# Implementation Plan - Juego de la Papa Online (Safe Zone)

## Goal Description
Implement a "Safe Zone" around the starting number of the current turn. Any line intersections occurring within this radius (15px) should be ignored to prevent immediate loss when starting a stroke near the previous line.

## Proposed Changes

### Frontend (Client)
#### [MODIFY] [collision.js](file:///home/iyaki/Proyectos/iyaki/papa-online/client/collision.js)
- Add `getIntersectionPoint(p1, p2, p3, p4)` helper.
- Update `doPolylineIntersection` to accept an optional `safeZone` object `{ x, y, radius }`.
- In `doPolylineIntersection`, if `doLinesIntersect` is true:
    - Calculate intersection point.
    - If point is within `safeZone`, ignore it.

#### [MODIFY] [game.js](file:///home/iyaki/Proyectos/iyaki/papa-online/client/game.js)
- In `checkCollisions`:
    - Identify the `startNum` (current number).
    - Pass `{ x: startNum.x, y: startNum.y, radius: 15 }` as `safeZone` to `doPolylineIntersection`.

## Verification Plan
### Manual Verification
1.  Start game.
2.  Draw line 1->2.
3.  As Player 2, start drawing from 2.
4.  Intentionally cross the end of the 1->2 line *inside* the circle of 2.
5.  Verify NO Game Over.
6.  Cross the line *outside* the circle.
7.  Verify Game Over.
