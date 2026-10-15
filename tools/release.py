#!/usr/bin/env python3
"""Build an install archive with fixed metadata and a single cesa/ root."""
import gzip
import hashlib
import io
import os
from datetime import datetime, timezone
import tarfile
from template_files import template_files
from release_info import ARCHIVE, DIRECTORY_ENTRY, RELEASE_DATE, ROOT, STABLE_ARCHIVE, directory_entry

files = template_files(ROOT / 'cesa', tracked=True)
epoch = int(os.environ.get('SOURCE_DATE_EPOCH', datetime.strptime(RELEASE_DATE, '%Y-%m-%d').replace(tzinfo=timezone.utc).timestamp()))
output = io.BytesIO()
with tarfile.open(fileobj=output, mode='w', format=tarfile.PAX_FORMAT, dereference=True) as archive:
    for name, file in files.items():
        info = archive.gettarinfo(str(file), arcname='cesa/' + name)
        info.mtime = epoch
        info.uid = info.gid = 0
        info.uname = info.gname = ''
        info.mode = 0o644
        info.pax_headers = {}
        with file.open('rb') as stream:
            archive.addfile(info, stream)
destination = ARCHIVE
destination.parent.mkdir(exist_ok=True)
with destination.open('wb') as stream:
    with gzip.GzipFile(filename='', mode='wb', fileobj=stream, mtime=0, compresslevel=9) as compressed:
        compressed.write(output.getvalue())
digest = hashlib.sha256(destination.read_bytes()).hexdigest()
STABLE_ARCHIVE.write_bytes(destination.read_bytes())
(destination.parent / 'SHA256SUMS').write_text(''.join(f'{digest}  {file.name}\n' for file in [ARCHIVE, STABLE_ARCHIVE]))
DIRECTORY_ENTRY.write_text(directory_entry())
print(f'{destination.relative_to(ROOT)}: {destination.stat().st_size} bytes; SHA256 {digest}')
