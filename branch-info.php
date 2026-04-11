<?php
/**
 * Returns the current git branch as JSON. No auth required — it's just a branch name.
 * Used by branch-banner.js to show which branch is deployed.
 */
header('Content-Type: application/json');
header('Cache-Control: no-cache');

$dir = __DIR__;
$result = [];
$rc = 0;
exec('cd ' . escapeshellarg($dir) . ' && git branch --show-current 2>/dev/null', $result, $rc);
$branch = ($rc === 0 && !empty($result)) ? trim($result[0]) : 'main';

echo json_encode(['client' => $branch]);
