const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function loadTs(file, cache = new Map()) {
    file = path.resolve(__dirname, file);
    if (!path.extname(file)) file += '.ts';
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} }; cache.set(file, mod);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { exports: mod.exports, module: mod, require: name => name.startsWith('.') ? loadTs(path.resolve(path.dirname(file), name), cache) : require(name), Date, Intl, Map, Set, JSON, console });
    return mod.exports;
}
const { ingestCalendarReviews, prepareCalendarAction, commitCalendarAction } = loadTs('../services/calendarReview.ts');
const { cairoDate, scheduledCount, replaceScheduleFrom } = loadTs('../services/studentSchedule.ts');
const { createCalendarSchedules, currentWeek, reviewFor } = require('../calendar-schedules');
const json = value => JSON.parse(JSON.stringify(value));
const now = new Date();
const week = currentWeek(now);
const occurrence = (overrides = {}) => ({ id: 'occurrence-1', start: new Date(Date.parse(week.timeMin) + 2 * 86400000 + 12 * 3600000).toISOString(), end: new Date(Date.parse(week.timeMin) + 2 * 86400000 + 13 * 3600000).toISOString(), timeZone: 'Europe/London', colorId: '10', recurring: false, ...overrides });
const student = () => ({ id: 's1', name: 'Bilal', academy: 'Test', rate: 10, location: 'جنيه', days: [2, 4] });
const result = (events, extras = {}) => ({ available: true, schedules: {}, reviews: { s1: { name: 'Bilal', fetchedAt: now.toISOString(), events, ...extras } } });
const ingest = (students, events, extras) => ingestCalendarReviews(students, [{ id: 's1', name: 'Bilal' }], result(events, extras));
const state = (students) => ({ students, attendance: {}, makeupLinks: [], savedReports: {}, savedReportDrafts: {} });
const attendanceKey = (studentId, date) => { const [y, m, d] = date.split('-').map(Number); return `${studentId}_${d}_${m - 1}_${y}`; };

test('detection only creates proposals and does not modify days, attendance or input data', () => {
    const students = [student()]; const before = JSON.stringify(students);
    const updated = ingest(students, [occurrence()]);
    assert.equal(JSON.stringify(students), before);
    assert.deepEqual(updated[0].days, [2, 4]);
    assert.equal(updated[0].calendarReview.pending[0].kind, 'scheduled');
    assert.equal(updated[0].calendarReview.pending[0].reason, 'green');
    assert.equal(ingest(updated, [occurrence()]), updated, 'unchanged polling does not save again');
});

test('explicit event colors alone determine red/green; ordinary recurring occurrences do not prompt', () => {
    const events = [occurrence({ id: 'ordinary', colorId: '', recurring: true }), occurrence({ id: 'red', colorId: '4' }), occurrence({ id: 'oneoff', colorId: '' })];
    const [updated] = ingest([student()], events);
    assert.deepEqual(json(updated.calendarReview.pending.map(p => [p.event.id, p.kind])), [['red', 'red'], ['oneoff', 'scheduled']]);
});

test('ignoring persists across reload and green color cleanup does not re-ask as a one-off', () => {
    const students = ingest([student()], [occurrence()]);
    const data = state(students); const proposal = students[0].calendarReview.pending[0];
    const committed = commitCalendarAction(data, 's1', prepareCalendarAction(data, 's1', proposal.id, 'ignore'));
    assert.deepEqual(json(committed.attendance), {});
    const reloaded = json(committed.students);
    assert.equal(ingest(reloaded, [occurrence()]), reloaded);
    const reset = ingest(reloaded, [occurrence({ colorId: '' })]);
    assert.equal(reset[0].calendarReview.pending.length, 0);
    const recolored = ingest(reset, [occurrence({ colorId: '11' })]);
    assert.equal(recolored[0].calendarReview.pending[0].kind, 'red');
});

test('pending evidence survives archive/removal and color reset without inferring absence', () => {
    const first = ingest([student()], [occurrence({ colorId: '11' })]);
    const reset = ingest(first, [occurrence({ colorId: '' })]);
    assert.equal(reset[0].calendarReview.pending.length, 1);
    const removed = ingest(reset, []);
    assert.equal(removed[0].calendarReview.pending.length, 1);
    assert.equal(removed[0].calendarReview.observed['occurrence-1'].present, false);
    assert.equal(ingest(removed, []), removed);
});

test('a moved recurring exception is detected on first read; repeat reads do not re-prompt', () => {
    const moved = occurrence({ colorId: '', recurring: true, originalStart: new Date(Date.parse(occurrence().start) - 86400000).toISOString() });
    const first = ingest([student()], [moved]);
    assert.equal(first[0].calendarReview.pending[0].kind, 'moved');
    assert.equal(first[0].calendarReview.pending[0].from, moved.originalStart);
    assert.equal(ingest(first, [moved]), first);
    const twice = ingest(first, [{ ...moved, start: new Date(Date.parse(moved.start) + 86400000).toISOString() }]);
    assert.equal(twice[0].calendarReview.pending.length, 1);
    assert.equal(twice[0].calendarReview.pending[0].from, moved.start);
});

test('matching is exact, ignores incomplete reads and does not link duplicate student names', () => {
    const students = [student()];
    assert.equal(ingestCalendarReviews(students, [{ id: 's1', name: 'Bilal' }], { available: false, schedules: {}, reviews: result([occurrence()]).reviews }), students);
    const renamed = [{ ...student(), name: 'Bilal Ahmed' }];
    assert.equal(ingest(renamed, [occurrence()]), renamed);
    const duplicates = [student(), { ...student(), id: 's2' }];
    assert.equal(ingest(duplicates, [occurrence()]), duplicates);
});

test('approving blue schedule changes only the selected date and records the decision once', () => {
    const students = ingest([student()], [occurrence()]); const data = state(students);
    data.attendance.unrelated = '1';
    const proposal = students[0].calendarReview.pending[0];
    const preview = prepareCalendarAction(data, 's1', proposal.id, 'schedule');
    assert.deepEqual(data.attendance, { unrelated: '1' }, 'preview is read-only');
    const committed = commitCalendarAction(data, 's1', preview);
    assert.equal(committed.attendance[attendanceKey('s1', cairoDate(occurrence().start))], 'e');
    assert.equal(committed.attendance.unrelated, '1');
    assert.equal(committed.students[0].calendarReview.pending.length, 0);
    assert.throws(() => commitCalendarAction({ ...data, ...committed }, 's1', preview), /لم يعد متاح/);
});

test('red needs an explicit meaning; overwriting a recorded state needs separate consent', () => {
    const students = ingest([student()], [occurrence({ colorId: '11' })]); const data = state(students);
    const proposal = students[0].calendarReview.pending[0];
    assert.throws(() => prepareCalendarAction(data, 's1', proposal.id, 'schedule'), /الإجراء المناسب/);
    const key = attendanceKey('s1', cairoDate(occurrence().start));
    data.attendance[key] = '1';
    const preview = prepareCalendarAction(data, 's1', proposal.id, 'apology');
    assert.equal(preview.requiresReplace, true);
    assert.throws(() => commitCalendarAction(data, 's1', preview), /أكد مراجعة/);
    assert.equal(commitCalendarAction(data, 's1', preview, true).attendance[key], 'r');
    assert.equal(prepareCalendarAction(data, 's1', proposal.id, 'teacher').changes[0].after, 'x');
    assert.equal(prepareCalendarAction(data, 's1', proposal.id, 'absence').changes[0].after, '!');
});

test('saved reports, drafts, existing makeup links and changes during confirmation are protected', () => {
    const students = ingest([student()], [occurrence()]); const data = state(students);
    const proposal = students[0].calendarReview.pending[0];
    const key = attendanceKey('s1', cairoDate(occurrence().start));
    data.savedReports[key] = 'Report';
    assert.throws(() => prepareCalendarAction(data, 's1', proposal.id, 'schedule'), /تقرير أو مسودة/);
    delete data.savedReports[key]; data.savedReportDrafts[key] = { draft: true };
    assert.throws(() => prepareCalendarAction(data, 's1', proposal.id, 'schedule'), /تقرير أو مسودة/);
    delete data.savedReportDrafts[key];
    const preview = prepareCalendarAction(data, 's1', proposal.id, 'schedule');
    data.attendance[key] = 'r';
    assert.throws(() => commitCalendarAction(data, 's1', preview, true), /تغيرت البيانات/);
    const [year, month, day] = cairoDate(occurrence().start).split('-').map(Number);
    data.makeupLinks.push({ studentId: 's1', month: month - 1, year, missedDay: day, makeupDay: day + 1 });
    assert.throws(() => prepareCalendarAction(data, 's1', proposal.id, 'schedule'), /مرتبط بالفعل/);
});

test('moving across a month clears only the source requirement and schedules the actual target date', () => {
    const e = occurrence({ start: '2026-12-01T10:00:00Z', end: '2026-12-01T11:00:00Z', originalStart: '2026-11-30T10:00:00Z', colorId: '', recurring: true });
    const students = ingest([{ ...student(), days: [1, 4] }], [e]); const data = state(students);
    const proposal = students[0].calendarReview.pending[0];
    const preview = prepareCalendarAction(data, 's1', proposal.id, 'move');
    const committed = commitCalendarAction(data, 's1', preview);
    assert.equal(committed.attendance.s1_30_10_2026, 'exempt');
    assert.equal(committed.attendance.s1_1_11_2026, 'e');
    assert.deepEqual(committed.students[0].days, [1, 4]);
    assert.throws(() => prepareCalendarAction(data, 's1', proposal.id, 'makeup'), /بين شهرين/);
});

test('makeup preview links the original and replacement dates only after confirmation', () => {
    const e = occurrence({ start: '2026-11-12T10:00:00Z', end: '2026-11-12T11:00:00Z' });
    const students = ingest([student()], [e]); const data = state(students);
    const proposal = students[0].calendarReview.pending[0];
    const preview = prepareCalendarAction(data, 's1', proposal.id, 'makeup', { sourceDate: '2026-11-10', doubleTarget: true });
    assert.equal(data.makeupLinks.length, 0);
    const committed = commitCalendarAction(data, 's1', preview);
    assert.equal(committed.attendance.s1_10_10_2026, 'م');
    assert.equal(committed.attendance.s1_12_10_2026, 'ed');
    assert.equal(committed.makeupLinks[0].missedDay, 10);
});

test('permanent weekly changes preserve earlier schedule versions and effective start gates', () => {
    let s = { ...student(), days: [2, 4], dayStartDates: { 2: '2026-10-20' } };
    s = replaceScheduleFrom(s, [1, 3], '2026-11-15');
    assert.equal(scheduledCount(s, 13, 9, 2026), 0, 'old Tuesday before start gate');
    assert.equal(scheduledCount(s, 10, 10, 2026), 1, 'old Tuesday stays scheduled');
    assert.equal(scheduledCount(s, 17, 10, 2026), 0, 'new Tuesday is not scheduled');
    assert.equal(scheduledCount(s, 16, 10, 2026), 1, 'new Monday is scheduled');
    s = replaceScheduleFrom(s, [5], '2026-12-01');
    assert.equal(scheduledCount(s, 16, 10, 2026), 1);
    assert.equal(scheduledCount(s, 4, 11, 2026), 1);
    assert.equal(scheduledCount(s, 10, 10, 2026), 1);
});

test('weekly approvals use future effective date and cannot rewrite a recorded class', () => {
    const future = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const [year, month, day] = future.split('-').map(Number);
    const dow = new Date(`${future}T12:00:00Z`).getUTCDay();
    const students = ingest([{ ...student(), days: [dow] }], [], { weeklyDays: [(dow + 1) % 7], weeklySignature: 'new-plan' });
    const data = state(students); const proposal = students[0].calendarReview.pending[0];
    const preview = prepareCalendarAction(data, 's1', proposal.id, 'weekly', { effectiveFrom: future });
    const committed = commitCalendarAction(data, 's1', preview);
    assert.equal(committed.students[0].scheduleHistory[0].before, future);
    data.attendance[`s1_${day}_${month - 1}_${year}`] = '!';
    assert.throws(() => prepareCalendarAction(data, 's1', proposal.id, 'weekly', { effectiveFrom: future }), /حصة مسجلة/);
    assert.throws(() => prepareCalendarAction(data, 's1', proposal.id, 'weekly', { effectiveFrom: '2000-01-01' }), /اليوم أو بعده/);
});

test('review read includes adjacent weeks and recurrence evidence without changing current-week schedule', async () => {
    const fakeNow = new Date('2026-11-09T12:00:00Z');
    const starts = ['2026-11-03T16:30:00Z', '2026-11-10T16:30:00Z', '2026-11-17T16:30:00Z'];
    const read = createCalendarSchedules({ now: () => fakeNow, readToken: () => ({ token: 'test', expiry: '2027-01-01T00:00:00Z' }), fetchImpl: async raw => {
        const url = new URL(raw);
        let value;
        if (url.pathname.endsWith('/calendarList')) value = { items: [{ id: 'cal', summary: 'Students', selected: true }] };
        else if (url.searchParams.get('singleEvents') === 'false') value = { items: [{ id: 'series', summary: 'Bilal', recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=TU'], start: { dateTime: starts[0], timeZone: 'Europe/London' } }] };
        else {
            assert.equal(url.searchParams.get('timeMin'), '2026-10-30T22:00:00.000Z');
            assert.equal(url.searchParams.get('timeMax'), '2026-11-20T22:00:00.000Z');
            value = { items: starts.map((start, index) => ({ id: `e${index}`, summary: 'Bilal', iCalUID: 'uid', colorId: index === 1 ? '10' : '', recurringEventId: 'series', originalStartTime: { dateTime: start }, start: { dateTime: start, timeZone: 'Europe/London' }, end: { dateTime: start } })) };
        }
        return { ok: true, status: 200, json: async () => value };
    } });
    const result = await read([{ id: 's1', name: 'Bilal' }], { review: true });
    assert.equal(result.available, true);
    assert.equal(result.schedules.s1.slots.length, 1);
    assert.equal(result.reviews.s1.events.length, 3);
    assert.deepEqual(result.reviews.s1.weeklyDays, [2]);
    assert.equal(result.reviews.s1.events[1].colorId, '10');
});

test('limited recurrence rules cannot be mistaken for a permanent weekly plan', () => {
    const event = { ...occurrence({ recurring: true }), name: 'Bilal', seriesKey: 'series' };
    const snapshot = { week, reviewTimeMax: new Date(Date.parse(week.timeMax) + 7 * 86400000).toISOString(), updatedAt: now.toISOString(), events: [event], masters: new Map([['series', { recurrence: ['RRULE:FREQ=WEEKLY;COUNT=3'], start: { dateTime: event.start } }]]) };
    assert.equal(reviewFor('Bilal', snapshot).weeklyDays, undefined);
});

test('moving one class must not erase another class at its source or silently merge with the target', () => {
    const e = occurrence({ start: '2026-11-12T10:00:00Z', originalStart: '2026-11-10T10:00:00Z', colorId: '', recurring: true });
    let students = ingest([{ ...student(), days: [2, 2, 4] }], [e]);
    let data = state(students); let p = students[0].calendarReview.pending[0];
    assert.throws(() => prepareCalendarAction(data, 's1', p.id, 'move'), /أكثر من حصة/);
    students = ingest([student()], [e]); data = state(students); p = students[0].calendarReview.pending[0];
    assert.throws(() => prepareCalendarAction(data, 's1', p.id, 'move'), /حصة مجدولة بالفعل/);
    const approved = commitCalendarAction(data, 's1', prepareCalendarAction(data, 's1', p.id, 'move', { doubleTarget: true }));
    assert.equal(approved.attendance.s1_12_10_2026, 'ed');
});
