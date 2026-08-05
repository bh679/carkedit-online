// CarkedIt Online — Join Game Screen
'use strict';

import { render as renderGameboard } from '../components/gameboard.js';
import { render as renderPhaseHeader } from '../components/phase-header.js';
import { renderCalendarActions } from '../components/calendar-actions.js';
import { formatStartTime, formatCountdown, msUntil, hasStarted } from '../utils/schedule-format.js';

const UNAVAILABLE_MESSAGES = {
  ended: 'This game has already been played.',
  cancelled: 'The host cancelled this game.',
  expired: 'This game link has expired.',
};

/**
 * A scheduled link is usually opened long before the game — often by someone
 * who can't play right now. So the countdown, the calendar buttons and the
 * rules are offered BEFORE the join form, and are useful without joining.
 */
function renderScheduleBanner(state) {
  const info = state.scheduledInfo;
  if (!info) return '';

  const unavailable = UNAVAILABLE_MESSAGES[info.status];
  if (unavailable) {
    return `<div class="schedule__banner schedule__banner--closed">
        <span class="schedule__banner-label">${escapeHtml(unavailable)}</span>
      </div>`;
  }

  const titleHtml = info.title
    ? `<span class="schedule__banner-title">${escapeHtml(info.title)}</span>`
    : '';

  if (hasStarted(info.scheduledAt)) {
    return `
      <div class="schedule__banner">
        ${titleHtml}
        <span class="schedule__banner-label">Starting now — join in</span>
      </div>
    `;
  }

  return `
    <div class="schedule__banner">
      ${titleHtml}
      <span class="schedule__banner-label">Starts in</span>
      <span class="online-lobby__countdown-value schedule__banner-countdown">${formatCountdown(msUntil(info.scheduledAt))}</span>
      <span class="schedule__banner-when">${escapeHtml(formatStartTime(info.scheduledAt))}</span>
      ${renderCalendarActions()}
      <button class="btn btn--ghost schedule__how-btn" onclick="window.game.openHowToPlay()">
        How to play
      </button>
      <p class="online-lobby__field-note">
        You can join now and wait in the lobby — the host may start early.
      </p>
    </div>
  `;
}

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
      <div id="join-schedule-banner">${renderScheduleBanner(state)}</div>
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
        <button class="btn mode-select__back-btn" onclick="window.game.showScreen('menu')">
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
