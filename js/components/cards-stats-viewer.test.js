import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortCards, filterCards } from './cards-stats-viewer.js';

const CARDS = [
  { card_id: 'd1', card_deck: 'die', play_rate: 50, play_count: 5 },
  { card_id: 'l1', card_deck: 'living', play_rate: 90, play_count: 1 },
  { card_id: 'b1', card_deck: 'bye', play_rate: 10, play_count: 9 },
  { card_id: 'p1', card_deck: 'die', play_rate: 30, play_count: 3 }, // belongs to packX
];

// Pack metadata: packX has two cards (p1 played, p2 unplayed), created by Alice.
const cardPackMap = { p1: 'packX', p2: 'packX' };
const packCardsMap = {
  packX: [
    { card_id: 'p1', card_deck: 'die', card_text: 'P1' },
    { card_id: 'p2', card_deck: 'die', card_text: 'P2' },
  ],
};
const packCreatorMap = { packX: 'Alice' };
const MAPS = { cardPackMap, packCardsMap, packCreatorMap };

// ── sortCards ───────────────────────────────────────────────────────────────
test('sortCards sorts by play_rate desc by default', () => {
  assert.deepEqual(sortCards(CARDS).map((c) => c.card_id), ['l1', 'd1', 'p1', 'b1']);
});

test('sortCards sorts ascending when sortAsc', () => {
  assert.deepEqual(sortCards(CARDS, 'play_rate', true).map((c) => c.card_id), ['b1', 'p1', 'd1', 'l1']);
});

test('sortCards sorts by a different numeric field (play_count desc)', () => {
  assert.deepEqual(sortCards(CARDS, 'play_count').map((c) => c.card_id), ['b1', 'd1', 'p1', 'l1']);
});

test('sortCards is pure — does not mutate input order', () => {
  const input = [...CARDS];
  sortCards(input, 'play_rate', true);
  assert.deepEqual(input.map((c) => c.card_id), ['d1', 'l1', 'b1', 'p1']);
});

// ── filterCards ──────────────────────────────────────────────────────────────
test('filterCards deck filter keeps only the chosen deck', () => {
  assert.deepEqual(filterCards(CARDS, { deckFilter: 'die', ...MAPS }).map((c) => c.card_id), ['d1', 'p1']);
});

test("filterCards pack 'base' keeps only cards not in any pack", () => {
  assert.deepEqual(filterCards(CARDS, { packFilter: 'base', ...MAPS }).map((c) => c.card_id), ['d1', 'l1', 'b1']);
});

test('filterCards specific pack keeps pack cards + injects zero-stat unplayed cards', () => {
  const out = filterCards(CARDS, { packFilter: 'packX', ...MAPS });
  assert.deepEqual(out.map((c) => c.card_id), ['p1', 'p2']);
  const p2 = out.find((c) => c.card_id === 'p2');
  assert.equal(p2.play_count, 0);
  assert.equal(p2.play_rate, 0);
});

test('filterCards author filter keeps the author cards + injects their unplayed cards', () => {
  const out = filterCards(CARDS, { authorFilter: 'Alice', ...MAPS });
  assert.deepEqual(out.map((c) => c.card_id).sort(), ['p1', 'p2']);
});

test('filterCards with no active filters returns all rows', () => {
  assert.equal(filterCards(CARDS, MAPS).length, CARDS.length);
});

test('filterCards is pure — does not mutate the input array', () => {
  const input = [...CARDS];
  filterCards(input, { packFilter: 'packX', ...MAPS });
  assert.equal(input.length, CARDS.length);
  assert.deepEqual(input.map((c) => c.card_id), ['d1', 'l1', 'b1', 'p1']);
});
