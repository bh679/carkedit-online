// CarkedIt Online — All Games (See All page)
'use strict';

import { renderAdminHeader, bindAdminHeader, resetAdminHeaderMenu } from './components/admin-header.js';
import {
  renderGameFilters,
  renderStatusChips,
  renderDurationChips,
  renderPlayerChips,
} from './components/game-filters.js';
import { getFirebaseConfig } from './firebase-config.js';

const FIREBASE_CONFIG = getFirebaseConfig();
const API_BASE = '';
const PAGE_SIZE = 100;

let firebaseAuth = null;
let authToken = null;
let firebaseUserInfo = null;

let games = [];
let gamesTotalCount = 0;

const STATUS_VALUES = ['all', 'started', 'finished', 'abandoned', 'live'];
const DEV_VALUES = ['nodev', 'all', 'dev'];
const DATE_VALUES = ['all', 'today', 'week', 'month'];

let filterDateRange = 'all';
let filterErrorsOnly = false;
let filterDev = 'all';
let filterStatus = 'all';

let filterHideGroups   = new Set();
let filterHideRaw      = new Set();
let filterHideDuration = new Set();
let filterHidePlayers  = new Set();
let expandedGroups     = new Set();
let filterCounts = { total: 0, date: {}, errors: {}, dev: {}, status: {}, groups: {}, raw: {}, duration: {}, players: {} };

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

function authFetch(url, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  return fetch(url, { ...opts, headers });
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
  return `${API_BASE}/api/carkedit/games?${params}`;
}

async function fetchFilterCounts() {
  try {
    const res = await authFetch(`${API_BASE}/api/carkedit/games/filter-counts?${buildGameFilterParams()}`);
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

async function loadMore() {
  await fetchGames(true);
  renderPage();
}

async function applyFilters() {
  writeFiltersToUrl();
  await fetchGames(false);
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

async function toggleGameDev(id, next) {
  try {
    const res = await authFetch(`${API_BASE}/api/carkedit/games/${encodeURIComponent(id)}/dev`, {
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

function renderGameCard(game) {
  const cls = rowClass(game);
  const errorFlag = game.has_error ? '<span class="dashboard__flag dashboard__flag--error" title="Error">!</span>' : '';
  const issueFlag = game.issue_count > 0 ? `<span class="dashboard__flag dashboard__flag--issue" title="${game.issue_count} issue report(s)">&#9873;</span>` : '';
  const devFlag = `<button class="dashboard__dev-toggle ${game.is_dev ? 'is-on' : ''}" title="Toggle dev" onclick="event.stopPropagation(); window.statsGames.toggleGameDev('${game.id}', ${!game.is_dev})">DEV</button>`;
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

  return `
    <div class="dashboard__card ${cls}">
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
  app.innerHTML = `
    ${renderAdminHeader({ user: firebaseUserInfo })}
    <div class="dashboard">
      <header class="dashboard__header">
        <h1 class="dashboard__title">All Games <span class="dashboard__versions"><a href="stats.html" class="dashboard__see-all" style="flex:0 0 auto;padding:0.25rem 0.75rem;font-size:0.75rem">← Back to Stats</a></span></h1>
      </header>
      <section class="dashboard__section">
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
  await fetchGames(false);
  renderPage();
}

window.statsGames = {
  cycleStatus, cycleDev, cycleDateRange,
  setGameFilter,
  toggleHideGroup, toggleHideRaw, toggleHideDuration, toggleHidePlayers, toggleExpandGroup,
  loadMore, toggleGameDev,
};

readFiltersFromUrl();
renderGate('Loading…', false);

try {
  const authMod = await loadFirebaseAuth();
  authMod.onAuthStateChanged(firebaseAuth, async (user) => {
    if (user) {
      authToken = await user.getIdToken();
      firebaseUserInfo = { displayName: user.displayName, photoURL: user.photoURL, email: user.email };
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
