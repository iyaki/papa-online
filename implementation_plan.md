# Implementation Plan - Juego de la Papa Online (Local Statistics)

## Goal Description
Track wins and losses locally (per device) against different opponents. Display these statistics in a modal accessible from the lobby.

## Proposed Changes

### Frontend (Client)
#### [MODIFY] [main.js](file:///home/iyaki/Proyectos/iyaki/papa-online/client/main.js)
- **Stats Logic**:
    - Create `loadStats()` and `saveStats(stats)` helpers.
    - Create `updateStats(opponentName, isWin)`.
        - Load stats.
        - Increment `totalWins` / `totalLosses`.
        - Find or create entry for `opponentName`.
        - Increment specific win/loss.
        - Save stats.
    - **Trigger**: Call `updateStats` inside `game_sync` handler when `isGameOver` is true AND `winner` is set.
        - **Crucial**: Need to prevent double-counting. Store `processedGames` list in localStorage (list of roomCodes) to ensure we only count each game once.
- **UI Logic**:
    - Add "Stats" button listener.
    - Render stats modal content:
        - Header: Total Wins / Total Losses.
        - List: Opponent Name | Wins | Losses.

#### [MODIFY] [index.html](file:///home/iyaki/Proyectos/iyaki/papa-online/client/index.html)
- **Lobby**: Add `<button id="stats-btn" class="secondary-btn">📊 Estadísticas</button>`.
- **Modal**: Add `#stats-modal` structure (hidden by default).

#### [MODIFY] [style.css](file:///home/iyaki/Proyectos/iyaki/papa-online/client/style.css)
- **Stats Modal**: Style the modal and the list of opponents (scrollable if long).

## Verification Plan
### Manual Verification
1.  Play a game and win.
2.  Check Stats modal. Should show 1 Win vs Opponent.
3.  Reload page. Stats should persist.
4.  Play another game against same opponent and lose.
5.  Stats should show 1 Win / 1 Loss.
6.  Play against different opponent.
7.  Stats should show new entry.
