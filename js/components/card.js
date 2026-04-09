// CarkedIt Online — Card Component
//
// Renders a canonical Card object (see js/data/card.js) into HTML. The
// exported entry point `render(card)` dispatches on `card.deckType` to a
// per-deck renderer; shared mystery/split handling lives in `applySpecial`
// so the image and text-only code paths can't drift apart.
'use strict';

/** HTML-attribute escape helper. Exported for test / designer reuse. */
export function escAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Shared classification of a card's `special` state. Both the image and
 * text-only paths consume this same result so the two can't drift.
 *
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
 * Die-deck inner template: title-overlay layout, with mystery and split
 * variants. Only place the die-specific graphic area shape lives.
 */
function renderDieInner(card, spec) {
  const { deckType } = card;
  const safeTitle = escAttr(card.title);
  if (spec.isSplit) {
    return `
      <div class="card__graphic-area card__graphic-area--${deckType} card__graphic-area--split">
        <span class="card__split-option card__split-option--top">${escAttr(spec.options[0])}</span>
        <span class="card__split-or" aria-hidden="true">OR</span>
        <span class="card__split-option card__split-option--bottom">${escAttr(spec.options[1])}</span>
      </div>`;
  }
  if (spec.isMystery) {
    return `
      <div class="card__graphic-area card__graphic-area--${deckType} card__graphic-area--mystery card__graphic-area--title-top">
        <div class="card__mystery-mark" aria-hidden="true"></div>
        <h3 class="card__title-overlay card__title-overlay--top">${safeTitle}</h3>
      </div>`;
  }
  return `
    <div class="card__graphic-area card__graphic-area--${deckType} card__graphic-area--title-top">
      <h3 class="card__title-overlay card__title-overlay--top">${safeTitle}</h3>
    </div>`;
}

/**
 * Live/bye-deck inner template: description + prompt body below the graphic.
 * Shared implementation — live and bye differ only in `deckType` class names.
 */
function renderTextBodyInner(card) {
  const { deckType, title, description, prompt } = card;
  return `
    <div class="card__graphic-area card__graphic-area--${deckType}"></div>
    <div class="card__body card__body--text-only">
      <h3 class="card__title card__title--${deckType}">${title}</h3>
      ${description ? `<p class="card__description">${description}</p>` : ''}
      ${prompt ? `<p class="card__prompt"><span class="card__prompt-icon">&#x1F4AC;</span> ${prompt}</p>` : ''}
    </div>`;
}

/** Dispatch on deckType: pick the inner (image-fallback / text-only) template. */
function renderInner(card, spec) {
  if (card.deckType === 'die') return renderDieInner(card, spec);
  return renderTextBodyInner(card);
}

/** Shared brand-image HTML for every deck. */
function renderBrand(brandImageUrl) {
  if (!brandImageUrl) return '';
  return `<img class="card__brand" src="${escAttr(brandImageUrl)}" alt="" onerror="this.style.display='none'">`;
}

/**
 * Render a canonical Card object into an HTML string.
 * Accepts a Card produced by `buildCard()` — see js/data/card.js.
 *
 * @param {object} card
 * @returns {string} HTML
 */
export function render(card) {
  if (!card) return '';
  const deckType = card.deckType || '';
  const spec = applySpecial(card);
  const brandHtml = renderBrand(card.brandImageUrl);

  if (card.image) {
    // Illustrated card. If the image fails to load we swap the wrapper to
    // the text-only variant and substitute the inner markup. The fallback
    // HTML is generated from the SAME `renderInner` call the text-only
    // branch uses, so the two code paths can't drift.
    const fallback = renderInner(card, spec).replace(/\s+/g, ' ').trim();
    const onError = `this.parentElement.classList.add('card--text-only');this.outerHTML='${escAttr(fallback)}';`;
    const altText = [card.title, card.description, card.prompt].filter(Boolean).join(' — ');
    return `
    <div class="card card--${deckType}${spec.extraClasses}">
      <img src="${escAttr(card.image)}" alt="${escAttr(altText)}" class="card__img" onerror="${onError}">
      ${brandHtml}
      ${spec.isMystery ? '<span class="card__mystery-badge">?</span>' : ''}
    </div>`;
  }

  // Text-only (custom pack without illustration, or designer preview).
  return `
    <div class="card card--${deckType} card--text-only${spec.extraClasses}">
      ${renderInner(card, spec)}
      ${brandHtml}
    </div>`;
}
