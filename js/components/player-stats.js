// CarkedIt Online — Player Stats Component
// Renders the distinct-player list (filterable, paginated) for the
// dashboard USERS section and the bottom of admin-users.html. Supports
// clickable row expansion: each row opens to show that player's games,
// each with an optional DEV-flag toggle (requires patchDevFlag + confirm
// helpers to be passed in).
'use strict';

const DEV_FILTER_CYCLE = ['nodev', 'all', 'dev'];
const DEV_FILTER_LABELS = { all: 'With Dev', nodev: 'No Dev', dev: 'Only Dev' };
const INITIAL_LIMIT = 5;
const FETCH_LIMIT = 1000;
const PLAYER_GAMES_LIMIT = 100;
const DEFAULT_EXPANSION_STEPS = [50, 100, 'all'];

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escAttr(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
}

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function formatDate(iso) {
  return iso ? new Date(iso).toLocaleDateString() : '—';
}

function formatDateTime(iso) {
  return iso ? new Date(iso).toLocaleString() : '—';
}

function formatBirth(month, day) {
  if (!month || !day) return '';
  return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
}

function renderPlayerGames(nameKey, games, canToggleDev) {
  if (games === undefined) {
    return `<div class="user-stats__games user-stats__games--loading" data-ps-stop>Loading games…</div>`;
  }
  if (games.length === 0) {
    return `<div class="user-stats__games user-stats__games--empty" data-ps-stop>No games found for this player.</div>`;
  }
  const nameKeyAttr = escAttr(nameKey);
  const rows = games.map(g => {
    const devOn = g.is_dev ? 'is-on' : '';
    const gid = escAttr(String(g.id));
    const date = formatDateTime(g.finished_at || g.started_at);
    const host = escapeHtml(g.host_name || '(no host)');
    const status = escapeHtml(g.status || '');
    const live = g.live_status === 'live' ? '<span class="dashboard__badge dashboard__badge--live">live</span>'
      : g.live_status === 'abandoned' ? '<span class="dashboard__badge dashboard__badge--abandoned">abandoned</span>'
      : '';
    const devBtn = canToggleDev
      ? `<button class="dashboard__dev-toggle ${devOn}" title="Toggle dev for this game" data-ps-action="toggle-game-dev" data-ps-game-id="${gid}" data-ps-name-key="${nameKeyAttr}" data-ps-next="${g.is_dev ? '0' : '1'}">DEV</button>`
      : '';
    return `
      <div class="user-stats__game-row">
        <span class="user-stats__game-date">${date}</span>
        <span class="user-stats__game-host">${host}</span>
        <span class="user-stats__game-meta">${g.player_count}p · ${formatDuration(g.duration_seconds)}</span>
        <span class="user-stats__game-status">${status} ${live}</span>
        ${devBtn}
      </div>
    `;
  }).join('');
  return `
    <div class="user-stats__games" data-ps-stop>
      <div class="user-stats__games-header">Games (${games.length})</div>
      ${rows}
    </div>
  `;
}

function renderRow(p, expandedKey, playerGamesCache, canToggleDev) {
  const verified = p.matched_user_id
    ? '<span class="user-stats__badge user-stats__badge--verified" title="Matches a registered user">✓</span>'
    : '';
  const avatar = p.avatar_url
    ? `<img class="user-stats__avatar" src="${escAttr(p.avatar_url)}" alt="">`
    : '<span class="user-stats__avatar user-stats__avatar--blank"></span>';
  const birth = formatBirth(p.birth_month, p.birth_day);
  const birthChip = birth
    ? `<span class="user-stats__chip user-stats__chip--birth" title="Birth month/day">🎂 ${birth}</span>`
    : '';
  const ipChip = (p.distinct_host_ips > 1)
    ? `<span class="user-stats__chip user-stats__chip--multi" title="${p.distinct_host_ips} distinct host IPs seen for this name — could be multiple people">⚠ ${p.distinct_host_ips} IPs</span>`
    : '';
  const userIdChip = (p.distinct_host_user_ids > 1)
    ? `<span class="user-stats__chip user-stats__chip--multi" title="${p.distinct_host_user_ids} distinct host user IDs seen for this name">⚠ ${p.distinct_host_user_ids} accts</span>`
    : '';
  const email = p.email ? `<span class="user-stats__email">${escapeHtml(p.email)}</span>` : '';

  const expanded = expandedKey === p.name_key;
  const expandedCls = expanded ? ' user-stats__row--expanded' : '';
  const nameKeyAttr = escAttr(p.name_key);
  const detail = expanded
    ? renderPlayerGames(p.name_key, playerGamesCache[p.name_key], canToggleDev)
    : '';

  return `
    <div class="user-stats__row${expandedCls}" data-ps-action="toggle-player" data-ps-name-key="${nameKeyAttr}">
      <div class="user-stats__identity">
        ${avatar}
        <div class="user-stats__name-wrap">
          <span class="user-stats__name">${escapeHtml(p.display_name)} ${verified}</span>
          ${email}
          <div class="user-stats__chips">${birthChip}${ipChip}${userIdChip}</div>
        </div>
      </div>
      <div class="user-stats__metric"><span class="user-stats__metric-value">${p.games_played}</span><span class="user-stats__metric-label">games</span></div>
      <div class="user-stats__metric"><span class="user-stats__metric-value">${formatDuration(p.total_seconds)}</span><span class="user-stats__metric-label">play time</span></div>
      <div class="user-stats__metric"><span class="user-stats__metric-value">${formatDate(p.first_game_at)}</span><span class="user-stats__metric-label">first</span></div>
      <div class="user-stats__metric"><span class="user-stats__metric-value">${formatDate(p.last_game_at)}</span><span class="user-stats__metric-label">last</span></div>
      ${detail}
    </div>
  `;
}

function renderActions(displayLimit, total, showSeeAllLink, expansionSteps) {
  const buttons = [];
  if (displayLimit < total) {
    for (const step of expansionSteps) {
      if (step === 'all') {
        buttons.push(`<button class="dashboard__load-more" data-ps-action="all">Show all</button>`);
      } else if (typeof step === 'number' && step > 0) {
        const remaining = total - displayLimit;
        if (remaining > 0) {
          buttons.push(`<button class="dashboard__load-more" data-ps-action="add" data-ps-amount="${step}">+${step}</button>`);
        }
      }
    }
  }

  const seeAll = showSeeAllLink
    ? `<a class="dashboard__see-all" href="/admin-users">See all →</a>`
    : '';

  if (buttons.length === 0 && !seeAll) return '';

  const hasButtons = buttons.length > 0;
  const cls = hasButtons
    ? (buttons.length > 1
        ? 'dashboard__list-actions dashboard__list-actions--multi-step'
        : 'dashboard__list-actions')
    : 'dashboard__list-actions dashboard__list-actions--solo';

  return `<div class="${cls}">${buttons.join('')}${seeAll}</div>`;
}

export function mountPlayerStats(rootEl, opts) {
  const {
    authFetch,
    apiBase = '',
    showSeeAllLink = false,
    expansionSteps = DEFAULT_EXPANSION_STEPS,
    patchDevFlag = null,
    confirmDevToggle = null,
    onGameDevToggled = null,
  } = opts;

  const canToggleDev = typeof patchDevFlag === 'function';

  const state = {
    devFilter: 'nodev',
    displayLimit: INITIAL_LIMIT,
    data: { players: [], total_distinct: 0, total_matched_users: 0 },
    loading: false,
    error: null,
    expandedPlayerKey: null,
    playerGamesCache: {},
  };

  async function fetchData() {
    state.loading = true;
    try {
      const res = await authFetch(`${apiBase}/api/carkedit/users/stats?dev=${state.devFilter}&limit=${FETCH_LIMIT}`);
      if (res.ok) {
        state.data = await res.json();
        state.error = null;
      } else {
        state.error = `Failed to load (${res.status})`;
      }
    } catch (err) {
      state.error = 'Network error';
      console.warn('[player-stats] fetch failed:', err);
    } finally {
      state.loading = false;
    }
  }

  async function fetchPlayerGames(nameKey) {
    try {
      const res = await authFetch(`${apiBase}/api/carkedit/games?playerName=${encodeURIComponent(nameKey)}&dev=all&limit=${PLAYER_GAMES_LIMIT}`);
      if (res.ok) {
        const data = await res.json();
        state.playerGamesCache[nameKey] = data.games || [];
      } else {
        state.playerGamesCache[nameKey] = [];
      }
    } catch (err) {
      console.warn('[player-stats] fetch player games failed:', err);
      state.playerGamesCache[nameKey] = [];
    }
  }

  function render() {
    if (!rootEl.isConnected) return;

    const devActive = state.devFilter !== 'all' ? 'dashboard__filter-btn--active' : '';
    const filterBar = `
      <div class="dashboard__filter-bar">
        <button class="dashboard__filter-btn ${devActive}" data-ps-action="cycle-dev">${DEV_FILTER_LABELS[state.devFilter]}</button>
      </div>
    `;

    const players = state.data.players || [];
    const total = players.length;

    if (state.loading && total === 0) {
      rootEl.innerHTML = `${filterBar}<p class="dashboard__empty">Loading…</p>`;
      return;
    }

    if (state.error && total === 0) {
      rootEl.innerHTML = `${filterBar}<p class="dashboard__empty">${escapeHtml(state.error)}</p>`;
      return;
    }

    if (total === 0) {
      rootEl.innerHTML = `${filterBar}<p class="dashboard__empty">No player data yet.</p>`;
      return;
    }

    const visibleCount = Math.min(state.displayLimit, total);
    const rows = players.slice(0, visibleCount)
      .map(p => renderRow(p, state.expandedPlayerKey, state.playerGamesCache, canToggleDev))
      .join('');

    const summary = `
      <div class="user-stats__summary">
        ${state.data.total_distinct} distinct players · ${state.data.total_matched_users} matched to user accounts
        <span class="user-stats__summary-meta">· showing ${visibleCount} of ${total}</span>
      </div>
    `;

    rootEl.innerHTML = `
      ${filterBar}
      ${summary}
      <div class="user-stats__list">${rows}</div>
      ${renderActions(state.displayLimit, total, showSeeAllLink, expansionSteps)}
    `;
  }

  async function refresh() {
    await fetchData();
    render();
  }

  async function togglePlayer(nameKey) {
    if (state.expandedPlayerKey === nameKey) {
      state.expandedPlayerKey = null;
      render();
      return;
    }
    state.expandedPlayerKey = nameKey;
    if (!state.playerGamesCache[nameKey]) {
      render();
      await fetchPlayerGames(nameKey);
    }
    render();
  }

  async function togglePlayerGameDev(gameId, nameKey, next) {
    if (!canToggleDev) return;
    const list = state.playerGamesCache[nameKey] || [];
    const g = list.find(x => x.id === gameId);
    const label = g ? `${g.host_name || '(no host)'} — ${gameId}` : gameId;
    if (typeof confirmDevToggle === 'function') {
      const ok = await confirmDevToggle('Game', label, next);
      if (!ok) return;
    }
    try {
      const updated = await patchDevFlag('games', gameId, next);
      const i = list.findIndex(x => x.id === gameId);
      if (i >= 0) list[i] = { ...list[i], is_dev: !!updated.is_dev };
      if (typeof onGameDevToggled === 'function') onGameDevToggled(gameId, !!updated.is_dev);
      render();
    } catch (e) {
      console.error(e);
      alert('Failed to toggle dev: ' + e.message);
    }
  }

  rootEl.addEventListener('click', async (e) => {
    if (e.target.closest('[data-ps-stop]')) return;
    const target = e.target.closest('[data-ps-action]');
    if (!target) return;
    const action = target.getAttribute('data-ps-action');

    if (action === 'cycle-dev') {
      e.stopPropagation();
      const idx = DEV_FILTER_CYCLE.indexOf(state.devFilter);
      state.devFilter = DEV_FILTER_CYCLE[(idx + 1) % DEV_FILTER_CYCLE.length];
      state.displayLimit = INITIAL_LIMIT;
      state.expandedPlayerKey = null;
      render();
      await fetchData();
      render();
      return;
    }

    if (action === 'add') {
      e.stopPropagation();
      const amount = parseInt(target.getAttribute('data-ps-amount'), 10) || 0;
      state.displayLimit = state.displayLimit + amount;
      render();
      return;
    }

    if (action === 'all') {
      e.stopPropagation();
      state.displayLimit = Infinity;
      render();
      return;
    }

    if (action === 'toggle-player') {
      const nameKey = target.getAttribute('data-ps-name-key');
      if (nameKey) togglePlayer(nameKey);
      return;
    }

    if (action === 'toggle-game-dev') {
      e.stopPropagation();
      const gameId = target.getAttribute('data-ps-game-id');
      const nameKey = target.getAttribute('data-ps-name-key');
      const next = target.getAttribute('data-ps-next') === '1';
      if (gameId && nameKey) togglePlayerGameDev(gameId, nameKey, next);
      return;
    }
  });

  render();
  refresh();

  return { refresh };
}
