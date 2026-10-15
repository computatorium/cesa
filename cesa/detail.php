<?php
/** Based on Mort's image detail template. GPL-2.0-only. */
if (!defined('DOKU_INC')) die();
require_once __DIR__ . '/tpl_functions.php';
?><!DOCTYPE html>
<html lang="<?php echo hsc($conf['lang']) ?>" dir="<?php echo hsc($lang['direction']) ?>" class="no-js" data-appearance="<?php echo cesa_appearance() ?>" data-default-appearance="<?php echo cesa_appearance() ?>">
<head>
    <meta charset="utf-8" />
    <title><?php echo hsc(tpl_img_getTag('IPTC.Headline', $IMG)) ?> [<?php echo hsc(strip_tags($conf['title'])) ?>]</title>
    <?php cesa_head() ?>
</head>
<body>
<div id="dokuwiki__site"><div id="dokuwiki__top" class="site <?php echo tpl_classes() ?>" style="--article-width:<?php echo cesa_width() ?>">
    <?php include __DIR__ . '/tpl_header.php' ?>
    <div class="cesa-layout" id="dokuwiki__detail">
        <main id="dokuwiki__content" tabindex="-1">
            <?php html_msgarea() ?>
            <?php if (!$ERROR): $items = (new \dokuwiki\Menu\DetailMenu())->getListItems('action ', false); ?>
            <?php if ($items): ?><nav id="dokuwiki__pagetools" aria-label="<?php echo hsc($lang['page_tools']) ?>"><ul class="cesa-site-actions"><?php echo $items ?></ul></nav><?php endif ?>
            <?php endif ?>
            <div class="page group">
                <?php tpl_includeFile('pageheader.html') ?>
                <?php if ($ERROR): ?>
                    <h1><?php echo $ERROR ?></h1>
                <?php else: ?>
                    <?php if ($REV) echo p_locale_xhtml('showrev') ?>
                    <h1><?php echo nl2br(hsc(tpl_img_getTag('simple.title'))) ?></h1>
                    <?php tpl_img(1200, 900) ?>
                    <div class="img_detail">
                        <?php tpl_img_meta() ?>
                        <dl><dt><?php echo hsc($lang['reference']) ?>:</dt>
                        <?php
                        $usage = (new \dokuwiki\Search\MetadataSearch())->mediause($IMG);
                        if ($usage !== []) {
                            foreach ($usage as $path) echo '<dd>' . html_wikilink($path) . '</dd>';
                        } else {
                            echo '<dd>' . hsc($lang['nothingfound']) . '</dd>';
                        }
                        ?>
                        </dl>
                        <p><?php echo hsc($lang['media_acl_warning']) ?></p>
                    </div>
                <?php endif ?>
                <?php tpl_includeFile('pagefooter.html') ?>
            </div>
        </main>
    </div>
    <?php include __DIR__ . '/tpl_footer.php' ?>
</div></div>
<div class="no"><?php tpl_indexerWebBug() ?></div>
</body>
</html>
