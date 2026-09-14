# AGENTS.md

Guidance for AI agents (and humans) working in this repo.

## Workflow (mandatory)

For any change beyond a one-line fix or dependency bump:

1. Create `specs/<change-name>/` from `specs/_TEMPLATE/` and write `spec.md`.
2. Do not write implementation code until `spec.md` exists.
3. Derive `tasks.md` from the spec — no tasks without a matching requirement.
4. The first implementation task is always writing the failing tests for each
   acceptance criterion.
5. A change is done when `npm run verify` is green and every acceptance
   criterion lists a passing test.

See `specs/README.md` for the full workflow.

## Commands

- `npm run verify:server` — Jest unit + integration tests (fast, ~seconds).
- `npm run verify` — server tests + Playwright e2e; boots the server itself.
- `cd server && npm test -- --watch` — watch mode for iteration.

Node deps are two-level: root `package.json` (e2e/lsp tooling) and
`server/package.json` (runtime + jest).

## Test placement

- Server logic → `server/*.test.js` (unit, pure functions) or
  `server/*.integration.test.js` (Socket.IO, real server bootstrap — follow
  existing `server.integration.test.js` patterns).
- User-visible flows → `tests/e2e/*.spec.js` (Playwright; helpers in
  `tests/e2e/utils.js`; `playwright.config.js` auto-starts the server on :3000).

## Hooks

lefthook runs related Jest tests on commit and the full server suite on push.
Hooks are a gate, not the harness: run `npm run verify` before declaring work
done.

## Repo facts

- Vanilla JS: no build step, no linter/formatter — don't introduce one
  unprompted.
- Docs `README.md`/`TESTING.md` are Spanish; AI-workflow docs (this file,
  `specs/`) are English.
- Deployment via Docker — see `DEPLOYMENT.md`.
