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
  playerChosenCards: {},  // { [playerName]: card[] } — cards chosen by each Living Dead across phases
  phaseComplete: false,
  cardRevealed: false,
  hand: [],
  winner: null,
  decks: { die: null, live: null, bye: null },
  preloadComplete: false,
  selectedPlayerForRemoval: null,
  gameSettings: {
    rounds: 2,
    handSize: 5,
    enableDie: true,
    enableLive: true,
    enableBye: true,
    enableEulogy: true,
    forceWildcards: false,
    playableWildcards: true,
    wildcardCount: 2,
    eulogistCount: 2,
    handRedraws: 'once_per_phase',
    timerEnabled: false,
    pitchTimerEnabled: true,
    playCardTimerEnabled: true,
    timerCountUp: false,
    pitchDuration: 120,
    timerVisible: true,
    timerAutoAdvance: true,
    ultraQuickMode: false,
    optionalCardPlay: false,
  },
  showAdvancedSettings: false,

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
  handRedrawnPlayers: {},
  hasPlayedCardPlayers: {},
  forcedPlayerNames: [],

  // Profile card inspect overlay (living-dead / selecting sub-states)
  profileInspectCard: null,

  // Pitching timer (live countdown — not a setting)
  pitchTimerSeconds: 120,
  // Play card timer (live countdown — not a setting)
  playCardTimerSeconds: 60,

  // Wildcard cards held aside during Phase 3
  wildcardCards: {},

  // Phase 4 state
  phase4SubState: 'wildcard-intro',
  wildcardPlayers: [],
  currentWildcardIndex: 0,
  selectedEulogists: [],
  currentEulogistIndex: 0,
  bestEulogist: null,
};

export function getState() {
  return _state;
}

export function setState(updates) {
  _state = { ..._state, ...updates };
}
