import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSolo, pickCard, answerCard, answerFor, buildEulogyText, dealPair, playableCards, currentDeck, SOLO_DECKS, SUMMARY_ORDER, CHOICE_SIZE, buildSoloUrl, stripSoloParam } from './solo-manager.js';

function deck(type, n, extra = () => ({})) {
  return Array.from({ length: n }, (_, i) => ({ id: i + 1, deckType: type, compositeId: `${type}:${i + 1}`, ...extra(i) }));
}
const decks = { die: deck('die', 14), live: deck('live', 14), bye: deck('bye', 14) };

test('dealPair never repeats a card', () => {
  const a = dealPair(decks.die);
  const b = dealPair(decks.die, a.usedIds);
  const ids = [...a.pair, ...b.pair].map((c) => c.compositeId);
  assert.equal(new Set(ids).size, CHOICE_SIZE * 2);
});

test('dealPair deals four cards', () => {
  assert.equal(CHOICE_SIZE, 4);
  assert.equal(dealPair(decks.die).pair.length, 4);
});

test('dealPair throws when the deck is exhausted', () => {
  assert.throws(() => dealPair(deck('die', 3)));
});

test('playableCards drops BYE wildcards', () => {
  const bye = deck('bye', 3, (i) => (i === 0 ? { illustrationKey: 'wildcard-eulogy' } : {}));
  assert.equal(playableCards(bye).length, 2);
});

test('round flow: two picks then a final between the favourites', () => {
  let s = createSolo(decks);
  assert.equal(currentDeck(s), 'die');
  assert.equal(s.round, 1);
  assert.equal(s.pair.length, 4);
  const favA = s.pair[3];
  s = pickCard(s, 3, decks);
  assert.equal(s.round, 2);
  assert.equal(s.pair.length, 4);
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

test('buildSoloUrl: origin → /?solo=1, tolerates trailing slash', () => {
  assert.equal(buildSoloUrl('https://play.carkedit.com'), 'https://play.carkedit.com/?solo=1');
  assert.equal(buildSoloUrl('https://play.carkedit.com/'), 'https://play.carkedit.com/?solo=1');
});

test('stripSoloParam removes only the solo param', () => {
  assert.equal(stripSoloParam('https://x.test/?solo=1'), 'https://x.test/');
  assert.equal(stripSoloParam('https://x.test/?solo=1&join=ABCD'), 'https://x.test/?join=ABCD');
});

test('SUMMARY_ORDER shows life before death, afterlife last', () => {
  assert.deepEqual([...SUMMARY_ORDER], ['live', 'die', 'bye']);
});

const mysteryDecks = {
  die: deck('die', 14, (i) => (i === 0 ? { special: 'mystery', title: 'Pick the Best Way to Die' } : {})),
  live: deck('live', 14),
  bye: deck('bye', 14),
};

test('picking a ? card pauses on an answer step; picks are ignored until answered', () => {
  let s = createSolo(mysteryDecks);
  s = pickCard(s, 0, mysteryDecks);
  assert.equal(s.pendingAnswer.compositeId, 'die:1');
  assert.equal(s.round, 2);
  assert.equal(pickCard(s, 0, mysteryDecks), s);
  const answered = answerCard(s, '  Laughing  ');
  assert.equal(answered.pendingAnswer, null);
  assert.equal(answerFor(answered, s.pendingAnswer), 'Laughing');
  assert.equal(answered.round, 2);
});

test('skipping a ? card stores no answer and does not ask again', () => {
  let s = createSolo(mysteryDecks);
  s = pickCard(s, 0, mysteryDecks);
  s = answerCard(s, '');
  assert.equal(s.pendingAnswer, null);
  assert.deepEqual(s.answers, {});
  // The mystery card is now a favourite; picking it in the final asks again
  // only because no answer was stored — pick a plain card and finish instead.
  s = pickCard(s, 0, mysteryDecks);
  assert.equal(s.round, 3);
  s = pickCard(s, 1, mysteryDecks);
  assert.equal(s.pendingAnswer, null);
  assert.equal(currentDeck(s), 'live');
});

test('a ? card answered once is not asked again when it wins the final', () => {
  let s = createSolo(mysteryDecks);
  s = answerCard(pickCard(s, 0, mysteryDecks), 'Laughing');
  s = pickCard(s, 0, mysteryDecks);
  s = pickCard(s, 0, mysteryDecks); // final: mystery card wins
  assert.equal(s.pendingAnswer, null);
  assert.equal(s.picks.die.compositeId, 'die:1');
});

test('answerCard is a no-op without a pending card and never mutates', () => {
  const s = createSolo(decks);
  assert.equal(answerCard(s, 'x'), s);
  const before = JSON.stringify(s);
  pickCard(s, 0, mysteryDecks);
  assert.equal(JSON.stringify(s), before);
});

test('buildEulogyText lists life, death, afterlife then the eulogy', () => {
  const solo = {
    picks: {
      die: { compositeId: 'die:1', title: 'Pick the Best Way to Die' },
      live: { compositeId: 'live:1', title: 'Pirate' },
      bye: { compositeId: 'bye:1', title: 'Heaven' },
    },
    answers: { 'die:1': 'Laughing' },
  };
  assert.equal(
    buildEulogyText(solo, ' Gone too soon. '),
    'Your life: Pirate\nYour death: Pick the Best Way to Die — Laughing\nYour afterlife: Heaven\n\nGone too soon.'
  );
  assert.equal(buildEulogyText({ picks: {}, answers: {} }, ''), '');
});
