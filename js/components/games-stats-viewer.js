// CarkedIt Online — Games stats viewer (shared component).
//
// Extracted from dashboard.js #game-list so the Stats page and the brand-admin
// page render the games list + filters + detail from ONE code path. Owns its
// own filter/pagination state and registers its handlers on window[ns] (the
// game-filters component renders onclick="window.${ns}.method(...)").
//
// mountGamesStats(rootEl, {
//   authFetch, gamesBase,            // gamesBase: e.g. '/api/carkedit' or '/api/carkedit/brands/<id>'
//   ns = 'gamesView',                // window namespace the filter HTML calls into
//   renderGameDetail,                // from components/game-detail.js
//   gameDetailUrl,                   // (id) => url for a single game's detail
//   seeAllHref = null,               // () => string | null (omits the "See all" link if null)
//   pageSize = 5,
//   autoSelectRange = true,          // widen today→week→month→all until a range has games
//   patchDevFlag = null,             // (kind, id, next) => Promise; DEV is read-only if null
//   confirmDevToggle = null,         // (kind, label, next) => Promise<boolean>
//   onGameDevToggled = null,         // (id, next) => void  (lets the page sync other views)
// }) → { refresh, getState }
'use strict';

import {
  renderGameFilters, renderStatusChips, renderDurationChips, renderPlayerChips,
} from './game-filters.js';
import {
  maskName, isMobile, formatDuration, formatDurationCompact, formatDateTime,
  formatTimeAgo, statusLabel, liveStatusLabel, statusDot, rowClass, ICON_PERSON,
} from '../utils/dashboard-format.js';

export function mountGamesStats(rootEl, opts = {}) {
  const {
    authFetch, gamesBase, ns = 'gamesView', renderGameDetail, gameDetailUrl,
    seeAllHref = null, pageSize = 5, autoSelectRange = true,
    patchDevFlag = null, confirmDevToggle = null, onGameDevToggled = null,
  } = opts;

  const state = {
    games: [], total: 0,
    expandedGameId: null, expandedGroups: new Set(),
    filterDateRange: 'today', filterErrorsOnly: false, filterDev: 'nodev', filterStatus: 'all',
    filterHideGroups: new Set(), filterHideRaw: new Set(), filterHideDuration: new Set(), filterHidePlayers: new Set(),
    filterCounts: { total: 0, date: {}, errors: {}, dev: {}, status: {}, groups: {}, raw: {}, duration: {}, players: {} },
    loaded: false,
  };
  const detailCache = {};

  function filterState() {
    return {
      filterDateRange: state.filterDateRange,
      filterErrorsOnly: state.filterErrorsOnly,
      filterDev: state.filterDev,
      filterStatus: state.filterStatus,
      filterCounts: state.filterCounts,
      filterHideGroups: state.filterHideGroups,
      filterHideRaw: state.filterHideRaw,
      filterHideDuration: state.filterHideDuration,
      filterHidePlayers: state.filterHidePlayers,
      expandedGroups: state.expandedGroups,
    };
  }

  function buildParams() {
    const params = new URLSearchParams();
    if (state.filterDateRange !== 'all') {
      const now = new Date();
      let dateFrom;
      if (state.filterDateRange === 'today') dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      else if (state.filterDateRange === 'week') { const day = now.getDay(); const diff = day === 0 ? 6 : day - 1; dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff); }
      else if (state.filterDateRange === 'month') dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
      if (dateFrom) params.set('dateFrom', dateFrom.toISOString());
    }
    if (state.filterErrorsOnly) params.set('errorsOnly', 'true');
    if (state.filterDev !== 'all') params.set('dev', state.filterDev);
    if (state.filterStatus !== 'all') params.set('status', state.filterStatus);
    if (state.filterHideGroups.size) params.set('hideGroups', [...state.filterHideGroups].join(','));
    if (state.filterHideRaw.size) params.set('hideRaw', [...state.filterHideRaw].join(','));
    if (state.filterHideDuration.size) params.set('hideDurationBuckets', [...state.filterHideDuration].join(','));
    if (state.filterHidePlayers.size) params.set('hidePlayerCounts', [...state.filterHidePlayers].join(','));
    return params;
  }

  async function fetchFilterCounts() {
    try {
      const res = await authFetch(`${gamesBase}/games/filter-counts?${buildParams()}`);
      if (res.ok) state.filterCounts = await res.json();
    } catch (err) { console.warn('[games-stats-viewer] filter-counts failed:', err); }
  }

  async function fetchGames(append = false) {
    try {
      const offset = append ? state.games.length : 0;
      const params = buildParams();
      params.set('limit', String(pageSize));
      params.set('offset', String(offset));
      const [gamesRes] = await Promise.all([
        authFetch(`${gamesBase}/games?${params}`),
        append ? Promise.resolve() : fetchFilterCounts(),
      ]);
      if (!gamesRes.ok) return;
      const data = await gamesRes.json();
      state.games = append ? [...state.games, ...(data.games || [])] : (data.games || []);
      state.total = data.total || 0;
    } catch (err) { console.warn('[games-stats-viewer] games fetch failed:', err); }
  }

  function renderGameCard(game) {
    const cls = rowClass(game);
    const expanded = state.expandedGameId === game.id;
    const errorFlag = game.has_error ? '<span class="dashboard__flag dashboard__flag--error" title="Error">!</span>' : '';
    const issueFlag = game.issue_count > 0 ? `<span class="dashboard__flag dashboard__flag--issue" title="${game.issue_count} issue report(s)">&#9873;</span>` : '';
    const devFlag = patchDevFlag
      ? `<button class="dashboard__dev-toggle ${game.is_dev ? 'is-on' : ''}" title="Toggle dev" onclick="event.stopPropagation(); window.${ns}.toggleGameDev('${game.id}', ${!game.is_dev})">DEV</button>`
      : `<span class="dashboard__dev-toggle ${game.is_dev ? 'is-on' : ''}" title="Read-only" style="opacity:0.4;cursor:not-allowed">DEV</span>`;
    const liveLabel = liveStatusLabel(game.live_status);
    const liveBadge = liveLabel ? `<span class="dashboard__badge dashboard__badge--${game.live_status}">${liveLabel}</span>` : '';
    const isLive = game.live_status === 'live';
    const mobile = isMobile();
    const dateDisplay = mobile
      ? formatTimeAgo(game.finished_at || game.started_at)
      : ((isLive && game.started_at) ? formatDateTime(game.started_at) : formatDateTime(game.finished_at));
    const lastActivity = (isLive && game.last_activity_at) ? `<span class="dashboard__cell dashboard__cell--activity" title="Last activity">${formatTimeAgo(game.last_activity_at)}</span>` : '';
    const playTime = isLive ? (lastActivity || '—') : (mobile ? formatDurationCompact(game.duration_seconds) : formatDuration(game.duration_seconds));
    const playersDisplay = `${game.player_count} ${ICON_PERSON}`;
    const statusLiveDisplay = `${statusDot(game.live_status)}${statusLabel(game.status)}`;
    let detail = '';
    if (expanded) detail = renderGameDetail(detailCache[game.id] || game);
    return `
      <div class="dashboard__card ${cls}" onclick="window.${ns}.toggleGame('${game.id}')">
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
      </div>`;
  }

  function render() {
    if (!state.loaded) { rootEl.innerHTML = '<p class="dashboard__empty">Loading…</p>'; return; }
    const hasMore = state.games.length < state.total;
    const loadMoreBtn = hasMore
      ? `<button class="dashboard__load-more" onclick="window.${ns}.loadMoreGames()">Load more (${state.games.length} of ${state.total})</button>`
      : '';
    const seeAllBtn = seeAllHref ? `<a class="dashboard__see-all" href="${seeAllHref()}">See all</a>` : '';
    const actionsClass = hasMore ? 'dashboard__list-actions' : 'dashboard__list-actions dashboard__list-actions--solo';
    const actions = (loadMoreBtn || seeAllBtn) ? `<div class="${actionsClass}">${loadMoreBtn}${seeAllBtn}</div>` : '';
    const fs = filterState();
    rootEl.innerHTML = `
      ${renderGameFilters(fs, ns)}
      ${renderStatusChips(fs, ns)}
      ${renderDurationChips(fs, ns)}
      ${renderPlayerChips(fs, ns)}
      ${state.games.length === 0 ? '<p class="dashboard__empty">No games match filters.</p>' : `
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
        ${state.games.map(renderGameCard).join('')}
        ${actions}
      `}
    `;
  }

  // ── Handlers (registered on window[ns] for the filter HTML + card onclicks) ──
  const handlers = {
    async loadMoreGames() { await fetchGames(true); render(); },
    setGameFilter(key, value) {
      if (key === 'errorsOnly') state.filterErrorsOnly = value;
      if (key === 'dev') state.filterDev = value;
      if (key === 'status') state.filterStatus = value;
      fetchGames(false).then(render);
    },
    cycleStatus() {
      const o = ['all', 'started', 'finished', 'abandoned', 'live'];
      state.filterStatus = o[(o.indexOf(state.filterStatus) + 1) % o.length];
      fetchGames(false).then(render);
    },
    cycleDev() {
      const o = ['nodev', 'all', 'dev'];
      state.filterDev = o[(o.indexOf(state.filterDev) + 1) % o.length];
      fetchGames(false).then(render);
    },
    cycleDateRange() {
      const o = ['all', 'today', 'week', 'month'];
      state.filterDateRange = o[(o.indexOf(state.filterDateRange) + 1) % o.length];
      fetchGames(false).then(render);
    },
    toggleHideGroup(g) { state.filterHideGroups.has(g) ? state.filterHideGroups.delete(g) : state.filterHideGroups.add(g); fetchGames(false).then(render); },
    toggleHideRaw(r) { state.filterHideRaw.has(r) ? state.filterHideRaw.delete(r) : state.filterHideRaw.add(r); fetchGames(false).then(render); },
    toggleHideDuration(b) { state.filterHideDuration.has(b) ? state.filterHideDuration.delete(b) : state.filterHideDuration.add(b); fetchGames(false).then(render); },
    toggleHidePlayers(k) { state.filterHidePlayers.has(k) ? state.filterHidePlayers.delete(k) : state.filterHidePlayers.add(k); fetchGames(false).then(render); },
    toggleExpandGroup(g) { state.expandedGroups.has(g) ? state.expandedGroups.delete(g) : state.expandedGroups.add(g); render(); },
    async toggleGame(gameId) {
      if (state.expandedGameId === gameId) { state.expandedGameId = null; render(); return; }
      state.expandedGameId = gameId;
      const cached = detailCache[gameId];
      const isLive = !cached || cached.live_status === 'live';
      if ((!cached || isLive) && gameDetailUrl) {
        try {
          const res = await authFetch(gameDetailUrl(gameId));
          if (res.ok) detailCache[gameId] = await res.json();
        } catch (err) { console.warn('[games-stats-viewer] detail fetch failed:', err); }
      }
      render();
    },
    async toggleGameDev(id, next) {
      if (!patchDevFlag) return;
      const g = state.games.find((x) => x.id === id);
      const label = g ? (g.host_name || id) : id;
      if (confirmDevToggle && !await confirmDevToggle('Game', label, next)) return;
      try {
        await patchDevFlag('games', id, next);
        await fetchGames(false);
        render();
        if (onGameDevToggled) onGameDevToggled(id, next);
      } catch (e) { console.error(e); alert('Failed to toggle dev: ' + e.message); }
    },
  };
  if (typeof window !== 'undefined') {
    window[ns] = Object.assign(window[ns] || {}, handlers);
  }

  async function refresh() {
    if (autoSelectRange && !state.loaded) {
      // First load: widen today→week→month→all until a range has games.
      for (const range of ['today', 'week', 'month', 'all']) {
        state.filterDateRange = range;
        await fetchGames(false);
        if (state.total > 0) break;
      }
    } else {
      await fetchGames(false);
    }
    state.loaded = true;
    render();
  }

  render();
  refresh();
  return { refresh, getState: () => state };
}
