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

function renderGameCard(game) {
  const cls = rowClass(game);
  const expanded = expandedGameId === game.id;
  const errorFlag = game.has_error ? '<span class="dashboard__flag dashboard__flag--error" title="Error">!</span>' : '';
  const liveLabel = liveStatusLabel(game.live_status);
  const liveBadge = liveLabel ? `<span class="dashboard__badge dashboard__badge--${game.live_status}">${liveLabel}</span>` : '';

  let detail = '';
  if (expanded) {
    const players = (game.players || []).map(p => `
      <div class="dashboard__player-row">
        <span class="dashboard__player-rank">#${p.rank}</span>
        <span class="dashboard__player-name">${maskName(p.player_name)}</span>
        <span class="dashboard__player-score">${p.score} pts</span>
      </div>
    `).join('');

    let settingsHtml = '';
    if (game.settings_json) {
      try {
        const s = JSON.parse(game.settings_json);
        settingsHtml = `<div class="dashboard__detail-settings"><strong>Settings:</strong> ${JSON.stringify(s)}</div>`;
      } catch {}
    }

    detail = `
      <div class="dashboard__detail">
        <div class="dashboard__players-list">${players}</div>
        ${settingsHtml}
      </div>
    `;
  }

  return `
    <div class="dashboard__card ${cls}" onclick="window.dash.toggleGame('${game.id}')">
      <div class="dashboard__card-row">
        <span class="dashboard__cell dashboard__cell--date">${formatDateTime(game.finished_at)}</span>
        <span class="dashboard__cell dashboard__cell--host">${maskName(game.host_name)}</span>
        <span class="dashboard__cell dashboard__cell--players">${game.player_count} players</span>
        <span class="dashboard__cell dashboard__cell--time">${formatDuration(game.duration_seconds)}</span>
        <span class="dashboard__cell dashboard__cell--status">${statusLabel(game.status)}</span>
        <span class="dashboard__cell dashboard__cell--live">${liveBadge}</span>
        <span class="dashboard__cell dashboard__cell--error">${errorFlag}</span>
      </div>
      ${detail}
    </div>
  `;
}

function renderGameList() {
  const el = document.getElementById('game-list');
  if (!el) return;

  if (games.length === 0) {
    el.innerHTML = '<p class="dashboard__empty">No games recorded yet.</p>';
    return;
  }

  // Column header
  el.innerHTML = `
    <div class="dashboard__list-header">
      <span class="dashboard__cell dashboard__cell--date">Date/Time</span>
      <span class="dashboard__cell dashboard__cell--host">Host</span>
      <span class="dashboard__cell dashboard__cell--players">Players</span>
      <span class="dashboard__cell dashboard__cell--time">Play Time</span>
      <span class="dashboard__cell dashboard__cell--status">Status</span>
      <span class="dashboard__cell dashboard__cell--live"></span>
      <span class="dashboard__cell dashboard__cell--error"></span>
    </div>
    ${games.map(renderGameCard).join('')}
  `;
}

// ── Card Analytics ────────────────────────────────
let cardStats = { mostPlayed: [], leastPlayed: [], highestWinRate: [] };
let cardDeckFilter = 'all'; // 'all' | 'die' | 'living' | 'bye'

async function fetchCardStats() {
  try {
    const res = await fetch(`${API_BASE}/api/carkedit/cards/stats`);
    if (!res.ok) return;
    cardStats = await res.json();
  } catch (err) {
    console.warn('[dashboard] Failed to fetch card stats:', err);
  }
}

function filterCards(cards) {
  if (cardDeckFilter === 'all') return cards;
  return cards.filter(c => c.card_deck === cardDeckFilter);
}

function setDeckFilter(filter) {
  cardDeckFilter = filter;
  renderCardAnalytics();
}

function deckTypeForCard(deck) {
  if (deck === 'living') return 'live';
  if (deck === 'bye') return 'bye';
  return 'die';
}

function renderStatCard(card) {
  const deckType = deckTypeForCard(card.card_deck);
  return `
    <div class="dashboard__stat-card-wrap">
      <div class="card card--${deckType}">
        <div class="card__image">
          <div class="card__image-placeholder"></div>
        </div>
        <div class="card__body">
          <h3 class="card__title">${card.card_text}</h3>
        </div>
      </div>
      <div class="dashboard__stat-card-data">
        <span>${card.play_count} plays</span>
        <span>${card.win_count} wins</span>
        <span class="dashboard__stat-card-rate">${card.win_rate}%</span>
      </div>
    </div>
  `;
}

function renderCardRow(title, cards) {
  const filtered = filterCards(cards);
  if (!filtered || filtered.length === 0) {
    return `
      <div class="dashboard__card-row-section">
        <h3 class="dashboard__card-row-title">${title}</h3>
        <p class="dashboard__card-row-empty">No data yet</p>
      </div>`;
  }
  return `
    <div class="dashboard__card-row-section">
      <h3 class="dashboard__card-row-title">${title}</h3>
      <div class="dashboard__card-row-scroll">
        ${filtered.map(renderStatCard).join('')}
      </div>
    </div>`;
}

function renderCardAnalytics() {
  const el = document.getElementById('card-analytics');
  if (!el) return;

  const filterBtn = (value, label) => {
    const active = cardDeckFilter === value ? 'dashboard__filter-btn--active' : '';
    return `<button class="dashboard__filter-btn ${active}" onclick="window.dash.setDeckFilter('${value}')">${label}</button>`;
  };

  el.innerHTML = `
    <h2 class="dashboard__section-title">Card Analytics</h2>
    <div class="dashboard__filter-bar">
      ${filterBtn('all', 'All')}
      ${filterBtn('die', 'Die')}
      ${filterBtn('living', 'Live')}
      ${filterBtn('bye', 'Bye')}
    </div>
    ${renderCardRow('Most Played', cardStats.mostPlayed)}
    ${renderCardRow('Least Played', cardStats.leastPlayed)}
    ${renderCardRow('Highest Win Rate (3+ plays)', cardStats.highestWinRate)}
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
      <div class="dashboard__content" id="card-analytics"></div>
    </div>
  `;
  renderStats();
  renderGameList();
  renderCardAnalytics();
}

// ── Init ─────────────────────────────────────────────
window.dash = { cyclePlayTime, toggleGame, setDeckFilter };

document.addEventListener('DOMContentLoaded', async () => {
  renderPage();
  await Promise.all([fetchGames(), fetchStats(), fetchCardStats()]);
  renderStats();
  renderGameList();
  renderCardAnalytics();
});
