<?php
/** Based on DokuWiki's Mort default template. GPL-2.0-only. */
if (!defined('DOKU_INC')) die();
require_once __DIR__ . '/tpl_functions.php';
$sidebar = '';
$toc = '';
// Fetch navigation only after the page's read permission is established.
if (tpl_getConf('rail') && $ACT === 'show' && $INFO['perm'] >= AUTH_READ) {
    if (!empty($conf['sidebar'])) {
        $sidebar = (string) tpl_include_page($conf['sidebar'], false, true, true);
    }
    $toc = tpl_toc(true);
}
if (tpl_getConf('rail') && $ACT === 'admin') $toc = tpl_toc(true);
// The surrounding disclosure replaces the core TOC toggle.
$toc = preg_replace('/<h3 class="toggle">.*?<\/h3>/s', '', $toc, 1);
$hasSidebar = trim(strip_tags($sidebar)) !== '' || preg_match('/<(?:img|svg|video|audio|table)\b/i', $sidebar);
$hasRail = $hasSidebar || $toc !== '';
?><!DOCTYPE html>
<html lang="<?php echo hsc($conf['lang']) ?>" dir="<?php echo hsc($lang['direction']) ?>" class="no-js" data-appearance="<?php echo cesa_appearance() ?>" data-default-appearance="<?php echo cesa_appearance() ?>">
<head>
    <meta charset="utf-8" />
    <title><?php tpl_pagetitle() ?> [<?php echo hsc(strip_tags($conf['title'])) ?>]</title>
    <?php cesa_head() ?>
</head>
<body>
<div id="dokuwiki__site"><div id="dokuwiki__top" class="site <?php echo tpl_classes() ?><?php echo $hasRail ? ' cesa-has-rail' : '' ?>" style="--article-width:<?php echo cesa_width() ?>">
    <?php include __DIR__ . '/tpl_header.php' ?>
    <div class="cesa-layout <?php echo $hasRail ? 'has-rail' : '' ?>">
        <?php if ($hasRail): ?>
        <nav id="dokuwiki__aside" aria-label="<?php echo hsc(tpl_getLang('navigation')) ?>">
            <?php if ($hasSidebar): ?>
            <details class="cesa-navigation">
                <summary><span><?php echo hsc($lang['sidebar']) ?></span></summary>
                <div class="aside include">
                    <?php tpl_includeFile('sidebarheader.html') ?>
                    <?php echo $sidebar ?>
                    <?php tpl_includeFile('sidebarfooter.html') ?>
                </div>
            </details>
            <?php endif ?>
            <?php if ($toc !== ''): ?>
            <details class="cesa-navigation">
                <summary><span><?php echo hsc(tpl_getLang('contents')) ?></span></summary>
                <?php echo $toc ?>
            </details>
            <?php endif ?>
        </nav>
        <?php endif ?>
        <main id="dokuwiki__content" tabindex="-1">
            <?php html_msgarea() ?>
            <?php cesa_page_actions() ?>
            <div class="page group">
                <?php tpl_includeFile('pageheader.html') ?>
                <!-- wikipage start -->
                <?php // Old revisions have no stored TOC; tpl_content() renders it inline when the rail has none. ?>
                <?php tpl_content($toc === '') ?>
                <!-- wikipage stop -->
                <?php tpl_includeFile('pagefooter.html') ?>
            </div>
        </main>
    </div>
    <?php $cesaPageInfo = tpl_pageinfo(true); include __DIR__ . '/tpl_footer.php' ?>
</div></div>
<div class="no"><?php tpl_indexerWebBug() ?></div>
</body>
</html>
