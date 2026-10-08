/**
 * PWA artifacts (V4 of specs/pwa-push-notifications.md):
 * manifest, service worker, generated icons and the head links that wire them.
 */

const { test, expect } = require('@playwright/test');

test.describe('PWA artifacts', () => {
    test('manifest.json is served with name and 192/512 icons', async ({ request }) => {
        const res = await request.get('/manifest.json');
        expect(res.status()).toBe(200);
        const manifest = await res.json();
        expect(manifest.name).toBe('Juego de la Papa');
        expect(manifest.display).toBe('standalone');
        const sizes = manifest.icons.map((icon) => icon.sizes);
        expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
    });

    test('sw.js is served and handles push events', async ({ request }) => {
        const res = await request.get('/sw.js');
        expect(res.status()).toBe(200);
        const src = await res.text();
        expect(src).toContain("addEventListener('push'");
        expect(src).toContain('showNotification');
    });

    test('icon-192.png is a real PNG (magic bytes, not a renamed JPEG)', async ({ request }) => {
        const res = await request.get('/icon-192.png');
        expect(res.status()).toBe(200);
        const body = await res.body();
        expect(body.subarray(0, 4).toString('latin1')).toBe('\x89PNG');
    });

    test('index.html links the manifest and apple-touch-icon', async ({ request }) => {
        const res = await request.get('/');
        expect(res.status()).toBe(200);
        const html = await res.text();
        expect(html).toContain('rel="manifest"');
        expect(html).toContain('apple-touch-icon');
    });
});
