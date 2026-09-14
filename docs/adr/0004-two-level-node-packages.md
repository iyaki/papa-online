# 4. Two-level Node packages

Date: 2026-09-14

## Status

Accepted

## Context

Tooling has different lifecycles: the server runtime (Express, Socket.IO,
Jest) changes with the app, while root tooling (Playwright e2e, LSP servers)
changes with the development environment. A single package.json would couple
CI installs for server-only jobs to heavy browser tooling.

## Decision

Keep two independent packages:

- Root `package.json` — e2e and agent tooling (`@playwright/test`,
  `typescript-language-server`).
- `server/package.json` — runtime and Jest; the only one CI's `npm ci` and
  the Docker image need.

## Consequences

- Server CI and Docker builds stay small and fast (`cd server && npm ci`).
- Two installs are required for a fully working dev environment; scripts like
  `npm run verify` chain both.
- Root tooling changes never touch `server/package-lock.json` and vice versa.
