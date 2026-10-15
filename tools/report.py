#!/usr/bin/env python3
"""Publish only complete passing evidence bound to the tested archive and browsers."""
import base64
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import tarfile
from urllib.parse import urlparse
from template_files import template_bytes
from release_info import ARCHIVE, VERSION

ROOT = Path(__file__).resolve().parents[1]

def require(condition, message):
    if not condition:
        raise SystemExit(message + '; verification record was not replaced.')


def entries(suites):
    for suite in suites:
        for spec in suite.get('specs', []):
            for test in spec['tests']:
                yield spec, test
        yield from entries(suite.get('suites', []))


def attachment(item):
    data = base64.b64decode(item['body']) if 'body' in item else Path(item['path']).read_bytes()
    return json.loads(data)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def tree(files):
    return sha(''.join(f'{name}\0{sha(data)}\n' for name, data in sorted(files.items())).encode())


result = json.loads((ROOT / 'test-results/results.json').read_text())
manifest = json.loads(subprocess.check_output(
    ['npx', 'playwright', 'test', '--list', '--reporter=json'], cwd=ROOT, text=True))
expected = {(spec['id'], test['projectName']) for spec, test in entries(manifest['suites'])}
actual = list(entries(result['suites']))
require(not result.get('errors'), 'Runner errors are present')
require(bool(expected) and len(actual) == len(expected) and
        {(spec['id'], test['projectName']) for spec, test in actual} == expected,
        'Latest run does not cover the full current test manifest')
require(result['stats']['expected'] == len(expected) and
        all(result['stats'].get(key, 0) == 0 for key in ['skipped', 'unexpected', 'flaky']),
        'Latest run is incomplete or contains skipped, failed or flaky tests')

archive = ARCHIVE
archive_sha = sha(archive.read_bytes())
require((ROOT / 'dist/SHA256SUMS').read_text() == f'{archive_sha}  {archive.name}\n',
        'Published checksum differs from the archive')
with tarfile.open(archive, 'r:gz') as package:
    members = package.getmembers()
    require(all(m.isfile() and m.name.startswith('cesa/') and '..' not in Path(m.name).parts for m in members),
            'Unexpected archive entries')
    archived = {m.name.removeprefix('cesa/'): package.extractfile(m).read() for m in members}
    require(len(archived) == len(members), 'Duplicate archive entries')
require(archived == template_bytes(ROOT / 'cesa'), 'Archive differs from current template source')
require(archived == template_bytes(ROOT / '.dev/wiki/lib/tpl/cesa'), 'Archive differs from installed template')
tree_sha = tree(archived)
tests, versions = [], {}
for spec, test in actual:
    require(len(test['results']) == 1 and test['results'][0]['status'] == 'passed' and
            test.get('expectedStatus') == 'passed' and test.get('status') == 'expected',
            f'Nonpassing or retried evidence: {spec["title"]}')
    run = test['results'][0]
    contexts = [attachment(item) for item in run.get('attachments', []) if item['name'] == 'cesa-verification-context']
    require(len(contexts) == 1, f'Missing run provenance: {spec["title"]}')
    context = contexts[0]
    require(context['archive_sha256'] == archive_sha and
            context['source_tree_sha256'] == tree_sha and context['installed_tree_sha256'] == tree_sha and
            context['installed_symlink'] is False, 'Tested template/archive does not match this extracted release')
    endpoint = urlparse(context['base_url'])
    require(endpoint.hostname in ['127.0.0.1', 'localhost', '::1'] and endpoint.port == 8088 and
            endpoint.path in ['', '/'], 'Evidence is not from the local release fixture')
    browser = test['projectName']
    require(browser not in versions or versions[browser] == context['browser_version'], 'Browser version changed during run')
    versions[browser] = context['browser_version']
    known = sum(attachment(item)['count'] for item in run.get('attachments', [])
                if item['name'] == 'upstream-webkit-unload-diagnostics')
    tests.append({'browser': browser, 'test': spec['title'], 'status': run['status'],
                  'duration_ms': run['duration'], 'known_upstream_unload_diagnostics': known})

prefix = ['php'] if os.environ.get('CESA_NATIVE') else ['docker', 'compose', 'exec', '-T', '-w', '/workspace', 'wiki', 'php']
php = subprocess.check_output(prefix + ['-r', 'echo PHP_VERSION;'], cwd=ROOT, text=True)
assets = json.loads(subprocess.check_output(prefix + ['tools/assets.php'], cwd=ROOT, text=True))
report = {
    'version': VERSION,
    'recorded_utc': datetime.now(timezone.utc).isoformat(),
    'platform': platform.platform(), 'php': php,
    'browsers': versions, 'sources': json.loads((ROOT / 'tools/sources.json').read_text()),
    'playwright': json.loads((ROOT / 'node_modules/@playwright/test/package.json').read_text())['version'],
    'optional_mathjax_runtime': '2.7.9 (development only)',
    'installation': 'Extracted release archive, verified against source and per-test provenance',
    'archive_sha256': archive_sha, 'template_tree_sha256': tree_sha,
    'archive_bytes': archive.stat().st_size, 'assets': assets,
    'stats': result['stats'], 'tests': tests,
}
destination = ROOT / 'docs/verification-results.json'
for appearance in ['light', 'dark']:
    shutil.copyfile(ROOT / f'docs/screenshots/chromium-1280-{appearance}.png',
                    ROOT / f'docs/screenshots/{appearance}.png')
temporary = destination.with_suffix('.json.tmp')
temporary.write_text(json.dumps(report, indent=2) + '\n')
temporary.replace(destination)
print(json.dumps({k: report[k] for k in ['php', 'browsers', 'stats', 'assets', 'archive_sha256']}, indent=2))
