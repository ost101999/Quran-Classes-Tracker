const test = require('node:test');
const assert = require('node:assert/strict');
const { createCalendarSchedules, currentWeek, scheduleFor } = require('../calendar-schedules');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const syncModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../services/calendarStudentSync.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: syncModule.exports, Date, Map });
const { applyCalendarSchedules } = syncModule.exports;
const now = new Date('2026-11-09T10:00:00Z');
const authorized = () => ({ token: 'test-token', expiry: '2027-01-01T00:00:00Z' });
const response = (value, status = 200) => ({ ok: status === 200, status, json: async () => value });
const event = (summary, dateTime, extra = {}) => ({ id: `${summary}-${dateTime}`, summary, status: 'confirmed', start: { dateTime, timeZone: 'Europe/London' }, ...extra });

test('Cairo week rolls over at Saturday midnight, including year and DST boundaries', () => {
    assert.deepEqual(currentWeek(now), { weekStart: '2026-11-07', weekEnd: '2026-11-13', timeMin: '2026-11-06T22:00:00.000Z', timeMax: '2026-11-13T22:00:00.000Z' });
    assert.equal(currentWeek(new Date('2026-11-06T21:59:59Z')).weekStart, '2026-10-31');
    assert.equal(currentWeek(new Date('2026-11-06T22:00:00Z')).weekStart, '2026-11-07');
    assert.equal(currentWeek(new Date('2027-01-01T12:00:00Z')).weekStart, '2026-12-26');
    const spring = currentWeek(new Date('2026-04-23T12:00:00Z'));
    assert.equal(spring.timeMin, '2026-04-17T22:00:00.000Z');
    assert.equal(spring.timeMax, '2026-04-24T21:00:00.000Z');
    const autumn = currentWeek(new Date('2026-10-29T12:00:00Z'));
    assert.equal(autumn.timeMin, '2026-10-23T21:00:00.000Z');
    assert.equal(autumn.timeMax, '2026-10-30T22:00:00.000Z');
});

test('reads all pages, expands recurrences, matches exact names, and excludes cancellations/all-day/out-of-week events', async () => {
    const calls = [];
    const read = createCalendarSchedules({ now: () => now, readToken: authorized, fetchImpl: async raw => {
        const url = new URL(raw); calls.push(url);
        if (url.pathname.endsWith('/calendarList')) return response(url.searchParams.has('pageToken')
            ? { items: [{ id: 'hidden', selected: true, hidden: true }, { id: 'unchecked', selected: false }] }
            : { items: [{ id: 'classes', selected: true }], nextPageToken: 'cal-page-2' });
        assert.ok(url.pathname.includes('/classes/'));
        assert.equal(url.searchParams.get('singleEvents'), 'true');
        assert.equal(url.searchParams.get('timeMax'), '2026-11-13T22:00:00.000Z');
        return response(url.searchParams.has('pageToken') ? { items: [event('Bilal', '2026-11-13T23:59:59+02:00')] } : {
            timeZone: 'Europe/London', nextPageToken: 'events-page-2', items: [
                event(' Bilal ', '2026-11-10T16:30:00Z'),
                event('Bilal Ahmed', '2026-11-11T16:30:00Z'),
                event('bilal', '2026-11-11T16:30:00Z'),
                event('Bilal', '2026-11-12T16:30:00Z', { status: 'cancelled' }),
                event('Bilal', '', { start: { date: '2026-11-12' } }),
                event('Bilal', '2026-11-06T21:30:00Z'),
                event('Bilal', '2026-11-13T22:00:00Z'),
            ],
        });
    } });
    const result = await read([{ id: '1', name: 'Bilal' }, { id: '2', name: 'Missing' }]);
    assert.equal(result.available, true);
    assert.equal(result.schedules['1'].slots.length, 2);
    assert.match(result.schedules['1'].message, /Tuesday\* -> \*04:30 PM/);
    assert.equal(result.schedules['2'].status, 'empty');
    assert.equal(calls.length, 4);
    await read([{ id: '3', name: 'Bilal' }]);
    assert.equal(calls.length, 4, 'one weekly snapshot serves every student');
});

test('refreshes moved/cancelled classes, reuses in-flight requests, and never publishes partial reads', async () => {
    let broken = false;
    let cancelled = false;
    let calls = 0;
    const read = createCalendarSchedules({ now: () => now, readToken: authorized, fetchImpl: async raw => {
        calls++;
        const url = new URL(raw);
        if (url.pathname.endsWith('/calendarList')) return response({ items: [{ id: 'first', selected: true }, { id: 'second', selected: true }] });
        if (url.pathname.includes('/second/')) return response({}, broken ? 503 : 200);
        return response({ items: cancelled ? [] : [event('Bilal', '2026-11-10T16:30:00Z')] });
    } });
    const requests = [{ id: '1', name: 'Bilal' }];
    const [first, second] = await Promise.all([read(requests, { force: true }), read(requests, { force: true })]);
    assert.equal(calls, 3);
    assert.deepEqual(first, second);
    broken = true;
    assert.equal((await read(requests, { force: true })).available, false);
    assert.equal((await read(requests)).available, false, 'failed refresh cannot resurrect an earlier cached success');
    broken = false; cancelled = true;
    const empty = await read(requests);
    assert.equal(empty.schedules['1'].status, 'empty');
    assert.deepEqual(empty.schedules['1'].slots, []);
});

test('refreshes OAuth in memory and retries a revoked access token once', async () => {
    let refreshes = 0;
    let calendarReads = 0;
    const saved = { ...authorized(), refresh_token: 'test-refresh', client_id: 'test-client', client_secret: 'test-secret' };
    const read = createCalendarSchedules({ now: () => now, readToken: () => saved, fetchImpl: async (raw, options) => {
        if (raw === 'https://oauth2.googleapis.com/token') {
            refreshes++;
            assert.equal(options.method, 'POST');
            return response({ access_token: 'renewed', expires_in: 3600 });
        }
        if (raw.includes('/calendarList?')) {
            calendarReads++;
            if (calendarReads === 1) return response({}, 401);
            assert.equal(options.headers.Authorization, 'Bearer renewed');
            return response({ items: [{ id: 'a', selected: true }] });
        }
        return response({ items: [] });
    } });
    assert.equal((await read([{ id: '1', name: 'Bilal' }])).available, true);
    assert.equal(refreshes, 1);
    assert.equal(saved.token, 'test-token');
});

test('shared copies are deduplicated and each occurrence retains its own timezone', async () => {
    const read = createCalendarSchedules({ now: () => now, readToken: authorized, fetchImpl: async raw => {
        if (raw.includes('/calendarList?')) return response({ items: [{ id: 'a', selected: true }, { id: 'b', selected: true }] });
        return response({ timeZone: 'Asia/Dubai', items: [
            event('Bilal', '2026-11-10T16:30:00Z', { iCalUID: 'shared' }),
            event('Bilal', '2026-11-12T16:30:00Z', { iCalUID: 'other', start: { dateTime: '2026-11-12T16:30:00Z' } }),
        ] });
    } });
    const { schedules } = await read([{ id: '1', name: 'Bilal' }]);
    assert.equal(schedules['1'].slots.length, 2);
    assert.match(schedules['1'].message, /08:30 PM\* \(Asia\/Dubai\)/);
});

test('new Cairo week bypasses snapshot cache even within one minute', async () => {
    let clock = new Date('2026-11-06T21:59:50Z');
    let calls = 0;
    const read = createCalendarSchedules({ now: () => clock, readToken: authorized, fetchImpl: async raw => {
        calls++;
        return response(raw.includes('/calendarList?') ? { items: [{ id: 'a', selected: true }] } : { items: [] });
    } });
    const requests = [{ id: '1', name: 'Bilal' }];
    assert.equal((await read(requests)).schedules['1'].weekStart, '2026-10-31');
    clock = new Date('2026-11-06T22:00:01Z');
    assert.equal((await read(requests)).schedules['1'].weekStart, '2026-11-07');
    assert.equal(calls, 4);
});

test('student merge ignores errors, renamed students, expired weeks and timestamp-only changes', () => {
    const week = currentWeek(new Date());
    const schedule = scheduleFor('Bilal', [], week, new Date().toISOString());
    const students = [{ id: '1', name: 'Bilal', scheduleMessage: 'old', quranLink: 'keep-me' }];
    const requests = [{ id: '1', name: 'Bilal' }];
    const result = { available: true, schedules: { '1': schedule } };
    const updated = applyCalendarSchedules(students, requests, result);
    assert.equal(updated[0].calendarSchedule.status, 'empty');
    assert.equal(updated[0].quranLink, 'keep-me');
    assert.equal(applyCalendarSchedules(updated, requests, { ...result, schedules: { '1': { ...schedule, updatedAt: new Date(Date.now() + 1000).toISOString() } } }), updated);
    assert.equal(applyCalendarSchedules(students, requests, { available: false, schedules: {} }), students);
    const renamed = [{ ...students[0], name: 'Other' }];
    assert.equal(applyCalendarSchedules(renamed, requests, result), renamed);
    assert.equal(applyCalendarSchedules(students, requests, { ...result, schedules: { '1': { ...schedule, timeMax: '2000-01-01T00:00:00Z' } } }), students);
});
