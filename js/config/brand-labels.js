// CarkedIt Online — Partner-brand ("Evangelist") display labels.
//
// The literal below is an instant, offline fallback. The single source of truth
// is the API's ROLE_LABELS (carkedit-api/src/config/brand-config.ts), exposed at
// GET /api/carkedit/config/labels — we hydrate from it on load so the two copies
// can't silently drift. Components that read ROLE_LABELS at render time pick up
// the hydrated value; import-time readers use the (kept-in-sync) literal.
'use strict';

export const ROLE_LABELS = {
  evangelist: { singular: 'Death Evangelist', plural: 'Death Evangelists' },
};

// Converge to the API's labels in the browser (mutate in place; never throws).
if (typeof window !== 'undefined' && typeof fetch === 'function') {
  fetch(`${window.location.origin}/api/carkedit/config/labels`)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      const ev = data && data.roleLabels && data.roleLabels.evangelist;
      if (ev && ev.singular) {
        ROLE_LABELS.evangelist.singular = String(ev.singular);
        ROLE_LABELS.evangelist.plural = String(ev.plural || `${ev.singular}s`);
      }
    })
    .catch(() => {});
}
