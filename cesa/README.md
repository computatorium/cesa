# Cesa

A minimal template for DokuWiki 2026-07-14c “Mort”, requiring PHP 8.2+.

## Install

Extract the Cesa release archive into `lib/tpl/`. Select `cesa` in Configuration Manager, or add this to `conf/local.php`:

```php
$conf['template'] = 'cesa';
```

Back up `conf/local.php` before switching templates. Pages and ACLs need no migration.

## Settings

```php
$conf['tpl']['cesa']['articleWidth'] = '88ch'; // 40ch–130ch
$conf['tpl']['cesa']['rail'] = 1;
$conf['tpl']['cesa']['logo'] = 0;
$conf['tpl']['cesa']['appearance'] = 'system'; // system, light, dark
```

The title, sidebar, permissions, and available actions come from DokuWiki. Hierarchical breadcrumbs follow `youarehere`; the trace and tagline are omitted. The sidebar sits in the margin when it fits and above the content otherwise. Turning off the rail leaves the native contents list in the article. The optional logo uses DokuWiki's media lookup, then the bundled fallback.

Appearance selection is saved in local storage. System mode follows the operating system. Blocked storage still permits a selection for the current document. Without JavaScript, the configured appearance, navigation, and server forms work normally.

## Styles

Use `conf/userstyle.css` for screen overrides, `conf/userprint.css` for print, or `conf/userall.css` for both. Mort also accepts the corresponding `.less` files. Palette placeholders belong in `conf/tpl/cesa/style.ini`:

```ini
[replacements]
__link__ = "#205c85"
__existing__ = "#205c85"
```

CSS properties control both palettes and typography. Override `--serif`, `--sans`, `--mono`, `--font-article`, `--font-ui`, `--control-height`, or `--gutter` as needed. Dark colors can be scoped to `:root[data-theme="dark"]`; for the JavaScript-disabled fallback, also use `:root[data-appearance="dark"]` and the system preference media query.

Fonts are local: Charter/Georgia for articles, Lucida Grande/Segoe UI for controls, and SFMono-Regular/Menlo for code, with further fallbacks in `css/typography.css`. Shared styles cover screen, print, forms, editor, media, and administration. Mathematical symbols retain MathJax's own glyph fonts.

Standard `meta.html`, `header.html`, `sidebarheader.html`, `sidebarfooter.html`, `pageheader.html`, `pagefooter.html`, and `footer.html` includes are supported. Keep custom includes outside the template directory when upgrading.

## Editing and plugins

Editing uses DokuWiki's source editor, toolbar, preview, drafts, and locks. The template does not change page storage or ACLs.

Wrap and the legacy MathJax 2 plugin have optional compatibility styles. Install them separately; neither is bundled or required. The tested MathJax plugin needs the MathJax 2 runtime; MathJax 3 and 4 do not work with it.

## Upgrade or roll back

Back up `lib/tpl/cesa/`, replace it with the new archive, then save Configuration Manager settings or run `touch conf/local.php` and reload the browser to recompile cached assets.

To roll back, select the previous template or restore its `$conf['template']` setting. Restore the previous template directory if needed. Content and ACLs are unaffected.

GPL-2.0-only. See [LICENSE](LICENSE), [COPYRIGHT](COPYRIGHT), and the Lucide notices in `images/lucide/`.
