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
const { getRecentApologyClasses, ingestCalendarReviews, prepareCalendarAction, commitCalendarAction } = loadTs('../services/calendarReview.ts');
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

test('pending evidence survives archive and color reset, while deleted events are removed automatically', () => {
    const first = ingest([student()], [occurrence({ colorId: '11' })]);
    const reset = ingest(first, [occurrence({ colorId: '' })]);
    assert.equal(reset[0].calendarReview.pending.length, 1);
    const archived = ingest(reset, [], { archivedIds: ['occurrence-1'] });
    assert.equal(archived[0].calendarReview.pending.length, 1);
    assert.equal(archived[0].calendarReview.observed['occurrence-1'].present, false);
    assert.equal(ingest(archived, [], { archivedIds: ['occurrence-1'] }), archived);
    const deleted = ingest(archived, []);
    assert.equal(deleted[0].calendarReview.pending.length, 0);
    assert.equal(deleted[0].calendarReview.observed['occurrence-1'], undefined);
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

test('dayTransitionTime shifts early-morning Cairo classes and recurrence days to the previous day', async () => {
    // 2026-11-10T23:00:00Z is Wednesday 2026-11-11 01:00 AM in Africa/Cairo (UTC+2).
    // With dayTransitionTime = '07:00', 01:00 AM belongs to Tuesday 2026-11-10.
    const wednesday1amCairo = '2026-11-10T23:00:00Z';
    assert.equal(cairoDate(wednesday1amCairo, '00:00'), '2026-11-11');
    assert.equal(cairoDate(wednesday1amCairo, '07:00'), '2026-11-10');

    const e = occurrence({ start: wednesday1amCairo, end: '2026-11-10T23:30:00Z', colorId: '10', recurring: false });
    const students = ingest([student()], [e]);
    const data = { ...state(students), dayTransitionTime: '07:00' };
    const proposal = students[0].calendarReview.pending[0];
    const preview = prepareCalendarAction(data, 's1', proposal.id, 'schedule');
    const committed = commitCalendarAction(data, 's1', preview);
    assert.equal(committed.attendance[attendanceKey('s1', '2026-11-10')], 'e');
    assert.equal(committed.attendance[attendanceKey('s1', '2026-11-11')], undefined);

    // Recurrence on Wednesday 01:00 AM Cairo should map to Tuesday (2) when dayTransitionTime is 07:00.
    const fakeNow = new Date('2026-11-09T12:00:00Z');
    const starts = ['2026-11-03T23:00:00Z', '2026-11-10T23:00:00Z', '2026-11-17T23:00:00Z'];
    const read = createCalendarSchedules({ now: () => fakeNow, readToken: () => ({ token: 'test', expiry: '2027-01-01T00:00:00Z' }), fetchImpl: async raw => {
        const url = new URL(raw);
        let value;
        if (url.pathname.endsWith('/calendarList')) value = { items: [{ id: 'cal', summary: 'Students', selected: true }] };
        else if (url.searchParams.get('singleEvents') === 'false') value = { items: [{ id: 'series', summary: 'Bilal', recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=WE'], start: { dateTime: starts[0], timeZone: 'Africa/Cairo' } }] };
        else value = { items: starts.map((start, index) => ({ id: `e${index}`, summary: 'Bilal', iCalUID: 'uid', colorId: '', recurringEventId: 'series', originalStartTime: { dateTime: start }, start: { dateTime: start, timeZone: 'Africa/Cairo' }, end: { dateTime: start } })) };
        return { ok: true, status: 200, json: async () => value };
    } });
    const resMidnight = await read([{ id: 's1', name: 'Bilal' }], { review: true, dayTransitionTime: '00:00' });
    assert.deepEqual(resMidnight.reviews.s1.weeklyDays, [3]); // Wednesday
    const res7am = await read([{ id: 's1', name: 'Bilal' }], { review: true, dayTransitionTime: '07:00' });
    assert.deepEqual(res7am.reviews.s1.weeklyDays, [2]); // Tuesday
});

test('a 60-minute class on Saturday and 30-minute class on Sunday matches [6, 6, 0] without false weekly prompt', () => {
    // Next week Saturday (60 min) + Sunday (30 min)
    const satStart = new Date(Date.parse(week.timeMax) + 12 * 3600000).toISOString();
    const satEnd = new Date(Date.parse(satStart) + 60 * 60000).toISOString();
    const sunStart = new Date(Date.parse(week.timeMax) + 86400000 + 12 * 3600000).toISOString();
    const sunEnd = new Date(Date.parse(sunStart) + 30 * 60000).toISOString();
    const events = [
        { ...occurrence({ id: 'sat', start: satStart, end: satEnd, colorId: '', recurring: true }), name: 'Bilal', seriesKey: 's-sat' },
        { ...occurrence({ id: 'sun', start: sunStart, end: sunEnd, colorId: '', recurring: true }), name: 'Bilal', seriesKey: 's-sun' },
    ];
    const snapshot = {
        week, reviewTimeMax: new Date(Date.parse(week.timeMax) + 7 * 86400000).toISOString(), updatedAt: now.toISOString(), events,
        masters: new Map([
            ['s-sat', { recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=SA'], start: { dateTime: satStart }, end: { dateTime: satEnd } }],
            ['s-sun', { recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=SU'], start: { dateTime: sunStart }, end: { dateTime: sunEnd } }],
        ]),
    };
    const rev = reviewFor('Bilal', snapshot);
    assert.deepEqual(rev.weeklyDays, [0, 6]);
    assert.deepEqual(rev.weeklyExpandedDays, [0, 6, 6]);

    // Student with [6, 6, 0] (السبت، السبت، الأحد) should NOT get a weekly proposal
    const mixedStudent = { ...student(), days: [6, 6, 0], duration: 'خليط' };
    const [afterIngest] = ingestCalendarReviews([mixedStudent], [{ id: 's1', name: 'Bilal' }], { available: true, schedules: {}, reviews: { s1: rev } });
    assert.equal(afterIngest.calendarReview.pending.length, 0);

    // Meanwhile, a regular 60-min student with [6] and a single 60-min Saturday event also does NOT get a prompt
    const single60Snap = { ...snapshot, events: [events[0]], masters: new Map([['s-sat', snapshot.masters.get('s-sat')]]) };
    const single60Rev = reviewFor('Bilal', single60Snap);
    const regular60Student = { ...student(), days: [6], duration: '٦٠' };
    const [afterReg60] = ingestCalendarReviews([regular60Student], [{ id: 's1', name: 'Bilal' }], { available: true, schedules: {}, reviews: { s1: single60Rev } });
    assert.equal(afterReg60.calendarReview.pending.length, 0);
});

test('weekly proposal re-prompts if student days in app or calendar days change after approval or ignore', () => {
    const future = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    // 1. Student has Wednesday [3], Calendar has Monday [1] (sig-mon)
    let students = ingest([{ ...student(), days: [3] }], [], { weeklyDays: [1], weeklySignature: 'sig-mon' });
    assert.equal(students[0].calendarReview.pending.length, 1);

    // 2. Teacher approves updating to Monday [1]
    let data = state(students);
    let committed = commitCalendarAction(data, 's1', prepareCalendarAction(data, 's1', students[0].calendarReview.pending[0].id, 'weekly', { effectiveFrom: future }));
    assert.deepEqual(json(committed.students[0].days), [1]);
    assert.equal(committed.students[0].calendarReview.pending.length, 0);

    // 3. Teacher manually changes student days back to Wednesday [3] in the app -> should immediately re-propose!
    const manuallyEdited = [{ ...committed.students[0], days: [3] }];
    students = ingest(manuallyEdited, [], { weeklyDays: [1], weeklySignature: 'sig-mon' });
    assert.equal(students[0].calendarReview.pending.length, 1);
    assert.deepEqual(json(students[0].calendarReview.pending[0].days), [1]);

    // 4. Teacher clicks Ignore this time -> stays silent while App=[3] & Calendar=[1]
    data = state(students);
    committed = commitCalendarAction(data, 's1', prepareCalendarAction(data, 's1', students[0].calendarReview.pending[0].id, 'ignore'));
    students = ingest(committed.students, [], { weeklyDays: [1], weeklySignature: 'sig-mon' });
    assert.equal(students[0].calendarReview.pending.length, 0);

    // 5. Teacher changes student days in App to Thursday [4] -> new mismatch prompts again!
    students = ingest([{ ...students[0], days: [4] }], [], { weeklyDays: [1], weeklySignature: 'sig-mon' });
    assert.equal(students[0].calendarReview.pending.length, 1);
});

test('returning event color to default after confirming red or green proposes resetting the recorded status', () => {
    // 1. Event is colored Red ('11') -> teacher confirms student apology ('r')
    const redEvent = occurrence({ id: 'luqman-1', colorId: '11', recurring: true });
    let students = ingest([student()], [redEvent]);
    let data = state(students);
    const key = attendanceKey('s1', cairoDate(redEvent.start));
    let committed = commitCalendarAction(data, 's1', prepareCalendarAction(data, 's1', students[0].calendarReview.pending[0].id, 'apology'));
    assert.equal(committed.attendance[key], 'r');
    assert.equal(committed.students[0].calendarReview.pending.length, 0);

    // 2. Teacher changes event color back to default ('') in Google Calendar -> proposes 'reset'
    students = ingest(committed.students, [{ ...redEvent, colorId: '' }]);
    assert.equal(students[0].calendarReview.pending.length, 1);
    assert.equal(students[0].calendarReview.pending[0].kind, 'reset');

    // 3. Teacher clicks Confirm ('reset') -> clears the apology ('r') without requiring extra replace checkbox
    data = { ...state(students), attendance: committed.attendance };
    const preview = prepareCalendarAction(data, 's1', students[0].calendarReview.pending[0].id, 'reset');
    assert.equal(preview.requiresReplace, false);
    committed = commitCalendarAction(data, 's1', preview);
    assert.equal(committed.attendance[key], undefined);
    assert.equal(committed.students[0].calendarReview.pending.length, 0);
});

test('getRecentApologyClasses returns last 3 student/teacher apologies and allows 1-click makeup confirmation', () => {
    const redNov3 = occurrence({ id: 'ev-nov3', start: '2026-11-03T18:00:00Z', end: '2026-11-03T18:30:00Z', colorId: '11', recurring: true });
    const greenNov14 = occurrence({ id: 'ev-nov14', start: '2026-11-14T18:00:00Z', end: '2026-11-14T18:30:00Z', colorId: '10', recurring: false });
    let students = ingest([student()], [redNov3, greenNov14]);
    const data = state(students);
    data.attendance.s1_1_10_2026 = 'r';  // 2026-11-01 student apology
    data.attendance.s1_3_10_2026 = 'x';  // 2026-11-03 teacher apology
    data.attendance.s1_8_10_2026 = 'r';  // 2026-11-08 student apology
    data.attendance.s1_10_10_2026 = 'x'; // 2026-11-10 teacher apology

    const recent = getRecentApologyClasses(students[0], data, '2026-11-14', 3);
    assert.deepEqual(json(recent.map(item => [item.date, item.status])), [
        ['2026-11-10', 'x'],
        ['2026-11-08', 'r'],
        ['2026-11-03', 'x'],
    ]);

    // Confirming makeup against 2026-11-03 (which also has a single observed red event) works without requiresReplace
    // and leaves the target day status empty so makeupLinks alone renders a single blue circle (not a double class with red dot)
    const greenProposal = students[0].calendarReview.pending.find(p => p.kind === 'scheduled');
    const preview = prepareCalendarAction(data, 's1', greenProposal.id, 'makeup', { sourceDate: '2026-11-03' });
    assert.equal(preview.requiresReplace, false);
    const committed = commitCalendarAction(data, 's1', preview);
    assert.equal(committed.attendance.s1_3_10_2026, 'م');
    assert.equal(committed.attendance.s1_14_10_2026, undefined);
    assert.equal(committed.makeupLinks[0].missedDay, 3);
    assert.equal(committed.makeupLinks[0].makeupDay, 14);
    assert.equal(committed.makeupLinks[0].originalStatus, 'x');
});

test('deleting future recurring classes in Google Calendar proposes ending enrollment starting from current month', () => {
    const luqman = {
        ...student(),
        name: 'Luqman',
        days: [2],
        calendarReview: {
            name: 'Luqman',
            observed: {
                past1: {
                    event: { id: 'past1', start: '2026-11-03T18:30:00.000Z', end: '2026-11-03T19:30:00.000Z', timeZone: 'Europe/Stockholm', colorId: '', recurring: true },
                    revision: 1,
                    present: true,
                },
            },
            pending: [],
            decisions: {},
            weeklySignature: 'prev-sig',
        },
    };
    const [updated] = ingestCalendarReviews([luqman], [{ id: 's1', name: 'Luqman' }], {
        available: true,
        schedules: { s1: { slots: [], status: 'empty' } },
        reviews: { s1: { name: 'Luqman', fetchedAt: now.toISOString(), events: [luqman.calendarReview.observed.past1.event] } },
    });
    assert.equal(updated.calendarReview.pending.length, 1);
    assert.equal(updated.calendarReview.pending[0].kind, 'weekly');
    assert.deepEqual(json(updated.calendarReview.pending[0].days), []);

    const data = state([updated]);
    const preview = prepareCalendarAction(data, 's1', updated.calendarReview.pending[0].id, 'weekly');
    assert.equal(preview.requiresReplace, false);
    const committed = commitCalendarAction(data, 's1', preview);
    assert.deepEqual(json(committed.students[0].days), []);
    assert.ok(committed.students[0].deletedAt);
});

test('handles Firebase-stripped calendarReview with undefined pending, observed, and decisions', () => {
    const firebaseStripped = {
        ...student(),
        calendarReview: {
            name: 'Bilal',
            weeklySignature: 'sig-1',
        },
    };
    const [updated] = ingestCalendarReviews([firebaseStripped], [{ id: 's1', name: 'Bilal' }], {
        available: true,
        schedules: {},
        reviews: {
            s1: {
                name: 'Bilal',
                fetchedAt: now.toISOString(),
                events: [{ id: 'ev1', start: '2026-11-12T17:00:00.000Z', end: '2026-11-12T17:30:00.000Z', timeZone: 'Europe/Stockholm', colorId: '11', recurring: true }],
            },
        },
    });
    assert.equal(updated.calendarReview.pending.length, 1);
    assert.equal(updated.calendarReview.pending[0].kind, 'red');
});
