const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');
const { currentWeek, scheduleFor } = require('../calendar-schedules');
const enabled = process.env.CALENDAR_UI_TESTS === '1';

test('student editor fills and refreshes; portal renders current, empty and expired weeks', { skip: !enabled, timeout: 90000 }, async () => {
    const root = path.resolve(__dirname, '..');
    const week = currentWeek();
    const start = new Date(Date.parse(week.timeMin) + 3 * 86400000 + 18 * 3600000).toISOString();
    const schedule = scheduleFor('Bilal', [{ name: 'Bilal', start, timeZone: 'Europe/London' }], week, new Date().toISOString());
    const student = { id: 'test', name: 'Bilal', academy: 'Test', rate: 10, location: 'جنيه', scheduleMessage: schedule.message, calendarSchedule: schedule, days: [] };
    const data = { students: [student], month: new Date().getMonth(), year: new Date().getFullYear(), attendance: {}, academyRates: {}, studentProgress: {}, lastReports: {}, savedReports: {} };
    const bundle = await require('esbuild').build({ stdin: {
        contents: `import React from 'react'; import { createRoot } from 'react-dom/client'; import StudentModal from './components/StudentModal';
        window.electronAPI = { getCalendarSchedules: async () => {
          window.scheduleReads = (window.scheduleReads || 0) + 1;
          await new Promise(resolve => setTimeout(resolve, 50));
          return window.fixture;
        }};
        createRoot(document.getElementById('root')).render(<StudentModal student={window.student} academies={['Test']} currentMonth={10} currentYear={2026} openStudentWebInitially={true} onSave={s=>window.savedStudent=s} onClose={()=>{}}/>);`,
        resolveDir: root, loader: 'tsx',
    }, bundle: true, write: false, format: 'iife', define: { 'process.env.NODE_ENV': '"test"' } });
    const portal = fs.readFileSync(path.join(root, 'student-web-app/index.html'), 'utf8');
    const server = http.createServer((req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        if (req.url.startsWith('/editor')) {
            res.end(`<html dir="rtl"><body><div id="root"></div><script>window.student=${JSON.stringify({ ...student, calendarSchedule: undefined, scheduleMessage: 'old saved text' })};window.fixture=${JSON.stringify({ available: true, schedules: { test: schedule } })};</script><script>${bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></body></html>`);
        } else res.end(portal);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    let browser;
    try {
        browser = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-sandbox'] });
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${origin}/editor`);
        await page.waitForFunction(() => document.querySelector('#student-schedule')?.value.includes('Classes schedule for Bilal'));
        assert.equal(await page.$eval('#student-schedule', el => el.readOnly), true);
        assert.match(await page.$eval('#student-schedule-status', el => el.textContent), /تم التحديث/);
        await page.$eval('form', form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
        assert.equal(await page.evaluate(() => window.savedStudent.calendarSchedule.weekStart), week.weekStart);
        assert.equal(await page.evaluate(() => window.savedStudent.scheduleMessage), schedule.message);
        const empty = scheduleFor('Bilal', [], week, new Date().toISOString());
        await page.evaluate(result => { window.fixture = result; [...document.querySelectorAll('button')].find(el => el.textContent === 'تحديث الآن').click(); }, { available: true, schedules: { test: empty } });
        await page.waitForFunction(() => document.querySelector('#student-schedule')?.value.includes('No classes scheduled this week'));
        await page.evaluate(() => { window.fixture = { available: false, schedules: {}, error: 'Test offline' }; [...document.querySelectorAll('button')].find(el => el.textContent === 'تحديث الآن').click(); });
        await page.waitForFunction(() => document.querySelector('#student-schedule-status')?.textContent === 'Test offline');
        assert.match(await page.$eval('#student-schedule', el => el.value), /No classes scheduled/);

        await page.setRequestInterception(true);
        page.on('request', request => {
            if (request.url().includes('firebaseio.com')) {
                assert.equal(request.method(), 'GET', 'UI test must never write to the real database');
                return request.respond({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(request.url().includes('/students/') ? data.students[0] : data) });
            }
            request.continue();
        });
        await page.goto(`${origin}/?student=test`, { waitUntil: 'networkidle2' });
        await page.waitForSelector('#tour-my-schedule', { timeout: 20000 });
        await page.click('#tour-my-schedule');
        await page.waitForFunction(() => document.body.textContent.includes('Current week · Saturday — Friday'));
        assert.ok((await page.$eval('body', el => el.textContent)).includes('Europe/London'));
        data.students[0] = { ...student, calendarSchedule: { ...schedule, timeMax: '2000-01-01T00:00:00Z' } };
        await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        await page.waitForFunction(() => document.body.textContent.includes('Waiting for the teacher to update this week'));
        data.students[0] = { ...student, calendarSchedule: empty, scheduleMessage: empty.message };
        await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        await page.waitForFunction(() => document.body.textContent.includes('No classes scheduled this week.'));
        assert.deepEqual(errors, []);
    } finally {
        await browser?.close();
        await new Promise(resolve => server.close(resolve));
    }
});
