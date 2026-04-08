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
 */
function renderTextOnlyInner(title, description, prompt, deckType) {
  if (deckType === 'die') {
    return `
      <div class="card__graphic-area card__graphic-area--${deckType}">
        <h3 class="card__title-overlay">${title}</h3>
      </div>`;
  }
  return `
      <div class="card__graphic-area card__graphic-area--${deckType}"></div>
      <div class="card__body card__body--text-only">
        <h3 class="card__title card__title--${deckType}">${title}</h3>
        ${description ? `<p class="card__description">${description}</p>` : ''}
        ${prompt ? `<p class="card__prompt"><span class="card__prompt-icon">&#x1F4AC;</span> ${prompt}</p>` : ''}
      </div>`;
}

export function render({ title = '', description = '', prompt = '', image = '', illustrationKey = '', deckType = '', brandImageUrl = '', packId = '' } = {}) {
  const imgSrc = image || (illustrationKey && deckType ? `assets/illustrations/${deckType}/${illustrationKey}.jpg` : '');
  const altText = [title, description, prompt].filter(Boolean).join(' — ');
  const brand = brandImageUrl || getPackBrand(packId);
  const brandHtml = brand
    ? `<img class="card__brand" src="${escAttr(brand)}" alt="" onerror="this.style.display='none'">`
    : '';

  if (imgSrc) {
    // If the image fails to load, swap the .card to the text-only variant
    // (same styling as custom packs without illustrations).
    const fallback = renderTextOnlyInner(title, description, prompt, deckType)
      .replace(/\s+/g, ' ')
      .trim();
    const onError = `this.parentElement.classList.add('card--text-only');this.outerHTML='${escAttr(fallback)}';`;
    return `
    <div class="card card--${deckType}">
      <img src="${imgSrc}" alt="${altText}" class="card__img" onerror="${onError}">
      ${brandHtml}
    </div>`;
  }

  // Text-only fallback — styled to match illustrated card layouts per deck
  return `
    <div class="card card--${deckType} card--text-only">
      ${renderTextOnlyInner(title, description, prompt, deckType)}
      ${brandHtml}
    </div>`;
}
