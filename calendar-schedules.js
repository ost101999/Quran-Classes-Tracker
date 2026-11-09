const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const identityHash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

const CAIRO = 'Africa/Cairo';
const API = 'https://www.googleapis.com/calendar/v3/';
const TOKEN_PATH = path.join(os.homedir(), 'MyAutoScripts', '5- My Programs', '1- Google Calender Magic Opener', 'Support Files', 'token.json');

function dateParts(date, timeZone) {
    return Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
        timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
}

function localMidnight(ymd) {
    const wall = Date.parse(`${ymd}T00:00:00Z`);
    let instant = wall;
    for (let attempt = 0; attempt < 4; attempt++) {
        const p = dateParts(new Date(instant), CAIRO);
        const delta = wall - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
        if (!delta) return new Date(instant).toISOString();
        instant += delta;
    }
    throw new Error('تعذّر تحديد بداية الأسبوع بتوقيت القاهرة.');
}

function currentWeek(now = new Date()) {
    const p = dateParts(now, CAIRO);
    const day = new Date(Date.UTC(p.year, p.month - 1, p.day));
    day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 1) % 7);
    const weekStart = day.toISOString().slice(0, 10);
    day.setUTCDate(day.getUTCDate() + 6);
    const weekEnd = day.toISOString().slice(0, 10);
    day.setUTCDate(day.getUTCDate() + 1);
    // Exclusive next-Saturday boundary includes every second of Friday.
    return { weekStart, weekEnd, timeMin: localMidnight(weekStart), timeMax: localMidnight(day.toISOString().slice(0, 10)) };
}

function scheduleFor(name, events, week, updatedAt) {
    const slots = events.filter(event => event.name === name.trim() && Date.parse(event.start) >= Date.parse(week.timeMin) && Date.parse(event.start) < Date.parse(week.timeMax))
        .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
        .map(({ start, timeZone }) => ({ start, timeZone }));
    const zones = [...new Set(slots.map(slot => slot.timeZone))];
    let message = `🕒 *Classes schedule for ${name.trim()}*\n`;
    if (zones.length === 1) message += `in ${zones[0]} time\n\n`;
    else if (zones.length > 1) message += 'Each class is shown in its own timezone\n\n';
    else message += '\nNo classes scheduled this week.';
    for (const slot of slots) {
        const start = new Date(slot.start);
        const day = new Intl.DateTimeFormat('en-US', { timeZone: slot.timeZone, weekday: 'long' }).format(start);
        const time = new Intl.DateTimeFormat('en-US', { timeZone: slot.timeZone, hour: '2-digit', minute: '2-digit', hour12: true }).format(start);
        message += `🔹 *${day}* -> *${time}*${zones.length > 1 ? ` (${slot.timeZone})` : ''}\n\n`;
    }
    return { source: 'google-calendar', name: name.trim(), ...week, updatedAt, status: slots.length ? 'ready' : 'empty', message: message.trim(), slots };
}

function createCalendarSchedules({ fetchImpl = globalThis.fetch, readToken = () => JSON.parse(fs.readFileSync(process.env.QURAN_CALENDAR_TOKEN_PATH || TOKEN_PATH, 'utf8')), now = () => new Date() } = {}) {
    let access;
    let snapshot;
    let pending;
    async function request(url, options = {}) {
        let response;
        try { response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(20000) }); }
        catch { throw new Error('تعذّر الاتصال بتقويم Google. تحقق من الإنترنت ثم أعد المحاولة.'); }
        if (!response.ok) {
            const error = new Error(response.status === 401 || response.status === 400
                ? 'انتهى اتصال Google Calendar. أعد تسجيل الدخول في Google Calendar Magic Opener.'
                : `تعذّرت قراءة تقويم Google (${response.status}). لم يتم استبدال الجدول المحفوظ.`);
            error.status = response.status;
            throw error;
        }
        return response.json();
    }
    async function token(force = false) {
        if (!force && access && access.expires > now().getTime() + 60000) return access.value;
        let saved;
        try { saved = readToken(); }
        catch { throw new Error('اربط Google Calendar من برنامج Google Calendar Magic Opener أولًا.'); }
        const expiry = saved.expiry ? Date.parse(saved.expiry.endsWith('Z') || /[+-]\d\d:\d\d$/.test(saved.expiry) ? saved.expiry : `${saved.expiry}Z`) : 0;
        if (!force && saved.token && expiry > now().getTime() + 60000) {
            access = { value: saved.token, expires: expiry };
        } else {
            if (!saved.refresh_token || !saved.client_id || !saved.client_secret) throw new Error('أعد ربط حساب Google Calendar في Google Calendar Magic Opener.');
            const result = await request('https://oauth2.googleapis.com/token', {
                method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: saved.refresh_token, client_id: saved.client_id, client_secret: saved.client_secret }).toString(),
            });
            if (!result.access_token) throw new Error('تعذّر تجديد اتصال Google Calendar.');
            // Keep refreshed credentials only in memory; never change Magic Opener's token file.
            access = { value: result.access_token, expires: now().getTime() + Number(result.expires_in || 3600) * 1000 };
        }
        return access.value;
    }
    async function getPage(route, params) {
        const url = `${API}${route}?${new URLSearchParams(params)}`;
        try { return await request(url, { headers: { Authorization: `Bearer ${await token()}` } }); }
        catch (error) {
            if (error.status !== 401) throw error;
            return request(url, { headers: { Authorization: `Bearer ${await token(true)}` } });
        }
    }
    async function readWeek(week, review = false) {
        const shiftDate = (date, days) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
        const timeMin = review ? localMidnight(shiftDate(week.weekStart, -7)) : week.timeMin;
        const timeMax = review ? localMidnight(shiftDate(week.weekStart, 14)) : week.timeMax;
        const calendars = [];
        let pageToken = '';
        do {
            const page = await getPage('users/me/calendarList', { maxResults: '250', ...(pageToken ? { pageToken } : {}) });
            calendars.push(...(page.items || []).filter(cal => cal.selected && !cal.hidden && !cal.deleted));
            pageToken = page.nextPageToken || '';
        } while (pageToken);
        if (!calendars.length) throw new Error('لا توجد تقويمات ظاهرة ومختارة لقراءة المواعيد.');
        const events = [];
        const masters = new Map();
        const seen = new Set();
        for (const calendar of calendars) {
            pageToken = '';
            do {
                const page = await getPage(`calendars/${encodeURIComponent(calendar.id)}/events`, {
                    timeMin, timeMax, singleEvents: 'true',
                    orderBy: 'startTime', showDeleted: 'false', maxResults: '2500', ...(pageToken ? { pageToken } : {}),
                });
                for (const event of page.items || []) {
                    if (event.status === 'cancelled' || !event.start?.dateTime || !event.summary?.trim()) continue;
                    const start = Date.parse(event.start.dateTime);
                    if (!Number.isFinite(start) || start < Date.parse(timeMin) || start >= Date.parse(timeMax)) continue;
                    // Shared copies of one occurrence should not appear twice.
                    const identity = JSON.stringify([event.iCalUID || `${calendar.id}/${event.id}`, start, event.summary.trim()]);
                    if (seen.has(identity)) continue;
                    seen.add(identity);
                    const timeZone = event.start.timeZone || page.timeZone || calendar.timeZone || CAIRO;
                    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date(start));
                    events.push({ name: event.summary.trim(), start: new Date(start).toISOString(), timeZone,
                        ...(review ? {
                            id: identityHash([event.iCalUID || `${calendar.id}/${event.id}`, event.recurringEventId ? event.originalStartTime?.dateTime || event.start.dateTime : 'single']),
                            end: event.end?.dateTime || event.start.dateTime,
                            originalStart: event.originalStartTime?.dateTime,
                            colorId: String(event.colorId || ''), recurring: !!event.recurringEventId,
                            seriesKey: event.recurringEventId ? `${calendar.id}/${event.recurringEventId}` : '',
                            archive: calendar.summary?.trim() === 'ي-منتهي',
                        } : {}),
                    });
                }
                pageToken = page.nextPageToken || '';
            } while (pageToken);
            if (review) {
                pageToken = '';
                do {
                    const page = await getPage(`calendars/${encodeURIComponent(calendar.id)}/events`, {
                        timeMin, timeMax, singleEvents: 'false', showDeleted: 'false', maxResults: '2500', ...(pageToken ? { pageToken } : {}),
                    });
                    for (const master of page.items || []) {
                        if (master.recurrence && master.status !== 'cancelled') masters.set(`${calendar.id}/${master.id}`, master);
                    }
                    pageToken = page.nextPageToken || '';
                } while (pageToken);
            }
        }
        // Failures above reject the entire snapshot instead of publishing a partial schedule.
        return { week, events, masters, review, reviewTimeMax: timeMax, updatedAt: now().toISOString() };
    }
    return async function getSchedules(students, { force = false, review = false } = {}) {
        const requests = (Array.isArray(students) ? students : []).filter(student => typeof student?.id === 'string' && typeof student?.name === 'string' && student.name.trim());
        if (!requests.length) return { available: true, schedules: {} };
        try {
            const week = currentWeek(now());
            if (!pending && (force || !snapshot || (review && !snapshot.review) || snapshot.week.weekStart !== week.weekStart || now().getTime() - Date.parse(snapshot.updatedAt) >= 55000)) {
                pending = readWeek(week, review).then(value => { snapshot = value; }).finally(() => { pending = null; });
            }
            if (pending) await pending;
            if (review && !snapshot.review) return getSchedules(students, { review: true });
            if (snapshot.week.weekStart !== currentWeek(now()).weekStart) throw new Error('بدأ أسبوع جديد أثناء التحديث. أعد المحاولة.');
            return { available: true, schedules: Object.fromEntries(requests.map(student => [student.id, scheduleFor(student.name, snapshot.events, snapshot.week, snapshot.updatedAt)])),
                ...(review ? { reviews: Object.fromEntries(requests.map(student => [student.id, reviewFor(student.name, snapshot)])) } : {}),
            };
        } catch (error) {
            snapshot = undefined;
            return { available: false, schedules: {}, error: error.message || 'تعذّرت قراءة المواعيد.' };
        }
    };
}

function reviewFor(name, snapshot) {
    const events = snapshot.events.filter(event => event.name === name.trim() && !event.archive);
    const nextWeekOccurrence = event => Date.parse(event.originalStart || event.start) >= Date.parse(snapshot.week.timeMax) && Date.parse(event.originalStart || event.start) < Date.parse(snapshot.reviewTimeMax);
    const seriesKeys = [...new Set(events.filter(event => event.recurring && nextWeekOccurrence(event)).map(event => event.seriesKey))];
    const days = [];
    const signatures = [];
    let complete = seriesKeys.length > 0;
    for (const key of seriesKeys) {
        const master = snapshot.masters.get(key);
        const rules = master?.recurrence || [];
        const rule = rules.length === 1 && rules[0].startsWith('RRULE:') ? Object.fromEntries(rules[0].slice(6).split(';').map(part => part.split('='))) : {};
        // Only an unbounded weekly rule is evidence of a permanent weekly plan.
        if (rule.FREQ !== 'WEEKLY' || (rule.INTERVAL && rule.INTERVAL !== '1') || Object.keys(rule).some(k => !['FREQ', 'INTERVAL', 'BYDAY', 'WKST'].includes(k)) || (rule.BYDAY && !/^(MO|TU|WE|TH|FR|SA|SU)(,(MO|TU|WE|TH|FR|SA|SU))*$/.test(rule.BYDAY))) { complete = false; break; }
        const expected = rule.BYDAY ? rule.BYDAY.split(',').length : 1;
        const starts = [...new Set(events.filter(event => event.seriesKey === key).map(event => event.originalStart || event.start))]
            .filter(start => Date.parse(start) >= Date.parse(snapshot.week.timeMax) && Date.parse(start) < Date.parse(snapshot.reviewTimeMax));
        if (starts.length !== expected) { complete = false; break; }
        for (const start of starts) {
            const p = dateParts(new Date(start), CAIRO);
            days.push(new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay());
        }
        signatures.push([identityHash(key), master.recurrence, master.start]);
    }
    return { name: name.trim(), fetchedAt: snapshot.updatedAt,
        events: events.map(({ id, start, end, originalStart, timeZone, colorId, recurring }) => ({ id, start, end, ...(originalStart ? { originalStart } : {}), timeZone, colorId, recurring })),
        ...(complete ? { weeklyDays: days.sort((a, b) => a - b), weeklySignature: identityHash(signatures.sort((a, b) => a[0].localeCompare(b[0]))) } : {}),
    };
}

module.exports = { createCalendarSchedules, currentWeek, scheduleFor, reviewFor };
