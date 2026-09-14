# Room Lifecycle

Status: Implemented

Retrospective spec documenting existing behaviour; untested areas listed under Open Questions / Risks.

## Overview

### Purpose

Two players need a shared game they can both enter: one creates a room and gets a shareable 6-character code, the other joins by code. Players must also be able to re-enter a room from a new socket (same browser token), abandon a game (surrender), and the server must garbage-collect rooms nobody returns to. This spec documents the existing create / join / leave / cleanup behaviour of the Socket.IO server and the client flows built on it.

Jobs to be done:

- As a player, I create a room and get a short code to share.
- As an opponent, I join that code and immediately see the current game state.
- As a returning player, I re-enter my rooms from a fresh socket using my browser token.
- As a player who wants out, I abandon a room and it disappears from my list.
- As the operator, I do not want abandoned rooms to accumulate forever.

### Goals

- Room creation produces a unique-feeling 6-character code and an immediately playable board.
- Joining is a single event exchange that fully synchronizes the joiner.
- The same token always maps back to the same player, even from a new socket id.
- Leaving (surrender) cleans up player, session, and — when empty — the room itself.
- Rooms inactive for 3 days are deleted with a notification to their players.

### Non-Goals
- In-game moves, game over, and rematch flows — own specs (they only touch `lastActivity` here).
- Connection-time token reconnection (`io.on('connection')` rewriting socket ids and pushing `my_games_list`) — covered by the sessions/reconnection spec, not here.
- Any persistent storage for rooms or sessions.

### Scope

Included: `create_room`, `join_room` (new player, same-token rejoin, error paths), `leave_room`, `scheduleCleanup`, the room/session/point data they produce, and the client lobby/game-screen flows for these events. Excluded: everything after the room exists and has two players playing (moves, game over, rematch), and reconnection at socket-connect time.

## Architecture

### Module/package layout (tree format)

```
papa-online/
├── server/
│   ├── server.js                     # ALL server behaviour: rooms map, playerSessions map,
│   │                                 #   generateNumbers/checkOverlap, scheduleCleanup,
│   │                                 #   io.on('connection') with every socket.on handler
│   ├── server.test.js                # unit tests (pure functions)
│   └── server.integration.test.js    # Socket.IO integration tests (real server bootstrap)
├── client/
│   ├── index.html                    # lobby UI: #point-count-select, #create-room-btn,
│   │                                 #   #room-code-input, #join-room-btn, #room-code-display
│   ├── main.js                       # socket wiring, session token, lobby handlers, enterGame()
│   ├── game.js                       # canvas rendering once in a game (consumes game_start/game_sync)
│   └── collision.js                  # client-side line/point collision checks
└── tests/e2e/basic.spec.js           # Playwright: create + join UI flow
```

This spec owns the room-lifecycle handlers in `server/server.js` (`create_room`, `join_room`, `leave_room`, `scheduleCleanup`, `get_my_games`/`sendMyGames`) and their client counterparts in `client/main.js`. `client/game.js` and `client/collision.js` appear only as consumers of the events emitted here.

### Component diagram (ASCII)

```
        Browser A (creator)                      Browser B (joiner)
  ┌──────────────────────────┐           ┌──────────────────────────┐
  │ index.html  lobby/game   │           │ index.html  lobby/game   │
  │ main.js     socket wiring│           │ main.js     socket wiring│
  └────────────┬─────────────┘           └────────────┬─────────────┘
               │ socket.io (auth: { token })          │
               ▼                                      ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │ server/server.js                                                │
  │  io.on('connection'):                                           │
  │   create_room / join_room / leave_room / get_my_games handlers  │
  │   scheduleCleanup(roomCode) → setTimeout re-arm loop            │
  │                                                                 │
  │  In-memory state (lost on restart):                             │
  │   rooms = { roomCode: Room }                                    │
  │   playerSessions = { token: { username, rooms[] } }             │
  └─────────────────────────────────────────────────────────────────┘
```

### Data flow summary

- **Create**: `create_room` → server rolls a 6-char code, generates points, stores `rooms[code]`, registers `playerSessions[token]`, joins the socket to the room, emits `room_created` + `game_start` + `my_games_list` to the creator, arms `scheduleCleanup`.
- **Join (new player)**: `join_room` → server appends the player, emits `room_joined` (joiner) + `player_joined` (room broadcast) + full `game_sync` (joiner) + `move_made { line: null }` (creator, only when turn was `null`).
- **Join (same token)**: `join_room` → server rewrites the stored player's socket id to the new one and answers `room_joined`; no `game_sync`, no duplicate entry.
- **Leave**: `leave_room` → server filters the player out, unregisters the room from the session, broadcasts `player_left`, acks `left_room_success`, deletes the room if empty.
- **Cleanup**: `scheduleCleanup` self-reschedules; on expiry it emits `room_deleted` + `my_games_update` per player still registered, then deletes the room. Clients react to `my_games_update` by re-requesting `my_games_list`.

## Data model

### Core Entities

All entities are plain JS objects living in module-level maps in `server/server.js`. The written definitions below are the source of truth alongside the code.

**Room** — keyed by `roomCode` in `rooms`:

| Field | Type | Notes |
|---|---|---|
| `players` | `Player[]` | max 2; creator first, joiner second |
| `numbers` | `Point[]` | `pointCount` entries from `generateNumbers(count, 600, 800)` |
| `lines` | `Line[]` | empty at creation; owned by the gameplay spec |
| `currentNumber` | `int` | starts at 1 |
| `currentTurn` | `socketId \| null` | creator's socket id at creation; `null` while waiting for an opponent after the creator's first move |
| `lastActivity` | `epoch ms` | refreshed on `create_room`, `submit_move`, `game_over`, `request_rematch`, `respond_rematch` |
| `winner` / `loser` | `token \| null` | set by the game-over flow, not this spec |
| `rematchRequestedBy` | `token \| null` | set by the rematch flow, not this spec |

**Player** — embedded in `Room.players`:

| Field | Type | Notes |
|---|---|---|
| `id` | `socketId` | rewritten on same-token rejoin |
| `username` | `string` | client-supplied, unvalidated |
| `token` | `string` | client-generated UUID from `localStorage['session_token']`; the stable identity |

**PlayerSession** — keyed by `token` in `playerSessions`:

| Field | Type | Notes |
|---|---|---|
| `username` | `string` | overwritten on each create/join |
| `rooms` | `roomCode[]` | every room the token created or joined; rooms removed on `leave_room` and implicitly when cleanup deletes them (list entries to deleted rooms are filtered out when rendering `my_games_list`) |

**Point** — one entry of `Room.numbers`:

| Field | Type | Notes |
|---|---|---|
| `value` | `int` | 1..pointCount, draw order |
| `x`, `y` | `float` | inside a 600x800 board with 40px padding; ≥40px Euclidean distance from every other point (`checkOverlap`), up to 100 placement attempts per point |

**Client localStorage keys** (persisted per browser, never sent to storage server-side):

| Key | Content |
|---|---|
| `session_token` | UUID generated on first visit (`generateUUID()`), sent as `socket.handshake.auth.token` |
| `username` | last used username, pre-filled in the lobby |
| `papa_online_stats` | JSON win/loss stats (`loadStats`/`saveStats` in `client/main.js`) |

### Relationships

- A `Room` has 0–2 `Player`s; a `PlayerSession` tracks many `Room`s (1 token → N rooms); the pair (token, room) identifies a `Player` inside a room.
- `room.deleted` ⇒ session `rooms` entries pointing at it are stale but harmless: `sendMyGames` filters rooms missing from `rooms` before emitting `my_games_list`.
- `playerSessions` is the bridge this spec shares with the sessions/reconnection spec (same map, different event surface).

### Persistence Notes

Everything server-side is in-memory: `rooms` and `playerSessions` are plain objects, and cleanup timers are `setTimeout` handles. A server restart loses all rooms, sessions, and pending cleanup timers; clients keep only their `localStorage` keys (token, username, stats), so a restart silently invalidates every `my_games_list` entry until rooms are recreated. There is no SQL schema, no indexes, no constraints beyond `rooms` being keyed by `roomCode` and last-write-wins on every field.

## Workflows

### Create room (happy path)

1. Client clicks `#create-room-btn`; `main.js` reads `#username-input` and `parseInt(#point-count-select.value)`, emits `create_room { username, pointCount }`.
2. Server rolls `roomCode = Math.random().toString(36).substring(2, 8).toUpperCase()`.
3. Server generates `pointCount` points (`generateNumbers(pointCount, 600, 800)`).
4. Server stores the Room (`currentTurn` = creator socket id, `lastActivity` = now), registers/extends `playerSessions[token].rooms`, `socket.join(roomCode)`.
5. Server emits to the creator: `room_created { roomCode, token }`, then `game_start { numbers, currentTurn }`, then `my_games_list`.
6. Server arms `scheduleCleanup(roomCode)`.
7. Client `room_created` handler calls `enterGame(roomCode)`: lobby hidden, `#game-screen` shown, `#room-code-display` set.

### Second player joins (happy path)

1. Client B clicks `#join-room-btn` with the code; `main.js` emits `join_room { username, roomCode }` and **optimistically** calls `enterGame(roomCode)` before any ack (a failure surfaces later via `error`).
2. Server finds the room, finds no player with B's token, and sees `players.length < 2`.
3. Server pushes Player B, registers B's session, `socket.join(roomCode)`.
4. Server emits `room_joined { roomCode, token }` to B, broadcasts `player_joined { username }` to the room.
5. With 2 players, server sends B a full `game_sync` snapshot: `roomCode`, `numbers`, `lines`, `currentNumber`, `currentTurn`, `isGameOver: false`, `winner: null`, `loser: null`, `players`, `rematchRequestedBy`.
6. If `currentTurn === null` (creator already moved while waiting), server reassigns `currentTurn` to the joiner and sends the creator `move_made { line: null, nextNumber, currentTurn }` so its UI unlocks.
7. Server refreshes both players' `my_games_list`.

### Join error paths

- **Nonexistent room**: `join_room` with an unknown `roomCode` → server emits `error { message: '🔍 No se encontró la sala. Verifica el código.' }`. The client `error` handler `alert()`s `err.message`.
- **Full room**: `join_room` on a room with 2 players → server emits `error { message: '⛔ La sala está llena. Ya hay 2 jugadores.' }`. Same client alert path; the joiner is left on a game screen fed by no `game_sync`.

### Same-token rejoin

1. Client emits `join_room` for a room whose `players` already contains its token.
2. Server rewrites `existingPlayer.id` to the new socket id, `socket.join(roomCode)`, emits `room_joined { roomCode, token }`.
3. Server ensures the session tracks the room and refreshes `my_games_list`; handler returns early — no `game_sync`, no duplicate player entry. (The client already recovered state via the connection-time reconnection path, owned by the sessions/reconnection spec.)

### Surrender / leave

1. From the lobby's "my games" list, the client confirms the abandon dialog and emits `leave_room { roomCode }`, then optimistically removes the list item.
2. Server filters the leaver out of `room.players` (matched by socket id) and removes the room from `playerSessions[token].rooms`.
3. Server `socket.leave(roomCode)`, broadcasts `player_left { playerId: socket.id }` to the room, emits `left_room_success` to the leaver, and refreshes `my_games_list`.
4. If the room is now empty, server deletes `rooms[roomCode]`. Otherwise the remaining player keeps the room (shown as "waiting"/opponent-left state via their list).

### Inactivity cleanup (`scheduleCleanup`)

1. Armed at room creation. No-op if the room was already deleted.
2. If `Date.now() - lastActivity >= 3 * 24 * 60 * 60 * 1000` (3 days): for every player still registered on the room, emit `room_deleted { roomCode }` and `my_games_update`, then delete the room.
3. Otherwise: compute `nextCheck = cleanupDelay - timeSinceLastActivity` and `setTimeout(() => scheduleCleanup(roomCode), nextCheck + 1000)` — a 1s buffer avoids tight re-check loops.
4. Any activity (`submit_move`, `game_over`, `request_rematch`, `respond_rematch`) refreshes `lastActivity`, pushing the expiry forward without re-arming the timer; the next scheduled check observes the newer timestamp.

## APIs

Transport is Socket.IO (single namespace). Auth: every connection carries `socket.handshake.auth.token` — the client-generated `session_token` UUID. There is no server-side validation of the token (see Permissions).

### Client → Server events (this spec)

| Event | Payload | Purpose |
|---|---|---|
| `create_room` | `{ username: string, pointCount?: int = 20 }` | Create room, generate board, register session, arm cleanup |
| `join_room` | `{ roomCode: string, username: string }` | Join as second player, rejoin with same token, or fail with `error` |
| `leave_room` | `{ roomCode: string }` | Surrender/abandon: remove player + session entry, delete if empty |
| `get_my_games` | `{}` | Re-request `my_games_list` (triggered by `my_games_update`) |

### Server → Client events (this spec)

| Event | Payload | Purpose |
|---|---|---|
| `room_created` | `{ roomCode, token }` | Creator ack; client enters game screen |
| `game_start` | `{ numbers: Point[], currentTurn }` | Creator's initial board |
| `room_joined` | `{ roomCode, token }` | Joiner/rejoiner ack; client enters game screen |
| `player_joined` | `{ username }` | Broadcast to room when the 2nd player lands |
| `game_sync` | `{ roomCode, numbers, lines, currentNumber, currentTurn, isGameOver, winner, loser, players, rematchRequestedBy }` | Full state snapshot for the joiner |
| `move_made` | `{ line: null, nextNumber, currentTurn }` | Special variant to the creator when join takes over a `null` turn. (`line` non-null variants belong to the gameplay spec) |
| `player_left` | `{ playerId: socketId }` | Broadcast to room after a surrender |
| `left_room_success` | *(no payload)* | Ack to the leaver — **no client handler exists** |
| `error` | `{ message: string }` | Join failures (full room, missing room) |
| `room_deleted` | `{ roomCode }` | Cleanup notification; client returns to lobby if inside |
| `my_games_update` | *(no payload)* | Ping to re-fetch via `get_my_games` |
| `my_games_list` | `[{ roomCode, opponentName, isMyTurn, isGameOver, winner, loser, rematchRequestedBy }]` | Lobby list snapshot (`opponentName` is `'Esperando...'` while solo) |

Events on the same connection owned by other specs: `submit_move`, `game_over`, `request_rematch`, `respond_rematch`, `request_game_sync` (they mutate `lastActivity` and rematch/game fields defined here but are specified elsewhere).

## Client SDK Design

There is no SDK library; `client/main.js` is the integration surface. Patterns:

- **Initialization**: on load, `main.js` reads `localStorage['session_token']`, generating and persisting a UUID if absent, then opens the socket with `auth: { token }`. If the URL contains a room code (shared link), it auto-emits `join_room` with the saved username.
- **Screen transitions**: `room_created` and `room_joined` both call `enterGame(roomCode)` — hides the lobby, shows `#game-screen`, sets `#room-code-display`. `join_room` is optimistic: the click handler enters the game screen *before* the ack, trusting `error` to correct it.
- **Error handling**: a single `error` handler `alert()`s `err.message`; no retry, no targeted recovery.
- **List freshness**: `my_games_update` → emit `get_my_games` → re-render from `my_games_list`. Deletion of a list item (surrender) is optimistic; the confirm dialog runs before `leave_room` is emitted.
- **Expectations**: no batching, no retry, no offline queue. Client persistence is limited to `localStorage` (`session_token`, `username`, `papa_online_stats`). `left_room_success` is emitted by the server but has no client handler — the optimistic UI removal is the only feedback.

## Configuration

| Setting | Source | Default / values |
|---|---|---|
| HTTP/Socket.IO port | `PORT` env var (`server.js`) | `3000` |
| Point count options | `#point-count-select` in `client/index.html` | 10, 15, 20 (selected), 25, 30 |
| Default `pointCount` | `create_room` destructure | `20` |
| Board size | `generateNumbers(count, 600, 800)` call | 600x800 px |
| Placement padding | `generateNumbers` | 40 px on each edge |
| Minimum point distance | `checkOverlap` | 40 px (Euclidean) |
| Placement attempts per point | `generateNumbers` loop cap | 100 (a point may end up overlapping if unplaceable in 100 tries) |
| Inactivity cleanup delay | `scheduleCleanup` | 3 days (`3 * 24 * 60 * 60 * 1000`) |
| Cleanup re-check buffer | `scheduleCleanup` | +1000 ms after computed expiry |
| Max players per room | `join_room` check | 2 |

## Permissions

Trust model: there are no roles and no auth. Any connected client may emit any event. The handshake token is unvalidated identity — a nickname, not a credential — and `username`/`roomCode` payloads are taken as-is. See Security Considerations for the consequences.

## Security Considerations

- **Tokens are not secrets**: `session_token` is a client-generated UUID stored in `localStorage`. Anyone who learns a token can rejoin as that player (same-token path rewrites socket ids without challenge).
- **Room codes are not checked for collisions**: `Math.random().toString(36).substring(2, 8).toUpperCase()` is never compared against existing rooms and never retried; a collision silently overwrites `rooms[roomCode]` and the previous room becomes unreachable. The codespace is 36^6 (~2.2e9), so collisions are rare but possible and unhandled.
- **No input validation**: `username`, `pointCount`, and `roomCode` are used verbatim; `pointCount` beyond the lobby options is honoured by `generateNumbers` (bounded only by placement attempts per point).
- **No rate limiting**: join/create/leave can be spammed; cleanup timers pile up per created room.
- **Error messages** reveal only room existence/fullness — acceptable for this game, but they make room-code enumeration trivially scriptable.

## Dependencies

| Library | Role | Rationale |
|---|---|---|
| `express` | Static file serving of `client/` | Already the HTTP layer for Socket.IO |
| `socket.io` | Realtime event transport (server) | Core transport; rooms ↔ Socket.IO rooms 1:1 via `socket.join` |
| `socket.io-client` | Test client in `server.integration.test.js`, Playwright flows | Dev-only |

No database, cache, or queue: state is deliberately in-memory (see Persistence Notes).

## Open Questions / Risks

Untested behaviours — each was an acceptance criterion with no passing test (old ACs 3, 6, 7, 8, 10, 11). They are risks, not verifications:

- **Non-default point count**: a room created with `pointCount: 10` (or 15/25/30) is assumed to yield exactly that many `numbers`; the join test creates with `pointCount: 10` but asserts only that `numbers` exists. Untested.
- **Same-token rejoin**: `join_room` with a token already in the room is assumed to update the stored player's socket id, emit `room_joined`, and not duplicate the player. Untested.
- **Nonexistent-room error**: `join_room` on an unknown `roomCode` is assumed to emit `error { message: '🔍 No se encontró la sala. Verifica el código.' }`. Untested.
- **Full-room error**: `join_room` on a room with 2 players is assumed to emit `error { message: '⛔ La sala está llena. Ya hay 2 jugadores.' }`. Untested.
- **`left_room_success` and empty-room deletion**: the leaver is assumed to receive `left_room_success`, and a room left with 0 players is assumed to be deleted. The surrender test leaves one player behind, so neither is exercised. Untested. (Additionally, `left_room_success` has no client handler — by design, but unverified.)
- **3-day inactivity cleanup**: `scheduleCleanup` is assumed to emit `room_deleted` + `my_games_update` to registered players and then delete the room; the rescheduling branch and the `lastActivity`-refresh interplay are likewise untested.

Design risks retained from the previous spec's out-of-scope list:

- **Room-code collision**: overwrite on collision is silent (see Security Considerations). A uniqueness check + retry loop would close it.
- **README discrepancy**: project docs mention point-count options 5/10/15/20; the shipped `#point-count-select` offers 10/15/20/25/30 (default 20 selected). Not corrected in this spec — see Appendix.

## Verifications

- Creating a room returns `room_created` with a 6-character `roomCode` and `game_start` carrying 20 numbers plus the creator as `currentTurn` — PASS: `should create a room and receive game_start event` (`server/server.integration.test.js`)
- A created room is registered on the creator's session and shows up in `my_games_list` with `roomCode` and `opponentName` — PASS: `should return my games list` (`server/server.integration.test.js`)
- A second player joining receives `room_joined` and a `game_sync` snapshot while the creator sees `player_joined` — PASS: `should allow second player to join room` (`server/server.integration.test.js`)
- Surrendering via `leave_room` removes the leaver and delivers `player_left` with the leaver's `playerId` to the remaining player — PASS: `should handle surrender (leave_room)` (`server/server.integration.test.js`)
- End-to-end UI: Player 1 creates from the lobby (`#create-room-btn`, `#game-screen` visible, non-empty `#room-code-display`) and Player 2 joins that code, both ending on the game screen with `#turn-indicator` and `#game-canvas` — PASS: `Multiplayer Game Flow > Player 1 creates room and Player 2 joins` (`tests/e2e/basic.spec.js`)

## Appendices

### Compatibility notes

- Event names and payload shapes above are the de-facto public API for clients; the special `move_made { line: null }` variant is load-bearing for the creator's UI unlock on join and must survive any refactor of the gameplay spec.
- `sendMyGames` tolerates session entries pointing at deleted rooms (filtered server-side); clients should not assume `my_games_list` is exhaustive across restarts.

### Doc discrepancy: point-count options

`README.md` documents point counts 5/10/15/20, but the shipped selector `client/index.html#point-count-select` offers 10/15/20/25/30 with `20` pre-selected, and `create_room` defaults to `20`. The code is authoritative; the README is stale and is not corrected by this spec (documentation fix belongs to its own change).

### Future considerations

- Room-code uniqueness check with retry at creation.
- Tests for the six untested behaviours listed under Open Questions / Risks.
- Persisting `playerSessions` (the code itself comments: "In a real app, this would be in a DB/Redis") so rooms survive restarts.
