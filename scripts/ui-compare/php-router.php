<?php
/**
 * Router for PHP's built-in server, used only to run the OLD site locally for
 * `npm run ui-compare`. PHP's dev server does not read .htaccess, so the clean-URL
 * rewrites are replicated here.
 *
 * Usage (see docs/UI_COMPARE.md section 2):
 *   C:\xampp\php\php.exe -S 127.0.0.1:8080 \
 *     -t "<copy>\public" "<this file>"
 *
 * Serve with -t pointing at the copy's public/ so existing files are returned as-is.
 */

$uri  = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$root = $_SERVER['DOCUMENT_ROOT'];

$file = realpath($root . $uri);

// A real file (asset, css, js) - let the built-in server handle it.
if ($file && is_file($file) && str_starts_with($file, realpath($root))) {
    return false;
}

$route = function (string $uri): string {
    $p = '/' . ltrim($uri, '/');

    if ($p === '' || $p === '/')                     return '/index.php';
    if ($p === '/index')                             return '/index.php';
    if ($p === '/index.php')                         return '/index.php';

    if (preg_match('#^/category/([A-Za-z0-9-]+)/?$#', $p, $m)) {
        return '/browse-courses.php?category=' . $m[1];
    }
    if (preg_match('#^/course/([A-Za-z0-9-]+)/?$#', $p, $m)) {
        return '/course.php?slug=' . $m[1];
    }
    if (preg_match('#^/instructor-profile/([A-Za-z0-9-]+)/?$#', $p, $m)) {
        return '/instructor-profile.php?slug=' . $m[1];
    }
    if (preg_match('#^/lesson/([A-Za-z0-9-]+)/?$#', $p, $m)) {
        return '/course-content.php?lesson=' . $m[1];
    }

    // Strip a single .php extension, as the root .htaccess does.
    if (preg_match('#^(/.+)\.php$#', $p, $m)) {
        $candidate = $m[1];
        if (preg_match('#^/([A-Za-z0-9_-]+)/([A-Za-z0-9_-]+)$#', $candidate, $s)) {
            $known = ['student', 'admin', 'instructor', 'page', 'ajax'];
            if (in_array($s[1], $known, true)) return $candidate . '.php';
        }
        return $candidate . '.php';
    }

    // /student/purchase-history  ->  /student/purchase-history.php
    if (preg_match('#^/([A-Za-z0-9_-]+)/([A-Za-z0-9_-]+)/?$#', $p, $s)) {
        $known = ['student', 'admin', 'instructor', 'page', 'ajax'];
        if (in_array($s[1], $known, true)) return $p . '.php';
    }

    return null;
};

$target = $route($uri);
if ($target === null) {
    http_response_code(404);
    echo 'Not Found (ui-compare router)';
    return true;
}

$path = parse_url($target, PHP_URL_PATH);
$query = parse_url($target, PHP_URL_QUERY);

$full = realpath($root . $path);
if (!$full || !is_file($full)) {
    http_response_code(404);
    echo 'Not Found (ui-compare router): ' . htmlspecialchars($path);
    return true;
}

if ($query) {
    $_SERVER['QUERY_STRING'] = $query;
    parse_str($query, $_GET);
}

require $full;
return true;
