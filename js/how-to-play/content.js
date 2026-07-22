// CarkedIt Online — How to Play content data
// Single source of truth for the setup steps, decks and phases shown on both the
// standalone /how-to-play page (js/how-to-play/app.js) and the in-lobby overlay
// (js/components/how-to-play-overlay.js).
//
// DOM-free by design: this module must stay import-safe so it can be pulled into
// the game bundle without triggering any page bootstrap.
'use strict';

export const SETUP_STEPS = [
  {
    n: 1,
    title: 'Host a Game',
    badge: 'Free Account Required',
    body: 'Tap <strong>Start Game → Online → Create Private Room</strong>. You’re now the Funeral Director (the host).',
  },
  {
    n: 2,
    title: 'Share the Link',
    body: 'Tap your <strong>Room Code</strong> to copy the invite link, then send it to your friends however you like.',
  },
  {
    n: 3,
    title: 'Join & Start',
    badge: 'No Account Required',
    badgeVariant: 'ok',
    body: 'Your friends open the link to jump straight in. Once everyone has joined, tap <strong>Start Game</strong>.',
  },
];

export const DECKS = [
  { key: 'die', name: 'Die', img: 'assets/card-backs/die-back.jpg', count: 48, desc: 'How you cark it.' },
  { key: 'live', name: 'Live', img: 'assets/card-backs/live-back.jpg', count: 68, desc: 'Things to do before you die.' },
  { key: 'bye', name: 'Bye', img: 'assets/card-backs/bye-back.jpg', count: 68, desc: 'What happens after you’re gone.' },
];

export const PHASES = [
  {
    n: 1,
    key: 'die',
    title: 'Die!',
    body: 'Draw a death card and tell everyone how you go. No points — just setting the scene.',
  },
  {
    n: 2,
    key: 'live',
    title: 'Live!',
    body: 'Everyone pitches a Live card for how you should spend your time. Pick your favourite — the player who pitched it scores a point.',
  },
  {
    n: 3,
    key: 'bye',
    title: 'Bye!',
    body: 'Same again with Bye cards: everyone pitches what happens after you die. Pick your favourite to award a point.',
  },
  {
    n: 4,
    key: 'wildcard',
    title: 'Eulogy Wildcard',
    body: 'Play a Wildcard to send two players head-to-head delivering your eulogy. Judge the best one and hand out bonus points all round.',
  },
];
