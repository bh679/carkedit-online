// Shared game-filter UI for stats dashboard + See All page.
// Render functions are pure: they read from `state` and emit HTML with
// onclick handlers that call `window[ns].method(...)`. Each page owns
// its own state and exposes the matching handlers on `window[ns]`.
'use strict';

export const STATUS_GROUP_ORDER = ['lobby', 'die', 'living', 'bye', 'eulogy', 'finished', 'other'];

export const STATUS_GROUP_MEMBERS = {
  lobby:    ['lobby', ''],
  die:      ['die', 'die_phase'],
  living:   ['live', 'living_setup', 'living_submit', 'living_reveal', 'living_convince', 'living_select', 'living_winner'],
  bye:      ['bye', 'bye_setup', 'bye_submit', 'bye_reveal', 'bye_convince', 'bye_select', 'bye_winner'],
  eulogy:   ['eulogy', 'eulogy_intro', 'eulogy_pick', 'eulogy_speech', 'eulogy_judge', 'eulogy_points'],
  finished: ['finished', 'winner', 'game_over'],
  other:    ['abandoned'],
};

export const STATUS_GROUP_LABELS = {
  lobby: 'Lobby', die: 'Die', living: 'Living', bye: 'Bye',
  eulogy: 'Eulogy', finished: 'Finished', other: 'Other',
};

export const DURATION_ORDER = ['under5', '5to15', '15to30', 'over30', 'unknown'];

export const DURATION_LABELS = {
  under5: '<5m', '5to15': '5–15m', '15to30': '15–30m', over30: '30m+', unknown: 'unknown',
};

const STATUS_LABELS = { all: 'All Status', started: 'Started', finished: 'Finished', abandoned: 'Abandon', live: 'Live' };
const DEV_LABELS    = { all: 'With Dev', nodev: 'No Dev', dev: 'Only Dev' };
const DATE_LABELS   = { all: 'All Time', today: 'Today', week: 'This Week', month: 'This Month' };

// Empty-string status is collapsed into the lobby group and can't round-trip
// through the hideRaw CSV param, so it's filtered out of the sub-chip expansion.
// A group with only one effective member produces a single sub-chip that just
// duplicates the parent toggle — suppress its expand chevron.
export function groupHasMultipleSubStates(group) {
  return (STATUS_GROUP_MEMBERS[group] || []).filter(m => m !== '').length > 1;
}

export function renderGameFilters(state, ns) {
  const errActive    = state.filterErrorsOnly      ? 'dashboard__filter-btn--active' : '';
  const statusActive = state.filterStatus !== 'all' ? 'dashboard__filter-btn--active' : '';
  const devActive    = state.filterDev !== 'all'    ? 'dashboard__filter-btn--active' : '';
  const dateActive   = state.filterDateRange !== 'all' ? 'dashboard__filter-btn--active' : '';

  const counts = state.filterCounts || {};
  const dateCount   = (counts.date    && counts.date[state.filterDateRange])   ?? 0;
  const errorsCount = (counts.errors  && counts.errors.on)                     ?? 0;
  const devCount    = (counts.dev     && counts.dev[state.filterDev])          ?? 0;
  const statusCount = (counts.status  && counts.status[state.filterStatus])    ?? 0;

  return `
    <div class="dashboard__game-filters">
      <button class="dashboard__filter-btn ${dateActive}" onclick="window.${ns}.cycleDateRange()">${DATE_LABELS[state.filterDateRange]} <span class="dashboard__filter-btn__count">${dateCount}</span></button>
      <button class="dashboard__filter-btn ${errActive}" onclick="window.${ns}.setGameFilter('errorsOnly', ${!state.filterErrorsOnly})">Errors <span class="dashboard__filter-btn__count">${errorsCount}</span></button>
      <button class="dashboard__filter-btn ${devActive}" onclick="window.${ns}.cycleDev()">${DEV_LABELS[state.filterDev]} <span class="dashboard__filter-btn__count">${devCount}</span></button>
      <button class="dashboard__filter-btn ${statusActive}" onclick="window.${ns}.cycleStatus()">${STATUS_LABELS[state.filterStatus]} <span class="dashboard__filter-btn__count">${statusCount}</span></button>
    </div>`;
}

export function renderStatusChips(state, ns) {
  const counts = state.filterCounts || {};
  const groups = counts.groups || {};
  const raw    = counts.raw    || {};
  const hideGroups = state.filterHideGroups || new Set();
  const expanded   = state.expandedGroups   || new Set();

  const chips = STATUS_GROUP_ORDER.map(g => {
    const count    = groups[g] ?? 0;
    const isHidden = hideGroups.has(g);
    const isOpen   = expanded.has(g);
    const label    = STATUS_GROUP_LABELS[g] || g;
    const hiddenCls = isHidden ? 'dashboard__chip--hidden' : '';
    const expCls    = isOpen   ? 'dashboard__chip__chevron--expanded' : '';
    const sub       = isOpen   ? renderRawChipsForGroup(g, raw, state, ns) : '';
    const expandBtn = groupHasMultipleSubStates(g)
      ? `<button class="dashboard__chip dashboard__chip--expand" onclick="window.${ns}.toggleExpandGroup('${g}')" title="Show raw sub-statuses">
          <span class="dashboard__chip__chevron ${expCls}">›</span>
        </button>`
      : '';
    return `
      <div class="dashboard__chip-wrap">
        <button class="dashboard__chip ${hiddenCls}" onclick="window.${ns}.toggleHideGroup('${g}')">
          ${label} <span class="dashboard__chip__count">${count}</span>
        </button>
        ${expandBtn}
        ${sub}
      </div>`;
  }).join('');

  // Warn about any raw status the API returns that we haven't grouped yet.
  for (const r of Object.keys(raw)) {
    let inGroup = false;
    for (const members of Object.values(STATUS_GROUP_MEMBERS)) {
      if (members.includes(r)) { inGroup = true; break; }
    }
    if (!inGroup) console.warn('[game-filters] status not in any group:', r);
  }

  return `<div class="dashboard__chip-row" data-row="status">${chips}</div>`;
}

function renderRawChipsForGroup(group, raw, state, ns) {
  const members = STATUS_GROUP_MEMBERS[group] || [];
  const hideRaw = state.filterHideRaw || new Set();
  const chips = members
    .filter(m => m !== '' && ((raw[m] ?? 0) > 0 || hideRaw.has(m)))
    .map(m => {
      const count    = raw[m] ?? 0;
      const isHidden = hideRaw.has(m);
      const hiddenCls = isHidden ? 'dashboard__chip--hidden' : '';
      return `
        <button class="dashboard__chip dashboard__chip--raw ${hiddenCls}" onclick="window.${ns}.toggleHideRaw('${m}')">
          ${m} <span class="dashboard__chip__count">${count}</span>
        </button>`;
    }).join('');
  if (!chips) return `<div class="dashboard__chip-row dashboard__chip-row--sub"><span class="dashboard__chip-empty">no sub-statuses</span></div>`;
  return `<div class="dashboard__chip-row dashboard__chip-row--sub">${chips}</div>`;
}

export function renderDurationChips(state, ns) {
  const counts = (state.filterCounts && state.filterCounts.duration) || {};
  const hideDuration = state.filterHideDuration || new Set();
  const chips = DURATION_ORDER
    .filter(key => (counts[key] ?? 0) > 0 || hideDuration.has(key))
    .map(key => {
      const count = counts[key] ?? 0;
      const isHidden = hideDuration.has(key);
      const hiddenCls = isHidden ? 'dashboard__chip--hidden' : '';
      return `
        <button class="dashboard__chip ${hiddenCls}" onclick="window.${ns}.toggleHideDuration('${key}')">
          ${DURATION_LABELS[key] || key} <span class="dashboard__chip__count">${count}</span>
        </button>`;
    }).join('');
  if (!chips) return '';
  return `<div class="dashboard__chip-row" data-row="duration"><span class="dashboard__chip-label">Length:</span>${chips}</div>`;
}

export function renderPlayerChips(state, ns) {
  const counts = (state.filterCounts && state.filterCounts.players) || {};
  const hidePlayers = state.filterHidePlayers || new Set();
  const keys = Object.keys(counts).sort((a, b) => {
    if (a === '7plus') return 1;
    if (b === '7plus') return -1;
    return Number(a) - Number(b);
  });
  if (keys.length === 0) return '';
  const chips = keys.map(key => {
    const count = counts[key] ?? 0;
    const isHidden = hidePlayers.has(key);
    const hiddenCls = isHidden ? 'dashboard__chip--hidden' : '';
    const label = key === '7plus' ? '7+' : key;
    return `
      <button class="dashboard__chip ${hiddenCls}" onclick="window.${ns}.toggleHidePlayers('${key}')">
        ${label} <span class="dashboard__chip__count">${count}</span>
      </button>`;
  }).join('');
  return `<div class="dashboard__chip-row" data-row="players"><span class="dashboard__chip-label">Players:</span>${chips}</div>`;
}
