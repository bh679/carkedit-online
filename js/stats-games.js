// CarkedIt Online — All Games (See All page)
'use strict';

import { guardPage } from './managers/page-permission-guard.js';
import { renderAdminHeader, bindAdminHeader, resetAdminHeaderMenu } from './components/admin-header.js';
import {
  renderGameFilters,
  renderStatusChips,
  renderDurationChips,
  renderPlayerChips,
} from './components/game-filters.js';
import { getFirebaseConfig, getProdFirebaseConfig } from './firebase-config.js';
import { renderGameDetail, init as initGameDetail } from './components/game-detail.js';

await guardPage('stats-games').catch((err) => { throw err; });

const FIREBASE_CONFIG = getFirebaseConfig();
const PROD_API_ORIGIN = 'https://play.carkedit.com';
const PAGE_SIZE = 100;

let firebaseAuth = null;
let authToken = null;
let firebaseUserInfo = null;

// "Preview production data" mode — cross-origin fetch against prod's API
// using a secondary Firebase app instance for prod auth. See plan
// async-floating-feather.md and the CORS allowance in carkedit-api/src/index.ts.
let dataSource = 'local'; // 'local' | 'prod'
let prodAuth = null;
let prodAuthToken = null;

function apiBase() {
  return dataSource === 'prod' ? PROD_API_ORIGIN : '';
}

function canPreviewProd() {
  return typeof window !== 'undefined'
    && window.location
    && window.location.hostname !== 'play.carkedit.com';
}

let games = [];
let gamesTotalCount = 0;

const STATUS_VALUES = ['all', 'started', 'finished', 'abandoned', 'live'];
const DEV_VALUES = ['nodev', 'all', 'dev'];
const DATE_VALUES = ['all', 'today', 'week', 'month'];
const SORT_VALUES = ['recency', 'longest', 'shortest'];
const STATE_METRIC_VALUES = ['avg', 'median'];
const STATE_ORDER = ['lobby', 'die', 'living', 'bye', 'eulogy', 'finished'];
const STATE_LABELS = { lobby: 'Lobby', die: 'Die', living: 'Live', bye: 'Bye', eulogy: 'Eulogy', finished: 'Finished' };

let filterDateRange = 'all';
let filterErrorsOnly = false;
let filterDev = 'all';
let filterStatus = 'all';
let sortMode = 'recency';
let stateMetric = 'avg';

let summaryStats = null;
let stateStats = [];

let filterHideGroups   = new Set();
let filterHideRaw      = new Set();
let filterHideDuration = new Set();
let filterHidePlayers  = new Set();
let expandedGroups     = new Set();
let filterCounts = { total: 0, date: {}, errors: {}, dev: {}, status: {}, groups: {}, raw: {}, duration: {}, players: {} };

let expandedGameId = null;
const gameDetailCache = {};

function parseCsvSet(value) {
  if (!value) return new Set();
  return new Set(value.split(',').filter(Boolean));
}

function readFiltersFromUrl() {
  const params = new URLSearchParams(location.search);
  const dr = params.get('dateRange');
  if (dr && DATE_VALUES.includes(dr)) filterDateRange = dr;
  filterErrorsOnly = params.get('errorsOnly') === '1' || params.get('errorsOnly') === 'true';
  const dev = params.get('dev');
  if (dev && DEV_VALUES.includes(dev)) filterDev = dev;
  const st = params.get('status');
  if (st && STATUS_VALUES.includes(st)) filterStatus = st;
  filterHideGroups   = parseCsvSet(params.get('hideGroups'));
  filterHideRaw      = parseCsvSet(params.get('hideRaw'));
  filterHideDuration = parseCsvSet(params.get('hideDurationBuckets'));
  filterHidePlayers  = parseCsvSet(params.get('hidePlayerCounts'));
  const so = params.get('sort');
  if (so && SORT_VALUES.includes(so)) sortMode = so;
  const sm = params.get('stateMetric');
  if (sm && STATE_METRIC_VALUES.includes(sm)) stateMetric = sm;
  if (params.get('source') === 'prod' && canPreviewProd()) dataSource = 'prod';
}

function writeFiltersToUrl() {
  const params = new URLSearchParams();
  if (filterDateRange !== 'all') params.set('dateRange', filterDateRange);
  if (filterErrorsOnly) params.set('errorsOnly', '1');
  if (filterDev !== 'all') params.set('dev', filterDev);
  if (filterStatus !== 'all') params.set('status', filterStatus);
  if (filterHideGroups.size   > 0) params.set('hideGroups',          [...filterHideGroups].join(','));
  if (filterHideRaw.size      > 0) params.set('hideRaw',             [...filterHideRaw].join(','));
  if (filterHideDuration.size > 0) params.set('hideDurationBuckets', [...filterHideDuration].join(','));
  if (filterHidePlayers.size  > 0) params.set('hidePlayerCounts',    [...filterHidePlayers].join(','));
  if (sortMode !== 'recency') params.set('sort', sortMode);
  if (stateMetric !== 'avg') params.set('stateMetric', stateMetric);
  if (dataSource === 'prod') params.set('source', 'prod');
  const qs = params.toString();
  const url = qs ? `${location.pathname}?${qs}` : location.pathname;
  history.replaceState(null, '', url);
}

async function loadFirebaseAuth() {
  const [appMod, authMod] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js'),
  ]);
  const app = appMod.initializeApp(FIREBASE_CONFIG);
  firebaseAuth = authMod.getAuth(app);
  return authMod;
}

// Initialize a secondary Firebase app pointing at prod, prompt sign-in via
// popup, and keep prodAuthToken fresh as the Firebase SDK silently refreshes
// the underlying ID token. Idempotent — safe to call repeatedly.
async function ensureProdAuth() {
  const [appMod, authMod] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js'),
  ]);
  if (!prodAuth) {
    let prodApp;
    try {
      prodApp = appMod.getApp('prod');
    } catch {
      prodApp = appMod.initializeApp(getProdFirebaseConfig(), 'prod');
    }
    prodAuth = authMod.getAuth(prodApp);
    authMod.onAuthStateChanged(prodAuth, async (user) => {
      prodAuthToken = user ? await user.getIdToken() : null;
    });
  }
  if (!prodAuth.currentUser) {
    const provider = new authMod.GoogleAuthProvider();
    await authMod.signInWithPopup(prodAuth, provider);
  }
  prodAuthToken = await prodAuth.currentUser.getIdToken();
  return prodAuthToken;
}

function authFetch(url, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const token = dataSource === 'prod' ? prodAuthToken : authToken;
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { ...opts, headers });
}

async function cycleDataSource() {
  if (!canPreviewProd()) return;
  if (dataSource === 'local') {
    try {
      await ensureProdAuth();
    } catch (err) {
      console.warn('[stats-games] Prod sign-in failed:', err);
      return;
    }
    dataSource = 'prod';
  } else {
    dataSource = 'local';
  }
  applyFilters();
}

async function doSignOut() {
  const { signOut } = await import('https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js');
  await signOut(firebaseAuth);
  authToken = null;
  firebaseUserInfo = null;
  renderGate('Sign in to view stats.', true);
}

function maskName(name) {
  if (!name || name.length <= 1) return '*';
  return name[0] + '*'.repeat(name.length - 1);
}

const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

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

function formatTimeAgo(isoDate) {
  if (!isoDate) return '—';
  const seconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

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
  return '';
}

function statusDot(liveStatus) {
  if (liveStatus === 'live') return '<span class="dashboard__status-dot dashboard__status-dot--live"></span>';
  if (liveStatus === 'abandoned') return '<span class="dashboard__status-dot dashboard__status-dot--abandoned"></span>';
  return '';
}

const ICON_PERSON = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle;opacity:0.7"><path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z"/></svg>';

function buildGameFilterParams() {
  const params = new URLSearchParams();
  if (filterDateRange !== 'all') {
    const now = new Date();
    let dateFrom;
    if (filterDateRange === 'today') {
      dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (filterDateRange === 'week') {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
    } else if (filterDateRange === 'month') {
      dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    if (dateFrom) params.set('dateFrom', dateFrom.toISOString());
  }
  if (filterErrorsOnly) params.set('errorsOnly', 'true');
  if (filterDev !== 'all') params.set('dev', filterDev);
  if (filterStatus !== 'all') params.set('status', filterStatus);
  if (filterHideGroups.size   > 0) params.set('hideGroups',          [...filterHideGroups].join(','));
  if (filterHideRaw.size      > 0) params.set('hideRaw',             [...filterHideRaw].join(','));
  if (filterHideDuration.size > 0) params.set('hideDurationBuckets', [...filterHideDuration].join(','));
  if (filterHidePlayers.size  > 0) params.set('hidePlayerCounts',    [...filterHidePlayers].join(','));
  return params;
}

function buildGamesUrl(limit, offset) {
  const params = buildGameFilterParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  if (sortMode === 'longest') { params.set('orderBy', 'duration'); params.set('orderDir', 'desc'); }
  else if (sortMode === 'shortest') { params.set('orderBy', 'duration'); params.set('orderDir', 'asc'); }
  return `${apiBase()}/api/carkedit/games?${params}`;
}

function buildStatsUrl() {
  return `${apiBase()}/api/carkedit/games/stats?${buildGameFilterParams()}`;
}

function buildStateStatsUrl() {
  return `${apiBase()}/api/carkedit/games/stats/by-state?${buildGameFilterParams()}`;
}

async function fetchFilterCounts() {
  try {
    const res = await authFetch(`${apiBase()}/api/carkedit/games/filter-counts?${buildGameFilterParams()}`);
    if (!res.ok) return;
    filterCounts = await res.json();
  } catch (err) {
    console.warn('[stats-games] Failed to fetch filter counts:', err);
  }
}

async function fetchGames(append = false) {
  try {
    const offset = append ? games.length : 0;
    const [gamesRes] = await Promise.all([
      authFetch(buildGamesUrl(PAGE_SIZE, offset)),
      append ? Promise.resolve() : fetchFilterCounts(),
    ]);
    if (!gamesRes.ok) return;
    const data = await gamesRes.json();
    if (append) {
      games = [...games, ...(data.games || [])];
    } else {
      games = data.games || [];
    }
    gamesTotalCount = data.total || 0;
  } catch (err) {
    console.warn('[stats-games] Failed to fetch games:', err);
  }
}

async function fetchStats() {
  try {
    const [s, ss] = await Promise.all([
      authFetch(buildStatsUrl()).then(r => r.ok ? r.json() : null).catch(() => null),
      authFetch(buildStateStatsUrl()).then(r => r.ok ? r.json() : null).catch(() => null),
    ]);
    summaryStats = s;
    stateStats = (ss && Array.isArray(ss.states)) ? ss.states : [];
  } catch (err) {
    console.warn('[stats-games] Failed to fetch stats:', err);
  }
}

async function loadMore() {
  await fetchGames(true);
  renderPage();
}

async function applyFilters() {
  writeFiltersToUrl();
  await Promise.all([fetchGames(false), fetchStats()]);
  renderPage();
}

function setGameFilter(key, value) {
  if (key === 'errorsOnly') filterErrorsOnly = value;
  if (key === 'dev') filterDev = value;
  if (key === 'status') filterStatus = value;
  applyFilters();
}

function cycleStatus() {
  const idx = STATUS_VALUES.indexOf(filterStatus);
  filterStatus = STATUS_VALUES[(idx + 1) % STATUS_VALUES.length];
  applyFilters();
}

function cycleDev() {
  const idx = DEV_VALUES.indexOf(filterDev);
  filterDev = DEV_VALUES[(idx + 1) % DEV_VALUES.length];
  applyFilters();
}

function cycleDateRange() {
  const idx = DATE_VALUES.indexOf(filterDateRange);
  filterDateRange = DATE_VALUES[(idx + 1) % DATE_VALUES.length];
  applyFilters();
}

function toggleHideGroup(group) {
  if (filterHideGroups.has(group)) filterHideGroups.delete(group);
  else filterHideGroups.add(group);
  applyFilters();
}

function toggleHideRaw(raw) {
  if (filterHideRaw.has(raw)) filterHideRaw.delete(raw);
  else filterHideRaw.add(raw);
  applyFilters();
}

function toggleHideDuration(bucket) {
  if (filterHideDuration.has(bucket)) filterHideDuration.delete(bucket);
  else filterHideDuration.add(bucket);
  applyFilters();
}

function toggleHidePlayers(key) {
  if (filterHidePlayers.has(key)) filterHidePlayers.delete(key);
  else filterHidePlayers.add(key);
  applyFilters();
}

function toggleExpandGroup(group) {
  if (expandedGroups.has(group)) expandedGroups.delete(group);
  else expandedGroups.add(group);
  renderPage();
}

function cycleSortMode() {
  const idx = SORT_VALUES.indexOf(sortMode);
  sortMode = SORT_VALUES[(idx + 1) % SORT_VALUES.length];
  applyFilters();
}

function toggleStateMetric() {
  stateMetric = stateMetric === 'avg' ? 'median' : 'avg';
  writeFiltersToUrl();
  renderPage();
}

async function toggleGame(gameId) {
  if (expandedGameId === gameId) {
    expandedGameId = null;
    renderPage();
    return;
  }
  expandedGameId = gameId;
  const cached = gameDetailCache[gameId];
  const isLive = !cached || cached.live_status === 'live';
  if (!cached || isLive) {
    try {
      const res = await authFetch(`${apiBase()}/api/carkedit/games/${gameId}`);
      if (res.ok) gameDetailCache[gameId] = await res.json();
    } catch (err) {
      console.warn('[stats-games] Failed to fetch game detail:', err);
    }
  }
  renderPage();
}

async function toggleGameDev(id, next) {
  if (dataSource === 'prod') return; // read-only in prod-preview mode
  try {
    const res = await authFetch(`${apiBase()}/api/carkedit/games/${encodeURIComponent(id)}/dev`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_dev: !!next }),
    });
    if (!res.ok) return;
    const updated = await res.json();
    const idx = games.findIndex(g => g.id === id);
    if (idx >= 0) games[idx] = { ...games[idx], is_dev: updated.is_dev };
    renderPage();
  } catch (err) {
    console.warn('[stats-games] Failed to toggle dev:', err);
  }
}

function getGameFilterState() {
  return {
    filterDateRange,
    filterErrorsOnly,
    filterDev,
    filterStatus,
    filterCounts,
    filterHideGroups,
    filterHideRaw,
    filterHideDuration,
    filterHidePlayers,
    expandedGroups,
  };
}

function formatNumber(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  return Number(n).toLocaleString('en-AU');
}

function tile(value, label, opts = {}) {
  const cls = opts.clickable ? 'dashboard__stat dashboard__stat--clickable' : 'dashboard__stat';
  const onclick = opts.onclick ? ` onclick="${opts.onclick}"` : '';
  const title = opts.title ? ` title="${opts.title}"` : '';
  return `<div class="${cls}"${onclick}${title}>
    <span class="dashboard__stat-value">${value}</span>
    <span class="dashboard__stat-label">${label}</span>
  </div>`;
}

function renderStatsPanel() {
  const s = summaryStats || {};
  const total = s.totalGames || 0;
  const finished = s.finishedGames || 0;
  const completion = total > 0 ? Math.round((finished / total) * 100) + '%' : '—';
  const avgPlayers = total > 0 ? (s.allPlayers / total).toFixed(1) : '—';

  let longestLabel = 'Longest';
  let longestValue = formatDurationCompact(s.longestPlayTime || 0);
  if (sortMode === 'longest') { longestLabel = '↓ Longest'; }
  else if (sortMode === 'shortest') { longestLabel = '↑ Shortest'; longestValue = formatDurationCompact(s.shortestPlayTime || 0); }
  const longestTitle = sortMode === 'recency'
    ? 'Click to sort by longest first'
    : (sortMode === 'longest' ? 'Click to sort by shortest first' : 'Click to restore default order');

  return `
    <div class="dashboard__stats">
      ${tile(formatNumber(total), 'Games Started')}
      ${tile(formatNumber(finished), 'Games Finished')}
      ${tile(completion, 'Completion')}
      ${tile(formatNumber(s.liveGames || 0), 'Live Now')}
      ${tile(formatNumber(s.abandonedGames || 0), 'Abandoned')}
      ${tile(formatNumber(s.allPlayers || 0), 'Total Players')}
      ${tile(avgPlayers, 'Avg Players')}
      ${tile(formatDurationCompact(s.avgPlayTime || 0), 'Avg Duration')}
      ${tile(longestValue, longestLabel, { clickable: true, onclick: 'window.statsGames.cycleSortMode()', title: longestTitle })}
      ${tile(formatNumber(s.errorGames || 0), 'Errors')}
      ${tile(formatNumber(s.issueGames || 0), 'Issues')}
    </div>
  `;
}

function renderStateBreakdown() {
  if (!stateStats || stateStats.length === 0) return '';
  const byState = {};
  for (const r of stateStats) byState[r.state] = r;
  const metricKey = stateMetric === 'median' ? 'median_seconds' : 'avg_seconds';
  const metricLabel = stateMetric === 'median' ? 'Median' : 'Avg';
  const altLabel = stateMetric === 'median' ? 'avg' : 'median';

  const subs = STATE_ORDER.map(key => {
    const r = byState[key] || { avg_seconds: 0, median_seconds: 0, count: 0 };
    const seconds = r[metricKey] || 0;
    const value = r.count > 0 ? formatDurationCompact(seconds) : '—';
    return `<div class="dashboard__stat-sub" title="${r.count} sample(s)">
      <span class="dashboard__stat-sub-value">${value}</span>
      <span class="dashboard__stat-sub-label">${STATE_LABELS[key]}</span>
    </div>`;
  }).join('');

  return `
    <div class="dashboard__stat-group" style="margin-bottom: var(--space-md); cursor: pointer;" onclick="window.statsGames.toggleStateMetric()" title="Click to switch to ${altLabel}">
      <span class="dashboard__stat-label" style="text-align:left;padding:0 4px">${metricLabel} time per state · click to switch to ${altLabel}</span>
      <div class="dashboard__stat-breakdown">${subs}</div>
    </div>
  `;
}

function renderGameCard(game) {
  const cls = rowClass(game);
  const errorFlag = game.has_error ? '<span class="dashboard__flag dashboard__flag--error" title="Error">!</span>' : '';
  const issueFlag = game.issue_count > 0 ? `<span class="dashboard__flag dashboard__flag--issue" title="${game.issue_count} issue report(s)">&#9873;</span>` : '';
  const devFlag = dataSource === 'prod'
    ? `<span class="dashboard__dev-toggle ${game.is_dev ? 'is-on' : ''}" title="Read-only in prod preview" style="opacity:0.4;cursor:not-allowed">DEV</span>`
    : `<button class="dashboard__dev-toggle ${game.is_dev ? 'is-on' : ''}" title="Toggle dev" onclick="event.stopPropagation(); window.statsGames.toggleGameDev('${game.id}', ${!game.is_dev})">DEV</button>`;
  const liveLabel = liveStatusLabel(game.live_status);
  const liveBadge = liveLabel ? `<span class="dashboard__badge dashboard__badge--${game.live_status}">${liveLabel}</span>` : '';
  const isLive = game.live_status === 'live';
  const mobile = isMobile();
  const dateDisplay = mobile
    ? formatTimeAgo(game.finished_at || game.started_at)
    : ((isLive && game.started_at) ? formatDateTime(game.started_at) : formatDateTime(game.finished_at));
  const lastActivity = (isLive && game.last_activity_at) ? `<span class="dashboard__cell dashboard__cell--activity" title="Last activity">${formatTimeAgo(game.last_activity_at)}</span>` : '';
  const playTime = isLive
    ? (lastActivity || '—')
    : (mobile ? formatDurationCompact(game.duration_seconds) : formatDuration(game.duration_seconds));
  const playersDisplay = `${game.player_count} ${ICON_PERSON}`;
  const statusLiveDisplay = `${statusDot(game.live_status)}${statusLabel(game.status)}`;

  const expanded = expandedGameId === game.id;
  let detail = '';
  if (expanded) {
    const gd = gameDetailCache[game.id] || game;
    detail = renderGameDetail(gd);
  }

  return `
    <div class="dashboard__card ${cls}" onclick="window.statsGames.toggleGame('${game.id}')">
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
        <span class="dashboard__cell dashboard__cell--issue">${issueFlag}</span>
      </div>
      ${detail}
    </div>
  `;
}

function renderGate(msg, showSignIn = false) {
  document.getElementById('app').innerHTML = `
    ${renderAdminHeader()}
    <div class="dashboard">
      <header class="dashboard__header">
        <h1 class="dashboard__title">All Games</h1>
      </header>
      <p class="dashboard__empty">${msg}</p>
      ${showSignIn ? '<button class="btn btn--google" id="sign-in-btn" style="font-size:1rem;padding:0.75em 1.5em">Sign in with Google</button>' : ''}
    </div>`;
  bindAdminHeader(document.getElementById('app'), {});
  if (showSignIn) {
    document.getElementById('sign-in-btn').addEventListener('click', async () => {
      const authMod = await loadFirebaseAuth();
      const provider = new authMod.GoogleAuthProvider();
      await authMod.signInWithPopup(firebaseAuth, provider);
    });
  }
}

function renderPage() {
  resetAdminHeaderMenu();
  const app = document.getElementById('app');
  const hasMore = games.length < gamesTotalCount;
  const loadMoreBtn = hasMore
    ? `<button class="dashboard__load-more" onclick="window.statsGames.loadMore()">Load more (${games.length} of ${gamesTotalCount})</button>`
    : '';

  const list = games.length === 0
    ? '<p class="dashboard__empty">No games match filters.</p>'
    : `
      <div class="dashboard__list-header">
        <span class="dashboard__cell dashboard__cell--date">Date/Time</span>
        <span class="dashboard__cell dashboard__cell--host">Host</span>
        <span class="dashboard__cell dashboard__cell--players">Players</span>
        <span class="dashboard__cell dashboard__cell--time">Play Time</span>
        <span class="dashboard__cell dashboard__cell--status">Status</span>
        <span class="dashboard__cell dashboard__cell--live"></span>
        <span class="dashboard__cell dashboard__cell--dev"></span>
        <span class="dashboard__cell dashboard__cell--error"></span>
        <span class="dashboard__cell dashboard__cell--issue"></span>
      </div>
      ${games.map(renderGameCard).join('')}
      ${loadMoreBtn}
    `;

  const state = getGameFilterState();
  const sourceToggle = canPreviewProd()
    ? `<button class="dashboard__filter-btn ${dataSource === 'prod' ? 'dashboard__filter-btn--active' : ''}" onclick="window.statsGames.cycleDataSource()" title="Toggle production data preview">${dataSource === 'prod' ? '⚠ PROD DATA' : 'Local data'}</button>`
    : '';
  const prodBanner = dataSource === 'prod'
    ? '<div class="dashboard__source-banner">Viewing PRODUCTION data — read-only preview</div>'
    : '';
  app.innerHTML = `
    ${renderAdminHeader({ user: firebaseUserInfo })}
    <div class="dashboard">
      ${prodBanner}
      <header class="dashboard__header">
        <h1 class="dashboard__title">All Games <span class="dashboard__versions"><a href="stats.html" class="dashboard__see-all" style="flex:0 0 auto;padding:0.25rem 0.75rem;font-size:0.75rem">← Back to Stats</a></span></h1>
        ${sourceToggle}
      </header>
      <section class="dashboard__section">
        ${renderStatsPanel()}
        ${renderStateBreakdown()}
        <div id="game-list">
          ${renderGameFilters(state, 'statsGames')}
          ${renderStatusChips(state, 'statsGames')}
          ${renderDurationChips(state, 'statsGames')}
          ${renderPlayerChips(state, 'statsGames')}
          ${list}
        </div>
      </section>
    </div>
  `;
  bindAdminHeader(app, { user: firebaseUserInfo, onSignOut: doSignOut });
}

async function boot() {
  initGameDetail({ authFetch, apiBase });
  await Promise.all([fetchGames(false), fetchStats()]);
  renderPage();
}

window.statsGames = {
  cycleStatus, cycleDev, cycleDateRange,
  setGameFilter,
  toggleHideGroup, toggleHideRaw, toggleHideDuration, toggleHidePlayers, toggleExpandGroup,
  loadMore, toggleGame, toggleGameDev, cycleDataSource,
  cycleSortMode, toggleStateMetric,
};

readFiltersFromUrl();
renderGate('Loading…', false);

try {
  const authMod = await loadFirebaseAuth();
  authMod.onAuthStateChanged(firebaseAuth, async (user) => {
    if (user) {
      authToken = await user.getIdToken();
      firebaseUserInfo = { displayName: user.displayName, photoURL: user.photoURL, email: user.email };
      if (dataSource === 'prod') {
        try { await ensureProdAuth(); } catch (err) { console.warn('[stats-games] Prod sign-in failed:', err); dataSource = 'local'; }
      }
      await boot();
    } else {
      authToken = null;
      firebaseUserInfo = null;
      renderGate('Sign in to view stats.', true);
    }
  });
} catch (err) {
  renderGate('Authentication service unavailable.', false);
}
