import type { Student, CalendarSchedule, CalendarSchedulesResult } from '../types';

export function isCurrentSchedule(schedule: CalendarSchedule | undefined, name: string, now = Date.now()): boolean {
  return !!schedule && schedule.name === name.trim() && now >= Date.parse(schedule.timeMin) && now < Date.parse(schedule.timeMax);
}

export function applyCalendarSchedules(students: Student[], requests: { id: string; name: string }[], result: CalendarSchedulesResult): Student[] {
  if (!result.available) return students;
  const names = new Map(requests.map(student => [student.id, student.name]));
  let changed = false;
  const next = students.map(student => {
    const schedule = result.schedules[student.id];
    if (names.get(student.id) !== student.name || !isCurrentSchedule(schedule, student.name)) return student;
    const previous = student.calendarSchedule;
    if (previous && Date.parse(previous.updatedAt) > Date.parse(schedule.updatedAt)) return student;
    // Avoid rewriting every student/cloud record when only the fetch timestamp changes.
    if (previous?.weekStart === schedule.weekStart && previous?.name === schedule.name && student.scheduleMessage === schedule.message && JSON.stringify(previous.slots) === JSON.stringify(schedule.slots)) return student;
    changed = true;
    return { ...student, scheduleMessage: schedule.message, calendarSchedule: schedule };
  });
  return changed ? next : students;
}
