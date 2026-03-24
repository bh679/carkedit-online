// CarkedIt Online — Phase 4 Screen (Eulogy Wildcard + Winner)
'use strict';

import { render as renderPhaseHeader } from '../components/phase-header.js';
import { render as renderPlayerList } from '../components/player-list.js';
import { render as renderGameboard } from '../components/gameboard.js';
import { render as renderHand } from '../components/hand.js';
import { render as renderCard } from '../components/card.js';

/**
 * @param {object} state
 * @returns {string} HTML string
 */
export function render(state) {
  const currentPlayer = state.players[state.currentPlayerIndex]?.name ?? '';

  const boardContent = state.winner
    ? `
      <div class="phase4__winner">
        <h2 class="phase4__winner-title">Winner!</h2>
        <p class="phase4__winner-name">${state.winner}</p>
        <button class="btn btn--primary" onclick="window.game.showScreen('menu')">
          Play Again
        </button>
      </div>
    `
    : `
      <div class="phase__draw">
        ${state.currentCard
          ? renderCard({ ...state.currentCard, deckType: 'bye' })
          : '<p class="phase__prompt">Draw an Eulogy Wildcard</p>'}
      </div>
      ${renderHand(state.hand ?? [])}
      <div class="phase__actions">
        <button class="btn btn--primary" onclick="window.game.drawCard('bye')">
          Draw Wildcard
        </button>
        <button class="btn btn--secondary" onclick="window.game.revealWinner()">
          Reveal Winner
        </button>
      </div>
    `;

  return `
    <div class="screen screen--phase" data-phase="4">
      ${renderPhaseHeader({ phase: '4', label: 'Phase 4 — Eulogy', currentPlayer })}
      ${renderPlayerList(state.players, { funeralDirector: state.funeralDirector })}
      ${renderGameboard(state, boardContent)}
    </div>
  `;
}
