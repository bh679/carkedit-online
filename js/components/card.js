// CarkedIt Online — Card Component
'use strict';

/**
 * @param {{ title: string, description: string, prompt: string, image: string, deckType: string }} cardData
 * @returns {string} HTML string
 */
export function render({ title = '', description = '', prompt = '', image = '', illustrationKey = '', deckType = '' } = {}) {
  const imgSrc = image || (illustrationKey && deckType ? `assets/illustrations/${deckType}/${illustrationKey}.jpg` : '');
  const altText = [title, description, prompt].filter(Boolean).join(' — ');

  if (imgSrc) {
    return `
    <div class="card card--${deckType}">
      <img src="${imgSrc}" alt="${altText}" class="card__img">
    </div>`;
  }

  // Text-only fallback — styled to match illustrated card layouts per deck
  if (deckType === 'die') {
    // Die cards: full-bleed layout, title at top, coloured background fills entire card
    return `
    <div class="card card--${deckType} card--text-only">
      <div class="card__graphic-area card__graphic-area--${deckType}">
        <h3 class="card__title-overlay">${title}</h3>
      </div>
    </div>`;
  }

  // Live / Bye cards: illustration area top ~60%, text section bottom ~40%
  return `
    <div class="card card--${deckType} card--text-only">
      <div class="card__graphic-area card__graphic-area--${deckType}"></div>
      <div class="card__body card__body--text-only">
        <h3 class="card__title card__title--${deckType}">${title}</h3>
        ${description ? `<p class="card__description">${description}</p>` : ''}
        ${prompt ? `<p class="card__prompt"><span class="card__prompt-icon">&#x1F4AC;</span> ${prompt}</p>` : ''}
      </div>
    </div>`;
}
