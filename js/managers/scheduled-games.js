// CarkedIt Online — Scheduled game API access.
//
// A scheduled game has no Colyseus room most of its life, so everything here
// goes over REST. The join link is the ordinary ?join=CODE link: one URL that
// works before, during and (with a clear message) after the game.
'use strict';

import { getAuthToken } from './auth-manager.js';

const API_BASE = `${window.location.origin}/api/carkedit`;

async function authHeaders() {
  const token = await getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function readError(res, fallback) {
  const body = await res.json().catch(() => ({}));
  return new Error(body.error || fallback);
}

/** The shareable link for a code — same shape the live-lobby copy button uses. */
export function buildJoinUrl(code) {
  const url = new URL(window.location.href);
  url.search = `?join=${encodeURIComponent(code)}`;
  url.hash = '';
  return url.toString();
}

/** Reserve a code + start time. Requires a Host account. */
export async function createScheduledGame({ scheduledAt, title, videoCall, videoCallNotes, devMode }) {
  const res = await fetch(`${API_BASE}/scheduled`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      scheduledAt,
      title: title || undefined,
      videoCall: videoCall || [],
      videoCallNotes: videoCallNotes || '',
      devMode: !!devMode,
      brandId: window.brand ? window.brand.id : undefined,
    }),
  });
  if (!res.ok) throw await readError(res, 'Failed to schedule the game');
  return res.json();
}

/**
 * Resolve a code. Returns null when no scheduled game holds it (an ordinary
 * walk-up room code), so callers can fall through to the live-room path.
 */
export async function lookupScheduledGame(code) {
  const res = await fetch(`${API_BASE}/scheduled/${encodeURIComponent(String(code).toUpperCase())}`);
  if (res.status === 404) return null;
  if (!res.ok) throw await readError(res, 'Could not check that code');
  return res.json();
}

/**
 * Ask the server to have a room running for this code and return its roomId.
 * Safe to call repeatedly — concurrent callers all get the same room.
 */
export async function openScheduledRoom(code) {
  const res = await fetch(`${API_BASE}/scheduled/${encodeURIComponent(String(code).toUpperCase())}/room`, {
    method: 'POST',
  });
  if (!res.ok) throw await readError(res, 'Could not open the game room');
  return res.json();
}

/** The signed-in host's own upcoming games. */
export async function fetchMyScheduledGames() {
  const res = await fetch(`${API_BASE}/scheduled`, { headers: await authHeaders() });
  if (!res.ok) throw await readError(res, 'Failed to load your scheduled games');
  const data = await res.json();
  return data.games;
}

export async function rescheduleGame(id, { scheduledAt, title }) {
  const body = {};
  if (scheduledAt !== undefined) body.scheduledAt = scheduledAt;
  if (title !== undefined) body.title = title;
  const res = await fetch(`${API_BASE}/scheduled/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await readError(res, 'Failed to update the game');
  return res.json();
}

export async function cancelScheduledGame(id) {
  const res = await fetch(`${API_BASE}/scheduled/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (!res.ok) throw await readError(res, 'Failed to cancel the game');
  return res.json();
}
