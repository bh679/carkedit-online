'use strict';

import { render as renderCardList } from './card-list.js';
import { render as renderPackBg } from './pack-card-background.js';

// Sentinel "base" pack — counts must match carkedit-api/src/data/cards.ts
const BASE_PACK = {
  id: 'base',
  title: 'CarkedIt (Base Game)',
  card_count: 184,
  die_count: 48,
  live_count: 68,
  bye_count: 68,
  isBase: true,
  is_official: true,
  status: 'published',
  creator_id: null,
};

const DECKS = ['die', 'live', 'bye'];
const DECK_LABEL = { die: 'DIE', live: 'LIVE', bye: 'BYE' };

// 24x24 white SVG icons used by the filter tabs and the favourite toggle.
const ICON_OFFICIAL = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="white" aria-hidden="true">
  <path d="M12 2C7.6 2 4 5.6 4 10c0 3.4 2.1 6.3 5 7.4V20l3-1.5L15 20v-2.6c2.9-1.1 5-4 5-7.4 0-4.4-3.6-8-8-8zm-3 8a1.4 1.4 0 1 1 0-2.8A1.4 1.4 0 0 1 9 10zm6 0a1.4 1.4 0 1 1 0-2.8 1.4 1.4 0 0 1 0 2.8zm-3 5c-2 0-3.6-1.2-4-2.8h8c-.4 1.6-2 2.8-4 2.8z"/>
</svg>`;

const ICON_MINE = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="white" aria-hidden="true">
  <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-3.3 0-8 1.7-8 5v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1c0-3.3-4.7-5-8-5z"/>
</svg>`;

const ICON_PUBLIC = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="12" cy="12" r="9"/>
  <path d="M3 12h18"/>
  <path d="M12 3a14 14 0 0 1 0 18"/>
  <path d="M12 3a14 14 0 0 0 0 18"/>
</svg>`;

const ICON_HEART = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="white" aria-hidden="true">
  <path d="M12 21s-7-4.5-9.3-9A5.5 5.5 0 0 1 12 6.5 5.5 5.5 0 0 1 21.3 12C19 16.5 12 21 12 21z"/>
</svg>`;

const ICON_HEART_OUTLINE = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M12 21s-7-4.5-9.3-9A5.5 5.5 0 0 1 12 6.5 5.5 5.5 0 0 1 21.3 12C19 16.5 12 21 12 21z"/>
</svg>`;

const TABS = [
  { id: 'public',     label: 'Public Decks',    icon: ICON_PUBLIC,   requiresAuth: false, empty: 'No public decks available.' },
  { id: 'official',   label: 'Official Decks',  icon: ICON_OFFICIAL, requiresAuth: false, empty: 'No official decks available.' },
  { id: 'mine',       label: 'My Decks',        icon: ICON_MINE,     requiresAuth: true,  empty: 'You haven\'t created any decks yet.' },
  { id: 'favourites', label: 'My Favourites',   icon: ICON_HEART,    requiresAuth: true,  empty: 'No favourites yet — tap the heart on any deck.' },
];

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isDeckEnabled(disabledSet, packId, deck) {
  return !disabledSet.has(`${packId}:${deck}`);
}

function deckCount(pack, deck) {
  if (deck === 'die') return Number(pack.die_count ?? 0);
  if (deck === 'live') return Number(pack.live_count ?? 0);
  if (deck === 'bye') return Number(pack.bye_count ?? 0);
  return 0;
}

function packMatchesFilter(pack, filter, authUserId) {
  // Base game: always shows on Official + Public; never on Mine; only on
  // Favourites if explicitly favourited.
  if (pack.isBase) {
    if (filter === 'mine') return false;
    if (filter === 'favourites') return !!pack.is_favorited;
    return filter === 'official' || filter === 'public';
  }
  switch (filter) {
    case 'official':   return !!pack.is_official;
    case 'mine':       return !!authUserId && pack.creator_id === authUserId;
    case 'public':     return pack.status === 'published';
    case 'favourites': return !!pack.is_favorited;
    default:           return true;
  }
}

function renderDeckChips(pack, disabledSet, isHost) {
  return DECKS.map((deck) => {
    const on = isDeckEnabled(disabledSet, pack.id, deck);
    const count = deckCount(pack, deck);
    const cls = `pack-selector__deck-chip pack-selector__deck-chip--${deck} ${on ? 'is-on' : 'is-off'}`;
    if (!isHost) {
      return `<span class="${cls}" aria-disabled="true">${DECK_LABEL[deck]} ${count}</span>`;
    }
    return `<button class="${cls}" onclick="window.game.togglePackDeck('${escapeHtml(pack.id)}', '${deck}')">
      ${DECK_LABEL[deck]} ${count}
    </button>`;
  }).join('');
}

function buildPackPreviewItems(pack, state, disabledSet) {
  // Returns array of { deck, text, imgSrc? } for currently-enabled decks
  const items = [];
  const want = (d) => isDeckEnabled(disabledSet, pack.id, d);
  if (pack.id === 'base') {
    const base = state.basePackCards;
    if (!base) return null; // signal "loading"
    if (want('die')) for (const c of base.die || []) items.push({ deck: 'die', text: c.title || c.text || '', imgSrc: c.illustrationKey ? `assets/illustrations/die/${c.illustrationKey}.jpg` : undefined, special: c.special || '', options: c.options || null });
    if (want('live')) for (const c of base.live || []) items.push({ deck: 'live', text: c.title || c.text || '', imgSrc: c.illustrationKey ? `assets/illustrations/live/${c.illustrationKey}.jpg` : undefined });
    if (want('bye')) for (const c of base.bye || []) items.push({ deck: 'bye', text: c.title || c.text || '', imgSrc: c.illustrationKey ? `assets/illustrations/bye/${c.illustrationKey}.jpg` : undefined });
    return items;
  }
  const cards = (state.packCards || {})[pack.id];
  if (!cards) return null; // loading
  for (const c of cards) {
    const deck = c.deck_type;
    if (!want(deck)) continue;
    let options = null;
    if (Array.isArray(c.options)) options = c.options;
    else if (typeof c.options_json === 'string' && c.options_json) {
      try { const p = JSON.parse(c.options_json); if (Array.isArray(p)) options = p; } catch {}
    }
    items.push({ deck, text: c.text || '', special: c.card_special || '', options, image_url: c.image_url || '' });
  }
  return items;
}

function findFeaturedCardText(pack, state) {
  if (!pack.featured_card_id) return null;
  const cards = (state.packCards || {})[pack.id];
  if (!cards) return null;
  const c = cards.find((x) => x.id === pack.featured_card_id);
  return c ? c.text : null;
}

function renderItem(pack, on, isHost, state, disabledSet) {
  const title = escapeHtml(pack.title);
  const count = Number(pack.card_count ?? 0);
  const expanded = (state.expandedPackPreviewIds || []).includes(pack.id);
  const featuredText = findFeaturedCardText(pack, state);
  const featuredLine = pack.featured_card_id
    ? `<span class="pack-selector__featured" title="Feature card">&#9733; ${featuredText ? escapeHtml(featuredText) : 'Featured card'}</span>`
    : '';

  const favBtn = (!isHost || pack.isBase) ? '' : `
    <button class="pack-selector__fav ${pack.is_favorited ? 'is-on' : ''}"
            title="${pack.is_favorited ? 'Remove from favourites' : 'Add to favourites'}"
            onclick="event.stopPropagation(); window.game.toggleFavoritePack('${escapeHtml(pack.id)}')">
      ${pack.is_favorited ? ICON_HEART : ICON_HEART_OUTLINE}
    </button>
  `;

  const previewIconBtn = (isHost && on)
    ? `<button class="pack-selector__preview-btn ${expanded ? 'is-active' : ''}"
               onclick="window.game.togglePackPreview('${escapeHtml(pack.id)}')"
               aria-label="${expanded ? 'Hide preview' : 'Preview cards'}"
               title="${expanded ? 'Hide preview' : 'Preview cards'}">
         <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
           <rect x="5" y="3" width="14" height="18" rx="2"/>
           <line x1="9" y1="8" x2="15" y2="8"/>
           <line x1="9" y1="12" x2="15" y2="12"/>
         </svg>
       </button>`
    : '';
  const toggleBtn = isHost
    ? `<button class="btn btn--small pack-selector__toggle ${on ? 'btn--active' : ''}"
               onclick="window.game.togglePack('${escapeHtml(pack.id)}')">
         ${on ? 'On' : 'Off'}
       </button>`
    : `<span class="pack-selector__tag">${on ? 'Selected' : ''}</span>`;
  const control = `<div class="pack-selector__controls">${favBtn}${previewIconBtn}${toggleBtn}</div>`;

  // Sub-row: deck chips (only when pack is enabled)
  let subRow = '';
  if (on) {
    const chips = renderDeckChips(pack, disabledSet, isHost);
    subRow = `
      <div class="pack-selector__sub-row">
        <div class="pack-selector__deck-chips">${chips}</div>
      </div>`;
  }

  // Inline preview strip
  let previewStrip = '';
  if (on && expanded && isHost) {
    const items = buildPackPreviewItems(pack, state, disabledSet);
    if (items === null) {
      previewStrip = `<div class="pack-selector__preview-strip"><p class="card-list__empty">Loading…</p></div>`;
    } else {
      // Stash the rendered list on window so the modal can navigate prev/next
      setTimeout(() => {
        if (window.game && window.game.setLobbyPreviewList) window.game.setLobbyPreviewList(items);
      }, 0);
      let _idx = 0;
      previewStrip = `<div class="pack-selector__preview-strip">${renderCardList(items, {
        size: 'sm',
        showStats: false,
        scrollArrows: true,
        id: `pack-preview-${pack.id}`,
        emptyText: 'No cards in enabled decks',
        buildOnClick: () => `window.game.previewLobbyCardAt(${_idx++})`,
      })}</div>`;
    }
  }

  return `
    <div class="pack-selector__item ${on ? 'is-selected' : ''} ${pack.isBase ? 'is-base' : ''}">
      ${renderPackBg(pack)}
      <div class="pack-selector__row">
        <div class="pack-selector__info">
          <span class="pack-selector__title">${title}</span>
          <span class="pack-selector__meta">${count} card${count === 1 ? '' : 's'}</span>
          ${featuredLine}
        </div>
        ${control}
      </div>
      ${subRow}
      ${previewStrip}
    </div>
  `;
}

function renderTabs(activeFilter, isAuthed) {
  const buttons = TABS
    .filter((t) => !t.requiresAuth || isAuthed)
    .map((t) => `
      <button class="pack-selector__tab ${t.id === activeFilter ? 'is-active' : ''}"
              type="button"
              role="tab"
              aria-selected="${t.id === activeFilter}"
              title="${t.label}"
              onclick="window.game.setPackFilter('${t.id}')">
        ${t.icon}
      </button>
    `).join('');
  return `<div class="pack-selector__tabs" role="tablist">${buttons}</div>`;
}

/**
 * Render the expansion pack selector for the online lobby.
 * Host sees filter tabs + per-deck sub-toggles + inline preview;
 * non-hosts see a read-only list of selected packs with their deck mask.
 */
export function render(state, { isHost } = { isHost: false }) {
  const expansionPacks = state.availablePacks || [];
  const selected = new Set(state.selectedPackIds || []);
  const disabledSet = new Set(state.disabledPackDecks || []);
  const allPacks = [BASE_PACK, ...expansionPacks];
  const authUserId = state.authUser?.id;
  const isAuthed = !!authUserId;

  // Compute per-deck totals across ALL currently-selected packs (not filtered),
  // honoring per-pack deck enablement.
  let dieTotal = 0, liveTotal = 0, byeTotal = 0;
  for (const p of allPacks) {
    if (!selected.has(p.id)) continue;
    if (isDeckEnabled(disabledSet, p.id, 'die'))  dieTotal  += deckCount(p, 'die');
    if (isDeckEnabled(disabledSet, p.id, 'live')) liveTotal += deckCount(p, 'live');
    if (isDeckEnabled(disabledSet, p.id, 'bye'))  byeTotal  += deckCount(p, 'bye');
  }

  const totalsHeader = `
    <div class="pack-selector__totals">
      <span class="pack-selector__total pack-selector__total--die">Die: ${dieTotal}</span>
      <span class="pack-selector__total pack-selector__total--live">Live: ${liveTotal}</span>
      <span class="pack-selector__total pack-selector__total--bye">Bye: ${byeTotal}</span>
    </div>
  `;

  // Non-host view: show only selected packs (read-only)
  if (!isHost) {
    const visible = allPacks.filter((p) => selected.has(p.id));
    const items = visible.length === 0
      ? `<div class="pack-selector__empty">No packs selected.</div>`
      : visible.map((p) => renderItem(p, true, false, state, disabledSet)).join('');
    return `<div class="pack-selector">${totalsHeader}${items}</div>`;
  }

  // Host view: tabs + filtered list
  let activeFilter = state.packFilter || 'official';
  const activeTab = TABS.find((t) => t.id === activeFilter);
  if (activeTab?.requiresAuth && !isAuthed) activeFilter = 'official';

  const filtered = allPacks.filter((p) => packMatchesFilter(p, activeFilter, authUserId));
  const tabsHtml = renderTabs(activeFilter, isAuthed);
  const items = filtered.length === 0
    ? `<div class="pack-selector__empty">${TABS.find((t) => t.id === activeFilter)?.empty || ''}</div>`
    : filtered.map((p) => renderItem(p, selected.has(p.id), true, state, disabledSet)).join('');

  // Bind scroll-arrow listeners for any open preview strips after render
  setTimeout(() => {
    if (window.cardList && window.cardList.bindScrollArrows) {
      for (const id of (state.expandedPackPreviewIds || [])) {
        window.cardList.bindScrollArrows(`pack-preview-${id}`);
      }
    }
  }, 0);

  return `<div class="pack-selector">${tabsHtml}${totalsHeader}${items}</div>`;
}
