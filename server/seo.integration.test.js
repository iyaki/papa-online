/**
 * SEO / AEO / GEO Discoverability - Integration Tests
 *
 * Verifies the crawler-facing artifacts: head metadata + JSON-LD on `/`,
 * robots.txt and sitemap.xml. See specs/seo-aeo-discoverability.md.
 */

const { server, io } = require('./server');
const fs = require('node:fs');
const path = require('node:path');

const BASE_URL = 'https://juego-papa.com';

describe('SEO / AEO / GEO Discoverability', () => {
    let httpServerAddr;

    beforeAll((done) => {
        server.listen(() => {
            httpServerAddr = { port: server.address().port };
            done();
        });
    });

    afterAll((done) => {
        io.close();
        server.close(done);
    });

    async function get(path) {
        const res = await fetch(`http://localhost:${httpServerAddr.port}${path}`);
        return { status: res.status, text: await res.text() };
    }

    function jsonLdBlocks(html) {
        return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
            (m) => JSON.parse(m[1]),
        );
    }

    test('V1: / serves meta description, canonical URL and JSON-LD blocks', async () => {
        const { status, text } = await get('/');
        expect(status).toBe(200);

        expect(text).toMatch(/<meta name="description" content="[^"]+"/);
        expect(text).toMatch(new RegExp(`<link rel="canonical" href="${BASE_URL}/">`));

        const blocks = jsonLdBlocks(text);
        const types = blocks.map((b) => b['@type']);
        expect(types).toContain('WebApplication');
        expect(types).toContain('FAQPage');

        const app = blocks.find((b) => b['@type'] === 'WebApplication');
        expect(app.applicationCategory).toBe('GameApplication');
        expect(app.isAccessibleForFree).toBe(true);
        expect(app.offers.price).toBe('0');
        expect(app.inLanguage).toBe('es');
        expect(app.url).toBe(`${BASE_URL}/`);
    });

    // Schema must mirror visible content: compare with tags stripped and whitespace collapsed
    const flat = (s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

    test('V2: FAQPage JSON-LD questions appear verbatim in the served HTML', async () => {
        const { text } = await get('/');
        const faq = jsonLdBlocks(text).find((b) => b['@type'] === 'FAQPage');
        expect(faq.mainEntity.length).toBeGreaterThanOrEqual(4);
        const html = flat(text);
        for (const q of faq.mainEntity) {
            expect(html).toContain(flat(q.name));
            expect(html).toContain(flat(q.acceptedAnswer.text));
        }
    });

    test('V3: robots.txt allows all crawlers and references the sitemap', async () => {
        const { status, text } = await get('/robots.txt');
        expect(status).toBe(200);
        expect(text).toMatch(/User-agent: \*\s+Allow: \//);
        expect(text).toContain(`Sitemap: ${BASE_URL}/sitemap.xml`);
    });

    test('V4: sitemap.xml lists exactly the canonical URL with index.html lastmod', async () => {
        const { status, text } = await get('/sitemap.xml');
        expect(status).toBe(200);
        expect(text).toContain(`<loc>${BASE_URL}/</loc>`);
        expect(text.match(/<loc>/g)).toHaveLength(1);

        const lastmod = text.match(/<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/)?.[1];
        expect(lastmod).toBeDefined();
        const expected = fs
            .statSync(path.join(__dirname, '../client/index.html'))
            .mtime.toISOString()
            .slice(0, 10);
        expect(lastmod).toBe(expected);
        expect(new Date(lastmod).getTime()).toBeLessThanOrEqual(Date.now());
    });
});
