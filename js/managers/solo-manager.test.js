import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSolo, endIntro, pickCard, continueStory, openEulogy, inspectCard, dismissInspect, stepInspect, answerCard, answerFor, buildEulogyText, dealPair, playableCards, currentDeck, SOLO_DECKS, SUMMARY_ORDER, CHOICE_SIZE, buildSoloUrl, stripSoloParam, buildStoryRequest, startStory, finishStory, failStory, dealLikely, ratherFor, ROUNDS_PER_DECK } from './solo-manager.js';

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

test('dealPair deals at most one split and one ? card per hand', () => {
  const specials = ['split', 'split', 'split', 'mystery', 'mystery', 'mystery'];
  const d = deck('die', 12, (i) => (specials[i] ? { special: specials[i] } : {}));
  const a = dealPair(d);
  const count = (pair, kind) => pair.filter((c) => c.special === kind).length;
  assert.equal(count(a.pair, 'split'), 1);
  assert.equal(count(a.pair, 'mystery'), 1);
  assert.deepEqual(a.pair.map((c) => c.id), [1, 4, 7, 8]);
  const b = dealPair(d, a.usedIds);
  assert.equal(count(b.pair, 'split'), 1);
  assert.equal(count(b.pair, 'mystery'), 1);
  assert.deepEqual(b.pair.map((c) => c.id), [2, 5, 9, 10]);
});

test('dealPair tops up with capped specials when nothing else is left', () => {
  const d = deck('die', 4, () => ({ special: 'mystery' }));
  assert.equal(dealPair(d).pair.length, CHOICE_SIZE);
});

test('playableCards drops BYE wildcards', () => {
  const bye = deck('bye', 3, (i) => (i === 0 ? { illustrationKey: 'wildcard-eulogy' } : {}));
  assert.equal(playableCards(bye).length, 2);
});

test('round flow: would rather, then more likely with the rather card back in the hand', () => {
  assert.equal(ROUNDS_PER_DECK, 2);
  let s = createSolo(decks);
  assert.equal(currentDeck(s), 'die');
  assert.equal(s.round, 1);
  assert.equal(s.pair.length, 4);
  const rather = s.pair[3];
  s = pickCard(s, 3, decks, () => 0.5);
  assert.equal(s.round, 2);
  assert.equal(s.pair.length, 4);
  assert.equal(s.pair[2], rather);
  assert.equal(s.rathers.die, rather);
  assert.equal(new Set(s.pair.map((c) => c.compositeId)).size, 4);
  const likely = s.pair[1];
  s = pickCard(s, 1, decks);
  assert.equal(s.picks.die, likely);
  assert.equal(s.rathers.die, rather);
  assert.equal(currentDeck(s), 'live');
  assert.equal(s.round, 1);
  // Story screen between decks: input is ignored until Continue.
  assert.equal(s.stage, 'story');
  assert.equal(pickCard(s, 0, decks), s);
  assert.equal(inspectCard(s, 0), s);
  assert.equal(openEulogy(s), s);
  s = continueStory(s);
  assert.equal(s.stage, 'round');
  assert.equal(continueStory(s), s);
});

test('dealLikely places the rather card at the rng slot and deals three fresh cards', () => {
  const { pair: first, usedIds } = dealPair(decks.die);
  const rather = first[0];
  for (const [r, slot] of [[0, 0], [0.3, 1], [0.6, 2], [0.99, 3]]) {
    const { pair, usedIds: next } = dealLikely(decks.die, usedIds, rather, () => r);
    assert.equal(pair.length, CHOICE_SIZE);
    assert.equal(pair[slot], rather);
    assert.equal(next.length, usedIds.length + CHOICE_SIZE - 1);
    assert.ok(pair.filter((c) => c !== rather).every((c) => !usedIds.includes(c.compositeId)));
  }
});

test('dealLikely counts the rather card toward the special caps', () => {
  const d = deck('die', 12, (i) => (i < 4 ? { special: 'mystery' } : {}));
  const { pair } = dealLikely(d, ['die:1'], d[0], () => 0);
  assert.equal(pair.filter((c) => c.special === 'mystery').length, 1);
});

test('ratherFor is null when the rather card is also the final pick', () => {
  const a = { compositeId: 'die:1' };
  const b = { compositeId: 'die:2' };
  assert.equal(ratherFor({ rathers: { die: a }, picks: { die: a } }, 'die'), null);
  assert.equal(ratherFor({ rathers: { die: a }, picks: { die: b } }, 'die'), a);
  assert.equal(ratherFor({ picks: { die: b } }, 'die'), null);
});

function playThrough(decks) {
  let s = createSolo(decks);
  for (let i = 0; i < SOLO_DECKS.length * ROUNDS_PER_DECK; i++) s = continueStory(pickCard(s, 0, decks));
  return s;
}

test('finishes after BYE more-likely with a rather and a pick per deck, then story → eulogy', () => {
  const s = playThrough(decks);
  assert.equal(s.done, true);
  assert.equal(s.stage, 'story');
  assert.deepEqual(Object.keys(s.picks), SOLO_DECKS);
  assert.deepEqual(Object.keys(s.rathers), SOLO_DECKS);
  assert.equal(pickCard(s, 0, decks), s);
  assert.equal(continueStory(s), s);
  const e = openEulogy(s);
  assert.equal(e.stage, 'eulogy');
  assert.equal(openEulogy(e), e);
  assert.equal(createSolo(decks).stage, 'round');
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
  s = pickCard(s, 0, mysteryDecks, () => 0);
  s = answerCard(s, '');
  assert.equal(s.pendingAnswer, null);
  assert.deepEqual(s.answers, {});
  // The mystery card is back in the more-likely hand (slot 0 here); picking it
  // would ask again only because no answer was stored — pick a plain card.
  assert.equal(s.round, 2);
  s = pickCard(s, 1, mysteryDecks);
  assert.equal(s.pendingAnswer, null);
  assert.equal(currentDeck(s), 'live');
});

test('a ? card answered as rather is not asked again when it is also more likely', () => {
  let s = createSolo(mysteryDecks);
  s = answerCard(pickCard(s, 0, mysteryDecks, () => 0), 'Laughing');
  assert.equal(s.pair[0].compositeId, 'die:1');
  s = pickCard(s, 0, mysteryDecks); // more likely: the same mystery card
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
    rathers: { live: { compositeId: 'live:2', title: 'Astronaut' }, die: { compositeId: 'die:1' } },
    answers: { 'die:1': 'Laughing' },
  };
  assert.equal(
    buildEulogyText(solo, ' Gone too soon. '),
    'Your life: Pirate (would rather: Astronaut)\nYour death: Pick the Best Way to Die — Laughing\nYour afterlife: Heaven\n\nGone too soon.'
  );
  assert.equal(buildEulogyText({ picks: {}, answers: {} }, ''), '');
});

test('inspect: tap previews, arrows wrap, dismiss closes, pick clears', () => {
  const s = endIntro(createSolo(decks));
  assert.equal(s.inspectIndex, null);
  assert.equal(inspectCard(s, 9), s);
  const open = inspectCard(s, 1);
  assert.equal(open.inspectIndex, 1);
  assert.equal(stepInspect(open, 1).inspectIndex, 2);
  assert.equal(stepInspect(open, -1).inspectIndex, 0);
  assert.equal(stepInspect(stepInspect(open, -1), -1).inspectIndex, 3);
  assert.equal(stepInspect(inspectCard(s, 3), 1).inspectIndex, 0);
  assert.equal(dismissInspect(open).inspectIndex, null);
  assert.equal(dismissInspect(s), s);
  assert.equal(stepInspect(s, 1), s);
  assert.equal(pickCard(open, 1, decks).inspectIndex, null);
  assert.equal(s.inspectIndex, null);
});

test('inspect is ignored while a ? answer is pending or the game is done', () => {
  const pending = pickCard(createSolo(mysteryDecks), 0, mysteryDecks);
  assert.equal(inspectCard(pending, 0), pending);
  assert.equal(pickCard(pending, 0, mysteryDecks).inspectIndex, null);
});

const finished = Object.freeze({
  done: true,
  stage: 'eulogy',
  picks: {
    die: { compositeId: 'die:1', title: 'Coconut', description: 'From above' },
    live: { compositeId: 'live:1', title: 'Pirate' },
    bye: { compositeId: 'bye:1', title: 'Heaven' },
  },
  answers: { 'die:1': 'In Bali' },
});

test('buildStoryRequest sends each pick with description and answer', () => {
  assert.deepEqual(buildStoryRequest(finished, '  Legend. '), {
    picks: {
      live: { title: 'Pirate', description: '', answer: '' },
      die: { title: 'Coconut', description: 'From above', answer: 'In Bali' },
      bye: { title: 'Heaven', description: '', answer: '' },
    },
    eulogy: 'Legend.',
  });
});

test('buildStoryRequest includes the would-rather card for each deck', () => {
  const solo = {
    ...finished,
    rathers: {
      die: { compositeId: 'die:9', title: 'In my sleep', description: 'Peaceful' },
      live: { compositeId: 'live:1', title: 'Pirate' },
      bye: { compositeId: 'bye:3', title: 'Ghost' },
    },
  };
  const { picks } = buildStoryRequest(solo, '');
  assert.deepEqual(picks.die.rather, { title: 'In my sleep', description: 'Peaceful', answer: '' });
  assert.deepEqual(picks.live.rather, { title: 'Pirate', description: '', answer: '' });
  assert.equal(picks.bye.rather.title, 'Ghost');
  assert.equal(picks.die.title, 'Coconut');
});

test('startStory → finishStory shows the story', () => {
  const loading = startStory(finished, 'Legend.', 1);
  assert.equal(loading.stage, 'lifestory');
  assert.equal(loading.lifeStory.status, 'loading');
  assert.equal(finished.stage, 'eulogy');
  const ready = finishStory(loading, 1, ' You sailed. ');
  assert.deepEqual({ ...ready.lifeStory }, { status: 'ready', requestId: 1, text: 'You sailed.', error: '' });
});

test('failStory records the error; stale or off-screen responses are ignored', () => {
  const loading = startStory(finished, '', 2);
  assert.equal(failStory(loading, 2, 'Nope').lifeStory.error, 'Nope');
  assert.equal(finishStory(loading, 1, 'old'), loading);
  const left = { ...loading, stage: 'eulogy' };
  assert.equal(finishStory(left, 2, 'late'), left);
  assert.equal(startStory({ ...finished, done: false }, '', 3).stage, 'eulogy');
});

test('intro: every new question opens with an intro; endIntro clears it', () => {
  const s = createSolo(decks);
  assert.equal(s.intro, true);
  const cleared = endIntro(s);
  assert.equal(cleared.intro, false);
  assert.equal(endIntro(cleared), cleared);
  assert.equal(s.intro, true, 'endIntro does not mutate');

  const likely = pickCard(cleared, 0, decks);
  assert.equal(likely.round, 2);
  assert.equal(likely.intro, true, 'more-likely question gets its own intro');

  const story = pickCard(endIntro(likely), 0, decks);
  assert.equal(story.stage, 'story');
  const nextDeck = continueStory(story);
  assert.equal(nextDeck.deckIndex, 1);
  assert.equal(nextDeck.intro, true, 'next deck question gets its own intro');
});

test('intro: cards cannot be inspected until the intro ends', () => {
  const s = createSolo(decks);
  assert.equal(inspectCard(s, 0), s);
  assert.equal(inspectCard(endIntro(s), 0).inspectIndex, 0);
});
