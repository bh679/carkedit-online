// CarkedIt Online — "Your game is scheduled" confirmation.
//
// The point of this screen is the link. A scheduled game is useless until the
// host has sent it to someone, so copying and calendaring come first and
// everything else is secondary.
'use strict';

import { render as renderGameboard } from '../components/gameboard.js';
import { render as renderPhaseHeader } from '../components/phase-header.js';
import { renderCalendarActions } from '../components/calendar-actions.js';
import { renderVideoCallLink } from '../components/video-call-link.js';
import { renderCountdown } from '../components/countdown.js';
import { formatStartTime } from '../utils/schedule-format.js';
import { escapeHtml } from '../utils/escape.js';

export function render(state) {
  const game = state.scheduledGame;
  if (!game) {
    return `
      <div class="screen screen--online-lobby">
        ${renderPhaseHeader({ phase: 'join', label: 'Scheduled' })}
        ${renderGameboard('<p class="online-lobby__empty">No scheduled game to show.</p>')}
        <div class="online-lobby__actions">
          <button class="btn mode-select__back-btn" onclick="window.game.showScreen('menu')">&larr; Back</button>
        </div>
      </div>
    `;
  }

  const titleHtml = game.title
    ? `<p class="schedule__created-title">${escapeHtml(game.title)}</p>`
    : '';

  const boardContent = `
    <div class="online-lobby__forms">
      <h2 class="online-lobby__heading">Game Scheduled</h2>
      ${titleHtml}
      <p class="schedule__created-when">${escapeHtml(formatStartTime(game.scheduledAt))}</p>
      <p class="schedule__created-countdown">${renderCountdown(game.scheduledAt)}</p>

      <div class="online-lobby__room-code" onclick="window.game.copyScheduledLink()" style="cursor:pointer" title="Click to copy join link">
        <span class="online-lobby__code-label">Room Code</span>
        <span class="online-lobby__code-value">${escapeHtml(game.code)}</span>
        <span class="online-lobby__code-hint">Click to copy the invite link</span>
      </div>

      <p class="online-lobby__field-note">
        Send this link to your players. Opening it early shows them a countdown
        and how the game works — the link stops working 24 hours after the start
        time, or once the game has been played.
      </p>

      ${renderCalendarActions()}
      ${renderVideoCallLink(state)}

      <div class="online-lobby__divider"></div>

      <button class="btn btn--secondary online-lobby__action-btn" onclick="window.game.openScheduledGames()">
        My Scheduled Games
      </button>
    </div>
  `;

  return `
    <div class="screen screen--online-lobby">
      ${renderPhaseHeader({ phase: 'join', label: 'Scheduled' })}
      ${renderGameboard(boardContent)}
      <div class="online-lobby__actions">
        <button class="btn mode-select__back-btn" onclick="window.game.showScreen('menu')">&larr; Back to Menu</button>
      </div>
    </div>
  `;
}
