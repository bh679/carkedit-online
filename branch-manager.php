<?php
/**
 * Branch Manager — switch staging branches for carkedit-online and carkedit-api.
 *
 * Self-contained: all HTML/CSS/JS is inline. No external dependencies from the repo.
 * On every page load, regenerates rescue.php (gitignored) as a zero-input failsafe.
 *
 * Auth: Firebase Google sign-in → verified as admin via carkedit-api.
 * Deploy token is read server-side for git operations — never exposed to the user.
 */

session_start();

$TOKEN_FILE   = '/home/bitnami/server/.deploy-token-carkedit-online';
$CLIENT_DIR   = '/opt/bitnami/apache/htdocs/carkedit-online';
$API_DIR      = '/home/bitnami/server/carkedit-api';
$API_PORT     = 4500;
$STATE_FILE   = __DIR__ . '/branch-state.json';
$RESCUE_FILE  = __DIR__ . '/rescue.php';

/* SHA of the commit that first introduced branch-manager.php */
$BM_ORIGIN_SHA = '2965731';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function loadToken($file) {
    if (!is_readable($file)) return '';
    return trim(file_get_contents($file));
}

function runCmd($cmd) {
    $output = [];
    $rc = 0;
    exec($cmd . ' 2>&1', $output, $rc);
    return ['output' => $output, 'rc' => $rc];
}

function readState($file) {
    if (!is_readable($file)) return ['client' => 'main', 'api' => 'main'];
    $data = json_decode(file_get_contents($file), true);
    return is_array($data) ? $data : ['client' => 'main', 'api' => 'main'];
}

function writeState($file, $data) {
    file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
}

function getBranches($dir) {
    $result = runCmd('sudo -u bitnami bash -c "cd ' . escapeshellarg($dir) . ' && git fetch --all --prune 2>/dev/null && git branch -r --sort=-committerdate --no-color 2>/dev/null"');
    $branches = [];
    foreach ($result['output'] as $line) {
        $line = trim($line);
        if (strpos($line, 'origin/HEAD') !== false) continue;
        if (strpos($line, 'origin/') === 0) {
            $branches[] = substr($line, 7); // strip 'origin/'
        }
    }
    return $branches;
}

function getOpenBranches($dir) {
    // Branches not yet merged into main — i.e. still "open", sorted by most recent commit
    $result = runCmd('sudo -u bitnami bash -c "cd ' . escapeshellarg($dir) . ' && git fetch --all --prune 2>/dev/null && git branch -r --no-merged origin/main --sort=-committerdate --no-color 2>/dev/null"');
    $branches = ['main']; // always include main at the top
    foreach ($result['output'] as $line) {
        $line = trim($line);
        if (strpos($line, 'origin/HEAD') !== false) continue;
        if (strpos($line, 'origin/') === 0) {
            $branches[] = substr($line, 7);
        }
    }
    return array_unique($branches);
}

function getTags($dir, $limit = 10) {
    $result = runCmd('sudo -u bitnami bash -c "cd ' . escapeshellarg($dir) . ' && git tag --sort=-creatordate 2>/dev/null"');
    $tags = [];
    foreach ($result['output'] as $line) {
        $line = trim($line);
        if ($line !== '') $tags[] = $line;
        if (count($tags) >= $limit) break;
    }
    return $tags;
}

function getCurrentBranch($dir) {
    $result = runCmd('sudo -u bitnami bash -c "cd ' . escapeshellarg($dir) . ' && git branch --show-current 2>/dev/null"');
    return trim(implode('', $result['output'])) ?: 'unknown';
}

function getDeployedSha($dir) {
    $result = runCmd('sudo -u bitnami bash -c "cd ' . escapeshellarg($dir) . ' && git rev-parse HEAD 2>/dev/null"');
    return trim(implode('', $result['output'])) ?: '';
}

function validateBranch($branch) {
    return preg_match('/^[a-zA-Z0-9_\-\.\/]+$/', $branch);
}

function getVersionForBranch($dir, $branch) {
    $esc = escapeshellarg($branch);
    $result = runCmd('sudo -u bitnami bash -c "cd ' . escapeshellarg($dir) . ' && git show origin/' . $esc . ':package.json 2>/dev/null"');
    if ($result['rc'] !== 0) return '?';
    $json = json_decode(implode("\n", $result['output']), true);
    return is_array($json) && isset($json['version']) ? $json['version'] : '?';
}

function getVersionsForBranches($dir, $branches) {
    $versions = [];
    foreach ($branches as $branch) {
        $versions[$branch] = getVersionForBranch($dir, $branch);
    }
    return $versions;
}

function branchContainsCommit($dir, $branch, $sha) {
    $escBranch = escapeshellarg('origin/' . $branch);
    $escSha = escapeshellarg($sha);
    $result = runCmd('sudo -u bitnami bash -c "cd ' . escapeshellarg($dir) . ' && git merge-base --is-ancestor ' . $escSha . ' ' . $escBranch . ' 2>/dev/null"');
    return $result['rc'] === 0;
}

function getBranchManagerMap($dir, $branches, $sha) {
    $map = [];
    foreach ($branches as $branch) {
        $map[$branch] = branchContainsCommit($dir, $branch, $sha);
    }
    return $map;
}

function getBranchDetails($dir, $branches) {
    $details = [];
    foreach ($branches as $branch) {
        if ($branch === 'main') {
            $escDir = escapeshellarg($dir);
            $mainShaResult = runCmd('sudo -u bitnami bash -c "cd ' . $escDir . ' && git rev-parse origin/main 2>/dev/null"');
            $mainRemoteSha = trim(implode('', $mainShaResult['output']));
            $details[$branch] = ['commitMessage' => '', 'commitsAhead' => 0, 'commitDate' => '', 'remoteSha' => $mainRemoteSha];
            continue;
        }
        $escBranch = escapeshellarg('origin/' . $branch);
        $escDir = escapeshellarg($dir);

        // Get subject and ISO date in one call (separated by newline)
        $logResult = runCmd('sudo -u bitnami bash -c "cd ' . $escDir . ' && git log -1 --format=\'%s%n%aI\' ' . $escBranch . ' 2>/dev/null"');
        $commitMessage = isset($logResult['output'][0]) ? trim($logResult['output'][0]) : '';
        $commitDate = isset($logResult['output'][1]) ? trim($logResult['output'][1]) : '';

        $countResult = runCmd('sudo -u bitnami bash -c "cd ' . $escDir . ' && git rev-list --count origin/main..' . $escBranch . ' 2>/dev/null"');
        $commitsAhead = (int) trim(implode('', $countResult['output']));

        // Get the remote tip SHA for this branch
        $shaResult = runCmd('sudo -u bitnami bash -c "cd ' . $escDir . ' && git rev-parse ' . $escBranch . ' 2>/dev/null"');
        $remoteSha = trim(implode('', $shaResult['output']));

        $details[$branch] = [
            'commitMessage' => $commitMessage,
            'commitsAhead'  => $commitsAhead,
            'commitDate'    => $commitDate,
            'remoteSha'     => $remoteSha,
        ];
    }
    return $details;
}

/**
 * Verify a Firebase ID token against the carkedit-api admin endpoint.
 * Returns true if the user is an admin, false otherwise.
 */
function verifyAdminToken($idToken, $apiPort) {
    $url = "http://localhost:{$apiPort}/api/carkedit/users";
    $opts = [
        'http' => [
            'method'  => 'GET',
            'header'  => "Authorization: Bearer {$idToken}\r\n",
            'timeout' => 10,
            'ignore_errors' => true,
        ],
    ];
    $ctx = stream_context_create($opts);
    $response = @file_get_contents($url, false, $ctx);
    if ($response === false) return false;

    // Check HTTP status from response headers
    foreach ($http_response_header as $header) {
        if (preg_match('/^HTTP\/\S+\s+(\d+)/', $header, $m)) {
            $status = (int) $m[1];
            return $status >= 200 && $status < 300;
        }
    }
    return false;
}

/* ------------------------------------------------------------------ */
/*  Regenerate rescue.php                                              */
/* ------------------------------------------------------------------ */

function generateRescue($rescueFile, $tokenFile, $clientDir, $apiDir) {
    $code = '<?php
/* Auto-generated rescue file. Visit this URL to reset both repos to main. No auth needed. */
header("Content-Type: text/html; charset=utf-8");

$clientDir = ' . var_export($clientDir, true) . ';
$apiDir    = ' . var_export($apiDir, true) . ';

function runCmd($cmd) {
    $output = [];
    $rc = 0;
    exec($cmd . " 2>&1", $output, $rc);
    return ["output" => $output, "rc" => $rc];
}

$action = $_GET["action"] ?? "";
$results = [];

if ($action === "reset") {
    // Reset client to main
    $r1 = runCmd("sudo -u bitnami bash -c \"cd " . escapeshellarg($clientDir) . " && git fetch origin && git checkout -- . && git clean -fd && git checkout main && git reset --hard origin/main\"");
    $results[] = ["repo" => "client", "rc" => $r1["rc"], "output" => $r1["output"]];

    // Reset API to main, rebuild, restart
    $r2 = runCmd("sudo -u bitnami bash -c \"cd " . escapeshellarg($apiDir) . " && git fetch origin && git checkout -- . && git clean -fd && git checkout main && git reset --hard origin/main && npm install && npm run build && npm prune --omit=dev\"");
    $results[] = ["repo" => "api-pull", "rc" => $r2["rc"], "output" => $r2["output"]];

    if ($r2["rc"] === 0) {
        $r3 = runCmd("sudo -u bitnami bash -c \"cd " . escapeshellarg($apiDir) . " && pm2 restart carkedit-api\"");
        $results[] = ["repo" => "api-restart", "rc" => $r3["rc"], "output" => $r3["output"]];
    } else {
        $results[] = ["repo" => "api-restart", "rc" => 1, "output" => ["Skipped: build failed (rc=" . $r2["rc"] . "). Server left running on previous version. Use Restart Server button to force."]];
    }

    // Update branch state
    $stateFile = dirname(__FILE__) . "/branch-state.json";
    file_put_contents($stateFile, json_encode(["client" => "main", "api" => "main", "updatedAt" => gmdate("c")], JSON_PRETTY_PRINT));

    $allOk = true;
    foreach ($results as $r) { if ($r["rc"] !== 0) $allOk = false; }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CarkedIt Rescue</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#1a1a2e;color:#eee;min-height:100vh;display:flex;justify-content:center;align-items:center}
.container{max-width:500px;width:90%;text-align:center;padding:2rem}
h1{font-size:1.5rem;margin-bottom:1rem}
.btn{display:inline-block;padding:1rem 2rem;font-size:1.1rem;font-weight:bold;border:none;border-radius:8px;cursor:pointer;text-decoration:none;margin:0.5rem}
.btn-danger{background:#e94560;color:#fff}
.btn-danger:hover{background:#c73e55}
.btn-link{background:none;color:#e94560;border:1px solid #e94560;font-size:0.9rem;padding:0.5rem 1rem}
.result{margin-top:1.5rem;text-align:left;background:rgba(255,255,255,0.05);border-radius:8px;padding:1rem}
.ok{color:#4caf50}.err{color:#f44336}
pre{font-size:0.75rem;color:#888;white-space:pre-wrap;margin-top:0.5rem}
</style>
<script src="js/branch-banner.js"></script>
</head>
<body>
<div class="container">
<?php if ($action !== "reset"): ?>
  <h1>CarkedIt Staging Rescue</h1>
  <p style="color:#aaa;margin-bottom:1.5rem">Reset both repos to <strong>main</strong> and restart the API server.</p>
  <a class="btn btn-danger" href="?action=reset">Reset Everything to Main</a>
  <br>
  <a class="btn btn-link" href="branch-manager.php" style="margin-top:1rem">Back to Branch Manager</a>
<?php else: ?>
  <h1><?= $allOk ? "Reset Complete" : "Reset Finished (with errors)" ?></h1>
  <?php foreach ($results as $r): ?>
    <div class="result">
      <strong><?= htmlspecialchars($r["repo"]) ?></strong>:
      <span class="<?= $r["rc"] === 0 ? "ok" : "err" ?>"><?= $r["rc"] === 0 ? "OK" : "FAILED (rc=" . $r["rc"] . ")" ?></span>
      <pre><?= htmlspecialchars(implode("\n", $r["output"])) ?></pre>
    </div>
  <?php endforeach; ?>
  <a class="btn btn-link" href="./" style="margin-top:1.5rem">Go to CarkedIt Online</a>
  <a class="btn btn-link" href="branch-manager.php">Branch Manager</a>
<?php endif; ?>
</div>
</body>
</html>';

    file_put_contents($rescueFile, $code);
}

/* ------------------------------------------------------------------ */
/*  Auth: session-based, verified via Firebase + carkedit-api          */
/* ------------------------------------------------------------------ */

$authenticated = isset($_SESSION['bm_auth']) && $_SESSION['bm_auth'] === true;

/* ------------------------------------------------------------------ */
/*  API action: auth — verify Firebase ID token as admin               */
/* ------------------------------------------------------------------ */

if (isset($_GET['action']) && $_GET['action'] === 'auth') {
    header('Content-Type: application/json');

    // Accept token from Authorization header or POST body
    $idToken = '';
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (strpos($authHeader, 'Bearer ') === 0) {
        $idToken = substr($authHeader, 7);
    }
    if (empty($idToken) && isset($_POST['idToken'])) {
        $idToken = $_POST['idToken'];
    }

    if (empty($idToken)) {
        http_response_code(400);
        echo json_encode(['error' => 'No ID token provided']);
        exit;
    }

    if (verifyAdminToken($idToken, $API_PORT)) {
        $_SESSION['bm_auth'] = true;
        echo json_encode(['status' => 'ok']);
    } else {
        http_response_code(403);
        echo json_encode(['error' => 'Not an admin or API unreachable']);
    }
    exit;
}

/* ------------------------------------------------------------------ */
/*  API action: logout                                                 */
/* ------------------------------------------------------------------ */

if (isset($_GET['action']) && $_GET['action'] === 'logout') {
    session_destroy();
    header('Content-Type: application/json');
    echo json_encode(['status' => 'ok']);
    exit;
}

/* ------------------------------------------------------------------ */
/*  Regenerate rescue on every authenticated load                      */
/* ------------------------------------------------------------------ */

if ($authenticated) {
    generateRescue($RESCUE_FILE, $TOKEN_FILE, $CLIENT_DIR, $API_DIR);
}

/* ------------------------------------------------------------------ */
/*  API actions (JSON responses) — require auth                        */
/* ------------------------------------------------------------------ */

if ($authenticated && isset($_GET['action'])) {
    header('Content-Type: application/json');
    $action = $_GET['action'];

    if ($action === 'status') {
        $state = readState($STATE_FILE);
        $clientOpen = getOpenBranches($CLIENT_DIR);
        $apiOpen = getOpenBranches($API_DIR);
        echo json_encode([
            'client' => [
                'current' => getCurrentBranch($CLIENT_DIR),
                'deployedSha' => getDeployedSha($CLIENT_DIR),
                'openBranches' => $clientOpen,
                'versions' => getVersionsForBranches($CLIENT_DIR, $clientOpen),
                'tags' => getTags($CLIENT_DIR),
                'hasBranchManager' => getBranchManagerMap($CLIENT_DIR, $clientOpen, $BM_ORIGIN_SHA),
                'branchDetails' => getBranchDetails($CLIENT_DIR, $clientOpen),
            ],
            'api' => [
                'current' => getCurrentBranch($API_DIR),
                'deployedSha' => getDeployedSha($API_DIR),
                'openBranches' => $apiOpen,
                'versions' => getVersionsForBranches($API_DIR, $apiOpen),
                'tags' => getTags($API_DIR),
                'branchDetails' => getBranchDetails($API_DIR, $apiOpen),
            ],
            'state' => $state,
        ]);
        exit;
    }

    if ($action === 'switch') {
        $clientBranch = $_GET['client'] ?? '';
        $apiBranch    = $_GET['api'] ?? '';
        $wantClient   = $clientBranch !== '' && validateBranch($clientBranch);
        $wantApi      = $apiBranch !== '' && validateBranch($apiBranch);
        $results      = [];
        $apiFailed    = false;

        // Deploy API first — it's most likely to fail (npm install/build).
        // When both repos are requested, we skip the client if the API fails
        // to avoid split-brain (client on new branch, API stuck on old).
        if ($wantApi) {
            $esc = escapeshellarg($apiBranch);
            // git checkout -- . && git clean -fd : reset dirty working tree
            // left behind by npm install modifying package-lock.json
            $r = runCmd('sudo -u bitnami bash -c "cd ' . escapeshellarg($API_DIR) . ' && git fetch origin && git checkout -- . && git clean -fd && git checkout ' . $esc . ' && git reset --hard origin/' . $esc . ' && npm install && npm run build && npm prune --omit=dev"');
            $results['api-pull'] = ['branch' => $apiBranch, 'rc' => $r['rc'], 'output' => $r['output']];

            if ($r['rc'] === 0) {
                $r2 = runCmd('sudo -u bitnami bash -c "cd ' . escapeshellarg($API_DIR) . ' && pm2 restart carkedit-api"');
                $results['api-restart'] = ['rc' => $r2['rc'], 'output' => $r2['output']];
            } else {
                $apiFailed = true;
                $results['api-restart'] = ['rc' => 1, 'output' => ['Skipped: build failed (rc=' . $r['rc'] . '). Server left running on previous version. Use Restart Server button to force.']];
            }
        }

        // Switch client branch (skip if API failed during a linked deploy)
        if ($wantClient) {
            if ($wantApi && $apiFailed) {
                $results['client'] = ['branch' => $clientBranch, 'rc' => 1, 'output' => ['Skipped: API deploy failed. Client left on current branch to avoid split-brain.']];
            } else {
                $esc = escapeshellarg($clientBranch);
                $r = runCmd('sudo -u bitnami bash -c "cd ' . escapeshellarg($CLIENT_DIR) . ' && git fetch origin && git checkout -- . && git clean -fd && git checkout ' . $esc . ' && git reset --hard origin/' . $esc . '"');
                $results['client'] = ['branch' => $clientBranch, 'rc' => $r['rc'], 'output' => $r['output']];
            }
        }

        // Update state — only record branches that actually deployed
        $state = readState($STATE_FILE);
        if (isset($results['client']) && $results['client']['rc'] === 0) $state['client'] = $clientBranch;
        if (isset($results['api-pull']) && $results['api-pull']['rc'] === 0) $state['api'] = $apiBranch;
        $state['updatedAt'] = gmdate('c');
        writeState($STATE_FILE, $state);

        $allOk = true;
        foreach ($results as $r) { if ($r['rc'] !== 0) $allOk = false; }

        echo json_encode(['status' => $allOk ? 'ok' : 'error', 'results' => $results]);
        exit;
    }

    http_response_code(400);
    echo json_encode(['error' => 'Unknown action']);
    exit;
}

/* If an action was requested but user is not authenticated */
if (!$authenticated && isset($_GET['action']) && !in_array($_GET['action'], ['auth', 'logout'])) {
    header('Content-Type: application/json');
    http_response_code(401);
    echo json_encode(['error' => 'Not authenticated']);
    exit;
}

/*  HTML Dashboard — uses shared CSS & admin-header component          */
/* ------------------------------------------------------------------ */
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CarkedIt — Branch Manager</title>
    <link rel="stylesheet" href="css/base.css?v=1.06.0104">
    <link rel="stylesheet" href="css/components/auth.css?v=1.06.0104">
    <link rel="stylesheet" href="css/components/admin-header.css?v=1.06.0104">
    <link rel="stylesheet" href="css/dashboard.css?v=1.06.0104">
    <style>
        .bm { max-width: 1024px; margin: 0 auto; padding: var(--space-md) var(--space-lg); }
        .bm__top { display: flex; gap: var(--space-md); align-items: flex-start; }
        .bm__top-left { flex: 1; min-width: 0; }
        .bm__top-right { flex: 0 0 320px; }
        @media (max-width: 768px) {
            .bm__top { flex-direction: column; }
            .bm__top-right { flex: none; width: 100%; }
        }
        .bm__title { font-size: 1.4rem; margin: 0 0 var(--space-xs); }
        .bm__subtitle { color: var(--color-text-muted); font-size: 0.9rem; margin-bottom: var(--space-lg); }
        .bm__gate { display: flex; align-items: center; justify-content: center; min-height: 60vh; text-align: center; }
        .bm__gate p { color: var(--color-text-muted); margin-bottom: 1em; }
        .bm__gate .auth-loading { color: var(--color-primary); }

        /* Reset banner */
        .bm__reset { background: var(--color-danger, #e94560); border-radius: var(--radius-md); padding: var(--space-md);
            display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-md); flex-wrap: wrap; gap: var(--space-sm); }
        .bm__reset span { font-weight: 700; }
        .bm__reset button { padding: var(--space-sm) var(--space-md); border: 2px solid #fff; border-radius: var(--radius-sm);
            background: transparent; color: #fff; font-weight: 700; cursor: pointer; font-size: 0.9rem; }
        .bm__reset button:hover { background: rgba(255,255,255,0.2); }

        /* Repo sections */
        .bm__repo { background: var(--color-surface); border-radius: var(--radius-md); padding: var(--space-md); margin-bottom: var(--space-sm); }
        .bm__repo h2 { font-size: 1rem; margin-bottom: var(--space-sm); display: flex; align-items: center; gap: var(--space-sm); }
        .bm__badge { font-size: 0.75rem; padding: 0.15em 0.5em; border-radius: 4px; font-weight: 600; }
        .bm__badge--client { background: rgba(10,61,98,0.6); color: #82ccdd; }
        .bm__badge--api { background: rgba(60,19,97,0.6); color: #be2edd; }
        .bm__current { font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: var(--space-sm); }
        .bm__current strong { color: var(--color-live, #4caf50); }
        .bm__update-badge { display: inline-block; font-size: 0.7rem; font-weight: 600; padding: 0.1em 0.5em; border-radius: 9999px; background: var(--color-live, #4caf50); color: #fff; margin-left: var(--space-xs); vertical-align: middle; }

        /* Branch select rows */
        .bm__row { display: flex; gap: var(--space-sm); align-items: center; flex-wrap: wrap; }
        .bm__row select { flex: 1; min-width: 200px; padding: 0.6rem; border: 1px solid var(--color-border);
            border-radius: var(--radius-sm); background: var(--color-bg); color: var(--color-text); font-size: 0.9rem; }
        .bm__row button { padding: 0.6rem var(--space-md); border: none; border-radius: var(--radius-sm);
            background: var(--color-primary); color: #fff; font-weight: 700; cursor: pointer; font-size: 0.9rem; white-space: nowrap; }
        .bm__row button:hover { filter: brightness(1.15); }
        .bm__row button:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Linked section */
        .bm__linked { background: var(--color-surface); border-radius: var(--radius-md); padding: var(--space-md);
            margin-bottom: var(--space-sm); border: 1px solid rgba(233,69,96,0.3); }
        .bm__linked h2 { font-size: 1rem; margin-bottom: var(--space-xs); }
        .bm__linked p { font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: var(--space-sm); }
        .bm__linked-api { color: var(--color-text-muted); font-size: 0.85rem; }

        /* Status */
        .bm__status { margin-top: var(--space-md); padding: var(--space-sm); border-radius: var(--radius-sm); font-size: 0.85rem; display: none; }
        .bm__status.ok { display: block; background: rgba(76,175,80,0.15); border: 1px solid rgba(76,175,80,0.3); color: #4caf50; }
        .bm__status.error { display: block; background: rgba(244,67,54,0.15); border: 1px solid rgba(244,67,54,0.3); color: #f44336; }
        .bm__status.loading { display: block; background: rgba(152,66,255,0.15); border: 1px solid rgba(152,66,255,0.3); color: var(--color-primary); }
        .bm__log { margin-top: var(--space-xs); font-size: 0.75rem; color: var(--color-text-muted); white-space: pre-wrap; max-height: 200px; overflow-y: auto; }
        .bm__log-wrapper { position: relative; }
        .bm__copy-btn { display: none; position: absolute; top: 4px; right: 4px; padding: 0.25rem 0.5rem; font-size: 0.7rem;
            background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-sm);
            color: var(--color-text-muted); cursor: pointer; z-index: 1; }
        .bm__copy-btn:hover { color: var(--color-text); border-color: var(--color-text-muted); }
        .bm__copy-btn.copied { color: #4caf50; border-color: #4caf50; }

        /* Recent branches */
        .bm__divider { border: none; border-top: 1px solid var(--color-border); margin: var(--space-md) 0; }
        .bm__recent { background: var(--color-surface); border-radius: var(--radius-md); padding: var(--space-md); margin-bottom: var(--space-sm); }
        .bm__recent h2 { font-size: 1rem; margin-bottom: var(--space-sm); }
        .bm__filters { display: flex; gap: var(--space-md); flex-wrap: wrap; margin-bottom: var(--space-md); align-items: center; }
        .bm__filter-group { display: flex; align-items: center; gap: var(--space-xs); }
        .bm__filter-label { font-size: 0.7rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; }
        .bm__filter-btn { padding: 0.2em 0.6em; font-size: 0.75rem; font-weight: 600; border: 1px solid var(--color-border);
            border-radius: var(--radius-sm); background: transparent; color: var(--color-text-muted); cursor: pointer; white-space: nowrap; }
        .bm__filter-btn:hover { color: var(--color-text); border-color: var(--color-text-muted); }
        .bm__filter-btn--active { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
        .bm__filter-btn--active:hover { filter: brightness(1.15); }
        .bm__filter-btn--client.bm__filter-btn--active { background: rgba(10,61,98,0.6); color: #82ccdd; border-color: #82ccdd; }
        .bm__filter-btn--api.bm__filter-btn--active { background: rgba(60,19,97,0.6); color: #be2edd; border-color: #be2edd; }
        .bm__filter-count { font-size: 0.75rem; color: var(--color-text-muted); margin-left: auto; }
        .bm__recent-cols { display: flex; gap: var(--space-md); }
        .bm__recent-col { flex: 1; }
        .bm__recent-col h3 { font-size: 0.85rem; margin-bottom: var(--space-xs); display: flex; align-items: center; gap: var(--space-xs); }
        .bm__recent-list { list-style: none; padding: 0; margin: 0; }
        .bm__recent-list li { font-size: 0.8rem; color: var(--color-text-muted); padding: 0.2em 0; font-family: monospace; }
        .bm__recent-list li.has-pr { color: var(--color-live, #4caf50); }

        /* Recent branches — dashboard card style */
        .bm__branch-card {
            background: var(--color-surface); border-radius: var(--radius-md);
            margin-bottom: var(--space-xs); cursor: pointer;
            transition: background 0.1s ease; overflow: hidden;
        }
        .bm__branch-card:hover { background: var(--color-secondary); }
        .bm__branch-card.has-pr { border-left: 3px solid var(--color-live, #4caf50); }
        .bm__branch-card.is-active { border-left: 3px solid #2196f3; background: rgba(33,150,243,0.08); }
        .bm__badge--active { background: rgba(33,150,243,0.2); color: #2196f3; }
        .bm__branch-card-row {
            display: flex; align-items: center; padding: var(--space-sm) var(--space-md);
            font-size: 0.85rem; gap: var(--space-sm);
        }
        .bm__branch-card-row .bm__chevron {
            font-size: 0.6rem; transition: transform 0.15s; flex-shrink: 0; width: 1em;
        }
        .bm__branch-card.is-expanded .bm__chevron { transform: rotate(90deg); }
        .bm__branch-card-row .bm__branch-name {
            flex: 1; font-family: monospace; overflow: hidden;
            text-overflow: ellipsis; white-space: nowrap;
        }
        .bm__branch-date {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 0.7rem; color: var(--color-text-muted); opacity: 0.6;
            margin-left: var(--space-xs); font-weight: 400;
        }
        .bm__branch-card-row .bm__count-badge {
            font-size: 0.7rem; padding: 0.1em 0.5em; border-radius: 9999px;
            font-weight: 600; white-space: nowrap; flex-shrink: 0;
        }
        .bm__count-badge--pr { background: rgba(76,175,80,0.2); color: var(--color-live, #4caf50); }
        .bm__count-badge--merged { background: rgba(152,66,255,0.2); color: var(--color-primary); }
        .bm__count-badge--ahead { background: rgba(255,255,255,0.08); color: var(--color-text-muted); }
        .bm__branch-detail {
            padding: var(--space-md); border-top: 1px solid var(--color-border);
            cursor: default; display: none; font-size: 0.8rem; line-height: 1.6;
        }
        .bm__branch-card.is-expanded .bm__branch-detail { display: block; }
        .bm__detail-row { display: flex; gap: var(--space-sm); margin-bottom: 0.2em; }
        .bm__detail-label { color: var(--color-text-muted); white-space: nowrap; min-width: 6em; }
        .bm__detail-value { color: var(--color-text); word-break: break-word; }
        .bm__branch-detail a { color: var(--color-primary); text-decoration: none; }
        .bm__branch-detail a:hover { text-decoration: underline; }
        .bm__repo-detail {
            background: rgba(255,255,255,0.03); border-radius: var(--radius-sm);
            padding: var(--space-sm) var(--space-md); margin-bottom: var(--space-sm);
        }
        .bm__repo-detail:last-child { margin-bottom: 0; }
        .bm__repo-detail-header {
            font-size: 0.8rem; font-weight: 600; margin-bottom: var(--space-xs);
            display: flex; align-items: center; gap: var(--space-xs);
        }
        .bm__show-more {
            display: block; width: 100%; padding: var(--space-sm); margin-top: var(--space-xs);
            background: transparent; border: 1px dashed var(--color-border); border-radius: var(--radius-sm);
            color: var(--color-text-muted); font-size: 0.8rem; cursor: pointer; text-align: center;
        }
        .bm__show-more:hover { color: var(--color-text); border-color: var(--color-text-muted); }
        .bm__deploy-btn {
            padding: 0.15em 0.6em; font-size: 0.7rem; font-weight: 600;
            border: 1px solid var(--color-border); border-radius: var(--radius-sm);
            background: var(--color-secondary); color: var(--color-text);
            cursor: pointer; white-space: nowrap; flex-shrink: 0;
            transition: background 0.1s, border-color 0.1s;
        }
        .bm__deploy-btn:hover:not(:disabled) { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
        .bm__deploy-btn:disabled { opacity: 0.25; cursor: not-allowed; background: transparent; color: var(--color-text-muted); border-color: transparent; }
        .bm__deploy-btn--update { background: var(--color-live, #4caf50); color: #fff; border-color: var(--color-live, #4caf50); }
        .bm__deploy-btn--update:hover:not(:disabled) { background: #43a047; border-color: #43a047; }
        select option.has-pr { color: #4caf50; }

        /* Rescue link */
        .bm__rescue { text-align: center; margin-top: var(--space-lg); padding-top: var(--space-md); border-top: 1px solid var(--color-border); }
        .bm__rescue a { color: var(--color-text-muted); font-size: 0.8rem; text-decoration: none; }
        .bm__rescue a:hover { color: var(--color-danger, #e94560); }

        /* Pre-branch-manager warning */
        .bm__warning { margin-top: var(--space-xs); padding: var(--space-sm) var(--space-md); border-radius: var(--radius-sm);
            background: rgba(255,193,7,0.15); border: 1px solid rgba(255,193,7,0.4); color: #ffc107; font-size: 0.8rem; }
        .bm__warning:empty { display: none; }

        /* Inline reset confirmation */
        .bm__confirm { background: var(--color-surface); border: 2px solid var(--color-danger, #e94560); border-radius: var(--radius-md);
            padding: var(--space-md); margin-bottom: var(--space-md); }
        .bm__confirm p { font-size: 0.9rem; margin-bottom: var(--space-sm); }
        .bm__confirm-actions { display: flex; gap: var(--space-sm); }
        .bm__confirm .btn--cancel { padding: 0.5rem var(--space-md); border: 1px solid var(--color-border); border-radius: var(--radius-sm);
            background: transparent; color: var(--color-text); cursor: pointer; font-size: 0.85rem; }
        .bm__confirm .btn--cancel:hover { background: rgba(255,255,255,0.05); }
        .bm__confirm .btn--danger { padding: 0.5rem var(--space-md); border: none; border-radius: var(--radius-sm);
            background: var(--color-danger, #e94560); color: #fff; font-weight: 700; cursor: pointer; font-size: 0.85rem; }
        .bm__confirm .btn--danger:hover { filter: brightness(1.15); }

        .hidden { display: none !important; }

        /* Production overlay */
        .bm__prod-banner { max-width: 1024px; margin: var(--space-lg) auto var(--space-md); padding: var(--space-lg);
            background: var(--color-surface); border: 2px solid var(--color-primary); border-radius: var(--radius-md);
            text-align: center; position: relative; z-index: 10; }
        .bm__prod-banner p { color: var(--color-text-muted); font-size: 1rem; margin-bottom: var(--space-md); }
        .bm__prod-banner a { display: inline-block; padding: 0.8rem 1.5rem; background: var(--color-primary); color: #fff;
            font-weight: 700; border-radius: var(--radius-sm); text-decoration: none; font-size: 1rem; }
        .bm__prod-banner a:hover { filter: brightness(1.15); }
        .bm--greyed { opacity: 0.35; pointer-events: none; user-select: none; }

        /* Tag & Deploy button */
        .bm__deploy-row { display: flex; align-items: center; gap: var(--space-sm); margin-bottom: var(--space-md); }
        .bm__deploy-row .btn { padding: 0.5rem var(--space-md); font-size: 0.85rem; }
        .btn--accent { background: var(--color-live, #4caf50); color: #fff; }
        .btn--accent-warn { background: var(--color-die, #e94560); color: #fff; }

        /* Deploy modal */
        .deploy-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .deploy-modal { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-lg); min-width: 380px; max-width: 90vw; }
        .deploy-modal__title { font-size: 1rem; font-weight: 700; margin-bottom: var(--space-md); }
        .deploy-table { width: 100%; border-collapse: collapse; font-size: 0.75rem; margin-bottom: var(--space-md); }
        .deploy-table th { text-align: left; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted); padding: var(--space-xs) var(--space-sm); border-bottom: 1px solid var(--color-border); }
        .deploy-table td { padding: var(--space-xs) var(--space-sm); }
        .deploy-modal__actions { display: flex; gap: var(--space-sm); justify-content: flex-end; }
        .deploy-modal__mode { margin-bottom: var(--space-sm); font-size: 0.75rem; }
        .deploy-status { font-size: 0.7rem; font-weight: 600; }
        .deploy-status--pending { color: var(--color-text-muted); }
        .deploy-status--exists { color: var(--color-text-muted); }
        .deploy-status--new { color: var(--color-live, #4caf50); }
        .deploy-status--ok { color: var(--color-live, #4caf50); }
        .deploy-status--warn { color: var(--color-die, #e94560); }
        .deploy-status--error { color: var(--color-primary); }
    </style>
    <script src="js/branch-banner.js"></script>
</head>
<body>
    <div id="app"></div>
    <script type="module">
    'use strict';

    function escapeHtml(str) {
      const d = document.createElement('div');
      d.textContent = str;
      return d.innerHTML;
    }

    import { renderAdminHeader, bindAdminHeader, resetAdminHeaderMenu } from './js/components/admin-header.js';

    const FIREBASE_CONFIG = {
      apiKey: "AIzaSyC6QJz6jTzJkBWV7Shd9XpCfHWrovJ9vaI",
      authDomain: window.location.host,
      projectId: "carkedit-5cc8e",
      storageBucket: "carkedit-5cc8e.firebasestorage.app",
      messagingSenderId: "144073275425",
      appId: "1:144073275425:web:2301fbbccc2be69c654b60",
    };

    const PHP_AUTHED = <?= $authenticated ? 'true' : 'false' ?>;
    const apiUrl = 'branch-manager.php';

    let firebaseAuth = null;
    let authModule = null;
    let fbUserInfo = null;
    let apiBranches = [];
    let clientBranches = [];
    let clientVersions = {};
    let apiVersions = {};
    let clientHasBM = {};
    let clientBranchDetails = {};
    let apiBranchDetails = {};
    let currentClientBranch = '';
    let currentApiBranch = '';
    let clientDeployedSha = '';
    let apiDeployedSha = '';
    let _fbIdToken = null;

    /* ── GitHub API (for Tag & Deploy) ───────────────── */

    const GH_PROXY = '/api/carkedit/github';
    const TAG_REPOS = [
      { name: 'bh679/carkedit-online', label: 'online' },
      { name: 'bh679/carkedit-api', label: 'api' },
    ];
    let _isOnMain = false;
    let _deployInfos = [];
    let clientPRBranches = new Set();
    let apiPRBranches = new Set();
    let clientPRData = new Map(); // branch -> { openCount, mergedCount }
    let apiPRData = new Map();
    let clientOpenSet = new Set();
    let apiOpenSet = new Set();
    let filters = { mergeStatus: 'all', openPR: 'all', repoClient: true, repoApi: true };

    async function ghFetch(path) {
      const headers = {};
      if (_fbIdToken) headers.Authorization = 'Bearer ' + _fbIdToken;
      const res = await fetch(GH_PROXY + path, { headers });
      if (!res.ok) throw new Error('GitHub API ' + res.status);
      return res.json();
    }

    async function ghPost(path, body) {
      if (!_fbIdToken) throw new Error('Not authenticated');
      const res = await fetch(GH_PROXY + path, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + _fbIdToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'GitHub API ' + res.status);
      }
      return res.json();
    }

    async function detectIfOnMain() {
      return currentClientBranch === 'main' && currentApiBranch === 'main';
    }

    function tagPrefix() { return _isOnMain ? 'v' : 't'; }

    async function fetchRepoTagInfo(repo, prefix) {
      const pkgContent = await ghFetch('/repos/' + repo + '/contents/package.json?ref=main');
      const pkg = JSON.parse(atob(pkgContent.content));
      const version = pkg.version;
      const tag = prefix + version;
      let tagExists = false;
      try { await ghFetch('/repos/' + repo + '/git/ref/tags/' + tag); tagExists = true; } catch {}
      const ref = await ghFetch('/repos/' + repo + '/git/ref/heads/main');
      const sha = ref.object.sha;
      return { repo, version, tag, tagExists, sha };
    }

    function renderDeployModal(infos, state, isOnMain) {
      const modeLabel = isOnMain
        ? '<span class="deploy-status deploy-status--ok">PRODUCTION (v-tag, triggers deploy)</span>'
        : '<span class="deploy-status deploy-status--warn">TEST (t-tag, no deploy)</span>';
      const rows = infos.map(info => {
        const status = state === 'loading' ? '<span class="deploy-status deploy-status--pending">checking...</span>'
          : info.tagExists ? '<span class="deploy-status deploy-status--exists">tag exists</span>'
          : '<span class="deploy-status deploy-status--new">will create</span>';
        const result = info.result
          ? (info.result === 'ok' ? '<span class="deploy-status deploy-status--ok">done</span>'
            : '<span class="deploy-status deploy-status--error">' + info.result + '</span>')
          : '';
        return '<tr><td><strong>' + (info.label || info.repo.split('/')[1]) + '</strong></td>'
          + '<td><code>' + (info.tag || '...') + '</code></td>'
          + '<td><code style="font-size:0.6rem">' + (info.sha ? info.sha.slice(0, 7) : '...') + '</code></td>'
          + '<td>' + (result || status) + '</td></tr>';
      }).join('');
      const canDeploy = state === 'ready' && infos.some(i => !i.tagExists);
      const btnLabel = isOnMain ? 'Create Tags & Deploy' : 'Create Test Tags';
      const buttons = state === 'done'
        ? '<button class="btn btn--secondary" onclick="closeDeployModal()">Close</button>'
        : state === 'deploying'
        ? '<button class="btn btn--secondary" disabled>Tagging...</button>'
        : '<button class="btn btn--secondary" onclick="closeDeployModal()">Cancel</button>'
          + ' <button class="btn ' + (isOnMain ? 'btn--primary' : 'btn--accent-warn') + '" '
          + (canDeploy ? 'onclick="confirmDeploy()"' : 'disabled') + '>' + (canDeploy ? btnLabel : 'All tagged') + '</button>';
      return '<div class="deploy-overlay" onclick="closeDeployModal()">'
        + '<div class="deploy-modal" onclick="event.stopPropagation()">'
        + '<div class="deploy-modal__title">Tag & Deploy</div>'
        + '<div class="deploy-modal__mode">' + modeLabel + '</div>'
        + '<table class="deploy-table"><thead><tr><th>Repo</th><th>Tag</th><th>SHA</th><th>Status</th></tr></thead>'
        + '<tbody>' + rows + '</tbody></table>'
        + '<div class="deploy-modal__actions">' + buttons + '</div></div></div>';
    }

    async function tagDeploy() {
      const el = document.getElementById('deploy-modal-root');
      if (!el) return;
      const placeholders = TAG_REPOS.map(r => ({ repo: r.name, label: r.label }));
      el.innerHTML = renderDeployModal(placeholders, 'loading', _isOnMain);
      try {
        _isOnMain = await detectIfOnMain();
        const prefix = tagPrefix();
        _deployInfos = await Promise.all(TAG_REPOS.map(r =>
          fetchRepoTagInfo(r.name, prefix).then(info => ({ ...info, label: r.label }))
        ));
        el.innerHTML = renderDeployModal(_deployInfos, 'ready', _isOnMain);
      } catch (err) {
        el.innerHTML = renderDeployModal(
          [{ repo: 'error', label: 'Error', tag: '', sha: '', tagExists: false, result: err.message }],
          'done', _isOnMain
        );
      }
    }

    async function confirmDeploy() {
      const el = document.getElementById('deploy-modal-root');
      if (!el) return;
      el.innerHTML = renderDeployModal(_deployInfos, 'deploying', _isOnMain);
      for (const info of _deployInfos) {
        if (info.tagExists) { info.result = 'ok'; continue; }
        try {
          await ghPost('/repos/' + info.repo + '/git/refs', { ref: 'refs/tags/' + info.tag, sha: info.sha });
          info.result = 'ok';
        } catch (err) { info.result = err.message; }
        el.innerHTML = renderDeployModal(_deployInfos, 'deploying', _isOnMain);
      }
      el.innerHTML = renderDeployModal(_deployInfos, 'done', _isOnMain);
    }

    function closeDeployModal() {
      const el = document.getElementById('deploy-modal-root');
      if (el) el.innerHTML = '';
    }
    // Expose for onclick handlers in rendered HTML
    window.tagDeploy = tagDeploy;
    window.confirmDeploy = confirmDeploy;
    window.closeDeployModal = closeDeployModal;

    /* ── PR branch detection ─────────────────────────── */

    function buildPRData(openPRs, closedPRs) {
      const map = new Map();
      for (const pr of openPRs) {
        const b = pr.head.ref;
        const d = map.get(b) || { openCount: 0, mergedCount: 0 };
        d.openCount++;
        map.set(b, d);
      }
      for (const pr of closedPRs) {
        if (!pr.merged_at) continue;
        const b = pr.head.ref;
        const d = map.get(b) || { openCount: 0, mergedCount: 0 };
        d.mergedCount++;
        map.set(b, d);
      }
      return map;
    }

    async function fetchOpenPRs() {
      try {
        const [clientOpen, apiOpen, clientClosed, apiClosed] = await Promise.all([
          ghFetch('/repos/bh679/carkedit-online/pulls?state=open&per_page=100'),
          ghFetch('/repos/bh679/carkedit-api/pulls?state=open&per_page=100'),
          ghFetch('/repos/bh679/carkedit-online/pulls?state=closed&per_page=100&sort=updated&direction=desc'),
          ghFetch('/repos/bh679/carkedit-api/pulls?state=closed&per_page=100&sort=updated&direction=desc'),
        ]);
        clientPRBranches = new Set(clientOpen.map(pr => pr.head.ref));
        apiPRBranches = new Set(apiOpen.map(pr => pr.head.ref));
        clientPRData = buildPRData(clientOpen, clientClosed);
        apiPRData = buildPRData(apiOpen, apiClosed);
      } catch { /* PR data unavailable — degrade silently */ }
    }

    /* ── GitHub API branch discovery ─────────────────── */

    async function fetchGhBranches() {
      try {
        const [clientRes, apiRes] = await Promise.all([
          ghFetch('/repos/bh679/carkedit-online/branches?per_page=100&sort=updated&direction=desc'),
          ghFetch('/repos/bh679/carkedit-api/branches?per_page=100&sort=updated&direction=desc'),
        ]);
        return {
          client: clientRes.map(b => b.name).filter(n => n !== 'HEAD'),
          api: apiRes.map(b => b.name).filter(n => n !== 'HEAD'),
        };
      } catch { return { client: [], api: [] }; }
    }

    function mergeBranchLists(phpBranches, ghBranches) {
      const set = new Set(phpBranches);
      const merged = [...phpBranches];
      for (const b of ghBranches) {
        if (!set.has(b)) {
          merged.push(b);
        }
      }
      return merged;
    }

    /* ── Firebase ─────────────────────────────────────── */

    async function loadFirebase() {
      const [appMod, authMod] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js'),
      ]);
      const app = appMod.initializeApp(FIREBASE_CONFIG);
      firebaseAuth = authMod.getAuth(app);
      authModule = authMod;
    }

    async function verifyWithServer(idToken) {
      const res = await fetch(apiUrl + '?action=auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'idToken=' + encodeURIComponent(idToken),
      });
      return res.ok;
    }

    async function doSignOut() {
      try { if (firebaseAuth) await authModule.signOut(firebaseAuth); } catch {}
      await fetch(apiUrl + '?action=logout');
      fbUserInfo = null;
      renderGate('Sign in with an admin Google account to continue.', true);
    }

    /* ── Rendering ────────────────────────────────────── */

    function renderGate(msg, showSignIn = false) {
      resetAdminHeaderMenu();
      document.getElementById('app').innerHTML = `
        ${renderAdminHeader()}
        <div class="bm__gate">
          <div>
            <h1>Branch Manager</h1>
            <p>${msg}</p>
            ${showSignIn ? '<button class="btn btn--google" id="gate-sign-in">Sign in with Google</button>' : ''}
          </div>
        </div>`;
      bindAdminHeader(document.getElementById('app'), {});
      const si = document.getElementById('gate-sign-in');
      if (si) {
        si.addEventListener('click', async () => {
          try {
            const provider = new authModule.GoogleAuthProvider();
            await authModule.signInWithPopup(firebaseAuth, provider);
          } catch (err) {
            renderGate('Sign-in failed: ' + (err.message || err), true);
          }
        });
      }
    }

    const IS_PRODUCTION = ['carkedit.com', 'www.carkedit.com'].includes(window.location.hostname);
    const STAGING_URL = 'https://brennan.games/carkedit-online/branch-manager.php';

    function renderDashboard() {
      resetAdminHeaderMenu();
      const app = document.getElementById('app');
      const prodBanner = IS_PRODUCTION ? `
        <div class="bm__prod-banner">
          <p>If you want to play on different branches, go to our staging server</p>
          <a href="${STAGING_URL}">Open Branch Manager on Staging</a>
        </div>` : '';
      app.innerHTML = `
        ${renderAdminHeader({ user: fbUserInfo })}
        ${prodBanner}
        <div class="bm${IS_PRODUCTION ? ' bm--greyed' : ''}">
          <h1 class="bm__title">Branch Manager</h1>
          <p class="bm__subtitle">Switch staging branches for carkedit-online and carkedit-api</p>

          <div id="reset-confirm" class="bm__confirm hidden">
            <p>Reset both repos to main? This will restart the API server.</p>
            <div class="bm__confirm-actions">
              <button class="btn--cancel" id="reset-cancel">Cancel</button>
              <button class="btn--danger" id="reset-go">Confirm Reset</button>
            </div>
          </div>

          <div id="restart-confirm" class="bm__confirm hidden">
            <p>Restart the API server?</p>
            <div class="bm__confirm-actions">
              <button class="btn--cancel" id="restart-cancel">Cancel</button>
              <button class="btn--danger" id="restart-go">Confirm Restart</button>
            </div>
          </div>

          <div class="bm__deploy-row">
            <button class="btn btn--accent" id="btn-tag-deploy" disabled title="Loading...">Tag &amp; Deploy</button>
            <button id="btn-reset" class="btn btn--secondary" style="padding:0.5rem var(--space-md);font-size:0.85rem">Reset to Main</button>
            <button id="btn-restart" class="btn btn--secondary" style="padding:0.5rem var(--space-md);font-size:0.85rem">Restart Server</button>
          </div>

          <div class="bm__top">
            <div class="bm__top-left">
              <div class="bm__linked">
                <h2>Linked Branch Switch</h2>
                <p>Select a client branch. If a matching API branch exists, it will be selected automatically.</p>
                <div class="bm__row">
                  <select id="linked-select"><option>Loading...</option></select>
                  <span class="bm__linked-api" id="linked-api-label">API: main</span>
                  <button id="btn-linked" disabled>Deploy Linked</button>
                </div>
                <div class="bm__warning" id="linked-warning"></div>
              </div>

              <div class="bm__repo">
                <h2>carkedit-online <span class="bm__badge bm__badge--client">client</span></h2>
                <div class="bm__current">Current branch: <strong id="client-current">loading...</strong></div>
                <div class="bm__row">
                  <select id="client-select"><option>Loading...</option></select>
                  <button id="btn-client" disabled>Deploy Client</button>
                </div>
                <div class="bm__warning" id="client-warning"></div>
              </div>

              <div class="bm__repo">
                <h2>carkedit-api <span class="bm__badge bm__badge--api">api</span></h2>
                <div class="bm__current">Current branch: <strong id="api-current">loading...</strong></div>
                <div class="bm__row">
                  <select id="api-select"><option>Loading...</option></select>
                  <button id="btn-api" disabled>Deploy API</button>
                </div>
              </div>

              <div class="bm__status" id="status-box"></div>
              <div class="bm__log-wrapper">
                <button class="bm__copy-btn" id="copy-log-btn" title="Copy error report">Copy</button>
                <div class="bm__log" id="output-log"></div>
              </div>
              <div id="deploy-modal-root"></div>
            </div>

            <div class="bm__top-right">
              <div class="bm__recent">
                <h2>Recent Tags</h2>
                <div class="bm__recent-col">
                  <div class="bm__current" style="margin-bottom:var(--space-xs)">Current version: <strong id="tags-client-version">loading...</strong></div>
                  <div class="bm__current" style="margin-bottom:var(--space-xs)">Live version: <strong id="live-client-version" style="color:#4caf50">loading...</strong></div>
                  <h3><span class="bm__badge bm__badge--client">client</span> carkedit-online</h3>
                  <ul class="bm__recent-list" id="recent-tags-client">
                    <li>Loading...</li>
                  </ul>
                </div>
                <div class="bm__recent-col" style="margin-top:var(--space-md)">
                  <div class="bm__current" style="margin-bottom:var(--space-xs)">Current version: <strong id="tags-api-version">loading...</strong></div>
                  <div class="bm__current" style="margin-bottom:var(--space-xs)">Live version: <strong id="live-api-version" style="color:#4caf50">loading...</strong></div>
                  <h3><span class="bm__badge bm__badge--api">api</span> carkedit-api</h3>
                  <ul class="bm__recent-list" id="recent-tags-api">
                    <li>Loading...</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <hr class="bm__divider">
          <div class="bm__recent">
            <h2>Recent Branches</h2>
            <div class="bm__filters" id="branch-filters">
              <div class="bm__filter-group">
                <span class="bm__filter-label">Merged:</span>
                <button class="bm__filter-btn bm__filter-btn--active" data-filter="mergeStatus" data-value="all">All</button>
                <button class="bm__filter-btn" data-filter="mergeStatus" data-value="not_merged">Not Merged</button>
                <button class="bm__filter-btn" data-filter="mergeStatus" data-value="merged">Merged</button>
              </div>
              <div class="bm__filter-group">
                <span class="bm__filter-label">Open PR:</span>
                <button class="bm__filter-btn bm__filter-btn--active" data-filter="openPR" data-value="all">All</button>
                <button class="bm__filter-btn" data-filter="openPR" data-value="yes">Yes</button>
                <button class="bm__filter-btn" data-filter="openPR" data-value="no">No</button>
              </div>
              <div class="bm__filter-group">
                <span class="bm__filter-label">Repos:</span>
                <button class="bm__filter-btn bm__filter-btn--client bm__filter-btn--active" data-filter="repoClient">Client</button>
                <button class="bm__filter-btn bm__filter-btn--api bm__filter-btn--active" data-filter="repoApi">API</button>
              </div>
              <span class="bm__filter-count" id="filter-count"></span>
            </div>
            <div class="bm__recent-list" id="recent-branches">
              <div>Loading...</div>
            </div>
          </div>

          <div class="bm__rescue">
            <a href="rescue.php">Emergency rescue (reset to main without auth)</a>
          </div>
        </div>`;

      bindAdminHeader(app, { user: fbUserInfo, onSignOut: doSignOut });
      if (!IS_PRODUCTION) {
        bindDashboard();
        loadStatus();
      }
    }

    /* ── Dashboard logic ──────────────────────────────── */

    function bindDashboard() {
      document.getElementById('linked-select').addEventListener('change', () => { updateLinkedLabel(); updateBmWarnings(); });
      document.getElementById('client-select').addEventListener('change', updateBmWarnings);
      document.getElementById('btn-linked').addEventListener('click', switchLinked);
      document.getElementById('btn-client').addEventListener('click', switchClient);
      document.getElementById('btn-api').addEventListener('click', switchApi);
      document.getElementById('btn-reset').addEventListener('click', resetToMain);
      document.getElementById('reset-cancel').addEventListener('click', () => document.getElementById('reset-confirm').classList.add('hidden'));
      document.getElementById('reset-go').addEventListener('click', confirmResetToMain);
      document.getElementById('btn-tag-deploy').addEventListener('click', tagDeploy);
      document.getElementById('btn-restart').addEventListener('click', () => document.getElementById('restart-confirm').classList.remove('hidden'));
      document.getElementById('restart-cancel').addEventListener('click', () => document.getElementById('restart-confirm').classList.add('hidden'));
      document.getElementById('restart-go').addEventListener('click', () => { document.getElementById('restart-confirm').classList.add('hidden'); restartServer(); });
      document.getElementById('copy-log-btn').addEventListener('click', function() {
        const log = document.getElementById('output-log').textContent;
        navigator.clipboard.writeText(log).then(() => {
          this.textContent = 'Copied!';
          this.classList.add('copied');
          setTimeout(() => { this.textContent = 'Copy'; this.classList.remove('copied'); }, 2000);
        });
      });

      // Branch filter buttons
      document.getElementById('branch-filters').addEventListener('click', function(e) {
        const btn = e.target.closest('.bm__filter-btn');
        if (!btn) return;

        const filterKey = btn.dataset.filter;
        const filterVal = btn.dataset.value;

        if (filterKey === 'repoClient' || filterKey === 'repoApi') {
          // Toggle buttons — at least one repo must stay on
          const next = !filters[filterKey];
          const otherKey = filterKey === 'repoClient' ? 'repoApi' : 'repoClient';
          if (!next && !filters[otherKey]) return;
          filters[filterKey] = next;
          btn.classList.toggle('bm__filter-btn--active', next);
        } else {
          // Radio buttons — one active per group
          filters[filterKey] = filterVal;
          const group = btn.closest('.bm__filter-group');
          group.querySelectorAll('.bm__filter-btn').forEach(b => b.classList.remove('bm__filter-btn--active'));
          btn.classList.add('bm__filter-btn--active');
        }

        populateMergedBranches('recent-branches');
      });
    }

    function showStatus(msg, type) {
      const box = document.getElementById('status-box');
      box.className = 'bm__status ' + type;
      box.textContent = msg;
      document.getElementById('output-log').textContent = '';
      document.getElementById('copy-log-btn').style.display = 'none';
    }

    function showResult(data) {
      if (data.status === 'ok') {
        showStatus('Branch switch successful. Reloading page...', 'ok');
      } else {
        showStatus('Branch switch completed with errors.', 'error');
      }
      if (data.results) {
        let log = '';
        for (const key in data.results) {
          const r = data.results[key];
          log += '--- ' + key + ' (rc=' + r.rc + ') ---\n';
          if (r.output) log += r.output.join('\n') + '\n';
        }
        document.getElementById('output-log').textContent = log;
        document.getElementById('copy-log-btn').style.display = 'inline-block';
      }
      if (data.status === 'ok') {
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setTimeout(loadStatus, 1500);
      }
    }

    function populateSelect(el, branches, current, versions, prBranches) {
      el.innerHTML = '';
      branches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        const ver = versions && versions[b] ? ' (v' + versions[b] + ')' : '';
        const hasPR = prBranches && prBranches.has(b);
        opt.textContent = b + ver + (b === current ? ' — current' : '') + (hasPR ? ' — PR' : '');
        if (hasPR) opt.classList.add('has-pr');
        if (b === current) opt.selected = true;
        el.appendChild(opt);
      });
    }

    let liveClientVersion = null;
    let liveApiVersion = null;

    function fetchLiveVersions() {
      const PROD = 'https://play.carkedit.com';
      return Promise.all([
        fetch(PROD + '/package.json').then(r => r.json()).then(d => { liveClientVersion = d.version || null; }).catch(() => {}),
        fetch(PROD + '/api/carkedit/health').then(r => r.json()).then(d => { liveApiVersion = d.version || null; }).catch(() => {}),
      ]).then(() => {
        const elC = document.getElementById('live-client-version');
        const elA = document.getElementById('live-api-version');
        if (elC) elC.textContent = liveClientVersion ? 'v' + liveClientVersion : '?';
        if (elA) elA.textContent = liveApiVersion ? 'v' + liveApiVersion : '?';
      });
    }

    function populateRecent(elId, branches, versions, prBranches, liveVersion, branchDetails, repoSlug, prData) {
      const container = document.getElementById(elId);
      if (!container) return;
      container.innerHTML = '';
      if (branches.length === 0) {
        container.innerHTML = '<div style="font-size:0.8rem;color:var(--color-text-muted)">No branches</div>';
        return;
      }
      const liveNorm = liveVersion ? liveVersion.replace(/^v/, '') : null;

      branches.forEach(b => {
        const ver = versions && versions[b] ? ' (v' + versions[b] + ')' : '';
        const hasPR = prBranches && prBranches.has(b);
        const tagNorm = b.replace(/^v/, '');
        const isLive = liveNorm && tagNorm === liveNorm;
        const details = branchDetails && branchDetails[b];
        const pr = prData && prData.get(b);

        if (details && b !== 'main') {
          // Dashboard card item
          const card = document.createElement('div');
          card.className = 'bm__branch-card' + (hasPR ? ' has-pr' : '');

          // Clickable row
          const row = document.createElement('div');
          row.className = 'bm__branch-card-row';
          row.innerHTML = '<span class="bm__chevron">\u25B6</span>'
            + '<span class="bm__branch-name">' + escapeHtml(b) + '<span style="color:var(--color-text-muted);font-weight:400">' + escapeHtml(ver) + '</span></span>';

          // Badges on the row
          if (details.commitsAhead > 0) {
            row.innerHTML += '<span class="bm__count-badge bm__count-badge--ahead">' + details.commitsAhead + ' ahead</span>';
          }
          if (pr && pr.openCount > 0) {
            row.innerHTML += '<span class="bm__count-badge bm__count-badge--pr">' + pr.openCount + ' PR' + (pr.openCount !== 1 ? 's' : '') + '</span>';
          }
          if (pr && pr.mergedCount > 0) {
            row.innerHTML += '<span class="bm__count-badge bm__count-badge--merged">' + pr.mergedCount + ' merged</span>';
          }
          card.appendChild(row);

          // Detail panel (hidden until click)
          const panel = document.createElement('div');
          panel.className = 'bm__branch-detail';

          if (details.commitMessage) {
            panel.innerHTML += '<div class="bm__detail-row">'
              + '<span class="bm__detail-label">Last commit:</span>'
              + '<span class="bm__detail-value">' + escapeHtml(details.commitMessage) + '</span></div>';
          }

          panel.innerHTML += '<div class="bm__detail-row">'
            + '<span class="bm__detail-label">Commits:</span>'
            + '<span class="bm__detail-value">' + details.commitsAhead + ' ahead of main</span></div>';

          if (pr) {
            panel.innerHTML += '<div class="bm__detail-row">'
              + '<span class="bm__detail-label">PRs:</span>'
              + '<span class="bm__detail-value">' + pr.openCount + ' open, ' + pr.mergedCount + ' merged</span></div>';
          }

          if (repoSlug) {
            const ghUrl = 'https://github.com/' + repoSlug + '/tree/' + encodeURIComponent(b);
            panel.innerHTML += '<div class="bm__detail-row">'
              + '<span class="bm__detail-label">GitHub:</span>'
              + '<span class="bm__detail-value"><a href="' + ghUrl + '" target="_blank" rel="noopener">' + escapeHtml(b) + '</a></span></div>';
          }

          card.appendChild(panel);

          // Toggle expand on click
          row.addEventListener('click', () => card.classList.toggle('is-expanded'));

          container.appendChild(card);
        } else {
          // Simple text item (main branch or tags list)
          const li = document.createElement('li');
          li.style.cssText = 'font-size:0.8rem;color:var(--color-text-muted);padding:0.2em 0;font-family:monospace;';
          li.textContent = (hasPR ? '\u25CF ' : '') + b + ver;
          if (isLive) {
            li.classList.add('is-live');
            const badge = document.createElement('span');
            badge.className = 'bm__badge bm__badge--live';
            badge.textContent = 'LIVE';
            li.appendChild(badge);
          }
          if (hasPR) li.classList.add('has-pr');
          container.appendChild(li);
        }
      });
    }

    function truncateList(elId, limit) {
      const container = document.getElementById(elId);
      if (!container) return;
      const items = Array.from(container.children);
      if (items.length <= limit) return;
      items.slice(limit).forEach(el => el.style.display = 'none');
      const btn = document.createElement('li');
      btn.style.cssText = 'font-size:0.8rem;color:var(--color-primary);padding:0.2em 0;font-family:monospace;cursor:pointer;';
      btn.textContent = 'See more (' + (items.length - limit) + ')';
      btn.addEventListener('click', () => {
        items.forEach(el => el.style.display = '');
        btn.remove();
      });
      container.appendChild(btn);
    }

    function applyBranchFilters(names) {
      return names.filter(b => {
        const inClient = clientBranches.includes(b);
        const inApi = apiBranches.includes(b);

        // Repo filter — branch must be in at least one enabled repo
        const repoPass = (filters.repoClient && inClient) || (filters.repoApi && inApi);
        if (!repoPass) return false;

        // Merge status filter
        if (filters.mergeStatus !== 'all') {
          const isOpen = clientOpenSet.has(b) || apiOpenSet.has(b);
          if (filters.mergeStatus === 'not_merged' && !isOpen) return false;
          if (filters.mergeStatus === 'merged' && isOpen) return false;
        }

        // Open PR filter
        if (filters.openPR !== 'all') {
          const totalOpen = (clientPRData.get(b)?.openCount || 0) + (apiPRData.get(b)?.openCount || 0);
          if (filters.openPR === 'yes' && totalOpen === 0) return false;
          if (filters.openPR === 'no' && totalOpen > 0) return false;
        }

        return true;
      });
    }

    function updateFilterCount(filtered, total) {
      const el = document.getElementById('filter-count');
      if (!el) return;
      el.textContent = filtered === total ? total + ' branches' : filtered + ' of ' + total + ' branches';
    }

    function populateMergedBranches(elId) {
      const container = document.getElementById(elId);
      if (!container) return;
      container.innerHTML = '';

      // Merge client and API branches, deduplicate, keep sorted by most recent
      const allNames = new Set();
      const orderedNames = [];
      for (const b of clientBranches) { if (b !== 'main' && !allNames.has(b)) { allNames.add(b); orderedNames.push(b); } }
      for (const b of apiBranches) { if (b !== 'main' && !allNames.has(b)) { allNames.add(b); orderedNames.push(b); } }

      const filteredNames = applyBranchFilters(orderedNames);
      updateFilterCount(filteredNames.length, orderedNames.length);

      if (filteredNames.length === 0) {
        container.innerHTML = '<div style="font-size:0.8rem;color:var(--color-text-muted)">No branches match filters</div>';
        return;
      }

      const INITIAL_SHOW = 5;
      let showCount = INITIAL_SHOW;

      function renderCards() {
        container.innerHTML = '';

        filteredNames.slice(0, showCount).forEach(renderBranchCard);

        if (showCount < filteredNames.length) {
          const btn = document.createElement('button');
          btn.className = 'bm__show-more';
          btn.textContent = 'Show more (' + (filteredNames.length - showCount) + ' remaining)';
          btn.addEventListener('click', () => { showCount = filteredNames.length; renderCards(); });
          container.appendChild(btn);
        } else if (filteredNames.length > INITIAL_SHOW) {
          const btn = document.createElement('button');
          btn.className = 'bm__show-more';
          btn.textContent = 'Show less';
          btn.addEventListener('click', () => { showCount = INITIAL_SHOW; renderCards(); });
          container.appendChild(btn);
        }
      }

      function renderBranchCard(b) {
        const inClient = clientBranches.includes(b);
        const inApi = apiBranches.includes(b);
        const cDetails = inClient && clientBranchDetails[b];
        const aDetails = inApi && apiBranchDetails[b];
        const cPR = clientPRData.get(b);
        const aPR = apiPRData.get(b);
        const cVer = inClient && clientVersions[b] ? 'v' + clientVersions[b] : '';
        const aVer = inApi && apiVersions[b] ? 'v' + apiVersions[b] : '';

        // Combine PR stats
        const totalOpen = (cPR ? cPR.openCount : 0) + (aPR ? aPR.openCount : 0);
        const totalMerged = (cPR ? cPR.mergedCount : 0) + (aPR ? aPR.mergedCount : 0);
        const totalAhead = (cDetails ? cDetails.commitsAhead : 0) + (aDetails ? aDetails.commitsAhead : 0);

        const isActive = (b === currentClientBranch || b === currentApiBranch);

        const card = document.createElement('div');
        card.className = 'bm__branch-card' + (totalOpen > 0 ? ' has-pr' : '') + (isActive ? ' is-active' : '');

        // Pick most recent commit date between repos
        const cDate = cDetails && cDetails.commitDate ? new Date(cDetails.commitDate) : null;
        const aDate = aDetails && aDetails.commitDate ? new Date(aDetails.commitDate) : null;
        let dateStr = '';
        const latest = (cDate && aDate) ? (cDate > aDate ? cDate : aDate) : (cDate || aDate);
        if (latest && !isNaN(latest)) {
          dateStr = latest.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            + ' ' + latest.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        }

        // Card row
        const row = document.createElement('div');
        row.className = 'bm__branch-card-row';
        let rowHtml = '<span class="bm__chevron">\u25B6</span>'
          + '<span class="bm__branch-name">' + escapeHtml(b)
          + (dateStr ? ' <span class="bm__branch-date">' + dateStr + '</span>' : '')
          + '</span>';

        // Repo badges
        if (inClient) rowHtml += '<span class="bm__badge bm__badge--client">client</span>';
        if (inApi) rowHtml += '<span class="bm__badge bm__badge--api">api</span>';
        if (isActive) rowHtml += '<span class="bm__badge bm__badge--active">ACTIVE</span>';

        // Count badges
        if (totalAhead > 0) rowHtml += '<span class="bm__count-badge bm__count-badge--ahead">' + totalAhead + ' ahead</span>';
        if (totalOpen > 0) rowHtml += '<span class="bm__count-badge bm__count-badge--pr">' + totalOpen + ' PR' + (totalOpen !== 1 ? 's' : '') + '</span>';
        if (totalMerged > 0) rowHtml += '<span class="bm__count-badge bm__count-badge--merged">' + totalMerged + ' merged</span>';

        // Deploy button — always enabled; green if active branch is behind remote
        const cRemoteSha = cDetails && cDetails.remoteSha ? cDetails.remoteSha : '';
        const aRemoteSha = aDetails && aDetails.remoteSha ? aDetails.remoteSha : '';
        const isBehindClient = isActive && inClient && b === currentClientBranch && clientDeployedSha && cRemoteSha && clientDeployedSha !== cRemoteSha;
        const isBehindApi = isActive && inApi && b === currentApiBranch && apiDeployedSha && aRemoteSha && apiDeployedSha !== aRemoteSha;
        const isBehind = isBehindClient || isBehindApi;
        const deployBtnClass = 'bm__deploy-btn' + (isBehind ? ' bm__deploy-btn--update' : '');
        const deployTitle = isBehind ? 'Update available — deploy latest' : (isActive ? 'Re-deploy this branch' : 'Deploy this branch to staging');
        rowHtml += '<button class="' + deployBtnClass + '" title="' + deployTitle + '"'
          + ' data-branch="' + escapeHtml(b) + '">Deploy</button>';

        row.innerHTML = rowHtml;
        card.appendChild(row);

        // Wire up deploy button (stop propagation so card doesn't toggle)
        const deployBtn = row.querySelector('.bm__deploy-btn');
        deployBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          deployBranch(b);
        });

        // Detail panel — stacked cards per repo
        const panel = document.createElement('div');
        panel.className = 'bm__branch-detail';

        if (inClient) {
          let html = '<div class="bm__repo-detail">'
            + '<div class="bm__repo-detail-header"><span class="bm__badge bm__badge--client">client</span> carkedit-online'
            + (cVer ? ' <span style="color:var(--color-text-muted)">(' + cVer + ')</span>' : '') + '</div>';
          if (cDetails && cDetails.commitMessage) {
            html += '<div class="bm__detail-row"><span class="bm__detail-label">Last commit:</span>'
              + '<span class="bm__detail-value">' + escapeHtml(cDetails.commitMessage) + '</span></div>';
          }
          if (cDetails) {
            html += '<div class="bm__detail-row"><span class="bm__detail-label">Commits:</span>'
              + '<span class="bm__detail-value">' + cDetails.commitsAhead + ' ahead of main</span></div>';
          }
          if (cPR) {
            html += '<div class="bm__detail-row"><span class="bm__detail-label">PRs:</span>'
              + '<span class="bm__detail-value">' + cPR.openCount + ' open, ' + cPR.mergedCount + ' merged</span></div>';
          }
          html += '<div class="bm__detail-row"><span class="bm__detail-label">GitHub:</span>'
            + '<span class="bm__detail-value"><a href="https://github.com/bh679/carkedit-online/tree/' + encodeURIComponent(b) + '" target="_blank" rel="noopener">' + escapeHtml(b) + '</a></span></div>';
          html += '</div>';
          panel.innerHTML += html;
        }

        if (inApi) {
          let html = '<div class="bm__repo-detail">'
            + '<div class="bm__repo-detail-header"><span class="bm__badge bm__badge--api">api</span> carkedit-api'
            + (aVer ? ' <span style="color:var(--color-text-muted)">(' + aVer + ')</span>' : '') + '</div>';
          if (aDetails && aDetails.commitMessage) {
            html += '<div class="bm__detail-row"><span class="bm__detail-label">Last commit:</span>'
              + '<span class="bm__detail-value">' + escapeHtml(aDetails.commitMessage) + '</span></div>';
          }
          if (aDetails) {
            html += '<div class="bm__detail-row"><span class="bm__detail-label">Commits:</span>'
              + '<span class="bm__detail-value">' + aDetails.commitsAhead + ' ahead of main</span></div>';
          }
          if (aPR) {
            html += '<div class="bm__detail-row"><span class="bm__detail-label">PRs:</span>'
              + '<span class="bm__detail-value">' + aPR.openCount + ' open, ' + aPR.mergedCount + ' merged</span></div>';
          }
          html += '<div class="bm__detail-row"><span class="bm__detail-label">GitHub:</span>'
            + '<span class="bm__detail-value"><a href="https://github.com/bh679/carkedit-api/tree/' + encodeURIComponent(b) + '" target="_blank" rel="noopener">' + escapeHtml(b) + '</a></span></div>';
          html += '</div>';
          panel.innerHTML += html;
        }

        card.appendChild(panel);
        row.addEventListener('click', () => card.classList.toggle('is-expanded'));
        container.appendChild(card);
      }

      renderCards();
    }

    function loadStatus() {
      Promise.all([
        fetch(apiUrl + '?action=status').then(r => r.json()),
        fetchOpenPRs(),
        fetchLiveVersions(),
        fetchGhBranches(),
      ]).then(([data, , , ghBranches]) => {
          clientBranches = mergeBranchLists(data.client.openBranches || [], ghBranches.client);
          apiBranches = mergeBranchLists(data.api.openBranches || [], ghBranches.api);
          clientOpenSet = new Set(data.client.openBranches || []);
          apiOpenSet = new Set(data.api.openBranches || []);
          clientVersions = data.client.versions || {};
          apiVersions = data.api.versions || {};
          clientHasBM = data.client.hasBranchManager || {};
          clientBranchDetails = data.client.branchDetails || {};
          apiBranchDetails = data.api.branchDetails || {};

          const clientCur = data.client.current;
          const apiCur = data.api.current;
          currentClientBranch = clientCur;
          currentApiBranch = apiCur;
          clientDeployedSha = data.client.deployedSha || '';
          apiDeployedSha = data.api.deployedSha || '';
          const clientVer = clientVersions[clientCur] || '?';
          const apiVer = apiVersions[apiCur] || '?';

          const clientCurDetails = clientBranchDetails[clientCur];
          const clientRemoteSha = clientCurDetails && clientCurDetails.remoteSha ? clientCurDetails.remoteSha : '';
          const clientBehind = clientDeployedSha && clientRemoteSha && clientDeployedSha !== clientRemoteSha;
          document.getElementById('client-current').innerHTML = escapeHtml(clientCur + ' (v' + clientVer + ')')
            + (clientBehind ? ' <span class="bm__update-badge">update available</span>' : '');

          const apiCurDetails = apiBranchDetails[apiCur];
          const apiRemoteSha = apiCurDetails && apiCurDetails.remoteSha ? apiCurDetails.remoteSha : '';
          const apiBehind = apiDeployedSha && apiRemoteSha && apiDeployedSha !== apiRemoteSha;
          document.getElementById('api-current').innerHTML = escapeHtml(apiCur + ' (v' + apiVer + ')')
            + (apiBehind ? ' <span class="bm__update-badge">update available</span>' : '');
          populateSelect(document.getElementById('client-select'), clientBranches, clientCur, clientVersions, clientPRBranches);
          populateSelect(document.getElementById('api-select'), apiBranches, apiCur, apiVersions, apiPRBranches);
          populateSelect(document.getElementById('linked-select'), clientBranches, clientCur, clientVersions, clientPRBranches);
          updateLinkedLabel();
          updateBmWarnings();
          populateMergedBranches('recent-branches');
          populateRecent('recent-tags-client', data.client.tags || [], {}, null, liveClientVersion);
          populateRecent('recent-tags-api', data.api.tags || [], {}, null, liveApiVersion);
          truncateList('recent-tags-client', 4);
          truncateList('recent-tags-api', 4);
          document.getElementById('tags-client-version').textContent = 'v' + clientVer;
          document.getElementById('tags-api-version').textContent = 'v' + apiVer;
          document.getElementById('btn-client').disabled = false;
          document.getElementById('btn-api').disabled = false;
          document.getElementById('btn-linked').disabled = false;

          // Update Tag & Deploy button state
          const onMain = clientCur === 'main' && apiCur === 'main';
          _isOnMain = onMain;
          const deployBtn = document.getElementById('btn-tag-deploy');
          if (deployBtn) {
            deployBtn.disabled = !onMain;
            deployBtn.className = 'btn ' + (onMain ? 'btn--accent' : 'btn--secondary');
            deployBtn.title = onMain ? 'Create version tags and trigger deploy' : 'Switch to main to tag & deploy';
          }
        })
        .catch(err => showStatus('Failed to load status: ' + err.message, 'error'));
    }

    function updateLinkedLabel() {
      const clientBranch = document.getElementById('linked-select').value;
      const matchingApi = apiBranches.indexOf(clientBranch) >= 0 ? clientBranch : 'main';
      const apiVer = apiVersions[matchingApi] ? ' (v' + apiVersions[matchingApi] + ')' : '';
      document.getElementById('linked-api-label').textContent = 'API: ' + matchingApi + apiVer;
    }

    function updateBmWarnings() {
      const BM_MSG = 'This branch predates the branch manager. Switching to it may remove this page.';
      const linkedVal = document.getElementById('linked-select')?.value;
      const clientVal = document.getElementById('client-select')?.value;
      const lw = document.getElementById('linked-warning');
      const cw = document.getElementById('client-warning');
      if (lw) lw.textContent = (linkedVal && clientHasBM[linkedVal] === false) ? BM_MSG : '';
      if (cw) cw.textContent = (clientVal && clientHasBM[clientVal] === false) ? BM_MSG : '';
    }

    function disableAll() {
      ['btn-client', 'btn-api', 'btn-linked', 'btn-reset', 'btn-restart', 'btn-tag-deploy'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = true;
      });
      document.querySelectorAll('.bm__deploy-btn').forEach(el => el.disabled = true);
    }
    function enableAll() {
      ['btn-client', 'btn-api', 'btn-linked', 'btn-reset', 'btn-restart'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = false;
      });
      // Tag & Deploy re-enabled only if on main (loadStatus will handle)
      document.querySelectorAll('.bm__deploy-btn').forEach(el => el.disabled = false);
    }

    function switchLinked() {
      const clientBranch = document.getElementById('linked-select').value;
      const ab = apiBranches.indexOf(clientBranch) >= 0 ? clientBranch : 'main';
      showStatus('Deploying client: ' + clientBranch + ', API: ' + ab + '...', 'loading');
      disableAll();
      fetch(apiUrl + '?action=switch&client=' + encodeURIComponent(clientBranch) + '&api=' + encodeURIComponent(ab))
        .then(r => r.json()).then(showResult)
        .catch(err => { showStatus('Error: ' + err.message, 'error'); enableAll(); });
    }
    function switchClient() {
      const branch = document.getElementById('client-select').value;
      showStatus('Deploying client: ' + branch + '...', 'loading');
      disableAll();
      fetch(apiUrl + '?action=switch&client=' + encodeURIComponent(branch))
        .then(r => r.json()).then(showResult)
        .catch(err => { showStatus('Error: ' + err.message, 'error'); enableAll(); });
    }
    function switchApi() {
      const branch = document.getElementById('api-select').value;
      showStatus('Deploying API: ' + branch + '...', 'loading');
      disableAll();
      fetch(apiUrl + '?action=switch&api=' + encodeURIComponent(branch))
        .then(r => r.json()).then(showResult)
        .catch(err => { showStatus('Error: ' + err.message, 'error'); enableAll(); });
    }
    function deployBranch(branch) {
      const inClient = clientBranches.includes(branch);
      const inApi = apiBranches.includes(branch);
      const params = [];
      if (inClient) params.push('client=' + encodeURIComponent(branch));
      if (inApi) params.push('api=' + encodeURIComponent(branch));
      if (params.length === 0) return;
      const label = inClient && inApi ? 'client + API' : inClient ? 'client' : 'API';
      showStatus('Deploying ' + label + ': ' + branch + '...', 'loading');
      disableAll();
      fetch(apiUrl + '?action=switch&' + params.join('&'))
        .then(r => r.json()).then(showResult)
        .catch(err => { showStatus('Error: ' + err.message, 'error'); enableAll(); });
    }

    function resetToMain() {
      document.getElementById('reset-confirm').classList.remove('hidden');
    }
    function confirmResetToMain() {
      document.getElementById('reset-confirm').classList.add('hidden');
      showStatus('Resetting everything to main...', 'loading');
      disableAll();
      fetch(apiUrl + '?action=switch&client=main&api=main')
        .then(r => r.json()).then(showResult)
        .catch(err => { showStatus('Error: ' + err.message, 'error'); enableAll(); });
    }

    function restartServer() {
      showStatus('Restarting API server...', 'loading');
      disableAll();
      fetch('/api/carkedit/server/restart', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + _fbIdToken },
      })
        .then(r => r.json())
        .then(() => { showStatus('Server restart triggered. Page may reload shortly.', 'ok'); enableAll(); })
        .catch(err => { showStatus('Error: ' + err.message, 'error'); enableAll(); });
    }

    /* ── Boot ─────────────────────────────────────────── */

    if (IS_PRODUCTION) {
      // On production, show greyed-out dashboard with staging link — no auth needed
      renderDashboard();
    } else {

    renderGate('Loading...', false);

    try {
      await loadFirebase();
    } catch (err) {
      renderGate('Failed to load Firebase — check your network.', false);
    }

    function storeFirebaseToken(token) { _fbIdToken = token; }

    if (PHP_AUTHED) {
      // Session still valid — try to get a fresh Firebase token for GH access
      renderDashboard();
      // Attempt to load GH token in background, then refresh to show PR highlights
      authModule.onAuthStateChanged(firebaseAuth, async (user) => {
        if (user) {
          const idToken = await user.getIdToken();
          storeFirebaseToken(idToken);
          loadStatus(); // re-fetch with PR data now available
        }
      });
    } else {
      authModule.onAuthStateChanged(firebaseAuth, async (user) => {
        if (!user) {
          renderGate('Sign in with an admin Google account to continue.', true);
          return;
        }
        fbUserInfo = { displayName: user.displayName, photoURL: user.photoURL };
        renderGate('Verifying admin access...', false);
        try {
          const idToken = await user.getIdToken();
          if (await verifyWithServer(idToken)) {
            storeFirebaseToken(idToken);
            renderDashboard();
          } else {
            renderGate('Your account is not an admin. Ask an admin to flag you via /admin-users.', false);
          }
        } catch (err) {
          renderGate('Failed to verify: ' + (err.message || err), false);
        }
      });
    }

    } // end IS_PRODUCTION else
    </script>
</body>
</html>
