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
const gameDetailCache = {};

async function toggleGame(gameId) {
  if (expandedGameId === gameId) {
    expandedGameId = null;
    renderGameList();
    return;
  }
  expandedGameId = gameId;
  // Fetch full detail if not cached
  if (!gameDetailCache[gameId]) {
    try {
      const res = await fetch(`${API_BASE}/api/carkedit/games/${gameId}`);
      if (res.ok) gameDetailCache[gameId] = await res.json();
    } catch (err) {
      console.warn('[dashboard] Failed to fetch game detail:', err);
    }
  }
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

// ── Game Detail Rendering (3-row expanded view) ──────

function renderMiniCard(text, deck) {
  const deckType = deck === 'living' ? 'live' : deck === 'bye' ? 'bye' : 'die';
  return `
    <div class="card card--${deckType} detail__mini-card">
      <div class="card__body">
        <h3 class="card__title">${text}</h3>
      </div>
    </div>`;
}

function renderSettingsCard(gd) {
  let settings = {};
  try { settings = gd.settings_json ? JSON.parse(gd.settings_json) : {}; } catch {}

  const settingRows = Object.entries(settings).map(([k, v]) =>
    `<div class="detail__setting-row"><span class="detail__setting-key">${k}</span><span class="detail__setting-val">${v}</span></div>`
  ).join('');

  return `
    <div class="detail__panel">
      <h4 class="detail__panel-title">Settings & Versions</h4>
      <div class="detail__versions">
        <span>API: ${gd.api_version || '—'}</span>
        <span>Client: ${gd.client_version || '—'}</span>
        <span>Mode: ${gd.mode}</span>
        <span>Rounds: ${gd.rounds}</span>
        ${gd.room_code ? `<span>Room: ${gd.room_code}</span>` : ''}
      </div>
      ${settingRows ? `<div class="detail__settings-grid">${settingRows}</div>` : ''}
    </div>`;
}

function renderPlayersCard(gd) {
  const cardPlays = gd.card_plays || [];
  const players = (gd.players || []).map(p => {
    // Find cards this player played
    const played = cardPlays.filter(c => c.player_name === p.player_name);
    const winningCards = played.filter(c => c.is_winner);
    const isWinner = p.rank === 1;

    const cardsHtml = played.length > 0
      ? `<div class="detail__player-cards">${played.map(c =>
          `<div class="detail__mini-card-wrap ${c.is_winner ? 'detail__mini-card-wrap--winner' : ''}">
            ${renderMiniCard(c.card_text, c.card_deck)}
          </div>`
        ).join('')}</div>`
      : '';

    return `
      <div class="detail__player ${isWinner ? 'detail__player--winner' : ''}">
        <div class="detail__player-header">
          <span class="detail__player-rank">#${p.rank}</span>
          <span class="detail__player-name">${maskName(p.player_name)}${isWinner ? ' ★' : ''}</span>
          <span class="detail__player-score">${p.score} pts</span>
        </div>
        ${cardsHtml}
      </div>`;
  }).join('');

  return `
    <div class="detail__panel detail__panel--wide">
      <h4 class="detail__panel-title">Players</h4>
      ${players}
    </div>`;
}

function renderPhaseCards(gd) {
  const cardPlays = gd.card_plays || [];
  if (cardPlays.length === 0) return '';

  // Group by phase + round
  const phases = {};
  for (const cp of cardPlays) {
    const key = `${cp.phase}-${cp.round}`;
    if (!phases[key]) phases[key] = { phase: cp.phase, round: cp.round, cards: [], winner: null };
    phases[key].cards.push(cp);
    if (cp.is_winner) phases[key].winner = cp;
  }

  const phaseCards = Object.values(phases).map(p => {
    const phaseName = p.phase === 'living' ? 'Live' : p.phase === 'bye' ? 'Bye' : p.phase;
    const winnerText = p.winner ? `Winner: ${maskName(p.winner.player_name)}` : '';
    const cardsHtml = p.cards.map(c =>
      `<div class="detail__mini-card-wrap ${c.is_winner ? 'detail__mini-card-wrap--winner' : ''}">
        ${renderMiniCard(c.card_text, c.card_deck)}
        <span class="detail__mini-card-player">${maskName(c.player_name)}</span>
      </div>`
    ).join('');

    return `
      <div class="detail__phase-card">
        <div class="detail__phase-header">
          <span class="detail__phase-name">${phaseName} — Round ${p.round}</span>
          <span class="detail__phase-stats">${p.cards.length} cards${winnerText ? ' · ' + winnerText : ''}</span>
        </div>
        <div class="detail__phase-cards">${cardsHtml}</div>
      </div>`;
  }).join('');

  return `
    <div class="detail__row">
      <h4 class="detail__row-title">Phases</h4>
      <div class="detail__phases-row">${phaseCards}</div>
    </div>`;
}

function renderDebugCard(gd) {
  return `
    <div class="detail__row detail__row--debug">
      <h4 class="detail__row-title">Debug</h4>
      <div class="detail__debug">
        <span>ID: ${gd.id}</span>
        <span>Started: ${gd.started_at || '—'}</span>
        <span>Finished: ${gd.finished_at}</span>
        <span>Duration: ${formatDuration(gd.duration_seconds)}</span>
        <span>Status: ${gd.status} / ${gd.live_status}</span>
        <span>Error: ${gd.has_error ? 'Yes' : 'No'}</span>
        <span>Dev: ${gd.is_dev ? 'Yes' : 'No'}</span>
        ${gd.room_code ? `<span>Room code: ${gd.room_code}</span>` : ''}
      </div>
    </div>`;
}

function renderGameDetail(gd) {
  return `
    <div class="dashboard__detail" onclick="event.stopPropagation()">
      <div class="detail__row detail__row--top">
        ${renderSettingsCard(gd)}
        ${renderPlayersCard(gd)}
      </div>
      ${renderPhaseCards(gd)}
      ${renderDebugCard(gd)}
    </div>`;
}

function renderGameCard(game) {
  const cls = rowClass(game);
  const expanded = expandedGameId === game.id;
  const errorFlag = game.has_error ? '<span class="dashboard__flag dashboard__flag--error" title="Error">!</span>' : '';
  const liveLabel = liveStatusLabel(game.live_status);
  const liveBadge = liveLabel ? `<span class="dashboard__badge dashboard__badge--${game.live_status}">${liveLabel}</span>` : '';

  let detail = '';
  if (expanded) {
    const gd = gameDetailCache[game.id] || game;
    detail = renderGameDetail(gd);
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
let cardSortMode = 'mostPlayed'; // 'mostPlayed' | 'leastPlayed' | 'highestWinRate'

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

function setCardSort(mode) {
  cardSortMode = mode;
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

function getActiveCards() {
  switch (cardSortMode) {
    case 'leastPlayed': return cardStats.leastPlayed;
    case 'highestWinRate': return cardStats.highestWinRate;
    default: return cardStats.mostPlayed;
  }
}

function renderCardAnalytics() {
  const el = document.getElementById('card-analytics');
  if (!el) return;

  const filterBtn = (value, label) => {
    const active = cardDeckFilter === value ? 'dashboard__filter-btn--active' : '';
    return `<button class="dashboard__filter-btn ${active}" onclick="window.dash.setDeckFilter('${value}')">${label}</button>`;
  };

  const sortOption = (value, label) =>
    `<option value="${value}" ${cardSortMode === value ? 'selected' : ''}>${label}</option>`;

  const filtered = filterCards(getActiveCards());
  const cardsHtml = filtered.length > 0
    ? `<div class="dashboard__card-row-scroll">${filtered.map(renderStatCard).join('')}</div>`
    : '<p class="dashboard__card-row-empty">No data yet</p>';

  el.innerHTML = `
    <div class="dashboard__card-analytics-header">
      <select class="dashboard__sort-select" onchange="window.dash.setCardSort(this.value)">
        ${sortOption('mostPlayed', 'Most Played')}
        ${sortOption('leastPlayed', 'Least Played')}
        ${sortOption('highestWinRate', 'Highest Win Rate (3+ plays)')}
      </select>
      <div class="dashboard__filter-bar">
        ${filterBtn('all', 'All')}
        ${filterBtn('die', 'Die')}
        ${filterBtn('living', 'Live')}
        ${filterBtn('bye', 'Bye')}
      </div>
    </div>
    ${cardsHtml}
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
window.dash = { cyclePlayTime, toggleGame, setDeckFilter, setCardSort };

document.addEventListener('DOMContentLoaded', async () => {
  renderPage();
  await Promise.all([fetchGames(), fetchStats(), fetchCardStats()]);
  renderStats();
  renderGameList();
  renderCardAnalytics();
});
