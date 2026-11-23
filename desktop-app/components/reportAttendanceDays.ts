import { AttendanceRecord, AttendanceStatus, Student } from '../types';

// List actual attendance separately from paid absences, which can still count toward totals.
export function formatAttendanceDays(student: Student, attendance: AttendanceRecord, month: number, year: number, isEnglish: boolean, billingStartDay?: number): string {
    const dates: Date[] = [];
    const previous = new Date(year, month - 1, 1);
    for (const [key, status] of Object.entries(attendance)) {
        const [id, dayText, monthText, yearText] = key.split('_');
        if (id !== student.id || ![AttendanceStatus.PRESENT, AttendanceStatus.DOUBLE_CLASS, AttendanceStatus.TRANSFERRED].includes(status)) continue;
        const day = Number(dayText), entryMonth = Number(monthText), entryYear = Number(yearText);
        const inCurrent = entryMonth === month && entryYear === year && (!billingStartDay || billingStartDay <= 1 || day < billingStartDay);
        const inPrevious = billingStartDay !== undefined && entryMonth === previous.getMonth() && entryYear === previous.getFullYear() &&
            (status === AttendanceStatus.TRANSFERRED || (billingStartDay > 1 && day >= billingStartDay));
        if ((inCurrent || inPrevious) && Number.isInteger(day) && day > 0 && day <= new Date(entryYear, entryMonth + 1, 0).getDate()) {
            dates.push(new Date(entryYear, entryMonth, day));
        }
    }
    dates.sort((a, b) => a.getTime() - b.getTime());
    const formatted = dates.map(date => date.toLocaleDateString(isEnglish ? 'en-GB' : 'ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    const heading = isEnglish ? '📅 *Attendance days:*' : '📅 *أيام الحضور:*';
    const days = formatted.length ? formatted.map(day => `   • ${day}`).join('\n') : (isEnglish ? '   None' : '   لا يوجد');
    return `${heading}\n${days}`;
}
