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
  const mod = { exports: {} };
  cache.set(file, mod);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    exports: mod.exports,
    module: mod,
    require: name => (name.startsWith('.') ? loadTs(path.resolve(path.dirname(file), name), cache) : require(name)),
    Date,
    Intl,
    Map,
    Set,
    JSON,
    Math,
    console,
  });
  return mod.exports;
}

const { AttendanceStatus } = loadTs('../types.ts');
const {
  isStudentInactiveInMonth,
  isStudentPausedInMonth,
  isStudentVisibleInMonth,
  nextMonthYear,
  pauseStudentFromMonth,
  reactivateStudentInMonth,
} = loadTs('../services/studentVisibility.ts');
const { calculateMonthlyStats } = loadTs('../services/monthlyStats.ts');

test('student attends month 1, pauses months 2-3, returns month 4 while preserving month 1 and hiding 2-3', () => {
  // Month indices: Jan=0, Feb=1, Mar=2, Apr=3, May=4 (year 2026)
  let student = {
    id: 's1',
    name: 'Yusuf',
    academy: 'خاص',
    rate: 100,
    location: 'جنيه',
    days: [1], // Mondays
    startedAt: { month: 0, year: 2026 },
  };
  const attendance = {
    s1_5_0_2026: AttendanceStatus.PRESENT, // Jan 5, 2026
  };

  // End enrollment at end of Jan -> deletedAt becomes Feb 2026 (month=1)
  const feb = nextMonthYear(0, 2026);
  assert.deepEqual(JSON.parse(JSON.stringify(feb)), { month: 1, year: 2026 });
  student = pauseStudentFromMonth(student, feb.month, feb.year);

  // Month 1 (Jan) still visible & billed even after pausing
  assert.equal(isStudentVisibleInMonth(student, 0, 2026, attendance), true);
  // Months 2 & 3 (Feb & Mar) hidden & flagged as paused
  assert.equal(isStudentVisibleInMonth(student, 1, 2026, attendance), false);
  assert.equal(isStudentVisibleInMonth(student, 2, 2026, attendance), false);
  assert.equal(isStudentPausedInMonth(student, 1, 2026), true);

  // Reactivate in Month 4 (Apr, month=3)
  student = { ...reactivateStudentInMonth(student, 3, 2026), days: [1] };

  // Still visible in Jan (0), still hidden in Feb (1) & Mar (2), visible in Apr (3) & May (4)!
  assert.equal(isStudentVisibleInMonth(student, 0, 2026, attendance), true);
  assert.equal(isStudentVisibleInMonth(student, 1, 2026, attendance), false);
  assert.equal(isStudentVisibleInMonth(student, 2, 2026, attendance), false);
  assert.equal(isStudentVisibleInMonth(student, 3, 2026, attendance), true);
  assert.equal(isStudentVisibleInMonth(student, 4, 2026, attendance), true);

  // Stats check: Jan keeps actual income (100), Feb/Mar stay 0 (and not listed or projected), Apr projects Mondays!
  const janStats = calculateMonthlyStats({ students: [student], attendance, month: 0, year: 2026, usdRate: 50, todayDate: '2026-04-01' });
  assert.equal(janStats.totalInEgp, 100);
  assert.deepEqual(JSON.parse(JSON.stringify(janStats.egpStudents.map(s => s.name))), ['Yusuf']);

  const febStats = calculateMonthlyStats({ students: [student], attendance, month: 1, year: 2026, usdRate: 50, todayDate: '2026-02-01' });
  assert.equal(febStats.totalInEgp, 0);
  assert.equal(febStats.projectedTotalInEgp, 0);
  assert.equal(febStats.egpStudents.length, 0);

  const aprStats = calculateMonthlyStats({ students: [student], attendance, month: 3, year: 2026, usdRate: 50, todayDate: '2026-04-01' });
  // Apr 2026 Mondays: 6, 13, 20, 27 -> 4 classes * 100 = 400
  assert.equal(aprStats.projectedTotalInEgp, 400);
});

test('supports multiple pause and return cycles and year boundary rollover', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(nextMonthYear(11, 2026))), { month: 0, year: 2027 });

  let student = { id: 's2', name: 'Ali', academy: 'Acad', rate: 50, location: 'جنيه', days: [2] };
  student = pauseStudentFromMonth(student, 1, 2026); // paused from Feb
  student = { ...reactivateStudentInMonth(student, 3, 2026), days: [2] }; // returned Apr
  student = pauseStudentFromMonth(student, 5, 2026); // paused again from Jun
  student = { ...reactivateStudentInMonth(student, 7, 2026), days: [2] }; // returned Aug

  assert.equal(isStudentInactiveInMonth(student, 0, 2026), false); // Jan active
  assert.equal(isStudentInactiveInMonth(student, 1, 2026), true);  // Feb paused
  assert.equal(isStudentInactiveInMonth(student, 2, 2026), true);  // Mar paused
  assert.equal(isStudentInactiveInMonth(student, 3, 2026), false); // Apr active
  assert.equal(isStudentInactiveInMonth(student, 4, 2026), false); // May active
  assert.equal(isStudentInactiveInMonth(student, 5, 2026), true);  // Jun paused
  assert.equal(isStudentInactiveInMonth(student, 6, 2026), true);  // Jul paused
  assert.equal(isStudentInactiveInMonth(student, 7, 2026), false); // Aug active
});

test('future-started student is not listed as paused when viewing earlier months', () => {
  const novStudent = { id: 's3', name: 'Bilal', academy: 'Acad', rate: 50, location: 'جنيه', days: [1], startedAt: { month: 10, year: 2026 } };
  assert.equal(isStudentInactiveInMonth(novStudent, 9, 2026), true);  // Oct inactive
  assert.equal(isStudentPausedInMonth(novStudent, 9, 2026), false);  // Oct not paused (not started yet)
  assert.equal(isStudentVisibleInMonth(novStudent, 9, 2026, {}), false);
  // If attendance exists in Oct, it remains visible:
  assert.equal(isStudentVisibleInMonth(novStudent, 9, 2026, { s3_5_9_2026: AttendanceStatus.PRESENT }), true);
});
