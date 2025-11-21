# Task List: Juego de la Papa Online

- [x] **Project Initialization**
    - [x] Setup basic HTML/CSS/JS structure (Vanilla) <!-- id: 0 -->
    - [x] Setup simple dev server (e.g., Vite Vanilla or simple http-server) <!-- id: 1 -->

- [x] **Core Game Mechanics (Freehand Update)**
    - [x] Update `Game` class to support freehand paths (array of points) <!-- id: 19 -->
    - [x] Update `CanvasManager` rendering for paths <!-- id: 20 -->
    - [x] **Critical**: Update collision detection for Polyline-Polyline intersection <!-- id: 21 -->
    - [x] Verify performance of collision checks <!-- id: 22 -->

- [x] **Core Game Mechanics (Legacy/Completed)**
    - [x] Create `CanvasManager` class for drawing and rendering <!-- id: 3 -->
    - [x] Implement logic to generate random number positions <!-- id: 4 -->
    - [x] Handle Mouse/Touch events for drawing lines <!-- id: 5 -->
    - [x] **Critical**: Implement collision detection (Line-Line intersection) <!-- id: 6 -->
    - [x] Implement **Game Over** logic immediately upon collision <!-- id: 7 -->
    - [x] Validate sequential connections (1->2, 2->3...) <!-- id: 8 -->

- [x] **Bug Fixes & Refinements**
    - [x] Fix collision bug at connection points (Player 2 instant loss) <!-- id: 23 -->
    - [x] Implement "Touch Number = Loss" rule <!-- id: 24 -->
    - [x] Fix "Back to Lobby" button functionality <!-- id: 25 -->
    - [x] Implement "Safe Zone" in start number (ignore collisions inside radius) <!-- id: 30 -->
    - [x] Persist Username in LocalStorage <!-- id: 31 -->

- [x] **Async Play & Reconnection**
    - [x] Client: Generate/Store Session Token (UUID) <!-- id: 26 -->
    - [x] Server: Authenticate socket with Token and handle Reconnection <!-- id: 27 -->
    - [x] Client: Handle `game_sync` to restore state <!-- id: 28 -->
    - [x] Fix UUID generation for non-secure contexts <!-- id: 42 -->

- [x] **New Features**
    - [x] Implement "Surrender" button <!-- id: 29 -->

- [x] **Game State & UI**
    - [x] Manage game state (current number, active player) <!-- id: 9 -->
    - [x] Create simple UI (Turn indicator, Player list, Restart button) <!-- id: 10 -->
    - [x] Implement Game Over / Win screens <!-- id: 11 -->

- [x] **Multiplayer Infrastructure**
    - [x] Setup Node.js + Socket.io server <!-- id: 12 -->
    - [x] Implement Room logic (Create/Join) <!-- id: 13 -->
    - [x] Implement Turn-based sync (Send complete move -> Update all clients) <!-- id: 14 -->
    - [x] Handle player disconnects <!-- id: 15 -->
    - [x] Fix CORS for remote access <!-- id: 43 -->

- [x] **UI Redesign: Nostalgic Paper Theme**
    - [x] Add Google Font (Handwritten style) <!-- id: 32 -->
    - [x] Implement Grid Paper Background (CSS) <!-- id: 33 -->
    - [x] Style buttons and inputs to match "sketch/notebook" theme <!-- id: 34 -->
    - [x] Update Canvas rendering to look like pencil/pen <!-- id: 35 -->

- [x] **Multi-Game Management**
    - [x] **Server**: Update `playerSessions` to store list of rooms (`rooms: []`) <!-- id: 36 -->
    - [x] **Server**: Update `join`/`create` to append to room list <!-- id: 37 -->
    - [x] **Server**: Implement `get_my_games` event to return active games list with status <!-- id: 38 -->
    - [x] **Client**: Create "My Games" list UI in Lobby <!-- id: 39 -->
    - [x] **Client**: Handle switching between games (minimize current, open selected) <!-- id: 40 -->
    - [x] **Client**: Add "Back to Menu" button in Game Screen <!-- id: 41 -->

- [x] **Mobile UI Optimization**
    - [x] **CSS**: Refactor `style.css` for mobile-first layout (flex-col, full width) <!-- id: 44 -->
    - [x] **CSS**: Optimize Lobby (large inputs/buttons, stacked layout) <!-- id: 45 -->
    - [x] **CSS**: Optimize Game Screen (compact info bar, max-width canvas) <!-- id: 46 -->
    - [x] **JS**: Ensure touch events work smoothly on canvas (prevent scrolling while drawing) <!-- id: 47 -->
    - [x] **Res**: Switch to Portrait resolution (600x800) <!-- id: 48 -->

- [x] **Shareable Game Links**
    - [x] **Client**: Add "Share" button in Game Screen (copies URL with `?room=CODE`) <!-- id: 49 -->
    - [x] **Client**: Handle `?room=CODE` on page load <!-- id: 50 -->
    - [x] **Client**: If session exists, auto-join room <!-- id: 51 -->
    - [x] **Client**: If no session, pre-fill room code and focus username input <!-- id: 52 -->
    - [x] **Client**: Use `navigator.share` for native sharing <!-- id: 53 -->

- [x] **Async Victory Notifications & Export**
    - [x] **Server**: Store `winner`/`loser` and set 1h timeout (keep data) <!-- id: 54 -->
    - [x] **Server**: Update `sendMyGames` to include result status <!-- id: 55 -->
    - [x] **Client**: Update "My Games" list to show "Ganaste/Perdiste" <!-- id: 56 -->
    - [x] **Client**: Add "Export" button to Game Over screen <!-- id: 58 -->
    - [x] **Client**: Implement `exportGameToImage` (Canvas -> Image with overlay) <!-- id: 59 -->
    - [x] **Refinement**: Include losing stroke, opponent name, and clear result in export <!-- id: 60 -->

- [ ] **Local Statistics**
    - [ ] **Client**: Implement `updateStats(opponent, result)` using localStorage <!-- id: 61 -->
    - [ ] **Client**: Add "Stats" button to Lobby <!-- id: 62 -->
    - [ ] **Client**: Create Stats Modal UI (Totals + Per Opponent list) <!-- id: 63 -->
    - [ ] **Client**: Hook up `updateStats` to game over events <!-- id: 64 -->

- [ ] **Polishing & Verification**
    - [ ] Polish UI (CSS variables, responsive layout) <!-- id: 16 -->
    - [ ] Verify responsive canvas (Mobile/Desktop) <!-- id: 17 -->
    - [ ] Manual Verification (Playtest) <!-- id: 18 -->
