# Implementation Plan - Juego de la Papa Online (Async Notifications & Export)

## Goal Description
1.  Notify players of game results (Win/Loss) in the lobby.
2.  Allow players to export the final game board as an image for social media.
3.  Manage server resources efficiently while enabling these features.

## Proposed Changes

### Backend (Server)
#### [MODIFY] [server.js](file:///home/iyaki/Proyectos/iyaki/papa-online/server/server.js)
- **`game_over` Event**:
    - Update `room.winner` and `room.loser`.
    - **Retention Policy**: Keep `lines` and `numbers` for **1 hour**.
        - *Reasoning*: Text data (JSON) is extremely lightweight (~5KB/game). Keeping it allows offline players to reconnect, fetch the state, and generate the export image. Immediate deletion would prevent async export.
    - **Auto-Cleanup**: Set `setTimeout` to delete the entire room object after 1 hour.
- **`sendMyGames` Helper**:
    - Include `winner` and `loser` status.

### Frontend (Client)
#### [MODIFY] [main.js](file:///home/iyaki/Proyectos/iyaki/papa-online/client/main.js)
- **`my_games_list` Handler**:
    - Show "¡Ganaste!" (Green) / "Perdiste" (Red) / "Jugando" (Neutral).
- **Export Logic**:
    - Add function `exportGameToImage(gameInstance)`.
    - Create a temporary canvas (or use existing).
    - Draw a background (paper texture).
    - Draw the game state (lines, numbers).
    - Overlay text: "Juego de la Papa", "Ganador: [Name]", Date.
    - Convert to Blob/URL and trigger download/share.

#### [MODIFY] [index.html](file:///home/iyaki/Proyectos/iyaki/papa-online/client/index.html)
- **Game Over Modal**:
    - Add "📸 Guardar Recuerdo" (Export) button.

## Verification Plan
### Manual Verification
1.  Play a game to completion.
2.  Verify "My Games" list shows the result.
3.  Click "Guardar Recuerdo".
4.  Verify an image is generated/downloaded with the game board and metadata.
5.  Verify server deletes room after timeout (can simulate by reducing timeout).
