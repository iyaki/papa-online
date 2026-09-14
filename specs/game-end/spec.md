# Spec: Game End (win/loss detection and reporting)

Status: Implemented

Retrospective spec documenting existing behaviour; untested areas listed under Open Questions / Risks.

## Overview

### Purpose

When a player makes a losing move (crosses an existing line) or otherwise ends the match, the losing side must be decided, the final state persisted in the room, and both clients informed so they show the correct win/loss screen and update local stats. This spec documents the existing game-end behaviour so future changes (e.g. real server-side disconnect handling) have a baseline.

### Goals

- The emitting player's loss is recorded on the room (`room.loser` / `room.winner` tokens).
- The losing line persists in room state when provided.
- Both clients reliably show a win or loss screen with reason and numbers-connected count.
- Each client records the result in local persistent stats without double counting.

### Non-Goals

- Server-side disconnect-loss: a raw socket disconnect during an active game does NOT end the game (the `disconnect` handler only logs). Would be a new change.
- Rematch flow after game over — covered by `specs/rematch/`.
- Room cleanup/expiry via `lastActivity` — covered by `specs/room-lifecycle/`.
- Server-side anti-cheat: the server trusts whichever client claims `game_over`; no move validation on game-over emission (see Security Considerations).

### Scope

- Server `game_over` event handling (`server/server.js:321-353`).
- Client loss detection during move drawing (`client/game.js:156-176`).
- Client win/loss screen rendering (`client/game.js:59-62`, `248-280`).
- Client local stats persistence in `localStorage` (`client/main.js:354-361`, `735-790`).

## Architecture

### Module/package layout (tree format)

```
server/
  server.js            # game_over handler (lines 321-353); disconnect is log-only (line 448)
client/
  game.js              # Game class: collision check -> emit game_over; gameOver() screen render
  main.js              # socket wiring, game_over/game_sync listeners, stats (loadStats/saveStats/updateStats)
  collision.js         # segment-intersection helper used by Game to detect crossing
  index.html           # #game-over-screen, #game-over-message elements
```

### Component diagram (ASCII)

```
 Client A (loser)                    Server                        Client B (winner)
┌─────────────────┐   game_over {roomCode,reason,lastLine}   ┌─────────────────┐
│ Game.draw():    │ ───────────────────────────────────────► │ socket.on(      │
│ crossing found  │        (server/server.js:321)            │  'game_over')   │
│ emit game_over  │                                          │                 │
│ + own loss screen│  room.lines.push(lastLine)              │                 │
└─────────────────┘  room.loser = emitter token            │                 │
        ▲            room.winner = other token              │                 │
        │            room.lastActivity = Date.now()         │                 │
        │                                                   │                 │
└───────┼──────── io.to(room).emit('game_over',{reason,loser,winner}) ───────┼──┘
        │            room.players.forEach -> my_games_update                 │
        │                                                                   │
│ gameOver(msg): #game-over-message, #game-over-screen,      same flow    │
│ confetti, "Números conectados: currentNumber - 1"                       │
│ updateStats(localStorage 'papa_online_stats')              updateStats  │
```

### Data flow summary

1. The losing client detects the crossing locally (client-side `collision.js` check), emits `game_over` with the reason and the losing line, and immediately shows its own loss screen without waiting for the server echo.
2. The server stores the loser/winner tokens on the room, optionally appends `lastLine` to `room.lines`, bumps `lastActivity`, and broadcasts `game_over` plus per-player `my_games_update`.
3. Each client, on receiving `game_over`, renders the win/loss screen and updates `localStorage` stats keyed by opponent name with `processedGames` dedup.
4. On reconnection, `game_sync` with `isGameOver && winner` re-triggers stats update (dedup makes it idempotent).

## Data model

### Core Entities

**Room** (server, in-memory `rooms[roomCode]`):

| Field | Type | Notes |
|---|---|---|
| `code` | string | Room identifier / Socket.IO room |
| `players` | Array<{ id: string, token: string, username: string }> | 0-2 entries |
| `lines` | Array<Line> | All drawn lines; game-over appends optional `lastLine` |
| `currentNumber` | number | Next number to connect |
| `currentTurn` | string \| null | Socket id whose turn it is |
| `loser` | string | Emitting player's token; `'unknown'` if not found |
| `winner` | string | Other player's token; `'unknown'` if not found |
| `isGameOver` | boolean | Exposed via `game_sync` |
| `lastActivity` | number | `Date.now()` timestamp, bumped on game over |

**PlayerSession**: map `token -> socket id` (`playerSessions`); the token is an unvalidated identity created client-side (UUID persisted in `localStorage` under `session_token`).

**Client stats** (`localStorage` key `papa_online_stats`):

| Field | Type | Notes |
|---|---|---|
| `totalWins` | number | Total wins for this browser |
| `totalLosses` | number | Total losses |
| `opponents` | `{ [name]: { wins: number, losses: number } }` | Name defaults to `'Oponente'`; invalid names (`'Oponente'`, `'Esperando...'`) are ignored |
| `processedGames` | string[] | Room codes already counted; guards against double counting |

### Relationships

- A Room has up to two players, each identified by a PlayerSession token.
- Stats are per-browser, derived from game results; they reference opponents by displayed username, not token.
- `processedGames` entries correspond 1:1 to counted Room results.

### Persistence Notes

- All server-side state (rooms, sessions) is in-memory and lost on server restart.
- Client-side persistence is `localStorage` only: `session_token` and `papa_online_stats` survive reloads and are never sent to the server as durable storage.
- No database, no schema.

## Workflows

### Losing move (happy path)

1. Player draws a line to the next number; `Game` checks the candidate segment against all existing lines with `collision.js`.
2. On crossing: client emits `game_over { roomCode, reason: "Cruzó una línea", lastLine: currentLine }` and immediately calls `gameOver("¡Cruzaste una línea! Perdiste.")` — own loss screen shows without waiting for the echo (`client/game.js:156-176`).
3. Server handler: pushes `lastLine` into `room.lines`; finds loser = emitting socket's player token (`'unknown'` fallback), winner = the other player's token (`'unknown'` fallback); sets `room.lastActivity = Date.now()`; logs the result.
4. Server broadcasts `game_over { reason, loser, winner }` to the room and emits `my_games_update` to each player.
5. Winner's client receives `game_over`; since `loser !== myToken`, message is `"¡Ganaste! El oponente perdió."`; `gameOver()` detects `Ganaste` and fires confetti.
6. Both clients render `#game-over-message` + `#game-over-screen`, show `🎯 Números conectados: ${currentNumber - 1}`, and call `updateStats(opponentName, isWin, roomCode)`.

### Failure / edge paths

- **Token not found in room players**: loser/winner stored as `'unknown'`; the event still broadcasts.
- **Room does not exist** (e.g. already cleaned up): the handler is a no-op — no broadcast.
- **Reconnection after game over**: client emits `request_game_sync`; on `game_sync` with `isGameOver && winner`, client recomputes win/loss and calls `updateStats` — `processedGames` dedup makes repeat calls no-ops. If the game-over screen state is restored without a fresh `game_over`, the screen shows `"Juego Terminado (Reconexión)"` (`client/game.js:87-90`).
- **Raw socket disconnect mid-game**: server `disconnect` handler only logs (`server/server.js:448`); the game continues server-side and the surviving player is NOT declared winner. No event is emitted.
- **Double game_over / echo after own local screen**: client already showed its screen; stats dedup prevents double counting.

## APIs

Socket.IO event surface (no HTTP API beyond the Socket.IO endpoint and static file serving; no auth — tokens are unvalidated identity):

| Event | Direction | Payload fields | Purpose |
|---|---|---|---|
| `game_over` | client → server | `roomCode`, `reason`, `lastLine?` | Client claims game over (emitter is the loser) |
| `game_over` | server → room | `reason`, `loser`, `winner` | Broadcast final result with resolved tokens |
| `my_games_update` | server → each player socket | (none) | Tells clients to refresh their game list |
| `game_sync` | server → client | `roomCode`, `numbers`, `lines`, `currentNumber`, `currentTurn`, `isGameOver`, `winner`, `loser`, `players`, `rematchRequestedBy` | Full state restore on reconnection; drives stats refresh for finished games |

## Client SDK Design

Client modules consume the surface as follows:

- `client/game.js` (`Game` class): registers a `game_over` listener; computes the message from `loser === this.token`; `gameOver(reason)` updates `#game-over-message`, un-hides `#game-over-screen`, shows confetti for winners (message contains `Ganaste`), inserts the numbers-connected counter (`currentNumber - 1`). Move drawing emits `game_over` directly on a detected crossing.
- `client/main.js`: owns the socket, `session_token` identity, and `game_sync` handling; on `game_over`-adjacent state changes resolves `opponentName` (defaults `'Oponente'`), and calls `updateStats()`. Stats helpers `loadStats`/`saveStats`/`updateStats` wrap `localStorage` access with `processedGames` dedup and invalid-opponent filtering.
- Initialization: on joining a game the client emits `request_game_sync` and waits for `game_sync` to populate the `Game`.

## Configuration

| Setting | Values / Default | Where |
|---|---|---|
| `PORT` env var | default `3000` | `server/server.js:455` |
| Point count options | 10 / 15 / 20 (default) / 25 / 30 | `client/index.html` `#point-count-select` |
| Room cleanup age | 3 days since `lastActivity` (bumped on game over) | server cleanup scheduler |
| Minimum point distance | 40px when generating points | server room creation |

## Permissions

Trust model: any connected client may emit any event. Tokens (`session_token` UUIDs) are unvalidated identity, not auth. There are no roles; the game-over emitter is by convention the loser, enforced only socially.

## Security Considerations

- The server trusts client-claimed `game_over` events: any player can declare themselves winner or loser with an arbitrary reason. No server-side move validation or anti-cheat exists; this is out of scope for this spec.
- Tokens are unvalidated identity; spoofing another player's token is trivial for a modified client.
- Stats live only in the client's `localStorage`; they are trivially editable by the user and are not authoritative.

## Dependencies

- `socket.io` / `socket.io-client` — realtime transport.
- No other runtime dependencies; vanilla JS client, no build step.

## Open Questions / Risks

- **Stats persistence is untested** (old AC4): no test covers `papa_online_stats` updates on `game_over` or the `game_sync` reconnection refresh path.
- **Confetti and numbers-connected counter are untested** (old AC5): the winner's game-over screen extras are not asserted by any test.
- **Socket-level disconnect does not end the game — untested** (old AC6): `server/server.js:448` disconnect handler is log-only; no test pins that a mid-game disconnect leaves the game running and the opponent undecided.
- **Untested tasks from the backlog**: e2e stats test (`tests/e2e/stats.spec.js` or integration), winner-screen extras test, raw-disconnect integration test — none written yet.

## Verifications

- Server game-over handling: loser/winner token resolution, optional `lastLine` save, `lastActivity` bump, `game_over` broadcast and per-player `my_games_update` — PASS: `should handle game over correctly` (`server/server.integration.test.js`)
- Player 2 makes a losing move (2 → 4, skipping 3): page 2 shows `Perdiste`, page 1 shows `Ganaste` — PASS: `Game Win/Loss Scenarios > Player 1 Wins (Player 2 crashes)` (`tests/e2e/win.spec.js`)
- Player 1 makes a losing move (1 → 3, skipping 2): page 1 shows `Perdiste`, page 2 shows `Ganaste` — PASS: `Game Win/Loss Scenarios > Player 2 Wins (Player 1 crashes)` (`tests/e2e/win.spec.js`)

## Appendices

- **Misleading e2e test titles**: the two `tests/e2e/win.spec.js` titles say "Player X crashes", but the tests actually simulate a losing move (drawing a line that crosses an existing one), not a socket disconnection. The titles are kept verbatim because citations must match the test files.
- **Compatibility**: `game_over` payload shape (`{ roomCode, reason, lastLine? }` in, `{ reason, loser, winner }` out) is the contract consumed by both clients and the rematch flow; changing it requires updating `specs/rematch/` consumers.
- **Future considerations**: server-side disconnect-loss (declare survivor winner after a grace period) and server-side game-over validation are the natural next changes; both need this spec as the baseline.
