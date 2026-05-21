#!/usr/bin/env node
/**
 * scripts/stamp-required-api-version.js
 *
 * Stamps `requiredApiVersion` in this repo's package.json with the version
 * carkedit-api was at when this commit was made. Wired up via the pre-commit
 * hook in `.githooks/pre-commit` so the stamp is automatically part of every
 * client commit.
 *
 * Lookup order:
 *   1. Sibling working tree at `<parent-of-main-repo>/carkedit-api/package.json`
 *      — found via `git rev-parse --git-common-dir` so this works correctly
 *      from worktrees too (same trick used by setup-worktree-assets.sh).
 *   2. Fallback: `https://raw.githubusercontent.com/bh679/carkedit-api/main/
 *      package.json` (with a 3s timeout) when the sibling is missing.
 *
 * If both lookups fail the script exits 0 with a warning — it never blocks a
 * commit on transient lookup failure. Use `--dry-run` to print the resolved
 * version without writing. Use `--cwd <dir>` to point at a different repo
 * (used by tests).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';

const SIBLING_NAME = 'carkedit-api';
const RAW_URL = 'https://raw.githubusercontent.com/bh679/carkedit-api/main/package.json';
const FETCH_TIMEOUT_MS = 3_000;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoDir = args.cwd ?? process.cwd();

  const siblingVersion = await readSiblingApiVersion(repoDir);
  const version = siblingVersion ?? await fetchMainApiVersion();

  if (!version) {
    console.warn(
      '[stamp-required-api-version] Could not resolve carkedit-api version from sibling or upstream; leaving package.json untouched.',
    );
    return;
  }

  const pkgPath = path.join(repoDir, 'package.json');
  const raw = await fs.readFile(pkgPath, 'utf8');
  const pkg = JSON.parse(raw);
  if (pkg.requiredApiVersion === version) {
    if (args.dryRun) console.log(`[stamp-required-api-version] already at ${version}`);
    return;
  }
  pkg.requiredApiVersion = version;

  if (args.dryRun) {
    console.log(`[stamp-required-api-version] would set requiredApiVersion=${version}`);
    return;
  }

  // Preserve trailing newline + 2-space indent to match the existing file.
  const trailingNl = raw.endsWith('\n') ? '\n' : '';
  await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + trailingNl);
  console.log(`[stamp-required-api-version] requiredApiVersion → ${version}`);
}

function parseArgs(argv) {
  const out = { dryRun: false, cwd: undefined };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') out.dryRun = true;
    else if (argv[i] === '--cwd') out.cwd = argv[++i];
  }
  return out;
}

/**
 * Locate sibling `carkedit-api/package.json` and return its `version` string,
 * or null when the sibling is missing / unreadable.
 *
 * Works for both a normal checkout AND a git worktree: we resolve via
 * `git rev-parse --git-common-dir`, which returns the main repo's `.git` for
 * worktrees. The sibling repo lives alongside the main repo's directory.
 */
async function readSiblingApiVersion(repoDir) {
  let commonDir;
  try {
    commonDir = execSync('git rev-parse --git-common-dir', {
      cwd: repoDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
  const absoluteCommon = path.isAbsolute(commonDir)
    ? commonDir
    : path.resolve(repoDir, commonDir);
  const mainRepoDir = path.dirname(absoluteCommon);
  const siblingPkg = path.join(path.dirname(mainRepoDir), SIBLING_NAME, 'package.json');
  try {
    const raw = await fs.readFile(siblingPkg, 'utf8');
    const pkg = JSON.parse(raw);
    return typeof pkg.version === 'string' && pkg.version.length > 0 ? pkg.version : null;
  } catch {
    return null;
  }
}

async function fetchMainApiVersion() {
  try {
    const res = await fetch(RAW_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) return null;
    const pkg = await res.json();
    return typeof pkg.version === 'string' && pkg.version.length > 0 ? pkg.version : null;
  } catch {
    return null;
  }
}

main().catch((err) => {
  // Never block a commit. Log the error and exit 0 — the pre-commit hook
  // expects a non-fatal stamp script.
  console.warn('[stamp-required-api-version] error:', err && err.message ? err.message : err);
  process.exit(0);
});
