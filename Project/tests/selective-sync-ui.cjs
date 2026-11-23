// Run with Vite on 127.0.0.1:4178. Uses an isolated browser and mocked IPC;
// every Firebase request is blocked. No Electron profile or live data is touched.
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
    try {
        for (const scenario of ['incremental', 'conflict', 'busy']) {
            const page = await browser.newPage();
            const errors = [];
            page.on('pageerror', error => { errors.push(error.message); console.error('UI error:', error.message); });
            await page.evaluateOnNewDocument(scenario => {
                window.__saves = []; window.__network = []; window.__choices = [];
                const originalFetch = window.fetch;
                window.fetch = (url, options) => {
                    if (String(url).includes('firebaseio.com')) { window.__network.push(String(url)); return Promise.reject(new Error('Live Firebase blocked in UI test')); }
                    return originalFetch(url, options);
                };
                let received = false;
                const status = { isSyncing: false, hasPending: scenario === 'conflict', error: scenario === 'conflict' ? 'conflict' : null, conflict: scenario === 'conflict', lastSuccessAt: null };
                window.electronAPI = {
                    platform: 'darwin', loadZoom: async () => null,
                    loadData: async () => ({ students: [], savedReports: { old: 'existing report' }, tajweedBank: { lesson: { id: 'lesson', title: 'local bank', questions: [], targetAge: 'adult', createdAt: 1 } }, year: 2026, month: 10, lastUpdated: 7 }),
                    saveData: async (data, skip, token) => {
                        window.__saves.push({ data, skip, token });
                        if (scenario === 'busy' && skip) return { success: false, busy: true };
                        if (skip) received = true;
                        return { success: true };
                    },
                    getCloudChanges: async () => scenario === 'conflict' ? { busy: true } : { token: 23, changes: received ? {} : { savedReports: { old: 'existing report', new: 'Windows report' } } },
                    getSyncStatus: async () => status, onSyncStatus() {}, offSyncStatus() {},
                    getSyncConflicts: async () => scenario === 'conflict' ? [{ path: 'savedReports/report1', localValue: 'LOCAL COPY', remoteValue: 'REMOTE COPY', remoteEtag: 'etag1' }] : [],
                    resolveSyncConflict: async (...args) => { window.__choices.push(args); return { success: false, changed: true }; },
                    onEscapeBtn() {}, offEscapeBtn() {}, onNavigateInternal() {}, offNavigateInternal() {},
                };
            }, scenario);
            await page.goto('http://127.0.0.1:4178');
            if (scenario === 'conflict') {
                await page.waitForFunction(() => document.body.innerText.includes('LOCAL COPY') && document.body.innerText.includes('REMOTE COPY'));
                await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent === 'استخدام النسخة السحابية').click());
                await page.waitForFunction(() => document.body.innerText.includes('النسخة السحابية اتغيّرت'));
                assert.deepEqual(await page.evaluate(() => window.__choices), [['savedReports/report1', 'remote', 'etag1']]);
                assert.equal(await page.evaluate(() => window.__saves.length), 0);
            } else {
                await page.waitForFunction(() => window.__saves.some(item => item.skip));
                if (scenario === 'incremental') {
                    await page.waitForFunction(() => window.__saves.some(item => !item.skip));
                    const saved = await page.evaluate(() => window.__saves);
                    assert.equal(saved[0].token, 23);
                    assert.deepEqual(saved.at(-1).data.savedReports, { old: 'existing report', new: 'Windows report' });
                    assert.equal(saved.at(-1).data.tajweedBank.lesson.title, 'local bank');
                } else {
                    assert.equal(await page.evaluate(() => window.__saves.some(item => !item.skip)), false, 'rejected cloud commit must not open editing/autosave');
                }
            }
            assert.deepEqual(await page.evaluate(() => window.__network), [], 'desktop must not invoke legacy full downloads');
            assert.deepEqual(errors, []);
            console.log(`PASS UI: ${scenario}`);
            await page.close();
        }
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
