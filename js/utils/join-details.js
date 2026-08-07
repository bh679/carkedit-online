// CarkedIt Online — Join details carried in the invite URL
//
// The desktop join screen steers people to their phone. Without this, that
// handover throws away whatever they'd already typed into "Your Details" and
// they start again on the small screen — so the nudge costs work instead of
// saving it. The QR carries the details across; the phone arrives pre-filled.
//
// Only the join screen's own QR uses this. The host's share panel and the
// copy-link buttons stay detail-free: those go out to a group, and the host's
// name has no business in them.
//
// Pure by design — the base URL is passed in rather than read from `window` —
// so both directions are testable under `node --test`.
'use strict';

/** Short keys keep the encoded URL short, which keeps the QR sparse to scan. */
const PARAM_NAME = 'n';
const PARAM_MONTH = 'bm';
const PARAM_DAY = 'bd';

/** Matches the maxlength on the name input; also caps QR density. */
const MAX_NAME_LENGTH = 24;

/** Coerces to an integer within [min, max], or 0 when it isn't one. */
function clampInt(value, min, max) {
  const n = parseInt(value ?? '', 10);
  return Number.isInteger(n) && n >= min && n <= max ? n : 0;
}

function cleanName(value) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, MAX_NAME_LENGTH);
}

/**
 * Adds the player's details to an invite URL.
 *
 * Blank fields are omitted rather than sent empty, so someone who has typed
 * nothing gets a URL byte-identical to the plain invite.
 *
 * @param {string} baseUrl — an invite URL, e.g. from buildJoinUrl()
 * @param {object} [details]
 * @param {string} [details.name]
 * @param {number|string} [details.birthMonth] — 1-12
 * @param {number|string} [details.birthDay] — 1-31
 * @returns {string} the URL, unchanged when there's nothing to add
 */
export function appendJoinDetails(baseUrl, details = {}) {
  if (typeof baseUrl !== 'string' || baseUrl === '') return '';

  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    return baseUrl;
  }

  const name = cleanName(details.name);
  const month = clampInt(details.birthMonth, 1, 12);
  const day = clampInt(details.birthDay, 1, 31);

  if (name) url.searchParams.set(PARAM_NAME, name);
  if (month) url.searchParams.set(PARAM_MONTH, String(month));
  if (day) url.searchParams.set(PARAM_DAY, String(day));

  return url.toString();
}

/**
 * Reads the details back out on the receiving device.
 *
 * Everything is validated: this arrives from a scanned code, which is data from
 * outside the app and could say anything.
 *
 * @param {string|URLSearchParams} search — a query string or parsed params
 * @returns {{name: string, birthMonth: number, birthDay: number}} zeros/'' when absent
 */
export function parseJoinDetails(search) {
  const params = search instanceof URLSearchParams
    ? search
    : new URLSearchParams(typeof search === 'string' ? search : '');

  return {
    name: cleanName(params.get(PARAM_NAME)),
    birthMonth: clampInt(params.get(PARAM_MONTH), 1, 12),
    birthDay: clampInt(params.get(PARAM_DAY), 1, 31),
  };
}

/** True when any detail is present — i.e. worth pre-filling. */
export function hasJoinDetails(details) {
  return !!(details && (details.name || details.birthMonth || details.birthDay));
}

/**
 * Strips the personal params, keeping everything else.
 *
 * Used to clean the phone's address bar once the details have been consumed:
 * left alone, a name and birthday would sit in browser history and ride along
 * if that person forwarded the link to someone else.
 *
 * @param {string} href — the current URL
 * @returns {string} the URL without n/bm/bd
 */
export function stripJoinDetails(href) {
  if (typeof href !== 'string' || href === '') return '';
  let url;
  try {
    url = new URL(href);
  } catch {
    return href;
  }
  for (const key of [PARAM_NAME, PARAM_MONTH, PARAM_DAY]) url.searchParams.delete(key);
  return url.toString();
}
