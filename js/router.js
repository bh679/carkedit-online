// CarkedIt Online — Screen Router
'use strict';

import { getState, setState } from './state.js';
import { preloadCards } from './preloader.js';
import { render as renderMenu } from './screens/menu.js';
import { render as renderLobby, renderAdvancedPanel } from './screens/lobby.js';
import { render as renderPhase1 } from './screens/phase1.js';
import { render as renderPhase23 } from './screens/phase2-3.js';
import { render as renderPhase4 } from './screens/phase4.js';
import {
  startPhase1, doneDying, revealCard,
  startPhase2, startPhase3,
  showPlayerHand, readyToSelect, redrawHand,
  inspectCard, prevCard, nextCard, dismissInspect, submitCard,
  revealCards, startPitching, donePitching,
  pickWinner, nextRound,
  inspectJudgingCard, prevJudgingCard, nextJudgingCard, confirmWinner,
  inspectProfileCard, dismissProfileCard,
  startPhase4, startEulogyRound, selectEulogist, confirmEulogists,
  startEulogy, doneEulogy, pickBestEulogy, nextWildcard,
} from './managers/game-manager.js';

const SCREENS = {
  menu:   (state) => renderMenu(state),
  lobby:  (state) => renderLobby(state),
  phase1: (state) => renderPhase1(state),
  phase2: (state) => renderPhase23('live', state),
  phase3: (state) => renderPhase23('bye', state),
  phase4: (state) => renderPhase4(state),
};

export function showScreen(name, updates = {}) {
  setState({ screen: name, ...updates });
  const state = getState();
  const app = document.getElementById('app');
  const renderFn = SCREENS[name];
  if (!renderFn) throw new Error(`Unknown screen: ${name}`);
  app.innerHTML = renderFn(state);

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
    const { rounds } = state.gameSettings;
    modeToggle.innerHTML = `
      <button
        class="btn lobby__mode-btn ${rounds === 1 ? 'btn--primary' : 'btn--secondary'}"
        onclick="window.game.setGameMode('quick')"
      >Quick</button>
      <button
        class="btn lobby__mode-btn ${rounds !== 1 ? 'btn--primary' : 'btn--secondary'}"
        onclick="window.game.setGameMode('normal')"
      >Normal</button>
    `;
  }
}

let _preloadPromise = null;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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
  } else {
    max = 68; min = 1;
  }
  const value = Math.max(min, Math.min(max, parseInt(rawValue, 10) || min));
  setState({ gameSettings: { ...state.gameSettings, [key]: value } });
  refreshAdvancedPanel();
}

function setGameMode(mode) {
  const rounds = mode === 'quick' ? 1 : 2;
  const state = getState();
  setState({ gameSettings: { ...state.gameSettings, rounds } });
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
  handRedraws: 'once_per_phase',
  timerEnabled: false,
  pitchTimerEnabled: true,
  playCardTimerEnabled: true,
  timerCountUp: false,
  pitchDuration: 120,
  timerVisible: true,
  timerAutoAdvance: true,
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
};

document.addEventListener('DOMContentLoaded', () => {
  showScreen('menu');
});
