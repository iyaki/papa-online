# Implementation Plan - Juego de la Papa Online (Freehand Edition)

## Goal Description
Update the game to support **freehand drawing** ("mano alzada"). Players can draw complex paths between numbers.
**Rules Update**:
1.  **Freehand**: Lines are no longer straight segments but paths composed of multiple points.
2.  **Collision**: Any part of the new path cannot cross any part of existing paths.
3.  **Instant Loss**: Still applies if any segment of the freehand path crosses an existing line.

## User Review Required
> [!IMPORTANT]
> **Performance**: Collision detection for freehand lines is more expensive (checking N segments vs M segments). We might need to optimize or limit path length if it gets too slow, but for a simple game it should be fine.
> **Data Size**: Socket payloads will be larger (arrays of points).

## Proposed Changes

### Frontend (Client)
#### [MODIFY] [game.js](file:///home/iyaki/Proyectos/iyaki/papa-online/client/game.js)
- **State**: `currentLine` becomes an array of points `[{x,y}, {x,y}, ...]`.
- **Drawing**: On `mousemove`, append points to `currentLine`.
- **Rendering**: Use `ctx.lineTo` for each point in the path.
- **Validation**: Check if the *first* point is near Start Number and *last* point is near End Number.

#### [MODIFY] [collision.js](file:///home/iyaki/Proyectos/iyaki/papa-online/client/collision.js)
- Update `checkCollisions` to iterate through all segments of the new path and compare against all segments of all existing paths.
- `doPolylineIntersection(path1, path2)`: Returns true if any segment of path1 intersects any segment of path2.

### Backend (Server)
#### [MODIFY] [server.js](file:///home/iyaki/Proyectos/iyaki/papa-online/server/server.js)
- Ensure `line` data structure is treated as an opaque object or updated to expect an array. (Currently it just broadcasts, so might not need code changes, just verification).

## Verification Plan

### Manual Verification
1.  **Freehand Test**: Draw a curvy line between 1 and 2.
2.  **Collision Test**: Draw a line that snakes through others and eventually crosses one. Verify Game Over triggers at the exact crossing point.
3.  **Multiplayer Sync**: Verify the full curve appears on the opponent's screen.
