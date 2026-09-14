# Testing Guide - Papa Online

## Test Configuration

This project uses **Jest** as the testing framework to ensure code integrity during development.

## Running Tests

From the project root:

```bash
npm test
```

From the server directory:

```bash
cd server
npm test
```

## Test Coverage

**Current coverage**: 15 tests (7 unit + 8 integration) | Coverage: 76% ✅

### ✅ Unit Tests (7 tests)

#### Room Management Functions
- **generateNumbers**: Verifies correct generation of points
- **checkOverlap**: Detects overlapping points
- **Room code generation**: Validates the 6-character alphanumeric format

#### Game Logic
- **Turn sequence validation**: Verifies correct numbers
- **Progress tracking**: Tracks game completeness
- **Turn alternation**: Correct switching between players

#### Session Management
- **UUID generation**: Validates UUID v4 format

### ✅ Integration Tests (8 tests)

#### Socket.IO Communication
- **Authenticated connection**: Token verification on handshake
- **Room creation**: Emits `room_created` and `game_start` events
- **Joining a room**: Syncs two players in the same room
- **Turn-based moves**: Validates `move_made` and turn switching
- **Game Over**: Correctly identifies winner and loser
- **Surrender**: Validates `leave_room` and `player_left` events
- **My Games List**: Verifies the list of active games
- **Rematch accept**: verifies `game_restarted` carries `roomCode`, regenerated
  numbers at the same point count, and the accepting player's turn

### ✅ E2E Tests (Playwright)

User-visible flows are covered by the Playwright suite in `tests/e2e/`
(helpers in `tests/e2e/utils.js`):

- **Basic flow**: Player 1 creates a room, Player 2 joins
- **Win/loss scenarios**: collision moves and turn switching
- **Rematch flow**: request → accept (in-game or inline from the lobby) → new
  game; rejection from the lobby notifies the requester

`npm run verify` builds everything needed and runs server tests + e2e
(the Playwright config auto-starts the server on port 3000).

## GitHub Actions - CI/CD

The project has GitHub Actions configured to run the tests automatically on:
- Every push to the `main` or `master` branches
- Every Pull Request
- Manually via workflow_dispatch

Tests run on:
- Node.js 18.x
- Node.js 20.x

**Workflow location**: `.github/workflows/test.yml`

## Expected Results

When you run `npm test`, you should see:

```
PASS  ./server.test.js
  Room Management - Helper Functions
    ✓ generateNumbers should create correct number of points
    ✓ checkOverlap should detect close points
    ✓ room code generation should create 6 character alphanumeric codes
  Game Logic
    ✓ should validate turn sequence
    ✓ should track game progress
    ✓ should alternate turns between two players
  Session Management
    ✓ should generate valid UUID format

Test Suites: 1 passed, 1 total
Tests:       7 passed, 7 total
```

## Adding New Tests

To add tests, edit `server/server.test.js` following the existing pattern:

```javascript
describe('Feature Name', () => {
    test('should do something specific', () => {
        // Arrange
        const input = ...;
        
        // Act
        const result = functionToTest(input);
        
        // Assert
        expect(result).toBe(expectedValue);
    });
});
```

## Next Steps for Testing

1. **Collision detection tests**: Validate the line-intersection logic
2. **Reconnection tests**: Verify session persistence

## Available Commands

| Command                  | Description                                            |
| ------------------------ | ------------------------------------------------------ |
| `npm test`               | Runs all server tests (from `server/`)                 |
| `npm test -- --coverage` | Runs tests with a coverage report                      |
| `npm test -- --watch`    | Runs tests in watch mode (useful during development)   |
| `npm run verify:server`  | Runs the server suite from the repo root               |
| `npm run verify`         | Server tests + Playwright e2e (boots the server)       |
| `npm run lint`           | Biome lint + format check (the pre-commit gate)        |

## Important Notes

- Tests run in isolation and do not interfere with the development server
- You do not need to stop `npm run dev` to run the tests
- Unit tests test pure functions and do not require a running server;
  `npm run verify` boots its own server for the e2e suite
