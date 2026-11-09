import { AttendanceStatus, type Student, type CalendarOccurrence, type CalendarProposal, type CalendarReviewState, type CalendarSchedulesResult, type AttendanceRecord, type MakeupLink } from '../types';
import { cairoDate, replaceScheduleFrom, scheduledCount } from './studentSchedule';

export type CalendarAction = 'schedule' | 'double' | 'makeup' | 'apology' | 'absence' | 'teacher' | 'move' | 'weekly' | 'reset' | 'ignore';
export type ReviewData = { students: Student[]; attendance: AttendanceRecord; makeupLinks: MakeupLink[]; savedReports: Record<string, unknown>; savedReportDrafts?: Record<string, unknown>; lastReports?: Record<string, unknown>; dayTransitionTime?: string };
export type ActionOptions = { sourceDate?: string; effectiveFrom?: string; doubleTarget?: boolean };
export type CalendarActionPreview = { guard: string; changes: { key: string; date: string; before: AttendanceStatus | undefined; after: AttendanceStatus }[]; lines: string[]; requiresReplace: boolean; student: Student; links: MakeupLink[]; proposal: CalendarProposal; action: CalendarAction; options: ActionOptions };
export type ApologyClassOption = { date: string; day: number; month: number; year: number; status: AttendanceStatus.ABSENCE_RED | AttendanceStatus.UNEXCUSED_ABSENCE };

export function getRecentApologyClasses(student: Student, data: ReviewData, targetDate: string, limit = 3): ApologyClassOption[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return [];
  const [targetYear, targetMonthNum] = targetDate.split('-').map(Number);
  const targetMonth = targetMonthNum - 1;
  const prefix = `${student.id}_`;
  const items: ApologyClassOption[] = [];
  for (const [key, status] of Object.entries(data.attendance)) {
    if (!key.startsWith(prefix)) continue;
    if (status !== AttendanceStatus.ABSENCE_RED && status !== AttendanceStatus.UNEXCUSED_ABSENCE) continue;
    const parts = key.slice(prefix.length).split('_').map(Number);
    if (parts.length !== 3 || parts.some(p => !Number.isInteger(p))) continue;
    const [day, month, year] = parts;
    if (month !== targetMonth || year !== targetYear) continue;
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (date === targetDate) continue;
    if (data.savedReports[key] || data.savedReportDrafts?.[key] || data.lastReports?.[key]) continue;
    if (data.makeupLinks.some(link => link.studentId === student.id && link.month === month && link.year === year && (link.missedDay === day || link.makeupDay === day))) continue;
    items.push({ date, day, month, year, status });
  }
  items.sort((a, b) => {
    const aBefore = a.date < targetDate ? 0 : 1;
    const bBefore = b.date < targetDate ? 0 : 1;
    if (aBefore !== bBefore) return aBefore - bBefore;
    return b.date.localeCompare(a.date);
  });
  return items.slice(0, limit);
}
const green = new Set(['2', '10']);
const red = new Set(['4', '11']);
const color = (event: CalendarOccurrence) => green.has(event.colorId) ? 'green' : red.has(event.colorId) ? 'red' : '';
const fingerprint = (event: CalendarOccurrence) => JSON.stringify([event.start, event.end, color(event), event.recurring, event.originalStart || '']);
const sameDays = (a: number[], b: number[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
export const attendanceLabels: Record<string, string> = { '': 'بدون تسجيل', e: 'حصة مجدولة — دائرة زرقاء', ed: 'حصتان مجدولتان', exempt: 'إلغاء طلب الحصة لهذا اليوم', r: 'اعتذار الطالب', '!': 'غياب الطالب — تُحسب حصة', '!2': 'غياب الطالب — تُحسب حصتان', x: 'اعتذار المعلم', 'م': 'مؤجلة للتعويض', '1': 'حضور', '2': 'حضور حصتين', t: 'حصة منقولة', ta: 'غياب منقول' };

// Detection only. This function never modifies attendance, reports or fixed days.
export function ingestCalendarReviews(students: Student[], requests: { id: string; name: string }[], result: CalendarSchedulesResult): Student[] {
  if (!result.available || !result.reviews) return students;
  const requested = new Map(requests.map(student => [student.id, student.name]));
  let changed = false;
  const next = students.map(student => {
    const snapshot = result.reviews?.[student.id];
    if (!snapshot || requested.get(student.id) !== student.name || snapshot.name !== student.name.trim()) return student;
    // Identical names in separate student records need manual disambiguation.
    if (students.filter(item => item.name.trim() === student.name.trim()).length > 1) return student;
    const old: CalendarReviewState = student.calendarReview?.name === snapshot.name ? student.calendarReview : { name: snapshot.name, observed: {}, pending: [], decisions: {} };
    const observed = { ...old.observed };
    let pending = [...old.pending];
    const decisions = { ...old.decisions };
    const propose = (proposal: CalendarProposal) => {
      if (!decisions[proposal.id] && !pending.some(item => item.id === proposal.id)) pending.push(proposal);
    };
    for (const event of snapshot.events) {
      if (!event.id || !Number.isFinite(Date.parse(event.start))) continue;
      const previous = observed[event.id];
      const unchanged = !!(previous && fingerprint(previous.event) === fingerprint(event));
      const revision = unchanged ? previous.revision : (previous?.revision || 0) + 1;
      if (!unchanged) {
        observed[event.id] = { event, revision, present: true };
        // A newer date supersedes unreviewed suggestions for that same occurrence.
        if (previous && previous.event.start !== event.start) pending = pending.filter(item => item.event?.id !== event.id);
      }
      const base = { event, detectedAt: snapshot.fetchedAt };
        if (!unchanged) {
          const from = previous ? (previous.event.start !== event.start ? previous.event.start : undefined)
            : event.originalStart && Date.parse(event.originalStart) !== Date.parse(event.start) ? event.originalStart : undefined;
          if (from) propose({ ...base, id: `${event.id}:moved:${revision}`, kind: 'moved', from });
          if (color(event) === 'red') {
            pending = pending.filter(item => item.event?.id !== event.id || item.kind === 'moved');
            propose({ ...base, id: `${event.id}:red:${revision}`, kind: 'red' });
          } else if (color(event) === 'green' || (!previous && !event.recurring && !from)) {
            pending = pending.filter(item => item.event?.id !== event.id || item.kind === 'moved');
            propose({ ...base, id: `${event.id}:scheduled:${revision}`, kind: 'scheduled', reason: color(event) === 'green' ? 'green' : 'one-off' });
          }
        }
        if (color(event) === '') {
          const latestColorDecision = Object.entries(decisions)
            .filter(([key, val]) => key.startsWith(`${event.id}:`) && ['apology', 'absence', 'teacher', 'schedule', 'double', 'reset'].includes(val.action))
            .map(([key, val]) => ({ rev: Number(key.split(':').pop()) || 0, action: val.action }))
            .sort((a, b) => b.rev - a.rev)[0];
          if (latestColorDecision && latestColorDecision.action !== 'reset' && revision > latestColorDecision.rev) {
            pending = pending.filter(item => item.event?.id !== event.id || item.kind === 'moved' || item.id === `${event.id}:reset:${revision}`);
            propose({ ...base, id: `${event.id}:reset:${revision}`, kind: 'reset' });
          }
        }
      }
      const presentIds = new Set(snapshot.events.map(event => event.id));
      const archivedIds = new Set(snapshot.archivedIds || []);
      const archivedStarts = new Set(snapshot.archivedStarts || []);
      for (const [id, item] of Object.entries(observed)) {
        const isPresent = presentIds.has(id);
        const isArchived = !isPresent && (archivedIds.has(id) || archivedStarts.has(item.event.start));
        if (!isPresent && !isArchived) {
          pending = pending.filter(proposal => proposal.event?.id !== id);
          delete observed[id];
          continue;
        }
        if (item.present !== isPresent) observed[id] = { ...item, present: isPresent };
      }
      if (snapshot.weeklySignature && snapshot.weeklyDays) {
        const currentDays = student.days || [];
        const hasDoubleDay = currentDays.some((day, index) => currentDays.indexOf(day) !== index);
        const matchesWeekly = sameDays(currentDays, snapshot.weeklyDays)
          || (!!snapshot.weeklyExpandedDays && (student.duration === 'خليط' || hasDoubleDay) && sameDays(currentDays, snapshot.weeklyExpandedDays));
        const proposedDays = (student.duration === 'خليط' || hasDoubleDay) && snapshot.weeklyExpandedDays ? snapshot.weeklyExpandedDays : snapshot.weeklyDays;
        const weeklyId = `weekly:${snapshot.weeklySignature}:${[...currentDays].sort().join(',')}`;
        pending = pending.filter(item => item.kind !== 'weekly' || item.id === weeklyId);
        for (const key of Object.keys(decisions)) {
          if (key.startsWith('weekly:') && (matchesWeekly || key !== weeklyId)) delete decisions[key];
        }
        if (!matchesWeekly) propose({ id: weeklyId, kind: 'weekly', signature: snapshot.weeklySignature, days: proposedDays, detectedAt: snapshot.fetchedAt });
        else pending = pending.filter(item => item.kind !== 'weekly');
      } else pending = pending.filter(item => item.kind !== 'weekly');
      // Keep detected colors even when an external script clears/archives the event.
      // Keep outstanding questions, but bound the acknowledged observation history.
      const cutoff = Date.parse(snapshot.fetchedAt) - 120 * 86400000;
      for (const [id, item] of Object.entries(observed)) {
        if (Date.parse(item.event.start) < cutoff && !pending.some(proposal => proposal.event?.id === id)) delete observed[id];
      }
      for (const [id, decision] of Object.entries(decisions)) if (Date.parse(decision.at) < cutoff && !pending.some(proposal => proposal.id === id)) delete decisions[id];
      const state: CalendarReviewState = { name: snapshot.name, observed, pending, decisions, ...(snapshot.weeklySignature ? { weeklySignature: snapshot.weeklySignature } : old.weeklySignature ? { weeklySignature: old.weeklySignature } : {}) };
      if (JSON.stringify(old) === JSON.stringify(state)) return student;
      changed = true;
      return { ...student, calendarReview: state };
    });
  return changed ? next : students;
}

function dateKey(studentId: string, date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T12:00:00Z`)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error('اختر تاريخًا صالحًا.');
  const [year, month, day] = date.split('-').map(Number);
  return { key: `${studentId}_${day}_${month - 1}_${year}`, year, month: month - 1, day };
}

export function prepareCalendarAction(data: ReviewData, studentId: string, proposalId: string, action: CalendarAction, options: ActionOptions = {}): CalendarActionPreview {
  const student = data.students.find(item => item.id === studentId);
  const proposal = student?.calendarReview?.pending.find(item => item.id === proposalId);
  if (!student || !proposal || student.calendarReview?.name !== student.name.trim()) throw new Error('الاقتراح لم يعد متاحًا. افتح المراجعة من جديد.');
  const allowed = proposal.kind === 'red' ? ['apology', 'absence', 'teacher'] : proposal.kind === 'reset' ? ['reset'] : proposal.kind === 'moved' ? ['move', 'makeup'] : proposal.kind === 'weekly' ? ['weekly'] : ['schedule', 'double', 'makeup'];
  if (action !== 'ignore' && !allowed.includes(action)) throw new Error('اختر الإجراء المناسب لهذا الاقتراح.');
  const changes: CalendarActionPreview['changes'] = [];
  let updatedStudent = student;
  let links = data.makeupLinks;
  const lines: string[] = [];
  const add = (date: string, after: AttendanceStatus) => {
    const { key, month, year, day } = dateKey(studentId, date);
    const before = data.attendance[key];
    if ((before || '') === after) return;
    if (data.savedReports[key] || data.savedReportDrafts?.[key] || data.lastReports?.[key]) throw new Error(`حصة ${date} عليها تقرير أو مسودة محفوظة. راجعها يدويًا قبل تغيير حالتها.`);
    if (data.makeupLinks.some(link => link.studentId === studentId && link.month === month && link.year === year && (link.missedDay === day || link.makeupDay === day))) throw new Error(`يوم ${date} مرتبط بالفعل بتعويض. راجع الربط الحالي أولًا.`);
    changes.push({ key, date, before, after });
    lines.push(`${date}: ${attendanceLabels[before || ''] || before} ← ${attendanceLabels[after]}`);
  };
  if (action === 'ignore') lines.push('تجاهل هذا الاقتراح دون تغيير بيانات الطالب.');
  else if (action === 'weekly') {
    const todayCairo = cairoDate(new Date(), data.dayTransitionTime);
    const effective = options.effectiveFrom || todayCairo;
    dateKey(studentId, effective);
    if (effective < todayCairo) throw new Error('تاريخ بداية الجدول الجديد يجب أن يكون اليوم أو بعده لحماية سجل الحصص السابق.');
    if (!proposal.days?.length || proposal.days.some(day => day < 0 || day > 6)) throw new Error('الأيام المقترحة غير صالحة.');
    updatedStudent = replaceScheduleFrom(student, proposal.days, effective);
    for (const key of new Set([...Object.keys(data.attendance), ...Object.keys(data.savedReports), ...Object.keys(data.savedReportDrafts || {})])) {
      if (!key.startsWith(`${studentId}_`)) continue;
      const parts = key.slice(studentId.length + 1).split('_').map(Number);
      if (parts.length !== 3 || parts.some(part => !Number.isInteger(part))) continue;
      const [day, month, year] = parts;
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (date < effective || scheduledCount(student, day, month, year) === scheduledCount(updatedStudent, day, month, year)) continue;
      const status = data.attendance[key];
      if (data.savedReports[key] || data.savedReportDrafts?.[key] || (status && ![AttendanceStatus.EXTRA_DAY, AttendanceStatus.EXTRA_DOUBLE, AttendanceStatus.EXEMPT].includes(status))) throw new Error(`توجد حصة مسجلة يوم ${date} تتأثر بتغيير الأيام. اختر تاريخ بداية بعدها أو راجع الحصة يدويًا.`);
    }
    lines.push(`تحديث الأيام الثابتة ابتداءً من ${effective}، مع الاحتفاظ بالجدول السابق قبل هذا التاريخ.`);
  } else {
    if (!proposal.event) throw new Error('بيانات الحصة غير متاحة.');
    const target = cairoDate(proposal.event.start, data.dayTransitionTime);
    const targetParts = dateKey(studentId, target);
    if (action === 'schedule' || action === 'double') add(target, action === 'double' ? AttendanceStatus.EXTRA_DOUBLE : AttendanceStatus.EXTRA_DAY);
    else if (action === 'reset') add(target, AttendanceStatus.ABSENT);
    else if (action === 'apology') add(target, AttendanceStatus.ABSENCE_RED);
    else if (action === 'teacher') add(target, AttendanceStatus.UNEXCUSED_ABSENCE);
    else if (action === 'absence') {
      const isDouble = scheduledCount(student, targetParts.day, targetParts.month, targetParts.year) >= 2 || [AttendanceStatus.EXTRA_DOUBLE, AttendanceStatus.DOUBLE_CLASS, AttendanceStatus.PAID_ABSENCE_DOUBLE].includes(data.attendance[targetParts.key]);
      add(target, isDouble ? AttendanceStatus.PAID_ABSENCE_DOUBLE : AttendanceStatus.PAID_ABSENCE);
    } else {
      const source = action === 'move' ? (proposal.from ? cairoDate(proposal.from, data.dayTransitionTime) : '') : options.sourceDate || (proposal.from ? cairoDate(proposal.from, data.dayTransitionTime) : '');
      const sourceParts = dateKey(studentId, source);
      if (source === target) {
        if (action === 'makeup') throw new Error('اختر يوم الحصة الأصلية مختلفًا عن يوم التعويض.');
        lines.push('تغيير وقت الحصة داخل اليوم نفسه؛ لا حاجة لتعديل حالة اليوم.');
      } else {
        const sourceStatus = data.attendance[sourceParts.key];
        const sourceCount = scheduledCount(student, sourceParts.day, sourceParts.month, sourceParts.year);
        const sourceEventsOnDay = Object.values(student.calendarReview?.observed || {}).filter(item => item.present !== false && item.event.id !== proposal.event!.id && cairoDate(item.event.start, data.dayTransitionTime) === source);
        const otherSourceEvent = proposal.kind === 'moved' ? sourceEventsOnDay.length > 0 : sourceEventsOnDay.length > 1;
        if (sourceCount > 1 || [AttendanceStatus.EXTRA_DOUBLE, AttendanceStatus.DOUBLE_CLASS, AttendanceStatus.PAID_ABSENCE_DOUBLE].includes(sourceStatus) || otherSourceEvent) throw new Error('اليوم الأصلي يحتوي على أكثر من حصة أو حدث آخر. راجعه يدويًا حتى لا تُلغى الحصة الأخرى.');
        const targetCount = scheduledCount(student, targetParts.day, targetParts.month, targetParts.year);
        if (!options.doubleTarget && (targetCount > 0 || data.attendance[targetParts.key] === AttendanceStatus.EXTRA_DAY)) throw new Error('اليوم الجديد به حصة مجدولة بالفعل. اختر «حصة ثانية في نفس اليوم» إذا كان المقصود إضافة الحصة المنقولة إليها.');
        if (options.doubleTarget && (targetCount > 1 || [AttendanceStatus.EXTRA_DOUBLE, AttendanceStatus.DOUBLE_CLASS, AttendanceStatus.PAID_ABSENCE_DOUBLE].includes(data.attendance[targetParts.key]))) throw new Error('اليوم الجديد يحتوي بالفعل على حصتين. راجع عدد الحصص يدويًا.');
        if (action === 'makeup' && (sourceParts.month !== targetParts.month || sourceParts.year !== targetParts.year)) throw new Error('ربط تعويض بين شهرين يحتاج مراجعة يدوية. يمكنك اختيار نقل الحصة لتعديل اليومين دون ربط تعويض.');
        add(source, action === 'makeup' ? AttendanceStatus.POSTPONED : AttendanceStatus.EXEMPT);
        add(target, options.doubleTarget ? AttendanceStatus.EXTRA_DOUBLE : AttendanceStatus.EXTRA_DAY);
        if (action === 'makeup') links = [...links, { studentId, missedDay: sourceParts.day, makeupDay: targetParts.day, month: targetParts.month, year: targetParts.year, originalStatus: data.attendance[sourceParts.key] || AttendanceStatus.ABSENT }];
      }
    }
  }
  const requiresReplace = changes.some(change => !!change.before && ![AttendanceStatus.EXTRA_DAY, AttendanceStatus.EXTRA_DOUBLE, AttendanceStatus.EXEMPT, ...(action === 'reset' ? [AttendanceStatus.ABSENCE_RED, AttendanceStatus.PAID_ABSENCE, AttendanceStatus.PAID_ABSENCE_DOUBLE, AttendanceStatus.UNEXCUSED_ABSENCE] : []), ...(action === 'makeup' && change.after === AttendanceStatus.POSTPONED ? [AttendanceStatus.ABSENCE_RED, AttendanceStatus.UNEXCUSED_ABSENCE] : [])].includes(change.before));
  const guard = JSON.stringify([student, changes.map(change => [change.key, change.before || '', data.savedReports[change.key], data.savedReportDrafts?.[change.key], data.lastReports?.[change.key]]), data.makeupLinks, action, options, data.dayTransitionTime || '00:00']);
  return { guard, changes, lines, requiresReplace, student: updatedStudent, links, proposal, action, options };
}

export function commitCalendarAction(data: ReviewData, studentId: string, preview: CalendarActionPreview, allowReplace = false) {
  const current = prepareCalendarAction(data, studentId, preview.proposal.id, preview.action, preview.options);
  if (current.guard !== preview.guard) throw new Error('تغيرت البيانات أثناء المراجعة. اعرض التعديل من جديد قبل تأكيده.');
  if (current.requiresReplace && !allowReplace) throw new Error('أكد مراجعة الحالة المسجلة قبل استبدالها.');
  const review = current.student.calendarReview!;
  const nextDecisions = current.action === 'weekly'
    ? Object.fromEntries(Object.entries(review.decisions).filter(([key]) => !key.startsWith('weekly:')))
    : { ...review.decisions, [current.proposal.id]: { action: current.action, at: new Date().toISOString() } };
  const student = { ...current.student, calendarReview: { ...review, pending: review.pending.filter(item => item.id !== current.proposal.id), decisions: nextDecisions } };
  const nextAttendance = { ...data.attendance };
  for (const change of current.changes) {
    if (change.after === AttendanceStatus.ABSENT) delete nextAttendance[change.key];
    else nextAttendance[change.key] = change.after;
  }
  return { students: data.students.map(item => item.id === studentId ? student : item), attendance: nextAttendance, makeupLinks: current.links };
}
