// CarkedIt Online — Screen Router
'use strict';

import { getState, setState } from './state.js';
import { preloadCards } from './preloader.js';
import { render as renderMenu } from './screens/menu.js';
import { render as renderModeSelect } from './screens/mode-select.js';
import { render as renderLobby, renderAdvancedPanel } from './screens/lobby.js';
import { render as renderOnlineLobby } from './screens/online-lobby.js';
import { render as renderPhase1 } from './screens/phase1.js';
import { render as renderPhase23 } from './screens/phase2-3.js';
import { render as renderPhase4 } from './screens/phase4.js';
import { shuffle } from './utils/shuffle.js';
import {
  createRoom as networkCreateRoom,
  joinRoom as networkJoinRoom,
  leaveRoom as networkLeaveRoom,
} from './network/client.js';
import {
  startPhase1, doneDying, revealCard,
  startPhase2, startPhase3,
  showPlayerHand, readyToSelect, redrawHand,
  inspectCard, prevCard, nextCard, dismissInspect, passCard, submitCard,
  revealCards, startPitching, donePitching,
  pickWinner, nextRound,
  inspectJudgingCard, prevJudgingCard, nextJudgingCard, confirmWinner,
  inspectProfileCard, dismissProfileCard,
  startPhase4, startEulogyRound, selectEulogist, confirmEulogists,
  startEulogy, doneEulogy, pickBestEulogy, nextWildcard,
} from './managers/game-manager.js';

const SCREENS = {
  menu:          (state) => renderMenu(state),
  'mode-select': (state) => renderModeSelect(state),
  lobby:         (state) => renderLobby(state),
  'online-lobby': (state) => renderOnlineLobby(state),
  phase1:        (state) => renderPhase1(state),
  phase2:        (state) => renderPhase23('live', state),
  phase3:        (state) => renderPhase23('bye', state),
  phase4:        (state) => renderPhase4(state),
};

export function showScreen(name, updates = {}) {
  setState({ screen: name, ...updates });
  const state = getState();
  const app = document.getElementById('app');
  const renderFn = SCREENS[name];
  if (!renderFn) throw new Error(`Unknown screen: ${name}`);
  app.innerHTML = renderFn(state);

  if (name === 'menu') {
    fetch('package.json').then(r => r.json()).then(pkg => {
      const el = document.getElementById('menu-version');
      if (el) el.textContent = `v${pkg.version}`;
    }).catch(() => {});
  }

  // Show player list label only when the list overflows (more players than fit on screen)
  requestAnimationFrame(() => {
    const list = document.querySelector('.player-list');
    const container = document.querySelector('.player-list-container');
    if (list && container) {
      container.classList.toggle('player-list-container--scrollable', list.scrollWidth > list.clientWidth);
    }
  });

  // Start preloading cards when entering the lobby
  if (name === 'lobby' && !state.preloadComplete) {
    startPreload();
  }
}

function refreshAdvancedPanel() {
  const state = getState();
  const panel = document.getElementById('advanced-settings-panel');
  if (panel) {
    panel.innerHTML = renderAdvancedPanel(state);
  }
  const toggleBtn = document.querySelector('#lobby-advanced .lobby__advanced-toggle');
  if (toggleBtn) {
    toggleBtn.textContent = `Advanced Settings ${state.showAdvancedSettings ? '▲' : '▼'}`;
  }
  const modeToggle = document.getElementById('lobby-mode-toggle');
  if (modeToggle) {
    const { rounds, ultraQuickMode, optionalCardPlay } = state.gameSettings;
    const pc = state.players.length;
    const isQuick     = !ultraQuickMode && rounds === 1 && !optionalCardPlay;
    const isNormal    = !ultraQuickMode && rounds !== 1 && !optionalCardPlay;
    const isBigGroup  = !ultraQuickMode && rounds === 1 &&  optionalCardPlay;
    const isHugeGroup =  ultraQuickMode &&                  optionalCardPlay;
    modeToggle.innerHTML = `
      <button class="btn lobby__mode-btn ${isQuick ? 'btn--primary' : 'btn--secondary'}"
        onclick="window.game.setGameMode('quick')">Quick</button>
      <button class="btn lobby__mode-btn ${isNormal ? 'btn--primary' : 'btn--secondary'}"
        onclick="window.game.setGameMode('normal')">Normal</button>
      ${pc > 6 ? `<button class="btn lobby__mode-btn ${isBigGroup ? 'btn--primary' : 'btn--secondary'}"
        onclick="window.game.setGameMode('big-group')">Big Group</button>` : ''}
      ${pc > 9 ? `<button class="btn lobby__mode-btn ${isHugeGroup ? 'btn--primary' : 'btn--secondary'}"
        onclick="window.game.setGameMode('huge-group')">Huge Group</button>` : ''}
    `;
  }
}

let _preloadPromise = null;

function startPreload() {
  if (_preloadPromise) return; // already in progress
  _preloadPromise = preloadCards((loaded, total) => {
    const el = document.getElementById('preload-progress');
    if (el) el.textContent = `Loading cards\u2026 ${loaded}/${total}`;
  }).then(({ decks }) => {
    const state = getState();
    setState({
      decks: {
        die: shuffle(decks.die ?? []),
        live: shuffle(decks.live ?? []),
        bye: shuffle(decks.bye ?? []),
      },
      preloadComplete: true,
    });
    // Re-render lobby to enable Start button
    if (getState().screen === 'lobby') {
      showScreen('lobby');
    }
  });
}

// TODO (dev only): placeholder names for quick testing — remove or replace with proper UX before shipping
const DEV_NAME_POOL = [
  { name: 'Brennan',   birthMonth: 11, birthDay: 1  },
  { name: 'Simon',     birthMonth: 6,  birthDay: 15 },
  { name: 'Leonie',    birthMonth: 3,  birthDay: 22 },
  { name: 'Danikah',   birthMonth: 8,  birthDay: 7  },
  { name: 'Lowe',      birthMonth: 1,  birthDay: 30 },
  { name: 'Hatton',    birthMonth: 5,  birthDay: 12 },
  { name: 'Sanderson', birthMonth: 9,  birthDay: 4  },
];

function addPlayer() {
  const input = document.getElementById('player-name-input');
  let name = input?.value?.trim();

  if (!name) {
    // TODO (dev only): auto-fill a random name when the field is empty
    const state = getState();
    const taken = new Set(state.players.map((p) => p.name));
    const available = DEV_NAME_POOL.filter((n) => !taken.has(n.name));
    if (available.length === 0) return;
    const pick = available[Math.floor(Math.random() * available.length)];
    name = pick.name;
    const monthEl = document.getElementById('player-birth-month');
    const dayEl = document.getElementById('player-birth-day');
    if (monthEl) monthEl.value = pick.birthMonth;
    if (dayEl) dayEl.value = pick.birthDay;
  }

  const state = getState();
  if (state.players.some((p) => p.name === name)) return;

  const monthEl = document.getElementById('player-birth-month');
  const dayEl = document.getElementById('player-birth-day');
  const birthMonth = parseInt(monthEl?.value ?? '', 10) || 0;
  const birthDay = parseInt(dayEl?.value ?? '', 10) || 0;

  const newPlayers = [...state.players, { name, score: 0, birthMonth, birthDay }];
  const newPlayerCount = Math.max(newPlayers.length, 2);
  const maxHandSize = Math.max(1, Math.floor(68 / newPlayerCount));
  const currentHandSize = state.gameSettings?.handSize ?? 5;
  setState({
    players: newPlayers,
    gameSettings: { ...state.gameSettings, handSize: Math.min(currentHandSize, maxHandSize) },
  });
  showScreen('lobby');
}

function selectPlayerRemoval(name) {
  const state = getState();
  const next = state.selectedPlayerForRemoval === name ? null : name;
  setState({ selectedPlayerForRemoval: next });
  showScreen('lobby');
}

function removePlayer(name) {
  const state = getState();
  setState({
    players: state.players.filter((p) => p.name !== name),
    selectedPlayerForRemoval: null,
  });
  showScreen('lobby');
}

function updateSetting(key, rawValue) {
  const state = getState();
  let max, min;
  if (key === 'rounds') {
    max = 10; min = 1;
  } else if (key === 'wildcardCount') {
    max = 10; min = 0;
  } else if (key === 'handSize') {
    const playerCount = Math.max(state.players.length, 2);
    max = Math.max(1, Math.floor(68 / playerCount)); min = 1;
  } else if (key === 'eulogistCount') {
    max = 10; min = 1;
  } else {
    max = 68; min = 1;
  }
  const value = Math.max(min, Math.min(max, parseInt(rawValue, 10) || min));
  setState({ gameSettings: { ...state.gameSettings, [key]: value } });
  refreshAdvancedPanel();
}

function setGameMode(mode) {
  const state = getState();
  const presets = {
    'quick':      { rounds: 1, ultraQuickMode: false, optionalCardPlay: false },
    'normal':     { rounds: 2, ultraQuickMode: false, optionalCardPlay: false },
    'big-group':  { rounds: 1, ultraQuickMode: false, optionalCardPlay: true  },
    'huge-group': { rounds: 1, ultraQuickMode: true,  optionalCardPlay: true  },
  };
  const patch = presets[mode];
  if (!patch) return;
  setState({ gameSettings: { ...state.gameSettings, ...patch } });
  refreshAdvancedPanel();
}

function toggleAdvancedSettings() {
  setState({ showAdvancedSettings: !getState().showAdvancedSettings });
  refreshAdvancedPanel();
}

function setHandRedraws(value) {
  const allowed = ['off', 'once_per_phase', 'once_per_round', 'unlimited'];
  if (!allowed.includes(value)) return;
  const state = getState();
  setState({ gameSettings: { ...state.gameSettings, handRedraws: value } });
  refreshAdvancedPanel();
}

const PITCH_DURATIONS = [30, 60, 120, 180, 240, 300, 600, 900, 1800, 3600];

const DEFAULT_GAME_SETTINGS = {
  rounds: 2,
  handSize: 5,
  enableDie: true,
  enableLive: true,
  enableBye: true,
  enableEulogy: true,
  forceWildcards: false,
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
};

function resetSettings() {
  setState({ gameSettings: { ...DEFAULT_GAME_SETTINGS } });
  showScreen('lobby');
}

function toggleSetting(key) {
  const state = getState();
  setState({ gameSettings: { ...state.gameSettings, [key]: !state.gameSettings[key] } });
  refreshAdvancedPanel();
}

function toggleUltraQuickMode() {
  const state = getState();
  const enabling = !state.gameSettings.ultraQuickMode;
  setState({
    gameSettings: {
      ...state.gameSettings,
      ultraQuickMode: enabling,
      rounds: enabling ? 1 : state.gameSettings.rounds,
      ...(enabling ? { enableLive: true, enableBye: true } : {}),
    },
  });
  showScreen('lobby');
}

function cyclePitchDuration(dir) {
  const state = getState();
  const current = state.gameSettings.pitchDuration ?? 120;
  const idx = PITCH_DURATIONS.indexOf(current);
  const next = PITCH_DURATIONS[Math.max(0, Math.min(PITCH_DURATIONS.length - 1, idx + dir))];
  setState({ gameSettings: { ...state.gameSettings, pitchDuration: next } });
  refreshAdvancedPanel();
}

function revealWinner() {
  const state = getState();
  const sorted = [...state.players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const winner = sorted[0]?.name ?? '';
  setState({ winner, phase4SubState: 'winner' });
  showScreen('phase4');
}

// Expose game API for inline onclick handlers
window.game = {
  showScreen,
  addPlayer,
  selectPlayerRemoval,
  removePlayer,
  updateSetting,
  toggleSetting,
  toggleUltraQuickMode,
  setGameMode,
  toggleAdvancedSettings,
  setHandRedraws,
  cyclePitchDuration,
  resetSettings,
  startPhase1,
  doneDying,
  revealCard,
  revealWinner,
  // Phase 2/3 actions
  startPhase2,
  startPhase3,
  showPlayerHand,
  readyToSelect,
  redrawHand,
  inspectCard,
  prevCard,
  nextCard,
  dismissInspect,
  passCard,
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
  // Phase 4 actions
  startPhase4,
  startEulogyRound,
  selectEulogist,
  confirmEulogists,
  startEulogy,
  doneEulogy,
  pickBestEulogy,
  nextWildcard,
  setRounds(n) {
    setState({ totalRounds: Math.max(1, Math.min(10, n)) });
    showScreen('lobby');
  },
  // Online multiplayer actions
  async createRoom() {
    const name = document.getElementById('online-player-name')?.value?.trim();
    if (!name) {
      setState({ onlineError: 'Please enter your name' });
      showScreen('online-lobby');
      return;
    }
    const birthMonth = parseInt(document.getElementById('online-birth-month')?.value ?? '', 10) || 0;
    const birthDay = parseInt(document.getElementById('online-birth-day')?.value ?? '', 10) || 0;
    try {
      await networkCreateRoom(
        { name, birthMonth, birthDay, isPrivate: true },
        () => { if (getState().screen === 'online-lobby') showScreen('online-lobby'); },
      );
      showScreen('online-lobby');
    } catch (err) {
      showScreen('online-lobby');
    }
  },
  async joinRoom() {
    const name = document.getElementById('online-player-name')?.value?.trim();
    const code = document.getElementById('online-room-code')?.value?.trim();
    if (!name) {
      setState({ onlineError: 'Please enter your name' });
      showScreen('online-lobby');
      return;
    }
    if (!code) {
      setState({ onlineError: 'Please enter a room code' });
      showScreen('online-lobby');
      return;
    }
    const birthMonth = parseInt(document.getElementById('online-birth-month')?.value ?? '', 10) || 0;
    const birthDay = parseInt(document.getElementById('online-birth-day')?.value ?? '', 10) || 0;
    try {
      await networkJoinRoom(
        code,
        { name, birthMonth, birthDay },
        () => { if (getState().screen === 'online-lobby') showScreen('online-lobby'); },
      );
      showScreen('online-lobby');
    } catch (err) {
      showScreen('online-lobby');
    }
  },
  async leaveRoom() {
    await networkLeaveRoom();
    showScreen('online-lobby');
  },
  startOnlineGame() {
    // Placeholder — game state sync will be implemented in a future session
  },
};

document.addEventListener('DOMContentLoaded', () => {
  showScreen('menu');
});
