'use strict';

import { setStateSetter, initAuth, signInWithGoogle, getAuthToken } from '../managers/auth-manager.js';
import { bindScrollArrows } from '../components/card-list.js';
import { render as renderPackBg } from '../components/pack-card-background.js';

const API_BASE = `${window.location.origin}/api/carkedit`;

const ROW_DEFS = [
  { key: 'newest',     label: 'Newest',     params: { sort: 'newest', visibility: 'public', status: 'published' } },
  { key: 'official',   label: 'Official',   params: { sort: 'newest', is_official: 'true', visibility: 'public', status: 'published' } },
  { key: 'most_used',  label: 'Most Used',  params: { sort: 'most_used', visibility: 'public', status: 'published' } },
  { key: 'most_saved', label: 'Most Saved', params: { sort: 'most_saved', visibility: 'public', status: 'published' } },
];
const ROW_LIMIT = 12;

const state = {
  tab: 'browse',                  // 'browse' | 'favourites'
  view: 'list',                   // 'list' | 'detail'
  rows: {},                       // { [key]: { packs, loading, error } }
  favourites: { packs: [], loading: false, error: null },
  selectedPack: null,
  authUser: null,
  authLoading: true,
  authToken: null,
  loading: false,
  error: null,
};

function setState(updates) {
  Object.assign(state, updates);
  render();
}
setStateSetter(setState, () => state);

async function authedFetch(url, opts = {}) {
  const token = await getAuthToken();
  const headers = { ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, { ...opts, headers });
}

async function loadRow(def) {
  state.rows[def.key] = { packs: [], loading: true, error: null };
  render();
  try {
    const params = new URLSearchParams({ ...def.params, limit: String(ROW_LIMIT) });
    const res = await authedFetch(`${API_BASE}/packs?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.rows[def.key] = { packs: data.packs, loading: false, error: null };
  } catch (err) {
    state.rows[def.key] = { packs: [], loading: false, error: err.message || 'Failed' };
  }
  render();
}

function loadAllRows() {
  for (const def of ROW_DEFS) loadRow(def);
}

async function loadFavourites() {
  if (!state.authUser) {
    setState({ favourites: { packs: [], loading: false, error: null } });
    return;
  }
  setState({ favourites: { packs: [], loading: true, error: null } });
  try {
    const res = await authedFetch(`${API_BASE}/packs/favorites`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    setState({ favourites: { packs: data.packs, loading: false, error: null } });
  } catch (err) {
    setState({ favourites: { packs: [], loading: false, error: err.message || 'Failed' } });
  }
}

async function loadDetail(packId) {
  setState({ loading: true, error: null, view: 'detail', selectedPack: null });
  try {
    const [packRes, statsRes] = await Promise.all([
      authedFetch(`${API_BASE}/packs/${encodeURIComponent(packId)}`),
      authedFetch(`${API_BASE}/packs/${encodeURIComponent(packId)}/stats`),
    ]);
    if (!packRes.ok) throw new Error(`HTTP ${packRes.status}`);
    const pack = await packRes.json();
    const stats = statsRes.ok ? await statsRes.json() : null;
    const existing = findPackInState(packId);
    setState({
      selectedPack: {
        ...pack,
        stats,
        is_favorited: pack.is_favorited ?? existing?.is_favorited ?? false,
        creator_name: existing?.creator_name,
      },
      loading: false,
    });
  } catch (err) {
    setState({ error: err.message || 'Failed to load pack', loading: false });
  }
}

function findPackInState(packId) {
  for (const key of Object.keys(state.rows)) {
    const found = (state.rows[key].packs || []).find((p) => p.id === packId);
    if (found) return found;
  }
  return state.favourites.packs.find((p) => p.id === packId);
}

async function toggleFavorite(packId, currentlyFavorited) {
  if (!state.authUser) {
    await signInWithGoogle();
    return;
  }
  try {
    const res = await authedFetch(`${API_BASE}/packs/${encodeURIComponent(packId)}/favorite`, {
      method: currentlyFavorited ? 'DELETE' : 'POST',
    });
    if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
    // Update local state across rows + favourites + detail
    for (const key of Object.keys(state.rows)) {
      state.rows[key].packs = (state.rows[key].packs || []).map((p) =>
        p.id === packId
          ? {
              ...p,
              is_favorited: !currentlyFavorited,
              favorite_count: (p.favorite_count || 0) + (currentlyFavorited ? -1 : 1),
            }
          : p
      );
    }
    if (state.selectedPack && state.selectedPack.id === packId) {
      state.selectedPack = { ...state.selectedPack, is_favorited: !currentlyFavorited };
    }
    render();
    if (state.tab === 'favourites') loadFavourites();
  } catch (err) {
    setState({ error: err.message || 'Favorite failed' });
  }
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function render() {
  const app = document.getElementById('app');
  if (state.view === 'detail') {
    app.innerHTML = renderDetail();
  } else {
    app.innerHTML = renderList();
  }
  attachHandlers();
}

function renderList() {
  return `
    <div class="screen screen--marketplace">
      <div class="marketplace__header">
        <h1 class="marketplace__title">Expansions</h1>
      </div>

      <div class="marketplace__tabs">
        <button class="marketplace__tab ${state.tab === 'browse' ? 'marketplace__tab--active' : ''}" data-action="tab-browse">Browse</button>
        <button class="marketplace__tab ${state.tab === 'favourites' ? 'marketplace__tab--active' : ''}" data-action="tab-favourites">★ Favourites</button>
      </div>

      ${state.tab === 'browse' ? renderBrowseRows() : renderFavourites()}

      <div class="menu__actions marketplace__actions">
        <a class="btn btn--primary menu__site-link" href="card-designer">+ Create Pack</a>
        <a class="btn mode-select__back-btn menu__site-link" href="index.html">← Home</a>
      </div>
    </div>
  `;
}

function renderBrowseRows() {
  return ROW_DEFS.map((def) => {
    const row = state.rows[def.key] || { packs: [], loading: true };
    const scrollId = `pack-strip-${def.key}`;
    return `
      <section class="marketplace__row">
        <h2 class="marketplace__row-title">${esc(def.label)}</h2>
        ${row.loading
          ? '<p class="card-list__empty">Loading…</p>'
          : row.error
            ? `<p class="marketplace__error">${esc(row.error)}</p>`
            : row.packs.length === 0
              ? '<p class="card-list__empty">No expansions yet.</p>'
              : `
                <div class="card-list__wrapper">
                  <button class="card-list__nav card-list__nav--left dashboard__scroll-btn dashboard__scroll-btn--left" id="${scrollId}-left" onclick="window.cardList.scroll('${scrollId}', -1)" aria-label="Scroll left" style="display:none">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
                  </button>
                  <div class="card-list__scroll card-list__scroll--sm" id="${scrollId}">
                    ${row.packs.map(renderPackCard).join('')}
                  </div>
                  <button class="card-list__nav card-list__nav--right dashboard__scroll-btn dashboard__scroll-btn--right" id="${scrollId}-right" onclick="window.cardList.scroll('${scrollId}', 1)" aria-label="Scroll right">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
                  </button>
                </div>`
        }
      </section>
    `;
  }).join('');
}

function renderFavourites() {
  if (!state.authUser && !state.authLoading) {
    return '<p class="marketplace__empty">Sign in to see your Favourites.<br><button class="btn btn--primary" data-action="signin">Sign in with Google</button></p>';
  }
  const f = state.favourites;
  if (f.loading) return '<p class="marketplace__loading">Loading…</p>';
  if (f.error) return `<p class="marketplace__error">${esc(f.error)}</p>`;
  if (f.packs.length === 0) return '<p class="marketplace__empty">No favourites yet — browse expansions and tap ★ to save them.</p>';
  return `<div class="marketplace__grid">${f.packs.map(renderPackCard).join('')}</div>`;
}

function renderPackCard(p) {
  const fav = !!p.is_favorited;
  return `
    <div class="card-list__item card-list__item--sm pack-card" data-pack-id="${esc(p.id)}" data-action="open">
      ${renderPackBg(p)}
      <div class="pack-card__content">
        <h3 class="pack-card__title">${esc(p.title)}</h3>
        <div class="pack-card__creator">by ${esc(p.creator_name || 'Unknown')}</div>
        <div class="pack-card__stats">
          <span>${p.card_count || 0}c</span>
          <span>${p.usage_count || 0}g</span>
          <span>♥${p.favorite_count || 0}</span>
        </div>
        <button class="pack-card__save ${fav ? 'pack-card__save--saved' : ''}" data-action="toggle-fav" data-pack-id="${esc(p.id)}" data-fav="${fav}">
          ${fav ? '★' : '☆'}
        </button>
      </div>
    </div>
  `;
}

function renderDetail() {
  const p = state.selectedPack;
  if (state.loading || !p) return '<div class="screen screen--marketplace"><p class="marketplace__loading">Loading…</p></div>';
  const fav = !!p.is_favorited;
  const cards = p.cards || [];
  const byDeck = { die: [], live: [], bye: [] };
  for (const c of cards) (byDeck[c.deck_type] || (byDeck[c.deck_type] = [])).push(c);
  const stats = p.stats || {};
  return `
    <div class="screen screen--marketplace">
      <div class="marketplace__header">
        <button class="marketplace__back" data-action="back">← Back</button>
        <h1 class="marketplace__title">Expansion</h1>
        <span></span>
      </div>
      <div class="pack-detail__header">
        <div>
          <h2 class="pack-detail__title">${esc(p.title)}</h2>
          <div class="pack-detail__creator">by ${esc(p.creator_name || 'Unknown')}</div>
        </div>
        <button class="pack-card__save ${fav ? 'pack-card__save--saved' : ''}" data-action="toggle-fav" data-pack-id="${esc(p.id)}" data-fav="${fav}">
          ${fav ? '★ Saved' : '☆ Save'}
        </button>
      </div>
      ${p.description ? `<p class="pack-detail__desc">${esc(p.description)}</p>` : ''}
      <div class="pack-detail__stats">
        <span>${stats.card_count ?? cards.length} cards</span>
        <span>${stats.usage_count ?? 0} games</span>
        <span>♥ ${stats.favorite_count ?? 0}</span>
      </div>
      <div class="pack-detail__decks">
        ${['die', 'live', 'bye'].map((deck) => `
          <div class="pack-detail__deck pack-detail__deck--${deck}">
            <h3>${deck} (${byDeck[deck].length})</h3>
            <ul>${byDeck[deck].map((c) => `<li>${esc(c.text)}</li>`).join('')}</ul>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function attachHandlers() {
  document.querySelectorAll('[data-action]').forEach((el) => {
    el.addEventListener('click', onAction);
  });
  for (const def of ROW_DEFS) {
    bindScrollArrows(`pack-strip-${def.key}`);
  }
}

function onAction(e) {
  const target = e.currentTarget;
  const action = target.getAttribute('data-action');
  switch (action) {
    case 'tab-browse':
      if (state.tab !== 'browse') setState({ tab: 'browse', view: 'list' });
      break;
    case 'tab-favourites':
      if (state.tab !== 'favourites') {
        state.tab = 'favourites';
        state.view = 'list';
        loadFavourites();
      }
      break;
    case 'signin':
      signInWithGoogle();
      break;
    case 'open': {
      const id = target.getAttribute('data-pack-id');
      if (id) loadDetail(id);
      break;
    }
    case 'toggle-fav': {
      e.stopPropagation();
      const id = target.getAttribute('data-pack-id');
      const fav = target.getAttribute('data-fav') === 'true';
      if (id) toggleFavorite(id, fav);
      break;
    }
    case 'back':
      setState({ view: 'list', selectedPack: null });
      break;
  }
}

initAuth(() => {
  if (state.tab === 'favourites') loadFavourites();
});
loadAllRows();
render();
