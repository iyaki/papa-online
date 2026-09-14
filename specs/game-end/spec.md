# Change: game-end

## Problem
When a player makes a losing move (crosses a line) or otherwise ends the match, the server must decide the loser and winner, persist the final state, and inform both clients so they show the correct win/loss screen and record local stats. This spec documents the existing game-end behaviour retroactively so future changes (e.g. real disconnect handling) have a baseline.

## Requirements
- R1: The server accepts a `game_over` event `{ roomCode, reason, lastLine? }` from a player socket. The emitting player's token is stored as `room.loser` (`'unknown'` if not found) and the other player's token as `room.winner` (`'unknown'` if not found).
- R2: If `lastLine` is provided, it is pushed into `room.lines` so the losing line persists in the room state.
- R3: On game over, the server sets `room.lastActivity = Date.now()`, then broadcasts `game_over` `{ reason, loser, winner }` to the room, and emits `my_games_update` to each player individually.
- R4: When a client receives `game_over`, the game screen shows a win or loss message on `#game-over-message` (loser: `"¡Perdiste! " + reason`; winner: `"¡Ganaste! El oponente perdió."`), un-hides `#game-over-screen`, shows confetti for the winner, and displays the count of numbers connected (`currentNumber - 1`).
- R5: On `game_over`, each client updates local stats in `localStorage` under key `papa_online_stats`: total wins/losses, per-opponent wins/losses (opponent name defaults to `'Oponente'`), guarded against double counting by `processedGames` including the `roomCode`. Stats are also refreshed on `game_sync` reconnection when `isGameOver && winner` is present.
- R6: The losing move is detected client-side: when the drawn line crosses an existing line, the client emits `game_over` `{ roomCode, reason: "Cruzó una línea", lastLine: currentLine }` and immediately shows its own loss screen without waiting for the server echo.

## Acceptance criteria
- AC1 (R1, R2, R3): Server stores loser/winner tokens from the emitting socket, saves optional `lastLine`, bumps `lastActivity`, and broadcasts `game_over` with `{ reason, loser, winner }` to both sockets, plus `my_games_update` to each — verified by `server/server.integration.test.js` › `should handle game over correctly`
- AC2 (R6): After player 2 makes a losing move (2 → 4, skipping 3), page 2 shows `Perdiste` in `#game-over-message` and page 1 shows `Ganaste` — verified by `tests/e2e/win.spec.js` › `Game Win/Loss Scenarios > Player 1 Wins (Player 2 crashes)`
- AC3 (R6, R4): After player 1 makes a losing move (1 → 3, skipping 2), page 1 shows `Perdiste` and page 2 shows `Ganaste` — verified by `tests/e2e/win.spec.js` › `Game Win/Loss Scenarios > Player 2 Wins (Player 1 crashes)`
- AC4 (R5): Local stats in `localStorage` (`papa_online_stats`: `totalWins`/`totalLosses`, `opponents[name].wins/losses`, `processedGames` dedup) are updated on `game_over` and on `game_sync` reconnection with `isGameOver` — verified by: none yet
- AC5 (R4): Winner sees confetti and the "numbers connected" counter on the game-over screen — verified by: none yet
- AC6 (R1): A socket-level disconnect (closing the connection) during an active game does NOT end the game server-side: the `disconnect` handler only logs (`server/server.js:448`); the surviving opponent is not declared winner — verified by: none yet

## Out of scope
- Real server-side disconnect-loss (declaring the remaining player winner when the opponent's socket closes) — currently only logged; would be a new change.
- Rematch flow after game over (covered by `specs/rematch/`).
- Room cleanup/expiry via `lastActivity` (covered by `specs/room-lifecycle/`).
- Server-side anti-cheat: the server trusts whichever client claims `game_over`; no move validation on game-over emission.
