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
const { calculateMonthlyStats } = loadTs('../services/monthlyStats.ts');

test('projects remaining scheduled classes from today onward while ignoring past unrecorded days, holidays, and absences', () => {
  // November 2026: 1=Sun, 2=Mon, 3=Tue, ..., 16=Mon, 23=Mon, 30=Mon; 5=Thu, 12=Thu, 19=Thu, 26=Thu
  const student = { id: 's1', name: 'Ahmed', academy: 'Acad', rate: 100, location: 'جنيه', days: [1, 4] }; // Mon & Thu
  const attendance = {
    s1_2_10_2026: AttendanceStatus.PRESENT,          // Nov 2 (Mon) -> +100 actual
    s1_5_10_2026: AttendanceStatus.ABSENCE_RED,      // Nov 5 (Thu) -> 0
    s1_16_10_2026: AttendanceStatus.UNEXCUSED_ABSENCE, // Nov 16 (Mon) -> 0
    // Nov 9 (Mon) & Nov 12 (Thu) unrecorded in the past -> 0
    // Remaining from todayDate = 2026-11-18:
    // Nov 19 (Thu), Nov 23 (Mon), Nov 26 (Thu), Nov 30 (Mon) -> if Thu is academy holiday, only Mon 23 & Mon 30 remain = 2 classes!
  };

  const stats = calculateMonthlyStats({
    students: [student],
    attendance,
    month: 10, // November (0-indexed)
    year: 2026,
    usdRate: 50,
    academyRates: { Acad: { rate: 100, currency: 'جنيه', holidays: [4] } }, // Thu is holiday
    todayDate: '2026-11-18',
  });

  assert.equal(stats.egpTotal, 100);
  assert.equal(stats.remainingProjectedClasses, 2);
  assert.equal(stats.projectedTotalInEgp, 300);
  assert.equal(stats.remainingProjectedInEgp, 200);
});

test('includes upcoming extra classes, double classes, makeup links, and respects exempt and deleted students', () => {
  // November 2026: todayDate = 2026-11-20 (Fri). Remaining Mon/Wed: Nov 23 (Mon), Nov 25 (Wed), Nov 30 (Mon)
  const s1 = { id: 's1', name: 'Double', academy: 'A', rate: 50, location: 'جنيه', days: [1, 1] }; // 2 classes on Mon
  const s2 = { id: 's2', name: 'Makeup', academy: 'A', rate: 50, location: 'جنيه', days: [] };
  const s3 = { id: 's3', name: 'Deleted', academy: 'A', rate: 50, location: 'جنيه', days: [1], deletedAt: { month: 10, year: 2026 } };

  const attendance = {
    s1_2_10_2026: AttendanceStatus.DOUBLE_CLASS,    // +2 actual (100)
    s1_23_10_2026: AttendanceStatus.EXEMPT,         // Nov 23 exempted -> 0 projected
    s1_25_10_2026: AttendanceStatus.EXTRA_DOUBLE,   // Nov 25 (Wed) -> +2 projected
    s2_24_10_2026: AttendanceStatus.EXTRA_DAY,      // Nov 24 (Tue) -> +1 projected
    // Nov 30 (Mon) for s1 -> +2 projected (unrecorded scheduled double)
  };
  const makeupLinks = [
    { studentId: 's2', missedDay: 10, makeupDay: 27, month: 10, year: 2026 }, // Nov 27 -> +1 projected
  ];

  const stats = calculateMonthlyStats({
    students: [s1, s2, s3],
    attendance,
    makeupLinks,
    month: 10,
    year: 2026,
    usdRate: 50,
    todayDate: '2026-11-20',
  });

  assert.equal(stats.totalInEgp, 100);
  assert.equal(stats.remainingProjectedClasses, 6); // s1: 2 (Nov 25) + 2 (Nov 30) = 4; s2: 1 (Nov 24) + 1 (Nov 27) = 2
  assert.equal(stats.projectedTotalInEgp, 400);
});

test('respects custom billingStartDay cycles, transferred classes, and excludes deferred tail from current cycle projection', () => {
  // Cycle for Nov 2026 with billingStartDay = 15:
  // Includes Oct 15..31 (prevMonth=9) + Nov 1..14 (month=10).
  // Nov 15..30 is deferred to Dec 2026.
  // Suppose todayDate = 2026-11-10:
  // - Oct 20 (Tue): PRESENT (+1 actual)
  // - Oct 5 (Mon): TRANSFERRED (+1 actual, from prev month)
  // - Nov 10 (Tue, today): unrecorded scheduled (+1 projected)
  // - Nov 17 (Tue): >= 15 -> deferred if recorded, NOT in Nov projected!
  const student = { id: 's1', name: 'Cycle', academy: 'C', rate: 80, location: 'جنيه', days: [2] }; // Tuesday
  const attendance = {
    s1_20_9_2026: AttendanceStatus.PRESENT,
    s1_5_9_2026: AttendanceStatus.TRANSFERRED,
    s1_17_10_2026: AttendanceStatus.PRESENT, // deferred to next cycle
  };

  const stats = calculateMonthlyStats({
    students: [student],
    attendance,
    month: 10,
    year: 2026,
    usdRate: 50,
    academyRates: { C: { rate: 80, currency: 'جنيه', billingStartDay: 15 } },
    todayDate: '2026-11-10',
  });

  assert.equal(stats.totalInEgp, 160); // 2 classes * 80
  assert.equal(stats.deferredEgpTotal, 80); // Nov 17
  assert.equal(stats.remainingProjectedClasses, 1); // Nov 10 only (Nov 12 is Thu, Nov 17 is >= 15)
  assert.equal(stats.projectedTotalInEgp, 240);
});

test('applies hourly/mixed rates, USD conversion, receiveInEGP, and academy deductions/additions to both actual and projected', () => {
  // Nov 2026, todayDate = 2026-11-25 (Wed). Remaining Sat/Sun: Nov 28 (Sat), Nov 29 (Sun)
  const usdStudent = { id: 'u1', name: 'HourlyUSD', academy: 'USD_AC', rate: 10, location: 'دولار', paymentBasis: 'بالساعة', duration: '٤٥', days: [6] }; // Sat 45min -> $7.5/class
  const mixedEgpFromUsd = { id: 'u2', name: 'MixedEGP', academy: 'USD_EGP', rate: 20, location: 'دولار', duration: 'خليط', days: [0] }; // Sun 30min unit -> $10/class -> EGP

  const attendance = {
    u1_7_10_2026: AttendanceStatus.PRESENT, // $7.5 actual
    u2_8_10_2026: AttendanceStatus.PRESENT, // $10 actual -> 500 EGP
  };

  const stats = calculateMonthlyStats({
    students: [usdStudent, mixedEgpFromUsd],
    attendance,
    month: 10,
    year: 2026,
    usdRate: 50,
    academyRates: {
      USD_AC: { rate: 10, currency: 'دولار', monthlyDeductions: { '10_2026': 30 }, monthlyDeductionTypes: { '10_2026': 'minutes' } }, // -$5
      USD_EGP: { rate: 20, currency: 'دولار', receiveInEGP: true, monthlyAdditions: { '10_2026': 5 }, monthlyAdditionTypes: { '10_2026': 'amount' } }, // +$5 = +250 EGP
    },
    todayDate: '2026-11-25',
  });

  // Actual:
  // USD_AC: $7.5 - $5 = $2.5 -> 125 EGP
  // USD_EGP: 500 EGP + 250 EGP = 750 EGP
  assert.equal(stats.usdTotal, 2.5);
  assert.equal(stats.egpTotal, 750);
  assert.equal(stats.totalInEgp, 875);

  // Projected (+1 Sat Nov 28 = +$7.5 = +375 EGP; +1 Sun Nov 29 = +$10 = +500 EGP):
  assert.equal(stats.remainingProjectedClasses, 2);
  assert.equal(stats.projectedUsdTotal, 10);
  assert.equal(stats.projectedEgpTotal, 1250);
  assert.equal(stats.projectedTotalInEgp, 1750);
  assert.equal(stats.remainingProjectedInEgp, 875);
});

test('excludes zero-class students from monthly breakdown lists and respects startedAt month', () => {
  const activeWithClasses = { id: 's1', name: 'Bilal', academy: 'خاص', rate: 20, location: 'دولار', days: [1] };
  const addedLater = { id: 's2', name: 'Eesa', academy: 'خاص', rate: 20, location: 'دولار', days: [1], startedAt: { month: 10, year: 2026 } };
  const zeroInOct = { id: 's3', name: 'Aziz', academy: 'خاص', rate: 20, location: 'دولار', days: [] };

  const stats = calculateMonthlyStats({
    students: [activeWithClasses, addedLater, zeroInOct],
    attendance: { s1_5_9_2026: AttendanceStatus.PRESENT }, // Oct 2026 (month=9)
    month: 9,
    year: 2026,
    usdRate: 50,
    todayDate: '2026-10-01',
  });

  assert.deepEqual(JSON.parse(JSON.stringify(stats.usdStudents.map(s => s.name))), ['Bilal']);
  assert.equal(stats.usdTotal, 20);
  // Eesa has startedAt in Nov 2026, so he should not project into Oct 2026 either:
  // Bilal has 4 Mondays in Oct 2026 (Oct 5, 12, 19, 26) -> 4 * $20 * 50 = 4000 EGP
  assert.equal(stats.projectedTotalInEgp, 4000);
});
