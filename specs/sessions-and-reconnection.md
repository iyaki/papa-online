# Sessions and Reconnection

Status: Implemented

Retrospective spec documenting existing behaviour; untested areas listed under Open Questions / Risks.

## Overview

### Purpose

Socket.IO assigns a new socket id on every connection, so a page reload or network blip would otherwise orphan a player's games. Token-based player identity (sent in the Socket.IO handshake auth) gives each browser a stable identity, lets the server re-attach a returning player to all their rooms, and powers a persistent "my games" lobby list.

### Goals

- A browser keeps the same identity across reconnects via a UUID stored in `localStorage`.
- On reconnection, the server re-attaches the player to every room they were in: socket id swap, `currentTurn` remap, and `socket.join`.
- The client can always render an up-to-date "Mis Partidas" lobby via `get_my_games` / `my_games_list`.
- One token can hold several concurrent rooms (multi-tab / multi-game play).

### Non-Goals

- Persistent session storage (DB/Redis) — sessions are in-memory by design.
- Session expiry or token invalidation.
- Server-side cleanup of rooms on player disconnect (handled by `scheduleCleanup` room-empty logic, covered by the room-lifecycle spec).
- Rematch flow semantics themselves (`rematchRequestedBy` content is covered by the rematch spec).

### Scope

Server: reading `socket.handshake.auth.token`, the `playerSessions` map, re-attachment on connection, the `get_my_games` / `my_games_list` / `my_games_update` event trio, session registration on `create_room` / `join_room` / `leave_room`, and the log-only `disconnect` handler. Client: token generation/persistence and the lobby-list rendering and refresh triggers. Gameplay rules inside rooms and the rematch flow are defined by their own specs.

## Architecture

### Module/package layout (tree format)

```
papa-online/
├── server/
│   └── server.js              # playerSessions map (L54), connection handler (L81-451):
│                              #   sendMyGames helper (L86-109), re-attachment (L112-134),
│                              #   get_my_games (L136-138), session registration in
│                              #   create_room / join_room / leave_room, disconnect (L448-450)
├── client/
│   ├── main.js                # session token persistence (L74-79), socket init with auth
│                              #   (L82-86), get_my_games triggers (L393, L459, L664, L678),
│                              #   my_games_list rendering (L578+)
│   ├── game.js                # in-game canvas logic (not session-aware)
│   └── index.html             # menu markup incl. #my-games-list container
└── tests/
    ├── server/server.integration.test.js   # token connect + my-games tests
    └── e2e/*.spec.js                       # real-browser flows (two isolated contexts)
```

### Component diagram (ASCII)

```
+---------------------------+          +--------------------------------+
| Browser (client/main.js)  |          | server/server.js               |
|                           |          |                                |
| localStorage:             |  HTTP/WS | rooms {} (L19)                 |
|   session_token ----------+--Socket--+> playerSessions {} (L54)       |
|   username                |  (auth:  |    token -> {username, rooms[]}|
|   papa_online_stats       |   token) |                                |
|                           |          | io.on('connection'):           |
| socket.emit(              |          |   re-attach player to rooms    |
|   'get_my_games') --------+--------->+   sendMyGames()                |
|                           |          |     |                          |
| socket.on('my_games_list')|<---------+<---+ my_games_list payload      |
|   -> render lobby         |          |                                |
+---------------------------+          +--------------------------------+
```

### Data flow summary

1. **Connect with a known token**: client sends `auth.token` in the handshake; the server looks up `playerSessions[token]`, re-attaches the socket to every live room in the session, then calls `sendMyGames()`.
2. **Request the lobby**: client emits `get_my_games`; server maps the session's room codes to live rooms, filters out dead codes, and emits `my_games_list`.
3. **Push refresh**: whenever turn ownership, game-over, or rematch state changes (`submit_move`, `game_over`, `request_rematch`, `respond_rematch`), the server emits `my_games_update` to both players; the client responds by emitting `get_my_games`.
4. **Session registration**: `create_room` and `join_room` create or update `playerSessions[token]` and append the room code; `leave_room` removes the room code from the session.
5. **Disconnect**: the server only logs the socket id; no room or session state changes.

## Data model

### Core Entities

**PlayerSession** (server, in-memory `playerSessions[token]`, server.js:54)

| Field      | Type       | Description                                          |
| ---------- | ---------- | ---------------------------------------------------- |
| `token`    | `string`   | Map key; the UUID the client generated and persists. |
| `username` | `string`   | Latest username presented for this token.            |
| `rooms`    | `string[]` | Room codes this token participates in (multi-room).  |

**Room** (server, in-memory `rooms[code]`, server.js:19 — full definition in the room/gameplay specs; fields this spec consumes)

| Field                | Type                            | Description                                    |
| -------------------- | ------------------------------- | ---------------------------------------------- |
| `players`            | `{id, username, token}[]`       | `id` is the current socket id; `token` is the stable join key to `PlayerSession`. |
| `currentTurn`        | `string \| null`                | Socket id of the player to move; remapped on re-attachment. |
| `winner` / `loser`   | `string \| null`                | Stored as **tokens**, set by `game_over`.      |
| `rematchRequestedBy` | `string \| null`                | Token of the requesting player.                |
| `lastActivity`       | `number`                        | Epoch ms; drives `scheduleCleanup`.            |

**Client localStorage keys** (client/main.js)

| Key                  | Type     | Description                                                                 |
| -------------------- | -------- | --------------------------------------------------------------------------- |
| `session_token`      | `string` | UUID generated once via `generateUUID()`, reused for every connection (L74-79). |
| `username`           | `string` | Convenience prefill on create/join (L555, L566); not part of server identity. |
| `papa_online_stats`  | `string` | JSON client-only win/loss stats (L736-750); never sent to the server.       |

### Relationships

- One `PlayerSession` holds many room codes (`rooms[]`); a room code maps to one live `Room` in `rooms`.
- A `Room` holds up to two players; each player carries the `token` that links it back to its `PlayerSession`.
- `my_games_list` is computed by joining `playerSessions[token].rooms` → `rooms[code]` → opponent via `r.players.find(p => p.token !== token)` (server.js:91).
- `winner`, `loser`, and `rematchRequestedBy` are compared against the client's `sessionToken` when rendering lobby statuses (client/main.js:613-622).

### Persistence Notes

Everything server-side is in-memory: `const rooms = {}` (server.js:19) and `const playerSessions = {}` (server.js:54, with the code comment "In a real app, this would be in a DB/Redis."). Both are lost on server restart; a reconnecting player after a restart has no session and is treated as new. There is no SQL schema, no indexes, no constraints. Only the client's `localStorage` keys survive restarts and page reloads.

## Workflows

### First connection (new browser)

1. `client/main.js` reads `localStorage.session_token`; absent → generates a UUID via `generateUUID()` and stores it (L75-78).
2. Client opens the socket with `io({ auth: { token: sessionToken } })` (L82-86).
3. Server reads `socket.handshake.auth.token` (L82); no matching session → plain connection, no re-attachment, `sendMyGames()` no-ops (guard at L87).

### Reconnection (existing session) — happy path

1. Client reconnects with the same `auth.token`.
2. Server finds `playerSessions[token]` (L112) and iterates the session's room codes.
3. For each code with a live room: find the room player by token; if `room.currentTurn === player.id` (the old socket id), remap `room.currentTurn = socket.id`; set `player.id = socket.id`; call `socket.join(roomCode)` (L116-131).
4. Server calls `sendMyGames()` (L133) so the client immediately gets its lobby list.

### Reconnection — failure paths

- Room code in the session but the room no longer exists (expired via `scheduleCleanup` or deleted): the loop skips it; `sendMyGames` filters the dead code out of the list (L89-90).
- Player entry not found in the room's `players` array: the room is skipped (L120-129).
- No token or unknown token: no session branch runs; the socket behaves as a fresh player.

### `get_my_games` / `my_games_list` computation

1. Client emits `get_my_games` (or the server proactively calls `sendMyGames()` on reconnection, `create_room`, `join_room`, or `leave_room`).
2. Server maps each session room code to its room; `null` results (dead rooms) are filtered out (L105).
3. Per live room it builds `{ roomCode, opponentName, isMyTurn, isGameOver, winner, loser, rematchRequestedBy }` where `opponentName` falls back to `'Esperando...'` when there is no opponent yet, `isMyTurn = r.currentTurn === socket.id`, and `isGameOver = !!r.winner` (L96-104).
4. Server emits `my_games_list` with the array (L107); the client sorts it (`getGameSortScore`: my-turn first, then rematch pending, then waiting-for-opponent, then finished) and renders entries (client/main.js:590-660).

### Session registration and removal

- `create_room`: creates `playerSessions[token] = { username, rooms: [] }` if absent, refreshes `username`, appends the room code if not already present (L160-166).
- `join_room`: same create-or-update for a new player (L217-223); if the token already sits in the room, it instead re-attaches in place — `existingPlayer.id = socket.id`, `socket.join`, session ensured, `sendMyGames()` (L190-207).
- `leave_room` (surrender/quit): filters the room code out of `playerSessions[token].rooms` (L363-365).

### Disconnect

1. Socket goes away for any reason.
2. Server logs `User disconnected: <socket.id>` (L448-450). Nothing else: no session mutation, no room mutation, no cleanup scheduling. Removal from rooms happens only via explicit `leave_room` (surrender).

## APIs

No HTTP API is part of this spec (static files are served over HTTP; all interaction is Socket.IO). Base path: the Socket.IO connection itself; auth is the handshake `auth.token` — accepted as-is, never validated.

Session-relevant event surface:

| Event              | Direction | Payload                                                                  | Purpose |
| ------------------ | --------- | ------------------------------------------------------------------------ | ------- |
| handshake auth     | C→S       | `{ auth: { token: string } }` (connection option)                        | Stable player identity across reconnects. |
| `get_my_games`     | C→S       | `{}`                                                                     | Request the current lobby list. |
| `my_games_list`    | S→C       | `Array<{ roomCode, opponentName, isMyTurn, isGameOver, winner, loser, rematchRequestedBy }>` | One entry per live session room; dead codes filtered. |
| `my_games_update`  | S→C       | `{}`                                                                     | Push hint that the lobby changed; client re-requests via `get_my_games`. |
| `create_room`      | C→S       | `{ username, pointCount = 20 }`                                          | Registers the token's session with the new room. |
| `room_created`     | S→C       | `{ roomCode, token }`                                                    | Echoes the code and the token back. |
| `join_room`        | C→S       | `{ roomCode, username }`                                                 | Joins, or re-attaches in place if the token already owns a seat. |
| `room_joined`      | S→C       | `{ roomCode, token }`                                                    | Echoes the code and the token back. |
| `leave_room`       | C→S       | `{ roomCode }`                                                           | Surrender/quit; removes the room from the session. |
| `left_room_success`| S→C       | `{}` (emitted after `leave_room`)                                        | Confirms removal; followed by `my_games_list`. |
| `error`            | S→C       | `{ message }`                                                            | Unknown room code or full room during `join_room`. |

## Client SDK Design

The "SDK" is the vanilla-JS client in `client/main.js` talking raw Socket.IO. Initialization (L74-86):

```js
let sessionToken = localStorage.getItem('session_token');
if (!sessionToken) {
    sessionToken = generateUUID();
    localStorage.setItem('session_token', sessionToken);
}

const socket = io({
    auth: {
        token: sessionToken
    }
});
```

`get_my_games` emission triggers (client/main.js):

| Trigger                  | Location | Notes                                            |
| ------------------------ | -------- | ------------------------------------------------ |
| Menu (lobby) load        | L393     | Initial list render.                             |
| After rematch reset      | L459     | URL params cleared, list refreshed.              |
| `my_games_update` event  | L663-665 | Server-pushed change hint → re-request.          |
| Return to menu (`backToMenuBtn`) | L678 | Refresh list on leaving a game.          |

Behaviour expectations: no batching or retry — each trigger is a plain request/response round-trip; persistence is the `localStorage` token; rendering sorts entries and derives statuses (`¡Ganaste!` / `Perdiste` / `¡Revancha pedida!` / `Esperando revancha...`) by comparing payload fields against the local `sessionToken` (L611-624). An empty list renders "No tienes partidas activas." (L580-582).

## Configuration

| Setting          | Values / Default                  | Owner                        |
| ---------------- | --------------------------------- | ---------------------------- |
| `PORT` env var   | default `3000` (server.js:455)    | Shared server config.        |
| `pointCount`     | 10 / 15 / 20 / 25 / 30 (UI select); default 20 server-side | Affects generated numbers only; irrelevant to sessions. |
| `session_token`  | UUID, client `localStorage`       | This spec.                   |

This spec adds no server-side configuration: the `playerSessions` map is unbounded (no TTL, no max rooms). Other constants (3-day cleanup window, 40px minimum number distance) belong to the room-lifecycle and collision specs.

## Permissions

Trust model: there are no roles and no auth. Any connected client may emit any event, and the handshake `token` is unvalidated identity, not authorization. Presenting a token string is sufficient for the server to hand that session's seats back to the socket (re-attachment), and `winner` / `loser` / `rematchRequestedBy` are plain token strings exposed in `my_games_list` payloads.

## Security Considerations

- **Token is capability, not credential**: anyone who learns a token can reconnect as that player and take over their seats (server accepts `auth.token` as-is, L82/L112). Mitigations (signing, binding to a session secret) are future work.
- **No expiry or rotation**: tokens live forever in client `localStorage`; server sessions live until restart.
- **Token leakage surface**: the server logs tokens to stdout on connect (L83); the client sends the token on every handshake; `winner` / `loser` / `rematchRequestedBy` (tokens) are broadcast in `my_games_list` and `game_over` payloads.
- **Client storage**: `localStorage` is readable by any script on the origin; acceptable given there is no auth to protect.
- No user-input validation gaps specific to this spec beyond the above: payloads are read destructively but the session map is only keyed by strings the server stores itself.

## Dependencies

| Dependency        | Role | Rationale |
| ----------------- | ---- | --------- |
| `socket.io`       | Server transport + handshake `auth` bag | Provides the `socket.handshake.auth` mechanism this spec is built on. |
| `socket.io-client`| Client transport; `Client` in integration tests | Same handshake-auth API used by tests (`auth: { token: ... }`). |
| `express`         | Static file serving | Unrelated to sessions; listed for completeness. |

No database, cache, or auth library is used.

## Open Questions / Risks

Coverage gaps — behaviours that ship today but have no test:

- **Re-attachment mechanics are untested**: socket-id swap, `currentTurn` remap (only when it was the old socket's turn), and `socket.join` on reconnect (old AC3, R3) have no test; a regression here would silently strand games after a reload.
- **`my_games_list` payload shape and dead-room filter are untested**: the tests only assert `roomCode` + `opponentName` presence; `isMyTurn`, `isGameOver`, `winner`, `loser`, `rematchRequestedBy` values and the filtering of rooms no longer in `rooms` (old AC4, R4) are unverified.
- **Multi-room sessions are untested**: two rooms registered under one token and both served by `get_my_games` (old AC5, R2) have no test.
- **Disconnect is log-only — untested**: no test asserts that room and session state survive a socket disconnect without `leave_room` (old AC6, R6).
- **Client token persistence is untested**: nothing verifies that `session_token` is generated, stored in `localStorage`, and sent as handshake `auth.token` across a reload (old AC7, R1). E2E candidate for `tests/e2e/`.

## Verifications

- A Socket.IO client connecting with `auth: { token: 'test-token-1' }` connects successfully — PASS: `should connect client with authentication token` (`server/server.integration.test.js`)
- A token-authenticated client that emits `create_room` receives `room_created` (6-character code) and `game_start` (20 numbers + `currentTurn`), exercising the session-registration path — PASS: `should create a room and receive game_start event` (`server/server.integration.test.js`)
- A player that created a room and then emits `get_my_games` receives a non-empty `my_games_list` whose first entry has `roomCode` and `opponentName` properties — PASS: `should return my games list` (`server/server.integration.test.js`)
- Two isolated browser contexts (independent `localStorage`, hence independent session tokens) complete room creation and join through the real UI — PASS: `Player 1 creates room and Player 2 joins` (`tests/e2e/basic.spec.js`)

## Appendices

- **Compatibility notes**: `playerSessions` is intentionally not in `module.exports` (server.js:461-467 exports `server`, `io`, `rooms`, `generateNumbers`, `checkOverlap`), so tests can only observe session behaviour through emitted events — keep it that way or the in-memory contract leaks into tests. The token is any string; only the client happens to generate UUIDs via `generateUUID()`.
- **Future considerations**: DB/Redis-backed sessions (the code comment at server.js:53 anticipates this), token signing/expiry, and a `request_game_sync`-style explicit re-sync after reconnection are already sketched in code comments (server.js:203-205) but are out of scope here.
