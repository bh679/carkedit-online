// CarkedIt Online — Game Manager
'use strict';

import { getState, setState } from '../state.js';
import { showScreen } from '../router.js';
import { createPhase1Manager } from './phase1-manager.js';
import { createPhase23Manager } from './phase23-manager.js';
import { createPhase4Manager } from './phase4-manager.js';
import { computeDodTurnOrder } from '../utils/turn-order.js';
import { shuffle } from '../utils/shuffle.js';

let currentPhaseManager = null;

function onStateChange(updates) {
  setState(updates);
  showScreen(getState().screen);
}

function onPhaseComplete() {
  setState({ phaseComplete: true, turnStatus: 'idle' });
  showScreen(getState().screen);
}

// ── Phase 1 ──────────────────────────────────────────────

export function startPhase1() {
  const orderedPlayers = computeDodTurnOrder(getState().players);
  setState({
    screen: 'phase1',
    phase: 1,
    players: orderedPlayers,
    currentPlayerIndex: 0,
    turnStatus: 'dealing',
    phaseComplete: false,
    playerDieCards: {},
    currentCard: null,
  });
  showScreen('phase1');

  currentPhaseManager = createPhase1Manager({ onStateChange, onPhaseComplete });
  currentPhaseManager.start();
}

export function doneDying() {
  if (currentPhaseManager?.nextTurn) {
    currentPhaseManager.nextTurn();
  }
}

// ── Phase 2/3 shared init state ─────────────────────────

function createPhase23InitState() {
  return {
    phaseComplete: false,
    phase2SubState: 'living-dead',
    livingDeadIndex: 0,
    phase23Round: 0,
    playerHands: {},
    submittedCards: {},
    revealedCards: false,
    pitchingPlayerIndex: 0,
    selectedCard: null,
    currentNonDeadIndex: 0,
    roundWinner: null,
    currentCard: null,
    hand: [],
    handRedrawnPlayers: {},
    hasPlayedCardPlayers: {},
  };
}

// ── Phase 2 (LIVE) ──────────────────────────────────────

export function startPhase2() {
  setState({ screen: 'phase2', phase: 2, ...createPhase23InitState() });

  currentPhaseManager = createPhase23Manager({
    deckType: 'live',
    onStateChange: (updates) => {
      setState(updates);
      showScreen('phase2');
    },
    onPhaseComplete: () => {
      setState({ phaseComplete: true, phase2SubState: 'living-dead' });
      showScreen('phase2');
    },
  });

  currentPhaseManager.start();
}

// ── Phase 3 (BYE) ──────────────────────────────────────

export function startPhase3() {
  setState({ screen: 'phase3', phase: 3, ...createPhase23InitState() });

  // Apply wildcard count setting to bye deck
  const { forceWildcards, wildcardCount } = getState().gameSettings;
  const byeDeck = getState().decks.bye ?? [];
  const wildcards = byeDeck.filter(c => c.special === 'Wildcard');
  const nonWildcards = byeDeck.filter(c => c.special !== 'Wildcard');
  let keepWildcards = [];
  if (!forceWildcards && wildcardCount > 0) {
    const template = wildcards[0] ?? { title: 'Wildcard Eulogy', description: 'Save this card until the end, for a chance at bonus points!', special: 'Wildcard', illustrationKey: 'wildcard-eulogy' };
    keepWildcards = Array.from({ length: wildcardCount }, (_, i) => ({
      ...template,
      id: `wildcard-${i}`,
    }));
  }
  const combined = shuffle([...nonWildcards, ...keepWildcards]);
  setState({ decks: { ...getState().decks, bye: combined } });

  currentPhaseManager = createPhase23Manager({
    deckType: 'bye',
    onStateChange: (updates) => {
      setState(updates);
      showScreen('phase3');
    },
    onPhaseComplete: () => {
      setState({ phaseComplete: true, phase2SubState: 'living-dead' });
      showScreen('phase3');
    },
  });

  currentPhaseManager.start();
}

// ── Phase 2/3 Actions ───────────────────────────────────

export function showPlayerHand() {
  currentPhaseManager?.showPlayerHand();
}

export function readyToSelect() {
  currentPhaseManager?.readyToSelect();
}

export function redrawHand() {
  currentPhaseManager?.redrawHand();
}

export function inspectCard(cardId) {
  currentPhaseManager?.inspectCard(cardId);
}

export function prevCard(cardId) {
  currentPhaseManager?.prevCard(cardId);
}

export function nextCard(cardId) {
  currentPhaseManager?.nextCard(cardId);
}

export function dismissInspect() {
  currentPhaseManager?.dismissInspect();
}

export function passCard() {
  currentPhaseManager?.passCard();
}

export function submitCard(cardId) {
  currentPhaseManager?.submitCard(cardId);
}

export function revealCards() {
  currentPhaseManager?.revealCards();
}

export function startPitching() {
  currentPhaseManager?.startPitching();
}

export function donePitching() {
  currentPhaseManager?.donePitching();
}

export function pickWinner(playerName) {
  currentPhaseManager?.pickWinner(playerName);
}

export function inspectJudgingCard(playerName) {
  currentPhaseManager?.inspectJudgingCard(playerName);
}

export function prevJudgingCard(cardId) {
  currentPhaseManager?.prevJudgingCard(cardId);
}

export function nextJudgingCard(cardId) {
  currentPhaseManager?.nextJudgingCard(cardId);
}

export function confirmWinner() {
  currentPhaseManager?.confirmWinner();
}

export function inspectProfileCard(index) {
  currentPhaseManager?.inspectProfileCard(index);
}

export function dismissProfileCard() {
  currentPhaseManager?.dismissProfileCard();
}

export function nextRound() {
  currentPhaseManager?.nextRound();
}

export function revealCard() {
  if (currentPhaseManager?.revealCard) {
    currentPhaseManager.revealCard();
  }
}

// ── Phase 4 (EULOGY WILDCARD) ────────────────────────────

export function startPhase4() {
  setState({
    screen: 'phase4',
    phase: 4,
    phaseComplete: false,
    phase4SubState: 'wildcard-intro',
    wildcardPlayers: [],
    currentWildcardIndex: 0,
    selectedEulogists: [],
    currentEulogistIndex: 0,
    bestEulogist: null,
    currentCard: null,
  });

  currentPhaseManager = createPhase4Manager({
    onStateChange: (updates) => {
      setState(updates);
      showScreen('phase4');
    },
    onPhaseComplete: () => {
      setState({ phaseComplete: true });
      showScreen('phase4');
    },
  });

  currentPhaseManager.start();
}

export function startEulogyRound() {
  currentPhaseManager?.startEulogyRound();
}

export function selectEulogist(playerName) {
  currentPhaseManager?.selectEulogist(playerName);
}

export function confirmEulogists() {
  currentPhaseManager?.confirmEulogists();
}

export function startEulogy() {
  currentPhaseManager?.startEulogy();
}

export function doneEulogy() {
  currentPhaseManager?.doneEulogy();
}

export function pickBestEulogy(playerName) {
  currentPhaseManager?.pickBestEulogy(playerName);
}

export function nextWildcard() {
  currentPhaseManager?.nextWildcard();
}
