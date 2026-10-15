"""Release names shared by the build and verification tools."""
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
VERSION = json.loads((ROOT / 'package.json').read_text())['version']
if not re.fullmatch(r'\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?', VERSION):
    raise SystemExit('Invalid release version in package.json.')
ARCHIVE = ROOT / 'dist' / f'cesa-{VERSION}.tar.gz'

if __name__ == '__main__':
    print(VERSION)
