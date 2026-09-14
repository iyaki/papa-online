# Use Cases - Papa Online

Step-by-step guide to the actions a player executes today to use each feature
of the game. While the [specs](../specs/README.md) document the **intention
and expected behaviour**, this document describes **current usage**, exactly
as it can be executed against the application today.

Every use case was manually verified against the app running locally
(`cd server && npm run dev`, two browsers simulating the two players).
On-screen labels are quoted verbatim in Spanish, as the UI is Spanish.

---

## UC-01: Create a room

**Actor**: player who wants to start a game.

1. Open the app. The lobby is shown.
2. Type your name into the "Tu Nombre" field (max 10 characters; it is saved
   in the browser for future visits).
3. (Optional) Pick the number of points in the selector: 10, 15, 20
   (default), 25 or 30.
4. Press **Crear Sala**.
5. Result: you enter the game screen with the 6-character room code shown in
   "Sala: XXXXXX". The board is already generated: number 1 appears connected
   and "Siguiente: 2" shows the first target. The indicator reads "Tu Turno":
   the creator can start playing even before the opponent joins.

## UC-02: Share the room code

**Actor**: a player inside a room (creator or joiner).

1. On the game screen, press the share icon (to the right of the
   "Sala: XXXXXX" badge).
2. Result depends on the device:
   - With the Web Share API (mobile): the OS share sheet opens with the
     message "¡Únete a mi partida! Código: XXXXXX" and the link
     `https://<host>/?room=XXXXXX`.
   - Without the Web Share API (desktop): the link is copied to the clipboard
     and the icon shows "¡Copiado!" for 2 seconds.

## UC-03: Join a room

**Actor**: the second player.

### By typing the code

1. Open the app. Type your name into "Tu Nombre".
2. Type the 6-character code into the "Código" field.
3. Press **Unirse**.
4. Result: game screen synced with the board in progress; the indicator shows
   "Turno del Oponente" or "Tu Turno" depending on whose turn it is.

### Via a shared link (`?room=CODIGO`)

1. Open the link you received (`https://<host>/?room=XXXXXX`).
2. If a name is already saved in the browser: joining is automatic, no button
   press needed.
3. If no name is saved: the "Código" field comes pre-filled; enter your name
   and the "Unirse" button pulses as a hint. Press **Unirse**.

### Visible errors

- Room already has 2 players: alert "⛔ La sala está llena. Ya hay 2 jugadores."
- Non-existent code: room-not-found error alert.

## UC-04: Play a turn

**Actor**: the player whose turn it is ("Tu Turno").

1. Check "Siguiente: N" to see which number to connect.
2. Press on the last connected number (N-1) and, without releasing, drag to
   number N. The stroke is drawn live while you drag.
3. Release near number N. If the stroke reaches the target, the move is valid:
   the line stays drawn, "Siguiente" advances to N+1, and the turn passes to
   the opponent (the indicator switches between "Tu Turno" and "Turno del
   Oponente").
4. If you release far from the target, the stroke is discarded and the turn is
   kept: you can try again.

**Move-level losing rules** (the offender loses immediately):

- The stroke crosses a line already drawn (yours or the opponent's).
- The stroke touches a number that is not the target (this includes skipping
  the order, e.g. dragging from 1 straight to 3).

The opponent is notified of the game end immediately, with no extra move
needed.

## UC-05: Game end and result screen

**Actor**: both players.

1. When someone crosses a line (or cannot move), both players see the "Juego
   Terminado" screen on top of the board.
2. The loser sees "¡Perdiste! <reason>" and the winner sees "¡Ganaste! El
   oponente perdió.", along with the counter "Números conectados: N".
3. Options shown to both: **🔄 Pedir Revancha**, **Volver al Lobby**, and
   **📸 Guardar Recuerdo** (see UC-06, UC-09 and UC-13).

## UC-06: Request a rematch (and respond from anywhere)

**Actor**: either player, from the result screen.

1. Press **🔄 Pedir Revancha**. The button becomes disabled with the text
   "Esperando respuesta..." and the message "Esperando a que el oponente
   acepte..." appears.
2. The opponent sees the panel "¡Tu oponente quiere la revancha!" with two
   buttons: **Aceptar** and **Rechazar** (their own rematch button is hidden
   in the meantime).
3. If they accept: both return to the board with regenerated numbers and
   "Siguiente: 2"; the player who **accepted** moves first.
4. If they reject: the requester is notified of the rejection and both stay
   on the result screen.
5. If the opponent is in the lobby, the "Mis Partidas" row shows "¡Revancha
   pedida!" with **✓ Aceptar** / **✗ Rechazar** inline buttons. Accepting
   enters the new game immediately (the accepting player moves first);
   rejecting keeps both players where they are and the row returns to the
   finished-game status.

## UC-07: Leave to the menu and come back

**Actor**: a player who wants to leave the game screen without abandoning
the room.

1. On the game screen, press the house icon (top left). The game is **not**
   abandoned: it stays alive, and the `?room=` parameter is cleaned from the
   URL.
2. In the lobby, the "Mis Partidas" section lists each room with its current
   status: "¡Tu Turno!", "Esperando...", "¡Ganaste!", "Perdiste",
   "¡Revancha pedida!" or "Esperando revancha...". The list is sorted so the
   games that need the player's action come first.
3. Press the room's row to re-enter: the full state (numbers, lines, turn)
   is re-synced with the server. Rows with a pending rematch offer the
   inline accept/reject described in UC-06.

## UC-08: Reconnect to a game

**Actor**: a player who closed or reloaded the tab.

1. Open (or reload) the app in the same browser.
2. The lobby shows "Mis Partidas" with the active rooms and their status.
3. Press the room's row: the game is restored exactly where it was (turn,
   lines and next number).
4. Rooms are kept for 3 days from the last activity, then deleted (as noted
   at the bottom of the lobby).

## UC-09: Abandon a game

**Actor**: a player who wants to remove a room from their list.

1. In the lobby, go to "Mis Partidas".
2. Press the trash icon on the corresponding row.
3. Confirm the dialog "¿Estás seguro que quieres abandonar la sala XXXXXX? Se
   borrará de tu lista."
4. Result: the room disappears from your list. (If the other player was still
   in it, their game continues on their side.)

## UC-10: View local statistics

**Actor**: any player, from the lobby.

1. Press **📊 Estadísticas**.
2. The total Wins and Losses are shown, along with the per-opponent breakdown
   ("Nombre X 🏆 - Y 💔").
3. Press **Volver al Lobby** to close.
4. Data is saved on the device only (localStorage); clearing the browser data
   removes it. Each game is counted exactly once.

## UC-11: Check rules and help

**Actor**: any player, from the lobby.

1. Press **❓ Ayuda / Reglas**.
2. The screen shows the game goal, how to play, who wins, room lifetime
   (3 days) and the bug-report email.
3. Press **Entendido** to go back to the lobby.

## UC-12: Enable notifications

**Actor**: a player who wants to know when it is their turn.

1. In the lobby, press **🔔 Activar Notificaciones** (visible when the
   browser supports notifications and permission has not been granted or
   denied yet).
2. Accept the browser permission prompt.
3. Result: when the opponent plays and the tab is not visible, a
   "Papa Online - ¡Es tu turno!" notification arrives.

## UC-13: Save a game souvenir

**Actor**: a player, from the result screen.

1. Press **📸 Guardar Recuerdo**.
2. Result: a PNG (`juego-papa-YYYY-MM-DD.png`) downloads with the final
   board, the players' names, the result and the game URL.

---

## Relationship with the specs

- Specs (`specs/`): intention, decisions and expected behaviour of each
  change, with their verifications.
- This document: the concrete steps a player executes today. If a step here
  contradicts a spec, the spec wins and there is either a documentation bug
  or an implementation bug here.
