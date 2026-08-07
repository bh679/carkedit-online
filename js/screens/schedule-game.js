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
import { localDateTimeValue, earliestStartValue } from '../utils/schedule-format.js';

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
        min="${escapeHtml(earliestStartValue())}"
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

      <label class="schedule__label" for="schedule-video-call">Video call <span class="schedule__label-note">optional</span></label>
      <textarea
        id="schedule-video-call"
        class="input schedule__paste"
        rows="4"
        maxlength="4000"
        placeholder="Paste a Zoom, Google Meet, Teams, Discord or WhatsApp invite — we'll sort out the links, numbers and codes."
        ${connecting ? 'disabled' : ''}
      >${escapeHtml(typed.videoCallText || '')}</textarea>
      <p class="online-lobby__field-note">
        CarkedIt is best played with everyone on a call. Paste the whole invite —
        links, dial-in numbers and meeting codes are pulled out for your players
        and added to the calendar invite. Anyone with the game link can see it.
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

