import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderLoginModal } from './auth-button.js';

const open = (extra = {}) => renderLoginModal({ showLoginModal: true, ...extra });

test('renderLoginModal: hidden modal renders nothing', () => {
  assert.equal(renderLoginModal({ showLoginModal: false }), '');
});

test('renderLoginModal: sign-in mode shows the Forgot password affordance', () => {
  const html = open({ loginMode: 'signin' });
  assert.ok(html.includes('Forgot password?'));
  assert.ok(html.includes('window.game.modalForgotPassword()'));
});

test('renderLoginModal: sign-up mode hides the Forgot password affordance', () => {
  const html = open({ loginMode: 'signup' });
  assert.ok(!html.includes('Forgot password?'));
});

test('renderLoginModal: a loginNotice renders in the success notice element', () => {
  const html = open({ loginMode: 'signin', loginNotice: 'Reset email sent — check your inbox' });
  assert.ok(html.includes('login-modal__notice'));
  assert.ok(html.includes('Reset email sent — check your inbox'));
});

test('renderLoginModal: no notice element when loginNotice is absent', () => {
  assert.ok(!open({ loginMode: 'signin' }).includes('login-modal__notice'));
});
