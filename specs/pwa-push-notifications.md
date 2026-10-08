# PWA instalable + notificaciones (SW + Web Push)

Status: Implemented

## Overview

### Purpose

- Make the game installable as a PWA (manifest + icons) so it opens standalone
  from the home screen like an app.
- Deliver turn/game-event notifications through the Service Worker
  (`registration.showNotification`), replacing the current `new Notification()`
  usage which does not work on Android Chrome, and whose icon points to a
  non-existent `/favicon.ico`.
- Add server-side Web Push so a player whose tab is closed still gets "¡Es tu
  turno!", rival-joined, game-over and rematch notifications.

### Goals

- `manifest.json` + real PNG icons (192/512/apple-touch) generated from the
  existing 1024px art (`client/favicon.png`).
- All notifications flow through a service worker (`client/sw.js`).
- Web Push with VAPID keys, optional at runtime: without `VAPID_*` env vars the
  server runs exactly as today with push disabled.
- Push is sent only to the absent player (no socket with their last
  `socket.id` in `io.sockets.sockets`).

### Non-Goals

- No persistence layer: subscriptions live in `playerSessions` (in-memory),
  consistent with rooms; a restart clears them just like it clears rooms.
- No offline caching: `sw.js` has no `fetch` handler by design.
- No `pushsubscriptionchange` handler: silent re-subscription on load plus
  404/410 pruning covers the lifecycle.
- No backend job queue / retry for failed pushes: single fire-and-forget with
  404/410 cleanup.

### Scope

- Server: `web-push` dep, VAPID config from env, `GET /api/push/config`,
  `POST /api/push/subscribe`, push helper + 5 socket hooks, new exports.
- Client: SW registration, `sendNotification` migrated to
  `registration.showNotification`, push subscription flow behind the existing
  `#enable-notifications-btn`, notification triggers on `move_made`,
  `player_joined`, `rematch_requested`, `game_restarted`, `game_over`.
- Static: `client/manifest.json`, `client/sw.js`, `client/icon-192.png`,
  `client/icon-512.png`, `client/apple-touch-icon.png`, generator script
  `scripts/generate-icons.mjs`.
- Docs: `DEPLOYMENT.md` push section.

## Architecture

### Module/package layout

```
server/server.js          # +web-push config, endpoints, notifyPlayerIfAbsent, hooks
server/push.integration.test.js  # V1–V3
client/manifest.json      # new
client/sw.js              # new: push + notificationclick
client/main.js            # sendNotification rewrite, enablePush, triggers
client/icon-192.png | icon-512.png | apple-touch-icon.png  # generated
scripts/generate-icons.mjs  # one-off generator (kept for art changes)
tests/e2e/pwa.spec.js     # V4
DEPLOYMENT.md             # VAPID setup section
```

### Component diagram

```
Player A (tab closed)                     Player B (tab open)
     │                                         │ submit_move
     │                                         ▼
     │                              Socket.IO server (submit_move)
     │                                         │ room.players[].id ∉ io.sockets.sockets
     │                                         ▼
     │                              webpush.sendNotification(subscription, JSON)
     │                                         │
     ▼                                         ▼
Push service (FCM) ──push event──► sw.js ──► showNotification
     │                                         │
     ▼                                         ▼
"¡Es tu turno!" ──tap──► openWindow /?room=CODE ──► auto-join
```

### Data flow summary

1. Client registers `/sw.js`; on "enable notifications" click it asks
   permission, fetches `GET /api/push/config`, subscribes via
   `pushManager.subscribe` and POSTs `{ token, subscription }` to
   `/api/push/subscribe`.
2. Server stores `playerSessions[token].pushSubscription` (upsert).
3. On game events, for each absent player with a subscription the server sends
   the payload `{ title, body, url }`; `sw.js` shows it and routes clicks to
   `url`.

## Data model

### Core Entities

```js
// playerSessions[token] gains one optional field
playerSessions[token] = {
    username: string,
    rooms: string[],
    pushSubscription: PushSubscriptionJSON | undefined, // { endpoint, keys, ... }
}
```

- `PushSubscriptionJSON` is whatever `pushManager.subscribe` returns,
  serialized with `JSON.stringify` (it is JSON-serializable as-is).

### Relationships

- One session (token) → one subscription (last one wins, upsert).
- Subscriptions belong to a session, not a room: any of the session's rooms
  can trigger a push.

### Persistence Notes

- In-memory only, same lifetime as `playerSessions` (process lifetime). No
  schema, no migration.

## Workflows

### Enable notifications (client)

1. User taps `#enable-notifications-btn` (shown only when
   `Notification.permission === 'default'`).
2. `Notification.requestPermission()`; if `granted` → `enablePush()`:
   `GET /api/push/config` → if `publicKey` is null, stop (local notifications
   only) → `swReady` registration → `pushManager.subscribe({
   userVisibleOnly: true, applicationServerKey })` → `POST /api/push/subscribe`.
3. On every page load with `permission === 'granted'`, `enablePush()` runs
   silently (re-subscription covers endpoint rotation).

### Turn push (server)

1. `submit_move` valid → turn flips → `move_made` emitted.
2. `notifyPlayerIfAbsent(nextPlayer, { title: '🥔 ¡Es tu turno!', body:
   '<mover> movió. ¡Te toca!', url: '/?room=<code>' })`.
3. Absent = `!io.sockets.sockets.has(player.id)`. A network blip does not fire
   (socket survives until ping timeout ~25s).
4. Push error with `statusCode` 404/410 → `delete
   session.pushSubscription`.

### Other hooks (server)

| Event | Notified | Copy |
|---|---|---|
| `join_room` (new player) | other player | `¡Tu rival se unió!` / `<joiner> ya está en la sala <code>.` |
| `game_over` | winner (opponent of emitter) | `Partida terminada` / `¡Ganaste! 🏆` |
| `request_rematch` | non-requester | `¡Revancha pedida!` / `<requester> quiere la revancha.` |
| `respond_rematch` accept | requester (opponent of accepter) | `¡Revancha aceptada!` / `La partida vuelve a empezar.` |

### notificationclick (sw.js)

1. Focus an existing open window client if any.
2. Otherwise `openWindow(notification.data.url)` — `/?room=CODE` auto-joins
   via the existing URL param flow.

## APIs

Base path: `/api/push`. Auth: session `token` in body (same trust level as
socket auth; no additional auth).

| Method | Path | Purpose | Request | Response |
|---|---|---|---|---|
| GET | `/api/push/config` | Expose VAPID public key | — | `200 { publicKey: string \| null }` |
| POST | `/api/push/subscribe` | Upsert subscription | `{ token: string, subscription: { endpoint: string } }` | `204` / `400` invalid body |

Validation: `token` non-empty string; `subscription` object with `endpoint`
string; else 400.

## Client SDK Design

- `swReady = 'serviceWorker' in navigator ? navigator.serviceWorker.register('/sw.js') : null`.
- `sendNotification(title, body, roomCode)` — no-op unless permission granted,
  page hidden and SW ready; uses `registration.showNotification` with
  `icon`/`badge: '/icon-192.png'`, `tag: roomCode || 'papa-online'`,
  `data.url = roomCode ? '/?room=CODE' : '/'`. The 5s auto-close is removed
  on purpose (SW notifications persist until interaction; desired for
  turn pings).
- Triggers: `move_made` (now passes `game.roomCode`), `player_joined`,
  `rematch_requested`, `game_restarted`, `game_over`.
- `urlBase64ToUint8Array` converts the VAPID key for `pushManager.subscribe`.

## Configuration

| Env var | Default | Effect |
|---|---|---|
| `VAPID_PUBLIC_KEY` | `null` | Absent → push disabled, `publicKey: null` served |
| `VAPID_PRIVATE_KEY` | `null` | Both required for `webpush.setVapidDetails` |

Subject: `https://juego-papa.com` (web-push accepts a URL).

## Permissions

Single anonymous role (token identity). No new roles. Browser-level: the
notification permission prompt is the only gate.

## Security Considerations

- VAPID private key stays server-side; only the public key is served.
- Subscription bodies validated (shape check) before storage; no eval/dynamic
  use of stored fields beyond `webpush.sendNotification`.
- Push payloads contain no secrets (room code + copy only).

## Dependencies

- `web-push` (server runtime): VAPID + payload delivery. Zero-dependency
  alternative would mean implementing JWT ES256 + encryption; not worth it.
- `sharp` (dev-only, `--no-save`): one-off icon rasterization in
  `scripts/generate-icons.mjs`; not a package.json dep.

## Open Questions / Risks

- iOS only delivers Web Push to installed PWAs over HTTPS — platform
  limitation, documented in DEPLOYMENT.md.
- Presence detection relies on `io.sockets.sockets` (socket.io v4 standard
  API). Contingency if zombies appear in practice: explicit
  `token → socketId` map maintained on connect/disconnect; helper signature
  unchanged.
- Manual on-device verification (Android Chrome install + real push) cannot
  be automated here; recorded below as a manual verification.

## Verifications

- **V1 config endpoint** — ✅ `server/push.integration.test.js` › "V1: GET
  /api/push/config": without env, `GET /api/push/config` → `{ publicKey: null }`;
  with `VAPID_*` set (isolated re-require) → returns the key and
  `webpush.setVapidDetails` is called.
- **V2 push on turn** — ✅ same file, `web-push` mocked: absent player with
  subscription gets exactly 1 `sendNotification` whose JSON payload has
  `title: '🥔 ¡Es tu turno!'` and `url: '/?room=<code>'`; both sockets alive →
  0 calls; 410 rejection → `pushSubscription` deleted; `join_room` notifies the
  absent rival with body `Joiner ya está en la sala JOIN01.`
- **V3 subscribe endpoint** — ✅ same file: valid body → 204 and
  `playerSessions[token].pushSubscription` stored (upsert + shell session for
  unknown tokens); six invalid-body variants → 400.
- **V4 PWA served** — ✅ `tests/e2e/pwa.spec.js`: `/manifest.json` 200 with
  name + 192/512 icons; `/sw.js` 200 with `push` + `showNotification`;
  `/icon-192.png` 200 with real `\x89PNG` magic bytes; `/` HTML contains
  `rel="manifest"` and `apple-touch-icon`.
- **Manual (documented, not automated)** — ⬜ pending: with `VAPID_*` in dev,
  Android Chrome: install from menu, enable notifications, create room, close
  tab, rival moves → push "¡Es tu turno!" arrives, tap opens `/?room=CODE` and
  auto-joins. iOS: installed PWA only.

## Appendices

### Compatibility notes

- `new Notification()` replaced by SW notifications (Android Chrome
  requirement); desktop browsers keep working.
- Static assets served at root by the existing `express.static` mount with
  `no-cache` — correct for manifest/sw refresh semantics (not `/v/` URLs).

### Future considerations

- Persist sessions/subscriptions if rooms ever get a real store.
- `pushsubscriptionchange` listener if silent re-subscription proves
  insufficient.
