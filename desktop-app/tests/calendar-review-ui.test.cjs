const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer');
const { currentWeek } = require('../calendar-schedules');

test('review UI previews changes, requires confirmation, rejects stale approval and remembers ignore', { skip: process.env.CALENDAR_UI_TESTS !== '1', timeout: 60000 }, async () => {
    const root = path.resolve(__dirname, '..');
    const week = currentWeek();
    const instant = days => new Date(Date.parse(week.timeMin) + days * 86400000 + 14 * 3600000).toISOString();
    const events = [
        { id: 'green', start: instant(2), end: instant(2), timeZone: 'Europe/London', colorId: '10', recurring: false },
        { id: 'red', start: instant(3), end: instant(3), timeZone: 'Europe/London', colorId: '11', recurring: true },
        { id: 'move', start: instant(4), end: instant(4), originalStart: instant(1), timeZone: 'Europe/London', colorId: '', recurring: true },
    ];
    const fixture = { students: [{ id: 's1', name: 'Bilal', academy: 'Test', rate: 10, location: 'جنيه', days: [2, 4] }], attendance: {}, makeupLinks: [], savedReports: {} };
    const bundle = await require('esbuild').build({ stdin: { resolveDir: root, loader: 'tsx', contents: `
      import React, {useState} from 'react'; import {createRoot} from 'react-dom/client';
      import CalendarReviewModal from './components/CalendarReviewModal';
      import {ingestCalendarReviews,commitCalendarAction} from './services/calendarReview';
      const initial=${JSON.stringify(fixture)};
      initial.students=ingestCalendarReviews(initial.students,[{id:'s1',name:'Bilal'}],{available:true,schedules:{},reviews:{s1:{name:'Bilal',fetchedAt:new Date().toISOString(),events:${JSON.stringify(events)}}}});
      function Harness(){const [data,setData]=useState(initial);window.data=data;window.changeAttendance=(key,value)=>setData(prev=>({...prev,attendance:{...prev.attendance,[key]:value}}));
        return <CalendarReviewModal data={data} error="" loading={false} disabled={false} onRefresh={()=>{}} onClose={()=>{}} onConfirm={(studentId,preview,replace)=>{const updated=commitCalendarAction(data,studentId,preview,replace);setData({...data,...updated});}}/>;
      } createRoot(document.getElementById('root')).render(<Harness/>);
    ` }, bundle: true, write: false, format: 'iife', define: { 'process.env.NODE_ENV': '"test"' } });
    const css = (await require('postcss')([require('tailwindcss')({ content: [path.join(root, 'components/CalendarReviewModal.tsx')] })]).process('@tailwind base; @tailwind components; @tailwind utilities;', { from: undefined })).css;
    const server = http.createServer((_req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(`<html><head><style>${css}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></body></html>`); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        browser = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-sandbox'] });
        const page = await browser.newPage(); await page.setViewport({ width: 1000, height: 850 });
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        await page.waitForSelector('[role="dialog"]');
        assert.deepEqual(await page.evaluate(() => window.data.attendance), {});
        if (process.env.CALENDAR_REVIEW_SCREENSHOT) await page.screenshot({ path: process.env.CALENDAR_REVIEW_SCREENSHOT });
        const clickText = async (kind, text) => page.$eval(`[data-proposal-kind="${kind}"]`, (el, text) => [...el.querySelectorAll('button')].find(button => button.textContent === text).click(), text);
        await page.select('[data-proposal-kind="red"] select', 'apology');
        await clickText('red', 'تأكيد');
        await page.waitForFunction(() => Object.values(window.data.attendance).includes('r'));
        assert.equal(await page.$('[data-proposal-kind="red"]'), null);
        const key = await page.evaluate(start => {const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(start)).map(x=>[x.type,x.value]));return `s1_${Number(p.day)}_${Number(p.month)-1}_${p.year}`;}, events[0].start);
        await page.evaluate(key => window.changeAttendance(key, '1'), key);
        await clickText('scheduled', 'تأكيد');
        assert.equal(await page.$eval('[data-proposal-kind="scheduled"] button', el => el.disabled), true);
        await page.click('[data-proposal-kind="scheduled"] input[type="checkbox"]');
        await clickText('scheduled', 'تأكيد التعديل');
        await page.waitForFunction(key => window.data.attendance[key] === 'e', {}, key);
        await clickText('moved', 'تجاهل هذا التغيير');
        await page.waitForFunction(() => window.data.students[0].calendarReview.pending.length === 0);
        assert.equal(await page.evaluate(() => Object.values(window.data.students[0].calendarReview.decisions).filter(x => x.action === 'ignore').length), 1);
        assert.deepEqual(errors, []);
    } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
});
