// CarkedIt Online — Join Game Screen
'use strict';

import { render as renderGameboard } from '../components/gameboard.js';
import { render as renderPhaseHeader } from '../components/phase-header.js';
import { renderCalendarActions } from '../components/calendar-actions.js';
import { renderOverlay as renderHowToPlayOverlay } from '../components/how-to-play-overlay.js';
import { renderVideoCallLink } from '../components/video-call-link.js';
import { renderCountdown } from '../components/countdown.js';
import { formatStartTime, hasStarted } from '../utils/schedule-format.js';
import { buildJoinQrBanner, shouldNudgeToPhone } from '../components/join-qr.js';
import { isMobileDevice } from '../utils/device.js';
import { buildJoinUrl } from '../managers/scheduled-games.js';
import { appendJoinDetails } from '../utils/join-details.js';

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
        ${renderVideoCallLink(state)}
      </div>
    `;
  }

  return `
    <div class="schedule__banner">
      ${titleHtml}
      <span class="schedule__banner-when">${escapeHtml(formatStartTime(info.scheduledAt))}</span>
      ${renderCountdown(info.scheduledAt)}
      ${renderCalendarActions()}
      ${renderVideoCallLink(state)}
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

  // Details scanned in from a desktop QR win over the signed-in profile — they
  // are what this player just typed, on purpose, for this game.
  const prefillName = state.joinPrefill?.name || state.authUser?.display_name || '';
  const prefillBM = state.joinPrefill?.birthMonth || state.authUser?.birth_month || 0;
  const prefillBD = state.joinPrefill?.birthDay || state.authUser?.birth_day || 0;

  // Someone who followed a share link on a laptop is on the wrong device for a
  // game with a private hand. Make the phone the default: hide the Join button
  // and offer the QR underneath, with an explicit way back to joining here.
  const nudgeArgs = {
    roomCode: state.roomCode,
    isDesktop: !isMobileDevice(),
    viaShareLink: !!state.arrivedViaJoinLink,
  };
  const nudging = shouldNudgeToPhone(nudgeArgs);
  // The QR carries Your Details across so the phone arrives pre-filled. These
  // fields are typed after this render, so window.game.refreshJoinQr() re-encodes
  // it live as they go — this only seeds the initial code.
  const joinQrHtml = buildJoinQrBanner({
    ...nudgeArgs,
    joinUrl: state.roomCode
      ? appendJoinDetails(buildJoinUrl(state.roomCode), {
          name: prefillName,
          birthMonth: prefillBM,
          birthDay: prefillBD,
        })
      : '',
    revealed: !!state.desktopJoinRevealed,
  });

  // Rendered either way, hidden by class — revealDesktopJoin() un-hides it in
  // place rather than re-rendering, which would discard anything already typed.
  const joinBtnHidden = nudging && !state.desktopJoinRevealed;

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
        oninput="window.game.refreshJoinQr()"
        ${connecting ? 'disabled' : ''}
      >
      <div class="online-lobby__birthday-row">
        <select id="online-birth-month" class="input online-lobby__birthday-select"
                onchange="window.game.refreshJoinQr()" ${connecting ? 'disabled' : ''}>
          <option value="">Birth Month</option>
          ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
            .map((m, i) => `<option value="${i + 1}"${prefillBM === i + 1 ? ' selected' : ''}>${m}</option>`).join('')}
        </select>
        <select id="online-birth-day" class="input online-lobby__birthday-select"
                onchange="window.game.refreshJoinQr()" ${connecting ? 'disabled' : ''}>
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
          class="btn btn--primary online-lobby__join-btn${joinBtnHidden ? ' online-lobby__join-btn--hidden' : ''}"
          onclick="window.game.joinRoom(event)"
          ${connecting ? 'disabled' : ''}
        >
          ${connecting ? 'Joining...' : 'Join'}
        </button>
      </div>

      ${errorHtml}
      ${joinQrHtml}
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
      ${state.showHowToPlay ? renderHowToPlayOverlay(state) : ''}
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
