// CarkedIt Online — Scheduled game countdown.
//
// Ticks once a second and writes ONLY the countdown text, the way the pitch
// timer does. Re-rendering the lobby every second would blow away typed input,
// scroll position and the host's open edit drawer.
'use strict';

import { formatCountdown, msUntil } from '../utils/schedule-format.js';

let _timer = null;
let _onReached = null;

const VALUE_SELECTOR = '.online-lobby__countdown-value';

/**
 * Start ticking towards `scheduledAt`.
 * @param {string} scheduledAt ISO UTC start time
 * @param {() => void} onReached called once when the start time arrives, so the
 *   caller can re-render the lobby into its "startable" form
 */
export function startScheduleCountdown(scheduledAt, onReached) {
  clearScheduleCountdown();
  if (!scheduledAt) return;
  _onReached = onReached;

  const tick = () => {
    const remaining = msUntil(scheduledAt);
    const el = document.querySelector(VALUE_SELECTOR);
    if (el) el.textContent = formatCountdown(remaining);
    if (remaining === 0) {
      // Fire once, then stop: the re-render swaps the banner for the normal
      // start controls, so there is nothing left to tick.
      const reached = _onReached;
      clearScheduleCountdown();
      if (reached) reached();
    }
  };

  tick();
  _timer = setInterval(tick, 1000);
}

export function clearScheduleCountdown() {
  if (_timer) clearInterval(_timer);
  _timer = null;
  _onReached = null;
}
