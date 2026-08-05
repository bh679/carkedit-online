// CarkedIt Online — "My Scheduled Games".
//
// The host's control panel for games they've arranged: re-share the link,
// move the time, or call it off. Reschedule is edited inline on the row so
// the list stays the single place a host manages upcoming games.
'use strict';

import { render as renderGameboard } from '../components/gameboard.js';
import { render as renderPhaseHeader } from '../components/phase-header.js';
import { renderOverlay as renderHowToPlayOverlay } from '../components/how-to-play-overlay.js';
import { renderCountdown } from '../components/countdown.js';
import { formatStartTime } from '../utils/schedule-format.js';
import { escapeHtml } from '../utils/escape.js';

const STATUS_LABELS = {
  scheduled: 'Scheduled',
  live: 'Lobby open',
  ended: 'Played',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

export function render(state) {
  return `
    <div class="screen screen--online-lobby">
      ${renderPhaseHeader({ phase: 'join', label: 'Scheduled Games' })}
      ${renderGameboard(`<div class="online-lobby__forms" id="scheduled-games-body">${renderBody(state)}</div>`)}
      <div class="online-lobby__actions">
        <button class="btn mode-select__back-btn" onclick="window.game.showScreen('menu')">&larr; Back to Menu</button>
      </div>
      ${state.showHowToPlay ? renderHowToPlayOverlay(state) : ''}
    </div>
  `;
}

/**
 * Body only — the list reloads in place after cancel/reschedule so the screen
 * doesn't flash back through its loading state on every action.
 */
export function renderBody(state) {
  if (state.scheduledGamesLoading) {
    return '<p class="online-lobby__empty">Loading...</p>';
  }
  if (state.scheduledGamesError) {
    return `<p class="online-lobby__error">${escapeHtml(state.scheduledGamesError)}</p>`;
  }
  const games = state.scheduledGames || [];
  if (games.length === 0) {
    return `
      ${renderHeading()}
      <p class="online-lobby__empty">You have no upcoming games.</p>
      <button class="btn btn--primary online-lobby__action-btn" onclick="window.game.openOnlineLobby()">
        Schedule One
      </button>
    `;
  }

  return `
    ${renderHeading()}
    <div class="schedule__list">
      ${games.map((g) => renderRow(g, state)).join('')}
    </div>
  `;
}

/**
 * The same instructions overlay the lobby offers. A host arranging a game days
 * ahead is often the one who has to explain it to everyone else, so the rules
 * belong here too — not only once everybody has arrived.
 */
function renderHeading() {
  return `
    <div class="schedule__list-head">
      <h2 class="online-lobby__heading">Scheduled Games</h2>
      <button class="btn btn--ghost schedule__how-btn" onclick="window.game.openHowToPlay()">
        How to play
      </button>
    </div>
  `;
}

function renderRow(game, state) {
  const status = STATUS_LABELS[game.status] || game.status;
  const editing = state.rescheduleId === game.id;
  const titleHtml = game.title
    ? `<span class="schedule__row-title">${escapeHtml(game.title)}</span>`
    : '';

  // A game that has been played (or cancelled/expired) is history: its link is
  // dead and the server rejects edits, so offering the actions would only
  // produce errors. The row stays visible for the rest of its window as a
  // record of what happened.
  const actionable = game.status === 'scheduled' || game.status === 'live';
  if (!actionable) {
    return `
      <div class="schedule__row schedule__row--closed">
        <div class="schedule__row-head">
          <span class="schedule__row-code">${escapeHtml(game.code)}</span>
          <span class="schedule__row-status schedule__row-status--${escapeHtml(game.status)}">${escapeHtml(status)}</span>
        </div>
        ${titleHtml}
        <span class="schedule__row-when">${escapeHtml(formatStartTime(game.scheduledAt))}</span>
      </div>
    `;
  }

  const editHtml = editing
    ? `
      <div class="schedule__row-edit">
        <input
          type="datetime-local"
          id="reschedule-at-${escapeHtml(game.id)}"
          class="input schedule__datetime"
          value="${escapeHtml(localDateTimeValue(game.scheduledAt))}"
        >
        <div class="schedule__row-actions">
          <button class="btn btn--ghost" onclick="window.game.cancelReschedule()">Cancel</button>
          <button class="btn btn--primary" onclick="window.game.saveReschedule('${escapeHtml(game.id)}')">Save</button>
        </div>
      </div>`
    : `
      <div class="schedule__row-actions">
        <button class="btn btn--secondary" onclick="window.game.copyScheduledLinkFor('${escapeHtml(game.code)}')">Copy Link</button>
        <button class="btn btn--ghost" onclick="window.game.startReschedule('${escapeHtml(game.id)}')">Reschedule</button>
        <button class="btn btn--ghost schedule__cancel-btn" onclick="window.game.cancelScheduledGame('${escapeHtml(game.id)}')">Cancel Game</button>
      </div>`;

  return `
    <div class="schedule__row">
      <div class="schedule__row-head">
        <span class="schedule__row-code">${escapeHtml(game.code)}</span>
        <span class="schedule__row-status schedule__row-status--${escapeHtml(game.status)}">${escapeHtml(status)}</span>
      </div>
      ${titleHtml}
      <span class="schedule__row-when">
        ${escapeHtml(formatStartTime(game.scheduledAt))}
        ${renderCountdown(game.scheduledAt, { compact: true })}
      </span>
      ${editHtml}
    </div>
  `;
}

/** ISO → the local wall-clock string `datetime-local` expects. */
function localDateTimeValue(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
