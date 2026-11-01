const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFirebasePatch } = require('../firebase-patch');

test('unchanged local keys needing Firebase sanitization do not generate an upload', () => {
    const state = { academyRates: { 'School.A': { rate: 10 } }, paymentStatus: { 'School.A_2026': true } };
    assert.deepEqual(buildFirebasePatch(state, state), {});
});

test('actual edits and deletions still generate a Firebase patch', () => {
    const previous = { academyRates: { 'School.A': { rate: 10 } }, attendance: { 'one.1': 'present', 'two.2': 'absent' } };
    const current = { academyRates: { 'School.A': { rate: 20 } }, attendance: { 'one.1': 'absent' } };
    assert.deepEqual(buildFirebasePatch(current, previous), {
        academyRates: { School_A: { rate: 20 } },
        'attendance/one_1': 'absent',
        'attendance/two_2': null,
    });
});
