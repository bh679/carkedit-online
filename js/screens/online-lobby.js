// CarkedIt Online — Online Lobby Screen
'use strict';

import { render as renderPhaseHeader } from '../components/phase-header.js';
import { render as renderGameboard } from '../components/gameboard.js';
import { PERSON_ICON, STAR_ICON, formatBirthday } from '../components/player-list.js';
import { renderAdvancedPanel, renderToggle } from './lobby.js';
import { render as renderPackSelector } from '../components/pack-selector.js';

const LINK_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M6.5 9.5L9.5 6.5" stroke="#374151" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M9 10L10.5 8.5C11.9 7.1 11.9 4.9 10.5 3.5C9.1 2.1 6.9 2.1 5.5 3.5L4 5" stroke="#374151" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M7 6L5.5 7.5C4.1 8.9 4.1 11.1 5.5 12.5C6.9 13.9 9.1 13.9 10.5 12.5L12 11" stroke="#374151" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;

/**
 * @param {object} state
 * @returns {string} HTML string
 */
export function render(state) {
  const { connectionStatus, roomCode, isHost, onlinePlayers, onlineError } = state;
  const connected = connectionStatus === 'connected';
  const connecting = connectionStatus === 'connecting';

  if (connected) {
    return renderConnectedLobby(state);
  }

  return renderJoinCreate(state, connecting, onlineError);
}

function renderJoinCreate(state, connecting, error) {
  const errorHtml = error
    ? `<p class="online-lobby__error">${escapeHtml(error)}</p>`
    : '';

  const prefillName = state.authUser?.display_name || '';
  const prefillBM = state.authUser?.birth_month || 0;
  const prefillBD = state.authUser?.birth_day || 0;

  const boardContent = `
    <div class="online-lobby__forms">
      <h2 class="online-lobby__heading">Your Details</h2>
      <input
        type="text"
        id="online-player-name"
        placeholder="Your name"
        class="input"
        maxlength="24"
        value="${escapeHtml(prefillName)}"
        ${connecting ? 'disabled' : ''}
      >
      <div class="online-lobby__birthday-row">
        <select id="online-birth-day" class="input online-lobby__birthday-select" ${connecting ? 'disabled' : ''}>
          <option value="">Birth Day</option>
          ${Array.from({ length: 31 }, (_, i) =>
            `<option value="${i + 1}"${prefillBD === i + 1 ? ' selected' : ''}>${i + 1}</option>`).join('')}
        </select>
        <select id="online-birth-month" class="input online-lobby__birthday-select" ${connecting ? 'disabled' : ''}>
          <option value="">Birth Month</option>
          ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
            .map((m, i) => `<option value="${i + 1}"${prefillBM === i + 1 ? ' selected' : ''}>${m}</option>`).join('')}
        </select>
      </div>

      <div class="online-lobby__divider"></div>

      <h2 class="online-lobby__heading">Create a Room</h2>
      <button
        class="btn btn--primary online-lobby__action-btn"
        onclick="window.game.createRoom(event)"
        ${connecting ? 'disabled' : ''}
      >
        ${connecting ? 'Creating...' : 'Create Private Room'}
      </button>

      ${errorHtml}
    </div>
  `;

  const headerHtml = renderPhaseHeader({ phase: 'online', label: 'Online' });

  return `
    <div class="screen screen--online-lobby">
      ${headerHtml}
      ${renderGameboard(boardContent)}
      <div class="online-lobby__actions">
        <button class="btn mode-select__back-btn" onclick="window.game.showScreen('mode-select')">
          &larr; Back
        </button>
      </div>
    </div>
  `;
}

function renderConnectedLobby(state) {
  const { roomCode, isHost, onlinePlayers, onlineSettings } = state;
  const allReady = onlinePlayers.length > 0 && onlinePlayers.every(p => p.ready);

  const playerListHtml = onlinePlayers.length === 0
    ? '<p class="online-lobby__empty">No players yet...</p>'
    : onlinePlayers.map((p, i) => {
        const isFD = i === 0;
        const isSelf = p.sessionId === state.mySessionId;
        const icon = isFD ? STAR_ICON : PERSON_ICON;
        const birthday = formatBirthday(p);
        const modifiers = [
          isFD ? ' player-list__chip--director' : '',
          isSelf ? ' player-list__chip--self' : '',
          !p.connected ? ' player-list__chip--disconnected' : '',
        ].join('');
        const status = isFD
          ? (p.ready ? 'Ready to Die' : 'Funeral Director')
          : p.ready ? 'Ready to Die' : p.connected ? 'Connected' : 'Disconnected';
        return `
          <div class="player-list__chip${modifiers}">
            <span class="player-list__icon">${icon}</span>
            <span class="player-list__name">${escapeHtml(p.name)}</span>
            ${birthday
              ? `<span class="player-list__birthday">${birthday}</span>`
              : ''}
            <span class="player-list__status">${status}</span>
          </div>
        `;
      }).join('');

  const codeDisplay = roomCode
    ? `<div class="online-lobby__room-code" onclick="window.game.copyJoinLink()" style="cursor:pointer" title="Click to copy join link">
        <span class="online-lobby__code-label">Room Code</span>
        <span class="online-lobby__code-value">${escapeHtml(roomCode)}</span>
       </div>`
    : '';

  const settingsHtml = isHost
    ? (() => {
        const { rounds, ultraQuickMode, optionalCardPlay } = state.gameSettings;
        const pc = onlinePlayers.length;
        const isQuick     = !ultraQuickMode && rounds === 1 && !optionalCardPlay;
        const isNormal    = !ultraQuickMode && rounds !== 1 && !optionalCardPlay;
        const isBigGroup  = !ultraQuickMode && rounds === 1 &&  optionalCardPlay;
        const isHugeGroup =  ultraQuickMode &&                  optionalCardPlay;
        return `<div class="online-lobby__settings">
          <h2 class="online-lobby__heading">Room Settings</h2>
          ${renderToggle(
            'Auto-start when ready',
            onlineSettings.autoStartOnReady,
            "window.game.toggleOnlineSetting('autoStartOnReady')",
          )}
          <div class="online-lobby__divider"></div>
          <h2 class="online-lobby__heading">Game Mode</h2>
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
          <div class="lobby__advanced">
            <button
              class="btn btn--secondary lobby__advanced-toggle"
              onclick="window.game.toggleAdvancedSettings()"
            >
              Advanced Settings ${state.showAdvancedSettings ? '▲' : '▼'}
            </button>
            <div id="advanced-settings-panel">${renderAdvancedPanel(state)}</div>
          </div>
          <div class="online-lobby__divider"></div>
          <h2 class="online-lobby__heading">Expansion Packs</h2>
          ${renderPackSelector(state, { isHost: true })}
        </div>
        <div class="online-lobby__divider"></div>`;
      })()
    : renderSettingsSummary(state);

  // Find if the local player is ready
  const myPlayer = onlinePlayers.find(p => p.sessionId === state.mySessionId);
  const amReady = myPlayer?.ready ?? false;

  const readyBtn = `
    <button
      class="btn ${amReady ? 'btn--secondary' : 'btn--primary'} online-lobby__ready-btn"
      onclick="window.game.toggleReady()"
    >
      ${amReady ? 'Not Ready' : 'Ready to Die'}
    </button>
  `;

  const hostControls = isHost
    ? `${readyBtn}
       <div class="online-lobby__divider"></div>
       <div class="online-lobby__start-container">
         <button
          class="btn btn--primary online-lobby__start-btn"
          onclick="window.game.startOnlineGame()"
          ${onlinePlayers.length < 2 ? 'disabled' : ''}
        >
          Start Game (${onlinePlayers.length} players)
        </button>
       </div>`
    : `${readyBtn}
       <p class="online-lobby__waiting">Waiting for The Funeral Director to start the game...</p>`;

  const boardContent = `
    <div class="online-lobby__connected">
      ${codeDisplay}
      <div class="online-lobby__divider"></div>
      <h2 class="online-lobby__heading">Players</h2>
      <div class="online-lobby__player-list">
        ${playerListHtml}
      </div>
      <div class="online-lobby__divider"></div>
      ${hostControls}
      ${settingsHtml}
    </div>
  `;

  const FLAG_ICON = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M3 2v12" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M3 2h8l-2 3 2 3H3" fill="#ffffff"/>
  </svg>`;

  const onlineDevMode = onlinePlayers.length > 0 && onlinePlayers.every(p => p.isDevName);
  const flagClass = `phase-header__flag-btn${onlineDevMode ? ' phase-header__flag-btn--dev' : ''}`;
  const headerHtml = `
    <header class="phase-header">
      <div class="phase-header__left">
        <span class="phase-header__app-name">CarkedIt</span>
        <span class="phase-header__phase-label">Online Lobby</span>
      </div>
      <div class="phase-header__right">
        <button class="${flagClass}" aria-label="Report issue" onclick="window.game.openIssueReport()">
          ${FLAG_ICON}
        </button>
        <button class="phase-header__settings-btn" aria-label="Copy join link" onclick="window.game.copyJoinLink()" ${roomCode ? '' : 'disabled'}>
          ${LINK_ICON}
        </button>
      </div>
    </header>
  `;

  return `
    <div class="screen screen--online-lobby">
      ${headerHtml}
      ${renderGameboard(boardContent)}
      <div class="online-lobby__actions">
        <button class="btn btn--secondary" onclick="window.game.leaveRoom()">
          Leave Room
        </button>
      </div>
    </div>
  `;
}

const REDRAW_LABELS = {
  off: 'Off', once_per_phase: 'Once / Phase',
  once_per_round: 'Once / Round', unlimited: 'Unlimited',
};

const DEFAULTS = {
  rounds: 2, handSize: 5, enableLive: true, enableBye: true, enableEulogy: true,
  forceWildcards: 'atLeastOne', playableWildcards: true, wildcardCount: 2, eulogistCount: 2,
  handRedraws: 'once_per_phase', timerEnabled: false, ultraQuickMode: false,
  optionalCardPlay: false,
};

const MODE_PRESETS = {
  Quick:        { rounds: 1, ultraQuickMode: false, optionalCardPlay: false },
  Normal:       { rounds: 2, ultraQuickMode: false, optionalCardPlay: false },
  'Big Group':  { rounds: 1, ultraQuickMode: false, optionalCardPlay: true },
  'Ultra Quick':{ rounds: 1, ultraQuickMode: true,  optionalCardPlay: false },
  'Huge Group': { rounds: 1, ultraQuickMode: true,  optionalCardPlay: true },
};

export function renderSettingsSummary(state) {
  const gs = state.gameSettings;

  // Detect named mode
  const isQuick      = !gs.ultraQuickMode && gs.rounds === 1 && !gs.optionalCardPlay;
  const isNormal     = !gs.ultraQuickMode && gs.rounds !== 1 && !gs.optionalCardPlay;
  const isBigGroup   = !gs.ultraQuickMode && gs.rounds === 1 &&  gs.optionalCardPlay;
  const isUltraQuick =  gs.ultraQuickMode &&                    !gs.optionalCardPlay;
  const isHugeGroup  =  gs.ultraQuickMode &&                     gs.optionalCardPlay;
  const modeName = isQuick ? 'Quick' : isNormal ? 'Normal'
    : isBigGroup ? 'Big Group' : isUltraQuick ? 'Ultra Quick'
    : isHugeGroup ? 'Huge Group' : null;

  // Effective defaults = global defaults + mode preset (so mode-set values are hidden)
  const d = { ...DEFAULTS, ...(modeName ? MODE_PRESETS[modeName] : {}) };

  const cards = [];

  // Show mode chip if not Normal (no label prefix, just the mode name)
  if (modeName && modeName !== 'Normal') cards.push([null, modeName]);

  // Only show settings that differ from the effective defaults
  if (gs.rounds !== d.rounds) cards.push(['Rounds', gs.rounds]);
  if (gs.handSize !== d.handSize) cards.push(['Hand', gs.handSize]);

  // Disabled phases as individual off-state chips
  if (!gs.enableLive) cards.push([null, 'LIVE', true]);
  if (!gs.enableBye) cards.push([null, 'BYE', true]);
  if (!gs.enableEulogy) cards.push([null, 'EULOGY', true]);

  // Toggles: just the name, color shows on/off
  if (gs.handRedraws !== d.handRedraws) {
    if (gs.handRedraws === 'off') {
      cards.push([null, 'Hand Redraws', true]);
    } else {
      cards.push(['Redraws', REDRAW_LABELS[gs.handRedraws] ?? gs.handRedraws]);
    }
  }
  if (gs.timerEnabled !== d.timerEnabled) cards.push([null, 'Timer', !gs.timerEnabled]);
  if (gs.optionalCardPlay !== d.optionalCardPlay) cards.push([null, 'Optional Card Play', !gs.optionalCardPlay]);
  if (gs.forceWildcards !== d.forceWildcards) {
    const wcLabel = gs.forceWildcards === 'everyone' ? 'Wildcards: Everyone'
      : gs.forceWildcards === 'off' ? 'Wildcards: Off' : 'Wildcards: At Least One';
    cards.push([null, wcLabel, gs.forceWildcards === 'off']);
  }
  if (gs.playableWildcards !== d.playableWildcards) cards.push([null, 'Playable Wildcards', !gs.playableWildcards]);
  if (gs.wildcardCount !== d.wildcardCount) cards.push(['Wildcards', gs.wildcardCount]);
  if (gs.eulogistCount !== d.eulogistCount) cards.push(['Eulogists', gs.eulogistCount]);

  const packCount = (state.selectedPackIds || []).length;
  if (packCount > 0) cards.push(['Packs', packCount]);

  if (cards.length === 0) {
    return `<div id="settings-summary-panel" class="online-lobby__settings-summary"></div>`;
  }

  return `
    <div id="settings-summary-panel" class="online-lobby__settings-summary">
      ${cards.map(([label, value, isOff]) => `<span class="btn ${isOff ? 'btn--secondary' : 'btn--primary'} online-lobby__summary-chip">${label ? `${label}: ${value}` : value}</span>`).join('')}
    </div>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
