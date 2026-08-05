import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { formatCountdown, msUntil, hasStarted } from './schedule-format.js';

// formatStartTime/formatStartTimeShort are locale+timezone dependent and are
// verified visually; the arithmetic below is what can silently go wrong.
describe('formatCountdown', () => {
  test('drops the hours field under an hour', () => {
    assert.equal(formatCountdown(0), '00:00');
    assert.equal(formatCountdown(9_000), '00:09');
    assert.equal(formatCountdown(59 * 60_000 + 59_000), '59:59');
  });

  test('shows hours once past one', () => {
    assert.equal(formatCountdown(3_600_000), '1:00:00');
    assert.equal(formatCountdown(2 * 3_600_000 + 5 * 60_000 + 7_000), '2:05:07');
  });

  test('spells out days so a far-off game reads sensibly', () => {
    assert.equal(formatCountdown(86_400_000), '1d 00:00:00');
    assert.equal(formatCountdown(3 * 86_400_000 + 4 * 3_600_000 + 12 * 60_000 + 7_000), '3d 04:12:07');
  });

  test('never goes negative', () => {
    assert.equal(formatCountdown(-5_000), '00:00');
  });
});

describe('msUntil / hasStarted', () => {
  test('floors at zero for a past time', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    assert.equal(msUntil(past), 0);
    assert.equal(hasStarted(past), true);
  });

  test('counts down to a future time', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    assert.ok(msUntil(future) > 55_000);
    assert.equal(hasStarted(future), false);
  });

  test('treats an unparseable time as already started rather than throwing', () => {
    assert.equal(msUntil('not a date'), 0);
    assert.equal(hasStarted('not a date'), true);
  });
});
