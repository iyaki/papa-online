# Implementation Plan - Juego de la Papa Online (Username Persistence)

## Goal Description
Automatically save and restore the player's username using `localStorage` so they don't have to re-enter it every time they visit the page.

## Proposed Changes

### Frontend (Client)
#### [MODIFY] [main.js](file:///home/iyaki/Proyectos/iyaki/papa-online/client/main.js)
- On page load: `usernameInput.value = localStorage.getItem('username') || ''`.
- On `create_room` or `join_room`: `localStorage.setItem('username', usernameInput.value)`.

## Verification Plan
### Manual Verification
1.  Enter username "TestUser".
2.  Create Room.
3.  Reload page.
4.  Verify "TestUser" is still in the input field.
