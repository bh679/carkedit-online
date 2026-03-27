// CarkedIt Online — Phase 2/3 Manager (Live & Bye Decks)
'use strict';

import { getState } from '../state.js';

const DEFAULT_PITCH_DURATION = 120; // seconds — overridable via state.pitchDuration

let _pitchTimer = null;

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
    const handSize = state.gameSettings?.handSize ?? 5;

    for (const player of state.players) {
      const currentHand = hands[player.name] ?? [];
      const needed = handSize - currentHand.length;
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
      profileInspectCard: null,
      phase2SubState: 'living-dead',
      currentNonDeadIndex: 0,
      roundWinner: null,
      handRedrawnPlayers: {},
      hasPlayedCardPlayers: {},
      currentCard: getLivingDeadDieCard(state, 0),
      ...handUpdates,
    });
  }

  function redrawHand() {
    const state = getState();
    const player = state.players[state.currentPlayerIndex];
    if (!player) return;

    const handRedraws = state.gameSettings?.handRedraws ?? 'once_per_phase';
    const alreadyRedrawn = !!(state.handRedrawnPlayers ?? {})[player.name];
    if (handRedraws === 'off') return;
    if (handRedraws !== 'unlimited' && alreadyRedrawn) return;

    const handSize = state.gameSettings?.handSize ?? HAND_SIZE;
    const currentHand = state.playerHands[player.name] ?? [];
    const deck = [...getDeck(), ...currentHand];

    const newHand = deck.splice(0, Math.min(handSize, deck.length));
    const newPlayerHands = { ...state.playerHands, [player.name]: newHand };
    const newRedrawnPlayers = { ...(state.handRedrawnPlayers ?? {}), [player.name]: true };

    onStateChange({
      hand: newHand,
      playerHands: newPlayerHands,
      handRedrawnPlayers: newRedrawnPlayers,
      ...setDeck(deck),
    });
  }

  function dealHandsFromDeck(deck, state) {
    const handSize = state.gameSettings?.handSize ?? 5;
    const deckCopy = [...deck];
    const hands = { ...state.playerHands };
    const wildcardCards = { ...(state.wildcardCards ?? {}) };

    for (const player of state.players) {
      const currentHand = hands[player.name] ?? [];
      const needed = handSize - currentHand.length;
      if (needed > 0 && deckCopy.length > 0) {
        const dealt = deckCopy.splice(0, Math.min(needed, deckCopy.length));

        // For bye deck: track wildcards in wildcardCards for Phase 4 detection,
        // but also keep them in the player's hand so they're visible
        if (deckType === 'bye') {
          for (const card of dealt) {
            if (card.special === 'Wildcard') {
              const existing = wildcardCards[player.name] ?? [];
              wildcardCards[player.name] = [...existing, card];
            }
          }
          hands[player.name] = [...currentHand, ...dealt];
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
      profileInspectCard: null,
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

  function getProfileCards() {
    const state = getState();
    const player = state.players[state.livingDeadIndex];
    if (!player) return [];
    const cards = [];
    const dieCard = state.playerDieCards[player.name];
    if (dieCard) cards.push({ ...dieCard, deckType: 'die' });
    const chosen = state.playerChosenCards?.[player.name] ?? [];
    for (const card of chosen) {
      cards.push({ ...card });
    }
    return cards;
  }

  function inspectProfileCard(index) {
    const card = getProfileCards()[index];
    if (card) {
      onStateChange({ profileInspectCard: card });
    }
  }

  function dismissProfileCard() {
    onStateChange({ profileInspectCard: null });
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
    const newHasPlayed = { ...(state.hasPlayedCardPlayers ?? {}), [player.name]: true };

    const nextNonDeadIndex = state.currentNonDeadIndex + 1;
    const allSubmitted = nextNonDeadIndex >= nonDeadIndices.length;

    onStateChange({
      submittedCards: newSubmitted,
      playerHands: newHands,
      hasPlayedCardPlayers: newHasPlayed,
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

  function startPitchTimer() {
    clearPitchTimer();
    const countUp = getState().gameSettings?.timerCountUp ?? false;
    _pitchTimer = setInterval(() => {
      const state = getState();
      if (state.gameSettings?.timerCountUp ?? false) {
        onStateChange({ pitchTimerSeconds: state.pitchTimerSeconds + 1 });
      } else {
        const remaining = state.pitchTimerSeconds - 1;
        if (remaining <= 0) {
          clearPitchTimer();
          if (state.gameSettings?.timerAutoAdvance ?? true) {
            donePitching();
          } else {
            onStateChange({ pitchTimerSeconds: 0 });
          }
        } else {
          onStateChange({ pitchTimerSeconds: remaining });
        }
      }
    }, 1000);
  }

  function clearPitchTimer() {
    if (_pitchTimer !== null) {
      clearInterval(_pitchTimer);
      _pitchTimer = null;
    }
  }

  function startPitching() {
    const state = getState();
    const countUp = state.gameSettings?.timerCountUp ?? false;
    const duration = state.gameSettings?.pitchDuration ?? DEFAULT_PITCH_DURATION;
    onStateChange({
      phase2SubState: 'pitching',
      pitchingPlayerIndex: 0,
      pitchTimerSeconds: countUp ? 0 : duration,
    });
    if (state.gameSettings?.timerEnabled) {
      startPitchTimer();
    }
  }

  function donePitching() {
    clearPitchTimer();
    const state = getState();
    const nonDeadPlayers = getNonDeadPlayers();
    const nextIndex = state.pitchingPlayerIndex + 1;
    const countUp = state.gameSettings?.timerCountUp ?? false;
    const duration = state.gameSettings?.pitchDuration ?? DEFAULT_PITCH_DURATION;

    if (nextIndex >= nonDeadPlayers.length) {
      onStateChange({
        phase2SubState: 'judging',
      });
    } else {
      onStateChange({
        pitchingPlayerIndex: nextIndex,
        pitchTimerSeconds: countUp ? 0 : duration,
      });
      if (getState().gameSettings?.timerEnabled) {
        startPitchTimer();
      }
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

    // Store the winning card on the Living Dead's tableau
    const livingDeadName = state.players[state.livingDeadIndex].name;
    const winningCard = state.submittedCards[playerName];
    const playerChosenCards = { ...(state.playerChosenCards ?? {}) };
    const existing = playerChosenCards[livingDeadName] ?? [];
    playerChosenCards[livingDeadName] = [...existing, { ...winningCard, deckType }];

    // Draw players back up to hand size
    const handSize = state.gameSettings?.handSize ?? 5;
    const hands = { ...state.playerHands };
    const wildcardCards = { ...(state.wildcardCards ?? {}) };
    for (const player of players) {
      const currentHand = hands[player.name] ?? [];
      const needed = handSize - currentHand.length;
      if (needed > 0 && deck.length > 0) {
        const dealt = deck.splice(0, Math.min(needed, deck.length));
        if (deckType === 'bye') {
          for (const card of dealt) {
            if (card.special === 'Wildcard') {
              const existing = wildcardCards[player.name] ?? [];
              wildcardCards[player.name] = [...existing, card];
            }
          }
        }
        hands[player.name] = [...currentHand, ...dealt];
      }
    }

    onStateChange({
      players,
      playerHands: hands,
      wildcardCards,
      playerChosenCards,
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
    clearPitchTimer();
    const state = getState();
    const nextLivingDead = state.livingDeadIndex + 1;
    const handRedraws = state.gameSettings?.handRedraws ?? 'once_per_phase';
    const resetRedrawTracking = handRedraws === 'once_per_round' || handRedraws === 'unlimited';
    const redrawReset = resetRedrawTracking
      ? { handRedrawnPlayers: {}, hasPlayedCardPlayers: {} }
      : {};

    if (nextLivingDead >= state.players.length) {
      // All players have been Living Dead this round
      const nextPhaseRound = state.phase23Round + 1;

      const maxRounds = getState().gameSettings?.rounds ?? 2;
      if (nextPhaseRound >= maxRounds) {
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
        profileInspectCard: null,
        roundWinner: null,
        currentCard: getLivingDeadDieCard(state, 0),
        phase2SubState: 'living-dead',
        ...redrawReset,
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
        profileInspectCard: null,
        roundWinner: null,
        currentCard: getLivingDeadDieCard(state, nextLivingDead),
        phase2SubState: 'living-dead',
        ...redrawReset,
      });
    }
  }

  return {
    start,
    showPlayerHand,
    readyToSelect,
    redrawHand,
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
    inspectProfileCard,
    dismissProfileCard,
  };
}
