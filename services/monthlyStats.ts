import { AttendanceRecord, AttendanceStatus, MakeupLink, Student } from '../types';
import { cairoDate, scheduledCount } from './studentSchedule';

export interface MonthlyStatsStudentItem {
  id: string;
  name: string;
  amount: number;
  academy: string;
  isAggregated?: boolean;
}

export interface MonthlyStatsResult {
  egpTotal: number;
  usdTotal: number;
  deferredEgpTotal: number;
  deferredUsdTotal: number;
  totalInEgp: number;
  projectedEgpTotal: number;
  projectedUsdTotal: number;
  projectedTotalInEgp: number;
  remainingProjectedInEgp: number;
  remainingProjectedClasses: number;
  egpStudents: MonthlyStatsStudentItem[];
  usdStudents: MonthlyStatsStudentItem[];
}

export interface CalculateMonthlyStatsParams {
  students: Student[];
  attendance: AttendanceRecord;
  month: number;
  year: number;
  usdRate: number;
  academyRates?: Record<string, any>;
  paymentStatus?: Record<string, boolean>;
  makeupLinks?: MakeupLink[];
  dayTransitionTime?: string;
  todayDate?: string;
}

const toWesternDigits = (str: string): string => {
  if (!str) return '';
  return str.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
};

const formatYmd = (d: number, m: number, y: number): string =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const isStudentDeletedInMonth = (student: Student, m: number, y: number): boolean =>
  !!student.deletedAt && (y > student.deletedAt.year || (y === student.deletedAt.year && m >= student.deletedAt.month));

const isStudentBeforeStartInMonth = (student: Student, m: number, y: number): boolean =>
  !!student.startedAt && (y < student.startedAt.year || (y === student.startedAt.year && m < student.startedAt.month));

export const getStatusSessionValue = (
  status: AttendanceStatus | undefined,
  student: Student,
  d: number,
  m: number,
  y: number
): number => {
  if (!status) return 0;
  if (status === AttendanceStatus.DOUBLE_CLASS || status === AttendanceStatus.PAID_ABSENCE_DOUBLE) return 2;
  if (status === AttendanceStatus.PAID_ABSENCE) {
    return scheduledCount(student, d, m, y) === 2 ? 2 : 1;
  }
  if ([AttendanceStatus.PRESENT, AttendanceStatus.TRANSFERRED, AttendanceStatus.TRANSFERRED_ABSENT].includes(status)) return 1;
  return 0;
};

const DONE_OR_EXEMPT_STATUSES = new Set<AttendanceStatus>([
  AttendanceStatus.PRESENT,
  AttendanceStatus.PAID_ABSENCE,
  AttendanceStatus.PAID_ABSENCE_DOUBLE,
  AttendanceStatus.POSTPONED,
  AttendanceStatus.UNEXCUSED_ABSENCE,
  AttendanceStatus.ABSENCE_RED,
  AttendanceStatus.DOUBLE_CLASS,
  AttendanceStatus.TRANSFERRED,
  AttendanceStatus.TRANSFERRED_ABSENT,
  AttendanceStatus.EXEMPT,
]);

export const getProjectedSessionValue = (
  status: AttendanceStatus | undefined,
  student: Student,
  d: number,
  m: number,
  y: number,
  todayStr: string,
  academyInfo: { holidays?: number[]; isArchived?: boolean } | undefined,
  makeupLinks: MakeupLink[]
): number => {
  if (status && DONE_OR_EXEMPT_STATUSES.has(status)) {
    return getStatusSessionValue(status, student, d, m, y);
  }
  if (formatYmd(d, m, y) < todayStr) return 0;
  if (academyInfo?.isArchived || isStudentDeletedInMonth(student, m, y) || isStudentBeforeStartInMonth(student, m, y)) return 0;
  if (status === AttendanceStatus.EXTRA_DOUBLE) return 2;

  const holidays = academyInfo?.holidays || [];
  const isHoliday = holidays.includes(new Date(y, m, d).getDay());
  const sched = isHoliday ? 0 : scheduledCount(student, d, m, y);
  const isMakeupTarget = makeupLinks.some(
    l => l.studentId === student.id && l.makeupDay === d && l.month === m && l.year === y
  );

  if (status === AttendanceStatus.EXTRA_DAY || sched > 0 || isMakeupTarget) {
    return Math.max(1, sched);
  }
  return 0;
};

const calcStudentAmount = (student: Student, classUnits: number): number => {
  if (student.paymentBasis === 'بالساعة' || student.duration === 'خليط') {
    const durationMin = student.duration === 'خليط' ? 30 : (parseInt(toWesternDigits(student.duration || '٣٠'), 10) || 30);
    return (classUnits * durationMin / 60) * student.rate;
  }
  return classUnits * student.rate;
};

const applyAcademyAdjustments = (
  academyRates: Record<string, any> | undefined,
  monthKey: string,
  usdRate: number,
  state: {
    egpTotal: number;
    usdTotal: number;
    egpAggregated?: Record<string, number>;
    usdAggregated?: Record<string, number>;
  }
) => {
  if (!academyRates) return;
  Object.entries(academyRates).forEach(([academyName, rateInfo]) => {
    const deduction = rateInfo.monthlyDeductions?.[monthKey] ?? rateInfo.deductedMinutes ?? 0;
    const deductionType = rateInfo.monthlyDeductionTypes?.[monthKey] ?? 'minutes';
    if (deduction > 0) {
      const deductionAmount = deductionType === 'minutes' ? (deduction / 60) * rateInfo.rate : deduction;
      if (rateInfo.currency === 'جنيه') {
        if (state.egpAggregated?.[academyName]) {
          state.egpAggregated[academyName] = Math.max(0, state.egpAggregated[academyName] - deductionAmount);
        }
        state.egpTotal = Math.max(0, state.egpTotal - deductionAmount);
      } else if (rateInfo.currency === 'دولار') {
        if (rateInfo.receiveInEGP) {
          const convertedDeduction = deductionAmount * usdRate;
          if (state.egpAggregated?.[academyName]) {
            state.egpAggregated[academyName] = Math.max(0, state.egpAggregated[academyName] - convertedDeduction);
          }
          state.egpTotal = Math.max(0, state.egpTotal - convertedDeduction);
        } else {
          if (state.usdAggregated?.[academyName]) {
            state.usdAggregated[academyName] = Math.max(0, state.usdAggregated[academyName] - deductionAmount);
          }
          state.usdTotal = Math.max(0, state.usdTotal - deductionAmount);
        }
      }
    }

    const addition = rateInfo.monthlyAdditions?.[monthKey] ?? 0;
    const additionType = rateInfo.monthlyAdditionTypes?.[monthKey] ?? 'minutes';
    if (addition > 0) {
      const additionAmount = additionType === 'minutes' ? (addition / 60) * rateInfo.rate : addition;
      if (rateInfo.currency === 'جنيه') {
        if (state.egpAggregated?.[academyName]) {
          state.egpAggregated[academyName] += additionAmount;
        }
        state.egpTotal += additionAmount;
      } else if (rateInfo.currency === 'دولار') {
        if (rateInfo.receiveInEGP) {
          const convertedAddition = additionAmount * usdRate;
          if (state.egpAggregated?.[academyName]) {
            state.egpAggregated[academyName] += convertedAddition;
          }
          state.egpTotal += convertedAddition;
        } else {
          if (state.usdAggregated?.[academyName]) {
            state.usdAggregated[academyName] += additionAmount;
          }
          state.usdTotal += additionAmount;
        }
      }
    }
  });
};

export function calculateMonthlyStats({
  students,
  attendance,
  month,
  year,
  usdRate,
  academyRates,
  paymentStatus,
  makeupLinks = [],
  dayTransitionTime = '00:00',
  todayDate,
}: CalculateMonthlyStatsParams): MonthlyStatsResult {
  const todayStr = todayDate || cairoDate(new Date(), dayTransitionTime);

  const actualTotals = {
    egpTotal: 0,
    usdTotal: 0,
    egpAggregated: {} as Record<string, number>,
    usdAggregated: {} as Record<string, number>,
  };
  const projectedTotals = { egpTotal: 0, usdTotal: 0 };

  let deferredEgpTotal = 0;
  let deferredUsdTotal = 0;
  let remainingProjectedClasses = 0;

  const egpStudents: MonthlyStatsStudentItem[] = [];
  const usdStudents: MonthlyStatsStudentItem[] = [];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let prevMonth = month - 1;
  let prevYear = year;
  if (prevMonth < 0) {
    prevMonth = 11;
    prevYear = year - 1;
  }
  const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();

  students.forEach(student => {
    const isDeletedThisMonth = isStudentDeletedInMonth(student, month, year);
    const academyInfo = academyRates?.[student.academy];
    const billingStartDay = academyInfo?.billingStartDay || 1;

    let currentCycleClasses = 0;
    let projectedCycleClasses = 0;
    let deferredClasses = 0;

    // 1. Previous Month Tail (when billingStartDay > 1)
    if (billingStartDay > 1) {
      for (let d = billingStartDay; d <= daysInPrevMonth; d++) {
        const status = attendance[`${student.id}_${d}_${prevMonth}_${prevYear}`];
        currentCycleClasses += getStatusSessionValue(status, student, d, prevMonth, prevYear);
        projectedCycleClasses += getProjectedSessionValue(status, student, d, prevMonth, prevYear, todayStr, academyInfo, makeupLinks);
      }
    }

    // 1.5 Previous Month TRANSFERRED classes (always belong to this cycle)
    for (let d = 1; d <= daysInPrevMonth; d++) {
      const status = attendance[`${student.id}_${d}_${prevMonth}_${prevYear}`];
      if (status === AttendanceStatus.TRANSFERRED || status === AttendanceStatus.TRANSFERRED_ABSENT) {
        currentCycleClasses++;
        projectedCycleClasses++;
      }
    }

    // 2. Current Month Head (belongs to this cycle) & Tail (deferred to next cycle)
    for (let d = 1; d <= daysInMonth; d++) {
      const status = attendance[`${student.id}_${d}_${month}_${year}`];
      const actualValue = getStatusSessionValue(status, student, d, month, year);
      const projectedValue = getProjectedSessionValue(status, student, d, month, year, todayStr, academyInfo, makeupLinks);

      if (billingStartDay > 1 && d >= billingStartDay) {
        deferredClasses += actualValue;
      } else {
        currentCycleClasses += actualValue;
        projectedCycleClasses += projectedValue;
      }
    }

    remainingProjectedClasses += Math.max(0, projectedCycleClasses - currentCycleClasses);

    if (isDeletedThisMonth && currentCycleClasses === 0 && projectedCycleClasses === 0 && deferredClasses === 0) {
      return;
    }

    const currency = student.location || 'جنيه';
    const studentAmount = calcStudentAmount(student, currentCycleClasses);
    const projectedAmount = calcStudentAmount(student, projectedCycleClasses);
    const isSpecial = student.academy === 'خاص' || student.academy.includes('خاص');
    const academyReceivesInEGP = academyInfo?.receiveInEGP === true;

    const addIncome = (
      totals: { egpTotal: number; usdTotal: number; egpAggregated?: Record<string, number>; usdAggregated?: Record<string, number> },
      amount: number,
      recordStudentList: boolean
    ) => {
      if (currency === 'جنيه') {
        totals.egpTotal += amount;
        if (recordStudentList) {
          if (isSpecial) egpStudents.push({ id: student.id, name: student.name, amount, academy: student.academy });
          else if (totals.egpAggregated) totals.egpAggregated[student.academy] = (totals.egpAggregated[student.academy] || 0) + amount;
        }
      } else if (currency === 'دولار') {
        if (academyReceivesInEGP) {
          const amountInEGP = amount * usdRate;
          totals.egpTotal += amountInEGP;
          if (recordStudentList) {
            if (isSpecial) egpStudents.push({ id: student.id, name: student.name, amount: amountInEGP, academy: student.academy });
            else if (totals.egpAggregated) totals.egpAggregated[student.academy] = (totals.egpAggregated[student.academy] || 0) + amountInEGP;
          }
        } else {
          totals.usdTotal += amount;
          if (recordStudentList) {
            if (isSpecial) usdStudents.push({ id: student.id, name: student.name, amount, academy: student.academy });
            else if (totals.usdAggregated) totals.usdAggregated[student.academy] = (totals.usdAggregated[student.academy] || 0) + amount;
          }
        }
      }
    };

    if (!(isDeletedThisMonth && currentCycleClasses === 0 && deferredClasses === 0)) {
      addIncome(actualTotals, studentAmount, currentCycleClasses > 0);
    }
    addIncome(projectedTotals, projectedAmount, false);

    if (deferredClasses > 0) {
      const deferredAmount = calcStudentAmount(student, deferredClasses);
      if (currency === 'جنيه') {
        deferredEgpTotal += deferredAmount;
      } else if (currency === 'دولار') {
        if (academyReceivesInEGP) deferredEgpTotal += deferredAmount * usdRate;
        else deferredUsdTotal += deferredAmount;
      }
    }
  });

  const monthKey = `${month}_${year}`;
  applyAcademyAdjustments(academyRates, monthKey, usdRate, actualTotals);
  applyAcademyAdjustments(academyRates, monthKey, usdRate, projectedTotals);

  Object.entries(actualTotals.egpAggregated).forEach(([academyName, amount]) => {
    egpStudents.push({ id: academyName, name: academyName, amount, academy: academyName, isAggregated: true });
  });
  Object.entries(actualTotals.usdAggregated).forEach(([academyName, amount]) => {
    usdStudents.push({ id: academyName, name: academyName, amount, academy: academyName, isAggregated: true });
  });

  const sortStudents = (list: MonthlyStatsStudentItem[]) =>
    list.sort((a, b) => {
      const isPaidA = !!paymentStatus?.[`${a.id}_${month}_${year}`];
      const isPaidB = !!paymentStatus?.[`${b.id}_${month}_${year}`];
      if (isPaidA !== isPaidB) return isPaidA ? 1 : -1;
      return b.amount - a.amount;
    });

  const totalInEgp = actualTotals.egpTotal + actualTotals.usdTotal * usdRate;
  const projectedTotalInEgp = projectedTotals.egpTotal + projectedTotals.usdTotal * usdRate;

  return {
    egpTotal: actualTotals.egpTotal,
    usdTotal: actualTotals.usdTotal,
    deferredEgpTotal,
    deferredUsdTotal,
    totalInEgp,
    projectedEgpTotal: projectedTotals.egpTotal,
    projectedUsdTotal: projectedTotals.usdTotal,
    projectedTotalInEgp,
    remainingProjectedInEgp: Math.max(0, projectedTotalInEgp - totalInEgp),
    remainingProjectedClasses,
    egpStudents: sortStudents(egpStudents),
    usdStudents: sortStudents(usdStudents),
  };
}
