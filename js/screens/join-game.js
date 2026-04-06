// CarkedIt Online — Join Game Screen
'use strict';

import { render as renderGameboard } from '../components/gameboard.js';
import { render as renderPhaseHeader } from '../components/phase-header.js';

/**
 * @param {object} state
 * @returns {string} HTML string
 */
export function render(state) {
  const { connectionStatus, onlineError } = state;
  const connecting = connectionStatus === 'connecting';
  const errorHtml = onlineError
    ? `<p class="online-lobby__error">${escapeHtml(onlineError)}</p>`
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
        <select id="online-birth-month" class="input online-lobby__birthday-select" ${connecting ? 'disabled' : ''}>
          <option value="">Birth Month</option>
          ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
            .map((m, i) => `<option value="${i + 1}"${prefillBM === i + 1 ? ' selected' : ''}>${m}</option>`).join('')}
        </select>
        <select id="online-birth-day" class="input online-lobby__birthday-select" ${connecting ? 'disabled' : ''}>
          <option value="">Birth Day</option>
          ${Array.from({ length: 31 }, (_, i) =>
            `<option value="${i + 1}"${prefillBD === i + 1 ? ' selected' : ''}>${i + 1}</option>`).join('')}
        </select>
      </div>

      <div class="online-lobby__divider"></div>

      <h2 class="online-lobby__heading">Join a Room</h2>
      <div class="online-lobby__join-row">
        <input
          type="text"
          id="online-room-code"
          placeholder="Room code"
          class="input online-lobby__code-input"
          maxlength="5"
          value="${escapeHtml(state.roomCode || '')}"
          ${connecting ? 'disabled' : ''}
        >
        <button
          class="btn btn--primary"
          onclick="window.game.joinRoom(event)"
          ${connecting ? 'disabled' : ''}
        >
          ${connecting ? 'Joining...' : 'Join'}
        </button>
      </div>

      ${errorHtml}
    </div>
  `;

  const headerHtml = renderPhaseHeader({ phase: 'join', label: 'Join Game' });

  return `
    <div class="screen screen--online-lobby">
      ${headerHtml}
      ${renderGameboard(boardContent)}
      <div class="online-lobby__actions">
        <button class="btn btn--secondary" onclick="window.game.showScreen('menu')">
          &larr; Back
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
