# Tasks: room-lifecycle

Generated from spec.md. Do not add tasks without a matching requirement.

- [ ] 1. Close the coverage gaps (ACs 1, 2, 4, 5, 9, 12 already have passing tests; write the
  missing ones in `server/server.integration.test.js`): (a) `join_room` on a nonexistent
  roomCode emits `error` (AC7); (b) `join_room` on a full room emits `error` (AC8); (c)
  same-token `join_room` updates the player socket id and emits `room_joined` without
  duplicating the player (AC6); (d) `leave_room` emits `left_room_success` and deletes the room
  when it empties (AC10); (e) a 3-day-inactive room is deleted after `room_deleted` +
  `my_games_update` are emitted to its players (AC11); (f) a non-default `pointCount` yields
  exactly that many numbers (AC3).
- [x] 2. `npm run verify` green; update AC test references if names changed
