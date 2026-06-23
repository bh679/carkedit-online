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

/** The request form. `evangelist` is the configurable role label for copy. */
export function renderRequestForm(evangelist = 'Evangelist') {
  const who = escapeHtml(evangelist);
  return `
    <form id="brand-request-form" class="brand-signup__form" onsubmit="return window.brandSignup.submit(event)">
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
    return `<li class="brand-signup__brand">
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
