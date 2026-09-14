# 7. spec-creator skill for spec authoring

Date: 2026-09-14

## Status

Accepted — supersedes the spec-authoring mechanics of ADR 0006 (the SDD
process itself stands).

## Context

ADR 0006 adopted a hand-rolled template (`specs/_TEMPLATE/` with
Problem/Requirements/Acceptance-criteria plus a derived `tasks.md`). The
owner then adopted the `spec-creator` skill from
[iyaki/specralph](https://github.com/iyaki/specralph) as the standard,
distributed through Vercel's skills CLI (`npx skills add`), which provides a
richer engineering-grade spec structure (architecture, data model,
workflows, verifications) and a versioned installation instead of
copy-paste templates.

## Decision

- Specs are authored via the `spec-creator` skill; structure follows
  `.agents/skills/spec-creator/SPEC_TEMPLATE.md`, with an explicit
  `Verifications` section mapped to named tests.
- `specs/_TEMPLATE/` is removed; `tasks.md` is no longer part of the model.
  Implementation sequencing lives in the spec's workflows or, when running
  the ralph loop, in a generated `IMPLEMENTATION_PLAN.md`.
- The skill version is pinned in `skills-lock.json`; refresh with
  `npx skills update`.
- Test-first implementation and the `npm run verify` green gate from
  ADR 0006 are unchanged.
- The six retrospective feature specs keep their original format; only new
  specs use the spec-creator structure.

## Consequences

- Specs are distribution-managed like a dependency (lockfile-pinned) rather
  than living as in-repo templates.
- Reviewers get a fuller structure (architecture, data models, security) per
  change; cost is a heavier document for small changes — acceptable, since
  one-line fixes and dependency bumps remain exempt.
