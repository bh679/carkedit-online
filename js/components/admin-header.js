// CarkedIt Online — Shared Admin Header Component
'use strict';

const NAV_LINKS = [
  { label: '\u2190',  path: '.', className: 'admin-header__link--back' },
  { label: 'Stats',   path: 'stats' },
  { label: 'Users',   path: 'admin-users' },
  { label: 'ImageAI', path: 'admin-image-gen' },
  { label: 'Dev',     path: 'dev-dashboard' },
  { label: 'Branch',  path: 'branch-manager.php' },
];

let _menuOpen = false;
let _version = null;
let _versionFetched = false;

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function isActive(linkPath) {
  // Get the last segment of the current pathname (works regardless of base path)
  const segments = location.pathname.replace(/\.html$/, '').replace(/\/$/, '').split('/');
  const current = segments[segments.length - 1] || '';
  const target = linkPath === '.' ? '' : linkPath;
  return current === target;
}

function fetchVersion() {
  if (_versionFetched) return;
  _versionFetched = true;
  fetch('package.json')
    .then(r => r.json())
    .then(pkg => {
      _version = pkg.version;
      const el = document.querySelector('.admin-header__version');
      if (el) el.textContent = `v${_version}`;
    })
    .catch(() => {});
}

/**
 * Returns the admin header HTML string.
 * @param {{ user?: { displayName?: string, photoURL?: string }, onSignOut?: Function }} opts
 */
export function renderAdminHeader(opts = {}) {
  const user = opts.user || {};
  const name = esc(user.displayName || 'Admin');
  const initial = (user.displayName || 'A').charAt(0).toUpperCase();
  const avatar = user.photoURL
    ? `<img class="admin-header__avatar" src="${esc(user.photoURL)}" alt="" />`
    : `<span class="admin-header__avatar admin-header__avatar--initial">${esc(initial)}</span>`;

  const nav = NAV_LINKS.map(l => {
    const active = isActive(l.path) ? ' admin-header__link--active' : '';
    const extra = l.className ? ` ${l.className}` : '';
    return `<a class="admin-header__link${active}${extra}" href="${l.path}">${esc(l.label)}</a>`;
  }).join('');

  const versionText = _version ? `v${_version}` : '';

  const menuHtml = _menuOpen ? `
    <div class="admin-header__menu" onclick="event.stopPropagation()">
      <div class="admin-header__menu-name">${name}</div>
      <div class="admin-header__menu-divider"></div>
      <button class="admin-header__menu-item admin-header__menu-item--logout" data-admin-header-action="sign-out">Sign Out</button>
    </div>
  ` : '';

  return `
    <header class="admin-header">
      <nav class="admin-header__nav">${nav}</nav>
      <div class="admin-header__right">
        <span class="admin-header__version">${versionText}</span>
        <div class="admin-header__profile">
          <button class="admin-header__avatar-btn" data-admin-header-action="toggle-menu" aria-label="User menu">
            ${avatar}
          </button>
          ${menuHtml}
        </div>
      </div>
    </header>`;
}

/**
 * Attach event listeners for the admin header.
 * Call after the HTML from renderAdminHeader() is in the DOM.
 * @param {Element} root — container to search within
 * @param {{ onSignOut?: Function }} opts
 */
export function bindAdminHeader(root, opts = {}) {
  fetchVersion();

  root.querySelector('[data-admin-header-action="toggle-menu"]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    _menuOpen = !_menuOpen;
    // Re-render just the profile area
    const profile = root.querySelector('.admin-header__profile');
    if (profile) {
      const header = root.querySelector('.admin-header');
      // Find the full header and re-render
      if (header) {
        const parent = header.parentElement;
        if (parent && opts._rerender) {
          opts._rerender();
          return;
        }
      }
      // Fallback: toggle menu visibility via DOM
      const existing = root.querySelector('.admin-header__menu');
      if (_menuOpen && !existing) {
        const user = opts.user || {};
        const name = esc(user.displayName || 'Admin');
        const menuEl = document.createElement('div');
        menuEl.className = 'admin-header__menu';
        menuEl.onclick = (ev) => ev.stopPropagation();
        menuEl.innerHTML = `
          <div class="admin-header__menu-name">${name}</div>
          <div class="admin-header__menu-divider"></div>
          <button class="admin-header__menu-item admin-header__menu-item--logout" data-admin-header-action="sign-out">Sign Out</button>
        `;
        profile.appendChild(menuEl);
        menuEl.querySelector('[data-admin-header-action="sign-out"]')?.addEventListener('click', () => {
          _menuOpen = false;
          if (opts.onSignOut) opts.onSignOut();
        });
      } else if (!_menuOpen && existing) {
        existing.remove();
      }
    }
  });

  root.querySelector('[data-admin-header-action="sign-out"]')?.addEventListener('click', () => {
    _menuOpen = false;
    if (opts.onSignOut) opts.onSignOut();
  });

  // Close menu on outside click
  const closeHandler = (e) => {
    if (_menuOpen && !e.target.closest('.admin-header__profile')) {
      _menuOpen = false;
      const menu = root.querySelector('.admin-header__menu');
      if (menu) menu.remove();
    }
  };
  // Remove previous handler if any, then add
  document.removeEventListener('click', _outsideClickHandler);
  _outsideClickHandler = closeHandler;
  document.addEventListener('click', closeHandler);
}

let _outsideClickHandler = () => {};

/**
 * Reset menu state (useful when a page fully re-renders).
 */
export function resetAdminHeaderMenu() {
  _menuOpen = false;
}
