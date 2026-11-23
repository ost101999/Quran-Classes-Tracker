import type { AttendanceRecord, InactivePeriod, MonthYear, Student } from '../types';

export function compareMonthYear(a: MonthYear, b: MonthYear): number {
  return (a.year * 12 + a.month) - (b.year * 12 + b.month);
}

export function nextMonthYear(month: number, year: number): MonthYear {
  return month >= 11 ? { month: 0, year: year + 1 } : { month: month + 1, year };
}

export function isStudentInactiveInMonth(student: Student, month: number, year: number): boolean {
  const target: MonthYear = { month, year };
  if (student.startedAt && compareMonthYear(target, student.startedAt) < 0) return true;
  if (student.deletedAt && compareMonthYear(target, student.deletedAt) >= 0) return true;
  if (Array.isArray(student.inactivePeriods)) {
    for (const period of student.inactivePeriods) {
      if (!period?.from) continue;
      if (compareMonthYear(target, period.from) < 0) continue;
      if (!period.to || compareMonthYear(target, period.to) < 0) return true;
    }
  }
  return false;
}

export function isStudentPausedInMonth(student: Student, month: number, year: number): boolean {
  const target: MonthYear = { month, year };
  if (student.startedAt && compareMonthYear(target, student.startedAt) < 0) return false;
  return isStudentInactiveInMonth(student, month, year);
}

export function hasStudentAttendanceInMonth(
  studentId: string,
  month: number,
  year: number,
  attendance: AttendanceRecord
): boolean {
  const prefix = `${studentId}_`;
  const suffix = `_${month}_${year}`;
  return Object.keys(attendance).some(key => key.startsWith(prefix) && key.endsWith(suffix) && !!attendance[key]);
}

export function isStudentVisibleInMonth(
  student: Student,
  month: number,
  year: number,
  attendance: AttendanceRecord
): boolean {
  if (!isStudentInactiveInMonth(student, month, year)) return true;
  return hasStudentAttendanceInMonth(student.id, month, year, attendance);
}

export function pauseStudentFromMonth(student: Student, fromMonth: number, fromYear: number): Student {
  return {
    ...student,
    days: [],
    deletedAt: { month: fromMonth, year: fromYear },
  };
}

export function reactivateStudentInMonth(student: Student, targetMonth: number, targetYear: number): Student {
  const target: MonthYear = { month: targetMonth, year: targetYear };
  const nextPeriods: InactivePeriod[] = [];

  for (const period of student.inactivePeriods || []) {
    if (!period?.from) continue;
    if (!period.to) {
      if (compareMonthYear(target, period.from) > 0) {
        nextPeriods.push({ from: period.from, to: target });
      }
      continue;
    }
    if (compareMonthYear(target, period.from) > 0 && compareMonthYear(target, period.to) < 0) {
      nextPeriods.push({ from: period.from, to: target });
    } else {
      nextPeriods.push(period);
    }
  }

  if (student.deletedAt && compareMonthYear(target, student.deletedAt) > 0) {
    const duplicate = nextPeriods.some(
      p => compareMonthYear(p.from, student.deletedAt!) === 0 && p.to && compareMonthYear(p.to, target) === 0
    );
    if (!duplicate) {
      nextPeriods.push({ from: student.deletedAt, to: target });
    }
  }

  const nextStartedAt =
    student.startedAt && compareMonthYear(target, student.startedAt) < 0 ? target : student.startedAt;

  return {
    ...student,
    deletedAt: undefined,
    ...(nextStartedAt ? { startedAt: nextStartedAt } : {}),
    inactivePeriods: nextPeriods.length > 0 ? nextPeriods : undefined,
  };
}
