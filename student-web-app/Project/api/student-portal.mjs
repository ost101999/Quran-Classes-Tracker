const databaseUrl = 'https://quran-classes-tracker-default-rtdb.firebaseio.com/appState';

const arabicToLatin = {
  'ا': 'a', 'أ': 'a', 'إ': 'e', 'آ': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th',
  'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'd', 'ر': 'r', 'ز': 'z',
  'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a',
  'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
  'ه': 'h', 'و': 'w', 'ي': 'y', 'ى': 'a', 'ة': 'a', 'ئ': 'e', 'ؤ': 'o',
};

const scheduleFields = ['scheduleMessage', 'calendarSchedule'];
const studentFields = [
  'id', 'name', 'days', 'duration', 'zoomLink', 'quranLink', 'readingLink',
  'targetAge', 'studyPlan', 'scheduleHistory', 'dayStartDates', ...scheduleFields,
];

function toSlug(name) {
  return Array.from(String(name || '').toLowerCase().trim(), character => arabicToLatin[character] ?? character)
    .join('').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function selectFields(record, fields) {
  return Object.fromEntries(fields.filter(field => Object.hasOwn(record, field)).map(field => [field, record[field]]));
}

async function readFirebase(path, params = {}) {
  const encodedPath = path.map(encodeURIComponent).join('/');
  const url = new URL(`${databaseUrl}/${encodedPath}.json`);
  url.search = new URLSearchParams(params);
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Firebase returned ${response.status}`);
  return response.json();
}

function filterEntries(records, predicate) {
  return Object.fromEntries(Object.entries(records || {}).filter(predicate));
}

async function getSubmissionIds(read, studentId, assignments) {
  if (!Object.keys(assignments).length) return [];

  const keys = Object.keys(await read(['tajweedSubmissions'], { shallow: 'true' }) || {});
  const linkedIds = new Set(Object.values(assignments).map(assignment => assignment.submissionId).filter(Boolean));
  const assignmentIds = new Set(Object.keys(assignments));
  for (const assignment of Object.values(assignments)) assignmentIds.add(String(assignment.id));
  const candidates = keys.filter(key => {
    const separator = key.lastIndexOf('_sub_');
    return linkedIds.has(key) || key.startsWith(`${studentId}_`) || separator < 0 || assignmentIds.has(key.slice(0, separator));
  });

  // Check ownership of old or linked records without downloading their audio on the server.
  const owned = [];
  for (let start = 0; start < candidates.length; start += 20) {
    const batch = candidates.slice(start, start + 20);
    const owners = await Promise.all(batch.map(key => read(['tajweedSubmissions', key, 'studentId'])));
    owned.push(...batch.filter((_, index) => String(owners[index]) === studentId));
  }
  return owned;
}

export function createStudentPortalHandler(read = readFirebase) {
  return async function studentPortal(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');
    const send = (status, data) => {
      res.statusCode = status;
      res.end(JSON.stringify(data));
    };

    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return send(405, { error: 'Method not allowed' });
    }

    const params = new URL(req.url, 'http://localhost').searchParams;
    const slug = params.get('slug');
    const id = params.get('student');
    const section = params.get('section') || 'overview';
    if ((!slug && !id) || !['overview', 'schedule', 'tajweed'].includes(section)) {
      return send(400, { error: 'Invalid student link or section' });
    }

    try {
      const students = Object.values(await read(['students']) || {});
      const matches = students.filter(student => student?.id &&
        (!slug || toSlug(student.name) === slug) && (!id || String(student.id) === id));
      // A shared name cannot identify which student record to return.
      if (matches.length !== 1) return send(404, { error: 'Student link not found' });
      const [student] = matches;
      const studentId = String(student.id);

      if (section === 'schedule') {
        return send(200, selectFields(student, ['id', 'name', ...scheduleFields]));
      }

      if (section === 'tajweed') {
        const [tajweedBank, allAssignments] = await Promise.all([read(['tajweedBank']), read(['tajweedAssignments'])]);
        const tajweedAssignments = filterEntries(allAssignments, ([, assignment]) => String(assignment?.studentId) === studentId);
        const submissionIds = await getSubmissionIds(read, studentId, tajweedAssignments);
        return send(200, { tajweedBank: tajweedBank || {}, tajweedAssignments, submissionIds });
      }

      const prefix = `${studentId}_`;
      const range = { orderBy: JSON.stringify('$key'), startAt: JSON.stringify(prefix), endAt: JSON.stringify(`${prefix}\uf8ff`) };
      const [month, year, attendance, savedReports] = await Promise.all([
        read(['month']), read(['year']), read(['attendance'], range), read(['savedReports'], range),
      ]);
      const belongsToStudent = ([key]) => key.startsWith(prefix) && /^\d+_\d+_\d{4}$/.test(key.slice(prefix.length));
      return send(200, {
        student: selectFields(student, studentFields), month, year,
        attendance: filterEntries(attendance, belongsToStudent),
        savedReports: filterEntries(savedReports, belongsToStudent),
      });
    } catch {
      return send(502, { error: 'Could not load student data' });
    }
  };
}

const handleStudentPortal = createStudentPortalHandler();

export default async function handler(req, res) {
  return handleStudentPortal(req, res);
}
