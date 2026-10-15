<?php if (!defined('DOKU_INC')) die(); ?>
<footer id="dokuwiki__footer">
    <?php
    $footerParts = [];
    $licenseHtml = tpl_license('', false, true, false);
    if ($licenseHtml !== '') {
        $footerParts[] = hsc(tpl_getLang('license_label')) . ' ' . substr($licenseHtml, strlen($lang['license']) + 1);
    }
    if (!empty($cesaPageInfo) && preg_match('/<time\b[^>]*>.*?<\/time>/s', $cesaPageInfo, $date)) {
        $footerParts[] = hsc($lang['lastmod']) . ' ' . $date[0];
    }
    if ($footerParts) echo '<p class="cesa-footer-meta">' . implode(' | ', $footerParts) . '</p>';
    ?>
    <?php tpl_includeFile('footer.html') ?>
</footer>
