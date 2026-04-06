'use strict';

import { render as renderCard } from '../components/card.js';
import {
  fetchMyPacks, createPack, getPack,
  updatePack, deletePack, addCards, updateCard, deleteCard,
} from './pack-manager.js';
import {
  setStateSetter, initAuth, signInWithGoogle,
  signInWithEmail, signUpWithEmail, logOut,
} from '../managers/auth-manager.js';

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
};

function setState(updates) {
  Object.assign(state, updates);
  render();
}

// ---------------------------------------------------------------------------
// Render dispatcher
// ---------------------------------------------------------------------------
function render() {
  const app = document.getElementById('app');

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
    case 'editor':   app.innerHTML = renderPackEditor(); break;
    case 'add-card': app.innerHTML = renderCardForm(); break;
    default:         app.innerHTML = renderPackList(); break;
  }
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
    <div class="screen screen--card-designer">
      <div class="designer__header">
        <h1 class="designer__title">Card Designer</h1>
      </div>
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
      <a class="btn mode-select__back-btn" href="index.html">&larr; Back to Game</a>
    </div>
  `;
}

function renderAuthBar() {
  if (!state.authUser) return '';
  const name = esc(state.authUser.display_name || 'User');
  const avatar = state.firebaseUser?.photoURL
    ? `<img class="auth-bar__avatar" src="${esc(state.firebaseUser.photoURL)}" alt="" />`
    : '';
  return `
    <div class="auth-bar">
      ${avatar}
      <span class="auth-bar__name">${name}</span>
      <button class="btn btn--ghost btn--small" data-action="log-out">Log Out</button>
    </div>
  `;
}

function renderPackList() {
  const packItems = state.myPacks.map(p => `
    <div class="designer__pack-item">
      <div class="designer__pack-info">
        <span class="designer__pack-title">${esc(p.title)}</span>
        <span class="designer__pack-meta">${p.card_count ?? 0} cards &middot; ${esc(p.status)}</span>
      </div>
      <div class="designer__pack-actions">
        <button class="btn btn--small btn--secondary" data-action="edit-pack" data-id="${esc(p.id)}">Edit</button>
        <button class="btn btn--small btn--ghost btn--danger" data-action="delete-pack" data-id="${esc(p.id)}">Delete</button>
      </div>
    </div>
  `).join('');

  return `
    <div class="screen screen--card-designer">
      <div class="page-auth">${renderAuthBar()}</div>
      <div class="designer__header">
        <h1 class="designer__title">Card Designer</h1>
      </div>
      ${state.error ? `<p class="designer__error">${esc(state.error)}</p>` : ''}
      ${state.loading ? '<p class="designer__loading">Loading&hellip;</p>' : ''}
      <div class="designer__pack-list">
        ${packItems || '<p class="designer__empty">No packs yet. Create one!</p>'}
      </div>
      <button class="btn btn--primary" data-action="new-pack">+ Create New Pack</button>
      <a class="btn mode-select__back-btn" href="index.html">&larr; Back to Game</a>
    </div>
  `;
}

function renderPackEditor() {
  const pack = state.currentPack;
  if (!pack) return renderPackList();

  const deckTypes = ['die', 'live', 'bye'];
  const sections = deckTypes.map(type => {
    const cards = state.currentPackCards.filter(c => c.deck_type === type);
    const label = type.charAt(0).toUpperCase() + type.slice(1);
    const rows = cards.map(c => `
      <div class="designer__card-row">
        <span class="designer__card-text">${esc(c.text)}</span>
        <button class="btn btn--icon" data-action="edit-card" data-card='${esc(JSON.stringify(c))}' title="Edit">&#9998;</button>
        <button class="btn btn--icon btn--danger" data-action="delete-card" data-card-id="${esc(c.id)}" title="Delete">&times;</button>
      </div>
    `).join('');
    return `
      <div class="designer__section">
        <h3 class="designer__section-header designer__section-header--${type}">${label} Cards (${cards.length})</h3>
        ${rows || '<p class="designer__empty-section">No cards yet</p>'}
      </div>
    `;
  }).join('');

  return `
    <div class="screen screen--card-designer">
      <div class="page-auth">${renderAuthBar()}</div>
      <div class="designer__header">
        <h1 class="designer__title">Edit Pack</h1>
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
        <button class="btn btn--secondary btn--small" data-action="save-pack-meta">Save Details</button>
      </div>
      ${sections}
      <div class="designer__editor-actions">
        <button class="btn btn--primary" data-action="show-add-card">+ Add Card</button>
      </div>
      <button class="btn mode-select__back-btn" data-action="back-to-list">&larr; Back to Packs</button>
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
  });

  return `
    <div class="screen screen--card-designer">
      <div class="page-auth">${renderAuthBar()}</div>
      <div class="designer__header">
        <h1 class="designer__title">${heading}</h1>
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
          <button class="btn btn--primary" data-action="save-card">${editing ? 'Update Card' : 'Save Card'}</button>
        </div>
      </div>
      <button class="btn mode-select__back-btn" data-action="back-to-editor">&larr; Back to Pack</button>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Event delegation
// ---------------------------------------------------------------------------
document.addEventListener('click', async (e) => {
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
    case 'sign-in-google': await signInWithGoogle(); break;
    case 'switch-to-signup': setState({ loginMode: 'signup', loginError: null }); break;
    case 'switch-to-signin': setState({ loginMode: 'signin', loginError: null }); break;
    case 'log-out': await logOut(); break;
  }
});

// Handle login form submission
document.addEventListener('submit', async (e) => {
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
});

// Live-update card text and preview
document.addEventListener('input', (e) => {
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
      });
    }
    if (countEl) {
      countEl.textContent = `${state.cardFormText.length}/200`;
    }
  }
});

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
    });
  } catch (err) {
    setState({ loading: false, error: err.message });
  }
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
// Init
// ---------------------------------------------------------------------------
async function onAuthChanged() {
  // Called when Firebase auth state changes
  if (state.authUser) {
    // User just logged in — fetch their packs
    const userId = state.authUser.id;
    try {
      const packs = await fetchMyPacks(userId);
      setState({ localUserId: userId, myPacks: packs, loading: false, view: 'list' });
    } catch (err) {
      setState({ localUserId: userId, loading: false, error: `Failed to load packs: ${err.message}` });
    }
  } else {
    // User logged out — clear pack data
    setState({ localUserId: null, myPacks: [], currentPack: null, currentPackCards: [], view: 'list' });
  }
}

async function init() {
  // Wire auth-manager to use our local state instead of game state.js
  setStateSetter(
    (updates) => { Object.assign(state, updates); render(); },
    () => state,
  );
  render(); // show loading state
  await initAuth(onAuthChanged);
}

document.addEventListener('DOMContentLoaded', init);
