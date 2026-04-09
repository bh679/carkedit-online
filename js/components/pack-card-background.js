// CarkedIt Online — Pack row background (faded featured card + deck bands)
'use strict';

import { render as renderCard } from './card.js';
import { buildCard } from '../data/card.js';

/**
 * Render an absolutely-positioned background for a pack row.
 * Returns "" when there is nothing to show.
 *
 * @param {{
 *   featured_card_text?: string|null,
 *   featured_card_deck?: 'die'|'live'|'bye'|null,
 *   die_count?: number,
 *   live_count?: number,
 *   bye_count?: number,
 * }} pack
 */
export function render(pack) {
  const ftext = pack?.featured_card_text;
  const fdeck = pack?.featured_card_deck;
  const die = Number(pack?.die_count ?? 0);
  const live = Number(pack?.live_count ?? 0);
  const bye = Number(pack?.bye_count ?? 0);

  if (!ftext && die === 0 && live === 0 && bye === 0) return '';

  const cardLayer = ftext && fdeck
    ? `<div class="pack-bg__card">${renderCard(buildCard({ title: ftext, deckType: fdeck, brandImageUrl: pack?.brand_image_url || '' }))}</div>`
    : '';

  // 45° diagonal gradient using card-back colours of decks this pack contains.
  const decks = [
    die > 0 ? 'var(--color-die)' : null,
    live > 0 ? 'var(--color-live)' : null,
    bye > 0 ? 'var(--color-bye)' : null,
  ].filter(Boolean);

  let overlayHtml = '';
  if (decks.length > 0) {
    const step = 100 / decks.length;
    const stops = decks
      .map((c, i) => `${c} ${(i * step).toFixed(2)}% ${((i + 1) * step).toFixed(2)}%`)
      .join(', ');
    const gradient = `linear-gradient(135deg, ${stops})`;
    overlayHtml = `<div class="pack-bg__overlay" style="background-image: ${gradient};"></div>`;
  }

  return `<div class="pack-bg" aria-hidden="true">${overlayHtml}${cardLayer}</div>`;
}
