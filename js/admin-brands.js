// CarkedIt Online — Admin brand-review render helpers.
//
// Pure, DOM-free HTML builders for admin-brands.html (global-admin review UI).
// Kept out of the page's inline boot so they're unit-testable (see
// admin-brands.test.js). The page wires Firebase auth + authFetch + event
// delegation; these functions only turn brand rows into markup.
'use strict';

import { escapeHtml } from './utils/escape.js';

/** Brand lifecycle states (mirrors the API BrandStatus union). */
export const BRAND_STATUSES = ['pending', 'approved', 'rejected', 'suspended'];

const STATUS_LABEL = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  suspended: 'Suspended',
};

/** Coloured status pill for a brand. Unknown values fall back to 'pending'. */
export function statusBadge(status) {
  const s = BRAND_STATUSES.includes(status) ? status : 'pending';
  return `<span class="admin-brands__badge admin-brands__badge--${s}">${STATUS_LABEL[s]}</span>`;
}

/** <option> list for the status filter ('' = All). */
export function filterOptions(selected) {
  const sel = selected || '';
  const opts = [['', 'All'], ...BRAND_STATUSES.map((s) => [s, STATUS_LABEL[s]])];
  return opts
    .map(([v, label]) => `<option value="${v}"${v === sel ? ' selected' : ''}>${label}</option>`)
    .join('');
}

/** Which review actions make sense from a given status. */
export function actionsFor(status) {
  switch (status) {
    case 'pending': return ['approve', 'reject'];
    case 'approved': return ['suspend'];
    case 'rejected': return ['approve'];
    case 'suspended': return ['approve'];
    default: return ['approve', 'reject'];
  }
}

const ACTION_TO_STATUS = { approve: 'approved', reject: 'rejected', suspend: 'suspended' };
const ACTION_LABEL = { approve: 'Approve', reject: 'Reject', suspend: 'Suspend' };

function adminPanelButton(brand) {
  if (brand.status !== 'approved') return '';
  const slug = escapeHtml(brand.slug);
  return ` <a class="admin-brands__btn admin-brands__btn--admin" href="/${slug}/admin" target="_blank" rel="noopener">Admin Panel</a>`;
}

function actionButtons(brand) {
  const reviewBtns = actionsFor(brand.status)
    .map((a) =>
      `<button class="admin-brands__btn admin-brands__btn--${a}" ` +
      `data-brand-id="${escapeHtml(brand.id)}" data-status="${ACTION_TO_STATUS[a]}">${ACTION_LABEL[a]}</button>`,
    )
    .join(' ');
  return reviewBtns + adminPanelButton(brand);
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' });
  } catch {
    return '—';
  }
}

function ownerCell(brand) {
  const name = brand.owner_display_name ? escapeHtml(brand.owner_display_name) : '—';
  const email = brand.owner_email
    ? `<br><span class="admin-brands__owner-email">${escapeHtml(brand.owner_email)}</span>`
    : '';
  return `${name}${email}`;
}

function logoCell(brand) {
  return brand.logo_url
    ? `<img class="admin-brands__logo" src="${escapeHtml(brand.logo_url)}" alt="" onerror="this.style.display='none'" />`
    : '<span class="admin-brands__logo admin-brands__logo--empty" aria-hidden="true"></span>';
}

function slugCell(brand) {
  const slug = escapeHtml(brand.slug);
  const fullUrl = `https://play.carkedit.com/${slug}`;
  return `<button class="admin-brands__slug admin-brands__slug--copy" data-copy-url="${escapeHtml(fullUrl)}" title="Copy: ${escapeHtml(fullUrl)}">/${slug}</button>`;
}

/** One <tr> for a brand request. */
export function renderBrandRow(brand) {
  return `<tr>
    <td>${logoCell(brand)}</td>
    <td>${slugCell(brand)}</td>
    <td>${escapeHtml(brand.name)}</td>
    <td>${ownerCell(brand)}</td>
    <td>${fmtDate(brand.created_at)}</td>
    <td>${statusBadge(brand.status)}</td>
    <td class="admin-brands__actions">${actionButtons(brand)}</td>
  </tr>`;
}

/** Full review table, or an empty-state message. */
export function renderBrandsTable(brands) {
  if (!brands || brands.length === 0) {
    return '<p class="admin-brands__empty">No brand requests.</p>';
  }
  const rows = brands.map(renderBrandRow).join('');
  return `<table class="admin-brands__table">
    <thead><tr>
      <th>Logo</th><th>URL</th><th>Name</th><th>Owner</th><th>Requested</th><th>Status</th><th>Actions</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}
