# Overlap Detection

Status: Implemented

Retrospective spec documenting existing behaviour; untested areas listed under Open Questions / Risks.

## Overview

### Purpose

The game must place numbered points so they are readable and reachable, and must detect when a drawn line crosses an existing line so the loser can be decided. Placement and crossing detection live in two independent halves:

- **Placement (server)** — `generateNumbers` and `checkOverlap` in `server/server.js` (lines 21–50) produce a random but non-overlapping layout of numbered points inside a padded play area.
- **Crossing detection (client)** — `client/collision.js` judges whether the path being drawn intersects existing lines, and `client/game.js` turns a positive verdict into a `game_over` emission that decides the loser.

This spec documents both halves exactly as they ship today.

### Goals

- Specify the point-placement algorithm: sequential values, 40 px padding, overlap retry with a 100-attempt cap.
- Specify the strict minimum-distance rule (`sqrt(dx²+dy²) < 40`).
- Specify the client geometry: orientation-based segment intersection, collinear special cases, shared-endpoint exclusion, polyline sweep with safe zone.
- Specify the collision → drawer-loses → `game_over` flow (reason text and `lastLine` payload).
- Make explicit which parts of this behaviour are covered by automated tests and which are not.

### Non-Goals

- No server-side validation of drawn lines: the server trusts the client's collision verdicts; hardening the server against a cheating client is a separate change.
- Not replacing the shared-endpoint exclusion (`arePointsEqual`, 0.1 tolerance) or the safe-zone mechanism.
- No change to the 40 px padding or the 40-unit minimum-distance constants.
- Turn sequencing, progress tracking, room codes, and UUIDs are covered by other specs (`specs/turn-based-gameplay.md`, `specs/room-lifecycle.md`, `specs/sessions-and-reconnection.md`); their tests exist in `server/server.test.js` but are out of scope here.

### Scope

Requirements R1–R6, preserved verbatim in meaning from the original change:

- **R1** — `generateNumbers(count, width, height)` produces exactly `count` points with sequential `value` 1..count, each with `x`/`y` coordinates inside a padded play area of `padding = 40` px on every side: candidates are drawn as `padding + Math.random() * (size - 2*padding)`, so x ∈ `[40, width-40]` and y ∈ `[40, height-40]`.
- **R2** — Placement retries to avoid overlaps: for each point, a candidate is re-rolled while `checkOverlap(pos, numbers)` is true, up to a maximum of 100 attempts per point; after 100 attempts the last candidate is accepted as-is.
- **R3** — `checkOverlap(pos, numbers)` reports an overlap when the Euclidean distance between the candidate and any already-placed number is **strictly less than** `minDist = 40` units (`sqrt(dx²+dy²) < 40`). A point at exactly 40 units is NOT an overlap.
- **R4** — The client, in `client/collision.js`, exports `doLinesIntersect(p1, p2, p3, p4)` — classic orientation-based segment intersection: two segments intersect if orientations differ on both pairs (`o1 !== o2 && o3 !== o4`), special cases are handled for collinear touch (`orientation 0` plus `onSegment` bounding-box check), and segments that only share an endpoint (points equal within 0.1 tolerance via `arePointsEqual`) are NOT a collision.
- **R5** — The client exports `doPolylineIntersection(path1, path2, safeZone)` — it checks every segment pair of the two polylines with `doLinesIntersect`; an optional `safeZone = { x, y, radius }` ignores intersections whose point (computed by `getIntersectionPoint`, line-line algebra; parallel/collinear fallback returns `p1`) lies within `radius` of the safe-zone center.
- **R6** — When a collision is detected during a move, the client declares the player who drew the crossing line the loser and emits a `game_over` event including the reason and `lastLine` (the crossing segment).

## Architecture

### Module/package layout (tree format)

```
papa-online/
├── server/
│   └── server.js              # generateNumbers (21-40), checkOverlap (43-50);
│                              # exported for tests at 464-467
├── client/
│   ├── collision.js           # doLinesIntersect, getIntersectionPoint,
│   │                          # doPolylineIntersection, arePointsEqual — pure
│   │                          # geometry, ESM, no DOM/socket dependencies
│   ├── game.js                # Game.checkCollisions (196-218) wires collision.js
│   │                          # into canvas play; emits game_over (155-177)
│   ├── main.js                # bootstrap: canvas, socket, Game construction
│   └── index.html
└── tests/
    └── e2e/                   # Playwright flows (basic, rematch, win)
```

### Component diagram (ASCII)

```
        SERVER (server/server.js)                 CLIENT (browser)
┌─────────────────────────────────┐      ┌────────────────────────────────────┐
│ generateNumbers(count,600,800)  │      │ game.js (Game class)               │
│   └─ checkOverlap per candidate │      │  handleMouseMove / handleMouseUp   │
│ rooms[code].numbers, .lines     │      │   └─ checkCollisions(path)         │
└───────────────┬─────────────────┘      │      └─ collision.js               │
                │ numbers in game state  │        doLinesIntersect            │
                ▼                        │        doPolylineIntersection      │
        Socket.IO (game state) ─────────►│   collision? ──► socket.emit(      │
                ▲                        │                   'game_over',     │
                │    broadcast           │                   {roomCode,reason,│
                └────────────────────────┤                    lastLine})      │
                                         └────────────────────────────────────┘
```

### Data flow summary

- **Point placement** — on room creation and on rematch, the server calls `generateNumbers(pointCount, 600, 800)`; candidates are re-rolled while `checkOverlap` is true (max 100 attempts); the resulting array is stored in `rooms[code].numbers` and shipped to clients as part of the game state.
- **Draw-move collision check** — while drawing, each new pointer position more than 5 px from the previous one is appended to `currentLine`; `checkCollisions` sweeps the path against every existing line (safe zone of radius 15 around the start number) and against its own earlier segments; on a positive verdict the drawing client emits `game_over` and the server broadcasts `{reason, loser}` to the room.

## Data model

### Core Entities

```js
// server/server.js — point placed in the play area
NumberPoint {
    value: number,   // sequential, 1..count (draw order)
    x: number,       // px, [40, width-40]
    y: number        // px, [40, height-40]
}

// client/collision.js + game.js — one polyline per completed move segment
LinePath = Array<{ x: number, y: number }>   // consecutive points ≥ 5 px apart (throttle)

// safe zone passed to doPolylineIntersection
SafeZone {
    x: number,
    y: number,
    radius: number   // 15 px in game.js — centred on the current start number
}
```

Supporting entities (owned by other specs, listed for relationships only):

- `Room` — server-side in-memory object; this spec touches `room.numbers: NumberPoint[]` and `room.lines: LinePath[]` (cleared on rematch, `server/server.js:409-411`). Players, turn state, winner: see `specs/room-lifecycle.md`, `specs/turn-based-gameplay.md`.
- `PlayerSession` — UUID token identifying a player; see `specs/sessions-and-reconnection.md`. The client persists it in localStorage under `session_token`.
- Client stats accumulate under the localStorage key `papa_online_stats`.

### Relationships

- A `Room` has exactly one `NumberPoint[]` per game and a growing `LinePath[]` (one entry per accepted move).
- A `LinePath` starts at the `NumberPoint` whose `value` equals the player's `currentNumber` and ends at the next one; `checkCollisions` builds a `SafeZone` from that start number.
- `doPolylineIntersection` consumes `LinePath` pairs plus an optional `SafeZone`; `doLinesIntersect` consumes single segments; `getIntersectionPoint` is used only when a `SafeZone` is present.

### Persistence Notes

Everything server-side lives in the in-memory `rooms` object — numbers and lines are lost on server restart; there is no schema, table, or index. On the client, only the session token (`session_token`) and cumulative stats (`papa_online_stats`) persist, in localStorage.

## Workflows

### Point placement (game init and rematch)

1. Server computes `padding = 40`, inner area `w = width - 80`, `h = height - 80` (logical canvas 600×800).
2. For `i = 1..count`: draw a candidate `{value: i, x: padding + Math.random()*w, y: padding + Math.random()*h}`.
3. While `checkOverlap(candidate, placed)` is true and attempts < 100, redraw the candidate.
4. Push the candidate (even if step 3 exhausted 100 attempts — the last candidate is accepted as-is).
5. Store the array in `rooms[code].numbers` (`server/server.js:144` on creation; `:409` on rematch, keeping the same difficulty).

Failure path: a cramped board can exhaust the 100 attempts; the point is then placed possibly overlapping an existing one. This fallback is intentional but untested (see Open Questions / Risks).

### Draw-move collision check and loss

1. Player presses the mouse near the current target number; a new `currentLine` starts.
2. On each `mousemove`, if the pointer moved > 5 px from the last path point, the point is appended.
3. `checkCollisions(currentLine)` runs (`client/game.js:196-218`):
   - Build `safeZone = {x, y, radius: 15}` from the start number (null if not found).
   - Sweep the path against every `room.lines` entry via `doPolylineIntersection(path, existingPath, safeZone)`.
   - Sweep the path against itself (`doPolylineIntersection` on segment pairs with the same safe zone).
4. Happy path — no intersection: on `mouseup` snapped to the next number, the client emits `submit_move` and turn state advances (see `specs/turn-based-gameplay.md`).
5. Failure path — intersection found (`client/game.js:155-177`): the client emits
   `game_over` with `{ roomCode, reason: "Cruzó una línea", lastLine: currentLine }`
   (note: `lastLine` carries the **whole** drawn path, not just the crossing segment), shows
   "¡Cruzaste una línea! Perdiste." locally, and the server broadcasts `game_over`
   `{reason, loser}` to the room so the opponent sees the win.

## APIs

The surface is a Socket.IO event namespace (no REST). Auth: none — any connected client may emit any event (see Permissions).

| Event | Direction | Payload fields | Purpose |
|---|---|---|---|
| `game_over` | client → server | `roomCode: string`, `reason: string` (`"Cruzó una línea"` on collision), `lastLine: {x,y}[]` | Drawing client declares itself the loser after detecting a line crossing |
| `game_over` | server → clients (room broadcast) | `reason: string`, `loser: token` | Server relays the loss so both clients render the result |

Context events owned by other specs: `submit_move` (turn acceptance, `specs/turn-based-gameplay.md`), initial `game state` with `numbers` (`specs/room-lifecycle.md`).

## Client SDK Design

There is no SDK; the browser client consumes the geometry module directly.

- **Import pattern** — `game.js` does `import { doPolylineIntersection } from './collision.js'` (ESM, no bundler).
- **Initialization** — `new Game(canvas, username, roomCode, socket, token)` (`client/game.js:3`); the Game instance owns `numbers`, `lines`, `currentNumber`, and the drawing handlers.
- **Collision entry point** — `Game.checkCollisions(path)` wraps `doPolylineIntersection` with the radius-15 safe zone and the self-intersection sweep; callers are `handleMouseMove` (live check while drawing) and `handleMouseUp` (final check before `submit_move`).
- **Behavior expectations** — geometry functions are pure and synchronous (no batching, retry, or persistence); a collision verdict is acted on immediately by emitting `game_over` and locally ending the game. Segments sharing an endpoint within 0.1 are never reported; parallel/collinear lines get `p1` as the intersection point for safe-zone distance checks.

## Configuration

Environment: `PORT` — HTTP port for the Socket.IO server (server bootstrap; no other env vars affect this behaviour).

Point count is chosen at room creation from **10 / 15 / 20 / 25 / 30** and is preserved across rematches (`server/server.js:408`).

Constants:

| Constant | Value | Where | Meaning |
|---|---|---|---|
| `padding` | 40 px | `server/server.js:23` | Generation margin on every side of the 600×800 logical canvas |
| `minDist` | 40 units | `server/server.js:44` | Strict minimum distance between placed points (`< 40` overlaps) |
| retry cap | 100 attempts | `server/server.js:37` | Max re-rolls per point before accepting the last candidate |
| collinear threshold | 0.001 | `client/collision.js:5` | `getOrientation` returns 0 (collinear) below this cross-product magnitude |
| shared-endpoint tolerance | 0.1 | `client/collision.js:36` | `arePointsEqual` — equal x and y within 0.1 → segments "share" the point |
| parallel determinant threshold | 0.001 | `client/collision.js:52` | Below this, `getIntersectionPoint` falls back to `p1` |
| safe-zone radius | 15 px | `client/game.js:199` | Intersections within 15 px of the start number are ignored |
| move-point throttle | 5 px | `client/game.js:151` | Minimum pointer travel before a new path point is recorded |

## Permissions

Trust model: any connected client may emit any Socket.IO event, and tokens are unvalidated identity, not auth. The collision verdict and the `game_over` claim both come from the emitting client; the server performs no geometric or turn validation on them (see Security Considerations).

## Security Considerations

- **Sensitive data handling** — none: payloads are coordinates, room codes, and reason strings.
- **Client-authoritative verdicts** — the server trusts the client's `game_over` emission wholesale: a malicious client can emit `game_over` with a fabricated `reason`/`lastLine` (or for a room it is not losing in) and force a result; `lastLine` geometry is never re-checked server-side.
- **Validation rules** — none on this surface today. Hardening (server-side line-crossing recomputation, emission authorization) is explicitly out of scope for this spec.

## Dependencies

| Dependency | Role | Rationale |
|---|---|---|
| `socket.io` (server) | Event transport for `game_over` broadcast | Already the project's transport |
| Native Canvas API (client) | Pointer input and rendering around the collision check | No framework in use |
| — | Geometry | Hand-rolled orientation/line algebra in `collision.js`; no geometry library |

Test tooling: Jest (server unit tests, CJS) and Playwright (e2e). `client/collision.js` is an ESM module, so Jest-based tests for it require a harness decision (see Open Questions / Risks).

## Open Questions / Risks

Untested behaviour, carried over from the original acceptance criteria (old AC4–AC7) and unchecked tasks (old tasks 1–4):

- **`doLinesIntersect` segment cases are untested** — crossing (`o1 !== o2 && o3 !== o4`), collinear-touch special cases (`orientation 0` + `onSegment`), and the shared-endpoint exclusion within 0.1 tolerance have no dedicated test. Note: `client/collision.js` is ESM while the server Jest harness runs CJS — a harness decision (ESM-aware Jest config or a parallel runner) is a prerequisite for these tests.
- **`doPolylineIntersection` safe-zone behaviour is untested** — an intersection inside the safe-zone radius being ignored while one outside is reported (including the `getIntersectionPoint` parallel/collinear fallback returning `p1`) has no dedicated test.
- **`generateNumbers` retry-cap fallback is untested** — the after-100-attempts acceptance of a possibly overlapping candidate is not covered by any test.
- **Collision → `game_over` emission is untested in isolation** — no test asserts the `{roomCode, reason: "Cruzó una línea", lastLine}` emission from a real crossing. The e2e win flows exercise `game_over` end-to-end but their losses are produced by invalid moves, not by drawing a crossing line, so the collision path itself is never asserted.

## Verifications

- `generateNumbers(20, 600, 800)` returns exactly 20 points with sequential values 1..20, all inside the 40 px padding — PASS: `generateNumbers should create correct number of points` (`server/server.test.js`).
- `checkOverlap` reports an overlap at distance ≈ 14.1, none at ≈ 141, and none at exactly 40 (strict less-than) — PASS: `checkOverlap should detect close points` (`server/server.test.js`).
- The full regression harness is green: server suite (14 tests) plus Playwright e2e (4 tests) via `npm run verify` — PASS: `Player 2 Wins (Player 1 crashes)` and `Player 1 Wins (Player 2 crashes)` (`tests/e2e/win.spec.js`), `Player 1 creates room and Player 2 joins` (`tests/e2e/basic.spec.js`), `Full Rematch Flow (Request -> Accept -> New Game)` (`tests/e2e/rematch.spec.js`).

## Appendices

### Compatibility notes

- `client/collision.js` is ESM (`export function`); the server Jest harness is CJS — any future unit tests for the geometry must resolve this mismatch first.
- `lastLine` in the `game_over` payload is the full drawn path; consumers must not assume it is a single segment.

### Future considerations

- Server-side recomputation of crossings to close the client-trust gap.
- Dedicated geometry tests (segment cases, safe zone, retry cap) once the ESM/Jest harness question is settled.
- An explicit integration/e2e assertion that a drawn crossing emits `game_over` with the documented reason and `lastLine`.
