import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { X, Trash2, Clock, Link, Check, Phone, ChevronDown, ChevronLeft } from 'lucide-react';
import { Student, StudyPlan, CalendarSchedule } from '../types';
import { DAYS_OF_WEEK } from '../constants';
import { linksEquivalent } from '../services/shortcutStudentSync';
import { isCurrentSchedule } from '../services/calendarStudentSync';

type ShortcutMatch = {
  id: string; folderId: string; path: string; titles: string[]; isQuran: boolean; isReading: boolean;
  zoomLink: string; quranLink: string; readingLink: string; readingLinkInvalid: boolean; readingConflict: boolean; zoomConflict: boolean; conflict: boolean; exact?: boolean;
};

interface Props {
  onClose: () => void;
  onSave: (student: Student) => void;
  onDelete?: (id: string) => void;
  academies: string[];
  student?: Student;
  academyRates?: Record<string, { rate: number; currency: string; holidays?: number[] }>;
  onEndEnrollment?: (student: Student) => void;
  prefillAcademy?: string;
  currentMonth: number;
  currentYear: number;
  onAssignTajweed?: () => void;
  students?: Student[];
  showToast?: (msg: string) => void;
  openStudentWebInitially?: boolean;
  onAcknowledgeMissingReading?: (studentId: string, ids: string[]) => void;
}

// Convert Western numerals to Hindi numerals
const toHindiDigits = (str: string): string => {
  return str.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)]);
};

// Convert Hindi numerals back to Western for storage
const toWesternDigits = (str: string): string => {
  return str.toString().replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
};

// Helper to check if a string is a valid URL
const isValidUrl = (url: string): boolean => {
  if (!url || url.length < 3) return false;
  try {
    const pattern = new RegExp('^(https?:\\/\\/)?' + // protocol
      '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
      '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
      '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
      '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
      '(\\#[-a-z\\d_]*)?$', 'i'); // fragment locator
    return !!pattern.test(url);
  } catch {
    return false;
  }
};

const isDriveFileLink = (value: string): boolean => {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.hostname !== 'drive.google.com') return false;
    const match = url.pathname.match(/^\/file\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/);
    const id = match ? match[1] : (/^\/(?:open|uc)$/.test(url.pathname) ? url.searchParams.get('id') : null);
    return !!id && /^[a-zA-Z0-9_-]+$/.test(id);
  } catch {
    return false;
  }
};

const isGoogleMeetLink = (value: string): boolean => {
  try { return new URL(value.replace(/[\u061c\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '').trim()).hostname === 'meet.google.com'; }
  catch { return false; }
};

const shortcutIsComplete = (
  matches: ShortcutMatch[], readings: ShortcutMatch[], missing: ShortcutMatch[],
  saved: { shortcutId: string; readingId: string; zoom: string; quran: string; reading: string; acknowledged: string[] },
): boolean => {
  if (matches.length !== 1) return false;
  const source = matches[0];
  if (source.id !== saved.shortcutId && source.id !== saved.readingId) return false;
  if (source.conflict || source.zoomConflict || !source.zoomLink || !saved.zoom || !linksEquivalent(saved.zoom, source.zoomLink, 'zoom')) return false;
  if (source.isQuran && (!source.quranLink || !saved.quran || !linksEquivalent(saved.quran, source.quranLink, 'quran'))) return false;
  const candidates = readings.filter(item => item.folderId === source.folderId);
  if (candidates.length > 1) return false;
  const reading = candidates[0];
  if (reading && (reading.readingConflict || reading.readingLinkInvalid || !reading.readingLink || !saved.reading || !linksEquivalent(saved.reading, reading.readingLink, 'quran'))) return false;
  if (saved.readingId && reading?.id !== saved.readingId && !saved.acknowledged.includes(saved.readingId)) return false;
  return !missing.some(item => item.folderId === source.folderId && !saved.acknowledged.includes(item.id));
};

const StudentModal: React.FC<Props> = ({ onClose, onSave, onDelete, onEndEnrollment, academies, student, academyRates, prefillAcademy, currentMonth, currentYear, onAssignTajweed, students, showToast, openStudentWebInitially = false, onAcknowledgeMissingReading }) => {
  const [name, setName] = useState(student?.name || '');
  const [academy, setAcademy] = useState(student?.academy || prefillAcademy || '');
  const [studentTargetAge, setStudentTargetAge] = useState<'kids' | 'adults'>(student?.targetAge || 'adults');
  const [currency, setCurrency] = useState(student?.location || 'جنيه');
  const [rate, setRate] = useState(student?.rate ? toHindiDigits(student.rate.toString()) : '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>(student?.days || []);
  const [duration, setDuration] = useState(student?.duration || '٣٠');
  const [paymentBasis, setPaymentBasis] = useState(student?.paymentBasis || 'بالحصة');
  const [useAcademyRate, setUseAcademyRate] = useState(student?.useAcademyRate ?? false);
  const [externalLink, setExternalLink] = useState(student?.externalLink || '');
  const [color, setColor] = useState(student?.color || '');
  const [disableReport, setDisableReport] = useState(student?.disableReport ?? false);
  const [whatsappNumber, setWhatsappNumber] = useState(student?.whatsappNumber || '');
  const [zoomLink, setZoomLink] = useState(student?.zoomLink || '');
  const [quranLink, setQuranLink] = useState(student?.quranLink || '');
  const [quranLinkError, setQuranLinkError] = useState(false);
  const [readingLink, setReadingLink] = useState(student?.readingLink || '');
  const [readingLinkError, setReadingLinkError] = useState(false);
  const [shortcutSourceId, setShortcutSourceId] = useState(student?.shortcutSourceId || '');
  const [readingShortcutSourceId, setReadingShortcutSourceId] = useState(student?.readingShortcutSourceId || '');
  const [shortcutNotRequired, setShortcutNotRequired] = useState(student?.shortcutNotRequired ?? false);
  const [acknowledgedMissingReadingIds, setAcknowledgedMissingReadingIds] = useState<string[]>(student?.acknowledgedMissingReadingIds || []);
  const [shortcutMatches, setShortcutMatches] = useState<ShortcutMatch[]>([]);
  const [readingMatches, setReadingMatches] = useState<ShortcutMatch[]>([]);
  const [missingReadingMatches, setMissingReadingMatches] = useState<ShortcutMatch[]>([]);
  const [folderHint, setFolderHint] = useState('');
  const [shortcutAvailable, setShortcutAvailable] = useState<boolean | null>(null);
  const [shortcutCollapsed, setShortcutCollapsed] = useState(false);
  const [shortcutApplied, setShortcutApplied] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState(student?.scheduleMessage || '');
  const [calendarSchedule, setCalendarSchedule] = useState<CalendarSchedule | undefined>(student?.calendarSchedule);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [scheduleRefresh, setScheduleRefresh] = useState(0);
  const [showStudentWeb, setShowStudentWeb] = useState(openStudentWebInitially);
  const [isEndingEnrollment, setIsEndingEnrollment] = useState(!!student?.deletedAt);
  const [dayStartDates, setDayStartDates] = useState<Record<number, string>>(student?.dayStartDates || {});
  const [studyPlan, setStudyPlan] = useState<StudyPlan>(student?.studyPlan || {
    isActive: false,
    targetType: 'pages',
    from: 0,
    to: 0,
    totalClasses: 0,
    portionPerClass: 0,
    startDate: '',
    endDate: '',
  });
  const formRef = useRef<HTMLFormElement>(null);
  const mainPanelRef = useRef<HTMLElement>(null);
  const studentWebPanelRef = useRef<HTMLElement>(null);
  const [activePanelHeight, setActivePanelHeight] = useState<number>();

  useEffect(() => {
    if (!showStudentWeb || !name.trim()) return;
    if (!window.electronAPI?.getCalendarSchedules) {
      setScheduleError('أعد تشغيل تطبيق الكمبيوتر لتفعيل التحديث التلقائي من Google Calendar.');
      return;
    }
    let cancelled = false;
    let running = false;
    const refresh = async (force = false) => {
      if (running) return;
      running = true;
      setScheduleLoading(true);
      setScheduleError('');
      try {
        const id = student?.id || 'draft';
        const result = await window.electronAPI!.getCalendarSchedules!([{ id, name }], force);
        if (cancelled) return;
        const schedule = result.schedules[id];
        if (!result.available || !isCurrentSchedule(schedule, name)) {
          setScheduleError(result.error || 'تعذّر تحديث جدول الأسبوع الحالي. أعد المحاولة.');
          return;
        }
        setCalendarSchedule(schedule);
        setScheduleMessage(schedule.message);
      } catch {
        if (!cancelled) setScheduleError('تعذّر الاتصال بالتقويم. أعد المحاولة.');
      } finally {
        running = false;
        if (!cancelled) setScheduleLoading(false);
      }
    };
    const start = window.setTimeout(() => void refresh(true), 300);
    const timer = window.setInterval(() => void refresh(), 60000);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);
    return () => {
      cancelled = true;
      window.clearTimeout(start);
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onFocus);
    };
  }, [showStudentWeb, name, student?.id, scheduleRefresh]);

  useLayoutEffect(() => {
    const panel = showStudentWeb ? studentWebPanelRef.current : mainPanelRef.current;
    if (!panel) return;
    const measure = () => setActivePanelHeight(panel.offsetHeight);
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(panel);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [showStudentWeb]);

  useEffect(() => {
    if (!shortcutApplied) return;
    const timer = window.setTimeout(() => setShortcutApplied(false), 2500);
    return () => window.clearTimeout(timer);
  }, [shortcutApplied]);

  useEffect(() => {
    setShortcutMatches([]);
    setReadingMatches([]);
    setMissingReadingMatches([]);
    setFolderHint('');
    setShortcutAvailable(null);
    setShortcutCollapsed(shortcutNotRequired);
    if (shortcutNotRequired) return;
    if (!window.electronAPI?.getShortcutLinks || name.trim().length < 2) {
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const result = await window.electronAPI!.getShortcutLinks!([{ id: 'current', name }]);
        if (cancelled) return;
        setShortcutAvailable(result.available);
        const matches = result.matches.current || [];
        const readings = result.readingMatches?.current || [];
        const missing = result.missingReadingMatches?.current || [];
        setShortcutMatches(matches);
        setReadingMatches(readings);
        setMissingReadingMatches(missing);
        setFolderHint(result.folderHints?.current?.[0] || '');
        if (result.available) setShortcutCollapsed(shortcutIsComplete(matches.length ? matches : readings, readings, missing, {
          shortcutId: shortcutSourceId, readingId: readingShortcutSourceId, zoom: zoomLink,
          quran: quranLink, reading: readingLink, acknowledged: acknowledgedMissingReadingIds,
        }));
      } catch {
        if (!cancelled) setShortcutAvailable(false);
      }
    }, 300);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [name, shortcutNotRequired]);

  const calculatePortion = (plan: StudyPlan) => {
    if (!plan.from || !plan.to || !plan.totalClasses) return 0;
    const amount = Math.abs(plan.to - plan.from) + (plan.targetType === 'pages' ? 0 : 1);
    let portion = amount / plan.totalClasses;
    if (plan.targetType === 'pages') {
      portion = Math.round(portion * 4) / 4;
    } else {
      portion = Math.round(portion);
    }
    return portion;
  };

  // Intercept ALL wheel events while modal is open and redirect to the form
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (formRef.current) {
        formRef.current.scrollTop += e.deltaY;
      }
    };
    document.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      document.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Calculate total classes from start and end dates
  useEffect(() => {
    if (studyPlan.startDate && studyPlan.endDate && selectedDays.length > 0) {
      const start = new Date(studyPlan.startDate);
      const end = new Date(studyPlan.endDate);
      let count = 0;
      let current = new Date(start);
      while (current <= end) {
        if (selectedDays.includes(current.getDay())) {
          count++;
        }
        current.setDate(current.getDate() + 1);
      }
      setStudyPlan(prev => {
        if (prev.totalClasses === count) return prev;
        const next = { ...prev, totalClasses: count };
        next.portionPerClass = calculatePortion(next);
        return next;
      });
    }
  }, [studyPlan.startDate, studyPlan.endDate, selectedDays]);

  // Update dayStartDates automatically when selectedDays changes
  useEffect(() => {
    setDayStartDates(prev => {
      const next = { ...prev };
      let changed = false;
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      selectedDays.forEach(dayId => {
        // If it's a new day (not in original student and not in prev state)
        const wasOriginallyPresent = student?.days?.includes(dayId);
        if (!next[dayId] && (!student || !wasOriginallyPresent)) {
          next[dayId] = todayStr;
          changed = true;
        }
      });

      // Cleanup removed days
      Object.keys(next).forEach(dayIdStr => {
        const dayId = parseInt(dayIdStr);
        if (!selectedDays.includes(dayId)) {
          delete next[dayId];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [selectedDays, student]);

  // Sync rate and basis when academy or duration changes, if using academy rate
  React.useEffect(() => {
    if (useAcademyRate && academyRates && academyRates[academy]) {
      const { rate: acRate, currency: acCurrency } = academyRates[academy];

      // Dynamic Calculation:
      const normalizedDuration = toWesternDigits(duration);

      let displayPrice = acRate;
      if (duration === 'خليط') {
        displayPrice = acRate;
      } else {
        // Proportional calculation: (minutes / 60) × hourly rate
        const mins = parseInt(normalizedDuration) || 30;
        displayPrice = (mins / 60) * acRate;
      }

      setRate(toHindiDigits(displayPrice.toString()));
      setCurrency(acCurrency);

      // Auto-set basis for Academy Rate
      if (normalizedDuration === '60' || duration === 'خليط') {
        setPaymentBasis('بالساعة');
      } else {
        setPaymentBasis('بالحصة');
      }
    }
  }, [academy, useAcademyRate, academyRates, duration]);

  // Auto-switch Payment Basis based on Duration (General Rule)
  React.useEffect(() => {
    const normalized = toWesternDigits(duration);
    if (normalized === '60' || duration === 'خليط') {
      setPaymentBasis('بالساعة');
    } else {
      // 30 min or custom duration → per-session
      setPaymentBasis('بالحصة');
    }
  }, [duration]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !academy || !rate) return;
    if (quranLink.trim() && !isDriveFileLink(quranLink)) {
      setQuranLinkError(true);
      setShowStudentWeb(true);
      return;
    }
    if (readingLink.trim() && !isDriveFileLink(readingLink)) {
      setReadingLinkError(true);
      setShowStudentWeb(true);
      return;
    }

    const savedStudent: Student = {
      ...student,
      id: student?.id || Date.now().toString(),
      name,
      academy,
      targetAge: studentTargetAge,
      location: currency,
      rate: Number(toWesternDigits(rate).replace(',', '.')),
      duration,
      paymentBasis,
      useAcademyRate,
      externalLink,
      color,
      disableReport,
      whatsappNumber: whatsappNumber, // Store as is (number or group name)
      zoomLink,
      quranLink: quranLink.trim(),
      readingLink: readingLink.trim(),
      shortcutSourceId: shortcutSourceId || undefined,
      readingShortcutSourceId: readingShortcutSourceId || undefined,
      acknowledgedMissingReadingIds: acknowledgedMissingReadingIds.length ? acknowledgedMissingReadingIds : undefined,
      shortcutNotRequired,
      shortcutAutoMatchDisabled: shortcutSourceId || readingShortcutSourceId ? false : (student?.shortcutAutoMatchDisabled ?? !student),
      scheduleMessage: calendarSchedule && !isCurrentSchedule(calendarSchedule, name) ? '' : scheduleMessage,
      calendarSchedule: isCurrentSchedule(calendarSchedule, name) ? calendarSchedule : undefined,
      deletedAt: isEndingEnrollment ? (() => {
        let dMonth = currentMonth + 1;
        let dYear = currentYear;
        if (dMonth > 11) {
          dMonth = 0;
          dYear++;
        }
        return { month: dMonth, year: dYear };
      })() : undefined,
      days: isEndingEnrollment ? [] : selectedDays,
      dayStartDates: isEndingEnrollment ? {} : dayStartDates,
      studyPlan: studyPlan
    };

    if (name && students) {
      const isDuplicate = students.some(s =>
        s.name.trim() === name.trim() && s.id !== student?.id
      );
      if (isDuplicate) {
        if (showToast) {
          showToast('⚠️ هذا الاسم موجود مسبقاً لطالب آخر!');
        } else {
          alert('⚠️ هذا الاسم موجود مسبقاً لطالب آخر!');
        }
        return;
      }
    }

    onSave(savedStudent);
  };

  const filteredAcademies = academies.filter(ac =>
    ac.toLowerCase().includes(academy.toLowerCase()) && ac !== academy
  );
  const primaryShortcutMatches = shortcutMatches.length ? shortcutMatches : readingMatches;
  const shortcutLinked = primaryShortcutMatches.length === 1
    ? (shortcutSourceId === primaryShortcutMatches[0].id || readingShortcutSourceId === primaryShortcutMatches[0].id)
    : shortcutAvailable !== true && !!(shortcutSourceId || readingShortcutSourceId);
  const shortcutStatus = shortcutNotRequired ? '' : primaryShortcutMatches.length > 1 ? 'توجد عدة ملفات مطابقة تحتاج مراجعة'
    : shortcutLinked ? 'تم ربط ملف الطالب'
      : primaryShortcutMatches.length === 1 ? 'يوجد ملف مطابق يحتاج مراجعة'
        : (shortcutSourceId || readingShortcutSourceId) && shortcutAvailable === true ? 'الملف المرتبط يحتاج مراجعة' : '';

  const inputClasses = "w-full px-10 py-2 bg-gray-50 text-gray-900 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-[#ffe05d] focus:bg-white transition-all placeholder-gray-400 text-right text-[25px]";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 font-arabic"
      onClick={onClose}
    >
      <div
        className="student-modal-card bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* === Sliding container (2 panels side by side) === */}
        <div
          className="flex items-start transition-[transform,height] duration-300 ease-in-out will-change-transform"
          style={{ transform: showStudentWeb ? 'translateX(100%)' : 'translateX(0)', height: activePanelHeight }}
        >

          {/* ─────── Panel 0: Main form ─────── */}
          <section ref={mainPanelRef} className="w-full flex-shrink-0">

            {/* Header */}
            <div className="relative p-6 text-center border-b border-gray-100">
              <button onClick={onClose} className="absolute left-6 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                <X size={24} />
              </button>
              <h2 className="text-3xl font-arabic text-gray-800 pt-2">{student ? 'تعديل بيانات الطالب' : 'إضافة طالب'}</h2>
              <button
                type="button"
                onClick={() => setShowStudentWeb(true)}
                title={shortcutStatus || 'واجهة الطالب'}
                aria-label={shortcutStatus ? `واجهة الطالب — ${shortcutStatus}` : 'واجهة الطالب'}
                className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-base font-bold text-gray-500 hover:text-amber-600 hover:bg-amber-50 px-4 py-2 rounded-xl transition-all border border-transparent hover:border-amber-200 group shadow-sm bg-gray-50"
              >
                {shortcutStatus && <Link aria-hidden="true" size={13} strokeWidth={2.5} className={`pointer-events-none absolute -left-1 -top-1 z-10 rounded-sm bg-white ${shortcutLinked ? 'text-emerald-600' : 'text-amber-500'}`} />}
                <span className="font-arabic">واجهة الطالب</span>
                <ChevronLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
              </button>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto overscroll-contain max-h-[calc(95vh-90px)]">
              <div className="space-y-2">
                <label className="block text-2xl font-bold text-gray-600 pr-1">اسم الطالب</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => { setName(toHindiDigits(e.target.value)); setShortcutSourceId(''); setReadingShortcutSourceId(''); }}
                  className={`${inputClasses} ${/[a-zA-Z]/.test(name) ? 'font-english text-lg' : 'font-arabic text-[25px]'}`}
                  placeholder=""
                />
              </div>

              <div className="space-y-2 relative">
                <label className="block text-2xl font-bold text-gray-600 pr-1">الأكاديمية</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={academy}
                    onChange={e => {
                      setAcademy(toHindiDigits(e.target.value));
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    className={`${inputClasses} ${/[a-zA-Z]/.test(academy) ? 'font-english text-xl' : 'font-arabic text-[25px]'}`}
                    placeholder=""
                    autoComplete="off"
                  />
                  {showSuggestions && filteredAcademies.length > 0 && (
                    <div className="absolute top-full right-0 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto">
                      {filteredAcademies.map(ac => (
                        <div
                          key={ac}
                          onClick={() => {
                            setAcademy(ac);
                            setShowSuggestions(false);
                          }}
                          className={`px-6 py-4 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-none text-gray-700 transition-colors text-right text-[22px] ${/[a-zA-Z]/.test(ac) ? 'font-english' : 'font-arabic'}`}
                        >
                          {ac}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-2xl font-bold text-gray-600 pr-1">زمن الحصة</label>
                <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100">
                  {['٣٠', '٦٠', 'خليط'].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDuration(d)}
                      className={`flex-1 py-1 rounded-lg text-2xl transition-all ${duration === d
                        ? 'bg-white text-gray-800 shadow-sm font-bold border border-gray-100'
                        : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                      {d}
                    </button>
                  ))}
                  {/* Custom duration button */}
                  <button
                    type="button"
                    onClick={() => { if (['٣٠', '٦٠', 'خليط'].includes(duration)) setDuration(''); }}
                    className={`flex-1 py-1 rounded-lg text-xl transition-all ${!['٣٠', '٦٠', 'خليط'].includes(duration)
                      ? 'bg-white text-gray-800 shadow-sm font-bold border border-gray-100'
                      : 'text-gray-400 hover:text-gray-600'
                      }`}
                  >
                    ✏️
                  </button>
                </div>
                {/* Custom duration input */}
                {!['٣٠', '٦٠', 'خليط'].includes(duration) && (
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    value={duration}
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9٠-٩]/g, '');
                      setDuration(toHindiDigits(val));
                    }}
                    placeholder=""
                    className="w-full px-4 py-2 bg-gray-50 border-2 border-[#ffe05d] rounded-xl text-center text-2xl font-arabic focus:outline-none placeholder-gray-200"
                  />
                )}
              </div>

              <div className="row flex gap-4">
                <div className={`space-y-2 flex-1 transition-all duration-300 ${useAcademyRate ? 'opacity-60' : ''}`}>
                  <label className="block text-2xl font-bold text-gray-600 pr-1">
                    {useAcademyRate ? (duration === 'خليط' ? 'سعر الساعة (محسوب)' : 'سعر الحصة (محسوب)') : 'السعر'}
                  </label>
                  <input
                    type="text"
                    required
                    inputMode="decimal"
                    value={rate}
                    readOnly={useAcademyRate}
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9٠-٩.]/g, '');
                      setRate(toHindiDigits(val));
                    }}
                    className={`${inputClasses} text-center ${useAcademyRate ? 'border-red-300 bg-red-50/50' : ''}`}
                    placeholder="٠"
                  />
                </div>

                <div className={`space-y-2 flex-1 transition-all duration-300 ${useAcademyRate ? 'opacity-60' : ''}`}>
                  <label className="block text-2xl font-bold text-gray-600 pr-1">العملة</label>
                  <select
                    value={currency}
                    disabled={useAcademyRate}
                    onChange={e => setCurrency(e.target.value)}
                    className={`${inputClasses} text-center text-2xl px-6 py-3 appearance-none cursor-pointer leading-relaxed ${useAcademyRate ? 'border-red-300 bg-red-50/50' : ''}`}
                    style={{ textAlignLast: 'center' }}
                  >
                    <option value="جنيه">جنيه</option>
                    <option value="دولار">دولار</option>
                    <option value="يورو">يورو</option>
                  </select>
                </div>

                <div className={`space-y-2 flex-1 ${useAcademyRate ? 'opacity-60' : ''}`}>
                  <label className="block text-2xl font-bold text-gray-600 pr-1">النظام</label>
                  <select
                    value={duration === 'خليط' ? 'بالساعة' : paymentBasis}
                    disabled={useAcademyRate || duration === 'خليط'}
                    onChange={e => setPaymentBasis(e.target.value)}
                    className={`${inputClasses} text-center text-2xl px-6 py-3 appearance-none cursor-pointer leading-relaxed ${useAcademyRate ? 'border-red-300 bg-red-50/50' : ''}`}
                    style={{ textAlignLast: 'center' }}
                  >
                    <option value="بالحصة">بالحصة</option>
                    <option value="بالساعة">بالساعة</option>
                  </select>
                </div>
              </div>

              {academy && academyRates && academyRates[academy] && (
                <div className="flex flex-col gap-2">
                  <div className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${useAcademyRate ? 'bg-red-50/50 border-red-300/30' : 'bg-gray-50/50 border-gray-100'}`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="useAcademyRate"
                        checked={useAcademyRate}
                        onChange={e => setUseAcademyRate(e.target.checked)}
                        className="w-5 h-5 accent-red-500 cursor-pointer"
                      />
                      <label htmlFor="useAcademyRate" className="text-xl font-bold text-gray-700 cursor-pointer select-none">
                        اتباع سعر الأكاديمية
                      </label>
                    </div>
                  </div>
                </div>
              )}


              <div className="space-y-2">
                <label className="block text-2xl font-bold text-gray-600 pr-1">الأيام</label>
                <div className="student-modal-days-row flex flex-nowrap gap-1.5 overflow-x-auto justify-center bg-gray-50 p-2 rounded-xl border border-gray-100 no-scrollbar">
                  {[...DAYS_OF_WEEK].sort((a, b) => (a.id === 6 ? -1 : b.id === 6 ? 1 : a.id - b.id)).filter(d => d.id !== 5).map((day) => {
                    const occurrences = selectedDays.filter(d => d === day.id).length;
                    const isSelected = occurrences > 0;
                    const isDouble = occurrences === 2;

                    const academyHolidays = academyRates?.[academy]?.holidays || [];
                    const isHoliday = academyHolidays.includes(day.id);

                    return (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => {
                          setSelectedDays(prev => {
                            if (duration === 'خليط') {
                              // Triple toggle: 0 -> 1 -> 2 -> 0
                              if (occurrences === 0) return [...prev, day.id];
                              if (occurrences === 1) return [...prev, day.id];
                              return prev.filter(d => d !== day.id);
                            } else {
                              // Normal toggle
                              return prev.includes(day.id)
                                ? prev.filter(d => d !== day.id)
                                : [...prev, day.id];
                            }
                          });
                        }}
                        className={`relative px-3.5 py-2.5 rounded-xl text-[22px] font-neirizi transition-all whitespace-nowrap min-w-[65px] flex flex-col items-center justify-center ${isSelected
                          ? `bg-[#ffe05d] text-gray-900 shadow-sm ${isDouble ? 'ring-2 ring-gray-900 ring-offset-2' : ''}`
                          : 'bg-white text-gray-500 border border-gray-200 hover:border-[#ffe05d] hover:text-gray-900'
                          } ${isHoliday ? 'opacity-40 grayscale-[0.8] saturate-50' : ''}`}
                        title={isHoliday ? 'هذا اليوم أجازة للأكاديمية' : undefined}
                      >
                        {day.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-8 mt-4 border-t border-gray-100 flex flex-col gap-6">
                <div className="flex items-center gap-4">
                  <label className="text-lg font-medium text-gray-400 flex items-center gap-2 whitespace-nowrap font-neirizi w-32">
                    <Link size={18} className="text-gray-300" />
                    رابط خارجي
                  </label>
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={externalLink}
                      onChange={e => setExternalLink(e.target.value)}
                      className={`${inputClasses} py-1.5 px-4 !text-sm border-gray-200 focus:border-gray-300 bg-white text-left font-english ${isValidUrl(externalLink) ? 'text-gray-900 pr-10' : 'text-gray-400'}`}
                      dir="ltr"
                      placeholder=""
                    />
                    {isValidUrl(externalLink) && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 animate-in fade-in zoom-in slide-in-from-right-2 duration-300">
                        <div className="bg-emerald-100 text-emerald-600 rounded-full p-1 shadow-sm border border-emerald-200">
                          <Check size={12} strokeWidth={4} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <label className="text-lg font-medium text-gray-400 flex items-center gap-2 whitespace-nowrap font-neirizi w-32">
                    <Phone size={18} className="text-gray-300" />
                    رقم واتساب / اسم المجموعة
                  </label>
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={whatsappNumber}
                      onChange={e => setWhatsappNumber(e.target.value)}
                      className={`${inputClasses} py-1.5 px-4 !text-sm border-gray-200 focus:border-gray-300 bg-white text-left font-english ${whatsappNumber.length > 2 ? 'text-gray-900 pr-10' : 'text-gray-400'}`}
                      dir="ltr"
                      placeholder=""
                    />
                    {whatsappNumber.length > 2 && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 animate-in fade-in zoom-in slide-in-from-right-2 duration-300">
                        <div className="bg-green-100 text-green-600 rounded-full p-1 shadow-sm border border-green-200">
                          <Check size={12} strokeWidth={4} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <label className="text-lg font-medium text-gray-400 w-32">خيارات إضافية</label>
                  <div className="flex-1 flex items-center justify-between">
                    {/* Student Color */}
                    <div className="flex items-center gap-2">
                      <div className="flex justify-center gap-1.5 bg-gray-50 p-1.5 rounded-lg border border-gray-100/50">
                        {[
                          { id: '', bg: 'bg-white', border: 'border-gray-200' },
                          { id: 'red', bg: 'bg-rose-100', border: 'border-rose-400' },
                          { id: 'orange', bg: 'bg-orange-100', border: 'border-orange-400' },
                          { id: 'green', bg: 'bg-emerald-100', border: 'border-emerald-400' },
                          { id: 'blue', bg: 'bg-blue-100', border: 'border-blue-400' },
                          { id: 'purple', bg: 'bg-violet-100', border: 'border-violet-400' },
                        ].map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setColor(c.id)}
                            className={`w-8 h-8 rounded-full border transition-all duration-200 flex items-center justify-center ${c.bg
                              } ${c.border} ${color === c.id
                                ? 'ring-2 ring-offset-1 ring-gray-300 scale-110 shadow-sm'
                                : 'hover:scale-105 opacity-60 hover:opacity-100'
                              }`}
                            title={c.id || 'افتراضي'}
                          >
                            {color === c.id && <Check size={14} className={`stroke-[3px] ${c.id ? 'text-gray-600' : 'text-gray-400'}`} />}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Disable Report */}
                    <div className="flex items-center gap-2 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer" onClick={() => setDisableReport(!disableReport)}>
                      <input
                        type="checkbox"
                        id="disableReport"
                        checked={disableReport}
                        onChange={e => setDisableReport(e.target.checked)}
                        className="w-4 h-4 accent-gray-500 cursor-pointer"
                      />
                      <label htmlFor="disableReport" className="text-base text-gray-500 cursor-pointer select-none">
                        تعطيل التقرير
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 mt-4 border-t border-gray-100 flex items-stretch gap-3">
                {student && (onDelete || onEndEnrollment) ? (
                  <div className="flex w-full gap-3">
                    <button
                      type="submit"
                      className="flex-[2] py-3 bg-[#ffe05d] text-gray-900 text-xl font-bold font-arabic rounded-xl hover:bg-[#fcd030] hover:shadow-lg hover:shadow-[#ffe05d]/20 active:scale-[0.98] transition-all pb-3.5"
                    >
                      تعديل
                    </button>

                    {/* End Enrollment Toggle */}
                    <button
                      type="button"
                      onClick={() => setIsEndingEnrollment(!isEndingEnrollment)}
                      className={`w-14 rounded-xl transition-all flex items-center justify-center border ${isEndingEnrollment
                        ? 'bg-red-500 text-white border-red-600 hover:bg-red-600 shadow-md ring-2 ring-red-200'
                        : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100'
                        }`}
                      title={isEndingEnrollment ? "تراجع عن إنهاء الاشتراك" : "حذف ما تبقى (إنهاء الاشتراك)"}
                    >
                      {isEndingEnrollment ? <X size={22} strokeWidth={2.5} /> : <Clock size={22} strokeWidth={2} />}
                    </button>

                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => {
                          onDelete(student.id);
                          onClose();
                        }}
                        className="w-14 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-all flex items-center justify-center border border-red-100"
                        title="حذف الطالب نهائياً"
                      >
                        <Trash2 size={22} strokeWidth={2} />
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="submit"
                    className="w-full py-3 bg-[#ffe05d] text-gray-900 text-2xl font-arabic rounded-xl hover:bg-[#fcd030] hover:shadow-lg hover:shadow-[#ffe05d]/20 active:scale-[0.98] transition-all pb-4"
                  >
                    حفظ
                  </button>
                )}
              </div>
            </form>
          </section>
          {/* ─── End Panel 0 ─── */}

          {/* ─── Panel 1: واجهة الطالب ─── */}
          <section ref={studentWebPanelRef} className="w-full flex-shrink-0">
            <div className="relative p-6 text-center border-b border-gray-100">
              <button
                type="button"
                onClick={() => setShowStudentWeb(false)}
                className="absolute right-6 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                title="رجوع"
              >
                <ChevronLeft size={24} style={{ transform: 'scaleX(-1)' }} />
              </button>
              <h2 className="text-3xl font-arabic text-gray-800 pt-2">واجهة الطالب</h2>
            </div>

            <div className="p-8 space-y-6 overflow-y-auto overscroll-contain max-h-[calc(95vh-90px)]">
              <div className={`space-y-3 rounded-2xl border p-4 transition-colors duration-500 ${shortcutApplied ? 'border-emerald-400 bg-emerald-100' : 'border-emerald-100 bg-emerald-50/50'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xl font-bold text-gray-700">الربط بملفات الطالب</h3>
                    {(shortcutCollapsed || shortcutSourceId || readingShortcutSourceId || shortcutNotRequired) && <button type="button" onClick={() => setShortcutCollapsed(value => !value)} className="inline-flex items-center gap-1 text-base font-bold text-emerald-700" aria-expanded={!shortcutCollapsed}>
                      {shortcutCollapsed ? (shortcutNotRequired ? 'لا يحتاج اختصارات' : 'تم الربط') : 'إخفاء'}
                      <ChevronDown size={16} className={shortcutCollapsed ? '' : 'rotate-180'} />
                    </button>}
                  </div>
                  {!shortcutCollapsed && <>
                  <label className="flex items-center gap-2 text-base text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={shortcutNotRequired} onChange={e => setShortcutNotRequired(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
                    لا يحتاج اختصارات
                  </label>
                  {shortcutNotRequired ? <p className="text-sm text-gray-500">الربط التلقائي وتنبيهاته متوقفان لهذا الطالب.</p> : <>
                  <p className="text-base text-gray-600">اختر ملف الطالب المطابق لتحديث الروابط، سواء كان مصحفًا أو كتاب قراءة.</p>
                  {!window.electronAPI?.getShortcutLinks && <p className="text-sm text-gray-500">الربط التلقائي متاح من تطبيق الكمبيوتر.</p>}
                  {shortcutAvailable === false && <p className="text-sm text-red-600">تعذرت قراءة ملف الاختصارات من iCloud.</p>}
                  {shortcutAvailable === true && primaryShortcutMatches.length === 0 && <p className="text-sm text-amber-700">لم نجد اختصارًا لملف مصحف أو قراءة موجود مباشرة داخل مجلد مطابق لاسم الطالب. راجع الاسم والمسار المحفوظ في الاختصارات.</p>}
                  {shortcutAvailable === true && primaryShortcutMatches.length === 0 && folderHint && <p className="text-sm text-amber-700">وجدنا ملفًا باسم الطالب داخل مجلد «{folderHint}»، لكن اسم المجلد مختلف. راجع الاسم والمسار؛ لم يتم الربط تلقائيًا.</p>}
                  {primaryShortcutMatches.length > 1 && <p className="text-sm text-amber-700">يوجد أكثر من ملف مطابق داخل المجلد، لذلك لم نختَر ملفًا تلقائيًا. راجع الاختصارات.</p>}
                  {primaryShortcutMatches.length === 1 && primaryShortcutMatches.map(match => {
                    const zoomDifferent = !!(zoomLink && match.zoomLink && !linksEquivalent(zoomLink, match.zoomLink, 'zoom'));
                    const quranDifferent = !!(quranLink && match.quranLink && !linksEquivalent(quranLink, match.quranLink, 'quran'));
                    const readingCandidates = readingMatches.filter(item => item.folderId === match.folderId);
                    const reading = readingCandidates.length === 1 ? readingCandidates[0] : undefined;
                    const missingReading = missingReadingMatches.filter(item => item.folderId === match.folderId && !acknowledgedMissingReadingIds.includes(item.id));
                    const readingDifferent = !!(readingLink && reading?.readingLink && !linksEquivalent(readingLink, reading.readingLink, 'quran'));
                    const readingAvailable = !!(reading?.readingLink && !reading.readingConflict && !reading.readingLinkInvalid);
                    return (
                      <div key={match.id} className="rounded-xl bg-white border border-gray-200 p-4 space-y-2">
                        <p className="text-sm text-gray-600">{match.isReading ? 'كتاب القراءة' : 'المصحف'}</p>
                        <p className="text-base font-bold text-gray-800 break-all" dir="auto">{match.path}</p>
                        <p className="text-base text-gray-600 flex flex-wrap gap-x-2 gap-y-1">
                          <span>{match.exact ? 'مجلد مطابق' : 'يحتاج مراجعة'}</span>
                          <span className={match.zoomLink && !zoomDifferent && !match.zoomConflict ? 'text-emerald-700' : 'text-amber-700'}>{isGoogleMeetLink(match.zoomLink) ? 'Google Meet' : 'زوم'}: {zoomDifferent ? 'مختلف' : match.zoomLink ? 'متاح' : 'غير متاح'}</span>
                          <span className={match.quranLink && !quranDifferent ? 'text-emerald-700' : 'text-amber-700'}>المصحف: {quranDifferent ? 'مختلف' : match.quranLink ? 'متاح' : 'غير متاح'}</span>
                          <span className={readingAvailable && !readingDifferent ? 'text-emerald-700' : 'text-amber-700'}>كتاب القراءة: {readingDifferent ? 'مختلف' : readingAvailable ? 'متاح' : 'غير متاح'}</span>
                        </p>
                        {(zoomDifferent || quranDifferent) && <p className="text-base text-amber-700">{zoomDifferent && quranDifferent ? 'رابطا الحصة والمصحف مختلفان' : zoomDifferent ? 'رابط الحصة مختلف' : 'رابط المصحف مختلف'} عن المحفوظ.</p>}
                        {reading && reading.id !== match.id && <p className="text-sm text-gray-600 break-all" dir="auto">كتاب القراءة: {reading.path}</p>}
                        {readingDifferent && <p className="text-base text-amber-700">رابط كتاب القراءة مختلف عن المحفوظ.</p>}
                        {readingDifferent && <p className="text-xs text-gray-500 break-all" dir="ltr">Drive: {reading?.readingLink}</p>}
                        {readingCandidates.length > 1 && <p className="text-base text-amber-700">يوجد أكثر من كتاب قراءة في المجلد؛ راجع الاختصارات قبل الربط.</p>}
                        {match.isReading && match.zoomConflict && <p className="text-base text-amber-700">توجد روابط زوم مختلفة لنفس الملف في الاختصارات؛ راجعها أولًا.</p>}
                        {reading?.readingConflict && <p className="text-base text-amber-700">توجد روابط مختلفة لكتاب القراءة في الاختصارات؛ راجعها أولًا.</p>}
                        {reading?.readingLinkInvalid && <p className="text-base text-amber-700">رابط Google Drive المحفوظ لكتاب القراءة غير صالح.</p>}
                        {missingReading.length > 0 && <p className="text-base text-amber-700">يوجد كتاب قراءة محفوظ في الاختصارات لكن الملف غير موجود في المسار المسجل.</p>}
                        {readingShortcutSourceId && reading?.id !== readingShortcutSourceId && !acknowledgedMissingReadingIds.includes(readingShortcutSourceId) && <p className="text-base text-amber-700">تعذر العثور على كتاب القراءة المرتبط سابقًا في مساره؛ راجع الملف قبل تحديث الرابط.</p>}
                        {reading && !reading.readingLink && !reading.readingConflict && !reading.readingLinkInvalid && <p className="text-sm text-gray-500">لا يوجد رابط Google Drive محفوظ لكتاب القراءة بعد.</p>}
                        {(!match.isReading && match.conflict) ? <p className="text-base text-amber-700">توجد روابط مختلفة لنفس الملف في الاختصارات؛ راجعها أولًا.</p> : (
                          <button type="button" onClick={() => {
                            setShortcutSourceId(match.isReading ? '' : match.id);
                            if (match.isReading) setReadingShortcutSourceId(match.id);
                            if (match.zoomLink) setZoomLink(match.zoomLink);
                            if (match.quranLink) { setQuranLink(match.quranLink); setQuranLinkError(false); }
                            if (reading && !reading.readingConflict) {
                              setReadingShortcutSourceId(reading.id);
                              if (reading.readingLink && !reading.readingLinkInvalid) { setReadingLink(reading.readingLink); setReadingLinkError(false); }
                            }
                            const reviewedIds = [...missingReading.map(item => item.id), ...(!reading && readingShortcutSourceId ? [readingShortcutSourceId] : [])];
                            if (reviewedIds.length) {
                              setAcknowledgedMissingReadingIds(previous => [...new Set([...previous, ...reviewedIds])]);
                              if (student?.id) onAcknowledgeMissingReading?.(student.id, reviewedIds);
                            }
                            const hasUnresolvedIssue = match.conflict || match.zoomConflict || !match.zoomLink ||
                              (match.isQuran && !match.quranLink) || readingCandidates.length > 1 ||
                              !!(reading && (reading.readingConflict || reading.readingLinkInvalid || !reading.readingLink));
                            setShortcutCollapsed(!hasUnresolvedIssue);
                            setShortcutApplied(true);
                          }} className="rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-base font-bold">
                            استخدام روابط هذا الملف
                          </button>
                        )}
                      </div>
                    );
                  })}
                  </>}
                  </>}
              </div>
              {/* Zoom Link */}
              <div className="space-y-2">
                <label className="block text-xl font-bold text-gray-600 flex items-center gap-2">
                  <Link size={18} className="text-gray-400" />
                  {isGoogleMeetLink(zoomLink) ? 'رابط Google Meet' : 'رابط زوم'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={zoomLink}
                    onChange={e => setZoomLink(e.target.value)}
                    className={`w-full px-4 py-2.5 bg-gray-50 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-[#ffe05d] focus:bg-white transition-all text-sm font-english text-left ${isValidUrl(zoomLink) ? 'text-gray-900 pr-10' : 'text-gray-400'}`}
                    dir="ltr"
                  />
                  {isValidUrl(zoomLink) && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="bg-emerald-100 text-emerald-600 rounded-full p-1 border border-emerald-200">
                        <Check size={12} strokeWidth={4} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Quran file link */}
              <div className="space-y-2">
                <label htmlFor="quran-link" className="block text-xl font-bold text-gray-600 flex items-center gap-2">
                  <Link size={18} className="text-gray-400" />
                  رابط المصحف
                </label>
                <input
                  id="quran-link"
                  type="url"
                  value={quranLink}
                  onChange={e => { setQuranLink(e.target.value); setQuranLinkError(false); }}
                  aria-invalid={quranLinkError}
                  aria-describedby={quranLinkError ? 'quran-link-error' : undefined}
                  placeholder="https://drive.google.com/file/d/.../view"
                  className="w-full px-4 py-2.5 bg-gray-50 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-[#ffe05d] focus:bg-white transition-all text-sm font-english text-left"
                  dir="ltr"
                />
                {quranLinkError && <p id="quran-link-error" className="text-sm text-red-600" role="alert">أدخل رابط ملف صالحًا من Google Drive.</p>}
              </div>

              <div className="space-y-2">
                <label htmlFor="reading-link" className="block text-xl font-bold text-gray-600 flex items-center gap-2">
                  <Link size={18} className="text-gray-400" />
                  رابط كتاب القراءة
                </label>
                <input
                  id="reading-link" type="url" value={readingLink}
                  onChange={e => { setReadingLink(e.target.value); setReadingLinkError(false); }}
                  aria-invalid={readingLinkError} aria-describedby={readingLinkError ? 'reading-link-error' : undefined}
                  placeholder="https://drive.google.com/file/d/.../view"
                  className="w-full px-4 py-2.5 bg-gray-50 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-[#ffe05d] focus:bg-white transition-all text-sm font-english text-left" dir="ltr"
                />
                {readingLinkError && <p id="reading-link-error" className="text-sm text-red-600" role="alert">أدخل رابط ملف صالحًا من Google Drive.</p>}
              </div>

              {/* Schedule Message */}
              <div className="space-y-2">
                <label htmlFor="student-schedule" className="block text-xl font-bold text-gray-600 flex items-center gap-2">
                  <span>🕒</span>
                  جدول الأسبوع الحالي (من Google Calendar)
                </label>
                <textarea
                  id="student-schedule"
                  value={calendarSchedule && !isCurrentSchedule(calendarSchedule, name) ? '' : scheduleMessage}
                  readOnly
                  aria-busy={scheduleLoading}
                  aria-describedby="student-schedule-status"
                  placeholder="يتم ملء المواعيد تلقائيًا حسب اسم الطالب في التقويم"
                  className="w-full px-4 py-2.5 bg-gray-50 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-[#ffe05d] focus:bg-white transition-all text-sm font-english text-left resize-y min-h-[130px]"
                  dir="ltr"
                  rows={5}
                />
                <div className="flex items-start justify-between gap-3 text-sm">
                  <p id="student-schedule-status" role="status" className={scheduleError ? 'text-amber-700' : 'text-emerald-700'}>
                    {scheduleLoading ? 'جاري قراءة مواعيد الأسبوع الحالي…' : scheduleError || (isCurrentSchedule(calendarSchedule, name)
                      ? `${calendarSchedule!.status === 'empty' ? 'لا توجد مواعيد بهذا الاسم هذا الأسبوع' : 'تم التحديث من التقويم'} · ${calendarSchedule!.weekStart} — ${calendarSchedule!.weekEnd}`
                      : 'من السبت إلى الجمعة بتوقيت القاهرة، وتُعرض الحصص بتوقيت الطالب.')}
                  </p>
                  <button type="button" disabled={scheduleLoading || !name.trim()} onClick={() => setScheduleRefresh(value => value + 1)} className="shrink-0 text-emerald-700 font-bold disabled:opacity-40">تحديث الآن</button>
                </div>
                <p className="text-xs text-gray-500">يتحدث تلقائيًا كل دقيقة أثناء تشغيل التطبيق، ويصل إلى واجهة الطالب بعد المزامنة.</p>
              </div>

              {/* Student Age Group */}
              <div className="space-y-2">
                <label className="block text-xl font-bold text-gray-600 font-arabic">فئة الطالب</label>
                <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100">
                  <button
                    type="button"
                    onClick={() => setStudentTargetAge('kids')}
                    className={`flex-1 py-2 rounded-lg text-lg font-arabic transition-all ${studentTargetAge === 'kids'
                      ? 'bg-white text-emerald-700 shadow-sm border border-emerald-200 font-bold'
                      : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    صغار
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudentTargetAge('adults')}
                    className={`flex-1 py-2 rounded-lg text-lg font-arabic transition-all ${studentTargetAge === 'adults'
                      ? 'bg-white text-emerald-700 shadow-sm border border-emerald-200 font-bold'
                      : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    كبار
                  </button>
                </div>
              </div>

              {/* Study Plan Section */}
              <div className="pt-6 mt-6 border-t border-gray-100">
                <h3 className="text-2xl font-bold text-gray-800 font-arabic mb-4">إعدادات الخطة</h3>
                <div className="flex items-center justify-between p-4 rounded-2xl border bg-gray-50/50 border-gray-100 mb-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="studyPlanActive"
                      checked={studyPlan.isActive}
                      onChange={e => setStudyPlan(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="w-5 h-5 accent-[#ffe05d] cursor-pointer"
                    />
                    <label htmlFor="studyPlanActive" className="text-xl font-bold text-gray-700 cursor-pointer select-none font-arabic">
                      تفعيل الخطة للطالب
                    </label>
                  </div>
                </div>

                {studyPlan.isActive && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    {/* Target Type */}
                    <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100">
                      <button
                        type="button"
                        onClick={() => {
                          setStudyPlan(prev => {
                            const next = { ...prev, targetType: 'pages' as const };
                            next.portionPerClass = calculatePortion(next);
                            return next;
                          });
                        }}
                        className={`flex-1 py-2 rounded-lg text-lg font-arabic transition-all ${studyPlan.targetType === 'pages'
                          ? 'bg-white text-emerald-700 shadow-sm border border-emerald-200 font-bold'
                          : 'text-gray-500 hover:text-gray-700'
                          }`}
                      >
                        صفحات
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setStudyPlan(prev => {
                            const next = { ...prev, targetType: 'verses' as const };
                            next.portionPerClass = calculatePortion(next);
                            return next;
                          });
                        }}
                        className={`flex-1 py-2 rounded-lg text-lg font-arabic transition-all ${studyPlan.targetType === 'verses'
                          ? 'bg-white text-emerald-700 shadow-sm border border-emerald-200 font-bold'
                          : 'text-gray-500 hover:text-gray-700'
                          }`}
                      >
                        آيات
                      </button>
                    </div>

                    {/* From - To */}
                    <div className="flex gap-4">
                      <div className="flex-1 space-y-2">
                        <label className="block text-lg font-bold text-gray-600 font-arabic">من</label>
                        <input
                          type="number"
                          value={studyPlan.from || ''}
                          onChange={e => {
                            const val = Number(e.target.value);
                            setStudyPlan(prev => {
                               const next = { ...prev, from: val };
                               next.portionPerClass = calculatePortion(next);
                               return next;
                            });
                          }}
                          className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#ffe05d] focus:bg-white transition-all text-center font-english"
                          dir="ltr"
                        />
                      </div>
                      <div className="flex-1 space-y-2">
                        <label className="block text-lg font-bold text-gray-600 font-arabic">إلى</label>
                        <input
                          type="number"
                          value={studyPlan.to || ''}
                          onChange={e => {
                            const val = Number(e.target.value);
                            setStudyPlan(prev => {
                               const next = { ...prev, to: val };
                               next.portionPerClass = calculatePortion(next);
                               return next;
                            });
                          }}
                          className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#ffe05d] focus:bg-white transition-all text-center font-english"
                          dir="ltr"
                        />
                      </div>
                    </div>

                    {/* Classes & Start Time */}
                    <div className="flex gap-4">
                      <div className="flex-1 space-y-2">
                        <label className="block text-lg font-bold text-gray-600 font-arabic whitespace-nowrap text-sm">عدد الحصص</label>
                        <input
                          type="number"
                          value={studyPlan.totalClasses || ''}
                          onChange={e => {
                            const val = Number(e.target.value);
                            setStudyPlan(prev => {
                               const next = { ...prev, totalClasses: val };
                               next.portionPerClass = calculatePortion(next);
                               return next;
                            });
                          }}
                          className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#ffe05d] focus:bg-white transition-all text-center font-english"
                          dir="ltr"
                        />
                      </div>
                      <div className="flex-1 space-y-2">
                        <label className="block text-lg font-bold text-gray-600 font-arabic whitespace-nowrap text-sm">المقدار للحصة</label>
                        <div className="w-full px-4 py-2 bg-gray-100 border border-transparent rounded-xl text-center text-gray-600 font-bold font-english h-[42px] flex items-center justify-center">
                          {studyPlan.portionPerClass || 0}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-4">
                      <div className="flex-1 space-y-2">
                        <label className="block text-lg font-bold text-gray-600 font-arabic whitespace-nowrap text-sm">تاريخ البدء</label>
                        <input
                          type="date"
                          value={studyPlan.startDate || ''}
                          onChange={e => setStudyPlan(prev => ({ ...prev, startDate: e.target.value }))}
                          className="w-full px-2 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#ffe05d] focus:bg-white transition-all text-center font-english text-sm"
                          dir="ltr"
                        />
                      </div>
                      <div className="flex-1 space-y-2">
                        <label className="block text-lg font-bold text-gray-600 font-arabic whitespace-nowrap text-sm">تاريخ الانتهاء</label>
                        <input
                          type="date"
                          value={studyPlan.endDate || ''}
                          onChange={e => setStudyPlan(prev => ({ ...prev, endDate: e.target.value }))}
                          className="w-full px-2 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#ffe05d] focus:bg-white transition-all text-center font-english text-sm"
                          dir="ltr"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Save */}
              <button
                type="button"
                onClick={() => handleSubmit({ preventDefault: () => { } } as React.FormEvent)}
                className="w-full py-3 bg-[#ffe05d] text-gray-900 text-xl font-bold font-arabic rounded-xl hover:bg-[#fcd030] hover:shadow-lg hover:shadow-[#ffe05d]/20 active:scale-[0.98] transition-all pb-4"
              >
                حفظ
              </button>
            </div>
          </section>
          {/* ─── End Panel 1 ─── */}

        </div>
        {/* === End sliding container === */}

      </div>
    </div>
  );
};

export default StudentModal;
