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

/**
 * Renders a toggle row: label + On/Off button.
 *
 * @param {string} label - Display label (may include HTML like hints)
 * @param {boolean} value - Current on/off state
 * @param {string} onClick - onclick expression
 * @param {boolean} [disabled=false] - Whether the row is disabled
 * @param {boolean} [overrideDisplay] - Force a specific display value (for dependent toggles)
 */
function renderToggle(label, value, onClick, { disabled = false, overrideDisplay } = {}) {
  const displayOn = overrideDisplay !== undefined ? overrideDisplay : value;
  const rowClass = disabled ? 'lobby__stepper-row lobby__stepper-row--disabled' : 'lobby__stepper-row';
  return `
    <div class="${rowClass}">
      <span class="lobby__stepper-label">${label}</span>
      <button class="btn lobby__stepper-btn ${displayOn ? 'btn--primary' : 'btn--secondary'}"
        onclick="${onClick}"
        ${disabled ? 'disabled' : ''}>
        ${displayOn ? 'On' : 'Off'}
      </button>
    </div>
  `;
}

/**
 * Renders a stepper row: label + −/value/+ buttons.
 *
 * @param {string} label - Display label
 * @param {number|string} value - Current value
 * @param {string} onDec - onclick for decrement
 * @param {string} onInc - onclick for increment
 * @param {boolean} decDisabled - Whether − is disabled
 * @param {boolean} incDisabled - Whether + is disabled
 * @param {object} [options]
 * @param {boolean} [options.disabled=false] - Disable entire row
 * @param {string} [options.valueClass=''] - Extra CSS class for value span
 */
function renderStepper(label, value, onDec, onInc, decDisabled, incDisabled, { disabled = false, valueClass = '' } = {}) {
  const rowClass = disabled ? 'lobby__stepper-row lobby__stepper-row--disabled' : 'lobby__stepper-row';
  const valClass = `lobby__stepper-value${valueClass ? ` ${valueClass}` : ''}`;
  return `
    <div class="${rowClass}">
      <span class="lobby__stepper-label">${label}</span>
      <button class="btn btn--secondary lobby__stepper-btn"
        onclick="${onDec}"
        ${decDisabled || disabled ? 'disabled' : ''}>&minus;</button>
      <span class="${valClass}">${value}</span>
      <button class="btn btn--secondary lobby__stepper-btn"
        onclick="${onInc}"
        ${incDisabled || disabled ? 'disabled' : ''}>+</button>
    </div>
  `;
}

export function renderAdvancedPanel(state) {
  if (!state.showAdvancedSettings) return '';
  const { rounds, handSize, enableLive, enableBye, enableEulogy, forceWildcards, playableWildcards = true, wildcardCount, eulogistCount, handRedraws = 'once_per_phase', timerEnabled, pitchTimerEnabled, playCardTimerEnabled, timerCountUp, pitchDuration, timerVisible, timerAutoAdvance, ultraQuickMode, optionalCardPlay } = state.gameSettings;
  const playerCount = Math.max(state.players.length, 2);
  const maxHandSize = Math.max(1, Math.floor(68 / playerCount));
  const estimate = timeEstimate(playerCount, rounds);
  const prompt = ROUND_PROMPTS[rounds] ?? ROUND_PROMPTS[10];

  const maxEulogists = Math.max(1, state.players.length - 1);
  const effectiveEulogistCount = Math.min(eulogistCount, maxEulogists);

  const wildcardSubSettings = enableEulogy ? `
    <div class="lobby__advanced-subsection">
      ${renderToggle(
        'Force Wildcards <span class="lobby__stepper-hint">(everyone gets one)</span>',
        forceWildcards,
        "window.game.toggleSetting('forceWildcards')",
      )}
      ${renderStepper(
        'Wildcards in Deck', wildcardCount,
        `window.game.updateSetting('wildcardCount', ${wildcardCount - 1})`,
        `window.game.updateSetting('wildcardCount', ${wildcardCount + 1})`,
        wildcardCount <= 0, wildcardCount >= 10,
        { disabled: forceWildcards },
      )}
      ${renderStepper(
        'Eulogists per Round', effectiveEulogistCount,
        `window.game.updateSetting('eulogistCount', ${effectiveEulogistCount - 1})`,
        `window.game.updateSetting('eulogistCount', ${effectiveEulogistCount + 1})`,
        effectiveEulogistCount <= 1, effectiveEulogistCount >= maxEulogists,
      )}
      ${renderToggle(
        'Playable Wildcards <span class="lobby__stepper-hint">(can be pitched in Phase 3)</span>',
        playableWildcards,
        "window.game.toggleSetting('playableWildcards')",
      )}
    </div>
  ` : '';

  const timerSubSettings = timerEnabled ? `
    <div class="lobby__advanced-subsection">
      ${renderToggle('Pitch Timer', pitchTimerEnabled, "window.game.toggleSetting('pitchTimerEnabled')")}
      ${renderToggle('Play Card Timer', playCardTimerEnabled, "window.game.toggleSetting('playCardTimerEnabled')")}
      ${renderToggle('Count Up', timerCountUp, "window.game.toggleSetting('timerCountUp')")}
      ${renderStepper(
        'Duration', formatPitchDuration(pitchDuration),
        "window.game.cyclePitchDuration(-1)",
        "window.game.cyclePitchDuration(1)",
        PITCH_DURATIONS.indexOf(pitchDuration) <= 0,
        PITCH_DURATIONS.indexOf(pitchDuration) >= PITCH_DURATIONS.length - 1,
        { disabled: timerCountUp, valueClass: 'lobby__stepper-value--wide' },
      )}
      ${renderToggle('Show Timer', timerVisible, "window.game.toggleSetting('timerVisible')", { disabled: timerCountUp, overrideDisplay: timerCountUp || timerVisible })}
      ${renderToggle('Auto-advance', timerAutoAdvance, "window.game.toggleSetting('timerAutoAdvance')", { disabled: timerCountUp, overrideDisplay: !timerCountUp && timerAutoAdvance })}
    </div>
  ` : '';

  return `
    <div class="lobby__advanced-panel">
      ${renderToggle(
        'Ultra Quick Mode <span class="lobby__stepper-hint">(half players per phase, good for 8+ players)</span>',
        ultraQuickMode,
        "window.game.toggleUltraQuickMode()",
      )}
      <div class="lobby__advanced-divider"></div>
      ${renderStepper(
        'Rounds', rounds,
        `window.game.updateSetting('rounds', ${rounds - 1})`,
        `window.game.updateSetting('rounds', ${rounds + 1})`,
        rounds <= 1, rounds >= 10,
        { disabled: ultraQuickMode },
      )}
      <p class="lobby__setting-meta">${estimate} &mdash; ${prompt}</p>
      <div class="lobby__advanced-divider"></div>
      <p class="lobby__advanced-section-label">Phases</p>
      ${renderToggle('DIE', true, '', { disabled: true })}
      ${renderToggle('LIVE', enableLive, "window.game.toggleSetting('enableLive')", { disabled: ultraQuickMode })}
      ${renderToggle('BYE', enableBye, "window.game.toggleSetting('enableBye')", { disabled: ultraQuickMode })}
      ${renderToggle('EULOGY', enableEulogy, "window.game.toggleSetting('enableEulogy')")}
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
      ${renderStepper(
        'Cards in Hand', handSize,
        `window.game.updateSetting('handSize', ${handSize - 1})`,
        `window.game.updateSetting('handSize', ${handSize + 1})`,
        handSize <= 1, handSize >= maxHandSize,
      )}
      <p class="lobby__setting-meta">Max ${maxHandSize} cards with ${playerCount} players</p>
      ${renderToggle(
        `Optional Card Play <span class="lobby__stepper-hint">${playerCount <= 3 ? '(needs 4+ players)' : '(players may pass instead of playing a card)'}</span>`,
        optionalCardPlay,
        "window.game.toggleSetting('optionalCardPlay')",
        { disabled: playerCount <= 3 },
      )}
      ${renderToggle('Timer', timerEnabled, "window.game.toggleSetting('timerEnabled')")}
      ${timerSubSettings}
      <div class="lobby__advanced-divider"></div>
      <button class="btn btn--secondary lobby__reset-btn" onclick="window.game.resetSettings()">
        Default Settings
      </button>
    </div>
  `;
}

export function render(state) {
  const { rounds, ultraQuickMode, optionalCardPlay } = state.gameSettings;

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
      <h2 class="lobby__heading">Game Modes</h2>
      ${(() => {
        const pc = state.players.length;
        const isQuick     = !ultraQuickMode && rounds === 1 && !optionalCardPlay;
        const isNormal    = !ultraQuickMode && rounds !== 1 && !optionalCardPlay;
        const isBigGroup  = !ultraQuickMode && rounds === 1 &&  optionalCardPlay;
        const isHugeGroup =  ultraQuickMode &&                  optionalCardPlay;
        return `
          <div id="lobby-mode-toggle" class="lobby__mode-toggle">
            <button class="btn lobby__mode-btn ${isQuick ? 'btn--primary' : 'btn--secondary'}"
              onclick="window.game.setGameMode('quick')">Quick</button>
            <button class="btn lobby__mode-btn ${isNormal ? 'btn--primary' : 'btn--secondary'}"
              onclick="window.game.setGameMode('normal')">Normal</button>
            ${pc > 6 ? `<button class="btn lobby__mode-btn ${isBigGroup ? 'btn--primary' : 'btn--secondary'}"
              onclick="window.game.setGameMode('big-group')">Big Group</button>` : ''}
            ${pc > 9 ? `<button class="btn lobby__mode-btn ${isHugeGroup ? 'btn--primary' : 'btn--secondary'}"
              onclick="window.game.setGameMode('huge-group')">Huge Group</button>` : ''}
          </div>
        `;
      })()}
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
