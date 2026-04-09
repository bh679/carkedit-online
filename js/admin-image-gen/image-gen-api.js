// CarkedIt Online — admin-image-gen API wrapper.
//
// Thin Bearer-token fetchers for the three new admin endpoints in
// carkedit-api, plus the existing pack endpoints used by the "Pick from pack"
// tab. The auth token is injected via setAuthTokenGetter() from the shell
// script in admin-image-gen.html — this module does not initialize Firebase
// itself (that's the HTML's job) to keep the bundle lean and avoid coupling
// to the game-wide auth-manager state.

'use strict';

const API_BASE = `${window.location.origin}/api/carkedit`;

let _tokenGetter = async () => null;

export function setAuthTokenGetter(fn) {
  _tokenGetter = fn || (async () => null);
}

async function authHeaders() {
  const token = await _tokenGetter();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function handleJson(res, fallbackMsg) {
  if (res.ok) return res.json();
  let err = {};
  try { err = await res.json(); } catch {}
  const e = new Error(err.error || fallbackMsg);
  e.status = res.status;
  throw e;
}

// --- Image-gen endpoints ---

/** GET /image-gen/providers — returns [{id,label,configured}]. */
export async function listProviders() {
  const res = await fetch(`${API_BASE}/image-gen/providers`, {
    headers: await authHeaders(),
  });
  const data = await handleJson(res, 'Failed to list providers');
  return Array.isArray(data?.providers) ? data.providers : [];
}

/**
 * POST /image-gen/generate — returns { imageUrl, provider, promptSent, meta }.
 * Either pass (cardText, cardPrompt, deckType, style) and let the server
 * assemble the prompt, or pass promptOverride to bypass the assembler.
 */
export async function generateImage({
  providerId,
  cardText,
  cardPrompt,
  deckType,
  style,
  promptOverride,
  options,
}) {
  const res = await fetch(`${API_BASE}/image-gen/generate`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      providerId,
      cardText,
      cardPrompt,
      deckType,
      style,
      promptOverride,
      options,
    }),
  });
  return handleJson(res, 'Image generation failed');
}

/**
 * POST /packs/:id/cards/:cardId/image-from-url — server downloads the remote
 * image, writes it to uploads/card-images/, and sets card.image_url. Returns
 * the updated card.
 */
export async function saveImageToCard(packId, cardId, imageUrl) {
  const res = await fetch(
    `${API_BASE}/packs/${encodeURIComponent(packId)}/cards/${encodeURIComponent(cardId)}/image-from-url`,
    {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ imageUrl }),
    }
  );
  return handleJson(res, 'Failed to save image to card');
}

// --- Pack endpoints (read-only reuse for the Pick-from-pack tab) ---

/** GET /packs?creator_id=... — packs owned by the given user. */
export async function listMyPacks(userId) {
  const url = new URL(`${API_BASE}/packs`);
  if (userId) url.searchParams.set('creator_id', userId);
  url.searchParams.set('limit', '200');
  const res = await fetch(url, { headers: await authHeaders() });
  const data = await handleJson(res, 'Failed to list packs');
  return Array.isArray(data?.packs) ? data.packs : [];
}

/** GET /packs/:id — pack with its cards. */
export async function getPackWithCards(packId) {
  const res = await fetch(`${API_BASE}/packs/${encodeURIComponent(packId)}`, {
    headers: await authHeaders(),
  });
  return handleJson(res, 'Failed to load pack');
}
