// CarkedIt Online — Phase 2/3 Screen (Live / Bye Decks — shared layout)
'use strict';

import { render as renderPhaseHeader } from '../components/phase-header.js';
import { render as renderPlayerList } from '../components/player-list.js';
import { render as renderGameboard } from '../components/gameboard.js';
import { render as renderHand } from '../components/hand.js';
import { render as renderCard } from '../components/card.js';

const PHASE_CONFIG = {
  live: { number: '2', label: 'Phase 2 — Live', deckType: 'live', nextScreen: 'phase3' },
  bye:  { number: '3', label: 'Phase 3 — Bye',  deckType: 'bye',  nextScreen: 'phase4' },
};

/**
 * @param {'live'|'bye'} phase
 * @param {object} state
 * @returns {string} HTML string
 */
export function render(phase, state) {
  const config = PHASE_CONFIG[phase];
  const currentPlayer = state.players[state.currentPlayerIndex]?.name ?? '';
  const deckName = config.deckType.charAt(0).toUpperCase() + config.deckType.slice(1);

  const boardContent = `
    <div class="phase__draw">
      ${state.currentCard
        ? renderCard({ ...state.currentCard, deckType: config.deckType })
        : `<p class="phase__prompt">Draw a ${deckName} card to begin</p>`}
    </div>
    ${renderHand(state.hand ?? [])}
    <div class="phase__actions">
      <button class="btn btn--primary" onclick="window.game.drawCard('${config.deckType}')">
        Draw Card
      </button>
      <button class="btn btn--secondary" onclick="window.game.showScreen('${config.nextScreen}')">
        Next Phase →
      </button>
    </div>
  `;

  return `
    <div class="screen screen--phase" data-phase="${config.number}">
      ${renderPhaseHeader({ phase: config.number, label: config.label, currentPlayer })}
      ${renderPlayerList(state.players, { funeralDirector: state.funeralDirector })}
      ${renderGameboard(state, boardContent)}
    </div>
  `;
}
