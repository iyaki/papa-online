# 10. Docker image publishing via GHCR

Date: 2026-09-14

## Status

Accepted

## Context

Deployment previously meant cloning the repo on the VPS and building the
image there (`docker-compose build` on every update). The Dockerfile already
declared `org.opencontainers.image.source`, but no image was ever published
from this repository — a manually pushed `ghcr.io/iyaki/papa-online` package
existed without any link to the repo, because GitHub only associates a
container package with its source repository when it is pushed from the
repo's own Actions using the built-in `GITHUB_TOKEN` (the label alone does
not create the link).

## Decision

- CI publishes the image to `ghcr.io/iyaki/papa-online` on every push to
  `main` and on `v*` tags (`.github/workflows/docker-publish.yml`), using
  `GITHUB_TOKEN` (`packages: write`) so the package is permanently linked to
  this repository. Pull requests build without pushing, so Dockerfile
  breakage is caught before merge.
- Tags: `latest` (default branch), `sha-<commit>` (rollback pin), `X.Y.Z`
  (semver tags).
- `docker-compose.yml` consumes the published image (`image:`) instead of
  building on the server; the VPS update flow is
  `git pull && docker-compose pull && docker-compose up -d`.
- Client and server ship inside the same image, keeping wire-contract
  changes (see `specs/`) atomic on deploy.

## Consequences

- The VPS no longer needs the repo's Node toolchain, only Docker Compose and
  (while the package is private) a `read:packages` PAT for
  `docker login ghcr.io`; flipping the package to public removes the login.
- Restarts still wipe all in-memory game state; redeploy timing is unchanged
  in that respect.
- A failed build on `main` leaves the previous `latest` in place — deploy
  stays on the last good image, so watch the workflow result after merging.
