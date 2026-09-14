const { test, expect } = require('@playwright/test');

test.describe('Multiplayer Game Flow', () => {
    test('Player 1 creates room and Player 2 joins', async ({ browser }) => {
        // Create two isolated browser contexts (like two different users)
        const context1 = await browser.newContext();
        const context2 = await browser.newContext();

        const page1 = await context1.newPage();
        const page2 = await context2.newPage();

        // --- Player 1: Create Room ---
        await page1.goto('/');
        await page1.fill('#username-input', 'Jugador 1');
        await page1.click('#create-room-btn');

        // Wait for room to be created and get the code
        await expect(page1.locator('#game-screen')).toBeVisible();
        await expect(page1.locator('#room-code-display')).not.toBeEmpty();

        // Extract room code
        const roomCodeText = await page1.locator('#room-code-display').textContent();
        // Assuming format "Sala: XXXXXX", we just want the code if it's text,
        // but looking at valid HTML it seems #room-code-display contains just the code or "Sala: CODE"?
        // In index.html: Sala: <span id="room-code-display"></span>. So the span has just the code via roomCodeDisplay.textContent = roomCode
        const roomCode = roomCodeText.trim();
        console.log(`Room created: ${roomCode}`);

        // --- Player 2: Join Room ---
        await page2.goto('/');
        await page2.fill('#username-input', 'Jugador 2');
        await page2.fill('#room-code-input', roomCode);
        await page2.click('#join-room-btn');

        // Wait for Player 2 to enter game
        await expect(page2.locator('#game-screen')).toBeVisible();
        await expect(page2.locator('#room-code-display')).toHaveText(roomCode);

        // Verify Opponent Names
        // Player 1 should see Player 2 as opponent (this info might be in the turn indicator or lobby list,
        // but in game screen it's just "Sala: ...")
        // Let's check if the game started notification or elements are present.
        // The "current-player-display" should show whose turn it is.
        await expect(page1.locator('#turn-indicator')).toBeVisible();
        await expect(page2.locator('#turn-indicator')).toBeVisible();

        // Verify "Mis Partidas" update in the lobby (we need to go back or check if it updated in background?
        // The test usually ends here for basic flow, but let's check basic interaction)

        // Check canvas exists
        await expect(page1.locator('#game-canvas')).toBeVisible();
        await expect(page2.locator('#game-canvas')).toBeVisible();

        // Cleanup
        await context1.close();
        await context2.close();
    });
});
