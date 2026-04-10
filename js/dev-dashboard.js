// CarkedIt Online — Dev Dashboard
'use strict';

import { loadAllCards } from './data/cardTypes.js';
import { render as renderCard } from './components/card.js';
import { renderAdminHeader, bindAdminHeader } from './components/admin-header.js';

// ── Constants ─────────────────────────────────────────
const PRIMARY_REPO = 'bh679/carkedit-online';
const REPOS = [
  { name: 'bh679/carkedit-online', color: 'var(--color-die)', label: 'online', outdated: false },
  { name: 'bh679/carkedit-api', color: 'var(--color-primary)', label: 'api', outdated: false },
  { name: 'bh679/CarkedIt', color: 'var(--color-text-muted)', label: 'orc', outdated: false },
  { name: 'bh679/carkedit-client', color: 'var(--color-text-muted)', label: 'client', outdated: true },
  { name: 'bh679/fill-in-the-blank', color: 'var(--color-text-muted)', label: 'fitb', outdated: true },
];
const API = 'https://api.github.com';
const CACHE_TTL = 5 * 60 * 1000;
const DECK_TYPES = ['die', 'live', 'bye'];

const DESIGN_DOCS = [
  { file: 'gamedesign.md', label: 'Game Design', github: `https://github.com/${PRIMARY_REPO}/blob/main/gamedesign.md` },
  { file: 'gamerules.md', label: 'Game Rules', github: `https://github.com/${PRIMARY_REPO}/blob/main/gamerules.md` },
  { file: 'visualstyle.md', label: 'Visual Style', github: `https://github.com/${PRIMARY_REPO}/blob/main/visualstyle.md` },
];

// ── State ─────────────────────────────────────────────
const miniState = { decks: {}, deckType: 'die', index: 0 };
const commitCache = new Map();
const fetchedData = { commits: null, events: null, issues: null };
const docCache = new Map();
let activeDoc = null;
let rateLimitRemaining = null;
let rateLimitTotal = null;
let rateLimitReset = null;

// ── GitHub API Helper ─────────────────────────────────

function getToken() {
  const params = new URLSearchParams(window.location.search);
  const t = params.get('token');
  if (t) sessionStorage.setItem('gh_token', t);
  return sessionStorage.getItem('gh_token');
}

async function ghFetch(path) {
  const cacheKey = `gh:${path}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) {
    const { data, ts } = JSON.parse(cached);
    if (Date.now() - ts < CACHE_TTL) return data;
  }

  const headers = { Accept: 'application/vnd.github.v3+json' };
  const token = getToken();
  if (token) headers.Authorization = `token ${token}`;

  const res = await fetch(`${API}${path}`, { headers });
  rateLimitRemaining = res.headers.get('X-RateLimit-Remaining');
  rateLimitTotal = res.headers.get('X-RateLimit-Limit');
  const resetHeader = res.headers.get('X-RateLimit-Reset');
  if (resetHeader) rateLimitReset = parseInt(resetHeader, 10);

  if (!res.ok) {
    if (res.status === 403) throw new Error('Rate limited — try again later or add ?token=ghp_...');
    throw new Error(`GitHub API ${res.status}`);
  }

  const data = await res.json();
  // Don't cache 202 (GitHub "computing" responses — e.g. stats/commit_activity)
  if (res.status !== 202) {
    sessionStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() }));
  }
  return data;
}

async function ghPost(path, body) {
  const token = getToken();
  if (!token) throw new Error('GitHub token required — add ?token=ghp_...');
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `token ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API ${res.status}`);
  }
  return res.json();
}

// ── localStorage Persistence (rate-limit fallback) ────

const LS_PREFIX = 'gh-persist:';

function persistData(key, data) {
  try {
    localStorage.setItem(`${LS_PREFIX}${key}`, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* quota exceeded — ignore */ }
}

function loadPersistedData(key) {
  try {
    const raw = localStorage.getItem(`${LS_PREFIX}${key}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    return { data, ts };
  } catch {
    return null;
  }
}

function relativeTimeFromTs(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── Time Helpers ──────────────────────────────────────

function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function shortDate(dateStr) {
  return new Date(dateStr).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

// ── Repo Helpers ──────────────────────────────────────

function getRepoConfig(repoName) {
  return REPOS.find(r => r.name === repoName) || REPOS[0];
}

// ── Section: Contribution Graph ───────────────────────

function mergeContribData(datasets) {
  // Each dataset is an array of 52 weeks with days[0..6]
  // Merge by summing day counts across all repos
  const validSets = datasets.filter(d => Array.isArray(d) && d.length > 0);
  if (!validSets.length) return null;

  // Use the first valid set as the base structure
  const merged = validSets[0].map(week => ({
    ...week,
    days: [...week.days]
  }));

  for (let s = 1; s < validSets.length; s++) {
    const set = validSets[s];
    const len = Math.min(merged.length, set.length);
    for (let w = 0; w < len; w++) {
      for (let d = 0; d < 7; d++) {
        merged[w].days[d] = merged[w].days[d] + (set[w].days[d] || 0);
      }
    }
  }

  return merged;
}

const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function renderContribGraph(data) {
  if (!data || !data.length) return '<p class="dash-empty">No contribution data available.</p>';

  // Group weeks by the month of their Sunday date, keep only last 3 months
  const groups = new Map(); // monthKey -> { label, weeks[] }
  for (const week of data) {
    const weekTs = week.week * 1000;
    const sunday = new Date(weekTs);
    const monthKey = `${sunday.getFullYear()}-${sunday.getMonth()}`;
    if (!groups.has(monthKey)) {
      groups.set(monthKey, { label: monthNames[sunday.getMonth()], weeks: [] });
    }
    groups.get(monthKey).weeks.push(week);
  }

  const recentGroups = [...groups.values()].slice(-3);

  const monthGroupsHtml = recentGroups.map(({ label, weeks }) => {
    const weekRowsHtml = weeks.map(week => {
      const cellsHtml = Array.from({ length: 7 }, (_, d) => {
        const count = week.days[d];
        let level = 0;
        if (count >= 1) level = 1;
        if (count >= 3) level = 2;
        if (count >= 5) level = 3;
        if (count >= 8) level = 4;
        const weekTs = week.week * 1000;
        const cellDate = new Date(weekTs + d * 86400000);
        const dateStr = cellDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const tooltip = `${count} commit${count !== 1 ? 's' : ''} · ${dayNames[d]} ${dateStr}`;
        return `<div class="contrib-cell contrib-cell--${level}" data-tooltip="${tooltip}"></div>`;
      }).join('');
      return `<div class="contrib-week-row">${cellsHtml}</div>`;
    }).join('');
    return `<div class="contrib-month-group"><div class="contrib-month-label">${label}</div>${weekRowsHtml}</div>`;
  }).join('');

  return `
    <div class="contrib-wrapper">
      ${monthGroupsHtml}
    </div>
    <div class="contrib-legend">
      Less
      <div class="contrib-legend__cell contrib-cell"></div>
      <div class="contrib-legend__cell contrib-cell--1"></div>
      <div class="contrib-legend__cell contrib-cell--2"></div>
      <div class="contrib-legend__cell contrib-cell--3"></div>
      <div class="contrib-legend__cell contrib-cell--4"></div>
      More
    </div>
  `;
}

// ── Section: Recent Commits (Multi-repo) ──────────────

const DEFAULT_VISIBLE = 5;
const LOAD_MORE_STEP = 10;
const visibleCounts = { commits: DEFAULT_VISIBLE, wiki: DEFAULT_VISIBLE, todo: DEFAULT_VISIBLE };

function renderCommitsList(commits) {
  if (!commits || !commits.length) return '<p class="dash-empty">No commits found.</p>';

  const visible = visibleCounts.commits;
  const items = commits.slice(0, visible).map((c, i) => {
    const repo = getRepoConfig(c._repo);
    const msg = c.commit.message.split('\n')[0];
    const date = shortDate(c.commit.author.date);
    const sha = c.sha.slice(0, 7);
    const outdatedClass = repo.outdated ? ' commit-item--outdated' : '';

    return `
      <li class="commit-item${outdatedClass}" data-index="${i}" data-sha="${c.sha}" data-repo="${c._repo}">
        <div class="commit-item__row">
          <span class="commit-item__sha" style="color:${repo.color}">${sha}</span>
          <span class="commit-item__repo" style="border-color:${repo.color};color:${repo.color}">${repo.label}</span>
          <span class="commit-item__msg" title="${msg}">${msg}</span>
          <span class="commit-item__date">${date}</span>
        </div>
        <div class="commit-item__files" id="commit-files-${i}" style="display:none">
          <span class="dash-loading">Loading files...</span>
        </div>
      </li>
    `;
  }).join('');

  const remaining = commits.length - visible;
  const allLoaded = remaining <= 0;
  const showMoreBtn = allLoaded
    ? `<button class="btn btn--secondary dash-list-actions__btn" disabled>All loaded</button>`
    : `<button class="btn btn--secondary dash-list-actions__btn" onclick="window.devDash.showMore('commits')">Show more (${remaining})</button>`;

  const actions = `<div class="dash-list-actions">
    ${showMoreBtn}
    <a href="https://github.com/${PRIMARY_REPO}/commits/main" target="_blank" class="btn btn--secondary dash-list-actions__btn">View on GitHub &rarr;</a>
  </div>`;

  return `<ul class="commit-list">${items}</ul>${actions}`;
}

async function toggleCommitFiles(index, sha, repoName) {
  const el = document.getElementById(`commit-files-${index}`);
  if (!el) return;

  if (el.style.display !== 'none') {
    el.style.display = 'none';
    return;
  }

  el.style.display = 'block';

  const cacheKey = `${repoName}:${sha}`;
  if (commitCache.has(cacheKey)) {
    el.innerHTML = renderCommitFiles(commitCache.get(cacheKey), repoName, sha);
    return;
  }

  try {
    const detail = await ghFetch(`/repos/${repoName}/commits/${sha}`);
    commitCache.set(cacheKey, detail.files || []);
    el.innerHTML = renderCommitFiles(detail.files || [], repoName, sha);
    updateRateLimit();
  } catch (err) {
    el.innerHTML = `<span class="dash-error">${err.message}</span>`;
  }
}

function renderCommitFiles(files, repoName, sha) {
  const count = files.length;
  const list = files.length
    ? files.map(f => {
        const adds = f.additions ? `<span class="additions">+${f.additions}</span>` : '';
        const dels = f.deletions ? `<span class="deletions">-${f.deletions}</span>` : '';
        return `<li>${f.filename} ${adds} ${dels}</li>`;
      }).join('')
    : '';

  const fileInfo = count ? `<strong>${count} file${count !== 1 ? 's' : ''} changed</strong><ul>${list}</ul>` : '<span class="dash-empty">No file changes.</span>';
  const ghLink = `<a href="https://github.com/${repoName}/commit/${sha}" target="_blank" class="dash-card__link" style="margin-top:var(--space-xs);font-size:0.65rem">View commit on GitHub &rarr;</a>`;

  return `${fileInfo}${ghLink}`;
}

// ── Section: Design Docs Viewer ───────────────────────

function renderDesignDocs() {
  const tabs = DESIGN_DOCS.map(doc => {
    const isActive = activeDoc === doc.file;
    return `<button class="btn ${isActive ? 'btn--primary' : 'btn--secondary'} design-docs__tab"
      onclick="window.devDash.toggleDoc('${doc.file}')">${doc.label}</button>`;
  }).join('');

  return `
    <div class="design-docs__tabs">${tabs}</div>
    <div id="design-docs-content"></div>
  `;
}

async function toggleDoc(file) {
  const contentEl = document.getElementById('design-docs-content');
  if (!contentEl) return;

  // Collapse if same doc clicked
  if (activeDoc === file) {
    activeDoc = null;
    contentEl.innerHTML = '';
    rerenderSection('design-docs');
    return;
  }

  activeDoc = file;
  rerenderSection('design-docs');

  // Show loading
  const newContentEl = document.getElementById('design-docs-content');
  if (!newContentEl) return;
  newContentEl.innerHTML = '<span class="dash-loading">Loading...</span>';

  // Fetch doc
  if (!docCache.has(file)) {
    try {
      const res = await fetch(file);
      const text = await res.text();
      docCache.set(file, text);
    } catch {
      newContentEl.innerHTML = '<span class="dash-error">Failed to load document.</span>';
      return;
    }
  }

  const doc = DESIGN_DOCS.find(d => d.file === file);
  const content = docCache.get(file);
  newContentEl.innerHTML = `
    <pre class="design-docs__pre">${escapeHtml(content)}</pre>
    <a href="${doc.github}" target="_blank" class="dash-card__link" style="margin-top:var(--space-sm)">View on GitHub &rarr;</a>
  `;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Section: Mini Card Tester ─────────────────────────

function renderMiniCardTester() {
  const deck = miniState.decks[miniState.deckType] ?? [];
  const card = deck[miniState.index];

  const deckButtons = DECK_TYPES.map(type => `
    <button
      class="btn ${miniState.deckType === type ? 'btn--primary' : 'btn--secondary'}"
      onclick="window.devDash.switchDeck('${type}')"
    >${type.toUpperCase()}</button>
  `).join('');

  const cardHtml = card
    ? renderCard(card)
    : '<p class="dash-empty">Loading cards...</p>';

  const counter = deck.length
    ? `<span class="mini-card-tester__counter">Card ${miniState.index + 1} / ${deck.length}</span>`
    : '';

  return `
    <div class="mini-card-tester__decks">${deckButtons}</div>
    <div class="mini-card-tester__preview" id="mini-card-preview">${cardHtml}</div>
    ${counter}
  `;
}

function miniNextCard() {
  const deck = miniState.decks[miniState.deckType] ?? [];
  if (!deck.length) return;

  if (miniState.index < deck.length - 1) {
    miniState.index = miniState.index + 1;
  } else {
    const i = DECK_TYPES.indexOf(miniState.deckType);
    miniState.deckType = DECK_TYPES[(i + 1) % DECK_TYPES.length];
    miniState.index = 0;
  }
  rerenderSection('mini-card');
}

function miniSwitchDeck(deckType) {
  miniState.deckType = deckType;
  miniState.index = 0;
  rerenderSection('mini-card');
}

// ── Section: Color Palette ────────────────────────────

const COLOR_GROUPS = [
  {
    label: 'Core Theme',
    vars: ['--color-bg', '--color-surface', '--color-text', '--color-text-muted',
           '--color-white', '--color-primary', '--color-secondary', '--color-border']
  },
  {
    label: 'Deck Accents',
    vars: ['--color-die', '--color-live', '--color-bye']
  },
  {
    label: 'Card Overlays',
    vars: ['--color-card-image-bg', '--color-card-placeholder-start', '--color-card-placeholder-end']
  },
  {
    label: 'Player List',
    vars: ['--color-player-list-bg', '--color-player-list-label', '--color-chip-bg',
           '--color-chip-director-bg', '--color-chip-director-border', '--color-player-name', '--color-score']
  }
];

function renderColorPalette() {
  const style = getComputedStyle(document.documentElement);

  return COLOR_GROUPS.map(group => {
    const swatches = group.vars.map(v => {
      const value = style.getPropertyValue(v).trim();
      return `
        <div class="swatch">
          <div class="swatch__color" style="background:${value}"></div>
          <div class="swatch__info">
            <span class="swatch__name">${v.replace('--color-', '')}</span>
            <span class="swatch__value">${value}</span>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="palette-group__title">${group.label}</div>
      <div class="swatch-grid">${swatches}</div>
    `;
  }).join('');
}

// ── Section: Wiki Updates ─────────────────────────────

const wikiContentCache = new Map();

function renderWikiUpdates(events) {
  const wikiEvents = (events || []).filter(e => e.type === 'GollumEvent');

  if (!wikiEvents.length) {
    return '<p class="dash-empty">No recent wiki updates found.</p>';
  }

  const allItems = [];
  let idx = 0;
  for (const event of wikiEvents) {
    for (const page of event.payload.pages) {
      const wikiIdx = idx++;
      allItems.push(`
        <li class="wiki-item" data-wiki-idx="${wikiIdx}" data-wiki-page="${page.page_name}" data-wiki-url="${page.html_url}" style="cursor:pointer">
          <div class="wiki-item__title" style="color:var(--color-text)">${page.page_name.replace(/-/g, ' ')}</div>
          <div class="wiki-item__meta">${page.action} &middot; ${relativeTime(event.created_at)}</div>
          <div class="wiki-item__preview" id="wiki-preview-${wikiIdx}" style="display:none"></div>
        </li>
      `);
    }
  }

  const visible = visibleCounts.wiki;
  const remaining = allItems.length - visible;
  const allLoaded = remaining <= 0;
  const showMoreBtn = allLoaded
    ? `<button class="btn btn--secondary dash-list-actions__btn" disabled>All loaded</button>`
    : `<button class="btn btn--secondary dash-list-actions__btn" onclick="window.devDash.showMore('wiki')">Show more (${remaining})</button>`;

  const actions = `<div class="dash-list-actions">
    ${showMoreBtn}
    <a href="https://github.com/${PRIMARY_REPO}/wiki" target="_blank" class="btn btn--secondary dash-list-actions__btn">View Wiki &rarr;</a>
  </div>`;

  return `<ul class="wiki-list">${allItems.slice(0, visible).join('')}</ul>${actions}`;
}

async function toggleWikiItem(idx, pageName, url) {
  const el = document.getElementById(`wiki-preview-${idx}`);
  if (!el) return;

  if (el.style.display !== 'none') {
    el.style.display = 'none';
    return;
  }

  el.style.display = 'block';

  if (wikiContentCache.has(pageName)) {
    el.innerHTML = renderWikiPreview(wikiContentCache.get(pageName), url);
    return;
  }

  el.innerHTML = '<span class="dash-loading">Loading...</span>';

  try {
    // Fetch wiki page raw markdown via GitHub raw content
    const rawUrl = `https://raw.githubusercontent.com/wiki/${PRIMARY_REPO}/${encodeURIComponent(pageName)}.md`;
    const res = await fetch(rawUrl);
    const content = res.ok ? await res.text() : '';
    wikiContentCache.set(pageName, content);
    el.innerHTML = renderWikiPreview(content, url);
  } catch {
    wikiContentCache.set(pageName, '');
    el.innerHTML = renderWikiPreview('', url);
  }
}

function renderWikiPreview(content, url) {
  // Extract markdown headings (lines starting with #)
  const headings = content.split('\n')
    .filter(line => /^#{1,4}\s/.test(line.trim()))
    .map(line => {
      const level = line.match(/^(#+)/)[1].length;
      const text = line.replace(/^#+\s*/, '').trim();
      const indent = (level - 1) * 12;
      return `<div style="padding-left:${indent}px;font-size:0.65rem;color:var(--color-text-muted);padding:2px 0 2px ${indent}px">${text}</div>`;
    }).join('');

  let headingsHtml;
  if (headings) {
    headingsHtml = headings;
  } else if (content.trim()) {
    // No headings — show first 75 words as preview
    const words = content.replace(/[#*_`\[\]()>|]/g, '').trim().split(/\s+/).slice(0, 75).join(' ');
    headingsHtml = `<div style="font-size:0.65rem;color:var(--color-text-muted);padding:2px 0;line-height:1.5">${escapeHtml(words)}...</div>`;
  } else {
    headingsHtml = '<div style="font-size:0.65rem;color:var(--color-text-muted);padding:2px 0">No content available</div>';
  }

  return `
    <div style="margin-top:var(--space-xs);padding-top:var(--space-xs);border-top:1px solid var(--color-border)">
      ${headingsHtml}
      <a href="${url}" target="_blank" class="dash-card__link" style="margin-top:var(--space-xs);font-size:0.6rem">View full page on Wiki &rarr;</a>
    </div>
  `;
}

function attachWikiListeners() {
  const list = document.querySelector('.wiki-list');
  if (!list) return;
  list.addEventListener('click', (e) => {
    const item = e.target.closest('.wiki-item');
    if (!item || e.target.closest('a')) return;
    const { wikiIdx, wikiPage, wikiUrl } = item.dataset;
    toggleWikiItem(parseInt(wikiIdx, 10), wikiPage, wikiUrl);
  });
}

// ── Section: To-Do Board ──────────────────────────────

function renderTodoBoard(issues) {
  if (!issues || !issues.length) return '<p class="dash-empty">No open issues found.</p>';

  const visible = visibleCounts.todo;
  const items = issues.slice(0, visible).map(issue => {
    const labels = issue.labels.map(l =>
      `<span class="todo-label" style="background:#${l.color}22;color:#${l.color}">${l.name}</span>`
    ).join('');

    return `
      <li class="todo-item">
        <a href="${issue.html_url}" target="_blank" class="todo-item__title" style="color:var(--color-text);text-decoration:none">
          ${issue.title}
        </a>
        <div class="todo-item__meta">#${issue.number} &middot; ${relativeTime(issue.updated_at)}</div>
        ${labels ? `<div class="todo-item__labels">${labels}</div>` : ''}
      </li>
    `;
  }).join('');

  const remaining = issues.length - visible;
  const allLoaded = remaining <= 0;
  const showMoreBtn = allLoaded
    ? `<button class="btn btn--secondary dash-list-actions__btn" disabled>All loaded</button>`
    : `<button class="btn btn--secondary dash-list-actions__btn" onclick="window.devDash.showMore('todo')">Show more (${remaining})</button>`;

  const actions = `<div class="dash-list-actions">
    ${showMoreBtn}
    <a href="https://github.com/users/bh679/projects/12" target="_blank" class="btn btn--secondary dash-list-actions__btn">View Board &rarr;</a>
  </div>`;

  return `<ul class="todo-list">${items}</ul>${actions}`;
}

// ── List Show More ────────────────────────────────────

function showMore(name) {
  const prevCount = visibleCounts[name];
  visibleCounts[name] = visibleCounts[name] + LOAD_MORE_STEP;
  const el = document.getElementById(`section-${name}`);
  if (!el) return;

  // Find the last visible item before re-render to scroll to it after
  const listEl = el.querySelector('ul');
  const lastItem = listEl ? listEl.children[prevCount - 1] : null;
  const scrollTarget = lastItem ? lastItem.id || null : null;

  switch (name) {
    case 'commits':
      if (fetchedData.commits) {
        el.innerHTML = renderCommitsList(fetchedData.commits);
        attachCommitListeners();
      }
      break;
    case 'wiki':
      if (fetchedData.events) {
        el.innerHTML = renderWikiUpdates(fetchedData.events);
        attachWikiListeners();
      }
      break;
    case 'todo':
      if (fetchedData.issues) el.innerHTML = renderTodoBoard(fetchedData.issues);
      break;
  }

  // Scroll to the last previously-visible item (bottom of already-loaded content)
  const newListEl = el.querySelector('ul');
  if (newListEl && newListEl.children[prevCount - 1]) {
    newListEl.children[prevCount - 1].scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ── Dashboard Shell ───────────────────────────────────

function renderDashboard(sections) {
  return `
    <div style="padding:var(--space-md)">
      <div class="dash-header">
        <div style="display:flex;align-items:center;gap:var(--space-sm)">
          <span class="dash-header__title">Dev Dashboard</span>
          <span style="font-size:0.65rem;color:var(--color-text-muted)">v<span id="version-number">...</span></span>
        </div>
        <div class="dash-header__meta">
          <span id="rate-limit"></span>
          <button class="btn btn--accent-warn deploy-btn" style="padding:0.3rem 0.6rem;font-size:0.7rem" onclick="devDash.tagDeploy()">Tag &amp; Deploy</button>
          <a href="index.html" target="_blank" class="btn btn--primary" style="padding:0.3rem 0.75rem;font-size:0.75rem;text-decoration:none">Play Game</a>
          <button class="btn btn--secondary" style="padding:0.3rem 0.6rem;font-size:0.7rem" onclick="location.reload()">Refresh</button>
        </div>
      </div>

      <div class="dash-grid">

        <div class="dash-card dash-card--full">
          <div class="dash-card__title">Design Docs</div>
          <div id="section-design-docs">${sections.designDocs}</div>
        </div>

        <div class="dash-card--full dash-commits-row">
          <div class="dash-card dash-card--grow">
            <div class="dash-card__title">Recent Commits</div>
            <div id="section-commits">${sections.commits}</div>
          </div>
          <div class="dash-card dash-card--fit">
            <div class="dash-card__title">Contribution Graph</div>
            <div id="section-contrib">${sections.contrib}</div>
          </div>
        </div>

        <div class="dash-card">
          <div class="dash-card__title">Card Tester</div>
          <div id="section-mini-card">${sections.miniCard}</div>
          <a href="card-test" class="dash-card__link">Open Card Tester &rarr;</a>
        </div>

        <div class="dash-card">
          <div class="dash-card__title">Color Palette</div>
          <div id="section-palette">${sections.palette}</div>
          <a href="color-demo" class="dash-card__link">Open Color Demo &rarr;</a>
        </div>

        <div class="dash-card">
          <div class="dash-card__title">Wiki</div>
          <div id="section-wiki">${sections.wiki}</div>
          <a href="https://github.com/${PRIMARY_REPO}/wiki" target="_blank" class="dash-card__link">Open Wiki &rarr;</a>
        </div>

        <div class="dash-card">
          <div class="dash-card__title">To-Do Board</div>
          <div id="section-todo">${sections.todo}</div>
          <a href="https://github.com/users/bh679/projects/12" target="_blank" class="dash-card__link">Open Project Board &rarr;</a>
        </div>

      </div>
      <div id="deploy-modal-root"></div>
    </div>
  `;
}

// ── Section Re-render ─────────────────────────────────

function rerenderSection(name) {
  const el = document.getElementById(`section-${name}`);
  if (!el) return;

  switch (name) {
    case 'mini-card':
      el.innerHTML = renderMiniCardTester();
      attachMiniCardListeners();
      break;
    case 'palette':
      el.innerHTML = renderColorPalette();
      break;
    case 'design-docs':
      el.innerHTML = renderDesignDocs();
      break;
  }
}

function attachMiniCardListeners() {
  const preview = document.getElementById('mini-card-preview');
  if (preview) {
    preview.addEventListener('click', miniNextCard);
    preview.style.cursor = 'pointer';
  }
}

function attachCommitListeners() {
  const list = document.querySelector('.commit-list');
  if (!list) return;
  list.addEventListener('click', (e) => {
    const item = e.target.closest('.commit-item');
    if (!item) return;
    const { index, sha, repo } = item.dataset;
    toggleCommitFiles(parseInt(index, 10), sha, repo);
  });
}

function updateRateLimit() {
  const el = document.getElementById('rate-limit');
  if (!el) return;
  if (rateLimitRemaining === null) return;

  const total = rateLimitTotal || '?';
  let resetStr = '';
  if (rateLimitReset) {
    const resetDate = new Date(rateLimitReset * 1000);
    resetStr = ` · resets ${resetDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
  }

  const remaining = parseInt(rateLimitRemaining, 10);
  const warn = remaining <= 10 ? ' rate-limit--warn' : '';
  el.className = `rate-limit-indicator${warn}`;
  el.innerHTML = `API: ${rateLimitRemaining}/${total}${resetStr}`;
}

// ── Init ──────────────────────────────────────────────

function renderCachedLabel(ts) {
  return `<span class="dash-loading" style="font-style:normal">(cached ${relativeTimeFromTs(ts)})</span>`;
}

async function init() {
  const app = document.getElementById('app');

  // Load persisted data immediately for instant render
  const cachedCommits = loadPersistedData('commits');
  const cachedContrib = loadPersistedData('contrib');
  const cachedEvents = loadPersistedData('events');
  const cachedIssues = loadPersistedData('issues');

  const loadingSections = {
    contrib: '<span class="dash-loading">Loading...</span>',
    designDocs: '',
    commits: '<span class="dash-loading">Loading...</span>',
    miniCard: '<span class="dash-loading">Loading cards...</span>',
    palette: '',
    wiki: '<span class="dash-loading">Loading...</span>',
    todo: '<span class="dash-loading">Loading...</span>',
  };

  app.innerHTML = renderAdminHeader({ user: _fbUserInfo }) + renderDashboard(loadingSections);
  bindAdminHeader(app, {
    user: _fbUserInfo,
    onSignOut: async () => {
      if (_fbAuth) {
        const { signOut } = await import('https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js');
        await signOut(_fbAuth);
      }
      window.location.href = '/';
    },
  });

  // Render static sections immediately
  rerenderSection('palette');
  rerenderSection('design-docs');

  // Show cached data instantly while fresh data loads
  if (cachedCommits) {
    fetchedData.commits = cachedCommits.data;
    const commitsEl = document.getElementById('section-commits');
    if (commitsEl) {
      commitsEl.innerHTML = renderCommitsList(cachedCommits.data) + renderCachedLabel(cachedCommits.ts);
      attachCommitListeners();
    }
  }
  if (cachedContrib) {
    const contribEl = document.getElementById('section-contrib');
    if (contribEl) {
      const merged = mergeContribData(cachedContrib.data);
      if (merged) contribEl.innerHTML = renderContribGraph(merged) + renderCachedLabel(cachedContrib.ts);
    }
  }
  if (cachedEvents) {
    fetchedData.events = cachedEvents.data;
    const wikiEl = document.getElementById('section-wiki');
    if (wikiEl) {
      wikiEl.innerHTML = renderWikiUpdates(cachedEvents.data) + renderCachedLabel(cachedEvents.ts);
      attachWikiListeners();
    }
  }
  if (cachedIssues) {
    fetchedData.issues = cachedIssues.data;
    const todoEl = document.getElementById('section-todo');
    if (todoEl) {
      todoEl.innerHTML = renderTodoBoard(cachedIssues.data) + renderCachedLabel(cachedIssues.ts);
    }
  }

  // Load version from package.json
  fetch('package.json').then(r => r.json()).then(pkg => {
    const el = document.getElementById('version-number');
    if (el) el.textContent = pkg.version;
  }).catch(() => {});

  // Load cards for mini tester
  loadAllCards().then(allCards => {
    DECK_TYPES.forEach(type => {
      miniState.decks[type] = allCards.filter(c => c.typeId === type);
    });
    rerenderSection('mini-card');
  }).catch(() => {
    const el = document.getElementById('section-mini-card');
    if (el) el.innerHTML = '<span class="dash-error">Failed to load cards.</span>';
  });

  // Fetch GitHub data in parallel — commits and contrib from all repos + other data
  const commitFetches = REPOS.map(repo =>
    ghFetch(`/repos/${repo.name}/commits?per_page=10`).then(commits =>
      commits.map(c => ({ ...c, _repo: repo.name }))
    ).catch(() => [])
  );

  const allRepos = REPOS;
  const contribFetches = allRepos.map(repo =>
    ghFetch(`/repos/${repo.name}/stats/commit_activity`).catch(() => null)
  );

  const [commitsResults, contribResults, eventsResult, issuesResult] = await Promise.allSettled([
    Promise.all(commitFetches),
    Promise.all(contribFetches),
    ghFetch(`/repos/${PRIMARY_REPO}/events?per_page=100`),
    ghFetch(`/repos/${PRIMARY_REPO}/issues?state=open&per_page=20&sort=updated`),
  ]);

  updateRateLimit();

  // Update contrib graph (merged from all repos)
  const contribEl = document.getElementById('section-contrib');
  if (contribEl && contribResults.status === 'fulfilled') {
    const contribData = contribResults.value;
    const merged = mergeContribData(contribData);

    // Persist for offline/rate-limited use
    persistData('contrib', contribData);

    // Check if any repos returned non-array (202 = computing), clear their cache and retry
    const incomplete = contribData.some(d => !Array.isArray(d) || d.length === 0);
    if (incomplete) {
      allRepos.forEach((repo, i) => {
        if (!Array.isArray(contribData[i]) || contribData[i].length === 0) {
          sessionStorage.removeItem(`gh:/repos/${repo.name}/stats/commit_activity`);
        }
      });
      setTimeout(async () => {
        const retryFetches = allRepos.map(repo =>
          ghFetch(`/repos/${repo.name}/stats/commit_activity`).catch(() => null)
        );
        const retryData = await Promise.all(retryFetches);
        const retryMerged = mergeContribData(retryData);
        if (retryMerged && contribEl) {
          contribEl.innerHTML = renderContribGraph(retryMerged);
          persistData('contrib', retryData);
        }
        updateRateLimit();
      }, 3000);
    }

    contribEl.innerHTML = merged
      ? renderContribGraph(merged)
      : '<p class="dash-empty">Loading contribution data... (retrying)</p>';
  } else if (contribEl && !cachedContrib) {
    contribEl.innerHTML = `<span class="dash-error">${contribResults.reason?.message || 'Failed to load'}</span>`;
  }

  // Merge and sort all commits by date
  if (commitsResults.status === 'fulfilled') {
    const allCommits = commitsResults.value.flat();
    allCommits.sort((a, b) => new Date(b.commit.author.date) - new Date(a.commit.author.date));
    fetchedData.commits = allCommits;
    persistData('commits', allCommits);
  }
  const commitsEl = document.getElementById('section-commits');
  if (commitsEl) {
    commitsEl.innerHTML = fetchedData.commits
      ? renderCommitsList(fetchedData.commits)
      : '<span class="dash-error">Failed to load commits</span>';
    attachCommitListeners();
  }

  // Store and update wiki
  if (eventsResult.status === 'fulfilled') {
    fetchedData.events = eventsResult.value;
    persistData('events', eventsResult.value);
  }
  const wikiEl = document.getElementById('section-wiki');
  if (wikiEl) {
    wikiEl.innerHTML = eventsResult.status === 'fulfilled'
      ? renderWikiUpdates(eventsResult.value)
      : (cachedEvents ? renderWikiUpdates(cachedEvents.data) + renderCachedLabel(cachedEvents.ts) : `<span class="dash-error">${eventsResult.reason?.message || 'Failed to load'}</span>`);
    attachWikiListeners();
  }

  // Store and update todo
  if (issuesResult.status === 'fulfilled') {
    fetchedData.issues = issuesResult.value;
    persistData('issues', issuesResult.value);
  }
  const todoEl = document.getElementById('section-todo');
  if (todoEl) {
    todoEl.innerHTML = issuesResult.status === 'fulfilled'
      ? renderTodoBoard(issuesResult.value)
      : (cachedIssues ? renderTodoBoard(cachedIssues.data) + renderCachedLabel(cachedIssues.ts) : `<span class="dash-error">${issuesResult.reason?.message || 'Failed to load'}</span>`);
  }
}

// ── Tag & Deploy ─────────────────────────────────────

const TAG_REPOS = [
  { name: 'bh679/carkedit-online', label: 'online' },
  { name: 'bh679/carkedit-api', label: 'api' },
];

let _isOnMain = false;

async function detectIfOnMain() {
  try {
    const localPkg = await fetch('package.json').then(r => r.json());
    const remotePkgContent = await ghFetch(`/repos/bh679/carkedit-online/contents/package.json?ref=main`);
    const remotePkg = JSON.parse(atob(remotePkgContent.content));
    return localPkg.version === remotePkg.version;
  } catch {
    return false;
  }
}

function tagPrefix() {
  return _isOnMain ? 'v' : 't';
}

async function fetchRepoTagInfo(repo, prefix) {
  const pkgContent = await ghFetch(`/repos/${repo}/contents/package.json?ref=main`);
  const pkg = JSON.parse(atob(pkgContent.content));
  const version = pkg.version;
  const tag = `${prefix}${version}`;

  let tagExists = false;
  try {
    await ghFetch(`/repos/${repo}/git/ref/tags/${tag}`);
    tagExists = true;
  } catch (e) { tagExists = false; }

  const ref = await ghFetch(`/repos/${repo}/git/ref/heads/main`);
  const sha = ref.object.sha;

  return { repo, version, tag, tagExists, sha };
}

function renderDeployModal(infos, state, isOnMain) {
  const modeLabel = isOnMain
    ? '<span class="deploy-status deploy-status--ok">PRODUCTION (v-tag, triggers deploy)</span>'
    : '<span class="deploy-status deploy-status--warn">TEST (t-tag, no deploy)</span>';

  const rows = infos.map((info, i) => {
    const status = state === 'loading' ? '<span class="deploy-status deploy-status--pending">checking...</span>'
      : info.tagExists ? '<span class="deploy-status deploy-status--exists">tag exists</span>'
      : '<span class="deploy-status deploy-status--new">will create</span>';
    const result = info.result
      ? (info.result === 'ok' ? '<span class="deploy-status deploy-status--ok">done</span>'
        : `<span class="deploy-status deploy-status--error">${info.result}</span>`)
      : '';
    return `<tr>
      <td><strong>${info.label || info.repo.split('/')[1]}</strong></td>
      <td><code>${info.tag || '...'}</code></td>
      <td><code style="font-size:0.6rem">${info.sha ? info.sha.slice(0, 7) : '...'}</code></td>
      <td>${result || status}</td>
    </tr>`;
  }).join('');

  const canDeploy = state === 'ready' && infos.some(i => !i.tagExists);
  const btnLabel = isOnMain ? 'Create Tags & Deploy' : 'Create Test Tags';
  const buttons = state === 'done'
    ? `<button class="btn btn--secondary" onclick="devDash.closeDeployModal()">Close</button>`
    : state === 'deploying'
    ? `<button class="btn btn--secondary" disabled>Tagging...</button>`
    : `<button class="btn btn--secondary" onclick="devDash.closeDeployModal()">Cancel</button>
       <button class="btn ${isOnMain ? 'btn--primary' : 'btn--accent-warn'}" ${canDeploy ? `onclick="devDash.confirmDeploy()"` : 'disabled'}>${canDeploy ? btnLabel : 'All tagged'}</button>`;

  return `<div class="deploy-overlay" onclick="devDash.closeDeployModal()">
    <div class="deploy-modal" onclick="event.stopPropagation()">
      <div class="deploy-modal__title">Tag & Deploy</div>
      <div class="deploy-modal__mode">${modeLabel}</div>
      <table class="deploy-table">
        <thead><tr><th>Repo</th><th>Tag</th><th>SHA</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="deploy-modal__actions">${buttons}</div>
    </div>
  </div>`;
}

let _deployInfos = [];

async function tagDeploy() {
  const el = document.getElementById('deploy-modal-root');
  if (!el) return;

  // Show loading state
  const placeholders = TAG_REPOS.map(r => ({ repo: r.name, label: r.label }));
  el.innerHTML = renderDeployModal(placeholders, 'loading', _isOnMain);

  try {
    _isOnMain = await detectIfOnMain();
    const prefix = tagPrefix();
    _deployInfos = await Promise.all(TAG_REPOS.map(r =>
      fetchRepoTagInfo(r.name, prefix).then(info => ({ ...info, label: r.label }))
    ));
    el.innerHTML = renderDeployModal(_deployInfos, 'ready', _isOnMain);

    // Update button color to reflect branch state
    const btn = document.querySelector('.deploy-btn');
    if (btn) {
      btn.className = `btn ${_isOnMain ? 'btn--accent' : 'btn--accent-warn'}`;
    }
  } catch (err) {
    el.innerHTML = renderDeployModal(
      [{ repo: 'error', label: 'Error', tag: '', sha: '', tagExists: false, result: err.message }],
      'done', _isOnMain
    );
  }
}

async function confirmDeploy() {
  const el = document.getElementById('deploy-modal-root');
  if (!el) return;

  el.innerHTML = renderDeployModal(_deployInfos, 'deploying', _isOnMain);

  for (const info of _deployInfos) {
    if (info.tagExists) { info.result = 'ok'; continue; }
    try {
      await ghPost(`/repos/${info.repo}/git/refs`, {
        ref: `refs/tags/${info.tag}`,
        sha: info.sha,
      });
      info.result = 'ok';
    } catch (err) {
      info.result = err.message;
    }
    el.innerHTML = renderDeployModal(_deployInfos, 'deploying', _isOnMain);
  }

  el.innerHTML = renderDeployModal(_deployInfos, 'done', _isOnMain);
}

function closeDeployModal() {
  const el = document.getElementById('deploy-modal-root');
  if (el) el.innerHTML = '';
}

// ── Public API ────────────────────────────────────────

window.devDash = { switchDeck: miniSwitchDeck, nextCard: miniNextCard, showMore, toggleDoc, tagDeploy, confirmDeploy, closeDeployModal };

// ── Admin Auth Gate ─────────────────────────────────
let _fbAuth = null;
let _fbUserInfo = null;

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyC6QJz6jTzJkBWV7Shd9XpCfHWrovJ9vaI",
  authDomain: "carkedit-5cc8e.firebaseapp.com",
  projectId: "carkedit-5cc8e",
  storageBucket: "carkedit-5cc8e.firebasestorage.app",
  messagingSenderId: "144073275425",
  appId: "1:144073275425:web:2301fbbccc2be69c654b60",
};

function renderAuthGate(msg, showSignIn = false) {
  document.getElementById('app').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:80vh;text-align:center">
      <div style="max-width:400px">
        <h1 style="margin-bottom:0.5em">Dev Dashboard</h1>
        <p style="color:#888;margin-bottom:1.5em">${msg}</p>
        ${showSignIn ? '<button class="btn btn--google" id="gate-sign-in" style="font-size:1rem;padding:0.75em 1.5em">Sign in with Google</button>' : ''}
        <div style="margin-top:1.5em"><a href="/" class="btn" style="background:transparent;color:var(--color-text-muted,#888);font-size:0.875rem;text-decoration:none">Back to Main Menu</a></div>
      </div>
    </div>`;
}

document.addEventListener('DOMContentLoaded', async () => {
  renderAuthGate('Loading...', false);
  try {
    const [appMod, authMod] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js'),
    ]);
    const fbApp = appMod.initializeApp(FIREBASE_CONFIG);
    const fbAuth = authMod.getAuth(fbApp);
    _fbAuth = fbAuth;

    authMod.onAuthStateChanged(fbAuth, async (user) => {
      if (!user) {
        renderAuthGate('Sign in to access the dev dashboard.', true);
        document.getElementById('gate-sign-in')?.addEventListener('click', async () => {
          const provider = new authMod.GoogleAuthProvider();
          await authMod.signInWithPopup(fbAuth, provider);
        });
        return;
      }
      const token = await user.getIdToken();
      try {
        const res = await fetch('/api/carkedit/users/me', { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) { window.location.href = '/'; return; }
        const me = await res.json();
        if (!me.is_admin) {
          // Try bootstrap
          const bRes = await fetch('/api/carkedit/admin/bootstrap', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
          if (!bRes.ok) { window.location.href = '/'; return; }
        }
      } catch { window.location.href = '/'; return; }
      _fbUserInfo = { displayName: user.displayName, photoURL: user.photoURL, email: user.email };
      // Load GitHub token from server config (if not already set via URL param)
      if (!getToken()) {
        try {
          const cfgRes = await fetch('/api/carkedit/dev/config', { headers: { Authorization: `Bearer ${token}` } });
          if (cfgRes.ok) {
            const cfg = await cfgRes.json();
            if (cfg.githubToken) sessionStorage.setItem('gh_token', cfg.githubToken);
          }
        } catch { /* ignore — token just won't be available */ }
      }
      await init();
    });
  } catch (err) {
    console.warn('[dev-dashboard] Firebase init failed:', err);
    renderAuthGate('Authentication service unavailable.', false);
  }
});
