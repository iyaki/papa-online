# Tasks: overlap-detection

Generated from spec.md. Do not add tasks without a matching requirement.

- [ ] 1. Write test for client segment intersection `doLinesIntersect` (crossing, collinear, shared-endpoint cases) (`client/collision.test.js` or a Jest-compatible location — module is ESM, decide harness first)
- [ ] 2. Write test for `doPolylineIntersection` safe-zone inclusion/exclusion (AC7)
- [ ] 3. Write test for `generateNumbers` 100-attempt cap fallback placement (AC5)
- [ ] 4. Document (or tighten, if changed) the client collision → `game_over` (reason, `lastLine`) emission with an integration or e2e assertion (AC4)
- [x] 5. `generateNumbers` count, sequential values, and padding bounds covered — `generateNumbers should create correct number of points` in `server/server.test.js` (AC1, AC2)
- [x] 6. `checkOverlap` strict less-than 40 min distance covered — `checkOverlap should detect close points` in `server/server.test.js` (AC3)
- [x] 7. `npm run verify` green (14/14 server tests + 4/4 e2e); AC references unchanged
