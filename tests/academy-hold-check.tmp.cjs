const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(7000);
    await page.evaluateOnNewDocument(() => localStorage.setItem('quran_tracker_data', JSON.stringify({
      students: [{ id: 's1', name: 'Student', academy: 'Alpha', location: 'EGP', rate: 10, days: [4], duration: '60' }],
      attendance: {}, month: 9, year: 2026, dayOff: 5, academyOrder: ['Alpha'], academyRates: { Alpha: { rate: 10, currency: 'EGP' } }
    })));
    await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#academy-Alpha');
    const navSelector = 'nav [role="button"]';
    const hold = async () => {
      const rect = await page.$eval(navSelector, element => {
        const r = element.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      });
      await page.mouse.move(rect.x, rect.y);
      await page.mouse.down();
      await new Promise(resolve => setTimeout(resolve, 650));
      await page.mouse.up();
      await page.waitForSelector('.context-menu');
    };
    await hold();
    if (!(await page.$eval('.context-menu', e => e.textContent)).includes('إضافة طالب')) throw Error('Missing add option');
    if (!(await page.$eval('.context-menu', e => e.textContent)).includes('تعديل')) throw Error('Missing edit option');
    await page.$eval('.context-menu button:nth-child(2)', e => e.click());
    await page.waitForSelector('button[title="أرشفة الأكاديمية"]');
    if (!await page.$eval('input', input => input.value === 'Alpha')) throw Error('Wrong academy in edit form');
    await page.keyboard.press('Escape');
    await hold();
    await page.$eval('.context-menu button:nth-child(1)', e => e.click());
    await page.waitForFunction(() => Array.from(document.querySelectorAll('input')).some(input => input.value === 'Alpha'));
    console.log('Long press opens menu and both actions use the selected academy');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
