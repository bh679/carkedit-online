// CarkedIt Online — Player List Component
'use strict';

const PERSON_ICON = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="5" cy="3.5" r="2" fill="#6b7280"/>
  <path d="M1 9.5C1 7.567 2.791 6 5 6s4 1.567 4 3.5" stroke="#6b7280" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;

const STAR_ICON = `<svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M5 1l1.18 2.39L9 3.82 7 5.76l.47 2.74L5 7.27 2.53 8.5 3 5.76 1 3.82l2.82-.43L5 1z"/>
</svg>`;

const SKULL_ICON = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M5 0.5C2.5 0.5 1 2.2 1 4.2C1 5.8 1.8 6.8 2.5 7.3V8.5C2.5 8.8 2.7 9 3 9H3.5V8.2H4.2V9H5.8V8.2H6.5V9H7C7.3 9 7.5 8.8 7.5 8.5V7.3C8.2 6.8 9 5.8 9 4.2C9 2.2 7.5 0.5 5 0.5Z" fill="currentColor"/>
  <circle cx="3.5" cy="4" r="1" fill="#000"/>
  <circle cx="6.5" cy="4" r="1" fill="#000"/>
  <rect x="4.2" y="6" width="0.6" height="1.2" rx="0.2" fill="#000"/>
  <rect x="5.2" y="6" width="0.6" height="1.2" rx="0.2" fill="#000"/>
</svg>`;

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatBirthday(p) {
  if (!p.birthMonth || !p.birthDay) return '';
  return `🎂 ${MONTH_ABBR[p.birthMonth - 1]} ${p.birthDay}`;
}

/**
 * @param {Array<{ name: string, score: number }>} players
 * @param {object} options
 * @returns {string} HTML string
 */
export function render(players = [], {
  funeralDirector = null,
  activePlayerIndex = -1,
  allowRemove = false,
  selectedForRemoval = null,
  livingDeadName = null,
  submittedPlayers = [],
  pitchingPlayer = null,
} = {}) {
  if (!players.length) {
    return `
      <div class="player-list-container">
        <span class="player-list-container__label">Players</span>
        <div class="player-list player-list--empty"><p>No players yet</p></div>
      </div>
    `;
  }

  const chips = players.filter(p => p.name !== livingDeadName).map((p, index) => {
    const isDirector = p.name === funeralDirector;
    const isLivingDead = false;
    const isSubmitted = submittedPlayers.includes(p.name);
    const isPitching = p.name === pitchingPlayer;
    const isActive = index === activePlayerIndex;
    const isSelected = allowRemove && p.name === selectedForRemoval;

    let icon = PERSON_ICON;
    if (isLivingDead) icon = SKULL_ICON;
    else if (isDirector) icon = STAR_ICON;

    const score = p.score ?? 0;
    const modifiers = [
      isLivingDead ? ' player-list__chip--living-dead' : '',
      isDirector && !isLivingDead ? ' player-list__chip--director' : '',
      isSubmitted && !isLivingDead ? ' player-list__chip--submitted' : '',
      isPitching ? ' player-list__chip--pitching' : '',
      isActive ? ' player-list__chip--active' : '',
    ].join('');
    const escapedName = p.name.replace(/'/g, "\\'");
    const clickAttr = allowRemove
      ? ` onclick="window.game.selectPlayerRemoval('${escapedName}')" style="cursor:pointer"`
      : '';
    const removeBtn = isSelected
      ? `<button class="player-list__remove-btn" onclick="event.stopPropagation(); window.game.removePlayer('${escapedName}')" aria-label="Remove ${p.name}">✕</button>`
      : '';
    return `
      <div class="player-list__chip${modifiers}"${clickAttr}>
        <span class="player-list__icon">${icon}</span>
        <span class="player-list__name">${p.name}</span>
        ${(allowRemove || isActive || isLivingDead) && formatBirthday(p)
          ? `<span class="player-list__birthday">${formatBirthday(p)}</span>`
          : `<span class="player-list__score">${score}</span>`
        }
        ${removeBtn}
      </div>
    `;
  }).join('');

  return `
    <div class="player-list-container">
      <span class="player-list-container__label">${players.length} Players</span>
      <div class="player-list">${chips}</div>
    </div>
  `;
}
