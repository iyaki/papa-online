# Rematch

Status: Implemented

Retrospective spec documenting existing behaviour; untested areas listed under Open Questions / Risks.

## Overview

### Purpose

When a game ends, players are dropped on a dead game-over screen with no way to play again against the same opponent. The rematch feature lets a finished-game player request a rematch; the opponent accepts (starting a fresh game with the same difficulty, accepting player moves first) or rejects (notifying the requester). The my-games lobby (`my-games`) reflects the pending rematch status so the request is visible even after leaving the game screen.

Job to be done: "I just lost a close game and want an immediate re-run against the same person, without creating a new room and sharing a new code."

### Goals

- One-click rematch request from the game-over screen (`#rematch-btn`).
- Accepting player always starts the new game; difficulty (point count) is preserved.
- Rejection notifies the requester and leaves the finished game untouched.
- Rematch state survives page reloads and reconnections via `game_sync`.
- The lobby shows who requested the rematch and ranks opponent-pending rematches highest.

### Non-Goals

- Swapping turns randomly or by a loser-starts rule on rematch (current rule: accepting player always starts).
- Rematch when a player has left the room / disconnected (rematch requires both players' current socket sessions).
- Multi-round rematch history or scoring across rematches.
- Rejecting from the lobby without an active game screen.

### Scope

The feature spans two server handlers, four client socket handlers, and the lobby renderer. Requirements:

| Id | Requirement |
|----|-------------|
| R1 | A player in a finished game can request a rematch (`request_rematch`). The server stores the requester's token in `room.rematchRequestedBy`, emits `rematch_requested` (no payload) to the opponent, and emits `my_games_update` to both players so the lobby shows the pending state. |
| R2 | The opponent can accept via `respond_rematch` with `accept: true`. The server regenerates numbers with the same point count (`pointCount = room.numbers.length`, `generateNumbers(pointCount, 600, 800)`), clears `lines`, resets `currentNumber` to 1, clears `winner` / `loser` / `rematchRequestedBy`, sets `currentTurn` to the ACCEPTING player's socket id, emits `game_restarted` (payload `{ numbers, currentTurn }`) to the room, and emits `my_games_update` to both players. |
| R3 | The opponent can reject via `respond_rematch` with `accept: false`. The server clears `room.rematchRequestedBy`, emits `rematch_rejected` (no payload) to the requester, and emits `my_games_update` to both players. The game stays in its finished state. |
| R4 | Client shows the rematch UI after game over (`#rematch-btn`), a "waiting for response" state for the requester, and an accept/reject prompt (`#rematch-request-container` with `#accept-rematch-btn` / `#reject-rematch-btn`) for the opponent, driven by the `rematch_requested` / `rematch_rejected` / `game_restarted` socket events in `client/main.js`. |
| R5 | On reconnection (`game_sync`), the client restores the rematch UI state from the `rematchRequestedBy` field: the requester sees a disabled "Esperando respuesta..." button; the opponent sees the accept/reject prompt. |
| R6 | The my-games lobby renders the rematch status for finished games ("Esperando revancha..." if I requested, "¡Revancha pedida!" if the opponent requested) and sorts games with an opponent-pending rematch to the top (sort priority 3). |

## Architecture

### Module/package layout (tree format)

```
papa-online/
├── server/
│   └── server.js              # All server logic: rooms store, rematch handlers,
│                              #   game_sync, sendMyGames, generateNumbers
├── client/
│   ├── index.html             # Rematch DOM: #rematch-btn, #rematch-status,
│   │                          #   #rematch-request-container, #accept-rematch-btn,
│   │                          #   #reject-rematch-btn, #point-count-select
│   ├── main.js                # Socket wiring: rematch handlers, game_sync restore,
│   │                          #   lobby render (status text + sort priority)
│   ├── game.js                # Game state object; startGame(numbers, currentTurn)
│   │                          #   re-initializes canvas after game_restarted
│   └── collision.js           # Line/number collision checks used during play
└── tests/
    └── e2e/
        └── rematch.spec.js    # Playwright e2e for the full rematch flow
```

Rematch logic lives entirely in `server/server.js` (handlers `request_rematch`, `respond_rematch` around lines 381–446; `game_sync` lines 271–287; `sendMyGames` lines 86–109) and `client/main.js` (socket handlers lines 268–496; lobby render/sort lines 611–727).

### Component diagram (ASCII)

```
+---------------------+                                  +---------------------+
|   Browser: P1       |                                  |   Browser: P2       |
|  (requester)        |                                  |  (opponent)         |
|                     |                                  |                     |
| main.js handlers    |                                  | main.js handlers    |
|  #rematch-btn ----emit request_rematch --------------> |                     |
|  #rematch-btn <--emit rematch_requested -------------- |  shows prompt       |
|  waiting state      |                                  |  #accept/#reject    |
|                     |                                  |      |              |
|                     |                                  |      emit respond_  |
|                     |                                  |      rematch        |
| game_restarted <--emit game_restarted (to room) -------+  reset + startGame  |
| my_games_update <---emit my_games_update (to each) ---> | lobby refresh       |
+---------------------+                                  +---------------------+
        |                                                        ^
        v                                                        |
+-----------------------------------------------------------------------+
|                     server/server.js (Socket.IO)                      |
|  rooms{code: Room}  playerSessions{token: {username, rooms[]}}        |
|  request_rematch -> rematchRequestedBy = token                        |
|  respond_rematch  -> accept: reset room, currentTurn = acceptor       |
|                     reject:  rematchRequestedBy = null                |
|  request_game_sync -> game_sync (incl. rematchRequestedBy)            |
|  sendMyGames      -> my_games_list (incl. rematchRequestedBy)         |
+-----------------------------------------------------------------------+
```

### Data flow summary

- **Request:** click `#rematch-btn` → `request_rematch { roomCode }` → server sets `room.rematchRequestedBy = <requester token>` and bumps `lastActivity` → `rematch_requested` to opponent + `my_games_update` to both → opponent's client reveals the prompt; both clients re-fetch the lobby via `get_my_games`.
- **Accept:** `respond_rematch { roomCode, accept: true }` → server resets the room in place (new numbers, same count; `currentTurn` = accepting socket id) → `game_restarted { numbers, currentTurn }` to the room → both clients hide the game-over screen and call `game.startGame()` → `my_games_update` clears the pending flag in both lobbies.
- **Reject:** `respond_rematch { roomCode, accept: false }` → server clears `rematchRequestedBy` → `rematch_rejected` to requester + `my_games_update` to both → requester's client shows the rejection message and re-enables `#rematch-btn`; game stays finished.
- **Reconnect:** client enters a game (`enterGame` emits `request_game_sync`) → server replies `game_sync` including `rematchRequestedBy` → client re-derives requester/opponent UI by comparing `rematchRequestedBy` with its `session_token`.
- **Lobby:** every rematch state change ends with `my_games_update` to both players; each client answers it with `get_my_games`, and the server's `sendMyGames` includes `rematchRequestedBy` per game so the lobby can render status and sort priority.

## Data model

### Core Entities

`Room` — one entry per game in the in-memory `rooms` object, keyed by 6-char room code:

| Field | Type | Notes |
|-------|------|-------|
| `players` | `Array<{ id, username, token }>` | `id` is the live socket id (rewritten on reconnect); `token` is the stable identity. |
| `numbers` | `Array<{ value, x, y }>` | Regenerated on rematch accept with the same length. Board is 600×800. |
| `lines` | `Array` | Drawn lines; cleared on rematch accept. |
| `currentNumber` | `number` | Next number to connect; reset to 1 on rematch accept. |
| `currentTurn` | `socket id \| null` | Set to the ACCEPTING player's socket id on rematch accept. |
| `winner` | `token \| undefined` | Set by the (client-trusted) `game_over` event; cleared on rematch accept. |
| `loser` | `token \| undefined` | Cleared on rematch accept. |
| `rematchRequestedBy` | `token \| null \| undefined` | The rematch pending flag: the requester's token. Not initialized at room creation (`undefined` until first request). |
| `lastActivity` | `number` | Epoch ms; bumped by rematch request/response; drives the 3-day cleanup timer. |

`PlayerSession` — one entry per token in `playerSessions`: `{ username, rooms: string[] }` (room codes). Keeps finished games listed in the lobby.

`numbers` entry — `{ value: number (1..pointCount), x: number, y: number }`, placed by `generateNumbers(count, 600, 800)` with a 40px padding and a 40px minimum-distance overlap check (up to 100 placement attempts per number).

Client `localStorage` keys (per browser, never sent except the token at connect):

| Key | Content |
|-----|---------|
| `session_token` | UUID generated on first visit; sent as `socket.handshake.auth.token`; compared against `rematchRequestedBy` to decide requester vs opponent UI. |
| `username` | Remembered username for create/join forms. |
| `papa_online_stats` | JSON win/loss stats (unrelated to rematch state, listed for completeness). |

Client mirror: `game.rematchRequestedBy` on the Game object mirrors the server flag ('opponent' marker, own token, or `null`) so UI handlers can branch without extra server round-trips.

### Relationships

- A `Room` has exactly 2 `Player` entries (host + joiner); each belongs to one room at a time but a `PlayerSession` can list many rooms.
- `rematchRequestedBy` holds a `Player.token`; the client compares it to its own `session_token` to decide which UI branch to render (requester vs opponent).
- `my_games_list` entries are projections of `Room` state per token (via `playerSessions[token].rooms`), including `rematchRequestedBy` verbatim.

### Persistence Notes

There is no database and no SQL schema: `rooms` and `playerSessions` are plain in-memory JS objects in `server/server.js`. Everything server-side is lost on process restart (including pending rematches). The only persistence is client-side `localStorage` (`session_token`, `username`, `papa_online_stats`), which is why a token can outlive a server restart even though its rooms cannot. Rooms are deleted after 3 days of inactivity (`cleanupDelay = 3 * 24 * 60 * 60 * 1000`), at which point players get `room_deleted` + `my_games_update`.

## Workflows

**Request a rematch (R1, happy path)**

1. The game has ended (a `game_over` was processed; `room.winner` set). Both game-over screens show `#rematch-btn`.
2. Player A clicks `#rematch-btn`. The client optimistically disables the button, sets its text to "Esperando respuesta...", shows `#rematch-status` ("Esperando a que el oponente acepte..."), and sets `game.rematchRequestedBy = sessionToken`. Then it emits `request_rematch { roomCode }`.
3. Server: `room.rematchRequestedBy = tokenA`; `room.lastActivity = Date.now()`; emits `rematch_requested` (no payload) to Player B; emits `my_games_update` to both players.
4. Player B's client receives `rematch_requested`: hides `#rematch-btn`, reveals `#rematch-request-container` (accept/reject), sets `game.rematchRequestedBy = 'opponent'`.
5. Both clients receive `my_games_update`, re-emit `get_my_games`, and the lobby now shows the pending status.

**Accept a rematch (R2, happy path)**

1. Player B clicks `#accept-rematch-btn` → emits `respond_rematch { roomCode, accept: true }`.
2. Server, in order: `pointCount = room.numbers.length`; `room.numbers = generateNumbers(pointCount, 600, 800)`; `room.lines = []`; `room.currentNumber = 1`; `room.winner = null`; `room.loser = null`; `room.rematchRequestedBy = null`; `room.currentTurn = <B's socket id>` (the ACCEPTING player always starts); `room.lastActivity = Date.now()`.
3. Server emits `game_restarted { numbers, currentTurn }` to the room, then `my_games_update` to both players.
4. Each client hides the game-over screen, resets the rematch UI (hide prompt/status, re-show and enable `#rematch-btn`), clears local `lines`/`winner`/`loser`/`rematchRequestedBy`, and calls `game.startGame(numbers, currentTurn)`.
5. B's turn indicator shows `my-turn`; A's shows `opponent-turn`. Play resumes.

**Reject a rematch (R3, alternative path)**

1. Player B clicks `#reject-rematch-btn` → emits `respond_rematch { roomCode, accept: false }`. The client also hides the prompt locally, re-shows `#rematch-btn`, and clears `game.rematchRequestedBy`.
2. Server: `room.rematchRequestedBy = null`; emits `rematch_rejected` (no payload) to Player A (the requester); emits `my_games_update` to both players. The room keeps its finished state (`winner`/`loser` intact).
3. Player A's client shows `#rematch-status` "El oponente rechazó la revancha." (red), re-enables `#rematch-btn` ("Pedir Revancha"), clears `game.rematchRequestedBy`. A may request again.

**Restore rematch state on reconnect (R5)**

1. The client re-enters a game (e.g. from the lobby); `enterGame` emits `request_game_sync { roomCode }`. Server-side, a reconnecting socket with a known token has already been re-joined to its rooms and had its player `id` (and `currentTurn`, if it was theirs) remapped to the new socket id.
2. Server replies `game_sync { roomCode, numbers, lines, currentNumber, currentTurn, isGameOver, winner, loser, players, rematchRequestedBy }`.
3. If `isGameOver`, the client resets the rematch UI, then: if `rematchRequestedBy === sessionToken` → disable `#rematch-btn`, text "Esperando respuesta...", status "Esperando a que el oponente acepte..."; else if `rematchRequestedBy` is set → reveal `#rematch-request-container`, hide `#rematch-btn`.

**Edge / degenerate cases (as coded today)**

- `request_rematch` / `respond_rematch` for an unknown `roomCode` are silent no-ops (`if (room)` guard).
- No handler validates that the game is actually over: a rematch can be requested and accepted mid-game, resetting an unfinished game.
- No handler validates that the responder is the opponent of the requester: any room member can respond, and `respond_rematch` with `accept: true` resets the game even with no pending request.
- A second `request_rematch` overwrites `rematchRequestedBy` with the new requester's token.
- On reject, `rematch_rejected` goes to "the other player" (`p.id !== socket.id`); if the requester is gone from `room.players`, the emit is skipped but the request is still cleared and `my_games_update` still fans out.

## APIs

Transport is Socket.IO; there are no HTTP endpoints beyond socket handshake. Base identity: `socket.handshake.auth.token` (the `session_token` from `localStorage`). Tokens are identity, not authentication (see Permissions).

Client → Server events:

| Event | Payload | Purpose |
|-------|---------|---------|
| `request_rematch` | `{ roomCode }` | Store requester token, notify opponent, update lobbies. (R1) |
| `respond_rematch` | `{ roomCode, accept: boolean }` | Accept (`true`: reset room and restart) or reject (`false`: clear request, notify requester). (R2, R3) |
| `request_game_sync` | `{ roomCode }` | Ask for full room state after (re)entering a game; reply carries `rematchRequestedBy`. (R5) |
| `get_my_games` | none | Re-fetch the lobby list; triggered by `my_games_update`. (R6) |

Server → Client events:

| Event | Payload | Purpose |
|-------|---------|---------|
| `rematch_requested` | none | Sent to the opponent: show the accept/reject prompt. (R1, R4) |
| `rematch_rejected` | none | Sent to the requester: show rejection message, re-enable request button. (R3, R4) |
| `game_restarted` | `{ numbers: [{value,x,y}], currentTurn: socketId }` | Sent to the room: replace the finished game with a fresh one. (R2, R4) |
| `my_games_update` | none | Sent to both players on every rematch state change: signal to re-fetch the lobby. (R1–R3, R6) |
| `game_sync` | `{ roomCode, numbers, lines, currentNumber, currentTurn, isGameOver, winner, loser, players, rematchRequestedBy }` | Full room state for (re)entry; `rematchRequestedBy` drives rematch UI restore. (R5) |
| `my_games_list` | `[{ roomCode, opponentName, isMyTurn, isGameOver, winner, loser, rematchRequestedBy }]` | Lobby payload; `isGameOver` is `!!winner`; `rematchRequestedBy` feeds status text and sort. (R6) |

## Client SDK Design

"SDK" here is the vanilla-JS client (`client/main.js` + `client/game.js`); there is no generated SDK.

Initialization:

- On load, the client reads `session_token` from `localStorage` (generating a UUID if absent) and opens the Socket.IO connection with `auth: { token }`.
- All rematch UI elements already exist in `client/index.html`; handlers toggle the `hidden` class and `disabled` state.

Event wiring:

| Trigger | DOM elements | Behaviour |
|---------|--------------|-----------|
| `#rematch-btn` click | `#rematch-btn`, `#rematch-status` | Optimistic waiting state + emit `request_rematch`; sets `game.rematchRequestedBy = sessionToken`. |
| `rematch_requested` | `#rematch-request-container`, `#rematch-btn`, `#rematch-status` | Reveal prompt, hide request button, mark `game.rematchRequestedBy = 'opponent'`. |
| `#accept-rematch-btn` click | — | Emit `respond_rematch { accept: true }`; UI reset arrives with `game_restarted`. |
| `#reject-rematch-btn` click | `#rematch-request-container`, `#rematch-btn` | Emit `respond_rematch { accept: false }` + optimistic local reset. |
| `rematch_rejected` | `#rematch-status`, `#rematch-btn` | Red rejection message, re-enable request button, clear `game.rematchRequestedBy`. |
| `game_restarted` | game-over screen, rematch elements | Hide game-over, reset rematch UI, clear local state, `game.startGame(numbers, currentTurn)`. |
| `game_sync` (with `isGameOver`) | rematch elements | Restore requester/opponent branch from `rematchRequestedBy` vs `session_token`. |
| `my_games_update` | lobby list | Re-emit `get_my_games`; `my_games_list` re-renders statuses and sort. |

Behaviour expectations: UI updates are optimistic and fire-and-forget — there is no retry, no event queue, no dedup. If a socket message is lost, state recovers only via a fresh `game_sync` (re-entering the game) or the next `my_games_list` render.

## Configuration

| Setting | Source | Default / values |
|---------|--------|------------------|
| Server port | `PORT` env var (`server/server.js`) | `3000` |
| Point count (rematch preserves it) | `#point-count-select` in `client/index.html` | `10`, `15`, `20` (default), `25`, `30` |
| Board size for number generation | Hardcoded in `respond_rematch` / `create_room` | `600` × `800` |
| Number placement padding / min distance | `generateNumbers` / `checkOverlap` | `40` px / `40` px |
| Overlap placement attempts | `generateNumbers` loop | max `100` per number |
| Room inactivity cleanup | `cleanupDelay` in `scheduleCleanup` | `3` days (`3 * 24 * 60 * 60 * 1000`) |

## Permissions

Trust model: any connected client may emit any event; tokens are unvalidated identity, not authentication. There is no role system — the only rematch-relevant distinction is positional, derived at runtime from room membership and the pending flag:

| Position | Derived by | May |
|----------|-----------|-----|
| Requester | `room.rematchRequestedBy === its token` | Request/ re-request; sees waiting state; receives `rematch_rejected`. |
| Opponent | any other player in the room | Receive `rematch_requested`; accept or reject. |

The server does not enforce that only the requester requests or only the non-requester responds (see Security Considerations).

## Security Considerations

- **Token = identity, not auth.** `session_token` is a client-generated UUID sent at handshake; the server never validates it beyond session existence. Anyone who knows/guesses a token can act as that player.
- **No game-over guard.** `request_rematch` and `respond_rematch` do not check `room.winner`; a rematch accept resets an in-progress game if triggered mid-game.
- **No membership/role validation on `respond_rematch`.** Any socket that knows the `roomCode` can join-independent events; any room player can accept/reject a request addressed to someone else, and `accept: true` works with no pending request.
- **Overwrite semantics.** A duplicate `request_rematch` silently re-points `rematchRequestedBy` at the latest requester.
- **Room code guessability.** Room codes are 6-char random base-36 strings; `roomCode` is the only capability check on every handler.

## Dependencies

| Dependency | Where | Rationale |
|------------|-------|-----------|
| `socket.io` ^4.7.2 | server | Rooms, per-socket emits, auth at handshake. |
| `express` ^4.18.2 | server | Serves the static client; not used by rematch logic itself. |
| Socket.IO browser client | `client/index.html` | Event transport for all rematch messages. |
| `jest` ^30.5.1 + `socket.io-client` ^4.8.3 | server devDeps | Unit/integration test harness (no rematch tests yet — see Risks). |
| Playwright | root devDeps | E2E coverage of the rematch flow (`tests/e2e/rematch.spec.js`). |

## Open Questions / Risks

Untested behaviours (each was an unchecked acceptance criterion in the backfilled spec; none is covered by any test today):

- **Rejection path untested.** No test exercises `respond_rematch { accept: false }`: that `rematchRequestedBy` is cleared, the requester receives `rematch_rejected`, both players get `my_games_update`, and the finished game stays intact. (Was AC5.)
- **Server-side rematch handlers have no integration test.** Room-state mutation is unverified: `rematchRequestedBy` storage on request and clearing on respond, number regeneration with the same point count, reset of `lines`/`currentNumber`/`winner`/`loser`, `currentTurn` set to the accepting player's socket id, and the `game_restarted` / `rematch_rejected` emissions. (Was AC6.)
- **Reconnect rematch-state restore untested.** No test covers re-entering a finished game with a pending rematch and verifying the requester/opponent UI branches restored from `game_sync`'s `rematchRequestedBy`. (Was AC7.)
- **Lobby rematch status/sort untested.** No test verifies the status text ("Esperando revancha..." / "¡Revancha pedida!") nor that opponent-pending rematches sort to the top (priority 3). (Was AC8.)

Design risks observed in code (accepted for now, documented so they are visible):

- Missing guards listed under Edge / degenerate cases (no game-over check, no responder validation, overwrite on duplicate request) — a malicious or buggy client can reset a live game.
- Rematch depends on both players still being in `room.players`; if one left the room, `rematch_requested` is skipped but the flag is still stored, so the lobby can show a pending rematch nobody can accept.

## Verifications

- After a game ends, both players see `#rematch-btn` on their game-over screen — PASS: `Full Rematch Flow (Request -> Accept -> New Game)` (`tests/e2e/rematch.spec.js`).
- After the requester clicks `#rematch-btn`, the button is disabled showing "Esperando respuesta", `#rematch-status` shows "Esperando a que el oponente acepte", and the opponent's `#rematch-request-container` becomes visible — PASS: `Full Rematch Flow (Request -> Accept -> New Game)` (`tests/e2e/rematch.spec.js`).
- After the opponent clicks `#accept-rematch-btn`, both game-over screens hide, the game restarts with new numbers, and the accepting player holds the turn (`my-turn` for the acceptor, `opponent-turn` for the requester) — PASS: `Full Rematch Flow (Request -> Accept -> New Game)` (`tests/e2e/rematch.spec.js`).
- After acceptance both players can play again (a valid move is made in the new game) — PASS: `Full Rematch Flow (Request -> Accept -> New Game)` (`tests/e2e/rematch.spec.js`).

## Appendices

### Compatibility notes

- Rematch event names/payloads (`request_rematch`, `respond_rematch`, `rematch_requested`, `rematch_rejected`, `game_restarted`, `my_games_update`, field `rematchRequestedBy`) are the wire contract; older deployed clients do not exist as a managed population (no versioning), so any payload change must ship server+client together.
- `rematchRequestedBy` being `undefined` (never requested) vs `null` (cleared) is treated identically by all consumers (truthiness checks); keep it that way.
- Difficulty preservation relies on `room.numbers.length`; if board size ever changes between create and rematch, the rematch still uses 600×800 with the original count.

### Future considerations

- Close the tested-behaviour gaps listed under Open Questions / Risks: a rejection-path integration test, a `request_rematch`/`respond_rematch` integration suite, a reconnect-restore e2e, and a lobby status/sort e2e.
- Loser-starts (or alternating) turn rule on rematch.
- Rejecting a rematch from the lobby without re-entering the game screen.
