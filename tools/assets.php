<?php
/** Measure template assets through Mort's compiler. */
if (PHP_SAPI !== 'cli') die();
define('DOKU_INC', dirname(__DIR__) . '/.dev/wiki/');
define('SIMPLE_TEST', true);
$_SERVER['HTTP_HOST'] = '127.0.0.1:8088';
$_SERVER['SERVER_PORT'] = '8088';
$_SERVER['SCRIPT_NAME'] = '/doku.php';
// Mort's LESS parser exits directly on failure.
$measured = false;
register_shutdown_function(static function () use (&$measured) {
    if (!$measured) {
        fwrite(STDERR, "Asset compilation failed.\n");
        exit(1);
    }
});
require DOKU_INC . 'lib/exe/css.php';
$style = new \dokuwiki\StyleUtils('cesa');
$ini = $style->cssStyleini();
$css = '';
foreach ($ini['stylesheets'] as $media => $files) {
    foreach ($files as $file => $base) $css .= '@media ' . $media . '{' . css_loadfile($file, $base) . '}';
}
$css = css_compress(css_parseless(css_applystyle($css, $ini['replacements'])));
if (str_contains($css, 'fatal error')) throw new \RuntimeException('CSS compilation failed');
$root = dirname(__DIR__) . '/cesa/';
$locale = json_encode(['template' => ['cesa' => tpl_getLang('js')]], JSON_THROW_ON_ERROR);
$js = file_get_contents($root . 'appearance.js') . file_get_contents($root . 'script.js') . $locale;
$enhancement = (new \splitbrain\JSStrip\JSStrip())->compress(file_get_contents($root . 'script.js'));
$sizes = [
    'css_gzip_bytes' => strlen(gzencode($css, 9)),
    // Core minifies script.js; the early inline appearance script remains unminified.
    'js_gzip_bytes' => strlen(gzencode(file_get_contents($root . 'appearance.js'), 9)) + strlen(gzencode($enhancement, 9)) + strlen(gzencode($locale, 9)),
    'js_source_gzip_bytes' => strlen(gzencode(file_get_contents($root . 'appearance.js'), 9)) + strlen(gzencode(file_get_contents($root . 'script.js'), 9)) + strlen(gzencode($locale, 9)),
    'css_bytes' => strlen($css), 'js_source_bytes' => strlen($js),
];
$measured = true;
echo json_encode($sizes, JSON_PRETTY_PRINT) . "\n";
if ($sizes['css_gzip_bytes'] > 40 * 1024 || $sizes['js_gzip_bytes'] > 5 * 1024) exit(1);
