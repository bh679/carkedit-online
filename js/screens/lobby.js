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
const REDRAW_OPTIONS = [
  { value: 'off',            label: 'Off' },
  { value: 'once_per_phase', label: 'Once / Phase' },
  { value: 'once_per_round', label: 'Once / Round' },
  { value: 'unlimited',      label: 'Unlimited' },
];

const PITCH_DURATIONS = [30, 60, 120, 180, 240, 300, 600, 900, 1800, 3600];

function formatPitchDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  return `${seconds / 60} min`;
}

export function renderAdvancedPanel(state) {
  if (!state.showAdvancedSettings) return '';
  const { rounds, handSize, enableLive, enableBye, enableEulogy, forceWildcards, wildcardCount, handRedraws = 'once_per_phase', timerEnabled, timerCountUp, pitchDuration, timerVisible, timerAutoAdvance } = state.gameSettings;
  const playerCount = Math.max(state.players.length, 2);
  const maxHandSize = Math.max(1, Math.floor(68 / playerCount));
  const estimate = timeEstimate(playerCount, rounds);
  const prompt = ROUND_PROMPTS[rounds] ?? ROUND_PROMPTS[10];

  const wildcardSubSettings = enableEulogy ? `
    <div class="lobby__advanced-subsection">
      <div class="lobby__stepper-row">
        <span class="lobby__stepper-label">Force Wildcards <span class="lobby__stepper-hint">(everyone gets one)</span></span>
        <button class="btn lobby__stepper-btn ${forceWildcards ? 'btn--primary' : 'btn--secondary'}"
          onclick="window.game.toggleSetting('forceWildcards')">
          ${forceWildcards ? 'On' : 'Off'}
        </button>
      </div>
      <div class="lobby__stepper-row ${forceWildcards ? 'lobby__stepper-row--disabled' : ''}">
        <span class="lobby__stepper-label">Wildcards in Deck</span>
        <button class="btn btn--secondary lobby__stepper-btn"
          onclick="window.game.updateSetting('wildcardCount', ${wildcardCount - 1})"
          ${wildcardCount <= 0 || forceWildcards ? 'disabled' : ''}>&minus;</button>
        <span class="lobby__stepper-value">${wildcardCount}</span>
        <button class="btn btn--secondary lobby__stepper-btn"
          onclick="window.game.updateSetting('wildcardCount', ${wildcardCount + 1})"
          ${wildcardCount >= 10 || forceWildcards ? 'disabled' : ''}>+</button>
      </div>
    </div>
  ` : '';

  return `
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
      <div class="lobby__advanced-divider"></div>
      <p class="lobby__advanced-section-label">Phases</p>
      <div class="lobby__stepper-row lobby__stepper-row--disabled">
        <span class="lobby__stepper-label">DIE</span>
        <button class="btn lobby__stepper-btn btn--primary" disabled>On</button>
      </div>
      <div class="lobby__stepper-row">
        <span class="lobby__stepper-label">LIVE</span>
        <button class="btn lobby__stepper-btn ${enableLive ? 'btn--primary' : 'btn--secondary'}"
          onclick="window.game.toggleSetting('enableLive')">
          ${enableLive ? 'On' : 'Off'}
        </button>
      </div>
      <div class="lobby__stepper-row">
        <span class="lobby__stepper-label">BYE</span>
        <button class="btn lobby__stepper-btn ${enableBye ? 'btn--primary' : 'btn--secondary'}"
          onclick="window.game.toggleSetting('enableBye')">
          ${enableBye ? 'On' : 'Off'}
        </button>
      </div>
      <div class="lobby__stepper-row">
        <span class="lobby__stepper-label">EULOGY</span>
        <button class="btn lobby__stepper-btn ${enableEulogy ? 'btn--primary' : 'btn--secondary'}"
          onclick="window.game.toggleSetting('enableEulogy')">
          ${enableEulogy ? 'On' : 'Off'}
        </button>
      </div>
      ${wildcardSubSettings}
      <div class="lobby__advanced-divider"></div>
      <div class="lobby__select-row">
        <span class="lobby__stepper-label">Hand Redraws</span>
        <div class="lobby__segmented">
          ${REDRAW_OPTIONS.map(opt => `
            <button
              class="btn lobby__seg-btn ${handRedraws === opt.value ? 'btn--primary' : 'btn--secondary'}"
              onclick="window.game.setHandRedraws('${opt.value}')"
            >${opt.label}</button>
          `).join('')}
        </div>
      </div>
      <div class="lobby__stepper-row">
        <span class="lobby__stepper-label">Cards in Hand</span>
        <button class="btn btn--secondary lobby__stepper-btn"
          onclick="window.game.updateSetting('handSize', ${handSize - 1})"
          ${handSize <= 1 ? 'disabled' : ''}>&minus;</button>
        <span class="lobby__stepper-value">${handSize}</span>
        <button class="btn btn--secondary lobby__stepper-btn"
          onclick="window.game.updateSetting('handSize', ${handSize + 1})"
          ${handSize >= maxHandSize ? 'disabled' : ''}>+</button>
      </div>
      <p class="lobby__setting-meta">Max ${maxHandSize} cards with ${playerCount} players</p>
      <div class="lobby__stepper-row">
        <span class="lobby__stepper-label">Pitch Timer</span>
        <button class="btn lobby__stepper-btn ${timerEnabled ? 'btn--primary' : 'btn--secondary'}"
          onclick="window.game.toggleSetting('timerEnabled')">
          ${timerEnabled ? 'On' : 'Off'}
        </button>
      </div>
      ${timerEnabled ? `
      <div class="lobby__advanced-subsection">
        <div class="lobby__stepper-row">
          <span class="lobby__stepper-label">Count Up</span>
          <button class="btn lobby__stepper-btn ${timerCountUp ? 'btn--primary' : 'btn--secondary'}"
            onclick="window.game.toggleSetting('timerCountUp')">
            ${timerCountUp ? 'On' : 'Off'}
          </button>
        </div>
        <div class="lobby__stepper-row${timerCountUp ? ' lobby__stepper-row--disabled' : ''}">
          <span class="lobby__stepper-label">Duration</span>
          <button class="btn btn--secondary lobby__stepper-btn"
            onclick="window.game.cyclePitchDuration(-1)"
            ${timerCountUp || PITCH_DURATIONS.indexOf(pitchDuration) <= 0 ? 'disabled' : ''}>&minus;</button>
          <span class="lobby__stepper-value lobby__stepper-value--wide">${formatPitchDuration(pitchDuration)}</span>
          <button class="btn btn--secondary lobby__stepper-btn"
            onclick="window.game.cyclePitchDuration(1)"
            ${timerCountUp || PITCH_DURATIONS.indexOf(pitchDuration) >= PITCH_DURATIONS.length - 1 ? 'disabled' : ''}>+</button>
        </div>
        <div class="lobby__stepper-row${timerCountUp ? ' lobby__stepper-row--disabled' : ''}">
          <span class="lobby__stepper-label">Show Timer</span>
          <button class="btn lobby__stepper-btn ${timerCountUp ? 'btn--primary' : timerVisible ? 'btn--primary' : 'btn--secondary'}"
            onclick="window.game.toggleSetting('timerVisible')"
            ${timerCountUp ? 'disabled' : ''}>
            ${timerCountUp ? 'On' : timerVisible ? 'On' : 'Off'}
          </button>
        </div>
        <div class="lobby__stepper-row${timerCountUp ? ' lobby__stepper-row--disabled' : ''}">
          <span class="lobby__stepper-label">Auto-advance</span>
          <button class="btn lobby__stepper-btn ${!timerCountUp && timerAutoAdvance ? 'btn--primary' : 'btn--secondary'}"
            onclick="window.game.toggleSetting('timerAutoAdvance')"
            ${timerCountUp ? 'disabled' : ''}>
            ${timerCountUp ? 'Off' : timerAutoAdvance ? 'On' : 'Off'}
          </button>
        </div>
      </div>
      ` : ''}
      <div class="lobby__advanced-divider"></div>
      <button class="btn btn--secondary lobby__reset-btn" onclick="window.game.resetSettings()">
        Default Settings
      </button>
    </div>
  `;
}

export function render(state) {
  const { rounds } = state.gameSettings;

  const months = [
    'Jan','Feb','Mar','Apr','May','Jun',
    'Jul','Aug','Sep','Oct','Nov','Dec',
  ];
  const monthOptions = months.map((m, i) =>
    `<option value="${i + 1}">${m}</option>`
  ).join('');
  const dayOptions = Array.from({ length: 31 }, (_, i) =>
    `<option value="${i + 1}">${i + 1}</option>`
  ).join('');

  const boardContent = `
    <div class="lobby__board-content">
    <div class="lobby__setup">
      <h2 class="lobby__heading">Add Player</h2>
      <div class="lobby__add-player">
        <input
          type="text"
          id="player-name-input"
          placeholder="Enter player name"
          class="input"
          maxlength="24"
        >
      </div>
      <div class="lobby__birthday-row">
        <select id="player-birth-month" class="input lobby__birthday-select">
          <option value="">Birth Month</option>
          ${monthOptions}
        </select>
        <select id="player-birth-day" class="input lobby__birthday-select">
          <option value="">Birth Day</option>
          ${dayOptions}
        </select>
        <button class="btn btn--secondary lobby__add-btn" onclick="window.game.addPlayer()">
          Add
        </button>
      </div>
    </div>
    <div class="lobby__settings-section">
      <div class="lobby__settings-divider"></div>
      <h2 class="lobby__heading">Game Settings</h2>
      <div id="lobby-mode-toggle" class="lobby__mode-toggle">
        <button
          class="btn lobby__mode-btn ${rounds === 1 ? 'btn--primary' : 'btn--secondary'}"
          onclick="window.game.setGameMode('quick')"
        >Quick</button>
        <button
          class="btn lobby__mode-btn ${rounds !== 1 ? 'btn--primary' : 'btn--secondary'}"
          onclick="window.game.setGameMode('normal')"
        >Normal</button>
      </div>
      <div id="lobby-advanced" class="lobby__advanced">
        <button
          class="btn btn--secondary lobby__advanced-toggle"
          onclick="window.game.toggleAdvancedSettings()"
        >
          Advanced Settings ${state.showAdvancedSettings ? '▲' : '▼'}
        </button>
        <div id="advanced-settings-panel">${renderAdvancedPanel(state)}</div>
      </div>
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
