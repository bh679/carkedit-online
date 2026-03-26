// CarkedIt Online — Phase 4 Manager (Eulogy Wildcard)
'use strict';

import { getState } from '../state.js';

/**
 * @param {{ onStateChange: (updates: object) => void, onPhaseComplete: () => void }} config
 */
export function createPhase4Manager({ onStateChange, onPhaseComplete }) {

  function detectWildcardPlayers() {
    const state = getState();
    const wildcardCards = state.wildcardCards ?? {};
    return state.players.filter(p => {
      const cards = wildcardCards[p.name] ?? [];
      return cards.length > 0;
    });
  }

  function getWildcardPlayerDieCard(state, playerName) {
    const dieCard = state.playerDieCards[playerName];
    return dieCard ? { ...dieCard, deckType: 'die' } : null;
  }

  function start() {
    const wildcardPlayers = detectWildcardPlayers();

    if (wildcardPlayers.length === 0) {
      // No wildcards — go straight to winner
      onStateChange({
        phase4SubState: 'winner',
        wildcardPlayers: [],
        currentWildcardIndex: 0,
        selectedEulogists: [],
        currentEulogistIndex: 0,
        bestEulogist: null,
      });
      return;
    }

    onStateChange({
      phase4SubState: 'wildcard-intro',
      wildcardPlayers: wildcardPlayers.map(p => p.name),
      currentWildcardIndex: 0,
      selectedEulogists: [],
      currentEulogistIndex: 0,
      bestEulogist: null,
      currentCard: null,
    });
  }

  function startEulogyRound() {
    const state = getState();
    const wildcardPlayerName = state.wildcardPlayers[state.currentWildcardIndex];

    onStateChange({
      phase4SubState: 'pick-eulogists',
      selectedEulogists: [],
      currentEulogistIndex: 0,
      bestEulogist: null,
      currentCard: getWildcardPlayerDieCard(state, wildcardPlayerName),
    });
  }

  function selectEulogist(playerName) {
    const state = getState();
    const current = state.selectedEulogists ?? [];
    const wildcardPlayerName = state.wildcardPlayers[state.currentWildcardIndex];

    // Can't select self
    if (playerName === wildcardPlayerName) return;

    // Toggle selection
    const isSelected = current.includes(playerName);
    let next;
    if (isSelected) {
      next = current.filter(n => n !== playerName);
    } else if (current.length < 2) {
      next = [...current, playerName];
    } else {
      // Already have 2 — replace the oldest
      next = [current[1], playerName];
    }

    onStateChange({ selectedEulogists: next });
  }

  function confirmEulogists() {
    const state = getState();
    if ((state.selectedEulogists ?? []).length !== 2) return;

    onStateChange({
      phase4SubState: 'pass-phone-eulogist',
      currentEulogistIndex: 0,
    });
  }

  function startEulogy() {
    const state = getState();
    const wildcardPlayerName = state.wildcardPlayers[state.currentWildcardIndex];

    onStateChange({
      phase4SubState: 'eulogy',
      currentCard: getWildcardPlayerDieCard(state, wildcardPlayerName),
    });
  }

  function doneEulogy() {
    const state = getState();
    const nextIndex = state.currentEulogistIndex + 1;

    if (nextIndex >= 2) {
      // Both eulogies done — time to judge
      onStateChange({
        phase4SubState: 'judge',
        currentEulogistIndex: 0,
      });
    } else {
      // Pass phone to next eulogist
      onStateChange({
        phase4SubState: 'pass-phone-eulogist',
        currentEulogistIndex: nextIndex,
      });
    }
  }

  function pickBestEulogy(playerName) {
    const state = getState();
    const eulogists = state.selectedEulogists ?? [];
    if (!eulogists.includes(playerName)) return;

    const wildcardPlayerName = state.wildcardPlayers[state.currentWildcardIndex];
    const runnerUp = eulogists.find(n => n !== playerName);

    // Award points: best=2, runner-up=1, wildcard player=1
    const players = state.players.map(p => {
      let bonus = 0;
      if (p.name === playerName) bonus += 2;
      if (p.name === runnerUp) bonus += 1;
      if (p.name === wildcardPlayerName) bonus += 1;
      return { ...p, score: (p.score ?? 0) + bonus };
    });

    onStateChange({
      players,
      bestEulogist: playerName,
      phase4SubState: 'points-awarded',
    });
  }

  function nextWildcard() {
    const state = getState();
    const nextIndex = state.currentWildcardIndex + 1;

    if (nextIndex >= state.wildcardPlayers.length) {
      // All wildcards done — show winner
      onStateChange({
        phase4SubState: 'winner',
        currentWildcardIndex: nextIndex,
      });
    } else {
      // Next wildcard holder
      const nextPlayerName = state.wildcardPlayers[nextIndex];
      onStateChange({
        phase4SubState: 'pick-eulogists',
        currentWildcardIndex: nextIndex,
        selectedEulogists: [],
        currentEulogistIndex: 0,
        bestEulogist: null,
        currentCard: getWildcardPlayerDieCard(state, nextPlayerName),
      });
    }
  }

  return {
    start,
    startEulogyRound,
    selectEulogist,
    confirmEulogists,
    startEulogy,
    doneEulogy,
    pickBestEulogy,
    nextWildcard,
  };
}
