<?php if (!defined('DOKU_INC')) die(); ?>
<a class="cesa-skip" href="#dokuwiki__content"><?php echo hsc($lang['skip_to_content']) ?></a>
<header id="dokuwiki__header">
    <?php tpl_includeFile('header.html') ?>
    <div class="cesa-header-row">
        <div class="cesa-identity">
            <a class="cesa-title" href="<?php echo wl() ?>" accesskey="h" title="<?php echo hsc(tpl_getLang('home')) ?>">
                <?php if (tpl_getConf('logo')):
                    $logo = tpl_getMediaFile([':wiki:logo.svg', ':logo.svg', ':wiki:logo.png', ':logo.png', 'images/logo.svg'], false);
                ?><img src="<?php echo hsc($logo) ?>" width="28" height="28" alt="" /><?php endif ?>
                <?php echo hsc(strip_tags($conf['title'])) ?>
            </a>
        </div>
        <div class="cesa-header-controls">
            <?php cesa_appearance_control() ?>
            <?php if ($conf['useacl']): $userItems = (new \dokuwiki\Menu\UserMenu())->getListItems('action ', false); ?>
            <?php if ($userItems): ?>
            <details id="dokuwiki__usertools" class="cesa-menu">
                <summary><span><?php echo hsc(tpl_getLang('account')) ?></span></summary>
                <ul>
                    <?php if (!empty($_SERVER['REMOTE_USER'])): ?><li class="user"><?php tpl_userinfo() ?></li><?php endif ?>
                    <?php echo $userItems ?>
                </ul>
            </details>
            <?php endif; endif ?>
        </div>
        <?php if (actionOK('search')): ?><div id="dokuwiki__sitetools"><label for="qsearch__in" class="a11y"><?php echo hsc($lang['btn_search']) ?></label><?php tpl_searchform() ?></div><?php endif ?>
    </div>
    <div class="cesa-subheader">
        <?php if ($conf['youarehere']): ?><nav class="breadcrumbs" aria-label="<?php echo hsc(tpl_getLang('breadcrumbs')) ?>"><?php echo preg_replace('/<span class="bchead">.*?<\/span>/s', '', tpl_youarehere(' / ', true), 1) ?></nav><?php endif ?>
        <nav aria-label="<?php echo hsc($lang['site_tools']) ?>"><ul class="cesa-site-actions"><?php echo (new \dokuwiki\Menu\SiteMenu())->getListItems('action ', false) ?></ul></nav>
    </div>
</header>
