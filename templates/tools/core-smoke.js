/* Requires a fixture created with --without-plugins. */
const { chromium, firefox, webkit, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const { base } = require('./fixture');

(async () => {
    for (const name of Object.keys(require('./sources.json')).filter(name => name !== 'mort')) {
        if (await fs.stat(`.dev/wiki/lib/plugins/${name}`).catch(() => null)) throw new Error(`Remove ${name}: this check requires --without-plugins.`);
    }
    for (const [name, type] of Object.entries({ chromium, firefox, webkit })) {
        const executablePath = process.env[`CESA_${name.toUpperCase()}_EXECUTABLE`];
        const browser = await type.launch(executablePath ? { executablePath } : {});
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.goto(`${base}/doku.php?id=start`);
        await expect(page.locator('.page h1')).toHaveText('Notebook');
        expect(await page.locator('script[src*="MathJax"]').count()).toBe(0);
        await page.locator('.cesa-appearance summary').click();
        await page.locator('.cesa-appearance button[data-appearance="dark"]').click();
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
        await page.goto(`${base}/doku.php?id=start&do=login`);
        await page.locator('#focus__this').fill('editor');
        await page.locator('input[name=p]').fill('cesa-test-only');
        await page.locator('#dw__login button[type=submit]').click();
        const id = `test:core_${name}_${Date.now()}`;
        await page.goto(`${base}/doku.php?id=${id}&do=edit`);
        const text = '====== Core only ======\n\nAn **accurate** preview.\n';
        await page.locator('#wiki__text').fill(text);
        await page.locator('#edbtn__preview').click();
        await expect(page.locator('.preview strong')).toHaveText('accurate');
        await expect(page.locator('#wiki__text')).toHaveValue(text);
        await page.locator('#edbtn__save').click();
        await expect(page.locator('.page h1')).toHaveText('Core only');
        await page.goto(`${base}/doku.php?id=technical`);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const known = `/${new URL(base).host}/lib/exe/ajax.php due to access control checks.`;
        expect(errors.filter(e => !(name === 'webkit' && e === known))).toEqual([]);
        console.log(`${name} ${browser.version()}: core-only archived install, reading, dark mode, login, preview, save, image/table layout passed`);
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
