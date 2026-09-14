# 9. Application language is Spanish

Date: 2026-09-14

## Status

Accepted

## Context

The application has been in Spanish since the first commit: UI strings,
alerts, the FAQ, `lang="es"` and `og:locale es_AR` in `client/index.html`.
The audience is Spanish-speaking (the project credits an Argentine idea and
author). Repository documentation was historically written in Spanish and has
since been unified in English.

But nothing documented the app-language rule. A docs-language convention alone
does not cover user-facing strings, which made it easy for a contributor or an
agent to assume the app should simply follow whatever the docs use — or to
introduce English UI text in a PR without anyone pointing at a written
decision.

## Decision

The player-facing application language is **Spanish**.

- All user-visible strings are written in Spanish: UI labels, placeholders,
  alerts and confirms, socket-driven notifications, the FAQ, the exported
  souvenir image text, and error messages.
- `client/index.html` keeps `lang="es"`; new screens and metadata inherit it.
- Code identifiers, code comments, commit messages, and all repository
  documentation (README, TESTING, DEPLOYMENT, AGENTS.md, `specs/`, `docs/`)
  are written in English. Documentation quotes on-screen labels verbatim in
  Spanish when describing the UI.
- No i18n framework: one hardcoded language. Introducing localization would
  need a new ADR superseding this one.

## Consequences

- New UI strings must be Spanish; PR review and agent work have a citable
  ADR to check against instead of vibes.
- English prose may still appear in code comments and docs without violating
  this decision — the boundary is *user-visible strings*, not the codebase.
- If the game ever needs a second language, this ADR is superseded, not
  edited (per ADR 0001).
