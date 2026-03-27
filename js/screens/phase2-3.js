// CarkedIt Online — Phase 2/3 Screen (Live / Bye Decks — shared layout)
'use strict';

import { render as renderPhaseHeader } from '../components/phase-header.js';
import { render as renderPlayerList } from '../components/player-list.js';
import { render as renderGameboard, renderActiveCard } from '../components/gameboard.js';
import { render as renderHand, renderInspectOverlay } from '../components/hand.js';
import { render as renderCard } from '../components/card.js';
import { render as renderCardGrid } from '../components/card-grid.js';
import { render as renderLivingDeadProfile } from '../components/living-dead-profile.js';

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
  return renderActiveCard(renderCard({ ...card, deckType: 'die' }));
}

function renderLivingDeadScreen(config, state, playerListOptions, livingDeadName) {
  const livingDead = state.players[state.livingDeadIndex];
  const dieCard = state.playerDieCards?.[livingDeadName]
    ? { ...state.playerDieCards[livingDeadName], deckType: 'die' }
    : null;
  const chosenCards = state.playerChosenCards?.[livingDeadName] ?? [];

  const round = state.phase23Round + 1;
  const hint = `Round ${round} — ${livingDeadName} is The Living Dead`;

  return `
    <div class="screen screen--phase" data-phase="${config.number}">
      ${renderPhaseHeader({ phase: config.number, label: config.label })}
      ${renderPlayerList(state.players, playerListOptions)}
      ${renderLivingDeadProfile({
        player: livingDead,
        dieCard,
        chosenCards,
        profileInspectCard: state.profileInspectCard ?? null,
        deckType: config.deckType,
        hint,
      })}
      ${renderHand([], {
        livingDeadMessage: `You are The Living Dead this round.\nSit back and relax! 👑`,
        footer: `
          <button class="btn btn--primary" onclick="window.game.showPlayerHand()">
            Start Round
          </button>
        `,
      })}
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
  const livingDead = state.players[state.livingDeadIndex];
  const livingDeadName = livingDead?.name ?? '';
  const dieCard = state.playerDieCards?.[livingDeadName]
    ? { ...state.playerDieCards[livingDeadName], deckType: 'die' }
    : null;
  const chosenCards = state.playerChosenCards?.[livingDeadName] ?? [];

  const hint = `${playerName}, select your best card to play`;

  const handRedraws = state.gameSettings?.handRedraws ?? 'once_per_phase';
  const hasRedrawn = !!(state.handRedrawnPlayers ?? {})[playerName];
  const hasPlayed = !!(state.hasPlayedCardPlayers ?? {})[playerName];
  const showRedraw = handRedraws !== 'off'
    && (handRedraws === 'unlimited' || !hasRedrawn)
    && (handRedraws === 'once_per_round' || handRedraws === 'unlimited' || !hasPlayed);
  const redrawButton = showRedraw ? `
    <button class="btn btn--secondary" onclick="window.game.redrawHand()">
      Redraw Hand
    </button>
  ` : '';

  return `
    <div class="screen screen--phase" data-phase="${config.number}">
      ${renderPhaseHeader({ phase: config.number, label: config.label })}
      ${renderPlayerList(state.players, playerListOptions)}
      ${renderLivingDeadProfile({
        player: livingDead,
        dieCard,
        chosenCards,
        profileInspectCard: state.profileInspectCard ?? null,
        deckType: config.deckType,
        hint,
        submittedCards: state.submittedCards ?? {},
      })}
      ${renderHand(state.hand ?? [], { selectedCard: state.selectedCard, deckType: config.deckType, footer: redrawButton })}
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
      ${renderHand([], { footer: `
        <button class="btn btn--primary" onclick="window.game.revealCards()">
          Reveal Cards
        </button>
      ` })}
    </div>
  `;
}

function renderRevealedScreen(config, state, playerListOptions) {
  return `
    <div class="screen screen--phase" data-phase="${config.number}">
      ${renderPhaseHeader({ phase: config.number, label: config.label })}
      ${renderPlayerList(state.players, playerListOptions)}
      ${renderGameboard('', 'Cards revealed! Time to pitch.', {
        playedCards: state.submittedCards ?? {},
        revealed: true,
        deckType: config.deckType,
      })}
      ${renderHand([], { footer: `
        <button class="btn btn--primary" onclick="window.game.startPitching()">
          Start Pitching
        </button>
      ` })}
    </div>
  `;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function renderPitchingScreen(config, state, playerListOptions, nonDeadPlayers) {
  const pitcher = nonDeadPlayers[state.pitchingPlayerIndex];
  const pitcherName = pitcher?.name ?? '';
  const { timerEnabled, timerVisible, timerCountUp } = state.gameSettings ?? {};
  const seconds = state.pitchTimerSeconds ?? (timerCountUp ? 0 : 120);
  const timerClass = (!timerCountUp && seconds < 30) ? 'pitch-timer pitch-timer--warning' : 'pitch-timer';
  const timerHtml = (timerEnabled && timerVisible)
    ? `<div class="${timerClass}"><span class="pitch-timer__time">${formatTime(seconds)}</span></div>`
    : '';

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
      ${timerHtml}
      ${renderHand([], { footer: `
        <button class="btn btn--primary" onclick="window.game.donePitching()">
          Done Pitching
        </button>
      ` })}
    </div>
  `;
}

function renderJudgingScreen(config, state, playerListOptions, nonDeadPlayers) {
  const livingDead = state.players[state.livingDeadIndex];
  const livingDeadName = livingDead?.name ?? '';

  const entries = nonDeadPlayers
    .map(p => {
      const card = (state.submittedCards ?? {})[p.name];
      if (!card) return null;
      return {
        card: { ...card, deckType: card.deckType || config.deckType },
        label: `${p.name}'s card`,
        onClick: `window.game.inspectJudgingCard('${p.name}')`,
      };
    })
    .filter(Boolean);

  const inspectOverlay = state.selectedCard
    ? renderInspectOverlay({
        selectedCard: state.selectedCard,
        deckType: config.deckType,
        submitLabel: 'Pick This Card',
        onSubmit: `window.game.confirmWinner()`,
        onPrev:   `window.game.prevJudgingCard('${state.selectedCard.id}')`,
        onNext:   `window.game.nextJudgingCard('${state.selectedCard.id}')`,
      })
    : '';

  return `
    <div class="screen screen--phase" data-phase="${config.number}">
      ${renderPhaseHeader({ phase: config.number, label: config.label })}
      ${renderPlayerList(state.players, playerListOptions)}
      <div class="judging">
        <h2 class="judging__title">${livingDeadName}, pick your favourite!</h2>
        ${renderCardGrid(entries)}
      </div>
      ${inspectOverlay}
    </div>
  `;
}

function renderWinnerScreen(config, state, playerListOptions) {
  const winnerName = state.roundWinner ?? '';
  const winnerCard = state.roundWinnerCard;
  const activeCardHtml = winnerCard
    ? renderActiveCard(renderCard({ ...winnerCard, deckType: winnerCard.deckType || config.deckType }))
    : '';

  return `
    <div class="screen screen--phase" data-phase="${config.number}">
      ${renderPhaseHeader({ phase: config.number, label: config.label })}
      ${renderPlayerList(state.players, playerListOptions)}
      ${activeCardHtml}
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
  const { enableBye, enableEulogy } = state.gameSettings ?? {};
  const nextAction = config.deckType === 'live'
    ? (enableBye ? `window.game.startPhase3()` : enableEulogy ? `window.game.startPhase4()` : `window.game.revealWinner()`)
    : (enableEulogy ? `window.game.startPhase4()` : `window.game.revealWinner()`);
  const nextLabel = config.deckType === 'live'
    ? (enableBye ? 'Start Phase 3 — BYE' : enableEulogy ? 'Final Phase' : 'Reveal Winner')
    : (enableEulogy ? 'Final Phase' : 'Reveal Winner');

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
