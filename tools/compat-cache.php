<?php
/** Isolated cache/filesystem check; browser tests use real DokuWiki authentication. */
if (PHP_SAPI !== 'cli') die();
define('DOKU_INC', dirname(__DIR__) . '/.dev/wiki/');
$scratch = sys_get_temp_dir() . '/cesa-cache-' . bin2hex(random_bytes(8));
define('DOKU_PLUGIN', $scratch . '/plugins/');
$conf['metadir'] = $scratch . '/meta';
function auth_isadmin(): bool { return true; }
function actionOK($action): bool { return true; }
function io_mkdir_p($directory): bool { return is_dir($directory) || mkdir($directory, 0700, true); }
require dirname(__DIR__) . '/cesa/compat/repair.php';
function require_check(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}
io_mkdir_p(DOKU_PLUGIN . 'confmanager/configTypes');
try {
    $file = DOKU_PLUGIN . 'confmanager/configTypes/ConfigManagerTwoLine.php';
    copy(dirname(__DIR__) . '/.dev/original-plugins/confmanager/configTypes/ConfigManagerTwoLine.php', $file);
    $canary = $scratch . '/canary.php';
    file_put_contents($canary, '<?php return "old";');
    touch($canary, time() - 10);
    require_check((include $canary) === 'old', 'Cannot execute cache fixture.');
    file_put_contents($canary, '<?php return "new";');
    require_check(@opcache_invalidate($canary, true) === false, 'Run with a restricted OPCache API.');
    require_check((include $canary) === 'old', 'Run with OPCache enabled and timestamp validation disabled.');
    require_check(cesa_compat_update('confmanager') === false, 'Repair must report unsuccessful cache invalidation.');
    require_check(hash_file('sha256', $file) === cesa_compat_specs()['confmanager']['fixed'], 'Repair did not update the disk file.');
    echo "Restricted OPCache: stale execution reproduced; repair reports cache reset required.\n";
} finally {
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($scratch, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($iterator as $entry) {
        if ($entry->isDir()) rmdir($entry->getPathname());
        else unlink($entry->getPathname());
    }
    rmdir($scratch);
}
