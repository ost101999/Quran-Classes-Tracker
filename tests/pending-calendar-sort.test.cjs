const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const esbuild = require('esbuild');

async function loadModule() {
  const root = path.resolve(__dirname, '..');
  const result = await esbuild.build({
    entryPoints: [path.join(root, 'services/pendingCalendarSort.ts')],
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'node',
  });
  const mod = { exports: {} };
  const fn = new Function('require', 'module', 'exports', result.outputFiles[0].text);
  fn(require, mod, mod.exports);
  return mod.exports;
}

test('sortPendingStudentsByCalendar sorts across academies by exact calendar start time and places unscheduled at end', async () => {
  const { sortPendingStudentsByCalendar } = await loadModule();

  const s1 = {
    id: 's1',
    name: 'Ahmed',
    academy: 'A',
    location: 'جنيه',
    rate: 50,
    calendarReview: {
      name: 'Ahmed',
      observed: {
        e1: {
          revision: 1,
          present: true,
          event: { id: 'e1', start: '2026-11-12T18:30:00+02:00', end: '2026-11-12T19:00:00+02:00', timeZone: 'Africa/Cairo', colorId: '', recurring: true },
        },
      },
      pending: [],
      decisions: {},
    },
  };

  const s2 = {
    id: 's2',
    name: 'Sara',
    academy: 'B',
    location: 'جنيه',
    rate: 50,
    calendarSchedule: {
      source: 'google-calendar',
      name: 'Sara',
      weekStart: '2026-11-07',
      weekEnd: '2026-11-13',
      timeMin: '2026-11-07T00:00:00+02:00',
      timeMax: '2026-11-14T00:00:00+02:00',
      updatedAt: '2026-11-12T10:00:00Z',
      status: 'ready',
      message: '',
      slots: [{ start: '2026-11-12T16:00:00+02:00', timeZone: 'Africa/Cairo' }],
    },
  };

  const s3 = {
    id: 's3',
    name: 'Omar',
    academy: 'A',
    location: 'جنيه',
    rate: 50,
    // No calendar events
  };

  const s4 = {
    id: 's4',
    name: 'Zaid',
    academy: 'C',
    location: 'جنيه',
    rate: 50,
    calendarReview: {
      name: 'Zaid',
      observed: {
        // Red event earlier + non-red event later -> non-red takes precedence
        red1: {
          revision: 1,
          present: true,
          event: { id: 'red1', start: '2026-11-12T14:00:00+02:00', end: '2026-11-12T14:30:00+02:00', timeZone: 'Africa/Cairo', colorId: '11', recurring: true },
        },
        ok1: {
          revision: 1,
          present: true,
          event: { id: 'ok1', start: '2026-11-12T17:15:00+02:00', end: '2026-11-12T17:45:00+02:00', timeZone: 'Africa/Cairo', colorId: '', recurring: false },
        },
      },
      pending: [],
      decisions: {},
    },
  };

  const result = sortPendingStudentsByCalendar([s1, s2, s3, s4], 12, 10, 2026, '00:00');
  assert.deepEqual(result.sortedStudents.map(s => s.id), ['s2', 's4', 's1', 's3']);
  assert.equal(result.slotsByStudentId.s2.timeLabel, '٤:٠٠ م');
  assert.equal(result.slotsByStudentId.s4.timeLabel, '٥:١٥ م');
  assert.equal(result.slotsByStudentId.s1.timeLabel, '٦:٣٠ م');
  assert.equal(result.slotsByStudentId.s3, undefined);
});

test('sortPendingStudentsByCalendar respects dayTransitionTime and recurring weekday fallback', async () => {
  const { sortPendingStudentsByCalendar } = await loadModule();

  const lateNight = {
    id: 'late',
    name: 'Late',
    academy: 'A',
    location: 'جنيه',
    rate: 50,
    calendarReview: {
      name: 'Late',
      observed: {
        // 01:00 AM on Nov 13 belongs to effective day Nov 12 when transition is 04:00
        e1: {
          revision: 1,
          present: true,
          event: { id: 'e1', start: '2026-11-13T01:00:00+02:00', end: '2026-11-13T01:30:00+02:00', timeZone: 'Africa/Cairo', colorId: '', recurring: true },
        },
      },
      pending: [],
      decisions: {},
    },
  };

  const evening = {
    id: 'evening',
    name: 'Evening',
    academy: 'A',
    location: 'جنيه',
    rate: 50,
    calendarReview: {
      name: 'Evening',
      observed: {
        e2: {
          revision: 1,
          present: true,
          event: { id: 'e2', start: '2026-11-12T22:00:00+02:00', end: '2026-11-12T22:30:00+02:00', timeZone: 'Africa/Cairo', colorId: '', recurring: true },
        },
      },
      pending: [],
      decisions: {},
    },
  };

  // On Nov 12 (exact date) with transition 04:00: 22:00 comes before 01:00 AM next morning
  const exact = sortPendingStudentsByCalendar([lateNight, evening], 12, 10, 2026, '04:00');
  assert.deepEqual(exact.sortedStudents.map(s => s.id), ['evening', 'late']);
  assert.equal(exact.slotsByStudentId.late.isExactDate, true);

  // On Nov 26 (Thursday two weeks later, outside snapshot) recurring fallback still orders 22:00 before 01:00
  const fallback = sortPendingStudentsByCalendar([lateNight, evening], 26, 10, 2026, '04:00');
  assert.deepEqual(fallback.sortedStudents.map(s => s.id), ['evening', 'late']);
  assert.equal(fallback.slotsByStudentId.late.isExactDate, false);
});

