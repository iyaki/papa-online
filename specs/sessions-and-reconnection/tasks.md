# Tasks: sessions-and-reconnection

Generated from spec.md. Do not add tasks without a matching requirement.

- [ ] 1. Write test for socket-id swap, `currentTurn` remap and `socket.join` on reconnection (AC3) — reconnect a token mid-game in `server/server.integration.test.js`
- [ ] 2. Write test asserting full `my_games_list` payload shape (`isMyTurn`, `isGameOver`, `winner`, `loser`, `rematchRequestedBy`) and dead-room filtering (AC4) — extend `server/server.integration.test.js`
- [ ] 3. Write test for multi-room session accumulation per token (AC5) — `server/server.integration.test.js`
- [ ] 4. Write test that room/session state survives a disconnect (AC6) — `server/server.integration.test.js`
- [ ] 5. Write client test that `session_token` is persisted in `localStorage` and sent as handshake auth (AC7) — `tests/e2e/basic.spec.js` or new e2e spec
- [ ] 6. Session identity, reconnection and `get_my_games` behaviours (R1–R6) are already implemented in `server/server.js` and `client/main.js`; no new implementation code expected
- [ ] 7. `npm run verify` green; update AC test references if names changed
