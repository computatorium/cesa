#!/usr/bin/env python3
"""Build twice to check reproducibility, then verify installations without and with plugins."""
import subprocess
import sys
from template_files import template_bytes
from release_info import ARCHIVE, DIRECTORY_ENTRY, ROOT, STABLE_ARCHIVE

def run(*args):
    subprocess.run(args, cwd=ROOT, check=True)

run(sys.executable, 'tools/test-release.py')
run(sys.executable, 'tools/release.py')
outputs = [ARCHIVE, STABLE_ARCHIVE, DIRECTORY_ENTRY, ROOT / 'dist/SHA256SUMS']
first = {file: file.read_bytes() for file in outputs}
run(sys.executable, 'tools/release.py')
if first != {file: file.read_bytes() for file in outputs}:
    raise SystemExit('Release is not reproducible.')
run('docker', 'compose', 'down')
run(sys.executable, 'tools/bootstrap.py', '--reset', '--archive', str(STABLE_ARCHIVE), '--without-plugins')
run('docker', 'compose', 'up', '-d', '--wait')
run('node', 'tools/core-smoke.js')
run(sys.executable, 'tools/check.py')
run('docker', 'compose', 'down')
run(sys.executable, 'tools/bootstrap.py', '--reset', '--archive', str(ARCHIVE))
run('docker', 'compose', 'up', '-d', '--wait')
installed = ROOT / '.dev/wiki/lib/tpl/cesa'
expected = template_bytes(ROOT / 'cesa')
actual = template_bytes(installed)
if expected != actual:
    raise SystemExit('Installed archive differs from the template source.')
run('docker', 'compose', 'exec', '-T', '-w', '/workspace', 'wiki', 'php',
    '-d', 'opcache.enable_cli=1', '-d', 'opcache.validate_timestamps=0',
    '-d', 'opcache.file_update_protection=0', '-d', 'opcache.restrict_api=/cesa-no-api',
    'tools/compat-cache.php')
run('npm', 'test')
run(sys.executable, 'tools/check.py')
run(sys.executable, 'tools/report.py')
print('Archive reproducibility, both clean installations, browser workflows, PHP and assets passed.')
