// CarkedIt Online — Brand-request ("Evangelist") render helpers.
//
// Pure, DOM-free HTML builders for brand-signup.html (the self-serve request
// page linked from the account screen). Kept out of the page's inline boot so
// they're unit-testable (see brand-signup.test.js). The page wires Firebase
// auth + authFetch + submit/slug-check; these only turn data into markup.
'use strict';

import { escapeHtml } from './utils/escape.js';
import { PLANS, normalisePlan } from './config/plans.js';

const STATUS_LABEL = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  suspended: 'Suspended',
};

// Re-exported from the shared plan catalog so the page + tests have one import.
export { normalisePlan };
export const PLAN_LABELS = Object.fromEntries(PLANS.map((p) => [p.key, p.name]));

/**
 * A plan picker, pre-selected to the plan chosen on the pricing page (if any).
 * The user can switch plans here, so this is an editable <select>, not a label.
 * Each option shows the price after the name on one line, e.g. "Pro — $250 / year".
 */
export function renderPlanSelect(plan, id = 'brand-request-plan') {
  const selected = normalisePlan(plan);
  const options = PLANS
    .map((p) => {
      const label = `${p.name} — ${p.price} ${p.period}`;
      return `<option value="${escapeHtml(p.key)}"${p.key === selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;
    })
    .join('');
  return `
    <label class="brand-signup__field brand-signup__plan">
      <span>Plan</span>
      <select id="${escapeHtml(id)}" class="brand-signup__plan-select">
        <option value=""${selected ? '' : ' selected'}>— Choose a plan —</option>
        ${options}
      </select>
    </label>`;
}

/**
 * The request form. `evangelist` is the configurable role label for copy;
 * `plan` (optional) is the tier chosen on the pricing page, pre-selected in the
 * plan picker (the user can switch it here); `email` (optional) pre-fills the
 * contact email from the signed-in account.
 */
export function renderRequestForm(evangelist = 'Evangelist', plan = null, email = '') {
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
      <p class="brand-signup__slug-hint" id="brand-slug-hint">play.carkedit.com/&lt;your-url&gt;</p>
      <label class="brand-signup__field">
        <span>Contact email</span>
        <input type="email" id="brand-request-email" maxlength="160" required
          value="${escapeHtml(email)}" placeholder="you@example.com" />
      </label>
      <label class="brand-signup__field">
        <span>Phone number</span>
        <input type="tel" id="brand-request-phone" maxlength="40" required
          autocomplete="tel" placeholder="+61 400 000 000" />
      </label>
      <label class="brand-signup__field">
        <span>Logo (optional)</span>
        <input type="file" id="brand-request-logo" accept="image/*" />
      </label>
      <div class="brand-signup__actions">
        <button type="submit" class="btn btn--primary brand-signup__submit">Submit request</button>
        <span id="brand-request-status" class="brand-signup__status"></span>
      </div>
      <p class="brand-signup__note">Becoming a ${who} is admin-approved — your request stays pending until reviewed.</p>
    </form>`;
}

/**
 * The user's existing brand requests with their review status (or empty).
 * Each row is clickable to expand it into an inline edit form; the row whose id
 * matches `expandedId` renders that form beneath it.
 */
export function renderMyBrands(brands, expandedId = null, evangelist = 'Evangelist') {
  if (!brands || brands.length === 0) return '';
  const items = brands.map((b) => {
    const id = escapeHtml(b.id);
    const expanded = b.id === expandedId;
    const label = STATUS_LABEL[b.status] || b.status;
    const logo = b.logo_url
      ? `<img class="brand-signup__brand-logo" src="${escapeHtml(b.logo_url)}" alt="" onerror="this.style.display='none'" />`
      : '<span class="brand-signup__brand-logo brand-signup__brand-logo--empty" aria-hidden="true"></span>';
    return `<li class="brand-signup__brand-item${expanded ? ' brand-signup__brand-item--expanded' : ''}">
      <div class="brand-signup__brand brand-signup__brand--clickable" role="button" tabindex="0"
        aria-expanded="${expanded}"
        onclick="window.brandSignup.expandRequest('${id}')"
        onkeydown="window.brandSignup.onBrandKey(event, '${id}')">
        ${logo}
        <span class="brand-signup__brand-slug">play.carkedit.com/${escapeHtml(b.slug)}</span>
        <span class="brand-signup__brand-name">${escapeHtml(b.name)}</span>
        <span class="brand-signup__brand-status brand-signup__brand-status--${escapeHtml(b.status)}">${escapeHtml(label)}</span>
        <span class="brand-signup__brand-chevron" aria-hidden="true">${expanded ? '▾' : '▸'}</span>
      </div>
      ${expanded ? renderEditForm(b, evangelist) : ''}
    </li>`;
  }).join('');
  return `<div class="brand-signup__brands">
    <h2 class="brand-signup__brands-title">Your requests</h2>
    <ul class="brand-signup__brands-list">${items}</ul>
  </div>`;
}

/**
 * Inline editor for an existing request, pre-filled from `brand`. Uses
 * edit-prefixed ids so it never collides with the create form, and submits to
 * window.brandSignup.saveEdit. Status is shown read-only (edits never change it).
 */
export function renderEditForm(brand, evangelist = 'Evangelist') {
  const id = escapeHtml(brand.id);
  const who = escapeHtml(evangelist);
  const label = STATUS_LABEL[brand.status] || brand.status;
  const logoPreview = brand.logo_url
    ? `<img class="brand-signup__edit-logo" src="${escapeHtml(brand.logo_url)}" alt="current logo" onerror="this.style.display='none'" />`
    : '';
  return `
    <form class="brand-signup__form brand-signup__edit-form"
      onsubmit="return window.brandSignup.saveEdit(event, '${id}')">
      <p class="brand-signup__edit-status-line">Status:
        <span class="brand-signup__brand-status brand-signup__brand-status--${escapeHtml(brand.status)}">${escapeHtml(label)}</span>
      </p>
      ${renderPlanSelect(brand.plan, 'edit-brand-plan')}
      <label class="brand-signup__field">
        <span>Brand name</span>
        <input type="text" id="edit-brand-name" maxlength="80" required
          value="${escapeHtml(brand.name || '')}" placeholder="Acme Funeral Co." />
      </label>
      <label class="brand-signup__field">
        <span>Desired URL</span>
        <input type="text" id="edit-brand-slug" maxlength="40" required autocomplete="off"
          value="${escapeHtml(brand.slug || '')}" placeholder="acme" />
      </label>
      <p class="brand-signup__slug-hint">play.carkedit.com/${escapeHtml(brand.slug || '<your-url>')}</p>
      <label class="brand-signup__field">
        <span>Contact email</span>
        <input type="email" id="edit-brand-email" maxlength="160" required
          value="${escapeHtml(brand.contact_email || '')}" placeholder="you@example.com" />
      </label>
      <label class="brand-signup__field">
        <span>Phone number</span>
        <input type="tel" id="edit-brand-phone" maxlength="40" required autocomplete="tel"
          value="${escapeHtml(brand.contact_phone || '')}" placeholder="+61 400 000 000" />
      </label>
      <label class="brand-signup__field">
        <span>Logo (optional — replaces current)</span>
        ${logoPreview}
        <input type="file" id="edit-brand-logo" accept="image/*" />
      </label>
      <div class="brand-signup__actions">
        <button type="submit" class="btn btn--primary brand-signup__submit">Save changes</button>
        <button type="button" class="btn btn--secondary brand-signup__cancel"
          onclick="window.brandSignup.collapseRequest()">Cancel</button>
        <span id="edit-brand-status" class="brand-signup__status"></span>
      </div>
      <p class="brand-signup__note">Editing a ${who} request keeps its current review status.</p>
    </form>`;
}
