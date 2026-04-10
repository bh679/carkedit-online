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
    $r2 = runCmd("sudo -u bitnami bash -c \"cd " . escapeshellarg($apiDir) . " && git fetch origin && git checkout main && git reset --hard origin/main && npm run build\"");
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
            ],
            'api' => [
                'current' => getCurrentBranch($API_DIR),
                'branches' => getBranches($API_DIR),
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
            $r = runCmd('sudo -u bitnami bash -c "cd ' . escapeshellarg($API_DIR) . ' && git fetch origin && git checkout ' . $esc . ' && git reset --hard origin/' . $esc . ' && npm run build"');
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

/* ------------------------------------------------------------------ */
/*  HTML Dashboard (self-contained)                                    */
/* ------------------------------------------------------------------ */
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CarkedIt - Branch Manager</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#1a1a2e;color:#eee;min-height:100vh}
.container{max-width:700px;margin:0 auto;padding:1.5rem}

/* Nav bar */
.nav{display:flex;gap:0.5rem;align-items:center;padding:0.75rem 0;border-bottom:1px solid rgba(255,255,255,0.1);margin-bottom:1.5rem;flex-wrap:wrap}
.nav a{color:#aaa;text-decoration:none;font-size:0.85rem;padding:0.3rem 0.6rem;border-radius:4px}
.nav a:hover{color:#fff;background:rgba(255,255,255,0.1)}
.nav a.active{color:#e94560;font-weight:bold}

/* Header */
h1{font-size:1.3rem;margin-bottom:0.5rem}
.subtitle{color:#888;font-size:0.9rem;margin-bottom:1.5rem}

/* Auth gate */
.auth-gate{max-width:400px;margin:4rem auto;text-align:center}
.auth-gate h2{margin-bottom:0.5rem}
.auth-gate p{color:#888;font-size:0.9rem;margin-bottom:1.5rem}
.btn-google{display:inline-flex;align-items:center;gap:0.5rem;padding:0.75rem 1.5rem;border:none;border-radius:6px;background:#fff;color:#333;font-size:1rem;cursor:pointer;font-weight:500}
.btn-google:hover{background:#f0f0f0}
.btn-google svg{width:18px;height:18px}
.auth-error{color:#f44336;font-size:0.85rem;margin-top:1rem}
.auth-loading{color:#0abde3;font-size:0.9rem}
.btn-signout{background:none;border:1px solid #666;color:#aaa;padding:0.4rem 0.8rem;border-radius:4px;cursor:pointer;font-size:0.8rem}
.btn-signout:hover{color:#fff;border-color:#aaa}

/* Reset banner */
.reset-banner{background:#e94560;border-radius:8px;padding:1rem;display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;flex-wrap:wrap;gap:0.5rem}
.reset-banner span{font-weight:bold}
.reset-banner button{padding:0.5rem 1.25rem;border:2px solid #fff;border-radius:6px;background:transparent;color:#fff;font-weight:bold;cursor:pointer;font-size:0.9rem}
.reset-banner button:hover{background:rgba(255,255,255,0.2)}

/* Repo section */
.repo{background:rgba(255,255,255,0.05);border-radius:8px;padding:1.25rem;margin-bottom:1rem}
.repo h2{font-size:1rem;margin-bottom:0.75rem;display:flex;align-items:center;gap:0.5rem}
.repo h2 .badge{font-size:0.75rem;padding:0.15rem 0.5rem;border-radius:4px;font-weight:normal}
.badge-client{background:#0a3d62;color:#82ccdd}
.badge-api{background:#3c1361;color:#be2edd}
.current{font-size:0.85rem;color:#aaa;margin-bottom:0.75rem}
.current strong{color:#4caf50}

/* Branch select */
.branch-row{display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap}
.branch-row select{flex:1;min-width:200px;padding:0.6rem;border:1px solid #333;border-radius:6px;background:#16213e;color:#eee;font-size:0.9rem}
.branch-row button{padding:0.6rem 1.25rem;border:none;border-radius:6px;background:#0abde3;color:#fff;font-weight:bold;cursor:pointer;font-size:0.9rem;white-space:nowrap}
.branch-row button:hover{background:#0997b8}
.branch-row button:disabled{opacity:0.5;cursor:not-allowed}

/* Linked switch */
.linked-section{background:rgba(255,255,255,0.05);border-radius:8px;padding:1.25rem;margin-bottom:1rem;border:1px solid rgba(233,69,96,0.3)}
.linked-section h2{font-size:1rem;margin-bottom:0.5rem}
.linked-section p{font-size:0.85rem;color:#aaa;margin-bottom:0.75rem}
.linked-row{display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap}
.linked-row select{flex:1;min-width:200px;padding:0.6rem;border:1px solid #333;border-radius:6px;background:#16213e;color:#eee;font-size:0.9rem}
.linked-row button{padding:0.6rem 1.25rem;border:none;border-radius:6px;background:#e94560;color:#fff;font-weight:bold;cursor:pointer;font-size:0.9rem;white-space:nowrap}
.linked-row button:hover{background:#c73e55}

/* Status */
.status{margin-top:1rem;padding:0.75rem;border-radius:6px;font-size:0.85rem;display:none}
.status.ok{display:block;background:rgba(76,175,80,0.15);border:1px solid rgba(76,175,80,0.3);color:#4caf50}
.status.error{display:block;background:rgba(244,67,54,0.15);border:1px solid rgba(244,67,54,0.3);color:#f44336}
.status.loading{display:block;background:rgba(10,189,227,0.15);border:1px solid rgba(10,189,227,0.3);color:#0abde3}

/* Output log */
.output-log{margin-top:0.5rem;font-size:0.75rem;color:#888;white-space:pre-wrap;max-height:200px;overflow-y:auto}

/* Rescue link */
.rescue-link{text-align:center;margin-top:1.5rem;padding-top:1rem;border-top:1px solid rgba(255,255,255,0.1)}
.rescue-link a{color:#888;font-size:0.8rem;text-decoration:none}
.rescue-link a:hover{color:#e94560}

.hidden{display:none!important}
</style>
</head>
<body>

<!-- Auth gate (shown when not signed in) -->
<div id="auth-gate" class="auth-gate hidden">
  <h2>Branch Manager</h2>
  <p>Sign in with your admin Google account to manage staging branches.</p>
  <div id="auth-loading" class="auth-loading">Loading Firebase...</div>
  <button id="btn-google-signin" class="btn-google hidden">
    <svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
    Sign in with Google
  </button>
  <div id="auth-error" class="auth-error hidden"></div>
</div>

<!-- Dashboard (shown when authenticated) -->
<div id="dashboard" class="<?= $authenticated ? '' : 'hidden' ?>">
<div class="container">
  <nav class="nav">
    <a href="./">Home</a>
    <a href="stats">Stats</a>
    <a href="admin-users">Users</a>
    <a href="admin-image-gen">ImageAI</a>
    <a href="dev-dashboard">Dev</a>
    <a href="branch-manager.php" class="active">Branch</a>
    <span style="margin-left:auto"></span>
    <button class="btn-signout" id="btn-signout">Sign Out</button>
  </nav>

  <h1>Branch Manager</h1>
  <p class="subtitle">Switch staging branches for carkedit-online and carkedit-api</p>

  <!-- Reset to main -->
  <div class="reset-banner">
    <span>Reset everything to main</span>
    <button id="btn-reset" onclick="resetToMain()">Reset to Main</button>
  </div>

  <!-- Linked branch switch -->
  <div class="linked-section">
    <h2>Linked Branch Switch</h2>
    <p>Select a client branch. If a matching API branch exists, it will be selected automatically.</p>
    <div class="linked-row">
      <select id="linked-select"><option>Loading...</option></select>
      <span style="color:#888;font-size:0.85rem" id="linked-api-label">API: main</span>
      <button id="btn-linked" onclick="switchLinked()" disabled>Deploy Linked</button>
    </div>
  </div>

  <!-- Client repo -->
  <div class="repo">
    <h2>carkedit-online <span class="badge badge-client">client</span></h2>
    <div class="current">Current branch: <strong id="client-current">loading...</strong></div>
    <div class="branch-row">
      <select id="client-select"><option>Loading...</option></select>
      <button id="btn-client" onclick="switchClient()" disabled>Deploy Client</button>
    </div>
  </div>

  <!-- API repo -->
  <div class="repo">
    <h2>carkedit-api <span class="badge badge-api">api</span></h2>
    <div class="current">Current branch: <strong id="api-current">loading...</strong></div>
    <div class="branch-row">
      <select id="api-select"><option>Loading...</option></select>
      <button id="btn-api" onclick="switchApi()" disabled>Deploy API</button>
    </div>
  </div>

  <!-- Status -->
  <div class="status" id="status-box"></div>
  <div class="output-log" id="output-log"></div>

  <!-- Rescue link -->
  <div class="rescue-link">
    <a href="rescue.php">Emergency rescue (reset to main without auth)</a>
  </div>
</div>
</div>

<script type="module">
'use strict';

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyC6QJz6jTzJkBWV7Shd9XpCfHWrovJ9vaI",
  authDomain: "carkedit-5cc8e.firebaseapp.com",
  projectId: "carkedit-5cc8e",
  storageBucket: "carkedit-5cc8e.firebasestorage.app",
  messagingSenderId: "144073275425",
  appId: "1:144073275425:web:2301fbbccc2be69c654b60",
};

const PHP_AUTHED = <?= $authenticated ? 'true' : 'false' ?>;

let firebaseAuth = null;
let authModule = null;

/* ---------------------------------------------------------------- */
/*  Firebase auth                                                    */
/* ---------------------------------------------------------------- */

async function loadFirebase() {
  const [appMod, authMod] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js'),
  ]);
  const app = appMod.initializeApp(FIREBASE_CONFIG);
  firebaseAuth = authMod.getAuth(app);
  authModule = authMod;
  return authMod;
}

async function verifyWithServer(idToken) {
  const res = await fetch('branch-manager.php?action=auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'idToken=' + encodeURIComponent(idToken),
  });
  return res.ok;
}

async function initAuth() {
  const authLoading = document.getElementById('auth-loading');
  const btnGoogle   = document.getElementById('btn-google-signin');
  const authError   = document.getElementById('auth-error');
  const authGate    = document.getElementById('auth-gate');
  const dashboard   = document.getElementById('dashboard');

  try {
    await loadFirebase();
  } catch (err) {
    authLoading.textContent = 'Failed to load Firebase. Check your network.';
    return;
  }

  authLoading.classList.add('hidden');

  // If already PHP-authed (session), just set up the sign-out handler
  if (PHP_AUTHED) {
    setupSignOut();
    loadStatus();
    return;
  }

  // Watch for Firebase auth state
  authModule.onAuthStateChanged(firebaseAuth, async (fbUser) => {
    if (!fbUser) {
      // Show sign-in button
      authGate.classList.remove('hidden');
      btnGoogle.classList.remove('hidden');
      authError.classList.add('hidden');
      dashboard.classList.add('hidden');
      return;
    }

    // User signed in — verify admin with server
    authGate.classList.remove('hidden');
    btnGoogle.classList.add('hidden');
    authError.classList.add('hidden');
    authLoading.textContent = 'Verifying admin access...';
    authLoading.classList.remove('hidden');

    try {
      const idToken = await fbUser.getIdToken();
      const isAdmin = await verifyWithServer(idToken);

      if (isAdmin) {
        authGate.classList.add('hidden');
        dashboard.classList.remove('hidden');
        setupSignOut();
        loadStatus();
      } else {
        authLoading.classList.add('hidden');
        authError.textContent = 'Your account is not an admin. Ask an admin to flag you via /admin-users.';
        authError.classList.remove('hidden');
        // Show a sign-out option
        btnGoogle.textContent = 'Sign out & try another account';
        btnGoogle.classList.remove('hidden');
        btnGoogle.onclick = async () => {
          await authModule.signOut(firebaseAuth);
          btnGoogle.textContent = 'Sign in with Google';
          btnGoogle.onclick = doGoogleSignIn;
        };
      }
    } catch (err) {
      authLoading.classList.add('hidden');
      authError.textContent = 'Failed to verify: ' + (err.message || err);
      authError.classList.remove('hidden');
    }
  });

  async function doGoogleSignIn() {
    try {
      const provider = new authModule.GoogleAuthProvider();
      await authModule.signInWithPopup(firebaseAuth, provider);
    } catch (err) {
      authError.textContent = 'Sign-in failed: ' + (err.message || err);
      authError.classList.remove('hidden');
    }
  }

  btnGoogle.addEventListener('click', doGoogleSignIn);
}

function setupSignOut() {
  document.getElementById('btn-signout').addEventListener('click', async () => {
    try {
      if (firebaseAuth) await authModule.signOut(firebaseAuth);
    } catch {}
    await fetch('branch-manager.php?action=logout');
    window.location.reload();
  });
}

/* ---------------------------------------------------------------- */
/*  Branch management (same as before)                               */
/* ---------------------------------------------------------------- */

const apiUrl = 'branch-manager.php';
let apiBranches = [];
let clientBranches = [];

function showStatus(msg, type) {
  const box = document.getElementById('status-box');
  box.className = 'status ' + type;
  box.textContent = msg;
  document.getElementById('output-log').textContent = '';
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
      populateSelect(document.getElementById('linked-select'), clientBranches, data.client.current);

      updateLinkedLabel();

      document.getElementById('btn-client').disabled = false;
      document.getElementById('btn-api').disabled = false;
      document.getElementById('btn-linked').disabled = false;
    })
    .catch(err => {
      showStatus('Failed to load status: ' + err.message, 'error');
    });
}

function updateLinkedLabel() {
  const clientBranch = document.getElementById('linked-select').value;
  const matchingApi = apiBranches.indexOf(clientBranch) >= 0 ? clientBranch : 'main';
  document.getElementById('linked-api-label').textContent = 'API: ' + matchingApi;
}

document.getElementById('linked-select').addEventListener('change', updateLinkedLabel);

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

window.switchLinked = function() {
  const clientBranch = document.getElementById('linked-select').value;
  const apiBranch = apiBranches.indexOf(clientBranch) >= 0 ? clientBranch : 'main';
  showStatus('Deploying client: ' + clientBranch + ', API: ' + apiBranch + '...', 'loading');
  disableAll();
  fetch(apiUrl + '?action=switch&client=' + encodeURIComponent(clientBranch) + '&api=' + encodeURIComponent(apiBranch))
    .then(r => r.json())
    .then(showResult)
    .catch(err => { showStatus('Error: ' + err.message, 'error'); enableAll(); });
};

window.switchClient = function() {
  const branch = document.getElementById('client-select').value;
  showStatus('Deploying client: ' + branch + '...', 'loading');
  disableAll();
  fetch(apiUrl + '?action=switch&client=' + encodeURIComponent(branch))
    .then(r => r.json())
    .then(showResult)
    .catch(err => { showStatus('Error: ' + err.message, 'error'); enableAll(); });
};

window.switchApi = function() {
  const branch = document.getElementById('api-select').value;
  showStatus('Deploying API: ' + branch + '...', 'loading');
  disableAll();
  fetch(apiUrl + '?action=switch&api=' + encodeURIComponent(branch))
    .then(r => r.json())
    .then(showResult)
    .catch(err => { showStatus('Error: ' + err.message, 'error'); enableAll(); });
};

window.resetToMain = function() {
  if (!confirm('Reset both repos to main? This will restart the API server.')) return;
  showStatus('Resetting everything to main...', 'loading');
  disableAll();
  fetch(apiUrl + '?action=switch&client=main&api=main')
    .then(r => r.json())
    .then(showResult)
    .catch(err => { showStatus('Error: ' + err.message, 'error'); enableAll(); });
};

/* Boot */
initAuth();
</script>

</body>
</html>
