// CarkedIt Online — Shared Admin Navigation Model
//
// Single source of truth for the admin menu link list. Both the horizontal
// admin header (components/admin-header.js) and the avatar dropdown menus
// (components/auth-button.js, marketplace/app.js, card-designer/app.js) derive
// their admin links from here, so adding or renaming an admin page in pages.js
// updates every menu at once.
'use strict';

import { PAGES, meetsRole } from './pages.js';

// Short labels for admin pages shown in the compact menus (keeps the bar tidy
// while the admin-roles page can still show the longer pages.js labels).
export const NAV_LABELS = {
  'stats':               'Stats',
  'stats-games':         'Games',
  'stats-surveys':       'Surveys',
  'admin-users':         'Users',
  'admin-roles':         'Roles',
  'admin-image-gen':     'ImageAI',
  'financial-dashboard': 'Costs',
  'dev-dashboard':       'Dev',
  'deploy':              'Deploy',
};

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Builds a 2-level nav tree of admin pages from a merged/effective page list:
//   [ { label: 'Stats', path: 'stats', minRole: 'QA',
//       children: [ { label: 'Games', path: 'stats-games', minRole: 'QA' }, … ] },
//     { label: 'Users', path: 'admin-users', minRole: 'Admin', children: [] }, … ]
// Only `category: 'admin'` pages appear. Children are pages whose `parent`
// matches a top-level page's path. No back link and no role filtering — callers
// add their own chrome (e.g. the header's ← link) and filter by role at render.
export function buildAdminNavLinks(effectivePages) {
  const adminPages = effectivePages.filter((p) => p.category === 'admin');
  const topLevel = adminPages.filter((p) => !p.parent);
  return topLevel.map((p) => {
    const children = adminPages
      .filter((c) => c.parent === p.path)
      .map((c) => ({
        label: NAV_LABELS[c.path] ?? c.label,
        path: c.path,
        minRole: c.currentMinRole,
      }));
    return { label: NAV_LABELS[p.path] ?? p.label, path: p.path, minRole: p.currentMinRole, children };
  });
}

// Flat HTML for the compact avatar dropdowns: the top-level admin pages a user
// of `role` may reach, rendered as <a> items. Reads the static PAGES registry
// (default min-roles) so it stays synchronous — the dropdowns render without an
// async permissions fetch. `itemClass` lets each dropdown apply its own CSS.
export function renderAdminMenuItems({ role = 'Admin', itemClass = 'auth-menu__item' } = {}) {
  const effective = PAGES.map((p) => ({ ...p, currentMinRole: p.defaultMinRole }));
  return buildAdminNavLinks(effective)
    .filter((l) => meetsRole(role, l.minRole))
    .map((l) => `<a class="${itemClass}" href="${esc(l.path)}">${esc(l.label)}</a>`)
    .join('');
}
