// CarkedIt Online — Online Lobby Screen
'use strict';

import { render as renderPhaseHeader } from '../components/phase-header.js';
import { render as renderGameboard } from '../components/gameboard.js';

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

  const boardContent = `
    <div class="online-lobby__forms">
      <h2 class="online-lobby__heading">Your Details</h2>
      <input
        type="text"
        id="online-player-name"
        placeholder="Your name"
        class="input"
        maxlength="24"
        ${connecting ? 'disabled' : ''}
      >
      <div class="online-lobby__birthday-row">
        <select id="online-birth-month" class="input online-lobby__birthday-select" ${connecting ? 'disabled' : ''}>
          <option value="">Birth Month</option>
          ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
            .map((m, i) => `<option value="${i + 1}">${m}</option>`).join('')}
        </select>
        <select id="online-birth-day" class="input online-lobby__birthday-select" ${connecting ? 'disabled' : ''}>
          <option value="">Birth Day</option>
          ${Array.from({ length: 31 }, (_, i) =>
            `<option value="${i + 1}">${i + 1}</option>`).join('')}
        </select>
      </div>

      <div class="online-lobby__divider"></div>

      <h2 class="online-lobby__heading">Create a Room</h2>
      <button
        class="btn btn--primary online-lobby__action-btn"
        onclick="window.game.createRoom()"
        ${connecting ? 'disabled' : ''}
      >
        ${connecting ? 'Creating...' : 'Create Private Room'}
      </button>

      <div class="online-lobby__divider"></div>

      <h2 class="online-lobby__heading">Join a Room</h2>
      <div class="online-lobby__join-row">
        <input
          type="text"
          id="online-room-code"
          placeholder="Room code"
          class="input online-lobby__code-input"
          maxlength="5"
          ${connecting ? 'disabled' : ''}
        >
        <button
          class="btn btn--primary"
          onclick="window.game.joinRoom()"
          ${connecting ? 'disabled' : ''}
        >
          ${connecting ? 'Joining...' : 'Join'}
        </button>
      </div>

      ${errorHtml}
    </div>
  `;

  return `
    <div class="screen screen--online-lobby">
      ${renderPhaseHeader({ phase: '', label: 'Online' })}
      ${renderGameboard(boardContent)}
      <div class="online-lobby__actions">
        <button class="btn btn--secondary" onclick="window.game.showScreen('mode-select')">
          &larr; Back
        </button>
      </div>
    </div>
  `;
}

function renderConnectedLobby(state) {
  const { roomCode, isHost, onlinePlayers } = state;

  const playerListHtml = onlinePlayers.length === 0
    ? '<p class="online-lobby__empty">No players yet...</p>'
    : onlinePlayers.map(p => `
        <div class="online-lobby__player ${p.connected ? '' : 'online-lobby__player--disconnected'}">
          <span class="online-lobby__player-name">${escapeHtml(p.name)}</span>
          <span class="online-lobby__player-status">
            ${p.ready ? 'Ready' : p.connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      `).join('');

  const codeDisplay = roomCode
    ? `<div class="online-lobby__room-code">
        <span class="online-lobby__code-label">Room Code</span>
        <span class="online-lobby__code-value">${escapeHtml(roomCode)}</span>
       </div>`
    : '';

  const hostControls = isHost
    ? `<button
        class="btn btn--primary online-lobby__start-btn"
        onclick="window.game.startOnlineGame()"
        ${onlinePlayers.length < 2 ? 'disabled' : ''}
      >
        Start Game (${onlinePlayers.length} players)
      </button>`
    : '<p class="online-lobby__waiting">Waiting for host to start the game...</p>';

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
    </div>
  `;

  return `
    <div class="screen screen--online-lobby">
      ${renderPhaseHeader({ phase: '', label: 'Online Lobby' })}
      ${renderGameboard(boardContent)}
      <div class="online-lobby__actions">
        <button class="btn btn--secondary" onclick="window.game.leaveRoom()">
          Leave Room
        </button>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
