// CarkedIt Online — Phase 1 Screen (Die Deck)
'use strict';

import { render as renderPhaseHeader } from '../components/phase-header.js';
import { render as renderPlayerList } from '../components/player-list.js';
import { render as renderGameboard } from '../components/gameboard.js';
import { render as renderCard } from '../components/card.js';
import { render as renderCardBack } from '../components/cardBack.js';

/**
 * @param {object} state
 * @returns {string} HTML string
 */
export function render(state) {
  const currentPlayer = state.players[state.currentPlayerIndex];

  let boardContent;

  let handContent;

  if (state.phaseComplete) {
    boardContent = `
      <div class="phase1__layout">
        <div class="phase1__complete">
          <p class="phase__prompt">Everyone has met their fate!</p>
        </div>
        <div class="phase__actions">
          <button class="btn btn--primary" onclick="window.game.startPhase2()">
            Next Phase &rarr;
          </button>
        </div>
      </div>
    `;
    handContent = '<div class="hand hand--empty"></div>';
  } else if (state.turnStatus === 'describing' && state.currentCard) {
    if (state.cardRevealed) {
      const promptHtml = state.currentCard.prompt
        ? `<p class="phase1__card-prompt">${state.currentCard.prompt}</p>`
        : '';
      boardContent = `
        <div class="phase1__layout">
          <div class="phase__draw">
            ${renderCard({ ...state.currentCard, deckType: 'die' })}
          </div>
          ${promptHtml}
          <p class="phase1__turn-label">${currentPlayer.name}'s death</p>
        </div>
      `;
      handContent = `
        <div class="hand">
          <div class="phase1__hand-actions">
            <button class="btn btn--primary" onclick="window.game.doneDying()">
              Done Dying
            </button>
          </div>
        </div>
      `;
    } else {
      boardContent = `
        <div class="phase1__layout">
          <div class="phase__draw phase1__card-facedown" onclick="window.game.revealCard()">
            ${renderCardBack({ deckType: 'die' })}
          </div>
          <p class="phase1__turn-label">${currentPlayer.name}'s death</p>
        </div>
      `;
      handContent = `
        <div class="hand">
          <div class="phase1__hand-actions">
            <button class="btn btn--primary" onclick="window.game.revealCard()">
              Flip Card
            </button>
          </div>
        </div>
      `;
    }
  } else {
    boardContent = `
      <div class="phase1__layout">
        <div class="phase1__dealing">
          <p class="phase__prompt">Drawing for ${currentPlayer?.name ?? ''}...</p>
        </div>
      </div>
    `;
    handContent = '<div class="hand hand--empty"></div>';
  }

  return `
    <div class="screen screen--phase" data-phase="1">
      ${renderPhaseHeader({ phase: '1', label: 'Phase 1 - DIE' })}
      ${renderPlayerList(state.players, {
        funeralDirector: state.funeralDirector,
        activePlayerIndex: state.phaseComplete ? -1 : state.currentPlayerIndex,
      })}
      ${renderGameboard(boardContent)}
      ${handContent}
    </div>
  `;
}
