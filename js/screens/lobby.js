// CarkedIt Online — Lobby Screen
'use strict';

import { render as renderPhaseHeader } from '../components/phase-header.js';
import { render as renderGameboard } from '../components/gameboard.js';
import { render as renderPlayerList } from '../components/player-list.js';

const ROUND_PROMPTS = {
  1:  'A quick death is a good death.',
  2:  'Standard Death.',
  3:  "You're in for a long death.",
  4:  'This is going to take a while\u2026',
  5:  'Are you sure about this?',
  6:  'You might want to order pizza.',
  7:  'Cancel your plans for the evening.',
  8:  'This could be your whole weekend.',
  9:  'Your friends will hate you for this.',
  10: 'You will literally die before this ends.',
};

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.round(minutes / 60 * 10) / 10;
  return `${Number.isInteger(hrs) ? hrs : hrs.toFixed(1)} hr`;
}

function timeEstimate(players, rounds) {
  const lower = Math.round(players * (rounds + 1) * 10 / 3);
  const upper = lower * 2;
  return `${formatDuration(lower)}\u2013${formatDuration(upper)}`;
}

/**
 * @param {object} state
 * @returns {string} HTML string
 */
export function render(state) {
  const { rounds, handSize } = state.gameSettings;
  const playerCount = Math.max(state.players.length, 2);
  const estimate = timeEstimate(playerCount, rounds);
  const prompt = ROUND_PROMPTS[rounds] ?? ROUND_PROMPTS[10];

  const advancedPanel = state.showAdvancedSettings ? `
    <div class="lobby__advanced-panel">
      <div class="lobby__stepper-row">
        <span class="lobby__stepper-label">Rounds</span>
        <button class="btn btn--secondary lobby__stepper-btn"
          onclick="window.game.updateSetting('rounds', ${rounds - 1})"
          ${rounds <= 1 ? 'disabled' : ''}>&minus;</button>
        <span class="lobby__stepper-value">${rounds}</span>
        <button class="btn btn--secondary lobby__stepper-btn"
          onclick="window.game.updateSetting('rounds', ${rounds + 1})"
          ${rounds >= 10 ? 'disabled' : ''}>+</button>
      </div>
      <p class="lobby__setting-meta">${estimate} &mdash; ${prompt}</p>
      <div class="lobby__stepper-row">
        <span class="lobby__stepper-label">Cards in Hand</span>
        <button class="btn btn--secondary lobby__stepper-btn"
          onclick="window.game.updateSetting('handSize', ${handSize - 1})"
          ${handSize <= 1 ? 'disabled' : ''}>&minus;</button>
        <span class="lobby__stepper-value">${handSize}</span>
        <button class="btn btn--secondary lobby__stepper-btn"
          onclick="window.game.updateSetting('handSize', ${handSize + 1})"
          ${handSize >= 68 ? 'disabled' : ''}>+</button>
      </div>
    </div>
  ` : '';


  const boardContent = `
    <div class="lobby__board-content">
    <div class="lobby__setup">
      <h2 class="lobby__heading">Player Setup</h2>
      <div class="lobby__add-player">
        <input
          type="text"
          id="player-name-input"
          placeholder="Enter player name"
          class="input"
          maxlength="24"
        >
        <button class="btn btn--secondary" onclick="window.game.addPlayer()">
          Add
        </button>
      </div>
    </div>
    <div class="lobby__mode-toggle">
      <button
        class="btn lobby__mode-btn ${rounds === 1 ? 'btn--primary' : 'btn--secondary'}"
        onclick="window.game.setGameMode('quick')"
      >Quick</button>
      <button
        class="btn lobby__mode-btn ${rounds !== 1 ? 'btn--primary' : 'btn--secondary'}"
        onclick="window.game.setGameMode('normal')"
      >Normal</button>
    </div>
    <div class="lobby__advanced">
      <button
        class="btn btn--secondary lobby__advanced-toggle"
        onclick="window.game.toggleAdvancedSettings()"
      >
        Advanced Settings ${state.showAdvancedSettings ? '▲' : '▼'}
      </button>
      ${advancedPanel}
    </div>
  `;

  const canStart = state.players.length >= 2 && state.preloadComplete;
  const loadingIndicator = state.preloadComplete
    ? ''
    : '<p id="preload-progress" class="lobby__loading">Loading cards\u2026</p>';

  return `
    <div class="screen screen--lobby">
      ${renderPhaseHeader({ phase: '', label: 'Lobby' })}
      ${renderPlayerList(state.players, {
        funeralDirector: state.funeralDirector,
        allowRemove: true,
        selectedForRemoval: state.selectedPlayerForRemoval,
      })}
      ${renderGameboard(boardContent)}
      ${loadingIndicator}
      <div class="lobby__actions">
        <button
          class="btn btn--primary"
          onclick="window.game.startPhase1()"
          ${canStart ? '' : 'disabled'}
        >
          ${state.preloadComplete ? 'Start Game' : 'Loading\u2026'}
        </button>
      </div>
    </div>
  `;
}
