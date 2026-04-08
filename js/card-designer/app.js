'use strict';

import { render as renderCard } from '../components/card.js';
import { render as renderPackBg } from '../components/pack-card-background.js';
import { render as renderCardList, bindScrollArrows } from '../components/card-list.js';
import {
  fetchMyPacks, createPack, getPack,
  updatePack, deletePack, addCards, updateCard, deleteCard,
  setPackOfficial, setPackDev,
  uploadPackBrand, removePackBrand,
} from './pack-manager.js';
import { registerPackBrand } from '../state.js';
import {
  signInWithGoogle, signInWithEmail, signUpWithEmail, logOut,
} from '../managers/auth-manager.js';

// ---------------------------------------------------------------------------
// Mount target — set by mount(); when null, the module is dormant.
// ---------------------------------------------------------------------------
let _container = null;
let _mounted = false;
let _listenersInstalled = false;
let _onViewChange = null;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let state = {
  view: 'list',           // 'list' | 'editor' | 'add-card'
  myPacks: [],
  currentPack: null,
  currentPackCards: [],
  editingCard: null,       // null = new card, object = editing existing
  cardFormDeckType: 'die',
  cardFormText: '',
  pickingFeature: false,
  loading: false,
  error: null,
  localUserId: null,

  // Auth state
  authUser: null,
  firebaseUser: null,
  authToken: null,
  authLoading: true,
  loginMode: 'signin',     // 'signin' | 'signup'
  loginError: null,
  showUserMenu: false,
};

function setState(updates) {
  const prevView = state.view;
  Object.assign(state, updates);
  if ('view' in updates && updates.view !== prevView && _onViewChange) {
    _onViewChange(state.view);
  }
  render();
  refreshSaveDirtyState();
}

export function getView() {
  return state.view;
}

// ---------------------------------------------------------------------------
// Render dispatcher
// ---------------------------------------------------------------------------
function render() {
  if (!_mounted || !_container) return;
  const app = _container;

  // Auth gate: show login screen if not authenticated
  if (state.authLoading) {
    app.innerHTML = '<div class="screen screen--card-designer"><p class="designer__loading">Loading&hellip;</p></div>';
    return;
  }
  if (!state.authUser) {
    app.innerHTML = renderLoginGate();
    return;
  }

  switch (state.view) {
    case 'list':     app.innerHTML = renderPackList(); break;
    case 'editor':
      app.innerHTML = renderPackEditor();
      ['die', 'live', 'bye'].forEach(t => bindScrollArrows(`designer-cards-${t}`));
      break;
    case 'add-card': app.innerHTML = renderCardForm(); break;
    default:         app.innerHTML = renderPackList(); break;
  }
}

if (typeof window !== 'undefined') {
  window.cardDesigner = window.cardDesigner || {};
  window.cardDesigner.editCardById = (id) => {
    const card = state.currentPackCards.find(c => String(c.id) === String(id));
    if (!card) return;
    setState({
      view: 'add-card',
      editingCard: card,
      cardFormDeckType: card.deck_type,
      cardFormText: card.text,
      error: null,
    });
  };
  window.cardDesigner.setFeatureCard = async (id) => {
    if (!state.currentPack) return;
    setState({ loading: true, error: null });
    try {
      await updatePack(state.currentPack.id, { featured_card_id: id });
      const full = await getPack(state.currentPack.id);
      setState({
        loading: false,
        currentPack: full,
        currentPackCards: full.cards || [],
        pickingFeature: false,
      });
    } catch (err) {
      setState({ loading: false, error: err.message, pickingFeature: false });
    }
  };
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

function renderLoginGate() {
  const isSignUp = state.loginMode === 'signup';
  const title = isSignUp ? 'Create Account' : 'Sign In';
  const submitLabel = isSignUp ? 'Create Account' : 'Sign In';
  const toggleAction = isSignUp ? 'switch-to-signin' : 'switch-to-signup';
  const toggleText = isSignUp
    ? 'Already have an account? <a href="#" data-action="switch-to-signin">Sign In</a>'
    : 'Don\'t have an account? <a href="#" data-action="switch-to-signup">Sign Up</a>';
  const error = state.loginError ? `<div class="login-modal__error">${esc(state.loginError)}</div>` : '';

  return `
    <div class="designer__login-gate">
      <p class="designer__login-prompt">Sign in to create and manage your card packs.</p>
      <div class="login-modal" style="position:static; margin:0 auto;">
        <h2 class="login-modal__title">${title}</h2>
        <button class="btn btn--google" data-action="sign-in-google">Sign in with Google</button>
        <div class="login-modal__divider"><span>or</span></div>
        <form class="login-modal__form" data-action="submit-email-auth">
          <input type="email" name="email" class="login-modal__input" placeholder="Email" required />
          <input type="password" name="password" class="login-modal__input" placeholder="Password" required minlength="6" />
          ${error}
          <button type="submit" class="btn btn--primary login-modal__submit">${submitLabel}</button>
        </form>
        <div class="login-modal__toggle">${toggleText}</div>
      </div>
    </div>
  `;
}

function renderAuthBar() {
  if (!state.authUser) return '';
  const name = esc(state.authUser.display_name || 'User');
  const isAdmin = !!state.authUser.is_admin;
  const hasPhoto = !!state.firebaseUser?.photoURL;
  const initial = name.charAt(0).toUpperCase();

  const avatarImg = hasPhoto
    ? `<img class="auth-bar__avatar" src="${esc(state.firebaseUser.photoURL)}" alt="" />`
    : `<span class="auth-bar__avatar auth-bar__avatar--initial">${initial}</span>`;

  const adminItems = isAdmin ? `
    <a class="auth-menu__item" href="/dashboard">Dashboard</a>
    <a class="auth-menu__item" href="/admin-users">User Management</a>
    <a class="auth-menu__item" href="/dev-dashboard">Dev Dashboard</a>
  ` : '';

  const menu = state.showUserMenu ? `
    <div class="auth-menu" onclick="event.stopPropagation()">
      <div class="auth-menu__name">${name}</div>
      <div class="auth-menu__divider"></div>
      ${adminItems}
      <button class="auth-menu__item auth-menu__item--logout" data-action="log-out">Log Out</button>
    </div>
  ` : '';

  return `
    <div class="auth-bar">
      <button class="auth-bar__avatar-btn" data-action="toggle-user-menu" aria-label="User menu">
        ${avatarImg}
      </button>
      ${menu}
    </div>
  `;
}

function renderPackList() {
  const packItems = state.myPacks.map(p => {
    const cardCount = p.card_count ?? 0;
    const isPublished = p.status === 'published';
    const statusBadge = isPublished
      ? '<span class="designer__status-badge designer__status-badge--published">published</span>'
      : '<span class="designer__status-badge designer__status-badge--draft">draft</span>';
    const publishBtn = isPublished
      ? `<button class="btn btn--small btn--ghost" data-action="unpublish-pack" data-id="${esc(p.id)}">Unpublish</button>`
      : cardCount > 0
        ? `<button class="btn btn--small btn--success" data-action="publish-pack" data-id="${esc(p.id)}">Publish</button>`
        : '';
    return `
      <div class="designer__pack-item">
        ${renderPackBg(p)}
        <div class="designer__pack-info">
          <span class="designer__pack-title">${esc(p.title)}</span>
          <span class="designer__pack-meta">${cardCount} cards &middot; ${statusBadge}</span>
        </div>
        <div class="designer__pack-actions">
          ${publishBtn}
          <button class="btn btn--small btn--secondary" data-action="edit-pack" data-id="${esc(p.id)}">Edit</button>
          <button class="btn btn--small btn--ghost btn--danger" data-action="delete-pack" data-id="${esc(p.id)}">Delete</button>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="screen screen--card-designer screen--card-designer--embedded">
      ${state.error ? `<p class="designer__error">${esc(state.error)}</p>` : ''}
      ${state.loading ? '<p class="designer__loading">Loading&hellip;</p>' : ''}
      <div class="designer__pack-list">
        ${packItems || '<p class="designer__empty">No packs yet. Create one!</p>'}
      </div>
      <div class="designer__new-pack-wrap">
        <button class="btn btn--primary" data-action="new-pack">+ Create New Pack</button>
      </div>
    </div>
  `;
}

function renderPackEditor() {
  const pack = state.currentPack;
  if (!pack) return renderPackList();

  const deckTypes = ['die', 'live', 'bye'];
  const picking = state.pickingFeature;
  const featureCard = pack.featured_card_id
    ? state.currentPackCards.find(c => String(c.id) === String(pack.featured_card_id))
    : null;
  const featureHtml = featureCard
    ? renderCard({ title: featureCard.text, description: '', prompt: '', image: '', illustrationKey: '', deckType: featureCard.deck_type, brandImageUrl: pack.brand_image_url || '' })
    : '<span class="designer__feature-empty">None</span>';
  const sections = deckTypes.map(type => {
    const cards = state.currentPackCards.filter(c => c.deck_type === type);
    const label = type.charAt(0).toUpperCase() + type.slice(1);
    const items = cards.map(c => ({ id: c.id, deck: c.deck_type, text: c.text }));
    const listHtml = renderCardList(items, {
      size: 'sm',
      showStats: false,
      scrollArrows: true,
      id: `designer-cards-${type}`,
      emptyText: 'No cards yet',
      buildOnClick: (it) => picking
        ? `window.cardDesigner.setFeatureCard('${String(it.id).replace(/'/g, "\\'")}')`
        : `window.cardDesigner.editCardById('${String(it.id).replace(/'/g, "\\'")}')`,
    });
    return `
      <div class="designer__section">
        <h3 class="designer__section-header designer__section-header--${type}">${label} Cards (${cards.length})</h3>
        ${listHtml}
      </div>
    `;
  }).join('');

  return `
    <div class="screen screen--card-designer screen--card-designer--embedded">
    <div class="marketplace__header">
      <h1 class="marketplace__title">Edit Pack</h1>
    </div>
    ${state.error ? `<p class="designer__error">${esc(state.error)}</p>` : ''}
    <div class="designer__editor">
        <label class="designer__label">
          Pack Title
          <input class="designer__input" data-field="pack-title" type="text" value="${esc(pack.title)}" maxlength="100" />
        </label>
        <label class="designer__label">
          Description
          <textarea class="designer__input designer__textarea" data-field="pack-description" maxlength="500">${esc(pack.description)}</textarea>
        </label>
        <div class="designer__feature">
          <span class="designer__label">Pack Branding (logo shown on every card)</span>
          <div class="designer__feature-row">
            <div class="designer__brand-preview">
              ${pack.brand_image_url
                ? `<img src="${esc(pack.brand_image_url)}" alt="Pack brand" style="max-width: 64px; max-height: 64px; object-fit: contain; background: #fff; border-radius: 8px; padding: 4px;">`
                : '<span class="designer__feature-empty">None</span>'}
            </div>
            <label class="btn btn--secondary btn--small" style="cursor: pointer;">
              ${pack.brand_image_url ? 'Replace' : 'Upload'}
              <input type="file" accept="image/png,image/jpeg,image/webp" data-action="upload-brand" style="display: none;">
            </label>
            ${pack.brand_image_url
              ? '<button class="btn btn--ghost btn--small" data-action="remove-brand">Remove</button>'
              : ''}
          </div>
          <p class="designer__feature-hint">PNG, JPEG, or WebP. Max 2MB.</p>
        </div>
        <div class="designer__feature">
          <span class="designer__label">Feature Card</span>
          <div class="designer__feature-row">
            <div class="designer__feature-preview">${featureHtml}</div>
            ${picking
              ? `<button class="btn btn--ghost btn--small" data-action="cancel-pick-feature">Cancel</button>`
              : `<button class="btn btn--secondary btn--small" data-action="start-pick-feature" ${state.currentPackCards.length === 0 ? 'disabled' : ''}>Set Feature Card</button>`}
            ${!picking && pack.featured_card_id
              ? `<button class="btn btn--ghost btn--small" data-action="clear-feature">Clear</button>`
              : ''}
          </div>
          ${picking ? '<p class="designer__feature-hint">Click a card below to set it as the pack feature card.</p>' : ''}
        </div>
        ${state.authUser?.is_admin ? `
          <div class="lobby__stepper-row" style="margin-top: 0.75rem;">
            <span class="lobby__stepper-label">Mark as Official Deck (admin)</span>
            <button class="btn lobby__stepper-btn ${pack.is_official ? 'btn--primary' : 'btn--secondary'}"
              style="width: auto; min-width: 4.5rem; padding: 0 var(--space-md);"
              data-action="toggle-pack-official" data-id="${esc(pack.id)}" data-next="${pack.is_official ? 'false' : 'true'}">
              ${pack.is_official ? 'On' : 'Off'}
            </button>
          </div>
          <div class="lobby__stepper-row">
            <span class="lobby__stepper-label">Mark as Dev Deck (admin)</span>
            <button class="btn lobby__stepper-btn ${pack.is_dev ? 'btn--primary' : 'btn--secondary'}"
              style="width: auto; min-width: 4.5rem; padding: 0 var(--space-md);"
              data-action="toggle-pack-dev" data-id="${esc(pack.id)}" data-next="${pack.is_dev ? 'false' : 'true'}">
              ${pack.is_dev ? 'On' : 'Off'}
            </button>
          </div>
        ` : ''}
      </div>
      ${sections}
      <div class="designer__editor-actions">
        <button class="btn btn--primary" data-action="show-add-card">+ Add Card</button>
        <button class="btn btn--secondary" data-action="save-pack-meta">Save</button>
        ${pack.status === 'published'
          ? `<button class="btn btn--ghost" data-action="unpublish-pack" data-id="${esc(pack.id)}">Unpublish</button>`
          : state.currentPackCards.length > 0
            ? `<button class="btn btn--success" data-action="publish-pack" data-id="${esc(pack.id)}">Publish Pack</button>`
            : ''}
      </div>
      <div class="designer__back-wrap">
        <button class="btn mode-select__back-btn menu__site-link" data-action="back-to-list">&larr; Back to Packs</button>
      </div>
    </div>
  `;
}

function renderCardForm() {
  const editing = state.editingCard;
  const heading = editing ? 'Edit Card' : 'Add New Card';
  const deckTypes = ['die', 'live', 'bye'];

  const picker = deckTypes.map(type => {
    const label = type.charAt(0).toUpperCase() + type.slice(1);
    const active = state.cardFormDeckType === type ? 'designer__deck-btn--active' : '';
    return `<button class="btn btn--small designer__deck-btn ${active}" data-action="set-deck-type" data-type="${type}">${label}</button>`;
  }).join('');

  const preview = renderCard({
    title: state.cardFormText || 'Card text here...',
    description: '',
    prompt: '',
    image: '',
    illustrationKey: '',
    deckType: state.cardFormDeckType,
    brandImageUrl: state.currentPack?.brand_image_url || '',
  });

  return `
    <div class="screen screen--card-designer screen--card-designer--embedded">
    <div class="marketplace__header">
      <h1 class="marketplace__title">${heading}</h1>
    </div>
    ${state.error ? `<p class="designer__error">${esc(state.error)}</p>` : ''}
    <div class="designer__card-form">
        <div class="designer__field">
          <span class="designer__label">Deck Type</span>
          <div class="designer__deck-picker">${picker}</div>
        </div>
        <label class="designer__label">
          Card Text
          <textarea class="designer__input designer__textarea" data-field="card-text" maxlength="200" placeholder="Enter card text...">${esc(state.cardFormText)}</textarea>
        </label>
        <div class="designer__char-count">${state.cardFormText.length}/200</div>
        <div class="designer__preview-section">
          <span class="designer__label">Preview</span>
          <div class="designer__preview">${preview}</div>
        </div>
        <div class="designer__form-actions">
          <button class="btn btn--ghost" data-action="back-to-editor">Cancel</button>
          ${editing ? `<button class="btn btn--ghost btn--danger" data-action="delete-card" data-card-id="${esc(editing.id)}">Delete</button>` : ''}
          <button class="btn btn--primary" data-action="save-card">${editing ? 'Update Card' : 'Save Card'}</button>
        </div>
      </div>
      <div class="designer__back-wrap">
        <button class="btn mode-select__back-btn menu__site-link" data-action="back-to-editor">&larr; Back to Pack</button>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Event delegation — installed once globally, gated on _mounted + container
// ---------------------------------------------------------------------------
function installListeners() {
  if (_listenersInstalled) return;
  _listenersInstalled = true;
  document.addEventListener('click', onDocClick);
  document.addEventListener('click', onDocClickOutsideMenu);
  document.addEventListener('submit', onDocSubmit);
  document.addEventListener('input', onDocInput);
  document.addEventListener('change', onDocChange);
}

async function onDocChange(e) {
  if (!isInside(e)) return;
  const input = e.target.closest('[data-action="upload-brand"]');
  if (!input || !input.files || !input.files[0]) return;
  await handleUploadBrand(input.files[0]);
  input.value = '';
}

function isInside(e) {
  return _mounted && _container && _container.contains(e.target);
}

async function onDocClick(e) {
  if (!isInside(e)) return;
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;

  switch (action) {
    case 'new-pack': await handleNewPack(); break;
    case 'edit-pack': await handleEditPack(btn.dataset.id); break;
    case 'delete-pack': await handleDeletePack(btn.dataset.id); break;
    case 'back-to-list': await handleBackToList(); break;
    case 'save-pack-meta': await handleSavePackMeta(); break;
    case 'show-add-card': await handleShowAddCard(); break;
    case 'back-to-editor': setState({ view: 'editor', error: null }); break;
    case 'set-deck-type': setState({ cardFormDeckType: btn.dataset.type }); break;
    case 'save-card': await handleSaveCard(); break;
    case 'edit-card': handleEditCard(btn.dataset.card); break;
    case 'delete-card': await handleDeleteCard(btn.dataset.cardId); break;
    case 'publish-pack': await handlePublishPack(btn.dataset.id); break;
    case 'unpublish-pack': await handleUnpublishPack(btn.dataset.id); break;
    case 'toggle-pack-official': await handleToggleOfficial(btn.dataset.id, btn.dataset.next === 'true'); break;
    case 'toggle-pack-dev': await handleToggleDev(btn.dataset.id, btn.dataset.next === 'true'); break;
    case 'start-pick-feature': setState({ pickingFeature: true, error: null }); break;
    case 'cancel-pick-feature': setState({ pickingFeature: false }); break;
    case 'clear-feature': await handleClearFeature(); break;
    case 'remove-brand': await handleRemoveBrand(); break;
    case 'sign-in-google': await signInWithGoogle(); break;
    case 'switch-to-signup': setState({ loginMode: 'signup', loginError: null }); break;
    case 'switch-to-signin': setState({ loginMode: 'signin', loginError: null }); break;
    case 'toggle-user-menu': setState({ showUserMenu: !state.showUserMenu }); break;
    case 'log-out': await logOut(); break;
  }
}

// Close user menu on outside click
function onDocClickOutsideMenu(e) {
  if (!_mounted) return;
  if (state.showUserMenu && !e.target.closest('.auth-bar')) {
    setState({ showUserMenu: false });
  }
}

// Handle login form submission
async function onDocSubmit(e) {
  if (!isInside(e)) return;
  const form = e.target.closest('[data-action="submit-email-auth"]');
  if (!form) return;
  e.preventDefault();
  const email = form.querySelector('[name="email"]').value;
  const password = form.querySelector('[name="password"]').value;
  if (state.loginMode === 'signup') {
    await signUpWithEmail(email, password);
  } else {
    await signInWithEmail(email, password);
  }
}

function refreshSaveDirtyState() {
  if (!state.currentPack) return;
  const titleInput = document.querySelector('[data-field="pack-title"]');
  const descInput = document.querySelector('[data-field="pack-description"]');
  const saveBtn = document.querySelector('.designer__editor-actions [data-action="save-pack-meta"]');
  if (!titleInput || !saveBtn) return;
  const title = titleInput.value.trim();
  const description = (descInput?.value ?? '').trim();
  const dirty = title !== (state.currentPack.title || '') || description !== (state.currentPack.description || '');
  saveBtn.classList.toggle('is-dirty', dirty);
}

// Live-update card text and preview
function onDocInput(e) {
  if (!isInside(e)) return;
  if (e.target.matches('[data-field="pack-title"]') || e.target.matches('[data-field="pack-description"]')) {
    refreshSaveDirtyState();
    return;
  }
  if (e.target.matches('[data-field="card-text"]')) {
    state.cardFormText = e.target.value;
    // Update preview without full re-render to keep cursor position
    const previewEl = document.querySelector('.designer__preview');
    const countEl = document.querySelector('.designer__char-count');
    if (previewEl) {
      previewEl.innerHTML = renderCard({
        title: state.cardFormText || 'Card text here...',
        description: '', prompt: '', image: '', illustrationKey: '',
        deckType: state.cardFormDeckType,
        brandImageUrl: state.currentPack?.brand_image_url || '',
      });
    }
    if (countEl) {
      countEl.textContent = `${state.cardFormText.length}/200`;
    }
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleNewPack() {
  setState({ loading: true, error: null });
  try {
    const pack = await createPack(state.localUserId, 'Untitled Pack', '');
    const full = await getPack(pack.id);
    setState({
      loading: false,
      currentPack: full,
      currentPackCards: full.cards || [],
      view: 'editor',
    });
  } catch (err) {
    setState({ loading: false, error: err.message });
  }
}

async function handleEditPack(packId) {
  setState({ loading: true, error: null });
  try {
    const full = await getPack(packId);
    setState({
      loading: false,
      currentPack: full,
      currentPackCards: full.cards || [],
      view: 'editor',
    });
  } catch (err) {
    setState({ loading: false, error: err.message });
  }
}

async function handleDeletePack(packId) {
  const pack = state.myPacks.find(p => p.id === packId);
  const name = pack ? pack.title : 'this pack';
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  setState({ loading: true, error: null });
  try {
    await deletePack(packId);
    const packs = await fetchMyPacks(state.localUserId);
    setState({ loading: false, myPacks: packs });
  } catch (err) {
    setState({ loading: false, error: err.message });
  }
}

async function handleBackToList() {
  setState({ loading: true, error: null });
  try {
    const packs = await fetchMyPacks(state.localUserId);
    setState({ loading: false, myPacks: packs, currentPack: null, currentPackCards: [], view: 'list' });
  } catch (err) {
    setState({ loading: false, error: err.message, view: 'list' });
  }
}

async function handleSavePackMeta() {
  const titleInput = document.querySelector('[data-field="pack-title"]');
  const descInput = document.querySelector('[data-field="pack-description"]');
  const title = titleInput?.value?.trim();
  const description = descInput?.value?.trim();
  if (!title) { setState({ error: 'Title is required' }); return; }

  setState({ loading: true, error: null });
  try {
    const updated = await updatePack(state.currentPack.id, { title, description });
    setState({ loading: false, currentPack: { ...state.currentPack, ...updated } });
  } catch (err) {
    setState({ loading: false, error: err.message });
  }
}

async function autoSavePackMeta() {
  if (!state.currentPack) return;
  const titleInput = document.querySelector('[data-field="pack-title"]');
  const descInput = document.querySelector('[data-field="pack-description"]');
  if (!titleInput) return;
  const title = titleInput.value.trim();
  const description = descInput?.value?.trim() ?? '';
  if (!title) return;
  // Only save if something changed
  if (title === state.currentPack.title && description === (state.currentPack.description || '')) return;
  try {
    const updated = await updatePack(state.currentPack.id, { title, description });
    state.currentPack = { ...state.currentPack, ...updated };
  } catch { /* silent — will be saved manually later */ }
}

async function handleShowAddCard() {
  // Auto-save pack metadata if fields have been edited
  await autoSavePackMeta();
  setState({
    view: 'add-card',
    editingCard: null,
    cardFormDeckType: 'die',
    cardFormText: '',
    error: null,
  });
}

function handleEditCard(cardJson) {
  try {
    const card = JSON.parse(cardJson);
    setState({
      view: 'add-card',
      editingCard: card,
      cardFormDeckType: card.deck_type,
      cardFormText: card.text,
      error: null,
    });
  } catch { /* ignore parse errors */ }
}

async function handleSaveCard() {
  const text = state.cardFormText.trim();
  if (!text) { setState({ error: 'Card text is required' }); return; }

  setState({ loading: true, error: null });
  try {
    if (state.editingCard) {
      await updateCard(state.currentPack.id, state.editingCard.id, {
        text,
        deck_type: state.cardFormDeckType,
      });
    } else {
      await addCards(state.currentPack.id, [{ deck_type: state.cardFormDeckType, text }]);
    }
    // Refresh pack data
    const full = await getPack(state.currentPack.id);
    setState({
      loading: false,
      currentPack: full,
      currentPackCards: full.cards || [],
      editingCard: null,
      cardFormText: '',
      view: 'editor',
    });
  } catch (err) {
    setState({ loading: false, error: err.message });
  }
}

async function handleDeleteCard(cardId) {
  if (!confirm('Delete this card?')) return;
  setState({ loading: true, error: null });
  try {
    await deleteCard(state.currentPack.id, cardId);
    const full = await getPack(state.currentPack.id);
    setState({
      loading: false,
      currentPack: full,
      currentPackCards: full.cards || [],
      view: 'editor',
      editingCard: null,
    });
  } catch (err) {
    setState({ loading: false, error: err.message });
  }
}

async function handleClearFeature() {
  if (!state.currentPack) return;
  setState({ loading: true, error: null });
  try {
    await updatePack(state.currentPack.id, { featured_card_id: null });
    const full = await getPack(state.currentPack.id);
    setState({
      loading: false,
      currentPack: full,
      currentPackCards: full.cards || [],
    });
  } catch (err) {
    setState({ loading: false, error: err.message });
  }
}

async function handleUploadBrand(file) {
  if (!state.currentPack || !file) return;
  setState({ loading: true, error: null });
  try {
    const updated = await uploadPackBrand(state.currentPack.id, file);
    registerPackBrand(state.currentPack.id, updated.brand_image_url || '');
    setState({
      loading: false,
      currentPack: { ...state.currentPack, brand_image_url: updated.brand_image_url },
    });
  } catch (err) {
    setState({ loading: false, error: err.message });
  }
}

async function handleRemoveBrand() {
  if (!state.currentPack) return;
  setState({ loading: true, error: null });
  try {
    const updated = await removePackBrand(state.currentPack.id);
    registerPackBrand(state.currentPack.id, '');
    setState({
      loading: false,
      currentPack: { ...state.currentPack, brand_image_url: updated.brand_image_url || null },
    });
  } catch (err) {
    setState({ loading: false, error: err.message });
  }
}

async function handlePublishPack(packId) {
  const ok = await showConfirmModal('Publish this pack? It will be visible to other players.', 'Publish', 'btn--success');
  if (!ok) return;
  setState({ loading: true, error: null });
  try {
    await updatePack(packId, { status: 'published' });
    // Refresh — could be from list or editor view
    if (state.currentPack?.id === packId) {
      const full = await getPack(packId);
      setState({ loading: false, currentPack: full, currentPackCards: full.cards || [] });
    }
    const packs = await fetchMyPacks(state.localUserId);
    setState({ loading: false, myPacks: packs });
  } catch (err) {
    setState({ loading: false, error: err.message });
  }
}

async function handleUnpublishPack(packId) {
  const ok = await showConfirmModal('Unpublish this pack? It will no longer be visible to other players.', 'Unpublish', 'btn--danger');
  if (!ok) return;
  setState({ loading: true, error: null });
  try {
    await updatePack(packId, { status: 'draft' });
    if (state.currentPack?.id === packId) {
      const full = await getPack(packId);
      setState({ loading: false, currentPack: full, currentPackCards: full.cards || [] });
    }
    const packs = await fetchMyPacks(state.localUserId);
    setState({ loading: false, myPacks: packs });
  } catch (err) {
    setState({ loading: false, error: err.message });
  }
}

async function handleToggleOfficial(packId, isOfficial) {
  if (!state.authUser?.is_admin) return;
  setState({ error: null });
  try {
    const updated = await setPackOfficial(packId, isOfficial);
    if (state.currentPack?.id === packId) {
      setState({ currentPack: { ...state.currentPack, is_official: !!updated.is_official } });
    }
  } catch (err) {
    setState({ error: err.message });
  }
}

async function handleToggleDev(packId, isDev) {
  if (!state.authUser?.is_admin) return;
  setState({ error: null });
  try {
    const updated = await setPackDev(packId, isDev);
    if (state.currentPack?.id === packId) {
      setState({ currentPack: { ...state.currentPack, is_dev: !!updated.is_dev } });
    }
  } catch (err) {
    setState({ error: err.message });
  }
}

// ---------------------------------------------------------------------------
// Custom confirm modal
// ---------------------------------------------------------------------------
function showConfirmModal(message, confirmLabel, confirmClass = 'btn--primary') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-modal">
        <p class="confirm-modal__message">${esc(message)}</p>
        <div class="confirm-modal__actions">
          <button class="btn btn--ghost confirm-modal__cancel">Cancel</button>
          <button class="btn ${confirmClass} confirm-modal__confirm">${esc(confirmLabel)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    // Force reflow then add visible class for transition
    overlay.offsetHeight;
    overlay.classList.add('confirm-overlay--visible');

    const cleanup = (result) => {
      overlay.classList.remove('confirm-overlay--visible');
      overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
      // Fallback if no transition fires
      setTimeout(() => overlay.remove(), 300);
      resolve(result);
    };

    overlay.querySelector('.confirm-modal__cancel').addEventListener('click', () => cleanup(false));
    overlay.querySelector('.confirm-modal__confirm').addEventListener('click', () => cleanup(true));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// Mount API — called by host (e.g. marketplace) to embed the designer.
// ---------------------------------------------------------------------------
async function loadPacksForUser() {
  if (!state.authUser) {
    setState({ localUserId: null, myPacks: [], currentPack: null, currentPackCards: [], view: 'list' });
    return;
  }
  const userId = state.authUser.id;
  setState({ localUserId: userId, loading: true, error: null });
  try {
    const packs = await fetchMyPacks(userId);
    setState({ localUserId: userId, myPacks: packs, loading: false, view: 'list' });
  } catch (err) {
    setState({ localUserId: userId, loading: false, error: `Failed to load packs: ${err.message}` });
  }
}

/**
 * Mount the card designer into a DOM container.
 * The host is responsible for keeping auth state in sync via syncAuth().
 */
export function mount(container, initialAuth = {}, opts = {}) {
  _container = container;
  _mounted = true;
  _onViewChange = opts.onViewChange || null;
  installListeners();
  // Sync any auth fields the host already knows about
  Object.assign(state, {
    authUser: initialAuth.authUser ?? null,
    firebaseUser: initialAuth.firebaseUser ?? null,
    authToken: initialAuth.authToken ?? null,
    authLoading: initialAuth.authLoading ?? false,
  });
  render();
  // Notify host of current view so it can sync fullscreen layout
  if (_onViewChange) _onViewChange(state.view);
  // Kick off pack fetch on first mount only (don't clobber in-progress edits on remount)
  if (state.authUser && state.myPacks.length === 0 && state.view === 'list') {
    loadPacksForUser();
  }
}

export function unmount() {
  _mounted = false;
  _container = null;
}

/**
 * Notify the designer that the host's auth state changed.
 * Re-fetches packs if the user just logged in.
 */
export function syncAuth(auth) {
  const wasAuthed = !!state.authUser;
  Object.assign(state, {
    authUser: auth.authUser ?? null,
    firebaseUser: auth.firebaseUser ?? null,
    authToken: auth.authToken ?? null,
    authLoading: auth.authLoading ?? false,
  });
  if (!_mounted) return;
  const isAuthed = !!state.authUser;
  if (isAuthed && !wasAuthed) {
    loadPacksForUser();
  } else if (!isAuthed && wasAuthed) {
    setState({ localUserId: null, myPacks: [], currentPack: null, currentPackCards: [], view: 'list' });
  } else {
    render();
  }
}
