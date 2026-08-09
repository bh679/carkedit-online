import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOSTED_KEY,
  DISMISS_KEY,
  isFirstHostedGame,
  isDiscordBarDismissed,
  renderFirstHostDiscordBar,
} from './first-host-discord.js';
import { DISCORD_INVITE_URL, DISCORD_PROMPT } from '../config/community.js';

// Under node there is no localStorage, so the guarded helpers report the
// first-time state — which is exactly the state the bar is built for.
const HOST = { isHost: true };
const URL = 'https://discord.gg/testinvite';

// ── Storage helpers ───────────────────────────────────────

test('storage keys are namespaced and distinct', () => {
  assert.equal(HOSTED_KEY, 'carkedit:hasHostedOnline');
  assert.equal(DISMISS_KEY, 'carkedit:discordBarDismissed');
  assert.notEqual(HOSTED_KEY, DISMISS_KEY);
});

test('no storage (node env) reads as first hosted game, not dismissed', () => {
  assert.equal(isFirstHostedGame(), true);
  assert.equal(isDiscordBarDismissed(), false);
});

// ── Visible state ─────────────────────────────────────────

test('renderFirstHostDiscordBar: shows the prompt to a first-time host', () => {
  const html = renderFirstHostDiscordBar(HOST, { url: URL });
  assert.ok(html.includes(DISCORD_PROMPT), 'carries the exact prompt copy');
  assert.ok(html.includes('online-lobby__discord-bar'));
  assert.ok(html.includes(`href="${URL}"`));
});

test('renderFirstHostDiscordBar: external link opens safely in a new tab', () => {
  const html = renderFirstHostDiscordBar(HOST, { url: URL });
  assert.ok(html.includes('target="_blank"'));
  assert.ok(html.includes('rel="noopener noreferrer"'));
});

test('renderFirstHostDiscordBar: dismiss is wired to the router, never navigation', () => {
  const html = renderFirstHostDiscordBar(HOST, { url: URL });
  assert.ok(html.includes('window.game.dismissDiscordBar()'));
  assert.ok(html.includes('aria-label="Dismiss"'));
});

test('renderFirstHostDiscordBar: a quote in the URL cannot break out of the href', () => {
  const html = renderFirstHostDiscordBar(HOST, { url: 'https://x.test/"><script>' });
  assert.ok(!html.includes('<script>'), 'no raw tag survives into the markup');
  assert.ok(html.includes('&quot;'));
});

// ── Hidden states ─────────────────────────────────────────

test('renderFirstHostDiscordBar: hidden without a configured invite', () => {
  // Blanking the constant must pull the bar rather than render a dead link.
  assert.equal(renderFirstHostDiscordBar(HOST, { url: '' }), '');
});

test('the configured invite is a real Discord URL and is what the bar links to', () => {
  assert.match(DISCORD_INVITE_URL, /^https:\/\/discord\.gg\/[A-Za-z0-9]+$/);
  assert.ok(renderFirstHostDiscordBar(HOST).includes(`href="${DISCORD_INVITE_URL}"`));
});

test('renderFirstHostDiscordBar: hidden for players who are not the host', () => {
  assert.equal(renderFirstHostDiscordBar({ isHost: false }, { url: URL }), '');
  assert.equal(renderFirstHostDiscordBar({}, { url: URL }), '');
  assert.equal(renderFirstHostDiscordBar(undefined, { url: URL }), '');
});

// ── Storage-gated hidden states ───────────────────────────
// These need a localStorage to gate on, so they run against a stub. Kept last
// and torn down so the no-storage tests above keep reading a bare environment.

function withStoredKeys(keys, fn) {
  globalThis.localStorage = { getItem: (k) => (keys.includes(k) ? '1' : null) };
  try {
    fn();
  } finally {
    delete globalThis.localStorage;
  }
}

test('renderFirstHostDiscordBar: hidden once the host has hosted a game', () => {
  withStoredKeys([HOSTED_KEY], () => {
    assert.equal(isFirstHostedGame(), false);
    assert.equal(renderFirstHostDiscordBar(HOST, { url: URL }), '');
  });
});

test('renderFirstHostDiscordBar: hidden once dismissed, even on a first hosted game', () => {
  withStoredKeys([DISMISS_KEY], () => {
    assert.equal(isFirstHostedGame(), true, 'still their first hosted game');
    assert.equal(isDiscordBarDismissed(), true);
    assert.equal(renderFirstHostDiscordBar(HOST, { url: URL }), '');
  });
});

test('storage throwing (private mode) degrades to showing, never throws', () => {
  globalThis.localStorage = {
    getItem() { throw new Error('storage disabled'); },
  };
  try {
    assert.equal(isFirstHostedGame(), true);
    assert.equal(isDiscordBarDismissed(), false);
    assert.ok(renderFirstHostDiscordBar(HOST, { url: URL }).includes(DISCORD_PROMPT));
  } finally {
    delete globalThis.localStorage;
  }
});
