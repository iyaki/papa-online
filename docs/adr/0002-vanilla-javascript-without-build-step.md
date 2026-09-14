# 2. Vanilla JavaScript without a build step

Date: 2026-09-14

## Status

Accepted

## Context

The client is a two-player DOM/canvas game (rooms, drawing lines, collision
feedback). Options ranged from a framework with a bundler to plain files
served statically.

## Decision

The client stays vanilla HTML/CSS/JS with no build step, no bundler, no
framework. TypeScript exists in root devDependencies only as
`typescript-language-server` tooling for editors/agents — it never compiles
anything.

## Consequences

- No client dependency tree, no build pipeline to maintain or break in CI.
- All shared client code must be loaded via `<script>` tags or ES modules
  as-is.
- No type checking on client code; correctness relies on tests and review.
- Repo convention: do not introduce a bundler, framework, or
  linter/formatter unprompted (see AGENTS.md).
