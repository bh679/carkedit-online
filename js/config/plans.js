// CarkedIt Online — Evangelist plan catalog (single source of truth).
//
// Shared by the pricing page (js/evangelist-pricing/app.js) and the brand-signup
// plan picker (js/brand-signup.js) so tier names + prices never drift. Keep the
// keys in sync with the API's allowed plan enum (carkedit-api POST /brands).
'use strict';

export const PLANS = [
  { key: 'basic', name: 'Basic', price: '$150', period: '/ year' },
  { key: 'pro', name: 'Pro', price: '$250', period: '/ year' },
  { key: 'ultimate', name: 'Ultimate', price: '$500', period: '/ year' },
];

export const PLAN_BY_KEY = Object.fromEntries(PLANS.map((p) => [p.key, p]));
export const PLAN_KEYS = PLANS.map((p) => p.key);

/** Normalise an incoming ?plan= value to a known key, or null if unknown. */
export function normalisePlan(value) {
  const key = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return Object.prototype.hasOwnProperty.call(PLAN_BY_KEY, key) ? key : null;
}
