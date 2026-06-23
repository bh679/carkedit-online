import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAdminNavLinks, renderAdminMenuItems } from './admin-nav.js';

// --- buildAdminNavLinks (registry → 2-level tree) ---------------------------

// Isolated sample so these assertions don't move when the real PAGES list does.
const SAMPLE_PAGES = [
  { path: 'index',         label: 'Home',           category: 'public', currentMinRole: 'Player' },
  { path: 'color-demo',    label: 'Colors',         category: 'dev',    currentMinRole: 'QA' },
  { path: 'admin-users',   label: 'User Management', category: 'admin', currentMinRole: 'Admin' },
  { path: 'stats',         label: 'Stats',          category: 'admin',  currentMinRole: 'QA' },
  { path: 'stats-games',   label: 'Game Stats',     category: 'admin',  currentMinRole: 'QA', parent: 'stats' },
  { path: 'stats-surveys', label: 'Survey Stats',   category: 'admin',  currentMinRole: 'QA', parent: 'stats' },
];

test('buildAdminNavLinks: keeps only top-level admin pages (no public/dev, no nested children)', () => {
  const paths = buildAdminNavLinks(SAMPLE_PAGES).map((l) => l.path);
  assert.deepEqual(paths, ['admin-users', 'stats']);
});

test('buildAdminNavLinks: never prepends the header-only back link', () => {
  const links = buildAdminNavLinks(SAMPLE_PAGES);
  assert.ok(!links.some((l) => l.path === '.'), 'back link belongs to the header, not the shared source');
});

test('buildAdminNavLinks: maps known paths to their short NAV_LABELS', () => {
  const users = buildAdminNavLinks(SAMPLE_PAGES).find((l) => l.path === 'admin-users');
  assert.equal(users.label, 'Users'); // short label, not the long "User Management"
});

test('buildAdminNavLinks: falls back to the page label when no short label exists', () => {
  const links = buildAdminNavLinks([
    { path: 'custom-admin', label: 'Custom Admin', category: 'admin', currentMinRole: 'QA' },
  ]);
  assert.equal(links[0].label, 'Custom Admin');
});

test('buildAdminNavLinks: nests child pages under their parent in order', () => {
  const stats = buildAdminNavLinks(SAMPLE_PAGES).find((l) => l.path === 'stats');
  assert.deepEqual(stats.children.map((c) => c.path), ['stats-games', 'stats-surveys']);
  assert.deepEqual(stats.children.map((c) => c.label), ['Games', 'Surveys']);
});

test('buildAdminNavLinks: empty input yields an empty list', () => {
  assert.deepEqual(buildAdminNavLinks([]), []);
});

// --- renderAdminMenuItems (flat dropdown HTML from the real PAGES registry) --

test('renderAdminMenuItems: an Admin sees every admin page, in registry order', () => {
  const html = renderAdminMenuItems(); // default role = Admin
  const labels = [...html.matchAll(/auth-menu__item" href="[^"]+">([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(labels, ['ImageAI', 'Users', 'Roles', 'Brands', 'Deploy', 'Dev', 'Costs', 'Stats']);
});

test('renderAdminMenuItems: emits anchors carrying the links the old hardcoded list was missing', () => {
  const html = renderAdminMenuItems();
  assert.ok(html.includes('<a class="auth-menu__item" href="admin-roles">Roles</a>'));
  assert.ok(html.includes('<a class="auth-menu__item" href="financial-dashboard">Costs</a>'));
  assert.ok(html.includes('<a class="auth-menu__item" href="deploy">Deploy</a>'));
});

test('renderAdminMenuItems: dropdown stays flat — no Stats sub-pages', () => {
  const html = renderAdminMenuItems();
  assert.ok(!html.includes('href="stats-games"'));
  assert.ok(!html.includes('href="stats-surveys"'));
});

test('renderAdminMenuItems: QA role hides Admin-only pages (Users, Roles)', () => {
  const html = renderAdminMenuItems({ role: 'QA' });
  assert.ok(!html.includes('href="admin-users"'), 'Users is Admin-only');
  assert.ok(!html.includes('href="admin-roles"'), 'Roles is Admin-only');
  assert.ok(html.includes('href="stats"'), 'Stats is QA-visible');
  assert.ok(html.includes('href="admin-image-gen"'), 'ImageAI is QA-visible');
});

test('renderAdminMenuItems: a Player sees no admin pages', () => {
  assert.equal(renderAdminMenuItems({ role: 'Player' }), '');
});

test('renderAdminMenuItems: honours a custom itemClass', () => {
  const html = renderAdminMenuItems({ itemClass: 'custom__item' });
  assert.ok(html.includes('<a class="custom__item" href="stats">Stats</a>'));
  assert.ok(!html.includes('auth-menu__item'));
});
