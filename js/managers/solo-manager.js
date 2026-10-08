// CarkedIt Online — Single Player Manager
//
// One person, no server, no points. For each deck (DIE → LIVE → BYE) the
// player sees two cards and picks a favourite, twice; the third and final
// round pits the two favourites against each other. The winner of that
// round is the pick for the deck.
//
// Everything here is a pure transition over a `solo` object held in state
// (see js/state.js). The router owns the thin `start` / `pick` hooks that
// touch the DOM.
'use strict';

export const SOLO_DECKS = Object.freeze(['die', 'live', 'bye']);
export const ROUNDS_PER_DECK = 3;
const PAIR_SIZE = 2;

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

// `Card` normalises the raw "Wildcard" special to null, so fall back to the
// illustration key, which survives normalisation.
function isWildcard(card) {
  const special = String(card.special ?? '').toLowerCase();
  const key = String(card.illustrationKey ?? '').toLowerCase();
  return special === 'wildcard' || key === 'wildcard-eulogy';
}

/**
 * Deal the next pair of unused cards from a deck. Pure.
 * @param {object[]} deck — ordered (already shuffled) cards
 * @param {string[]} usedIds — compositeIds already shown this game
 * @returns {{ pair: object[], usedIds: string[] }}
 */
export function dealPair(deck, usedIds = []) {
  const used = new Set(usedIds);
  const pair = [];
  for (const card of playableCards(deck)) {
    if (pair.length === PAIR_SIZE) break;
    const id = cardId(card);
    if (used.has(id)) continue;
    pair.push(card);
  }
  if (pair.length < PAIR_SIZE) {
    throw new Error(`Not enough cards to deal a pair (have ${pair.length})`);
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
    usedIds,
    done: false,
  });
}

/** Deck key for the current step. */
export function currentDeck(solo) {
  return SOLO_DECKS[solo.deckIndex];
}

/**
 * Apply the player's choice and return the next solo state. Pure.
 * @param {object} solo
 * @param {number} index — 0 or 1, which card of `pair` was picked
 * @param {{ die: object[], live: object[], bye: object[] }} decks
 */
export function pickCard(solo, index, decks) {
  if (solo.done) return solo;
  const chosen = solo.pair[index];
  if (!chosen) throw new Error(`Invalid pick index ${index}`);
  const deck = currentDeck(solo);

  if (solo.round < ROUNDS_PER_DECK - 1) {
    const { pair, usedIds } = dealPair(decks[deck], solo.usedIds);
    return Object.freeze({ ...solo, round: solo.round + 1, pair, usedIds, favourites: [...solo.favourites, chosen] });
  }

  if (solo.round === ROUNDS_PER_DECK - 1) {
    const favourites = [...solo.favourites, chosen];
    return Object.freeze({ ...solo, round: ROUNDS_PER_DECK, pair: favourites, favourites });
  }

  // Final round — chosen is the pick for this deck.
  const picks = { ...solo.picks, [deck]: chosen };
  const nextIndex = solo.deckIndex + 1;
  if (nextIndex >= SOLO_DECKS.length) {
    return Object.freeze({ ...solo, picks, favourites: [], pair: [], done: true });
  }
  const nextDeck = SOLO_DECKS[nextIndex];
  const { pair, usedIds } = dealPair(decks[nextDeck], solo.usedIds);
  return Object.freeze({ ...solo, deckIndex: nextIndex, round: 1, pair, usedIds, favourites: [], picks });
}
