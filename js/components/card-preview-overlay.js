// CarkedIt Online — Shared Card Preview Overlay
//
// Modal overlay that previews a single card from a list, with prev/next nav.
// Extracted from router.js so non-game pages (e.g. the Expansions marketplace)
// can reuse the same look-and-feel without pulling in the full game runtime.
'use strict';

import { render as renderCardFace } from './card.js';
import { get as registryGet } from '../data/CardRegistry.js';

// Reuse the lobby's overlay id so we inherit its full-screen fixed CSS
// (#lobby-card-preview-overlay { position: fixed; inset: 0; z-index: 200 }).
const OVERLAY_ID = 'lobby-card-preview-overlay';

let _list = [];
let _index = 0;

export function setList(items) {
  _list = Array.isArray(items) ? items : [];
}

export function showAt(index) {
  if (!_list.length) return;
  const i = ((index % _list.length) + _list.length) % _list.length;
  _index = i;
  const item = _list[i];
  const card = registryGet(item.compositeId);
  const deckType = card?.deckType || 'die';
  let overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    document.body.appendChild(overlay);
  }
  const cardHtml = card ? card.frontHtml : '';
  const showNav = _list.length > 1;
  const prevBtn = showNav
    ? `<button class="hand__nav-btn hand__nav-btn--prev" onclick="event.stopPropagation(); window.cardPreview.prev()" aria-label="Previous">&#8249;</button>`
    : '';
  const nextBtn = showNav
    ? `<button class="hand__nav-btn hand__nav-btn--next" onclick="event.stopPropagation(); window.cardPreview.next()" aria-label="Next">&#8250;</button>`
    : '';
  overlay.innerHTML = `
    <div class="hand__inspect-overlay hand__inspect-overlay--${deckType}" onclick="window.cardPreview.close()">
      ${prevBtn}
      <div class="hand__inspect-card-wrapper" onclick="event.stopPropagation()">
        ${cardHtml}
        <button class="btn btn--secondary hand__submit-btn" onclick="window.cardPreview.close()">Close</button>
      </div>
      ${nextBtn}
    </div>`;
  overlay.style.display = 'block';
}

export function next() { showAt(_index + 1); }
export function prev() { showAt(_index - 1); }

export function close() {
  const overlay = document.getElementById(OVERLAY_ID);
  if (overlay) { overlay.style.display = 'none'; overlay.innerHTML = ''; }
}

// Expose for inline onclick handlers in cards rendered via renderCardList.
if (typeof window !== 'undefined') {
  window.cardPreview = { setList, showAt, next, prev, close };
}
