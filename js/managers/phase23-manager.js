// CarkedIt Online — Phase 2/3 Manager (Live & Bye Decks)
'use strict';

import { getState } from '../state.js';

const HAND_SIZE = 5;

/**
 * @param {{ deckType: 'live'|'bye', onStateChange: (updates: object) => void, onPhaseComplete: () => void }} config
 */
export function createPhase23Manager({ deckType, onStateChange, onPhaseComplete }) {

  function getDeck() {
    return getState().decks[deckType] ?? [];
  }

  function setDeck(cards) {
    const state = getState();
    return { decks: { ...state.decks, [deckType]: cards } };
  }

  function getNonDeadPlayers() {
    const state = getState();
    return state.players.filter((_, i) => i !== state.livingDeadIndex);
  }

  function getNonDeadPlayerIndices() {
    const state = getState();
    return state.players
      .map((_, i) => i)
      .filter(i => i !== state.livingDeadIndex);
  }

  function dealHands() {
    const state = getState();
    const deck = [...getDeck()];
    const hands = { ...state.playerHands };

    for (const player of state.players) {
      const currentHand = hands[player.name] ?? [];
      const needed = HAND_SIZE - currentHand.length;
      if (needed > 0 && deck.length > 0) {
        const dealt = deck.splice(0, Math.min(needed, deck.length));
        hands[player.name] = [...currentHand, ...dealt];
      }
    }

    return { playerHands: hands, ...setDeck(deck) };
  }

  function getLivingDeadDieCard(state, livingDeadIndex) {
    const player = state.players[livingDeadIndex];
    const dieCard = player ? state.playerDieCards[player.name] : null;
    return dieCard ? { ...dieCard, deckType: 'die' } : null;
  }

  function start() {
    const state = getState();

    const deck = [...getDeck()];
    const handUpdates = dealHandsFromDeck(deck, state);

    onStateChange({
      livingDeadIndex: 0,
      phase23Round: 0,
      submittedCards: {},
      revealedCards: false,
      pitchingPlayerIndex: 0,
      selectedCard: null,
      phase2SubState: 'living-dead',
      currentNonDeadIndex: 0,
      roundWinner: null,
      currentCard: getLivingDeadDieCard(state, 0),
      ...handUpdates,
    });
  }

  function dealHandsFromDeck(deck, state) {
    const deckCopy = [...deck];
    const hands = { ...state.playerHands };
    const wildcardCards = { ...(state.wildcardCards ?? {}) };

    for (const player of state.players) {
      const currentHand = hands[player.name] ?? [];
      const needed = HAND_SIZE - currentHand.length;
      if (needed > 0 && deckCopy.length > 0) {
        const dealt = deckCopy.splice(0, Math.min(needed, deckCopy.length));

        // For bye deck: separate wildcard cards so they're held for Phase 4
        if (deckType === 'bye') {
          const regular = [];
          for (const card of dealt) {
            if (card.special === 'Wildcard') {
              const existing = wildcardCards[player.name] ?? [];
              wildcardCards[player.name] = [...existing, card];
            } else {
              regular.push(card);
            }
          }
          hands[player.name] = [...currentHand, ...regular];
        } else {
          hands[player.name] = [...currentHand, ...dealt];
        }
      }
    }

    const result = { playerHands: hands, ...setDeck(deckCopy) };
    if (deckType === 'bye') {
      result.wildcardCards = wildcardCards;
    }
    return result;
  }

  function showPlayerHand() {
    onStateChange({
      phase2SubState: 'pass-phone',
      currentNonDeadIndex: 0,
    });
  }

  function readyToSelect() {
    const state = getState();
    const nonDeadIndices = getNonDeadPlayerIndices();
    const playerIndex = nonDeadIndices[state.currentNonDeadIndex];
    const player = state.players[playerIndex];

    onStateChange({
      phase2SubState: 'selecting',
      hand: state.playerHands[player.name] ?? [],
      currentPlayerIndex: playerIndex,
      selectedCard: null,
    });
  }

  function inspectCard(cardId) {
    const state = getState();
    const hand = state.hand ?? [];
    const card = hand.find(c => String(c.id) === String(cardId));
    if (card) {
      onStateChange({ selectedCard: card });
    }
  }

  function prevCard(currentCardId) {
    const state = getState();
    const hand = state.hand ?? [];
    const index = hand.findIndex(c => String(c.id) === String(currentCardId));
    const prevIndex = index <= 0 ? hand.length - 1 : index - 1;
    if (hand[prevIndex]) {
      onStateChange({ selectedCard: hand[prevIndex] });
    }
  }

  function nextCard(currentCardId) {
    const state = getState();
    const hand = state.hand ?? [];
    const index = hand.findIndex(c => String(c.id) === String(currentCardId));
    const nextIndex = index >= hand.length - 1 ? 0 : index + 1;
    if (hand[nextIndex]) {
      onStateChange({ selectedCard: hand[nextIndex] });
    }
  }

  function dismissInspect() {
    onStateChange({ selectedCard: null });
  }

  function getJudgingCardList() {
    const state = getState();
    return getNonDeadPlayers()
      .map(p => {
        const card = (state.submittedCards ?? {})[p.name];
        return card ? { ...card, playerName: p.name } : null;
      })
      .filter(Boolean);
  }

  function inspectJudgingCard(playerName) {
    const state = getState();
    const card = (state.submittedCards ?? {})[playerName];
    if (card) {
      onStateChange({ selectedCard: { ...card, playerName } });
    }
  }

  function prevJudgingCard(cardId) {
    const list = getJudgingCardList();
    const index = list.findIndex(c => String(c.id) === String(cardId));
    const prevIndex = index <= 0 ? list.length - 1 : index - 1;
    if (list[prevIndex]) {
      onStateChange({ selectedCard: list[prevIndex] });
    }
  }

  function nextJudgingCard(cardId) {
    const list = getJudgingCardList();
    const index = list.findIndex(c => String(c.id) === String(cardId));
    const nextIndex = index >= list.length - 1 ? 0 : index + 1;
    if (list[nextIndex]) {
      onStateChange({ selectedCard: list[nextIndex] });
    }
  }

  function confirmWinner() {
    const state = getState();
    const playerName = state.selectedCard?.playerName;
    if (playerName) {
      pickWinner(playerName);
    }
  }

  function submitCard(cardId) {
    const state = getState();
    const nonDeadIndices = getNonDeadPlayerIndices();
    const playerIndex = nonDeadIndices[state.currentNonDeadIndex];
    const player = state.players[playerIndex];
    const hand = state.playerHands[player.name] ?? [];
    const card = hand.find(c => String(c.id) === String(cardId));

    if (!card) return;

    const newHand = hand.filter(c => String(c.id) !== String(cardId));
    const newSubmitted = { ...state.submittedCards, [player.name]: card };
    const newHands = { ...state.playerHands, [player.name]: newHand };

    const nextNonDeadIndex = state.currentNonDeadIndex + 1;
    const allSubmitted = nextNonDeadIndex >= nonDeadIndices.length;

    onStateChange({
      submittedCards: newSubmitted,
      playerHands: newHands,
      selectedCard: null,
      hand: [],
      currentNonDeadIndex: nextNonDeadIndex,
      phase2SubState: allSubmitted ? 'all-submitted' : 'pass-phone',
    });
  }

  function revealCards() {
    onStateChange({
      revealedCards: true,
      phase2SubState: 'revealed',
    });
  }

  function startPitching() {
    onStateChange({
      phase2SubState: 'pitching',
      pitchingPlayerIndex: 0,
    });
  }

  function donePitching() {
    const state = getState();
    const nonDeadPlayers = getNonDeadPlayers();
    const nextIndex = state.pitchingPlayerIndex + 1;

    if (nextIndex >= nonDeadPlayers.length) {
      onStateChange({
        phase2SubState: 'judging',
      });
    } else {
      onStateChange({
        pitchingPlayerIndex: nextIndex,
      });
    }
  }

  function pickWinner(playerName) {
    const state = getState();

    // Award point
    const players = state.players.map(p =>
      p.name === playerName ? { ...p, score: (p.score ?? 0) + 1 } : p
    );

    // Return unselected cards to deck bottom
    const deck = [...getDeck()];
    const nonDeadPlayers = getNonDeadPlayers();
    for (const p of nonDeadPlayers) {
      if (p.name !== playerName && state.submittedCards[p.name]) {
        deck.push(state.submittedCards[p.name]);
      }
    }

    // Draw players back up to 5 cards
    const hands = { ...state.playerHands };
    for (const player of players) {
      const currentHand = hands[player.name] ?? [];
      const needed = HAND_SIZE - currentHand.length;
      if (needed > 0 && deck.length > 0) {
        const dealt = deck.splice(0, Math.min(needed, deck.length));
        hands[player.name] = [...currentHand, ...dealt];
      }
    }

    onStateChange({
      players,
      playerHands: hands,
      roundWinner: playerName,
      roundWinnerCard: state.submittedCards[playerName] ?? null,
      phase2SubState: 'winner-announced',
      submittedCards: {},
      revealedCards: false,
      selectedCard: null,
      ...setDeck(deck),
    });
  }

  function nextRound() {
    const state = getState();
    const nextLivingDead = state.livingDeadIndex + 1;

    if (nextLivingDead >= state.players.length) {
      // All players have been Living Dead this round
      const nextPhaseRound = state.phase23Round + 1;

      if (nextPhaseRound >= state.totalRounds) {
        // Phase complete — all rounds done
        onPhaseComplete();
        return;
      }

      // Start next round (all players are Living Dead again)
      onStateChange({
        phase23Round: nextPhaseRound,
        livingDeadIndex: 0,
        currentNonDeadIndex: 0,
        submittedCards: {},
        revealedCards: false,
        pitchingPlayerIndex: 0,
        selectedCard: null,
        roundWinner: null,
        currentCard: getLivingDeadDieCard(state, 0),
        phase2SubState: 'living-dead',
      });
    } else {
      // Next player becomes Living Dead
      onStateChange({
        livingDeadIndex: nextLivingDead,
        currentNonDeadIndex: 0,
        submittedCards: {},
        revealedCards: false,
        pitchingPlayerIndex: 0,
        selectedCard: null,
        roundWinner: null,
        currentCard: getLivingDeadDieCard(state, nextLivingDead),
        phase2SubState: 'living-dead',
      });
    }
  }

  return {
    start,
    showPlayerHand,
    readyToSelect,
    inspectCard,
    prevCard,
    nextCard,
    dismissInspect,
    submitCard,
    revealCards,
    startPitching,
    donePitching,
    pickWinner,
    nextRound,
    inspectJudgingCard,
    prevJudgingCard,
    nextJudgingCard,
    confirmWinner,
  };
}
