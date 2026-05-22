// CarkedIt Online — Phase Intro Component
'use strict';

import { render as renderPhaseLayout } from './phase-layout.js';
import { render as renderGameboard, renderActiveCard } from './gameboard.js';
import { render as renderCardBack } from './cardBack.js';
import { render as renderCard } from './card.js';
import { buildCard } from '../data/card.js';
import { escapeHtml } from '../utils/escape.js';

export const PHASE_DESCRIPTIONS = {
  '1': 'Time to die! Reveal your death and tell us a story of how you see it happening. Get serious, creative or funny!',
  '2': 'What did you wish you did before you died? Pitch the best way to live before you die, the living dead player judges.',
  '3': 'Pitch what happens after the end.',
  '4': 'Have a wildcard? Time for final words. Pick your eulogists. Judge the best.',
};

export const PHASE_LABELS = {
  '1': 'Phase 1 - DIE',
  '2': 'Phase 2 - LIVE',
  '3': 'Phase 3 - BYE',
  '4': 'Phase 4 - EULOGY',
};

const PHASE_DECK_TYPE = {
  '1': 'die',
  '2': 'live',
  '3': 'bye',
  '4': 'bye',
};

const PHASE_CARD_LABEL = {
  '1': 'Die Deck',
  '2': 'Live Deck',
  '3': 'Bye Deck',
  '4': 'Wildcard Eulogy',
};

function buildWildcardCardHtml() {
  const wildcardDisplayCard = buildCard({
    id: 'wildcard-intro',
    title: 'Wildcard Eulogy',
    description: 'Save this card until the end, for a chance at bonus points!',
    prompt: 'Bonus Mini-Game: pick 2 players to give your Eulogy!',
    illustrationKey: 'wildcard-eulogy',
    deckType: 'bye',
  });
  return renderCard(wildcardDisplayCard);
}

/**
 * Renders the shared phase-intro screen used before each of the 4 phases.
 *
 * @param {object} options
 * @param {'1'|'2'|'3'|'4'} options.phaseNumber
 * @param {object} options.state - Full game state (used for player list, mode flags)
 * @param {string} [options.extraContent] - HTML appended below the description
 *   (e.g. Phase 4 wildcard-holder list)
 * @param {boolean} [options.isOnline] - Online mode flag
 * @param {Array} [options.players] - Player array (online mode chips)
 * @param {boolean} [options.amReady] - Local player's own ready state (online)
 * @param {boolean} [options.isFuneralDirector] - Whether the viewer is the FD/host
 * @param {boolean} [options.allReady] - Whether every connected player is ready (online)
 * @returns {string} HTML string
 */
export function render({
  phaseNumber,
  state,
  extraContent = '',
  isOnline = false,
  players = [],
  amReady = false,
  isFuneralDirector = false,
  allReady = false,
}) {
  const label = PHASE_LABELS[phaseNumber] ?? `Phase ${phaseNumber}`;
  const description = PHASE_DESCRIPTIONS[phaseNumber] ?? '';
  const deckType = PHASE_DECK_TYPE[phaseNumber] ?? 'die';
  const cardLabel = PHASE_CARD_LABEL[phaseNumber] ?? '';

  const cardInner = phaseNumber === '4'
    ? buildWildcardCardHtml()
    : renderCardBack({ deckType });

  const cardHtml = renderActiveCard(cardInner, { label: cardLabel });

  const readyControls = isOnline
    ? renderOnlineControls({ players, amReady, isFuneralDirector, allReady })
    : renderLocalControls();

  const innerChildren = `
    <div class="phase-intro__layout">
      ${cardHtml}
      <p class="phase-intro__description">${escapeHtml(description)}</p>
      ${extraContent}
      ${readyControls}
    </div>
  `;

  return renderPhaseLayout({
    phase: phaseNumber,
    label,
    players: state?.players ?? [],
    playerListOptions: { funeralDirector: state?.funeralDirector },
    children: renderGameboard(innerChildren),
  });
}

function renderLocalControls() {
  return `
    <div class="phase-intro__actions">
      <button class="btn btn--primary" onclick="window.game.dismissPhaseIntro()">
        Start Phase
      </button>
    </div>
  `;
}

function renderOnlineControls({ players, amReady, isFuneralDirector, allReady }) {
  const chips = players.map(p => {
    const ready = !!p.ready;
    const cls = ready
      ? 'phase-intro__ready-chip phase-intro__ready-chip--ready'
      : 'phase-intro__ready-chip';
    const status = ready ? 'Ready to Die' : 'Not Ready';
    return `
      <div class="${cls}">
        <span class="phase-intro__ready-chip-name">${escapeHtml(p.name)}</span>
        <span class="phase-intro__ready-chip-status">${status}</span>
      </div>
    `;
  }).join('');

  const readyLabel = amReady ? 'Not Ready' : 'Ready to Die';
  const readyClass = amReady ? 'btn--secondary' : 'btn--primary';

  const startAnywayBtn = (isFuneralDirector && !allReady)
    ? `<button class="btn btn--secondary phase-intro__start-anyway"
              onclick="window.game.startPhaseAnyway()">
         Start Anyway
       </button>`
    : '';

  return `
    <div class="phase-intro__ready-list">
      ${chips}
    </div>
    <div class="phase-intro__actions">
      <button class="btn ${readyClass}" onclick="window.game.toggleIntroReady()">
        ${readyLabel}
      </button>
      ${startAnywayBtn}
    </div>
  `;
}
