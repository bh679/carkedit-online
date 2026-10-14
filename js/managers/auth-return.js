// CarkedIt Online — post-auth return snapshot
//
// On mobile, Google sign-in uses Firebase signInWithRedirect: a full page
// navigation to Google and back that wipes all in-memory state. Without a
// snapshot the return trip boots to the default screen (main menu), losing
// the player's place — e.g. the Create Room "Your Details" step.
//
// These helpers persist a small one-shot snapshot in sessionStorage (tab-local,
// like the game session) before the redirect, and hand back a sanitized copy
// on the return trip. Storage is injectable for unit tests.
'use strict';

const AUTH_RETURN_KEY = 'carkedit-auth-return';

// Screens safe to restore after the redirect — in-game screens need a live
// room and are recovered by the saved-session path instead.
export const AUTH_RETURN_SCREENS = ['online-lobby', 'join-game', 'account', 'menu'];

function defaultStorage() {
  try {
    return globalThis.sessionStorage || null;
  } catch (err) {
    // Some privacy modes throw on any storage access.
    return null;
  }
}

export function saveAuthReturn(snapshot, storage = defaultStorage()) {
  if (!storage) return;
  try {
    storage.setItem(AUTH_RETURN_KEY, JSON.stringify(snapshot));
  } catch (err) {
    // Storage full/disabled — sign-in still works, just without the return trip.
    console.warn('[auth-return] Could not save snapshot:', err);
  }
}

export function clearAuthReturn(storage = defaultStorage()) {
  if (!storage) return;
  try {
    storage.removeItem(AUTH_RETURN_KEY);
  } catch (err) { /* storage disabled — nothing to clear */ }
}

/**
 * One-shot read: returns a sanitized snapshot (or null) and removes the key
 * so a later manual reload doesn't spuriously restore.
 *
 * Sanitized shape: { screen, lobbyStep, lobbyDetails|null } where screen is
 * always from AUTH_RETURN_SCREENS (falls back to 'menu') — the raw value is
 * untrusted storage content.
 */
export function consumeAuthReturn(storage = defaultStorage()) {
  if (!storage) return null;
  let raw = null;
  try {
    raw = storage.getItem(AUTH_RETURN_KEY);
    if (raw != null) storage.removeItem(AUTH_RETURN_KEY);
  } catch (err) {
    console.warn('[auth-return] Could not read snapshot:', err);
    return null;
  }
  if (!raw) return null;
  let snapshot = null;
  try {
    snapshot = JSON.parse(raw);
  } catch (err) {
    return null;
  }
  if (!snapshot || typeof snapshot !== 'object') return null;

  const details = (snapshot.lobbyDetails && typeof snapshot.lobbyDetails === 'object')
    ? {
      name: String(snapshot.lobbyDetails.name || ''),
      birthMonth: parseInt(snapshot.lobbyDetails.birthMonth, 10) || 0,
      birthDay: parseInt(snapshot.lobbyDetails.birthDay, 10) || 0,
    }
    : null;

  return {
    screen: AUTH_RETURN_SCREENS.includes(snapshot.screen) ? snapshot.screen : 'menu',
    lobbyStep: snapshot.lobbyStep === 'email-auth' ? 'email-auth' : 'details',
    lobbyDetails: details,
  };
}
