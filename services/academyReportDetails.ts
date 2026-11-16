import { AttendanceStatus, type AttendanceRecord, type Student } from '../types';
import { cairoDate, scheduledCount } from './studentSchedule';

type ReportOptions = { billingStartDay?: number; autoCompleteReport?: boolean; hazemSystem?: boolean; holidays?: number[] };
const toHindiDigits = (num: number): string => String(num).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

export function getDetailedReportDays(student: Student, attendance: AttendanceRecord, month: number, year: number, isEnglish: boolean, academyRate: ReportOptions = {}, today = cairoDate()) {
        const active: { date: Date; absent: boolean }[] = [];
        const missing: { date: Date; teacher: boolean; sessions: number }[] = [];
        const coming: Date[] = [];
        let extraSessions = 0;
        let expectedExtraSessions = 0;
        let recordedSessions = 0;
        const start = academyRate?.billingStartDay || 1;
        const previous = new Date(year, month - 1, 1);
        const periods = [{ m: previous.getMonth(), y: previous.getFullYear(), previous: true }, { m: month, y: year, previous: false }];
        for (const period of periods) {
            const days = new Date(period.y, period.m + 1, 0).getDate();
            for (let day = 1; day <= days; day++) {
                const status = attendance[`${student.id}_${day}_${period.m}_${period.y}`];
                const transferred = status === AttendanceStatus.TRANSFERRED || status === AttendanceStatus.TRANSFERRED_ABSENT;
                if (period.previous ? !(transferred || (start > 1 && day >= start)) : (start > 1 && day >= start)) continue;
                const date = new Date(period.y, period.m, day);
                const dateKey = `${period.y}-${String(period.m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const scheduled = scheduledCount(student, day, period.m, period.y);
                const inBillingPeriod = !period.previous || (start > 1 && day >= start);
                const eligibleScheduled = inBillingPeriod && status !== AttendanceStatus.EXEMPT && !academyRate.holidays?.includes(date.getDay()) ? scheduled : 0;
                const recorded = status === AttendanceStatus.DOUBLE_CLASS || status === AttendanceStatus.PAID_ABSENCE_DOUBLE ? 2
                    : status === AttendanceStatus.PAID_ABSENCE ? (scheduled === 2 ? 2 : 1)
                    : [AttendanceStatus.PRESENT, AttendanceStatus.TRANSFERRED, AttendanceStatus.TRANSFERRED_ABSENT].includes(status) ? 1 : 0;
                recordedSessions += recorded;
                if (academyRate.hazemSystem) {
                    expectedExtraSessions += Math.max(0, eligibleScheduled - recorded);
                    if (!eligibleScheduled && (status === AttendanceStatus.ABSENCE_RED || status === AttendanceStatus.UNEXCUSED_ABSENCE)) expectedExtraSessions++;
                }
                if ([AttendanceStatus.PRESENT, AttendanceStatus.DOUBLE_CLASS, AttendanceStatus.TRANSFERRED, AttendanceStatus.PAID_ABSENCE, AttendanceStatus.PAID_ABSENCE_DOUBLE, AttendanceStatus.TRANSFERRED_ABSENT].includes(status)) {
                    active.push({ date, absent: status === AttendanceStatus.PAID_ABSENCE || status === AttendanceStatus.PAID_ABSENCE_DOUBLE || status === AttendanceStatus.TRANSFERRED_ABSENT });
                } else if (status === AttendanceStatus.ABSENCE_RED || status === AttendanceStatus.UNEXCUSED_ABSENCE) {
                    if (academyRate?.hazemSystem) {
                        missing.push({ date, teacher: status === AttendanceStatus.UNEXCUSED_ABSENCE, sessions: Math.max(1, scheduled) });
                    }
                } else if (!status && academyRate?.autoCompleteReport && dateKey > today && eligibleScheduled > 0) {
                    coming.push(date);
                    extraSessions += eligibleScheduled;
                }
            }
        }
        const dateText = (date: Date) => academyRate.hazemSystem && isEnglish
            ? `${date.toLocaleDateString('en-GB', { weekday: 'long' })}, ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`
            : date.toLocaleDateString(isEnglish ? 'en-GB' : 'ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });
        const count = isEnglish ? String(recordedSessions + extraSessions) : toHindiDigits(recordedSessions + extraSessions);
        const lines = [`   ${academyRate?.hazemSystem ? '- ' : '🟢 '}*${academyRate?.hazemSystem ? (isEnglish ? `Counted sessions (${count})` : `الحصص المحسوبة (${count})`) : (isEnglish ? 'Active days' : 'الأيام النشطة')}:*`];
        if (academyRate.hazemSystem) {
            const missingCount = missing.reduce((total, item) => total + item.sessions, 0);
            lines.push(isEnglish ? `   - *Not Counted (${missingCount})*` : `   - *غير محسوب (${toHindiDigits(missingCount)})*`);
            const appendGroup = (label: string, dates: Date[]) => {
                if (!dates.length) return;
                lines.push('', label);
                lines.push(...dates.map(date => `• ${dateText(date)}`));
            };
            appendGroup(isEnglish ? '✅ *Completed:*' : '✅ *الحصص المكتملة:*', active.filter(item => !item.absent).map(item => item.date));
            appendGroup(isEnglish ? '⚠️ *Absent (Counted):*' : '⚠️ *الغياب (محسوب):*', active.filter(item => item.absent).map(item => item.date));
            appendGroup(isEnglish ? '📅 *Upcoming:*' : '📅 *الحصص القادمة:*', coming);
            if (missing.length) {
                lines.push('', isEnglish ? '❌ *Apology (Not Counted):*' : '❌ *اعتذار (غير محسوب):*');
                lines.push(...missing.map(item => `• ${dateText(item.date)} - ${isEnglish ? (item.teacher ? 'Teacher' : 'Student') : (item.teacher ? 'المعلم' : 'الطالب')}`));
            }
            return { lines, extraSessions, expectedExtraSessions };
        }
        lines.push(...(active.length ? active.map(item => `   • ${item.absent ? (isEnglish ? '(Absent) ' : '(غياب) ') : ''}${dateText(item.date)}`) : [isEnglish ? '   None' : '   لا يوجد']));
        if (coming.length && academyRate.hazemSystem) {
            if (!active.length) lines.pop();
            lines.push(...coming.map(date => `   • (${isEnglish ? 'Coming' : 'قادمة'}) ${dateText(date)}`));
        }
        if (missing.length) {
            lines.push('', `   *${isEnglish ? 'Missing' : 'الحصص الفائتة'}:*`);
            lines.push(...missing.map(item => `   • (${isEnglish ? (item.teacher ? 'Teacher apology' : 'Student apology') : (item.teacher ? 'اعتذار المعلم' : 'اعتذار الطالب')}) ${dateText(item.date)}`));
        }
        if (coming.length && !academyRate.hazemSystem) {
            lines.push('', `   🔵 *${isEnglish ? 'Active days coming' : 'الأيام القادمة المتوقعة'}:*`);
            lines.push(...coming.map(date => `   • ${dateText(date)}`));
        }
        return { lines, extraSessions, expectedExtraSessions };
}
