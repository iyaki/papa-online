# Change: overlap-detection

## Problem
The game must place numbered points so they are readable and reachable, and must
detect when a drawn line crosses an existing line so the loser can be decided.
Placement and crossing detection currently live in two independent halves: the
server places points (`generateNumbers`, `checkOverlap` in `server/server.js`)
and the client judges line crossings (`client/collision.js`); this spec
documents both as they exist today (retrospective spec).

## Requirements

- R1: `generateNumbers(count, width, height)` produces exactly `count` points
  with sequential `value` 1..count, each with `x`/`y` coordinates inside a
  padded play area of `padding = 40` px on every side: candidates are drawn as
  `padding + Math.random() * (size - 2*padding)`, so x ∈ `[40, width-40]` and
  y ∈ `[40, height-40]`.
- R2: Placement retries to avoid overlaps: for each point, a candidate is
  re-rolled while `checkOverlap(pos, numbers)` is true, up to a maximum of 100
  attempts per point; after 100 attempts the last candidate is accepted as-is.
- R3: `checkOverlap(pos, numbers)` reports an overlap when the Euclidean
  distance between the candidate and any already-placed number is **strictly
  less than** `minDist = 40` units (`sqrt(dx²+dy²) < 40`). A point at exactly
  40 units is NOT an overlap.
- R4: The client, in `client/collision.js`, exports `doLinesIntersect(p1, p2,
  p3, p4)` — classic orientation-based segment intersection: two segments
  intersect if orientations differ on both pairs (`o1 !== o2 && o3 !== o4`),
  special cases are handled for collinear touch (`orientation 0` plus
  `onSegment` bounding-box check), and segments that only share an endpoint
  (points equal within 0.1 tolerance via `arePointsEqual`) are NOT a
  collision.
- R5: The client exports `doPolylineIntersection(path1, path2, safeZone)` —
  it checks every segment pair of the two polylines with `doLinesIntersect`;
  an optional `safeZone = { x, y, radius }` ignores intersections whose point
  (computed by `getIntersectionPoint`, line-line algebra, parallel/collinear
  fallback returns `p1`) lies within `radius` of the safe-zone center.
- R6: When a collision is detected during a move, the client declares the
  player who drew the crossing line the loser and emits a `game_over` event
  including the reason and `lastLine` (the crossing segment).

## Acceptance criteria

- AC1 (R1): `generateNumbers(20, 600, 800)` returns an array of length 20,
  first point has `value: 1`, last has `value: 20`, and each point has `x` and
  `y` — verified by `generateNumbers should create correct number of points`
  in `server/server.test.js`.
- AC2 (R1): Every generated point is within the 40 px padding: `x` in
  `[40, 600-40]` and `y` in `[40, 800-40]` — verified by
  `generateNumbers should create correct number of points` in
  `server/server.test.js`.
- AC3 (R3): A candidate at distance `sqrt(10²+10²)` ≈ 14.1 from an existing
  point reports overlap `true`; one at distance `sqrt(100²+100²)` ≈ 141
  reports `false`; one at exactly 40 units reports `false` (strict less-than) —
  verified by `checkOverlap should detect close points` in
  `server/server.test.js`.
- AC4 (R2, R4, R5, R6): The retry loop, segment-intersection geometry,
  polyline sweep with safe zone, and the collision → drawer-loses →
  `game_over` (reason, `lastLine`) flow are observable end-to-end when a
  winning/crossing line is drawn — verified by the Playwright e2e flows in
  `tests/e2e/win.spec.js` (which exercise the client collision path via a real
  game) — partially verified; no dedicated unit/integration test exists for
  `client/collision.js` itself.
  - verified by: none yet (for `doLinesIntersect`, `doPolylineIntersection`
    and the `game_over`/`lastLine` emission in isolation)
- AC5 (R2): After 100 failed attempts for a single point, generation stops
  retrying and places the point regardless of overlap — verified by: none yet.
- AC6 (R4): Segments that share an endpoint (touching at a joint within 0.1
  tolerance) are not reported as intersecting — verified by: none yet.
- AC7 (R5): An intersection inside the safe zone radius is ignored while one
  outside is reported — verified by: none yet.

## Out of scope

- Server-side validation of drawn lines (the server trusts client collision
  verdicts; hardening the server against a cheating client is a separate change).
- Replacing the shared-endpoint exclusion or the safe-zone mechanism.
- Any change to the 40 px padding or 40-unit minimum distance constants.
- Turn sequencing, progress tracking, room codes, and UUIDs (covered by other
  specs; their tests exist in `server/server.test.js` but are out of scope here).
