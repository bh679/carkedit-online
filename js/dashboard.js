// CarkedIt Online — Game Dashboard (standalone)
'use strict';

const API_BASE = '';  // Same origin
let games = [];
let gamesTotalCount = 0;
let gamesPageSize = 5;
let gamesOffset = 0;
let stats = {};
let weekStats = {};
let monthStats = {};
let liveStats = { activeGames: 0, activePlayers: 0 };
let playTimeMode = 'total'; // 'total' | 'average' | 'median' | 'longest'
let gamesCountMode = 'finished'; // 'finished' | 'total' | 'abandoned' | 'live'
let expandedGameId = null;

// Game filters
let filterDateRange = 'today'; // 'all' | 'today' | 'week' | 'month'
let filterErrorsOnly = false;
let filterDev = 'all'; // 'all' | 'dev' | 'nodev'
let filterStatus = 'all'; // 'all' | 'finished' | 'abandoned' | 'live'

// Card data lookup (loaded from JSON files for images)
const cardDataMap = {}; // key: `${deck}-${id}` → card object with illustrationKey

async function loadCardData() {
  const deckFiles = [
    { file: 'js/data/cards/die.json', deck: 'die', deckType: 'die' },
    { file: 'js/data/cards/live.json', deck: 'living', deckType: 'live' },
    { file: 'js/data/cards/bye.json', deck: 'bye', deckType: 'bye' },
  ];
  await Promise.all(deckFiles.map(async ({ file, deck, deckType }) => {
    try {
      const res = await fetch(file);
      if (!res.ok) return;
      const cards = await res.json();
      for (const c of cards) {
        cardDataMap[`${deck}-${c.id}`] = { ...c, deck, deckType };
      }
    } catch {}
  }));
}

function getCardImage(cardId, cardDeck) {
  const data = cardDataMap[`${cardDeck}-${cardId}`];
  if (data?.illustrationKey) {
    const deckType = cardDeck === 'living' ? 'live' : cardDeck === 'bye' ? 'bye' : 'die';
    return `assets/illustrations/${deckType}/${data.illustrationKey}.jpg`;
  }
  return null;
}

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
function buildGamesUrl(limit, offset) {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  if (filterDateRange !== 'all') {
    const now = new Date();
    let dateFrom;
    if (filterDateRange === 'today') {
      dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (filterDateRange === 'week') {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1; // Monday = start of week
      dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
    } else if (filterDateRange === 'month') {
      dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    if (dateFrom) params.set('dateFrom', dateFrom.toISOString());
  }
  if (filterErrorsOnly) params.set('errorsOnly', 'true');
  if (filterDev !== 'all') params.set('dev', filterDev);
  if (filterStatus !== 'all') params.set('status', filterStatus);
  return `${API_BASE}/api/carkedit/games?${params}`;
}

async function fetchGames(append = false) {
  try {
    const offset = append ? games.length : 0;
    const res = await fetch(buildGamesUrl(gamesPageSize, offset));
    if (!res.ok) return;
    const data = await res.json();
    if (append) {
      games = [...games, ...(data.games || [])];
    } else {
      games = data.games || [];
    }
    gamesTotalCount = data.total || 0;
  } catch (err) {
    console.warn('[dashboard] Failed to fetch games:', err);
  }
}

async function loadMoreGames() {
  await fetchGames(true);
  renderGameList();
}

async function applyGameFilters() {
  await fetchGames(false);
  renderGameList();
}

function setGameFilter(key, value) {
  if (key === 'errorsOnly') filterErrorsOnly = value;
  if (key === 'dev') filterDev = value;
  if (key === 'status') filterStatus = value;
  applyGameFilters();
}

function cycleStatus() {
  const opts = ['all', 'finished', 'abandoned', 'live'];
  const idx = opts.indexOf(filterStatus);
  filterStatus = opts[(idx + 1) % opts.length];
  applyGameFilters();
}

function cycleDev() {
  const opts = ['all', 'nodev', 'dev'];
  const idx = opts.indexOf(filterDev);
  filterDev = opts[(idx + 1) % opts.length];
  applyGameFilters();
}

function cycleDateRange() {
  const opts = ['all', 'today', 'week', 'month'];
  const idx = opts.indexOf(filterDateRange);
  filterDateRange = opts[(idx + 1) % opts.length];
  applyGameFilters();
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

async function fetchPeriodStats() {
  const now = new Date();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  try {
    const [weekRes, monthRes, liveRes] = await Promise.all([
      fetch(`${API_BASE}/api/carkedit/games/stats?since=${weekAgo}`),
      fetch(`${API_BASE}/api/carkedit/games/stats?since=${monthAgo}`),
      fetch(`${API_BASE}/api/carkedit/games/stats/live`),
    ]);
    if (weekRes.ok) weekStats = await weekRes.json();
    if (monthRes.ok) monthStats = await monthRes.json();
    if (liveRes.ok) liveStats = await liveRes.json();
  } catch (err) {
    console.warn('[dashboard] Failed to fetch period stats:', err);
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

function getGamesCountValue() {
  switch (gamesCountMode) {
    case 'total': return stats.totalGames || 0;
    case 'abandoned': return stats.abandonedGames || 0;
    case 'live': return stats.liveGames || 0;
    default: return stats.finishedGames ?? stats.totalGames ?? 0;
  }
}

function getGamesCountLabel() {
  switch (gamesCountMode) {
    case 'total': return 'Total Games';
    case 'abandoned': return 'Abandoned Games';
    case 'live': return 'Live Games';
    default: return 'Finished Games';
  }
}

function cycleGamesCount() {
  const modes = ['finished', 'total', 'abandoned', 'live'];
  const idx = modes.indexOf(gamesCountMode);
  gamesCountMode = modes[(idx + 1) % modes.length];
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

// ── Period Sub-Card Helpers ──────────────────────────
function getGamesCountFromStats(s) {
  switch (gamesCountMode) {
    case 'total': return s.totalGames || 0;
    case 'abandoned': return s.abandonedGames || 0;
    case 'live': return s.liveGames || 0;
    default: return s.finishedGames ?? s.totalGames ?? 0;
  }
}

function getPlayTimeFromStats(s) {
  switch (playTimeMode) {
    case 'average': return s.avgPlayTime || 0;
    case 'median': return s.medianPlayTime || 0;
    case 'longest': return s.longestPlayTime || 0;
    default: return s.totalPlayTime || 0;
  }
}

function getLiveGamesCount() {
  return liveStats.activeGames || 0;
}

function getLivePlayers() {
  return liveStats.activePlayers || 0;
}

function renderSubCards(liveVal, weekVal, monthVal, isTime) {
  const fmt = v => isTime ? formatDuration(v) : v;
  return `
    <div class="dashboard__stat-breakdown">
      <div class="dashboard__stat-sub">
        <span class="dashboard__stat-sub-value">${fmt(liveVal)}</span>
        <span class="dashboard__stat-sub-label">Live</span>
      </div>
      <div class="dashboard__stat-sub">
        <span class="dashboard__stat-sub-value">${fmt(weekVal)}</span>
        <span class="dashboard__stat-sub-label">Week</span>
      </div>
      <div class="dashboard__stat-sub">
        <span class="dashboard__stat-sub-value">${fmt(monthVal)}</span>
        <span class="dashboard__stat-sub-label">Month</span>
      </div>
    </div>`;
}

// ── Rendering ────────────────────────────────────────
function renderStats() {
  const el = document.getElementById('stats-bar');
  if (!el) return;
  el.innerHTML = `
    <div class="dashboard__stat-group">
      <div class="dashboard__stat dashboard__stat--clickable" onclick="window.dash.cycleGamesCount()">
        <span class="dashboard__stat-value">${getGamesCountValue()}</span>
        <span class="dashboard__stat-label">${getGamesCountLabel()}</span>
      </div>
      ${renderSubCards(getLiveGamesCount(), getGamesCountFromStats(weekStats), getGamesCountFromStats(monthStats), false)}
    </div>
    <div class="dashboard__stat-group">
      <div class="dashboard__stat">
        <span class="dashboard__stat-value">${stats.totalPlayers ?? 0}</span>
        <span class="dashboard__stat-label">Total Players</span>
      </div>
      ${renderSubCards(getLivePlayers(), weekStats.totalPlayers ?? 0, monthStats.totalPlayers ?? 0, false)}
    </div>
    <div class="dashboard__stat-group">
      <div class="dashboard__stat dashboard__stat--clickable" onclick="window.dash.cyclePlayTime()">
        <span class="dashboard__stat-value">${formatDuration(getPlayTimeValue())}</span>
        <span class="dashboard__stat-label">${getPlayTimeLabel()}</span>
      </div>
      ${renderSubCards(0, getPlayTimeFromStats(weekStats), getPlayTimeFromStats(monthStats), true)}
    </div>
  `;
}

// ── Card Preview Modal ───────────────────────────────

function escAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
}

function previewCard(text, deck, cardId) {
  const deckType = deck === 'living' ? 'live' : deck === 'bye' ? 'bye' : 'die';
  const imgSrc = cardId ? getCardImage(cardId, deck) : null;
  const overlay = document.getElementById('card-preview-overlay');
  if (!overlay) return;
  overlay.innerHTML = `
    <div class="preview__backdrop" onclick="window.dash.closePreview()"></div>
    <div class="preview__card-wrap">
      <div class="card card--${deckType}">
        ${imgSrc
          ? `<img src="${imgSrc}" alt="${text}" class="card__img">`
          : `<div class="card__image"><div class="card__image-placeholder"></div></div>
             <div class="card__body"><h3 class="card__title">${text}</h3></div>`}
      </div>
    </div>`;
  overlay.style.display = 'flex';
}

function closePreview() {
  const overlay = document.getElementById('card-preview-overlay');
  if (overlay) { overlay.style.display = 'none'; overlay.innerHTML = ''; }
}

// ── Game Detail Rendering (3-row expanded view) ──────

function renderMiniCard(text, deck, cardId) {
  const deckType = deck === 'living' ? 'live' : deck === 'bye' ? 'bye' : 'die';
  const imgSrc = cardId ? getCardImage(cardId, deck) : null;
  const idAttr = cardId ? `, '${escAttr(cardId)}'` : '';
  return `
    <div class="card card--${deckType} detail__mini-card" onclick="event.stopPropagation(); window.dash.previewCard('${escAttr(text)}', '${escAttr(deck)}'${idAttr})">
      ${imgSrc
        ? `<img src="${imgSrc}" alt="${text}" class="card__img">`
        : `<div class="card__body"><h3 class="card__title">${text}</h3></div>`}
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
            ${renderMiniCard(c.card_text, c.card_deck, c.card_id)}
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
        ${renderMiniCard(c.card_text, c.card_deck, c.card_id)}
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

function formatTimeAgo(isoDate) {
  if (!isoDate) return '';
  const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function renderGameCard(game) {
  const cls = rowClass(game);
  const expanded = expandedGameId === game.id;
  const errorFlag = game.has_error ? '<span class="dashboard__flag dashboard__flag--error" title="Error">!</span>' : '';
  const liveLabel = liveStatusLabel(game.live_status);
  const liveBadge = liveLabel ? `<span class="dashboard__badge dashboard__badge--${game.live_status}">${liveLabel}</span>` : '';

  // For live/abandoned games with no finished_at, show started_at and last activity
  const isLive = game.live_status === 'live';
  const dateDisplay = (isLive && game.started_at) ? formatDateTime(game.started_at) : formatDateTime(game.finished_at);
  const lastActivity = (isLive && game.last_activity_at) ? `<span class="dashboard__cell dashboard__cell--activity" title="Last activity">${formatTimeAgo(game.last_activity_at)}</span>` : '';

  let detail = '';
  if (expanded) {
    const gd = gameDetailCache[game.id] || game;
    detail = renderGameDetail(gd);
  }

  return `
    <div class="dashboard__card ${cls}" onclick="window.dash.toggleGame('${game.id}')">
      <div class="dashboard__card-row">
        <span class="dashboard__cell dashboard__cell--date">${dateDisplay}</span>
        <span class="dashboard__cell dashboard__cell--host">${maskName(game.host_name)}</span>
        <span class="dashboard__cell dashboard__cell--players">${game.player_count} players</span>
        <span class="dashboard__cell dashboard__cell--time">${isLive ? (lastActivity || '—') : formatDuration(game.duration_seconds)}</span>
        <span class="dashboard__cell dashboard__cell--status">${statusLabel(game.status)}</span>
        <span class="dashboard__cell dashboard__cell--live">${liveBadge}</span>
        <span class="dashboard__cell dashboard__cell--error">${errorFlag}</span>
      </div>
      ${detail}
    </div>
  `;
}

function renderGameFilters() {
  const statusLabels = { all: 'All Status', finished: 'Finished', abandoned: 'Abandon', live: 'Live' };
  const devLabels = { all: 'All Dev', nodev: 'No Dev', dev: 'Dev Only' };
  const dateLabels = { all: 'All Time', today: 'Today', week: 'This Week', month: 'This Month' };
  const errActive = filterErrorsOnly ? 'dashboard__filter-btn--active' : '';
  const statusActive = filterStatus !== 'all' ? 'dashboard__filter-btn--active' : '';
  const devActive = filterDev !== 'all' ? 'dashboard__filter-btn--active' : '';
  const dateActive = filterDateRange !== 'all' ? 'dashboard__filter-btn--active' : '';

  return `
    <div class="dashboard__game-filters">
      <button class="dashboard__filter-btn ${dateActive}" onclick="window.dash.cycleDateRange()">${dateLabels[filterDateRange]}</button>
      <button class="dashboard__filter-btn ${errActive}" onclick="window.dash.setGameFilter('errorsOnly', ${!filterErrorsOnly})">Errors</button>
      <button class="dashboard__filter-btn ${devActive}" onclick="window.dash.cycleDev()">${devLabels[filterDev]}</button>
      <button class="dashboard__filter-btn ${statusActive}" onclick="window.dash.cycleStatus()">${statusLabels[filterStatus]}</button>
    </div>`;
}

function renderGameList() {
  const el = document.getElementById('game-list');
  if (!el) return;

  const hasMore = games.length < gamesTotalCount;
  const loadMoreBtn = hasMore
    ? `<button class="dashboard__load-more" onclick="window.dash.loadMoreGames()">Load more (${games.length} of ${gamesTotalCount})</button>`
    : '';

  el.innerHTML = `
    ${renderGameFilters()}
    ${games.length === 0 ? '<p class="dashboard__empty">No games match filters.</p>' : `
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
      ${loadMoreBtn}
    `}
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
  const imgSrc = getCardImage(card.card_id, card.card_deck);
  const idAttr = card.card_id ? `, '${escAttr(String(card.card_id))}'` : '';
  return `
    <div class="dashboard__stat-card-wrap" onclick="window.dash.previewCard('${escAttr(card.card_text)}', '${escAttr(card.card_deck)}'${idAttr})">
      <div class="card card--${deckType}">
        ${imgSrc
          ? `<img src="${imgSrc}" alt="${card.card_text}" class="card__img">`
          : `<div class="card__image"><div class="card__image-placeholder"></div></div>
             <div class="card__body"><h3 class="card__title">${card.card_text}</h3></div>`}
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
    ? `<div class="dashboard__card-row-wrapper">
        <button class="dashboard__scroll-btn dashboard__scroll-btn--left" id="card-scroll-left" onclick="window.dash.scrollCards(-1)" aria-label="Scroll left" style="display:none">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div class="dashboard__card-row-scroll" id="card-scroll-row">${filtered.map(renderStatCard).join('')}</div>
        <button class="dashboard__scroll-btn dashboard__scroll-btn--right" id="card-scroll-right" onclick="window.dash.scrollCards(1)" aria-label="Scroll right">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>`
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

  // Check arrow visibility after render, and listen for manual scroll
  requestAnimationFrame(() => {
    updateScrollArrows();
    const row = document.getElementById('card-scroll-row');
    if (row) row.addEventListener('scroll', updateScrollArrows);
  });
}

function scrollCards(direction) {
  const el = document.getElementById('card-scroll-row');
  if (el) {
    el.scrollBy({ left: direction * 300, behavior: 'smooth' });
    // Update arrows after scroll animation
    setTimeout(updateScrollArrows, 350);
  }
}

function updateScrollArrows() {
  const el = document.getElementById('card-scroll-row');
  const left = document.getElementById('card-scroll-left');
  const right = document.getElementById('card-scroll-right');
  if (!el || !left || !right) return;

  const atStart = el.scrollLeft <= 5;
  const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 5;

  left.style.display = atStart ? 'none' : 'flex';
  right.style.display = atEnd ? 'none' : 'flex';
}

// ── Graphs ───────────────────────────────────────────

function renderGraph() {
  const canvas = document.getElementById('games-over-time');
  if (!canvas || games.length === 0) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const W = rect.width;
  const H = rect.height;

  // Group games by date
  const dayCounts = {};
  for (const g of games) {
    const dateStr = g.finished_at || g.started_at;
    if (!dateStr) continue;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) continue;
    const key = d.toISOString().slice(0, 10);
    dayCounts[key] = (dayCounts[key] || 0) + 1;
  }

  // Build sorted date range (fill gaps)
  const dates = Object.keys(dayCounts).sort();
  if (dates.length === 0) return;

  const start = new Date(dates[0]);
  const end = new Date(dates[dates.length - 1]);
  const allDates = [];
  const allCounts = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    allDates.push(key);
    allCounts.push(dayCounts[key] || 0);
  }
  if (allDates.length === 0) return;

  const maxCount = Math.max(...allCounts, 1);
  const pad = { top: 20, right: 20, bottom: 30, left: 40 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  // Background
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim() || '#252540';
  ctx.fillRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  const ySteps = Math.min(maxCount, 5);
  for (let i = 0; i <= ySteps; i++) {
    const y = pad.top + plotH - (i / ySteps) * plotH;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + plotW, y);
    ctx.stroke();
    // Y labels
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'right';
    ctx.fillText(String(Math.round(i / ySteps * maxCount)), pad.left - 6, y + 3);
  }

  // Bars
  const barW = Math.max(2, (plotW / allDates.length) - 2);
  const primary = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#9842FF';
  ctx.fillStyle = primary;

  for (let i = 0; i < allCounts.length; i++) {
    const x = pad.left + (i / allDates.length) * plotW + 1;
    const barH = (allCounts[i] / maxCount) * plotH;
    const y = pad.top + plotH - barH;
    ctx.fillRect(x, y, barW, barH);
  }

  // X labels (show first, last, and a few in between)
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '9px system-ui';
  ctx.textAlign = 'center';
  const labelCount = Math.min(allDates.length, 6);
  if (labelCount <= 1) {
    if (allDates.length > 0) {
      ctx.fillText(allDates[0].slice(5), pad.left + plotW / 2, H - 8);
    }
  } else {
    for (let i = 0; i < labelCount; i++) {
      const idx = Math.round(i / (labelCount - 1) * (allDates.length - 1));
      const x = pad.left + (idx / allDates.length) * plotW + barW / 2;
      const label = allDates[idx].slice(5); // MM-DD
      ctx.fillText(label, x, H - 8);
    }
  }
}

function renderPage() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="dashboard">
      <header class="dashboard__header">
        <h1 class="dashboard__title">CarkedIt — Game Dashboard
          <span class="dashboard__versions">
            <span id="dash-version-client" class="dashboard__version-item" data-tooltip="Checking...">...<span class="version-dot version-dot--checking"></span></span>
            <span id="dash-version-server" class="dashboard__version-item" data-tooltip="Checking...">...<span class="version-dot version-dot--checking"></span></span>
            <span id="dash-refresh-timer" class="dashboard__refresh-timer">${REFRESH_INTERVAL}s</span>
            <button class="dashboard__refresh-btn" onclick="window.dash.refreshNow()" title="Refresh now">&#x21bb;</button>
          </span>
        </h1>
      </header>

      <section class="dashboard__section">
        <h2 class="dashboard__section-title">Key Stats</h2>
        <div class="dashboard__stats" id="stats-bar"></div>
      </section>

      <section class="dashboard__section">
        <h2 class="dashboard__section-title">Games</h2>
        <div id="game-list"></div>
      </section>

      <section class="dashboard__section">
        <h2 class="dashboard__section-title">Cards</h2>
        <div id="card-analytics"></div>
      </section>

      <section class="dashboard__section">
        <h2 class="dashboard__section-title">Graphs</h2>
        <div class="dashboard__graph-wrap">
          <h3 class="dashboard__graph-label">Games Over Time</h3>
          <canvas id="games-over-time" class="dashboard__graph-canvas"></canvas>
        </div>
      </section>
    </div>
    <div id="card-preview-overlay" class="preview__overlay" style="display:none"></div>
  `;
  renderStats();
  renderGameList();
  renderCardAnalytics();
  renderGraph();
}

// ── Auto-Refresh ────────────────────────────────────
const REFRESH_INTERVAL = 30;
let refreshCountdown = REFRESH_INTERVAL;

async function refreshAll() {
  await Promise.all([fetchGames(), fetchStats(), fetchPeriodStats(), fetchCardStats()]);
  renderStats();
  renderGameList();
  renderCardAnalytics();
  renderGraph();
  refreshCountdown = REFRESH_INTERVAL;
}

function refreshNow() {
  refreshCountdown = REFRESH_INTERVAL;
  updateRefreshTimer();
  refreshAll();
}

function updateRefreshTimer() {
  const el = document.getElementById('dash-refresh-timer');
  if (el) el.textContent = `${refreshCountdown}s`;
}

// ── Init ─────────────────────────────────────────────
window.dash = { cyclePlayTime, cycleGamesCount, toggleGame, setDeckFilter, setCardSort, previewCard, closePreview, scrollCards, loadMoreGames, applyGameFilters, setGameFilter, refreshNow, cycleStatus, cycleDev, cycleDateRange };

document.addEventListener('DOMContentLoaded', async () => {
  renderPage();

  // --- Version tooltip that follows the mouse ---
  const tooltip = document.createElement('div');
  tooltip.className = 'dashboard__tooltip';
  document.body.appendChild(tooltip);

  document.querySelectorAll('.dashboard__version-item').forEach(el => {
    el.addEventListener('mouseenter', () => {
      const text = el.getAttribute('data-tooltip');
      if (text) { tooltip.textContent = text; tooltip.style.display = 'block'; }
    });
    el.addEventListener('mousemove', (e) => {
      tooltip.style.left = e.clientX + 12 + 'px';
      tooltip.style.top = e.clientY + 12 + 'px';
    });
    el.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
  });

  // --- Version display with GitHub sync status ---
  function updateVersionEl(el, label, localVer, ghVer, extra) {
    if (!el) return;
    const dot = el.querySelector('.version-dot');
    el.childNodes[0].textContent = `${label}: v${localVer} `;
    if (ghVer === null) {
      if (dot) { dot.className = 'version-dot version-dot--checking'; }
      el.setAttribute('data-tooltip', extra || 'Checking GitHub...');
    } else if (localVer === ghVer) {
      if (dot) { dot.className = 'version-dot version-dot--current'; }
      el.setAttribute('data-tooltip', `Up to date with GitHub${extra ? ' \u2014 ' + extra : ''}`);
    } else {
      if (dot) { dot.className = 'version-dot version-dot--outdated'; }
      el.setAttribute('data-tooltip', `GitHub has v${ghVer}${extra ? ' \u2014 ' + extra : ''}`);
    }
  }

  // Fetch client version
  fetch('package.json').then(r => r.json()).then(pkg => {
    const el = document.getElementById('dash-version-client');
    updateVersionEl(el, 'Client', pkg.version, null, 'Checking GitHub...');
    fetch('https://raw.githubusercontent.com/bh679/carkedit-online/main/package.json')
      .then(r => r.json())
      .then(ghPkg => updateVersionEl(el, 'Client', pkg.version, ghPkg.version))
      .catch(() => updateVersionEl(el, 'Client', pkg.version, null, 'Could not check GitHub'));
  }).catch(() => {});

  // Fetch server version
  fetch('/api/carkedit/version').then(r => r.json()).then(data => {
    const el = document.getElementById('dash-version-server');
    const started = data.startedAt ? `Started: ${new Date(data.startedAt).toLocaleString()}` : '';
    updateVersionEl(el, 'Server', data.version, null, started || 'Checking GitHub...');
    fetch('https://raw.githubusercontent.com/bh679/carkedit-api/main/package.json')
      .then(r => r.json())
      .then(ghPkg => updateVersionEl(el, 'Server', data.version, ghPkg.version, started))
      .catch(() => updateVersionEl(el, 'Server', data.version, null, started || 'Could not check GitHub'));
  }).catch(() => {});

  await Promise.all([fetchGames(), fetchStats(), fetchPeriodStats(), fetchCardStats(), loadCardData()]);
  renderStats();
  renderGameList();
  renderCardAnalytics();
  renderGraph();

  // Countdown timer — tick every second, refresh at 0
  setInterval(() => {
    refreshCountdown--;
    updateRefreshTimer();
    if (refreshCountdown <= 0) {
      refreshAll();
    }
  }, 1000);
});
