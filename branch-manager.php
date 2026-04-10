<?php
/**
 * Branch Manager — switch staging branches for carkedit-online and carkedit-api.
 *
 * Self-contained: all HTML/CSS/JS is inline. No external dependencies from the repo.
 * On every page load, regenerates rescue.php (gitignored) as a zero-input failsafe.
 *
 * Auth: same deploy token as deploy.php.
 */

session_start();

$TOKEN_FILE   = '/home/bitnami/server/.deploy-token-carkedit-online';
$CLIENT_DIR   = '/opt/bitnami/apache/htdocs/carkedit-online';
$API_DIR      = '/home/bitnami/server/carkedit-api';
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

/* ------------------------------------------------------------------ */
/*  Regenerate rescue.php                                              */
/* ------------------------------------------------------------------ */

function generateRescue($rescueFile, $tokenFile, $clientDir, $apiDir) {
    $code = '<?php
/* Auto-generated rescue file. Visit this URL to reset both repos to main. */
header("Content-Type: text/html; charset=utf-8");

$tokenFile = ' . var_export($tokenFile, true) . ';
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
/*  Token auth                                                         */
/* ------------------------------------------------------------------ */

$expectedToken = loadToken($TOKEN_FILE);

// Check session or query param
$authenticated = false;
if (isset($_SESSION['bm_auth']) && $_SESSION['bm_auth'] === true) {
    $authenticated = true;
}
if (isset($_GET['token']) && strlen($expectedToken) > 0 && hash_equals($expectedToken, $_GET['token'])) {
    $_SESSION['bm_auth'] = true;
    $authenticated = true;
}
if (isset($_POST['token']) && strlen($expectedToken) > 0 && hash_equals($expectedToken, $_POST['token'])) {
    $_SESSION['bm_auth'] = true;
    $authenticated = true;
}

/* ------------------------------------------------------------------ */
/*  Regenerate rescue on every authenticated load                      */
/* ------------------------------------------------------------------ */

if ($authenticated) {
    generateRescue($RESCUE_FILE, $TOKEN_FILE, $CLIENT_DIR, $API_DIR);
}

/* ------------------------------------------------------------------ */
/*  API actions (JSON responses)                                       */
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

/* Login */
.login-box{max-width:350px;margin:4rem auto;text-align:center}
.login-box h2{margin-bottom:1rem}
.login-box input{width:100%;padding:0.75rem;border:1px solid #333;border-radius:6px;background:#16213e;color:#eee;font-size:1rem;margin-bottom:0.75rem}
.login-box button{width:100%;padding:0.75rem;border:none;border-radius:6px;background:#e94560;color:#fff;font-size:1rem;cursor:pointer;font-weight:bold}
.login-box button:hover{background:#c73e55}
.login-error{color:#f44336;font-size:0.85rem;margin-bottom:0.5rem}

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
</style>
</head>
<body>

<?php if (!$authenticated): ?>
<!-- Login form -->
<div class="login-box">
  <h2>Branch Manager</h2>
  <p style="color:#888;margin-bottom:1.5rem">Enter deploy token to continue</p>
  <?php if (isset($_POST['token'])): ?>
    <div class="login-error">Invalid token</div>
  <?php endif; ?>
  <form method="post">
    <input type="password" name="token" placeholder="Deploy token" autofocus>
    <button type="submit">Sign In</button>
  </form>
</div>

<?php else: ?>
<!-- Dashboard -->
<div class="container">
  <nav class="nav">
    <a href="./">Home</a>
    <a href="stats">Stats</a>
    <a href="admin-users">Users</a>
    <a href="admin-image-gen">ImageAI</a>
    <a href="dev-dashboard">Dev</a>
    <a href="branch-manager.php" class="active">Branch</a>
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

<script>
(function() {
  'use strict';

  var apiUrl = 'branch-manager.php';
  var statusBox = document.getElementById('status-box');
  var outputLog = document.getElementById('output-log');
  var apiBranches = [];
  var clientBranches = [];

  function showStatus(msg, type) {
    statusBox.className = 'status ' + type;
    statusBox.textContent = msg;
    outputLog.textContent = '';
  }

  function showResult(data) {
    if (data.status === 'ok') {
      showStatus('Branch switch successful. Reloading status...', 'ok');
    } else {
      showStatus('Branch switch completed with errors.', 'error');
    }
    if (data.results) {
      var log = '';
      for (var key in data.results) {
        var r = data.results[key];
        log += '--- ' + key + ' (rc=' + r.rc + ') ---\n';
        if (r.output) log += r.output.join('\n') + '\n';
      }
      outputLog.textContent = log;
    }
    setTimeout(loadStatus, 1500);
  }

  function populateSelect(el, branches, current) {
    el.innerHTML = '';
    branches.forEach(function(b) {
      var opt = document.createElement('option');
      opt.value = b;
      opt.textContent = b + (b === current ? ' (current)' : '');
      if (b === current) opt.selected = true;
      el.appendChild(opt);
    });
  }

  function loadStatus() {
    fetch(apiUrl + '?action=status')
      .then(function(r) { return r.json(); })
      .then(function(data) {
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
      .catch(function(err) {
        showStatus('Failed to load status: ' + err.message, 'error');
      });
  }

  function updateLinkedLabel() {
    var clientBranch = document.getElementById('linked-select').value;
    var matchingApi = apiBranches.indexOf(clientBranch) >= 0 ? clientBranch : 'main';
    document.getElementById('linked-api-label').textContent = 'API: ' + matchingApi;
  }

  document.getElementById('linked-select').addEventListener('change', updateLinkedLabel);

  window.switchLinked = function() {
    var clientBranch = document.getElementById('linked-select').value;
    var apiBranch = apiBranches.indexOf(clientBranch) >= 0 ? clientBranch : 'main';
    showStatus('Deploying client: ' + clientBranch + ', API: ' + apiBranch + '...', 'loading');
    disableAll();
    fetch(apiUrl + '?action=switch&client=' + encodeURIComponent(clientBranch) + '&api=' + encodeURIComponent(apiBranch))
      .then(function(r) { return r.json(); })
      .then(showResult)
      .catch(function(err) { showStatus('Error: ' + err.message, 'error'); enableAll(); });
  };

  window.switchClient = function() {
    var branch = document.getElementById('client-select').value;
    showStatus('Deploying client: ' + branch + '...', 'loading');
    disableAll();
    fetch(apiUrl + '?action=switch&client=' + encodeURIComponent(branch))
      .then(function(r) { return r.json(); })
      .then(showResult)
      .catch(function(err) { showStatus('Error: ' + err.message, 'error'); enableAll(); });
  };

  window.switchApi = function() {
    var branch = document.getElementById('api-select').value;
    showStatus('Deploying API: ' + branch + '...', 'loading');
    disableAll();
    fetch(apiUrl + '?action=switch&api=' + encodeURIComponent(branch))
      .then(function(r) { return r.json(); })
      .then(showResult)
      .catch(function(err) { showStatus('Error: ' + err.message, 'error'); enableAll(); });
  };

  window.resetToMain = function() {
    if (!confirm('Reset both repos to main? This will restart the API server.')) return;
    showStatus('Resetting everything to main...', 'loading');
    disableAll();
    fetch(apiUrl + '?action=switch&client=main&api=main')
      .then(function(r) { return r.json(); })
      .then(showResult)
      .catch(function(err) { showStatus('Error: ' + err.message, 'error'); enableAll(); });
  };

  function disableAll() {
    ['btn-client', 'btn-api', 'btn-linked', 'btn-reset'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.disabled = true;
    });
  }

  function enableAll() {
    ['btn-client', 'btn-api', 'btn-linked', 'btn-reset'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.disabled = false;
    });
  }

  loadStatus();
})();
</script>
<?php endif; ?>

</body>
</html>
