// Shared E2E utilities

async function makeMove(page, fromValue, toValue) {
    // Wait for numbers to be defined and populated
    await page.waitForFunction(() => {
        return window.game && window.game.numbers && window.game.numbers.length > 0;
    }, { timeout: 10000 });

    // Get coordinates from the exposed game instance
    const coords = await page.evaluate(({ from, to }) => {
        if (!window.game || !window.game.numbers) return null;
        const n1 = window.game.numbers.find(n => n.value === from);
        const n2 = window.game.numbers.find(n => n.value === to);
        return { n1, n2 };
    }, { from: fromValue, to: toValue });

    if (!coords || !coords.n1 || !coords.n2) {
        const available = await page.evaluate(() => window.game.numbers.map(n => n.value));
        console.log(`Available numbers: ${available.join(', ')}`);
        throw new Error(`Could not find numbers ${fromValue} or ${toValue}`);
    }

    // Get canvas position to map internal coords to viewport
    const canvasBox = await page.locator('#game-canvas').boundingBox();
    const scaleX = canvasBox.width / 600;
    const scaleY = canvasBox.height / 800;

    const startX = canvasBox.x + coords.n1.x * scaleX;
    const startY = canvasBox.y + coords.n1.y * scaleY;
    const endX = canvasBox.x + coords.n2.x * scaleX;
    const endY = canvasBox.y + coords.n2.y * scaleY;

    // Perform drag
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 5 });
    await page.mouse.up();
}

/**
 * Creates a room with P1 and joins with P2.
 * Returns { roomCode, page1, page2, context1, context2 }
 */
async function setupGame(browser) {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // P1 Creates
    await page1.goto('/');
    await page1.fill('#username-input', 'P1');
    await page1.click('#create-room-btn');
    await page1.waitForSelector('#game-screen', { state: 'visible' });
    
    const roomCode = (await page1.locator('#room-code-display').textContent()).trim();

    // P2 Joins
    await page2.goto('/');
    await page2.fill('#username-input', 'P2');
    await page2.fill('#room-code-input', roomCode);
    await page2.click('#join-room-btn');
    
    // Sync wait
    await page2.waitForSelector('#game-screen', { state: 'visible' });
    await page1.waitForSelector('#game-canvas', { state: 'visible' });
    await page2.waitForSelector('#game-canvas', { state: 'visible' });

    return { roomCode, page1, page2, context1, context2 };
}

module.exports = { makeMove, setupGame };
