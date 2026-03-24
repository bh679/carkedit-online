// CarkedIt Online — Screen Router
'use strict';

import { getState, setState } from './state.js';
import { loadDeck } from './data/cardTypes.js';
import { render as renderMenu } from './screens/menu.js';
import { render as renderLobby } from './screens/lobby.js';
import { render as renderPhase1 } from './screens/phase1.js';
import { render as renderPhase23 } from './screens/phase2-3.js';
import { render as renderPhase4 } from './screens/phase4.js';

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

async function drawCard(deckId) {
  const state = getState();
  let remaining = state.decks[deckId];

  if (!remaining || remaining.length === 0) {
    const cards = await loadDeck(deckId);
    remaining = shuffle(cards);
  }

  const [currentCard, ...rest] = remaining;
  setState({
    currentCard,
    decks: { ...state.decks, [deckId]: rest },
  });
  showScreen(getState().screen);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function revealWinner() {
  const state = getState();
  const winner = state.players[Math.floor(Math.random() * state.players.length)]?.name ?? '';
  setState({ winner });
  showScreen('phase4');
}

// Expose game API for inline onclick handlers
window.game = { showScreen, addPlayer, drawCard, revealWinner };

document.addEventListener('DOMContentLoaded', () => {
  showScreen('menu');
});
