# Carked It! Online

A turn-based card game web app — vanilla HTML/CSS/JS, no frameworks.

**Buy the physical card game:** [carkedit.com](https://carkedit.com)

**Live:** [brennan.games/carkeditonline](https://brennan.games/carkeditonline)

---

## About

Carked It! is a party card game about death. Players draw cards across four phases, with a Funeral Director guiding the round. The game ends with a Eulogy Wildcard round and a winner reveal.

### Card Decks

| Deck | Colour | Cards |
|------|--------|-------|
| Die | Yellow | 48 |
| Live | Green | 68 |
| Bye | Blue | 68 (includes 2 Eulogy Wildcards) |

---

## Dev Setup

```bash
npm install
npm start
# Opens on http://localhost:4600
```

### Run Tests

```bash
npm test
npm run test:report  # view Playwright HTML report
```

---

## Architecture

- Single `index.html` — no page loads during the game
- All game state managed client-side in JavaScript
- Mobile-first layout, capped at mobile breakpoint on larger screens
- Cards use standard playing card aspect ratio (5:7)

### Key Files

| File | Purpose |
|------|---------|
| `index.html` | Entry point and game shell |
| `js/` | Game logic |
| `css/` | Styles |
| `assets/` | Card images and media |
| `gamedesign.md` | Technical design constraints |
| `gamerules.md` | Full game rules |
| `visualstyle.md` | Colour palette, typography, UI patterns |

---

## Deployment

Deploy via `deploy.php`. See wiki for full deployment docs:
[github.com/bh679/carkedit-online/wiki](https://github.com/bh679/carkedit-online/wiki)

---

## Version

Format: `V.MM.PPPP` — patch bumps on every commit, minor on every merged feature.

Current: see `package.json`.
