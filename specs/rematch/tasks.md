# Tasks: rematch

Generated from spec.md. Do not add tasks without a matching requirement.

- [ ] 1. Write test for rematch rejection path: server clears `rematchRequestedBy`, requester receives `rematch_rejected`, both get `my_games_update` (AC5) (`server/server.integration.test.js`)
- [ ] 2. Write integration tests for `request_rematch` / `respond_rematch` accept path: `rematchRequestedBy` stored with requester token, numbers regenerated with same pointCount, `lines`/`currentNumber`/`winner`/`loser`/`rematchRequestedBy` reset, `currentTurn` set to accepting player's socket id, `game_restarted` emitted with `{ numbers, currentTurn }` (AC6) (`server/server.integration.test.js`)
- [ ] 3. Write e2e test for reconnection restoring pending rematch UI state for requester and opponent (AC7) (`tests/e2e/rematch.spec.js`)
- [ ] 4. Write e2e test for my-games lobby rematch status rendering and prioritization (AC8) (`tests/e2e/rematch.spec.js` or a new lobby spec)
- [x] 5. Server: `request_rematch` stores `room.rematchRequestedBy = token`, emits `rematch_requested` to opponent, emits `my_games_update` to both (R1) (`server/server.js`) — verified by `tests/e2e/rematch.spec.js` > `Rematch Functionality > Full Rematch Flow (Request -> Accept -> New Game)`
- [x] 6. Server: `respond_rematch` accept resets the room and emits `game_restarted` with the accepting player's turn (R2) (`server/server.js`) — verified by `tests/e2e/rematch.spec.js` > `Rematch Functionality > Full Rematch Flow (Request -> Accept -> New Game)`
- [x] 7. Server: `respond_rematch` reject clears the request and emits `rematch_rejected` + `my_games_update` (R3) (`server/server.js`) — verified by: none yet
- [x] 8. Client: rematch request button, waiting state, accept/reject prompt handlers, and `game_restarted` reset in game screen (R4) (`client/main.js`) — verified by `tests/e2e/rematch.spec.js` > `Rematch Functionality > Full Rematch Flow (Request -> Accept -> New Game)`
- [x] 9. Client: `game_sync` restores rematch UI from `rematchRequestedBy` (R5) (`client/main.js`) — verified by: none yet
- [x] 10. Client: my-games lobby renders rematch status and sorts opponent-requested rematches first (R6) (`client/main.js`) — verified by: none yet
- [ ] 11. `npm run verify` green; update AC test references if names changed
