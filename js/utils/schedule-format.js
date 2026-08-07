// CarkedIt Online — Scheduled game time formatting.
//
// Start times travel as ISO UTC and are always shown in the viewer's own local
// time — players in one game are routinely in different zones.
'use strict';

/** "Fri 8 Aug, 7:30 pm" in the viewer's local zone. */
export function formatStartTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
  return `${date}, ${time}`;
}

/** Short local time only — for dense list rows. */
export function formatStartTimeShort(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/**
 * Milliseconds until the start, floored at 0. Callers treat 0 as "it's time".
 */
export function msUntil(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, d.getTime() - Date.now());
}

/**
 * Countdown text. Days are spelled out because a game can be scheduled weeks
 * out, where a raw HH:MM:SS would be meaningless.
 *   3d 04:12:07 · 04:12:07 · 12:07
 */
export function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (days > 0) return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

/** True once the scheduled moment has passed. */
export function hasStarted(iso) {
  return msUntil(iso) === 0;
}

/** Minutes of lead time the server insists on; mirrored here as the input min. */
export const MIN_LEAD_MINUTES = 5;

/**
 * `datetime-local` speaks local wall-clock time with no zone, so build its
 * value from the local parts rather than slicing an ISO (UTC) string. Takes
 * either an ISO string or epoch milliseconds — every screen that edits a start
 * time needs one of the two.
 */
export function localDateTimeValue(when) {
  const d = new Date(when);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The earliest value a start-time input should accept, as of right now. */
export function earliestStartValue() {
  return localDateTimeValue(Date.now() + MIN_LEAD_MINUTES * 60_000);
}
