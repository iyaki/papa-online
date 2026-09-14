# 6. Spec-driven development workflow with lefthook gates

Date: 2026-09-14

## Status

Accepted

## Context

The repo is developed with AI agents (omp and others) alongside humans.
Without a formal process, agents jumped straight to code, tests came as an
afterthought, and "done" had no shared definition. Existing tooling
(lefthook 2.1.14) was installed but configured with only the commented
example template.

## Decision

Adopt a lightweight, hand-rolled spec-driven development (SDD) workflow — no
spec-kit or other dependency:

- Every change beyond a one-line fix or dependency bump starts as a spec in
  `specs/<change-name>/` (copied from `specs/_TEMPLATE/`), with numbered
  requirements and acceptance criteria mapped to named tests, before any
  implementation code.
- `tasks.md` is derived from the spec; the first implementation task is
  always the failing tests for each acceptance criterion.
- A change is done when `npm run verify` is green and every acceptance
  criterion lists a passing test.
- Specs live in git and are kept after merge as the per-change record;
  architecture-level decisions go to `docs/adr/` instead.
- Agent-facing docs (AGENTS.md, `specs/`) are English; user-facing docs
  (README.md, TESTING.md) stay Spanish.
- lefthook enforces the test gates described in ADR 0005.

## Consequences

- Agents and humans share one entry point: AGENTS.md.
- Slightly more ceremony per change; explicitly exempted for one-liners and
  dependency bumps to keep the tax low.
- Spec quality becomes the quality bar — templates in `specs/_TEMPLATE/`
  keep specs testable instead of prosy.
