<?php
// Authentication and CSRF checks run before any repair or backup access.
// Use the wiki's base path and session cookie from this template entry point.
$suffix = '/lib/tpl/cesa/compat.php';
$script = $_SERVER['SCRIPT_NAME'] ?? '';
if (!str_ends_with($script, $suffix)) {
    http_response_code(400);
    exit('Invalid entry point.');
}
$installed = $_SERVER['SCRIPT_FILENAME'] ?? __FILE__;
$root = dirname($installed, 4);
if (!is_file($root . '/inc/init.php')) {
    $root = rtrim($_SERVER['DOCUMENT_ROOT'] ?? '', '/') . substr($script, 0, -strlen($suffix));
}
if (!is_file($root . '/inc/init.php')) {
    http_response_code(500);
    exit('Cannot locate the DokuWiki installation.');
}
if (!defined('DOKU_INC')) define('DOKU_INC', $root . '/');
$_SERVER['SCRIPT_NAME'] = substr($script, 0, -strlen($suffix)) . '/doku.php';
$_SERVER['PHP_SELF'] = $_SERVER['SCRIPT_NAME'];
ob_start();
require_once DOKU_INC . 'inc/init.php';
$startup = ob_get_clean();
header('Cache-Control: no-store');
header('X-Frame-Options: DENY');
if (!auth_isadmin() || !actionOK('admin') || $conf['template'] !== 'cesa') {
    http_response_code(403);
    exit('Administrator access with Cesa enabled is required.');
}
require_once __DIR__ . '/tpl_functions.php';
require_once __DIR__ . '/compat/repair.php';
$self = tpl_basedir() . 'compat.php';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!hash_equals(getSecurityToken(), $INPUT->post->str('sectok'))) {
        http_response_code(403);
        msg('Security token did not match.', -1);
    } else {
        try {
            $action = $INPUT->post->str('action');
            if (!in_array($action, ['repair', 'restore'], true)) throw new RuntimeException('Unknown action.');
            $cacheReady = cesa_compat_update($INPUT->post->str('plugin'), $action === 'restore');
            if ($cacheReady) {
                msg($action === 'restore' ? 'Original plugin file restored.' : 'Plugin repaired. The original file was backed up.', 1);
            } else {
                msg('File updated on disk, but PHP refused to refresh its opcode cache. Reset PHP through your hosting panel or ask your host before relying on this change.', -1);
            }
            send_redirect($self);
        } catch (RuntimeException $error) {
            http_response_code(409);
            msg($error->getMessage(), -1);
        }
    }
}
$ID = $conf['start'];
$INFO = pageinfo();
$ACT = 'admin';
jsinfo();
?><!DOCTYPE html>
<html lang="<?php echo hsc($conf['lang']) ?>" dir="<?php echo hsc($lang['direction']) ?>" class="no-js" data-appearance="<?php echo cesa_appearance() ?>" data-default-appearance="<?php echo cesa_appearance() ?>">
<head>
    <meta charset="utf-8" />
    <title>Plugin compatibility [<?php echo hsc(strip_tags($conf['title'])) ?>]</title>
    <?php cesa_head() ?>
</head>
<body>
<div id="dokuwiki__site"><div id="dokuwiki__top" class="site <?php echo tpl_classes() ?>" style="--article-width:<?php echo cesa_width() ?>">
    <?php include __DIR__ . '/tpl_header.php' ?>
    <main id="dokuwiki__content" tabindex="-1">
        <?php html_msgarea() ?>
        <div class="page group">
            <h1>Plugin compatibility</h1>
            <p>Repair the known Confmanager and Hiding IPs versions for PHP 8.2 and Mort. Each repair saves the original file for restoration. Plugin settings stay in DokuWiki's configuration.</p>
            <?php if (trim($startup) !== ''): ?><pre><?php echo hsc(strip_tags($startup)) ?></pre><?php endif ?>
            <?php foreach (cesa_compat_specs() as $id => $spec): $status = cesa_compat_status($id, $spec); ?>
            <section data-plugin="<?php echo hsc($id) ?>">
                <h2><?php echo hsc($spec['name']) ?></h2>
                <p><?php echo hsc($spec['reason']) ?>.</p>
                <p class="compat-status"><?php echo [
                    'pending' => 'Known version; repair available.',
                    'fixed' => 'Compatible file on disk.',
                    'missing' => 'File missing or linked; no changes available.',
                    'unknown' => 'Unrecognized version; no changes available.',
                ][$status['state']] ?><?php if (!$status['writable'] && $status['state'] === 'pending'): ?> The file or directory is not writable by PHP.<?php endif ?></p>
                <?php if ($status['writable'] && ($status['state'] === 'pending' || ($status['state'] === 'fixed' && $status['backup']))): ?>
                <form action="<?php echo hsc($self) ?>" method="post">
                    <?php echo formSecurityToken(false) ?>
                    <input type="hidden" name="plugin" value="<?php echo hsc($id) ?>" />
                    <button type="submit" name="action" value="<?php echo $status['state'] === 'pending' ? 'repair' : 'restore' ?>"><?php echo $status['state'] === 'pending' ? 'Repair' : 'Restore original' ?></button>
                </form>
                <?php endif ?>
            </section>
            <?php endforeach ?>
            <p><a href="<?php echo wl($ID, ['do' => 'admin', 'page' => 'extension']) ?>">Extension Manager</a></p>
        </div>
    </main>
    <?php $cesaPageInfo = ''; include __DIR__ . '/tpl_footer.php' ?>
</div></div>
</body>
</html>
