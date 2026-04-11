// CarkedIt Online — Game Manager
'use strict';

import { getState, setState } from '../state.js';
import { showScreen } from '../router.js';
import { createPhase1Manager } from './phase1-manager.js';
import { createPhase23Manager } from './phase23-manager.js';
import { createPhase4Manager } from './phase4-manager.js';
import { computeDodTurnOrder } from '../utils/turn-order.js';
import { shuffle } from '../utils/shuffle.js';
import { sendMessage, getRoom } from '../network/client.js';

let currentPhaseManager = null;

/** Find the index of a card in the local player's server-side hand by local card ID */
function findServerCardIndex(cardId) {
  const room = getRoom();
  const state = getState();
  if (!room) return -1;
  const myPlayer = room.state.players.get(state.mySessionId);
  if (!myPlayer?.hand) return -1;
  for (let i = 0; i < myPlayer.hand.length; i++) {
    if (myPlayer.hand[i].id === String(cardId)) return i;
  }
  return -1;
}

/** Find the index of the selected card in the server's submittedCards array */
function findSubmittedCardIndex() {
  const room = getRoom();
  const state = getState();
  if (!room || !state.selectedCard) {
    console.warn('[confirmWinner] No room or selectedCard', { hasRoom: !!room, selectedCard: state.selectedCard });
    return -1;
  }
  // Use stored index if available (from index-based selection)
  if (typeof state.selectedCard._cardIndex === 'number') {
    return state.selectedCard._cardIndex;
  }
  // Fallback: match by sessionId via playerName
  const playerName = state.selectedCard.playerName;
  const player = state.players.find(p => p.name === playerName);
  if (!player) {
    console.warn('[confirmWinner] Player not found for name:', playerName, 'players:', state.players.map(p => p.name));
    return -1;
  }
  for (let i = 0; i < room.state.submittedCards.length; i++) {
    if (room.state.submittedCards[i].submittedBy === player.sessionId) return i;
  }
  console.warn('[confirmWinner] No submitted card matches sessionId:', player.sessionId);
  return -1;
}

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
  if (getState().gameMode === 'online') {
    sendMessage('end_die_turn');
    return;
  }
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
  if (forceWildcards !== 'everyone' && wildcardCount > 0) {
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
  if (getState().gameMode === 'online') return; // No pass-phone in online mode
  currentPhaseManager?.showPlayerHand();
}

export function readyToSelect() {
  if (getState().gameMode === 'online') return; // No pass-phone in online mode
  currentPhaseManager?.readyToSelect();
}

export function redrawHand() {
  currentPhaseManager?.redrawHand();
}

export function inspectCard(cardId) {
  if (getState().gameMode === 'online') {
    const state = getState();
    const card = (state.hand ?? []).find(c => String(c.id) === String(cardId));
    if (card) {
      setState({ selectedCard: card });
      showScreen(state.screen);
    }
    return;
  }
  currentPhaseManager?.inspectCard(cardId);
}

export function prevCard(cardId) {
  if (getState().gameMode === 'online') {
    const state = getState();
    const hand = state.hand ?? [];
    const index = hand.findIndex(c => String(c.id) === String(cardId));
    const prevIndex = index <= 0 ? hand.length - 1 : index - 1;
    if (hand[prevIndex]) {
      setState({ selectedCard: hand[prevIndex] });
      showScreen(state.screen);
    }
    return;
  }
  currentPhaseManager?.prevCard(cardId);
}

export function nextCard(cardId) {
  if (getState().gameMode === 'online') {
    const state = getState();
    const hand = state.hand ?? [];
    const index = hand.findIndex(c => String(c.id) === String(cardId));
    const nextIndex = index >= hand.length - 1 ? 0 : index + 1;
    if (hand[nextIndex]) {
      setState({ selectedCard: hand[nextIndex] });
      showScreen(state.screen);
    }
    return;
  }
  currentPhaseManager?.nextCard(cardId);
}

export function dismissInspect() {
  if (getState().gameMode === 'online') {
    setState({ selectedCard: null });
    showScreen(getState().screen);
    return;
  }
  currentPhaseManager?.dismissInspect();
}

export function passCard() {
  currentPhaseManager?.passCard();
}

export function submitCard(cardId) {
  if (getState().gameMode === 'online') {
    const cardIndex = findServerCardIndex(cardId);
    if (cardIndex >= 0) sendMessage('submit_card', { cardIndex });
    return;
  }
  currentPhaseManager?.submitCard(cardId);
}

export function revealCards() {
  if (getState().gameMode === 'online') {
    sendMessage('reveal_submission');
    return;
  }
  currentPhaseManager?.revealCards();
}

export function startPitching() {
  if (getState().gameMode === 'online') return; // Server auto-manages convince flow
  currentPhaseManager?.startPitching();
}

export function donePitching() {
  if (getState().gameMode === 'online') {
    sendMessage('end_convince_turn');
    return;
  }
  currentPhaseManager?.donePitching();
}

export function pickWinner(playerName) {
  currentPhaseManager?.pickWinner(playerName);
}

export function inspectJudgingCard(indexOrName) {
  if (getState().gameMode === 'online') {
    const state = getState();
    const cards = state.onlineSubmittedCards ?? [];
    // Index-based lookup (new) with name-based fallback (legacy)
    const card = typeof indexOrName === 'number'
      ? cards[indexOrName]
      : (state.submittedCards ?? {})[indexOrName];
    if (card) {
      const player = state.players.find(p => p.sessionId === card.submittedBy);
      const cardIndex = typeof indexOrName === 'number' ? indexOrName : cards.indexOf(card);
      setState({ selectedCard: { ...card, playerName: player?.name ?? 'Unknown', _cardIndex: cardIndex } });
      showScreen(state.screen);
    }
    return;
  }
  currentPhaseManager?.inspectJudgingCard(indexOrName);
}

export function prevJudgingCard(currentIndex) {
  if (getState().gameMode === 'online') {
    const list = getOnlineJudgingCardList();
    const idx = typeof currentIndex === 'number' ? currentIndex : list.findIndex(c => String(c.id) === String(currentIndex));
    const prevIndex = idx <= 0 ? list.length - 1 : idx - 1;
    if (list[prevIndex]) {
      setState({ selectedCard: list[prevIndex] });
      showScreen(getState().screen);
    }
    return;
  }
  currentPhaseManager?.prevJudgingCard(currentIndex);
}

export function nextJudgingCard(currentIndex) {
  if (getState().gameMode === 'online') {
    const list = getOnlineJudgingCardList();
    const idx = typeof currentIndex === 'number' ? currentIndex : list.findIndex(c => String(c.id) === String(currentIndex));
    const nextIndex = idx >= list.length - 1 ? 0 : idx + 1;
    if (list[nextIndex]) {
      setState({ selectedCard: list[nextIndex] });
      showScreen(getState().screen);
    }
    return;
  }
  currentPhaseManager?.nextJudgingCard(currentIndex);
}

function getOnlineJudgingCardList() {
  const state = getState();
  return (state.onlineSubmittedCards ?? []).map((card, index) => {
    const player = state.players.find(p => p.sessionId === card.submittedBy);
    return { ...card, playerName: player?.name ?? 'Unknown', _cardIndex: index };
  });
}

export function confirmWinner() {
  if (getState().gameMode === 'online') {
    const cardIndex = findSubmittedCardIndex();
    if (cardIndex >= 0) sendMessage('select_winner', { cardIndex });
    return;
  }
  currentPhaseManager?.confirmWinner();
}

export function inspectProfileCard(index) {
  if (currentPhaseManager?.inspectProfileCard) {
    currentPhaseManager.inspectProfileCard(index);
    return;
  }
  // Online mode fallback — compute profile cards directly from state
  const state = getState();
  const livingDead = state.players[state.livingDeadIndex];
  if (!livingDead) return;
  const chosenCards = state.playerChosenCards?.[livingDead.name] ?? [];
  const dieCard = state.playerDieCards?.[livingDead.name];
  const allCards = [];
  chosenCards.forEach(c => { if (c.deckType === 'live') allCards.push(c); });
  if (dieCard) allCards.push({ ...dieCard, deckType: 'die' });
  chosenCards.forEach(c => { if (c.deckType === 'bye') allCards.push(c); });
  const card = allCards[index];
  if (card) {
    setState({ profileInspectCard: card });
    showScreen(getState().screen);
  }
}

export function dismissProfileCard() {
  if (currentPhaseManager?.dismissProfileCard) {
    currentPhaseManager.dismissProfileCard();
    return;
  }
  setState({ profileInspectCard: null });
  showScreen(getState().screen);
}

export function nextRound() {
  if (getState().gameMode === 'online') return; // Server auto-advances after 5s
  currentPhaseManager?.nextRound();
}

export function revealCard() {
  if (getState().gameMode === 'online') {
    sendMessage('reveal_die');
    return;
  }
  if (currentPhaseManager?.revealCard) {
    currentPhaseManager.revealCard();
  }
}

// ── Phase 4 (EULOGY WILDCARD) ────────────────────────────

export function startPhase4() {
  if (getState().gameMode === 'online') return; // Server manages eulogy transition

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
  if (getState().gameMode === 'online') {
    sendMessage('start_eulogy_round');
    return;
  }
  currentPhaseManager?.startEulogyRound();
}

export function selectEulogist(playerNameOrSessionId) {
  if (getState().gameMode === 'online') {
    // In online mode, the argument is a session ID
    sendMessage('select_eulogist', { sessionId: playerNameOrSessionId });
    return;
  }
  currentPhaseManager?.selectEulogist(playerNameOrSessionId);
}

export function confirmEulogists() {
  if (getState().gameMode === 'online') {
    sendMessage('confirm_eulogists');
    return;
  }
  currentPhaseManager?.confirmEulogists();
}

export function startEulogy() {
  // No pass-phone in online mode — this is only used in shared device mode
  currentPhaseManager?.startEulogy();
}

export function doneEulogy() {
  if (getState().gameMode === 'online') {
    sendMessage('done_eulogy');
    return;
  }
  currentPhaseManager?.doneEulogy();
}

export function pickBestEulogy(playerNameOrSessionId) {
  if (getState().gameMode === 'online') {
    // In online mode, the argument is a session ID
    sendMessage('pick_best_eulogy', { sessionId: playerNameOrSessionId });
    return;
  }
  currentPhaseManager?.pickBestEulogy(playerNameOrSessionId);
}

export function nextWildcard() {
  if (getState().gameMode === 'online') return; // Server auto-advances after 5s
  currentPhaseManager?.nextWildcard();
}
