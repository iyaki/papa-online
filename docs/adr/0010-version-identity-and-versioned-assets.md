# 10. Deploy identity is the git short SHA; assets are served under a versioned URL prefix

Date: 2026-09-14

## Status

Accepted

## Context

The app had no notion of "which build is this". `server/package.json` pins
`1.0.0` and is never bumped; `express.static` served `client/` with defaults
(`ETag`/`Last-Modified`, no `Cache-Control`), so browsers used heuristic
caching and could run stale JS/CSS after a deploy. Nothing let the operator
verify a deployment landed, or a player report their version.

Production additionally runs behind **Cloudflare** (proxy for
`papa.iyaki.ar`), which edge-caches by file extension with its own TTLs. With
stable asset URLs (`/main.js`), a deploy cannot invalidate the edge: players
receive old assets until the TTL lapses or someone purges the zone.

Two deployment paths exist (`DEPLOYMENT.md`): building on the VPS via
`docker-compose up --build` after `git pull`, and pushing prebuilt images to
GHCR via `scripts/build-push.sh`. Any scheme must work in both without manual
steps, and must not require Cloudflare credentials or zone configuration.

Constraints from other ADRs: no build step (ADR 0002), so no filename
fingerprinting pipeline exists or should be added.

## Decision

- **The deployment identity is the short git SHA** (`git rev-parse --short
  HEAD`) plus a UTC build timestamp, injected as Docker build args
  (`APP_VERSION`, `APP_BUILT_AT`) and baked into the image as `ENV`. Unset
  (local dev, tests) means `version: "dev"`.
- **Assets are served under `/v/<version>/…`**: `index.html` is rendered by
  the server with `__APP_VERSION__` substituted into the `style.css` and
  `main.js` URLs (and the lobby line `Versión: <sha>`), and
  `/v/:version` mounts the same static directory with
  `Cache-Control: public, max-age=31536000, immutable`. Because a URL is
  unique per deploy, every cache layer (browser, Cloudflare edge) is
  correct by construction — no purge, no invalidation step, no zone config.
  The client module graph needs no changes (relative imports resolve under
  the versioned prefix).
- **Everything version-less stays `no-cache`**: rendered HTML (`/`) and the
  root static fallback, so stale HTML from an earlier page load revalidates
  and migrates to current URLs.
- **The identity is exposed at `GET /api/version`** (JSON, public) alongside
  the lobby line. HTML being extensionless, Cloudflare does not cache it by
  default, so page loads always see current URLs; `/api/version` is
  likewise origin-served and truthfully reflects a running deploy.
- **No semver, no filename fingerprinting, no purge automation**: semver
  rots (manual bumps), fingerprinting needs a build step (contradicts
  ADR 0002), and purge-on-deploy adds credentials plus a step someone can
  forget.

## Consequences

- Deploys are verifiable (`curl /api/version` must match the deployed
  revision) and fully effective on every client's next page load, with
  Cloudflare edge caching still serving assets between deploys.
- Each deploy leaves previous-`SHA` assets in edge/browser caches until
  expiry/LRU eviction — harmless: immutable and unreachable from current
  HTML.
- Freshness of `/` and `/api/version` depends on Cloudflare *default*
  behaviour (extension-based caching); a zone-level "Cache Everything" rule
  would require a bypass rule for them (check documented in
  `DEPLOYMENT.md`).
- One small server-side render (read + replace on `/`) is the only code cost;
  the client JavaScript is untouched.
- If real content fingerprinting is ever introduced, this ADR is superseded,
  not edited (per ADR 0001).
