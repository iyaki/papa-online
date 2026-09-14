# Change: sessions-and-reconnection

## Problem
Socket.IO assigns a new socket id on every connection, so a page reload or network blip would otherwise orphan a player's games. Token-based player identity (sent in the Socket.IO handshake auth) gives each browser a stable identity, lets the server re-attach a returning player to all their rooms, and powers a persistent "my games" lobby list.

## Requirements
- R1: Each client generates a UUID session token, persists it in `localStorage` under `session_token`, and sends it as `socket.handshake.auth.token` on every Socket.IO connection.
- R2: The server keeps an in-memory `playerSessions` map (`token -> { username, rooms: [] }`). Creating a room registers the token with the room code and username; rooms array supports multiple concurrent rooms per token. (In-memory only — lost on server restart.)
- R3: On any connection where the token matches an existing session, the server re-attaches the player: for each room in the session, it finds the room player by token, remaps `room.currentTurn` to the new socket id if it was the old id, updates `player.id` to the new socket id, and calls `socket.join(roomCode)`.
- R4: After re-attachment (or on `get_my_games` request), the server emits `my_games_list` — one entry per live room in the session with payload `{ roomCode, opponentName, isMyTurn, isGameOver, winner, loser, rematchRequestedBy }`; `isMyTurn` compares `currentTurn` to the current socket id, `opponentName` falls back to `'Esperando...'` when there is no opponent, dead room codes are filtered out.
- R5: The client can request its games list via the `get_my_games` event; it does so on menu load, after rematch reset, on `my_games_update`, and when returning to the menu.
- R6: Server-side `disconnect` only logs the socket id; no room/session state is changed on disconnect (players are only fully removed via explicit surrender/`leave_room`).

## Acceptance criteria
- AC1 (R1): A Socket.IO client connecting with `auth: { token: 'test-token-1' }` connects successfully — verified by `should connect client with authentication token` in `server/server.integration.test.js`
- AC2 (R4, R5): A player that created a room and then emits `get_my_games` receives a non-empty `my_games_list` whose first entry has `roomCode` and `opponentName` properties — verified by `should return my games list` in `server/server.integration.test.js`
- AC3 (R3): A returning token gets its room player's socket id swapped, `currentTurn` remapped to the new socket id when it was that player's turn, and the socket joined to the room — verified by: none yet
- AC4 (R4): `my_games_list` payload for each game includes `isMyTurn`, `isGameOver`, `winner`, `loser`, and `rematchRequestedBy`; rooms no longer in `rooms` are omitted — verified by: none yet
- AC5 (R2): Creating two rooms with the same token yields a session with both room codes; the full list is served on `get_my_games` — verified by: none yet
- AC6 (R6): Server `disconnect` handler performs no state mutation (log only); room and session survive the socket going away — verified by: none yet
- AC7 (R1): Client persists a generated UUID in `localStorage.session_token` and sends it in the handshake `auth.token` — verified by: none yet (client-side only; candidates: `tests/e2e/*.spec.js`)

## Out of scope
- Persistent session storage (DB/Redis) — sessions are in-memory by design.
- Session expiry or token invalidation.
- Server-side cleanup of rooms on player disconnect (handled by `scheduleCleanup` room-empty logic, covered by the room-lifecycle spec).
- Rematch flow semantics themselves (`rematchRequestedBy` content is covered by the rematch spec).
