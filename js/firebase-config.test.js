import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getFirebaseConfig } from './firebase-config.js';

test('returns prod config for play.carkedit.com', () => {
  const cfg = getFirebaseConfig('play.carkedit.com', 'play.carkedit.com');
  assert.equal(cfg.projectId, 'carkedit-5cc8e');
  assert.equal(cfg.apiKey, 'AIzaSyC6QJz6jTzJkBWV7Shd9XpCfHWrovJ9vaI');
  assert.equal(cfg.messagingSenderId, '144073275425');
});

test('returns staging config for staging.play.carkedit.com', () => {
  const cfg = getFirebaseConfig('staging.play.carkedit.com', 'staging.play.carkedit.com');
  assert.equal(cfg.projectId, 'carkedit-staging');
});

test('returns dev config for dev.play.carkedit.com', () => {
  const cfg = getFirebaseConfig('dev.play.carkedit.com', 'dev.play.carkedit.com');
  assert.equal(cfg.projectId, 'carkedit-dev');
});

test('falls back to dev config for localhost', () => {
  const cfg = getFirebaseConfig('localhost', 'localhost:4540');
  assert.equal(cfg.projectId, 'carkedit-dev');
});

test('falls back to dev config for 127.0.0.1', () => {
  const cfg = getFirebaseConfig('127.0.0.1', '127.0.0.1:4540');
  assert.equal(cfg.projectId, 'carkedit-dev');
});

test('falls back to dev config for the legacy brennan.games host', () => {
  const cfg = getFirebaseConfig('brennan.games', 'brennan.games');
  assert.equal(cfg.projectId, 'carkedit-dev');
});

test('falls back to dev config for an unknown hostname', () => {
  const cfg = getFirebaseConfig('random.example.com', 'random.example.com');
  assert.equal(cfg.projectId, 'carkedit-dev');
});

test('hostname matching is case-insensitive', () => {
  const cfg = getFirebaseConfig('PLAY.CARKEDIT.COM', 'PLAY.CARKEDIT.COM');
  assert.equal(cfg.projectId, 'carkedit-5cc8e');
});

test('authDomain is set to the passed host arg', () => {
  const cfg = getFirebaseConfig('play.carkedit.com', 'play.carkedit.com:8443');
  assert.equal(cfg.authDomain, 'play.carkedit.com:8443');
});

test('authDomain defaults to the hostname when host arg is omitted', () => {
  const cfg = getFirebaseConfig('dev.play.carkedit.com');
  assert.equal(cfg.authDomain, 'dev.play.carkedit.com');
});

test('returned object always includes projectId and apiKey', () => {
  for (const host of ['play.carkedit.com', 'staging.play.carkedit.com', 'dev.play.carkedit.com', 'localhost']) {
    const cfg = getFirebaseConfig(host, host);
    assert.ok(cfg.projectId, `projectId missing for ${host}`);
    assert.ok(cfg.apiKey, `apiKey missing for ${host}`);
    assert.ok(cfg.appId, `appId missing for ${host}`);
    assert.ok(cfg.storageBucket, `storageBucket missing for ${host}`);
    assert.ok(cfg.messagingSenderId, `messagingSenderId missing for ${host}`);
  }
});
