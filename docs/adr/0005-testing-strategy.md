# 5. Testing strategy and harness

Date: 2026-09-14

## Status

Accepted

## Context

Tests must run fast locally, gate commits without flaky slowness, and still
catch real user-flow regressions. Environment cost differs sharply per layer:
Jest needs Node only, Playwright needs browser binaries plus system libraries
(the devcontainer needed `npx playwright install chromium` and
`npx playwright install-deps chromium`).

## Decision

Three layers, each with a defined trigger:

- Unit tests (`server/*.test.js`, pure functions) and integration tests
  (`server/*.integration.test.js`, real Socket.IO server bootstrap) run via
  `cd server && npm test`.
- Hooks (lefthook): pre-commit runs `jest --findRelatedTests` on staged
  `server/*.js`; pre-push runs the full server suite — only when pushed
  commits touch `server/` (lefthook `root:` scopes file matching).
- Playwright e2e (`tests/e2e/*.spec.js`) runs in CI only, never in hooks.
- `npm run verify` (root) is the single "everything green" harness: server
  suites then e2e (Playwright's webServer boots the app itself).

## Consequences

- Commits get fast, relevant feedback; pushes get full server coverage;
  slow browser-dependent tests stay out of the hot path.
- Hooks are a gate, not the harness: `npm run verify` must pass before
  declaring work done.
- Integration tests use real sockets and real timing — test callbacks must be
  idempotent (see the `my_games_list` double-emission flake fixed in
  `cd458b2`).
