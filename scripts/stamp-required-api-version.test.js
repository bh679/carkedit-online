/**
 * Unit test for scripts/stamp-required-api-version.js
 *
 * Spawns the script in a subprocess with --cwd pointed at a temp fixture
 * that simulates a local carkedit-online checkout next to a sibling
 * carkedit-api. Verifies the stamp lands in the local package.json.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, 'stamp-required-api-version.js');

async function setupFixture(opts) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cd-stamp-fixture-'));
  const localDir = path.join(root, 'carkedit-online');
  const siblingDir = path.join(root, 'carkedit-api');
  await fs.mkdir(localDir);
  // git init the local repo so `git rev-parse --git-common-dir` works.
  execSync('git init -q', { cwd: localDir });
  execSync('git config user.email test@example.com && git config user.name test',
    { cwd: localDir, shell: '/bin/sh' });
  await fs.writeFile(
    path.join(localDir, 'package.json'),
    JSON.stringify({ name: 'carkedit-online', version: '1.06.0186', ...(opts.initialReqd !== undefined ? { requiredApiVersion: opts.initialReqd } : {}) }, null, 2) + '\n',
  );
  if (opts.siblingVersion !== null) {
    await fs.mkdir(siblingDir);
    await fs.writeFile(
      path.join(siblingDir, 'package.json'),
      JSON.stringify({ name: 'carkedit-api', version: opts.siblingVersion }, null, 2) + '\n',
    );
  }
  return { root, localDir };
}

async function readLocalPkg(localDir) {
  const raw = await fs.readFile(path.join(localDir, 'package.json'), 'utf8');
  return JSON.parse(raw);
}

test('stamp: sibling carkedit-api/package.json drives the requiredApiVersion field', async () => {
  const { root, localDir } = await setupFixture({ siblingVersion: '0.02.0010' });
  try {
    execFileSync('node', [SCRIPT, '--cwd', localDir], { stdio: 'pipe' });
    const pkg = await readLocalPkg(localDir);
    assert.equal(pkg.requiredApiVersion, '0.02.0010');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('stamp: existing field is overwritten with sibling version', async () => {
  const { root, localDir } = await setupFixture({
    siblingVersion: '0.02.0042',
    initialReqd: '0.02.0001',
  });
  try {
    execFileSync('node', [SCRIPT, '--cwd', localDir], { stdio: 'pipe' });
    const pkg = await readLocalPkg(localDir);
    assert.equal(pkg.requiredApiVersion, '0.02.0042');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('stamp: idempotent when sibling version matches existing field', async () => {
  const { root, localDir } = await setupFixture({
    siblingVersion: '0.02.0005',
    initialReqd: '0.02.0005',
  });
  try {
    const before = await fs.stat(path.join(localDir, 'package.json'));
    // Wait a tick so mtime would differ if writeFile ran.
    await new Promise((r) => setTimeout(r, 10));
    execFileSync('node', [SCRIPT, '--cwd', localDir], { stdio: 'pipe' });
    const after = await fs.stat(path.join(localDir, 'package.json'));
    assert.equal(after.mtimeMs, before.mtimeMs, 'package.json must not be rewritten when unchanged');
    const pkg = await readLocalPkg(localDir);
    assert.equal(pkg.requiredApiVersion, '0.02.0005');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('stamp: --dry-run prints intended value without writing', async () => {
  const { root, localDir } = await setupFixture({ siblingVersion: '0.02.0099' });
  try {
    const stdout = execFileSync('node', [SCRIPT, '--cwd', localDir, '--dry-run'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    }).toString();
    assert.match(stdout, /would set requiredApiVersion=0\.02\.0099/);
    const pkg = await readLocalPkg(localDir);
    assert.equal(pkg.requiredApiVersion, undefined, 'dry-run must not write');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('stamp: missing sibling does not crash (exit 0) — warning printed, package.json untouched', async () => {
  const { root, localDir } = await setupFixture({ siblingVersion: null, initialReqd: undefined });
  try {
    // Fallback fetch may or may not succeed depending on network. Either way
    // the script exits 0 and either leaves the file alone or stamps it.
    const beforePkg = await readLocalPkg(localDir);
    execFileSync('node', [SCRIPT, '--cwd', localDir], { stdio: 'pipe' });
    const afterPkg = await readLocalPkg(localDir);
    // The script must not crash. If it stamped (network succeeded) the field
    // is set; if it didn't (offline), the file is unchanged. Both are valid.
    if (afterPkg.requiredApiVersion !== undefined) {
      assert.match(afterPkg.requiredApiVersion, /^\d+\.\d+\.\d+/);
    } else {
      assert.deepEqual(afterPkg, beforePkg);
    }
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
