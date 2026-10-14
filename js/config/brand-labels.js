// CarkedIt Online — Partner-brand ("Champion") display labels.
//
// The literal below is an instant, offline fallback. The single source of truth
// is the API's ROLE_LABELS (carkedit-api/src/config/brand-config.ts), exposed at
// GET /api/carkedit/config/labels — we hydrate from it on load so the two copies
// can't silently drift. Components that read ROLE_LABELS at render time pick up
// the hydrated value; import-time readers use the (kept-in-sync) literal.
'use strict';

export const ROLE_LABELS = {
  champion: { singular: 'Champion', plural: 'Champions' },
};

// Converge to the API's labels in the browser (mutate in place; never throws).
// We read ONLY the `champion` key: an API deployed before this client has just
// the pre-rename `evangelist` key, and ignoring it keeps the built-in 'Champion'
// instead of reverting to the old name mid-deploy.
if (typeof window !== 'undefined' && typeof fetch === 'function') {
  fetch(`${window.location.origin}/api/carkedit/config/labels`)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      const ch = data && data.roleLabels && data.roleLabels.champion;
      if (ch && ch.singular) {
        ROLE_LABELS.champion.singular = String(ch.singular);
        ROLE_LABELS.champion.plural = String(ch.plural || `${ch.singular}s`);
      }
    })
    .catch(() => {});
}
