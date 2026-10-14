// CarkedIt Online — Video Call Details: platform detection & invite parsing
//
// Pure and DOM-free so it can be unit-tested under `npm run test:unit`.
//
// The host pastes a raw invite (the whole Zoom email, a Meet blurb, a bare
// dial-in) and parseVideoCallText splits it into structured entries:
//
//   link  — a join URL, rendered as a "Join Zoom" button
//   phone — a dial string, rendered as a pressable tel: button
//   code  — a meeting ID / passcode / PIN, rendered as a copyable row
//
// Whatever text is left over becomes the free-text instructions. Everything is
// re-validated server-side in carkedit-api/src/utils/videoCall.ts — this module
// is a convenience for the host, not a security boundary.
'use strict';

export const MAX_ENTRIES = 8;
export const MAX_NOTES_LENGTH = 1000;

/**
 * Platform registry. `hosts` are matched against the URL hostname (exact or as
 * a suffix, so `us02web.zoom.us` matches `zoom.us`); `paths` further narrow a
 * shared host. Kept in sync with PLATFORM_SLUGS in the API's videoCall.ts.
 */
export const PLATFORMS = [
  { slug: 'zoom',        name: 'Zoom',            verb: 'Join',  hosts: ['zoom.us', 'zoomgov.com'] },
  { slug: 'google-meet', name: 'Google Meet',     verb: 'Join',  hosts: ['meet.google.com', 'g.co'] },
  { slug: 'teams',       name: 'Microsoft Teams', verb: 'Join',  hosts: ['teams.microsoft.com', 'teams.live.com'] },
  { slug: 'discord',     name: 'Discord',         verb: 'Open',  hosts: ['discord.gg', 'discord.com', 'discordapp.com'] },
  { slug: 'whatsapp',    name: 'WhatsApp',        verb: 'Open',  hosts: ['chat.whatsapp.com', 'call.whatsapp.com', 'wa.me', 'whatsapp.com'] },
  { slug: 'facetime',    name: 'FaceTime',        verb: 'Join',  hosts: ['facetime.apple.com'] },
  { slug: 'webex',       name: 'Webex',           verb: 'Join',  hosts: ['webex.com'] },
  { slug: 'skype',       name: 'Skype',           verb: 'Join',  hosts: ['skype.com'] },
  { slug: 'jitsi',       name: 'Jitsi Meet',      verb: 'Join',  hosts: ['meet.jit.si', 'jit.si', '8x8.vc'] },
  { slug: 'whereby',     name: 'Whereby',         verb: 'Join',  hosts: ['whereby.com'] },
  { slug: 'messenger',   name: 'Messenger',       verb: 'Open',  hosts: ['m.me', 'messenger.com'] },
  { slug: 'telegram',    name: 'Telegram',        verb: 'Open',  hosts: ['t.me', 'telegram.me'] },
  { slug: 'signal',      name: 'Signal',          verb: 'Open',  hosts: ['signal.group', 'signal.me'] },
  { slug: 'slack',       name: 'Slack',           verb: 'Open',  hosts: ['slack.com'] },
  { slug: 'gotomeeting', name: 'GoTo Meeting',    verb: 'Join',  hosts: ['gotomeet.me', 'gotomeeting.com'] },
  { slug: 'phone',       name: 'Conference Call', verb: 'Call',  hosts: [] },
  { slug: 'other',       name: 'Video Call',      verb: 'Join',  hosts: [] },
];

export const PLATFORM_SLUGS = PLATFORMS.map((p) => p.slug);

const BY_SLUG = new Map(PLATFORMS.map((p) => [p.slug, p]));

/** Registry entry for a slug, falling back to the generic "other" platform. */
export function getPlatform(slug) {
  return BY_SLUG.get(slug) ?? BY_SLUG.get('other');
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** @returns {string} platform slug for a URL — "other" when nothing matches. */
export function detectPlatform(url) {
  const host = hostnameOf(url);
  if (!host) return 'other';
  for (const p of PLATFORMS) {
    for (const h of p.hosts) {
      if (host === h || host.endsWith(`.${h}`)) return p.slug;
    }
  }
  return 'other';
}

/** http/https only — mirrors the server-side check so bad links never render. */
export function isSafeLink(value) {
  try {
    const { protocol } = new URL(String(value).trim());
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/** Rebuilds a `tel:` href from the dial characters a phone app understands. */
export function toDialHref(value) {
  const cleaned = String(value ?? '').replace(/[^0-9+,;#*]/g, '');
  return cleaned ? `tel:${cleaned}` : '';
}

/** Default button/row label when the host hasn't set one. */
export function defaultLabel(entry) {
  if (!entry) return '';
  if (entry.kind === 'phone') return 'Dial-in';
  if (entry.kind === 'code') return 'Code';
  const p = getPlatform(entry.platform);
  return `${p.verb} ${p.name}`;
}

// ── Parsing ────────────────────────────────────────────

// Trailing punctuation is almost always sentence punctuation, not part of the URL.
const URL_RE = /\bhttps?:\/\/[^\s<>"'`]+/gi;
const TEL_RE = /\btel:([+0-9][0-9+\-().,;#*\s]{5,30})/gi;

// Scheme-less links, but only for hosts we recognise — a general bare-domain
// regex would swallow ordinary prose.
const BARE_HOST_RE = new RegExp(
  `\\b((?:[a-z0-9-]+\\.)*(?:${PLATFORMS.flatMap((p) => p.hosts)
    .map((h) => h.replace(/\./g, '\\.'))
    .join('|')})\\/[^\\s<>"'\`]+)`,
  'gi',
);

const CODE_LABELS = [
  [/\bmeeting\s*(?:id|number)\b/i, 'Meeting ID'],
  [/\bconference\s*(?:id|code)\b/i, 'Conference ID'],
  [/\baccess\s*code\b/i, 'Access code'],
  [/\bpass\s*code\b|\bpassword\b/i, 'Passcode'],
  [/\bpin\b/i, 'PIN'],
  [/\broom\s*code\b/i, 'Room code'],
];
const CODE_RE = /\b(meeting\s*(?:id|number)|conference\s*(?:id|code)|access\s*code|pass\s*code|passcode|password|pin|room\s*code)\b\s*[:#]?\s*([0-9A-Za-z][0-9A-Za-z\- ]{2,30}?)(?=\s*(?:[,.;)|#]|$))/gi;

const INTL_PHONE_RE = /\+\d[\d\s\-().]{5,24}(?:\s*,{1,3}\s*[\d#*]{2,20})?/g;
const LOCAL_PHONE_RE = /\(?\b\d{2,4}\)?[\s.-]\d{3,4}[\s.-]\d{3,4}\b(?:\s*,{1,3}\s*[\d#*]{2,20})?/g;
// Local (non-`+`) numbers only count on a line that says it's a phone number,
// so a bare "812 3456 7890" meeting ID isn't turned into a dial button.
const DIAL_HINT_RE = /\b(dial|phone|call\s*in|one\s*tap|toll|mobile|landline|tel)\b/i;

// Lines that carry no information once their link/number has been lifted out.
const BOILERPLATE_RE = /^(?:[-—–_=*•.,:;|>]+|(?:.{0,20}\bis inviting you to a scheduled zoom meeting\b.*)|(?:join\s+(?:zoom\s+meeting|the\s+meeting|by\s+phone|with\s+google\s+meet|conference\s+call)?)|(?:one\s*tap\s*mobile)|(?:dial\s*by\s*your\s*location)|(?:or\s*dial(?:\s*in)?)|(?:find\s*your\s*local\s*number)|(?:more\s*phone\s*numbers)|(?:google\s*meet\s*joining\s*info)|(?:video\s*call\s*link)|(?:meeting\s*link)|(?:click\s*here\s*to\s*join(?:\s*the\s*meeting)?)|(?:\(us\)|\(au\)|\(uk\))|(?:phone\s*numbers?))\s*[:.]?\s*$/i;

function pushEntry(entries, seen, entry) {
  const key = `${entry.kind}:${entry.value.toLowerCase().replace(/\s+/g, '')}`;
  if (seen.has(key)) return;
  seen.add(key);
  entries.push(entry);
}

function trimUrl(raw) {
  return raw.replace(/[).,;:!?\]}>'"]+$/, '');
}

// Links that are lookup pages rather than the meeting itself — "Find your
// local number" would otherwise become a second, misleading "Join Zoom" button.
const LINK_NOISE_RE = /\b(find\s*your\s*local\s*number|more\s*phone\s*numbers|international\s*numbers|unsubscribe|privacy\s*policy)\b/i;

function extractLinks(line, entries, seen) {
  let rest = line;
  const discard = LINK_NOISE_RE.test(line);
  const take = (re, prefix = '') => {
    rest = rest.replace(re, (match) => {
      const url = trimUrl(prefix ? `${prefix}${match}` : match);
      if (discard || !isSafeLink(url)) return ' ';
      const platform = detectPlatform(url);
      pushEntry(entries, seen, { kind: 'link', platform, value: url, label: '' });
      return ' ';
    });
  };
  take(URL_RE);
  take(BARE_HOST_RE, 'https://');
  return rest;
}

/** Zoom puts the meeting ID in the join URL — surface it as its own copy row. */
function deriveZoomMeetingId(entries, seen) {
  const zoom = entries.find((e) => e.kind === 'link' && e.platform === 'zoom');
  if (!zoom) return;
  if (entries.some((e) => e.kind === 'code' && /meeting id/i.test(e.label))) return;
  const m = /\/j\/(\d{9,12})/.exec(zoom.value);
  if (!m) return;
  const digits = m[1];
  const spaced = digits.length === 11
    ? `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`
    : digits.length === 10
      ? `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
      : digits;
  pushEntry(entries, seen, { kind: 'code', platform: 'zoom', value: spaced, label: 'Meeting ID' });
}

function labelForCode(word) {
  for (const [re, label] of CODE_LABELS) {
    if (re.test(word)) return label;
  }
  return 'Code';
}

function extractCodes(line, entries, seen) {
  return line.replace(CODE_RE, (match, word, value) => {
    const cleaned = String(value).replace(/[^0-9A-Za-z \-]/g, '').replace(/\s+/g, ' ').trim();
    if (!cleaned || cleaned.length > 64) return ' ';
    pushEntry(entries, seen, {
      kind: 'code', platform: 'other', value: cleaned, label: labelForCode(word),
    });
    return ' ';
  });
}

function cleanPhone(raw) {
  const cleaned = String(raw).replace(/[^0-9+\s\-().,;#*]/g, '').replace(/\s+/g, ' ').trim()
    .replace(/[\s\-.,;]+$/, '');
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 24) return null;
  return cleaned;
}

function extractPhones(line, entries, seen) {
  let rest = line;
  const add = (raw) => {
    const value = cleanPhone(raw);
    if (!value) return false;
    pushEntry(entries, seen, { kind: 'phone', platform: 'phone', value, label: '' });
    return true;
  };

  rest = rest.replace(TEL_RE, (match, number) => (add(number) ? ' ' : ' '));
  rest = rest.replace(INTL_PHONE_RE, (match) => (add(match) ? ' ' : match));
  if (DIAL_HINT_RE.test(line)) {
    rest = rest.replace(LOCAL_PHONE_RE, (match) => (add(match) ? ' ' : match));
  }
  return rest;
}

/**
 * A short remainder beside a number is usually its region ("US (Tacoma)",
 * "Australia") — good enough to label the dial button with.
 */
function labelPhonesFromLine(line, entries, before) {
  const added = entries.slice(before).filter((e) => e.kind === 'phone' && !e.label);
  if (added.length !== 1) return false;
  const hint = line
    .replace(DIAL_HINT_RE, ' ')
    .replace(/[^A-Za-z0-9()\/ -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!hint || hint.length > 24 || !/[A-Za-z]{2}/.test(hint)) return false;
  added[0].label = hint;
  return true; // consumed — don't repeat it in the instructions
}

function cleanLeftover(text) {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';
  if (BOILERPLATE_RE.test(trimmed)) return '';
  // A remainder of pure punctuation/parens once its number was lifted out.
  if (!/[A-Za-z0-9]/.test(trimmed)) return '';
  return trimmed;
}

/**
 * Splits a pasted invite into structured entries plus leftover instructions.
 *
 * Order matters: links first, then labelled codes, then phone numbers — so a
 * "Meeting ID: 812 3456 7890" is claimed as a code before the phone matcher
 * ever sees those digits.
 *
 * @param {string} text
 * @returns {{ entries: Array<{kind: string, platform: string, value: string, label: string}>, notes: string }}
 */
export function parseVideoCallText(text) {
  if (typeof text !== 'string' || !text.trim()) return { entries: [], notes: '' };

  const entries = [];
  const seen = new Set();
  const noteLines = [];

  for (const rawLine of text.replace(/\r\n/g, '\n').split('\n')) {
    const before = entries.length;
    let rest = extractLinks(rawLine, entries, seen);
    rest = extractCodes(rest, entries, seen);
    rest = extractPhones(rest, entries, seen);
    const usedAsLabel = labelPhonesFromLine(rest, entries, before);

    // A line is never kept in half. If nothing meaningful survives extraction
    // it's dropped; if real prose survives, the ORIGINAL line is kept, link and
    // number included — cutting them out of a sentence ("Hop on around 7pm, or
    // call me on if you get stuck") reads as nonsense. The duplication is
    // deliberate: the buttons are for tapping, the sentence is for reading.
    const survives = !usedAsLabel && cleanLeftover(rest) !== '';
    noteLines.push(survives ? rawLine.replace(/\s+/g, ' ').trim() : '');
  }

  deriveZoomMeetingId(entries, seen);

  for (const entry of entries) {
    if (!entry.label) entry.label = defaultLabel(entry);
  }

  // Prioritise links and codes over dial-ins when trimming to the cap: a Zoom
  // invite lists a dozen local numbers and they must not crowd out the link.
  const byKind = (kind) => entries.filter((e) => e.kind === kind);
  const ordered = [...byKind('link'), ...byKind('code'), ...byKind('phone')].slice(0, MAX_ENTRIES);

  const notes = noteLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_NOTES_LENGTH);

  return { entries: ordered, notes };
}
