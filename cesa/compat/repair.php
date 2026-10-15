<?php
if (!defined('DOKU_INC')) die();

function cesa_compat_specs(): array
{
    return [
        'confmanager' => [
            'name' => 'Confmanager',
            'file' => 'confmanager/configTypes/ConfigManagerTwoLine.php',
            'patch' => 'confmanager-php82.patch',
            'original' => '56e27a760f36d267ee3a2e481067d90ae34ae8eb4a60ca4266cdc9f7ad5047e5',
            'fixed' => '4d7c18252ae51070a137ee4ec8c96b2bc6b7d4dadbf9fde4cff73b6bfddd5825',
            'reason' => 'PHP 8.2 constructor compatibility',
        ],
        'hidingip' => [
            'name' => 'Hiding IPs',
            'file' => 'hidingip/action.php',
            'patch' => 'hidingip-mort.patch',
            'original' => 'e0f0dbba4fe27c0e4a927d08569ffa6243eedfdb973cb56a147576d4a8474ec9',
            'fixed' => '26988092f303c36d17475c35da5824f1d8a067e81eb564de66e79532242efbbc',
            'reason' => 'Mort revision/recent hooks and IPv6 addresses',
        ],
    ];
}

function cesa_compat_file(array $spec): ?string
{
    $root = realpath(DOKU_PLUGIN);
    if ($root === false) return null;
    $file = $root . '/' . $spec['file'];
    return is_file($file) && realpath($file) === $file ? $file : null;
}

function cesa_compat_backup(string $id, array $spec): string
{
    global $conf;
    return $conf['metadir'] . '/_cesa_compat/' . $id . '-' . $spec['original'] . '.bak';
}

function cesa_compat_status(string $id, array $spec): array
{
    $file = cesa_compat_file($spec);
    $hash = $file === null ? false : @hash_file('sha256', $file);
    $backup = cesa_compat_backup($id, $spec);
    return [
        'state' => $hash === $spec['original'] ? 'pending' : ($hash === $spec['fixed'] ? 'fixed' : ($file === null ? 'missing' : 'unknown')),
        'writable' => $file !== null && is_writable($file) && is_writable(dirname($file)),
        'backup' => is_file($backup) && !is_link($backup) && @hash_file('sha256', $backup) === $spec['original'],
    ];
}

/** Apply the bundled diff without a shell, offsets, or fuzzy matching. */
function cesa_compat_patch(string $source, string $patch): string
{
    $lines = explode("\n", $source);
    $diff = explode("\n", rtrim($patch, "\n"));
    $output = [];
    $cursor = 0;
    $i = 2;
    if (!str_starts_with($diff[0] ?? '', '--- a/') || !str_starts_with($diff[1] ?? '', '+++ b/')) {
        throw new RuntimeException('Invalid bundled patch.');
    }
    while ($i < count($diff)) {
        if (!preg_match('/^@@ -(\d+),(\d+) \+(\d+),(\d+) @@/', $diff[$i++], $hunk)) {
            throw new RuntimeException('Invalid patch hunk.');
        }
        $start = (int) $hunk[1] - 1;
        if ($start < $cursor || $start > count($lines)) throw new RuntimeException('Patch offset mismatch.');
        while ($cursor < $start) $output[] = $lines[$cursor++];
        $old = $new = 0;
        while ($i < count($diff) && !str_starts_with($diff[$i], '@@ ')) {
            $line = $diff[$i++];
            $kind = $line[0] ?? '';
            $text = substr($line, 1);
            if ($kind === ' ' || $kind === '-') {
                if (($lines[$cursor++] ?? null) !== $text) throw new RuntimeException('Patch context mismatch.');
                $old++;
            }
            if ($kind === ' ' || $kind === '+') {
                $output[] = $text;
                $new++;
            } elseif ($kind !== '-') {
                throw new RuntimeException('Invalid patch line.');
            }
        }
        if ($old !== (int) $hunk[2] || $new !== (int) $hunk[4]) throw new RuntimeException('Patch length mismatch.');
    }
    return implode("\n", array_merge($output, array_slice($lines, $cursor)));
}

function cesa_compat_write(string $file, string $contents, int $mode): void
{
    $temporary = @tempnam(dirname($file), '.cesa-');
    if ($temporary === false) throw new RuntimeException('Cannot create a temporary file.');
    try {
        if (@file_put_contents($temporary, $contents) !== strlen($contents) || !@chmod($temporary, $mode)) {
            throw new RuntimeException('Cannot write the replacement file.');
        }
        if (!@rename($temporary, $file)) throw new RuntimeException('Cannot replace the file.');
    } finally {
        if (is_file($temporary)) @unlink($temporary);
    }
}

function cesa_compat_read(string $file): string
{
    $contents = @file_get_contents($file);
    if ($contents === false) throw new RuntimeException('Cannot read a required file.');
    return $contents;
}

function cesa_compat_update(string $id, bool $restore = false): bool
{
    if (!auth_isadmin() || !actionOK('admin')) throw new RuntimeException('Administrator access required.');
    $spec = cesa_compat_specs()[$id] ?? null;
    if ($spec === null) throw new RuntimeException('Unknown plugin.');
    $backup = cesa_compat_backup($id, $spec);
    if (!io_mkdir_p(dirname($backup))) throw new RuntimeException('Cannot create the backup directory.');
    $lock = @fopen(dirname($backup) . '/repair.lock', 'c');
    if ($lock === false) throw new RuntimeException('Cannot open the repair lock.');
    try {
        if (!flock($lock, LOCK_EX)) throw new RuntimeException('Cannot lock the repair.');
        $status = cesa_compat_status($id, $spec);
        if (!$status['writable']) throw new RuntimeException('The plugin file or its directory is not writable by PHP.');
        if ($status['state'] !== ($restore ? 'fixed' : 'pending')) {
            throw new RuntimeException('File version changed or is unrecognized; no file was changed.');
        }
        $file = cesa_compat_file($spec);
        $source = cesa_compat_read($file);
        if (hash('sha256', $source) !== ($restore ? $spec['fixed'] : $spec['original'])) {
            throw new RuntimeException('The plugin changed during repair; no file was changed.');
        }
        if ($restore) {
            if (!$status['backup']) throw new RuntimeException('A verified original backup is unavailable.');
            $replacement = cesa_compat_read($backup);
        } else {
            $replacement = cesa_compat_patch($source, cesa_compat_read(__DIR__ . '/' . $spec['patch']));
        }
        $expected = $restore ? $spec['original'] : $spec['fixed'];
        if (hash('sha256', $replacement) !== $expected) throw new RuntimeException('Replacement checksum mismatch.');
        if (!$restore) {
            if (!$status['backup']) {
                if (file_exists($backup) || is_link($backup)) throw new RuntimeException('The existing backup is invalid; no file was changed.');
                cesa_compat_write($backup, $source, 0600);
            }
        }
        if (cesa_compat_file($spec) !== $file || hash_file('sha256', $file) !== hash('sha256', $source)) {
            throw new RuntimeException('The plugin changed during repair; no file was changed.');
        }
        cesa_compat_write($file, $replacement, fileperms($file) & 0777);
        $cacheActive = (bool) ini_get('opcache.enable') &&
            (!in_array(PHP_SAPI, ['cli', 'cli-server', 'phpdbg'], true) || (bool) ini_get('opcache.enable_cli'));
        return !$cacheActive || (function_exists('opcache_invalidate') && @opcache_invalidate($file, true));
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}
