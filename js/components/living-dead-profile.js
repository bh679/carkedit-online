// CarkedIt Online — Living Dead Profile Component
'use strict';

import { render as renderCard } from './card.js';
import { render as renderCardBack } from './cardBack.js';

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
 */
function renderViewOverlay(card, deckType) {
  const activedeckType = card.deckType || deckType;
  return `
    <div class="hand__inspect-overlay hand__inspect-overlay--${activedeckType}" onclick="window.game.dismissProfileCard()">
      <div class="hand__inspect-card-wrapper" onclick="event.stopPropagation()">
        ${renderCard({ ...card, deckType: activedeckType })}
        <button class="btn btn--secondary hand__submit-btn" onclick="window.game.dismissProfileCard()">
          Close
        </button>
      </div>
    </div>
  `;
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
 * @param {object} options.submittedCards - { [playerName]: card } submitted face-down cards
 */
export function render({
  player,
  dieCard = null,
  chosenCards = [],
  profileInspectCard = null,
  deckType = 'live',
  hint = '',
  submittedCards = {},
}) {
  const birthday = formatBirthday(player);

  // Build card thumbnails list
  const allProfileCards = [];
  if (dieCard) {
    allProfileCards.push({ card: dieCard, label: 'Their Death' });
  }
  chosenCards.forEach((card) => {
    const label = card.deckType === 'live' ? 'LIVE Pick' : 'BYE Pick';
    allProfileCards.push({ card, label });
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

  // Submitted face-down cards row (shown during 'selecting' when others have already played)
  const submittedPlayerNames = Object.keys(submittedCards);
  let submittedHtml = '';
  if (submittedPlayerNames.length > 0) {
    const colClass = submittedPlayerNames.length >= 4 ? 'ld-profile__submitted--cols-4' : '';
    const cardEls = submittedPlayerNames.map(name => `
      <div class="ld-profile__submitted-card">
        ${renderCardBack({ deckType })}
        <span class="ld-profile__submitted-label">${name}</span>
      </div>
    `).join('');
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
