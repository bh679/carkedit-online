// CarkedIt Online — Game History Manager
'use strict';

import { getState } from '../state.js';
import { getAuthToken } from './auth-manager.js';

const STORAGE_PREFIX = 'carkedit_game_history';
const MAX_LOCAL_ENTRIES = 100;

/**
 * The signed-in user's id, or 'guest' when signed out. Used to namespace the
 * local cache so one browser's history never bleeds across accounts.
 */
function currentUid() {
  return getState().authUser?.id || 'guest';
}

/** localStorage key for a given user's cached history. */
function keyFor(uid) {
  return `${STORAGE_PREFIX}:${uid}`;
}

/** Read the cached history array for a user (defaults to the current user). */
function readHistory(uid = currentUid()) {
  try {
    const raw = localStorage.getItem(keyFor(uid));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Persist a history array (capped) for a user. */
function writeHistory(uid, entries) {
  try {
    localStorage.setItem(keyFor(uid), JSON.stringify(entries.slice(0, MAX_LOCAL_ENTRIES)));
  } catch (err) {
    console.warn('[game-history] Failed to save to localStorage:', err);
  }
}

/** Map a server game record to the local display/entry shape. */
function mapServerGame(g) {
  return {
    id: g.id,
    finishedAt: g.finished_at,
    mode: g.mode,
    rounds: g.rounds,
    players: (g.players || []).map((p) => ({
      name: p.player_name,
      score: p.score,
      rank: p.rank,
    })),
    winnerName: g.winner_name,
    winnerScore: g.winner_score,
    synced: true,
    settings: null,
  };
}

/**
 * Save a game result to the current account's local cache and POST local games
 * to the API.
 * @param {object} gameData - { id, mode, rounds, players, settings, finishedAt, synced }
 */
export function saveGameToHistory(gameData) {
  // Build players immutably, sorted by score with ranks assigned.
  const players = (gameData.players || [])
    .map((p) => ({ name: p.name, score: p.score ?? 0, rank: 0 }))
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ ...p, rank: i + 1 }));

  const entry = {
    id: gameData.id || crypto.randomUUID(),
    finishedAt: gameData.finishedAt || new Date().toISOString(),
    mode: gameData.mode || 'local',
    rounds: gameData.rounds || 1,
    players,
    winnerName: players[0]?.name || 'Unknown',
    winnerScore: players[0]?.score ?? 0,
    synced: gameData.synced || false,
    settings: gameData.settings || null,
    isDev: gameData.isDev || false,
  };

  const uid = currentUid();
  writeHistory(uid, [entry, ...readHistory(uid)]);

  // POST local games to the server (online games are recorded server-side already).
  if (entry.mode === 'local' && !entry.synced) {
    postGameToServer(entry).catch(() => {});
  }

  return entry;
}

/**
 * Get the current account's cached game history from localStorage.
 * @returns {object[]}
 */
export function getGameHistory() {
  return readHistory();
}

/**
 * Sync with the server: fetch the signed-in user's own games (host_user_id) and
 * cache them. Falls back to the local device cache when signed out or offline.
 * @returns {Promise<object[]>}
 */
export async function syncWithServer() {
  const uid = currentUid();

  // Re-POST any unsynced local games (authenticated) so they get owned server-side.
  for (const entry of readHistory(uid).filter((e) => !e.synced && e.mode === 'local')) {
    await postGameToServer(entry).catch(() => {});
  }

  const token = await getAuthToken();
  if (!token) return getGameHistory(); // signed out → device cache only

  try {
    const res = await fetch('/api/carkedit/games/mine?limit=100', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return getGameHistory();

    const data = await res.json();
    const serverGames = (data.games || []).map(mapServerGame);

    // Server is authoritative for the signed-in account.
    writeHistory(uid, serverGames);
    return serverGames;
  } catch (err) {
    console.warn('[game-history] Sync failed:', err);
    return getGameHistory();
  }
}

/**
 * POST a game result to the server, authenticated when signed in so the game is
 * attributed to the host's account (host_user_id).
 * @param {object} entry
 */
async function postGameToServer(entry) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    const token = await getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch('/api/carkedit/games', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        mode: entry.mode,
        rounds: entry.rounds,
        players: entry.players.map((p) => ({ name: p.name, score: p.score })),
        settings: entry.settings,
        finishedAt: entry.finishedAt,
        isDev: entry.isDev || false,
        // Brand PLAY attribution: tag the game with the brand URL it was created on
        // (window.brand is set on /<slug>/...). Server validates it to a real brand.
        brandId: (typeof window !== 'undefined' && window.brand) ? window.brand.id : undefined,
      }),
    });

    if (res.ok) {
      // Mark as synced in the current account's cache (immutably).
      const uid = currentUid();
      const history = readHistory(uid);
      const idx = history.findIndex((h) => h.id === entry.id);
      if (idx !== -1) {
        writeHistory(uid, history.map((h, i) => (i === idx ? { ...h, synced: true } : h)));
      }
    }
  } catch (err) {
    console.warn('[game-history] POST failed:', err);
  }
}
