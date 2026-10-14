import { test, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { notifyError, markBoundary, getTaggedErrors, clear } from './error-monitor.js';

// error-monitor stamps every entry with `new Date().toISOString()` and compares it
// to the boundary, so we drive Date with mock timers for deterministic ordering.
beforeEach(() => {
  clear();
  mock.timers.reset();
});

test('errors before the boundary are tagged stale, after are relevant', () => {
  mock.timers.enable({ apis: ['Date'] });

  mock.timers.setTime(1000);
  notifyError({ type: 'console.error', message: 'pre-game auth error' });

  mock.timers.setTime(2000);
  markBoundary();

  mock.timers.setTime(3000);
  notifyError({ type: 'console.error', message: 'in-game error' });

  const tagged = getTaggedErrors();
  const pre = tagged.find(e => e.message === 'pre-game auth error');
  const inGame = tagged.find(e => e.message === 'in-game error');

  assert.equal(pre.relevant, false, 'error before boundary should be stale');
  assert.equal(inGame.relevant, true, 'error after boundary should be relevant');
});

test('without a boundary, every error is relevant', () => {
  notifyError({ type: 'console.error', message: 'no boundary set' });
  assert.equal(getTaggedErrors()[0].relevant, true);
});

test('clear() resets the boundary so later errors are relevant again', () => {
  mock.timers.enable({ apis: ['Date'] });

  mock.timers.setTime(2000);
  markBoundary();
  clear();

  // Even an "earlier" clock reading is relevant once the boundary is gone.
  mock.timers.setTime(1000);
  notifyError({ type: 'console.error', message: 'after clear' });

  assert.equal(getTaggedErrors()[0].relevant, true);
});
