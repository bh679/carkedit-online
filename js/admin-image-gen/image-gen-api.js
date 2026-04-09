// CarkedIt Online — admin-image-gen API wrapper.
//
// Thin Bearer-token fetchers for the three new admin endpoints in
// carkedit-api, plus the existing pack endpoints used by the "Pick from pack"
// tab. The auth token is injected via setAuthTokenGetter() from the shell
// script in admin-image-gen.html — this module does not initialize Firebase
// itself (that's the HTML's job) to keep the bundle lean and avoid coupling
// to the game-wide auth-manager state.
//
// The token getter is stored on a `window` global rather than in module
// scope because the admin page's dynamic import uses a cache-bust query
// string (`?v=…`) while app.js statically imports this module without one.
// Those two URLs resolve to TWO separate module instances in the browser's
// ES-module cache — so a module-scoped `_tokenGetter` written by one
// instance would be invisible to the other, and the API calls would go out
// without an Authorization header. Using `window.__carkedit_...` keeps the
// getter on a single shared surface regardless of how many instances load.

'use strict';

const API_BASE = `${window.location.origin}/api/carkedit`;

const TOKEN_GETTER_KEY = '__carkedItImageGenGetToken';

export function setAuthTokenGetter(fn) {
  window[TOKEN_GETTER_KEY] = fn || null;
}

async function authHeaders() {
  const getter = window[TOKEN_GETTER_KEY];
  const token = typeof getter === 'function' ? await getter() : null;
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
  splitPosition,
  inputImage,
}) {
  const body = {
    providerId,
    cardText,
    cardPrompt,
    deckType,
    style,
    promptOverride,
    options,
  };
  if (splitPosition) body.splitPosition = splitPosition;
  if (inputImage) body.inputImage = inputImage;
  const res = await fetch(`${API_BASE}/image-gen/generate`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  return handleJson(res, 'Image generation failed');
}

/**
 * POST /image-gen/generate-stream — SSE streaming variant of generateImage.
 *
 * Streams progress events during the provider's polling loop so the UI can
 * show a live progress bar and status text. Returns the final result via
 * the 'complete' event (same shape as generateImage's response).
 *
 * @param {object}   params          — same fields as generateImage
 * @param {function} params.onProgress — called with { phase, status, elapsed }
 * @returns {Promise<object>}         — the final generation result
 */
export async function generateImageStream({
  providerId,
  cardText,
  cardPrompt,
  deckType,
  style,
  promptOverride,
  options,
  splitPosition,
  inputImage,
  onProgress,
}) {
  const body = {
    providerId,
    cardText,
    cardPrompt,
    deckType,
    style,
    promptOverride,
    options,
  };
  if (splitPosition) body.splitPosition = splitPosition;
  if (inputImage) body.inputImage = inputImage;

  const res = await fetch(`${API_BASE}/image-gen/generate-stream`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let err = {};
    try { err = await res.json(); } catch {}
    const e = new Error(err.error || 'Image generation failed');
    e.status = res.status;
    throw e;
  }

  // Parse SSE events from the response stream.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE events are separated by double newlines.
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';

    for (const part of parts) {
      if (!part.trim()) continue;
      let eventType = 'message';
      let data = '';
      for (const line of part.split('\n')) {
        if (line.startsWith('event: ')) eventType = line.slice(7).trim();
        else if (line.startsWith('data: ')) data = line.slice(6);
      }
      if (!data) continue;

      let parsed;
      try { parsed = JSON.parse(data); } catch { continue; }

      if (eventType === 'progress' && typeof onProgress === 'function') {
        onProgress(parsed);
      } else if (eventType === 'complete') {
        result = parsed;
      } else if (eventType === 'error') {
        throw new Error(parsed.error || 'Image generation failed');
      }
    }
  }

  if (!result) throw new Error('Stream ended without a result');
  return result;
}

/**
 * GET /image-gen/log — list recent generation log rows, newest first.
 * `scope` accepts 'all' | 'mine' | 'admins' and filters server-side.
 * Returns `[ { id, creator_id, deck_type, text, prompt, card_special,
 * options_json, image_url, image_url_b, provider, prompt_sent,
 * created_at } ]`.
 */
export async function listGenerationLog({ scope = 'all', limit = 50, offset = 0 } = {}) {
  const url = new URL(`${API_BASE}/image-gen/log`);
  url.searchParams.set('scope', scope);
  url.searchParams.set('limit', String(limit));
  if (offset) url.searchParams.set('offset', String(offset));
  const res = await fetch(url, { headers: await authHeaders() });
  const data = await handleJson(res, 'Failed to list generation log');
  return Array.isArray(data?.entries) ? data.entries : [];
}

/**
 * POST /image-gen/log/merge — merge two split-card log entries into one.
 * Folds mergeId's image into keepId's image_url_b, then deletes mergeId.
 */
export async function mergeLogEntries({ keepId, mergeId, updates }) {
  const res = await fetch(`${API_BASE}/image-gen/log/merge`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ keepId, mergeId, updates }),
  });
  return handleJson(res, 'Failed to merge log entries');
}

/**
 * GET /image-gen/style — load the current style JSON from the API.
 *
 * Replaces the previous direct fetch of the static
 * `/js/data/image-gen-style.json` file, which broke on production
 * where the admin page is mounted under a subpath (e.g.
 * `/carkedit-online/`) and the absolute path hit the wrong origin
 * root. The API is now the single source of truth for the style JSON
 * regardless of how the frontend is deployed.
 */
export async function getStyleJson() {
  const res = await fetch(`${API_BASE}/image-gen/style`, {
    headers: await authHeaders(),
  });
  const data = await handleJson(res, 'Failed to load style JSON');
  return (data && typeof data.style === 'object' && data.style !== null)
    ? data.style
    : {};
}

/**
 * POST /image-gen/style — persist the current style JSON to the API's
 * data directory (<api-root>/data/image-gen-style.json). Decoupled
 * from the frontend deploy path, so save always lands in the same
 * place that `getStyleJson()` reads from. Admin-only. Returns
 * `{ ok: true, bytes, path }` on success.
 */
export async function saveStyleJson(style) {
  const res = await fetch(`${API_BASE}/image-gen/style`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ style }),
  });
  return handleJson(res, 'Failed to save style JSON');
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

/**
 * GET /packs — every pack from every creator. Used by the admin
 * image-gen page's Pick-a-Pack dropdown, which iterates across every
 * custom pack regardless of who created it. The admin test tool
 * isn't scoped to a single creator, so no creator_id filter.
 */
export async function listAllPacks() {
  const url = new URL(`${API_BASE}/packs`);
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
