// CarkedIt Online — Reusable Pack Card component
// Renders a single expansion pack card and a grid of cards.
// Used by the marketplace browse/favourites lists and the manage-account screen.
'use strict';

import { render as renderPackBg } from './pack-card-background.js';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/**
 * Render a single pack card.
 * @param {object} p   - pack object
 * @param {object} [opts]
 * @param {boolean} [opts.showFavorite=true]  - render the ★ favourite toggle
 * @returns {string} HTML
 */
export function renderPackCard(p, opts = {}) {
  const { showFavorite = true } = opts;
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
        ${showFavorite ? `
          <button class="pack-card__save ${fav ? 'pack-card__save--saved' : ''}" data-action="toggle-fav" data-pack-id="${esc(p.id)}" data-fav="${fav}">
            ${fav ? '★' : '☆'}
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Render a responsive grid of pack cards.
 * @param {object[]} packs
 * @param {object} [opts]
 * @param {string}  [opts.emptyMessage]
 * @param {boolean} [opts.showFavorite]
 * @returns {string} HTML
 */
export function renderPackGrid(packs, opts = {}) {
  if (!packs || packs.length === 0) {
    return `<p class="marketplace__empty">${esc(opts.emptyMessage || 'No expansions yet.')}</p>`;
  }
  return `<div class="marketplace__grid">${packs.map((p) => renderPackCard(p, opts)).join('')}</div>`;
}
