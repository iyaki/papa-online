const { test, expect } = require('@playwright/test');

test.describe('App version indicator', () => {
    test('lobby shows the running version and loads assets from the versioned prefix', async ({
        page,
    }) => {
        await page.goto('/');
        await expect(page.locator('#app-version')).toHaveText('Versión: dev');
        const moduleSrc = await page.locator('script[type="module"]').getAttribute('src');
        expect(moduleSrc).toMatch(/^\/v\/[^/]+\/main\.js$/);
    });
});
