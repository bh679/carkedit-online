// CarkedIt Online — Packs stats viewer (shared component).
//
// Extracted from dashboard.js so the global Stats page AND the brand-admin page
// render pack stats from ONE code path — change here, both update. Self-contained:
// owns its sort/expand/filter state and binds its own events (no window.dash).
//
// mountPackStats(rootEl, {
//   authFetch,                 // (url, opts) => fetch wrapper with auth
//   statsUrl,                  // full URL to the pack-stats endpoint
//   brandId,                   // optional: enables the "Brand packs only" filter
//   onEditCost,                // optional (pack) => void; cost cell is read-only if absent
//   onToggleDev,               // optional (id, isDev) => void; DEV is read-only if absent
// }) → { refresh }
'use strict';

import { escapeHtml } from '../utils/escape.js';

function escAttr(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
}

const PACK_INITIAL_LIMIT = 7;
const SORTS = ['usage_count', 'total_plays', 'total_wins', 'win_rate', 'favorite_count', 'card_count', 'title', 'total_cost_usd'];

/**
 * Pure filter + sort for pack rows. Exported for unit testing. When brandOnly
 * (and a brandId) is set, keeps only packs whose creator belongs to that brand.
 */
export function selectPacks(packs, { sortMode = 'usage_count', sortAsc = false, brandOnly = false, brandId = null } = {}) {
  let out = [...(packs || [])];
  if (brandId && brandOnly) out = out.filter((p) => p.creator_brand_id === brandId);
  const dir = sortAsc ? 1 : -1;
  out.sort((a, b) => {
    let av, bv;
    if (sortMode === 'total_cost_usd') {
      av = (a.base_cost_usd || 0) + (a.total_cost_usd || 0);
      bv = (b.base_cost_usd || 0) + (b.total_cost_usd || 0);
    } else {
      av = a[sortMode];
      bv = b[sortMode];
    }
    if (typeof av === 'string' || typeof bv === 'string') {
      return dir * String(av || '').localeCompare(String(bv || ''));
    }
    return dir * ((av || 0) - (bv || 0));
  });
  return out;
}

export function mountPackStats(rootEl, opts = {}) {
  const { authFetch, statsUrl, brandId = null, onEditCost = null, onToggleDev = null } = opts;
  const state = {
    packs: [],
    sortMode: 'usage_count',
    sortAsc: false,
    expanded: false,
    brandOnly: false, // when brandId set, filter to packs created by brand accounts
    loaded: false,
  };

  function visiblePacks() {
    return selectPacks(state.packs, { sortMode: state.sortMode, sortAsc: state.sortAsc, brandOnly: state.brandOnly, brandId });
  }

  function sortHeader(label, mode) {
    const active = state.sortMode === mode;
    const arrow = active ? (state.sortAsc ? ' ▲' : ' ▼') : '';
    const cls = active ? 'dashboard__pack-th dashboard__pack-th--active' : 'dashboard__pack-th';
    return `<th class="${cls}" data-pk-sort="${mode}">${label}${arrow}</th>`;
  }

  function render() {
    if (!state.loaded) { rootEl.innerHTML = '<p class="dashboard__empty">Loading…</p>'; return; }

    const brandFilterBar = brandId
      ? `<div class="dashboard__filter-bar">
           <button class="dashboard__filter-btn ${state.brandOnly ? 'dashboard__filter-btn--active' : ''}" data-pk-brand-toggle>
             ${state.brandOnly ? 'Brand packs only' : 'All packs'}
           </button>
         </div>`
      : '';

    const allPacks = visiblePacks();
    if (allPacks.length === 0) {
      rootEl.innerHTML = `${brandFilterBar}<p class="dashboard__empty">No expansion packs yet.</p>`;
      bind();
      return;
    }

    const hasMore = allPacks.length > PACK_INITIAL_LIMIT;
    const packs = (hasMore && !state.expanded) ? allPacks.slice(0, PACK_INITIAL_LIMIT) : allPacks;
    const hidden = allPacks.length - packs.length;

    const rows = packs.map((p) => {
      const winRatePct = ((p.win_rate || 0) * 100).toFixed(0);
      const officialBadge = p.is_official ? ' <span class="dashboard__pack-badge dashboard__pack-badge--official">OFFICIAL</span>' : '';
      const devBadge = onToggleDev
        ? ` <button class="dashboard__dev-toggle ${p.is_dev ? 'is-on' : ''}" title="Toggle dev" data-pk-dev="${escAttr(p.id)}" data-pk-dev-next="${p.is_dev ? '0' : '1'}">DEV</button>`
        : ` <span class="dashboard__dev-toggle ${p.is_dev ? 'is-on' : ''}" title="Read-only" style="opacity:0.4;cursor:not-allowed">DEV</span>`;
      const statusKey = (p.status || 'draft').toLowerCase();
      const statusBadge = ` <span class="dashboard__pack-badge dashboard__pack-badge--status dashboard__pack-badge--${statusKey}">${statusKey.toUpperCase()}</span>`;
      const cost = ((p.base_cost_usd || 0) + (p.total_cost_usd || 0)).toFixed(2);
      const costCell = onEditCost
        ? `<td class="dashboard__pack-cell dashboard__pack-cell--num dashboard__pack-cell--cost" data-pk-cost="${escAttr(p.id)}" title="Click to set base cost">$${cost}</td>`
        : `<td class="dashboard__pack-cell dashboard__pack-cell--num">$${cost}</td>`;
      return `
        <tr class="dashboard__pack-row">
          <td class="dashboard__pack-cell dashboard__pack-cell--title">
            <a href="expansions.html?pack=${encodeURIComponent(p.id)}" target="_blank" rel="noopener">${escapeHtml(p.title || '(untitled)')}</a>${statusBadge}${officialBadge}${devBadge}
          </td>
          <td class="dashboard__pack-cell">${escapeHtml(p.creator_name || '—')}</td>
          <td class="dashboard__pack-cell dashboard__pack-cell--num">${p.card_count || 0}</td>
          <td class="dashboard__pack-cell dashboard__pack-cell--num">${p.usage_count || 0}</td>
          <td class="dashboard__pack-cell dashboard__pack-cell--num">${p.total_plays || 0}</td>
          <td class="dashboard__pack-cell dashboard__pack-cell--num">${p.total_wins || 0}</td>
          <td class="dashboard__pack-cell dashboard__pack-cell--num">${winRatePct}%</td>
          <td class="dashboard__pack-cell dashboard__pack-cell--num">${p.favorite_count || 0}</td>
          ${costCell}
        </tr>`;
    }).join('');

    rootEl.innerHTML = `
      ${brandFilterBar}
      <div class="dashboard__pack-stats-wrap">
        <table class="dashboard__pack-table">
          <thead>
            <tr>
              ${sortHeader('Pack', 'title')}
              <th class="dashboard__pack-th">Creator</th>
              ${sortHeader('Cards', 'card_count')}
              ${sortHeader('Games Used', 'usage_count')}
              ${sortHeader('Plays', 'total_plays')}
              ${sortHeader('Wins', 'total_wins')}
              ${sortHeader('Win Rate', 'win_rate')}
              ${sortHeader('Favorites', 'favorite_count')}
              ${sortHeader('Cost', 'total_cost_usd')}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        ${hasMore ? `<button class="dashboard__load-more" data-pk-expand>${state.expanded ? 'Show less' : `See more (${hidden} more)`}</button>` : ''}
      </div>`;
    bind();
  }

  function bind() {
    rootEl.querySelectorAll('[data-pk-sort]').forEach((th) => th.addEventListener('click', () => {
      const mode = th.getAttribute('data-pk-sort');
      if (!SORTS.includes(mode)) return;
      if (state.sortMode === mode) state.sortAsc = !state.sortAsc;
      else { state.sortMode = mode; state.sortAsc = false; }
      render();
    }));
    const expandBtn = rootEl.querySelector('[data-pk-expand]');
    if (expandBtn) expandBtn.addEventListener('click', () => { state.expanded = !state.expanded; render(); });
    const brandToggle = rootEl.querySelector('[data-pk-brand-toggle]');
    if (brandToggle) brandToggle.addEventListener('click', () => { state.brandOnly = !state.brandOnly; render(); });
    if (onEditCost) {
      rootEl.querySelectorAll('[data-pk-cost]').forEach((td) => td.addEventListener('click', () => {
        const p = state.packs.find((x) => x.id === td.getAttribute('data-pk-cost'));
        if (p) onEditCost(p);
      }));
    }
    if (onToggleDev) {
      rootEl.querySelectorAll('[data-pk-dev]').forEach((btn) => btn.addEventListener('click', () => {
        const p = state.packs.find((x) => x.id === btn.getAttribute('data-pk-dev'));
        if (p) onToggleDev(p, btn.getAttribute('data-pk-dev-next') === '1');
      }));
    }
  }

  async function refresh() {
    try {
      const res = await authFetch(statsUrl);
      if (res.ok) {
        const data = await res.json();
        state.packs = data.packs || [];
      }
    } catch (err) {
      console.warn('[packs-stats-viewer] fetch failed:', err);
    }
    state.loaded = true;
    render();
  }

  render();
  refresh();
  return { refresh };
}
