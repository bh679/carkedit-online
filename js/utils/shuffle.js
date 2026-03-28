// CarkedIt Online — Fisher-Yates Shuffle Utility
'use strict';

/**
 * Returns a new array with elements randomly shuffled (Fisher-Yates).
 * Does NOT mutate the original array.
 *
 * @param {Array} arr
 * @returns {Array}
 */
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
