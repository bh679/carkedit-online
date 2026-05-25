// CarkedIt Online — Static page registry + role utilities
//
// Source-of-truth for the *list* of standalone HTML pages this client serves.
// Per-page access (min role) is the static default below; admins can override
// at runtime via /api/carkedit/admin/page-permissions. The admin-roles page
// surfaces this table as an editable checkbox grid.
'use strict';

export const PAGES = [
  { path: 'index',                label: 'Home / Game',           defaultMinRole: 'Player', category: 'public' },
  { path: 'admin-image-gen',      label: 'Image AI',              defaultMinRole: 'QA',     category: 'admin'  },
  { path: 'admin-users',          label: 'User Management',       defaultMinRole: 'Admin',  category: 'admin'  },
  { path: 'admin-roles',          label: 'Roles & Permissions',   defaultMinRole: 'Admin',  category: 'admin'  },
  { path: 'card-scale-test',      label: 'Card Scale Test',       defaultMinRole: 'QA',     category: 'dev'    },
  { path: 'card-test',            label: 'Card Test',             defaultMinRole: 'QA',     category: 'dev'    },
  { path: 'color-demo',           label: 'Color Demo',            defaultMinRole: 'QA',     category: 'dev'    },
  { path: 'deploy',               label: 'Deploy',                defaultMinRole: 'QA',     category: 'admin'  },
  { path: 'deploying',            label: 'Deploying',             defaultMinRole: 'Player', category: 'public' },
  { path: 'dev-dashboard',        label: 'Dev Dashboard',         defaultMinRole: 'QA',     category: 'admin'  },
  { path: 'expansions',           label: 'Expansion Packs',       defaultMinRole: 'Player', category: 'public' },
  { path: 'financial-dashboard',  label: 'Costs',                 defaultMinRole: 'QA',     category: 'admin'  },
  { path: 'mockup-menu-layouts',  label: 'Menu Mockups',          defaultMinRole: 'QA',     category: 'dev'    },
  { path: 'stats',                label: 'Stats',                 defaultMinRole: 'QA',     category: 'admin'  },
  { path: 'stats-games',          label: 'Game Stats',            defaultMinRole: 'QA',     category: 'admin',  parent: 'stats' },
  { path: 'stats-surveys',        label: 'Survey Stats',          defaultMinRole: 'QA',     category: 'admin',  parent: 'stats' },
  { path: 'text-card-test',       label: 'Text Card Test',        defaultMinRole: 'QA',     category: 'dev'    },
];

export const ROLES = ['Player', 'Host', 'QA', 'Admin'];
export const ROLE_RANK = { Player: 0, Host: 1, QA: 2, Admin: 3 };

export function meetsRole(userRole, minRole) {
  return (ROLE_RANK[userRole] ?? 0) >= (ROLE_RANK[minRole] ?? 0);
}

// Module-level cache so admin-header + page-guard share one fetch per page load.
let _permissionsCache = null;

export async function fetchEffectivePermissions({ force = false } = {}) {
  if (!force && _permissionsCache) return _permissionsCache;
  try {
    const res = await fetch('/api/carkedit/page-permissions');
    const data = res.ok ? await res.json() : { overrides: [] };
    const byPath = new Map((data.overrides || []).map((o) => [o.path, o.min_role]));
    _permissionsCache = PAGES.map((p) => ({
      ...p,
      currentMinRole: byPath.get(p.path) ?? p.defaultMinRole,
    }));
  } catch {
    _permissionsCache = PAGES.map((p) => ({ ...p, currentMinRole: p.defaultMinRole }));
  }
  return _permissionsCache;
}

export function invalidatePermissionsCache() {
  _permissionsCache = null;
}

export function getPageByPath(pathSlug) {
  return PAGES.find((p) => p.path === pathSlug) ?? null;
}
