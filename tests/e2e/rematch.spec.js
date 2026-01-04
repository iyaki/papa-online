const { test, expect } = require('@playwright/test');
const { makeMove, setupGame } = require('./utils');

test.describe('Rematch Functionality', () => {

    test('Full Rematch Flow (Request -> Accept -> New Game)', async ({ browser }) => {
        const { page1, page2, context1, context2 } = await setupGame(browser);

        // 1. End the game quickly (P1 crashes)
        await makeMove(page1, 1, 3);
        await expect(page1.locator('#game-over-message')).toContainText('Perdiste');
        await expect(page2.locator('#game-over-message')).toContainText('Ganaste');

        // 2. Initial state check (game over screen visible)
        await expect(page1.locator('#rematch-btn')).toBeVisible();
        await expect(page2.locator('#rematch-btn')).toBeVisible();

        // 3. P1 Requests Rematch
        await page1.click('#rematch-btn');

        // Verify P1 UI update
        await expect(page1.locator('#rematch-btn')).toBeDisabled();
        await expect(page1.locator('#rematch-btn')).toContainText('Esperando respuesta');
        await expect(page1.locator('#rematch-status')).toContainText('Esperando a que el oponente acepte');

        // Verify P2 Receives Request
        await expect(page2.locator('#rematch-request-container')).toBeVisible(); // The modal/overlay?
        // Actually, check main.js logic:
        // socket.on('rematch_request', () => { ... document.getElementById('rematch-request-container').classList.remove('hidden'); ... })
        await expect(page2.locator('#rematch-request-container')).not.toHaveClass(/hidden/);

        // 4. P2 Accepts Rematch
        await page2.click('#accept-rematch-btn');

        // 5. Verify Game Reset
        // Both game over screens should disappear
        await expect(page1.locator('#game-over-screen')).toHaveClass(/hidden/);
        await expect(page2.locator('#game-over-screen')).toHaveClass(/hidden/);

        // Game canvas should be clear (we can check if numbers are reset)
        // Wait for new numbers to populate
        await page1.waitForFunction(() => window.game && window.game.numbers.length > 0);

        // Check turn logic: P2 accepted, so P2 should start?
        // Server logic: "currentTurn: socket.id" (requester? No, let's check server.js)
        // server.js: 
        // socket.on('respond_rematch', ({ accept }) => { if (accept) { ... currentTurn: socket.id ... } })
        // So the acceptor (P2) starts first.
        
        await expect(page2.locator('#current-player-display')).toHaveClass(/my-turn/);
        await expect(page1.locator('#current-player-display')).toHaveClass(/opponent-turn/);

        // 6. Verify they can play again
        // P2 makes valid move
        await makeMove(page2, 1, 2);
        
        await context1.close();
        await context2.close();
    });
});
