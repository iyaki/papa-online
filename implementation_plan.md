# Implementation Plan - Juego de la Papa Online (Multi-Game)

## Goal Description
Allow players to participate in multiple games simultaneously. The Lobby will serve as a dashboard listing all active games, their status (whose turn it is), and allowing the player to jump between them.

## Proposed Changes

### Backend (Server)
#### [MODIFY] [server.js](file:///home/iyaki/Proyectos/iyaki/papa-online/server/server.js)
- **Session Structure**: Change `playerSessions[token]` from `{ roomCode, username }` to `{ username, rooms: [code1, code2] }`.
- **Connection**:
    - On reconnect, iterate `session.rooms` and `socket.join(code)` for all of them.
    - Emit `my_games_list` with details of all active games.
- **Create/Join**:
    - Add the new room code to `session.rooms`.
    - Emit `my_games_list` update.
- **Leave**:
    - Remove room code from `session.rooms`.
- **New Event**: `get_my_games` -> returns list of `{ roomCode, opponentName, isMyTurn }`.

### Frontend (Client)
#### [MODIFY] [index.html](file:///home/iyaki/Proyectos/iyaki/papa-online/client/index.html)
- Add a "My Games" section in `#lobby-screen`.
- Add a "Back to Menu" button in `#game-screen` (top left?).

#### [MODIFY] [main.js](file:///home/iyaki/Proyectos/iyaki/papa-online/client/main.js)
- **State**: Maintain `activeGames` list.
- **Lobby**: Render the list of games. Clicking one calls `enterGame(roomCode)`.
- **Game Switching**:
    - `enterGame`: Requests full sync for that specific room.
    - "Back to Menu": Just hides `#game-screen` and shows `#lobby-screen`. Does NOT emit `leave_room`.
- **Socket Events**:
    - Listen for `my_games_list`.
    - Update `game_sync` to only initialize the game if we are currently viewing that room.

## Verification Plan
### Manual Verification
1.  User A creates Game 1.
2.  User A goes back to menu.
3.  User A creates Game 2.
4.  User A sees both games in list.
5.  User A can switch between Game 1 and Game 2.
6.  User B joins Game 1.
7.  User A sees Game 1 status update.
