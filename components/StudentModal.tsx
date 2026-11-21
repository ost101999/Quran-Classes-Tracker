import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { X, Trash2, Clock, Link, Check, Phone, ChevronDown, ChevronUp, ChevronLeft, ArchiveRestore, FileText, FolderOpen, BookOpen, AlertTriangle, Loader2, Layers, SlidersHorizontal, Send, Minus, Plus } from 'lucide-react';
import { Student, StudyPlan, CalendarSchedule, StudentReportSettings, MushafSectionKey } from '../types';
import { DAYS_OF_WEEK } from '../constants';
import { linksEquivalent } from '../services/shortcutStudentSync';
import { whatsappTargetsEquivalent } from '../services/whatsappStudentSync';
import { isCurrentSchedule } from '../services/calendarStudentSync';
import { cairoDate, replaceScheduleFrom } from '../services/studentSchedule';
import { isStudentInactiveInMonth, isStudentPausedInMonth, nextMonthYear } from '../services/studentVisibility';
import {
  DEFAULT_MUSHAF_SECTION_ORDER,
  MUSHAF_SECTION_LABELS,
  normalizeSectionOrder,
  buildCustomMushafPlan,
} from '../services/quranPages';

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
  onReactivateStudent?: (student: Student) => void;
  prefillAcademy?: string;
  currentMonth: number;
  currentYear: number;
  onAssignTajweed?: () => void;
  students?: Student[];
  showToast?: (msg: string) => void;
  openStudentWebInitially?: boolean;
  onAcknowledgeMissingReading?: (studentId: string, ids: string[]) => void;
  dayTransitionTime?: string;
  lastReport?: any;
  lastReportLanguage?: 'ar' | 'en';
  onGenerateCustomMushafNow?: (studentDraft: Student) => Promise<void>;
}

// Convert Western numerals to Hindi numerals
const toHindiDigits = (str: string): string => {
  return str.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)]);
};

// Convert Hindi numerals back to Western for storage
const toWesternDigits = (str: string): string => {
  return str.toString().replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
};

const arabicCalendarDate = (value: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return toHindiDigits(value);
  return new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))));
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

const StudentModal: React.FC<Props> = ({ onClose, onSave, onDelete, onEndEnrollment, onReactivateStudent, academies, student, academyRates, prefillAcademy, currentMonth, currentYear, onAssignTajweed, students, showToast, openStudentWebInitially = false, onAcknowledgeMissingReading, dayTransitionTime = '00:00', lastReport, lastReportLanguage = 'ar', onGenerateCustomMushafNow }) => {
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
  const [whatsappSource, setWhatsappSource] = useState('');
  const [whatsappSourceAvailable, setWhatsappSourceAvailable] = useState<boolean | null>(null);
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
  useEffect(() => {
    setWhatsappSource('');
    setWhatsappSourceAvailable(null);
    if (!student || name !== student.name || !window.electronAPI?.getWhatsAppTargets) return;
    let cancelled = false;
    const refresh = async () => {
      const now = new Date();
      const requests = (students || []).filter(item => !isStudentInactiveInMonth(item, now.getMonth(), now.getFullYear())).map(({ id, name }) => ({ id, name }));
      try {
        const result = await window.electronAPI!.getWhatsAppTargets!(requests);
        if (!cancelled) { setWhatsappSourceAvailable(result.available); setWhatsappSource(result.available ? result.matches[student.id] || '' : ''); }
      } catch { if (!cancelled) { setWhatsappSourceAvailable(false); setWhatsappSource(''); } }
    };
    void refresh();
    const timer = window.setInterval(refresh, 60000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [student, students, name]);
  const [scheduleMessage, setScheduleMessage] = useState(student?.scheduleMessage || '');
  const [calendarSchedule, setCalendarSchedule] = useState<CalendarSchedule | undefined>(student?.calendarSchedule);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [scheduleRefresh, setScheduleRefresh] = useState(0);
  const [activePanel, setActivePanel] = useState<'main' | 'studentWeb' | 'reportSettings'>(openStudentWebInitially ? 'studentWeb' : 'main');
  const [lastSubPanel, setLastSubPanel] = useState<'studentWeb' | 'reportSettings'>('studentWeb');
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);
  const showStudentWeb = activePanel === 'studentWeb';
  const openSubPanel = (panel: 'studentWeb' | 'reportSettings') => {
    setHeaderMenuOpen(false);
    setLastSubPanel(panel);
    setActivePanel(panel);
  };

  useEffect(() => {
    if (!headerMenuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setHeaderMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHeaderMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [headerMenuOpen]);
  const [reportSettings, setReportSettings] = useState<StudentReportSettings>(() => ({
    customMushafEnabled: student?.reportSettings?.customMushafEnabled ?? false,
    mushafTargetSection: student?.reportSettings?.mushafTargetSection || 'reading',
    mushafSectionOrder: normalizeSectionOrder(student?.reportSettings?.mushafSectionOrder),
    mushafIncludedSections: {
      rev: student?.reportSettings?.mushafIncludedSections?.rev !== false,
      oldRev: student?.reportSettings?.mushafIncludedSections?.oldRev !== false,
      new: student?.reportSettings?.mushafIncludedSections?.new !== false,
      tilawa: student?.reportSettings?.mushafIncludedSections?.tilawa !== false,
    },
    mushafDividerStyle: student?.reportSettings?.mushafDividerStyle || 'page',
    mushafLanguage: student?.reportSettings?.mushafLanguage || 'auto',
    mushafPageOffset: student?.reportSettings?.mushafPageOffset ?? 0,
    mushafAutoOpen: student?.reportSettings?.mushafAutoOpen ?? false,
    mushafAutoSendWhatsapp: student?.reportSettings?.mushafAutoSendWhatsapp !== false,
  }));
  const [mushafFileStatus, setMushafFileStatus] = useState<{ found: boolean; fileName?: string; error?: string; outputDir?: string } | null>(null);
  const [mushafGeneratingNow, setMushafGeneratingNow] = useState(false);
  const [openReportGroups, setOpenReportGroups] = useState<Record<'sections' | 'format' | 'delivery' | 'preview', boolean>>({
    sections: true,
    format: false,
    delivery: false,
    preview: true,
  });
  const toggleReportGroup = (key: 'sections' | 'format' | 'delivery' | 'preview') => {
    setOpenReportGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };
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
  const reportSettingsPanelRef = useRef<HTMLElement>(null);
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
        const result = await window.electronAPI!.getCalendarSchedules!([{ id, name }], force, false, dayTransitionTime);
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
  }, [showStudentWeb, name, student?.id, scheduleRefresh, dayTransitionTime]);

  useLayoutEffect(() => {
    const panel = activePanel === 'studentWeb'
      ? studentWebPanelRef.current
      : activePanel === 'reportSettings'
        ? reportSettingsPanelRef.current
        : mainPanelRef.current;
    if (!panel) return;
    const measure = () => setActivePanelHeight(panel.offsetHeight);
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(panel);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [activePanel, reportSettings.customMushafEnabled, openReportGroups]);

  useEffect(() => {
    if (activePanel !== 'reportSettings') return;
    if (!window.electronAPI?.resolveStudentMushaf) {
      setMushafFileStatus({
        found: false,
        error: 'الخدمة الخلفية غير مفعّلة في النسخة المفتوحة حالياً؛ يلزم تحديث التطبيق أو فتحه بالنسخة الجديدة لتفعيل هذه الميزة.',
      });
      return;
    }
    let cancelled = false;
    setMushafFileStatus(null);
    window.electronAPI.resolveStudentMushaf({
      studentName: name,
      shortcutSourceId: shortcutSourceId || undefined,
      quranLink: quranLink || undefined,
    }).then(res => {
      if (!cancelled) setMushafFileStatus(res);
    }).catch(() => {
      if (!cancelled) setMushafFileStatus({ found: false, error: 'تعذر التحقق من ملف مصحف الطالب.' });
    });
    return () => { cancelled = true; };
  }, [activePanel, name, shortcutSourceId, quranLink]);

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

  // Intercept ALL wheel events while modal is open and redirect to active panel scroll container
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const targetScroll = activePanel === 'main'
        ? formRef.current
        : activePanel === 'reportSettings'
          ? (reportSettingsPanelRef.current?.querySelector('.report-settings-scroll') as HTMLElement | null)
          : (studentWebPanelRef.current?.querySelector('.overflow-y-auto') as HTMLElement | null);
      if (targetScroll) {
        targetScroll.scrollTop += e.deltaY;
      }
    };
    document.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      document.removeEventListener('wheel', handleWheel);
    };
  }, [activePanel]);

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
      const todayStr = cairoDate(new Date(), dayTransitionTime);

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

  const buildNormalizedReportSettings = (): StudentReportSettings | undefined => {
    if (!reportSettings.customMushafEnabled && !student?.reportSettings) return undefined;
    return {
      customMushafEnabled: !!reportSettings.customMushafEnabled,
      mushafTargetSection: reportSettings.mushafTargetSection || 'reading',
      mushafSectionOrder: normalizeSectionOrder(reportSettings.mushafSectionOrder),
      mushafIncludedSections: {
        rev: reportSettings.mushafIncludedSections?.rev !== false,
        oldRev: reportSettings.mushafIncludedSections?.oldRev !== false,
        new: reportSettings.mushafIncludedSections?.new !== false,
        tilawa: reportSettings.mushafIncludedSections?.tilawa !== false,
      },
      mushafDividerStyle: reportSettings.mushafDividerStyle || 'page',
      mushafLanguage: reportSettings.mushafLanguage || 'auto',
      mushafPageOffset: reportSettings.mushafPageOffset ?? 0,
      mushafAutoOpen: !!reportSettings.mushafAutoOpen,
      mushafAutoSendWhatsapp: reportSettings.mushafAutoSendWhatsapp !== false,
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !academy || !rate) return;
    if (quranLink.trim() && !isDriveFileLink(quranLink)) {
      setQuranLinkError(true);
      openSubPanel('studentWeb');
      return;
    }
    if (readingLink.trim() && !isDriveFileLink(readingLink)) {
      setReadingLinkError(true);
      openSubPanel('studentWeb');
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
      deletedAt: isEndingEnrollment ? nextMonthYear(currentMonth, currentYear) : undefined,
      days: isEndingEnrollment ? [] : selectedDays,
      dayStartDates: isEndingEnrollment ? {} : dayStartDates,
      studyPlan: studyPlan,
      reportSettings: buildNormalizedReportSettings(),
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

    // Once a calendar-reviewed schedule has history, a later manual edit must
    // also preserve the earlier periods instead of silently rewriting them.
    const daysChanged = student?.scheduleHistory?.length && (JSON.stringify(student.days || []) !== JSON.stringify(savedStudent.days || []) || JSON.stringify(student.dayStartDates || {}) !== JSON.stringify(savedStudent.dayStartDates || {}));
    onSave(daysChanged ? { ...savedStudent, scheduleHistory: replaceScheduleFrom(student!, savedStudent.days || [], cairoDate(new Date(), dayTransitionTime), savedStudent.dayStartDates).scheduleHistory } : savedStudent);
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
        {/* === Sliding container (main + active subpanel) === */}
        <div
          className="flex items-start transition-[transform,height] duration-300 ease-in-out will-change-transform"
          style={{ transform: activePanel !== 'main' ? 'translateX(100%)' : 'translateX(0)', height: activePanelHeight }}
        >

          {/* ─────── Panel 0: Main form ─────── */}
          <section ref={mainPanelRef} className="w-full flex-shrink-0">

            {/* Header */}
            <div className="relative z-20 p-6 text-center border-b border-gray-100">
              <button type="button" onClick={onClose} className="absolute left-6 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                <X size={24} />
              </button>
              <h2 className="text-3xl font-arabic text-gray-800 pt-2">{student ? 'تعديل بيانات الطالب' : 'إضافة طالب'}</h2>
              <div ref={headerMenuRef} className="absolute right-5 top-1/2 -translate-y-1/2">
                <button
                  type="button"
                  onClick={() => setHeaderMenuOpen(prev => !prev)}
                  aria-expanded={headerMenuOpen}
                  aria-haspopup="menu"
                  className="flex items-center gap-1.5 text-sm font-bold text-gray-600 hover:text-gray-800 hover:bg-gray-100 px-3.5 py-2 rounded-xl transition-all border border-gray-200/80 bg-gray-50/90 shadow-sm"
                >
                  <span className="font-arabic">المزيد</span>
                  <ChevronDown size={16} className={`transition-transform duration-150 ${headerMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {headerMenuOpen && (
                  <div
                    role="menu"
                    dir="rtl"
                    className="absolute right-0 top-full mt-2 w-48 rounded-2xl border border-gray-100 bg-white p-1.5 shadow-xl z-30 space-y-1"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => openSubPanel('studentWeb')}
                      title={shortcutStatus || 'واجهة الطالب'}
                      aria-label={shortcutStatus ? `واجهة الطالب — ${shortcutStatus}` : 'واجهة الطالب'}
                      className="w-full flex items-center justify-between gap-2 text-base font-bold text-gray-600 hover:text-amber-700 hover:bg-amber-50/80 px-3 py-2.5 rounded-xl transition-colors group"
                    >
                      <span className="flex items-center gap-2 font-arabic">
                        <span>واجهة الطالب</span>
                        {shortcutStatus && (
                          <Link
                            aria-hidden="true"
                            size={13}
                            strokeWidth={2.5}
                            className={shortcutLinked ? 'text-emerald-600' : 'text-amber-500'}
                          />
                        )}
                      </span>
                      <ChevronLeft size={16} className="text-gray-400 group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => openSubPanel('reportSettings')}
                      title="تخصيص إعدادات التقرير والمصحف المخصص"
                      className="w-full flex items-center justify-between gap-2 text-base font-bold text-gray-600 hover:text-emerald-700 hover:bg-emerald-50/80 px-3 py-2.5 rounded-xl transition-colors group"
                    >
                      <span className="flex items-center gap-2 font-arabic">
                        <span>تعديل التقرير</span>
                        {reportSettings.customMushafEnabled && (
                          <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        )}
                      </span>
                      <ChevronLeft size={16} className="text-gray-400 group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                )}
              </div>
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
                {(() => {
                  const pausedMatch = !student && name.trim() && onReactivateStudent
                    ? (students || []).find(s => s.name.trim() === name.trim() && isStudentPausedInMonth(s, currentMonth, currentYear))
                    : undefined;
                  if (!pausedMatch) return null;
                  return (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-2.5 text-sm text-emerald-900">
                      <span className="font-arabic">هذا الطالب متوقف حاليًا — يمكنك استعادته بنفس سجله وتقاريره بدايةً من هذا الشهر.</span>
                      <button
                        type="button"
                        onClick={() => onReactivateStudent(pausedMatch)}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 font-bold text-white hover:bg-emerald-700 transition-colors"
                      >
                        <ArchiveRestore size={16} />
                        <span>استعادة الطالب</span>
                      </button>
                    </div>
                  );
                })()}
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
                    رقم أو معرّف واتساب
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
                    {student && name === student.name && whatsappSource && whatsappTargetsEquivalent(whatsappNumber, student.whatsappNumber || '') && whatsappTargetsEquivalent(whatsappNumber, whatsappSource) && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 animate-in fade-in zoom-in slide-in-from-right-2 duration-300">
                        <div className="bg-green-100 text-green-600 rounded-full p-1 shadow-sm border border-green-200" title="مرتبط بـ MagicOpen وتتم متابعته" aria-label="مرتبط بـ MagicOpen وتتم متابعته">
                          <Link size={12} strokeWidth={2.5} />
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

          {/* ─── Panel 1 / Panel 2: Subpanel ─── */}
          {lastSubPanel === 'reportSettings' ? (
            <section ref={reportSettingsPanelRef} className="w-full flex-shrink-0 font-arabic flex flex-col max-h-[92vh]">
              <div className="shrink-0 relative px-6 py-5 text-center border-b border-gray-100 bg-white">
                <button
                  type="button"
                  onClick={() => setActivePanel('main')}
                  className="absolute right-6 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                  title="رجوع"
                >
                  <ChevronLeft size={24} style={{ transform: 'scaleX(-1)' }} />
                </button>
                <h2 className="text-3xl font-arabic font-bold text-gray-800 pt-1">تعديل التقرير</h2>
              </div>

              <div className="report-settings-scroll flex-1 min-h-0 overflow-y-auto overscroll-contain bg-slate-50/70 px-6 py-5 space-y-4 font-arabic">
                {/* Main Toggle & Student Mushaf Source Card */}
                <div className={`rounded-2xl border bg-white p-4 shadow-sm transition-colors ${reportSettings.customMushafEnabled ? 'border-emerald-200' : 'border-slate-200'}`}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!!reportSettings.customMushafEnabled}
                    onClick={() => setReportSettings(prev => ({ ...prev, customMushafEnabled: !prev.customMushafEnabled }))}
                    className="w-full flex items-center justify-between gap-4 text-right cursor-pointer"
                  >
                    <span className="text-xl font-bold text-slate-800 font-arabic">إنشاء ملف مصحف مخصص من التقرير</span>
                    <span
                      dir="rtl"
                      aria-hidden="true"
                      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 ${reportSettings.customMushafEnabled ? 'bg-emerald-600' : 'bg-slate-300'}`}
                    >
                      <span
                        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${reportSettings.customMushafEnabled ? '-translate-x-6' : '-translate-x-1'}`}
                      />
                    </span>
                  </button>

                  {reportSettings.customMushafEnabled && (
                    <div className={`mt-3 pt-3 border-t border-slate-100 flex items-center gap-2.5 text-lg font-arabic ${mushafFileStatus?.found ? 'text-emerald-800' : mushafFileStatus === null ? 'text-slate-600' : 'text-amber-800'}`}>
                      {mushafFileStatus === null ? (
                        <Loader2 size={18} className="text-slate-400 animate-spin shrink-0" />
                      ) : mushafFileStatus.found ? (
                        <BookOpen size={18} className="text-emerald-600 shrink-0" />
                      ) : (
                        <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                      )}
                      <p className="font-bold flex-1 min-w-0 truncate">
                        {mushafFileStatus === null
                          ? 'جاري التحقق من مصحف الطالب...'
                          : mushafFileStatus.found
                            ? `مصحف الطالب: ${mushafFileStatus.fileName}`
                            : (mushafFileStatus.error || 'لا يوجد ملف مصحف خاص مرتبط بهذا الطالب.')}
                      </p>
                    </div>
                  )}
                </div>

                {/* Student Mushaf Settings */}
                {reportSettings.customMushafEnabled && (
                  <div className="space-y-3.5 animate-in fade-in slide-in-from-top-2">
                    {/* Accordion 1: Section Source & Order */}
                    {(() => {
                      const orderedSections = normalizeSectionOrder(reportSettings.mushafSectionOrder);
                      const enabledCount = orderedSections.filter(k => reportSettings.mushafIncludedSections?.[k] !== false).length;
                      const targetLabel = (reportSettings.mushafTargetSection || 'reading') === 'homework' ? 'القادم' : 'الحالي';
                      return (
                        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden">
                          <button
                            type="button"
                            onClick={() => toggleReportGroup('sections')}
                            className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-right hover:bg-slate-50/70 transition-colors"
                          >
                            <span className="flex items-center gap-2.5">
                              <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                <Layers size={17} />
                              </span>
                              <span className="text-xl font-bold text-slate-800 font-arabic">أقسام التقرير والترتيب</span>
                            </span>
                            <span className="flex items-center gap-2 shrink-0">
                              <span className="text-sm font-arabic bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full">
                                {toHindiDigits(String(enabledCount))} أقسام · {targetLabel}
                              </span>
                              <ChevronDown size={18} className={`text-slate-400 transition-transform duration-200 ${openReportGroups.sections ? 'rotate-180' : ''}`} />
                            </span>
                          </button>
                          {openReportGroups.sections && (
                            <div className="px-4 pb-4 pt-3.5 space-y-4 border-t border-slate-100">
                              <div className="space-y-2">
                                <label className="block text-base font-bold text-slate-600 font-arabic">القسم المعتمد من التقرير</label>
                                <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                                  {([
                                    { id: 'reading', label: 'الدرس الحالي' },
                                    { id: 'homework', label: 'الدرس القادم' },
                                  ] as const).map(opt => {
                                    const active = (reportSettings.mushafTargetSection || 'reading') === opt.id;
                                    return (
                                      <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => setReportSettings(prev => ({ ...prev, mushafTargetSection: opt.id }))}
                                        className={`flex-1 py-2 rounded-lg text-lg font-arabic transition-all ${active
                                          ? 'bg-emerald-600 text-white shadow-sm font-bold'
                                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                                          }`}
                                      >
                                        {opt.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="space-y-2">
                                <label className="block text-base font-bold text-slate-600 font-arabic">ترتيب الأقسام في الملف</label>
                                <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white overflow-hidden">
                                  {orderedSections.map((secKey, idx, arr) => {
                                    const included = reportSettings.mushafIncludedSections?.[secKey] !== false;
                                    const move = (dir: -1 | 1) => {
                                      const nextOrder = [...arr];
                                      const targetIdx = idx + dir;
                                      if (targetIdx < 0 || targetIdx >= nextOrder.length) return;
                                      [nextOrder[idx], nextOrder[targetIdx]] = [nextOrder[targetIdx], nextOrder[idx]];
                                      setReportSettings(prev => ({ ...prev, mushafSectionOrder: nextOrder }));
                                    };
                                    return (
                                      <div key={secKey} className="flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-slate-50/70 transition-colors">
                                        <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                                          <input
                                            type="checkbox"
                                            checked={included}
                                            onChange={e => setReportSettings(prev => ({
                                              ...prev,
                                              mushafIncludedSections: {
                                                ...prev.mushafIncludedSections,
                                                [secKey]: e.target.checked,
                                              },
                                            }))}
                                            className="w-4 h-4 accent-emerald-600 cursor-pointer shrink-0"
                                          />
                                          <span className={`w-6 h-6 rounded-full text-sm font-bold flex items-center justify-center shrink-0 ${included ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                                            {toHindiDigits(String(idx + 1))}
                                          </span>
                                          <span className={`text-lg font-arabic font-bold truncate ${included ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                                            {MUSHAF_SECTION_LABELS[secKey].ar}
                                          </span>
                                        </label>
                                        <div className="flex items-center gap-0.5 shrink-0">
                                          <button
                                            type="button"
                                            disabled={idx === 0}
                                            onClick={() => move(-1)}
                                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-25 transition-colors"
                                            title="تحريك لأعلى"
                                          >
                                            <ChevronUp size={18} />
                                          </button>
                                          <button
                                            type="button"
                                            disabled={idx === arr.length - 1}
                                            onClick={() => move(1)}
                                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-25 transition-colors"
                                            title="تحريك لأسفل"
                                          >
                                            <ChevronDown size={18} />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Accordion 2: Divider Style, Language & Offset */}
                    {(() => {
                      const styleLabel = reportSettings.mushafDividerStyle === 'banner'
                        ? 'شريط أعلى الصفحة'
                        : reportSettings.mushafDividerStyle === 'both'
                          ? 'كلاهما'
                          : 'صفحة فاصلة';
                      const langLabel = reportSettings.mushafLanguage === 'ar'
                        ? 'عربي'
                        : reportSettings.mushafLanguage === 'en'
                          ? 'English'
                          : 'تلقائي';
                      const offsetVal = reportSettings.mushafPageOffset ?? 0;
                      return (
                        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden">
                          <button
                            type="button"
                            onClick={() => toggleReportGroup('format')}
                            className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-right hover:bg-slate-50/70 transition-colors"
                          >
                            <span className="flex items-center gap-2.5">
                              <span className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                                <SlidersHorizontal size={17} />
                              </span>
                              <span className="text-xl font-bold text-slate-800 font-arabic">شكل العناوين والصفحات</span>
                            </span>
                            <span className="flex items-center gap-2 shrink-0">
                              <span className="text-sm font-arabic bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full">
                                {styleLabel} · {langLabel}{offsetVal !== 0 ? ` (${offsetVal > 0 ? `+${offsetVal}` : offsetVal})` : ''}
                              </span>
                              <ChevronDown size={18} className={`text-slate-400 transition-transform duration-200 ${openReportGroups.format ? 'rotate-180' : ''}`} />
                            </span>
                          </button>
                          {openReportGroups.format && (
                            <div className="px-4 pb-4 pt-3.5 space-y-4 border-t border-slate-100">
                              <div className="space-y-2">
                                <label className="block text-base font-bold text-slate-600 font-arabic">شكل كتابة العنوان</label>
                                <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                                  {([
                                    { id: 'page', label: 'صفحة فاصلة' },
                                    { id: 'banner', label: 'شريط أعلى الصفحة' },
                                    { id: 'both', label: 'كلاهما' },
                                  ] as const).map(opt => {
                                    const active = (reportSettings.mushafDividerStyle || 'page') === opt.id;
                                    return (
                                      <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => setReportSettings(prev => ({ ...prev, mushafDividerStyle: opt.id }))}
                                        className={`flex-1 py-2 rounded-lg text-lg font-arabic transition-all ${active
                                          ? 'bg-emerald-600 text-white shadow-sm font-bold'
                                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                                          }`}
                                      >
                                        {opt.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="block text-base font-bold text-slate-600 font-arabic">لغة العناوين</label>
                                  <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                                    {([
                                      { id: 'auto', label: 'تلقائي', isEn: false },
                                      { id: 'ar', label: 'عربي', isEn: false },
                                      { id: 'en', label: 'English', isEn: true },
                                    ] as const).map(opt => {
                                      const active = (reportSettings.mushafLanguage || 'auto') === opt.id;
                                      return (
                                        <button
                                          key={opt.id}
                                          type="button"
                                          onClick={() => setReportSettings(prev => ({ ...prev, mushafLanguage: opt.id }))}
                                          className={`flex-1 py-2 rounded-lg transition-all ${opt.isEn ? 'font-english text-sm' : 'font-arabic text-lg'} ${active
                                            ? 'bg-emerald-600 text-white shadow-sm font-bold'
                                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                                            }`}
                                        >
                                          {opt.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <label htmlFor="mushafPageOffset" className="block text-base font-bold text-slate-600 font-arabic">إزاحة ترقيم الصفحات</label>
                                  <div className="flex items-center justify-between bg-slate-100 rounded-xl p-1 gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setReportSettings(prev => ({ ...prev, mushafPageOffset: (prev.mushafPageOffset ?? 0) - 1 }))}
                                      className="p-2 rounded-lg bg-white text-slate-600 hover:text-slate-900 shadow-sm transition-colors"
                                      title="إنقاص الإزاحة"
                                    >
                                      <Minus size={16} />
                                    </button>
                                    <input
                                      id="mushafPageOffset"
                                      type="number"
                                      value={offsetVal}
                                      onChange={e => setReportSettings(prev => ({ ...prev, mushafPageOffset: Number(e.target.value) || 0 }))}
                                      className="w-full bg-transparent text-center font-english text-base font-bold text-slate-800 focus:outline-none"
                                      dir="ltr"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setReportSettings(prev => ({ ...prev, mushafPageOffset: (prev.mushafPageOffset ?? 0) + 1 }))}
                                      className="p-2 rounded-lg bg-white text-slate-600 hover:text-slate-900 shadow-sm transition-colors"
                                      title="زيادة الإزاحة"
                                    >
                                      <Plus size={16} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Accordion 3: Storage & WhatsApp Delivery */}
                    {(() => {
                      const rawOutputDir = mushafFileStatus?.outputDir || 'Z:\\مصاحف الطلبة';
                      return (
                        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden">
                          <button
                            type="button"
                            onClick={() => toggleReportGroup('delivery')}
                            className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-right hover:bg-slate-50/70 transition-colors"
                          >
                            <span className="flex items-center gap-2.5">
                              <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                                <Send size={16} />
                              </span>
                              <span className="text-xl font-bold text-slate-800 font-arabic">الحفظ والواتساب</span>
                            </span>
                            <span className="flex items-center gap-2 shrink-0">
                              <span className="text-sm font-arabic bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full">
                                {reportSettings.mushafAutoSendWhatsapp !== false ? 'إرسال تلقائي' : 'حفظ فقط'}
                              </span>
                              <ChevronDown size={18} className={`text-slate-400 transition-transform duration-200 ${openReportGroups.delivery ? 'rotate-180' : ''}`} />
                            </span>
                          </button>
                          {openReportGroups.delivery && (
                            <div className="px-4 pb-4 pt-3.5 space-y-3 border-t border-slate-100">
                              <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5 border border-slate-200/70">
                                <div className="space-y-0.5 min-w-0">
                                  <span className="block text-base font-bold text-slate-600 font-arabic">مجلد الحفظ</span>
                                  <span className="block text-sm text-slate-500 font-english truncate" dir="ltr">
                                    {rawOutputDir.split(/([\\/])/).map((segment, i) =>
                                      /[^\u0000-\u007F]/.test(segment)
                                        ? <bdi key={i} dir="rtl" className="font-arabic text-base">{segment}</bdi>
                                        : <React.Fragment key={i}>{segment}</React.Fragment>
                                    )}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void window.electronAPI?.openMushafFolder?.()}
                                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:border-emerald-400 hover:text-emerald-700 text-base font-bold font-arabic shadow-sm transition-colors"
                                >
                                  <FolderOpen size={16} />
                                  <span>فتح المجلد</span>
                                </button>
                              </div>

                              <div className="rounded-xl border border-slate-200/80 divide-y divide-slate-100 bg-white overflow-hidden">
                                <label className="flex items-center gap-3 px-3.5 py-2.5 text-lg text-slate-800 font-arabic cursor-pointer hover:bg-slate-50/60 transition-colors">
                                  <input
                                    type="checkbox"
                                    checked={reportSettings.mushafAutoSendWhatsapp !== false}
                                    onChange={e => setReportSettings(prev => ({ ...prev, mushafAutoSendWhatsapp: e.target.checked }))}
                                    className="w-4 h-4 accent-emerald-600 cursor-pointer shrink-0"
                                  />
                                  <span>إرسال المصحف بعد التقرير عبر واتساب (أو نسخه في اليدوي)</span>
                                </label>

                                <label className="flex items-center gap-3 px-3.5 py-2.5 text-lg text-slate-800 font-arabic cursor-pointer hover:bg-slate-50/60 transition-colors">
                                  <input
                                    type="checkbox"
                                    checked={!!reportSettings.mushafAutoOpen}
                                    onChange={e => setReportSettings(prev => ({ ...prev, mushafAutoOpen: e.target.checked }))}
                                    className="w-4 h-4 accent-emerald-600 cursor-pointer shrink-0"
                                  />
                                  <span>فتح ملف المصحف تلقائيًا بعد الإنشاء</span>
                                </label>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Accordion 4: Report Review / Preview + Generate Now */}
                    {student && lastReport && onGenerateCustomMushafNow && (() => {
                      const previewSections = buildCustomMushafPlan({
                        reportData: lastReport,
                        sectionToggles: lastReport.sectionToggles,
                        cancelledInputs: lastReport.cancelledInputs,
                        settings: reportSettings,
                      });
                      const currentLang = reportSettings.mushafLanguage === 'en'
                        ? 'en'
                        : reportSettings.mushafLanguage === 'ar'
                          ? 'ar'
                          : lastReportLanguage;

                      return (
                        <div className="rounded-2xl border border-emerald-200 bg-white shadow-sm overflow-hidden">
                          <button
                            type="button"
                            onClick={() => toggleReportGroup('preview')}
                            className="w-full px-4 py-3.5 flex items-center justify-between gap-2 text-right bg-emerald-50/50 hover:bg-emerald-50/80 transition-colors"
                          >
                            <span className="flex items-center gap-2.5">
                              <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                <FileText size={17} />
                              </span>
                              <span className="text-xl font-bold text-slate-800 font-arabic">مراجعة ومعاينة آخر تقرير</span>
                            </span>
                            <span className="flex items-center gap-2 shrink-0">
                              <span className="text-sm font-arabic bg-emerald-100/80 text-emerald-800 px-2.5 py-0.5 rounded-full">
                                {previewSections.length ? `${toHindiDigits(String(previewSections.length))} أقسام` : 'فارغ'}
                              </span>
                              <ChevronDown size={18} className={`text-emerald-600 transition-transform duration-200 ${openReportGroups.preview ? 'rotate-180' : ''}`} />
                            </span>
                          </button>
                          {openReportGroups.preview && (
                            <div className="p-4 space-y-3 border-t border-emerald-100">
                              {previewSections.length > 0 && (
                                <div className="rounded-xl border border-slate-200/80 divide-y divide-slate-100 bg-slate-50/60 overflow-hidden text-lg font-arabic text-slate-700">
                                  {previewSections.map(sec => (
                                    <div key={sec.key} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                                      <span className={`font-bold text-slate-900 shrink-0 ${currentLang === 'en' ? 'font-english text-sm' : ''}`}>{currentLang === 'en' ? sec.titleEn : sec.titleAr}</span>
                                      <bdi className={`text-slate-600 truncate ${currentLang === 'en' ? 'font-english text-sm' : 'text-base'}`}>{currentLang === 'en' ? sec.summaryEn : sec.summaryAr} (ص {toHindiDigits(String(sec.startPage))}–{toHindiDigits(String(sec.endPage))})</bdi>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <button
                                type="button"
                                disabled={mushafGeneratingNow || !mushafFileStatus?.found || previewSections.length === 0}
                                onClick={async () => {
                                  setMushafGeneratingNow(true);
                                  try {
                                    const draftStudent: Student = {
                                      ...student,
                                      name,
                                      shortcutSourceId: shortcutSourceId || student.shortcutSourceId,
                                      quranLink: quranLink.trim() || student.quranLink,
                                      reportSettings: buildNormalizedReportSettings(),
                                    };
                                    await onGenerateCustomMushafNow(draftStudent);
                                  } finally {
                                    setMushafGeneratingNow(false);
                                  }
                                }}
                                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-arabic font-bold text-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
                              >
                                {mushafGeneratingNow ? <Loader2 size={18} className="animate-spin" /> : <BookOpen size={18} />}
                                <span>{mushafGeneratingNow ? 'جاري إنشاء ملف المصحف...' : 'توليد مصحف هذا التقرير الآن'}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Sticky Footer Save */}
              <div className="shrink-0 px-6 py-4 border-t border-gray-100 bg-white">
                <button
                  type="button"
                  onClick={() => handleSubmit({ preventDefault: () => { } } as React.FormEvent)}
                  className="w-full py-3 bg-[#ffe05d] text-gray-900 text-2xl font-bold font-arabic rounded-xl hover:bg-[#fcd030] hover:shadow-lg hover:shadow-[#ffe05d]/20 active:scale-[0.98] transition-all"
                >
                  حفظ
                </button>
              </div>
            </section>
          ) : (
            <section ref={studentWebPanelRef} className="w-full flex-shrink-0">
              <div className="relative p-6 text-center border-b border-gray-100">
                <button
                  type="button"
                  onClick={() => setActivePanel('main')}
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
                    {!window.electronAPI?.getShortcutLinks && <p className="text-sm text-gray-500">الربط التلقائي متاح من تطبيق الكمبيوتر.</p>}
                    {shortcutAvailable === false && <p className="text-sm text-red-600">تعذرت قراءة ملف الاختصارات من iCloud.</p>}
                    {shortcutAvailable === true && primaryShortcutMatches.length === 0 && <p className="text-sm text-amber-700">لم نجد اختصارًا لملف مصحف أو قراءة موجود مباشرة داخل مجلد مطابق لاسم الطالب. راجع الاسم والمسار المحفوظ في الاختصارات.</p>}
                    {primaryShortcutMatches.length !== 1 && <p className={whatsappSource ? 'text-base text-emerald-700' : 'text-base text-amber-700'}>معرّف واتساب: {whatsappSource ? 'متاح' : whatsappSourceAvailable === false ? 'تعذّر التحقق' : 'غير متاح'}</p>}
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
                      const folderName = match.path.split(/[\\/]/).filter(Boolean).slice(-2, -1)[0] || '';
                      const folderNumber = folderName.match(/^[0-9٠-٩۰-۹]+/)?.[0] || '';
                      const englishFolderNumber = folderNumber.replace(/[٠-٩۰-۹]/g, digit => String(digit.charCodeAt(0) - (digit.charCodeAt(0) >= 0x6f0 ? 0x6f0 : 0x660)));
                      const whatsappDifferent = !!(whatsappNumber && whatsappSource && !whatsappTargetsEquivalent(whatsappNumber, whatsappSource));
                      const statuses = [
                        { label: isGoogleMeetLink(match.zoomLink) ? 'Google Meet' : 'زوم', available: !!match.zoomLink && !zoomDifferent && !match.zoomConflict, text: match.zoomConflict || zoomDifferent ? 'مختلف' : match.zoomLink ? 'متاح' : 'غير متاح' },
                        { label: 'المصحف', available: !!match.quranLink && !quranDifferent, text: quranDifferent ? 'مختلف' : match.quranLink ? 'متاح' : 'غير متاح' },
                        { label: 'كتاب القراءة', available: readingAvailable && !readingDifferent, text: readingDifferent ? 'مختلف' : readingAvailable ? 'متاح' : 'غير متاح' },
                        { label: 'معرّف واتساب', available: !!whatsappSource && !whatsappDifferent, text: whatsappDifferent ? 'مختلف' : whatsappSource ? 'متاح' : whatsappSourceAvailable === false ? 'تعذّر التحقق' : 'غير متاح' },
                      ];
                      return (
                        <div key={match.id} className="rounded-xl bg-white border border-gray-200 p-4 space-y-2">
                          <p className="text-sm text-gray-600">{match.isReading ? 'كتاب القراءة' : 'المصحف'}</p>
                          <div className="py-1">
                            <p className="text-sm font-medium text-gray-500">مجلد الطالب</p>
                            <p className="mt-1 text-lg font-bold text-gray-800 break-words" dir="auto"><bdi className="font-english" dir="ltr">{englishFolderNumber}</bdi>{folderName.slice(folderNumber.length)}</p>
                            <details className="mt-2 text-sm text-gray-500">
                              <summary className="cursor-pointer text-emerald-700">عرض مسارات الملفات</summary>
                              <p className="mt-2 font-bold text-gray-600">{match.isReading ? 'كتاب القراءة' : 'المصحف'}</p>
                              <p className="mt-1 break-all" dir="auto">{match.path}</p>
                              {reading && reading.id !== match.id && <><p className="mt-2 font-bold text-gray-600">كتاب القراءة</p><p className="mt-1 break-all" dir="auto">{reading.path}</p></>}
                            </details>
                          </div>
                          <p className={match.exact ? 'text-base text-red-400' : 'text-base text-gray-600'}>{match.exact ? 'تفصيل' : 'يحتاج مراجعة'}</p>
                          <div className="space-y-1 text-base">
                            {[true, false].map(available => {
                              const group = statuses.filter(status => status.available === available);
                              return group.length > 0 && <div key={String(available)} className={`space-y-1 ${available ? 'text-emerald-700' : 'text-amber-700'}`}>
                                {group.map(status => <p key={status.label}>{status.label}: {status.text}</p>)}
                              </div>;
                            })}
                          </div>
                          {(zoomDifferent || quranDifferent) && <p className="text-base text-amber-700">{zoomDifferent && quranDifferent ? 'رابطا الحصة والمصحف مختلفان' : zoomDifferent ? 'رابط الحصة مختلف' : 'رابط المصحف مختلف'} عن المحفوظ.</p>}
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
                <div className="flex items-start justify-between gap-3 text-base">
                  <p id="student-schedule-status" role="status" className={scheduleError ? 'text-amber-700' : 'text-emerald-700'}>
                    {scheduleLoading ? 'جاري قراءة مواعيد الأسبوع الحالي…' : scheduleError || (isCurrentSchedule(calendarSchedule, name)
                      ? `${calendarSchedule!.status === 'empty' ? 'لا توجد مواعيد بهذا الاسم هذا الأسبوع' : 'تم التحديث من التقويم'} · ${arabicCalendarDate(calendarSchedule!.weekStart)} — ${arabicCalendarDate(calendarSchedule!.weekEnd)}`
                      : 'من السبت إلى الجمعة بتوقيت القاهرة، وتُعرض الحصص بتوقيت الطالب.')}
                  </p>
                  <button type="button" disabled={scheduleLoading || !name.trim()} onClick={() => setScheduleRefresh(value => value + 1)} className="shrink-0 text-emerald-700 font-bold disabled:opacity-40">تحديث الآن</button>
                </div>
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
          )}
          {/* ─── End Subpanel ─── */}

        </div>
        {/* === End sliding container === */}

      </div>
    </div>
  );
};

export default StudentModal;
