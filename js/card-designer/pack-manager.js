'use strict';

const API_BASE = `${window.location.origin}/api/carkedit`;

export async function getOrCreateLocalUser() {
  let userId = localStorage.getItem('carkedit-user-id');
  if (userId) return userId;

  const res = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ display_name: 'Anonymous Creator' }),
  });
  if (!res.ok) throw new Error('Failed to create user');
  const user = await res.json();
  localStorage.setItem('carkedit-user-id', user.id);
  return user.id;
}

export async function fetchMyPacks(userId) {
  const res = await fetch(`${API_BASE}/packs?creator_id=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error('Failed to fetch packs');
  const data = await res.json();
  return data.packs;
}

export async function createPack(creatorId, title, description) {
  const res = await fetch(`${API_BASE}/packs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
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
  });
  if (!res.ok) throw new Error('Failed to delete pack');
  return true;
}

export async function addCards(packId, cards) {
  const res = await fetch(`${API_BASE}/packs/${encodeURIComponent(packId)}/cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    },
  );
  if (!res.ok) throw new Error('Failed to update card');
  return res.json();
}

export async function deleteCard(packId, cardId) {
  const res = await fetch(
    `${API_BASE}/packs/${encodeURIComponent(packId)}/cards/${encodeURIComponent(cardId)}`,
    { method: 'DELETE' },
  );
  if (!res.ok) throw new Error('Failed to delete card');
  return true;
}
