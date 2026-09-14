# Tasks: game-end

Generated from spec.md. Do not add tasks without a matching requirement.

- [ ] 1. Write test for local stats update on `game_over` and reconnect `game_sync` (AC4, R5) (`tests/e2e/stats.spec.js` or `server/server.integration.test.js`)
- [ ] 2. Write test for confetti + numbers-connected counter on winner's game-over screen (AC5, R4) (`tests/e2e/win.spec.js`)
- [ ] 3. Write test that a raw socket disconnect mid-game does NOT end the game (AC6, R1) (`server/server.integration.test.js`)
- [x] 4. Server `game_over` handler: loser/winner tokens, `lastLine` save, `lastActivity` bump, broadcasts — already implemented (`server/server.js:321-353`)
- [x] 5. Client win/loss screen, confetti, numbers-connected counter — already implemented (`client/game.js:59-62, 248-280`)
- [x] 6. Client local stats persistence — already implemented (`client/main.js:354-361, 735-790`)
- [ ] 7. `npm run verify` green; update AC test references if names changed
