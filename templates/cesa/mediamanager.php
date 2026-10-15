<?php
/** Based on Mort's media manager template. GPL-2.0-only. */
if (!defined('DOKU_INC')) die();
require_once __DIR__ . '/tpl_functions.php';
?><!DOCTYPE html>
<html lang="<?php echo hsc($conf['lang']) ?>" dir="<?php echo hsc($lang['direction']) ?>" class="popup no-js" data-appearance="<?php echo cesa_appearance() ?>" data-default-appearance="<?php echo cesa_appearance() ?>">
<head>
    <meta charset="utf-8" />
    <title><?php echo hsc($lang['mediaselect']) ?> [<?php echo hsc(strip_tags($conf['title'])) ?>]</title>
    <?php cesa_head() ?>
</head>
<body>
<a class="cesa-skip" href="#mediamgr__content"><?php echo hsc($lang['skip_to_content']) ?></a>
<div id="media__manager" class="dokuwiki">
    <?php html_msgarea() ?>
    <nav id="mediamgr__aside"><div class="pad">
        <h1><?php echo hsc($lang['mediaselect']) ?></h1>
        <?php cesa_appearance_control() ?>
        <div id="media__opts"></div>
        <?php tpl_mediaTree() ?>
    </div></nav>
    <main id="mediamgr__content" tabindex="-1"><div class="pad"><?php tpl_mediaContent() ?></div></main>
</div>
</body>
</html>
