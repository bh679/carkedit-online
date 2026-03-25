// CarkedIt Online — Phase 1 Manager (Die Deck)
'use strict';

import { getState } from '../state.js';
import { loadDeck } from '../data/cardTypes.js';

/**
 * @param {{ onStateChange: (updates: object) => void, onPhaseComplete: () => void }} callbacks
 * @returns {{ start: () => Promise<void>, nextTurn: () => void }}
 */
export function createPhase1Manager({ onStateChange, onPhaseComplete }) {

  async function ensureDeck() {
    const state = getState();
    if (!state.decks.die || state.decks.die.length === 0) {
      const cards = await loadDeck('die');
      const shuffled = shuffle(cards);
      onStateChange({ decks: { ...state.decks, die: shuffled } });
    }
  }

  async function start() {
    await ensureDeck();
    await dealToCurrentPlayer();
  }

  async function dealToCurrentPlayer() {
    const state = getState();
    const player = state.players[state.currentPlayerIndex];
    const deck = state.decks.die;

    if (!deck || deck.length === 0) return;

    const [card, ...rest] = deck;

    onStateChange({
      currentCard: { ...card, deckType: 'die' },
      turnStatus: 'describing',
      cardRevealed: false,
      decks: { ...state.decks, die: rest },
      playerDieCards: { ...state.playerDieCards, [player.name]: card },
    });
  }

  function nextTurn() {
    const state = getState();
    const nextIndex = state.currentPlayerIndex + 1;

    if (nextIndex >= state.players.length) {
      onPhaseComplete();
      return;
    }

    onStateChange({
      currentPlayerIndex: nextIndex,
      currentCard: null,
      turnStatus: 'dealing',
    });

    setTimeout(() => dealToCurrentPlayer(), 300);
  }

  function revealCard() {
    onStateChange({ cardRevealed: true });
  }

  return { start, nextTurn, revealCard };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
