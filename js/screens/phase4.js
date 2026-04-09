// CarkedIt Online — Phase 4 Screen (Eulogy Wildcard + Winner)
'use strict';

import { render as renderPhaseLayout } from '../components/phase-layout.js';
import { render as renderGameboard, renderActiveCard } from '../components/gameboard.js';
import { render as renderCard } from '../components/card.js';
import { buildCard } from '../data/card.js';
import { render as renderLivingDeadProfile } from '../components/living-dead-profile.js';
import { render as renderPassPhone } from '../components/pass-phone.js';
import { render as renderPhaseHeader } from '../components/phase-header.js';
import { render as renderSurvey, hasSubmitted as surveySubmitted } from './survey.js';

const PHASE_LABEL = 'Phase 4 - EULOGY';

/**
 * Shorthand for wrapping phase 4 content in the standard layout.
 */
function layout(state, playerListOptions, children) {
  return renderPhaseLayout({
    phase: '4',
    label: PHASE_LABEL,
    players: state.players,
    playerListOptions,
    children,
  });
}

/**
 * @param {object} state
 * @returns {string} HTML string
 */
export function render(state) {
  const subState = state.phase4SubState ?? 'wildcard-intro';

  // Online mode — render with online-specific UI
  if (state.gameMode === 'online' && state.onlinePhase) {
    return renderOnline(state, subState);
  }

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

// ── Online Mode Rendering ─────────────────────────────────

function renderOnline(state, subState) {
  switch (subState) {
    case 'wildcard-intro':
      return renderOnlineWildcardIntro(state);
    case 'pick-eulogists':
      return renderOnlinePickEulogists(state);
    case 'eulogy':
      return renderOnlineEulogy(state);
    case 'judge':
      return renderOnlineJudge(state);
    case 'points-awarded':
      return renderOnlinePointsAwarded(state);
    case 'winner':
      return renderWinnerScreen(state);
    default:
      return renderOnlineWildcardIntro(state);
  }
}

function renderOnlineWildcardIntro(state) {
  const wildcardPlayers = state.wildcardPlayers ?? [];
  const hasWildcards = wildcardPlayers.length > 0;

  const wildcardDisplayCard = buildCard({
    id: 'wildcard-intro',
    title: 'Wildcard Eulogy',
    description: 'Save this card until the end, for a chance at bonus points!',
    prompt: 'Bonus Mini-Game: pick 2 players to give your Eulogy!',
    illustrationKey: 'wildcard-eulogy',
    deckType: 'bye',
  });
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

  // Only host or wildcard holder can start
  const canStart = state.isHost || state.isCurrentWildcardPlayer;
  const actionBtn = hasWildcards
    ? (canStart
        ? `<button class="btn btn--primary" onclick="window.game.startEulogyRound()">Start Eulogy Round</button>`
        : `<p class="phase4__waiting">Waiting for the host to start...</p>`)
    : (canStart
        ? `<button class="btn btn--primary" onclick="window.game.revealWinner()">Reveal Winner</button>`
        : `<p class="phase4__waiting">Waiting for results...</p>`);

  return layout(state, { funeralDirector: state.funeralDirector }, `
    ${renderGameboard(wildcardCardHtml, 'Wildcard Eulogy Round')}
    ${playerListHtml}
    <div class="phase-actions">
      ${actionBtn}
    </div>
  `);
}

function renderOnlinePickEulogists(state) {
  const wildcardPlayerName = state.onlineWildcardPlayerName ?? state.wildcardPlayers[state.currentWildcardIndex];
  const wildcardPlayer = state.players.find(p => p.name === wildcardPlayerName) ?? { name: wildcardPlayerName };
  const chosenCards = (state.playerChosenCards ?? {})[wildcardPlayerName] ?? [];
  const dieCard = state.currentCard ? { ...state.currentCard, deckType: 'die' } : null;

  const profileHtml = renderLivingDeadProfile({
    player: wildcardPlayer,
    dieCard,
    chosenCards,
    profileInspectCard: state.profileInspectCard ?? null,
    deckType: 'bye',
  });

  if (!state.isCurrentWildcardPlayer) {
    // Non-wildcard players see a waiting message
    return layout(state, {
      funeralDirector: state.funeralDirector,
      livingDeadName: wildcardPlayerName,
    }, `
      ${profileHtml}
      <div class="phase4__pick-eulogists">
        <h2 class="phase4__pick-title">${wildcardPlayerName} is picking eulogists...</h2>
        <p class="phase4__waiting">Waiting for selection</p>
      </div>
    `);
  }

  // Wildcard holder picks eulogists (using session IDs via server)
  const selected = state.selectedEulogists ?? [];
  const otherPlayers = state.players.filter(p => p.name !== wildcardPlayerName);
  const requiredCount = Math.min(state.gameSettings?.eulogistCount ?? 2, otherPlayers.length);

  const selectionChips = otherPlayers.map(p => {
    const isSelected = selected.includes(p.name);
    const escapedSid = (p.sessionId ?? '').replace(/'/g, "\\'");
    const selectedClass = isSelected ? ' phase4__eulogist-chip--selected' : '';
    return `
      <button class="phase4__eulogist-chip${selectedClass}"
              onclick="window.game.selectEulogist('${escapedSid}')">
        ${p.name}
      </button>
    `;
  }).join('');

  const canConfirm = selected.length === requiredCount;

  return layout(state, {
    funeralDirector: state.funeralDirector,
    livingDeadName: wildcardPlayerName,
  }, `
    ${profileHtml}
    <div class="phase4__pick-eulogists">
      <h2 class="phase4__pick-title">${wildcardPlayerName}, pick ${requiredCount} player${requiredCount === 1 ? '' : 's'} to give your eulogy</h2>
      <div class="phase4__eulogist-chips">
        ${selectionChips}
      </div>
    </div>
    <div class="phase-actions">
      <button class="btn btn--primary${canConfirm ? '' : ' btn--disabled'}"
              onclick="window.game.confirmEulogists()"
              ${canConfirm ? '' : 'disabled'}>
        Confirm (${selected.length}/${requiredCount})
      </button>
    </div>
  `);
}

function renderOnlineEulogy(state) {
  const eulogists = state.selectedEulogists ?? [];
  const eulogistName = eulogists[state.currentEulogistIndex] ?? '';
  const wildcardPlayerName = state.onlineWildcardPlayerName ?? state.wildcardPlayers[state.currentWildcardIndex];
  const wildcardPlayer = state.players.find(p => p.name === wildcardPlayerName) ?? { name: wildcardPlayerName };
  const eulogistNumber = state.currentEulogistIndex + 1;
  const chosenCards = (state.playerChosenCards ?? {})[wildcardPlayerName] ?? [];
  const dieCard = state.currentCard ? { ...state.currentCard, deckType: 'die' } : null;

  const profileHtml = renderLivingDeadProfile({
    player: wildcardPlayer,
    dieCard,
    chosenCards,
    profileInspectCard: state.profileInspectCard ?? null,
    deckType: 'bye',
  });

  const actionArea = state.isCurrentEulogist
    ? `<div class="phase-actions">
        <button class="btn btn--primary" onclick="window.game.doneEulogy()">Done</button>
      </div>`
    : `<div class="phase4__waiting">
        <p>Waiting for ${eulogistName} to finish their eulogy...</p>
      </div>`;

  return layout(state, {
    funeralDirector: state.funeralDirector,
    livingDeadName: wildcardPlayerName,
    pitchingPlayer: eulogistName,
  }, `
    ${profileHtml}
    <div class="phase4__eulogy">
      <h2 class="phase4__eulogy-title">${eulogistName}'s Eulogy</h2>
      <p class="phase4__eulogy-subtitle">Eulogy ${eulogistNumber} of ${eulogists.length} for ${wildcardPlayerName}</p>
      <p class="phase4__eulogy-prompt">Celebrate, honour, and roast ${wildcardPlayerName}!</p>
    </div>
    ${actionArea}
  `);
}

function renderOnlineJudge(state) {
  const eulogists = state.selectedEulogists ?? [];
  const wildcardPlayerName = state.onlineWildcardPlayerName ?? state.wildcardPlayers[state.currentWildcardIndex];
  const wildcardPlayer = state.players.find(p => p.name === wildcardPlayerName) ?? { name: wildcardPlayerName };
  const chosenCards = (state.playerChosenCards ?? {})[wildcardPlayerName] ?? [];
  const dieCard = state.currentCard ? { ...state.currentCard, deckType: 'die' } : null;

  const profileHtml = renderLivingDeadProfile({
    player: wildcardPlayer,
    dieCard,
    chosenCards,
    profileInspectCard: state.profileInspectCard ?? null,
    deckType: 'bye',
  });

  if (!state.isCurrentWildcardPlayer) {
    // Non-wildcard players see waiting message
    return layout(state, {
      funeralDirector: state.funeralDirector,
      livingDeadName: wildcardPlayerName,
    }, `
      ${profileHtml}
      <div class="phase4__judge">
        <h2 class="phase4__judge-title">${wildcardPlayerName} is picking their favourite eulogy...</h2>
        <div class="phase4__judge-options">
          ${eulogists.map(name => `
            <div class="phase4__judge-btn phase4__judge-btn--disabled">
              <span class="phase4__judge-btn-name">${name}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `);
  }

  // Wildcard holder picks the best (sends session ID to server)
  const eulogistButtons = eulogists.map(name => {
    // Find the session ID for this eulogist name
    const player = state.players.find(p => p.name === name);
    const escapedSid = (player?.sessionId ?? '').replace(/'/g, "\\'");
    return `
      <button class="phase4__judge-btn" onclick="window.game.pickBestEulogy('${escapedSid}')">
        <span class="phase4__judge-btn-name">${name}</span>
        <span class="phase4__judge-btn-label">Pick as best</span>
      </button>
    `;
  }).join('');

  return layout(state, {
    funeralDirector: state.funeralDirector,
    livingDeadName: wildcardPlayerName,
  }, `
    ${profileHtml}
    <div class="phase4__judge">
      <h2 class="phase4__judge-title">${wildcardPlayerName}, pick your favourite eulogy!</h2>
      <div class="phase4__judge-options">
        ${eulogistButtons}
      </div>
    </div>
  `);
}

function renderOnlinePointsAwarded(state) {
  const eulogists = state.selectedEulogists ?? [];
  const bestEulogist = state.bestEulogist;
  const runnerUp = eulogists.find(n => n !== bestEulogist);
  const wildcardPlayerName = state.onlineWildcardPlayerName ?? state.wildcardPlayers[state.currentWildcardIndex];

  return layout(state, {
    funeralDirector: state.funeralDirector,
    livingDeadName: wildcardPlayerName,
  }, `
    <div class="phase4__points">
      <h2 class="phase4__points-title">Points Awarded!</h2>
      <div class="phase4__points-breakdown">
        <div class="phase4__points-row phase4__points-row--best">
          <span class="phase4__points-name">${bestEulogist}</span>
          <span class="phase4__points-label">Best Eulogy</span>
          <span class="phase4__points-value">+2</span>
        </div>
        ${runnerUp ? `
        <div class="phase4__points-row">
          <span class="phase4__points-name">${runnerUp}</span>
          <span class="phase4__points-label">Runner-up</span>
          <span class="phase4__points-value">+1</span>
        </div>` : ''}
        <div class="phase4__points-row">
          <span class="phase4__points-name">${wildcardPlayerName}</span>
          <span class="phase4__points-label">Played Wildcard</span>
          <span class="phase4__points-value">+1</span>
        </div>
      </div>
    </div>
    <div class="winner-timer"><div class="winner-timer__bar"${state.gameSettings?.rounds === 1 ? ' style="animation-duration: 2.5s"' : ''}></div></div>
  `);
}

function renderWildcardIntro(state) {
  const wildcardPlayers = state.wildcardPlayers ?? [];
  const hasWildcards = wildcardPlayers.length > 0;

  // Hardcoded wildcard card for intro display
  const wildcardDisplayCard = buildCard({
    id: 'wildcard-intro',
    title: 'Wildcard Eulogy',
    description: 'Save this card until the end, for a chance at bonus points!',
    prompt: 'Bonus Mini-Game: pick 2 players to give your Eulogy!',
    illustrationKey: 'wildcard-eulogy',
    deckType: 'bye',
  });
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

  return layout(state, { funeralDirector: state.funeralDirector }, `
    ${renderGameboard(wildcardCardHtml, 'Wildcard Eulogy Round')}
    ${playerListHtml}
    <div class="phase-actions">
      ${actionBtn}
    </div>
  `);
}

function renderPickEulogists(state) {
  const wildcardPlayerName = state.wildcardPlayers[state.currentWildcardIndex];
  const wildcardPlayer = state.players.find(p => p.name === wildcardPlayerName) ?? { name: wildcardPlayerName };
  const selected = state.selectedEulogists ?? [];
  const chosenCards = (state.playerChosenCards ?? {})[wildcardPlayerName] ?? [];
  const dieCard = state.currentCard ? { ...state.currentCard, deckType: 'die' } : null;

  const profileHtml = renderLivingDeadProfile({
    player: wildcardPlayer,
    dieCard,
    chosenCards,
    profileInspectCard: state.profileInspectCard ?? null,
    deckType: 'bye',
  });

  const otherPlayers = state.players.filter(p => p.name !== wildcardPlayerName);
  const requiredCount = Math.min(state.gameSettings?.eulogistCount ?? 2, otherPlayers.length);
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

  const canConfirm = selected.length === requiredCount;

  return layout(state, {
    funeralDirector: state.funeralDirector,
    livingDeadName: wildcardPlayerName,
  }, `
    ${profileHtml}
    <div class="phase4__pick-eulogists">
      <h2 class="phase4__pick-title">${wildcardPlayerName}, pick ${requiredCount} player${requiredCount === 1 ? '' : 's'} to give your eulogy</h2>
      <div class="phase4__eulogist-chips">
        ${selectionChips}
      </div>
    </div>
    <div class="phase-actions">
      <button class="btn btn--primary${canConfirm ? '' : ' btn--disabled'}"
              onclick="window.game.confirmEulogists()"
              ${canConfirm ? '' : 'disabled'}>
        Confirm (${selected.length}/${requiredCount})
      </button>
    </div>
  `);
}

function renderPassPhoneEulogist(state) {
  const eulogists = state.selectedEulogists ?? [];
  const eulogistName = eulogists[state.currentEulogistIndex] ?? 'Next Player';
  const wildcardPlayerName = state.wildcardPlayers[state.currentWildcardIndex];

  return layout(state, {
    funeralDirector: state.funeralDirector,
    livingDeadName: wildcardPlayerName,
  }, renderPassPhone({
    playerName: eulogistName,
    onReady: 'window.game.startEulogy()',
    subtitle: `Time to give ${wildcardPlayerName}'s eulogy!`,
  }));
}

function renderEulogyScreen(state) {
  const eulogists = state.selectedEulogists ?? [];
  const eulogistName = eulogists[state.currentEulogistIndex] ?? '';
  const wildcardPlayerName = state.wildcardPlayers[state.currentWildcardIndex];
  const wildcardPlayer = state.players.find(p => p.name === wildcardPlayerName) ?? { name: wildcardPlayerName };
  const eulogistNumber = state.currentEulogistIndex + 1;
  const chosenCards = (state.playerChosenCards ?? {})[wildcardPlayerName] ?? [];
  const dieCard = state.currentCard ? { ...state.currentCard, deckType: 'die' } : null;

  const profileHtml = renderLivingDeadProfile({
    player: wildcardPlayer,
    dieCard,
    chosenCards,
    profileInspectCard: state.profileInspectCard ?? null,
    deckType: 'bye',
  });

  return layout(state, {
    funeralDirector: state.funeralDirector,
    livingDeadName: wildcardPlayerName,
    pitchingPlayer: eulogistName,
  }, `
    ${profileHtml}
    <div class="phase4__eulogy">
      <h2 class="phase4__eulogy-title">${eulogistName}'s Eulogy</h2>
      <p class="phase4__eulogy-subtitle">Eulogy ${eulogistNumber} of ${eulogists.length} for ${wildcardPlayerName}</p>
      <p class="phase4__eulogy-prompt">Celebrate, honour, and roast ${wildcardPlayerName}!</p>
    </div>
    <div class="phase-actions">
      <button class="btn btn--primary" onclick="window.game.doneEulogy()">
        Done
      </button>
    </div>
  `);
}

function renderJudgeScreen(state) {
  const eulogists = state.selectedEulogists ?? [];
  const wildcardPlayerName = state.wildcardPlayers[state.currentWildcardIndex];
  const wildcardPlayer = state.players.find(p => p.name === wildcardPlayerName) ?? { name: wildcardPlayerName };
  const chosenCards = (state.playerChosenCards ?? {})[wildcardPlayerName] ?? [];
  const dieCard = state.currentCard ? { ...state.currentCard, deckType: 'die' } : null;

  const profileHtml = renderLivingDeadProfile({
    player: wildcardPlayer,
    dieCard,
    chosenCards,
    profileInspectCard: state.profileInspectCard ?? null,
    deckType: 'bye',
  });

  const eulogistButtons = eulogists.map(name => {
    const escapedName = name.replace(/'/g, "\\'");
    return `
      <button class="phase4__judge-btn" onclick="window.game.pickBestEulogy('${escapedName}')">
        <span class="phase4__judge-btn-name">${name}</span>
        <span class="phase4__judge-btn-label">Pick as best</span>
      </button>
    `;
  }).join('');

  return layout(state, {
    funeralDirector: state.funeralDirector,
    livingDeadName: wildcardPlayerName,
  }, `
    ${profileHtml}
    <div class="phase4__judge">
      <h2 class="phase4__judge-title">${wildcardPlayerName}, pick your favourite eulogy!</h2>
      <div class="phase4__judge-options">
        ${eulogistButtons}
      </div>
    </div>
  `);
}

function renderPointsAwarded(state) {
  const eulogists = state.selectedEulogists ?? [];
  const bestEulogist = state.bestEulogist;
  const runnerUp = eulogists.find(n => n !== bestEulogist);
  const wildcardPlayerName = state.wildcardPlayers[state.currentWildcardIndex];

  const isLastWildcard = (state.currentWildcardIndex + 1) >= state.wildcardPlayers.length;
  const nextLabel = isLastWildcard ? 'Reveal Winner' : 'Next Eulogy Round';

  return layout(state, {
    funeralDirector: state.funeralDirector,
    livingDeadName: wildcardPlayerName,
  }, `
    <div class="phase4__points">
      <h2 class="phase4__points-title">Points Awarded!</h2>
      <div class="phase4__points-breakdown">
        <div class="phase4__points-row phase4__points-row--best">
          <span class="phase4__points-name">${bestEulogist}</span>
          <span class="phase4__points-label">Best Eulogy</span>
          <span class="phase4__points-value">+2</span>
        </div>
        ${runnerUp ? `
        <div class="phase4__points-row">
          <span class="phase4__points-name">${runnerUp}</span>
          <span class="phase4__points-label">Runner-up</span>
          <span class="phase4__points-value">+1</span>
        </div>` : ''}
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
  `);
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

  // Winner screen uses renderPhaseHeader directly (no player list)
  return `
    <div class="screen screen--phase" data-phase="4">
      ${renderPhaseHeader({ phase: '4', label: PHASE_LABEL })}
      <div class="phase4__winner">
        <h2 class="phase4__winner-crown">👑</h2>
        <h2 class="phase4__winner-title">Legendary Death Doula!</h2>
        <p class="phase4__winner-name">${winnerName}</p>
        <div class="winner-announcement__card">
          <div class="scoreboard">
            <h3 class="scoreboard__title">Final Scores</h3>
            ${scoreRows}
          </div>
        </div>
        ${renderSurvey(state)}
        ${surveySubmitted(state) ? '' : `
          <button class="btn btn--primary" onclick="window.game.showScreen('menu')">
            Play Again
          </button>
        `}
      </div>
    </div>
  `;
}
