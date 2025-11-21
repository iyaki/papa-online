# Implementation Plan - Juego de la Papa Online (Mobile Optimization)

## Goal Description
Optimize the user interface for mobile devices, prioritizing usability on small touch screens over desktop layouts.

## Proposed Changes

### Frontend (Client)
#### [MODIFY] [style.css](file:///home/iyaki/Proyectos/iyaki/papa-online/client/style.css)
- **Global**:
    - Remove fixed widths (`max-width: 800px` -> `width: 100%`, `padding: 10px`).
    - Increase base font size for readability.
- **Lobby**:
    - Stack controls vertically.
    - Inputs and Buttons: `width: 100%`, `padding: 15px` (larger touch targets).
    - "My Games" list: Card style, full width, easy to tap.
- **Game Screen**:
    - **Info Bar**: Make it compact. Maybe 2 rows: [Menu | Room] and [Turn | Next].
    - **Canvas**: Ensure `width: 100%`. Maintain aspect ratio but ensure it fits within the viewport height if possible (or allow scrolling if necessary, but drawing while scrolling is bad).
    - **Prevent Scrolling**: Add `touch-action: none` to canvas to prevent page scrolling while drawing.

#### [MODIFY] [game.js](file:///home/iyaki/Proyectos/iyaki/papa-online/client/game.js)
- Verify `touchstart`, `touchmove`, `touchend` handlers.
- Ensure `e.preventDefault()` is called to stop scrolling.

## Verification Plan
### Manual Verification
1.  Open game on mobile device (or browser dev tools mobile mode).
2.  Verify Lobby layout is stacked and easy to use.
3.  Verify Game Screen fits width.
4.  Test drawing: Ensure page doesn't scroll when dragging on canvas.
5.  Test "My Games" list scrolling and tapping.
