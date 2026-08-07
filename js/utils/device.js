// CarkedIt Online — Device Detection
'use strict';

/**
 * True when the player is on a phone or tablet.
 *
 * User-agent based on purpose, not viewport: the question these callers ask is
 * "is this a device you carry and point at things", not "is this window narrow".
 * A half-width laptop window is still a laptop.
 *
 * @returns {boolean}
 */
export function isMobileDevice() {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
