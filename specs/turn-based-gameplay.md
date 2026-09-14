# Turn-Based Gameplay

Status: Implemented

Retrospective spec documenting existing behaviour; untested areas listed under Open Questions / Risks.

## Overview

### Purpose

Two players take turns drawing a single freehand polyline between consecutively numbered points; the first player to cross an existing line, intersect their own stroke, or touch a forbidden number loses. Today this flow lives across `server/server.js` (`submit_move`, `request_game_sync`) and `client/game.js` (mouse/touch drawing), but the exact contract — who may move, what is broadcast, and how the client enforces the number sequence — was never written down. This spec records that contract and which tests prove each part of it, so future changes to the turn engine cannot silently break it.

### Goals

- Only the player whose socket id equals `room.currentTurn` can mutate game state.
- Every accepted move is broadcast to the whole room as a single `move_made` event and keeps lobby lists fresh.
- Any client can reconstruct the full game at any time via `request_game_sync` → `game_sync`.
- The client enforces the number sequence (1 → 2 → 3 …) and the no-crossing rule locally, before a move reaches the server.
- The turn indicator and next-number display always reflect `currentTurn` and `currentNumber`.

### Non-Goals

- Server-side `game_over` handling (winner/loser assignment, broadcast) — covered by the game-end spec.
- Collision geometry of `client/collision.js` (`doPolylineIntersection`) — covered by the overlap spec.
- Rematch request/accept flow and `game_restarted` — covered by the rematch spec.
- Room creation, join, leave, reconnection/session restore — covered by their own specs (this spec only documents the turn-inheritance hook those flows trigger).
- Lobby "Mis Partidas" rendering and stats; canvas rendering details (`draw()`); `exportToImage`.
- Win/lose messaging text and confetti presentation.

### Scope

Included: the `submit_move` gate and state mutation, the `move_made` broadcast, `request_game_sync`/`game_sync`, the client drawing input pipeline (mouse + touch) with its 20 px snap and sequence enforcement, and the whose-turn UX. Excluded: everything under Non-Goals.

## Architecture

### Module/package layout (tree format)

```
papa-online/
├── server/
│   └── server.js          # submit_move gate + state mutation, request_game_sync,
│                          # move_made / my_games_update emission (lines 289-319, 271-287)
├── client/
│   ├── game.js            # Game class: drawing input (mouse/touch), 20 px snap,
│   │                      # sequence enforcement, checkCollisions, updateTurn UX
│   ├── collision.js       # doPolylineIntersection (geometry, own spec)
│   ├── main.js            # enterGame() wiring, game_sync/move_made listeners, stats
│   └── index.html         # #game-canvas, #turn-indicator, #current-player-display,
│                          # #next-number-display, #point-count-select
└── tests/e2e/             # Playwright flows exercising draw → submit → turn swap
```

### Component diagram (ASCII)

```
        Browser A (creator)                 Browser B (joiner)
   ┌─────────────────────────┐        ┌─────────────────────────┐
   │ main.js                 │        │ main.js                 │
   │  enterGame() ───────────────┐    │  enterGame() ───────────────┐
   │  move_made / game_sync  │     │    │  move_made / game_sync  │    │
   ├─────────────────────────┘     │    ├─────────────────────────┘    │
   │ game.js                       │    │ game.js                      │
   │  mousedown/mouseup/touch*     │    │  (same input pipeline)       │
   │  snap + checkCollisions       │    │                              │
   └───────────┬───────────────────┘    └────────────┬─────────────────┘
               │ submit_move {roomCode, line}         │ request_game_sync
               ▼                                      ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │ server.js (in-memory rooms)                                     │
   │  submit_move: currentTurn gate → mutate → move_made (room)      │
   │               → lastActivity → my_games_update (each player)    │
   │  request_game_sync: → game_sync (full payload, unicast)         │
   └─────────────────────────────────────────────────────────────────┘
```

### Data flow summary

- **Accepted move**: client emits `submit_move {roomCode, line}` → server checks `room.currentTurn === socket.id` → pushes `line`, increments `currentNumber`, switches turn → broadcasts `move_made {line, nextNumber, currentTurn}` to the room → both clients apply it locally (`lines.push`, `updateTurn`, redraw) → server bumps `lastActivity` and emits `my_games_update` to each player for the lobby.
- **Rejected move**: `submit_move` from a socket whose id is not `currentTurn`, or for an unknown `roomCode`, falls through the gate and is silently dropped — no state change, no emit.
- **Sync**: any client emits `request_game_sync {roomCode}` → server unicasts `game_sync` with the full room snapshot → client calls `game.syncState(...)` to replace its local numbers/lines/turn state.
- **Crash (loss)**: while drawing, the client detects a crossing/self-intersection/forbidden-number touch and emits `game_over` itself; server assigns winner/loser (game-end spec).

## Data model

### Core Entities

All server-side state is held in two in-memory plain objects: `rooms` (keyed by room code) and `playerSessions` (keyed by identity token).

```js
Room {
  roomCode: string        // 6-char base36 uppercase, generated at create_room
  players: Player[]       // 1 creator at creation, +1 on join (max 2 for gameplay)
  numbers: Number[]       // board points, value 1..N
  lines: Line[]           // accepted strokes, one per completed move
  currentNumber: number   // sequence pointer, starts at 1, +1 per accepted move
  currentTurn: string|null// socket id of the player to move; null = waiting for joiner
  lastActivity: number    // epoch ms, bumped on every accepted move (drives 3-day cleanup)
  winner: string|null     // token of the winner (set by game_over, game-end spec)
  loser: string|null      // token of the loser
  rematchRequestedBy: string|null // token (rematch spec)
}

Player {
  id: string       // Socket.IO socket id — what currentTurn compares against
  username: string // display name
  token: string    // client-generated identity token (localStorage session_token)
}

PlayerSession {           // playerSessions[token]
  username: string
  rooms: string[]         // room codes this token participates in
}

Number { value: number, x: number, y: number }   // generateNumbers(count, 600, 800)
Line    = Array<{ x: number, y: number }>        // freehand stroke points
```

Client-side, `Game` mirrors the room state (`numbers`, `lines`, `currentNumber`, `isMyTurn`, `isGameOver`, `myPlayerId = socket.id`, `roomCode`, `token`) and persists to `localStorage`:

| Key | Value |
|---|---|
| `session_token` | UUID generated once, reused as the identity `token` |
| `username` | last used display name |
| `papa_online_stats` | JSON blob of per-opponent win/loss stats |

### Relationships

- A `Room` has 1–2 `Player`s; `currentTurn` holds exactly one `Player.id` (or `null` between a solo creator move and the join).
- A `Player` maps to one `PlayerSession` via `token`; the session lists every room the token plays in, enabling multi-room reconnection.
- `lines.length + 1 === currentNumber` after every accepted move: each line connects number `currentNumber - 1` to number `currentNumber`.
- `move_made`/`game_sync` carry only plain serialisable snapshots of the entities above — the client never mutates server state directly.

### Persistence Notes

Everything server-side is in-memory: `rooms` and `playerSessions` are lost on server restart; `lastActivity` older than 3 days (`3 * 24 * 60 * 60 * 1000` in `server/server.js`) makes a room eligible for scheduled deletion, which emits `room_deleted` + `my_games_update` to its players. The only durable state is client-side: `session_token`, `username`, and `papa_online_stats` in `localStorage`. No database, no schema, no indexes.

## Workflows

### W1 — Accept a turn-based move (happy path)

1. Player P1 (creator) and P2 (joiner) are in the room; `currentTurn` is the socket id of one of them.
2. The player to move draws a stroke from number `currentNumber` to number `currentNumber + 1` (see W3); the client emits `submit_move { roomCode, line }`.
3. Server finds `rooms[roomCode]` and checks `room.currentTurn === socket.id` (server.js:289-291). Both true → accept.
4. Server mutates: `room.lines.push(line)`, `room.currentNumber++`.
5. Turn switch: with 2 players, `currentTurn` becomes the opponent's socket id (found by `p.id !== socket.id`; falls back to the mover's own id if no opponent is found); solo (creator moved before the opponent joined) → `currentTurn = null`.
6. Server broadcasts `move_made { line, nextNumber: room.currentNumber, currentTurn }` to the whole room via `io.to(roomCode)`.
7. Server sets `room.lastActivity = Date.now()` and emits `my_games_update` (no payload) to every player in the room so lobby lists refresh.
8. Each client's `move_made` handler pushes `line` (only when truthy), sets `currentNumber = nextNumber`, calls `updateTurn(currentTurn)`, redraws.

### W2 — Rejected move (failure path)

A `submit_move` arrives from a socket whose id is not `room.currentTurn` (e.g. before joining, or after the turn passed), or its `roomCode` is unknown. The single gate `if (room && room.currentTurn === socket.id)` fails and the handler returns: no `move_made`, no `lines`/`currentNumber`/`currentTurn` change, no `my_games_update`. There is no error feedback — the event is silently ignored by design.

### W3 — Draw and submit a line on the client

1. Stroke start (`mousedown` or `touchstart` on `#game-canvas`): `handleMouseDown` returns immediately if `!isMyTurn || isGameOver || numbers.length === 0`. Otherwise it locates the number with `value === currentNumber`; if the press lands within 20 px (`isNear`, Euclidean distance `< 20`), the stroke starts snapped to that number's center; otherwise nothing starts.
2. Stroke extension (`mousemove`/`touchmove`, both `preventDefault`): each point is appended to `currentLine`. On every extension the client runs `checkCollisions`: crossing any existing line (with a 15 px safe zone around the start number), self-intersection, or bringing the stroke head within 20 px of any number that is neither the current nor the next one. On a hit, the client emits `game_over { roomCode, reason: "Cruzó una línea", lastLine }`, marks itself lost locally, and stops (see the game-end spec for the server side).
3. Stroke release (`mouseup` on `window`, or `touchend`): if `currentLine` exists and the game is not over, the client finds the number with `value === currentNumber + 1`:
   - Release within 20 px → the endpoint snaps to that number's center, `checkCollisions` runs once more, and if clean the client emits `submit_move { roomCode, line }`, clears the stroke, sets `isMyTurn = false`, and redraws (W1 takes over).
   - Release anywhere else → the line is discarded (`currentLine = null`), nothing is emitted.
4. There is no completion win: connecting the last number emits nothing; the game loop simply stops animating when `currentNumber > numbers.length`. The only way a game ends is an emitted `game_over`.

### W4 — Solo creator move, then joiner inherits the turn

1. Creator makes the first accepted move before anyone joined (W1 step 5 solo branch): `currentTurn = null`, and the `move_made` broadcast carries `currentTurn: null`.
2. Later, a player joins via `join_room`: the join handler sees `room.currentTurn === null` and assigns the turn to the joiner's socket id (server.js:233-236).
3. The joiner receives a `game_sync` with the post-move state, and the creator receives `move_made { line: null, nextNumber, currentTurn }` — with a null `line`, so the creator's client updates the turn without adding a phantom line.

### W5 — Reconnect / screen restore via sync

1. Any `enterGame()` call (room created, room joined, lobby click, reconnection) switches to `#game-screen` and emits `request_game_sync { roomCode }`.
2. Server responds to the requesting socket only, with `game_sync` carrying the full snapshot (see APIs).
3. Client's `game_sync` handler restores the UI, calls `game.syncState(numbers, lines, currentNumber, currentTurn, isGameOver)` (which also re-shows the game-over screen if `isGameOver`), and stores winner/loser/player metadata.

## APIs

Transport is Socket.IO over WebSocket; there are no HTTP endpoints. Auth: none server-side — see Permissions.

### Client → Server

| Event | Payload | Purpose |
|---|---|---|
| `submit_move` | `{ roomCode: string, line: Line }` | Submit the stroke drawn this turn. Accepted only while `room.currentTurn === socket.id`; otherwise silently ignored. |
| `request_game_sync` | `{ roomCode: string }` | Ask for a full state snapshot of a known room. |
| `game_over` | `{ roomCode: string, reason: string, lastLine: Line }` | Emitted by the client that detected its own losing stroke (W3 step 2). Winner/loser assignment is the game-end spec's concern. |

### Server → Client

| Event | Payload | Purpose |
|---|---|---|
| `move_made` | `{ line: Line\|null, nextNumber: number, currentTurn: string\|null }` | Broadcast to the room after every accepted move. `line: null` variant is emitted to the creator when a joiner inherits a `null` turn (W4). |
| `game_sync` | see table below | Unicast full state snapshot, in reply to `request_game_sync` and on join. |
| `my_games_update` | `{}` (no payload) | Tells the client to refetch its lobby list; emitted per player after every accepted move. |
| `game_start` | `{ numbers: Number[], currentTurn: string }` | Sent to the creator at room creation; bootstraps the board before any move exists. |
| `game_over` | `{ reason: string, loser: string }` | Broadcast result of a game_over submission; the client shows "¡Perdiste!"/"¡Ganaste!" based on `loser === token`. |

### `game_sync` payload

| Field | Type | Meaning |
|---|---|---|
| `roomCode` | string | Room identifier |
| `numbers` | `Number[]` | Board points |
| `lines` | `Line[]` | Accepted strokes |
| `currentNumber` | number | Sequence pointer (starts 1) |
| `currentTurn` | string\|null | Socket id to move next, `null` while waiting for the joiner |
| `isGameOver` | boolean | `!!room.winner` |
| `winner` | string\|null | Winner token |
| `loser` | string\|null | Loser token |
| `players` | `{ username, token }[]` | Room members mapped to display data only |
| `rematchRequestedBy` | string\|null | Token of the rematch requester, if any |

## Client SDK Design

There is no SDK; `client/game.js` (the `Game` class) plus `client/main.js` are the client library. Consumption pattern:

- **Initialization**: `enterGame(roomCode)` in `main.js` shows `#game-screen`, sets `#room-code-display`, instantiates `new Game(canvas, username, roomCode, socket, sessionToken)` once (reusing the instance and updating `roomCode`/`username` afterwards), and emits `request_game_sync`. The creator additionally receives `game_start` → `game.startGame(numbers, currentTurn)`.
- **State application**: `game.syncState(numbers, lines, currentNumber, currentTurn, isGameOver)` wholesale-replaces local state; `move_made` applies incrementally (`lines.push(line)` when truthy, `currentNumber = nextNumber`, `updateTurn`, redraw).
- **Turn UX**: `updateTurn(currentTurnId)` computes `isMyTurn = (currentTurnId === this.myPlayerId)`, renders "Tu Turno"/"Turno del Oponente" on `#current-player-display` with the `my-turn`/`opponent-turn` CSS classes, and sets `#next-number-display` to `currentNumber + 1`. Drawing input is inert whenever `isMyTurn` is false or `isGameOver` is true (W3 step 1 guard).
- **Retry/persistence**: none — events are fire-and-forget; recovery is always a fresh `request_game_sync`. Optimistic local `isMyTurn = false` after submitting prevents double-submit before the broadcast arrives.
- **Notifications**: `main.js` also listens to `move_made` to surface a notification when the resulting `currentTurn` is the local player's.

## Configuration

| Setting | Where | Values / default |
|---|---|---|
| `PORT` | env var, `server/server.js` | default `3000` |
| Board point count | `#point-count-select` at room creation (`create_room` `pointCount`) | `10`, `15`, `20` (default), `25`, `30` |
| Board size | hardcoded | 600 × 800 canvas units, 40 px padding |
| Number placement | `generateNumbers` / `checkOverlap` | minimum 40 px distance between numbers |
| Snap radius | `game.js` `isNear` | 20 px (stroke start, stroke end, forbidden-number head check) |
| Collision safe zone | `game.js` `checkCollisions` | 15 px radius around the start number |
| Room expiry | `server.js` `cleanupDelay` | 3 days since `lastActivity` |

## Permissions

Trust model: any connected client may emit any event; the server validates nothing but the turn gate and room existence. `currentTurn === socket.id` is the single authorization for state mutation; identity `token`s are unvalidated identity labels, not credentials. There are no roles — creator and joiner differ only in who holds the turn.

## Security Considerations

- **Server trusts client-emitted `game_over`**: any client can emit `game_over` at any time (not just after a detected collision) and the server assigns winner/loser accordingly — a client can declare itself the winner by lying. Accepted as-is for a casual game; hardening means server-side collision validation.
- **`submit_move` line content is unvalidated**: the gate checks only the turn; geometry (self-intersection, crossing, number snapping) is enforced exclusively client-side, so a modified client can submit arbitrary line data.
- **Tokens are not secrets**: `game_sync` hands both players' tokens to every syncing client; possession of a token lets anyone observe that player's sessions. Fine for this threat model; do not reuse these tokens as auth elsewhere.

## Dependencies

- `socket.io` — event transport (server + client).
- No other runtime dependency for this feature: canvas 2D and pointer/touch events are platform APIs; tests use `jest` (server) and `@playwright/test` (e2e).

## Open Questions / Risks

Coverage gaps — behaviours shipped but not asserted by any current test:

- **Out-of-turn `submit_move` is silently ignored** (W2): no test sends a `submit_move` from a non-turn socket or an unknown room and asserts no `move_made`/no state change.
- **Solo creator move → `currentTurn = null` + joiner inheritance** (W4): untested; join-side inheritance is only indirectly implied by the join flow (server.js:233-236).
- **`lastActivity` bump + `my_games_update` fan-out on accepted move** (W1 step 7): untested.
- **Full `request_game_sync` payload**: the join-time `game_sync` test asserts only `numbers` and `currentTurn`; `lines`, `isGameOver`, `winner`, `loser`, `players`, `rematchRequestedBy` are never asserted.
- **Invalid release discards the stroke without emitting `submit_move`** (W3 step 3 else-branch): untested.
- **Drawing input inert when it is not the player's turn or the game is over** (`handleMouseDown` early return): untested — e2e only ever draws on the moving player's turn.
- **Client modules have no unit tests**: `client/game.js`, `client/collision.js`, `client/main.js` are only exercised indirectly through Playwright e2e; a client-side regression in snapping or collision detection could go uncaught between e2e runs.

## Verifications

- Turn-gated move acceptance, `nextNumber` increment, and room-wide `move_made` broadcast on both clients — PASS: `should handle turn-based moves correctly` (`server/server.integration.test.js`)
- Join-time `game_sync` delivers at least `numbers` and `currentTurn` to the joining player — PASS (partial payload coverage): `should allow second player to join room` (`server/server.integration.test.js`)
- A real mouse drag 1 → 2 draws, submits, and swaps the turn indicator (moving player `my-turn` → opponent `opponent-turn`) — PASS: `Player 1 Wins (Player 2 crashes)` (`tests/e2e/win.spec.js`)
- Drawing into a forbidden number (1 → 3) triggers the client collision check, emits `game_over`, and both players see the loss/win result — PASS: `Player 2 Wins (Player 1 crashes)` (`tests/e2e/win.spec.js`)
- After both players join, the game screen restores (`#game-screen`, `#room-code-display`, visible `#game-canvas`) and `#turn-indicator` is visible on both pages — PASS: `Player 1 creates room and Player 2 joins` (`tests/e2e/basic.spec.js`)

## Appendices

### Compatibility notes

- `currentTurn` stores raw Socket.IO ids, so it is invalidated by any reconnect; the reconnection path re-binds the turn to the new socket id when it belonged to the old one (server.js:123-126) — a dependency this spec relies on but does not own.
- `move_made` with `line: null` (turn-inheritance notification, W4 step 3) is a documented variant clients must keep tolerating.

### Future considerations

- Server-side validation of `submit_move` line geometry and of `game_over` claims would close the trust gaps in Security Considerations.
- The untested behaviours in Open Questions / Risks are natural first candidates for new `server/server.integration.test.js` cases (turn gate, solo-move turn inheritance, sync payload) and one e2e case (invalid release, inert input).
