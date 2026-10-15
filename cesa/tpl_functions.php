<?php
if (!defined('DOKU_INC')) die();

function cesa_appearance(): string
{
    $mode = tpl_getConf('appearance');
    return in_array($mode, ['system', 'light', 'dark'], true) ? $mode : 'system';
}

function cesa_width(): string
{
    $width = (string) tpl_getConf('articleWidth');
    return preg_match('/^(?:[4-9][0-9]|1[0-2][0-9]|130)ch$/D', $width) ? $width : '88ch';
}

function cesa_head(): void
{
    // Apply the stored appearance before the stylesheet can paint.
    tpl_inlineScript(file_get_contents(__DIR__ . '/appearance.js'));
    tpl_metaheaders();
    echo '<meta name="viewport" content="width=device-width,initial-scale=1" />';
    echo tpl_favicon(['favicon', 'mobile']);
    tpl_includeFile('meta.html');
}

function cesa_appearance_icon(string $mode): string
{
    $names = ['system' => 'monitor', 'light' => 'sun', 'dark' => 'moon'];
    return str_replace('<svg', '<svg aria-hidden="true" focusable="false"', file_get_contents(__DIR__ . '/images/lucide/' . $names[$mode] . '.svg'));
}

function cesa_appearance_control(): void
{
    $label = hsc(tpl_getLang('appearance'));
    echo '<details class="cesa-appearance cesa-menu" aria-label="' . $label . '" hidden><summary aria-label="' . $label . '" title="' . $label . '">';
    foreach (['system', 'light', 'dark'] as $mode) {
        echo '<span class="cesa-theme-icon" data-mode="' . $mode . '">' . cesa_appearance_icon($mode) . '</span>';
    }
    echo '</summary><ul>';
    foreach (['system', 'light', 'dark'] as $mode) {
        echo '<li><button type="button" data-appearance="' . $mode . '" aria-pressed="false">' . cesa_appearance_icon($mode) . '<span>' . hsc(tpl_getLang($mode)) . '</span></button></li>';
    }
    echo '</ul></details>';
}

/** Build PageMenu once so MENU_ITEMS_ASSEMBLY handlers run once. */
function cesa_page_actions(): void
{
    global $lang, $INFO;
    if ($INFO['perm'] < AUTH_READ) return;
    $primary = '';
    $secondary = '';
    foreach ((new \dokuwiki\Menu\PageMenu())->getItems() as $item) {
        $link = $item->asHtmlLink('action ', false);
        if ($item instanceof \dokuwiki\Menu\Item\Edit) {
            $primary .= $link;
        } else {
            $secondary .= '<li class="action ' . hsc($item->getType()) . '">' . $link . '</li>';
        }
    }
    if (!$primary && !$secondary) return;
    echo '<nav id="dokuwiki__pagetools" aria-label="' . hsc($lang['page_tools']) . '">';
    echo $primary;
    if ($secondary) {
        echo '<details class="cesa-menu"><summary><span>' . hsc($lang['page_tools']) . '</span></summary><ul>' . $secondary . '</ul></details>';
    }
    echo '</nav>';
}
