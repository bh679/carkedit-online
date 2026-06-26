// CarkedIt Online — Evangelist Pricing page
// Standalone informational page presenting the three co-branding ("Evangelist")
// subscription tiers (Basic / Pro / Ultimate). Each tier's CTA links to the
// self-serve brand-signup request page.
//
// Pure render/logic functions are exported and import-safe (no DOM at load time)
// so they can be unit tested; the DOM bootstrap at the bottom is guarded.
//
// The "Evangelist" wording is NOT hardcoded: it comes from ROLE_LABELS.evangelist
// (js/config/brand-labels.js), which hydrates from the API at runtime so the term
// can change in one place. Mirrors brand-signup.html's pattern.
'use strict';

import { ROLE_LABELS } from '../config/brand-labels.js';
import { escapeHtml } from '../utils/escape.js';

// ── Content data ──────────────────────────────────────────

export const TIERS = [
  {
    key: 'basic',
    name: 'Basic',
    price: '$150',
    period: '/ year',
    features: [
      'Custom URL',
      '250 games a year <span class="evp-feature__note">(unlimited 6 months in pre-release)</span>',
      'Free for clients',
      'Logo branded',
      'Admin Stats page',
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '$250',
    period: '/ year',
    featured: true,
    inherits: 'Everything in Basic',
    features: [
      '1000 games a year <span class="evp-feature__note">(unlimited 6 months in pre-release)</span>',
      '20-card Custom Expansion Pack',
      'Clients can make 2 cards each',
    ],
  },
  {
    key: 'ultimate',
    name: 'Ultimate',
    price: '$500',
    period: '/ year',
    inherits: 'Everything in Pro',
    features: [
      'Unlimited Games',
      'Up to 200 Custom Cards',
      'Clients can make 10 custom cards each',
    ],
  },
];

export const SIGNUP_HREF = 'brand-signup.html';

// ── Rendering (pure: returns HTML strings) ────────────────

export function renderHeader(evangelist = 'Evangelist') {
  const who = escapeHtml(evangelist);
  return `
    <header class="evp-header">
      <a class="evp-back" href="/" aria-label="Back to menu">&larr; Menu</a>
      <img
        class="evp-header__logo"
        src="assets/CarkedIt-skull.webp"
        alt=""
        onerror="this.style.display='none'"
      />
      <h1 class="evp-header__title">${who} Pricing</h1>
      <p class="evp-header__subtitle">Run co-branded games at your own URL</p>
    </header>
  `;
}

export function renderTier(tier, evangelist = 'Evangelist') {
  const featured = tier.featured ? ' evp-tier--featured' : '';
  const badge = tier.featured
    ? '<span class="evp-tier__badge">Most popular</span>'
    : '';
  const inherits = tier.inherits
    ? `<li class="evp-feature evp-feature--inherits">${escapeHtml(tier.inherits)}</li>`
    : '';
  // Feature strings are trusted static copy (may contain a styled note span).
  const features = tier.features
    .map((f) => `<li class="evp-feature">${f}</li>`)
    .join('');
  const cta = `Become ${escapeHtml(`a ${evangelist}`)}`;
  return `
    <li class="evp-tier evp-tier--${tier.key}${featured}">
      ${badge}
      <h2 class="evp-tier__name">${escapeHtml(tier.name)}</h2>
      <p class="evp-tier__price">
        <span class="evp-tier__amount">${escapeHtml(tier.price)}</span>
        <span class="evp-tier__period">${escapeHtml(tier.period)}</span>
      </p>
      <ul class="evp-features">
        ${inherits}
        ${features}
      </ul>
      <a class="btn btn--primary evp-tier__cta" href="${SIGNUP_HREF}">${cta} &rarr;</a>
    </li>
  `;
}

export function renderTiers(tiers, evangelist = 'Evangelist') {
  return `
    <ul class="evp-tiers">
      ${tiers.map((t) => renderTier(t, evangelist)).join('')}
    </ul>
  `;
}

export function render(evangelist = 'Evangelist') {
  return `
    <div class="evp">
      ${renderHeader(evangelist)}
      <p class="evp-intro">
        Become a${escapeHtml(` ${evangelist}`)} and run Carked It! games under your own brand —
        your logo, your vanity URL, and stats to match. Pick the plan that fits your audience.
      </p>
      ${renderTiers(tiers(), evangelist)}
      <p class="evp-foot">All plans are billed yearly. Questions? Submit a request and an admin will be in touch.</p>
    </div>
  `;
}

// Indirection so render() always uses the canonical TIERS without a closure trap.
function tiers() {
  return TIERS;
}

// ── DOM behaviour (browser only) ──────────────────────────

function evangelistTerm() {
  const ev = ROLE_LABELS && ROLE_LABELS.evangelist;
  return (ev && ev.singular) || 'Evangelist';
}

function mount() {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = render(evangelistTerm());
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
}
