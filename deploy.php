<?php
/**
 * Deploy endpoint — triggers git pull with real-time status.
 * Usage: GET /carkedit-online/deploy.php?token=SECRET&target=client&branch=main
 *
 * Writes deploy-status.json at each step so deploying.html can show progress.
 * Optional: &branch=<name> to deploy a specific branch (default: main).
 */

header('Content-Type: application/json');

$statusFile = __DIR__ . '/deploy-status.json';
$maxHistory = 10;

/* ------------------------------------------------------------------ */
/*  Status file helpers                                                */
/* ------------------------------------------------------------------ */

function readStatus($file) {
    if (!is_readable($file)) {
        return ['deploying' => false, 'history' => []];
    }
    $data = json_decode(file_get_contents($file), true);
    return is_array($data) ? $data : ['deploying' => false, 'history' => []];
}

function writeStatus($file, $data) {
    file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
}

function addStep(&$status, $name, $stepStatus = 'active') {
    if (isset($status['steps'])) {
        foreach ($status['steps'] as &$s) {
            if ($s['status'] === 'active') {
                $s['status'] = 'done';
            }
        }
        unset($s);
    }
    $status['steps'][] = [
        'name'   => $name,
        'time'   => gmdate('c'),
        'status' => $stepStatus,
    ];
    $status['currentStep'] = $name;
}

function startDeploy($file, $target, $maxHistory) {
    $prev = readStatus($file);
    $status = [
        'deploying'   => true,
        'target'      => $target,
        'startedAt'   => gmdate('c'),
        'currentStep' => 'starting',
        'steps'       => [
            ['name' => 'starting', 'time' => gmdate('c'), 'status' => 'active'],
        ],
        'history'     => $prev['history'] ?? [],
    ];
    writeStatus($file, $status);
    return $status;
}

function completeDeploy($file, &$status, $success, $maxHistory) {
    addStep($status, 'complete', $success ? 'done' : 'error');
    $status['deploying'] = false;

    $historyEntry = [
        'target'      => $status['target'],
        'startedAt'   => $status['startedAt'],
        'completedAt' => gmdate('c'),
        'duration'    => time() - strtotime($status['startedAt']),
        'status'      => $success ? 'success' : 'failed',
    ];
    array_unshift($status['history'], $historyEntry);
    $status['history'] = array_slice($status['history'], 0, $maxHistory);

    writeStatus($file, $status);
}

/* ------------------------------------------------------------------ */
/*  Run a single shell command and capture output                      */
/* ------------------------------------------------------------------ */

function runCmd($cmd) {
    $output = [];
    $rc = 0;
    exec($cmd . ' 2>&1', $output, $rc);
    return ['output' => $output, 'rc' => $rc];
}

/* ------------------------------------------------------------------ */
/*  Token validation                                                   */
/* ------------------------------------------------------------------ */

$tokenFile = '/home/bitnami/server/.deploy-token-carkedit-online';
if (!is_readable($tokenFile)) {
    http_response_code(500);
    echo json_encode(['error' => 'Deploy token not readable']);
    exit;
}
$expectedToken = trim(file_get_contents($tokenFile));
if (strlen($expectedToken) === 0) {
    http_response_code(500);
    echo json_encode(['error' => 'Deploy token is empty']);
    exit;
}

$providedToken = $_GET['token'] ?? '';
if (strlen($providedToken) === 0 || !hash_equals($expectedToken, $providedToken)) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden']);
    exit;
}

/* ------------------------------------------------------------------ */
/*  Target validation                                                  */
/* ------------------------------------------------------------------ */

$target = $_GET['target'] ?? 'client';
if (!in_array($target, ['client'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid target. Use: client']);
    exit;
}

/* ------------------------------------------------------------------ */
/*  Branch validation                                                  */
/* ------------------------------------------------------------------ */

$branch = $_GET['branch'] ?? 'main';
if (!preg_match('/^[a-zA-Z0-9_\-\.\/]+$/', $branch)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid branch name']);
    exit;
}

/* ------------------------------------------------------------------ */
/*  Deploy with step-by-step status                                    */
/* ------------------------------------------------------------------ */

$branchStateFile = __DIR__ . '/branch-state.json';

$status = startDeploy($statusFile, $target, $maxHistory);
$allOutput = [];
$failed = false;

// Step: Pull client code
addStep($status, 'pulling-client');
writeStatus($statusFile, $status);
$escapedBranch = escapeshellarg($branch);
$result = runCmd('sudo -u bitnami bash -c "cd /opt/bitnami/apache/htdocs/carkedit-online && git fetch origin && git checkout ' . $escapedBranch . ' && git reset --hard origin/' . $escapedBranch . '"');
$allOutput = array_merge($allOutput, $result['output']);
if ($result['rc'] !== 0) {
    $failed = true;
}

// Update branch state
if (!$failed) {
    $branchState = is_readable($branchStateFile) ? json_decode(file_get_contents($branchStateFile), true) : [];
    if (!is_array($branchState)) $branchState = [];
    $branchState['client'] = $branch;
    $branchState['clientUpdatedAt'] = gmdate('c');
    file_put_contents($branchStateFile, json_encode($branchState, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
}

// Finalize
completeDeploy($statusFile, $status, !$failed, $maxHistory);

// Return response
if ($failed) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'target' => $target,
        'branch' => $branch,
        'output' => array_values(array_filter($allOutput)),
    ]);
} else {
    echo json_encode([
        'status' => 'ok',
        'target' => $target,
        'branch' => $branch,
        'output' => array_values(array_filter($allOutput)),
    ]);
}
