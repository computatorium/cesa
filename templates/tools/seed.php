<?php
/** Seed pages through DokuWiki's storage and index APIs. */
if (PHP_SAPI !== 'cli') die();
define('DOKU_INC', rtrim($argv[1], '/') . '/');
$_SERVER['HTTP_HOST'] = '127.0.0.1:8088';
$_SERVER['SERVER_PORT'] = '8088';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['SCRIPT_NAME'] = '/doku.php';
require DOKU_INC . 'inc/init.php';
$_SERVER['REMOTE_USER'] = 'admin';
$INFO['userinfo'] = ['name' => 'Admin', 'mail' => 'cesa-admin@example.invalid', 'grps' => ['admin']];
$pages = [
    'public:start' => "====== Public notebook ======\n\nA public namespace, readable without an account. See [[start|the home page]].\n",
    'sidebar' => "  * [[start|Home]]\n  * [[essay|On keeping a notebook]]\n  * [[bookmarks|Bookmarks]]\n  * [[notes:start|Everyday notes]]\n  * [[technical|Technical reference]]\n  * [[plugins|Wrap & mathematics]]\n  * [[rtl|Languages]]\n  * [[https://www.dokuwiki.org/|DokuWiki]]\n",
    'start' => "====== Notebook ======\n\nExample pages for testing Cesa.\n\n===== Read =====\n\n[[essay|On keeping a notebook]] covers sources and reproducible records.\n\n[[bookmarks|Bookmarks]] contains external links and nested lists.\n\n===== Work =====\n\n[[notes:start|Everyday notes]] contains short entries. [[technical|Technical reference]] includes code, tables, and images.\n\n===== Explore =====\n\n[[plugins|Mathematics and callouts]], [[rtl|writing directions]], and [[missing_page|a missing page]].\n\nThis sentence has a footnote.((Footnotes link back to the referring sentence.))\n",
    'essay' => file_get_contents(__DIR__ . '/fixtures/essay.txt'),
    'bookmarks' => "====== Bookmarks ======\n\nA short list, arranged as ordinary wiki content.\n\n===== Reading =====\n\n  * [[https://ncatlab.org/nlab/show/HomePage|nLab]] — mathematics as an interconnected notebook.\n  * [[https://wiki.c2.com/|WikiWikiWeb]] — simple pages and conversations.\n  * [[https://www.gutenberg.org/|Project Gutenberg]] — books to keep returning to.\n    * [[https://www.gutenberg.org/ebooks/author/37|Montaigne]] — essays.\n\n===== Making =====\n\n  * [[technical|Technical reference]]\n  * [[https://www.dokuwiki.org/|DokuWiki]]\n  * https://example.org/" . str_repeat('a-long-path-segment/', 20) . "\n\n===== Later =====\n\n  - Return to the [[essay|notebook essay]].\n  - Follow one link, then add a sentence about it.\n",
    'notes:start' => "====== Everyday notes ======\n\n===== This week =====\n\n  * Replace the bicycle brake pads.\n  * Read chapter three.\n    * Check the cited paper.\n      * Record its publication date.\n  * [[notes:question|A small question]]\n\n===== Errands =====\n\nReturn the library books.\n\n===== Tomorrow =====\n\nCompare the measurements from both runs.\n",
    'notes:question' => "====== A small question ======\n\nWere both measurements taken with the same input? See [[essay|the notebook essay]].\n",
    'private:sidebar' => "===== Private navigation =====\n\n  * [[private:secret|Private notebook]]\n",
    'private:secret' => "====== Private notebook ======\n\nCESA_PRIVATE_SENTINEL_7391\n\n===== Restricted contents =====\n\nThe word quietorchid belongs only to private search results.\n\n===== Second private heading =====\n\nThis page must never enter anonymous navigation or discovery.\n\n===== Third private heading =====\n\nAccess follows the private:* rules in conf/acl.auth.php.\n\n{{:private:landscape.png?320|Private image}}\n",
    'technical' => "====== Technical reference ======\n\nCode, images, and wide tables must stay inside the reading column.\n\n===== Code =====\n\n<code c>\n#include <stdio.h>\nint main(void) {\n    puts(\"A small, complete program.\");\n    return 0;\n}\n// " . str_repeat('a_long_identifier_', 24) . "\n</code>\n\n<code>\nA short source block.\n</code>\n\n===== A wide table =====\n\n^ Name ^ Meaning ^ A deliberately wide column ^ Another column ^ Status ^\n| Alpha | First | " . str_repeat('unbrokenidentifier', 12) . " | A long explanation for the horizontal scroll test. | Ready |\n| Beta | Second | Short table cell. | Another explanation. | Pending |\n\n===== Image =====\n\n{{:landscape.png?640|A simple landscape}}\n\nAn image uses the native detail view and media workflow.((A second footnote with [[essay|a link back to an essay]].))\n",
    'plugins' => '====== Wrap & mathematics ======' . "\n\nBoth extensions are optional. This page is also used for repeated editor previews.\n\n===== Callouts =====\n\n<WRAP info>\nAn information callout with a [[technical|reference link]].\n</WRAP>\n\n<WRAP important>\nAn important callout uses a colored start border.\n</WRAP>\n\n<WRAP columns>\nA paragraph in the first column.\n\nA paragraph in the second column.\n</WRAP>\n\n===== Inline mathematics =====\n\n" . 'For $x \in \mathbb{R}$, the identity $e^{i\pi}+1=0$ connects familiar constants.' . "\n\n===== Display mathematics =====\n\n" . '$$\int_0^1 x^2\,dx = \frac{1}{3}$$' . "\n\n" . '$$\underbrace{a_1+a_2+a_3+a_4+a_5+a_6+a_7+a_8+a_9+a_{10}+a_{11}+a_{12}}_{\text{a long expression that can scroll on a phone}}=\sum_{i=1}^{12}a_i$$' . "\n",
    'rtl' => "====== Languages ======\n\n===== العربية =====\n\n<WRAP :ar>\nهذه ملاحظات قصيرة عن القراءة والكتابة. يمكن أن تبدأ الفكرة بسؤال صغير، ثم تنمو مع مرور الوقت.\n</WRAP>\n\n===== עברית =====\n\n<WRAP :he>\nמחברת היא מקום לשאלות, לרעיונות ולדברים שכדאי לזכור.\n</WRAP>\n\n===== English =====\n\nWriting directions can coexist on the same page.\n",
    'history' => "====== History fixture ======\n\nAn earlier sentence.\n",
    'privacy' => "====== Public revision ======\n\nAn initial sentence.\n",
];
foreach ($pages as $id => $text) saveWikiText($id, $text, 'Seed Cesa fixtures');
sleep(1);
saveWikiText('history', "====== History fixture ======\n\nA revised sentence with a clear summary.\n", 'Clarify the history fixture');
$_SERVER['REMOTE_USER'] = '';
$_SERVER['REMOTE_ADDR'] = '203.0.113.17';
saveWikiText('privacy', "====== Public revision ======\n\nA sentence from an anonymous editor.\n", 'Anonymous revision');
sleep(1);
$_SERVER['REMOTE_ADDR'] = '2001:db8::17';
saveWikiText('privacy', "====== Public revision ======\n\nAnother sentence from an anonymous editor.\n", 'IPv6 anonymous revision');
$_SERVER['REMOTE_USER'] = 'admin';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
// Generate a deterministic PNG without an image-library dependency.
$width = 640; $height = 240; $pixels = '';
for ($y = 0; $y < $height; $y++) {
    $pixels .= "\0";
    for ($x = 0; $x < $width; $x++) {
        $ridge = 140 + (int)(20 * sin($x / 75));
        $pixels .= $y > $ridge ? pack('CCC', 88, 105, 85) : pack('CCC', 206 - (int)($y / 8), 218 - (int)($y / 10), 222 - (int)($y / 15));
    }
}
$chunk = static fn($type, $data) => pack('N', strlen($data)) . $type . $data . pack('N', crc32($type . $data));
$png = "\x89PNG\r\n\x1a\n" . $chunk('IHDR', pack('NNCCCCC', $width, $height, 8, 2, 0, 0, 0)) . $chunk('IDAT', gzcompress($pixels)) . $chunk('IEND', '');
io_saveFile(mediaFN('landscape.png'), $png);
io_saveFile(mediaFN('private:landscape.png'), $png);
$indexer = new \dokuwiki\Search\Indexer();
foreach (array_keys($pages) as $id) $indexer->addPage($id);
echo "Seeded " . count($pages) . " pages, revision history, and public/private copies of one image.\n";
