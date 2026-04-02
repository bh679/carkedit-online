# Gate 2 — Testing Report: Online Lobby Host Settings

## Screenshot

See preview screenshot above showing the host view with:
- Room code "ABCDE" displayed
- Player list (Brennan: Ready, Simon: Connected)
- **Room Settings** section with checked "Auto-start when everyone is ready" checkbox
- "Start Game (2 players)" button

## Local URL

http://localhost:59579

## Automated Test Results

| Test | Result |
|------|--------|
| Host view renders settings section | PASS |
| Checkbox is checked by default (autoStartOnReady: true) | PASS |
| Non-host view hides settings section entirely | PASS |
| Checkbox accent colour matches brand purple (#9842FF) | PASS |
| No console errors | PASS |

## Manual Testing Instructions

1. Open http://localhost:59579
2. Click "Start Game" -> "Online" to reach the online lobby
3. **Host view** (requires Colyseus server on port 4500):
   - Create a room — you should see "Room Settings" with a checked checkbox below the player list
   - Uncheck the checkbox — it should toggle and send a `setting` message to the server
4. **Non-host view**:
   - Join the same room from a second tab — no "Room Settings" section should appear
   - Only "Waiting for host to start the game..." is shown

**Note:** The Colyseus server is not in this worktree, so full end-to-end testing requires the server running separately. The client-side behaviour has been verified by simulating state directly.

## Changes Summary

- `js/state.js` — Added `onlineSettings.autoStartOnReady` (default: true)
- `js/screens/online-lobby.js` — Host-only "Room Settings" section with checkbox
- `js/router.js` — `toggleOnlineSetting()` function, exposed on `window.game`
- `js/network/client.js` — `sendRoomSetting()` sends Colyseus message to server
- `css/screens/online-lobby.css` — Styles for settings container, row, and checkbox
- `package.json` — Version bumped to 1.05.0006
