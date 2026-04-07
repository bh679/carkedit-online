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

  // Network / online multiplayer state
  gameMode: 'local',               // 'local' | 'online'
  isHost: false,
  roomCode: null,
  connectionStatus: 'disconnected', // 'disconnected' | 'connecting' | 'connected'
  onlinePlayers: [],               // synced from server room state
  onlineError: null,               // connection/join error message
  mySessionId: null,               // local player's Colyseus session ID
  isMyTurn: false,                  // whether it's this player's turn (online mode)

  // Online Phase 2/3/4 state
  onlinePhase: null,                // 'submit' | 'convince' | 'select' | 'winner' | 'eulogy_intro' | 'eulogy_pick' | 'eulogy_speech' | 'eulogy_judge' | 'eulogy_points' | 'game_winner' | 'game_over' | null
  isLivingDead: false,              // whether this client is the current Living Dead
  onlineSubmittedCount: 0,          // how many players have submitted cards
  onlineTotalSubmitters: 0,         // total non-Living-Dead players
  onlineConvincerName: null,        // name of the player currently convincing
  isMyConvinceTurn: false,          // whether it's this client's turn to convince
  onlineSubmittedCards: [],         // submitted cards synced from server
  onlineWinner: null,               // { name, card } after selection
  myCardRevealed: false,            // whether this client's submitted card has been revealed

  // Online lobby settings (host-controlled)
  onlineSettings: {
    autoStartOnReady: true,        // auto-start game when all players are ready
  },

  gameSettings: {
    rounds: 2,
    handSize: 5,
    enableDie: true,
    enableLive: true,
    enableBye: true,
    enableEulogy: true,
    forceWildcards: 'atLeastOne',
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

  // Online Phase 4 (Eulogy) state
  isCurrentWildcardPlayer: false,   // whether this client is the current wildcard holder
  isCurrentEulogist: false,         // whether this client is the current eulogist
  onlineEulogistNames: [],          // names of selected eulogists
  onlineWildcardPlayerName: '',     // name of current wildcard holder

  // Expansion packs
  availablePacks: [],      // Packs shown in lobby selector (own + public published)
  selectedPackIds: ['base'], // Pack IDs currently enabled (sentinel "base" = CarkedIt base game)

  // Auth state
  authUser: null,                    // Local user object { id, display_name, email, avatar_url }
  firebaseUser: null,                // Firebase user (for display name, photo)
  authToken: null,                   // Current Firebase ID token
  authLoading: true,                 // True until first auth state resolved
  showUserMenu: false,               // Show user avatar dropdown menu
  showLoginModal: false,             // Show login/signup modal
  loginMode: 'signin',              // 'signin' | 'signup'
  loginError: null,                  // Auth error message
};

export function getState() {
  return _state;
}

export function setState(updates) {
  _state = { ..._state, ...updates };
}
