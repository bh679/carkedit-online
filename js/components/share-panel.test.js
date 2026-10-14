import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canShare, renderShareButton, renderPanel } from './share-panel.js';

const JOIN_URL = 'https://play.carkedit.com/?join=KXQZ';
const CONNECTED = { gameMode: 'online', connectionStatus: 'connected', roomCode: 'KXQZ' };

// ── canShare ──────────────────────────────────────────────

test('canShare: true only for a connected online room with a code', () => {
  assert.equal(canShare(CONNECTED), true);
  assert.equal(canShare({ ...CONNECTED, gameMode: 'local' }), false);
  assert.equal(canShare({ ...CONNECTED, connectionStatus: 'connecting' }), false);
  assert.equal(canShare({ ...CONNECTED, roomCode: null }), false);
  assert.equal(canShare(undefined), false);
});

// ── Header button ─────────────────────────────────────────

test('renderShareButton: renders an opener once there is a room', () => {
  const html = renderShareButton(CONNECTED);
  assert.ok(html.includes('window.game.openShare()'), 'opens the panel');
  assert.ok(html.includes('phase-header__qr-btn'), 'sits in the header icon cluster');
  assert.ok(html.includes('aria-label="Show QR code"'), 'has an accessible name');
});

test('renderShareButton: absent rather than disabled without a room', () => {
  assert.equal(renderShareButton({ ...CONNECTED, roomCode: null }), '');
  assert.equal(renderShareButton({ ...CONNECTED, connectionStatus: 'disconnected' }), '');
});

test('renderShareButton: does not touch the existing copy-link button', () => {
  const html = renderShareButton(CONNECTED);
  assert.ok(!html.includes('copyJoinLink'), 'instant copy stays a separate control');
  assert.ok(!html.includes('phase-header__settings-btn'), 'does not reuse the copy button class');
});

// ── Panel ─────────────────────────────────────────────────

test('renderPanel: shows a QR code, the room code and the URL', () => {
  const html = renderPanel(CONNECTED, JOIN_URL);
  assert.ok(html.includes('<svg '), 'embeds the QR svg');
  assert.ok(html.includes('viewBox='), 'the svg is scalable');
  assert.ok(html.includes('KXQZ'), 'shows the room code');
  assert.ok(html.includes('play.carkedit.com/?join=KXQZ'), 'shows the join URL');
  assert.ok(html.includes('window.game.copyShareLink()'), 'offers copy');
});

test('renderPanel: QR carries an accessible label naming the room', () => {
  const html = renderPanel(CONNECTED, JOIN_URL);
  assert.ok(html.includes('QR code to join room KXQZ'));
  assert.ok(html.includes('role="img"'));
});

test('renderPanel: native share only when the platform supports it', () => {
  assert.ok(!renderPanel(CONNECTED, JOIN_URL).includes('nativeShare'), 'absent by default');
  assert.ok(
    renderPanel(CONNECTED, JOIN_URL, { nativeShare: true }).includes('window.game.nativeShare()'),
    'present when opted in',
  );
});

test('renderPanel: closes on backdrop and on the close button', () => {
  const html = renderPanel(CONNECTED, JOIN_URL);
  assert.equal(html.match(/window\.game\.closeShare\(\)/g).length, 2, 'backdrop + ✕');
  assert.ok(html.includes('event.stopPropagation()'), 'clicks inside the panel do not close it');
});

test('renderPanel: nothing to render without a room or a URL', () => {
  assert.equal(renderPanel(CONNECTED, null), '');
  assert.equal(renderPanel({ ...CONNECTED, roomCode: null }, JOIN_URL), '');
});

test('renderPanel: escapes the room code and URL', () => {
  const html = renderPanel(
    { ...CONNECTED, roomCode: '<img src=x>' },
    'https://play.carkedit.com/?join=%22%3E%3Cscript%3E',
  );
  assert.ok(!html.includes('<img src=x>'), 'room code cannot inject markup');
  assert.ok(html.includes('&lt;img src=x&gt;'), 'room code is escaped');
  assert.ok(!html.includes('<script>'), 'URL cannot inject markup');
});

test('renderPanel: carries no personal details — this URL goes out to a group', () => {
  // The join screen's QR deliberately embeds the scanner's own name and
  // birthday (js/utils/join-details.js). The host's share panel must not: it
  // is broadcast to everyone invited, and the host's details are not theirs
  // to hand out. Guards against someone wiring appendJoinDetails in here.
  const html = renderPanel(CONNECTED, JOIN_URL);
  // Match on param boundaries — a bare 'n=' also occurs inside 'join='.
  for (const param of ['n', 'bm', 'bd']) {
    assert.ok(
      !new RegExp(`[?&]${param}=`).test(html),
      `share panel URL is free of the '${param}' param`,
    );
  }
  assert.ok(html.includes('?join=KXQZ'), 'still the plain invite');
});

test('renderPanel: is a dialog labelled for screen readers', () => {
  const html = renderPanel(CONNECTED, JOIN_URL);
  assert.ok(html.includes('role="dialog"'));
  assert.ok(html.includes('aria-label="Invite players"'));
});
