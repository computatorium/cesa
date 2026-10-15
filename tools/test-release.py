#!/usr/bin/env python3
"""Check archive aliases, directory metadata, and release-date validation."""
from datetime import datetime, timedelta, timezone
import hashlib
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix='cesa-package-')
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        shutil.copytree(ROOT / 'cesa', self.root / 'cesa')
        shutil.copyfile(ROOT / 'package.json', self.root / 'package.json')
        (self.root / 'tools').mkdir()
        for name in ['release.py', 'release_info.py', 'template_files.py']:
            shutil.copyfile(ROOT / 'tools' / name, self.root / 'tools' / name)

    def build(self):
        env = {key: value for key, value in os.environ.items() if key != 'SOURCE_DATE_EPOCH'}
        return subprocess.run([sys.executable, 'tools/release.py'], cwd=self.root,
                              env=env, capture_output=True, text=True)

    def test_archives_checksums_and_directory_date(self):
        result = self.build()
        self.assertEqual(result.returncode, 0, result.stderr)
        dist = self.root / 'dist'
        versioned = next(file for file in dist.glob('cesa-*.tar.gz'))
        stable = dist / 'cesa.tar.gz'
        self.assertEqual(stable.read_bytes(), versioned.read_bytes())
        checksums = {name: checksum for checksum, name in
                     (line.split() for line in (dist / 'SHA256SUMS').read_text().splitlines())}
        self.assertEqual(set(checksums), {versioned.name, stable.name})
        for name, expected in checksums.items():
            self.assertEqual(hashlib.sha256((dist / name).read_bytes()).hexdigest(), expected)
        with tarfile.open(stable) as package:
            info = dict(line.split(None, 1) for line in package.extractfile('cesa/template.info.txt').read().decode().splitlines())
            self.assertEqual(info['phpmin'], '8.2')
        listing = (dist / 'dokuwiki.txt').read_text()
        self.assertEqual(re.search(r'^lastupdate\s*:\s*(.+)$', listing, re.M)[1], info['date'])
        self.assertIn('https://github.com/computatorium/cesa/releases/latest/download/cesa.tar.gz', listing)
        first = {file.name: file.read_bytes() for file in dist.iterdir()}
        result = self.build()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(first, {file.name: file.read_bytes() for file in dist.iterdir()})

    def test_invalid_and_future_dates_stop_before_packaging(self):
        file = self.root / 'cesa/template.info.txt'
        original = file.read_text()
        tomorrow = (datetime.now(timezone.utc).date() + timedelta(days=1)).isoformat()
        for value in ['2026-02-30', '20261015', '2026-10-15T12:00:00Z', tomorrow]:
            with self.subTest(date=value):
                file.write_text(re.sub(r'^date\s+.+$', 'date     ' + value, original, flags=re.M))
                result = self.build()
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('YYYY-MM-DD', result.stderr)
                self.assertFalse((self.root / 'dist').exists())


if __name__ == '__main__':
    unittest.main()
