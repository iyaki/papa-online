# Change: room-lifecycle

## Problem
Two players need a shared game they can both enter: one creates a room and gets a shareable
6-character code, the other joins by code. Players must also be able to re-enter a room from a
new socket (same browser token), abandon a game (surrender), and the server must garbage-collect
rooms nobody returns to. This spec documents the existing create/join/leave/cleanup behaviour
retrospectively.

## Requirements

- R1: Room creation. `create_room { username, pointCount = 20 }` creates `rooms[roomCode]` keyed
  by a 6-character alphanumeric code (`Math.random().toString(36).substring(2, 8).toUpperCase()`).
  It generates `pointCount` numbers (1..pointCount) on a 600x800 board with 40px padding, minimum
  40px separation between points (`checkOverlap`), and up to 100 placement attempts per number.
  Room state: `players` (creator first), `lines: []`, `currentNumber: 1`,
  `currentTurn = creator socket id`, `lastActivity = Date.now()`.
- R2: Creation emissions and session. The creator receives `room_created { roomCode, token }`,
  `game_start { numbers, currentTurn }`, and `my_games_list`; `socket.join(roomCode)` is called;
  the room code is appended to `playerSessions[token].rooms` (created if absent); the inactivity
  timer is armed via `scheduleCleanup(roomCode)`.
- R3: Second player join. `join_room { roomCode, username }` on an existing room with fewer than
  2 players: push the joiner, emit `room_joined { roomCode, token }` to the joiner, broadcast
  `player_joined { username }` to the room, and send the joiner a full `game_sync` snapshot
  (`roomCode`, `numbers`, `lines`, `currentNumber`, `currentTurn`, `isGameOver: false`,
  `winner: null`, `loser: null`, `players`, `rematchRequestedBy`). If `currentTurn === null`
  (creator moved while waiting for an opponent), the turn is reassigned to the joiner; the
  creator is notified with `move_made { line: null, nextNumber, currentTurn }`.
- R4: Same-token rejoin. `join_room` whose `token` already exists in `room.players` updates
  `existingPlayer.id` to the new socket id, calls `socket.join(roomCode)`, emits
  `room_joined { roomCode, token }`, ensures the session tracks the room, and returns early
  (no `game_sync`, no duplicate player entry).
- R5: Join error paths. Joining an existing full room emits
  `error { message: '⛔ La sala está llena. Ya hay 2 jugadores.' }`; joining a nonexistent
  roomCode emits `error { message: '🔍 No se encontró la sala. Verifica el código.' }`.
  The client alerts `err.message` on `error`.
- R6: Surrender / leave. `leave_room { roomCode }`: remove the player from `room.players`
  (matched by socket id), remove the room from `playerSessions[token].rooms`, `socket.leave`,
  broadcast `player_left { playerId: socket.id }` to the room, emit `left_room_success` to the
  leaver, and refresh `my_games_list`. If the room is left empty, `delete rooms[roomCode]`.
- R7: Inactivity cleanup. `scheduleCleanup(roomCode)` is a no-op if the room is already deleted.
  If `Date.now() - lastActivity >= 3 days`, it emits `room_deleted { roomCode }` and
  `my_games_update` to every player still registered on the room, then deletes the room.
  Otherwise it reschedules a check at (remaining time + 1s buffer). `lastActivity` is refreshed
  on `create_room`, `submit_move`, `game_over`, `request_rematch`, and `respond_rematch`.

## Acceptance criteria

- AC1 (R1): `room_created` carries a 6-character `roomCode` — verified by `should create a room
  and receive game_start event` in `server/server.integration.test.js`
- AC2 (R1): `game_start` payload has `numbers` (length 20 for `pointCount: 20`) and `currentTurn`
  — verified by `should create a room and receive game_start event` in
  `server/server.integration.test.js`
- AC3 (R1): a non-default `pointCount` produces exactly that many numbers — verified by: none yet
  (the join test creates with `pointCount: 10` but asserts only that `numbers` exists)
- AC4 (R2): a created room appears in `my_games_list` with `roomCode` and `opponentName` —
  verified by `should return my games list` in `server/server.integration.test.js`
- AC5 (R3): the joining player receives `game_sync` with `numbers` and `currentTurn`, while the
  creator received `game_start` at creation — verified by `should allow second player to join
  room` in `server/server.integration.test.js`
- AC6 (R4): a same-token `join_room` updates the stored player socket id and answers
  `room_joined` without duplicating the player — verified by: none yet
- AC7 (R5): joining a nonexistent room emits `error` — verified by: none yet
- AC8 (R5): joining a full room emits `error` — verified by: none yet
- AC9 (R6): the remaining player receives `player_left` with the leaver's `playerId` — verified
  by `should handle surrender (leave_room)` in `server/server.integration.test.js`
- AC10 (R6): the leaver receives `left_room_success`, and a room left with 0 players is deleted
  — verified by: none yet (the surrender test leaves one player behind, so empty-room deletion
  is never exercised)
- AC11 (R7): a room inactive for 3 days is deleted after emitting `room_deleted` and
  `my_games_update` to its players — verified by: none yet
- AC12 (R1, R2, R3): end-to-end UI flow: Player 1 creates via the lobby (`#create-room-btn`),
  `#game-screen` becomes visible with a non-empty `#room-code-display`; Player 2 joins with that
  code (`#join-room-btn`) and sees the same code; both pages show `#turn-indicator` and
  `#game-canvas` — verified by `Multiplayer Game Flow > Player 1 creates room and Player 2
  joins` in `tests/e2e/basic.spec.js`

## Out of scope
- Room-code collision: `Math.random()` codes are not checked for uniqueness and never retried.
- The lobby's `#point-count-select` offers 10/15/20/25/30 (default 20 selected); the 5/10/15/20
  set mentioned in project docs does not exist in code, and README is not corrected here.
- `left_room_success` has no client handler: the my-games list item is removed optimistically
  after the `leave_room` emit.
- Connection-time token reconnection (`io.on('connection')` rewriting socket ids and pushing
  `my_games_list`) — covered by the sessions/reconnection spec, not here.
- In-game moves, game over, and rematch flows — own specs.
