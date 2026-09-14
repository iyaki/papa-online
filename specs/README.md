# Specs

Spec-driven development (SDD) for papa-online. Every change beyond a one-line
fix or dependency bump starts here, as a spec, before any implementation code.

## Workflow

Specs are authored with the `spec-creator` skill from
[iyaki/specralph](https://github.com/iyaki/specralph), installed with Vercel's
skills CLI (see `skills-lock.json`; refresh with `npx skills update`). The
skill lives at `.agents/skills/spec-creator/`, symlinked into `.omp/skills/`
and `.claude/skills/` for agent discovery.

1. Author `specs/<change-name>/spec.md` by invoking the `spec-creator` skill
   and following `.agents/skills/spec-creator/SPEC_TEMPLATE.md`: Overview
   (purpose, goals, non-goals, scope), architecture, data model, workflows,
   and an explicit `Verifications` section whose items map to named tests.
2. Set `Status: Proposed` and get the spec approved before implementing.
3. Implement test-first: the failing tests for the spec's Verifications are
   written before the implementation code.
4. Flip `Status: Implemented` when `npm run verify` is green and every
   Verifications item lists a passing test.
5. If scope shifts mid-change, update the spec first — the spec is the source
   of truth until the change is merged.

## Feature specs

Backfilled specs documenting existing behaviour (retrospective; written in
the pre-specralph format, kept as-is; `[ ]` tasks there are real coverage
gaps, not pending work):

- `sessions-and-reconnection/` — token identity, player sessions, my-games list, reconnect re-attachment
- `room-lifecycle/` — create/join/rejoin, point counts, surrender, empty-room and inactivity cleanup
- `turn-based-gameplay/` — submit_move gating, move_made, game_sync, client drawing
- `overlap-detection/` — number placement, line-crossing geometry, collision
- `game-end/` — game_over, winner/loser, local stats, disconnect semantics
- `rematch/` — request/accept/reject, game restart, lobby status

When a new spec is complete, add it to this list (the `spec-creator` skill
requires this too).

## Lifecycle

Specs live in git alongside the change and are kept after merge as the
per-change record of what was done and which tests prove it.

Architecture-level decisions (frameworks, structure, process) are recorded
separately as ADRs in `docs/adr/` — a spec says what changed, an ADR says why
the codebase is shaped the way it is.
