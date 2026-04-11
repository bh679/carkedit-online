// CarkedIt Online — Pure Card Render Functions
//
// Extracted from js/components/card.js and js/components/cardBack.js to break
// the circular dependency between Card.js (data layer) and the component
// bridge. These are pure functions: card data in, HTML string out. No imports
// from Card.js or state.js.
'use strict';

// ─── Shared helpers ─────────────────────────────────────────────────────────

/** HTML-attribute escape helper. */
export function escAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Shared classification of a card's `special` state.
 * @param {{special: ?string, options: ?[string,string]}} card
 */
function applySpecial(card) {
  const isMystery = card.special === 'mystery';
  const isSplit = card.special === 'split' && Array.isArray(card.options) && card.options.length === 2;
  const classes = [
    isMystery ? 'card--mystery' : '',
    isSplit ? 'card--split' : '',
  ].filter(Boolean).join(' ');
  return {
    extraClasses: classes ? ' ' + classes : '',
    isMystery,
    isSplit,
    options: isSplit ? card.options : null,
  };
}

/**
 * Inline-style helper for the AI-gen `graphicImage` path.
 */
function graphicBgStyle(graphicImage, deckType) {
  if (!graphicImage) return '';
  return ` style="background: url('${escAttr(graphicImage)}') center / cover no-repeat, var(--color-${deckType}) !important"`;
}

/** Same pattern for the two split-card halves. */
function halfBgStyle(url, fallbackVar) {
  if (!url) return '';
  return ` style="background: url('${escAttr(url)}') center / cover no-repeat, var(${fallbackVar})"`;
}

// ─── Inner templates ────────────────────────────────────────────────────────

function renderDieInner(card, spec) {
  const { deckType } = card;
  const safeTitle = escAttr(card.title);

  if (spec.isSplit) {
    const imgs = Array.isArray(card.graphicImages) ? card.graphicImages : null;
    if (imgs) {
      const imgA = imgs[0] || '';
      const imgB = imgs[1] || '';
      return `
        <div class="card__graphic-area card__graphic-area--${deckType} card__graphic-area--split">
          <div class="card__split-half card__split-half--a"${halfBgStyle(imgA, '--split-bg-a')}></div>
          <div class="card__split-half card__split-half--b"${halfBgStyle(imgB, '--split-bg-b')}></div>
          <span class="card__split-option card__split-option--top">${escAttr(spec.options[0])}</span>
          <span class="card__split-or" aria-hidden="true">OR</span>
          <span class="card__split-option card__split-option--bottom">${escAttr(spec.options[1])}</span>
        </div>`;
    }
    const bgStyle = graphicBgStyle(card.graphicImage, deckType);
    return `
      <div class="card__graphic-area card__graphic-area--${deckType} card__graphic-area--split"${bgStyle}>
        <span class="card__split-option card__split-option--top">${escAttr(spec.options[0])}</span>
        <span class="card__split-or" aria-hidden="true">OR</span>
        <span class="card__split-option card__split-option--bottom">${escAttr(spec.options[1])}</span>
      </div>`;
  }

  const bgStyle = graphicBgStyle(card.graphicImage, deckType);
  if (spec.isMystery) {
    const hasImage = !!card.graphicImage;
    return `
      <div class="card__graphic-area card__graphic-area--${deckType} card__graphic-area--mystery card__graphic-area--title-top"${bgStyle}>
        ${hasImage ? '' : '<div class="card__mystery-mark" aria-hidden="true"></div>'}
        <h3 class="card__title-overlay card__title-overlay--top">${safeTitle}</h3>
      </div>`;
  }
  const pos = card.textPosition === 'bottom' ? 'bottom' : 'top';
  const colorCls = card.textColor === 'white' ? ' card__title-overlay--light' : '';
  return `
    <div class="card__graphic-area card__graphic-area--${deckType} card__graphic-area--title-${pos}"${bgStyle}>
      <h3 class="card__title-overlay card__title-overlay--${pos}${colorCls}">${safeTitle}</h3>
    </div>`;
}

function renderTextBodyInner(card) {
  const { deckType, title, description, prompt } = card;
  const bgStyle = graphicBgStyle(card.graphicImage, deckType);
  return `
    <div class="card__graphic-area card__graphic-area--${deckType}"${bgStyle}></div>
    <div class="card__body card__body--text-only">
      <h3 class="card__title card__title--${deckType}">${title}</h3>
      ${description ? `<p class="card__description">${description}</p>` : ''}
      ${prompt ? `<p class="card__prompt"><span class="card__prompt-icon">&#x1F4AC;</span> ${prompt}</p>` : ''}
    </div>`;
}

function renderInner(card, spec) {
  if (card.deckType === 'die') return renderDieInner(card, spec);
  return renderTextBodyInner(card);
}

function renderBrand(brandImageUrl) {
  if (!brandImageUrl) return '';
  return `<img class="card__brand" src="${escAttr(brandImageUrl)}" alt="" draggable="false" onerror="this.style.display='none'">`;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Render the front face of a card to an HTML string.
 * Pure function — takes a card-data object, returns HTML.
 *
 * @param {object} card  - normalised card object (from Card class or buildCard)
 * @returns {string} HTML
 */
export function renderFrontHtml(card) {
  if (!card) return '';
  const deckType = card.deckType || '';
  const spec = applySpecial(card);
  const brandHtml = renderBrand(card.brandImageUrl);

  if (card.graphicImage || Array.isArray(card.graphicImages)) {
    return `
    <div class="card card--${deckType} card--text-only${spec.extraClasses}">
      ${renderInner(card, spec)}
      ${brandHtml}
      ${spec.isMystery ? '<span class="card__mystery-badge">?</span>' : ''}
    </div>`;
  }

  if (card.image) {
    const fallback = renderInner(card, spec).replace(/\s+/g, ' ').trim();
    const onError = `this.parentElement.classList.add('card--text-only');this.outerHTML='${escAttr(fallback)}';`;
    const altText = [card.title, card.description, card.prompt].filter(Boolean).join(' — ');
    return `
    <div class="card card--${deckType}${spec.extraClasses}">
      <img src="${escAttr(card.image)}" alt="${escAttr(altText)}" class="card__img" draggable="false" onerror="${onError}">
      ${brandHtml}
      ${spec.isMystery ? '<span class="card__mystery-badge">?</span>' : ''}
    </div>`;
  }

  return `
    <div class="card card--${deckType} card--text-only${spec.extraClasses}">
      ${renderInner(card, spec)}
      ${brandHtml}
    </div>`;
}

// ─── Card Back ──────────────────────────────────────────────────────────────

const DECK_WORDS = ['LIVE', 'DIE', 'BYE!'];
const HIGHLIGHT_MAP = { die: 'DIE', live: 'LIVE', bye: 'BYE!' };

/**
 * Render the back face of a card to an HTML string.
 * @param {string} deckType - 'die' | 'live' | 'bye'
 * @returns {string} HTML
 */
export function renderBackHtml(deckType = 'die') {
  const highlighted = HIGHLIGHT_MAP[deckType] ?? 'DIE';
  const words = DECK_WORDS.map(word => {
    const isHighlighted = word === highlighted;
    const cssClass = isHighlighted ? 'card-back__word' : 'card-back__word card-back__word--faded';
    return `<span class="${cssClass}">${word}</span>`;
  }).join('\n      ');

  return `
    <div class="card-back card-back--${deckType}">
      <img class="card-back__image"
           src="assets/card-backs/${deckType}-back.jpg"
           alt="${deckType} deck back"
           draggable="false"
           onload="this.closest('.card-back').querySelector('.card-back__fallback').style.display='none'"
           onerror="this.style.display='none'">
      <div class="card-back__fallback">
        ${words}
      </div>
    </div>
  `;
}
