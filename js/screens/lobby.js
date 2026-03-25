// CarkedIt Online — Lobby Screen
'use strict';

import { render as renderPhaseHeader } from '../components/phase-header.js';
import { render as renderGameboard } from '../components/gameboard.js';
import { render as renderPlayerList } from '../components/player-list.js';

/**
 * @param {object} state
 * @returns {string} HTML string
 */
export function render(state) {
  const boardContent = `
    <div class="lobby__setup">
      <h2 class="lobby__heading">Player Setup</h2>
      <div class="lobby__add-player">
        <input
          type="text"
          id="player-name-input"
          placeholder="Enter player name"
          class="input"
          maxlength="24"
        >
        <button class="btn btn--secondary" onclick="window.game.addPlayer()">
          Add
        </button>
      </div>
    </div>
  `;

  const canStart = state.players.length >= 2;

  return `
    <div class="screen screen--lobby">
      ${renderPhaseHeader({ phase: '', label: 'Lobby' })}
      ${renderPlayerList(state.players, { funeralDirector: state.funeralDirector })}
      ${renderGameboard(boardContent)}
      <div class="lobby__actions">
        <button
          class="btn btn--primary"
          onclick="window.game.startPhase1()"
          ${canStart ? '' : 'disabled'}
        >
          Start Game
        </button>
      </div>
    </div>
  `;
}
