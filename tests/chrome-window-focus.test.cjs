const { test } = require('node:test');
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const { focusChromeWindow } = require('../chrome-window-focus');

test('brings the matching Chrome window to the foreground', { timeout: 30000, skip: process.platform !== 'win32' }, async () => {
    const browser = await puppeteer.launch({ headless: false });
    try {
        const first = await browser.newPage();
        await first.goto('data:text/html,<title>Tracker focus test 8591</title>');
        const session = await browser.target().createCDPSession();
        const { targetId } = await session.send('Target.createTarget', { url: 'data:text/html,<title>Tracker other window 8591</title>', newWindow: true });
        const secondTarget = await browser.waitForTarget(target => target._targetId === targetId);
        const second = await secondTarget.page();
        await second.bringToFront();
        assert.equal(await focusChromeWindow('Tracker focus test 8591'), true);
    } finally {
        await browser.close();
    }
});
