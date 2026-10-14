// CarkedIt Online — Live countdown to a scheduled start.
//
// Sits under the start time wherever one is shown. The element carries its own
// target in `data-countdown-to`, so a screen can show several at once (the
// host's list of games) and one ticker updates them all — see
// managers/schedule-countdown.js.
'use strict';

import { formatCountdown, msUntil, hasStarted } from '../utils/schedule-format.js';
import { escapeHtml } from '../utils/escape.js';

/**
 * @param {string} iso  ISO UTC start time
 * @param {{compact?: boolean}} [opts] compact drops the "starts in" label for
 *   dense rows where the surrounding text already says what it is.
 * @returns {string} HTML string — empty once the start time has passed
 */
export function renderCountdown(iso, { compact = false } = {}) {
  if (!iso || hasStarted(iso)) return '';
  const label = compact ? '' : '<span class="schedule__countdown-label">starts in</span>';
  return `
    <span class="schedule__countdown${compact ? ' schedule__countdown--compact' : ''}">
      ${label}
      <span class="schedule__countdown-value" data-countdown-to="${escapeHtml(iso)}">${formatCountdown(msUntil(iso))}</span>
    </span>
  `;
}
