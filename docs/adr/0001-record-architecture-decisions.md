# 1. Record architecture decisions

Date: 2026-09-14

## Status

Accepted

## Context

Architecture decisions made in conversations or PR reviews are easy to lose:
six months later nobody remembers why the project avoids a build step, or why
e2e tests don't run in the pre-push hook. Specs (`specs/`) record what changed
and why per change, but architecture decisions cut across changes and need a
stable, numbered home.

## Decision

We record architecture decisions as lightweight ADRs (Nygard format) in
`docs/adr/`, numbered sequentially (`0001-...`, `0002-...`).

- An ADR is immutable once accepted: to change a decision, write a new ADR
  that supersedes the old one and mark the old one "Superseded by N".
- ADRs document *why*, specs document *what changed*. A spec may reference an
  ADR, never duplicate it.

## Consequences

- New significant architectural choices require a new numbered ADR in the
  same PR.
- Decision history is greppable and agent-readable; no tooling required.
