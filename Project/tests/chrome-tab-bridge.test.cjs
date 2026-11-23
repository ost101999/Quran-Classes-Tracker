const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { once } = require('node:events');
const puppeteer = require('puppeteer');
const { createChromeTabBridge } = require('../chrome-tab-bridge');

test('Chrome extension finds an existing tab and rejects a different URL', { timeout: 45000 }, async () => {
    const focusedTitles = [];
    const bridge = createChromeTabBridge({ onFocus: title => focusedTitles.push(title), port: 0 });
    const bridgeServer = bridge.start();
    await once(bridgeServer, 'listening');
    const bridgePort = bridgeServer.address().port;
    const site = http.createServer((_req, res) => res.end('lesson'));
    await new Promise(resolve => site.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${site.address().port}/lesson`;
    const extension = fs.mkdtempSync(path.join(os.tmpdir(), 'tracker-extension-test-'));
    for (const file of ['manifest.json', 'background.js']) {
        const source = fs.readFileSync(path.resolve(__dirname, '../chrome-tab-extension', file), 'utf8');
        fs.writeFileSync(path.join(extension, file), source.replaceAll('39271', String(bridgePort)));
    }
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            pipe: true,
            enableExtensions: [extension],
        });
        const page = await browser.newPage();
        await page.goto(url);
        await page.evaluate(() => { document.title = 'Tracker lesson test'; });
        await browser.waitForTarget(target => target.type() === 'service_worker' && target.url().includes('fglnbaanfedkjkciegfabjnfnocbggeh'));
        let found = false;
        for (let i = 0; i < 30 && !found; i++) {
            await new Promise(resolve => setTimeout(resolve, 200));
            found = await bridge.focusExisting(url);
        }
        assert.equal(found, true);
        assert.deepEqual(focusedTitles, ['Tracker lesson test']);
        // Allow the extension to reconnect its long poll after returning the result.
        await new Promise(resolve => setTimeout(resolve, 300));
        assert.equal(await bridge.focusExisting(`${url}-different`), false);
        const portal = await browser.newPage();
        await portal.setRequestInterception(true);
        portal.on('request', request => request.respond({ status: 200, body: 'portal' }));
        await portal.goto('https://quranreport.vercel.app/student?_ts=1');
        await new Promise(resolve => setTimeout(resolve, 300));
        assert.equal(await bridge.focusExisting('https://quranreport.vercel.app/student?_ts=2'), true);
        await portal.waitForFunction(() => location.search.includes('_ts=2'));
        assert.equal((await browser.pages()).filter(item => item.url().startsWith('https://quranreport.vercel.app/student')).length, 1);
        const denied = await fetch(`http://127.0.0.1:${bridgePort}/next`, { method: 'POST' });
        assert.equal(denied.status, 403);
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        if (browser) await browser.close();
        bridge.stop();
        site.closeAllConnections();
        await new Promise(resolve => site.close(resolve));
        fs.unlinkSync(path.join(extension, 'manifest.json'));
        fs.unlinkSync(path.join(extension, 'background.js'));
        fs.rmdirSync(extension);
    }
});
