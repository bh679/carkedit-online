// CarkedIt Online — Single Player Manager
//
// One person, no server, no points. For each deck (DIE → LIVE → BYE) the
// player sees four cards and picks a favourite, twice; the third and final
// round pits the two favourites against each other. The winner of that
// round is the pick for the deck. Picking a `?` (mystery) card pauses the
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
export const ROUNDS_PER_DECK = 3;
export const CHOICE_SIZE = 4;
/** Order the picks are shown on the summary: life first, then death. */
export const SUMMARY_ORDER = Object.freeze(['live', 'die', 'bye']);

/** Short labels for the screen. */
export const DECK_LABELS = Object.freeze({
  die: { phase: '1', label: 'Phase 1 - DIE', prompt: 'Which death would you rather?', pickLabel: 'Your death' },
  live: { phase: '2', label: 'Phase 2 - LIVE', prompt: 'How do you want to live before you cark it?', pickLabel: 'Your life' },
  bye: { phase: '3', label: 'Phase 3 - BYE', prompt: 'What happens after you die?', pickLabel: 'Your afterlife' },
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
 * Deal the next CHOICE_SIZE unused cards from a deck. Pure.
 * @param {object[]} deck — ordered (already shuffled) cards
 * @param {string[]} usedIds — compositeIds already shown this game
 * @returns {{ pair: object[], usedIds: string[] }}
 */
export function dealPair(deck, usedIds = []) {
  const used = new Set(usedIds);
  const pair = [];
  for (const card of playableCards(deck)) {
    if (pair.length === CHOICE_SIZE) break;
    const id = cardId(card);
    if (used.has(id)) continue;
    pair.push(card);
  }
  if (pair.length < CHOICE_SIZE) {
    throw new Error(`Not enough cards to deal ${CHOICE_SIZE} (have ${pair.length})`);
  }
  return { pair, usedIds: [...usedIds, ...pair.map(cardId)] };
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
    favourites: [],
    picks: {},
    answers: {},
    pendingAnswer: null,
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
  if (!isMystery(chosen) || answers[cardId(chosen)] !== undefined) return Object.freeze(next);
  return Object.freeze({ ...next, pendingAnswer: chosen });
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
    return `${DECK_LABELS[deck].pickLabel}: ${answer ? `${title} — ${answer}` : title}`;
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
 */
export function pickCard(solo, index, decks) {
  if (solo.done || solo.pendingAnswer) return solo;
  const chosen = solo.pair[index];
  if (!chosen) throw new Error(`Invalid pick index ${index}`);
  const answers = solo.answers ?? {};
  return withPendingAnswer(advance(solo, chosen, decks), chosen, answers);
}

/** The round/deck transition for a pick, before any answer step. */
function advance(solo, chosen, decks) {
  const deck = currentDeck(solo);

  if (solo.round < ROUNDS_PER_DECK - 1) {
    const { pair, usedIds } = dealPair(decks[deck], solo.usedIds);
    return { ...solo, round: solo.round + 1, pair, usedIds, favourites: [...solo.favourites, chosen] };
  }

  if (solo.round === ROUNDS_PER_DECK - 1) {
    const favourites = [...solo.favourites, chosen];
    return { ...solo, round: ROUNDS_PER_DECK, pair: favourites, favourites };
  }

  // Final round — chosen is the pick for this deck.
  const picks = { ...solo.picks, [deck]: chosen };
  const nextIndex = solo.deckIndex + 1;
  if (nextIndex >= SOLO_DECKS.length) {
    return { ...solo, picks, favourites: [], pair: [], done: true };
  }
  const nextDeck = SOLO_DECKS[nextIndex];
  const { pair, usedIds } = dealPair(decks[nextDeck], solo.usedIds);
  return { ...solo, deckIndex: nextIndex, round: 1, pair, usedIds, favourites: [], picks };
}
