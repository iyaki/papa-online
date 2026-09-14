const { test, expect } = require('@playwright/test');
const { setupGame } = require('./utils');

// Drag from `fromValue` to a point `pastPx` beyond `toValue` (same direction),
// passing through the target number without releasing there.
async function makeOvershootMove(page, fromValue, toValue, pastPx) {
    await page.waitForFunction(
        () => window.game && window.game.numbers && window.game.numbers.length > 0,
        { timeout: 10000 },
    );

    const coords = await page.evaluate(
        ({ from, to }) => {
            const n1 = window.game.numbers.find((n) => n.value === from);
            const n2 = window.game.numbers.find((n) => n.value === to);
            return { n1, n2 };
        },
        { from: fromValue, to: toValue },
    );

    const canvasBox = await page.locator('#game-canvas').boundingBox();
    const scaleX = canvasBox.width / 600;
    const scaleY = canvasBox.height / 800;

    const startX = canvasBox.x + coords.n1.x * scaleX;
    const startY = canvasBox.y + coords.n1.y * scaleY;
    const endX = canvasBox.x + coords.n2.x * scaleX;
    const endY = canvasBox.y + coords.n2.y * scaleY;

    // Extend the segment past the target number.
    const dx = endX - startX;
    const dy = endY - startY;
    const len = Math.hypot(dx, dy);
    const pastX = endX + (dx / len) * pastPx;
    const pastY = endY + (dy / len) * pastPx;

    // Many steps so an interpolated point lands well inside the 20px snap radius.
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(pastX, pastY, { steps: 30 });
    await page.mouse.up();
}

test.describe('Stroke auto-complete on target number', () => {
    test('overshooting the target number auto-completes the stroke', async ({ browser }) => {
        const { page1, page2, context1, context2 } = await setupGame(browser);

        // Drag 1 -> through 2 -> 50px past it, then release.
        await makeOvershootMove(page1, 1, 2, 50);

        // The move was submitted on reaching number 2: turn swapped, nobody lost.
        await expect(page1.locator('#current-player-display')).toHaveClass(/opponent-turn/);
        await expect(page2.locator('#current-player-display')).toHaveClass(/my-turn/);
        await expect(page1.locator('#game-over-message')).toBeHidden();
        await expect(page2.locator('#game-over-message')).toBeHidden();

        await context1.close();
        await context2.close();
    });

    test('releasing short of the target still discards the stroke', async ({ browser }) => {
        const { page1, page2, context1, context2 } = await setupGame(browser);

        // Drag from 1 toward 2 but stop 40px short of it.
        await makeOvershootMove(page1, 1, 2, -40);

        // Nothing submitted: turn stays on P1, no game over.
        await expect(page1.locator('#current-player-display')).toHaveClass(/my-turn/);
        await expect(page2.locator('#current-player-display')).toHaveClass(/opponent-turn/);
        await expect(page1.locator('#game-over-message')).toBeHidden();

        await context1.close();
        await context2.close();
    });
});
