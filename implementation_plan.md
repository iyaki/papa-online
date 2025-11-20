# Implementation Plan - Juego de la Papa Online (Surrender)

## Goal Description
Add a "Surrender" (Rendirse) button that allows a player to forfeit the game, immediately granting victory to the opponent.

## Proposed Changes

### Frontend (Client)
#### [MODIFY] [index.html](file:///home/iyaki/Proyectos/iyaki/papa-online/client/index.html)
- Add a "Rendirse" button to the game screen (e.g., near the "Back to Lobby" or top bar).

#### [MODIFY] [main.js](file:///home/iyaki/Proyectos/iyaki/papa-online/client/main.js)
- Add event listener for the "Rendirse" button.
- On click, emit `game_over` with reason "El oponente se rindió".

### Backend (Server)
- No changes needed (existing `game_over` logic handles `loser: socket.id`).

## Verification Plan
### Manual Verification
1.  Start game.
2.  Click "Rendirse".
3.  Verify I see "Perdiste" and opponent sees "Ganaste".
