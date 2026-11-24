import https from 'node:https';
import { execFile } from 'node:child_process';

export const FIREBASE_BASE_URL = 'https://quran-classes-tracker-default-rtdb.firebaseio.com';
export const LIVE_SITE_BASE_URL = 'https://quranreport.vercel.app';

const ARABIC_TO_LATIN = {
  'ا': 'a', 'أ': 'a', 'إ': 'e', 'آ': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th',
  'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z',
  'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a',
  'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
  'ه': 'h', 'ة': 'a', 'و': 'w', 'ي': 'y', 'ى': 'a', 'ئ': 'e', 'ؤ': 'o',
};

/**
 * Matches the slug logic in Project/index.html so generated paths resolve identically.
 */
export function toSlug(name) {
  if (!name) return '';
  let transliterated = String(name).toLowerCase().trim();
  for (const [ar, en] of Object.entries(ARABIC_TO_LATIN)) {
    transliterated = transliterated.replace(new RegExp(ar, 'g'), en);
  }
  return transliterated.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function fetchJson(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('error', reject);
      res.on('end', () => {
        if ((res.statusCode || 0) < 200 || (res.statusCode || 0) >= 300) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('Timeout')));
    req.on('error', reject);
  });
}

function studentPathFromList(students, chosen) {
  const slug = toSlug(chosen.name);
  if (slug) {
    const firstMatch = students.find((s) => toSlug(s.name) === slug);
    if (firstMatch && String(firstMatch.id) === String(chosen.id)) {
      return `/${slug}`;
    }
  }
  return `/?student=${encodeURIComponent(String(chosen.id))}`;
}

/**
 * Fetches live students and recent report/attendance metadata from Firebase
 * and returns a valid path for the most recently active non-deleted student.
 */
export async function getRealStudentPath() {
  try {
    const [rawStudents, lastReports, attendanceShallow] = await Promise.all([
      fetchJson(`${FIREBASE_BASE_URL}/appState/students.json`),
      fetchJson(`${FIREBASE_BASE_URL}/appState/lastReports.json`).catch(() => null),
      fetchJson(`${FIREBASE_BASE_URL}/appState/attendance.json?shallow=true`).catch(() => null),
    ]);

    const list = Array.isArray(rawStudents) ? rawStudents : Object.values(rawStudents || {});
    const allStudents = list.filter((s) => s && s.id && s.name);
    if (allStudents.length === 0) return '/';

    const activeStudents = allStudents.filter((s) => !s.deletedAt);
    const pool = activeStudents.length > 0 ? activeStudents : allStudents;
    const byId = new Map(pool.map((s) => [String(s.id), s]));

    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();

    // Score each active student by latest report/attendance date and current-month activity count
    const stats = new Map();
    const bump = (id, year, month, day, isReport) => {
      if (!byId.has(id)) return;
      const cur = stats.get(id) || { latestDateNum: 0, curMonthCount: 0, hasReport: false };
      const dateNum = (Number(year) || 0) * 10000 + ((Number(month) || 0) + 1) * 100 + (Number(day) || 0);
      if (dateNum > cur.latestDateNum) cur.latestDateNum = dateNum;
      if (Number(year) === curYear && Number(month) === curMonth) {
        cur.curMonthCount += isReport ? 3 : 1;
      }
      if (isReport) cur.hasReport = true;
      stats.set(id, cur);
    };

    if (lastReports && typeof lastReports === 'object') {
      for (const [id, rep] of Object.entries(lastReports)) {
        if (!rep || typeof rep !== 'object') continue;
        bump(id, rep._year, rep._month, rep._dayNum, true);
      }
    }

    if (attendanceShallow && typeof attendanceShallow === 'object') {
      for (const key of Object.keys(attendanceShallow)) {
        const match = key.match(/^(.+)_(\d+)_(\d+)_(\d{4})$/);
        if (!match) continue;
        const [, id, monthStr, dayStr, yearStr] = match;
        bump(id, Number(yearStr), Number(monthStr), Number(dayStr), false);
      }
    }

    let chosen = pool[pool.length - 1];
    if (stats.size > 0) {
      const ranked = [...stats.entries()].sort((a, b) => {
        const sa = a[1];
        const sb = b[1];
        if ((sb.curMonthCount > 0) !== (sa.curMonthCount > 0)) {
          return sb.curMonthCount > 0 ? 1 : -1;
        }
        if (sb.latestDateNum !== sa.latestDateNum) return sb.latestDateNum - sa.latestDateNum;
        if (sb.curMonthCount !== sa.curMonthCount) return sb.curMonthCount - sa.curMonthCount;
        return Number(sb.hasReport) - Number(sa.hasReport);
      });
      chosen = byId.get(ranked[0][0]) || chosen;
    }

    return studentPathFromList(allStudents, chosen);
  } catch {
    return '/';
  }
}

export function openInBrowser(url) {
  if (process.platform === 'win32') {
    execFile('cmd.exe', ['/c', 'start', '', url], { windowsHide: true });
  } else if (process.platform === 'darwin') {
    execFile('open', [url]);
  } else {
    execFile('xdg-open', [url]);
  }
}

if (process.argv.includes('--open-live')) {
  const studentPath = await getRealStudentPath();
  openInBrowser(`${LIVE_SITE_BASE_URL}${studentPath}`);
} else if (process.argv.includes('--print')) {
  const studentPath = await getRealStudentPath();
  console.log(studentPath);
}
