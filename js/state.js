// CarkedIt Online — Game State
'use strict';

let _state = {
  screen: 'menu',
  players: [],
  funeralDirector: null,
  phase: null,
  currentCard: null,
  currentPlayerIndex: 0,
  turnStatus: 'idle',
  playerDieCards: {},
  phaseComplete: false,
  cardRevealed: false,
  hand: [],
  winner: null,
  decks: { die: null, live: null, bye: null },
  preloadComplete: false,
  selectedPlayerForRemoval: null,

  // Phase 2/3 state
  totalRounds: 2,
  livingDeadIndex: 0,
  phase23Round: 0,
  playerHands: {},
  submittedCards: {},
  revealedCards: false,
  pitchingPlayerIndex: 0,
  selectedCard: null,
  phase2SubState: 'living-dead',
  currentNonDeadIndex: 0,
  roundWinner: null,
  roundWinnerCard: null,
};

export function getState() {
  return _state;
}

export function setState(updates) {
  _state = { ..._state, ...updates };
}
