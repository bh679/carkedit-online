// CarkedIt Online — Add to Calendar.
//
// One button that opens its options on press. Which calendar someone uses is a
// detail they only care about at the moment they tap — showing every service up
// front made a row of buttons compete with the countdown and the join code for
// attention.
//
// Shared by every place a scheduled game shows its start time (post-create
// confirmation, join screen, waiting lobby) so the flow is identical wherever
// a player meets it.
'use strict';

export function renderCalendarActions() {
  return `
    <div class="schedule__calendar">
      <button
        class="btn btn--secondary schedule__calendar-btn"
        aria-expanded="false"
        aria-controls="schedule-calendar-menu"
        onclick="window.game.toggleCalendarMenu(event)"
      >
        Add to Calendar
      </button>
      <div class="schedule__calendar-menu" id="schedule-calendar-menu" hidden>
        <button class="btn btn--ghost schedule__calendar-option" onclick="window.game.openGoogleCalendar()">
          Google Calendar
        </button>
        <button class="btn btn--ghost schedule__calendar-option" onclick="window.game.openOutlookCalendar()">
          Outlook
        </button>
        <button class="btn btn--ghost schedule__calendar-option" onclick="window.game.downloadScheduleIcs()">
          Apple Calendar &amp; other
        </button>
      </div>
    </div>
  `;
}
