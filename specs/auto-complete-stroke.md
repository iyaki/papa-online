# Stroke Auto-Complete on Reaching the Target Number

Status: Implemented

## Overview

### Purpose

While drawing a stroke, a player who "overshoots" the target number — the mouse
keeps moving after the stroke head passes over number `currentNumber + 1` —
loses the whole stroke on release, because `handleMouseUp` only accepts a
release within the 20 px snap radius
([iyaki/papa-online#15](https://github.com/iyaki/papa-online/issues/15)). The
player must release with surgical precision. This change makes the stroke end
by itself: the moment the stroke head reaches the target number, the move is
completed and submitted automatically, exactly as if the player had released
on the number.

### Goals

- A stroke that touches the target number is completed and submitted without
  requiring the pointer button/finger to be released.
- Auto-completion applies the same rules as a release on the number: endpoint
  snaps to the number's center, final collision check runs, and the move is
  either submitted or the player loses with "Cruzó una línea".
- Input events that arrive after auto-completion (further movement, the
  eventual release) are inert.
- Releasing before ever reaching the target number still discards the stroke
  (unchanged behaviour).
- Mouse and touch share the behaviour (both route through the same handlers).

### Non-Goals

- Server-side validation of `submit_move` geometry or `game_over` claims —
  covered by the turn-based-gameplay and game-end specs.
- Collision geometry itself (`client/collision.js`) — covered by
  `overlap-detection.md`.
- Any visual change to the snap radius, safe zone, or stroke rendering.
- Completion of the game when the *last* number is connected (still just an
  accepted move; there is no completion win).

### Scope

Included: `client/game.js` stroke-extension logic (`handleMouseMove`), the
extracted stroke-completion routine shared by `handleMouseUp` and
`handleMouseMove`, and Playwright e2e coverage. Excluded: everything listed
under Non-Goals; no server changes.

## Architecture

### Module/package layout (tree format)

```
papa-online/
├── client/
│   └── game.js            # handleMouseMove: auto-complete check on each new
│                          # point; finishStroke(): shared completion routine
│                          # (snap + final check + submit), also used by
│                          # handleMouseUp
└── tests/e2e/
    └── auto-complete.spec.js   # overshoot auto-completes; stop-short discards
```

### Component diagram (ASCII)

```
   pointer / touch
        │  mousedown on start number → currentLine = [start]
        ▼
 handleMouseMove (per new point, dist > 5 px)
        │
        ├─ checkCollisions hit ──────────────► game_over (unchanged)
        │
        ├─ head within 20 px of number        ← NEW
        │   currentNumber + 1
        │        │
        │        ▼
        │   finishStroke(): snap endpoint to target center → final
        │   checkCollisions → submit_move | game_over; currentLine = null;
        │   isMyTurn = false; redraw
        │
        └─ otherwise → draw() preview (unchanged)

 handleMouseUp
        ├─ head within 20 px of target → finishStroke()   (delegates, unchanged
        │                                                  observable behaviour)
        └─ otherwise → discard stroke (unchanged)

 events after finishStroke(): handleMouseMove/handleMouseUp early-return
 (currentLine is null)
```

### Data flow summary

Identical to a release-on-target move (turn-based-gameplay spec W1): the
client emits `submit_move { roomCode, line }`, the server accepts it on the
turn gate, increments `currentNumber`, switches `currentTurn`, and broadcasts
`move_made`. Auto-completion only changes *when* the client emits
`submit_move` — on reaching the target instead of on release.

## Data model

### Core Entities

No new entities. Reuses the turn-based-gameplay spec's entities (`Room`,
`Number`, `Line`) and `Game` client mirror (`currentLine`, `isMyTurn`,
`currentNumber`) verbatim; that spec remains the source of truth.

### Relationships

- The auto-complete check consumes the same 20 px snap radius (`isNear`) as
  stroke start and stroke end; it introduces no new tunable.
- The submitted `Line` is byte-identical in shape to a release-on-target
  line: freehand points plus the final snapped point at the target center.

### Persistence Notes

None — client-side behaviour only; all state remains in-memory server-side
and in `localStorage` client-side, as documented in the turn-based-gameplay
spec.

## Workflows

### W1 — Auto-complete on reaching the target (new happy path)

1. The player whose turn it is starts a stroke on number `currentNumber`
   (`handleMouseDown`, 20 px snap) — unchanged.
2. The player drags; each new point (> 5 px from the previous) is appended and
   `checkCollisions` runs — unchanged. On a hit, `game_over` is emitted
   (unchanged).
3. **NEW**: after a clean collision check, if the head is within 20 px of
   number `currentNumber + 1`, the client runs `finishStroke()`:
   - appends the snapped endpoint `{ x: target.x, y: target.y }`,
   - runs the final `checkCollisions`;
     - hit → emits `game_over { roomCode, reason: "Cruzó una línea",
       lastLine }` and marks the player lost locally (identical to the
       release-on-target crash path),
     - clean → emits `submit_move { roomCode, line }`, sets
       `currentLine = null`, `isMyTurn = false`, redraws.
4. Subsequent `mousemove`/`touchmove` and the eventual `mouseup`/`touchend`
   early-return (`currentLine` is `null`). The `move_made` broadcast then
   applies the move on all clients as in W1 of the turn-based-gameplay spec.

### W2 — Release before reaching the target (unchanged failure path)

The stroke head never gets within 20 px of number `currentNumber + 1`. On
release, `handleMouseUp` finds the head away from the target and discards the
stroke (`currentLine = null`, redraw, nothing emitted). This is the pre-change
behaviour for the non-overshoot case and it is preserved.

### W3 — Overshoot that misses the 20 px window (boundary)

If a single movement step jumps from > 20 px of the target to past it without
any intermediate event landing inside the 20 px radius, the stroke is *not*
auto-completed; it remains in progress and W2 applies on release. Real
pointer input produces many intermediate events, so this is a geometric edge,
not a UX case; it is documented, not specially handled.

## APIs

No changes. The client emits the existing `submit_move` and `game_over`
events (payloads per turn-based-gameplay / game-end specs); no new socket
events, no HTTP endpoints.

## Client SDK Design

No public API change. Internals:

- `finishStroke()` — new private method on `Game`; the single place that
  snaps the endpoint to the target center, runs the final collision check,
  and emits `submit_move` or `game_over`. Called from `handleMouseUp` (when
  the release is near the target) and from `handleMouseMove` (when the newly
  tracked head reaches the target).
- `handleMouseMove` — after appending a point and a clean `checkCollisions`,
  checks `isNear(pos, nextNumber)` and calls `finishStroke()` when true.
- `handleMouseUp` — keeps its near-target guard and delegates to
  `finishStroke()`; its discard branch is unchanged.

Behaviour expectations: fire-and-forget emit, optimistic `isMyTurn = false`,
no retry — same as today.

## Configuration

No new settings. The auto-complete window reuses the existing 20 px snap
radius (`isNear`) documented in the turn-based-gameplay spec's Configuration
table.

## Permissions

Unchanged: only the client holding the turn can start a stroke
(`handleMouseDown` guard), so only it can auto-complete and emit
`submit_move`; the server's `currentTurn` gate remains the sole
authorisation.

## Security Considerations

No change to the trust model: `submit_move` content stays client-validated
only, and a modified client can still emit arbitrary events (see
turn-based-gameplay spec). Auto-completion adds no new attack surface — it
emits the same events from the same trust boundary.

## Dependencies

None added. Canvas 2D and pointer/touch events remain platform APIs.

## Open Questions / Risks

- **Premature completion on grazed numbers**: a player steering a line that
  merely brushes past the target number (within 20 px) now has the stroke
  committed where they previously could have continued and released later —
  but continuing past the target always discarded the stroke before, so no
  previously-possible valid move is removed. Accepted as the intended
  trade-off of the requested behaviour.
- **Event starvation on jump inputs**: synthetic or low-rate input that skips
  over the 20 px window never auto-completes (W3); documented boundary.
- **Crash on the snap segment**: the final snapped endpoint can in principle
  create a last-segment crossing detected only by `finishStroke`'s final
  check → `game_over`. Same as the existing release-on-target path;
  untested (random boards make it impractical to force deterministically).

## Verifications

- Overshooting the target number mid-drag completes the move: P1 drags from
  number 1 through number 2 and past it (> 20 px) before releasing; the move
  is submitted and the turn swaps (`opponent-turn` on P1, `my-turn` on P2)
  with no game-over message — `overshooting the target number auto-completes the stroke`
  (`tests/e2e/auto-complete.spec.js`)
- Releasing short of the target number still discards the stroke and keeps
  the turn: P1 drags from 1 toward 2 but stops 40 px short, releases; turn
  stays on P1 and no move is broadcast —
  `releasing short of the target still discards the stroke`
  (`tests/e2e/auto-complete.spec.js`)
- Existing release-on-target and crash flows keep passing —
  `Player 1 Wins (Player 2 crashes)` and
  `Player 2 Wins (Player 1 crashes)` (`tests/e2e/win.spec.js`)
- Full suite green: `npm run verify` (server Jest + Playwright e2e).

## Appendices

### Compatibility notes

- The submitted line for an auto-completed move is indistinguishable from a
  release-on-target line; the server and the receiving client need no
  changes.
- Touch input inherits the behaviour through the shared `handleMouseMove` /
  `handleMouseUp` handlers.

### Future considerations

- If players find the 20 px auto-complete window too eager on small boards,
  a dedicated (smaller) auto-complete radius would be the one-line tuning
  knob; not needed until reported.
