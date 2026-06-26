import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectPacks } from './packs-stats-viewer.js';

const PACKS = [
  { id: 'a', title: 'Beta', usage_count: 5, creator_brand_id: 'brand_1' },
  { id: 'b', title: 'Alpha', usage_count: 9, creator_brand_id: null },
  { id: 'c', title: 'Gamma', usage_count: 1, creator_brand_id: 'brand_1' },
];

test('selectPacks sorts by usage_count desc by default', () => {
  assert.deepEqual(selectPacks(PACKS).map((p) => p.id), ['b', 'a', 'c']);
});

test('selectPacks sorts ascending when sortAsc', () => {
  assert.deepEqual(selectPacks(PACKS, { sortAsc: true }).map((p) => p.id), ['c', 'a', 'b']);
});

test('selectPacks sorts by title (string localeCompare)', () => {
  assert.deepEqual(selectPacks(PACKS, { sortMode: 'title', sortAsc: true }).map((p) => p.title), ['Alpha', 'Beta', 'Gamma']);
});

test('brandOnly filters to packs created by the brand', () => {
  assert.deepEqual(selectPacks(PACKS, { brandOnly: true, brandId: 'brand_1' }).map((p) => p.id), ['a', 'c']);
});

test('brandOnly without a brandId is a no-op (shows all)', () => {
  assert.equal(selectPacks(PACKS, { brandOnly: true }).length, 3);
});

test('selectPacks is pure — does not mutate input order', () => {
  const input = [...PACKS];
  selectPacks(input, { sortAsc: true });
  assert.deepEqual(input.map((p) => p.id), ['a', 'b', 'c']);
});
