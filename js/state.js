// CarkedIt Online — Game State
'use strict';

let _state = {
  screen: 'menu',
  players: [],
  funeralDirector: null,
  phase: null,
  currentCard: null,
  currentPlayerIndex: 0,
  hand: [],
  winner: null,
};

export function getState() {
  return _state;
}

export function setState(updates) {
  _state = { ..._state, ...updates };
}
