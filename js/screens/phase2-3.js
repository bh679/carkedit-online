// CarkedIt Online — Phase 2/3 Screen (Live / Bye Decks — shared layout)
'use strict';

import { render as renderPhaseLayout } from '../components/phase-layout.js';
import { render as renderGameboard, renderActiveCard } from '../components/gameboard.js';
import { render as renderHand, renderInspectOverlay } from '../components/hand.js';
import { render as renderCard } from '../components/card.js';
import { render as renderCardGrid } from '../components/card-grid.js';
import { render as renderLivingDeadProfile } from '../components/living-dead-profile.js';
import { render as renderPassPhone } from '../components/pass-phone.js';
import { render as renderCardBack } from '../components/cardBack.js';
import { escapeHtml } from '../utils/escape.js';

const PHASE_CONFIG = {
  live: { number: '2', label: 'Phase 2 - LIVE', deckType: 'live', nextScreen: 'phase3' },
  bye:  { number: '3', label: 'Phase 3 - BYE',  deckType: 'bye',  nextScreen: 'phase4' },
};

/**
 * Shorthand for wrapping phase content in the standard layout.
 */
function layout(config, state, playerListOptions, children) {
  // Build round label: "Round 1 / 2 - Brennan's Dead"
  const totalRounds = state.gameMode === 'online'
    ? (state.rounds ?? 1)
    : (state.totalRounds ?? 1);
  const currentRound = state.gameMode === 'online'
    ? (state.round ?? 0) + 1
    : (state.phase23Round ?? 0) + 1;
  const livingDead = state.players[state.livingDeadIndex];
  const livingDeadName = livingDead?.name ?? '';
  const roundLabel = livingDeadName
    ? `Round ${currentRound} / ${totalRounds} - ${livingDeadName}'s Dead`
    : '';

  return renderPhaseLayout({
    phase: config.number,
    label: config.label,
    players: state.players,
    playerListOptions,
    children,
    roundLabel,
  });
}

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

  // Online mode — render based on server-synced phase
  if (state.gameMode === 'online' && state.onlinePhase) {
    return renderOnline(phase, config, state);
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
  const submittedPlayerNames = Object.keys(state.submittedCards ?? {});
  return submittedPlayerNames[state.pitchingPlayerIndex] ?? null;
}

function renderDieCard(card) {
  if (!card) return '';
  return renderActiveCard(renderCard(card));
}

function renderLivingDeadScreen(config, state, playerListOptions, livingDeadName) {
  const livingDead = state.players[state.livingDeadIndex];
  const dieCard = state.playerDieCards?.[livingDeadName]
    ? { ...state.playerDieCards[livingDeadName], deckType: 'die' }
    : null;
  const chosenCards = state.playerChosenCards?.[livingDeadName] ?? [];

  const round = state.phase23Round + 1;
  const hint = `Round ${round} — ${livingDeadName} is The Living Dead`;

  return layout(config, state, playerListOptions, `
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
  `);
}

function renderPassPhoneScreen(config, state, playerListOptions, nonDeadIndices) {
  const playerIndex = nonDeadIndices[state.currentNonDeadIndex];
  const player = state.players[playerIndex];
  const playerName = player?.name ?? 'Next Player';

  return layout(config, state, playerListOptions,
    renderPassPhone({ playerName, onReady: 'window.game.readyToSelect()' }),
  );
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

  const isForced = (state.forcedPlayerNames ?? []).length > 0;
  const optionalCardPlay = (state.gameSettings?.optionalCardPlay ?? false) && !isForced;
  const passButton = optionalCardPlay ? `
    <button class="btn btn--secondary" onclick="window.game.passCard()">
      Pass
    </button>
  ` : '';

  const footerContent = (redrawButton || passButton)
    ? `<div class="hand__footer-row">${redrawButton}${passButton}</div>`
    : '';

  const { timerEnabled, playCardTimerEnabled, timerVisible, timerCountUp } = state.gameSettings ?? {};
  const playCardSeconds = state.playCardTimerSeconds ?? (timerCountUp ? 0 : 120);
  const playCardTimerClass = (!timerCountUp && playCardSeconds < 30) ? 'pitch-timer pitch-timer--warning' : 'pitch-timer';
  const playCardTimerHtml = (timerEnabled && playCardTimerEnabled && timerVisible)
    ? `<div class="${playCardTimerClass}"><span class="pitch-timer__time">${formatTime(playCardSeconds)}</span></div>`
    : '';

  return layout(config, state, playerListOptions, `
    ${renderLivingDeadProfile({
      player: livingDead,
      dieCard,
      chosenCards,
      profileInspectCard: state.profileInspectCard ?? null,
      deckType: config.deckType,
      hint,
      submittedCards: state.submittedCards ?? {},
    })}
    ${playCardTimerHtml}
    ${renderHand(state.hand ?? [], { selectedCard: state.selectedCard, deckType: config.deckType, footer: footerContent })}
  `);
}

function renderAllSubmittedScreen(config, state, playerListOptions) {
  const livingDead = state.players[state.livingDeadIndex];

  return layout(config, state, playerListOptions, `
    ${renderLivingDeadProfile({
      player: livingDead,
      dieCard: null,
      chosenCards: [],
      profileInspectCard: null,
      deckType: config.deckType,
      hint: 'All cards are in!',
      submittedCards: state.submittedCards ?? {},
    })}
    ${renderHand([], { footer: `
      <button class="btn btn--primary" onclick="window.game.revealCards()">
        Reveal Cards
      </button>
    ` })}
  `);
}

function renderRevealedScreen(config, state, playerListOptions) {
  const livingDead = state.players[state.livingDeadIndex];

  return layout(config, state, playerListOptions, `
    ${renderLivingDeadProfile({
      player: livingDead,
      dieCard: null,
      chosenCards: [],
      profileInspectCard: null,
      deckType: config.deckType,
      hint: 'Cards revealed! Time to pitch.',
      submittedCards: state.submittedCards ?? {},
      submittedRevealed: true,
    })}
    ${renderHand([], { footer: `
      <button class="btn btn--primary" onclick="window.game.startPitching()">
        Start Pitching
      </button>
    ` })}
  `);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function renderPitchingScreen(config, state, playerListOptions, nonDeadPlayers) {
  const submittedPlayerNames = Object.keys(state.submittedCards ?? {});
  const pitcherName = submittedPlayerNames[state.pitchingPlayerIndex] ?? '';
  const { timerEnabled, timerVisible, timerCountUp } = state.gameSettings ?? {};
  const seconds = state.pitchTimerSeconds ?? (timerCountUp ? 0 : 120);
  const timerClass = (!timerCountUp && seconds < 30) ? 'pitch-timer pitch-timer--warning' : 'pitch-timer';
  const timerHtml = (timerEnabled && timerVisible)
    ? `<div class="${timerClass}"><span class="pitch-timer__time">${formatTime(seconds)}</span></div>`
    : '';

  return layout(config, state, { ...playerListOptions, pitchingPlayer: pitcherName }, `
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
  `);
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
        label: `${escapeHtml(p.name)}'s card`,
        onClick: `window.game.inspectJudgingCard(${escapeHtml(JSON.stringify(p.name))})`,
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

  return layout(config, state, playerListOptions, `
    <div class="judging">
      <h2 class="judging__title">${livingDeadName}, pick your favourite!</h2>
      ${renderCardGrid(entries)}
    </div>
    ${inspectOverlay}
  `);
}

function renderWinnerScreen(config, state, playerListOptions) {
  const winnerName = state.roundWinner ?? '';
  const winnerCard = state.roundWinnerCard;
  const activeCardHtml = winnerCard
    ? renderActiveCard(renderCard(winnerCard))
    : '';

  return layout(config, state, playerListOptions, `
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
  `);
}

// ── Online Mode Rendering ─────────────────────────────────

function renderOnline(phase, config, state) {
  const livingDead = state.players[state.livingDeadIndex];
  const livingDeadName = livingDead?.name ?? '';

  const playerListOptions = {
    funeralDirector: state.funeralDirector,
    livingDeadName,
    submittedPlayers: state.onlineSubmittedPlayerNames ?? [],
    pitchingPlayer: state.onlinePhase === 'convince' ? state.onlineConvincerName : null,
  };

  switch (state.onlinePhase) {
    case 'submit':
      return renderOnlineSubmit(config, state, playerListOptions, livingDead, livingDeadName);
    case 'reveal':
      return renderOnlineReveal(config, state, playerListOptions);
    case 'convince':
      return renderOnlineConvince(config, state, playerListOptions, livingDeadName);
    case 'select':
      return renderOnlineSelect(config, state, playerListOptions, livingDeadName);
    case 'winner':
      return renderOnlineWinner(config, state, playerListOptions);
    default:
      return renderOnlineSubmit(config, state, playerListOptions, livingDead, livingDeadName);
  }
}

function renderOnlineSubmit(config, state, playerListOptions, livingDead, livingDeadName) {
  const round = (state.round ?? 0) + 1;
  const hint = `Round ${round} — ${livingDeadName} is The Living Dead`;
  const dieCard = state.currentCard;
  const chosenCards = state.playerChosenCards?.[livingDeadName] ?? [];

  // Build submitted cards map (name -> card) for profile display
  const submittedCardsMap = {};
  for (const card of (state.onlineSubmittedCards ?? [])) {
    const player = state.players.find(p => p.sessionId === card.submittedBy);
    if (player) submittedCardsMap[player.name] = card;
  }

  if (state.isLivingDead) {
    // Living Dead sees the prompt — no Start Round button
    return layout(config, state, playerListOptions, `
      ${renderLivingDeadProfile({
        player: livingDead,
        dieCard,
        chosenCards,
        profileInspectCard: state.profileInspectCard ?? null,
        deckType: config.deckType,
        hint,
        submittedCards: submittedCardsMap,
      })}
      ${renderHand([], {
        livingDeadMessage: `You are The Living Dead this round.\nSit back and relax! 👑`,
      })}
    `);
  }

  // Non-Living-Dead player — show hand for card selection
  const { timerEnabled, playCardTimerEnabled, timerVisible, timerCountUp } = state.gameSettings ?? {};
  const playCardSeconds = state.playCardTimerSeconds ?? (timerCountUp ? 0 : 120);
  const playCardTimerClass = (!timerCountUp && playCardSeconds < 30) ? 'pitch-timer pitch-timer--warning' : 'pitch-timer';
  const playCardTimerHtml = (timerEnabled && playCardTimerEnabled && timerVisible)
    ? `<div class="${playCardTimerClass}"><span class="pitch-timer__time">${formatTime(playCardSeconds)}</span></div>`
    : '';

  return layout(config, state, playerListOptions, `
    ${renderLivingDeadProfile({
      player: livingDead,
      dieCard,
      chosenCards,
      profileInspectCard: state.profileInspectCard ?? null,
      deckType: config.deckType,
      hint: 'Select your best card to play',
      submittedCards: submittedCardsMap,
    })}
    ${playCardTimerHtml}
    ${renderHand(state.hand ?? [], { selectedCard: state.selectedCard, deckType: config.deckType })}
  `);
}

function renderOnlineReveal(config, state, playerListOptions) {
  const revealIndex = state.revealIndex ?? 0;
  const cards = state.onlineSubmittedCards ?? [];

  const items = cards.map((card, i) => {
    const alreadyRevealed = i < revealIndex;
    if (alreadyRevealed) {
      // Already flipped — show face-up directly (no animation)
      return `
        <div class="card-grid__item">
          ${renderCard(card)}
          <span class="card-grid__label">Card ${i + 1}</span>
        </div>
      `;
    }
    // Not yet revealed — flip container (back showing, front hidden)
    return `
      <div class="card-grid__item card-flip" data-reveal-index="${i}">
        <div class="card-flip__inner">
          <div class="card-flip__back">${renderCardBack({ deckType: config.deckType })}</div>
          <div class="card-flip__front">${renderCard(card)}</div>
        </div>
        <span class="card-grid__label">Card ${i + 1}</span>
      </div>
    `;
  }).join('');

  return layout(config, state, playerListOptions, `
    <div class="judging">
      <h2 class="judging__title">Revealing cards...</h2>
      <div class="card-grid card-grid--cols-2">${items}</div>
    </div>
  `);
}

function renderOnlineConvince(config, state, playerListOptions, livingDeadName) {
  // Build submitted cards as a name->card map for gameboard display
  const submittedMap = {};
  for (const card of state.onlineSubmittedCards) {
    // Find player name from sessionId
    const player = state.players.find(p => p.sessionId === card.submittedBy);
    const name = player?.name ?? card.submittedBy;
    submittedMap[name] = { ...card, deckType: card.deckType || config.deckType };
  }

  const convincerName = state.onlineConvincerName ?? '';

  // Pitch timer display
  const { timerEnabled, pitchTimerEnabled, timerVisible, timerCountUp } = state.gameSettings ?? {};
  const pitchSeconds = state.pitchTimerSeconds ?? (timerCountUp ? 0 : 120);
  const pitchTimerClass = (!timerCountUp && pitchSeconds < 30) ? 'pitch-timer pitch-timer--warning' : 'pitch-timer';
  const pitchTimerHtml = (timerEnabled && pitchTimerEnabled && timerVisible)
    ? `<div class="${pitchTimerClass}"><span class="pitch-timer__time">${formatTime(pitchSeconds)}</span></div>`
    : '';

  if (state.isMyConvinceTurn) {
    // It's my turn to pitch
    const myCard = state.onlineSubmittedCards.find(c => c.submittedBy === state.mySessionId);
    const revealButton = (myCard && !myCard.faceUp)
      ? `<button class="btn btn--primary" onclick="window.game.revealCards()">Reveal My Card</button>`
      : `<button class="btn btn--primary" onclick="window.game.donePitching()">Done Pitching</button>`;

    return layout(config, state, { ...playerListOptions, pitchingPlayer: convincerName }, `
      ${renderGameboard('', 'Your turn to pitch!', {
        playedCards: submittedMap,
        revealed: false,
        deckType: config.deckType,
        pitchingPlayer: convincerName,
      })}
      ${pitchTimerHtml}
      ${renderHand([], { footer: revealButton })}
    `);
  }

  // Watching someone else pitch
  return layout(config, state, { ...playerListOptions, pitchingPlayer: convincerName }, `
    ${renderGameboard('', `${convincerName} is pitching`, {
      playedCards: submittedMap,
      revealed: false,
      deckType: config.deckType,
      pitchingPlayer: convincerName,
    })}
    ${pitchTimerHtml}
    ${renderHand([], {
      livingDeadMessage: `Waiting for ${convincerName} to pitch...`,
    })}
  `);
}

function renderOnlineSelect(config, state, playerListOptions, livingDeadName) {
  // Build judging entries from submitted cards — shared by all players
  const entries = state.onlineSubmittedCards.map((card, index) => {
    const player = state.players.find(p => p.sessionId === card.submittedBy);
    const name = player?.name ?? 'Unknown';
    return {
      card: { ...card, deckType: card.deckType || config.deckType },
      label: `${escapeHtml(name)}'s card`,
      onClick: `window.game.inspectJudgingCard(${index})`,
      playerName: name,
    };
  });

  // submittedCards map (keyed by player name) is now built in syncLivingPhaseState
  // and stored in state properly via setState — no render-time mutation needed.

  if (state.isLivingDead) {
    // Living Dead picks the winner
    const inspectOverlay = state.selectedCard
      ? renderInspectOverlay({
          selectedCard: state.selectedCard,
          deckType: config.deckType,
          submitLabel: 'Pick This Card',
          onSubmit: `window.game.confirmWinner()`,
          onPrev: `window.game.prevJudgingCard(${state.selectedCard._cardIndex ?? 0})`,
          onNext: `window.game.nextJudgingCard(${state.selectedCard._cardIndex ?? 0})`,
        })
      : '';

    return layout(config, state, playerListOptions, `
      <div class="judging">
        <h2 class="judging__title">${livingDeadName}, pick your favourite!</h2>
        ${renderCardGrid(entries)}
      </div>
      ${inspectOverlay}
    `);
  }

  // Non-Living-Dead sees the same cards but can only preview (no winner selection)
  const inspectOverlay = state.selectedCard
    ? renderInspectOverlay({
        selectedCard: state.selectedCard,
        deckType: config.deckType,
        submitLabel: 'Close',
        onSubmit: `window.game.dismissInspect()`,
        onPrev: `window.game.prevJudgingCard(${state.selectedCard._cardIndex ?? 0})`,
        onNext: `window.game.nextJudgingCard(${state.selectedCard._cardIndex ?? 0})`,
        btnStyle: 'secondary',
      })
    : '';

  return layout(config, state, playerListOptions, `
    <div class="judging">
      <h2 class="judging__title">${livingDeadName} is picking their favourite...</h2>
      ${renderCardGrid(entries)}
    </div>
    ${inspectOverlay}
  `);
}

function renderOnlineWinner(config, state, playerListOptions) {
  const winnerName = state.roundWinner ?? '';
  const winnerCard = state.roundWinnerCard;
  const activeCardHtml = winnerCard
    ? renderActiveCard(renderCard(winnerCard))
    : '';

  return layout(config, state, playerListOptions, `
    ${activeCardHtml}
    <div class="winner-announcement">
      <div class="winner-announcement__card">
        <h2 class="winner-announcement__title">🎉</h2>
        <p class="winner-announcement__name">${winnerName} wins this round!</p>
        <p class="winner-announcement__points">+1 point</p>
      </div>
      <div class="winner-timer"><div class="winner-timer__bar"${state.gameSettings?.rounds === 1 ? ' style="animation-duration: 2.5s"' : ''}></div></div>
    </div>
  `);
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
      <span class="scoreboard__name">${escapeHtml(p.name)}</span>
      <span class="scoreboard__score">${p.score ?? 0}</span>
    </div>
  `).join('');

  return layout(config, state, { funeralDirector: state.funeralDirector }, `
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
  `);
}
