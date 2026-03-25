// CarkedIt Online — Player List Component
'use strict';

const PERSON_ICON = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="5" cy="3.5" r="2" fill="#6b7280"/>
  <path d="M1 9.5C1 7.567 2.791 6 5 6s4 1.567 4 3.5" stroke="#6b7280" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;

const STAR_ICON = `<svg width="10" height="10" viewBox="0 0 10 10" fill="#fdc700" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M5 1l1.18 2.39L9 3.82 7 5.76l.47 2.74L5 7.27 2.53 8.5 3 5.76 1 3.82l2.82-.43L5 1z"/>
</svg>`;

/**
 * @param {Array<{ name: string, score: number }>} players
 * @param {{ funeralDirector: string|null }} options
 * @returns {string} HTML string
 */
export function render(players = [], { funeralDirector = null, activePlayerIndex = -1 } = {}) {
  if (!players.length) {
    return `
      <div class="player-list-container">
        <span class="player-list-container__label">Players</span>
        <div class="player-list player-list--empty"><p>No players yet</p></div>
      </div>
    `;
  }

  const chips = players.map((p, index) => {
    const isDirector = p.name === funeralDirector;
    const isActive = index === activePlayerIndex;
    const icon = isDirector ? STAR_ICON : PERSON_ICON;
    const score = p.score ?? 0;
    const modifiers = [
      isDirector ? ' player-list__chip--director' : '',
      isActive ? ' player-list__chip--active' : '',
    ].join('');
    return `
      <div class="player-list__chip${modifiers}">
        <span class="player-list__icon">${icon}</span>
        <span class="player-list__name">${p.name}</span>
        <span class="player-list__score">${score}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="player-list-container">
      <span class="player-list-container__label">Players</span>
      <div class="player-list">${chips}</div>
    </div>
  `;
}
