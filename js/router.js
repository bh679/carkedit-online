// CarkedIt Online — Screen Router
'use strict';

import { getState, setState } from './state.js';
import { preloadCards } from './preloader.js';
import { render as renderMenu } from './screens/menu.js';
import { render as renderLobby } from './screens/lobby.js';
import { render as renderPhase1 } from './screens/phase1.js';
import { render as renderPhase23 } from './screens/phase2-3.js';
import { render as renderPhase4 } from './screens/phase4.js';
import {
  startPhase1, doneDying, revealCard,
  startPhase2, startPhase3,
  showPlayerHand, readyToSelect,
  inspectCard, prevCard, nextCard, dismissInspect, submitCard,
  revealCards, startPitching, donePitching,
  pickWinner, nextRound,
  inspectJudgingCard, prevJudgingCard, nextJudgingCard, confirmWinner,
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
const DEV_NAME_POOL = ['Brennan', 'Simon', 'Leonie', 'Danikah', 'Lowe', 'Hatton', 'Sanderson'];

function addPlayer() {
  const input = document.getElementById('player-name-input');
  let name = input?.value?.trim();

  if (!name) {
    // TODO (dev only): auto-fill a random name when the field is empty
    const state = getState();
    const taken = new Set(state.players.map((p) => p.name));
    const available = DEV_NAME_POOL.filter((n) => !taken.has(n));
    if (available.length === 0) return;
    name = available[Math.floor(Math.random() * available.length)];
  }

  const state = getState();
  if (state.players.some((p) => p.name === name)) return;
  setState({ players: [...state.players, { name, score: 0 }] });
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
  const max = key === 'rounds' ? 10 : 68;
  const value = Math.max(1, Math.min(max, parseInt(rawValue, 10) || 1));
  const state = getState();
  setState({ gameSettings: { ...state.gameSettings, [key]: value } });
  showScreen('lobby');
}

function toggleAdvancedSettings() {
  setState({ showAdvancedSettings: !getState().showAdvancedSettings });
  showScreen('lobby');
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
  toggleAdvancedSettings,
  startPhase1,
  doneDying,
  revealCard,
  revealWinner,
  // Phase 2/3 actions
  startPhase2,
  startPhase3,
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
