const { test, expect } = require('@playwright/test');
const { createPlayerContext } = require('./utils');

test.describe('Player Onboarding', () => {
    test('tutorial overlay appears on first game and is remembered after dismissal', async ({
        browser,
    }) => {
        const context = await browser.newContext(); // fresh player, no flag
        const page = await context.newPage();

        await page.goto('/');
        await page.fill('#username-input', 'Nuevo');
        await page.click('#create-room-btn');

        const overlay = page.locator('#tutorial-overlay');
        await expect(overlay).toBeVisible();
        await expect(overlay).toContainText('para 2');

        await page.click('#tutorial-dismiss-btn');
        await expect(overlay).toBeHidden();
        // First-game solo creator: invite hint shows until the rival joins
        await expect(page.locator('#invite-hint')).toBeVisible();

        // Second game in the same browser: flag persisted, no overlay
        await page.click('#back-to-menu-btn');
        await page.click('#create-room-btn');
        await expect(page.locator('#game-screen')).toBeVisible();
        await expect(overlay).toBeHidden();
    });

    test('returning player sees no tutorial overlay', async ({ browser }) => {
        const context = await createPlayerContext(browser);
        const page = await context.newPage();

        await page.goto('/');
        await expect(page.locator('#lobby-screen')).toContainText('Empezar partida');
        await expect(page.locator('#lobby-screen')).toContainText('para 2 jugadores');

        await page.fill('#username-input', 'Veterano');
        await page.click('#create-room-btn');

        await expect(page.locator('#game-screen')).toBeVisible();
        await expect(page.locator('#tutorial-overlay')).toBeHidden();
        await expect(page.locator('#invite-hint')).toBeHidden();
    });

    test('invite hint appears for first-time creator and hides when the rival joins', async ({
        browser,
    }) => {
        const p1Context = await browser.newContext(); // fresh creator
        const page1 = await p1Context.newPage();
        await page1.goto('/');
        await page1.fill('#username-input', 'P1');
        await page1.click('#create-room-btn');
        await expect(page1.locator('#tutorial-overlay')).toBeVisible();
        await page1.click('#tutorial-dismiss-btn');
        await expect(page1.locator('#invite-hint')).toBeVisible();

        const roomCode = (await page1.locator('#room-code-display').textContent()).trim();

        const p2Context = await browser.newContext();
        const page2 = await p2Context.newPage();
        await page2.goto('/');
        await page2.fill('#username-input', 'P2');
        await page2.fill('#room-code-input', roomCode);
        await page2.click('#join-room-btn');
        await expect(page2.locator('#game-screen')).toBeVisible();

        await expect(page1.locator('#invite-hint')).toBeHidden();
    });

    test('first-time joiner sees the tutorial overlay', async ({ browser }) => {
        const p1Context = await createPlayerContext(browser);
        const page1 = await p1Context.newPage();
        await page1.goto('/');
        await page1.fill('#username-input', 'P1');
        await page1.click('#create-room-btn');
        await expect(page1.locator('#game-screen')).toBeVisible();

        const roomCode = (await page1.locator('#room-code-display').textContent()).trim();

        const p2Context = await browser.newContext(); // fresh joiner
        const page2 = await p2Context.newPage();
        await page2.goto('/');
        await page2.fill('#username-input', 'P2');
        await page2.fill('#room-code-input', roomCode);
        await page2.click('#join-room-btn');

        await expect(page2.locator('#game-screen')).toBeVisible();
        await expect(page2.locator('#tutorial-overlay')).toBeVisible();
        await expect(page1.locator('#tutorial-overlay')).toBeHidden();

        await page2.click('#tutorial-dismiss-btn');
        await expect(page2.locator('#invite-hint')).toBeHidden();
    });

    test('help screen explains interaction and losing rules', async ({ page }) => {
        await page.goto('/');
        await page.click('#faq-btn');

        const faq = page.locator('#faq-screen');
        await expect(faq).toBeVisible();
        await expect(faq).toContainText('se completa sola');
        await expect(faq).toContainText('reintentar');
        await expect(faq).toContainText('no es el siguiente');
        await expect(page.locator('#faq-diagram')).toBeVisible();

        await page.click('#close-faq-btn');
        await expect(faq).toBeHidden();
    });
});
