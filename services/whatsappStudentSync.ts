import type { Student } from '../types';

type Request = { id: string; name: string };
type Difference = { key: string; studentId: string; studentName: string; current: string; target: string };

function canonical(value: string): string {
  let s = value.trim().toLowerCase().replace(/[\s()]/g, '');
  if (/^\d{5,20}(?:-\d{5,20})?@g\.us$/.test(s) || /^\d+@lid$/.test(s)) return s;
  s = s.replace(/@c\.us$/, '').replace(/[-+]/g, '').replace(/^00/, '');
  if (/^01\d{9}$/.test(s)) s = `20${s.slice(1)}`;
  return s;
}

export function whatsappTargetsEquivalent(first: string, second: string): boolean {
  return !!first.trim() && !!second.trim() && canonical(first) === canonical(second);
}

export function whatsappDifferences(students: Student[], matches: Record<string, string>): Difference[] {
  return students.flatMap(student => {
    const current = student.whatsappNumber?.trim() || '';
    const target = matches[student.id];
    return current && target && !whatsappTargetsEquivalent(current, target)
      ? [{ key: JSON.stringify([student.id, current, target]), studentId: student.id, studentName: student.name, current, target }]
      : [];
  });
}

export function applyWhatsAppMatches(students: Student[], requests: Request[], matches: Record<string, string>): Student[] {
  const names = new Map(requests.map(item => [item.id, item.name]));
  let changed = false;
  const next = students.map(student => {
    const target = matches[student.id];
    if (!target || student.whatsappNumber?.trim() || names.get(student.id) !== student.name) return student;
    changed = true;
    return { ...student, whatsappNumber: target };
  });
  return changed ? next : students;
}
