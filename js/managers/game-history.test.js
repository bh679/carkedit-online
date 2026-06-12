import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setState } from '../state.js';
import { saveGameToHistory, getGameHistory } from './game-history.js';

// Minimal in-memory localStorage so game-history's cache works under `node --test`
// (no browser). A fresh store per test keeps cases isolated.
function installLocalStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => store.clear(),
  };
}

beforeEach(() => {
  installLocalStorage();
  setState({ authUser: null });
});

// The core bug: a new account on a shared browser inherited the previous
// account's games because the cache was not scoped per account.
test('saved games are isolated per account (no cross-account bleed)', () => {
  setState({ authUser: { id: 'userA' } });
  saveGameToHistory({ mode: 'online', rounds: 1, players: [{ name: 'Alice', score: 7 }] });
  assert.equal(getGameHistory().length, 1);

  // A different account must not see userA's games.
  setState({ authUser: { id: 'userB' } });
  assert.deepEqual(getGameHistory(), []);

  // Back to userA — their game is still there.
  setState({ authUser: { id: 'userA' } });
  assert.equal(getGameHistory().length, 1);
  assert.equal(getGameHistory()[0].winnerName, 'Alice');
});

test('a signed-out (guest) view does not see a signed-in account\'s games', () => {
  setState({ authUser: { id: 'userA' } });
  saveGameToHistory({ mode: 'online', rounds: 1, players: [{ name: 'Alice', score: 7 }] });

  setState({ authUser: null }); // guest bucket
  assert.deepEqual(getGameHistory(), []);
});

test('winner is the highest scorer regardless of input order', () => {
  setState({ authUser: { id: 'userA' } });
  const entry = saveGameToHistory({
    mode: 'online',
    rounds: 2,
    players: [
      { name: 'Low', score: 2 },
      { name: 'High', score: 9 },
      { name: 'Mid', score: 5 },
    ],
  });

  assert.equal(entry.winnerName, 'High');
  assert.equal(entry.winnerScore, 9);
  assert.deepEqual(entry.players.map((p) => p.rank), [1, 2, 3]);
});
