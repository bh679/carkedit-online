<?php
/**
 * Returns the current git branch as JSON. No auth required — it's just a branch name.
 * Used by branch-banner.js to show which branch is deployed.
 */
header('Content-Type: application/json');
header('Cache-Control: no-cache');

// Read .git/HEAD directly — avoids permission issues with exec + git
$headFile = __DIR__ . '/.git/HEAD';
$branch = 'main';
if (is_readable($headFile)) {
    $head = trim(file_get_contents($headFile));
    // Format: "ref: refs/heads/branch-name" or a raw SHA (detached HEAD)
    if (strpos($head, 'ref: refs/heads/') === 0) {
        $branch = substr($head, 16);
    }
}

echo json_encode(['client' => $branch]);
