// CarkedIt Online — Phase 1 Screen (Die Deck)
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

  const boardContent = `
    <div class="phase__draw">
      ${state.currentCard
        ? renderCard({ ...state.currentCard, deckType: 'die' })
        : '<p class="phase__prompt">Draw a Die card to begin</p>'}
    </div>
    ${renderHand(state.hand ?? [])}
    <div class="phase__actions">
      <button class="btn btn--primary" onclick="window.game.drawCard('die')">
        Draw Card
      </button>
      <button class="btn btn--secondary" onclick="window.game.showScreen('phase2')">
        Next Phase →
      </button>
    </div>
  `;

  return `
    <div class="screen screen--phase" data-phase="1">
      ${renderPhaseHeader({ phase: '1', label: 'Phase 1 — Die', currentPlayer })}
      ${renderPlayerList(state.players, { funeralDirector: state.funeralDirector })}
      ${renderGameboard(state, boardContent)}
    </div>
  `;
}
