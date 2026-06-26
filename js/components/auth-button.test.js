import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderLoginModal, renderMenuAccountButtons, menuAccountButtons } from './auth-button.js';

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

test('renderMenuAccountButtons: signed out renders nothing', () => {
  assert.equal(renderMenuAccountButtons({ authUser: null }), '');
});

test('renderMenuAccountButtons: signed in shows Manage Account but no Brand Admin without brands', () => {
  const html = renderMenuAccountButtons({ authUser: { id: 'u1' }, myBrands: [] });
  assert.ok(html.includes('Manage Account'));
  assert.ok(html.includes('window.game.manageAccount()'));
  assert.ok(!html.includes('Brand Admin'));
});

test('renderMenuAccountButtons: approved brand links to the co-branded /<slug>/admin', () => {
  const html = renderMenuAccountButtons({
    authUser: { id: 'u1' },
    myBrands: [{ id: 'b1', status: 'approved', slug: 'acme' }],
  });
  assert.ok(html.includes('Brand Admin'));
  assert.ok(html.includes('href="/acme/admin"'));
});

test('renderMenuAccountButtons: pending brand does not show Brand Admin', () => {
  const html = renderMenuAccountButtons({
    authUser: { id: 'u1' },
    myBrands: [{ id: 'b1', status: 'pending', slug: 'acme' }],
  });
  assert.ok(html.includes('Manage Account'));
  assert.ok(!html.includes('Brand Admin'));
});

test('menuAccountButtons: returns an array sized by access (0 / 1 / 2 buttons)', () => {
  assert.equal(menuAccountButtons({ authUser: null }).length, 0);
  assert.equal(menuAccountButtons({ authUser: { id: 'u1' }, myBrands: [] }).length, 1);
  assert.equal(
    menuAccountButtons({ authUser: { id: 'u1' }, myBrands: [{ id: 'b1', status: 'approved', slug: 'acme' }] }).length,
    2,
  );
});

test('renderMenuAccountButtons: approved brand is shown even when a pending brand is listed first', () => {
  const html = renderMenuAccountButtons({
    authUser: { id: 'u1' },
    myBrands: [
      { id: 'b1', status: 'pending', slug: 'pend' },
      { id: 'b2', status: 'approved', slug: 'acme' },
    ],
  });
  assert.ok(html.includes('href="/acme/admin"'));
});
