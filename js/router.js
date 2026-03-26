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

function revealWinner() {
  const state = getState();
  const winner = state.players[Math.floor(Math.random() * state.players.length)]?.name ?? '';
  setState({ winner });
  showScreen('phase4');
}

// Expose game API for inline onclick handlers
window.game = {
  showScreen,
  addPlayer,
  selectPlayerRemoval,
  removePlayer,
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
};

document.addEventListener('DOMContentLoaded', () => {
  showScreen('menu');
});
