// CarkedIt Online — Card Component
'use strict';

/**
 * @param {{ title: string, description: string, prompt: string, image: string, deckType: string }} cardData
 * @returns {string} HTML string
 */
export function render({ title = '', description = '', prompt = '', image = '', illustrationKey = '', deckType = '' } = {}) {
  const imgSrc = image || (illustrationKey && deckType ? `assets/illustrations/${deckType}/${illustrationKey}.jpg` : '');
  const altText = [title, description, prompt].filter(Boolean).join(' — ');

  return `
    <div class="card card--${deckType}">
      ${imgSrc
        ? `<img src="${imgSrc}" alt="${altText}" class="card__img">`
        : `
        <div class="card__image">
          <div class="card__image-placeholder"></div>
        </div>
        <div class="card__body">
          <h3 class="card__title">${title}</h3>
          <p class="card__description">${description}</p>
          ${prompt ? `<p class="card__prompt">${prompt}</p>` : ''}
        </div>`
      }
    </div>
  `;
}
