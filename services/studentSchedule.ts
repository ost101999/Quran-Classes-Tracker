import type { Student } from '../types';

export function cairoDate(value: string | number | Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  const get = (type: string) => parts.find(part => part.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function scheduleConfigOnDate(student: Student, date: string) {
  return [...(student.scheduleHistory || [])].sort((a, b) => a.before.localeCompare(b.before)).find(entry => date < entry.before) || student;
}

export function scheduledCount(student: Student, day: number, month: number, year: number): number {
  const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const config = scheduleConfigOnDate(student, date);
  const dow = new Date(Date.UTC(year, month, day)).getUTCDay();
  const count = config.days?.filter(value => value === dow).length || 0;
  return config.dayStartDates?.[dow] && date < config.dayStartDates[dow] ? 0 : count;
}

export function replaceScheduleFrom(student: Student, days: number[], effectiveFrom: string, dayStartDates: Record<number, string> = {}): Student {
  const previousDate = new Date(Date.parse(`${effectiveFrom}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
  const previous = scheduleConfigOnDate(student, previousDate);
  const history = (student.scheduleHistory || []).filter(entry => entry.before < effectiveFrom);
  history.push({ before: effectiveFrom, days: [...(previous.days || [])], ...(previous.dayStartDates ? { dayStartDates: { ...previous.dayStartDates } } : {}) });
  return { ...student, days: [...days], dayStartDates, scheduleHistory: history };
}
