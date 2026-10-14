import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveAuthReturn, consumeAuthReturn, clearAuthReturn, AUTH_RETURN_SCREENS } from './auth-return.js';

// Minimal in-memory Storage stand-in — node:test has no sessionStorage.
function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    size: () => map.size,
  };
}

const KEY = 'carkedit-auth-return';

test('save + consume round-trips a lobby snapshot with typed details', () => {
  const storage = fakeStorage();
  saveAuthReturn({
    screen: 'online-lobby',
    lobbyStep: 'details',
    lobbyDetails: { name: 'Brennan', birthMonth: 7, birthDay: 22 },
  }, storage);
  const snap = consumeAuthReturn(storage);
  assert.deepEqual(snap, {
    screen: 'online-lobby',
    lobbyStep: 'details',
    lobbyDetails: { name: 'Brennan', birthMonth: 7, birthDay: 22 },
  });
});

test('consume is one-shot: second read returns null', () => {
  const storage = fakeStorage();
  saveAuthReturn({ screen: 'online-lobby' }, storage);
  assert.ok(consumeAuthReturn(storage));
  assert.equal(consumeAuthReturn(storage), null);
});

test('consume returns null when nothing was saved', () => {
  assert.equal(consumeAuthReturn(fakeStorage()), null);
});

test('non-whitelisted screen falls back to menu', () => {
  const storage = fakeStorage();
  saveAuthReturn({ screen: 'phase2' }, storage);
  assert.equal(consumeAuthReturn(storage).screen, 'menu');
});

test('every whitelisted screen survives the round-trip', () => {
  for (const screen of AUTH_RETURN_SCREENS) {
    const storage = fakeStorage();
    saveAuthReturn({ screen }, storage);
    assert.equal(consumeAuthReturn(storage).screen, screen);
  }
});

test('snapshot without lobbyDetails yields lobbyDetails null', () => {
  const storage = fakeStorage();
  saveAuthReturn({ screen: 'account' }, storage);
  const snap = consumeAuthReturn(storage);
  assert.equal(snap.lobbyDetails, null);
});

test('lobbyStep only accepts email-auth, otherwise details', () => {
  const storage = fakeStorage();
  saveAuthReturn({ screen: 'online-lobby', lobbyStep: 'email-auth' }, storage);
  assert.equal(consumeAuthReturn(storage).lobbyStep, 'email-auth');
  saveAuthReturn({ screen: 'online-lobby', lobbyStep: 'weird' }, storage);
  assert.equal(consumeAuthReturn(storage).lobbyStep, 'details');
});

test('malformed lobbyDetails values are coerced to safe types', () => {
  const storage = fakeStorage();
  saveAuthReturn({
    screen: 'online-lobby',
    lobbyDetails: { name: 42, birthMonth: 'nope', birthDay: '9' },
  }, storage);
  const snap = consumeAuthReturn(storage);
  assert.deepEqual(snap.lobbyDetails, { name: '42', birthMonth: 0, birthDay: 9 });
});

test('corrupt JSON in storage is consumed and returns null', () => {
  const storage = fakeStorage({ [KEY]: '{not json' });
  assert.equal(consumeAuthReturn(storage), null);
  assert.equal(storage.getItem(KEY), null); // still removed
});

test('non-object JSON payload returns null', () => {
  const storage = fakeStorage({ [KEY]: '"just a string"' });
  assert.equal(consumeAuthReturn(storage), null);
});

test('clearAuthReturn removes a saved snapshot', () => {
  const storage = fakeStorage();
  saveAuthReturn({ screen: 'online-lobby' }, storage);
  clearAuthReturn(storage);
  assert.equal(consumeAuthReturn(storage), null);
});

test('helpers are no-ops with no storage available (private mode)', () => {
  assert.doesNotThrow(() => saveAuthReturn({ screen: 'menu' }, null));
  assert.doesNotThrow(() => clearAuthReturn(null));
  assert.equal(consumeAuthReturn(null), null);
});

test('a throwing storage never propagates (quota / privacy modes)', () => {
  const throwing = {
    getItem: () => { throw new Error('denied'); },
    setItem: () => { throw new Error('denied'); },
    removeItem: () => { throw new Error('denied'); },
  };
  assert.doesNotThrow(() => saveAuthReturn({ screen: 'menu' }, throwing));
  assert.doesNotThrow(() => clearAuthReturn(throwing));
  assert.equal(consumeAuthReturn(throwing), null);
});
