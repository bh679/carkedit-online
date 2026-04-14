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
    $result = runCmd('sudo -u bitnami bash -c "cd ' . escapeshellarg($dir) . ' && git fetch --all --prune 2>/dev/null && git branch -r --no-color 2>/dev/null"');
    $branches = [];
    foreach ($result['output'] as $line) {
        $line = trim($line);
        if (strpos($line, 'origin/HEAD') !== false) continue;
        if (strpos($line, 'origin/') === 0) {
            $branches[] = substr($line, 7); // strip 'origin/'
        }
    }
    sort($branches);
    return $branches;
}

function getOpenBranches($dir) {
    // Branches not yet merged into main — i.e. still "open"
    $result = runCmd('sudo -u bitnami bash -c "cd ' . escapeshellarg($dir) . ' && git branch -r --no-merged origin/main --no-color 2>/dev/null"');
    $branches = ['main']; // always include main
    foreach ($result['output'] as $line) {
        $line = trim($line);
        if (strpos($line, 'origin/HEAD') !== false) continue;
        if (strpos($line, 'origin/') === 0) {
            $branches[] = substr($line, 7);
        }
    }
    sort($branches);
    return array_unique($branches);
}

function getCurrentBranch($dir) {
    $result = runCmd('sudo -u bitnami bash -c "cd ' . escapeshellarg($dir) . ' && git branch --show-current 2>/dev/null"');
    return trim(implode('', $result['output'])) ?: 'unknown';
}

function validateBranch($branch) {
    return preg_match('/^[a-zA-Z0-9_\-\.\/]+$/', $branch);
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
    $r1 = runCmd("sudo -u bitnami bash -c \"cd " . escapeshellarg($clientDir) . " && git fetch origin && git checkout main && git reset --hard origin/main\"");
    $results[] = ["repo" => "client", "rc" => $r1["rc"], "output" => $r1["output"]];

    // Reset API to main, rebuild, restart
    $r2 = runCmd("sudo -u bitnami bash -c \"cd " . escapeshellarg($apiDir) . " && git fetch origin && git checkout main && git reset --hard origin/main && npm install --omit=dev && npm run build\"");
    $results[] = ["repo" => "api-pull", "rc" => $r2["rc"], "output" => $r2["output"]];

    $r3 = runCmd("sudo -u bitnami bash -c \"cd " . escapeshellarg($apiDir) . " && pm2 restart carkedit-api\"");
    $results[] = ["repo" => "api-restart", "rc" => $r3["rc"], "output" => $r3["output"]];

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
        echo json_encode([
            'client' => [
                'current' => getCurrentBranch($CLIENT_DIR),
                'branches' => getBranches($CLIENT_DIR),
                'openBranches' => getOpenBranches($CLIENT_DIR),
            ],
            'api' => [
                'current' => getCurrentBranch($API_DIR),
                'branches' => getBranches($API_DIR),
                'openBranches' => getOpenBranches($API_DIR),
            ],
            'state' => $state,
        ]);
        exit;
    }

    if ($action === 'switch') {
        $clientBranch = $_GET['client'] ?? '';
        $apiBranch    = $_GET['api'] ?? '';
        $results = [];

        // Switch client branch
        if ($clientBranch !== '' && validateBranch($clientBranch)) {
            $esc = escapeshellarg($clientBranch);
            $r = runCmd('sudo -u bitnami bash -c "cd ' . escapeshellarg($CLIENT_DIR) . ' && git fetch origin && git checkout ' . $esc . ' && git reset --hard origin/' . $esc . '"');
            $results['client'] = ['branch' => $clientBranch, 'rc' => $r['rc'], 'output' => $r['output']];
        }

        // Switch API branch
        if ($apiBranch !== '' && validateBranch($apiBranch)) {
            $esc = escapeshellarg($apiBranch);
            $r = runCmd('sudo -u bitnami bash -c "cd ' . escapeshellarg($API_DIR) . ' && git fetch origin && git checkout ' . $esc . ' && git reset --hard origin/' . $esc . ' && npm install --omit=dev && npm run build"');
            $results['api-pull'] = ['branch' => $apiBranch, 'rc' => $r['rc'], 'output' => $r['output']];

            // Restart PM2
            $r2 = runCmd('sudo -u bitnami bash -c "cd ' . escapeshellarg($API_DIR) . ' && pm2 restart carkedit-api"');
            $results['api-restart'] = ['rc' => $r2['rc'], 'output' => $r2['output']];
        }

        // Update state
        $state = readState($STATE_FILE);
        if ($clientBranch !== '' && validateBranch($clientBranch)) $state['client'] = $clientBranch;
        if ($apiBranch !== '' && validateBranch($apiBranch))       $state['api'] = $apiBranch;
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
        .bm { max-width: 700px; margin: 0 auto; padding: var(--space-md) var(--space-lg); }
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

        /* Rescue link */
        .bm__rescue { text-align: center; margin-top: var(--space-lg); padding-top: var(--space-md); border-top: 1px solid var(--color-border); }
        .bm__rescue a { color: var(--color-text-muted); font-size: 0.8rem; text-decoration: none; }
        .bm__rescue a:hover { color: var(--color-danger, #e94560); }

        .hidden { display: none !important; }
    </style>
</head>
<body>
    <div id="app"></div>
    <script type="module">
    'use strict';

    import { renderAdminHeader, bindAdminHeader, resetAdminHeaderMenu } from './js/components/admin-header.js';

    const FIREBASE_CONFIG = {
      apiKey: "AIzaSyC6QJz6jTzJkBWV7Shd9XpCfHWrovJ9vaI",
      authDomain: "carkedit-5cc8e.firebaseapp.com",
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

    function renderDashboard() {
      resetAdminHeaderMenu();
      const app = document.getElementById('app');
      app.innerHTML = `
        ${renderAdminHeader({ user: fbUserInfo })}
        <div class="bm">
          <h1 class="bm__title">Branch Manager</h1>
          <p class="bm__subtitle">Switch staging branches for carkedit-online and carkedit-api</p>

          <div class="bm__reset">
            <span>Reset everything to main</span>
            <button id="btn-reset">Reset to Main</button>
          </div>

          <div class="bm__linked">
            <h2>Linked Branch Switch</h2>
            <p>Select a client branch. If a matching API branch exists, it will be selected automatically.</p>
            <div class="bm__row">
              <select id="linked-select"><option>Loading...</option></select>
              <span class="bm__linked-api" id="linked-api-label">API: main</span>
              <button id="btn-linked" disabled>Deploy Linked</button>
            </div>
          </div>

          <div class="bm__repo">
            <h2>carkedit-online <span class="bm__badge bm__badge--client">client</span></h2>
            <div class="bm__current">Current branch: <strong id="client-current">loading...</strong></div>
            <div class="bm__row">
              <select id="client-select"><option>Loading...</option></select>
              <button id="btn-client" disabled>Deploy Client</button>
            </div>
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

          <div class="bm__rescue">
            <a href="rescue.php">Emergency rescue (reset to main without auth)</a>
          </div>
        </div>`;

      bindAdminHeader(app, { user: fbUserInfo, onSignOut: doSignOut });
      bindDashboard();
      loadStatus();
    }

    /* ── Dashboard logic ──────────────────────────────── */

    function bindDashboard() {
      document.getElementById('linked-select').addEventListener('change', updateLinkedLabel);
      document.getElementById('btn-linked').addEventListener('click', switchLinked);
      document.getElementById('btn-client').addEventListener('click', switchClient);
      document.getElementById('btn-api').addEventListener('click', switchApi);
      document.getElementById('btn-reset').addEventListener('click', resetToMain);
      document.getElementById('copy-log-btn').addEventListener('click', function() {
        const log = document.getElementById('output-log').textContent;
        navigator.clipboard.writeText(log).then(() => {
          this.textContent = 'Copied!';
          this.classList.add('copied');
          setTimeout(() => { this.textContent = 'Copy'; this.classList.remove('copied'); }, 2000);
        });
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
        showStatus('Branch switch successful. Reloading status...', 'ok');
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
      setTimeout(loadStatus, 1500);
    }

    function populateSelect(el, branches, current) {
      el.innerHTML = '';
      branches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.textContent = b + (b === current ? ' (current)' : '');
        if (b === current) opt.selected = true;
        el.appendChild(opt);
      });
    }

    function loadStatus() {
      fetch(apiUrl + '?action=status')
        .then(r => r.json())
        .then(data => {
          clientBranches = data.client.branches || [];
          apiBranches = data.api.branches || [];
          document.getElementById('client-current').textContent = data.client.current;
          document.getElementById('api-current').textContent = data.api.current;
          populateSelect(document.getElementById('client-select'), clientBranches, data.client.current);
          populateSelect(document.getElementById('api-select'), apiBranches, data.api.current);
          populateSelect(document.getElementById('linked-select'), data.client.openBranches || clientBranches, data.client.current);
          updateLinkedLabel();
          document.getElementById('btn-client').disabled = false;
          document.getElementById('btn-api').disabled = false;
          document.getElementById('btn-linked').disabled = false;
        })
        .catch(err => showStatus('Failed to load status: ' + err.message, 'error'));
    }

    function updateLinkedLabel() {
      const clientBranch = document.getElementById('linked-select').value;
      const matchingApi = apiBranches.indexOf(clientBranch) >= 0 ? clientBranch : 'main';
      document.getElementById('linked-api-label').textContent = 'API: ' + matchingApi;
    }

    function disableAll() {
      ['btn-client', 'btn-api', 'btn-linked', 'btn-reset'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = true;
      });
    }
    function enableAll() {
      ['btn-client', 'btn-api', 'btn-linked', 'btn-reset'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = false;
      });
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
    function resetToMain() {
      if (!confirm('Reset both repos to main? This will restart the API server.')) return;
      showStatus('Resetting everything to main...', 'loading');
      disableAll();
      fetch(apiUrl + '?action=switch&client=main&api=main')
        .then(r => r.json()).then(showResult)
        .catch(err => { showStatus('Error: ' + err.message, 'error'); enableAll(); });
    }

    /* ── Boot ─────────────────────────────────────────── */

    renderGate('Loading...', false);

    try {
      await loadFirebase();
    } catch (err) {
      renderGate('Failed to load Firebase — check your network.', false);
    }

    if (PHP_AUTHED) {
      // Session still valid — go straight to dashboard
      renderDashboard();
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
            renderDashboard();
          } else {
            renderGate('Your account is not an admin. Ask an admin to flag you via /admin-users.', false);
          }
        } catch (err) {
          renderGate('Failed to verify: ' + (err.message || err), false);
        }
      });
    }
    </script>
</body>
</html>
