import type { Student } from '../types';
import { cairoDate } from './studentSchedule';

export interface PendingCalendarSlot {
  timestamp: number;
  timeLabel: string;
  isExactDate: boolean;
}

const RED_COLOR_IDS = new Set(['4', '11']);
const HINDI_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

function toHindi(value: number | string): string {
  return String(value).replace(/\d/g, d => HINDI_DIGITS[Number(d)]);
}

function getCairoHourMinute(ms: number): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Cairo',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(ms));
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find(p => p.type === 'minute')?.value ?? '0');
  return { hour, minute };
}

export function formatCairoTimeArabic(ms: number): string {
  const { hour, minute } = getCairoHourMinute(ms);
  const period = hour >= 12 ? 'م' : 'ص';
  const hour12 = hour % 12 || 12;
  return `${toHindi(hour12)}:${toHindi(String(minute).padStart(2, '0'))} ${period}`;
}

function makeTargetDateStr(day: number, month: number, year: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getStudentCalendarSlotOnDay(
  student: Student,
  day: number,
  month: number,
  year: number,
  dayTransitionTime = '00:00'
): PendingCalendarSlot | null {
  const trimmedName = student.name?.trim();
  if (!trimmedName) return null;

  const targetDate = makeTargetDateStr(day, month, year);
  const targetDow = new Date(Date.UTC(year, month, day)).getUTCDay();

  const observedItems =
    student.calendarReview?.name === trimmedName && student.calendarReview?.observed
      ? Object.values(student.calendarReview.observed).filter(
          item => item && item.present !== false && item.event?.start && Number.isFinite(Date.parse(item.event.start))
        )
      : [];

  // 1. Exact effective-date match from observed calendar events
  const exactObserved = observedItems.filter(
    item => cairoDate(item.event.start, dayTransitionTime) === targetDate
  );
  if (exactObserved.length > 0) {
    const nonRed = exactObserved.filter(item => !RED_COLOR_IDS.has(item.event.colorId));
    const pool = nonRed.length > 0 ? nonRed : exactObserved;
    const earliestMs = Math.min(...pool.map(item => Date.parse(item.event.start)));
    return {
      timestamp: earliestMs,
      timeLabel: formatCairoTimeArabic(earliestMs),
      isExactDate: true,
    };
  }

  // 2. Exact effective-date match from weekly calendarSchedule slots
  const scheduleSlots =
    student.calendarSchedule?.name === trimmedName && Array.isArray(student.calendarSchedule.slots)
      ? student.calendarSchedule.slots.filter(slot => slot?.start && Number.isFinite(Date.parse(slot.start)))
      : [];

  const exactSchedule = scheduleSlots.filter(
    slot => cairoDate(slot.start, dayTransitionTime) === targetDate
  );
  if (exactSchedule.length > 0) {
    const earliestMs = Math.min(...exactSchedule.map(slot => Date.parse(slot.start)));
    return {
      timestamp: earliestMs,
      timeLabel: formatCairoTimeArabic(earliestMs),
      isExactDate: true,
    };
  }

  // 3. Fallback for dates outside the 3-week calendar snapshot using recurring weekday times
  const targetMidday = Date.parse(`${targetDate}T12:00:00Z`);
  const recurringFallbackMs: number[] = [];

  for (const item of observedItems) {
    if (!item.event.recurring || RED_COLOR_IDS.has(item.event.colorId)) continue;
    const effDate = cairoDate(item.event.start, dayTransitionTime);
    const effDow = new Date(`${effDate}T12:00:00Z`).getUTCDay();
    if (effDow !== targetDow) continue;
    const startMs = Date.parse(item.event.start);
    const diffMs = targetMidday - Date.parse(`${effDate}T12:00:00Z`);
    recurringFallbackMs.push(startMs + diffMs);
  }

  if (recurringFallbackMs.length === 0) {
    for (const slot of scheduleSlots) {
      const effDate = cairoDate(slot.start, dayTransitionTime);
      const effDow = new Date(`${effDate}T12:00:00Z`).getUTCDay();
      if (effDow !== targetDow) continue;
      const startMs = Date.parse(slot.start);
      const diffMs = targetMidday - Date.parse(`${effDate}T12:00:00Z`);
      recurringFallbackMs.push(startMs + diffMs);
    }
  }

  if (recurringFallbackMs.length > 0) {
    const earliestMs = Math.min(...recurringFallbackMs);
    return {
      timestamp: earliestMs,
      timeLabel: formatCairoTimeArabic(earliestMs),
      isExactDate: false,
    };
  }

  return null;
}

export function sortPendingStudentsByCalendar(
  students: Student[],
  day: number,
  month: number,
  year: number,
  dayTransitionTime = '00:00'
): { sortedStudents: Student[]; slotsByStudentId: Record<string, PendingCalendarSlot> } {
  const slotsByStudentId: Record<string, PendingCalendarSlot> = {};
  const indexed = students.map((student, index) => {
    const slot = getStudentCalendarSlotOnDay(student, day, month, year, dayTransitionTime);
    if (slot) slotsByStudentId[student.id] = slot;
    return { student, index, slot };
  });

  indexed.sort((a, b) => {
    if (a.slot && b.slot) {
      if (a.slot.timestamp !== b.slot.timestamp) return a.slot.timestamp - b.slot.timestamp;
      return a.index - b.index;
    }
    if (a.slot) return -1;
    if (b.slot) return 1;
    return a.index - b.index;
  });

  return {
    sortedStudents: indexed.map(item => item.student),
    slotsByStudentId,
  };
}
