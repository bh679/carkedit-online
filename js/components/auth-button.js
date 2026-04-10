// CarkedIt Online — Auth Button Component
'use strict';

export function renderAuthButton(state) {
  if (state.authLoading) {
    return '<div class="auth-bar"><span class="auth-bar__loading">...</span></div>';
  }

  if (state.authUser) {
    const name = state.authUser.display_name || 'User';
    const isAdmin = !!state.authUser.is_admin;
    const hasPhoto = !!state.firebaseUser?.photoURL;
    const initial = name.charAt(0).toUpperCase();

    const avatarImg = hasPhoto
      ? `<img class="auth-bar__avatar" src="${state.firebaseUser.photoURL}" alt="" />`
      : `<span class="auth-bar__avatar auth-bar__avatar--initial">${initial}</span>`;

    const adminItems = isAdmin ? `
      <a class="auth-menu__item" href="stats">Stats</a>
      <a class="auth-menu__item" href="admin-users">Users</a>
      <a class="auth-menu__item" href="admin-image-gen">ImageAI</a>
      <a class="auth-menu__item" href="dev-dashboard">Dev</a>
    ` : '';

    const menu = state.showUserMenu ? `
      <div class="auth-menu" onclick="event.stopPropagation()">
        <div class="auth-menu__name">${name}</div>
        <div class="auth-menu__divider"></div>
        ${adminItems}
        <button class="auth-menu__item" onclick="window.game.manageAccount()">Manage Account</button>
        <button class="auth-menu__item auth-menu__item--logout" onclick="window.game.logOut()">Log Out</button>
      </div>
    ` : '';

    return `
      <div class="auth-bar">
        <button class="auth-bar__avatar-btn" onclick="window.game.toggleUserMenu()" aria-label="User menu">
          ${avatarImg}
        </button>
        ${menu}
      </div>
    `;
  }

  return `
    <div class="auth-bar">
      <button class="btn btn--ghost" onclick="window.game.showLogin()">Sign In</button>
    </div>
  `;
}

export function renderLoginModal(state) {
  if (!state.showLoginModal) return '';

  const isSignUp = state.loginMode === 'signup';
  const title = isSignUp ? 'Create Account' : 'Sign In';
  const submitLabel = isSignUp ? 'Create Account' : 'Sign In';
  const toggleText = isSignUp
    ? 'Already have an account? <a href="#" onclick="window.game.setLoginMode(\'signin\'); return false;">Sign In</a>'
    : 'Don\'t have an account? <a href="#" onclick="window.game.setLoginMode(\'signup\'); return false;">Sign Up</a>';
  const error = state.loginError ? `<div class="login-modal__error">${state.loginError}</div>` : '';

  return `
    <div class="login-modal__overlay" onclick="window.game.hideLogin()">
      <div class="login-modal" onclick="event.stopPropagation()">
        <button class="login-modal__close" onclick="window.game.hideLogin()">&times;</button>
        <h2 class="login-modal__title">${title}</h2>

        <button class="btn btn--google" onclick="window.game.signInWithGoogle()">
          Sign in with Google
        </button>

        <div class="login-modal__divider"><span>or</span></div>

        <form class="login-modal__form" onsubmit="window.game.submitEmailAuth(event)">
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
