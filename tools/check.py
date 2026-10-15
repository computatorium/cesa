#!/usr/bin/env python3
"""Lint PHP 8.2, compile template assets with Mort, and inspect live runtime diagnostics."""
import argparse
import json
from pathlib import Path
import re
import subprocess
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--native', action='store_true', help='Use host PHP instead of the PHP 8.2 container')
parser.add_argument('--url', default='http://127.0.0.1:8088')
args = parser.parse_args()
prefix = ['php'] if args.native else ['docker', 'compose', 'exec', '-T', '-w', '/workspace', 'wiki', 'php']
phpfiles = sorted((ROOT / 'cesa').rglob('*.php')) + sorted((ROOT / 'tools').glob('*.php'))
for file in phpfiles:
    result = subprocess.run(prefix + ['-l', str(file.relative_to(ROOT))], cwd=ROOT, capture_output=True, text=True)
    if result.returncode:
        raise SystemExit(result.stdout + result.stderr)
result = subprocess.run(prefix + ['tools/assets.php'], cwd=ROOT, capture_output=True, text=True)
try:
    sizes = json.loads(result.stdout)
except json.JSONDecodeError:
    raise SystemExit('Asset compilation failed:\n' + result.stdout + result.stderr)
if result.returncode:
    raise SystemExit('Asset budget check failed:\n' + result.stdout + result.stderr)
print(f'PHP syntax: {len(phpfiles)} files; asset budgets passed: {sizes}')
bad = re.compile(r'(?:<b>(?:Fatal error|Warning|Deprecated)</b>|(?:^|\n)(?:Fatal error|Warning|Deprecated):|unforeseen error|fatal error occur+ed during compilation)', re.I)
for target in ['/doku.php?id=start', '/doku.php?id=technical', '/doku.php?id=private:secret', '/doku.php?id=start&do=media&image=landscape.png', '/lib/exe/css.php?t=cesa', '/lib/exe/js.php?t=cesa', '/lib/exe/detail.php?media=landscape.png', '/lib/exe/mediamanager.php?ns=&edid=wiki__text']:
    body = urllib.request.urlopen(args.url + target).read().decode()
    if bad.search(body):
        raise SystemExit(f'Runtime diagnostic in {target}')
print('Runtime documents and compiled CSS/JS: no PHP warnings or compilation errors.')
if not args.native:
    logs = subprocess.check_output(['docker', 'compose', 'logs', 'wiki'], cwd=ROOT, text=True)
    diagnostics = [line for line in logs.splitlines() if re.search(r'(?:PHP (?:Warning|Fatal|Deprecated)|Uncaught)', line)]
    if diagnostics:
        raise SystemExit('\n'.join(diagnostics))
    print('PHP 8.2 server log: no warnings, fatal errors or deprecations.')
errors = ROOT / '.dev/wiki/data/log/error'
if errors.exists() and any(p.stat().st_size for p in errors.rglob('*.log')):
    raise SystemExit('DokuWiki error log is not empty. Inspect .dev/wiki/data/log/error.')
