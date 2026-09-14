const { test, expect } = require('@playwright/test');
const { makeMove, setupGame } = require('./utils');

test.describe('Game Win/Loss Scenarios', () => {
    test('Player 2 Wins (Player 1 crashes)', async ({ browser }) => {
        const { page1, page2, context1, context2 } = await setupGame(browser);

        // 2. Player 1 makes a losing move (1 -> 3, skipping 2)
        await makeMove(page1, 1, 3);

        // 3. Verify Game Over
        await expect(page1.locator('#game-over-message')).toContainText('Perdiste');
        await expect(page2.locator('#game-over-message')).toContainText('Ganaste');

        await context1.close();
        await context2.close();
    });

    test('Player 1 Wins (Player 2 crashes)', async ({ browser }) => {
        const { page1, page2, context1, context2 } = await setupGame(browser);

        // 2. Player 1 makes a VALID move (1 -> 2)
        await makeMove(page1, 1, 2);

        // Verify turn change
        await expect(page2.locator('#current-player-display')).toHaveClass(/my-turn/);
        await expect(page1.locator('#current-player-display')).toHaveClass(/opponent-turn/);

        // 3. Player 2 makes a losing move (2 -> 4, skipping 3)
        await makeMove(page2, 2, 4);

        // 4. Verify Game Over
        await expect(page2.locator('#game-over-message')).toContainText('Perdiste');
        await expect(page1.locator('#game-over-message')).toContainText('Ganaste');

        await context1.close();
        await context2.close();
    });
});
