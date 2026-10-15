"""Release metadata shared by the build and verification tools."""
from datetime import date, datetime, timezone
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
VERSION = json.loads((ROOT / 'package.json').read_text())['version']
if not re.fullmatch(r'\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?', VERSION):
    raise SystemExit('Invalid release version in package.json.')
ARCHIVE = ROOT / 'dist' / f'cesa-{VERSION}.tar.gz'
STABLE_ARCHIVE = ROOT / 'dist/cesa.tar.gz'
DIRECTORY_ENTRY = ROOT / 'dist/dokuwiki.txt'
INFO = dict(line.split(None, 1) for line in (ROOT / 'cesa/template.info.txt').read_text().splitlines() if line.strip())
RELEASE_DATE = INFO.get('date', '')
try:
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', RELEASE_DATE):
        raise ValueError
    if date.fromisoformat(RELEASE_DATE) > datetime.now(timezone.utc).date():
        raise ValueError
except ValueError:
    raise SystemExit('template.info.txt must contain a real release date in YYYY-MM-DD format, no later than today (UTC).')


def directory_entry():
    return f'''====== {INFO['name']} ======

---- template ----
description : {INFO['desc']}
author      : {INFO['author']}
lastupdate  : {RELEASE_DATE}
compatible  : Mort
downloadurl : https://github.com/computatorium/cesa/releases/latest/download/cesa.tar.gz
bugtracker  : https://github.com/computatorium/cesa/issues
sourcerepo  : https://github.com/computatorium/cesa
----
'''

if __name__ == '__main__':
    if len(sys.argv) == 1:
        print(VERSION)
    elif sys.argv[1:] == ['--date']:
        print(RELEASE_DATE)
    else:
        raise SystemExit('usage: release_info.py [--date]')
