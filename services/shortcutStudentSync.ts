import type { Student } from '../types';

interface Match {
  id: string;
  exact?: boolean;
  conflict: boolean;
  zoomLink: string;
  quranLink: string;
  isReading?: boolean;
  folderId?: string;
  readingLink?: string;
  readingLinkInvalid?: boolean;
  readingConflict?: boolean;
  zoomConflict?: boolean;
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
    const acknowledged = new Set(student.acknowledgedMissingReadingIds || []);
    const missing = (result.missingReadingMatches?.[student.id] || []).some(match => !!quran.folderId && match.folderId === quran.folderId && !acknowledged.has(match.id));
    const linkedMissing = student.readingShortcutSourceId && !acknowledged.has(student.readingShortcutSourceId);
    return linkedMissing || missing ? { issue: 'missing' } : {};
  }
  if (matches[0].readingConflict) return { issue: 'conflict' };
  if (matches[0].readingLinkInvalid) return { issue: 'invalid' };
  if (student.readingShortcutSourceId && matches[0].id !== student.readingShortcutSourceId && !(student.acknowledgedMissingReadingIds || []).includes(student.readingShortcutSourceId)) return { issue: 'missing' };
  return { source: matches[0] };
}

function resolveSources(requests: StudentRequest[], result: ShortcutResult) {
  const claims = new Map<string, number>();
  const candidatesFor = (id: string) => {
    const quran = (result.matches[id] || []).filter(match => match.exact);
    return quran.length ? quran : (result.readingMatches?.[id] || []).filter(match => match.exact);
  };
  for (const item of requests) {
    const exact = candidatesFor(item.id);
    if (exact.length === 1 && (exact[0].isReading || !exact[0].conflict)) claims.set(exact[0].id, (claims.get(exact[0].id) || 0) + 1);
  }
  return (student: Student): Match | undefined => {
    const exact = candidatesFor(student.id);
    if (exact.length !== 1 || (!exact[0].isReading && exact[0].conflict)) return undefined;
    if (student.shortcutSourceId) return exact[0].id === student.shortcutSourceId ? exact[0] : undefined;
    if (exact[0].isReading && student.readingShortcutSourceId) return exact[0].id === student.readingShortcutSourceId ? exact[0] : undefined;
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
  shortcutIssue?: 'missing' | 'ambiguous' | 'conflict' | 'review';
  missingZoom?: boolean;
  zoomConflict?: boolean;
  key: string;
}

export function findShortcutDifferences(students: Student[], requests: StudentRequest[], result: ShortcutResult): ShortcutDifference[] {
  const resolve = resolveSources(requests, result);
  const requestedNames = new Map(requests.map(item => [item.id, item.name]));
  return students.flatMap(student => {
    if (requestedNames.get(student.id) !== student.name) return [];
    const source = resolve(student);
    if (!source) {
      const quran = (result.matches[student.id] || []).filter(match => match.exact);
      const candidates = quran.length ? quran : (result.readingMatches?.[student.id] || []).filter(match => match.exact);
      const shortcutIssue = !candidates.length ? 'missing' : candidates.length > 1 ? 'ambiguous' : candidates[0].conflict || candidates[0].readingConflict ? 'conflict' : 'review';
      return [{ studentId: student.id, studentName: student.name, zoom: false, quran: false, reading: false, shortcutIssue,
        key: JSON.stringify([student.id, 'shortcut', shortcutIssue, candidates.map(match => match.id).sort()]) }];
    }
    const zoom = !!(student.zoomLink && source.zoomLink && !linksEquivalent(student.zoomLink, source.zoomLink, 'zoom'));
    const quran = !!(student.quranLink && source.quranLink && !linksEquivalent(student.quranLink, source.quranLink, 'quran'));
    const readingResult = readingForStudent(student, source, result);
    const reading = !!(student.readingLink && readingResult.source?.readingLink && !linksEquivalent(student.readingLink, readingResult.source.readingLink, 'quran'));
    const zoomConflict = !!(source.isReading && source.zoomConflict);
    const missingZoom = !student.zoomLink && !source.zoomLink && !readingResult.source?.zoomLink && !zoomConflict;
    if (!zoom && !quran && !reading && !readingResult.issue && !missingZoom && !zoomConflict) return [];
    return [{ studentId: student.id, studentName: student.name, zoom, quran, reading, readingIssue: readingResult.issue, missingZoom, zoomConflict,
      key: JSON.stringify([student.id, source.id, zoom ? student.zoomLink : '', zoom ? source.zoomLink : '', quran ? student.quranLink : '', quran ? source.quranLink : '', reading ? student.readingLink : '', reading ? readingResult.source?.readingLink : '', readingResult.issue || '', missingZoom, zoomConflict]) }];
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
    const readingSource = readingForStudent(student, source, result).source;
    const zoomLink = student.zoomLink || source.zoomLink || readingSource?.zoomLink || '';
    const quranLink = student.quranLink || source.quranLink || '';
    const readingLink = student.readingLink || readingSource?.readingLink || '';
    const readingShortcutSourceId = readingSource?.id || (source.isReading ? source.id : student.readingShortcutSourceId);
    const presentIds = new Set((result.readingMatches?.[student.id] || []).filter(match => match.folderId === source.folderId).map(match => match.id));
    const acknowledgedMissingReadingIds = (student.acknowledgedMissingReadingIds || []).filter(id => !presentIds.has(id));
    const acknowledgementsChanged = acknowledgedMissingReadingIds.length !== (student.acknowledgedMissingReadingIds || []).length;
    const shortcutSourceId = source.isReading ? student.shortcutSourceId : source.id;
    if (student.shortcutSourceId === shortcutSourceId && (student.zoomLink || '') === zoomLink && (student.quranLink || '') === quranLink && (student.readingLink || '') === readingLink && student.readingShortcutSourceId === readingShortcutSourceId && !acknowledgementsChanged) return student;
    changed = true;
    return { ...student, shortcutSourceId, zoomLink, quranLink, readingLink, readingShortcutSourceId, acknowledgedMissingReadingIds: acknowledgedMissingReadingIds.length ? acknowledgedMissingReadingIds : undefined };
  });
  return changed ? updated : students;
}
