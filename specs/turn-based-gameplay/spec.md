# Change: turn-based-gameplay

> Retrospective spec: documents the core turn-based flow as it exists today
> (no code change). Coverage gaps are listed honestly with `— verified by: none yet`.

## Problem

Two players take turns drawing a single polyline between consecutively numbered
points; the first player to cross a line (or touch a forbidden number) loses.
Today this flow is implemented across `server/server.js` (`submit_move`,
`request_game_sync`) and `client/game.js` (mouse/touch drawing), but the exact
contract — who may move, what is broadcast, and how the client enforces the
number sequence — was never written down. This spec records that contract and
which tests prove each part of it, so future changes to the turn engine cannot
silently break it.

## Requirements

- R1: The server accepts `submit_move` only when `room.currentTurn === socket.id`;
  a `submit_move` from any other socket in a known room is silently ignored
  (no state change, no emit). Unknown `roomCode` is ignored too.
- R2: An accepted move mutates room state: `line` is appended to `room.lines`,
  `room.currentNumber` is incremented by 1, and the turn passes on: with 2
  players `currentTurn` becomes the opponent's socket id; when the creator
  moves solo (opponent not joined yet) `currentTurn` becomes `null`
  (the joiner later inherits the turn on `join_room` when it is `null`).
- R3: An accepted move broadcasts `move_made` with `{ line, nextNumber, currentTurn }`
  to the whole room (`io.to(roomCode)`), where `nextNumber` is the incremented
  `room.currentNumber`.
- R4: An accepted move bumps `room.lastActivity` and emits `my_games_update`
  to every player in the room so lobby lists refresh.
- R5: `request_game_sync` (`{ roomCode }`) replies to the requesting socket with
  `game_sync` carrying the full state: `roomCode`, `numbers`, `lines`,
  `currentNumber`, `currentTurn`, `isGameOver` (`!!room.winner`), `winner`,
  `loser`, `players` (mapped to `{ username, token }`), `rematchRequestedBy`.
  The client requests it on every `enterGame()` and `game_sync` restores the
  game screen via `game.syncState(numbers, lines, currentNumber, currentTurn, isGameOver)`.
- R6: The client supports freehand line drawing on `#game-canvas` with mouse
  (`mousedown`/`mousemove`/`mouseup`) and touch (`touchstart`/`touchmove`/
  `touchend`, `preventDefault`) events. A stroke only starts if it is the
  player's turn (`isMyTurn`), the game is not over, and the press lands within
  20 px of the number whose `value === currentNumber`; the stroke starts snapped
  to that number's center.
- R7: The client enforces the target number sequence: releasing the stroke
  within 20 px of the number `value === currentNumber + 1` snaps the end to its
  center and emits `submit_move { roomCode, line }`; releasing anywhere else
  discards the line (no emit). During drawing, if the stroke crosses an existing
  line, intersects itself, or its head comes within 20 px of any number that is
  not the current or next one, the client emits
  `game_over { roomCode, reason: "Cruzó una línea", lastLine }` and marks itself
  lost locally. There is no completion win: connecting the last number does not
  emit anything; the only way a game ends is an emitted `game_over`.
- R8: Whose-turn UX: `updateTurn(currentTurnId)` sets `isMyTurn`, renders
  "Tu Turno"/"Turno del Oponente" on `#current-player-display` with the
  `my-turn`/`opponent-turn` classes, and shows the next target on
  `#next-number-display` (`currentNumber + 1`). Drawing input is inert when it
  is not the player's turn (R6 guard). `move_made` applies `line`/`nextNumber`/
  `currentTurn` locally and redraws.

## Acceptance criteria

- AC1 (R1): The creator (socket id equal to `currentTurn`) submits a move after
  the opponent joined and the move is accepted — verified by
  `'should handle turn-based moves correctly'` in `server/server.integration.test.js`
  (its `submit_move` from clientSocket1 produces the asserted `move_made`).
- AC2 (R2): After the creator's first accepted move `nextNumber` is `2`
  (`currentNumber` incremented from 1) — verified by
  `'should handle turn-based moves correctly'` in `server/server.integration.test.js`
  (`expect(data).toHaveProperty('nextNumber', 2)`).
- AC3 (R3): Both players in the room receive the same accepted move as
  `move_made` carrying a `line` — verified by
  `'should handle turn-based moves correctly'` in `server/server.integration.test.js`
  (its handler counts one `move_made` with a truthy `line` on each of the two
  clients; `done()` fires at `receivedMoves === 2`).
- AC4 (R2): After a valid move by player 1, the turn passes to player 2: page2
  shows `#current-player-display` with class `my-turn` and page1 with
  `opponent-turn` — verified by `'Player 1 Wins (Player 2 crashes)'` in
  `tests/e2e/win.spec.js`.
- AC5 (R1): A `submit_move` from a socket whose id is not `currentTurn`
  (including before joining, or after the turn passed) is silently ignored: no
  `move_made`, no `lines`/`currentNumber` change — verified by: none yet.
- AC6 (R2): A creator moving solo gets `currentTurn = null` (and the
  `move_made` broadcast says so); when the opponent then joins, the joiner
  inherits the turn — verified by: none yet (join-side inheritance is only
  indirectly implied by the join flow in `server/server.js` lines 233-236).
- AC7 (R4): An accepted move bumps `lastActivity` and delivers `my_games_update`
  to both players — verified by: none yet.
- AC8 (R5): On join, the joining player receives a `game_sync` containing
  `numbers` and `currentTurn` — verified by
  `'should allow second player to join room'` in `server/server.integration.test.js`
  (partial: only these two fields of the payload are asserted).
- AC9 (R5): `request_game_sync` answers with the full payload including
  `lines`, `currentNumber`, `isGameOver`, `winner`, `loser`, `players`
  (`{ username, token }` each) and `rematchRequestedBy` — verified by: none yet.
- AC10 (R5): The client restores the game screen from `game_sync`: after
  player 2 joins, page2 shows `#game-screen` with `#room-code-display` showing
  the room code and a visible `#game-canvas` — verified by
  `'Player 1 creates room and Player 2 joins'` in `tests/e2e/basic.spec.js`.
- AC11 (R6, R7): A real mouse drag from number 1 to number 2 (the current and
  next numbers) draws a stroke and submits the move end-to-end: the move is
  accepted and the turn indicator swaps (see AC4) — verified by
  `'Player 1 Wins (Player 2 crashes)'` in `tests/e2e/win.spec.js`
  (via the `makeMove` helper in `tests/e2e/utils.js`).
- AC12 (R7): Drawing into a forbidden number (drag 1 → 3, skipping 2) triggers
  the client's collision check, emits `game_over`, and both players see the
  result: crasher `#game-over-message` contains "Perdiste", opponent "Ganaste" —
  verified by `'Player 2 Wins (Player 1 crashes)'` in `tests/e2e/win.spec.js`.
- AC13 (R8): After both players are in the game, the turn indicator
  `#turn-indicator` is visible on both pages — verified by
  `'Player 1 creates room and Player 2 joins'` in `tests/e2e/basic.spec.js`.
- AC14 (R7): Releasing a stroke that does not end within 20 px of the next
  number discards the line without emitting `submit_move` — verified by: none yet.
- AC15 (R6, R8): Drawing input is inert when it is not the player's turn or the
  game is over (`handleMouseDown` early-returns; strokes never start) —
  verified by: none yet (e2e only exercises drawing on the moving player's turn).

## Out of scope

- Server-side `game_over` handling (winner/loser assignment, broadcast) — own spec (game end).
- Collision geometry of `client/collision.js` (`doPolylineIntersection`) — own spec (overlap).
- Rematch request/accept flow and `game_restarted` — own spec (rematch).
- Room creation, join, leave, reconnection/session restore — own specs.
- Lobby "Mis Partidas" rendering and stats; canvas rendering details (`draw()`); `exportToImage`.
- Win/lose messaging text and confetti presentation.
