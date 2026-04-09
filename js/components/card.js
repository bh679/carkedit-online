// CarkedIt Online — Card Component
'use strict';

import { getPackBrand } from '../state.js';

/**
 * @param {{ title: string, description: string, prompt: string, image: string, deckType: string }} cardData
 * @returns {string} HTML string
 */
function escAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Render the text-only inner contents (no outer .card wrapper) for a given
 * deck type. Used both as the standalone text-only template and as the
 * onerror fallback when an image fails to load.
 *
 * When `graphicImage` is set, the `.card__graphic-area` div gets an inline
 * `background:` shorthand that swaps the splatter-*.svg pattern for the
 * supplied image while still keeping the deck colour as a fallback fill.
 * Inline styles beat the stylesheet's `background:` shorthand by specificity,
 * so no `!important` is needed. Used by AI-generated card images so the
 * title overlay / body text / rounded graphic-area corners are preserved.
 */
function renderTextOnlyInner(title, description, prompt, deckType, special, options, graphicImage = '', graphicImages = null) {
  // `!important` is required here: the mystery (.card__graphic-area--mystery,
  // card.css line 216) and split (.card__graphic-area--split, line 263)
  // variants ship their own `background: … !important` declarations, and an
  // un-important inline style can't beat a stylesheet `!important`. Adding
  // `!important` to the inline declaration wins (inline `!important` > stylesheet
  // `!important`) so AI images display on every die variant.
  const bgStyle = graphicImage
    ? ` style="background: url('${escAttr(graphicImage)}') center / cover no-repeat, var(--color-${deckType}) !important"`
    : '';

  // Per-half background styles for the Die Split two-image layout. When a
  // slot is empty we return no inline style so the default
  // `.card__split-half--{top|bottom}` fallback colour shows through.
  const halfStyle = (url, fallbackVar) => url
    ? ` style="background: url('${escAttr(url)}') center / cover no-repeat, var(${fallbackVar})"`
    : '';

  if (deckType === 'die') {
    const isSplit = special === 'Split' && Array.isArray(options) && options.length === 2;
    const isMystery = special === '?';
    const safeTitle = escAttr(title);
    if (isSplit) {
      // Two-image split layout: ship an empty array by default so the
      // halves always render with fallback colours, giving a visible
      // diagonal divide even before any image is generated. When the
      // caller passes `graphicImages: [urlA, urlB]`, each half picks up
      // its own background. The single-image `graphicImage` still works
      // on the parent for backwards compat when `graphicImages` isn't set.
      // Slot A is the upper-left triangle, slot B is the lower-right
      // triangle (see .card__split-half--{a,b} clip-paths in card.css).
      const imgs = Array.isArray(graphicImages) ? graphicImages : [];
      const imgA = imgs[0] || '';
      const imgB = imgs[1] || '';
      // If the caller provided `graphicImages` at all (even empty slots),
      // use the two-halves layout. Otherwise keep backwards-compatible
      // single-fill behaviour via the parent-level `bgStyle`.
      const useHalves = Array.isArray(graphicImages);
      const parentStyle = useHalves ? '' : bgStyle;
      const halvesMarkup = useHalves
        ? `
          <div class="card__split-half card__split-half--a"${halfStyle(imgA, '--split-bg-a')}></div>
          <div class="card__split-half card__split-half--b"${halfStyle(imgB, '--split-bg-b')}></div>`
        : '';
      return `
        <div class="card__graphic-area card__graphic-area--${deckType} card__graphic-area--split"${parentStyle}>${halvesMarkup}
          <span class="card__split-option card__split-option--top">${escAttr(options[0])}</span>
          <span class="card__split-or" aria-hidden="true">OR</span>
          <span class="card__split-option card__split-option--bottom">${escAttr(options[1])}</span>
        </div>`;
    }
    if (isMystery) {
      return `
        <div class="card__graphic-area card__graphic-area--${deckType} card__graphic-area--mystery card__graphic-area--title-top"${bgStyle}>
          <div class="card__mystery-mark" aria-hidden="true"></div>
          <h3 class="card__title-overlay card__title-overlay--top">${safeTitle}</h3>
        </div>`;
    }
    return `
      <div class="card__graphic-area card__graphic-area--${deckType} card__graphic-area--title-top"${bgStyle}>
        <h3 class="card__title-overlay card__title-overlay--top">${safeTitle}</h3>
      </div>`;
  }
  return `
      <div class="card__graphic-area card__graphic-area--${deckType}"${bgStyle}></div>
      <div class="card__body card__body--text-only">
        <h3 class="card__title card__title--${deckType}">${title}</h3>
        ${description ? `<p class="card__description">${description}</p>` : ''}
        ${prompt ? `<p class="card__prompt"><span class="card__prompt-icon">&#x1F4AC;</span> ${prompt}</p>` : ''}
      </div>`;
}

export function render({ title = '', description = '', prompt = '', image = '', graphicImage = '', graphicImages = null, illustrationKey = '', deckType = '', brandImageUrl = '', packId = '', special = '', options = null } = {}) {
  const imgSrc = image || (illustrationKey && deckType ? `assets/illustrations/${deckType}/${illustrationKey}.jpg` : '');
  const altText = [title, description, prompt].filter(Boolean).join(' — ');
  const brand = brandImageUrl || getPackBrand(packId);
  const brandHtml = brand
    ? `<img class="card__brand" src="${escAttr(brand)}" alt="" onerror="this.style.display='none'">`
    : '';
  const optsArr = Array.isArray(options) ? options : (options && typeof options[Symbol.iterator] === 'function' ? Array.from(options) : null);

  // graphicImage / graphicImages path — AI-generated art that replaces
  // only the splatter pattern in the text-only layout. Keeps title
  // overlay / body text / rounded graphic-area corners / brand badge
  // intact. `graphicImages` (array) is the Die Split two-slot layout;
  // `graphicImage` (string) is the single-fill path used by every other
  // variant. If either is set, we take the text-only layout branch.
  if (graphicImage || Array.isArray(graphicImages)) {
    return `
    <div class="card card--${deckType} card--text-only${special === '?' ? ' card--mystery' : ''}${special === 'Split' ? ' card--split' : ''}">
      ${renderTextOnlyInner(title, description, prompt, deckType, special, optsArr, graphicImage, graphicImages)}
      ${brandHtml}
      ${special === '?' ? '<span class="card__mystery-badge">?</span>' : ''}
    </div>`;
  }

  if (imgSrc) {
    // If the image fails to load, swap the .card to the text-only variant
    // (same styling as custom packs without illustrations).
    const fallback = renderTextOnlyInner(title, description, prompt, deckType, special, optsArr)
      .replace(/\s+/g, ' ')
      .trim();
    const onError = `this.parentElement.classList.add('card--text-only');this.outerHTML='${escAttr(fallback)}';`;
    return `
    <div class="card card--${deckType}${special === '?' ? ' card--mystery' : ''}${special === 'Split' ? ' card--split' : ''}">
      <img src="${imgSrc}" alt="${altText}" class="card__img" onerror="${onError}">
      ${brandHtml}
      ${special === '?' ? '<span class="card__mystery-badge">?</span>' : ''}
    </div>`;
  }

  // Text-only fallback — styled to match illustrated card layouts per deck
  return `
    <div class="card card--${deckType} card--text-only${special === '?' ? ' card--mystery' : ''}${special === 'Split' ? ' card--split' : ''}">
      ${renderTextOnlyInner(title, description, prompt, deckType, special, optsArr)}
      ${brandHtml}
    </div>`;
}
