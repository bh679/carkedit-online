// CarkedIt Online — Survey responses viewer (shared component).
//
// Extracted from dashboard.js #survey-responses so the Stats page and the
// brand-admin page render the survey list from ONE code path. (The NPS summary
// cards stay in the dashboard stats bar — this is just the responses list.)
// Owns its dev-filter + pagination state; registers handlers on window[ns].
//
// mountSurveyResponses(rootEl, {
//   authFetch, surveyBase,           // surveyBase: '/api/carkedit' or '/api/carkedit/brands/<id>'
//   ns = 'surveyView', pageSize = 5,
//   patchDevFlag = null,             // (kind, id, next) => Promise; DEV read-only if null
//   confirmDevToggle = null,         // (kind, label, next) => Promise<boolean>
//   seeAllHref = null,               // () => string | null
// }) → { refresh }
'use strict';

import { escapeHtml } from '../utils/escape.js';

function escAttr(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
}

function npsBucketClass(score) {
  if (score >= 9) return 'nps-chip--promoter';
  if (score >= 7) return 'nps-chip--passive';
  return 'nps-chip--detractor';
}

const TRUNCATE_CHARS = 280;
const TRUNCATE_LINES = 5;
function shouldTruncate(text) {
  if (!text) return false;
  if (text.length > TRUNCATE_CHARS) return true;
  return text.split('\n').length > TRUNCATE_LINES;
}
function fieldClass(text) {
  return shouldTruncate(text) ? 'survey-response__field survey-response__field--truncatable' : 'survey-response__field';
}
function fieldOnclick(text) {
  return shouldTruncate(text) ? ` onclick="this.classList.toggle('survey-response__field--expanded')"` : '';
}

export function mountSurveyResponses(rootEl, opts = {}) {
  const {
    authFetch, surveyBase, ns = 'surveyView', pageSize = 5,
    patchDevFlag = null, confirmDevToggle = null, seeAllHref = null,
  } = opts;

  const state = { responses: [], total: 0, devFilter: 'nodev', loaded: false };

  async function fetchResponses(append = false) {
    try {
      const offset = append ? state.responses.length : 0;
      const devParam = state.devFilter !== 'all' ? `&dev=${state.devFilter}` : '';
      const res = await authFetch(`${surveyBase}/surveys?limit=${pageSize}&offset=${offset}${devParam}`);
      if (res.ok) {
        const data = await res.json();
        const incoming = data.responses || [];
        state.responses = append ? [...state.responses, ...incoming] : incoming;
        state.total = data.total || 0;
      }
    } catch (err) { console.warn('[survey-responses-viewer] fetch failed:', err); }
  }

  function render() {
    if (!state.loaded) { rootEl.innerHTML = '<p class="dashboard__empty">Loading…</p>'; return; }
    const devLabels = { all: 'With Dev', nodev: 'No Dev', dev: 'Only Dev' };
    const devActive = state.devFilter !== 'all' ? 'dashboard__filter-btn--active' : '';
    const filterBar = `
      <div class="dashboard__filter-bar">
        <button class="dashboard__filter-btn ${devActive}" onclick="window.${ns}.cycleSurveyDev()">${devLabels[state.devFilter]}</button>
      </div>`;
    const seeAllBtn = seeAllHref ? `<a class="dashboard__see-all" href="${seeAllHref()}">See all</a>` : '';

    if (state.responses.length === 0) {
      rootEl.innerHTML = `${filterBar}<p class="dashboard__empty">No survey responses yet.</p>`;
      return;
    }

    const rows = state.responses.map((r) => {
      const date = new Date(r.created_at).toLocaleString();
      const bucket = npsBucketClass(r.nps_score);
      const player = r.player_name || '(anonymous)';
      const rawComment = r.comment || '';
      const rawImprovement = r.improvement || '';
      const sid = escAttr(String(r.id));
      const devCell = patchDevFlag
        ? `<button class="dashboard__dev-toggle ${r.is_dev ? 'is-on' : ''}" title="Toggle dev" onclick="window.${ns}.toggleSurveyDev('${sid}', ${!r.is_dev})">DEV</button>`
        : `<span class="dashboard__dev-toggle ${r.is_dev ? 'is-on' : ''}" title="Read-only" style="opacity:0.4;cursor:not-allowed">DEV</span>`;
      return `
        <div class="survey-response">
          <div class="survey-response__header">
            <span class="nps-chip ${bucket}">${r.nps_score}</span>
            <span class="survey-response__player">${escapeHtml(player)}</span>
            <span class="survey-response__date">${date}</span>
            ${devCell}
          </div>
          ${rawComment ? `<div class="${fieldClass(rawComment)}"${fieldOnclick(rawComment)}><strong>Comment:</strong> ${escapeHtml(rawComment)}</div>` : ''}
          ${rawImprovement ? `<div class="${fieldClass(rawImprovement)}"${fieldOnclick(rawImprovement)}><strong>Improve:</strong> ${escapeHtml(rawImprovement)}</div>` : ''}
        </div>`;
    }).join('');

    const hasMore = state.responses.length < state.total;
    const loadMoreBtn = hasMore
      ? `<button class="dashboard__load-more" onclick="window.${ns}.loadMoreSurveys()">Load more (${state.responses.length} of ${state.total})</button>`
      : '';
    const actionsClass = hasMore ? 'dashboard__list-actions' : 'dashboard__list-actions dashboard__list-actions--solo';
    const actions = (loadMoreBtn || seeAllBtn) ? `<div class="${actionsClass}">${loadMoreBtn}${seeAllBtn}</div>` : '';

    rootEl.innerHTML = `
      ${filterBar}
      <div class="survey-responses__summary">Showing ${state.responses.length} of ${state.total} responses</div>
      <div class="survey-responses__list">${rows}</div>
      ${actions}`;
  }

  const handlers = {
    async loadMoreSurveys() { await fetchResponses(true); render(); },
    async cycleSurveyDev() {
      const o = ['nodev', 'all', 'dev'];
      state.devFilter = o[(o.indexOf(state.devFilter) + 1) % o.length];
      await fetchResponses(false);
      render();
    },
    async toggleSurveyDev(id, next) {
      if (!patchDevFlag) return;
      const r = state.responses.find((x) => String(x.id) === String(id));
      const label = r ? `NPS ${r.nps_score} — ${r.player_name || '(anonymous)'}` : String(id);
      if (confirmDevToggle && !await confirmDevToggle('Survey response', label, next)) return;
      try {
        await patchDevFlag('surveys', id, next);
        await fetchResponses(false);
        render();
      } catch (e) { console.error(e); alert('Failed to toggle dev: ' + e.message); }
    },
  };
  if (typeof window !== 'undefined') {
    window[ns] = Object.assign(window[ns] || {}, handlers);
  }

  async function refresh() {
    await fetchResponses(false);
    state.loaded = true;
    render();
  }

  render();
  refresh();
  return { refresh };
}
