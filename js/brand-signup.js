// CarkedIt Online — Brand-request ("Evangelist") render helpers.
//
// Pure, DOM-free HTML builders for brand-signup.html (the self-serve request
// page linked from the account screen). Kept out of the page's inline boot so
// they're unit-testable (see brand-signup.test.js). The page wires Firebase
// auth + authFetch + submit/slug-check; these only turn data into markup.
'use strict';

import { escapeHtml } from './utils/escape.js';

const STATUS_LABEL = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  suspended: 'Suspended',
};

// Plan tiers a request can be tagged with (chosen on the pricing page and passed
// in via ?plan=). Keep in sync with the Evangelist pricing page's TIERS keys and
// the API's allowed plan enum.
export const PLAN_LABELS = {
  basic: 'Basic',
  pro: 'Pro',
  ultimate: 'Ultimate',
};

/** Normalise an incoming ?plan= value to a known key, or null if unknown. */
export function normalisePlan(value) {
  const key = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return Object.prototype.hasOwnProperty.call(PLAN_LABELS, key) ? key : null;
}

/**
 * A plan picker, pre-selected to the plan chosen on the pricing page (if any).
 * The user can switch plans here, so this is an editable <select>, not a label.
 */
export function renderPlanSelect(plan) {
  const selected = normalisePlan(plan);
  const options = Object.entries(PLAN_LABELS)
    .map(([key, label]) =>
      `<option value="${escapeHtml(key)}"${key === selected ? ' selected' : ''}>${escapeHtml(label)}</option>`)
    .join('');
  return `
    <label class="brand-signup__field brand-signup__plan">
      <span>Plan</span>
      <select id="brand-request-plan" class="brand-signup__plan-select">
        <option value=""${selected ? '' : ' selected'}>— Choose a plan —</option>
        ${options}
      </select>
    </label>`;
}

/**
 * The request form. `evangelist` is the configurable role label for copy;
 * `plan` (optional) is the tier chosen on the pricing page, pre-selected in the
 * plan picker (the user can switch it here).
 */
export function renderRequestForm(evangelist = 'Evangelist', plan = null) {
  const who = escapeHtml(evangelist);
  return `
    <form id="brand-request-form" class="brand-signup__form" onsubmit="return window.brandSignup.submit(event)">
      ${renderPlanSelect(plan)}
      <label class="brand-signup__field">
        <span>Brand name</span>
        <input type="text" id="brand-request-name" maxlength="80" required placeholder="Acme Funeral Co." />
      </label>
      <label class="brand-signup__field">
        <span>Desired URL</span>
        <input type="text" id="brand-request-slug" maxlength="40" required placeholder="acme"
          autocomplete="off" oninput="window.brandSignup.checkSlug()" />
      </label>
      <p class="brand-signup__slug-hint" id="brand-slug-hint">carkedit.com/&lt;your-url&gt;</p>
      <label class="brand-signup__field">
        <span>Logo (optional)</span>
        <input type="file" id="brand-request-logo" accept="image/*" />
      </label>
      <div class="brand-signup__actions">
        <button type="submit" class="btn btn--primary">Submit request</button>
        <span id="brand-request-status" class="brand-signup__status"></span>
      </div>
      <p class="brand-signup__note">Becoming a ${who} is admin-approved — your request stays pending until reviewed.</p>
    </form>`;
}

/** The user's existing brand requests with their review status (or empty). */
export function renderMyBrands(brands) {
  if (!brands || brands.length === 0) return '';
  const items = brands.map((b) => {
    const label = STATUS_LABEL[b.status] || b.status;
    const logo = b.logo_url
      ? `<img class="brand-signup__brand-logo" src="${escapeHtml(b.logo_url)}" alt="" onerror="this.style.display='none'" />`
      : '<span class="brand-signup__brand-logo brand-signup__brand-logo--empty" aria-hidden="true"></span>';
    return `<li class="brand-signup__brand">
      ${logo}
      <span class="brand-signup__brand-slug">carkedit.com/${escapeHtml(b.slug)}</span>
      <span class="brand-signup__brand-name">${escapeHtml(b.name)}</span>
      <span class="brand-signup__brand-status brand-signup__brand-status--${escapeHtml(b.status)}">${escapeHtml(label)}</span>
    </li>`;
  }).join('');
  return `<div class="brand-signup__brands">
    <h2 class="brand-signup__brands-title">Your requests</h2>
    <ul class="brand-signup__brands-list">${items}</ul>
  </div>`;
}
