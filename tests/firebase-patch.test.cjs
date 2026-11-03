const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFirebasePatch } = require('../firebase-patch');

test('unchanged local keys needing Firebase sanitization do not generate an upload', () => {
    const state = { academyRates: { 'School.A': { rate: 10 } }, paymentStatus: { 'School.A_2026': true } };
    assert.deepEqual(buildFirebasePatch(state, state), {});
});

test('recording the last received cloud revision does not create an upload', () => {
    assert.deepEqual(buildFirebasePatch({ students: [], lastUpdated: 42 }, { students: [], lastUpdated: 41 }), {});
});

test('actual edits and deletions still generate a Firebase patch', () => {
    const previous = { academyRates: { 'School.A': { rate: 10 } }, attendance: { 'one.1': 'present', 'two.2': 'absent' } };
    const current = { academyRates: { 'School.A': { rate: 20 } }, attendance: { 'one.1': 'absent' } };
    assert.deepEqual(buildFirebasePatch(current, previous), {
        'academyRates/School_A': { rate: 20 },
        'attendance/one_1': 'absent',
        'attendance/two_2': null,
    });
});

test('saving one student report does not replace reports from another device', () => {
    const baseline = {
        lastReports: { studentA: { text: 'old A' }, studentB: { text: 'old B' } },
        savedReports: { reportA: 'old report A', reportB: 'old report B' },
        savedReportDrafts: { reportA: { note: 'old A' }, reportB: { note: 'old B' } },
    };
    const local = {
        lastReports: { ...baseline.lastReports, studentA: { text: 'new A' } },
        savedReports: { ...baseline.savedReports, reportA: 'new report A' },
        savedReportDrafts: { ...baseline.savedReportDrafts, reportA: { note: 'new A' } },
    };
    assert.deepEqual(buildFirebasePatch(local, baseline), {
        'lastReports/studentA': { text: 'new A' },
        'savedReports/reportA': 'new report A',
        'savedReportDrafts/reportA': { note: 'new A' },
    });
});
