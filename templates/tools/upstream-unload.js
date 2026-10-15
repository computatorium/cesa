/* Reproduce Mort's WebKit unload-AJAX diagnostic in both the stock template and Cesa. */
const { webkit } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const { base, atomicWrite } = require('./fixture');

(async () => {
    const conf = path.resolve(__dirname, '../.dev/wiki/conf/local.protected.php');
    const previous = await fs.readFile(conf).catch(() => null);
    const results = [];
    try {
        for (const { template, keepDraft } of [
            { template: 'dokuwiki', keepDraft: false },
            { template: 'dokuwiki', keepDraft: true },
            { template: 'cesa', keepDraft: false },
        ]) {
            await atomicWrite(conf, `<?php\n$conf['template'] = '${template}';\n`);
            const executablePath = process.env.CESA_WEBKIT_EXECUTABLE;
            const browser = await webkit.launch(executablePath ? { executablePath } : {});
            const page = await browser.newPage();
            const errors = [], failedRequests = [];
            page.on('pageerror', e => errors.push(e.message));
            page.on('requestfailed', request => failedRequests.push({
                url: new URL(request.url()).pathname,
                call: new URLSearchParams(request.postData() || '').get('call'),
                reason: request.failure()?.errorText,
            }));
            await page.goto(`${base}/doku.php?do=login`);
            await page.locator('#focus__this').fill('editor');
            await page.locator('input[name=p]').fill('cesa-test-only');
            await page.locator('#dw__login button[type=submit]').click();
            await page.goto(`${base}/doku.php?id=test:unload_${template}_${Date.now()}&do=edit`);
            await page.locator('#wiki__text').fill('====== Upstream unload check ======\n\nReal source.\n');
            await page.locator('#edbtn__preview').click();
            if (keepDraft) await page.evaluate(() => { window.keepDraft = true; });
            await page.locator('#edbtn__save').click();
            await page.waitForLoadState();
            results.push({ template, keepDraft, renderedClass: await page.locator('#dokuwiki__top').getAttribute('class'), browser: browser.version(), errors, failedRequests });
            await browser.close();
        }
    } finally {
        if (previous) await atomicWrite(conf, previous);
        else await fs.unlink(conf);
    }
    console.log(JSON.stringify(results, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
