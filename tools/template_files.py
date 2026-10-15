"""Shared file selection for releases and verification."""
from pathlib import Path
import subprocess


def template_files(directory, tracked=False):
    directory = Path(directory)
    if not directory.is_dir() or directory.is_symlink():
        raise SystemExit(f'Expected an extracted template directory: {directory}')
    files = {}
    for file in sorted(directory.rglob('*')):
        relative = file.relative_to(directory)
        if any(part.startswith('.') for part in relative.parts):
            continue
        if file.is_symlink() or not (file.is_dir() or file.is_file()):
            raise SystemExit(f'Unsupported template entry: {file}')
        if file.is_file():
            files[relative.as_posix()] = file
    repository = None
    if tracked:
        try:
            result = subprocess.run(['git', 'rev-parse', '--show-toplevel'], cwd=directory, capture_output=True, text=True)
            if result.returncode == 0:
                repository = Path(result.stdout.strip())
        except FileNotFoundError:
            pass
    if repository:
        prefix = directory.resolve().relative_to(repository).as_posix()
        names = subprocess.check_output(
            ['git', 'ls-files', '--cached', '-z', '--', prefix], cwd=repository
        ).decode().split('\0')
        expected = {
            Path(name).relative_to(prefix).as_posix() for name in names if name and
            not any(part.startswith('.') for part in Path(name).relative_to(prefix).parts)
        }
        unstaged = subprocess.run(['git', 'diff', '--quiet', '--', prefix], cwd=repository).returncode
        if expected != set(files) or unstaged:
            raise SystemExit('Template differs from the Git index; stage changes before building.')
    return files


def template_bytes(directory):
    return {name: file.read_bytes() for name, file in template_files(directory).items()}
