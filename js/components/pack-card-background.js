// CarkedIt Online — Pack row background (faded featured card + deck bands)
'use strict';

import { render as renderCard } from './card.js';

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
    ? `<div class="pack-bg__card">${renderCard({ title: ftext, deckType: fdeck })}</div>`
    : '';

  const bands = [
    die > 0 ? '<span class="pack-bg__band pack-bg__band--die"></span>' : '',
    live > 0 ? '<span class="pack-bg__band pack-bg__band--live"></span>' : '',
    bye > 0 ? '<span class="pack-bg__band pack-bg__band--bye"></span>' : '',
  ].join('');

  return `<div class="pack-bg" aria-hidden="true">${cardLayer}<div class="pack-bg__bands">${bands}</div></div>`;
}
