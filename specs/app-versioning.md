# Spec: App Versioning (deploy identity and versioned assets behind Cloudflare)

Status: Proposed

## Overview

### Purpose

Today there is no way to tell which build of the application is running, nor
to make a deployment deterministically reach clients:

- The server serves `client/` through `express.static` with default options:
  responses carry `ETag`/`Last-Modified` but **no `Cache-Control`**, so
  browsers apply heuristic caching and may run stale JS/CSS after a deploy.
- In production the app sits behind **Cloudflare** (proxy for
  `papa.iyaki.ar`). Cloudflare edge-caches by file extension (`js`, `css`,
  `png`, …) using its own TTL rules, independent of the browser. With stable
  asset URLs, a deploy cannot invalidate Cloudflare's edge cache: players
  keep receiving old assets until the edge TTL lapses or someone purges
  manually.
- `server/package.json` says `1.0.0` and is never bumped; the container
  healthcheck proves responsiveness, not *what* is served.

Jobs to be done:

1. As the operator, after deploying I want to verify the new revision is live
   (from a terminal, without opening the UI).
2. As a player (or someone helping them), I want to see which version the app
   is running, to report or diagnose issues.
3. As the operator, I want every deployment to reach all clients on their
   next page load **without manual Cloudflare purges, deploy scripts with
   Cloudflare credentials, or extra dashboard configuration** — and to keep
   Cloudflare's edge caching benefits between deploys.

### Goals

- Every deployment has a visible identity: the short git SHA of the built
  revision, plus the image build timestamp.
- `GET /api/version` returns that identity as JSON.
- The lobby shows the version (Spanish UI per ADR 0009): `Versión: a1b2c3d`.
- Asset URLs change on every deploy (`/v/<version>/…`), which makes them
  cache-agnostic: browsers, Cloudflare's edge, or no cache at all all behave
  correctly with the same origin headers. No cache-invalidation step exists
  anywhere in the deploy flow.
- Local dev and test runs work with zero configuration (`version: "dev"`).

### Non-Goals

- **No semantic versioning**: `package.json` version stays as-is; manual
  bumps would rot. The git SHA is the deployment identity.
- **No asset fingerprinting via filenames or build step** (ADR 0002): the
  version prefix achieves the same cache-busting effect at serve time with
  zero build tooling.
- **No Cloudflare API integration** (purge-on-deploy): rejected — see
  Architecture rationale.
- **No auto-reload / "new version available" prompt**: tabs left open across
  a deploy keep running the old version until their next reload. Upgrade path
  in Appendices.
- **No service worker / offline cache**: none exists today.

### Scope

- `server/server.js`: `getVersionInfo` helper, `GET /api/version` route,
  `GET /` route serving `index.html` with `__APP_VERSION__` substituted, a
  version-prefixed static mount `/v/:version`, and `no-cache` on the
  remaining root static.
- `client/index.html`: `__APP_VERSION__` placeholders in the `style.css` and
  `main.js` references, and a `Versión: __APP_VERSION__` line in the lobby
  footer. **No client JS changes** — the module graph is relative
  (`main.js` → `./game.js` → `./collision.js`), so versioning `main.js`'s URL
  versions the whole graph.
- `Dockerfile`: `ARG`/`ENV` pair baking `APP_VERSION` and `APP_BUILT_AT`.
- `scripts/build-push.sh`: passes both build args from git.
- `docker-compose.yml`: passes both build args (default `dev`).
- `DEPLOYMENT.md`: version-aware build commands, "verify the deployed
  version" step, and a Cloudflare section (default caching behaviour, what to
  check with `cf-cache-status`, the `/api/*` cache-rule caveat).

## Architecture

### Module/package layout (tree format)

```
server/
  server.js                  # getVersionInfo, GET /api/version, GET / (HTML),
                             # /v/:version static (immutable), root static (no-cache)
  server.test.js             # unit tests for getVersionInfo
  server.integration.test.js # HTML render, versioned assets, headers, /api/version
client/
  index.html                 # __APP_VERSION__ placeholders (css, js, lobby line)
Dockerfile                   # ARG/ENV APP_VERSION, APP_BUILT_AT
scripts/build-push.sh        # --build-arg from git rev-parse + date
docker-compose.yml           # build.args passthrough
DEPLOYMENT.md                # runbook + Cloudflare notes
```

### Component diagram (ASCII)

```
Build time                            Runtime
──────────                            ────────
git rev-parse --short HEAD ─┐         Browser                    Cloudflare edge        Origin (Node)
date -u (ISO-8601)        ─┤            │ GET / (HTML) ──── not cached by default ──────► render index.html,
                           ▼            │                                  ◄────────────── /v/<sha>/… refs
docker build --build-arg   │            │ GET /v/<sha>/main.js ── cache HIT ────────────────► (only first time)
      │                    │            │ GET /api/version ────── not cached by default ───► {"version":"<sha>",...}
      ▼                    │            ▼
Dockerfile ARG → ENV ──────┘        "Versión: <sha>" (server-rendered, no fetch)
      │
      ▼
node server/server.js
```

### Data flow summary

1. At image build, the short SHA and UTC build time become environment
   variables of the final image.
2. `GET /` reads `index.html`, substitutes every `__APP_VERSION__`, and
   serves it with `Cache-Control: no-cache`. HTML is extensionless, so
   Cloudflare does not cache it by default — every page load sees current
   URLs and current version text.
3. Versioned assets under `/v/<version>/` are served with
   `Cache-Control: public, max-age=31536000, immutable`: Cloudflare
   edge-caches them and browsers cache them, keyed by a URL that never
   repeats across deploys. Content is immutable per URL, so long TTLs are
   safe and no invalidation is ever needed.
4. `GET /api/version` (extensionless → origin-served) reports the live
   identity for operator checks.

## Data model

### Core Entities

**VersionInfo** (derived, never persisted):

| Field | Type | Source | Notes |
|---|---|---|---|
| `version` | `string` | `APP_VERSION` env | Short git SHA (e.g. `a1b2c3d`); `"dev"` when unset |
| `builtAt` | `string \| null` | `APP_BUILT_AT` env | UTC ISO-8601 build timestamp; `null` when unset |

### Relationships

- VersionInfo is a property of a *deployment*, not of game state; no entity in
  `specs/room-lifecycle.md` or `specs/sessions-and-reconnection.md` references
  it.
- The URL segment `/v/<version>/` is the same value surfaced by
  `/api/version` and the lobby line — one identity, three projections.
- No client-side persistence (not in `localStorage` alongside
  `session_token` / `papa_online_stats`).

### Persistence Notes

- None. Values live in image environment variables; nothing touches the
  in-memory rooms, sessions, or any database.

## Workflows

### Build and deploy (happy path)

1. GHCR path: `scripts/build-push.sh` runs
   `docker build --build-arg APP_VERSION=$(git rev-parse --short HEAD)
   --build-arg APP_BUILT_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ) ... --push`.
2. VPS path: after `git pull origin main`, the runbook command is
   `APP_VERSION=$(git rev-parse --short HEAD) docker-compose up -d --build`;
   compose forwards it as a build arg (default `dev` when omitted).
3. Dockerfile: `ARG APP_VERSION=dev` / `ARG APP_BUILT_AT=` declared *after*
   the `COPY` layers (dependency layers stay cached) and exported with `ENV`.
4. No Cloudflare purge, no cache invalidation step — none is needed.
5. Operator verifies: `curl https://papa.iyaki.ar/api/version` → SHA matches
   the deployed revision.

### Page load with a fresh deployment (behind Cloudflare)

1. Browser requests `/`; Cloudflare passes it to origin (HTML not cached by
   default); origin returns the substituted HTML (`no-cache`) referencing
   `/v/<new-sha>/…`.
2. Browser requests `/v/<new-sha>/main.js`, `/v/<new-sha>/style.css`:
   URL unseen before → browser miss → Cloudflare miss → origin serves with
   `immutable` → Cloudflare caches at edge, browser caches locally.
3. `game.js`/`collision.js` resolve relative to `main.js`'s URL
   (`/v/<new-sha>/…`) and are cached the same way. No client code changed.
4. The lobby line already contains the version (server-rendered).
5. Repeat loads: edge/browser hits; origin sees HTML + `/api/version` only.

### Failure / edge paths

- **Env unset** (local `node server/server.js`, tests, compose build without
  args): version is `dev`; HTML references `/v/dev/…`; everything works.
- **Old cached HTML after a deploy**: an already-loaded page or heuristic
  cached HTML requests `/main.js` at the root — the root static still serves
  it (`no-cache`), so stale HTML degrades gracefully; next load migrates to
  versioned URLs.
- **Fetch of unknown file under `/v/<version>/`**: 404, same as root static.
- **Dirty working tree at build time**: the SHA truthfully identifies the
  *commit* built; uncommitted changes are not reflected (noted in Risks).
- **Docker layer cache**: `ARG`/`ENV` declared after `COPY` never invalidate
  dependency layers; builds stay fast, the identity still lands in the image
  config.

## APIs

Base path: same origin as the app. No auth exists anywhere in this app; both
routes are equally public.

| Method | Path | Purpose | Response |
|---|---|---|---|
| `GET` | `/api/version` | Deployment identity | `200` `{"version": "a1b2c3d", "builtAt": "2026-09-14T21:05:00Z"}` |
| `GET` | `/v/:version/<asset>` | Versioned static assets | `200` asset with immutable caching; `404` unknown asset |

Errors: none defined — handlers read env vars / static files only.

Socket.IO surface: unchanged. `/socket.io/socket.io.js` stays owned by
socket.io with its own headers (see Risks).

## Client SDK Design

No client JavaScript changes. The client's only awareness of versioning is
that `index.html` references `__APP_VERSION__`-prefixed URLs, resolved at
serve time:

```html
<link rel="stylesheet" href="/v/__APP_VERSION__/style.css">
...
<p id="app-version" style="font-size: 0.75rem; color: #777;">Versión: __APP_VERSION__</p>
...
<script type="module" src="/v/__APP_VERSION__/main.js"></script>
```

The lobby version line is server-rendered — no fetch, no race, no client
state. The relative ES-module imports inside `main.js` continue to work
unchanged because the browser resolves them against the versioned URL.

## Configuration

| Setting | Values / Default | Where set |
|---|---|---|
| `APP_VERSION` | short git SHA / `dev` | Docker build arg → `ENV`; compose `build.args`; unset in local dev/tests |
| `APP_BUILT_AT` | UTC ISO-8601 build time / `null` | same channel as `APP_VERSION` |
| Versioned asset cache | `public, max-age=31536000, immutable` | `/v/:version` static `setHeaders` |
| Root static cache (HTML, PNGs, legacy paths) | `no-cache` | root static + `GET /` `setHeaders` |

Cloudflare (documented in `DEPLOYMENT.md`, no zone configuration required):

- Default behaviour already correct: extension-based edge caching for
  `/v/<sha>/…`, no caching for `/` and `/api/version`.
- Caveat: a zone-level "Cache Everything" rule would edge-cache HTML and
  `/api/version`, breaking deploy freshness — with such a rule, add a Cache
  Rule bypassing `/api/*` and `/`. Verification: `curl -sI
  https://papa.iyaki.ar/api/version | grep cf-cache-status` must show
  `DYNAMIC`/`BYPASS`, not `HIT`.

## Permissions

Public endpoints, same as every other surface of the app. They expose only
the revision hash, a timestamp, and the already-public static files.

## Security Considerations

- `/api/version` MUST stay limited to `{version, builtAt}`; do not extend it
  with environment, filesystem, or git metadata.
- The `/v/:version` mount serves exactly the same file set as the existing
  root static — no new files become reachable, and `version` is a path
  prefix, not a file lookup (no traversal surface beyond express.static's
  own, already hardened, resolution).
- `immutable` is safe only because the URL contains the version; never apply
  it to version-less paths.

## Dependencies

- None added. Uses existing `express` routing/static and Node's `fs` for the
  HTML substitution.

## Open Questions / Risks

- **Zone-level cache rules are outside repo control**: the design assumes
  default Cloudflare behaviour (extension-based, respect origin TTL). If the
  zone gains aggressive rules later, the DEPLOYMENT.md checks catch drift;
  versioned URLs keep assets correct regardless — only HTML/`/api/version`
  freshness depends on the bypass caveat above.
- **`/socket.io/socket.io.js` is not versioned**: served by socket.io with
  its own headers and only changes on dependency upgrades. After a socket.io
  upgrade, Cloudflare may briefly serve the previous client; socket.io
  tolerates this minor mismatch, and it self-heals at edge TTL. Out of scope.
- **Old-SHA asset accumulation in Cloudflare**: each deploy leaves the
  previous assets cached until LRU eviction — harmless (they are immutable
  and unreachable from current HTML).
- **Dirty-tree builds**: SHA identifies the commit, not uncommitted edits;
  acceptable for a single-operator deploy flow.
- **One `fs.readFileSync` per `/` request**: a ~11 KB file per page load,
  keeps dev edits hot and tests simple. If it ever mattered, cache it keyed
  by mtime — deliberately not built.

## Verifications

Planned tests (written first, per the SDD workflow; citations added when
passing):

1. `getVersionInfo` returns injected `APP_VERSION`/`APP_BUILT_AT` and falls
   back to `{"version":"dev","builtAt":null}` when unset — unit tests in
   `server/server.test.js`.
2. `GET /api/version` returns `200` JSON `{"version","builtAt"}`, reflecting
   env vars when set — integration test in
   `server/server.integration.test.js`.
3. `GET /` carries `Cache-Control: no-cache` and its body contains
   `/v/<version>/main.js`, `/v/<version>/style.css`, and
   `Versión: <version>` (with env vars set in the test) — integration test
   in `server/server.integration.test.js`.
4. `GET /v/<version>/main.js` (and `style.css`, `game.js`, `collision.js`)
   return `200` with
   `Cache-Control: public, max-age=31536000, immutable`; the module graph is
   loadable from the versioned prefix — integration test in
   `server/server.integration.test.js`.
5. The lobby shows a non-empty `Versión: <version>` line after load, and the
   game boots from versioned asset URLs — e2e test in
   `tests/e2e/version.spec.js` (broader play flows already covered by the
   existing e2e suite loading the app through `/`).

## Appendices

- **Compatibility**: old HTML referencing root `/main.js` keeps working
  (root static remains); no socket contract, room state, or client module
  changes. Retrospective specs unaffected.
- **Alternatives rejected** (see ADR 0010 for the full rationale):
  origin-wide `Cache-Control: no-cache` (bypasses Cloudflare's edge —
  every asset request worldwide hits the origin VPS); purge-on-deploy via
  the Cloudflare API (adds credentials, a deploy step, and a failure mode
  where someone forgets to purge).
- **Future considerations — reload prompt**: to also refresh tabs left open
  across a deploy, poll `/api/version` on `visibilitychange`, compare with
  the version captured at load, and show a "Nueva versión disponible —
  Recargar" banner. Needs only this spec's endpoint; would be its own change.
- **Future considerations — real fingerprinting**: if assets grow or
  per-deploy content-accuracy matters more than deploy identity, introduce
  content hashes and retire the SHA prefix via a new ADR.
