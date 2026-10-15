#!/usr/bin/env python3
"""Create a disposable wiki from checksum-pinned sources."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
DEV = ROOT / '.dev'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--reset', action='store_true', help='Delete and recreate .dev/wiki')
parser.add_argument('--archive', type=Path, help='Install a release archive instead of linking cesa/')
parser.add_argument('--without-plugins', action='store_true', help='Skip optional plugins')
parser.add_argument('--php', default='php', help='PHP binary for password generation and seeding')
args = parser.parse_args()
wiki = DEV / 'wiki'
if wiki.exists():
    if not args.reset:
        raise SystemExit('.dev/wiki exists; use --reset to replace the disposable test installation.')
    shutil.rmtree(wiki)
DEV.mkdir(exist_ok=True)
environment = ROOT / '.env'
settings = environment.read_text() if environment.exists() else ''
for key, value in [('CESA_UID', getattr(os, 'getuid', lambda: 1000)()),
                   ('CESA_GID', getattr(os, 'getgid', lambda: 1000)())]:
    if not any(line.split('=', 1)[0].strip() == key for line in settings.splitlines()):
        settings = settings.rstrip('\n') + f'\n{key}={value}\n'
environment.write_text(settings.lstrip('\n'))

def unpack(archive, destination):
    with tarfile.open(archive, 'r:gz') as bundle:
        # Pinned upstream archives have a single leading directory, no links.
        for item in bundle.getmembers():
            parts = Path(item.name).parts[1:]
            if not parts:
                continue
            if item.issym() or item.islnk() or '..' in parts or Path(*parts).is_absolute():
                raise SystemExit(f'Unsafe archive member: {item.name}')
            item.name = str(Path(*parts))
            bundle.extract(item, destination, filter='data')

sources = json.loads((ROOT / 'tools/sources.json').read_text())
for name, source in sources.items():
    if args.without_plugins and name != 'mort':
        continue
    archive = DEV / f'{name}.tar.gz'
    if not archive.exists():
        print(f'Downloading {name}: {source["version"]}', flush=True)
        urllib.request.urlretrieve(source['url'], archive)
    if hashlib.sha256(archive.read_bytes()).hexdigest() != source['sha256']:
        raise SystemExit(f'Checksum mismatch: {archive}; remove it and retry.')
    unpack(archive, wiki if name == 'mort' else wiki / 'lib/plugins' / name)

tpl = wiki / 'lib/tpl/cesa'
if args.archive:
    # The release has exactly one top-level cesa/ directory.
    with tarfile.open(args.archive) as bundle:
        if any(Path(m.name).parts[0] != 'cesa' for m in bundle.getmembers()):
            raise SystemExit('Expected a Cesa release archive.')
    unpack(args.archive, tpl)
else:
    tpl.symlink_to(os.path.relpath(ROOT / 'cesa', tpl.parent), target_is_directory=True)

if not args.without_plugins:
    for name, patch in [('confmanager', 'confmanager-php82.patch'), ('hidingip', 'hidingip-mort.patch')]:
        subprocess.run(['patch', '-p1', '-F0', '-t', '-i', str((tpl / 'compat' / patch).resolve())],
                       cwd=wiki / 'lib/plugins' / name, check=True)
    math = ROOT / 'node_modules/mathjax'
    if not math.exists():
        raise SystemExit('Run npm ci first (local MathJax is a development dependency).')
    (wiki / 'lib/mathjax').symlink_to(os.path.relpath(math, wiki / 'lib'), target_is_directory=True)

password = 'cesa-test-only'
hashed = subprocess.check_output([args.php, '-r', 'echo password_hash($argv[1], PASSWORD_BCRYPT);', password], text=True)
(wiki / 'conf/users.auth.php').write_text('# <?php exit()?>\n' + ''.join(
    f'{user}:{hashed}:{user.title()}:cesa-{user}@example.invalid:{groups}\n'
    for user, groups in [('reader', 'user,reader'), ('editor', 'user,editor'), ('editor2', 'user,editor'), ('admin', 'user,admin')]
))
(wiki / 'conf/acl.auth.php').write_text('''# <?php exit()?>
* @ALL 1
* @editor 8
private:* @ALL 0
private:* @reader 1
private:* @editor 8
private:* @admin 16
''')
(wiki / 'conf/local.php').write_text('''<?php
$conf['title'] = 'Cesa';
$conf['template'] = 'cesa';
$conf['useacl'] = 1;
$conf['superuser'] = '@admin';
$conf['disableactions'] = 'register';
$conf['subscribers'] = 1;
$conf['updatecheck'] = 0;
$conf['dnslookups'] = 0;
$conf['userewrite'] = 0;
$conf['breadcrumbs'] = 0;
$conf['youarehere'] = 1;
$conf['sidebar'] = 'sidebar';
$conf['locktime'] = 300;
$conf['cachetime'] = 0;
$conf['plugin']['mathjax']['url'] = '/lib/mathjax/MathJax.js?config=TeX-AMS_CHTML';
''')
if not args.without_plugins:
    with (wiki / 'conf/local.php').open('a') as local:
        local.write("$conf['renderer_xhtml'] = 'linkfavicon';\n$conf['plugin']['cmsmode']['actions'] = '';\n")
shutil.copyfile(ROOT / 'tools/router.php', wiki / 'router.php')
(wiki / 'conf/report_e_all').touch()
seed = subprocess.run([args.php, str(ROOT / 'tools/seed.php'), str(wiki)], capture_output=True, text=True, check=True)
if 'Seeded ' not in seed.stdout or '<!DOCTYPE' in seed.stdout:
    raise SystemExit(f'Seeding failed:\n{seed.stdout}\n{seed.stderr}')
print(seed.stdout, end='')
print(f'Ready: {wiki}\nAccounts: reader / editor / editor2 / admin\nPassword: {password}\nDevelopment only: bind the server to 127.0.0.1.')
