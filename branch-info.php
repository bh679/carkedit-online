<?php
/**
 * Returns the current git branch, version, and last commit info as JSON.
 * No auth required — used by branch-banner.js to show deployment context.
 */
header('Content-Type: application/json');
header('Cache-Control: no-cache');

$dir = __DIR__;

// --- Branch name (from .git/HEAD) ---
$headFile = $dir . '/.git/HEAD';
$branch = 'main';
$ref = '';
if (is_readable($headFile)) {
    $head = trim(file_get_contents($headFile));
    if (strpos($head, 'ref: refs/heads/') === 0) {
        $branch = substr($head, 16);
        $ref = substr($head, 5); // refs/heads/branch-name
    }
}

// --- Version (from package.json) ---
$version = '';
$pkgFile = $dir . '/package.json';
if (is_readable($pkgFile)) {
    $pkg = json_decode(file_get_contents($pkgFile), true);
    if (is_array($pkg) && isset($pkg['version'])) {
        $version = $pkg['version'];
    }
}

// --- Last commit info (SHA, date, message) ---
$commitSha = '';
$commitDate = '';
$commitMsg = '';

// Get SHA from the ref
if ($ref !== '') {
    $refFile = $dir . '/.git/' . $ref;
    // Ref might be packed — check packed-refs if file doesn't exist
    if (is_readable($refFile)) {
        $commitSha = trim(file_get_contents($refFile));
    } elseif (is_readable($dir . '/.git/packed-refs')) {
        $packed = file_get_contents($dir . '/.git/packed-refs');
        foreach (explode("\n", $packed) as $line) {
            if (strpos($line, $ref) !== false) {
                $commitSha = substr($line, 0, 40);
                break;
            }
        }
    }
}

// Parse the commit object to get date and message
if ($commitSha !== '') {
    // Git objects are stored at .git/objects/XX/YYYY...
    $objPath = $dir . '/.git/objects/' . substr($commitSha, 0, 2) . '/' . substr($commitSha, 2);
    if (is_readable($objPath)) {
        $raw = @gzuncompress(file_get_contents($objPath));
        if ($raw !== false) {
            // Strip the "commit <size>\0" header
            $body = substr($raw, strpos($raw, "\0") + 1);
            // Extract committer date (unix timestamp + timezone)
            if (preg_match('/^committer .+ (\d+) [+-]\d{4}$/m', $body, $m)) {
                $commitDate = gmdate('Y-m-d H:i', (int)$m[1]) . ' UTC';
            }
            // Message is after the first blank line
            $blankPos = strpos($body, "\n\n");
            if ($blankPos !== false) {
                $msg = trim(substr($body, $blankPos + 2));
                // Take first line only
                $nl = strpos($msg, "\n");
                $commitMsg = $nl !== false ? substr($msg, 0, $nl) : $msg;
            }
        }
    }
}

// --- API branch (from branch-state.json) ---
$apiBranch = 'main';
$stateFile = $dir . '/branch-state.json';
if (is_readable($stateFile)) {
    $state = json_decode(file_get_contents($stateFile), true);
    if (is_array($state) && isset($state['api'])) {
        $apiBranch = $state['api'];
    }
}

echo json_encode([
    'client'     => $branch,
    'api'        => $apiBranch,
    'version'    => $version,
    'commitSha'  => substr($commitSha, 0, 7),
    'commitDate' => $commitDate,
    'commitMsg'  => $commitMsg,
]);
