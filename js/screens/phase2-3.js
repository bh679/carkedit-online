// CarkedIt Online — Phase 2/3 Screen (Live / Bye Decks — shared layout)
'use strict';

import { render as renderPhaseHeader } from '../components/phase-header.js';
import { render as renderPlayerList } from '../components/player-list.js';
import { render as renderGameboard } from '../components/gameboard.js';
import { render as renderHand } from '../components/hand.js';
import { render as renderCard } from '../components/card.js';

const PHASE_CONFIG = {
  live: { number: '2', label: 'Phase 2 - LIVE', deckType: 'live', nextScreen: 'phase3' },
  bye:  { number: '3', label: 'Phase 3 - BYE',  deckType: 'bye',  nextScreen: 'phase4' },
};

/**
 * @param {'live'|'bye'} phase
 * @param {object} state
 * @returns {string} HTML string
 */
export function render(phase, state) {
  const config = PHASE_CONFIG[phase];

  // Phase complete — show transition screen
  if (state.phaseComplete) {
    return renderPhaseCompleteScreen(config, state);
  }

  const subState = state.phase2SubState ?? 'living-dead';
  const livingDead = state.players[state.livingDeadIndex];
  const livingDeadName = livingDead?.name ?? '';

  // Build player list options
  const playerListOptions = {
    funeralDirector: state.funeralDirector,
    livingDeadName,
    submittedPlayers: Object.keys(state.submittedCards ?? {}),
    pitchingPlayer: subState === 'pitching' ? getPitchingPlayerName(state) : null,
  };

  const nonDeadPlayers = state.players.filter((_, i) => i !== state.livingDeadIndex);
  const nonDeadIndices = state.players.map((_, i) => i).filter(i => i !== state.livingDeadIndex);

  switch (subState) {
    case 'living-dead':
      return renderLivingDeadScreen(config, state, playerListOptions, livingDeadName);

    case 'pass-phone':
      return renderPassPhoneScreen(config, state, playerListOptions, nonDeadIndices);

    case 'selecting':
      return renderSelectingScreen(config, state, playerListOptions);

    case 'all-submitted':
      return renderAllSubmittedScreen(config, state, playerListOptions);

    case 'revealed':
      return renderRevealedScreen(config, state, playerListOptions);

    case 'pitching':
      return renderPitchingScreen(config, state, playerListOptions, nonDeadPlayers);

    case 'judging':
      return renderJudgingScreen(config, state, playerListOptions, nonDeadPlayers);

    case 'winner-announced':
      return renderWinnerScreen(config, state, playerListOptions);

    default:
      return renderLivingDeadScreen(config, state, playerListOptions, livingDeadName);
  }
}

function getPitchingPlayerName(state) {
  const nonDeadPlayers = state.players.filter((_, i) => i !== state.livingDeadIndex);
  return nonDeadPlayers[state.pitchingPlayerIndex]?.name ?? null;
}

function renderDieCard(card) {
  if (!card) return '';
  return renderCard({ ...card, deckType: 'die' });
}

function renderLivingDeadScreen(config, state, playerListOptions, livingDeadName) {
  const promptCardHtml = renderDieCard(state.currentCard);

  const round = state.phase23Round + 1;
  const hint = `Round ${round} — ${livingDeadName} is The Living Dead`;

  return `
    <div class="screen screen--phase" data-phase="${config.number}">
      ${renderPhaseHeader({ phase: config.number, label: config.label })}
      ${renderPlayerList(state.players, playerListOptions)}
      ${renderGameboard(promptCardHtml, hint)}
      ${renderHand([], {
        livingDeadMessage: `You are The Living Dead this round.\nSit back and relax! 👑`,
      })}
      <div class="phase-actions">
        <button class="btn btn--primary" onclick="window.game.showPlayerHand()">
          Start Round
        </button>
      </div>
    </div>
  `;
}

function renderPassPhoneScreen(config, state, playerListOptions, nonDeadIndices) {
  const playerIndex = nonDeadIndices[state.currentNonDeadIndex];
  const player = state.players[playerIndex];
  const playerName = player?.name ?? 'Next Player';

  return `
    <div class="screen screen--phase" data-phase="${config.number}">
      ${renderPhaseHeader({ phase: config.number, label: config.label })}
      ${renderPlayerList(state.players, playerListOptions)}
      <div class="pass-phone">
        <div class="pass-phone__message">
          <h2 class="pass-phone__title">Pass the phone to</h2>
          <p class="pass-phone__name">${playerName}</p>
        </div>
        <button class="btn btn--primary" onclick="window.game.readyToSelect()">
          I'm ${playerName}
        </button>
      </div>
    </div>
  `;
}

function renderSelectingScreen(config, state, playerListOptions) {
  const currentPlayer = state.players[state.currentPlayerIndex];
  const playerName = currentPlayer?.name ?? '';
  const livingDeadName = state.players[state.livingDeadIndex]?.name ?? '';

  const promptCardHtml = renderDieCard(state.currentCard);

  const hint = `${playerName}, select your best card to play`;

  return `
    <div class="screen screen--phase" data-phase="${config.number}">
      ${renderPhaseHeader({ phase: config.number, label: config.label })}
      ${renderPlayerList(state.players, playerListOptions)}
      ${renderGameboard(promptCardHtml, hint, {
        playedCards: state.submittedCards ?? {},
        revealed: false,
        deckType: config.deckType,
      })}
      ${renderHand(state.hand ?? [], { selectedCard: state.selectedCard, deckType: config.deckType })}
    </div>
  `;
}

function renderAllSubmittedScreen(config, state, playerListOptions) {
  const livingDeadName = state.players[state.livingDeadIndex]?.name ?? '';
  const promptCardHtml = renderDieCard(state.currentCard);

  return `
    <div class="screen screen--phase" data-phase="${config.number}">
      ${renderPhaseHeader({ phase: config.number, label: config.label })}
      ${renderPlayerList(state.players, playerListOptions)}
      ${renderGameboard(promptCardHtml, 'All cards are in!', {
        playedCards: state.submittedCards ?? {},
        revealed: false,
        deckType: config.deckType,
      })}
      <div class="phase-actions">
        <button class="btn btn--primary" onclick="window.game.revealCards()">
          Reveal Cards
        </button>
      </div>
    </div>
  `;
}

function renderRevealedScreen(config, state, playerListOptions) {
  const livingDeadName = state.players[state.livingDeadIndex]?.name ?? '';
  const promptCardHtml = renderDieCard(state.currentCard);

  return `
    <div class="screen screen--phase" data-phase="${config.number}">
      ${renderPhaseHeader({ phase: config.number, label: config.label })}
      ${renderPlayerList(state.players, playerListOptions)}
      ${renderGameboard(promptCardHtml, 'Cards revealed! Time to pitch.', {
        playedCards: state.submittedCards ?? {},
        revealed: true,
        deckType: config.deckType,
      })}
      <div class="phase-actions">
        <button class="btn btn--primary" onclick="window.game.startPitching()">
          Start Pitching
        </button>
      </div>
    </div>
  `;
}

function renderPitchingScreen(config, state, playerListOptions, nonDeadPlayers) {
  const pitcher = nonDeadPlayers[state.pitchingPlayerIndex];
  const pitcherName = pitcher?.name ?? '';

  return `
    <div class="screen screen--phase" data-phase="${config.number}">
      ${renderPhaseHeader({ phase: config.number, label: config.label })}
      ${renderPlayerList(state.players, { ...playerListOptions, pitchingPlayer: pitcherName })}
      ${renderGameboard('', `${pitcherName} is pitching`, {
        playedCards: state.submittedCards ?? {},
        revealed: true,
        deckType: config.deckType,
        pitchingPlayer: pitcherName,
      })}
      ${renderHand(state.hand ?? [], { dimmed: true, deckType: config.deckType })}
      <div class="phase-actions">
        <button class="btn btn--primary" onclick="window.game.donePitching()">
          Done Pitching
        </button>
      </div>
    </div>
  `;
}

function renderJudgingScreen(config, state, playerListOptions, nonDeadPlayers) {
  const livingDead = state.players[state.livingDeadIndex];
  const livingDeadName = livingDead?.name ?? '';

  const cardButtons = nonDeadPlayers.map(p => {
    const card = (state.submittedCards ?? {})[p.name];
    if (!card) return '';
    return `
      <div class="judging__card-option" onclick="window.game.pickWinner('${p.name}')">
        ${renderCard({ ...card, deckType: card.deckType || config.deckType })}
        <span class="judging__card-player">${p.name}'s card</span>
      </div>
    `;
  }).join('');

  return `
    <div class="screen screen--phase" data-phase="${config.number}">
      ${renderPhaseHeader({ phase: config.number, label: config.label })}
      ${renderPlayerList(state.players, playerListOptions)}
      <div class="judging">
        <h2 class="judging__title">${livingDeadName}, pick your favourite!</h2>
        <div class="judging__cards">
          ${cardButtons}
        </div>
      </div>
    </div>
  `;
}

function renderWinnerScreen(config, state, playerListOptions) {
  const winnerName = state.roundWinner ?? '';
  const isPhaseComplete = false; // Manager handles completion

  return `
    <div class="screen screen--phase" data-phase="${config.number}">
      ${renderPhaseHeader({ phase: config.number, label: config.label })}
      ${renderPlayerList(state.players, playerListOptions)}
      <div class="winner-announcement">
        <div class="winner-announcement__card">
          <h2 class="winner-announcement__title">🎉</h2>
          <p class="winner-announcement__name">${winnerName} wins this round!</p>
          <p class="winner-announcement__points">+1 point</p>
        </div>
        <button class="btn btn--primary" onclick="window.game.nextRound()">
          Next Round
        </button>
      </div>
    </div>
  `;
}

function renderPhaseCompleteScreen(config, state) {
  const phaseName = config.deckType === 'live' ? 'LIVE' : 'BYE';
  const nextAction = config.deckType === 'live'
    ? `window.game.startPhase3()`
    : `window.game.showScreen('phase4')`;
  const nextLabel = config.deckType === 'live' ? 'Start Phase 3 — BYE' : 'Final Phase';

  // Build scoreboard
  const sortedPlayers = [...state.players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const scoreRows = sortedPlayers.map(p => `
    <div class="scoreboard__row">
      <span class="scoreboard__name">${p.name}</span>
      <span class="scoreboard__score">${p.score ?? 0}</span>
    </div>
  `).join('');

  return `
    <div class="screen screen--phase" data-phase="${config.number}">
      ${renderPhaseHeader({ phase: config.number, label: config.label })}
      ${renderPlayerList(state.players, { funeralDirector: state.funeralDirector })}
      <div class="winner-announcement">
        <div class="winner-announcement__card">
          <h2 class="winner-announcement__title">Phase ${config.number} Complete!</h2>
          <p class="winner-announcement__name">${phaseName} phase is done.</p>
          <div class="scoreboard">${scoreRows}</div>
        </div>
        <button class="btn btn--primary" onclick="${nextAction}">
          ${nextLabel} &rarr;
        </button>
      </div>
    </div>
  `;
}
