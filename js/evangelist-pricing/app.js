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
import { PLAN_BY_KEY } from '../config/plans.js';

// ── Content data ──────────────────────────────────────────
// Name + price come from the shared plan catalog (js/config/plans.js); only the
// marketing copy (features / featured / inherits) lives here.

export const TIERS = [
  {
    ...PLAN_BY_KEY.basic,
    features: [
      'Custom URL <span class="evp-feature__note">carkedit.com/your-url</span>',
      'Free for your clients',
      '250 games a year <span class="evp-feature__note">(unlimited in first 4 months)</span>',
      'Your Logo',
      'Analytics',
    ],
  },
  {
    ...PLAN_BY_KEY.pro,
    featured: true,
    inherits: 'Everything in Basic',
    features: [
      '1000 games a year <span class="evp-feature__note">(unlimited in first 4 months)</span>',
      'Up to 20 Custom Cards',
    ],
  },
  {
    ...PLAN_BY_KEY.ultimate,
    inherits: 'Everything in Pro',
    features: [
      'Unlimited Games',
      'Up to 200 Custom Cards',
      'Clients can make 2 cards each',
      'Custom Post-Game Survey',
    ],
  },
];

export const SIGNUP_HREF = 'brand-signup.html';
export const WHITELABEL_EMAIL = 'simon@theageingrevolution.com';

// Plan keys in display order, and the default selection (the featured tier).
export const PLAN_KEYS = TIERS.map((t) => t.key);
export const DEFAULT_PLAN = (TIERS.find((t) => t.featured) || TIERS[0]).key;

// ── Pure selection logic ──────────────────────────────────

export function isSelected(selected, key) {
  return selected === key;
}

/** The signup URL that carries the chosen plan to the request form. */
export function signupUrl(selected) {
  return PLAN_KEYS.includes(selected)
    ? `${SIGNUP_HREF}?plan=${encodeURIComponent(selected)}`
    : SIGNUP_HREF;
}

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

export function renderTier(tier, selected) {
  const on = isSelected(selected, tier.key);
  const featured = tier.featured ? ' evp-tier--featured' : '';
  const sel = on ? ' evp-tier--selected' : '';
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
  return `
    <li
      class="evp-tier evp-tier--${tier.key}${featured}${sel}"
      role="radio"
      aria-checked="${on}"
      tabindex="${on ? '0' : '-1'}"
      data-plan="${tier.key}"
      onclick="window.evangelistPricing.selectTier('${tier.key}')"
      onkeydown="window.evangelistPricing.onKey(event, '${tier.key}')"
    >
      <div class="evp-tier__head">
        ${badge}
        <span class="evp-tier__radio" aria-hidden="true"></span>
        <h2 class="evp-tier__name">${escapeHtml(tier.name)}</h2>
        <p class="evp-tier__price">
          <span class="evp-tier__amount">${escapeHtml(tier.price)}</span>
          <span class="evp-tier__period">${escapeHtml(tier.period)}</span>
        </p>
      </div>
      <ul class="evp-features">
        ${inherits}
        ${features}
      </ul>
    </li>
  `;
}

export function renderTiers(tiers, selected) {
  return `
    <ul class="evp-tiers" role="radiogroup" aria-label="Choose a plan">
      ${tiers.map((t) => renderTier(t, selected)).join('')}
    </ul>
  `;
}

export function renderActions(evangelist = 'Evangelist', selected) {
  const label = `Become ${escapeHtml(`a ${evangelist}`)}`;
  return `
    <div class="evp-actions">
      <button
        type="button"
        class="btn btn--primary evp-actions__cta"
        onclick="window.evangelistPricing.goToSignup()"
      >${label} &rarr;</button>
    </div>
  `;
}

export function renderWhiteLabel() {
  const email = escapeHtml(WHITELABEL_EMAIL);
  return `
    <p class="evp-whitelabel">
      <strong class="evp-whitelabel__title">Want a full corporate white label?</strong>
      Your own app, fully branded end-to-end —
      <a class="evp-whitelabel__link" href="mailto:${email}">email ${email}</a>
      to talk through a bespoke package.
    </p>
  `;
}

export function render(evangelist = 'Evangelist', selected = DEFAULT_PLAN) {
  return `
    <div class="evp">
      ${renderHeader(evangelist)}
      <p class="evp-intro">
        Become a${escapeHtml(` ${evangelist}`)} and run Carked It! games under your own brand —
        your logo, your vanity URL, and stats to match. Tap a plan to choose it.
      </p>
      ${renderTiers(tiers(), selected)}
      ${renderActions(evangelist, selected)}
      ${renderWhiteLabel()}
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

let selectedPlan = DEFAULT_PLAN;

/** Reflect the current selection onto the rendered tiers (no full re-render). */
function paintSelection() {
  PLAN_KEYS.forEach((key) => {
    const el = document.querySelector(`.evp-tier[data-plan="${key}"]`);
    if (!el) return;
    const on = isSelected(selectedPlan, key);
    el.classList.toggle('evp-tier--selected', on);
    el.setAttribute('aria-checked', String(on));
    el.tabIndex = on ? 0 : -1;
  });
}

function selectTier(key) {
  if (!PLAN_KEYS.includes(key)) return;
  selectedPlan = key;
  paintSelection();
}

function goToSignup() {
  window.location.href = signupUrl(selectedPlan);
}

// Arrow-key navigation within the radiogroup; Enter/Space confirm via the button.
function onKey(event, key) {
  const idx = PLAN_KEYS.indexOf(key);
  if (idx === -1) return;
  let next = null;
  if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (idx + 1) % PLAN_KEYS.length;
  else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (idx - 1 + PLAN_KEYS.length) % PLAN_KEYS.length;
  if (next === null) return;
  event.preventDefault();
  selectTier(PLAN_KEYS[next]);
  const el = document.querySelector(`.evp-tier[data-plan="${PLAN_KEYS[next]}"]`);
  if (el) el.focus();
}

function mount() {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = render(evangelistTerm(), selectedPlan);
}

if (typeof document !== 'undefined') {
  window.evangelistPricing = { selectTier, goToSignup, onKey };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
}
