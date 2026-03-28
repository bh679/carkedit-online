// CarkedIt Online — Living Dead Profile Component
'use strict';

import { render as renderCard } from './card.js';
import { render as renderCardBack } from './cardBack.js';
import { renderInspectOverlay } from './hand.js';

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/**
 * Calculates a font size (px) that fits the name on one line.
 * Uses uppercase bold char width ratio ≈ 0.75em, container ≈ 340px.
 */
function calcNameFontSize(name) {
  const containerPx = 340;
  const maxFontPx = Math.min(64, containerPx / (name.length * 0.75));
  return `${Math.max(18, Math.round(maxFontPx))}px`;
}

function formatBirthday(player) {
  if (!player.birthMonth || !player.birthDay) return '';
  const birth = `${MONTH_ABBR[player.birthMonth - 1]} ${player.birthDay}`;
  const now = new Date();
  const death = `${MONTH_ABBR[now.getMonth()]} ${now.getDate()}`;
  return `\uD83C\uDF82 ${birth} \u2192 \uD83D\uDC80 ${death}`;
}

/**
 * Simple full-screen view overlay for profile card inspection (no submit action).
 * Reuses the shared inspect overlay with no nav arrows and a Close button.
 */
function renderViewOverlay(card, deckType) {
  return renderInspectOverlay({
    selectedCard: card,
    deckType,
    submitLabel: 'Close',
    onSubmit: 'window.game.dismissProfileCard()',
    onDismiss: 'window.game.dismissProfileCard()',
    btnStyle: 'secondary',
  });
}

/**
 * Renders the Living Dead profile — shown during 'living-dead' and 'selecting' sub-states.
 * Focuses on who the Living Dead is rather than their die card.
 *
 * @param {object} options
 * @param {object} options.player - { name, birthMonth, birthDay }
 * @param {object|null} options.dieCard - The Living Dead's die card
 * @param {Array} options.chosenCards - Cards chosen as favorites in previous rounds
 * @param {object|null} options.profileInspectCard - Card currently shown in overlay
 * @param {string} options.deckType - 'live' | 'bye'
 * @param {string} options.hint - Hint text shown below the profile
 * @param {object} options.submittedCards - { [playerName]: card } submitted cards
 * @param {boolean} options.submittedRevealed - When true, render card fronts instead of backs
 */
export function render({
  player,
  dieCard = null,
  chosenCards = [],
  profileInspectCard = null,
  deckType = 'live',
  hint = '',
  submittedCards = {},
  submittedRevealed = false,
}) {
  const birthday = formatBirthday(player);

  // Build card thumbnails list: LIVE picks → DIE → BYE picks
  const allProfileCards = [];
  chosenCards.forEach((card) => {
    if (card.deckType === 'live') {
      allProfileCards.push({ card, label: 'LIVE Pick' });
    }
  });
  if (dieCard) {
    allProfileCards.push({ card: dieCard, label: 'Their Death' });
  }
  chosenCards.forEach((card) => {
    if (card.deckType === 'bye') {
      allProfileCards.push({ card, label: 'BYE Pick' });
    }
  });

  const thumbsHtml = allProfileCards.map(({ card, label }, index) => {
    const imgSrc = card.image || (card.illustrationKey && card.deckType
      ? `assets/illustrations/${card.deckType}/${card.illustrationKey}.jpg`
      : '');
    const safeTitle = (card.title || label).replace(/"/g, '&quot;');
    return `
      <button class="ld-profile__card-thumb" onclick="window.game.inspectProfileCard(${index})" aria-label="View ${safeTitle}">
        <div class="ld-profile__card-img-wrap">
          ${imgSrc
            ? `<img src="${imgSrc}" alt="${safeTitle}" class="ld-profile__card-img" loading="lazy">`
            : `<div class="ld-profile__card-placeholder"></div>`}
        </div>
        <span class="ld-profile__card-label">${label}</span>
      </button>
    `;
  }).join('');

  // Submitted cards row — face-down backs or revealed fronts
  const submittedPlayerNames = Object.keys(submittedCards);
  let submittedHtml = '';
  if (submittedPlayerNames.length > 0) {
    const cols = Math.min(submittedPlayerNames.length, 4);
    const colClass = `ld-profile__submitted--cols-${cols}`;
    const cardEls = submittedPlayerNames.map(name => {
      const cardHtml = submittedRevealed
        ? renderCard({ ...submittedCards[name], deckType: submittedCards[name].deckType || deckType })
        : renderCardBack({ deckType });
      return `
        <div class="ld-profile__submitted-card">
          ${cardHtml}
          <span class="ld-profile__submitted-label">${name}</span>
        </div>
      `;
    }).join('');
    submittedHtml = `<div class="ld-profile__submitted ${colClass}">${cardEls}</div>`;
  }

  // Full-screen overlay for inspecting a profile card
  const overlayHtml = profileInspectCard
    ? renderViewOverlay(profileInspectCard, deckType)
    : '';

  return `
    <div class="ld-profile">
      <div class="ld-profile__hero">
        <h1 class="ld-profile__name" style="font-size: ${calcNameFontSize(player.name)}">${player.name}</h1>
        ${birthday ? `<p class="ld-profile__birthday">${birthday}</p>` : ''}
        ${allProfileCards.length > 0 ? `
          <div class="ld-profile__cards">
            ${thumbsHtml}
          </div>
        ` : ''}
      </div>
      ${submittedHtml}
      ${hint ? `<p class="ld-profile__hint">${hint}</p>` : ''}
    </div>
    ${overlayHtml}
  `;
}
