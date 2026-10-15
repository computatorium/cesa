const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const { base, atomicWrite, removeFile } = require('../tools/fixture');
const evidence = require('../tools/evidence');
const password = 'cesa-test-only';
const uid = (testInfo, name) => `test:${testInfo.project.name}_${name}_${Date.now()}`;
const url = (id, action = '') => `/doku.php?id=${encodeURIComponent(id)}${action ? `&do=${action}` : ''}`;
async function setAppearance(page, mode) {
    await page.locator('.cesa-appearance summary').click();
    await page.locator(`.cesa-appearance button[data-appearance="${mode}"]`).click();
}
async function localFavicons(context) {
    await context.route('https://www.faviconextractor.com/favicon/**', route => route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="#315c9e"/></svg>',
    }));
}

async function login(page, user = 'editor') {
    await page.goto(url('start', 'login'));
    await page.locator('#focus__this').fill(user);
    await page.locator('input[name="p"]').fill(password);
    await page.locator('#dw__login button[type="submit"]').click();
    await expect(page.locator('#dokuwiki__top')).toHaveClass(/loggedIn/);
    await page.waitForLoadState('load');
}
async function save(page, id, text, summary = 'Browser workflow') {
    await page.goto(url(id, 'edit'));
    await page.locator('#wiki__text').fill(text);
    await page.locator('#edit__summary').fill(summary);
    await page.locator('#edbtn__save').click();
    await expect(page.locator('#dokuwiki__top')).toHaveClass(/mode_show/);
    await page.waitForLoadState('load');
}
async function raw(page, id) {
    return (await page.request.get(url(id, 'export_raw'))).text();
}
async function cancel(page) {
    // Native DokuWiki asks for confirmation on deliberate Cancel when text is changed.
    const handler = dialog => dialog.accept();
    page.on('dialog', handler);
    await page.locator('button[name="do[cancel]"]').click();
    await expect(page.locator('#wiki__text')).toHaveCount(0);
    await page.waitForLoadState('load');
    page.off('dialog', handler);
}
async function noOverflow(page) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}
async function mathReady(page, selector = '.page') {
    await expect(page.locator(`${selector} .MathJax_CHTML`).first()).toBeVisible();
    await page.evaluate(() => new Promise(resolve => MathJax.Hub.Queue(resolve)));
}

async function inlineMathBaseline(page) {
    const shifts = await page.locator('.MathJax_CHTML').evaluateAll(nodes => nodes
        .filter(node => !node.closest('.MJXc-display'))
        .map(node => {
            const glyph = node.querySelector('.mjx-char');
            const original = node.getAttribute('style');
            const before = glyph.getBoundingClientRect().y;
            node.style.setProperty('overflow', 'visible', 'important');
            const shift = Math.abs(glyph.getBoundingClientRect().y - before);
            if (original === null) node.removeAttribute('style'); else node.setAttribute('style', original);
            return shift;
        }));
    expect(shifts.length).toBeGreaterThan(0);
    expect(Math.max(...shifts)).toBeLessThan(.1);
}

test('one stable reading column for articles, login, sitemap, media, history and editing', async ({ page }, testInfo) => {
    for (const width of [360, 768, 1280, 1920]) {
        await page.setViewportSize({ width, height: 960 });
        let column;
        for (const action of ['', 'login', 'index', 'media', 'revisions', 'edit']) {
            await page.goto(url('technical', action));
            const box = await page.locator('.cesa-layout').boundingBox();
            if (!column) column = box;
            expect(box.x).toBeCloseTo(column.x, 0);
            expect(box.width).toBeCloseTo(column.width, 0);
            await expect(page.locator('.trace, .bchead')).toHaveCount(0);
            await noOverflow(page);
            if (action === 'login') {
                const form = await page.locator('#dw__login').boundingBox();
                expect(form.x + form.width / 2).toBeCloseTo(column.x + column.width / 2, 0);
                await expect(page.locator('#dw__login fieldset')).toHaveCSS('border-top-width', '0px');
                await expect(page.locator('#remember__me')).toHaveCSS('appearance', 'none');
                for (const appearance of ['light', 'dark']) {
                    await setAppearance(page, appearance);
                    if (testInfo.project.name === 'chromium') await page.screenshot({ path: `docs/screenshots/chromium-login-${width}-${appearance}.png` });
                }
            }
        }
    }
});

test('custom selects preserve keyboard, pointer, multiple values, core changes and reset', async ({ page }) => {
    await page.goto(url('start'));
    await page.locator('.page').evaluate(e => e.insertAdjacentHTML('beforeend', `<form id="control-fixture">
        <label for="control-choice">Choice</label><select id="control-choice" name="choice" required>
        <option value="a">Alpha</option><option value="b" disabled>Beta</option>
        <optgroup label="More"><option value="g">Gamma</option><option value="d">Delta</option></optgroup></select>
        <label for="control-many">Many</label><select id="control-many" name="many" multiple>
        <option value="x" selected>First</option><option value="y">Second</option></select>
        <label><input type="checkbox" id="control-check">Check</label>
        <label><input type="radio" id="control-radio-a" name="radio" value="a" checked>One</label>
        <label><input type="radio" id="control-radio-b" name="radio" value="b">Two</label>
        <button type="reset">Reset</button></form>`));
    const choice = page.getByRole('combobox', { name: 'Choice', exact: true });
    await choice.focus();
    await choice.press('Space');
    await expect(choice).toHaveAttribute('aria-expanded', 'true');
    await choice.press('Alt+ArrowUp');
    await expect(choice).toHaveAttribute('aria-expanded', 'false');
    await choice.press('Alt+ArrowDown');
    await expect(choice).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('option', { name: 'Beta', exact: true })).toHaveAttribute('aria-disabled', 'true');
    await choice.press('ArrowDown');
    await choice.press('Enter');
    await expect(page.locator('#control-choice')).toHaveValue('g');
    await choice.click();
    await expect(page.getByRole('group', { name: 'More', exact: true })).toBeVisible();
    await page.locator('.cesa-option-group').click();
    await expect(choice).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('group', { name: 'More', exact: true }).getByRole('option')).toHaveCount(2);
    await page.getByRole('option', { name: 'Delta', exact: true }).click();
    await expect(choice).toHaveText('Delta');
    await page.locator('#control-choice').evaluate(e => jQuery(e).val('a').trigger('change'));
    await expect(choice).toHaveText('Alpha');
    await page.locator('#control-choice').evaluate(e => e.add(new Option('Epsilon', 'e')));
    await choice.focus();
    await choice.press('e');
    await choice.press('Enter');
    await expect(choice).toHaveText('Epsilon');
    const many = page.getByRole('combobox', { name: 'Many', exact: true });
    await many.click();
    await page.getByRole('option', { name: 'Second', exact: true }).click();
    await expect(many).toHaveAttribute('aria-expanded', 'true');
    expect(await page.locator('#control-fixture').evaluate(e => new FormData(e).getAll('many'))).toEqual(['x', 'y']);
    await many.press('Escape');
    await expect(many).toBeFocused();
    await many.press('Alt+ArrowDown');
    await many.press('Alt+ArrowUp');
    expect(await page.locator('#control-fixture').evaluate(e => new FormData(e).getAll('many'))).toEqual(['x', 'y']);
    await page.locator('#control-check').focus();
    await page.locator('#control-check').press('Space');
    await expect(page.locator('#control-check')).toBeChecked();
    await page.locator('#control-radio-a').focus();
    await page.locator('#control-radio-a').press('ArrowRight');
    await expect(page.locator('#control-radio-b')).toBeChecked();
    for (const id of ['#control-check', '#control-radio-a', '#control-radio-b']) await expect(page.locator(id)).toHaveCSS('appearance', 'none');
    await page.locator('#control-fixture button[type="reset"]').click();
    await expect(choice).toHaveText('Alpha');
    await expect(many).toHaveText('First');
    await page.locator('#control-choice').evaluate(e => { e.disabled = true; });
    await expect(choice).toBeDisabled();
    await page.locator('#control-choice').evaluate(e => { e.disabled = false; });
    await page.locator('#control-choice').evaluate(e => { e.hidden = true; });
    await expect(choice).toBeHidden();
    await page.locator('#control-choice').evaluate(e => { e.hidden = false; e.selectedIndex = -1; jQuery(e).trigger('change'); });
    expect(await page.locator('#control-fixture').evaluate(e => e.checkValidity())).toBe(false);
    await expect(choice).toHaveAttribute('aria-invalid', 'true');
    await choice.press('a');
    await choice.press('Enter');
    await expect(page.locator('#control-choice')).toHaveValue('a');
    await expect(choice).toHaveAttribute('aria-invalid', 'false');
    await choice.click();
    await page.keyboard.press('Tab');
    await expect(choice).toHaveAttribute('aria-expanded', 'false');
    await page.locator('.page').evaluate(e => e.insertAdjacentHTML('beforeend', '<form id="reset-destination" dir="rtl"></form>'));
    await page.locator('#control-choice').evaluate(e => document.querySelector('#reset-destination').append(e));
    await expect(page.locator('#control-fixture .cesa-select-trigger')).toHaveCount(1);
    await expect(page.locator('#reset-destination .cesa-select-trigger')).toHaveCount(1);
    await choice.click();
    await expect(page.locator('.cesa-select-options:visible')).toHaveCSS('direction', 'rtl');
    const triggerBox = await choice.boundingBox();
    const optionBox = await page.locator('.cesa-select-options:visible').boundingBox();
    expect(optionBox.x + optionBox.width).toBeCloseTo(triggerBox.x + triggerBox.width, 0);
    await page.getByRole('option', { name: 'Gamma', exact: true }).click();
    await page.locator('#reset-destination').evaluate(e => e.reset());
    await expect(choice).toHaveText('Alpha');
    await page.locator('#control-choice').evaluate(e => { e.setAttribute('form', 'control-fixture'); e.value = 'd'; jQuery(e).trigger('change'); });
    await expect(choice).toHaveText('Delta');
    await page.locator('#control-fixture').evaluate(e => e.reset());
    await expect(choice).toHaveText('Alpha');
    await page.locator('#control-choice').evaluate(e => { window.detachedChoice = e.parentElement; e.parentElement.remove(); });
    await expect(choice).toHaveCount(0);
    await page.locator('#reset-destination').evaluate(e => e.append(window.detachedChoice));
    await expect(choice).toHaveCount(1);
    await choice.click();
    await page.getByRole('option', { name: 'Gamma', exact: true }).click();
    await expect(page.locator('#control-choice')).toHaveValue('g');
    await page.locator('#control-choice').evaluate(e => e.remove());
    await expect(choice).toHaveCount(0);
    await expect(page.locator('#reset-destination .cesa-select')).toHaveCount(0);
    await page.locator('#control-fixture').evaluate(e => e.remove());
    await expect(page.locator('.cesa-select-options')).toHaveCount(0);
});

test.beforeEach(async ({ page, browser }, testInfo) => {
    await localFavicons(page.context());
    await testInfo.attach('cesa-verification-context', { body: JSON.stringify(evidence(browser)), contentType: 'application/json' });
    page.errors = [];
    page.on('pageerror', error => page.errors.push(error.message));
});
test.afterEach(async ({ page }, testInfo) => {
    // Mort's native deleteDraft() issues an async POST during unload. WebKit rejects it.
    // Reproduced unchanged with the stock template: node tools/upstream-unload.js.
    const nativeUnload = `/${new URL(base).host}/lib/exe/ajax.php due to access control checks.`;
    const known = testInfo.project.name === 'webkit' ? page.errors.filter(error => error === nativeUnload) : [];
    if (known.length) await testInfo.attach('upstream-webkit-unload-diagnostics', {
        body: JSON.stringify({ count: known.length, message: nativeUnload }), contentType: 'application/json',
    });
    expect(page.errors.filter(error => !known.includes(error))).toEqual([]);
    if (!page.isClosed()) await page.evaluate(() => { window.onbeforeunload = null; window.keepDraft = true; }).catch(() => {});
});

test('reading, keyboard navigation, contents, hooks and native actions', async ({ page }, testInfo) => {
    await page.goto(url('start'));
    await expect(page.locator('.page h1')).toHaveText('Notebook');
    await expect(page.locator('.docInfo')).toHaveCount(0);
    await expect(page.locator('.cesa-footer-meta')).toHaveText(/^License: .+ \| Last modified: \d{4}\/\d{2}\/\d{2}/);
    await expect(page.locator('.page')).toHaveCSS('font-size', '18px');
    expect(await page.locator('.page').evaluate(e => parseFloat(getComputedStyle(e).lineHeight))).toBeCloseTo(28.8, 3);
    await expect(page.locator('#dokuwiki__aside .cesa-navigation')).toHaveCount(2);
    await expect(page.locator('#dokuwiki__pagetools > a')).toHaveText('Show pagesource');
    // macOS WebKit uses Option+Tab to include links when full keyboard access is off.
    await page.keyboard.press(testInfo.project.name === 'webkit' ? 'Alt+Tab' : 'Tab');
    await expect(page.locator('.cesa-skip')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#dokuwiki__content')).toBeFocused();
    for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 960 });
        if (width === 390) await page.goto(url('start'));
        const contents = page.locator('#dokuwiki__aside details').filter({ has: page.locator('#dw__toc') });
        await contents.locator('summary').click();
        await page.locator('#dw__toc a').filter({ hasText: /^Work$/ }).click();
        await expect(page).toHaveURL(/#work$/);
        await expect(contents).not.toHaveAttribute('open');
        const nav = await page.locator('#dokuwiki__aside').boundingBox();
        const heading = await page.locator('#work').boundingBox();
        expect(heading.y).toBeGreaterThanOrEqual(nav.y + nav.height);
    }
    await page.setViewportSize({ width: 1280, height: 960 });
    const tools = page.locator('#dokuwiki__pagetools details');
    await tools.locator('summary').click();
    await expect(tools.locator('a')).not.toHaveCount(0);
    await tools.locator('a').first().focus();
    await page.keyboard.press('Escape');
    await expect(tools).not.toHaveAttribute('open');
    await expect(tools.locator('summary')).toBeFocused();
    await page.locator('#qsearch__in').focus();
    await tools.locator('summary').evaluate(e => e.click());
    await page.keyboard.press('Escape');
    await expect(tools).not.toHaveAttribute('open');
    await expect(tools.locator('summary')).toBeFocused();
    await tools.locator('summary').click();
    await tools.locator('a').last().focus();
    await page.keyboard.press(testInfo.project.name === 'webkit' ? 'Alt+Tab' : 'Tab');
    await expect(tools).not.toHaveAttribute('open');
    await expect(page.locator('img[src*="taskrunner.php"]')).toHaveCount(1);
    await tools.locator('ul').evaluate(e => e.insertAdjacentHTML('beforeend', '<li><select aria-label="Menu choice"><option>One</option><option>Two</option></select></li>'));
    await tools.locator('summary').click();
    const nested = tools.locator('.cesa-select-trigger');
    await nested.click();
    await page.getByRole('option', { name: 'Two', exact: true }).click();
    await expect(nested).toHaveText('Two');
    await expect(nested).toBeFocused();
    await expect(tools).toHaveAttribute('open', '');
    await nested.click();
    await nested.press('Escape');
    await expect(nested).toHaveAttribute('aria-expanded', 'false');
    await expect(tools).toHaveAttribute('open', '');
    await nested.press('Escape');
    await expect(tools).not.toHaveAttribute('open');
    await noOverflow(page);
});

test('sticky navigation, centered compact summary and consistent sitemap expansion', async ({ page }, testInfo) => {
    for (const width of [390, 1280, 1920]) {
        await page.setViewportSize({ width, height: 960 });
        await page.goto(url('essay'));
        const margin = await page.locator('#dokuwiki__top').evaluate(e => e.classList.contains('cesa-rail-margin'));
        const aside = page.locator('#dokuwiki__aside');
        const summary = aside.locator('summary').first();
        await expect(summary.locator('span')).toHaveCSS('text-decoration-line', 'none');
        await expect(summary).toHaveCSS('text-decoration-line', 'none');
        expect(await summary.evaluate(e => getComputedStyle(e, '::before').textDecorationLine)).toBe('none');
        if (!margin) {
            const a = await aside.boundingBox(), s = await summary.boundingBox();
            expect(Math.abs((s.y - a.y) - (a.y + a.height - s.y - s.height))).toBeLessThanOrEqual(1.1);
        }
        await page.evaluate(() => scrollTo(0, 700));
        await expect.poll(async () => (await aside.boundingBox()).y).toBeGreaterThanOrEqual(0);
        expect((await aside.boundingBox()).y).toBeLessThanOrEqual(17);
        const contents = aside.locator('details').filter({ has: page.locator('#dw__toc') });
        if (await contents.getAttribute('open') === null) await contents.locator('summary').click();
        await contents.getByRole('link', { name: 'Context', exact: true }).click();
        await expect(page).toHaveURL(/#context$/);
        if (!margin) {
            await expect(contents).not.toHaveAttribute('open');
            const nav = await aside.boundingBox(), heading = await page.locator('#context').boundingBox();
            expect(heading.y).toBeGreaterThanOrEqual(nav.y + nav.height);
        }
        await noOverflow(page);
        if (testInfo.project.name === 'chromium') await page.screenshot({ path: `docs/screenshots/chromium-sticky-${width}.png` });
    }
    await page.goto(url('start', 'index'));
    const folder = page.locator('#index__tree a.idx_dir[title="notes"]');
    expect(await folder.evaluate(e => getComputedStyle(e, '::before').content)).toBe('"+"');
    await folder.focus();
    const loaded = page.waitForResponse(r => r.url().includes('ajax.php') && r.request().postData()?.includes('call=index'));
    await folder.press('Enter');
    expect((await loaded).ok()).toBe(true);
    await expect(folder.locator('xpath=../..')).toHaveClass(/open/);
    expect(await folder.evaluate(e => getComputedStyle(e, '::before').content)).toBe('"−"');
    await expect(page.locator('#index__tree a[title="notes:question"]')).toBeVisible();
    await folder.press('Enter');
    await expect(folder.locator('xpath=../..')).toHaveClass(/closed/);
});

test('footnotes and return anchors clear the sticky compact navigation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(url('technical'));
    await page.locator('.page').evaluate(e => e.insertAdjacentHTML('beforeend', '<div style="height:100vh" aria-hidden="true"></div>'));
    for (const [link, target] of [['.fn_top', '#fn__1'], ['.fn_bot', '#fnt__1']]) {
        await page.locator(link).first().focus();
        await page.locator(link).first().press('Enter');
        await expect(page).toHaveURL(new RegExp(`${target}$`));
        const nav = await page.locator('#dokuwiki__aside').boundingBox();
        const anchor = await page.locator(target).boundingBox();
        expect(anchor.y).toBeGreaterThanOrEqual(nav.y + nav.height);
        expect(anchor.y + anchor.height).toBeLessThan(844);
    }
    await page.locator('.fn_top').first().click();
    await expect(page).toHaveURL(/#fn__1$/);
    await page.mouse.move(0, 0);
    await page.locator('.fn_top').first().hover();
    await expect(page.locator('#insitu__fn')).toBeVisible();
    const boxes = await page.evaluate(() => ({
        source: document.querySelector('.fn_top').getBoundingClientRect().toJSON(),
        popup: document.querySelector('#insitu__fn').getBoundingClientRect().toJSON(),
    }));
    const gap = boxes.popup.y > boxes.source.y ? (boxes.source.bottom + boxes.popup.y) / 2 : (boxes.popup.bottom + boxes.source.y) / 2;
    await page.mouse.move(boxes.popup.x + 1, gap);
    await page.mouse.move(boxes.popup.x + boxes.popup.width / 2, boxes.popup.y + boxes.popup.height / 2);
    await expect(page.locator('#insitu__fn')).toBeVisible();
    await page.mouse.move(0, 0);
    await expect(page.locator('#insitu__fn')).toBeHidden();
});

test('enlarged text, touch controls, open menus and whole-shell RTL reflow', async ({ page, browser }) => {
    for (const width of [320, 360, 390]) {
        await page.setViewportSize({ width, height: 844 });
        await page.goto(url('essay'));
        await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
        for (const direction of ['ltr', 'rtl']) {
            await page.locator('html').evaluate((e, dir) => { e.dir = dir; }, direction);
            await page.locator('#dokuwiki__usertools summary').click();
            await expect(page.locator('#dokuwiki__usertools > ul')).not.toHaveCSS('box-shadow', 'none');
            for (const selector of ['.cesa-header-controls', '#dokuwiki__usertools > ul']) {
                const box = await page.locator(selector).boundingBox();
                expect(box.x).toBeGreaterThanOrEqual(0);
                expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
            }
            await expect(page.locator('.cesa-appearance button')).toHaveCount(3);
            await expect(page.locator('.cesa-appearance button[aria-pressed="true"]')).toHaveCount(1);
            await page.locator('#dokuwiki__usertools summary').click();
            await page.locator('#dokuwiki__pagetools summary').click();
            const menu = await page.locator('#dokuwiki__pagetools details > ul').boundingBox();
            expect(menu.x).toBeGreaterThanOrEqual(0);
            expect(menu.x + menu.width).toBeLessThanOrEqual(width + 1);
            await page.locator('#dokuwiki__pagetools summary').click();
            await noOverflow(page);
        }
    }
    const context = await browser.newContext({ baseURL: base, hasTouch: true, viewport: { width: 1280, height: 960 } });
    await localFavicons(context);
    const touch = await context.newPage();
    await touch.goto(url('start'));
    expect(await touch.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
    for (const selector of ['.cesa-appearance summary', '#qsearch__in', '#dw__search button']) {
        expect((await touch.locator(selector).boundingBox()).height).toBeCloseTo(44, 0);
        await expect(touch.locator(selector)).toHaveCSS('font-size', '16px');
    }
    await context.close();
});

test('System, Light and Dark persist and follow live system changes', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(url('start'));
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const picker = page.locator('.cesa-appearance');
    await expect(picker.locator('.cesa-theme-icon[data-mode="system"]')).toBeVisible();
    await expect(picker.locator('button').first()).toBeHidden();
    await picker.locator('summary').focus();
    await picker.locator('summary').press('Enter');
    await expect(picker.getByRole('button', { name: 'Light', exact: true })).toBeVisible();
    await picker.getByRole('button', { name: 'Light', exact: true }).focus();
    await page.keyboard.press('Escape');
    await expect(picker).not.toHaveAttribute('open');
    await expect(picker.locator('summary')).toBeFocused();
    await setAppearance(page, 'light');
    await expect(picker.locator('.cesa-theme-icon[data-mode="light"]')).toBeVisible();
    await expect(picker).not.toHaveAttribute('open');
    await picker.locator('summary').click();
    await page.locator('#qsearch__in').click();
    await expect(picker).not.toHaveAttribute('open');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.emulateMedia({ colorScheme: 'light' });
    await setAppearance(page, 'dark');
    await expect(picker.locator('.cesa-theme-icon[data-mode="dark"]')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await setAppearance(page, 'system');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('shared shell aligns header, rail and content with consistent relative controls', async ({ page }) => {
    for (const width of [360, 390, 700, 701, 768, 1099, 1100, 1280, 1920]) {
        await page.setViewportSize({ width, height: 960 });
        await page.goto(url('essay'));
        const geometry = await page.evaluate(() => {
            const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
            const controls = ['.cesa-appearance summary', '#qsearch__in', '#dw__search button'].map(selector => {
                const e = document.querySelector(selector), style = getComputedStyle(e);
                return { ...rect(selector), font: style.fontSize, family: style.fontFamily };
            });
            return { header: rect('#dokuwiki__header'), rail: rect('#dokuwiki__aside'), content: rect('#dokuwiki__content'), margin: document.querySelector('#dokuwiki__top').classList.contains('cesa-rail-margin'), controls };
        });
        expect(Math.abs(geometry.header.left - geometry.content.left)).toBeLessThan(1);
        if (geometry.margin) expect(geometry.rail.right).toBeLessThan(geometry.content.left);
        else expect(Math.abs(geometry.header.left - geometry.rail.left)).toBeLessThan(1);
        expect(Math.abs(geometry.header.right - geometry.content.right)).toBeLessThan(1);
        expect(Math.abs(geometry.header.right - geometry.controls[2].right)).toBeLessThan(1);
        for (const control of geometry.controls) {
            expect(control.height).toBeCloseTo(width <= 700 ? 44 : 36, 0);
            expect(control.font).toBe(geometry.controls[0].font);
            expect(control.family).toBe(geometry.controls[0].family);
        }
        await noOverflow(page);
    }
    // Enlarged root text scales the entire type/control/spacing system together.
    await page.addStyleTag({ content: 'html { font-size: 125% !important; }' });
    await expect(page.locator('.page')).toHaveCSS('font-size', '22.5px');
    for (const selector of ['.cesa-appearance summary', '#qsearch__in', '#dw__search button']) {
        expect((await page.locator(selector).boundingBox()).height).toBeCloseTo(45, 0);
    }
    await noOverflow(page);
});

test('wide tables and source blocks scroll using the keyboard', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(url('technical'));
    await expect(page.locator('.page pre').last()).not.toHaveAttribute('tabindex');
    for (const selector of ['.page .table', '.page pre']) {
        const region = page.locator(selector).first();
        await expect(region).toHaveAttribute('tabindex', '0');
        await region.focus();
        await page.keyboard.press('ArrowRight');
        await expect.poll(() => region.evaluate(e => e.scrollLeft)).toBeGreaterThan(0);
    }
    await noOverflow(page);
});

test('stored appearance is applied before the stylesheet can paint', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('cesa.appearance', 'dark'));
    const observed = [];
    await page.route('**/lib/exe/css.php*', async route => {
        observed.push(await page.evaluate(() => document.documentElement.getAttribute('data-theme')));
        await route.continue();
    });
    await page.goto(url('start'));
    expect(observed).toContain('dark');
});

test('blocked browser storage still allows appearance and navigation', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }));
    await page.goto(url('start'));
    await setAppearance(page, 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const navigation = page.locator('#dokuwiki__aside details').first();
    if (await navigation.getAttribute('open') === null) await navigation.locator('summary').click();
    await page.locator('#dokuwiki__aside a').filter({ hasText: /^Bookmarks$/ }).click();
    await expect(page.locator('.page h1')).toHaveText('Bookmarks');
});

test('no JavaScript: reading, disclosure navigation, login and server preview/save', async ({ browser }, testInfo) => {
    const context = await browser.newContext({ javaScriptEnabled: false, colorScheme: 'dark', baseURL: base, viewport: { width: 390, height: 844 } });
    await localFavicons(context);
    const p = await context.newPage();
    await p.goto(url('start'));
    await expect(p.locator('.page h1')).toBeVisible();
    await expect(p.locator('html')).toHaveCSS('background-color', 'rgb(32, 33, 31)');
    await expect(p.locator('.cesa-appearance')).toBeHidden();
    await noOverflow(p);
    await p.goto(url('essay'));
    const contents = p.locator('#dokuwiki__aside details').filter({ has: p.locator('#dw__toc') });
    await contents.locator('summary').click();
    await contents.getByRole('link', { name: 'Context', exact: true }).click();
    await expect(p).toHaveURL(/#context$/);
    expect((await p.locator('#context').boundingBox()).y).toBeGreaterThanOrEqual(0);
    const nav = await p.locator('#dokuwiki__aside').boundingBox();
    expect(nav.y + nav.height).toBeLessThanOrEqual(0);
    await p.goto(url('history', 'recent'));
    const recent = p.locator('select[name="show_changes"]');
    await expect(recent).toBeVisible();
    await expect(recent).toHaveCSS('background-image', /linear-gradient/);
    await recent.evaluate(e => e.setAttribute('dir', 'rtl'));
    const caret = await recent.evaluate(e => {
        const style = getComputedStyle(e);
        return { position: style.backgroundPositionX.split(',')[0].trim(), size: parseFloat(style.fontSize) };
    });
    expect(parseFloat(caret.position)).toBeCloseTo(.6 * caret.size, 1);
    await recent.selectOption('pages');
    await p.locator('button[name="do[recent]"]').click();
    await expect(recent).toHaveValue('pages');
    await login(p);
    const id = uid(testInfo, 'nojs');
    await p.goto(url(id, 'edit'));
    await p.locator('#wiki__text').fill('====== No JavaScript ======\n\nAn **accurate** preview.');
    await p.locator('#edbtn__preview').click();
    await expect(p.locator('.preview strong')).toHaveText('accurate');
    await expect(p.locator('#wiki__text')).toHaveValue(/An \*\*accurate\*\* preview/);
    await p.locator('#edbtn__save').click();
    await expect(p.locator('.page h1')).toHaveText('No JavaScript');
    await context.close();
});

for (const width of [360, 390, 768, 1280, 1920]) {
    for (const appearance of ['light', 'dark']) {
        test(`reading layouts ${width}px ${appearance}`, async ({ page }, testInfo) => {
            await page.setViewportSize({ width, height: 960 });
            await page.emulateMedia({ colorScheme: appearance });
            for (const id of ['essay', 'bookmarks', 'technical', 'plugins', 'rtl']) {
                await page.goto(url(id));
                if (id === 'plugins') await mathReady(page);
                await noOverflow(page);
                await expect(page.locator('.page h1')).toBeVisible();
                await expect(page.locator('.page')).toHaveCSS('font-size', '18px');
                if (!(await page.locator('#dokuwiki__top').getAttribute('class')).includes('cesa-rail-margin')) {
                    await expect(page.locator('#dokuwiki__aside details[open]')).toHaveCount(0);
                    await page.locator('#dokuwiki__aside summary').first().click();
                    await expect(page.locator('#dokuwiki__aside a').first()).toBeVisible();
                    await page.locator('#dokuwiki__aside summary').first().click();
                }
                if (id === 'technical') {
                    const table = page.locator('.page .table');
                    expect(await table.evaluate(e => e.scrollWidth > e.clientWidth)).toBe(true);
                    const pre = page.locator('.page pre').first();
                    expect(await pre.evaluate(e => e.scrollWidth > e.clientWidth)).toBe(true);
                }
                if (testInfo.project.name === 'chromium' && [390, 1280].includes(width) && ['technical', 'bookmarks', 'plugins', 'rtl'].includes(id)) {
                    await fs.mkdir('docs/screenshots', { recursive: true });
                    await page.screenshot({ path: `docs/screenshots/chromium-${id}-${width}-${appearance}.png`, fullPage: true });
                }
            }
            await page.goto(url('essay'));
            await fs.mkdir('docs/screenshots', { recursive: true });
            if (testInfo.project.name === 'chromium' || width === 390 || width === 1280) {
                await page.screenshot({ path: `docs/screenshots/${testInfo.project.name}-${width}-${appearance}.png`, fullPage: true });
            }
        });
    }
}

test('anonymous and reader ACLs, discovery and native source view', async ({ page }) => {
    for (const action of ['', 'edit', 'revisions', 'backlink', 'export_raw']) {
        const response = await page.goto(url('private:secret', action));
        const body = await response.text();
        expect(body).not.toContain('CESA_PRIVATE_SENTINEL_7391');
        expect(body).not.toContain('Restricted contents');
        await expect(page.locator('#dokuwiki__aside')).toHaveCount(0);
        await expect(page.locator('#dokuwiki__pagetools')).toHaveCount(0);
        await expect(page.locator('#dokuwiki__pagetools > a')).toHaveCount(0);
    }
    for (const target of [url('start', 'index'), url('start', 'recent'), '/doku.php?do=search&q=quietorchid', '/lib/exe/ajax.php?call=qsearch&q=private']) {
        const text = await (await page.request.get(target)).text();
        expect(text).not.toContain('CESA_PRIVATE_SENTINEL_7391');
        expect(text).not.toContain('private:secret');
        expect(text).not.toContain('Private notebook');
    }
    const rawPrivate = await page.request.get(url('private:secret', 'export_raw'));
    expect([200, 403]).toContain(rawPrivate.status());
    expect(await rawPrivate.text()).toContain('Permission Denied');
    expect((await page.request.get('/lib/exe/fetch.php?media=private:landscape.png')).status()).toBe(403);
    await login(page, 'reader');
    await page.goto(url('private:secret'));
    await expect(page.locator('.page')).toContainText('CESA_PRIVATE_SENTINEL_7391');
    expect((await page.request.get('/lib/exe/fetch.php?media=private:landscape.png')).status()).toBe(200);
    await expect(page.locator('#dokuwiki__aside')).toContainText('Private navigation');
    await expect(page.locator('#dokuwiki__pagetools > a')).toHaveText('Show pagesource');
    await page.locator('#dokuwiki__pagetools > a').click();
    await expect(page.locator('#wiki__text')).toHaveAttribute('readonly');
    await expect(page.locator('#edbtn__save')).toHaveCount(0);
    await expect(page.locator('#dokuwiki__usertools .admin a')).toHaveCount(0);
});

test('search, index, recent changes, backlinks, revisions and diff', async ({ page }) => {
    await page.goto(url('start'));
    await page.locator('#qsearch__in').fill('notebook');
    await page.locator('#dw__search button').click();
    await expect(page.locator('.page')).toContainText('On keeping a notebook');
    await expect(page.locator('.search_results')).toContainText('notebook');
    for (const [id, action, text] of [
        ['start', 'index', 'essay'], ['start', 'recent', 'Recent Changes'],
        ['essay', 'backlink', 'start'], ['history', 'revisions', 'Clarify the history fixture'],
        ['history', 'diff', 'A revised sentence'],
    ]) {
        await page.goto(url(id, action));
        await expect(page.locator('.page')).toContainText(text);
        await noOverflow(page);
    }
});

test('Recent Changes and diff dropdowns remain usable after core initialization', async ({ page }) => {
    await page.goto(url('history', 'recent'));
    const recent = page.locator('select[name="show_changes"]').locator('..').locator('button.cesa-select-trigger');
    await recent.click();
    await Promise.all([
        page.waitForURL(/show_changes=pages/),
        page.getByRole('option', { name: 'Pages', exact: true }).click({ noWaitAfter: true }),
    ]);
    await expect(page.locator('select[name="show_changes"]')).toHaveValue('pages');
    await expect(recent).toHaveText('Pages');
    await page.goto(url('history', 'diff'));
    const view = page.locator('select[name="difftype"]').locator('..').locator('button.cesa-select-trigger');
    await view.click();
    await Promise.all([
        page.waitForResponse(response => response.request().isNavigationRequest() && response.request().postData()?.includes('difftype=inline')),
        page.getByRole('option', { name: 'Inline', exact: true }).click({ noWaitAfter: true }),
    ]);
    await expect(page.locator('select[name="difftype"]')).toHaveValue('inline');
    await expect(page.locator('table.diff')).toHaveClass(/diff_inline/);
    for (const name of ['rev2[0]', 'rev2[1]']) {
        const revision = page.locator(`select[name="${name}"]`).locator('..').locator('button.cesa-select-trigger');
        await expect(revision).toHaveAccessibleName(name === 'rev2[0]' ? 'Older revision' : 'Newer revision');
        await revision.click();
        await expect(page.locator('.cesa-select-options:visible')).toBeVisible();
        await revision.press('Escape');
    }
});

test('create, repeated accurate preview without saving, summary, save, cancel and toolbar', async ({ page }, testInfo) => {
    await login(page);
    const id = uid(testInfo, 'edit');
    await page.goto(url(id));
    await expect(page.locator('#dokuwiki__pagetools > a')).toHaveText('Create this page');
    await page.locator('#dokuwiki__pagetools > a').click();
    const text = '====== Browser notebook ======\n\nA **careful** thought.\n\n===== First section =====\n\nOne paragraph.\n\n===== Second section =====\n\nAnother paragraph.\n';
    await page.locator('#wiki__text').fill(text);
    await page.locator('#edit__summary').fill('Create a notebook with a useful summary');
    for (let i = 0; i < 3; i++) {
        await page.locator('#edbtn__preview').click();
        await expect(page.locator('.preview p strong')).toHaveText('careful');
        await expect(page.locator('#wiki__text')).toHaveValue(text);
        expect(await raw(page, id)).not.toContain('careful');
    }
    if (testInfo.project.name === 'chromium') {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: 'docs/screenshots/chromium-editor-preview.png', fullPage: true, style: '.cesa-skip { visibility: hidden !important; }' });
        await page.setViewportSize({ width: 390, height: 844 });
        await noOverflow(page);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: 'docs/screenshots/chromium-editor-preview-mobile.png', fullPage: true, style: '.cesa-skip { visibility: hidden !important; }' });
        await page.setViewportSize({ width: 1280, height: 960 });
    }
    await page.locator('#edbtn__save').click();
    await expect(page.locator('#dokuwiki__top')).toHaveClass(/mode_show/);
    expect(await raw(page, id)).toContain('A **careful** thought.');
    await page.goto(url(id, 'revisions'));
    await expect(page.locator('.page')).toContainText('Create a notebook with a useful summary');
    await page.goto(url(id, 'edit'));
    await page.locator('#wiki__text').fill('Discard this edit');
    await cancel(page);
    expect(await raw(page, id)).toContain('A **careful** thought.');
    await page.goto(url(id, 'edit'));
    await page.locator('#wiki__text').fill('toolbar word');
    await page.locator('#wiki__text').evaluate(e => { e.focus(); e.setSelectionRange(8, 12); });
    await page.locator('#tool__bar button[title*="Bold"]').click();
    await expect(page.locator('#wiki__text')).toHaveValue('toolbar **word**');
    await page.locator('#wiki__text').press('ControlOrMeta+End');
    await setAppearance(page, 'dark');
    await page.locator('#tool__bar button[title*="Internal Link"]').click();
    await expect(page.locator('#link__wiz')).toBeVisible();
    await expect(page.locator('#link__wiz')).toHaveCSS('background-color', 'rgb(32, 33, 31)');
    await expect(page.locator('#link__wiz_result')).toHaveCSS('color', 'rgb(222, 222, 215)');
    await page.locator('#link__wiz_entry').fill('essay');
    await page.locator('#link__wiz_entry').press('End');
    const essayLink = page.locator('#link__wiz_result a[title="essay"]');
    await expect(essayLink).toBeVisible();
    await essayLink.click();
    await expect(page.locator('#wiki__text')).toHaveValue(/\[\[:?essay/);
    await expect(page.locator('#link__wiz')).toBeHidden();
    await cancel(page);
});

test('section editing preserves surrounding sections', async ({ page }, testInfo) => {
    await login(page);
    const id = uid(testInfo, 'section');
    await save(page, id, '====== Sections ======\n\nIntroduction.\n\n===== One =====\n\nFirst.\n\n===== Two =====\n\nSecond.\n');
    const revision = Math.floor((await fs.stat(`.dev/wiki/data/pages/${id.replaceAll(':', '/')}.txt`)).mtimeMs / 1000);
    await page.waitForTimeout(1100);
    await page.locator('.secedit').nth(1).locator('button').click();
    const selected = await page.locator('#wiki__text').inputValue();
    expect(selected).toContain('First.');
    expect(selected).not.toContain('Second.');
    await page.locator('#wiki__text').fill(selected.replace('First.', 'First, revised.'));
    await page.locator('#edbtn__save').click();
    await expect(page.locator('#dokuwiki__top')).toHaveClass(/mode_show/);
    const result = await raw(page, id);
    expect(result).toContain('First, revised.');
    expect(result).toContain('Second.');
    expect(result).toContain('Introduction.');
    await page.goto(`${url(id)}&rev=${revision}`);
    await expect(page.locator('.page #dw__toc')).toBeVisible();
    await expect(page.locator('.page #dw__toc')).toContainText('One');
    await expect(page.locator('.page')).toContainText('First.');
    await expect(page.locator('.page')).not.toContainText('First, revised.');
});

test('restoring an old revision requires confirmation and preserves Cancel', async ({ page }, testInfo) => {
    await login(page);
    const id = uid(testInfo, 'revert');
    const original = '====== Restore test ======\n\nOriginal text.\n';
    await save(page, id, original);
    const revision = Math.floor((await fs.stat(`.dev/wiki/data/pages/${id.replaceAll(':', '/')}.txt`)).mtimeMs / 1000);
    await page.waitForTimeout(1100);
    await save(page, id, '====== Restore test ======\n\nReplacement text.\n');
    await page.goto(`${url(id)}&rev=${revision}`);
    await page.locator('#dokuwiki__pagetools summary').click();
    const restore = page.locator('#dokuwiki__pagetools li.revert a');
    for (const accept of [false, true]) {
        const prompted = page.waitForEvent('dialog');
        const clicked = restore.click({ noWaitAfter: true });
        const dialog = await prompted;
        expect(dialog.type()).toBe('confirm');
        if (accept) await dialog.accept(); else await dialog.dismiss();
        await clicked;
        if (accept) await expect(page.locator('#dokuwiki__top')).toHaveClass(/mode_show/);
        expect(await raw(page, id)).toContain(accept ? 'Original text.' : 'Replacement text.');
    }
});

test('native draft refresh, recovery, unsaved warning and locks', async ({ page, browser }, testInfo) => {
    await login(page);
    const id = uid(testInfo, 'draft');
    await save(page, id, '====== Draft notebook ======\n\nSaved text.\n');
    await page.goto(url(id, 'edit'));
    await page.evaluate(() => { dw_locktimer.lasttime = new Date(0); });
    const refreshed = page.waitForResponse(r => r.url().includes('ajax.php') && r.request().postData()?.includes('call=lock'));
    await page.locator('#wiki__text').fill('====== Draft notebook ======\n\nRecover this unsaved text.\n');
    expect((await refreshed).status()).toBe(200);
    await expect(page.locator('#draft__status')).toContainText(/Draft autosaved/i);
    await page.locator('#wiki__text').press('End');
    await page.locator('#wiki__text').press('Space');
    const warning = page.waitForEvent('dialog');
    const attempted = page.reload({ timeout: 3000 }).catch(() => {});
    const dialog = await warning;
    expect(dialog.type()).toBe('beforeunload');
    await dialog.dismiss();
    await attempted;
    await expect(page.locator('#wiki__text')).toHaveValue(/Recover this unsaved text/);
    const otherContext = await browser.newContext({ baseURL: base });
    await localFavicons(otherContext);
    const other = await otherContext.newPage();
    await login(other, 'editor2');
    await other.goto(url(id, 'edit'));
    await expect(other.locator('.page')).toContainText(/locked/i);
    await expect(other.locator('#wiki__text')).toHaveAttribute('readonly');
    await expect(other.locator('#edbtn__save')).toHaveCount(0);
    await otherContext.close();
    await page.evaluate(() => { window.onbeforeunload = null; window.keepDraft = true; });
    await page.goto(url(id, 'draft'));
    await expect(page.locator('#draft__status')).toContainText(/Draft autosaved/i);
    await page.locator('button[name="do[recover]"]').click();
    await expect(page.locator('#wiki__text')).toHaveValue(/Recover this unsaved text/);
    expect(await raw(page, id)).toContain('Saved text.');
    await page.locator('#edbtn__save').click();
    await expect(page.locator('#dokuwiki__top')).toHaveClass(/mode_show/);
    expect(await raw(page, id)).toContain('Recover this unsaved text.');
});

test('conflicting edits retain both versions until the user decides', async ({ page, browser }, testInfo) => {
    await login(page);
    const id = uid(testInfo, 'conflict');
    await save(page, id, '====== Conflict ======\n\nOriginal.\n');
    await page.goto(url(id, 'edit'));
    await page.locator('#wiki__text').fill('====== Conflict ======\n\nFirst editor unsaved.\n');
    const context = await browser.newContext({ baseURL: base });
    await localFavicons(context);
    const second = await context.newPage();
    await login(second);
    // Same user may edit from another device; force a different saved revision time.
    await second.waitForTimeout(1100);
    await save(second, id, '====== Conflict ======\n\nSecond editor saved.\n');
    await page.locator('#edbtn__save').click();
    await expect(page.locator('#dokuwiki__top')).toHaveClass(/mode_conflict/);
    await expect(page.locator('.page')).toContainText('First editor unsaved.');
    await expect(page.locator('.page')).toContainText('Second editor saved.');
    expect(await raw(page, id)).toContain('Second editor saved.');
    await page.locator('button[name="do[cancel]"]').click();
    expect(await raw(page, id)).toContain('Second editor saved.');
    await context.close();
});

test('optional plugins render in article and repeated server previews', async ({ page }, testInfo) => {
    await login(page);
    await page.goto(url('plugins'));
    await mathReady(page);
    await inlineMathBaseline(page);
    await expect(page.locator('.wrap_info')).toBeVisible();
    const id = uid(testInfo, 'plugins');
    await page.goto(url(id, 'edit'));
    const text = '====== Plugin preview ======\n\n<WRAP info>\nAn unsaved callout.\n</WRAP>\n\nThe identity $e^{i\\pi}+1=0$ and $g_j+\\frac12$.\n\n$$\\int_0^1 x^2 dx=\\frac13$$\n';
    await page.locator('#wiki__text').fill(text);
    for (let i = 0; i < 2; i++) {
        await page.locator('#edbtn__preview').click();
        await expect(page.locator('.preview .wrap_info')).toContainText('An unsaved callout.');
        await mathReady(page, '.preview');
        await inlineMathBaseline(page);
        await expect(page.locator('#wiki__text')).toHaveValue(text);
        expect(await raw(page, id)).not.toContain('An unsaved callout.');
    }
    await cancel(page);
});

test('media popup upload and insertion, fullscreen manager and image detail', async ({ page }, testInfo) => {
    await login(page);
    const id = uid(testInfo, 'media');
    await page.goto(url(id, 'edit'));
    await page.locator('#wiki__text').fill('====== Image notebook ======\n\n');
    await page.locator('#wiki__text').press('ControlOrMeta+End');
    const popupPromise = page.waitForEvent('popup');
    await page.locator('#tool__bar button[title*="Add Images"]').click();
    const popup = await popupPromise;
    popup.on('pageerror', error => page.errors.push(error.message));
    await popup.bringToFront();
    await popup.waitForLoadState();
    await expect(popup.locator('#media__manager')).toBeVisible();
    await expect(popup.locator('#media__opts')).toBeAttached();
    await expect(popup.locator('img[src*="taskrunner.php"]')).toHaveCount(0);
    const rootToggle = popup.locator('#media__tree .cesa-tree-toggle').first();
    await expect(rootToggle).toHaveText('−');
    await rootToggle.focus();
    await rootToggle.press('Enter');
    await expect(rootToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(popup.locator('#media__tree > ul > li > ul')).toBeHidden();
    await expect.poll(() => popup.evaluate(() => jQuery('#media__tree > ul > li > ul').is(':animated'))).toBe(false);
    await rootToggle.press('Space');
    await expect(rootToggle).toHaveText('−');
    await expect(popup.locator('#media__tree > ul > li > ul')).toBeVisible();
    await expect(popup.locator('#media__tree > ul > li > ul')).toHaveCSS('grid-column', '1 / -1');
    const aligned = await rootToggle.evaluate(button => {
        const label = button.parentElement.querySelector('.li a');
        const range = document.createRange();
        range.selectNodeContents(label);
        const a = button.getBoundingClientRect(), text = range.getBoundingClientRect();
        return Math.abs(a.y + a.height / 2 - text.y - text.height / 2);
    });
    expect(aligned).toBeLessThan(1.5);
    const privateToggle = popup.getByRole('button', { name: /^(Expand|Collapse) namespace: private$/ });
    const subtree = popup.waitForResponse(r => r.url().includes('ajax.php') && r.request().postData()?.includes('call=medians'));
    await privateToggle.click();
    expect((await subtree).ok()).toBe(true);
    await expect(privateToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(privateToggle).toHaveText('−');
    const name = `${testInfo.project.name}-${Date.now()}.png`;
    await popup.locator('input[type="file"]').setInputFiles({ name, mimeType: 'image/png', buffer: await fs.readFile('.dev/wiki/data/media/landscape.png') });
    const upload = popup.getByRole('button', { name: /^Upload$/i });
    await expect(upload).toBeVisible();
    await upload.click();
    await popup.getByRole('button', { name: /^Done$/i }).click();
    // A clean installation has no files in this new page's namespace until upload.
    await expect(popup.locator('#media__content span.info').first()).toHaveCSS('padding', '0px');
    await popup.setViewportSize({ width: 390, height: 844 });
    await noOverflow(popup);
    const media = popup.locator('a.mediafile').filter({ hasText: name });
    await expect(media).toBeVisible();
    for (const appearance of ['light', 'dark']) {
        await setAppearance(popup, appearance);
        await media.click();
        await expect(popup.locator('#media__popup_content button.selected').first()).toHaveCSS('background-color', appearance === 'dark' ? 'rgb(41, 43, 39)' : 'rgb(241, 241, 237)');
        const close = popup.locator('.ui-dialog:visible .ui-dialog-titlebar-close');
        await expect(close).toHaveCSS('background-color', appearance === 'dark' ? 'rgb(41, 43, 39)' : 'rgb(241, 241, 237)');
        expect((await close.boundingBox()).height).toBeCloseTo(44, 0);
        expect((await close.boundingBox()).width).toBeCloseTo(44, 0);
        await noOverflow(popup);
        if (appearance === 'light') await close.click();
    }
    if (testInfo.project.name === 'chromium') await popup.screenshot({ path: 'docs/screenshots/chromium-media-insert-dark.png' });
    await popup.getByRole('button', { name: /^Insert$/i }).click();
    await expect(page.locator('#wiki__text')).toHaveValue(new RegExp(name.replace('.', '\\.')));
    if (!popup.isClosed()) await popup.close();
    await page.locator('#edbtn__save').click();
    await expect(page.locator('#dokuwiki__top')).toHaveClass(/mode_show/);
    await expect(page.locator('.page img')).toBeVisible();
    expect(await page.locator('.page img').evaluate(e => e.complete && e.naturalWidth > 0)).toBe(true);
    await page.goto('/lib/exe/detail.php?media=landscape.png&id=technical');
    await expect(page.locator('.page img')).toBeVisible();
    await expect(page.locator('div.img_detail')).toContainText('landscape.png');
    await page.goto(url('start', 'media'));
    await expect(page.locator('#mediamanager__page')).toBeVisible();
    for (const appearance of ['light', 'dark']) {
        await setAppearance(page, appearance);
        for (const label of ['Rows', 'Thumbnails', 'Date', 'Name']) {
            const control = page.locator('#mediamanager__page .options label').filter({ hasText: label });
            await control.click();
            await expect.poll(() => page.evaluate(() => jQuery.active)).toBe(0);
            await expect(control).toHaveClass(/ui-state-active/);
            await expect(control).toHaveCSS('background-color', appearance === 'dark' ? 'rgb(41, 43, 39)' : 'rgb(241, 241, 237)');
            await expect(control).toHaveCSS('color', appearance === 'dark' ? 'rgb(222, 222, 215)' : 'rgb(39, 39, 36)');
        }
        await expect(page.locator('#mediamanager__page .namespaces .panelHeader')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
        await expect(page.locator('#mediamanager__page .filelist .panelContent').getByText('landscape.png', { exact: true })).toBeVisible();
        if (testInfo.project.name === 'chromium') await page.screenshot({ path: `docs/screenshots/chromium-media-${appearance}.png` });
    }
    await noOverflow(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await noOverflow(page);
});

test('media previews fit automatically sized panels and enlarged text reflows', async ({ page }) => {
    for (const width of [390, 768, 1280]) {
        for (const scale of [1, 2]) {
            await page.setViewportSize({ width, height: 960 });
            await page.goto('/doku.php?id=start&do=media&image=landscape.png');
            if (scale === 2) await page.addStyleTag({ content: 'html { font-size: 200%; }' });
            const image = page.locator('#mediamanager__page .file .image img');
            await expect(image).toBeVisible();
            expect(await image.evaluate(e => e.getBoundingClientRect().width <= e.closest('.image').clientWidth + 1)).toBe(true);
            const usable = await page.locator('#mediamanager__page .namespaces').evaluate(e => {
                const root = parseFloat(getComputedStyle(document.documentElement).fontSize);
                return e.clientWidth >= Math.min(10 * root, e.parentElement.clientWidth) - 1;
            });
            expect(usable).toBe(true);
            await noOverflow(page);
        }
    }
});

test('highlighted code and native feedback keep readable palette contrast', async ({ page }) => {
    await page.goto(url('technical'));
    await page.locator('.page').evaluate(e => {
        for (const name of ['success', 'error', 'info', 'notify']) {
            const message = document.createElement('div');
            message.className = name;
            message.textContent = `Native ${name} message`;
            e.append(message);
        }
    });
    for (const appearance of ['light', 'dark']) {
        await setAppearance(page, appearance);
        const ratios = await page.locator('pre.code [class], .page > div.success, .page > div.error, .page > div.info, .page > div.notify').evaluateAll(elements => {
            const rgb = color => color.match(/[\d.]+/g).slice(0, 3).map(Number);
            const luminance = color => rgb(color).map(c => c / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
            return elements.map(e => {
                let background = e;
                while (getComputedStyle(background).backgroundColor === 'rgba(0, 0, 0, 0)') background = background.parentElement;
                const a = luminance(getComputedStyle(e).color), b = luminance(getComputedStyle(background).backgroundColor);
                return { token: e.className, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
            });
        });
        expect(ratios.length).toBeGreaterThan(4);
        for (const { token, ratio } of ratios) expect(ratio, `${appearance} ${token}`).toBeGreaterThanOrEqual(4.5);
    }
});

test('linkfavicon icons stay single, spaced and readable in content, navigation and preview', async ({ page }, testInfo) => {
    await page.goto(url('bookmarks'));
    const link = page.locator('.page a[data-linkfavicon]').first();
    await expect.poll(() => link.evaluate(e => getComputedStyle(e).backgroundImage)).toContain('faviconextractor');
    for (const width of [390, 1280]) {
        await page.setViewportSize({ width, height: 960 });
        for (const appearance of ['light', 'dark']) {
            await setAppearance(page, appearance);
            for (const icon of [link, page.locator('#dokuwiki__aside a[data-linkfavicon]').first()]) {
                await expect(icon).toHaveCSS('background-repeat', 'no-repeat');
                await expect(icon).toHaveCSS('background-blend-mode', 'normal');
                await expect(icon).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
                const sizes = await icon.evaluate(e => {
                    const css = getComputedStyle(e);
                    return { font: parseFloat(css.fontSize), icon: parseFloat(css.backgroundSize), padding: parseFloat(css.paddingInlineStart) };
                });
                expect(sizes.icon).toBeCloseTo(sizes.font, 1);
                expect(sizes.padding).toBeGreaterThan(sizes.icon);
            }
            const image = await link.evaluate(e => getComputedStyle(e).backgroundImage);
            await link.hover();
            await expect(link).toHaveCSS('background-image', image);
            await expect(link).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
            await page.mouse.move(0, 0);
            await noOverflow(page);
            if (testInfo.project.name === 'chromium') await page.screenshot({ path: `docs/screenshots/chromium-linkfavicon-${width}-${appearance}.png` });
        }
    }
    await page.locator('html').evaluate(e => e.dir = 'rtl');
    await expect(link).toHaveCSS('background-position', '100% 50%');
    await noOverflow(page);
    await login(page);
    const id = uid(testInfo, 'favicon');
    await page.goto(url(id, 'edit'));
    await page.locator('#wiki__text').fill('[[https://example.org/|A preview with an icon]]');
    await page.locator('#edbtn__preview').click();
    const preview = page.locator('.preview a[data-linkfavicon]');
    await expect(preview).toHaveCSS('background-repeat', 'no-repeat');
    await expect.poll(() => preview.evaluate(e => getComputedStyle(e).backgroundImage)).toContain('faviconextractor');
    expect(await raw(page, id)).not.toContain('A preview with an icon');
    await cancel(page);
});

test('extension and ACL managers keep usable columns, details and controls on phones', async ({ page }, testInfo) => {
    await login(page, 'admin');
    const plugins = path.resolve('.dev/wiki/conf/plugins.local.php');
    const original = await fs.readFile(plugins);
    try {
        await page.goto(`${url('start', 'admin')}&page=extension`);
        const popularity = page.locator('section.extension').filter({ has: page.locator('.screenshot .id').filter({ hasText: /^popularity$/ }) });
        await popularity.getByRole('button', { name: 'Disable', exact: true }).click();
        await expect(popularity).toHaveClass(/disabled/);
        await expect(popularity.locator('.main')).toHaveCSS('opacity', '1');
        await popularity.getByRole('button', { name: 'Enable', exact: true }).click();
        await expect(popularity).not.toHaveClass(/disabled/);
    } finally {
        await atomicWrite(plugins, original);
    }
    for (const width of [360, 1280]) {
        await page.setViewportSize({ width, height: 960 });
        for (const appearance of ['light', 'dark']) {
            await setAppearance(page, appearance);
            await page.goto(`${url('start', 'admin')}&page=extension`);
            const extension = page.locator('#extension__list section.extension').first();
            const main = await extension.locator('.main').boundingBox();
            expect(main.width).toBeGreaterThan(width === 360 ? 200 : 400);
            const details = extension.locator('.details details');
            await details.locator('summary').click();
            await expect(details).toHaveAttribute('open', '');
            await details.locator('summary').click();
            await expect(details).not.toHaveAttribute('open');
            await noOverflow(page);
            if (testInfo.project.name === 'chromium') await page.screenshot({ path: `docs/screenshots/chromium-extension-${width}-${appearance}.png` });
            await page.goto(`${url('start', 'admin')}&page=acl`);
            await expect(page.locator('#acl_manager')).toBeVisible();
            const radio = page.locator('#acl_manager input[type=radio]').first();
            await radio.check();
            await expect(radio).toBeChecked();
            if (width === 360) {
                const tree = await page.locator('#acl__tree').boundingBox();
                const panel = await page.locator('#acl__detail').boundingBox();
                expect(panel.y).toBeGreaterThanOrEqual(tree.y + tree.height);
                expect(tree.width).toBeGreaterThan(300);
            }
            await noOverflow(page);
            if (testInfo.project.name === 'chromium') await page.screenshot({ path: `docs/screenshots/chromium-acl-${width}-${appearance}.png` });
        }
    }
    const notes = page.locator('#acl__tree .idx_dir').filter({ hasText: /^notes$/ }).locator('xpath=../..');
    await notes.locator('img').first().click();
    await expect(notes).toHaveClass(/open/);
    await expect(notes.locator('ul')).toBeVisible();
});

test('cmsmode settings and Hiding IPs retain their native permission hooks', async ({ page }) => {
    await page.goto(url('privacy', 'revisions'));
    await expect(page.locator('.page')).not.toContainText('203.0.113.17');
    await expect(page.locator('.page')).not.toContainText('2001:db8::17');
    for (const action of ['recent', 'diff']) {
        await page.goto(url('privacy', action));
        await expect(page.locator('.page')).not.toContainText('2001:db8::17');
        await expect(page.locator('.page')).not.toContainText('203.0.113.17');
    }
    for (const [target, options] of [
        ['/doku.php?id=privacy&do%5Bdiff%5D=1', {}],
        [url('privacy'), { headers: { 'X-DokuWiki-Do': 'diff' } }],
    ]) {
        const html = await (await page.request.get(target, options)).text();
        expect(html).toContain('mode_diff');
        expect(html).not.toContain('203.0.113.17');
        expect(html).not.toContain('2001:db8::17');
    }
    await page.goto(url('privacy', 'revisions'));
    await page.locator('input[name="rev2[]"]').nth(0).check();
    await page.locator('input[name="rev2[]"]').nth(1).check();
    await page.locator('button[name="do[diff]"]').click();
    await expect(page.locator('#dokuwiki__top')).toHaveClass(/mode_diff/);
    await page.waitForLoadState('load');
    await expect(page.locator('.page')).not.toContainText('203.0.113.17');
    await expect(page.locator('.page')).not.toContainText('2001:db8::17');
    await login(page, 'admin');
    await page.goto(url('privacy', 'revisions'));
    await expect(page.locator('.page')).toContainText('203.0.113.17');
    await expect(page.locator('.page')).toContainText('2001:db8::17');
    const target = path.resolve('.dev/wiki/conf/local.php');
    const original = await fs.readFile(target, 'utf8');
    const context = await page.context().browser().newContext({ baseURL: base });
    await localFavicons(context);
    const reader = await context.newPage();
    try {
        await atomicWrite(target, original + "\n$conf['plugin']['cmsmode']['actions'] = 'backlink,index,recent,revisions,media,search,source,export_raw,rss';\n$conf['plugin']['cmsmode']['youarehere'] = 1;\n");
        await reader.goto(url('start'));
        await expect(reader.locator('#qsearch__in, .breadcrumbs, #dokuwiki__pagetools > a')).toHaveCount(0);
        await expect(reader.locator('.page h1')).toHaveText('Notebook');
        await page.goto(url('start'));
        await expect(page.locator('#qsearch__in')).toBeVisible();
        await expect(page.locator('#dokuwiki__pagetools > a')).toHaveText('Edit this page');
    } finally {
        await atomicWrite(target, original);
        await context.close();
    }
});

test('confmanager keeps native selection, save, icon dialog and deletion usable', async ({ page }, testInfo) => {
    await login(page, 'admin');
    const conf = path.resolve('.dev/wiki/conf');
    const names = ['interwiki.local.conf'];
    const original = new Map(await Promise.all(names.map(async name => [name, await fs.readFile(path.join(conf, name)).catch(() => null)])));
    try {
        await page.goto(`${url('start', 'admin')}&page=confmanager`);
        await page.getByRole('combobox', { name: 'Select a configuration file' }).click();
        await page.getByRole('option', { name: 'InterWiki Links', exact: true }).click();
        await expect(page.locator('#configForm')).toBeVisible();
        const key = `cesacompat${testInfo.project.name}`;
        await page.locator('.newItem.key').fill(key);
        await page.locator('.newItem.value').fill('https://example.invalid/{NAME}');
        await page.locator('#configForm .saveButton').first().click();
        const entry = page.locator(`#configForm input.key[value="${key}"]`);
        await expect(entry).toBeVisible();
        expect(await fs.readFile(path.join(conf, 'interwiki.local.conf'), 'utf8')).toContain(key);
        for (const width of [390, 1280]) {
            await page.setViewportSize({ width, height: 960 });
            for (const appearance of ['light', 'dark']) {
                await setAppearance(page, appearance);
                const background = appearance === 'dark' ? 'rgb(32, 33, 31)' : await page.locator('html').evaluate(e => getComputedStyle(e).backgroundColor);
                await expect(page.locator('#confmanager > .level1')).toHaveCSS('background-color', background);
                await entry.locator('xpath=../..').locator('.upload_image_button').click();
                await expect(page.locator('#confmanager .popup')).toBeVisible();
                await expect(page.locator('#confmanager .popupcontent:visible')).toHaveCSS('background-color', background);
                const box = await page.locator('#confmanager .popup').boundingBox();
                expect(box.x).toBeGreaterThanOrEqual(0);
                expect(box.x + box.width).toBeLessThanOrEqual(width);
                if (testInfo.project.name === 'chromium') await page.screenshot({ path: `docs/screenshots/chromium-confmanager-${width}-${appearance}.png` });
                await page.locator('#popup_cancel').click();
                await expect(page.locator('#confmanager .popup')).toBeHidden();
                await noOverflow(page);
            }
        }
        await entry.locator('xpath=../..').locator('.deleteButton').click();
        await expect(entry).toHaveCount(0);
        const remaining = await fs.readFile(path.join(conf, 'interwiki.local.conf'), 'utf8').catch(error => {
            if (error.code === 'ENOENT') return '';
            throw error;
        });
        expect(remaining).not.toContain(key);
    } finally {
        for (const [name, data] of original) {
            const target = path.join(conf, name);
            if (data === null) await removeFile(target);
            else await atomicWrite(target, data);
        }
    }
});

test('profile, subscriptions and bundled administration screens', async ({ page }, testInfo) => {
    await login(page, 'admin');
    await page.goto(url('start', 'profile'));
    await expect(page.locator('input[name="fullname"]')).toBeVisible();
    await expect(page.locator('input[name="fullname"]')).toHaveValue('Admin');
    await page.goto(url('essay', 'subscribe'));
    await expect(page.locator('#subscribe__form')).toBeVisible();
    for (const admin of ['', 'config', 'acl', 'usermanager', 'extension', 'revert', 'popularity', 'logviewer', 'styling']) {
        await page.goto(`${url('start', 'admin')}${admin ? `&page=${admin}` : ''}`);
        await expect(page.locator('.page')).not.toBeEmpty();
        await expect(page.locator('.page')).not.toContainText('unforeseen error');
        await noOverflow(page);
    }
    await page.goto(`${url('start', 'admin')}&page=config`);
    await expect(page.locator('#config__manager')).toContainText('Article width');
    const language = page.getByRole('combobox', { name: 'Interface language', exact: true });
    await language.click();
    await page.getByRole('option', { name: 'de', exact: true }).click();
    await expect(page.locator('select[name="config[lang]"]')).toHaveValue('de');
    await language.click();
    await page.getByRole('option', { name: 'en', exact: true }).click();
    await expect(page.locator('select[name="config[lang]"]')).toHaveValue('en');
    await setAppearance(page, 'dark');
    if (testInfo.project.name === 'chromium') await page.screenshot({ path: 'docs/screenshots/chromium-admin-dark.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await noOverflow(page);
    if (testInfo.project.name === 'chromium') await page.screenshot({ path: 'docs/screenshots/chromium-admin-mobile-dark.png' });
});

test('profile update, account logout and password-reset form', async ({ page }, testInfo) => {
    await login(page);
    await page.goto(url('start', 'profile'));
    const original = await page.locator('input[name="fullname"]').inputValue();
    const changed = `Cesa ${testInfo.project.name} editor`;
    await page.locator('input[name="fullname"]').fill(changed);
    await page.locator('#dw__register input[name="oldpass"]').fill(password);
    await page.locator('#dw__register button[type="submit"]').click();
    await expect(page.locator('.success')).toContainText(/updated|saved/i);
    await page.goto(url('start', 'profile'));
    await expect(page.locator('input[name="fullname"]')).toHaveValue(changed);
    await page.locator('input[name="fullname"]').fill(original);
    await page.locator('#dw__register input[name="oldpass"]').fill(password);
    await page.locator('#dw__register button[type="submit"]').click();
    await expect(page.locator('.success')).toContainText(/updated|saved/i);
    await page.waitForLoadState('load');
    await page.locator('#dokuwiki__usertools summary').click();
    await page.locator('#dokuwiki__usertools .logout a').click();
    await expect(page.locator('#dokuwiki__top')).not.toHaveClass(/loggedIn/);
    await page.waitForLoadState('load');
    await page.goto(url('start', 'resendpwd'));
    await expect(page.locator('#dw__resendpwd')).toBeVisible();
});

test('200% text zoom, RTL directions and print', async ({ page }, testInfo) => {
    await page.goto(url('rtl'));
    await expect(page.locator('[dir="rtl"]').first()).toBeVisible();
    await page.goto(url('technical'));
    // A 1280px display at 200% browser zoom has a 640px CSS layout viewport.
    await page.setViewportSize({ width: 640, height: 480 });
    await noOverflow(page);
    await expect(page.locator('.page')).toHaveCSS('font-size', '18px');
    await page.addStyleTag({ content: 'html { font-size: 200%; }' });
    await noOverflow(page);
    await page.goto(url('essay'));
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('#dokuwiki__header')).toBeHidden();
    await expect(page.locator('#dokuwiki__aside')).toBeHidden();
    await expect(page.locator('.page h1')).toBeVisible();
    await expect(page.locator('.footnotes')).toBeVisible();
    await expect(page.locator('.page blockquote')).toBeVisible();
    await page.screenshot({ path: `docs/screenshots/${testInfo.project.name}-print.png`, fullPage: true });
    if (testInfo.project.name === 'chromium') await page.pdf({ path: 'docs/screenshots/essay-print.pdf', format: 'A4' });
});

test('template configuration, disabled actions, include hooks and local style overrides', async ({ page }) => {
    const conf = path.resolve('.dev/wiki/conf');
    const originals = new Map();
    async function temporary(name, contents) {
        const target = path.join(conf, name);
        if (!originals.has(target)) originals.set(target, await fs.readFile(target).catch(() => null));
        await fs.mkdir(path.dirname(target), { recursive: true });
        await atomicWrite(target, contents);
    }
    try {
        await temporary('local.protected.php', `<?php
$conf['tpl']['cesa']['articleWidth'] = '72ch';
putenv('NONCE=cesa-test-nonce');
$conf['tpl']['cesa']['rail'] = 0;
$conf['tpl']['cesa']['logo'] = 1;
$conf['tpl']['cesa']['appearance'] = 'dark';
$conf['disableactions'] = 'edit,source,revisions,backlink,subscribe,recent,index,media,register,search';
`);
        for (const hook of ['header', 'pageheader', 'pagefooter', 'footer']) {
            await temporary(`${hook}.html`, `<span data-test-hook="${hook}">Included ${hook}</span>`);
        }
        await temporary('meta.html', '<meta name="cesa-test-meta" content="preserved">');
        await temporary('tpl/cesa/style.ini', '[replacements]\n__link__ = "#135779"\n');
        await temporary('userstyle.css', '.page { border-top: 3px solid rgb(19, 87, 121); }');
        await page.goto(url('start'));
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
        await expect(page.locator('head > script').first()).toHaveAttribute('nonce', 'cesa-test-nonce');
        await expect(page.locator('#dokuwiki__aside')).toHaveCount(0);
        await expect(page.locator('.page #dw__toc')).toBeVisible();
        await expect(page.locator('.cesa-title img')).toBeVisible();
        await expect(page.locator('#dokuwiki__pagetools > a')).toHaveCount(0);
        await expect(page.locator('.cesa-site-actions a')).toHaveCount(0);
        await expect(page.locator('#dokuwiki__sitetools, label[for="qsearch__in"]')).toHaveCount(0);
        await expect(page.locator('#dokuwiki__top')).toHaveCSS('--article-width', '72ch');
        for (const hook of ['header', 'pageheader', 'pagefooter', 'footer']) {
            await expect(page.locator(`[data-test-hook="${hook}"]`)).toHaveCount(1);
        }
        await expect(page.locator('meta[name="cesa-test-meta"]')).toHaveAttribute('content', 'preserved');
        await expect(page.locator('.page')).toHaveCSS('border-top-width', '3px');
        const css = await (await page.request.get('/lib/exe/css.php?t=cesa')).text();
        expect(css).toContain('#135779');
        await temporary('local.protected.php', `<?php
$conf['tpl']['cesa']['articleWidth'] = '88ch; color: red';
$conf['sidebar'] = 'absent_sidebar';
`);
        await page.goto(url('history'));
        await expect(page.locator('#dokuwiki__aside')).toHaveCount(0);
        await expect(page.locator('#dokuwiki__top')).toHaveCSS('--article-width', '88ch');
    } finally {
        for (const [target, original] of originals) {
            if (original === null) await removeFile(target);
            else {
                await atomicWrite(target, original);
            }
        }
        // Mort invalidates compiled assets by file time; removing an override alone
        // can leave the old CSS cached. Advance the fixture config timestamp too.
        const local = path.join(conf, 'local.php');
        const stamp = Math.ceil(Math.max(Date.now(), (await fs.stat(local)).mtimeMs) / 1000) + 1;
        await fs.utimes(local, stamp, stamp);
    }
});

test('administrator PHP repair requires CSRF, verifies files and backups, and restores originals without JavaScript', async ({ browser, page: jsPage }, testInfo) => {
    const endpoint = '/lib/tpl/cesa/compat.php';
    for (const user of [null, 'reader', 'editor']) {
        const context = await browser.newContext({ baseURL: base, javaScriptEnabled: false });
        try {
            if (user) await login(await context.newPage(), user);
            expect((await context.request.get(endpoint)).status()).toBe(403);
            expect((await context.request.post(endpoint, { form: { action: 'repair', plugin: 'hidingip' } })).status()).toBe(403);
        } finally {
            await context.close();
        }
    }
    const context = await browser.newContext({ baseURL: base, javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const plugins = path.resolve('.dev/wiki/conf/plugins.local.php');
    const pluginConfig = await fs.readFile(plugins);
    const local = await fs.readFile('.dev/wiki/conf/local.php');
    const backupDirectory = path.resolve('.dev/wiki/data/meta/_cesa_compat');
    const files = new Map();
    for (const [id, relative] of [['confmanager', 'configTypes/ConfigManagerTwoLine.php'], ['hidingip', 'action.php']]) {
        const target = path.resolve('.dev/wiki/lib/plugins', id, relative);
        files.set(id, { target, fixed: await fs.readFile(target), original: await fs.readFile(path.join('.dev/original-plugins', id, relative)) });
    }
    try {
        await login(page, 'admin');
        await page.goto(`${url('start', 'admin')}&page=extension`);
        await page.getByRole('link', { name: 'Plugin compatibility', exact: true }).click();
        await expect(page.locator('h1')).toHaveText('Plugin compatibility');
        try {
            await atomicWrite('.dev/wiki/conf/local.php', Buffer.concat([local, Buffer.from("\n$conf['disableactions'] = 'admin';\n")]));
            expect((await page.request.get(endpoint)).status()).toBe(403);
        } finally {
            await atomicWrite('.dev/wiki/conf/local.php', local);
        }
        // Keep the old PHP signature out of startup while testing its file repair under E_ALL.
        await atomicWrite(plugins, Buffer.concat([pluginConfig, Buffer.from("\n$plugins['confmanager'] = 0;\n$plugins['hidingip'] = 0;\n")]));
        for (const file of files.values()) await atomicWrite(file.target, file.original);
        await page.goto(`${endpoint}?action=repair&plugin=hidingip`);
        await expect(page.locator('[data-plugin="hidingip"] .compat-status')).toContainText('repair available');
        const token = await page.locator('input[name="sectok"]').first().inputValue();
        const hiding = files.get('hidingip');
        expect((await page.request.post(endpoint, { form: { action: 'repair', plugin: 'hidingip' } })).status()).toBe(403);
        expect(await fs.readFile(hiding.target)).toEqual(hiding.original);
        expect((await page.request.post(endpoint, { form: { action: 'repair', plugin: '../../conf/local.php', sectok: token } })).status()).toBe(409);
        const changed = Buffer.concat([hiding.original, Buffer.from('\n// Local modification.\n')]);
        await atomicWrite(hiding.target, changed);
        expect((await page.request.post(endpoint, { form: { action: 'repair', plugin: 'hidingip', sectok: token } })).status()).toBe(409);
        expect(await fs.readFile(hiding.target)).toEqual(changed);
        await atomicWrite(hiding.target, hiding.original);
        await fs.unlink(hiding.target);
        await fs.symlink(path.relative(path.dirname(hiding.target), path.resolve('.dev/original-plugins/hidingip/action.php')), hiding.target);
        expect((await page.request.post(endpoint, { form: { action: 'repair', plugin: 'hidingip', sectok: token } })).status()).toBe(409);
        await fs.unlink(hiding.target);
        await atomicWrite(hiding.target, hiding.original);
        await fs.chmod(hiding.target, 0o444);
        expect((await page.request.post(endpoint, { form: { action: 'repair', plugin: 'hidingip', sectok: token } })).status()).toBe(409);
        expect(await fs.readFile(hiding.target)).toEqual(hiding.original);
        await fs.chmod(hiding.target, 0o644);
        for (const [id, file] of files) {
            await page.goto(endpoint);
            const row = page.locator(`[data-plugin="${id}"]`);
            await row.getByRole('button', { name: 'Repair', exact: true }).click();
            await expect(row.locator('.compat-status')).toHaveText('Compatible file on disk.');
            await page.waitForLoadState('load');
            expect(await fs.readFile(file.target)).toEqual(file.fixed);
            const backup = path.join(backupDirectory, (await fs.readdir(backupDirectory)).find(name => name.startsWith(`${id}-`) && name.endsWith('.bak')));
            expect(await fs.readFile(backup)).toEqual(file.original);
            expect((await fs.stat(backup)).mode & 0o777).toBe(0o600);
            expect((await page.request.get(`/data/meta/_cesa_compat/${path.basename(backup)}`)).status()).toBe(403);
            expect((await page.request.post(endpoint, { form: { action: 'repair', plugin: id, sectok: token } })).status()).toBe(409);
            await fs.writeFile(backup, 'Invalid backup');
            expect((await page.request.post(endpoint, { form: { action: 'restore', plugin: id, sectok: token } })).status()).toBe(409);
            expect(await fs.readFile(file.target)).toEqual(file.fixed);
            await fs.writeFile(backup, file.original);
            await row.getByRole('button', { name: 'Restore original', exact: true }).click();
            await expect(row.locator('.compat-status')).toContainText('repair available');
            await page.waitForLoadState('load');
            expect(await fs.readFile(file.target)).toEqual(file.original);
            await row.getByRole('button', { name: 'Repair', exact: true }).click();
            await expect(row.locator('.compat-status')).toHaveText('Compatible file on disk.');
            await page.waitForLoadState('load');
            await noOverflow(page);
        }
        await login(jsPage, 'admin');
        await jsPage.goto(endpoint);
        await expect(jsPage.locator('h1')).toHaveText('Plugin compatibility');
        for (const width of [390, 1280]) {
            await jsPage.setViewportSize({ width, height: 960 });
            for (const appearance of ['light', 'dark']) {
                await setAppearance(jsPage, appearance);
                await noOverflow(jsPage);
                if (testInfo.project.name === 'chromium') await jsPage.screenshot({ path: `docs/screenshots/chromium-repair-${width}-${appearance}.png` });
            }
        }
        const template = path.resolve('.dev/wiki/lib/tpl/cesa');
        const extracted = template + '.repair-test';
        await fs.rename(template, extracted);
        try {
            await fs.symlink(path.relative(path.dirname(template), path.resolve('cesa')), template, 'dir');
            const response = await page.goto(endpoint);
            expect(response.status()).toBe(200);
            await expect(page.locator('h1')).toHaveText('Plugin compatibility');
        } finally {
            await fs.unlink(template);
            await fs.rename(extracted, template);
        }
        expect(await fs.readFile('.dev/wiki/conf/local.php')).toEqual(local);
    } finally {
        await context.close();
        for (const file of files.values()) {
            await fs.chmod(file.target, 0o644);
            await atomicWrite(file.target, file.fixed);
        }
        await atomicWrite(plugins, pluginConfig);
        await fs.rm(backupDirectory, { recursive: true, force: true });
    }
});
