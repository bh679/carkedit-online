// CarkedIt Online — Session Recovery
//
// Persists the Colyseus reconnection token + room code to sessionStorage so a
// page reload mid-party can rejoin. sessionStorage is per-tab and auto-clears
// when the tab closes, which matches the "I refreshed by accident" UX without
// leaking stale tokens into new tabs.
'use strict';

const STORAGE_KEY = 'carkedit:online-session';

/** @typedef {{
 *   roomCode: string,
 *   reconnectionToken: string,
 *   identity: {
 *     name: string,
 *     birthMonth: number,
 *     birthDay: number,
 *     isDevName: boolean,
 *     userId: string,
 *   },
 *   savedAt: number,
 * }} SavedSession
 */

/**
 * Persist the session so the next page load can attempt to rejoin.
 * Silently no-ops if sessionStorage is unavailable (private mode, quota, etc.).
 */
export function saveSession({ roomCode, reconnectionToken, identity }) {
  if (!roomCode || !reconnectionToken) return;
  try {
    const payload = {
      roomCode,
      reconnectionToken,
      identity: identity || null,
      savedAt: Date.now(),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[session-recovery] saveSession failed:', err);
  }
}

/**
 * Read a previously-saved session from this tab.
 * @returns {SavedSession|null}
 */
export function loadSession() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.roomCode || !parsed?.reconnectionToken) return null;
    return parsed;
  } catch (err) {
    console.warn('[session-recovery] loadSession failed:', err);
    return null;
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('[session-recovery] clearSession failed:', err);
  }
}
