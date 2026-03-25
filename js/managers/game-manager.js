// CarkedIt Online — Game Manager
'use strict';

import { getState, setState } from '../state.js';
import { showScreen } from '../router.js';
import { createPhase1Manager } from './phase1-manager.js';

let currentPhaseManager = null;

function onStateChange(updates) {
  setState(updates);
  showScreen(getState().screen);
}

function onPhaseComplete() {
  setState({ phaseComplete: true, turnStatus: 'idle' });
  showScreen(getState().screen);
}

export function startPhase1() {
  setState({
    screen: 'phase1',
    phase: 1,
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
