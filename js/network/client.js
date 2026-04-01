// CarkedIt Online — Colyseus Network Client (SDK 0.17)
'use strict';

import { getState, setState } from '../state.js';

const DEFAULT_SERVER_URL = 'ws://localhost:4500';
const REST_BASE_URL = 'http://localhost:4500';

let _client = null;
let _room = null;

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

function setupRoomListeners(room, onUpdate) {
  // Colyseus 0.17 uses getStateCallbacks for state change listeners
  const $ = window.Colyseus.getStateCallbacks(room);

  // Wait for state to be ready before setting up listeners
  if (!room.state) {
    room.onStateChange.once(() => setupRoomListeners(room, onUpdate));
    return;
  }

  // Listen for room code changes on root state
  $(room.state).listen('roomCode', (value) => {
    setState({ roomCode: value });
    if (onUpdate) onUpdate(syncPlayersFromRoom(room));
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
  });

  // Listen for player removals
  $(room.state.players).onRemove(() => {
    const updated = syncPlayersFromRoom(room);
    setState({ onlinePlayers: updated });
    if (onUpdate) onUpdate(updated);
  });

  // Room lifecycle events (not state callbacks — these are on Room directly)
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
    room.onStateChange.once(() => resolve());
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

    // Wait for first state sync so players/roomCode are available
    await waitForState(room);

    setState({
      connectionStatus: 'connected',
      isHost: true,
      roomCode: room.state?.roomCode || null,
      gameMode: 'online',
      onlinePlayers: syncPlayersFromRoom(room),
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
    // Look up room ID by code via REST endpoint
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

    // Wait for first state sync so players are available
    await waitForState(room);

    setState({
      connectionStatus: 'connected',
      isHost: false,
      roomCode: code.toUpperCase(),
      gameMode: 'online',
      onlinePlayers: syncPlayersFromRoom(room),
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
  });
}

export function getRoom() {
  return _room;
}

export function getSessionId() {
  return _room?.sessionId ?? null;
}
