# 3. Socket.IO for realtime multiplayer

Date: 2026-09-14

## Status

Accepted

## Context

The game needs bidirectional realtime messaging between two players in a
room: room lifecycle, turn sync, game-over and surrender events, and
automatic reconnection when a player drops (a advertised feature).

## Decision

Use Socket.IO for client/server communication. Alternatives considered:

- Raw WebSocket: no rooms, no auto-reconnection, no fallback — all would be
  hand-rolled.
- Colyseus or similar: a full room-state framework; more power than a
  2-player turn-based game needs.

Game state lives in server memory (`rooms` object); the client holds no
authoritative state.

## Consequences

- Rooms, reconnection, and event semantics come for free; both ends share one
  event vocabulary.
- Client/server are coupled to the Socket.IO protocol (not plain WS).
- State is in-memory: a server restart loses all rooms, and horizontal
  scaling needs a shared store — acceptable for the current scale; revisit if
  multi-instance deployment is ever needed.
