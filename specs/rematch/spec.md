# Change: rematch

## Problem
When a game ends, players are dropped on a dead game-over screen with no way to
play again against the same opponent. The rematch feature lets a finished-game
player request a rematch, the opponent accept (starting a fresh game with the
same difficulty, accepting player moves first) or reject (notifying the
requester), with the lobby (`my-games`) reflecting the pending rematch status.

## Requirements
- R1: A player in a finished game can request a rematch. The server stores the
  requester's token in `room.rematchRequestedBy`, emits `rematch_requested` to
  the opponent (Socket.IO event, no payload), and emits `my_games_update` to
  both players so the lobby shows the pending state.
- R2: The opponent can accept via `respond_rematch` with `accept: true`. The
  server regenerates numbers with the same point count (`room.numbers.length`,
  `generateNumbers(pointCount, 600, 800)`), clears `lines`, resets
  `currentNumber` to 1, clears `winner`/`loser`/`rematchRequestedBy`, sets
  `currentTurn` to the ACCEPTING player's socket id, emits `game_restarted`
  (payload: `{ numbers, currentTurn }`) to the room, and emits
  `my_games_update` to both players.
- R3: The opponent can reject via `respond_rematch` with `accept: false`. The
  server clears `room.rematchRequestedBy`, emits `rematch_rejected` (no
  payload) to the requester, and emits `my_games_update` to both players.
- R4: Client shows the rematch UI after game over (`#rematch-btn`), a
  "waiting for response" state for the requester, and an
  accept/reject prompt (`#rematch-request-container` with
  `#accept-rematch-btn` / `#reject-rematch-btn`) for the opponent, updated by
  the `rematch_requested` / `rematch_rejected` / `game_restarted` socket
  events in `client/main.js`.
- R5: On reconnection (`game_sync`), the client restores the rematch UI state
  from the `rematchRequestedBy` field: requester sees a disabled
  "Esperando respuesta..." button, opponent sees the accept/reject prompt.
- R6: The my-games lobby renders the rematch status for finished games
  (`Esperando revancha...` if I requested, `¡Revancha pedida!` if the opponent
  requested) and sorts games with an opponent-pending rematch to the top
  (priority 3).

## Acceptance criteria
- AC1 (R1): After a game ends, both players see `#rematch-btn` visible — verified by `tests/e2e/rematch.spec.js` > `Rematch Functionality > Full Rematch Flow (Request -> Accept -> New Game)`.
- AC2 (R1): After the requester clicks `#rematch-btn`, the button becomes disabled and shows "Esperando respuesta", `#rematch-status` shows "Esperando a que el oponente acepte", and the opponent's `#rematch-request-container` becomes visible — verified by `tests/e2e/rematch.spec.js` > `Rematch Functionality > Full Rematch Flow (Request -> Accept -> New Game)`.
- AC3 (R2): After the opponent clicks `#accept-rematch-btn`, both game-over screens hide, the game restarts with new numbers, and the accepting player has the turn (`#current-player-display` gets `my-turn` for the acceptor, `opponent-turn` for the requester) — verified by `tests/e2e/rematch.spec.js` > `Rematch Functionality > Full Rematch Flow (Request -> Accept -> New Game)`.
- AC4 (R2): After acceptance both players can play again (a valid move is made in the new game) — verified by `tests/e2e/rematch.spec.js` > `Rematch Functionality > Full Rematch Flow (Request -> Accept -> New Game)`.
- AC5 (R3): Rejecting a rematch clears the request, emits `rematch_rejected` to the requester, and sends `my_games_update` to both players; the game stays in its finished state — verified by: none yet.
- AC6 (R2, R3): Server-side `request_rematch` / `respond_rematch` handlers are covered by an integration test (room state mutation: `rematchRequestedBy` storage/clearing, number regeneration with same count, `currentTurn` set to the accepting player's socket id, `game_restarted` / `rematch_rejected` emissions) — verified by: none yet.
- AC7 (R5): On reconnection to a finished game with a pending rematch, the UI restores the correct requester/opponent rematch state — verified by: none yet.
- AC8 (R6): The my-games lobby shows the rematch status text for finished games and prioritizes games where the opponent requested a rematch — verified by: none yet.

## Out of scope
- Swapping turns randomly or by loser-starts rule on rematch (current rule: accepting player always starts).
- Rematch when a player has left the room / disconnected.
- Multi-round rematch history or scoring across rematches.
- Rejecting from the lobby without an active game screen.
