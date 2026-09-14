# 8. Biome for lint and format

Date: 2026-09-14

## Status

Accepted

## Context

The repo had no linter or formatter; style drifted file by file and a
duplicate class member (`startGame` defined twice in `client/game.js`) sat
undetected in shipped code. A pre-commit gate existed (ADR 0005/0006) but
only ran related Jest tests.

## Decision

Adopt [Biome](https://biomejs.dev/) as the single lint + format tool,
installed as a root devDependency (tooling lives at the root level, per
ADR 0004):

- Config in `biome.json`: 4-space indent, single quotes, recommended rule
  set (errors block; warnings do not).
- Pre-commit hook runs `biome check --write` on staged JS/JSON/CSS/HTML files
  and re-stages the fixed result (lefthook `stage_fixed: true`).
- Intentional patterns are suppressed inline (`biome-ignore`) with the
  reason, e.g. the `vh` → `dvh` progressive-enhancement duplicates in
  `client/style.css` — not by disabling rules globally.
- `npm run lint` / `npm run lint:fix` wrap it for manual runs.
- Lockfiles are excluded from formatting.

## Consequences

- Bugs like duplicate class members, unused variables, and accidental type
  coercion (`==`) are caught at commit time.
- Formatting is deterministic; diffs stop carrying style noise. The initial
  formatting pass was a dedicated commit.
- Biome does not type-check; `// @ts-check` remains an optional future
  hardening (ADR 0002 keeps "no build step" intact — Biome never compiles).
