// CarkedIt Online — Shared Card List Component
//
// Renders a horizontal scrolling strip of cards. Used by the dashboard
// (with stats) and the online lobby pack preview (without stats).
'use strict';

import { render as renderCardFace } from './card.js';
import { buildCard } from '../data/card.js';
// Side-effect import: installs the document-level swipe handler for any
// `.hand__inspect-overlay` modal opened from a card in these lists. Safe
// to double-import (the module uses an idempotent window flag).
import './swipe-overlay.js';

function escAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function deckTypeFor(deck) {
  if (deck === 'living' || deck === 'live') return 'live';
  if (deck === 'bye') return 'bye';
  return 'die';
}

/**
 * Render a single card face. Delegates to the shared `card.js` component
 * which handles image-with-fallback (when an image fails to load, the
 * card swaps to the same text-only styling used for custom packs).
 */
function renderItemFace(item) {
  return renderCardFace(buildCard({
    title: item.text || '',
    image: item.imgSrc || '',
    deckType: deckTypeFor(item.deck),
    special: item.special || null,
    options: item.options || null,
  }));
}

/**
 * Build the inner stats row markup for a single card (dashboard variant).
 */
function renderStats(stats) {
  if (!stats) return '';
  const playRate = stats.draw_count > 0 ? `${stats.play_rate}% rate` : '';
  return `
    <div class="card-list__stats dashboard__stat-card-data">
      <span>${stats.play_count}/${stats.draw_count || '?'} plays</span>
      <span>${playRate}</span>
      <span>${stats.win_count} wins</span>
      <span class="dashboard__stat-card-rate">${stats.win_rate}% win</span>
    </div>`;
}

/**
 * @typedef {Object} CardListItem
 * @property {string|number} [id]
 * @property {'die'|'live'|'living'|'bye'} deck
 * @property {string} text
 * @property {string} [imgSrc]                     - Pre-resolved image src, if any
 * @property {Object} [stats]                      - { play_count, draw_count, play_rate, win_count, win_rate }
 *
 * @param {CardListItem[]} items
 * @param {Object} [opts]
 * @param {'sm'|'md'}   [opts.size='md']
 * @param {boolean}     [opts.showStats=false]
 * @param {boolean}     [opts.scrollArrows=true]
 * @param {string}      [opts.id]                  - DOM id for the scroll container
 * @param {string}      [opts.emptyText='No cards']
 * @param {string}      [opts.itemOnClick]         - Inline JS template; receives `${item}` substituted
 *                                                   via opts.buildOnClick(item) — preferred.
 * @param {(item:CardListItem)=>string} [opts.buildOnClick]
 * @param {boolean}     [opts.legacy=false]        - Apply dashboard__* legacy classes for CSS parity.
 * @returns {string} HTML string
 */
export function render(items, opts = {}) {
  const {
    size = 'md',
    showStats = false,
    scrollArrows = true,
    id,
    emptyText = 'No cards',
    buildOnClick,
    legacy = false,
  } = opts;

  if (!Array.isArray(items) || items.length === 0) {
    return `<p class="card-list__empty ${legacy ? 'dashboard__card-row-empty' : ''}">${escAttr(emptyText)}</p>`;
  }

  const wrapperClasses = [
    'card-list__wrapper',
    legacy ? 'dashboard__card-row-wrapper' : '',
  ].filter(Boolean).join(' ');

  const scrollClasses = [
    'card-list__scroll',
    `card-list__scroll--${size}`,
    legacy ? 'dashboard__card-row-scroll' : '',
  ].filter(Boolean).join(' ');

  const itemClasses = [
    'card-list__item',
    `card-list__item--${size}`,
    legacy ? 'dashboard__stat-card-wrap' : '',
  ].filter(Boolean).join(' ');

  const itemsHtml = items.map((it) => {
    const onClick = buildOnClick ? buildOnClick(it) : '';
    const onClickAttr = onClick ? ` onclick="${onClick}"` : '';
    return `
      <div class="${itemClasses}"${onClickAttr}>
        ${renderItemFace(it)}
        ${showStats ? renderStats(it.stats) : ''}
      </div>`;
  }).join('');

  const idAttr = id ? ` id="${id}"` : '';

  if (!scrollArrows) {
    return `
      <div class="${wrapperClasses}">
        <div class="${scrollClasses}"${idAttr}>${itemsHtml}</div>
      </div>`;
  }

  const leftId  = id ? `${id}-left`  : '';
  const rightId = id ? `${id}-right` : '';
  const leftIdAttr  = leftId  ? ` id="${leftId}"`  : '';
  const rightIdAttr = rightId ? ` id="${rightId}"` : '';
  const scrollFn = id ? `window.cardList.scroll('${escAttr(id)}', -1)` : '';
  const scrollFnRight = id ? `window.cardList.scroll('${escAttr(id)}', 1)` : '';

  return `
    <div class="${wrapperClasses}">
      <button class="card-list__nav card-list__nav--left dashboard__scroll-btn dashboard__scroll-btn--left"${leftIdAttr} onclick="${scrollFn}" aria-label="Scroll left" style="display:none">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <div class="${scrollClasses}"${idAttr}>${itemsHtml}</div>
      <button class="card-list__nav card-list__nav--right dashboard__scroll-btn dashboard__scroll-btn--right"${rightIdAttr} onclick="${scrollFnRight}" aria-label="Scroll right">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>`;
}

/**
 * Adapter: convert the dashboard's stat-row shape into a CardListItem.
 *
 * @param {Object} card - { card_id, card_deck, card_text, ...stats }
 * @param {(id, deck)=>string|null} [resolveImage]
 * @returns {CardListItem}
 */
export function fromStatRow(card, resolveImage) {
  return {
    id: card.card_id,
    deck: card.card_deck,
    text: card.card_text,
    imgSrc: resolveImage ? resolveImage(card.card_id, card.card_deck) : undefined,
    stats: {
      play_count: card.play_count,
      draw_count: card.draw_count,
      play_rate: card.play_rate,
      win_count: card.win_count,
      win_rate: card.win_rate,
    },
  };
}

/**
 * Bind scroll-arrow visibility for a list rendered with scrollArrows + an id.
 * Call after the list is in the DOM.
 */
export function bindScrollArrows(scrollId) {
  const row = document.getElementById(scrollId);
  if (!row) return;
  const update = () => updateArrows(scrollId);
  update();
  row.addEventListener('scroll', update);
}

function updateArrows(scrollId) {
  const row  = document.getElementById(scrollId);
  const left = document.getElementById(`${scrollId}-left`);
  const right = document.getElementById(`${scrollId}-right`);
  if (!row) return;
  const canLeft  = row.scrollLeft > 4;
  const canRight = row.scrollLeft + row.clientWidth < row.scrollWidth - 4;
  if (left)  left.style.display  = canLeft  ? '' : 'none';
  if (right) right.style.display = canRight ? '' : 'none';
}

function scroll(scrollId, direction) {
  const el = document.getElementById(scrollId);
  if (!el) return;
  el.scrollBy({ left: direction * 300, behavior: 'smooth' });
  setTimeout(() => updateArrows(scrollId), 350);
}

// Expose scroll handler globally so inline onclick can find it without imports.
if (typeof window !== 'undefined') {
  window.cardList = window.cardList || {};
  window.cardList.scroll = scroll;
  window.cardList.bindScrollArrows = bindScrollArrows;
}
