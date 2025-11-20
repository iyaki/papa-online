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

- [ ] **Bug Fixes & Refinements**
    - [ ] Fix collision bug at connection points (Player 2 instant loss) <!-- id: 23 -->
    - [ ] Implement "Touch Number = Loss" rule <!-- id: 24 -->
    - [ ] Fix "Back to Lobby" button functionality <!-- id: 25 -->

- [x] **Game State & UI**
    - [x] Manage game state (current number, active player) <!-- id: 9 -->
    - [x] Create simple UI (Turn indicator, Player list, Restart button) <!-- id: 10 -->
    - [x] Implement Game Over / Win screens <!-- id: 11 -->

- [x] **Multiplayer Infrastructure**
    - [x] Setup Node.js + Socket.io server <!-- id: 12 -->
    - [x] Implement Room logic (Create/Join) <!-- id: 13 -->
    - [x] Implement Turn-based sync (Send complete move -> Update all clients) <!-- id: 14 -->
    - [x] Handle player disconnects <!-- id: 15 -->

- [ ] **Polishing & Verification**
    - [ ] Polish UI (CSS variables, responsive layout) <!-- id: 16 -->
    - [ ] Verify responsive canvas (Mobile/Desktop) <!-- id: 17 -->
    - [ ] Manual Verification (Playtest) <!-- id: 18 -->
