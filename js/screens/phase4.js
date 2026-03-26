// CarkedIt Online — Phase 4 Screen (Eulogy Wildcard + Winner)
'use strict';

import { render as renderPhaseHeader } from '../components/phase-header.js';
import { render as renderPlayerList } from '../components/player-list.js';
import { render as renderGameboard, renderActiveCard } from '../components/gameboard.js';
import { render as renderCard } from '../components/card.js';
import { render as renderCardBack } from '../components/cardBack.js';

const PHASE_LABEL = 'Phase 4 - EULOGY';

/**
 * Renders the Living Dead's tableau — their chosen Live and Bye cards from Phases 2/3.
 * Displayed below the die card using the existing played-cards grid pattern.
 */
function renderTableau(chosenCards) {
  if (!chosenCards || chosenCards.length === 0) return '';

  const cardEls = chosenCards.map(card => {
    return `
      <div class="gameboard__played-card gameboard__played-card--revealed">
        ${renderCard({ ...card, deckType: card.deckType || 'live' })}
      </div>
    `;
  }).join('');

  const colClass = chosenCards.length >= 4 ? 'gameboard__played-cards--cols-4' : '';
  return `<div class="gameboard__played-cards ${colClass}">${cardEls}</div>`;
}

/**
 * @param {object} state
 * @returns {string} HTML string
 */
export function render(state) {
  const subState = state.phase4SubState ?? 'wildcard-intro';

  switch (subState) {
    case 'wildcard-intro':
      return renderWildcardIntro(state);
    case 'pick-eulogists':
      return renderPickEulogists(state);
    case 'pass-phone-eulogist':
      return renderPassPhoneEulogist(state);
    case 'eulogy':
      return renderEulogyScreen(state);
    case 'judge':
      return renderJudgeScreen(state);
    case 'points-awarded':
      return renderPointsAwarded(state);
    case 'winner':
      return renderWinnerScreen(state);
    default:
      return renderWildcardIntro(state);
  }
}

function renderWildcardIntro(state) {
  const wildcardPlayers = state.wildcardPlayers ?? [];
  const hasWildcards = wildcardPlayers.length > 0;

  // Hardcoded wildcard card for intro display
  const wildcardDisplayCard = {
    id: 'wildcard-intro',
    title: 'Wildcard Eulogy',
    description: 'Save this card until the end, for a chance at bonus points!',
    prompt: 'Bonus Mini-Game: pick 2 players to give your Eulogy!',
    illustrationKey: 'wildcard-eulogy',
    deckType: 'bye',
  };
  const wildcardCardHtml = renderActiveCard(
    renderCard(wildcardDisplayCard),
    { label: 'Wildcard Eulogy' },
  );

  const playerListHtml = hasWildcards
    ? `<div class="phase4__wildcard-holders">
        <h3 class="phase4__wildcard-holders-title">The Living Dead</h3>
        <p class="phase4__wildcard-holders-subtitle">Players with Eulogy Wildcards:</p>
        <div class="phase4__wildcard-names">
          ${wildcardPlayers.map(name => `<span class="phase4__wildcard-name">${name}</span>`).join('')}
        </div>
      </div>`
    : `<div class="phase4__no-wildcards">
        <p>No players held Eulogy Wildcards.</p>
      </div>`;

  const actionBtn = hasWildcards
    ? `<button class="btn btn--primary" onclick="window.game.startEulogyRound()">Start Eulogy Round</button>`
    : `<button class="btn btn--primary" onclick="window.game.revealWinner()">Reveal Winner</button>`;

  return `
    <div class="screen screen--phase" data-phase="4">
      ${renderPhaseHeader({ phase: '4', label: PHASE_LABEL })}
      ${renderPlayerList(state.players, { funeralDirector: state.funeralDirector })}
      ${renderGameboard(wildcardCardHtml, 'Wildcard Eulogy Round')}
      ${playerListHtml}
      <div class="phase-actions">
        ${actionBtn}
      </div>
    </div>
  `;
}

function renderPickEulogists(state) {
  const wildcardPlayerName = state.wildcardPlayers[state.currentWildcardIndex];
  const selected = state.selectedEulogists ?? [];
  const chosenCards = (state.playerChosenCards ?? {})[wildcardPlayerName] ?? [];
  const hasTableau = chosenCards.length > 0;

  const dieCardHtml = state.currentCard
    ? renderActiveCard(renderCard({ ...state.currentCard, deckType: 'die' }), { label: `${wildcardPlayerName}'s death` })
    : '';

  const tableauHtml = renderTableau(chosenCards);
  const cardAreaClass = hasTableau
    ? 'gameboard__card-area gameboard__card-area--has-played'
    : 'gameboard__card-area';

  const otherPlayers = state.players.filter(p => p.name !== wildcardPlayerName);
  const selectionChips = otherPlayers.map(p => {
    const isSelected = selected.includes(p.name);
    const escapedName = p.name.replace(/'/g, "\\'");
    const selectedClass = isSelected ? ' phase4__eulogist-chip--selected' : '';
    return `
      <button class="phase4__eulogist-chip${selectedClass}"
              onclick="window.game.selectEulogist('${escapedName}')">
        ${p.name}
      </button>
    `;
  }).join('');

  const canConfirm = selected.length === 2;

  return `
    <div class="screen screen--phase" data-phase="4">
      ${renderPhaseHeader({ phase: '4', label: PHASE_LABEL })}
      ${renderPlayerList(state.players, {
        funeralDirector: state.funeralDirector,
        livingDeadName: wildcardPlayerName,
      })}
      <div class="gameboard">
        <div class="${cardAreaClass}">
          ${dieCardHtml}
          ${tableauHtml}
        </div>
      </div>
      <div class="phase4__pick-eulogists">
        <h2 class="phase4__pick-title">${wildcardPlayerName}, pick 2 players to give your eulogy</h2>
        <div class="phase4__eulogist-chips">
          ${selectionChips}
        </div>
      </div>
      <div class="phase-actions">
        <button class="btn btn--primary${canConfirm ? '' : ' btn--disabled'}"
                onclick="window.game.confirmEulogists()"
                ${canConfirm ? '' : 'disabled'}>
          Confirm (${selected.length}/2)
        </button>
      </div>
    </div>
  `;
}

function renderPassPhoneEulogist(state) {
  const eulogists = state.selectedEulogists ?? [];
  const eulogistName = eulogists[state.currentEulogistIndex] ?? 'Next Player';
  const wildcardPlayerName = state.wildcardPlayers[state.currentWildcardIndex];

  return `
    <div class="screen screen--phase" data-phase="4">
      ${renderPhaseHeader({ phase: '4', label: PHASE_LABEL })}
      ${renderPlayerList(state.players, {
        funeralDirector: state.funeralDirector,
        livingDeadName: wildcardPlayerName,
      })}
      <div class="pass-phone">
        <div class="pass-phone__message">
          <h2 class="pass-phone__title">Pass the phone to</h2>
          <p class="pass-phone__name">${eulogistName}</p>
          <p class="pass-phone__subtitle">Time to give ${wildcardPlayerName}'s eulogy!</p>
        </div>
        <button class="btn btn--primary" onclick="window.game.startEulogy()">
          I'm ${eulogistName}
        </button>
      </div>
    </div>
  `;
}

function renderEulogyScreen(state) {
  const eulogists = state.selectedEulogists ?? [];
  const eulogistName = eulogists[state.currentEulogistIndex] ?? '';
  const wildcardPlayerName = state.wildcardPlayers[state.currentWildcardIndex];
  const eulogistNumber = state.currentEulogistIndex + 1;
  const chosenCards = (state.playerChosenCards ?? {})[wildcardPlayerName] ?? [];
  const hasTableau = chosenCards.length > 0;

  const dieCardHtml = state.currentCard
    ? renderActiveCard(renderCard({ ...state.currentCard, deckType: 'die' }), { label: `${wildcardPlayerName}'s death` })
    : '';

  const tableauHtml = renderTableau(chosenCards);
  const cardAreaClass = hasTableau
    ? 'gameboard__card-area gameboard__card-area--has-played'
    : 'gameboard__card-area';

  return `
    <div class="screen screen--phase" data-phase="4">
      ${renderPhaseHeader({ phase: '4', label: PHASE_LABEL })}
      ${renderPlayerList(state.players, {
        funeralDirector: state.funeralDirector,
        livingDeadName: wildcardPlayerName,
        pitchingPlayer: eulogistName,
      })}
      <div class="gameboard">
        <div class="${cardAreaClass}">
          ${dieCardHtml}
          ${tableauHtml}
        </div>
      </div>
      <div class="phase4__eulogy">
        <h2 class="phase4__eulogy-title">${eulogistName}'s Eulogy</h2>
        <p class="phase4__eulogy-subtitle">Eulogy ${eulogistNumber} of 2 for ${wildcardPlayerName}</p>
        <p class="phase4__eulogy-prompt">Celebrate, honour, and roast ${wildcardPlayerName}!</p>
      </div>
      <div class="phase-actions">
        <button class="btn btn--primary" onclick="window.game.doneEulogy()">
          Done
        </button>
      </div>
    </div>
  `;
}

function renderJudgeScreen(state) {
  const eulogists = state.selectedEulogists ?? [];
  const wildcardPlayerName = state.wildcardPlayers[state.currentWildcardIndex];

  const eulogistButtons = eulogists.map(name => {
    const escapedName = name.replace(/'/g, "\\'");
    return `
      <button class="phase4__judge-btn" onclick="window.game.pickBestEulogy('${escapedName}')">
        <span class="phase4__judge-btn-name">${name}</span>
        <span class="phase4__judge-btn-label">Pick as best</span>
      </button>
    `;
  }).join('');

  return `
    <div class="screen screen--phase" data-phase="4">
      ${renderPhaseHeader({ phase: '4', label: PHASE_LABEL })}
      ${renderPlayerList(state.players, {
        funeralDirector: state.funeralDirector,
        livingDeadName: wildcardPlayerName,
      })}
      <div class="phase4__judge">
        <h2 class="phase4__judge-title">${wildcardPlayerName}, pick your favourite eulogy!</h2>
        <div class="phase4__judge-options">
          ${eulogistButtons}
        </div>
      </div>
    </div>
  `;
}

function renderPointsAwarded(state) {
  const eulogists = state.selectedEulogists ?? [];
  const bestEulogist = state.bestEulogist;
  const runnerUp = eulogists.find(n => n !== bestEulogist);
  const wildcardPlayerName = state.wildcardPlayers[state.currentWildcardIndex];

  const isLastWildcard = (state.currentWildcardIndex + 1) >= state.wildcardPlayers.length;
  const nextLabel = isLastWildcard ? 'Reveal Winner' : 'Next Eulogy Round';

  return `
    <div class="screen screen--phase" data-phase="4">
      ${renderPhaseHeader({ phase: '4', label: PHASE_LABEL })}
      ${renderPlayerList(state.players, {
        funeralDirector: state.funeralDirector,
        livingDeadName: wildcardPlayerName,
      })}
      <div class="phase4__points">
        <h2 class="phase4__points-title">Points Awarded!</h2>
        <div class="phase4__points-breakdown">
          <div class="phase4__points-row phase4__points-row--best">
            <span class="phase4__points-name">${bestEulogist}</span>
            <span class="phase4__points-label">Best Eulogy</span>
            <span class="phase4__points-value">+2</span>
          </div>
          <div class="phase4__points-row">
            <span class="phase4__points-name">${runnerUp}</span>
            <span class="phase4__points-label">Runner-up</span>
            <span class="phase4__points-value">+1</span>
          </div>
          <div class="phase4__points-row">
            <span class="phase4__points-name">${wildcardPlayerName}</span>
            <span class="phase4__points-label">Played Wildcard</span>
            <span class="phase4__points-value">+1</span>
          </div>
        </div>
      </div>
      <div class="phase-actions">
        <button class="btn btn--primary" onclick="window.game.nextWildcard()">
          ${nextLabel} &rarr;
        </button>
      </div>
    </div>
  `;
}

function renderWinnerScreen(state) {
  const sortedPlayers = [...state.players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const winner = sortedPlayers[0];
  const winnerName = winner?.name ?? '';

  const scoreRows = sortedPlayers.map((p, i) => {
    const isWinner = i === 0;
    const rowClass = isWinner ? 'scoreboard__row scoreboard__row--winner' : 'scoreboard__row';
    return `
      <div class="${rowClass}">
        <span class="scoreboard__name">${isWinner ? '👑 ' : ''}${p.name}</span>
        <span class="scoreboard__score">${p.score ?? 0}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="screen screen--phase" data-phase="4">
      ${renderPhaseHeader({ phase: '4', label: PHASE_LABEL })}
      <div class="phase4__winner">
        <h2 class="phase4__winner-crown">👑</h2>
        <h2 class="phase4__winner-title">Legendary Death Doula!</h2>
        <p class="phase4__winner-name">${winnerName}</p>
        <div class="scoreboard">
          <h3 class="scoreboard__title">Final Scores</h3>
          ${scoreRows}
        </div>
        <button class="btn btn--primary" onclick="window.game.showScreen('menu')">
          Play Again
        </button>
      </div>
    </div>
  `;
}
