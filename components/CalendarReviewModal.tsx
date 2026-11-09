import React, { useEffect, useRef, useState } from 'react';
import { X, Calendar, RefreshCw, ArrowLeftRight } from 'lucide-react';
import type { Student, CalendarProposal } from '../types';
import { getRecentApologyClasses, prepareCalendarAction, type CalendarAction, type ActionOptions, type CalendarActionPreview, type ReviewData } from '../services/calendarReview';
import { cairoDate } from '../services/studentSchedule';

const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const dayNames = (values: number[]) => [...values].sort((a, b) => (a + 1) % 7 - (b + 1) % 7).map(day => days[day]).join('، ');
const dateLabel = (value: string) => new Intl.DateTimeFormat('ar-EG', { timeZone: 'Africa/Cairo', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const effectiveDayLabel = (value: string, dayTransitionTime?: string) => new Intl.DateTimeFormat('ar-EG', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${cairoDate(value, dayTransitionTime)}T12:00:00Z`));
const isoDayLabel = (date: string) => new Intl.DateTimeFormat('ar-EG', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T12:00:00Z`));

const ProposalCard: React.FC<{ student: Student; proposal: CalendarProposal; data: ReviewData; disabled: boolean; onConfirm: (studentId: string, preview: CalendarActionPreview, replace: boolean) => void }> = ({ student, proposal, data, disabled, onConfirm }) => {
  const targetDate = proposal.event ? cairoDate(proposal.event.start, data.dayTransitionTime) : '';
  const recentApologies = proposal.kind === 'scheduled' && targetDate ? getRecentApologyClasses(student, data, targetDate, 3) : [];
  const hasPreviousApology = proposal.reason === 'green' && recentApologies.some(item => item.date < targetDate);
  const [userEditedAction, setUserEditedAction] = useState(false);
  const [action, setAction] = useState<CalendarAction | ''>(
    proposal.kind === 'red' ? 'apology'
      : proposal.kind === 'reset' ? 'reset'
        : proposal.kind === 'weekly' ? 'weekly'
          : proposal.kind === 'moved' ? 'move'
            : (proposal.reason === 'green' && recentApologies.length > 0) ? 'makeup'
              : 'schedule'
  );
  const [sourceDate, setSourceDate] = useState(
    proposal.from ? cairoDate(proposal.from, data.dayTransitionTime) : (recentApologies[0]?.date || '')
  );
  const [effectiveFrom, setEffectiveFrom] = useState(cairoDate(new Date(), data.dayTransitionTime));
  const [doubleTarget, setDoubleTarget] = useState(false);
  const [preview, setPreview] = useState<CalendarActionPreview | null>(null);
  const [replace, setReplace] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userEditedAction && proposal.kind === 'scheduled' && hasPreviousApology && action !== 'makeup') {
      setAction('makeup');
      setSourceDate(recentApologies[0]?.date || '');
    } else if (action === 'makeup' && proposal.kind === 'scheduled' && recentApologies.length > 0 && !recentApologies.some(item => item.date === sourceDate)) {
      setSourceDate(recentApologies[0].date);
    }
  }, [hasPreviousApology, recentApologies, userEditedAction, proposal.kind, action, sourceDate]);

  const missing = proposal.event && student.calendarReview?.observed[proposal.event.id]?.present === false;
  const options: ActionOptions = { sourceDate, effectiveFrom, doubleTarget };
  const resetPreview = () => { setPreview(null); setReplace(false); setError(''); };
  const prepare = () => {
    if (!action) return;
    try {
      const nextPreview = prepareCalendarAction(data, student.id, proposal.id, action, options);
      setError('');
      if (nextPreview.requiresReplace) {
        setPreview(nextPreview);
        setReplace(false);
        return;
      }
      onConfirm(student.id, nextPreview, false);
    } catch (err) { setError((err as Error).message); }
  };
  const confirm = (value: CalendarActionPreview, allowReplace = false) => {
    try { onConfirm(student.id, value, allowReplace); setError(''); }
    catch (err) { setError((err as Error).message); setPreview(null); }
  };
  return <article className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3" data-proposal-kind={proposal.kind}>
    <div className="flex items-start justify-between gap-3">
      <div><h3 className="font-bold text-lg text-gray-900">{student.name}</h3>
        <p className="text-sm text-gray-600">{proposal.kind === 'red' ? 'رُصد حدث باللون الأحمر. هل هو اعتذار أم غياب؟' : proposal.kind === 'reset' ? 'تم إرجاع لون الحدث إلى الافتراضي. هل نرجع الحصة لوضعها الطبيعي؟' : proposal.kind === 'moved' ? 'تم رصد تغيير في موعد الحصة.' : proposal.kind === 'weekly' ? 'الأيام الأسبوعية المتكررة في الكاليندر مختلفة عن التطبيق.' : proposal.reason === 'green' ? 'رُصد حدث باللون الأخضر. هل نضيفه كحصة مجدولة؟' : 'رُصدت حصة غير متكررة. هل هي حصة إضافية أم تعويض؟'}</p>
      </div>
      {proposal.kind === 'weekly' || proposal.kind === 'moved' || proposal.kind === 'reset'
        ? <ArrowLeftRight aria-hidden="true" size={20} className="shrink-0 mt-2 text-blue-600" />
        : <span aria-hidden="true" className={`shrink-0 w-5 h-5 mt-2 rounded-full ${proposal.kind === 'red' ? 'bg-red-500' : 'border-2 border-blue-400'}`} />}
    </div>
    {proposal.event && <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700">
      {proposal.from && <p>من: {dateLabel(proposal.from)}{cairoDate(proposal.from, data.dayTransitionTime) !== cairoDate(proposal.from) ? ` (يُحسب يوم ${effectiveDayLabel(proposal.from, data.dayTransitionTime)})` : ''}</p>}
      <p>{proposal.from ? 'إلى: ' : 'الموعد: '}{dateLabel(proposal.event.start)}{cairoDate(proposal.event.start, data.dayTransitionTime) !== cairoDate(proposal.event.start) ? ` (يُحسب يوم ${effectiveDayLabel(proposal.event.start, data.dayTransitionTime)})` : ''}</p>
      <p className="text-xs text-gray-500 mt-1">التاريخ والوقت أعلاه بتوقيت القاهرة لتحديد خانة الحضور{data.dayTransitionTime && data.dayTransitionTime !== '00:00' ? ` (بداية اليوم: ${data.dayTransitionTime})` : ''}.</p>
    </div>}
    {proposal.kind === 'weekly' && <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-900"><p>الأيام الحالية في التطبيق: {dayNames(student.days || []) || 'غير محددة'}</p><p>أيام جوجل كاليندر: {dayNames(proposal.days || [])}</p></div>}
    {missing && <p className="text-sm text-amber-700">هذا الحدث رُصد سابقًا ولم يظهر في آخر قراءة؛ قد يكون أُرشف أو حُذف. تحقق من الحصة قبل الموافقة.</p>}
    {proposal.event && student.calendarReview?.observed[proposal.event.id]?.event.colorId !== proposal.event.colorId && <p className="text-sm text-amber-700">لون الحدث تغيّر بعد رصد الاقتراح. احتفظنا بالملاحظة لتراجعها بنفسك.</p>}
    <label className="block text-sm font-bold text-gray-700">الإجراء المقترح
      <select aria-label={`إجراء ${student.name}`} value={action} onChange={event => { const next = event.target.value as CalendarAction; setUserEditedAction(true); setAction(next); if (next === 'makeup' && proposal.kind === 'scheduled' && !sourceDate && recentApologies[0]) setSourceDate(recentApologies[0].date); resetPreview(); }} className="block w-full mt-1 rounded-xl border border-gray-200 p-2 bg-white" disabled={disabled}>
        {proposal.kind === 'red' ? <><option value="apology">اعتذار الطالب — دائرة حمراء</option><option value="absence">غياب الطالب — يُحسب ضمن الحصص</option><option value="teacher">اعتذار المعلم — دائرة حمراء بشرطة</option></>
          : proposal.kind === 'reset' ? <option value="reset">إرجاع الحصة لوضعها الطبيعي (مسح الاعتذار أو الغياب)</option>
            : proposal.kind === 'weekly' ? <option value="weekly">تحديث الأيام الثابتة من تاريخ محدد</option>
              : proposal.kind === 'moved' ? <><option value="move">نقل هذه الحصة فقط بين اليومين</option><option value="makeup">اعتبار الموعد الجديد تعويضًا عن الحصة الأصلية</option></>
                : <><option value="schedule">حصة مجدولة — دائرة زرقاء</option><option value="double">حصة ثانية في نفس اليوم — دائرتان مجدولتان</option><option value="makeup">تعويض عن حصة سابقة</option></>}
      </select>
    </label>
    {action === 'makeup' && (proposal.kind === 'scheduled'
      ? <label className="block text-sm font-bold text-gray-700">الحصة الأصلية (آخر حصص الاعتذار)
        <select aria-label="تاريخ الحصة الأصلية" value={sourceDate} onChange={event => { setSourceDate(event.target.value); resetPreview(); }} className="block w-full mt-1 rounded-xl border border-gray-200 p-2 bg-white font-normal" disabled={disabled || recentApologies.length === 0}>
          {recentApologies.length === 0
            ? <option value="">لا توجد حصص اعتذار سابقة مسجلة في هذا الشهر</option>
            : recentApologies.map(item => <option key={item.date} value={item.date}>{isoDayLabel(item.date)} — {item.status === 'x' ? 'اعتذار المعلم (بشرطة)' : 'اعتذار الطالب'}</option>)}
        </select>
      </label>
      : <label className="block text-sm">تاريخ الحصة الأصلية<input type="date" aria-label="تاريخ الحصة الأصلية" value={sourceDate} onChange={event => { setSourceDate(event.target.value); resetPreview(); }} className="block mt-1 border rounded-lg p-2" /></label>)}
    {action === 'weekly' && <label className="block text-sm">بداية تطبيق الأيام الجديدة<input type="date" aria-label="بداية الجدول الجديد" min={cairoDate(new Date(), data.dayTransitionTime)} value={effectiveFrom} onChange={event => { setEffectiveFrom(event.target.value); resetPreview(); }} className="block mt-1 border rounded-lg p-2" /></label>}
    {(action === 'makeup' || action === 'move') && <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={doubleTarget} onChange={event => { setDoubleTarget(event.target.checked); resetPreview(); }} />الموعد الجديد حصة ثانية في نفس اليوم</label>}
    {error && <p role="alert" className="text-red-700 text-sm">{error}</p>}
    {preview && <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
      <p className="font-bold text-amber-900">راجع التعديل قبل التأكيد</p>
      {preview.lines.map((line, index) => <p key={index} className="text-sm text-gray-800">{line}</p>)}
      {!preview.lines.length && <p className="text-sm">الحالة المطلوبة مسجلة بالفعل؛ سيتم إغلاق الاقتراح فقط.</p>}
      {preview.requiresReplace && <label className="flex items-start gap-2 text-sm text-red-700"><input type="checkbox" checked={replace} onChange={event => setReplace(event.target.checked)} />راجعت الحالة المسجلة وأوافق على استبدالها.</label>}
      <button type="button" disabled={disabled || (preview.requiresReplace && !replace)} onClick={() => confirm(preview, replace)} className="rounded-lg bg-emerald-700 px-4 py-2 text-white font-bold disabled:opacity-40">تأكيد التعديل</button>
      <button type="button" onClick={resetPreview} className="px-3 py-2 text-gray-600">رجوع</button>
    </div>}
    {!preview && <div className="flex gap-3">
      <button type="button" disabled={disabled || !action} onClick={prepare} className="rounded-xl bg-blue-700 px-4 py-2 text-white font-bold text-sm disabled:opacity-40">تأكيد</button>
      <button type="button" disabled={disabled} onClick={() => { try { confirm(prepareCalendarAction(data, student.id, proposal.id, 'ignore')); } catch (err) { setError((err as Error).message); } }} className="text-sm text-gray-600 px-3 py-2">تجاهل هذا التغيير</button>
    </div>}
  </article>;
}

export default function CalendarReviewModal({ data, error, loading, disabled, onRefresh, onClose, onConfirm }: { data: ReviewData; error: string; loading: boolean; disabled: boolean; onRefresh: () => void; onClose: () => void; onConfirm: (studentId: string, preview: CalendarActionPreview, replace: boolean) => void }) {
  const [search, setSearch] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => previous?.focus();
  }, []);
  const entries = data.students.flatMap(student => student.calendarReview?.name === student.name.trim() ? student.calendarReview.pending.map(proposal => ({ student, proposal })) : []);
  const visible = entries.filter(({ student }) => student.name.toLowerCase().includes(search.toLowerCase()));
      return <div className="fixed inset-0 z-[150] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose} onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') onClose(); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="calendar-review-title" dir="rtl" className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-gray-50 rounded-3xl shadow-2xl font-arabic overflow-hidden" onClick={event => event.stopPropagation()}>
          <header className="bg-white border-b p-5 flex items-start justify-between gap-3">
            <div><h2 id="calendar-review-title" className="text-xl font-bold flex items-center gap-2"><Calendar size={22} />مراجعة تغييرات الكاليندر</h2><p className="text-sm text-gray-500 mt-1">{entries.length} اقتراح · تعديل الحضور والأيام يتم بعد موافقتك فقط.</p></div>
            <button ref={closeRef} type="button" aria-label="إغلاق مراجعة الكاليندر" onClick={onClose} className="p-1 text-gray-500"><X size={24} /></button>
          </header>
          <div className="p-4 border-b flex gap-2 bg-white"><input aria-label="بحث في اقتراحات الكاليندر" placeholder="ابحث باسم الطالب…" value={search} onChange={event => setSearch(event.target.value)} className="flex-1 min-w-0 p-2 border rounded-xl" /><button type="button" disabled={loading || disabled} onClick={onRefresh} className="flex items-center gap-1 px-3 text-blue-700 disabled:opacity-40"><RefreshCw size={17} className={loading ? 'animate-spin' : ''} />تحديث</button></div>
          <div className="overflow-y-auto p-4 space-y-3">
            {error && <p role="alert" className="bg-amber-50 text-amber-800 border border-amber-200 rounded-xl p-3 text-sm">{error}</p>}
            {disabled && <p className="text-amber-800 text-sm">انتظر اكتمال المزامنة أو حل تعارض البيانات قبل الموافقة.</p>}
            {!visible.length && <p className="text-center py-12 text-gray-500">{loading ? 'جاري قراءة الكاليندر…' : 'لا توجد اقتراحات تحتاج مراجعة.'}</p>}
            {visible.map(({ student, proposal }) => <ProposalCard key={`${student.id}:${proposal.id}`} student={student} proposal={proposal} data={data} disabled={disabled} onConfirm={onConfirm} />)}
          </div>
        </section>
      </div>;
}
