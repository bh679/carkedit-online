// CarkedIt Online — Turn Order Utility
'use strict';

// Day of the Dead = November 1 = day 304 (0-indexed from Jan 1 = day 0)
const DOD_DAY = 304;

const DAYS_BEFORE_MONTH = [0, 0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

function dayOfYear(month, day) {
  return DAYS_BEFORE_MONTH[month] + (day - 1);
}

function dodDistance(player) {
  if (!player.birthMonth || !player.birthDay) return Infinity;
  const d = dayOfYear(player.birthMonth, player.birthDay);
  const diff = Math.abs(d - DOD_DAY);
  return Math.min(diff, 365 - diff);
}

/**
 * Returns a new players array rotated so the player whose birthday is
 * closest to Day of the Dead (November 1) goes first.
 * - Unknown birthdays (birthMonth/birthDay missing or 0) sort last.
 * - Ties broken by original join order (first match wins).
 * - The array is rotated, not sorted — relative join order is preserved.
 *
 * @param {Array<{ name: string, score: number, birthMonth?: number, birthDay?: number }>} players
 * @returns {Array}
 */
export function computeDodTurnOrder(players) {
  if (players.length === 0) return [];

  let minDist = Infinity;
  let pivotIndex = 0;

  players.forEach((p, i) => {
    const dist = dodDistance(p);
    if (dist < minDist) {
      minDist = dist;
      pivotIndex = i;
    }
  });

  return [...players.slice(pivotIndex), ...players.slice(0, pivotIndex)];
}
