const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeStudents, mergeCalendarReview, mergeCalendarSchedule, mergeArrayByKey } = require('../sync-merge');
const { createSelectiveSync, get, set } = require('../selective-sync');
const { firebaseHash } = require('../firebase-hash');

const copy = value => JSON.parse(JSON.stringify(value));
const tag = value => `"${firebaseHash(value) || 'null_etag'}"`;

function server(initial) {
    const data = copy(initial), reads = [], writes = [];
    let beforePut;
    return {
        data, reads, writes,
        hook: fn => { beforePut = fn; },
        client: {
            async probe(path) { return { etag: tag(get(data, path)) }; },
            async read(path) { reads.push(path); const value = copy(get(data, path)); return { value, etag: tag(value) }; },
            async put(path, value, etag) {
                if (beforePut) await beforePut(path, value, etag);
                if (etag && etag !== tag(get(data, path))) throw Object.assign(new Error('precondition'), { status: 412 });
                writes.push(path);
                set(data, path, value?.['.sv'] === 'timestamp' ? Date.now() : value);
                return { etag: tag(get(data, path)) };
            },
        },
    };
}

test('auto-merges student added on Windows while Mac updates calendar schedules without conflict', () => {
    const base = [
        { id: 's1', name: 'Eesa', days: [], rate: 5, calendarSchedule: { updatedAt: '2026-11-21T10:00:00.000Z', slots: [] } },
        { id: 's2', name: 'Bilal', days: [1, 3], rate: 6 },
    ];
    // Firebase strips empty days array on remote
    const remote = [
        { id: 's1', name: 'Eesa', rate: 5, paymentBasis: 'بالحصة', calendarSchedule: { updatedAt: '2026-11-21T16:30:00.000Z', slots: [] } },
        { id: 's2', name: 'Bilal', days: [1, 3], rate: 6 },
        { id: 'new1', name: 'Ibrahim Siddick', days: [6, 0], rate: 1.75 },
    ];
    const local = [
        { id: 's1', name: 'Eesa', days: [], rate: 5, calendarSchedule: { updatedAt: '2026-11-21T16:40:00.000Z', slots: [{ start: '2026-11-22T10:00:00Z' }] } },
        { id: 's2', name: 'Bilal', days: [1, 3], rate: 6, zoomLink: 'https://zoom.us/j/123' },
    ];

    const res = mergeStudents(base, local, remote);
    assert.equal(res.conflicts.length, 0);
    assert.equal(res.merged.length, 3);
    assert.ok(res.merged.some(s => s.id === 'new1' && s.name === 'Ibrahim Siddick'));
    const s1 = res.merged.find(s => s.id === 's1');
    assert.equal(s1.paymentBasis, 'بالحصة');
    assert.equal(s1.calendarSchedule.updatedAt, '2026-11-21T16:40:00.000Z');
    const s2 = res.merged.find(s => s.id === 's2');
    assert.equal(s2.zoomLink, 'https://zoom.us/j/123');
});

test('mergeCalendarReview preserves decisions and observed events from both devices', () => {
    const base = { name: 'Ali', observed: { e1: { revision: 1, event: { id: 'e1' } } }, pending: [{ id: 'p1', detectedAt: '2026-11-21T10:00:00Z' }], decisions: {} };
    const local = { name: 'Ali', observed: { e1: { revision: 2, event: { id: 'e1' } } }, pending: [], decisions: { p1: { action: 'schedule', decidedAt: 100 } } };
    const remote = { name: 'Ali', observed: { e1: { revision: 1, event: { id: 'e1' } }, e2: { revision: 1, event: { id: 'e2' } } }, pending: [{ id: 'p1', detectedAt: '2026-11-21T10:00:00Z' }, { id: 'p2', detectedAt: '2026-11-21T11:00:00Z' }], decisions: {} };

    const merged = mergeCalendarReview(base, local, remote);
    assert.equal(merged.observed.e1.revision, 2);
    assert.ok(merged.observed.e2);
    assert.equal(merged.decisions.p1.action, 'schedule');
    assert.deepEqual(merged.pending.map(p => p.id), ['p2']);
});

test('real field conflict isolates only the conflicting field and resolution still keeps other new students', () => {
    const base = [{ id: 's1', name: 'Eesa', rate: 5, days: [1] }];
    const local = [{ id: 's1', name: 'Eesa', rate: 8, days: [1] }];
    const remote = [
        { id: 's1', name: 'Eesa', rate: 10, days: [1] },
        { id: 'new1', name: 'Ibrahim Siddick', rate: 1.75, days: [6, 0] },
    ];

    const check = mergeStudents(base, local, remote);
    assert.equal(check.conflicts.length, 1);
    assert.equal(check.conflicts[0].studentId, 's1');
    assert.equal(check.conflicts[0].fields[0].field, 'rate');

    const resolvedLocal = mergeStudents(base, local, remote, { prefer: 'local' });
    assert.equal(resolvedLocal.merged.find(s => s.id === 's1').rate, 8);
    assert.ok(resolvedLocal.merged.some(s => s.id === 'new1'), 'choosing local must never drop remote-added student');
});

test('selectiveSync push auto-merges concurrent student additions and notifies caller', async () => {
    const baseData = { students: [{ id: 's1', name: 'Eesa', rate: 5, days: [] }], academyOrder: ['Aya'] };
    const cloud = server(baseData);
    const win = createSelectiveSync({ client: cloud.client, baseline: baseData });
    const mac = createSelectiveSync({ client: cloud.client, baseline: baseData });

    const winData = copy(baseData);
    winData.students.push({ id: 'new1', name: 'Ibrahim Siddick', rate: 1.75, days: [6, 0] });
    winData.academyOrder.push('B');
    await win.push(winData);

    const macData = copy(baseData);
    macData.students[0].calendarSchedule = { updatedAt: '2026-11-21T16:50:00.000Z', slots: [] };
    macData.academyOrder.push('C');
    let mergedPayload = null;
    await mac.push(macData, { onMerge: fields => { mergedPayload = fields; } });

    assert.equal(mac.conflicts().length, 0);
    assert.ok(mergedPayload);
    assert.equal(mergedPayload.students.length, 2);
    assert.ok(mergedPayload.students.some(s => s.id === 'new1'));
    assert.ok(mergedPayload.students[0].calendarSchedule);
    assert.deepEqual(mergedPayload.academyOrder, ['Aya', 'B', 'C']);
    assert.equal(cloud.data.students.length, 2);
});

test('selectiveSync push retries 412 mid-flight race on students via auto-merge', async () => {
    const baseData = { students: [{ id: 's1', name: 'Eesa', rate: 5, days: [] }] };
    const cloud = server(baseData);
    const mac = createSelectiveSync({ client: cloud.client, baseline: baseData });
    const macData = copy(baseData);
    macData.students[0].zoomLink = 'https://zoom.us/j/1';

    let injected = false;
    cloud.hook(path => {
        if (path === 'students' && !injected) {
            injected = true;
            cloud.data.students.push({ id: 'new1', name: 'Ibrahim Siddick', rate: 1.75 });
        }
    });

    let mergedPayload = null;
    await mac.push(macData, { onMerge: fields => { mergedPayload = fields; } });
    assert.equal(cloud.data.students.length, 2);
    assert.equal(cloud.data.students[0].zoomLink, 'https://zoom.us/j/1');
    assert.ok(mergedPayload?.students?.some(s => s.id === 'new1'));
});

test('mergeArrayByKey merges concurrent additions and respects single-side deletions', () => {
    const base = ['A', 'B', 'C'];
    const local = ['A', 'C', 'D']; // deleted B, added D
    const remote = ['A', 'B', 'C', 'E']; // added E
    const res = mergeArrayByKey(base, local, remote, x => String(x));
    assert.deepEqual(res.merged, ['A', 'C', 'E', 'D']);
});
