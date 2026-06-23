// CarkedIt Online — Partner-brand ("Evangelist") request API client.
//
// Thin authed-fetch wrappers for the self-serve brand-request flow on the
// account screen. Keeps the router controller free of fetch/FormData plumbing.
// All calls require a Firebase ID token (the endpoints are requireAuth).
'use strict';

import { getAuthToken } from './auth-manager.js';

const apiBase = () => `${window.location.origin}/api/carkedit`;

/**
 * Submit a brand request (multipart: name, slug, optional logo). Returns
 * `{ ok: true, brand }` or `{ ok: false, error }` with the server's message.
 */
export async function submitBrandRequest({ name, slug, logoFile }) {
  const token = await getAuthToken();
  if (!token) return { ok: false, error: 'You must be signed in to apply.' };

  const form = new FormData();
  form.append('name', name);
  form.append('slug', slug);
  if (logoFile) form.append('logo', logoFile);

  try {
    // No Content-Type header — the browser sets the multipart boundary.
    const res = await fetch(`${apiBase()}/brands`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || 'Request failed.' };
    return { ok: true, brand: data };
  } catch (err) {
    return { ok: false, error: 'Network error.' };
  }
}

/** Brands the signed-in user owns — drives the request-status list. */
export async function fetchMyBrands() {
  const token = await getAuthToken();
  if (!token) return [];
  try {
    const res = await fetch(`${apiBase()}/brands/mine`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => ({}));
    return data.brands || [];
  } catch (err) {
    return [];
  }
}

/** Live slug availability → `{ available: boolean, reason?: string }`. */
export async function checkSlugAvailable(slug) {
  const token = await getAuthToken();
  if (!token) return { available: false, reason: 'Sign in to check availability.' };
  try {
    const res = await fetch(`${apiBase()}/brands/slug-available/${encodeURIComponent(slug)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { available: false, reason: 'Could not check availability.' };
    return await res.json();
  } catch (err) {
    return { available: false, reason: 'Could not check availability.' };
  }
}
