// CarkedIt Online — Colyseus Network Client (SDK 0.17)
'use strict';

import { getState, setState } from '../state.js';

const _origin = window.location.origin;
const _isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const DEFAULT_SERVER_URL = _isLocal ? _origin : `${_origin}/colyseus`;
const REST_BASE_URL = _origin;

let _client = null;
let _room = null;
let _onScreenChange = null;

function getColyseusClient() {
  if (_client) return _client;
  if (!window.Colyseus) {
    throw new Error('Colyseus SDK not loaded. Ensure the script tag is in index.html.');
  }
  _client = new window.Colyseus.Client(DEFAULT_SERVER_URL);
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
      // Die phase ended — show completion
      setState({ phaseComplete: true, turnStatus: 'idle' });
      if (_onScreenChange) _onScreenChange('phase1');
    }
  });

  // Listen for current turn changes (advances during die phase)
  $(room.state).listen('currentTurn', () => {
    const state = getState();
    if (room.state.phase === 'die_phase' && state.screen === 'phase1') {
      const dieState = syncDiePhaseState(room);
      setState(dieState);
      if (_onScreenChange) _onScreenChange('phase1');
    }
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
    });

    // Listen for card faceUp changes in player's hand
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
  room.onLeave((code) => {
    setState({
      connectionStatus: 'disconnected',
      onlineError: code === 1000 ? null : `Disconnected (code: ${code})`,
    });
    _room = null;
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

export async function createRoom({ name, birthMonth, birthDay, isPrivate = true }, onUpdate) {
  setState({ connectionStatus: 'connecting', onlineError: null });
  try {
    const client = getColyseusClient();
    const room = await client.create('game', {
      name,
      birthMonth: birthMonth || 0,
      birthDay: birthDay || 0,
      private: isPrivate,
    });
    _room = room;

    await waitForState(room);

    setState({
      connectionStatus: 'connected',
      isHost: true,
      roomCode: room.state?.roomCode || null,
      gameMode: 'online',
      onlinePlayers: syncPlayersFromRoom(room),
      mySessionId: room.sessionId,
    });
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

export async function joinRoom(code, { name, birthMonth, birthDay }, onUpdate) {
  setState({ connectionStatus: 'connecting', onlineError: null });
  try {
    const lookupUrl = `${REST_BASE_URL}/api/carkedit/rooms/lookup?code=${encodeURIComponent(code.toUpperCase())}`;
    const res = await fetch(lookupUrl);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Room not found (${res.status})`);
    }
    const { roomId } = await res.json();

    const client = getColyseusClient();
    const room = await client.joinById(roomId, {
      name,
      birthMonth: birthMonth || 0,
      birthDay: birthDay || 0,
    });
    _room = room;

    await waitForState(room);

    setState({
      connectionStatus: 'connected',
      isHost: false,
      roomCode: code.toUpperCase(),
      gameMode: 'online',
      onlinePlayers: syncPlayersFromRoom(room),
      mySessionId: room.sessionId,
    });
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
