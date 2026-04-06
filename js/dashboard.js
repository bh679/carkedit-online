// CarkedIt Online — Game Dashboard (standalone)
'use strict';

// ── Firebase Auth for Admin Gate ────────────────────
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyC6QJz6jTzJkBWV7Shd9XpCfHWrovJ9vaI",
  authDomain: "carkedit-5cc8e.firebaseapp.com",
  projectId: "carkedit-5cc8e",
  storageBucket: "carkedit-5cc8e.firebasestorage.app",
  messagingSenderId: "144073275425",
  appId: "1:144073275425:web:2301fbbccc2be69c654b60",
};

let firebaseAuth = null;
let authToken = null;
let authUser = null; // local user from /users/me
let firebaseUserInfo = null; // { displayName, photoURL, email }

async function loadFirebaseAuth() {
  const [appMod, authMod] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js'),
  ]);
  const app = appMod.initializeApp(FIREBASE_CONFIG);
  firebaseAuth = authMod.getAuth(app);
  return authMod;
}

function authHeaders() {
  const h = {};
  if (authToken) h['Authorization'] = `Bearer ${authToken}`;
  return h;
}

function authFetch(url, opts = {}) {
  opts.headers = { ...opts.headers, ...authHeaders() };
  return fetch(url, opts);
}

const API_BASE = '';  // Same origin
let games = [];
let gamesTotalCount = 0;
let gamesPageSize = 5;
let gamesOffset = 0;
let stats = {};
let weekStats = {};
let monthStats = {};
let dayStats = {};
let liveStats = { activeGames: 0, activePlayers: 0 };
let playTimeMode = 'total'; // 'total' | 'average' | 'median' | 'longest'
let gamesCountMode = 'finished'; // 'finished' | 'total' | 'abandoned' | 'day'
let expandedGameId = null;

// Game filters
let filterDateRange = 'today'; // 'all' | 'today' | 'week' | 'month'
let filterErrorsOnly = false;
let filterDev = 'nodev'; // 'all' | 'dev' | 'nodev'
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

// ── Responsive Helper ───────────────────────────────────
const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

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

function formatDurationCompact(seconds) {
  if (!seconds && seconds !== 0) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
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
    const res = await authFetch(buildGamesUrl(gamesPageSize, offset));
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
  const opts = ['nodev', 'all', 'dev'];
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
    const res = await authFetch(`${API_BASE}/api/carkedit/games/stats`);
    if (!res.ok) return;
    stats = await res.json();
  } catch (err) {
    console.warn('[dashboard] Failed to fetch stats:', err);
  }
}

async function fetchPeriodStats() {
  const now = new Date();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  try {
    const [dayRes, weekRes, monthRes, liveRes] = await Promise.all([
      authFetch(`${API_BASE}/api/carkedit/games/stats?since=${dayAgo}`),
      authFetch(`${API_BASE}/api/carkedit/games/stats?since=${weekAgo}`),
      authFetch(`${API_BASE}/api/carkedit/games/stats?since=${monthAgo}`),
      authFetch(`${API_BASE}/api/carkedit/games/stats/live`),
    ]);
    if (dayRes.ok) dayStats = await dayRes.json();
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
    case 'day': return dayStats.finishedGames ?? dayStats.totalGames ?? 0;
    default: return stats.finishedGames ?? stats.totalGames ?? 0;
  }
}

function getGamesCountLabel() {
  switch (gamesCountMode) {
    case 'total': return 'Total Games';
    case 'abandoned': return 'Abandoned Games';
    case 'day': return 'Games Today';
    default: return 'Finished Games';
  }
}

function cycleGamesCount() {
  const modes = ['finished', 'total', 'abandoned', 'day'];
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
  // Always re-fetch for live games (data changes during gameplay), cache finished games
  const cachedGame = gameDetailCache[gameId];
  const isLive = !cachedGame || cachedGame.live_status === 'live';
  if (!cachedGame || isLive) {
    try {
      const res = await authFetch(`${API_BASE}/api/carkedit/games/${gameId}`);
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
    case 'day': return s.finishedGames ?? s.totalGames ?? 0;
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

let previewIndex = -1;

function getPreviewCards() {
  return filterCards(getActiveCards());
}

function renderPreviewStats(card) {
  if (!card) return '';
  const draws = card.draw_count || 0;
  return `
    <div class="preview__stats">
      <div class="preview__stat">
        <span class="preview__stat-value">${card.play_count}/${draws}</span>
        <span class="preview__stat-label">Plays / Draws</span>
      </div>
      <div class="preview__stat">
        <span class="preview__stat-value">${draws > 0 ? card.play_rate + '%' : '—'}</span>
        <span class="preview__stat-label">Play Rate</span>
      </div>
      <div class="preview__stat">
        <span class="preview__stat-value">${card.win_count}</span>
        <span class="preview__stat-label">Wins</span>
      </div>
      <div class="preview__stat">
        <span class="preview__stat-value">${card.win_rate}%</span>
        <span class="preview__stat-label">Win Rate</span>
      </div>
    </div>`;
}

function renderPreview() {
  const overlay = document.getElementById('card-preview-overlay');
  if (!overlay) return;
  const cards = getPreviewCards();
  if (previewIndex < 0 || previewIndex >= cards.length) { closePreview(); return; }

  const card = cards[previewIndex];
  const deckType = deckTypeForCard(card.card_deck);
  const imgSrc = getCardImage(card.card_id, card.card_deck);

  const cardHtml = imgSrc
    ? `<div class="card card--${deckType}"><img src="${imgSrc}" alt="${card.card_text}" class="card__img"></div>`
    : `<div class="card card--${deckType}">
        <div class="card__image"><div class="card__image-placeholder"></div></div>
        <div class="card__body"><h3 class="card__title">${card.card_text}</h3></div>
      </div>`;

  const showNav = cards.length > 1;
  const prevBtn = showNav
    ? `<button class="hand__nav-btn hand__nav-btn--prev" onclick="event.stopPropagation(); window.dash.prevPreviewCard()">&#8249;</button>`
    : '';
  const nextBtn = showNav
    ? `<button class="hand__nav-btn hand__nav-btn--next" onclick="event.stopPropagation(); window.dash.nextPreviewCard()">&#8250;</button>`
    : '';

  overlay.innerHTML = `
    <div class="hand__inspect-overlay hand__inspect-overlay--${deckType}" onclick="window.dash.closePreview()">
      ${prevBtn}
      <div class="hand__inspect-card-wrapper" onclick="event.stopPropagation()">
        ${cardHtml}
        ${renderPreviewStats(card)}
        <button class="btn btn--secondary hand__submit-btn" onclick="window.dash.closePreview()">Close</button>
      </div>
      ${nextBtn}
    </div>`;
  overlay.style.display = 'block';
}

function previewCard(text, deck, cardId) {
  const cards = getPreviewCards();
  previewIndex = cards.findIndex(c => String(c.card_id) === String(cardId) && c.card_deck === deck);
  if (previewIndex === -1) {
    // Card not in the analytics list (e.g. from game detail mini-cards) — show standalone
    const overlay = document.getElementById('card-preview-overlay');
    if (!overlay) return;
    const deckType = deckTypeForCard(deck);
    const imgSrc = cardId ? getCardImage(cardId, deck) : null;
    const cardHtml = imgSrc
      ? `<div class="card card--${deckType}"><img src="${imgSrc}" alt="${text}" class="card__img"></div>`
      : `<div class="card card--${deckType}">
          <div class="card__image"><div class="card__image-placeholder"></div></div>
          <div class="card__body"><h3 class="card__title">${text}</h3></div>
        </div>`;
    overlay.innerHTML = `
      <div class="hand__inspect-overlay hand__inspect-overlay--${deckType}" onclick="window.dash.closePreview()">
        <div class="hand__inspect-card-wrapper" onclick="event.stopPropagation()">
          ${cardHtml}
          <button class="btn btn--secondary hand__submit-btn" onclick="window.dash.closePreview()">Close</button>
        </div>
      </div>`;
    overlay.style.display = 'block';
    return;
  }
  renderPreview();
}

function prevPreviewCard() {
  const cards = getPreviewCards();
  if (!cards.length) return;
  previewIndex = (previewIndex - 1 + cards.length) % cards.length;
  renderPreview();
}

function nextPreviewCard() {
  const cards = getPreviewCards();
  if (!cards.length) return;
  previewIndex = (previewIndex + 1) % cards.length;
  renderPreview();
}

function closePreview() {
  const overlay = document.getElementById('card-preview-overlay');
  if (overlay) { overlay.style.display = 'none'; overlay.innerHTML = ''; }
  previewIndex = -1;
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
    const isWinner = false;

    const cardsHtml = played.length > 0
      ? `<div class="detail__player-cards">${played.map(c =>
          `<div class="detail__mini-card-wrap ${c.is_winner ? 'detail__mini-card-wrap--winner' : ''}">
            ${renderMiniCard(c.card_text, c.card_deck, c.card_id)}
          </div>`
        ).join('')}</div>`
      : '';

    const scoreText = `${p.score} wins`;

    return `
      <div class="detail__player ${isWinner ? 'detail__player--winner' : ''}">
        <div class="detail__player-header">
          <span class="detail__player-rank">#${p.rank}</span>
          <span class="detail__player-name">${maskName(p.player_name)}${isWinner ? ' ★' : ''}</span>
          <span class="detail__player-score">${scoreText}</span>
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

function getActivePhaseKey(status) {
  if (!status) return null;
  if (status.startsWith('die')) return 'die';
  if (status.startsWith('living')) return 'living';
  if (status.startsWith('bye')) return 'bye';
  if (status.startsWith('eulogy')) return 'eulogy';
  return null;
}

// Phase order for display — key matches card_plays phase values
const PHASE_DEFS = [
  { key: 'die',     label: 'Die',    settingKey: 'enableDie',    color: 'die' },
  { key: 'living',  label: 'Live',   settingKey: 'enableLive',   color: 'live' },
  { key: 'bye',     label: 'Bye',    settingKey: 'enableBye',    color: 'bye' },
  { key: 'eulogy',  label: 'Eulogy', settingKey: 'enableEulogy', color: 'eulogy' },
];

const PHASE_ORDER = ['die', 'living', 'bye', 'eulogy'];

function renderPhaseCards(gd) {
  const cardPlays = gd.card_plays || [];
  const isLive = gd.live_status === 'live';
  const activePhase = isLive ? getActivePhaseKey(gd.status) : null;

  // Parse settings to know which phases are enabled
  let settings = {};
  if (gd.settings_json) {
    try { settings = JSON.parse(gd.settings_json); } catch {}
  }

  // Group card_plays by phase key
  const playsByPhase = {};
  for (const cp of cardPlays) {
    if (!playsByPhase[cp.phase]) playsByPhase[cp.phase] = [];
    playsByPhase[cp.phase].push(cp);
  }

  // Count distinct rounds per phase
  function roundCount(plays) {
    return new Set(plays.map(c => c.round)).size;
  }

  const phaseCards = PHASE_DEFS.map(def => {
    const plays = playsByPhase[def.key] || [];
    const hasPlays = plays.length > 0;
    const enabled = settings[def.settingKey] !== false; // default true if setting unknown
    const isActive = activePhase === def.key;

    // Determine which phases are past based on game status position
    const statusPhase = getActivePhaseKey(gd.status);
    const statusIdx = statusPhase ? PHASE_ORDER.indexOf(statusPhase) : PHASE_ORDER.length;
    const thisIdx = PHASE_ORDER.indexOf(def.key);
    const isPast = thisIdx < statusIdx;

    let stateClass = '';
    if (!enabled) {
      stateClass = 'detail__phase-card--disabled';
    } else if (isActive) {
      stateClass = `detail__phase-card--active detail__phase-card--active-${def.color}`;
    } else if (!isPast && !hasPlays) {
      stateClass = 'detail__phase-card--pending';
    }

    const rounds = roundCount(plays);
    const roundLabel = rounds > 0 ? `${rounds} round${rounds !== 1 ? 's' : ''}` : '';
    const statsText = hasPlays ? `${plays.length} cards${roundLabel ? ' · ' + roundLabel : ''}` : (enabled ? 'Not yet' : 'Off');

    const cardsHtml = plays.map(c =>
      `<div class="detail__mini-card-wrap ${c.is_winner ? 'detail__mini-card-wrap--winner' : ''}">
        ${renderMiniCard(c.card_text, c.card_deck, c.card_id)}
        <span class="detail__mini-card-player">${maskName(c.player_name)}</span>
      </div>`
    ).join('');

    return `
      <div class="detail__phase-card ${stateClass}">
        <div class="detail__phase-header">
          <span class="detail__phase-name">${def.label}</span>
          <span class="detail__phase-stats">${statsText}</span>
        </div>
        ${hasPlays ? `<div class="detail__phase-cards">${cardsHtml}</div>` : ''}
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

// Person icon SVG for player count
const ICON_PERSON = '<svg class="dashboard__icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>';

// Colored dot for merged status-live column on mobile
function statusDot(liveStatus) {
  if (liveStatus === 'live') return '<span class="dashboard__dot dashboard__dot--live"></span>';
  if (liveStatus === 'abandoned') return '<span class="dashboard__dot dashboard__dot--abandoned"></span>';
  return '';
}

function renderGameCard(game) {
  const cls = rowClass(game);
  const expanded = expandedGameId === game.id;
  const errorFlag = game.has_error ? '<span class="dashboard__flag dashboard__flag--error" title="Error">!</span>' : '';
  const devFlag = game.is_dev ? '<span class="dashboard__badge dashboard__badge--dev" title="Dev game">DEV</span>' : '';
  const liveLabel = liveStatusLabel(game.live_status);
  const liveBadge = liveLabel ? `<span class="dashboard__badge dashboard__badge--${game.live_status}">${liveLabel}</span>` : '';

  // For live/abandoned games with no finished_at, show started_at and last activity
  const isLive = game.live_status === 'live';
  const mobile = isMobile();

  // Date: relative on mobile, full on desktop
  const dateDisplay = mobile
    ? formatTimeAgo(game.finished_at || game.started_at)
    : ((isLive && game.started_at) ? formatDateTime(game.started_at) : formatDateTime(game.finished_at));

  const lastActivity = (isLive && game.last_activity_at) ? `<span class="dashboard__cell dashboard__cell--activity" title="Last activity">${formatTimeAgo(game.last_activity_at)}</span>` : '';

  // Play time: compact (no seconds) on mobile
  const playTime = isLive
    ? (lastActivity || '—')
    : (mobile ? formatDurationCompact(game.duration_seconds) : formatDuration(game.duration_seconds));

  // Players: number + icon (no "players" text)
  const playersDisplay = `${game.player_count} ${ICON_PERSON}`;

  // Merged status+live column for mobile
  const statusLiveDisplay = `${statusDot(game.live_status)}${statusLabel(game.status)}`;

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
        <span class="dashboard__cell dashboard__cell--players">${playersDisplay}</span>
        <span class="dashboard__cell dashboard__cell--time">${playTime}</span>
        <span class="dashboard__cell dashboard__cell--status">${statusLabel(game.status)}</span>
        <span class="dashboard__cell dashboard__cell--live">${liveBadge}</span>
        <span class="dashboard__cell dashboard__cell--status-live">${statusLiveDisplay}</span>
        <span class="dashboard__cell dashboard__cell--dev">${devFlag}</span>
        <span class="dashboard__cell dashboard__cell--error">${errorFlag}</span>
      </div>
      ${detail}
    </div>
  `;
}

function renderGameFilters() {
  const statusLabels = { all: 'All Status', finished: 'Finished', abandoned: 'Abandon', live: 'Live' };
  const devLabels = { all: 'With Dev', nodev: 'No Dev', dev: 'Only Dev' };
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
        <span class="dashboard__cell dashboard__cell--dev"></span>
        <span class="dashboard__cell dashboard__cell--error"></span>
      </div>
      ${games.map(renderGameCard).join('')}
      ${loadMoreBtn}
    `}
  `;
}

// ── Card Analytics ────────────────────────────────
let cardStats = { cards: [] };
let cardDeckFilter = 'all'; // 'all' | 'die' | 'living' | 'bye'
let cardSortMode = 'play_rate'; // 'play_rate' | 'play_count' | 'win_rate' | 'draw_count'
let cardSortAsc = false; // false = descending (default), true = ascending
let cardDevFilter = 'nodev'; // 'all' | 'dev' | 'nodev'

async function fetchCardStats() {
  try {
    const params = cardDevFilter !== 'all' ? `?dev=${cardDevFilter}` : '';
    const res = await authFetch(`${API_BASE}/api/carkedit/cards/stats${params}`);
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

function cycleDeckFilter() {
  const opts = ['all', 'die', 'living', 'bye'];
  const idx = opts.indexOf(cardDeckFilter);
  cardDeckFilter = opts[(idx + 1) % opts.length];
  renderCardAnalytics();
}

function setCardSort(mode) {
  if (cardSortMode === mode) return; // direction toggle handled by toggleCardSortDir()
  cardSortMode = mode;
  cardSortAsc = false;
  renderCardAnalytics();
}

function toggleCardSortDir() {
  cardSortAsc = !cardSortAsc;
  renderCardAnalytics();
}

async function cycleCardDev() {
  const opts = ['nodev', 'all', 'dev'];
  const idx = opts.indexOf(cardDevFilter);
  cardDevFilter = opts[(idx + 1) % opts.length];
  await fetchCardStats();
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
        <span>${card.play_count}/${card.draw_count || '?'} plays</span>
        <span>${card.draw_count > 0 ? card.play_rate + '% rate' : ''}</span>
        <span>${card.win_count} wins</span>
        <span class="dashboard__stat-card-rate">${card.win_rate}% win</span>
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
  const cards = [...(cardStats.cards || [])];
  const dir = cardSortAsc ? 1 : -1;
  cards.sort((a, b) => dir * (a[cardSortMode] - b[cardSortMode]));
  return cards;
}

function renderCardAnalytics() {
  const el = document.getElementById('card-analytics');
  if (!el) return;

  const deckLabels = { all: 'All Decks', die: 'Die', living: 'Live', bye: 'Bye' };
  const deckActive = cardDeckFilter !== 'all' ? 'dashboard__filter-btn--active' : '';

  const sortOption = (value, label) =>
    `<option value="${value}" ${cardSortMode === value ? 'selected' : ''}>${label}</option>`;

  const dirArrow = cardSortAsc ? '&#x25B2;' : '&#x25BC;';
  const dirLabel = cardSortAsc ? 'Asc' : 'Desc';

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

  const cardDevLabels = { all: 'With Dev', nodev: 'No Dev', dev: 'Only Dev' };
  const cardDevActive = cardDevFilter !== 'all' ? 'dashboard__filter-btn--active' : '';

  el.innerHTML = `
    <div class="dashboard__card-analytics-header">
      <div class="dashboard__sort-bar">
        <select class="dashboard__sort-select" onchange="window.dash.setCardSort(this.value)">
          ${sortOption('play_rate', 'Play Rate')}
          ${sortOption('play_count', 'Play Count')}
          ${sortOption('win_rate', 'Win Rate')}
          ${sortOption('draw_count', 'Draw Count')}
        </select>
        <button class="dashboard__filter-btn" onclick="window.dash.toggleCardSortDir()" title="${dirLabel}">${dirArrow}</button>
      </div>
      <div class="dashboard__filter-bar">
        <button class="dashboard__filter-btn ${deckActive}" onclick="window.dash.cycleDeckFilter()">${deckLabels[cardDeckFilter]}</button>
        <button class="dashboard__filter-btn ${cardDevActive}" onclick="window.dash.cycleCardDev()">${cardDevLabels[cardDevFilter]}</button>
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

let showUserMenu = false;

function toggleUserMenu() {
  showUserMenu = !showUserMenu;
  renderPage();
}

function renderAuthBar() {
  const name = authUser?.display_name || firebaseUserInfo?.displayName || 'Admin';
  const hasPhoto = !!firebaseUserInfo?.photoURL;
  const initial = (name || 'A').charAt(0).toUpperCase();

  const avatarImg = hasPhoto
    ? `<img class="auth-bar__avatar" src="${firebaseUserInfo.photoURL}" alt="" />`
    : `<span class="auth-bar__avatar auth-bar__avatar--initial">${initial}</span>`;

  const menu = showUserMenu ? `
    <div class="auth-menu" onclick="event.stopPropagation()">
      <div class="auth-menu__name">${name}</div>
      <div class="auth-menu__divider"></div>
      <a class="auth-menu__item" href="/admin-users.html">User Management</a>
      <a class="auth-menu__item" href="/dev-dashboard.html">Dev Dashboard</a>
      <button class="auth-menu__item auth-menu__item--logout" onclick="window.dash.signOut()">Sign Out</button>
    </div>
  ` : '';

  return `
    <div class="page-auth">
      <div class="auth-bar">
        <button class="auth-bar__avatar-btn" onclick="window.dash.toggleUserMenu()" aria-label="User menu">
          ${avatarImg}
        </button>
        ${menu}
      </div>
    </div>`;
}

function renderPage() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="dashboard">
      ${renderAuthBar()}
      <header class="dashboard__header">
        <h1 class="dashboard__title"><a href="/" class="dashboard__play-link">&#9654; Play</a> CarkedIt — Game Dashboard
          <span class="dashboard__versions">
            <span id="dash-version-client" class="dashboard__version-item" data-tooltip="Checking...">...<span class="version-dot version-dot--checking"></span></span>
            <span id="dash-version-server" class="dashboard__version-item" data-tooltip="Checking...">...<span class="version-dot version-dot--checking"></span></span>
            <span id="dash-refresh-timer" class="dashboard__refresh-timer">${REFRESH_INTERVAL_IDLE}s</span>
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
    <div id="card-preview-overlay" style="display:none"></div>
  `;
  renderStats();
  renderGameList();
  renderCardAnalytics();
  renderGraph();
}

// ── Auto-Refresh ────────────────────────────────────
const REFRESH_INTERVAL_LIVE = 15;
const REFRESH_INTERVAL_IDLE = 60;

function getRefreshInterval() {
  return liveStats.activeGames > 0 ? REFRESH_INTERVAL_LIVE : REFRESH_INTERVAL_IDLE;
}

let refreshCountdown = REFRESH_INTERVAL_IDLE;

async function refreshAll() {
  await Promise.all([fetchGames(), fetchStats(), fetchPeriodStats(), fetchCardStats()]);
  // Re-fetch detail for expanded live games so phases/players update
  if (expandedGameId) {
    const cached = gameDetailCache[expandedGameId];
    if (!cached || cached.live_status === 'live') {
      try {
        const res = await authFetch(`${API_BASE}/api/carkedit/games/${expandedGameId}`);
        if (res.ok) gameDetailCache[expandedGameId] = await res.json();
      } catch {}
    }
  }
  renderStats();
  renderGameList();
  renderCardAnalytics();
  renderGraph();
  refreshCountdown = getRefreshInterval();
}

function refreshNow() {
  refreshCountdown = getRefreshInterval();
  updateRefreshTimer();
  refreshAll();
}

function updateRefreshTimer() {
  const el = document.getElementById('dash-refresh-timer');
  if (el) el.textContent = `${refreshCountdown}s`;
}

// ── Init ─────────────────────────────────────────────
window.dash = { cyclePlayTime, cycleGamesCount, toggleGame, cycleDeckFilter, setCardSort, toggleCardSortDir, cycleCardDev, previewCard, closePreview, prevPreviewCard, nextPreviewCard, scrollCards, loadMoreGames, applyGameFilters, setGameFilter, refreshNow, cycleStatus, cycleDev, cycleDateRange, signInWithGoogle, signOut, toggleUserMenu };

// Close user menu on outside click
document.addEventListener('click', (e) => {
  if (showUserMenu && !e.target.closest('.auth-bar')) {
    showUserMenu = false;
    renderPage();
  }
});

// ── Auth Gate UI ─────────────────────────────────────
function renderAuthGate(message, showSignIn = true) {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="dashboard" style="display:flex;align-items:center;justify-content:center;min-height:80vh">
      <div style="text-align:center;max-width:400px">
        <h1 style="margin-bottom:0.5em">CarkedIt Dashboard</h1>
        <p style="color:#888;margin-bottom:1.5em">${message}</p>
        ${showSignIn ? '<button class="btn btn--google" onclick="window.dash.signInWithGoogle()" style="font-size:1rem;padding:0.75em 1.5em">Sign in with Google</button>' : ''}
        <div style="margin-top:1.5em"><a href="/" class="btn" style="background:transparent;color:var(--color-text-muted,#888);font-size:0.875rem;text-decoration:none">Back to Main Menu</a></div>
      </div>
    </div>
  `;
}

async function signInWithGoogle() {
  try {
    const authMod = await loadFirebaseAuth();
    const provider = new authMod.GoogleAuthProvider();
    await authMod.signInWithPopup(firebaseAuth, provider);
    // Auth state change will reload the page via the listener below
  } catch (err) {
    console.error('[dashboard] Google sign-in error:', err);
    renderAuthGate('Sign-in failed. Please try again.');
  }
}

async function signOut() {
  if (!firebaseAuth) return;
  const { signOut: fbSignOut } = await import('https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js');
  await fbSignOut(firebaseAuth);
  authToken = null;
  authUser = null;
  renderAuthGate('Sign in to access the dashboard.');
}

async function bootstrapAdmin() {
  try {
    const res = await authFetch(`${API_BASE}/api/carkedit/admin/bootstrap`, { method: 'POST' });
    if (res.ok) {
      authUser = await res.json();
      bootDashboard();
    } else {
      const data = await res.json();
      renderAuthGate(data.error || 'Bootstrap failed.', false);
    }
  } catch (err) {
    console.warn('[dashboard] Bootstrap failed:', err);
    renderAuthGate('Bootstrap failed. Please try again.');
  }
}

async function checkAdminAndBoot() {
  // Fetch current user profile to check admin flag
  try {
    const res = await authFetch(`${API_BASE}/api/carkedit/users/me`);
    if (!res.ok) {
      renderAuthGate('You do not have admin access.', false);
      return;
    }
    authUser = await res.json();
    if (!authUser.is_admin) {
      // Try bootstrap — succeeds only if no admins exist yet
      const bootstrapRes = await authFetch(`${API_BASE}/api/carkedit/admin/bootstrap`, { method: 'POST' });
      if (bootstrapRes.ok) {
        authUser = await bootstrapRes.json();
        bootDashboard();
        return;
      }
      // Admins exist but this user isn't one — show access denied
      renderAuthGate('You do not have admin access.', false);
      return;
    }
  } catch (err) {
    console.warn('[dashboard] Admin check failed:', err);
    renderAuthGate('Could not verify admin status. Please try again.');
    return;
  }

  // Admin verified — boot the dashboard
  bootDashboard();
}

async function bootDashboard() {
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

  // Refresh immediately when tab/window regains focus
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      refreshAll();
    }
  });
}

// ── Init — Auth Gate ────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  renderAuthGate('Loading...', false);

  try {
    const authMod = await loadFirebaseAuth();
    authMod.onAuthStateChanged(firebaseAuth, async (user) => {
      if (user) {
        authToken = await user.getIdToken();
        firebaseUserInfo = { displayName: user.displayName, photoURL: user.photoURL, email: user.email };
        await checkAdminAndBoot();
      } else {
        authToken = null;
        authUser = null;
        firebaseUserInfo = null;
        renderAuthGate('Sign in to access the dashboard.');
      }
    });
  } catch (err) {
    console.warn('[dashboard] Firebase init failed:', err);
    renderAuthGate('Authentication service unavailable.', false);
  }
});
