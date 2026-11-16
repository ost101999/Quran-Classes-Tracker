const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
};
const { getDetailedReportDays } = require('../services/academyReportDetails.ts');
const { AttendanceStatus: S } = require('../types.ts');
const student = { id: 's', name: 'Student', days: [0, 0, 1], duration: '60' };
const render = (records, options = {}, today = '2026-11-16') => getDetailedReportDays(student, records, 10, 2026, true, options, today);

test('lists recorded attendance and labels paid absences, without forecasting by default', () => {
  const result = render({ s_1_10_2026: S.DOUBLE_CLASS, s_2_10_2026: S.PAID_ABSENCE, s_8_10_2026: S.ABSENCE_RED });
  const text = result.lines.join('\n');
  assert.match(text, /Active days/);
  assert.match(text, /Sunday 1 November/);
  assert.match(text, /\(Absent\) Monday 2 November/);
  assert.doesNotMatch(text, /2026/);
  assert.doesNotMatch(text, /Missing|coming|8 November/);
  assert.equal(result.extraSessions, 0);
});

test('Hazem excludes teacher and student apologies, including double scheduled days', () => {
  const result = render({ s_1_10_2026: S.PRESENT, s_2_10_2026: S.PAID_ABSENCE, s_8_10_2026: S.ABSENCE_RED, s_9_10_2026: S.UNEXCUSED_ABSENCE }, { hazemSystem: true });
  const text = result.lines.join('\n');
  assert.match(text, /Counted sessions \(2\)/);
  assert.match(text, /Absent \(Counted\):\*\n• Monday, 2 November/);
  assert.match(text, /- \*Counted sessions \(2\):\*\n\s+- \*\(Not Counted\) \(3\)\*/);
  assert.match(text, /Apology \(Not Counted\):\*\n• Sunday, 8 November - Student\n• Monday, 9 November - Teacher/);
  assert.equal(result.extraSessions, 0);
  assert.equal(result.expectedExtraSessions, 13);
  assert.doesNotMatch(text, /Active days coming/);
});

test('Hazem separates all expected sessions from counted sessions', () => {
  const records = { s_1_10_2026: S.DOUBLE_CLASS, s_2_10_2026: S.PAID_ABSENCE, s_8_10_2026: S.ABSENCE_RED };
  const hidden = render(records, { hazemSystem: true });
  const shown = render(records, { hazemSystem: true, autoCompleteReport: true });
  assert.equal(hidden.extraSessions, 0);
  assert.equal(shown.extraSessions, 6);
  assert.equal(hidden.expectedExtraSessions, 12);
  assert.equal(shown.expectedExtraSessions, 12);
  assert.match(shown.lines.join('\n'), /Counted sessions \(9\)/);
  assert.match(shown.lines.join('\n'), /22 November/);
  assert.match(shown.lines.join('\n'), /Upcoming:\*\n• Sunday, 22 November/);
  assert.doesNotMatch(shown.lines.join('\n'), /Active days coming/);
  assert.ok(shown.lines.findIndex(line => line.includes('Upcoming')) < shown.lines.findIndex(line => line.includes('Apology')));
  assert.doesNotMatch(hidden.lines.join('\n'), /Active days coming/);
});

test('projects only future unrecorded scheduled sessions, respecting double days, holidays and billing cutoff', () => {
  const result = render({ s_22_10_2026: S.EXEMPT }, { autoCompleteReport: true, billingStartDay: 25 });
  const text = result.lines.join('\n');
  assert.match(text, /Active days coming/);
  assert.match(text, /23 November/);
  assert.doesNotMatch(text, /22 November|29 November|16 November/);
  assert.equal(result.extraSessions, 1);
  const holidays = render({}, { autoCompleteReport: true, billingStartDay: 25, holidays: [1] });
  assert.match(holidays.lines.join('\n'), /22 November/);
  assert.doesNotMatch(holidays.lines.join('\n'), /23 November 2026/);
  assert.equal(holidays.extraSessions, 2);
});

test('uses the billing period across a year boundary and preserves transferred absence', () => {
  const result = getDetailedReportDays(student, { s_24_11_2025: S.PRESENT, s_25_11_2025: S.PRESENT, s_4_0_2026: S.TRANSFERRED_ABSENT, s_25_0_2026: S.PRESENT }, 0, 2026, true, { billingStartDay: 25 }, '2026-02-01');
  const text = result.lines.join('\n');
  assert.match(text, /25 December/);
  assert.match(text, /\(Absent\) Sunday 4 January/);
  assert.doesNotMatch(text, /24 December|25 January/);
});

test('formats Arabic labels and the counted sessions', () => {
  const result = getDetailedReportDays(student, { s_1_10_2026: S.PRESENT, s_2_10_2026: S.PAID_ABSENCE, s_8_10_2026: S.ABSENCE_RED }, 10, 2026, false, { hazemSystem: true }, '2026-11-16');
  const text = result.lines.join('\n');
  assert.match(text, /الحصص المحسوبة \(٢\)/);
  assert.match(text, /الغياب \(محسوب\)/);
  assert.match(text, /اعتذار \(غير محسوب\)/);
  assert.match(text, / - الطالب/);
});
