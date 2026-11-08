import type { Student } from '../types';

interface Match {
  id: string;
  exact?: boolean;
  conflict: boolean;
  zoomLink: string;
  quranLink: string;
  folderId?: string;
  readingLink?: string;
  readingLinkInvalid?: boolean;
  readingConflict?: boolean;
}

type ShortcutResult = { matches: Record<string, Match[]>; readingMatches?: Record<string, Match[]>; missingReadingMatches?: Record<string, Match[]>; groups: Match[] };
type StudentRequest = { id: string; name: string };

export function linksEquivalent(first: string, second: string, type: 'zoom' | 'quran'): boolean {
  if (first.trim() === second.trim()) return true;
  const identity = (value: string): string | null => {
    try {
      const url = new URL(value.trim());
      if (type === 'zoom' && ((url.protocol === 'https:' && (url.hostname === 'zoom.us' || url.hostname.endsWith('.zoom.us'))) || (url.protocol === 'zoommtg:' && url.hostname === 'zoom.us'))) {
        const meeting = url.protocol === 'zoommtg:' ? url.searchParams.get('confno') : url.pathname.match(/^\/(?:j|wc\/join)\/(\d+)\/?$/)?.[1];
        return meeting ? JSON.stringify([meeting, url.searchParams.get('pwd') || '']) : null;
      }
      if (type === 'quran' && url.protocol === 'https:' && url.hostname === 'drive.google.com') {
        const file = url.pathname.match(/^\/file\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/)?.[1] || (/^\/(?:open|uc)$/.test(url.pathname) ? url.searchParams.get('id') : null);
        return file ? JSON.stringify([file, url.searchParams.get('resourcekey') || '']) : null;
      }
    } catch { /* Compare unsupported links as plain strings. */ }
    return null;
  };
  const left = identity(first);
  const right = identity(second);
  return left !== null && left === right;
}

function readingForStudent(student: Student, quran: Match, result: ShortcutResult): { source?: Match; issue?: 'multiple' | 'conflict' | 'missing' | 'invalid' } {
  const matches = (result.readingMatches?.[student.id] || []).filter(match => match.exact && !!quran.folderId && match.folderId === quran.folderId);
  if (matches.length > 1) return { issue: 'multiple' };
  if (!matches.length) {
    const missing = (result.missingReadingMatches?.[student.id] || []).some(match => !!quran.folderId && match.folderId === quran.folderId);
    return student.readingShortcutSourceId || missing ? { issue: 'missing' } : {};
  }
  if (matches[0].readingConflict) return { issue: 'conflict' };
  if (matches[0].readingLinkInvalid) return { issue: 'invalid' };
  if (student.readingShortcutSourceId && matches[0].id !== student.readingShortcutSourceId) return { issue: 'missing' };
  return { source: matches[0] };
}

function resolveSources(requests: StudentRequest[], result: ShortcutResult) {
  const claims = new Map<string, number>();
  for (const item of requests) {
    const exact = (result.matches[item.id] || []).filter(match => match.exact);
    if (exact.length === 1 && !exact[0].conflict) claims.set(exact[0].id, (claims.get(exact[0].id) || 0) + 1);
  }
  return (student: Student): Match | undefined => {
    const exact = (result.matches[student.id] || []).filter(match => match.exact);
    if (exact.length !== 1 || exact[0].conflict) return undefined;
    if (student.shortcutSourceId) return exact[0].id === student.shortcutSourceId ? exact[0] : undefined;
    return !student.shortcutAutoMatchDisabled && claims.get(exact[0].id) === 1 ? exact[0] : undefined;
  };
}

export interface ShortcutDifference {
  studentId: string;
  studentName: string;
  zoom: boolean;
  quran: boolean;
  reading: boolean;
  readingIssue?: 'multiple' | 'conflict' | 'missing' | 'invalid';
  key: string;
}

export function findShortcutDifferences(students: Student[], requests: StudentRequest[], result: ShortcutResult): ShortcutDifference[] {
  const resolve = resolveSources(requests, result);
  const requestedNames = new Map(requests.map(item => [item.id, item.name]));
  return students.flatMap(student => {
    if (requestedNames.get(student.id) !== student.name) return [];
    const source = resolve(student);
    if (!source) return [];
    const zoom = !!(student.zoomLink && source.zoomLink && !linksEquivalent(student.zoomLink, source.zoomLink, 'zoom'));
    const quran = !!(student.quranLink && source.quranLink && !linksEquivalent(student.quranLink, source.quranLink, 'quran'));
    const readingResult = readingForStudent(student, source, result);
    const reading = !!(student.readingLink && readingResult.source?.readingLink && !linksEquivalent(student.readingLink, readingResult.source.readingLink, 'quran'));
    if (!zoom && !quran && !reading && !readingResult.issue) return [];
    return [{ studentId: student.id, studentName: student.name, zoom, quran, reading, readingIssue: readingResult.issue,
      key: JSON.stringify([student.id, source.id, zoom ? student.zoomLink : '', zoom ? source.zoomLink : '', quran ? student.quranLink : '', quran ? source.quranLink : '', reading ? student.readingLink : '', reading ? readingResult.source?.readingLink : '', readingResult.issue || '']) }];
  });
}

export function applyShortcutMatches(
  students: Student[],
  requests: StudentRequest[],
  result: ShortcutResult,
): Student[] {
  const resolve = resolveSources(requests, result);
  const requestedNames = new Map(requests.map(item => [item.id, item.name]));
  let changed = false;
  const updated = students.map(student => {
    if (requestedNames.get(student.id) !== student.name) return student;
    const source = resolve(student);
    if (!source) return student;
    const zoomLink = student.zoomLink || source.zoomLink || '';
    const quranLink = student.quranLink || source.quranLink || '';
    const readingSource = readingForStudent(student, source, result).source;
    const readingLink = student.readingLink || readingSource?.readingLink || '';
    const readingShortcutSourceId = student.readingShortcutSourceId || readingSource?.id;
    if (student.shortcutSourceId === source.id && (student.zoomLink || '') === zoomLink && (student.quranLink || '') === quranLink && (student.readingLink || '') === readingLink && student.readingShortcutSourceId === readingShortcutSourceId) return student;
    changed = true;
    return { ...student, shortcutSourceId: source.id, zoomLink, quranLink, readingLink, readingShortcutSourceId };
  });
  return changed ? updated : students;
}
