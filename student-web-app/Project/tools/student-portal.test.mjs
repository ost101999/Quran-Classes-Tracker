import assert from 'node:assert/strict';
import test from 'node:test';
import { createStudentPortalHandler } from '../api/student-portal.mjs';

const first = { id: '100', name: 'أحمد حسن', duration: '30', scheduleMessage: 'Monday', rate: 30 };
const second = { id: '100_2', name: 'Zayd', scheduleMessage: 'Tuesday', whatsappNumber: 'fictional' };
const assignments = {
  a: { id: 'a', studentId: first.id, submissionId: 'b_sub_2' },
  b: { id: 'b', studentId: second.id },
};
const submissionOwners = {
  a_sub_1: first.id,
  b_sub_2: second.id,
  '100_2_sub_3': second.id,
  legacy: first.id,
  legacyOther: second.id,
};

function fixture(students = [first, second]) {
  const calls = [];
  const handler = createStudentPortalHandler(async (path, params) => {
    calls.push([path, params]);
    switch (path[0]) {
      case 'students': return students;
      case 'month': return 10;
      case 'year': return 2026;
      case 'attendance': return { '100_5_10_2026': '1', '100_2_5_10_2026': '2' };
      case 'savedReports': return { '100_5_10_2026': 'Report A', '100_2_5_10_2026': 'Report B' };
      case 'tajweedBank': return { lesson: { title: 'Shared lesson' } };
      case 'tajweedAssignments': return assignments;
      case 'tajweedSubmissions':
        if (params?.shallow === 'true') return Object.fromEntries(Object.keys(submissionOwners).map(id => [id, true]));
        assert.equal(path[2], 'studentId');
        return submissionOwners[path[1]];
      default: throw new Error('Unexpected read');
    }
  });
  const request = async (query, method = 'GET') => {
    const headers = {};
    const response = {
      setHeader(name, value) { headers[name] = value; },
      end(body) { this.body = JSON.parse(body); },
    };
    await handler({ method, url: `/api/student-portal?${query}` }, response);
    return { status: response.statusCode, body: response.body, headers };
  };
  return { request, calls };
}

test('old name and ID links return exactly the selected student and their report and attendance', async () => {
  const { request, calls } = fixture();
  const byName = await request('slug=ahmd-hsn');
  assert.equal(byName.status, 200);
  assert.deepEqual(byName.body, {
    student: { id: first.id, name: first.name, duration: first.duration, scheduleMessage: first.scheduleMessage },
    attendance: { '100_5_10_2026': '1' },
    savedReports: { '100_5_10_2026': 'Report A' },
    month: 10,
    year: 2026,
  });
  assert.equal(byName.headers['Cache-Control'], 'private, no-store');
  assert.deepEqual(calls.find(([path]) => path[0] === 'savedReports')[1], {
    orderBy: '"$key"', startAt: '"100_"', endAt: '"100_\uf8ff"',
  });
  const byId = await request('student=100_2');
  assert.deepEqual(byId.body.attendance, { '100_2_5_10_2026': '2' });
  assert.equal(byId.body.student.id, second.id);
});

test('schedule refresh only reads students and returns the selected schedule', async () => {
  const { request, calls } = fixture({ 2: first, 5: second });
  const result = await request('slug=zayd&student=100_2&section=schedule');
  assert.deepEqual(result.body, { id: second.id, name: second.name, scheduleMessage: second.scheduleMessage });
  assert.deepEqual(calls.map(([path]) => path), [['students']]);
});

test('Tajweed returns owned assignments and verified submission IDs, including older records', async () => {
  const { request } = fixture();
  const result = await request('student=100&section=tajweed');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.tajweedAssignments, { a: assignments.a });
  assert.deepEqual(result.body.submissionIds, ['a_sub_1', 'legacy']);
  assert.deepEqual(result.body.tajweedBank, { lesson: { title: 'Shared lesson' } });
});

test('an unknown, conflicting or ambiguous link never returns another student', async () => {
  const { request } = fixture([first, { ...second, name: first.name }]);
  assert.equal((await request('slug=ahmd-hsn')).status, 404);
  assert.equal((await request('slug=missing')).status, 404);
  assert.equal((await request('slug=missing&student=100')).status, 404);
  assert.equal((await request('student=100&section=invalid')).status, 400);
  assert.equal((await request('student=100', 'POST')).status, 405);
});
