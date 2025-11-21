# Implementation Plan - Juego de la Papa Online (Shareable Links)

## Goal Description
Allow players to invite others by sharing a direct link to the room.

## Proposed Changes

### Frontend (Client)
#### [MODIFY] [index.html](file:///home/iyaki/Proyectos/iyaki/papa-online/client/index.html)
- Add a "Share" button (icon or text) near the room code display in `#game-info`.

#### [MODIFY] [main.js](file:///home/iyaki/Proyectos/iyaki/papa-online/client/main.js)
- **On Load**:
    - Check `window.location.search` for `room`.
    - If found:
        - Check if `username` is in localStorage.
        - **If Yes**: Emit `join_room` immediately.
        - **If No**:
            - Pre-fill `#room-code-input`.
            - Focus `#username-input`.
            - Optionally show a toast/message: "Ingresa tu nombre para unirte a la sala X".
- **Share Button**:
    - On click, construct URL: `${window.location.origin}/?room=${roomCode}`.
    - Use `navigator.clipboard.writeText()` to copy.
    - Show a temporary "Copied!" feedback.

## Verification Plan
### Manual Verification
1.  Create a room. Click "Share".
2.  Paste link in a new private window (simulating new user).
3.  Verify it asks for username with room code filled.
4.  Enter name -> Verify it joins correctly.
5.  Paste link in a window with existing session.
6.  Verify it auto-joins.
