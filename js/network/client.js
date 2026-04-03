// CarkedIt Online — Colyseus Network Client (SDK 0.17)
'use strict';

import { getState, setState } from '../state.js';
import { startPlayCardTimer, clearPlayCardTimer, startPitchTimer, clearPitchTimer, clearAllTimers } from '../managers/online-timer.js';
import { saveGameToHistory } from '../managers/game-history.js';

const _origin = window.location.origin;
let _serverUrl = _origin;
let _restBaseUrl = _origin;
let _configLoaded = false;

let _client = null;
let _room = null;
let _onScreenChange = null;
let _onSettingsChange = null;
let _lastOnUpdate = null;
let _reconnecting = false;

async function loadConfig() {
  if (_configLoaded) return;
  _configLoaded = true;
  try {
    const res = await fetch('config.json');
    if (res.ok) {
      const cfg = await res.json();
      if (cfg.serverUrl) {
        _serverUrl = cfg.serverUrl.replace(/\/+$/, '');
        _restBaseUrl = _serverUrl;
        console.log(`[client] Using server URL from config.json: ${_serverUrl}`);
      }
    }
  } catch {
    // No config.json or invalid — use same-origin default
  }
}

async function getColyseusClient() {
  await loadConfig();
  if (_client) return _client;
  if (!window.Colyseus) {
    throw new Error('Colyseus SDK not loaded. Ensure the script tag is in index.html.');
  }
  _client = new window.Colyseus.Client(_serverUrl);
  return _client;
}

function syncPlayersFromRoom(room) {
  const players = [];
  if (!room.state?.players?.forEach) return players;
  room.state.players.forEach((player, sessionId) => {
    players.push({
      sessionId,
      name: player.name,
      score: player.score,
      birthMonth: player.birthMonth,
      birthDay: player.birthDay,
      connected: player.connected,
      ready: player.ready,
    });
  });
  return players;
}

/** Build the local players array from online player data + turn order */
function buildPlayersFromOnline(room) {
  const turnOrder = Array.from(room.state.turnOrder ?? []);
  const players = [];
  for (const sessionId of turnOrder) {
    const p = room.state.players.get(sessionId);
    if (p) {
      players.push({
        sessionId,
        name: p.name,
        score: p.score ?? 0,
        birthMonth: p.birthMonth,
        birthDay: p.birthDay,
      });
    }
  }
  return players;
}

/** Find the card data for the current turn player's die card from server state */
function syncDiePhaseState(room) {
  const state = getState();
  const currentTurn = room.state.currentTurn;
  const mySessionId = state.mySessionId;
  const players = buildPlayersFromOnline(room);
  const turnOrder = Array.from(room.state.turnOrder ?? []);
  const currentPlayerIndex = turnOrder.indexOf(currentTurn);
  const currentPlayer = room.state.players.get(currentTurn);

  // Get the die card from the current player's hand
  let currentCard = null;
  let cardRevealed = false;
  if (currentPlayer?.hand?.length > 0) {
    const serverCard = currentPlayer.hand[0];
    cardRevealed = serverCard.faceUp;
    // Look up the full card from the local die deck by matching ID
    const dieCards = state.decks?.die ?? [];
    const localCard = dieCards.find(c => String(c.id) === serverCard.id);
    if (localCard) {
      currentCard = { ...localCard, deckType: 'die' };
    } else {
      // Fallback: use server text as title
      currentCard = { id: serverCard.id, title: serverCard.text, deckType: 'die' };
    }
  }

  return {
    players,
    currentPlayerIndex: Math.max(0, currentPlayerIndex),
    currentCard,
    cardRevealed,
    turnStatus: currentCard ? 'describing' : 'dealing',
    isMyTurn: currentTurn === mySessionId,
  };
}

/** Map a server Card schema object to the local card format */
function serverCardToLocal(serverCard) {
  const state = getState();
  const deckType = serverCard.deck === 'living' ? 'live' : serverCard.deck;
  const localDeck = state.decks?.[deckType] ?? [];
  const match = localDeck.find(c => String(c.id) === serverCard.id);
  return match
    ? { ...match, deckType, faceUp: serverCard.faceUp, submittedBy: serverCard.submittedBy }
    : { id: serverCard.id, title: serverCard.text, deckType, faceUp: serverCard.faceUp, submittedBy: serverCard.submittedBy };
}

/** Build state for the living/bye phase from server room state */
function syncLivingPhaseState(room) {
  const state = getState();
  const mySessionId = state.mySessionId;
  const players = buildPlayersFromOnline(room);
  const turnOrder = Array.from(room.state.turnOrder ?? []);
  const currentLivingDead = room.state.currentLivingDead;
  const livingDeadIndex = turnOrder.indexOf(currentLivingDead);
  const isLivingDead = currentLivingDead === mySessionId;

  // Map server phase to online sub-phase
  const serverPhase = room.state.phase;
  let onlinePhase = null;
  let screenName = null;
  if (serverPhase === 'living_submit' || serverPhase === 'bye_submit') {
    onlinePhase = 'submit';
    screenName = serverPhase.startsWith('living') ? 'phase2' : 'phase3';
  } else if (serverPhase === 'living_convince' || serverPhase === 'bye_convince') {
    onlinePhase = 'convince';
    screenName = serverPhase.startsWith('living') ? 'phase2' : 'phase3';
  } else if (serverPhase === 'living_select' || serverPhase === 'bye_select') {
    onlinePhase = 'select';
    screenName = serverPhase.startsWith('living') ? 'phase2' : 'phase3';
  } else if (serverPhase === 'living_winner' || serverPhase === 'bye_winner') {
    onlinePhase = 'winner';
    screenName = serverPhase.startsWith('living') ? 'phase2' : 'phase3';
  }

  // Sync this player's hand
  const myPlayer = room.state.players.get(mySessionId);
  const hand = [];
  if (myPlayer?.hand) {
    for (let i = 0; i < myPlayer.hand.length; i++) {
      hand.push(serverCardToLocal(myPlayer.hand[i]));
    }
  }

  // Count submitters and collect submitted player names
  let submittedCount = 0;
  let totalSubmitters = 0;
  const onlineSubmittedPlayerNames = [];
  room.state.players.forEach((p, sid) => {
    if (sid === currentLivingDead) return;
    totalSubmitters++;
    if (p.hasSubmitted) {
      submittedCount++;
      onlineSubmittedPlayerNames.push(p.name);
    }
  });

  // Sync submitted cards
  const submittedCards = [];
  for (let i = 0; i < room.state.submittedCards.length; i++) {
    submittedCards.push(serverCardToLocal(room.state.submittedCards[i]));
  }

  // Convince turn info
  const convincingTurn = room.state.convincingTurn;
  const convincerPlayer = room.state.players.get(convincingTurn);
  const onlineConvincerName = convincerPlayer?.name ?? null;
  const isMyConvinceTurn = convincingTurn === mySessionId;

  // Check if my submitted card has been revealed
  let myCardRevealed = false;
  for (let i = 0; i < room.state.submittedCards.length; i++) {
    const card = room.state.submittedCards[i];
    if (card.submittedBy === mySessionId && card.faceUp) {
      myCardRevealed = true;
      break;
    }
  }

  // Living Dead die card (for profile display)
  const livingDeadPlayer = room.state.players.get(currentLivingDead);
  const livingDeadName = livingDeadPlayer?.name ?? '';
  const currentCard = state.playerDieCards?.[livingDeadName]
    ? { ...state.playerDieCards[livingDeadName], deckType: 'die' }
    : null;

  // Winner announcement data
  const roundWinnerSessionId = room.state.roundWinner || '';
  const roundWinnerPlayer = roundWinnerSessionId ? room.state.players.get(roundWinnerSessionId) : null;
  const roundWinnerName = roundWinnerPlayer?.name ?? '';
  const roundWinnerCardIndex = room.state.roundWinnerCardIndex ?? -1;
  let roundWinnerCard = null;
  if (roundWinnerCardIndex >= 0 && roundWinnerCardIndex < submittedCards.length) {
    roundWinnerCard = submittedCards[roundWinnerCardIndex];
  }

  return {
    players,
    livingDeadIndex: Math.max(0, livingDeadIndex),
    isLivingDead,
    onlinePhase,
    screenName,
    hand,
    onlineSubmittedCount: submittedCount,
    onlineTotalSubmitters: totalSubmitters,
    onlineSubmittedPlayerNames,
    onlineSubmittedCards: submittedCards,
    onlineConvincerName,
    isMyConvinceTurn,
    myCardRevealed,
    currentCard,
    round: room.state.round,
    roundWinner: roundWinnerName,
    roundWinnerCard,
    // During select/winner phases, build the submittedCards map (keyed by player name)
    // so that confirmWinner/findSubmittedCardIndex can look up cards reliably.
    // Outside those phases, reset submittedCards and selectedCard.
    ...(onlinePhase === 'select' || onlinePhase === 'winner'
      ? { submittedCards: (() => {
          const map = {};
          for (const card of submittedCards) {
            const p = players.find(pl => pl.sessionId === card.submittedBy);
            if (p) map[p.name] = card;
          }
          return map;
        })() }
      : { submittedCards: {}, selectedCard: null }),
    phaseComplete: false,
  };
}

/** Build state for the eulogy (Phase 4) from server room state */
function syncEulogyPhaseState(room) {
  const state = getState();
  const mySessionId = state.mySessionId;
  const players = buildPlayersFromOnline(room);
  const serverPhase = room.state.phase;

  // Map server phase to client phase4SubState
  const phaseMap = {
    'eulogy_intro': 'wildcard-intro',
    'eulogy_pick': 'pick-eulogists',
    'eulogy_speech': 'eulogy',
    'eulogy_judge': 'judge',
    'eulogy_points': 'points-awarded',
    'winner': 'winner',
  };
  const phase4SubState = phaseMap[serverPhase] ?? 'wildcard-intro';

  // Map wildcard player IDs to names
  const wildcardPlayerIds = Array.from(room.state.wildcardPlayerIds ?? []);
  const wildcardPlayers = wildcardPlayerIds.map(id => {
    const p = room.state.players.get(id);
    return p?.name ?? id;
  });

  // Current wildcard player
  const currentWildcardPlayer = room.state.currentWildcardPlayer ?? '';
  const wildcardPlayerObj = room.state.players.get(currentWildcardPlayer);
  const onlineWildcardPlayerName = wildcardPlayerObj?.name ?? '';
  const isCurrentWildcardPlayer = currentWildcardPlayer === mySessionId;

  // Selected eulogists (session IDs to names)
  const eulogistIds = Array.from(room.state.selectedEulogists ?? []);
  const selectedEulogists = eulogistIds.map(id => {
    const p = room.state.players.get(id);
    return p?.name ?? id;
  });
  const onlineEulogistNames = selectedEulogists;

  // Current eulogist
  const currentEulogistIndex = room.state.currentEulogistIndex ?? 0;
  const currentEulogistId = eulogistIds[currentEulogistIndex] ?? '';
  const isCurrentEulogist = currentEulogistId === mySessionId;

  // Best eulogist
  const bestEulogistId = room.state.bestEulogist ?? '';
  const bestEulogistObj = room.state.players.get(bestEulogistId);
  const bestEulogist = bestEulogistObj?.name ?? null;

  // Die card for current wildcard player (from local playerDieCards)
  const currentCard = state.playerDieCards?.[onlineWildcardPlayerName]
    ? { ...state.playerDieCards[onlineWildcardPlayerName], deckType: 'die' }
    : null;

  return {
    players,
    phase4SubState,
    wildcardPlayers,
    currentWildcardIndex: room.state.currentWildcardIndex ?? 0,
    selectedEulogists,
    currentEulogistIndex,
    bestEulogist,
    currentCard,
    isCurrentWildcardPlayer,
    isCurrentEulogist,
    onlineEulogistNames,
    onlineWildcardPlayerName,
    onlinePhase: serverPhase,
    phaseComplete: false,
  };
}

/**
 * Re-derive the correct screen from the current room state.
 * Called when the tab becomes visible again or after reconnection
 * to ensure the client is on the right screen.
 */
function resyncFromRoomState() {
  if (!_room || !_room.state) return;
  const room = _room;
  const phase = room.state.phase;
  const state = getState();

  if (phase === 'lobby') {
    if (state.screen !== 'online-lobby') {
      setState({ screen: 'online-lobby', onlinePlayers: syncPlayersFromRoom(room) });
      if (_onScreenChange) _onScreenChange('online-lobby');
    }
    return;
  }

  if (phase === 'die_phase') {
    const dieState = syncDiePhaseState(room);
    setState({ phase: 1, ...dieState });
    if (_onScreenChange) _onScreenChange('phase1');
    return;
  }

  const livingBye = ['living_submit', 'living_convince', 'living_select', 'living_winner',
                     'bye_submit', 'bye_convince', 'bye_select', 'bye_winner'];
  if (livingBye.includes(phase)) {
    const lbState = syncLivingPhaseState(room);
    const phaseNum = phase.startsWith('living') ? 2 : 3;
    setState({ phase: phaseNum, screen: lbState.screenName, ...lbState });

    if (lbState.onlinePhase === 'submit' && !lbState.isLivingDead) {
      clearPitchTimer();
      startPlayCardTimer();
    } else if (lbState.onlinePhase === 'convince') {
      clearPlayCardTimer();
      startPitchTimer();
    } else {
      clearAllTimers();
    }
    if (_onScreenChange) _onScreenChange(lbState.screenName);
    return;
  }

  const eulogyPhases = ['eulogy_intro', 'eulogy_pick', 'eulogy_speech', 'eulogy_judge', 'eulogy_points', 'winner'];
  if (eulogyPhases.includes(phase)) {
    clearAllTimers();
    const eulogyState = syncEulogyPhaseState(room);
    setState({ phase: 4, screen: 'phase4', ...eulogyState });
    if (_onScreenChange) _onScreenChange('phase4');
    return;
  }

  if (phase === 'game_over') {
    const players = buildPlayersFromOnline(room);
    setState({ onlinePhase: 'game_over', players, phaseComplete: true });
    if (_onScreenChange) _onScreenChange(state.screen);
  }
}

// Resync when the tab becomes visible again
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && _room) {
    console.log('[client] Tab became visible — resyncing from room state');
    resyncFromRoomState();
  }
});

function setupRoomListeners(room, onUpdate) {
  const $ = window.Colyseus.getStateCallbacks(room);

  if (!room.state) {
    room.onStateChange.once(() => setupRoomListeners(room, onUpdate));
    return;
  }

  // Listen for room code changes on root state
  $(room.state).listen('roomCode', (value) => {
    setState({ roomCode: value });
    if (onUpdate) onUpdate(syncPlayersFromRoom(room));
  });

  // Listen for game settings changes (synced from server to local gameSettings)
  const settingKeys = [
    'rounds', 'handSize', 'enableDie', 'enableLive', 'enableBye', 'enableEulogy',
    'forceWildcards', 'playableWildcards', 'wildcardCount', 'eulogistCount',
    'handRedraws', 'timerEnabled', 'pitchTimerEnabled', 'playCardTimerEnabled',
    'timerCountUp', 'pitchDuration', 'timerVisible', 'timerAutoAdvance',
    'ultraQuickMode', 'optionalCardPlay',
  ];
  for (const key of settingKeys) {
    $(room.state).listen(key, (value) => {
      const state = getState();
      setState({ gameSettings: { ...state.gameSettings, [key]: value } });
      if (state.screen === 'online-lobby' && _onSettingsChange) _onSettingsChange();
    });
  }

  // Listen for autoStartOnReady changes
  $(room.state).listen('autoStartOnReady', (value) => {
    const state = getState();
    setState({ onlineSettings: { ...state.onlineSettings, autoStartOnReady: value } });
    if (state.screen === 'online-lobby' && _onSettingsChange) _onSettingsChange();
  });

  // Listen for game phase changes
  $(room.state).listen('phase', (phase) => {
    const state = getState();
    if (phase === 'die_phase' && state.screen !== 'phase1') {
      // Transition to Phase 1 screen
      const dieState = syncDiePhaseState(room);
      setState({
        phase: 1,
        phaseComplete: false,
        playerDieCards: {},
        ...dieState,
      });
      if (_onScreenChange) _onScreenChange('phase1');
    } else if (phase !== 'die_phase' && phase !== 'lobby' && state.screen === 'phase1') {
      // Store the last player's die card before transitioning
      if (state.currentCard && state.players?.[state.currentPlayerIndex]) {
        const lastPlayerName = state.players[state.currentPlayerIndex].name;
        const playerDieCards = { ...(state.playerDieCards ?? {}), [lastPlayerName]: state.currentCard };
        setState({ playerDieCards });
      }
      // Die phase ended — show completion
      setState({ phaseComplete: true, turnStatus: 'idle' });
      if (_onScreenChange) _onScreenChange('phase1');
    }

    // Living / Bye phase transitions
    const livingBye = ['living_submit', 'living_convince', 'living_select', 'living_winner',
                       'bye_submit', 'bye_convince', 'bye_select', 'bye_winner'];
    if (livingBye.includes(phase)) {
      const lbState = syncLivingPhaseState(room);
      const phaseNum = phase.startsWith('living') ? 2 : 3;
      console.log(`[client] Phase transition: ${phase} → onlinePhase=${lbState.onlinePhase}, winner=${lbState.roundWinner}, card=${lbState.roundWinnerCard?.id}`);
      setState({
        phase: phaseNum,
        screen: lbState.screenName,
        ...lbState,
      });

      // Start/stop timers based on phase
      if (lbState.onlinePhase === 'submit' && !lbState.isLivingDead) {
        clearPitchTimer();
        startPlayCardTimer();
      } else if (lbState.onlinePhase === 'convince') {
        clearPlayCardTimer();
        startPitchTimer();
      } else {
        clearAllTimers();
      }

      if (_onScreenChange) _onScreenChange(lbState.screenName);
    }

    // Eulogy / Winner phase transitions
    const eulogyPhases = ['eulogy_intro', 'eulogy_pick', 'eulogy_speech', 'eulogy_judge', 'eulogy_points', 'winner'];
    if (eulogyPhases.includes(phase)) {
      clearAllTimers();
      const eulogyState = syncEulogyPhaseState(room);
      console.log(`[client] Eulogy phase transition: ${phase} → phase4SubState=${eulogyState.phase4SubState}`);
      setState({
        phase: 4,
        screen: 'phase4',
        ...eulogyState,
      });
      if (_onScreenChange) _onScreenChange('phase4');
    }

    // Save online game result to localStorage when game ends
    if (phase === 'winner') {
      try {
        const players = buildPlayersFromOnline(room);
        const sorted = [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        saveGameToHistory({
          mode: 'online',
          rounds: room.state.rounds || 1,
          players: sorted,
          synced: true,  // Server already saved it
        });
      } catch (err) {
        console.warn('[client] Failed to save online game to history:', err);
      }
    }

    if (phase === 'game_over') {
      const players = buildPlayersFromOnline(room);
      setState({ onlinePhase: 'game_over', players, phaseComplete: true });
      if (_onScreenChange) _onScreenChange(getState().screen);
    }
  });

  // Listen for current turn changes (advances during die phase)
  $(room.state).listen('currentTurn', () => {
    const state = getState();
    if (room.state.phase === 'die_phase' && state.screen === 'phase1') {
      // Store the previous player's die card before advancing
      if (state.currentCard && state.players?.[state.currentPlayerIndex]) {
        const prevPlayerName = state.players[state.currentPlayerIndex].name;
        const playerDieCards = { ...(state.playerDieCards ?? {}), [prevPlayerName]: state.currentCard };
        setState({ playerDieCards });
      }

      const dieState = syncDiePhaseState(room);
      setState(dieState);
      if (_onScreenChange) _onScreenChange('phase1');
    }
  });

  // Listen for convincing turn changes (living/bye convince phase)
  $(room.state).listen('convincingTurn', () => {
    const state = getState();
    if (state.onlinePhase === 'convince') {
      const lbState = syncLivingPhaseState(room);
      setState(lbState);
      // Restart pitch timer for new convincer
      startPitchTimer();
      if (_onScreenChange) _onScreenChange(state.screen);
    }
  });

  // Listen for round winner changes (winner announcement phase)
  $(room.state).listen('roundWinner', () => {
    const state = getState();
    if (state.onlinePhase) {
      const lbState = syncLivingPhaseState(room);

      // Track chosen cards for Living Dead profile display
      if (lbState.roundWinnerCard && lbState.onlinePhase === 'winner') {
        const livingDeadPlayer = room.state.players.get(room.state.currentLivingDead);
        const livingDeadName = livingDeadPlayer?.name ?? '';
        if (livingDeadName) {
          const existing = state.playerChosenCards ?? {};
          const playerCards = existing[livingDeadName] ?? [];
          const deckType = room.state.phase.startsWith('living') ? 'live' : 'bye';
          lbState.playerChosenCards = {
            ...existing,
            [livingDeadName]: [...playerCards, { ...lbState.roundWinnerCard, deckType }],
          };
        }
      }

      setState(lbState);
      if (_onScreenChange) _onScreenChange(state.screen);
    }
  });

  // Listen for eulogy state changes
  $(room.state).listen('currentEulogistIndex', () => {
    const eulogyPhases = ['eulogy_intro', 'eulogy_pick', 'eulogy_speech', 'eulogy_judge', 'eulogy_points', 'winner'];
    if (eulogyPhases.includes(room.state.phase)) {
      const eulogyState = syncEulogyPhaseState(room);
      setState(eulogyState);
      if (_onScreenChange) _onScreenChange('phase4');
    }
  });

  $(room.state).listen('bestEulogist', () => {
    const eulogyPhases = ['eulogy_intro', 'eulogy_pick', 'eulogy_speech', 'eulogy_judge', 'eulogy_points', 'winner'];
    if (eulogyPhases.includes(room.state.phase)) {
      const eulogyState = syncEulogyPhaseState(room);
      setState(eulogyState);
      if (_onScreenChange) _onScreenChange('phase4');
    }
  });

  $(room.state).listen('currentWildcardPlayer', () => {
    const eulogyPhases = ['eulogy_intro', 'eulogy_pick', 'eulogy_speech', 'eulogy_judge', 'eulogy_points', 'winner'];
    if (eulogyPhases.includes(room.state.phase)) {
      const eulogyState = syncEulogyPhaseState(room);
      setState(eulogyState);
      if (_onScreenChange) _onScreenChange('phase4');
    }
  });

  $(room.state.selectedEulogists).onAdd(() => {
    const eulogyPhases = ['eulogy_pick'];
    if (eulogyPhases.includes(room.state.phase)) {
      const eulogyState = syncEulogyPhaseState(room);
      setState(eulogyState);
      if (_onScreenChange) _onScreenChange('phase4');
    }
  });

  $(room.state.selectedEulogists).onRemove(() => {
    const eulogyPhases = ['eulogy_pick'];
    if (eulogyPhases.includes(room.state.phase)) {
      const eulogyState = syncEulogyPhaseState(room);
      setState(eulogyState);
      if (_onScreenChange) _onScreenChange('phase4');
    }
  });

  // Listen for submitted cards changes
  $(room.state.submittedCards).onAdd((card) => {
    const state = getState();
    if (state.onlinePhase) {
      const lbState = syncLivingPhaseState(room);
      setState(lbState);
      if (_onScreenChange) _onScreenChange(state.screen);
    }
    // Listen for faceUp changes on submitted cards (reveal during convince)
    $(card).listen('faceUp', () => {
      const s = getState();
      if (s.onlinePhase) {
        const updated = syncLivingPhaseState(room);
        setState(updated);
        if (_onScreenChange) _onScreenChange(s.screen);
      }
    });
  });

  // Players map might not exist yet — guard
  if (!room.state.players) return;

  // Listen for player additions
  $(room.state.players).onAdd((player, sessionId) => {
    const updated = syncPlayersFromRoom(room);
    setState({ onlinePlayers: updated });
    if (onUpdate) onUpdate(updated);

    // Listen for changes on individual players
    $(player).onChange(() => {
      const refreshed = syncPlayersFromRoom(room);
      setState({ onlinePlayers: refreshed });
      if (onUpdate) onUpdate(refreshed);

      // Re-sync phase state when player properties change (e.g. hasSubmitted, score)
      const s = getState();
      const eulogyPhases = ['eulogy_intro', 'eulogy_pick', 'eulogy_speech', 'eulogy_judge', 'eulogy_points', 'winner'];
      if (eulogyPhases.includes(room.state.phase)) {
        const eulogyState = syncEulogyPhaseState(room);
        setState(eulogyState);
        if (_onScreenChange) _onScreenChange('phase4');
      } else if (s.onlinePhase) {
        const lbState = syncLivingPhaseState(room);
        setState(lbState);
        if (_onScreenChange) _onScreenChange(s.screen);
      }
    });

    // Listen for card changes in player's hand
    if (player.hand) {
      $(player.hand).onAdd((card) => {
        $(card).listen('faceUp', () => {
          const state = getState();
          if (room.state.phase === 'die_phase' && state.screen === 'phase1') {
            const dieState = syncDiePhaseState(room);
            setState(dieState);
            if (_onScreenChange) _onScreenChange('phase1');
          }
        });

        // Re-sync hand when cards are added during living/bye phases
        const s = getState();
        if (s.onlinePhase && sessionId === s.mySessionId) {
          const lbState = syncLivingPhaseState(room);
          setState(lbState);
          if (_onScreenChange) _onScreenChange(s.screen);
        }
      });
    }
  });

  // Listen for player removals
  $(room.state.players).onRemove(() => {
    const updated = syncPlayersFromRoom(room);
    setState({ onlinePlayers: updated });
    if (onUpdate) onUpdate(updated);
  });

  // Room lifecycle events
  room.onLeave(async (code) => {
    // Code 1000 = intentional leave (e.g. leaveRoom()), don't reconnect
    if (code === 1000 || _reconnecting) {
      setState({ connectionStatus: 'disconnected', onlineError: null });
      _room = null;
      return;
    }

    console.log(`[client] Unexpected disconnect (code: ${code}), attempting reconnect...`);
    setState({ connectionStatus: 'reconnecting', onlineError: null });
    _reconnecting = true;

    // Attempt reconnection using Colyseus SDK's built-in reconnect
    // The SDK stores the reconnection token internally
    try {
      const client = await getColyseusClient();
      const reconnectedRoom = await client.reconnect(room.reconnectionToken);
      _room = reconnectedRoom;
      _reconnecting = false;

      await waitForState(reconnectedRoom);

      setState({
        connectionStatus: 'connected',
        onlinePlayers: syncPlayersFromRoom(reconnectedRoom),
        mySessionId: reconnectedRoom.sessionId,
      });
      setupRoomListeners(reconnectedRoom, _lastOnUpdate);
      resyncFromRoomState();
      console.log('[client] Reconnected successfully');
    } catch (err) {
      console.log(`[client] Reconnection failed: ${err.message}`);
      _reconnecting = false;
      _room = null;
      setState({
        connectionStatus: 'disconnected',
        onlineError: `Disconnected — could not reconnect`,
      });
    }
  });

  room.onError((code, message) => {
    setState({ onlineError: message || `Room error (${code})` });
  });
}

function waitForState(room) {
  return new Promise((resolve) => {
    if (room.state?.players?.forEach) {
      resolve();
      return;
    }
    let resolved = false;
    const done = () => { if (!resolved) { resolved = true; resolve(); } };
    room.onStateChange.once(done);
    const interval = setInterval(() => {
      if (room.state?.players?.forEach) {
        clearInterval(interval);
        done();
      }
    }, 50);
    setTimeout(() => { clearInterval(interval); done(); }, 3000);
  });
}

/** Sync initial game settings from the server room state */
function syncGameSettingsFromRoom(room) {
  const keys = [
    'rounds', 'handSize', 'enableDie', 'enableLive', 'enableBye', 'enableEulogy',
    'forceWildcards', 'playableWildcards', 'wildcardCount', 'eulogistCount',
    'handRedraws', 'timerEnabled', 'pitchTimerEnabled', 'playCardTimerEnabled',
    'timerCountUp', 'pitchDuration', 'timerVisible', 'timerAutoAdvance',
    'ultraQuickMode', 'optionalCardPlay',
  ];
  const settings = {};
  for (const key of keys) {
    if (room.state[key] !== undefined) {
      settings[key] = room.state[key];
    }
  }
  return settings;
}

export async function createRoom({ name, birthMonth, birthDay, isPrivate = true, isDevName = false }, onUpdate) {
  setState({ connectionStatus: 'connecting', onlineError: null });
  try {
    const client = await getColyseusClient();
    const room = await client.create('game', {
      name,
      birthMonth: birthMonth || 0,
      birthDay: birthDay || 0,
      private: isPrivate,
      isDevName,
    });
    _room = room;

    await waitForState(room);

    const state = getState();
    setState({
      connectionStatus: 'connected',
      isHost: true,
      roomCode: room.state?.roomCode || null,
      gameMode: 'online',
      onlinePlayers: syncPlayersFromRoom(room),
      mySessionId: room.sessionId,
      gameSettings: { ...state.gameSettings, ...syncGameSettingsFromRoom(room) },
    });
    _lastOnUpdate = onUpdate;
    setupRoomListeners(room, onUpdate);
    return room;
  } catch (err) {
    setState({
      connectionStatus: 'disconnected',
      onlineError: err.message || 'Failed to create room',
    });
    throw err;
  }
}

export async function joinRoom(code, { name, birthMonth, birthDay, isDevName = false }, onUpdate) {
  setState({ connectionStatus: 'connecting', onlineError: null });
  try {
    await loadConfig();
    const lookupUrl = `${_restBaseUrl}/api/carkedit/rooms/lookup?code=${encodeURIComponent(code.toUpperCase())}`;
    const res = await fetch(lookupUrl);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Room not found (${res.status})`);
    }
    const { roomId } = await res.json();

    const client = await getColyseusClient();
    const room = await client.joinById(roomId, {
      name,
      birthMonth: birthMonth || 0,
      birthDay: birthDay || 0,
      isDevName,
    });
    _room = room;

    await waitForState(room);

    const state = getState();
    setState({
      connectionStatus: 'connected',
      isHost: false,
      roomCode: code.toUpperCase(),
      gameMode: 'online',
      onlinePlayers: syncPlayersFromRoom(room),
      mySessionId: room.sessionId,
      gameSettings: { ...state.gameSettings, ...syncGameSettingsFromRoom(room) },
    });
    _lastOnUpdate = onUpdate;
    setupRoomListeners(room, onUpdate);
    return room;
  } catch (err) {
    setState({
      connectionStatus: 'disconnected',
      onlineError: err.message || 'Failed to join room',
    });
    throw err;
  }
}

export async function leaveRoom() {
  clearAllTimers();
  if (_room) {
    await _room.leave();
    _room = null;
  }
  setState({
    connectionStatus: 'disconnected',
    isHost: false,
    roomCode: null,
    gameMode: 'local',
    onlinePlayers: [],
    onlineError: null,
    mySessionId: null,
  });
}

export function getRoom() {
  return _room;
}

export function getSessionId() {
  return _room?.sessionId ?? null;
}

export function sendMessage(type, data) {
  if (_room) {
    _room.send(type, data);
  }
}

/** Register a callback for screen changes triggered by server state */
export function onScreenChange(callback) {
  _onScreenChange = callback;
}

/** Register a callback for game settings changes from the server */
export function onSettingsChange(callback) {
  _onSettingsChange = callback;
}
