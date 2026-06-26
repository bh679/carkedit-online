// CarkedIt Online — Partner-brand ("Evangelist") co-branding.
//
// Reads window.__BRAND__ (injected by the API slug resolver when the page is
// served from a partner vanity URL, carkedit.com/<slug>) and exposes a
// normalized window.brand. Screens render an ADDITIONAL co-brand lockup (extra
// logo + partner-name line) — CarkedIt's own logo and name are NEVER swapped.
// Absent on the root domain → window.brand is null and the app is unchanged.
'use strict';

import { escapeHtml } from '../utils/escape.js';

/** Normalize a raw window.__BRAND__ payload to a clean brand object, or null. */
export function resolveBrand(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!raw.id || !raw.name) return null;
  return {
    id: String(raw.id),
    slug: raw.slug ? String(raw.slug) : null,
    name: String(raw.name),
    logoUrl: raw.logoUrl ? String(raw.logoUrl) : null,
  };
}

/**
 * Hydrate `win.brand` from a raw payload and (additively) append the partner
 * name to the document title — never replacing CarkedIt's title. Side effects
 * touch only the passed globals, so resolveBrand stays unit-testable DOM-free.
 */
export function applyBrand(raw, win, doc) {
  const brand = resolveBrand(raw);
  if (win) win.brand = brand;
  if (brand && doc && typeof doc.title === 'string') {
    doc.title = `${doc.title} · ${brand.name}`;
  }
  return brand;
}

/** Co-brand lockup HTML: an extra partner logo + "In partnership with <Brand>". */
export function renderCoBrand(brand) {
  if (!brand) return '';
  const logo = brand.logoUrl
    ? `<img class="menu__cobrand-logo" src="${escapeHtml(brand.logoUrl)}" alt="" onerror="this.style.display='none'" />`
    : '';
  return `
    <div class="menu__cobrand">
      ${logo}
      <p class="menu__cobrand-text">In partnership with <span class="menu__cobrand-name">${escapeHtml(brand.name)}</span></p>
    </div>
  `;
}

/**
 * Compact co-brand for the phase-header strip (in-game, lobby, create-room) —
 * a small partner logo + name sitting next to the "CarkedIt" title. Styled by
 * .phase-header__cobrand in css/components/phase-header.css.
 */
export function renderHeaderCoBrand(brand) {
  if (!brand) return '';
  const logo = brand.logoUrl
    ? `<img class="phase-header__cobrand-logo" src="${escapeHtml(brand.logoUrl)}" alt="" onerror="this.style.display='none'" />`
    : '';
  return `<span class="phase-header__cobrand" title="In partnership with ${escapeHtml(brand.name)}">${logo}<span class="phase-header__cobrand-name">${escapeHtml(brand.name)}</span></span>`;
}

// Auto-hydrate in the browser (no-op under Node test where window is undefined).
if (typeof window !== 'undefined') {
  applyBrand(window.__BRAND__, window, typeof document !== 'undefined' ? document : null);
}
