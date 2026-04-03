// CarkedIt Online — Game Dashboard (standalone)
'use strict';

const API_BASE = '';  // Same origin
let games = [];
let stats = {};
let playTimeMode = 'total'; // 'total' | 'average' | 'median' | 'longest'
let expandedGameId = null;

// ── PII Masking ──────────────────────────────────────
function maskName(name) {
  if (!name || name.length <= 1) return '*';
  return name[0] + '*'.repeat(name.length - 1);
}

// ── Time Formatting ──────────────────────────────────
function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function formatDateTime(isoDate) {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' })
    + ' ' + d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// ── Status Helpers ───────────────────────────────────
function statusLabel(status) {
  const map = { lobby: 'Lobby', die: 'Die', live: 'Live', bye: 'Bye', eulogy: 'Eulogy', finished: 'Finished' };
  return map[status] || status || 'Finished';
}

function liveStatusLabel(liveStatus) {
  if (liveStatus === 'live') return 'Live';
  if (liveStatus === 'abandoned') return 'Abandon';
  return '';
}

function rowClass(game) {
  if (game.has_error) return 'dashboard__row--error';
  if (game.live_status === 'live') return 'dashboard__row--live';
  if (game.live_status === 'abandoned') return 'dashboard__row--abandoned';
  if (game.is_dev) return 'dashboard__row--dev';
  return '';
}

// ── Data Fetching ────────────────────────────────────
async function fetchGames() {
  try {
    const res = await fetch(`${API_BASE}/api/carkedit/games?limit=100`);
    if (!res.ok) return;
    const data = await res.json();
    games = data.games || [];
  } catch (err) {
    console.warn('[dashboard] Failed to fetch games:', err);
  }
}

async function fetchStats() {
  try {
    const res = await fetch(`${API_BASE}/api/carkedit/games/stats`);
    if (!res.ok) return;
    stats = await res.json();
  } catch (err) {
    console.warn('[dashboard] Failed to fetch stats:', err);
  }
}

// ── Play Time Display ────────────────────────────────
function getPlayTimeValue() {
  switch (playTimeMode) {
    case 'average': return stats.avgPlayTime || 0;
    case 'median': return stats.medianPlayTime || 0;
    case 'longest': return stats.longestPlayTime || 0;
    default: return stats.totalPlayTime || 0;
  }
}

function getPlayTimeLabel() {
  switch (playTimeMode) {
    case 'average': return 'Avg Play Time';
    case 'median': return 'Median Play Time';
    case 'longest': return 'Longest Game';
    default: return 'Total Play Time';
  }
}

function cyclePlayTime() {
  const modes = ['total', 'average', 'median', 'longest'];
  const idx = modes.indexOf(playTimeMode);
  playTimeMode = modes[(idx + 1) % modes.length];
  renderStats();
}

// ── Expand/Collapse Game Detail ──────────────────────
function toggleGame(gameId) {
  expandedGameId = expandedGameId === gameId ? null : gameId;
  renderGameList();
}

// ── Rendering ────────────────────────────────────────
function renderStats() {
  const el = document.getElementById('stats-bar');
  if (!el) return;
  el.innerHTML = `
    <div class="dashboard__stat">
      <span class="dashboard__stat-value">${stats.totalGames ?? 0}</span>
      <span class="dashboard__stat-label">Finished Games</span>
    </div>
    <div class="dashboard__stat">
      <span class="dashboard__stat-value">${stats.totalPlayers ?? 0}</span>
      <span class="dashboard__stat-label">Total Players</span>
    </div>
    <div class="dashboard__stat dashboard__stat--clickable" onclick="window.dash.cyclePlayTime()">
      <span class="dashboard__stat-value">${formatDuration(getPlayTimeValue())}</span>
      <span class="dashboard__stat-label">${getPlayTimeLabel()}</span>
    </div>
  `;
}

function renderGameRow(game) {
  const cls = rowClass(game);
  const expanded = expandedGameId === game.id;
  const errorFlag = game.has_error ? '<span class="dashboard__flag dashboard__flag--error" title="Error">!</span>' : '';
  const liveLabel = liveStatusLabel(game.live_status);
  const liveBadge = liveLabel ? `<span class="dashboard__badge dashboard__badge--${game.live_status}">${liveLabel}</span>` : '';

  let detail = '';
  if (expanded) {
    const players = (game.players || []).map(p => `
      <tr>
        <td>#${p.rank}</td>
        <td>${maskName(p.player_name)}</td>
        <td>${p.score} pts</td>
      </tr>
    `).join('');

    let settingsHtml = '';
    if (game.settings_json) {
      try {
        const s = JSON.parse(game.settings_json);
        settingsHtml = `<div class="dashboard__detail-settings"><strong>Settings:</strong> ${JSON.stringify(s)}</div>`;
      } catch {}
    }

    detail = `
      <tr class="dashboard__detail-row">
        <td colspan="7">
          <div class="dashboard__detail">
            <table class="dashboard__players-table">
              <thead><tr><th>Rank</th><th>Player</th><th>Score</th></tr></thead>
              <tbody>${players}</tbody>
            </table>
            ${settingsHtml}
          </div>
        </td>
      </tr>
    `;
  }

  return `
    <tr class="dashboard__row ${cls}" onclick="window.dash.toggleGame('${game.id}')">
      <td class="dashboard__cell--date">${formatDateTime(game.finished_at)}</td>
      <td>${maskName(game.host_name)}</td>
      <td>${game.player_count}</td>
      <td>${formatDuration(game.duration_seconds)}</td>
      <td>${statusLabel(game.status)}</td>
      <td>${liveBadge}</td>
      <td>${errorFlag}</td>
    </tr>
    ${detail}
  `;
}

function renderGameList() {
  const el = document.getElementById('game-list');
  if (!el) return;

  if (games.length === 0) {
    el.innerHTML = '<p class="dashboard__empty">No games recorded yet.</p>';
    return;
  }

  el.innerHTML = `
    <table class="dashboard__table">
      <thead>
        <tr>
          <th>Date/Time</th>
          <th>Host</th>
          <th>Players</th>
          <th>Play Time</th>
          <th>Status</th>
          <th></th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${games.map(renderGameRow).join('')}
      </tbody>
    </table>
  `;
}

function renderPage() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="dashboard">
      <header class="dashboard__header">
        <h1 class="dashboard__title">CarkedIt — Game Dashboard</h1>
      </header>
      <div class="dashboard__stats" id="stats-bar"></div>
      <div class="dashboard__content" id="game-list"></div>
    </div>
  `;
  renderStats();
  renderGameList();
}

// ── Init ─────────────────────────────────────────────
window.dash = { cyclePlayTime, toggleGame };

document.addEventListener('DOMContentLoaded', async () => {
  renderPage();
  await Promise.all([fetchGames(), fetchStats()]);
  renderStats();
  renderGameList();
});
