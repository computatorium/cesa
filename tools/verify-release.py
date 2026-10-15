#!/usr/bin/env python3
"""Build twice to check reproducibility, then verify installations without and with plugins."""
from pathlib import Path
import subprocess
import sys
from template_files import template_bytes

ROOT = Path(__file__).resolve().parents[1]

def run(*args):
    subprocess.run(args, cwd=ROOT, check=True)

run(sys.executable, 'tools/release.py')
first = (ROOT / 'dist/cesa-1.0.0.tar.gz').read_bytes()
run(sys.executable, 'tools/release.py')
if first != (ROOT / 'dist/cesa-1.0.0.tar.gz').read_bytes():
    raise SystemExit('Release is not reproducible.')
run('docker', 'compose', 'down')
run(sys.executable, 'tools/bootstrap.py', '--reset', '--archive', 'dist/cesa-1.0.0.tar.gz', '--without-plugins')
run('docker', 'compose', 'up', '-d', '--wait')
run('node', 'tools/core-smoke.js')
run(sys.executable, 'tools/check.py')
run('docker', 'compose', 'down')
run(sys.executable, 'tools/bootstrap.py', '--reset', '--archive', 'dist/cesa-1.0.0.tar.gz')
run('docker', 'compose', 'up', '-d', '--wait')
installed = ROOT / '.dev/wiki/lib/tpl/cesa'
expected = template_bytes(ROOT / 'cesa')
actual = template_bytes(installed)
if expected != actual:
    raise SystemExit('Installed archive differs from the template source.')
run('npm', 'test')
run(sys.executable, 'tools/check.py')
run(sys.executable, 'tools/report.py')
print('Archive reproducibility, both clean installations, browser workflows, PHP and assets passed.')
