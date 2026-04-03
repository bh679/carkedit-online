// CarkedIt Online — Game History Manager
'use strict';

const STORAGE_KEY = 'carkedit_game_history';
const MAX_LOCAL_ENTRIES = 100;

/**
 * Save a game result to localStorage and optionally POST to the API.
 * @param {object} gameData - { id, mode, rounds, players, settings, finishedAt, synced }
 */
export function saveGameToHistory(gameData) {
  const entry = {
    id: gameData.id || crypto.randomUUID(),
    finishedAt: gameData.finishedAt || new Date().toISOString(),
    mode: gameData.mode || 'local',
    rounds: gameData.rounds || 1,
    players: (gameData.players || []).map((p, i) => ({
      name: p.name,
      score: p.score ?? 0,
      rank: i + 1,
    })),
    winnerName: gameData.players?.[0]?.name || 'Unknown',
    winnerScore: gameData.players?.[0]?.score ?? 0,
    synced: gameData.synced || false,
    settings: gameData.settings || null,
  };

  // Sort players by score descending and assign ranks
  entry.players.sort((a, b) => b.score - a.score);
  entry.players.forEach((p, i) => { p.rank = i + 1; });
  entry.winnerName = entry.players[0]?.name || 'Unknown';
  entry.winnerScore = entry.players[0]?.score ?? 0;

  // Save to localStorage
  try {
    const history = getGameHistory();
    history.unshift(entry);
    if (history.length > MAX_LOCAL_ENTRIES) history.length = MAX_LOCAL_ENTRIES;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (err) {
    console.warn('[game-history] Failed to save to localStorage:', err);
  }

  // POST local games to server
  if (entry.mode === 'local' && !entry.synced) {
    postGameToServer(entry).catch(() => {});
  }

  return entry;
}

/**
 * Get all game history from localStorage.
 * @returns {object[]}
 */
export function getGameHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Sync local history with the server: fetch remote games and merge.
 * @returns {Promise<object[]>} merged history
 */
export async function syncWithServer() {
  try {
    const res = await fetch('/api/carkedit/games?limit=100');
    if (!res.ok) return getGameHistory();

    const data = await res.json();
    const serverGames = (data.games || []).map((g) => ({
      id: g.id,
      finishedAt: g.finished_at,
      mode: g.mode,
      rounds: g.rounds,
      players: g.players.map((p) => ({
        name: p.player_name,
        score: p.score,
        rank: p.rank,
      })),
      winnerName: g.winner_name,
      winnerScore: g.winner_score,
      synced: true,
      settings: null,
    }));

    // Merge: local entries + server entries, deduplicate by ID
    const local = getGameHistory();
    const seen = new Set();
    const merged = [];

    for (const entry of [...local, ...serverGames]) {
      if (!seen.has(entry.id)) {
        seen.add(entry.id);
        merged.push({ ...entry, synced: true });
      }
    }

    merged.sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt));
    if (merged.length > MAX_LOCAL_ENTRIES) merged.length = MAX_LOCAL_ENTRIES;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));

    // POST any unsynced local games
    for (const entry of local.filter((e) => !e.synced && e.mode === 'local')) {
      postGameToServer(entry).catch(() => {});
    }

    return merged;
  } catch (err) {
    console.warn('[game-history] Sync failed:', err);
    return getGameHistory();
  }
}

/**
 * POST a game result to the server.
 * @param {object} entry
 */
async function postGameToServer(entry) {
  try {
    const res = await fetch('/api/carkedit/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: entry.mode,
        rounds: entry.rounds,
        players: entry.players.map((p) => ({ name: p.name, score: p.score })),
        settings: entry.settings,
        finishedAt: entry.finishedAt,
      }),
    });

    if (res.ok) {
      // Mark as synced in localStorage
      const history = getGameHistory();
      const idx = history.findIndex((h) => h.id === entry.id);
      if (idx !== -1) {
        history[idx].synced = true;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
      }
    }
  } catch (err) {
    console.warn('[game-history] POST failed:', err);
  }
}
