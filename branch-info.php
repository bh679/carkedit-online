<?php
/**
 * Returns the current git branch, version, and last commit info as JSON.
 * No auth required — used by branch-banner.js to show deployment context.
 *
 * Handles two sources of truth for the deployed branch:
 *   (a) `.git/HEAD` — works when the branch was checked out via the legacy
 *       branch-manager.php (`git checkout <branch>` keeps HEAD on a ref).
 *   (b) `branch-state.json` — required when carkedit-deploy does
 *       `git reset --hard <sha>` (detached HEAD), since HEAD then holds a raw
 *       SHA. The new service writes `/home/bitnami/server/branch-state.json`
 *       with shape:
 *         { client: { ref: { kind, value, sha }, sha, deployedAt, deployedBy } }
 *       The legacy file lived at `<repo>/branch-state.json` with shape:
 *         { client: "branch-name", api: "branch-name" }
 *       Both shapes are accepted, per-field, in case of partial migration.
 */
header('Content-Type: application/json');
header('Cache-Control: no-cache');

$dir = __DIR__;

// --- Branch name (from .git/HEAD) ---
$headFile = $dir . '/.git/HEAD';
$branch = 'main';
$ref = '';
$detachedSha = '';
if (is_readable($headFile)) {
    $head = trim(file_get_contents($headFile));
    if (strpos($head, 'ref: refs/heads/') === 0) {
        $branch = substr($head, 16);
        $ref = substr($head, 5); // refs/heads/branch-name
    } elseif (preg_match('/^[0-9a-f]{40}$/', $head)) {
        // Detached HEAD — record the SHA so commit info can still be looked up.
        $detachedSha = $head;
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

// --- branch-state.json (used for detached-HEAD branch lookup + API branch) ---
// Prefer the new carkedit-deploy location, fall back to the legacy in-repo one.
$state = null;
foreach (['/home/bitnami/server/branch-state.json', $dir . '/branch-state.json'] as $candidate) {
    if (is_readable($candidate)) {
        $decoded = json_decode(file_get_contents($candidate), true);
        if (is_array($decoded)) {
            $state = $decoded;
            break;
        }
    }
}

// Resolve client branch + sha from state when HEAD didn't give us a branch
// (i.e., detached HEAD after `git reset --hard`, or unreadable HEAD as in a
// git worktree where `.git` is a file pointer). Attached HEAD wins over state.
$commitSha = '';
if ($ref === '' && is_array($state) && isset($state['client'])) {
    $clientEntry = $state['client'];
    if (is_array($clientEntry) && isset($clientEntry['ref']['value'])) {
        // New shape — only treat as a branch if kind === 'branch'. Tags don't
        // get a banner (they're version pins, typically on prod).
        $kind = $clientEntry['ref']['kind'] ?? 'branch';
        if ($kind === 'branch') {
            $branch = $clientEntry['ref']['value'];
        }
        if (isset($clientEntry['sha']) && is_string($clientEntry['sha'])) {
            $commitSha = $clientEntry['sha'];
        }
    } elseif (is_string($clientEntry)) {
        // Legacy shape — string branch name.
        $branch = $clientEntry;
    }
}

// If still no commitSha but HEAD is detached, use the HEAD SHA directly.
if ($commitSha === '' && $detachedSha !== '') {
    $commitSha = $detachedSha;
}

// --- Last commit info (SHA, date, message) ---
$commitDate = '';
$commitMsg = '';

// If we don't already have a SHA, look it up from the ref (attached HEAD path).
if ($commitSha === '' && $ref !== '') {
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
if ($commitSha !== '' && preg_match('/^[0-9a-f]{40}$/', $commitSha)) {
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

// --- API branch and version ---
$apiBranch = 'main';
$apiVersion = '';
if (is_array($state) && isset($state['api'])) {
    $apiEntry = $state['api'];
    if (is_array($apiEntry) && isset($apiEntry['ref']['value'])) {
        // New shape
        $kind = $apiEntry['ref']['kind'] ?? 'branch';
        if ($kind === 'branch') {
            $apiBranch = $apiEntry['ref']['value'];
        }
    } elseif (is_string($apiEntry)) {
        // Legacy shape
        $apiBranch = $apiEntry;
    }
}
$apiPkg = '/home/bitnami/server/carkedit-api/package.json';
if (is_readable($apiPkg)) {
    $pkg = json_decode(file_get_contents($apiPkg), true);
    if (is_array($pkg) && isset($pkg['version'])) {
        $apiVersion = $pkg['version'];
    }
}

// --- Environment detection from Host header ---
// Used by client code (branch-banner.js, branch-manager) so the same
// JS works on every env without per-host conditionals.
$host = strtolower($_SERVER['HTTP_HOST'] ?? '');
if ($host === 'play.carkedit.com') {
    $envName = 'production';
} elseif (strpos($host, 'staging.') === 0) {
    $envName = 'staging';
} elseif (strpos($host, 'dev.') === 0) {
    $envName = 'development';
} else {
    $envName = 'development'; // localhost, previews, untagged hosts
}

echo json_encode([
    'client'     => $branch,
    'api'        => $apiBranch,
    'version'    => $version,
    'apiVersion' => $apiVersion,
    'commitSha'  => substr($commitSha, 0, 7),
    'commitDate' => $commitDate,
    'commitMsg'  => $commitMsg,
    'envName'    => $envName,
    'prodUrl'    => 'https://play.carkedit.com',
]);
