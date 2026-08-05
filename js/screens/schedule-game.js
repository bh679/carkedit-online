// CarkedIt Online — Schedule a Game.
//
// Its own screen because scheduling isn't a variant of creating a room: it
// collects a time and the video call instead of player details, and it opens
// no room at all — it reserves a code the host can share right away.
//
// Player name and birthday are deliberately absent. Those belong to whoever
// actually turns up, and are collected at join time like any other game.
'use strict';

import { render as renderGameboard } from '../components/gameboard.js';
import { render as renderPhaseHeader } from '../components/phase-header.js';
import { escapeHtml } from '../utils/escape.js';

/** Minutes of lead time the server insists on; mirrored here as the input min. */
const MIN_LEAD_MINUTES = 5;
const DEFAULT_LEAD_MINUTES = 60;

export function render(state) {
  const connecting = state.connectionStatus === 'connecting';
  const typed = state.scheduleDraft || {};
  const errorHtml = state.scheduleError
    ? `<p class="online-lobby__error">${escapeHtml(state.scheduleError)}</p>`
    : '';

  const boardContent = `
    <div class="online-lobby__forms">
      <h2 class="online-lobby__heading">Schedule a Game</h2>
      <p class="online-lobby__field-note">
        Pick a time and we'll give you a link to share now. It keeps working
        until 24 hours after the game starts.
      </p>

      <label class="schedule__label" for="schedule-start-at">When</label>
      <input
        type="datetime-local"
        id="schedule-start-at"
        class="input schedule__datetime"
        min="${escapeHtml(localDateTimeValue(Date.now() + MIN_LEAD_MINUTES * 60_000))}"
        value="${escapeHtml(typed.startsAt || localDateTimeValue(Date.now() + DEFAULT_LEAD_MINUTES * 60_000))}"
        ${connecting ? 'disabled' : ''}
      >

      <label class="schedule__label" for="schedule-title">Occasion <span class="schedule__label-note">optional</span></label>
      <input
        type="text"
        id="schedule-title"
        class="input"
        maxlength="60"
        placeholder="Nan's wake, Dave's send-off…"
        value="${escapeHtml(typed.title || '')}"
        ${connecting ? 'disabled' : ''}
      >

      <label class="schedule__label" for="schedule-video-url">Video call link <span class="schedule__label-note">optional</span></label>
      <input
        type="url"
        id="schedule-video-url"
        class="input"
        maxlength="500"
        placeholder="https://meet.google.com/..."
        value="${escapeHtml(typed.videoUrl || '')}"
        ${connecting ? 'disabled' : ''}
      >
      <p class="online-lobby__field-note">
        CarkedIt is best played with everyone on a call. Paste your Zoom, Meet or
        FaceTime link and we'll show it to your players and put it in the calendar
        invite. Anyone with the game link can see it.
      </p>

      ${errorHtml}

      <button
        class="btn btn--primary online-lobby__action-btn"
        onclick="window.game.scheduleRoom()"
        ${connecting ? 'disabled' : ''}
      >
        ${connecting ? 'Scheduling...' : 'Schedule Game'}
      </button>
    </div>
  `;

  return `
    <div class="screen screen--online-lobby">
      ${renderPhaseHeader({ phase: 'online', label: 'Schedule' })}
      ${renderGameboard(boardContent)}
      <div class="online-lobby__actions">
        <button class="btn mode-select__back-btn" onclick="window.game.openOnlineLobby()">
          &larr; Back
        </button>
      </div>
    </div>
  `;
}

/**
 * `datetime-local` speaks local wall-clock time with no zone, so build its
 * value from the local parts rather than slicing an ISO (UTC) string.
 */
function localDateTimeValue(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
