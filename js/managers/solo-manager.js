// CarkedIt Online — Single Player Manager
//
// One person, no server, no points. For each deck (DIE → LIVE → BYE) the
// player answers two questions from four cards each: first what they would
// rather (stored in `rathers`), then what is more likely — the second hand
// holds the "rather" card plus three fresh ones, and that pick is final for
// the deck (stored in `picks`). Tapping a card opens a full-screen preview
// (`inspectIndex`) and the pick is confirmed from there.
// A dealt hand holds at most one split and one `?` card (MAX_PER_HAND).
// Picking a `?` (mystery) card pauses the
// game on an answer step so the player can say what the card asks.
//
// Everything here is a pure transition over a `solo` object held in state
// (see js/state.js). The router owns the thin `start` / `pick` hooks that
// touch the DOM.
'use strict';

import { isWildcard as isWildcardCard } from '../data/card.js';

export const SOLO_QUERY_PARAM = 'solo';

/**
 * Shareable link that starts a solo game for anyone, signed in or not.
 * @param {string} origin — e.g. window.location.origin
 */
export function buildSoloUrl(origin) {
  return `${String(origin ?? '').replace(/\/$/, '')}/?${SOLO_QUERY_PARAM}=1`;
}

/** Remove the solo param from a URL so the menu doesn't carry it. Pure. */
export function stripSoloParam(href) {
  const url = new URL(href);
  url.searchParams.delete(SOLO_QUERY_PARAM);
  return url.toString();
}

export const SOLO_DECKS = Object.freeze(['die', 'live', 'bye']);
export const ROUNDS_PER_DECK = 2;
export const CHOICE_SIZE = 4;
/** Order the picks are shown on the summary: life first, then death. */
export const SUMMARY_ORDER = Object.freeze(['live', 'die', 'bye']);

/** Short labels for the screen. */
export const DECK_LABELS = Object.freeze({
  die: {
    phase: '1', label: 'Phase 1 - DIE', pickLabel: 'Your death',
    ratherPrompt: 'How would you rather die?', likelyPrompt: 'How are you more likely to die?',
  },
  live: {
    phase: '2', label: 'Phase 2 - LIVE', pickLabel: 'Your life',
    ratherPrompt: 'How would you rather live before you cark it?', likelyPrompt: 'How are you more likely to live?',
  },
  bye: {
    phase: '3', label: 'Phase 3 - BYE', pickLabel: 'Your afterlife',
    ratherPrompt: 'What would you rather happen after you die?', likelyPrompt: "What's more likely to happen after you die?",
  },
});

/**
 * Cards a solo player can be dealt. BYE Wildcards are prompts for the
 * eulogy round rather than afterlives, so they are left out; DIE split and
 * mystery cards render fine and stay in.
 * @param {object[]} cards
 * @returns {object[]}
 */
export function playableCards(cards) {
  return (cards ?? []).filter((c) => c && !isWildcard(c));
}

// Prefer the canonical `special === 'wildcard'` marker (see js/data/card.js);
// keep the illustration-key fallback for plain objects that never went
// through `buildCard()`.
function isWildcard(card) {
  if (isWildcardCard(card)) return true;
  const key = String(card.illustrationKey ?? '').toLowerCase();
  return key === 'wildcard-eulogy';
}

/**
 * Most of each special kind allowed in one dealt hand, so a hand never
 * stacks several "Would You Rather" (split) or `?` (mystery) cards.
 */
export const MAX_PER_HAND = Object.freeze({ split: 1, mystery: 1 });

/**
 * Deal the next `size` unused cards from a deck, capping specials per
 * MAX_PER_HAND. Capped cards are left unused so a later hand can take them;
 * if the deck can't fill a hand without them they top it up. `holding` are
 * cards already in the hand (not dealt here) that count toward the caps. Pure.
 * @param {object[]} deck — ordered (already shuffled) cards
 * @param {string[]} usedIds — compositeIds already shown this game
 * @param {{ size?: number, holding?: object[] }} [options]
 * @returns {{ pair: object[], usedIds: string[] }}
 */
export function dealPair(deck, usedIds = [], { size = CHOICE_SIZE, holding = [] } = {}) {
  const used = new Set(usedIds);
  const unused = playableCards(deck).filter((card) => !used.has(cardId(card)));
  const counts = countSpecials(holding);
  const pair = [];
  const skipped = [];
  for (const card of unused) {
    if (pair.length === size) break;
    const cap = MAX_PER_HAND[card.special];
    if (cap !== undefined && (counts[card.special] ?? 0) >= cap) {
      skipped.push(card);
      continue;
    }
    counts[card.special] = (counts[card.special] ?? 0) + 1;
    pair.push(card);
  }
  const filled = [...pair, ...skipped.slice(0, size - pair.length)];
  if (filled.length < size) {
    throw new Error(`Not enough cards to deal ${size} (have ${filled.length})`);
  }
  return { pair: filled, usedIds: [...usedIds, ...filled.map(cardId)] };
}

function countSpecials(cards) {
  return cards.reduce((acc, card) => (
    card?.special ? { ...acc, [card.special]: (acc[card.special] ?? 0) + 1 } : acc
  ), {});
}

/**
 * The "more likely" hand: the player's "rather" card plus CHOICE_SIZE - 1
 * fresh cards, with the rather card at a random slot. Pure given `rng`.
 * @param {object[]} deck
 * @param {string[]} usedIds
 * @param {object} rather — the card picked for "would rather"
 * @param {() => number} rng — returns [0, 1)
 */
export function dealLikely(deck, usedIds, rather, rng = Math.random) {
  const { pair, usedIds: nextUsed } = dealPair(deck, usedIds, { size: CHOICE_SIZE - 1, holding: [rather] });
  const slot = Math.min(CHOICE_SIZE - 1, Math.floor(rng() * CHOICE_SIZE));
  return { pair: [...pair.slice(0, slot), rather, ...pair.slice(slot)], usedIds: nextUsed };
}

export function cardId(card) {
  return card.compositeId ?? `${card.deckType ?? card.typeId}:${card.id}`;
}

/**
 * Build the opening solo state from the preloaded decks.
 * @param {{ die: object[], live: object[], bye: object[] }} decks
 */
export function createSolo(decks) {
  const deck = SOLO_DECKS[0];
  const { pair, usedIds } = dealPair(decks[deck]);
  return Object.freeze({
    deckIndex: 0,
    round: 1,
    pair,
    rathers: {},
    picks: {},
    answers: {},
    pendingAnswer: null,
    inspectIndex: null,
    stage: 'round',
    usedIds,
    done: false,
  });
}

function isMystery(card) {
  return card?.special === 'mystery';
}

/**
 * Attach a pending answer step when the chosen card is a `?` card that
 * hasn't been answered yet. Pure.
 */
function withPendingAnswer(next, chosen, answers) {
  const cleared = { ...next, inspectIndex: null };
  if (!isMystery(chosen) || answers[cardId(chosen)] !== undefined) return Object.freeze(cleared);
  return Object.freeze({ ...cleared, pendingAnswer: chosen });
}

/**
 * Open the full-screen preview of one of the dealt cards. Confirming from
 * there is `pickCard`. Pure; no-op when there is nothing to inspect.
 * @param {object} solo
 * @param {number} index
 */
export function inspectCard(solo, index) {
  if (solo.done || solo.pendingAnswer || !isRound(solo) || !solo.pair[index]) return solo;
  return Object.freeze({ ...solo, inspectIndex: index });
}

/** Close the preview without picking. Pure. */
export function dismissInspect(solo) {
  if (solo.inspectIndex === null || solo.inspectIndex === undefined) return solo;
  return Object.freeze({ ...solo, inspectIndex: null });
}

/** Move the preview to the previous (-1) or next (+1) card, wrapping. Pure. */
export function stepInspect(solo, delta) {
  if (solo.inspectIndex === null || solo.inspectIndex === undefined) return solo;
  const n = solo.pair.length;
  if (!n) return solo;
  const next = (((solo.inspectIndex + delta) % n) + n) % n;
  return Object.freeze({ ...solo, inspectIndex: next });
}

/**
 * Record the player's answer to the pending `?` card and clear the step.
 * Blank text skips without storing anything. Pure.
 * @param {object} solo
 * @param {string} text
 */
export function answerCard(solo, text) {
  if (!solo.pendingAnswer) return solo;
  const trimmed = String(text ?? '').trim();
  const answers = trimmed ? { ...solo.answers, [cardId(solo.pendingAnswer)]: trimmed } : solo.answers;
  return Object.freeze({ ...solo, answers, pendingAnswer: null });
}

/** The "would rather" card for a deck when it differs from the final pick, else null. */
export function ratherFor(solo, deck) {
  const rather = solo.rathers?.[deck];
  const pick = solo.picks?.[deck];
  if (!rather || (pick && cardId(rather) === cardId(pick))) return null;
  return rather;
}

/** The stored answer for a card, or '' when none. */
export function answerFor(solo, card) {
  if (!card) return '';
  return (solo.answers ?? {})[cardId(card)] ?? '';
}

/**
 * Plain-text version of the summary plus the player's own eulogy, for the
 * clipboard. Pure.
 * @param {object} solo
 * @param {string} eulogy
 */
export function buildEulogyText(solo, eulogy) {
  const line = (deck) => {
    const card = solo.picks?.[deck];
    if (!card) return null;
    const answer = answerFor(solo, card);
    const title = String(card.title ?? '');
    const rather = ratherFor(solo, deck);
    const ratherNote = rather ? ` (would rather: ${String(rather.title ?? '')})` : '';
    return `${DECK_LABELS[deck].pickLabel}: ${answer ? `${title} — ${answer}` : title}${ratherNote}`;
  };
  const lines = SUMMARY_ORDER.map(line).filter(Boolean);
  const words = String(eulogy ?? '').trim();
  return [lines.join('\n'), words].filter(Boolean).join('\n\n');
}

/** Deck key for the current step. */
export function currentDeck(solo) {
  return SOLO_DECKS[solo.deckIndex];
}

/**
 * Apply the player's choice and return the next solo state. Pure.
 * @param {object} solo
 * @param {number} index — which card of `pair` was picked
 * @param {{ die: object[], live: object[], bye: object[] }} decks
 * @param {() => number} [rng] — places the "rather" card in the next hand
 */
export function pickCard(solo, index, decks, rng = Math.random) {
  if (solo.done || solo.pendingAnswer || !isRound(solo)) return solo;
  const chosen = solo.pair[index];
  if (!chosen) throw new Error(`Invalid pick index ${index}`);
  const answers = solo.answers ?? {};
  return withPendingAnswer(advance(solo, chosen, decks, rng), chosen, answers);
}

/** The round/deck transition for a pick, before any answer step. */
function advance(solo, chosen, decks, rng) {
  const deck = currentDeck(solo);

  // "Would rather" — remember it and deal the "more likely" hand around it.
  if (solo.round < ROUNDS_PER_DECK) {
    const rathers = { ...solo.rathers, [deck]: chosen };
    const { pair, usedIds } = dealLikely(decks[deck], solo.usedIds, chosen, rng);
    return { ...solo, round: solo.round + 1, pair, usedIds, rathers };
  }

  // "More likely" — chosen is the pick for this deck; show the story so far.
  const picks = { ...solo.picks, [deck]: chosen };
  const nextIndex = solo.deckIndex + 1;
  if (nextIndex >= SOLO_DECKS.length) {
    return { ...solo, picks, pair: [], done: true, stage: 'story' };
  }
  const nextDeck = SOLO_DECKS[nextIndex];
  const { pair, usedIds } = dealPair(decks[nextDeck], solo.usedIds);
  return { ...solo, deckIndex: nextIndex, round: 1, pair, usedIds, picks, stage: 'story' };
}

/** Screens between rounds: 'round' (dealt cards), 'story' (picks so far), 'eulogy'. */
function isRound(solo) {
  return (solo.stage ?? 'round') === 'round';
}

/** Leave the mid-game story screen and deal into the next deck's rounds. Pure. */
export function continueStory(solo) {
  if (solo.done || solo.stage !== 'story') return solo;
  return Object.freeze({ ...solo, stage: 'round' });
}

/** Open the write-your-own-eulogy screen once the story is complete. Pure. */
export function openEulogy(solo) {
  if (!solo.done || solo.stage === 'eulogy') return solo;
  return Object.freeze({ ...solo, stage: 'eulogy' });
}

// ── Life story ──────────────────────────────────────────────
// "Done" on the eulogy screen asks the API (Claude) to write a story from the
// picks and eulogy. `lifeStory` tracks that request; `requestId` lets a late
// response from an earlier attempt be ignored.

/**
 * Request body for POST /api/carkedit/solo/story. Pure.
 * @param {object} solo
 * @param {string} eulogy
 */
export function buildStoryRequest(solo, eulogy) {
  const describe = (card) => ({
    title: String(card?.title ?? ''),
    description: String(card?.description ?? ''),
    answer: answerFor(solo, card),
  });
  const pick = (deck) => {
    const rather = solo.rathers?.[deck];
    return rather ? { ...describe(solo.picks?.[deck]), rather: describe(rather) } : describe(solo.picks?.[deck]);
  };
  return {
    picks: Object.fromEntries(SUMMARY_ORDER.map((deck) => [deck, pick(deck)])),
    eulogy: String(eulogy ?? '').trim(),
  };
}

/** Move to the life-story screen with a request in flight. Pure. */
export function startStory(solo, eulogy, requestId) {
  if (!solo.done) return solo;
  return Object.freeze({
    ...solo,
    stage: 'lifestory',
    eulogy: String(eulogy ?? ''),
    lifeStory: Object.freeze({ status: 'loading', requestId, text: '', error: '' }),
  });
}

function settleStory(solo, requestId, patch) {
  if (solo.stage !== 'lifestory' || solo.lifeStory?.requestId !== requestId) return solo;
  return Object.freeze({ ...solo, lifeStory: Object.freeze({ ...solo.lifeStory, ...patch }) });
}

/** Store the written story, if it answers the current request. Pure. */
export function finishStory(solo, requestId, text) {
  return settleStory(solo, requestId, { status: 'ready', text: String(text ?? '').trim(), error: '' });
}

/** Record a failed request, if it is the current one. Pure. */
export function failStory(solo, requestId, message) {
  return settleStory(solo, requestId, { status: 'error', text: '', error: String(message ?? '') });
}
