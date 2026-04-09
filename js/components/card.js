// CarkedIt Online — Card Component
//
// Renders a canonical Card object (see js/data/card.js) into HTML. The
// exported entry point `render(card)` dispatches on `card.deckType` to a
// per-deck renderer; shared mystery/split handling lives in `applySpecial`
// so the image and text-only code paths can't drift apart.
//
// AI-generated art paths:
//   - `card.graphicImage`  — single URL, drops into .card__graphic-area
//     as an inline background, keeping the text-only layout (title
//     overlay / body text / rounded corners) intact.
//   - `card.graphicImages` — [slotA, slotB] for Die Split cards, renders
//     two absolute-positioned .card__split-half divs that clip into
//     triangles (see .card__split-half--a / --b in card.css).
//
// Both beat the stylesheet's `background: … !important` on mystery and
// split variants by using inline `!important` themselves. When neither
// is set, the original splatter-pattern text-only layout renders.
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
 * Inline-style helper for the AI-gen `graphicImage` path. When set, the
 * .card__graphic-area div gets `background: url(…) cover, var(--color-*)
 * !important` which beats the stylesheet's own `background: …` shorthand
 * on mystery (.card__graphic-area--mystery line ~216) and split
 * (.card__graphic-area--split line ~263). Inline `!important` wins over
 * stylesheet `!important`.
 */
function graphicBgStyle(graphicImage, deckType) {
  if (!graphicImage) return '';
  return ` style="background: url('${escAttr(graphicImage)}') center / cover no-repeat, var(--color-${deckType}) !important"`;
}

/** Same pattern for the two split-card halves, each with its own fallback colour var. */
function halfBgStyle(url, fallbackVar) {
  if (!url) return '';
  return ` style="background: url('${escAttr(url)}') center / cover no-repeat, var(${fallbackVar})"`;
}

/**
 * Die-deck inner template: title-overlay layout, with mystery and split
 * variants. Only place the die-specific graphic area shape lives.
 *
 * When `card.graphicImage` is set on a non-split die card, the graphic
 * area div gets an inline background. When `card.graphicImages` is an
 * array on a split card, two absolute-positioned half divs render behind
 * the option text + OR circle.
 */
function renderDieInner(card, spec) {
  const { deckType } = card;
  const safeTitle = escAttr(card.title);

  if (spec.isSplit) {
    const imgs = Array.isArray(card.graphicImages) ? card.graphicImages : null;
    // Only emit the halves markup when the caller explicitly passed a
    // graphicImages array (even empty slots). Otherwise keep backwards
    // compatibility with the single-image `graphicImage` path on the
    // parent div.
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
    // No graphicImages array — fall back to single-fill `graphicImage`
    // on the parent (or nothing, showing the default gradient).
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
    return `
      <div class="card__graphic-area card__graphic-area--${deckType} card__graphic-area--mystery card__graphic-area--title-top"${bgStyle}>
        <div class="card__mystery-mark" aria-hidden="true"></div>
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

/**
 * Live/bye-deck inner template: description + prompt body below the graphic.
 * Shared implementation — live and bye differ only in `deckType` class names.
 *
 * When `card.graphicImage` is set, the graphic area holds the AI art
 * inside its rounded-corner 55% rectangle; the body text stays below
 * untouched.
 */
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

/** Dispatch on deckType: pick the inner (image-fallback / text-only) template. */
function renderInner(card, spec) {
  if (card.deckType === 'die') return renderDieInner(card, spec);
  return renderTextBodyInner(card);
}

/** Shared brand-image HTML for every deck. */
function renderBrand(brandImageUrl) {
  if (!brandImageUrl) return '';
  return `<img class="card__brand" src="${escAttr(brandImageUrl)}" alt="" draggable="false" onerror="this.style.display='none'">`;
}

/**
 * Render a canonical Card object into an HTML string.
 * Accepts a Card produced by `buildCard()` — see js/data/card.js.
 *
 * Resolution order for the inner markup:
 *   1. `card.graphicImage` or `card.graphicImages` set →
 *      text-only layout with AI art in the graphic area
 *   2. `card.image` set → illustrated full-bleed layout with the
 *      text-only inner as an onerror fallback
 *   3. Neither → text-only with the default splatter pattern
 *
 * @param {object} card
 * @returns {string} HTML
 */
export function render(card) {
  if (!card) return '';
  const deckType = card.deckType || '';
  const spec = applySpecial(card);
  const brandHtml = renderBrand(card.brandImageUrl);

  // graphicImage / graphicImages path — AI-generated art that replaces
  // only the splatter pattern in the text-only layout. Keeps title
  // overlay / body text / rounded graphic-area corners / brand badge
  // intact. Used by the admin image-gen preview and (future) in-game
  // rendering of saved AI cards.
  if (card.graphicImage || Array.isArray(card.graphicImages)) {
    return `
    <div class="card card--${deckType} card--text-only${spec.extraClasses}">
      ${renderInner(card, spec)}
      ${brandHtml}
      ${spec.isMystery ? '<span class="card__mystery-badge">?</span>' : ''}
    </div>`;
  }

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
      <img src="${escAttr(card.image)}" alt="${escAttr(altText)}" class="card__img" draggable="false" onerror="${onError}">
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
