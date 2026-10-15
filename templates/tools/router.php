<?php
/** Local development router: PHP's built-in server does not honor .htaccess. */
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
if (preg_match('~(?:^|/)(?:\.[^/]*|data|conf|bin|inc|vendor)(?:/|$)|\.\.|\x00~', $path)) {
    http_response_code(403);
    exit('Forbidden');
}
if ($path === '/') {
    require __DIR__ . '/doku.php';
    return true;
}
if (is_file(__DIR__ . $path)) return false;
http_response_code(404);
echo 'Not found';
