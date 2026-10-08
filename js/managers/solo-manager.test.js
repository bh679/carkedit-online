import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSolo, pickCard, dealPair, playableCards, currentDeck, SOLO_DECKS } from './solo-manager.js';

function deck(type, n, extra = () => ({})) {
  return Array.from({ length: n }, (_, i) => ({ id: i + 1, deckType: type, compositeId: `${type}:${i + 1}`, ...extra(i) }));
}
const decks = { die: deck('die', 6), live: deck('live', 6), bye: deck('bye', 6) };

test('dealPair never repeats a card', () => {
  const a = dealPair(decks.die);
  const b = dealPair(decks.die, a.usedIds);
  const ids = [...a.pair, ...b.pair].map((c) => c.compositeId);
  assert.equal(new Set(ids).size, 4);
});

test('dealPair throws when the deck is exhausted', () => {
  assert.throws(() => dealPair(deck('die', 1)));
});

test('playableCards drops BYE wildcards', () => {
  const bye = deck('bye', 3, (i) => (i === 0 ? { illustrationKey: 'wildcard-eulogy' } : {}));
  assert.equal(playableCards(bye).length, 2);
});

test('round flow: two picks then a final between the favourites', () => {
  let s = createSolo(decks);
  assert.equal(currentDeck(s), 'die');
  assert.equal(s.round, 1);
  const favA = s.pair[0];
  s = pickCard(s, 0, decks);
  assert.equal(s.round, 2);
  assert.deepEqual(s.favourites, [favA]);
  const favB = s.pair[1];
  s = pickCard(s, 1, decks);
  assert.equal(s.round, 3);
  assert.deepEqual(s.pair, [favA, favB]);
  s = pickCard(s, 1, decks);
  assert.equal(s.picks.die, favB);
  assert.equal(currentDeck(s), 'live');
  assert.equal(s.round, 1);
  assert.deepEqual(s.favourites, []);
});

test('finishes after BYE final with one pick per deck', () => {
  let s = createSolo(decks);
  for (let i = 0; i < SOLO_DECKS.length * 3; i++) s = pickCard(s, 0, decks);
  assert.equal(s.done, true);
  assert.deepEqual(Object.keys(s.picks), SOLO_DECKS);
  assert.equal(pickCard(s, 0, decks), s);
});

test('pickCard does not mutate the previous state', () => {
  const s = createSolo(decks);
  const before = JSON.stringify(s);
  pickCard(s, 0, decks);
  assert.equal(JSON.stringify(s), before);
});
