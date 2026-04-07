'use strict';

import { getAuthToken } from '../managers/auth-manager.js';

const API_BASE = `${window.location.origin}/api/carkedit`;

async function authHeaders() {
  const token = await getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function fetchMyPacks(userId) {
  const res = await fetch(`${API_BASE}/packs?creator_id=${encodeURIComponent(userId)}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch packs');
  const data = await res.json();
  return data.packs;
}

export async function fetchPublicPacks() {
  const res = await fetch(`${API_BASE}/packs?visibility=public&status=published&limit=100`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch public packs');
  const data = await res.json();
  return data.packs;
}

export async function fetchFavoritePacks() {
  const res = await fetch(`${API_BASE}/packs/favorites`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch favorite packs');
  const data = await res.json();
  return data.packs;
}

export async function setPackFavorite(packId, on) {
  const res = await fetch(`${API_BASE}/packs/${encodeURIComponent(packId)}/favorite`, {
    method: on ? 'POST' : 'DELETE',
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to update favorite');
  return true;
}

export async function setPackOfficial(packId, isOfficial) {
  const res = await fetch(`${API_BASE}/packs/${encodeURIComponent(packId)}/official`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify({ is_official: !!isOfficial }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to set pack official');
  }
  return res.json();
}

export async function createPack(creatorId, title, description) {
  const res = await fetch(`${API_BASE}/packs`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ creator_id: creatorId, title, description }),
  });
  if (!res.ok) throw new Error('Failed to create pack');
  return res.json();
}

export async function getPack(packId) {
  const res = await fetch(`${API_BASE}/packs/${encodeURIComponent(packId)}`);
  if (!res.ok) throw new Error('Failed to fetch pack');
  return res.json();
}

export async function updatePack(packId, updates) {
  const res = await fetch(`${API_BASE}/packs/${encodeURIComponent(packId)}`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update pack');
  }
  return res.json();
}

export async function deletePack(packId) {
  const res = await fetch(`${API_BASE}/packs/${encodeURIComponent(packId)}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete pack');
  return true;
}

export async function addCards(packId, cards) {
  const res = await fetch(`${API_BASE}/packs/${encodeURIComponent(packId)}/cards`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ cards }),
  });
  if (!res.ok) throw new Error('Failed to add cards');
  const data = await res.json();
  return data.cards;
}

export async function updateCard(packId, cardId, updates) {
  const res = await fetch(
    `${API_BASE}/packs/${encodeURIComponent(packId)}/cards/${encodeURIComponent(cardId)}`,
    {
      method: 'PUT',
      headers: await authHeaders(),
      body: JSON.stringify(updates),
    },
  );
  if (!res.ok) throw new Error('Failed to update card');
  return res.json();
}

export async function deleteCard(packId, cardId) {
  const res = await fetch(
    `${API_BASE}/packs/${encodeURIComponent(packId)}/cards/${encodeURIComponent(cardId)}`,
    {
      method: 'DELETE',
      headers: await authHeaders(),
    },
  );
  if (!res.ok) throw new Error('Failed to delete card');
  return true;
}
