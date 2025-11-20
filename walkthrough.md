# Walkthrough - Juego de la Papa Online

## How to Run
1.  Ensure the server is running:
    ```bash
    npm run dev
    ```
2.  Open your browser at `http://localhost:3000`.

## How to Play (Testing)
1.  **Open two browser tabs/windows** at `http://localhost:3000`.
2.  **Player 1 (Tab 1):**
    - Enter a name (e.g., "P1").
    - Click **"Crear Sala"**.
    - Copy the Room Code displayed at the bottom (e.g., `ABC123`).
3.  **Player 2 (Tab 2):**
    - Enter a name (e.g., "P2").
    - Enter the Room Code from Player 1.
    - Click **"Unirse"**.
4.  **Start Playing:**
    - The game starts automatically when 2 players are in.
    - **Player 1** starts (Green indicator).
    - Draw a line from **1** to **2**.
    - **Player 2** sees the line appear and it becomes their turn (Green indicator).
    - Player 2 draws from **2** to **3**.
5.  **Test Collision:**
    - Try to cross an existing line.
    - You should see the **"¡Juego Terminado!"** screen immediately.

## Features Verified
- [x] Room Creation/Joining
- [x] Multiplayer Sync (Turns, Lines)
- [x] Collision Detection (Instant Loss)
- [x] Win/Loss States
