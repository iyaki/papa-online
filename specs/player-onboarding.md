# Player Onboarding — First-Game Tutorial and Help Screen

Status: Implemented

## Overview

### Purpose

New players land in the lobby with no explanation of what the game is, and when
they enter a game screen they face the board with no hint that the interaction
is *press on the last connected number and drag to the next one*. The only
rules text is a short FAQ screen behind a lobby button, and it omits key
mechanics: auto-complete on reaching the target
([auto-complete-stroke.md](./auto-complete-stroke.md)), early-release = safe
retry, and touching a non-target number = instant loss. A first-time player
must leave the game screen (or lose a game) to learn the rules.

This change gives first-time players a one-time dismissible coach overlay on
their first game, rewrites the help screen so it covers the full ruleset with a
visual diagram, and adds a one-line game pitch to the lobby.

### Goals

- A first-time player entering the game screen sees a dismissible tutorial
  overlay explaining the drag interaction, auto-complete, safe retry, and the
  losing rules. Dismissing it stores a flag; the overlay never appears again on
  that browser.
- Returning players (flag present) enter the game screen with no overlay.
- A first-time player *joining* an existing room mid-flow sees the same overlay
  on their first game — creation is not the only entry path.
- The help screen covers: what the game is, how to play (drag interaction,
  auto-complete, safe retry), when you lose (crossed line or wrong number),
  who wins, and how to invite someone — plus a static SVG diagram of a valid
  line and a losing crossing.
- The lobby states in one line what the game is.
- **Round 2**: the two-player format is visible before entering a game (lobby
  pitch, tutorial overlay) and the lobby labels its primary action so a
  first-time player knows what to press to start ("Empezar partida").
- **Round 2**: a first-time creator who dismisses the tutorial sees an invite
  hint in the game screen while the room has only one player; it disappears
  when the rival joins.

### Non-Goals

- Interactive guided tutorial (highlighted steps, forced first move).
- Server or Socket.IO changes — entirely client-side presentation.
- An in-game help button on the game screen (the lobby FAQ entry stays the
  repeatable reference).
- An i18n system; UI strings remain Spanish per ADR 0009.

### Scope

Included: `client/index.html` (overlay markup, FAQ rewrite, lobby pitch and
step labels, invite hint), `client/main.js` (overlay show/dismiss logic,
invite-hint wiring), `tests/e2e/utils.js`
(`createPlayerContext` helper), `tests/e2e/onboarding.spec.js` (new). Excluded:
everything under Non-Goals; `server/` and `client/game.js` untouched.

## Architecture

### Module/package layout (tree format)

```
papa-online/
├── client/
│   ├── index.html        # #tutorial-overlay inside #game-screen; FAQ content
│   │                     # rewrite with #faq-diagram SVG; lobby pitch line
│   ├── main.js           # maybeShowTutorial(), dismiss handler, hooked into
│   │                     # every game-screen reveal site
│   └── style.css         # unchanged (.hidden global rule already covers it)
└── tests/e2e/
    ├── utils.js          # createPlayerContext(): context with flag preset
    ├── onboarding.spec.js   # overlay lifecycle + help content (new)
    ├── basic.spec.js     # contexts routed through createPlayerContext
    └── *.spec.js         # all gameplay specs inherit the flag via setupGame
```

### Component diagram (ASCII)

```
 lobby ── create/join/reconnect ──► game screen revealed
                                        │
                          every reveal site calls
                          maybeShowTutorial()
                                        │
                    localStorage.has_seen_tutorial set?
                          │                       │
                         no                      yes
                          ▼                       ▼
              #tutorial-overlay shown      game starts directly
                          │
              "¡Entendido!" (#tutorial-dismiss-btn)
                          │
              set has_seen_tutorial = 'true'
              hide overlay (never re-shown)
```

### Data flow summary

No server interaction. The flag lives in `localStorage` on the player's
device, read at every game-screen reveal and written once on dismissal — the
same client-only persistence model as `session_token` and `papa_online_stats`.

## Data model

### Core Entities

One new client-only entry:

| Key                 | Storage      | Type   | Values           | Written by           |
| ------------------- | ------------ | ------ | ---------------- | -------------------- |
| `has_seen_tutorial` | localStorage | string | `'true'` or unset | dismiss-button click |

Naming follows the existing snake_case localStorage keys (`session_token`,
`papa_online_stats`).

### Relationships

Independent of all server entities (`Room`, `Player`, `Line`). It is a
per-browser presentation flag only; the server never learns whether a player
has seen the tutorial.

### Persistence Notes

None beyond localStorage itself — no schema, no expiry. Clearing browser data
resets it (accepted; matches `username`/stats persistence behaviour).

## Workflows

### W1 — First game, create room (new happy path)

1. Player with no `has_seen_tutorial` flag fills their name and creates a
   room; the client reveals the game screen.
2. The reveal site calls `maybeShowTutorial()`; the flag is absent, so
   `#tutorial-overlay` becomes visible over the board.
3. Player reads the five rules bullets and presses `#tutorial-dismiss-btn`.
4. The handler stores `has_seen_tutorial = 'true'` and hides the overlay. The
   board is now interactive (it never was blocked by game state — the overlay
   was purely visual).

### W2 — Returning player

Any game-screen reveal with the flag present calls `maybeShowTutorial()`,
which does nothing. The player goes straight to the board. Rematch restarts
never hide the game screen, so they never re-trigger the check — and the flag
is never unset, so no flow can resurrect the overlay.

### W3 — First-time joiner

P2 joins P1's room with a fresh browser (no flag). P2's game screen reveal
(reconnect-sync path or `enterGame`) shows the overlay on P2's page only; P1,
who created earlier, is unaffected. Dismission persists as in W1.

### W4 — Help screen consult (content change only)

Trigger unchanged: lobby `#faq-btn` → `#faq-screen`. New content: expanded
sections (what the game is + turn-based play and solo start, how to play,
when you lose, who wins, how to invite, room duration, error reporting) and an
inline static SVG diagram (`#faq-diagram`) showing a valid 1→2→3 connection
and a losing crossing. `#close-faq-btn` behaviour unchanged.

### W5 — Invite hint for the first-time creator (round 2)

1. The client tracks the room's player count from `game_sync` (`players`) and
   `player_joined`; `maybeShowTutorial()` records when it actually showed the
   overlay on this game-screen entry.
2. On tutorial dismissal, if the room still has one player, `#invite-hint`
   becomes visible in the game screen: "la sala es para 2 — invitá a tu
   rival con el código o el link (Compartir)".
3. When the rival joins (`player_joined`, or a `game_sync` reporting 2
   players), the hint hides.
4. Returning players never see the hint: it is only ever shown as part of a
   first-game tutorial dismissal, and it never outlives the rival joining or
   leaving the game screen.

## APIs

No changes — no new socket events, no HTTP endpoints.

## Client SDK Design

No public API change. Internals in `client/main.js`:

- `TUTORIAL_SEEN_KEY = 'has_seen_tutorial'` — the storage key constant.
- `maybeShowTutorial()` — reveals `#tutorial-overlay` iff the flag is absent;
  called from every site that removes `hidden` from the game screen (today:
  the `game_sync` reconnection handler and `enterGame()`).
- Dismiss click handler on `#tutorial-dismiss-btn` — writes the flag, hides
  the overlay.

Behaviour expectations: synchronous, no retries, no network; the overlay is
plain DOM over the canvas, hidden via the existing `.hidden` global rule.

## Configuration

No new settings. The flag is not configurable; there is no "show tutorial
again" affordance (Non-Goals).

## Permissions

Unchanged — the overlay is display-only and adds no authorisation surface.

## Security Considerations

No change to the trust model. The flag is trivially forgeable/clearable by the
user, which is harmless: it gates only a help overlay, and the persistent-XSS
surface (none today) is untouched — the overlay contains static markup.

## Dependencies

None added.

## Open Questions / Risks

- **Per-device flag**: a player on a new browser/device sees the overlay once
  more. Accepted — matches the `username`/stats persistence model.
- **Overlay blocks the board until dismissed**: intentional; it is a one-time
  read. The rules stay available afterwards via the lobby help screen.
- **Reveal-site drift**: if a future change adds a game-screen reveal path
  without `maybeShowTutorial()`, first-timers on that path silently skip the
  tutorial. Mitigated by the "every reveal site" rule documented here.
- **FAQ diagram fidelity**: the SVG is a hand-drawn-style sketch, not a
  rendering of a real board; it illustrates the crossing rule, not exact
  geometry.

## Verifications

- Tutorial shows on the first game and never again: fresh context creates a
  room → `#tutorial-overlay` visible → dismiss → hidden → back to lobby →
  second room → overlay stays hidden (flag persisted) —
  `tutorial overlay appears on first game and is remembered after dismissal`
  (`tests/e2e/onboarding.spec.js`)
- Returning players skip it: context created via `createPlayerContext` (flag
  preset) → create room → `#tutorial-overlay` hidden —
  `returning player sees no tutorial overlay` (`tests/e2e/onboarding.spec.js`)
- First-time joiners get it too: P1 (flag preset) creates, P2 (fresh context)
  joins → overlay visible on P2's page, hidden on P1's —
  `first-time joiner sees the tutorial overlay` (`tests/e2e/onboarding.spec.js`)
- Help screen covers the ruleset: `#faq-btn` → `#faq-screen` contains
  auto-complete ("se completa sola"), safe retry ("reintentar"), wrong-number
  loss ("no es el siguiente") texts, `#faq-diagram` visible, close works —
  `help screen explains interaction and losing rules`
  (`tests/e2e/onboarding.spec.js`)
- Two-player format and start action are visible before playing: the lobby
  shows "Empezar partida" and "para 2 jugadores", and the tutorial overlay
  mentions "para 2" — `returning player sees no tutorial overlay` and
  `tutorial overlay appears on first game and is remembered after dismissal`
  (`tests/e2e/onboarding.spec.js`)
- First-time creator gets the invite hint until the rival joins: fresh P1
  dismisses the tutorial → `#invite-hint` visible; P2 joins → hidden on P1's
  page — `invite hint appears for first-time creator and hides when the rival
  joins` (`tests/e2e/onboarding.spec.js`)
- Returning players never see the invite hint: flag-preset creator →
  `#invite-hint` hidden — `returning player sees no tutorial overlay`
  (`tests/e2e/onboarding.spec.js`)
- Overlay never blocks returning players' gameplay: full suite green via
  `npm run verify` (all gameplay specs run flag-preset contexts).

## Appendices

### Compatibility notes

- Existing gameplay e2e specs are insulated by routing every context creation
  through `createPlayerContext()` (utils.js), which presets the flag — the
  overlay cannot cover the canvas mid-drag in old tests.
- Rematch is unaffected: the game screen never hides on restart, and the flag
  is never cleared.

### Future considerations

- A "ver reglas de nuevo" affordance from the game screen (the in-game help
  button) if players return to the FAQ often; not built until reported.
