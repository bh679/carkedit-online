// CarkedIt Online — Scheduled game countdown ticker.
//
// One interval drives every countdown on screen: each element carries its own
// target in `data-countdown-to`, so the host's list of games ticks as happily
// as a single lobby banner. Only the text is written — re-rendering the screen
// every second would blow away typed input, scroll position and the host's
// open edit drawer.
'use strict';

import { formatCountdown, msUntil } from '../utils/schedule-format.js';

let _timer = null;
let _onReached = null;

const VALUE_SELECTOR = '[data-countdown-to]';

/**
 * Start ticking every countdown currently in the DOM. Safe to call on every
 * render; a no-op when the screen has none.
 * @param {() => void} onReached called once when a countdown reaches its start
 *   time, so the caller can re-render into the "startable" form
 */
export function startScheduleCountdown(onReached) {
  clearScheduleCountdown();
  if (!document.querySelector(VALUE_SELECTOR)) return;
  _onReached = onReached;

  const tick = () => {
    const els = document.querySelectorAll(VALUE_SELECTOR);
    if (els.length === 0) {
      // The screen moved on without telling us.
      clearScheduleCountdown();
      return;
    }
    let anyReached = false;
    els.forEach((el) => {
      const remaining = msUntil(el.dataset.countdownTo);
      el.textContent = formatCountdown(remaining);
      if (remaining === 0) anyReached = true;
    });
    if (anyReached) {
      // Fire once, then stop: the re-render decides what (if anything) still
      // needs a countdown, and starts a fresh ticker for it.
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
