// CarkedIt Online — Phase 1 Screen (Die Deck)
'use strict';

import { render as renderPhaseLayout } from '../components/phase-layout.js';
import { render as renderGameboard, renderActiveCard } from '../components/gameboard.js';
import { render as renderCard } from '../components/card.js';
import { render as renderCardBack } from '../components/cardBack.js';
import { render as renderHand } from '../components/hand.js';

/**
 * @param {object} state
 * @returns {string} HTML string
 */
export function render(state) {
  const currentPlayer = state.players[state.currentPlayerIndex];

  let boardContent;

  let handContent;

  if (state.phaseComplete) {
    const { enableLive, enableBye, enableEulogy } = state.gameSettings ?? {};
    const nextAction = enableLive ? 'window.game.startPhase2()'
      : enableBye ? 'window.game.startPhase3()'
      : enableEulogy ? 'window.game.startPhase4()'
      : 'window.game.revealWinner()';
    boardContent = `
      <div class="phase1__layout">
        <div class="phase1__complete">
          <p class="phase__prompt">Everyone has met their fate!</p>
        </div>
        <div class="phase__actions">
          <button class="btn btn--primary" onclick="${nextAction}">
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
      boardContent = renderActiveCard(
        renderCard({ ...state.currentCard, deckType: 'die' }),
        { label: `${currentPlayer.name}'s death`, extraHtml: promptHtml },
      );
      handContent = renderHand([], { footer: `
        <button class="btn btn--primary" onclick="window.game.doneDying()">
          Done Dying
        </button>
      ` });
    } else {
      boardContent = renderActiveCard(
        renderCardBack({ deckType: 'die' }),
        { label: `${currentPlayer.name}'s death`, onClick: 'window.game.revealCard()' },
      );
      handContent = renderHand([], { footer: `
        <button class="btn btn--primary" onclick="window.game.revealCard()">
          Flip Card
        </button>
      ` });
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

  return renderPhaseLayout({
    phase: '1',
    label: 'Phase 1 - DIE',
    players: state.players,
    playerListOptions: {
      funeralDirector: state.funeralDirector,
      activePlayerIndex: state.phaseComplete ? -1 : state.currentPlayerIndex,
    },
    children: `${renderGameboard(boardContent)}${handContent}`,
  });
}
