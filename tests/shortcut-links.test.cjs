const test = require('node:test');
const assert = require('node:assert/strict');
const { parseShortcuts, findMatches, findReadingMatches, isExistingFile, zoomLink, driveLink, folderName } = require('../shortcut-links');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const syncSource = fs.readFileSync(require('node:path').join(__dirname, '../services/shortcutStudentSync.ts'), 'utf8');
const syncModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(syncSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: syncModule.exports, URL });
const { applyShortcutMatches, findShortcutDifferences, linksEquivalent } = syncModule.exports;

test('matches the student folder without its numeric prefix and combines duplicate entries', () => {
    const groups = parseShortcuts([
        '[Files]',
        "Bilal's Quran book=C:\\Students\\16 Bilal\\Bilal Quran.pdf|zoommtg://zoom.us/join?action=join&confno=12345&pwd=secret|||",
        "Bilal's Quran book=C:\\Students\\16 Bilal\\Bilal Quran.pdf||||https://drive.google.com/file/d/abc_123/view?resourcekey=key",
        'Eisa Quran=C:\\Students\\17 Eisa\\Eisa Quran.pdf|zoommtg://zoom.us/join?confno=999||',
        '[Settings]',
        'ignored=C:\\Students\\16 Bilal\\Other Quran.pdf|https://drive.google.com/file/d/other/view',
    ].join('\n'));
    const matches = findMatches(groups, 'Bilal');
    assert.equal(matches.length, 1);
    assert.equal(matches[0].exact, true);
    assert.equal(matches[0].conflict, false);
    assert.equal(matches[0].zoomLink, 'https://zoom.us/j/12345?pwd=secret');
    assert.equal(matches[0].quranLink, 'https://drive.google.com/file/d/abc_123/view?resourcekey=key');
    assert.equal(folderName('C:\\Students\\٢٣ـ أحمد\\مصحف.pdf'), 'أحمد');
});

test('identifies multiple Quran files in a single student folder as separate choices', () => {
    const groups = parseShortcuts([
        '[Files]',
        'Bilal Quran=C:\\Students\\16 Bilal\\Bilal Quran.pdf||||https://drive.google.com/file/d/bilal/view',
        'Eisa Quran=C:\\Students\\16 Bilal\\Eisa Quran.pdf||||https://drive.google.com/file/d/eisa/view',
    ].join('\n'));
    assert.equal(findMatches(groups, 'Bilal').filter(match => match.exact).length, 2);
});

test('marks conflicting links for the same file for review', () => {
    const groups = parseShortcuts([
        '[Files]',
        'Quran=C:\\Students\\2 Name\\Quran.pdf||||https://drive.google.com/file/d/first/view',
        'Quran=C:\\Students\\2 Name\\Quran.pdf||||https://drive.google.com/file/d/second/view',
    ].join('\n'));
    assert.equal(groups[0].conflict, true);
    assert.equal(groups[0].quranLink, '');
});

test('accepts file and Zoom links only from the intended hosts', () => {
    assert.equal(zoomLink('zoommtg://zoom.us/join?confno=123&pwd=test'), 'https://zoom.us/j/123?pwd=test');
    assert.equal(zoomLink('https://zoom.us.evil.example/j/123'), '');
    assert.equal(zoomLink('zoommtg://zoom.us/join?confno=abc'), '');
    assert.equal(driveLink('https://drive.google.com/open?id=abc_123'), 'https://drive.google.com/open?id=abc_123');
    assert.equal(driveLink('https://drive.google.com/drive/folders/abc_123'), '');
    assert.equal(driveLink('https://drive.google.com.evil.example/file/d/abc/view'), '');
});

test('fills missing links and preserves existing links when the source differs', () => {
    const student = { id: '1', name: 'Bilal', zoomLink: 'https://zoom.us/j/current' };
    const match = { id: 'file1', exact: true, conflict: false, zoomLink: 'https://zoom.us/j/new', quranLink: 'https://drive.google.com/file/d/abc/view' };
    const result = { matches: { '1': [match] }, groups: [match] };
    const [updated] = applyShortcutMatches([student], [{ id: '1', name: 'Bilal' }], result);
    assert.equal(updated.zoomLink, student.zoomLink);
    assert.equal(updated.quranLink, match.quranLink);
    assert.equal(updated.shortcutSourceId, 'file1');
    const unchanged = [updated];
    assert.equal(applyShortcutMatches(unchanged, [{ id: '1', name: 'Bilal' }], result), unchanged);
});

test('does not automatically choose ambiguous or shared matches, or unconfirmed new students', () => {
    const match = { id: 'file1', exact: true, conflict: false, zoomLink: 'https://zoom.us/j/1', quranLink: '' };
    const other = { ...match, id: 'file2' };
    const student = { id: '1', name: 'Bilal' };
    const requests = [{ id: '1', name: 'Bilal' }];
    const ambiguous = [student];
    assert.equal(applyShortcutMatches(ambiguous, requests, { matches: { '1': [match, other] }, groups: [match, other] }), ambiguous);
    const pending = [{ ...student, shortcutAutoMatchDisabled: true }];
    assert.equal(applyShortcutMatches(pending, requests, { matches: { '1': [match] }, groups: [match] }), pending);
    const duplicate = [student, { id: '2', name: 'Bilal' }];
    assert.equal(applyShortcutMatches(duplicate, [...requests, { id: '2', name: 'Bilal' }], { matches: { '1': [match], '2': [match] }, groups: [match] }), duplicate);
});

test('refreshes a confirmed file when a missing link appears later', () => {
    const student = { id: '1', name: 'Name', shortcutSourceId: 'file1', zoomLink: 'https://zoom.us/j/1' };
    const match = { id: 'file1', exact: true, conflict: false, zoomLink: 'https://zoom.us/j/2', quranLink: 'https://drive.google.com/file/d/later/view' };
    const [updated] = applyShortcutMatches([student], [{ id: '1', name: 'Name' }], { matches: { '1': [match] }, groups: [match] });
    assert.equal(updated.zoomLink, student.zoomLink);
    assert.equal(updated.quranLink, match.quranLink);
});

test('ignores similar names and files in nested folders', () => {
    const groups = parseShortcuts([
        '[Files]',
        'Ismail Quran=C:\\Students\\7 Ismail Ahmed\\Quran.pdf||||https://drive.google.com/file/d/ismail/view',
        'Ahmed Quran=C:\\Students\\14 Ahmed\\Quran.pdf||||https://drive.google.com/file/d/ahmed/view',
        'Eisa Quran=C:\\Students\\7 Ismail Ahmed\\Other\\Quran.pdf||||https://drive.google.com/file/d/eisa/view',
    ].join('\n'));
    const matches = findMatches(groups, 'Ismail Ahmed');
    assert.equal(matches.length, 1);
    assert.equal(matches[0].path, 'C:\\Students\\7 Ismail Ahmed\\Quran.pdf');
    assert.equal(findMatches(groups, 'Ismail').length, 0);
});

test('recognizes only existing files, not missing paths or directories', () => {
    assert.equal(isExistingFile(__filename), true);
    assert.equal(isExistingFile(__dirname), false);
    assert.equal(isExistingFile(require('node:path').join(__dirname, 'missing-quran.pdf')), false);
});

test('does not refresh a previously linked file when it no longer matches the folder', () => {
    const student = { id: '1', name: 'Ismail Ahmed', shortcutSourceId: 'old-file' };
    const old = { id: 'old-file', exact: true, conflict: false, zoomLink: 'https://zoom.us/j/1', quranLink: '' };
    const newer = { id: 'new-file', exact: true, conflict: false, zoomLink: 'https://zoom.us/j/2', quranLink: '' };
    const students = [student];
    assert.equal(applyShortcutMatches(students, [{ id: '1', name: 'Ismail Ahmed' }], { matches: { '1': [newer] }, groups: [old, newer] }), students);
});

test('reads Zoom and Drive from the fields used by MagicOpen', () => {
    const [group] = parseShortcuts('[Files]\nQuran=C:\\Students\\1 Name\\Quran.pdf|https://zoom.us/j/123|1|https://drive.google.com/file/d/academy/view|https://drive.google.com/file/d/quran/view');
    assert.equal(group.zoomLink, 'https://zoom.us/j/123');
    assert.equal(group.quranLink, 'https://drive.google.com/file/d/quran/view');
});

test('recognizes equivalent Zoom and Drive links while detecting meaningful changes', () => {
    assert.equal(linksEquivalent('https://us04web.zoom.us/j/12345?pwd=abc', 'https://zoom.us/j/12345?pwd=abc', 'zoom'), true);
    assert.equal(linksEquivalent('zoommtg://zoom.us/join?confno=12345&pwd=abc', 'https://zoom.us/j/12345?pwd=abc', 'zoom'), true);
    assert.equal(linksEquivalent('https://zoom.us/j/12345?pwd=abc', 'https://zoom.us/j/12345?pwd=changed', 'zoom'), false);
    assert.equal(linksEquivalent('https://drive.google.com/file/d/abc/view?usp=sharing', 'https://drive.google.com/file/d/abc/preview', 'quran'), true);
    assert.equal(linksEquivalent('https://drive.google.com/file/d/abc/view', 'https://drive.google.com/file/d/abc/view?resourcekey=key', 'quran'), false);
    assert.equal(linksEquivalent('https://drive.google.com/file/d/abc/view', 'https://drive.google.com/file/d/other/view', 'quran'), false);
});

test('reports changed existing links with the student name and stable notification key', () => {
    const student = { id: '1', name: 'Bilal', shortcutSourceId: 'file1', zoomLink: 'https://zoom.us/j/1', quranLink: 'https://drive.google.com/file/d/old/view' };
    const match = { id: 'file1', exact: true, conflict: false, zoomLink: 'https://zoom.us/j/2', quranLink: 'https://drive.google.com/file/d/new/view' };
    const requests = [{ id: '1', name: 'Bilal' }];
    const result = { matches: { '1': [match] }, groups: [match] };
    const alerts = findShortcutDifferences([student], requests, result);
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].studentName, 'Bilal');
    assert.equal(alerts[0].zoom, true);
    assert.equal(alerts[0].quran, true);
    assert.equal(findShortcutDifferences([student], requests, result)[0].key, alerts[0].key);
    assert.notEqual(findShortcutDifferences([student], requests, { matches: { '1': [{ ...match, zoomLink: 'https://zoom.us/j/3' }] }, groups: [] })[0].key, alerts[0].key);
});

test('does not report missing, equivalent, ambiguous or unconfirmed links as changes', () => {
    const student = { id: '1', name: 'Bilal', zoomLink: 'https://us04web.zoom.us/j/1?pwd=abc', quranLink: '' };
    const match = { id: 'file1', exact: true, conflict: false, zoomLink: 'https://zoom.us/j/1?pwd=abc', quranLink: 'https://drive.google.com/file/d/new/view' };
    const requests = [{ id: '1', name: 'Bilal' }];
    assert.equal(findShortcutDifferences([student], requests, { matches: { '1': [match] }, groups: [match] }).length, 0);
    const changed = { ...match, zoomLink: 'https://zoom.us/j/2' };
    assert.equal(findShortcutDifferences([{ ...student, shortcutAutoMatchDisabled: true }], requests, { matches: { '1': [changed] }, groups: [changed] }).length, 0);
    assert.equal(findShortcutDifferences([student], requests, { matches: { '1': [changed, { ...changed, id: 'file2' }] }, groups: [] }).length, 0);
});

test('recognizes Quran and reading records independently from the same folder', () => {
    const groups = parseShortcuts([
        '[Files]',
        "Bilal Quran=C:\\Students\\16 Bilal\\Bilal Quran.pdf|https://zoom.us/j/1|1||https://drive.google.com/file/d/quran/view",
        "Bilal Reading Book=C:\\Students\\16 Bilal\\Bilal Reading Book.pdf|https://zoom.us/j/1|1||https://drive.google.com/file/d/reading/view",
        'Noor Bayan=C:\\Other\\16 Bilal\\نور البيان.pdf|https://zoom.us/j/2|1||https://drive.google.com/file/d/other/view',
        'Reading Book=C:\\Students\\16 Bilal\\Other\\Reading Book.pdf|https://zoom.us/j/2|1||https://drive.google.com/file/d/nested/view',
    ].join('\n'));
    const quran = findMatches(groups, 'Bilal');
    const reading = findReadingMatches(groups, 'Bilal');
    assert.equal(quran.length, 1);
    assert.equal(reading.length, 2);
    assert.equal(reading.filter(item => item.folderId === quran[0].folderId).length, 1);
    assert.equal(reading.find(item => item.folderId === quran[0].folderId).readingLink, 'https://drive.google.com/file/d/reading/view');
});

test('fills the reading link only from the confirmed Quran folder and preserves existing links', () => {
    const quran = { id: 'q1', folderId: 'folder1', exact: true, conflict: false, zoomLink: 'https://zoom.us/j/1', quranLink: '' };
    const book = { id: 'r1', folderId: 'folder1', exact: true, readingLink: 'https://drive.google.com/file/d/reading/view' };
    const other = { id: 'r2', folderId: 'folder2', exact: true, readingLink: 'https://drive.google.com/file/d/other/view' };
    const student = { id: '1', name: 'Bilal', shortcutSourceId: 'q1' };
    const requests = [{ id: '1', name: 'Bilal' }];
    const result = { matches: { '1': [quran] }, readingMatches: { '1': [book, other] }, groups: [quran, book, other] };
    const [updated] = applyShortcutMatches([student], requests, result);
    assert.equal(updated.readingLink, book.readingLink);
    assert.equal(updated.readingShortcutSourceId, 'r1');
    const [preserved] = applyShortcutMatches([{ ...student, readingLink: 'https://drive.google.com/file/d/existing/view' }], requests, result);
    assert.equal(preserved.readingLink, 'https://drive.google.com/file/d/existing/view');
    assert.equal(findShortcutDifferences([preserved], requests, result)[0].reading, true);
});

test('reports multiple, conflicting, invalid and missing reading files without selecting one', () => {
    const quran = { id: 'q1', folderId: 'f1', exact: true, conflict: false, zoomLink: '', quranLink: '' };
    const reading = { id: 'r1', folderId: 'f1', exact: true, readingLink: 'https://drive.google.com/file/d/r1/view' };
    const other = { ...reading, id: 'r2' };
    const student = { id: '1', name: 'Bilal', shortcutSourceId: 'q1' };
    const requests = [{ id: '1', name: 'Bilal' }];
    const makeResult = (books, missing = []) => ({ matches: { '1': [quran] }, readingMatches: { '1': books }, missingReadingMatches: { '1': missing }, groups: [quran, ...books] });
    for (const [result, issue] of [[makeResult([reading, other]), 'multiple'], [makeResult([{ ...reading, readingConflict: true }]), 'conflict'], [makeResult([{ ...reading, readingLinkInvalid: true }]), 'invalid'], [makeResult([], [reading]), 'missing']]) {
        assert.equal(findShortcutDifferences([student], requests, result)[0].readingIssue, issue);
        assert.ok(!applyShortcutMatches([student], requests, result)[0].readingLink);
    }
});

test('detects invalid reading links stored in the Drive field', () => {
    const groups = parseShortcuts('[Files]\nReading Book=C:\\Students\\1 Name\\Reading Book.pdf|https://zoom.us/j/1|1||https://example.com/file');
    assert.equal(groups[0].isReading, true);
    assert.equal(groups[0].readingLinkInvalid, true);
    assert.equal(groups[0].readingLink, '');
});

test('fills a reading link added later to the already linked file', () => {
    const quran = { id: 'q1', folderId: 'f1', exact: true, conflict: false, zoomLink: '', quranLink: '' };
    const reading = { id: 'r1', folderId: 'f1', exact: true, readingLink: '' };
    const requests = [{ id: '1', name: 'Bilal' }];
    const result = { matches: { '1': [quran] }, readingMatches: { '1': [reading] }, groups: [quran, reading] };
    const [linked] = applyShortcutMatches([{ id: '1', name: 'Bilal', shortcutSourceId: 'q1' }], requests, result);
    assert.equal(linked.readingShortcutSourceId, 'r1');
    assert.ok(!linked.readingLink);
    const later = { ...reading, readingLink: 'https://drive.google.com/file/d/later/view' };
    const [updated] = applyShortcutMatches([linked], requests, { ...result, readingMatches: { '1': [later] } });
    assert.equal(updated.readingLink, later.readingLink);
});
