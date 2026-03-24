// CarkedIt Online — Player List Component
'use strict';

/**
 * @param {Array<{ name: string }>} players
 * @param {{ funeralDirector: string|null }} options
 * @returns {string} HTML string
 */
export function render(players = [], { funeralDirector = null } = {}) {
  if (!players.length) {
    return '<div class="player-list player-list--empty"><p>No players yet</p></div>';
  }

  const items = players.map((p) => `
    <li class="player-list__item ${p.name === funeralDirector ? 'player-list__item--director' : ''}">
      <span class="player-list__name">${p.name}</span>
      ${p.name === funeralDirector ? '<span class="player-list__badge">FD</span>' : ''}
    </li>
  `).join('');

  return `<ul class="player-list">${items}</ul>`;
}
