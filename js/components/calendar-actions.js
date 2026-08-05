// CarkedIt Online — Add-to-calendar button pair.
//
// Shared by every place a scheduled game shows its start time (post-create
// confirmation, join screen, waiting lobby) so the two calendar paths stay
// identical wherever a player meets them.
'use strict';

export function renderCalendarActions() {
  return `
    <div class="schedule__calendar-row">
      <button class="btn btn--secondary schedule__calendar-btn" onclick="window.game.downloadScheduleIcs()">
        Add to Calendar
      </button>
      <button class="btn btn--ghost schedule__calendar-btn" onclick="window.game.openGoogleCalendar()">
        Google Calendar
      </button>
    </div>
  `;
}
