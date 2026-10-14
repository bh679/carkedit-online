// CarkedIt Online — Card analytics viewer (shared component).
//
// Extracted from dashboard.js #card-analytics so the global Stats page AND the
// brand-admin page render the card analytics (deck/pack/author/sort/dev filters,
// the card rows, and the card-preview modal) from ONE code path — change here,
// both update. Self-contained: owns its filter/sort/preview state + the pack/card
// metadata pipeline, and registers its handlers on window[ns] (the rendered HTML
// calls onclick="window.${ns}.setCardSort(...)" etc., mirroring games/survey).
//
// mountCardStats(rootEl, {
//   authFetch,                 // (url, opts) => fetch wrapper with auth
//   cardsStatsUrl,             // full URL to the card-stats endpoint
//                              //   global: '/api/carkedit/cards/stats'
//                              //   brand:  '/api/carkedit/brands/<id>/cards/stats'
//   packsMetaBase,             // base for GLOBAL pack metadata, e.g.
//                              //   '/api/carkedit' (→ /packs + /packs/:id). Pack
//                              //   metadata (card→pack/author maps + images) is
//                              //   NOT brand-scoped, so this stays global.
//   ns = 'dash',               // window namespace the filter/preview HTML calls
//   brandId = null,            // accepted for signature parity; card stats are
//                              //   already brand-scoped via cardsStatsUrl and the
//                              //   metadata stays global, so it is unused here.
// }) → { refresh }
'use strict';

import { render as renderCardList, fromStatRow, bindScrollArrows } from './card-list.js';
import { render as renderCard } from './card.js';
import { getOrCreate as registryGetOrCreate } from '../data/CardRegistry.js';

function escAttr(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
}

function deckTypeForCard(deck) {
  if (deck === 'living') return 'live';
  if (deck === 'bye') return 'bye';
  return 'die';
}

/**
 * Pure sort for card stat rows. Exported for unit testing.
 * Descending by default (sortAsc=false), comparing the numeric sort field.
 */
export function sortCards(cards, sortMode = 'play_rate', sortAsc = false) {
  const out = [...(cards || [])];
  const dir = sortAsc ? 1 : -1;
  out.sort((a, b) => dir * (a[sortMode] - b[sortMode]));
  return out;
}

/**
 * Pure deck/pack/author filter for card stat rows. Exported for unit testing.
 * Pure: never mutates the input array. The pack/author branches inject zero-stat
 * placeholder rows for unplayed cards belonging to the selected pack/author so the
 * full deck is visible.
 */
export function filterCards(cards, opts = {}) {
  const {
    deckFilter = 'all', packFilter = 'all', authorFilter = 'all',
    cardPackMap = {}, packCardsMap = {}, packCreatorMap = {},
  } = opts;
  let result = [...(cards || [])];
  if (deckFilter !== 'all') {
    result = result.filter((c) => c.card_deck === deckFilter);
  }
  if (packFilter === 'base') {
    result = result.filter((c) => !(c.card_id in cardPackMap));
  } else if (packFilter !== 'all') {
    // Filter to cards in this pack
    result = result.filter((c) => cardPackMap[c.card_id] === packFilter);
    // Add zero-stat entries for pack cards not already in stats
    const existing = new Set(result.map((c) => c.card_id));
    const packCards = packCardsMap[packFilter] || [];
    for (const pc of packCards) {
      if (!existing.has(pc.card_id)) {
        result.push({ card_id: pc.card_id, card_text: pc.card_text, card_deck: pc.card_deck, play_count: 0, win_count: 0, win_rate: 0, draw_count: 0, play_rate: 0 });
      }
    }
  }
  if (authorFilter !== 'all') {
    result = result.filter((c) => {
      const packId = cardPackMap[c.card_id];
      return packId && packCreatorMap[packId] === authorFilter;
    });
    // Add zero-stat entries for unplayed cards from this author's packs.
    // Skip if a specific pack is selected (pack filter already handles it).
    if (packFilter === 'all') {
      const existing = new Set(result.map((c) => c.card_id));
      for (const [packId, creator] of Object.entries(packCreatorMap)) {
        if (creator !== authorFilter) continue;
        for (const pc of (packCardsMap[packId] || [])) {
          if (!existing.has(pc.card_id)) {
            result.push({ card_id: pc.card_id, card_text: pc.card_text, card_deck: pc.card_deck, play_count: 0, win_count: 0, win_rate: 0, draw_count: 0, play_rate: 0 });
            existing.add(pc.card_id);
          }
        }
      }
    }
  }
  return result;
}

export function mountCardStats(rootEl, opts = {}) {
  const {
    authFetch, cardsStatsUrl, packsMetaBase, ns = 'dash', brandId = null,
  } = opts;
  void brandId; // reserved; see header

  const state = {
    cardStats: { cards: [] },
    deckFilter: 'all',  // 'all' | 'die' | 'living' | 'bye'
    sortMode: 'play_rate', // 'play_rate' | 'play_count' | 'win_rate' | 'draw_count'
    sortAsc: false,     // false = descending (default)
    devFilter: 'nodev', // 'all' | 'dev' | 'nodev'
    packFilter: 'all',  // 'all' | 'base' | pack_id string
    authorFilter: 'all', // 'all' | creator_name string
    previewIndex: -1,
    loaded: false,
  };

  // Card data lookup (loaded from JSON files for images + pack metadata)
  const cardDataMap = {};    // key: `${deck}-${id}` → card object with illustrationKey
  const cardPackMap = {};    // key: card_id → pack_id
  const packCardsMap = {};   // key: pack_id → [{card_id, card_deck, card_text}]
  const packCreatorMap = {}; // key: pack_id → creator_name
  const packList = [];       // [{id, title}] for pack filter dropdown
  const authorList = [];     // unique sorted author names

  // ── Metadata pipeline (global packs; not brand-scoped) ──────────────────
  async function loadCardData() {
    // Load base-game cards from static JSON
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
          registryGetOrCreate({ ...c, deckType });
        }
      } catch {}
    }));

    // Load expansion-pack cards so we can resolve their image_url
    try {
      const res = await authFetch(`${packsMetaBase}/packs`);
      if (res.ok) {
        const data = await res.json();
        const packs = data.packs ?? data ?? [];
        packList.length = 0;
        await Promise.all(packs.map(async (p) => {
          try {
            const pr = await authFetch(`${packsMetaBase}/packs/${p.id}`);
            if (!pr.ok) return;
            const pack = await pr.json();
            packList.push({ id: p.id, title: pack.title || p.title || p.id });
            packCreatorMap[p.id] = p.creator_name || pack.creator_name || '';
            packCardsMap[p.id] = [];
            for (const c of (pack.cards ?? [])) {
              const deck = c.deck_type === 'live' ? 'living' : c.deck_type;
              const deckType = c.deck_type === 'live' ? 'live' : c.deck_type;
              cardDataMap[`${deck}-${c.id}`] = { ...c, deck, deckType, image_url: c.image_url || '' };
              registryGetOrCreate({ ...c, deckType });
              cardPackMap[c.id] = p.id;
              packCardsMap[p.id].push({ card_id: c.id, card_deck: deck, card_text: c.text });
            }
          } catch {}
        }));
        packList.sort((a, b) => a.title.localeCompare(b.title));
        authorList.length = 0;
        const authors = new Set(Object.values(packCreatorMap).filter(Boolean));
        authorList.push(...[...authors].sort());
      }
    } catch {}
  }

  // Kept for parity with the original (currently unused — the image system flows
  // through registryGetOrCreate → CardRegistry → renderCard).
  function getCardImage(cardId, cardDeck) {
    const data = cardDataMap[`${cardDeck}-${cardId}`];
    if (data?.image_url) return data.image_url;
    if (data?.illustrationKey) {
      const deckType = cardDeck === 'living' ? 'live' : cardDeck === 'bye' ? 'bye' : 'die';
      return `assets/illustrations/${deckType}/${data.illustrationKey}.jpg`;
    }
    return null;
  }
  void getCardImage;

  async function fetchCardStats() {
    try {
      const params = state.devFilter !== 'all' ? `?dev=${state.devFilter}` : '';
      const res = await authFetch(`${cardsStatsUrl}${params}`);
      if (!res.ok) return;
      state.cardStats = await res.json();
    } catch (err) {
      console.warn('[cards-stats-viewer] Failed to fetch card stats:', err);
    }
  }

  // ── Derived helpers ─────────────────────────────────────────────────────
  function filterOpts() {
    return {
      deckFilter: state.deckFilter,
      packFilter: state.packFilter,
      authorFilter: state.authorFilter,
      cardPackMap, packCardsMap, packCreatorMap,
    };
  }

  function getActiveCards() {
    return sortCards(state.cardStats.cards || [], state.sortMode, state.sortAsc);
  }

  // The visible (filtered + sorted) set — shared by the rendered list and the
  // preview modal so navigation walks exactly what is on screen.
  function visibleCards() {
    return filterCards(getActiveCards(), filterOpts());
  }

  function buildStatCardOnClick(item) {
    const [deckType, id] = item.compositeId.split(':');
    const deck = deckType === 'live' ? 'living' : deckType;
    return `window.${ns}.previewCard('', '${escAttr(deck)}', '${escAttr(id)}')`;
  }

  // Kept for parity with the original (unused by the main render, which calls
  // renderCardList directly).
  function renderCardRow(title, cards) {
    const filtered = filterCards(cards, filterOpts());
    if (!filtered || filtered.length === 0) {
      return `
        <div class="dashboard__card-row-section">
          <h3 class="dashboard__card-row-title">${title}</h3>
          <p class="dashboard__card-row-empty">No data yet</p>
        </div>`;
    }
    const items = filtered.map((c) => fromStatRow(c));
    return `
      <div class="dashboard__card-row-section">
        <h3 class="dashboard__card-row-title">${title}</h3>
        ${renderCardList(items, {
          size: 'md',
          showStats: true,
          scrollArrows: false,
          legacy: true,
          buildOnClick: buildStatCardOnClick,
        })}
      </div>`;
  }
  void renderCardRow;

  // ── Card Preview Modal (self-contained; overlay appended to document.body) ──
  function ensureOverlay() {
    let overlay = document.getElementById('card-preview-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'card-preview-overlay';
      overlay.style.display = 'none';
      document.body.appendChild(overlay);
    }
    return overlay;
  }

  function getPreviewCards() {
    return visibleCards();
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
    const overlay = ensureOverlay();
    const cards = getPreviewCards();
    if (state.previewIndex < 0 || state.previewIndex >= cards.length) { closePreview(); return; }

    const card = cards[state.previewIndex];
    const deckType = deckTypeForCard(card.card_deck);
    const compositeId = `${deckType}:${card.card_id}`;
    const cardHtml = renderCard(compositeId)
      || `<div class="card card--${deckType} card--text-only"><div class="card__body card__body--text-only"><h3 class="card__title card__title--${deckType}">${card.card_text}</h3></div></div>`;

    const showNav = cards.length > 1;
    const prevBtn = showNav
      ? `<button class="hand__nav-btn hand__nav-btn--prev" onclick="event.stopPropagation(); window.${ns}.prevPreviewCard()">&#8249;</button>`
      : '';
    const nextBtn = showNav
      ? `<button class="hand__nav-btn hand__nav-btn--next" onclick="event.stopPropagation(); window.${ns}.nextPreviewCard()">&#8250;</button>`
      : '';

    overlay.innerHTML = `
      <div class="hand__inspect-overlay hand__inspect-overlay--${deckType}" onclick="window.${ns}.closePreview()">
        ${prevBtn}
        <div class="hand__inspect-card-wrapper" onclick="event.stopPropagation()">
          ${cardHtml}
          ${renderPreviewStats(card)}
          <button class="btn btn--secondary hand__submit-btn" onclick="window.${ns}.closePreview()">Close</button>
        </div>
        ${nextBtn}
      </div>`;
    overlay.style.display = 'block';
  }

  function previewCard(text, deck, cardId) {
    const cards = getPreviewCards();
    state.previewIndex = cards.findIndex((c) => String(c.card_id) === String(cardId) && c.card_deck === deck);
    if (state.previewIndex === -1) {
      // Card not in the analytics list (e.g. from game detail mini-cards) — show standalone
      const overlay = ensureOverlay();
      const deckType = deckTypeForCard(deck);
      const compositeId = `${deckType}:${cardId}`;
      const cardHtml = renderCard(compositeId)
        || `<div class="card card--${deckType} card--text-only"><div class="card__body card__body--text-only"><h3 class="card__title card__title--${deckType}">${text}</h3></div></div>`;
      overlay.innerHTML = `
        <div class="hand__inspect-overlay hand__inspect-overlay--${deckType}" onclick="window.${ns}.closePreview()">
          <div class="hand__inspect-card-wrapper" onclick="event.stopPropagation()">
            ${cardHtml}
            <button class="btn btn--secondary hand__submit-btn" onclick="window.${ns}.closePreview()">Close</button>
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
    state.previewIndex = (state.previewIndex - 1 + cards.length) % cards.length;
    renderPreview();
  }

  function nextPreviewCard() {
    const cards = getPreviewCards();
    if (!cards.length) return;
    state.previewIndex = (state.previewIndex + 1) % cards.length;
    renderPreview();
  }

  function closePreview() {
    const overlay = document.getElementById('card-preview-overlay');
    if (overlay) { overlay.style.display = 'none'; overlay.innerHTML = ''; }
    state.previewIndex = -1;
  }

  // ── Render ──────────────────────────────────────────────────────────────
  function render() {
    if (!state.loaded) { rootEl.innerHTML = '<p class="dashboard__card-row-empty">Loading…</p>'; return; }

    const deckLabels = { all: 'All Decks', die: 'Die', living: 'Live', bye: 'Bye' };
    const deckActive = state.deckFilter !== 'all' ? 'dashboard__filter-btn--active' : '';

    const sortOption = (value, label) =>
      `<option value="${value}" ${state.sortMode === value ? 'selected' : ''}>${label}</option>`;

    const dirArrow = state.sortAsc ? '&#x25B2;' : '&#x25BC;';
    const dirLabel = state.sortAsc ? 'Asc' : 'Desc';

    const filtered = visibleCards();
    const cardsHtml = filtered.length > 0
      ? renderCardList(filtered.map((c) => fromStatRow(c)), {
          size: 'md',
          showStats: true,
          scrollArrows: true,
          legacy: true,
          id: 'card-scroll-row',
          buildOnClick: buildStatCardOnClick,
          highlightStat: state.sortMode,
        })
      : '<p class="dashboard__card-row-empty">No data yet</p>';

    const cardDevLabels = { all: 'With Dev', nodev: 'No Dev', dev: 'Only Dev' };
    const cardDevActive = state.devFilter !== 'all' ? 'dashboard__filter-btn--active' : '';

    const truncateLabel = (str, max = 28) => {
      const s = String(str ?? '');
      return s.length > max ? s.slice(0, max - 1) + '…' : s;
    };

    const packOption = (value, label) =>
      `<option value="${value}" ${state.packFilter === value ? 'selected' : ''}>${label}</option>`;

    const authorOption = (value, label) =>
      `<option value="${value}" ${state.authorFilter === value ? 'selected' : ''}>${label}</option>`;

    rootEl.innerHTML = `
      <div class="dashboard__card-analytics-header">
        <div class="dashboard__sort-bar">
          <select class="dashboard__sort-select" onchange="window.${ns}.setCardSort(this.value)">
            ${sortOption('play_rate', 'Play Rate')}
            ${sortOption('play_count', 'Play Count')}
            ${sortOption('win_rate', 'Win Rate')}
            ${sortOption('draw_count', 'Draw Count')}
          </select>
          <button class="dashboard__filter-btn" onclick="window.${ns}.toggleCardSortDir()" title="${dirLabel}">${dirArrow}</button>
        </div>
        <div class="dashboard__filter-bar">
          <select class="dashboard__sort-select" onchange="window.${ns}.setPackFilter(this.value)">
            ${packOption('all', 'All Packs')}
            ${state.authorFilter === 'all' ? packOption('base', 'Base Game') : ''}
            ${packList.filter((p) => state.authorFilter === 'all' || packCreatorMap[p.id] === state.authorFilter).map((p) => packOption(p.id, truncateLabel(p.title))).join('')}
          </select>
          <select class="dashboard__sort-select" onchange="window.${ns}.setAuthorFilter(this.value)">
            ${authorOption('all', 'All Authors')}
            ${authorList.map((a) => authorOption(a, a)).join('')}
          </select>
          <button class="dashboard__filter-btn ${deckActive}" onclick="window.${ns}.cycleDeckFilter()">${deckLabels[state.deckFilter]}</button>
          <button class="dashboard__filter-btn ${cardDevActive}" onclick="window.${ns}.cycleCardDev()">${cardDevLabels[state.devFilter]}</button>
        </div>
      </div>
      ${cardsHtml}
    `;

    // Bind shared scroll-arrow visibility helper
    requestAnimationFrame(() => bindScrollArrows('card-scroll-row'));
  }

  // ── Handlers (registered on window[ns] for the filter HTML + card onclicks) ──
  const handlers = {
    cycleDeckFilter() {
      const o = ['all', 'die', 'living', 'bye'];
      state.deckFilter = o[(o.indexOf(state.deckFilter) + 1) % o.length];
      render();
    },
    setCardSort(mode) {
      if (state.sortMode === mode) return; // direction toggle handled by toggleCardSortDir()
      state.sortMode = mode;
      state.sortAsc = false;
      render();
    },
    toggleCardSortDir() {
      state.sortAsc = !state.sortAsc;
      render();
    },
    async cycleCardDev() {
      const o = ['nodev', 'all', 'dev'];
      state.devFilter = o[(o.indexOf(state.devFilter) + 1) % o.length];
      await fetchCardStats();
      render();
    },
    setPackFilter(packId) {
      state.packFilter = packId;
      render();
    },
    setAuthorFilter(author) {
      state.authorFilter = author;
      // Reset pack filter if current pack doesn't belong to selected author
      if (author !== 'all' && state.packFilter !== 'all' && state.packFilter !== 'base') {
        if (packCreatorMap[state.packFilter] !== author) {
          state.packFilter = 'all';
        }
      }
      if (author !== 'all' && state.packFilter === 'base') {
        state.packFilter = 'all';
      }
      render();
    },
    previewCard, prevPreviewCard, nextPreviewCard, closePreview,
  };
  if (typeof window !== 'undefined') {
    window[ns] = Object.assign(window[ns] || {}, handlers);
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────
  // Metadata (global packs) loads once via a cached promise; refresh() re-fetches
  // stats only, mirroring the inline refreshAll() which never re-called loadCardData.
  let metadataPromise = null;
  function ensureMetadata() {
    if (!metadataPromise) metadataPromise = loadCardData();
    return metadataPromise;
  }

  async function refresh() {
    await Promise.all([ensureMetadata(), fetchCardStats()]);
    state.loaded = true;
    render();
  }

  render();   // "Loading…" placeholder
  refresh();  // initial metadata + stats load
  return { refresh };
}
