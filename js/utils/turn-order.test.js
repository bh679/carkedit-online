import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPitchOrder } from './turn-order.js';

const players = [
  { name: 'p1' },
  { name: 'p2' },
  { name: 'p3' },
  { name: 'p4' },
];

test('getPitchOrder: LD = p1 (index 0) → p2, p3, p4', () => {
  assert.deepEqual(getPitchOrder(players, 0), ['p2', 'p3', 'p4']);
});

test('getPitchOrder: LD = p2 (index 1) → p3, p4, p1', () => {
  assert.deepEqual(getPitchOrder(players, 1), ['p3', 'p4', 'p1']);
});

test('getPitchOrder: LD = p3 (index 2) → p4, p1, p2', () => {
  assert.deepEqual(getPitchOrder(players, 2), ['p4', 'p1', 'p2']);
});

test('getPitchOrder: LD = p4 (index 3) → p1, p2, p3', () => {
  assert.deepEqual(getPitchOrder(players, 3), ['p1', 'p2', 'p3']);
});

test('getPitchOrder: empty for single-player', () => {
  assert.deepEqual(getPitchOrder([{ name: 'p1' }], 0), []);
});

test('getPitchOrder: empty for zero players', () => {
  assert.deepEqual(getPitchOrder([], 0), []);
});
