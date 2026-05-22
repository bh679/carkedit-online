// CarkedIt Online — Player Stats Component
// Renders the distinct-player list (filterable, paginated) for the
// dashboard USERS section and the bottom of admin-users.html.
'use strict';

const DEV_FILTER_CYCLE = ['nodev', 'all', 'dev'];
const DEV_FILTER_LABELS = { all: 'With Dev', nodev: 'No Dev', dev: 'Only Dev' };
const INITIAL_LIMIT = 5;
const FETCH_LIMIT = 1000;
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

function formatBirth(month, day) {
  if (!month || !day) return '';
  return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
}

function renderRow(p) {
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

  return `
    <div class="user-stats__row">
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
  } = opts;

  const state = {
    devFilter: 'nodev',
    displayLimit: INITIAL_LIMIT,
    data: { players: [], total_distinct: 0, total_matched_users: 0 },
    loading: false,
    error: null,
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
    const rows = players.slice(0, visibleCount).map(renderRow).join('');

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

  rootEl.addEventListener('click', async (e) => {
    const target = e.target.closest('[data-ps-action]');
    if (!target) return;
    const action = target.getAttribute('data-ps-action');

    if (action === 'cycle-dev') {
      const idx = DEV_FILTER_CYCLE.indexOf(state.devFilter);
      state.devFilter = DEV_FILTER_CYCLE[(idx + 1) % DEV_FILTER_CYCLE.length];
      state.displayLimit = INITIAL_LIMIT;
      render();
      await fetchData();
      render();
      return;
    }

    if (action === 'add') {
      const amount = parseInt(target.getAttribute('data-ps-amount'), 10) || 0;
      state.displayLimit = state.displayLimit + amount;
      render();
      return;
    }

    if (action === 'all') {
      state.displayLimit = Infinity;
      render();
      return;
    }
  });

  render();
  refresh();

  return { refresh };
}
