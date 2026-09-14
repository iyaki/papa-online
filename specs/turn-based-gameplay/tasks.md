# Tasks: turn-based-gameplay

Generated from spec.md. Do not add tasks without a matching requirement.
Retrospective spec: items 1-4 document work that already exists and is covered
by existing tests (hence `[x]`); items 5-9 are the honest coverage gaps.

- [x] 1. Test coverage for the implemented flow: turn gating, state mutation and
  `move_made` broadcast covered by `'should handle turn-based moves correctly'`
  (`server/server.integration.test.js`); join-time `game_sync` (`numbers`,
  `currentTurn`) by `'should allow second player to join room'`
  (`server/server.integration.test.js`); client draw → submit → turn swap and
  crash-loss covered by `'Player 1 Wins (Player 2 crashes)'` and
  `'Player 2 Wins (Player 1 crashes)'` (`tests/e2e/win.spec.js`), screen/canvas
  restore by `'Player 1 creates room and Player 2 joins'`
  (`tests/e2e/basic.spec.js`)
- [x] 2. (R1, R2, R3) Server: `submit_move` accepted only from `currentTurn`;
  append line, `currentNumber++`, turn switch (2 players → opponent id, solo →
  `null`); broadcast `move_made { line, nextNumber, currentTurn }` (`server/server.js`)
- [x] 3. (R4) Server: bump `lastActivity` + `my_games_update` to both players on
  accepted move (`server/server.js`) — behaviour exists, assertion still missing (task 7)
- [x] 4. (R5) Server `request_game_sync` → full `game_sync` payload; client
  `enterGame()` requests sync and applies it via `game.syncState(...)`
  (`server/server.js`, `client/main.js`)
- [x] 5. (R6, R7, R8) Client: mouse/touch drawing on `#game-canvas` gated by
  `isMyTurn`/`isGameOver`, 20 px start/end snap to current/next number, discard
  on invalid release, collision check emitting `game_over`, turn UX classes
  (`client/game.js`) — covered indirectly by e2e (see task 1)
- [ ] 6. Write test for AC5 (R1): out-of-turn `submit_move` is silently ignored
  — no `move_made`, state unchanged (`server/server.integration.test.js`)
- [ ] 7. Write test for AC6 + AC7 (R2, R4): solo creator move sets
  `currentTurn = null` and joiner inherits turn; accepted move bumps
  `lastActivity` and sends `my_games_update` to both players
  (`server/server.integration.test.js`)
- [ ] 8. Write test for AC9 (R5): `request_game_sync` returns the full payload
  (`lines`, `currentNumber`, `isGameOver`, `winner`, `loser`, `players`,
  `rematchRequestedBy`) (`server/server.integration.test.js`)
- [ ] 9. Write test for AC14 + AC15 (R6, R7): invalid release discards the line
  without emitting `submit_move`; drawing input inert when not my turn or game
  over (`tests/e2e/*.spec.js` via `makeMove`, or a client-side unit test if
  `client/game.js` is ever made testable)
- [x] 10. `npm run verify` green; update AC test references if names changed
