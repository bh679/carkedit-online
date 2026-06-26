import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mountPlayerStats } from './player-stats.js';

// mountPlayerStats builds its fetch URL inline as `${apiBase}${statsBasePath}/...`.
// We mount against a minimal fake root + a mock authFetch that records the URL it
// is called with (the first call, on mount, is the users/stats fetch), and assert
// the statsBasePath seam routes the Users viewer to the right (global vs brand) base.
function fakeRoot() {
  return { isConnected: true, innerHTML: '', addEventListener() {} };
}
function recordingAuthFetch(calls) {
  return (url) => {
    calls.push(url);
    return Promise.resolve({
      ok: true,
      json: async () => ({ players: [], total_distinct: 0, total_matched_users: 0 }),
    });
  };
}

test('Users viewer defaults to the global /api/carkedit base', async () => {
  const calls = [];
  mountPlayerStats(fakeRoot(), { authFetch: recordingAuthFetch(calls) });
  await Promise.resolve();
  assert.equal(calls[0], '/api/carkedit/users/stats?dev=nodev&limit=1000');
});

test('statsBasePath brand-scopes the Users viewer fetch', async () => {
  const calls = [];
  mountPlayerStats(fakeRoot(), {
    authFetch: recordingAuthFetch(calls),
    statsBasePath: '/api/carkedit/brands/b1',
  });
  await Promise.resolve();
  assert.equal(calls[0], '/api/carkedit/brands/b1/users/stats?dev=nodev&limit=1000');
});

test('apiBase still prefixes the statsBasePath (cross-origin prod preview)', async () => {
  const calls = [];
  mountPlayerStats(fakeRoot(), {
    authFetch: recordingAuthFetch(calls),
    apiBase: 'https://play.carkedit.com',
    statsBasePath: '/api/carkedit/brands/b1',
  });
  await Promise.resolve();
  assert.equal(calls[0], 'https://play.carkedit.com/api/carkedit/brands/b1/users/stats?dev=nodev&limit=1000');
});
