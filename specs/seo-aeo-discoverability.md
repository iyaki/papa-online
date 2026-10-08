# SEO / AEO / GEO Discoverability

Status: Implemented

## Overview

### Purpose

The game is currently invisible to search engines and AI answer engines: the
landing page has Open Graph tags but no `meta description`, no canonical URL,
no structured data (schema.org), no `robots.txt` and no `sitemap.xml`. Anyone
searching "juego de la papa online", "juego de los números" or asking an AI
assistant for similar games gets no signal about this site.

Jobs to be done:

- A person googling the game by name or by genre finds and understands the page.
- An AI engine (Google AI Overviews, Perplexity, ChatGPT browsing) can extract
  what the game is, how it is played, and whether it is free, without running
  the JavaScript game.
- A shared link unfurls with a correct title, description and image (already
  mostly works; kept consistent with the new tags).

### Goals

- Serve crawler-usable metadata on `GET /`: title, meta description, canonical
  URL, Open Graph/Twitter completion.
- Expose structured data (JSON-LD) describing the game as a free
  `WebApplication` (`applicationCategory: GameApplication`) and the rules as a
  `FAQPage` whose questions/answers mirror the on-page FAQ content.
- Serve `robots.txt` (allow all + sitemap reference) and `sitemap.xml` from the
  static client directory with zero server code changes.
- Keep all user-visible strings in Spanish (ADR 0009).

### Non-Goals

- No server-rendered per-room pages (rooms are ephemeral and private).
- No hreflang/alternates (single language).
- No aggregateRating/Review markup (we have no rating data; fabricating it is
  a guideline violation).
- No Analytics/SEO tooling beyond what exists (GoatCounter stays).
- No changes to game code, Socket.IO events or lobby behaviour.

### Scope

- `client/index.html` head section only (plus nothing in body).
- New static file `client/robots.txt`.
- Sitemap served dynamically by a `GET /sitemap.xml` route (added after the
  initial static-file version): its `lastmod` is the mtime of
  `client/index.html`, so it never goes stale after deploys.
- One new Jest integration test file asserting the served artifacts.

## Architecture

No new modules. Static files ride the existing `express.static(CLIENT_DIR)`
mount, so `robots.txt` and `sitemap.xml` need no route. The JSON-LD blocks are
inline `<script type="application/ld+json">` in the HTML head.

```
client/
├── index.html      # head: description, canonical, og additions, 2× JSON-LD
└── robots.txt      # new: allow all, sitemap ref
server/server.js    # new: GET /sitemap.xml (lastmod = index.html mtime)
```

### Data flow summary

Crawler requests `GET /` → Express serves `index.html` (already does). Crawler
requests `GET /robots.txt` or `/sitemap.xml` → `express.static` serves them
from `client/` with the existing `no-cache` policy. No other flows change.

## Data model

Not applicable (no entities, no persistence). The structured-data payload is
static content in `index.html`; `sitemap.xml` holds the single canonical URL
`https://juego-papa.com/`.

## Workflows

1. Search engine crawls `/`, reads meta description, canonical and JSON-LD,
   indexes the lobby definition text and the FAQ screen content (already in
   the DOM), discovers `/sitemap.xml` via `/robots.txt`.
2. AI answer engine extracts: opening definition (lobby H1 + subtitle),
   rules/how-to-play (FAQ screen + FAQPage schema), pricing/free (schema
   `isAccessibleForFree: true`, `offers` price 0), privacy/stats behaviour
   (on-page stats note: data stored locally on the device).

## APIs

None added. Unchanged: `GET /`, `GET /api/version`, `/v/:version/*` static,
Socket.IO namespaces.

## Configuration

None. The production URL `https://juego-papa.com/` is hardcoded exactly where
it is already hardcoded today (og:url / og:image).

## Permissions

Not applicable (public static content).

## Security Considerations

- JSON-LD is static content served same-origin; no user input is interpolated.
- No new external requests introduced (no font/tag-manager additions).

## Dependencies

None added.

## Open Questions / Risks

- FAQ content lives in a screen hidden via CSS until the user opens Help.
  Google accepts accordion/tab-hidden content that is user-visible on
  interaction; risk of a manual action is low but non-zero. Mitigation: the
  FAQPage JSON-LD mirrors exactly the on-page text.
- `og:locale` stays `es_AR`; content is neutral-enough Spanish for any
  Spanish-speaking audience.

## Verifications

- V1: `GET /` serves a `meta[name=description]`, a `link[rel=canonical]`
  pointing at `https://juego-papa.com/`, and two parseable JSON-LD blocks with
  `@type` `WebApplication` (with `applicationCategory: GameApplication`,
  `isAccessibleForFree: true`, offers price 0, `inLanguage: es`) and
  `FAQPage`.
- V2: The `FAQPage` JSON-LD questions all appear verbatim in the served HTML
  (schema mirrors visible content).
- V3: `GET /robots.txt` returns 200, allows all crawlers and references the
  sitemap URL.
- V4: `GET /sitemap.xml` returns 200, lists exactly `https://juego-papa.com/`
  with a `lastmod` date matching `client/index.html`'s modification date
  (W3C `YYYY-MM-DD`, never in the future).

## Appendices

- Test placement: `server/seo.integration.test.js` follows the existing
  `server.integration.test.js` boot pattern (real server, real HTTP).
- The spec title/URL constants reuse the values already present in the OG tags;
  single source of truth remains the HTML file itself.
