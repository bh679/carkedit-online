import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveBrandId, renderStatsPanel, renderUsersPanel, formatDuration } from './brand-admin.js';

test('resolveBrandId prefers an explicit query brand id', () => {
  assert.equal(resolveBrandId('brand_q', [{ id: 'brand_owned' }]), 'brand_q');
});

test('resolveBrandId falls back to the first owned brand', () => {
  assert.equal(resolveBrandId(null, [{ id: 'brand_a' }, { id: 'brand_b' }]), 'brand_a');
  assert.equal(resolveBrandId('', [{ id: 'brand_a' }]), 'brand_a');
});

test('resolveBrandId returns null when there is nothing to resolve', () => {
  assert.equal(resolveBrandId(null, []), null);
  assert.equal(resolveBrandId(null, null), null);
  assert.equal(resolveBrandId(undefined, undefined), null);
  assert.equal(resolveBrandId(null, [{}]), null); // brand with no id
});

test('formatDuration renders minutes/seconds and handles empty', () => {
  assert.equal(formatDuration(0), '—');
  assert.equal(formatDuration(45), '45s');
  assert.equal(formatDuration(90), '1m 30s');
});

test('renderStatsPanel is null-safe and shows the count cards', () => {
  assert.match(renderStatsPanel(null), /No stats available/);
  const html = renderStatsPanel({ totalGames: 7, finishedGames: 5, allPlayers: 21, avgPlayTime: 120 });
  assert.match(html, /brand-admin__stats/);
  assert.match(html, /\b7\b/);
  assert.match(html, /\b21\b/);
  assert.match(html, /2m 0s/); // avg play time formatted
});

test('renderUsersPanel escapes user-supplied display names', () => {
  const html = renderUsersPanel([{ display_name: '<script>alert(1)</script>', created_at: '2026-06-01T00:00:00.000Z' }]);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});

test('renderUsersPanel shows an empty state', () => {
  assert.match(renderUsersPanel([]), /No accounts have signed up/);
  assert.match(renderUsersPanel(null), /No accounts have signed up/);
});
