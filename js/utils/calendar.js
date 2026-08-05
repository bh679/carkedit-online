// CarkedIt Online — Add-to-calendar for scheduled games.
//
// Two paths because no single one covers everyone: an .ics download works with
// Apple Calendar, Outlook and everything else, while Google Calendar users are
// far better served by a one-click template URL than by importing a file.
// Both are built here in the browser — the client has no build step and no
// dependencies.
'use strict';

/** How long to block out in the player's calendar. */
const DEFAULT_DURATION_MINUTES = 90;

/** ICS wants UTC basic format: 20260808T093000Z */
function toIcsStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Google's template URL uses the same basic format, start/end joined by "/". */
function toGoogleRange(start, end) {
  return `${toIcsStamp(start)}/${toIcsStamp(end)}`;
}

function endFor(startsAt, durationMinutes) {
  return new Date(new Date(startsAt).getTime() + durationMinutes * 60_000);
}

/**
 * RFC 5545 escaping: commas, semicolons and backslashes are field separators,
 * and newlines must be literal "\n" inside a value.
 */
function escapeIcsText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function eventDescription(joinUrl) {
  return [
    'CarkedIt is a party game about dying badly and being remembered fondly.',
    '',
    `Join here when it starts: ${joinUrl}`,
    'No account needed to play — just open the link, add your name, and wait for the host.',
  ].join('\n');
}

/**
 * Build a single-event .ics document.
 * @param {{title?: string, joinUrl: string, startsAt: string, durationMinutes?: number}} opts
 */
export function buildIcs({ title, joinUrl, startsAt, durationMinutes = DEFAULT_DURATION_MINUTES }) {
  const start = new Date(startsAt);
  const end = endFor(startsAt, durationMinutes);
  const stamp = toIcsStamp(new Date());
  // UID must be stable per event but unique across events; the join URL is both.
  const uid = `carkedit-${encodeURIComponent(joinUrl)}`;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CarkedIt//Scheduled Game//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${toIcsStamp(start)}`,
    `DTEND:${toIcsStamp(end)}`,
    `SUMMARY:${escapeIcsText(title || 'CarkedIt game')}`,
    `DESCRIPTION:${escapeIcsText(eventDescription(joinUrl))}`,
    `URL:${escapeIcsText(joinUrl)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:CarkedIt starts in 15 minutes',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/** Trigger a download of the .ics file. */
export function downloadIcs(opts) {
  const blob = new Blob([buildIcs(opts)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'carkedit-game.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick — Safari needs the URL to survive the click.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** One-click "add to Google Calendar" URL. */
export function googleCalendarUrl({ title, joinUrl, startsAt, durationMinutes = DEFAULT_DURATION_MINUTES }) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title || 'CarkedIt game',
    dates: toGoogleRange(new Date(startsAt), endFor(startsAt, durationMinutes)),
    details: eventDescription(joinUrl),
    location: joinUrl,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
