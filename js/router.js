// CarkedIt Online — Screen Router
'use strict';

import { getState, setState } from './state.js';
import { preloadCards } from './preloader.js';
import { render as renderMenu } from './screens/menu.js';
import { render as renderLobby } from './screens/lobby.js';
import { render as renderPhase1 } from './screens/phase1.js';
import { render as renderPhase23 } from './screens/phase2-3.js';
import { render as renderPhase4 } from './screens/phase4.js';
import { startPhase1, doneDying, revealCard } from './managers/game-manager.js';

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

function addPlayer() {
  const input = document.getElementById('player-name-input');
  const name = input?.value?.trim();
  if (!name) return;
  const state = getState();
  if (state.players.some((p) => p.name === name)) return;
  setState({ players: [...state.players, { name, score: 0 }] });
  showScreen('lobby');
}

function revealWinner() {
  const state = getState();
  const winner = state.players[Math.floor(Math.random() * state.players.length)]?.name ?? '';
  setState({ winner });
  showScreen('phase4');
}

// Expose game API for inline onclick handlers
window.game = { showScreen, addPlayer, startPhase1, doneDying, revealCard, revealWinner };

document.addEventListener('DOMContentLoaded', () => {
  showScreen('menu');
});
