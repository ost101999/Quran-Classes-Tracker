import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Settings, Plus, Download, Upload, Trash2, Calendar, ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Link, History, Clock, Users2, Banknote, BarChart3, Minus, Pin, Phone, MessageCircle, Copy, UserX, UserCheck, Shield, Wand2, Check, ArrowDown, Repeat, Eye, EyeOff, Bell } from 'lucide-react';

// Custom animation styles
const customStyles = `
  @keyframes pulse-scale-glow {
    0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
    50% { transform: scale(1.15); box-shadow: 0 0 10px 2px rgba(239, 68, 68, 0.6); }
  }
  .animate-pulse-scale-glow {
    animation: pulse-scale-glow 2s infinite ease-in-out;
  }
  @keyframes pulse-glow-soft {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
    50% { box-shadow: 0 0 10px 4px rgba(239, 68, 68, 0.6); }
  }
  .animate-pulse-glow-soft {
    animation: pulse-glow-soft 2s infinite ease-in-out;
  }
  @keyframes glow-green {
    0%, 100% { box-shadow: 0 0 5px rgba(16, 185, 129, 0.4); border-color: rgba(16, 185, 129, 0.6); }
    50% { box-shadow: 0 0 15px 5px rgba(16, 185, 129, 0.8); border-color: rgba(16, 185, 129, 1); }
  }
  .animate-glow-green {
    animation: glow-green 1.5s infinite ease-in-out;
    border-width: 2px !important;
  }
  @keyframes missedSlideIn {
    0% { opacity: 0; transform: translateX(calc(-100% + 20px)); }
    100% { opacity: 1; transform: translateX(-100%); }
  }
`;

import {
  Student,
  AttendanceStatus,
  AttendanceRecord,
  MakeupLink,
  LessonProgress,
} from './types';
import { MONTHS, DAYS_OF_WEEK, SURAHS, SURAH_AYAH_COUNTS } from './constants';
import StudentModal from './components/StudentModal';
import StudentDetailsModal from './components/StudentDetailsModal';
import ConfirmModal from './components/ConfirmModal';
import AcademyDetailsModal from './components/AcademyDetailsModal';
import AcademyEditModal from './components/AcademyEditModal';
import SettingsModal from './components/SettingsModal';
import MonthlyStatsModal from './components/MonthlyStatsModal';
import URLPromptModal from './components/URLPromptModal';
import ActionConfigModal from './components/ActionConfigModal';
import ActionChoiceModal from './components/ActionChoiceModal';
import SimpleInputModal from './components/SimpleInputModal';
import WebModal from './components/WebModal';
import MultiStudentDetailsModal from './components/MultiStudentDetailsModal';
import SearchableSurahSelect from './components/SearchableSurahSelect';
import TajweedBankModal from './components/TajweedBankModal';
import TajweedAssignModal from './components/TajweedAssignModal';
import TajweedGradingModal from './components/TajweedGradingModal';
import TajweedGroupedHoverSelect, { TajweedGroupedSelectGroup } from './components/TajweedGroupedHoverSelect';

// --- Constants ---
const STORAGE_KEY = 'quran_tracker_data';
const CLOUD_APPSTATE_BASE_URL = 'https://quran-classes-tracker-default-rtdb.firebaseio.com/appState';
const SEEN_UNGRADED_TAJWEED_VERSION = 2;

const TAJWEED_STATUS_RANK: Record<'pending' | 'submitted' | 'graded', number> = {
  pending: 0,
  submitted: 1,
  graded: 2,
};

// Hadiths about Quran
const HADITHS = [
  'قال رسول الله ﷺ: «خَيْرُكُمْ مَنْ تَعَلَّمَ القُرْآنَ وَعَلَّمَهُ»',
  'قال رسول الله ﷺ: «اقْرَأوا القُرْآنَ فَإِنَّهُ يَأْتِي يَوْمَ القِيَامَةِ شَفِيعًا لِأَصْحَابِهِ»',
  'قال رسول الله ﷺ: «الَّذِي يَقْرَأُ القُرْآنَ وَهُوَ مَاهِرٌ بِهِ مَعَ السَّفَرَةِ الكِرَامِ البَرَرَةِ»',
  'قال رسول الله ﷺ: «إِنَّ اللَّهَ يَرْفَعُ بِهَذَا الكِتَابِ أَقْوَامًا وَيَضَعُ بِهِ آخَرِينَ»',
  'قال رسول الله ﷺ: «مَثَلُ الْمُؤْمِنِ الَّذِي يَقْرَأُ الْقُرْآنَ مَثَلُ الْأُتْرُجَّةِ رِيحُهَا طَيِّبٌ وَطَعْمُهَا طَيِّبٌ»'
];

const TAJWEED_TOPIC_GROUPS = [
  {
    id: 'foundation',
    label: 'النون والميم المشددتان',
    topics: ['النون والميم المشددتان'],
  },
  {
    id: 'nun_tanween',
    label: 'أحكام النون الساكنة والتنوين',
    topics: ['الإظهار الحلقي', 'الإدغام', 'الإقلاب', 'الإخفاء الحقيقي'],
  },
  {
    id: 'meem_sakinah',
    label: 'أحكام الميم الساكنة',
    topics: ['الإخفاء الشفوي', 'الإدغام الشفوي (إدغام المتماثلين)', 'الإظهار الشفوي'],
  },
] as const;

const QURAN_TAJWEED_LESSONS = [
  { id: 'tajweed-foundation', title: 'النون والميم المشددتان' },
  { id: 'tajweed-nun-izhar', title: 'الإظهار الحلقي' },
  { id: 'tajweed-nun-idgham', title: 'الإدغام' },
  { id: 'tajweed-nun-iqlab', title: 'الإقلاب' },
  { id: 'tajweed-nun-ikhfa', title: 'الإخفاء الحقيقي' },
  { id: 'tajweed-meem-ikhfa', title: 'الإخفاء الشفوي' },
  { id: 'tajweed-meem-idgham', title: 'الإدغام الشفوي (إدغام المتماثلين)' },
  { id: 'tajweed-meem-izhar', title: 'الإظهار الشفوي' },
] as const;

const QURAN_TAJWEED_LESSONS_EN: Record<string, string> = {
  'tajweed-foundation': 'Stressed Noon and Meem',
  'tajweed-nun-izhar': 'Izhar Halqi',
  'tajweed-nun-idgham': 'Idgham',
  'tajweed-nun-iqlab': 'Iqlab',
  'tajweed-nun-ikhfa': 'Ikhfa Haqiqi',
  'tajweed-meem-ikhfa': 'Ikhfa Shafawi',
  'tajweed-meem-idgham': 'Idgham Shafawi (Idgham Al-Mutamathilain)',
  'tajweed-meem-izhar': 'Izhar Shafawi',
};

const TAJWEED_NEXT_REPEAT = '__tajweed_next_repeat__';
const TAJWEED_NEXT_HIDE = '__tajweed_next_hide__';

type TajweedLessonGroupKey = 'foundation' | 'nun' | 'meem' | 'independent';

const TAJWEED_GROUP_LABELS: Record<TajweedLessonGroupKey, string> = {
  foundation: 'دروس أساسية',
  nun: 'أحكام النون الساكنة والتنوين',
  meem: 'أحكام الميم الساكنة',
  independent: 'مستقل',
};

const inferTajweedLessonGroup = (lessonId: string, lessonTitle: string, rawGroup?: string): TajweedLessonGroupKey => {
  if (rawGroup === 'foundation' || rawGroup === 'nun' || rawGroup === 'meem' || rawGroup === 'independent') {
    return rawGroup;
  }

  const normalizedId = String(lessonId || '').toLowerCase();
  if (normalizedId === 'tajweed-foundation') return 'foundation';
  if (normalizedId.startsWith('tajweed-nun-')) return 'nun';
  if (normalizedId.startsWith('tajweed-meem-')) return 'meem';

  const normalizedTitle = String(lessonTitle || '')
    .replace(/[ـ]/g, '')
    .replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (
    normalizedTitle.includes('الإظهار الشفوي') ||
    normalizedTitle.includes('الإخفاء الشفوي') ||
    normalizedTitle.includes('الإدغام الشفوي')
  ) {
    return 'meem';
  }

  if (
    normalizedTitle.includes('الإظهار الحلقي') ||
    normalizedTitle.includes('الإدغام') ||
    normalizedTitle.includes('الإقلاب') ||
    normalizedTitle.includes('الإخفاء الحقيقي')
  ) {
    return 'nun';
  }

  return 'independent';
};

const initialStudents: Student[] = [];

const toHindiDigits = (num: number | string | undefined | null) => {
  if (num === null || num === undefined) return '';
  return num.toString()
    .replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)])
    .replace(/\./g, ",");
};



const SURAHS_EN = [
  'Al-Fatiha', 'Al-Baqara', 'Al-Imran', 'An-Nisa', 'Al-Ma\'idah', 'Al-An\'am', 'Al-A\'raf', 'Al-Anfal', 'At-Tawbah', 'Yunus', 'Hud', 'Yusuf', 'Ar-Ra\'d', 'Ibrahim', 'Al-Hijr', 'An-Nahl', 'Al-Isra', 'Al-Kahf', 'Maryam', 'Ta-Ha', 'Al-Anbiya', 'Al-Hajj', 'Al-Mu\'minun', 'An-Nur', 'Al-Furqan', 'Ash-Shu\'ara', 'An-Naml', 'Al-Qasas', 'Al-Ankabut', 'Ar-Rum', 'Luqman', 'As-Sajdah', 'Al-Ahzab', 'Saba', 'Fatir', 'Ya-Sin', 'As-Saffat', 'Sad', 'Az-Zumar', 'Ghafir', 'Fussilat', 'Ash-Shura', 'Az-Zukhruf', 'Ad-Dukhan', 'Al-Jathiyah', 'Al-Ahqaf', 'Muhammad', 'Al-Fath', 'Al-Hujurat', 'Qaf', 'Adh-Dhariyat', 'At-Tur', 'An-Najm', 'Al-Qamar', 'Ar-Rahman', 'Al-Waqi\'ah', 'Al-Hadid', 'Al-Mujadila', 'Al-Hashr', 'Al-Mumtahanah', 'As-Saff', 'Al-Jumu\'ah', 'Al-Munafiqun', 'At-Taghabun', 'At-Talaq', 'At-Tahrim', 'Al-Mulk', 'Al-Qalam', 'Al-Haqqah', 'Al-Ma\'arij', 'Nuh', 'Al-Jinn', 'Al-Muzzammil', 'Al-Muddaththir', 'Al-Qiyamah', 'Al-Insan', 'Al-Mursalat', 'An-Naba', 'An-Nazi\'at', 'Abasa', 'At-Takwir', 'Al-Infitar', 'Al-Mutaffifin', 'Al-Inshiqaq', 'Al-Buruj', 'At-Tariq', 'Al-A\'la', 'Al-Ghashiyah', 'Al-Fajr', 'Al-Balad', 'Ash-Shams', 'Al-Layl', 'Ad-Duha', 'Ash-Sharh', 'At-Tin', 'Al-Alaq', 'Al-Qadr', 'Al-Bayyinah', 'Az-Zalzalah', 'Al-Adiyat', 'Al-Qari\'ah', 'At-Takathur', 'Al-Asr', 'Al-Humazah', 'Al-Fil', 'Quraysh', 'Al-Ma\'un', 'Al-Kawthar', 'Al-Kafirun', 'An-Nasr', 'Al-Masad', 'Al-Ikhlas', 'Al-Falaq', 'An-Nas'
];

const getEnglishSurahName = (arabicName: string) => {
  // Surahs list needed for index lookup. Re-defined inside modal usually but we need a global or redundant definition.
  // Actually SURAHS is defined inside the modal scope in line 2954.
  // We should probably move SURAHS to global scope or duplicate it here for the helper.
  // Moving it to global is cleaner.
  const index = SURAHS.indexOf(arabicName);
  return index !== -1 ? SURAHS_EN[index] : arabicName;
};

const toEnglish = (str: string | number | undefined | null) => {
  const s = (str || '').toString();
  return s.replace(/[٠-٩]/g, d => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]);
};

const getSingleLessonType = (book: 'noor' | 'taasees', p: number, lang: 'ar' | 'en') => {
  if (book === 'noor') {
    if (p >= 1 && p <= 13) return lang === 'ar' ? 'حركة الفتح' : 'Fatha';
    if (p >= 14 && p <= 18) return lang === 'ar' ? 'حركة الكسر' : 'Kasra';
    if (p >= 19 && p <= 22) return lang === 'ar' ? 'حركة الضم' : 'Damma';
    if (p >= 23 && p <= 24) return lang === 'ar' ? 'مراجعة الحركات' : 'Harakat Review';
    if (p >= 25 && p <= 28) return lang === 'ar' ? 'المد بالألف' : 'Madd with Alif';
    if (p >= 29 && p <= 32) return lang === 'ar' ? 'المد بالياء' : 'Madd with Yaa';
    if (p >= 33 && p <= 36) return lang === 'ar' ? 'المد بالواو' : 'Madd with Waw';
    if (p >= 37 && p <= 39) return lang === 'ar' ? 'مراجعة المدود' : 'Mudood Review';
    if (p >= 40 && p <= 50) return lang === 'ar' ? 'السكون' : 'Sukun';
    if (p >= 51 && p <= 53) return lang === 'ar' ? 'التنوين بالفتح' : 'Tanween with Fatha';
    if (p >= 54 && p <= 56) return lang === 'ar' ? 'التنوين بالكسر' : 'Tanween with Kasra';
    if (p >= 57 && p <= 58) return lang === 'ar' ? 'التنوين بالضم' : 'Tanween with Damma';
    if (p >= 59 && p <= 62) return lang === 'ar' ? 'مراجعة التنوين' : 'Tanween Review';
    if (p >= 63 && p <= 66) return lang === 'ar' ? 'الشدة مع الفتح' : 'Shadda with Fatha';
    if (p >= 67 && p <= 70) return lang === 'ar' ? 'الشدة مع الكسر' : 'Shadda with Kasra';
    if (p >= 71 && p <= 75) return lang === 'ar' ? 'الشدة مع الضم' : 'Shadda with Damma';
    if (p >= 76 && p <= 77) return lang === 'ar' ? 'الشدة مع التنوين - نهاية الكتاب' : 'Shadda with Tanween - End of Book';
  } else {
    // Foundation Book
    if (p >= 1 && p <= 4) return lang === 'ar' ? 'الحروف أ ب ت ث' : 'The letters أ ب ت ث';
    if (p >= 5 && p <= 8) return lang === 'ar' ? 'الحروف ج ح خ' : 'The letters ج ح خ';
    if (p >= 9 && p <= 13) return lang === 'ar' ? 'الحروف د ذ' : 'The letters د ذ';
    if (p >= 14 && p <= 18) return lang === 'ar' ? 'الحروف ر ز' : 'The letters ر ز';
    if (p >= 19 && p <= 23) return lang === 'ar' ? 'الحروف س ش' : 'The letters س ش';
    if (p >= 24 && p <= 29) return lang === 'ar' ? 'الحروف ص ض' : 'The letters ص ض';
    if (p >= 30 && p <= 33) return lang === 'ar' ? 'الحروف ط ظ' : 'The letters ط ظ';
    if (p >= 34 && p <= 38) return lang === 'ar' ? 'الحروف ع غ' : 'The letters ع غ';
    if (p >= 39 && p <= 43) return lang === 'ar' ? 'الحروف ف ق' : 'The letters ف ق';
    if (p >= 44 && p <= 48) return lang === 'ar' ? 'الحروف ك ل' : 'The letters ك ل';
    if (p >= 49 && p <= 53) return lang === 'ar' ? 'الحروف م ن' : 'The letters م ن';
    if (p >= 54 && p <= 58) return lang === 'ar' ? 'الحرف و' : 'The letter و';
    if (p >= 59 && p <= 63) return lang === 'ar' ? 'الحرف ي - نهاية الكتاب' : 'The letter ي - End of Book';
  }
  return '';
};

const getNoorLessonType = (book: 'noor' | 'taasees', fromPageStr: string, toPageStr: string, lang: 'ar' | 'en') => {
  if (!fromPageStr) return '';
  const fromEn = fromPageStr.replace(/[٠-٩]/g, d => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]);
  const p1 = parseInt(fromEn);
  if (isNaN(p1)) return '';

  const type1 = getSingleLessonType(book, p1, lang);
  
  // If no toPage, or it's cancelled/0, just return type1
  if (!toPageStr || toPageStr.trim() === '0' || toPageStr.trim() === '٠') return type1;
  
  const toEn = toPageStr.replace(/[٠-٩]/g, d => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]);
  const p2 = parseInt(toEn);
  if (isNaN(p2) || p1 === p2) return type1;

  const startP = Math.min(p1, p2);
  const endP = Math.max(p1, p2);

  const uniqueLessons: string[] = [];
  for (let i = startP; i <= endP; i++) {
    const type = getSingleLessonType(book, i, lang);
    if (type && !uniqueLessons.includes(type)) {
      uniqueLessons.push(type);
    }
  }

  if (uniqueLessons.length === 0) return '';
  if (uniqueLessons.length === 1) return uniqueLessons[0];

  if (book === 'taasees') {
    if (lang === 'en') {
      const isAllLetters = uniqueLessons.every(l => l.startsWith('The letters ') || l.startsWith('The letter '));
      if (isAllLetters) {
        const combinedLetters = uniqueLessons.map(l => l.replace('The letters ', '').replace('The letter ', '')).join(' ');
        return `The letters ${combinedLetters}`;
      }
    } else if (lang === 'ar') {
      const isAllLetters = uniqueLessons.every(l => l.startsWith('الحروف ') || l.startsWith('الحرف '));
      if (isAllLetters) {
        const combinedLetters = uniqueLessons.map(l => l.replace('الحروف ', '').replace('الحرف ', '')).join(' ');
        return `الحروف ${combinedLetters}`;
      }
    }
  }

  return uniqueLessons.join(' - ');
};

const normalizeUrl = (url: string) => {
  const s = (url || '').toString().trim();
  if (!s) return '';
  // If no scheme is provided, assume https
  if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(s)) return `https://${s}`;
  return s;
};

const withStudentPortalRefresh = (url: string) => {
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) return '';

  try {
    const parsed = new URL(normalizedUrl);
    if (parsed.hostname === 'quranreport.vercel.app') {
      // Force a fresh fetch to avoid stale student portal data after submitting a report.
      parsed.searchParams.set('_ts', Date.now().toString());
    }
    return parsed.toString();
  } catch {
    return normalizedUrl;
  }
};

// Helper to open external links in default browser (Chrome)
const openExternalLink = (url: string, e?: React.MouseEvent) => {
  e?.preventDefault();
  e?.stopPropagation();
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) return;
  if (window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(normalizedUrl);
  } else {
    window.open(normalizedUrl, '_blank');
  }
};

function App() {

  type HistorySnapshot = {
    att: AttendanceRecord;
    sub: Record<string, any>;
    reports?: Record<string, string>;
    reportDrafts?: Record<string, any>;
  };

  type TajweedLessonEditorUiState = {
    showLessonSettings: boolean;
    activeVersionId?: string;
  };

  const [isLoaded, setIsLoaded] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [attendance, setAttendance] = useState<AttendanceRecord>({});
  const [past, setPast] = useState<HistorySnapshot[]>([]);
  const [future, setFuture] = useState<HistorySnapshot[]>([]);
  const [month, setMonth] = useState<number>(new Date().getMonth());
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [dayOff, setDayOff] = useState<number>(5);
  const [academyOrder, setAcademyOrder] = useState<string[]>([]);
  const [academyRates, setAcademyRates] = useState<Record<string, { rate: number; currency: string }>>({});
  const [monthlyObligations, setMonthlyObligations] = useState<Record<string, number>>({});
  const [paymentStatus, setPaymentStatus] = useState<Record<string, boolean>>({});
  const [autoBackupConfig, setAutoBackupConfig] = useState({ enabled: false, interval: 60, lastBackupAt: null as number | null, backupPath: '' });
  const [externalLinks, setExternalLinks] = useState<{
    partnership: string;
    expenses: string;
    link30m: string; // Legacy fallback
    link60m: string; // Legacy fallback
    // New Configs
    link30m_type?: 'copy' | 'link';
    link30m_copyVal?: string;
    link30m_linkVal?: string;
    link60m_type?: 'copy' | 'link';
    link60m_copyVal?: string;
    link60m_linkVal?: string;
    // General Configs
    partnership_type?: 'copy' | 'link';
    partnership_copyVal?: string;
    partnership_linkVal?: string;
    expenses_type?: 'copy' | 'link';
    expenses_copyVal?: string;
    expenses_linkVal?: string;
    taskCompletion?: string;
    taskCompletion_type?: 'copy' | 'link';
    taskCompletion_copyVal?: string;
    taskCompletion_linkVal?: string;
  }>({
    partnership: '',
    expenses: '',
    link30m: '',
    link60m: '',
    link30m_type: 'link', // Default to link for backward compat if old val exists
    link30m_copyVal: '',
    link30m_linkVal: '',
    link60m_type: 'link',
    link60m_copyVal: '',
    link60m_linkVal: '',
    partnership_type: 'link',
    partnership_copyVal: '',
    partnership_linkVal: '',
    expenses_type: 'link',
    expenses_copyVal: '',
    expenses_linkVal: ''
  });
  const [dayTransitionTime, setDayTransitionTime] = useState<string>('00:00');

  const [selectedAcademy, setSelectedAcademy] = useState<string | null>(null);
  const [showMakeupLines, setShowMakeupLines] = useState<boolean>(true);
  const [showMissedCount, setShowMissedCount] = useState<boolean>(false);
  const [missedCountPositions, setMissedCountPositions] = useState<Array<{ studentId: string; y: number; height: number; count: number }>>([]);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [confirmNonTodayAttendance, setConfirmNonTodayAttendance] = useState<boolean>(true);
  const [whatsappTarget, setWhatsappTarget] = useState<string>('');
  const [studentProgress, setStudentProgress] = useState<Record<string, LessonProgress>>({});

  // Persistent Mode State
  const [preferredModes, setPreferredModes] = useState({
    readingNew: 'ayah',
    readingRev: 'ayah',
    readingOldRev: 'ayah',
    readingTilawa: 'ayah',
    homeworkNew: 'ayah',
    homeworkRev: 'ayah',
    homeworkOldRev: 'ayah',
    homeworkTilawa: 'ayah'
  });

  // Section Toggle State (for report sections)
  const [sectionToggles, setSectionToggles] = useState({
    readingNew: true,
    readingRev: true,
    readingOldRev: false,
    readingTilawa: true,
    homeworkNew: true,
    homeworkRev: true,
    homeworkOldRev: false,
    homeworkTilawa: true,
    quranTajweed: false
  });

  const [sendViaWhatsapp, setSendViaWhatsapp] = useState(false);

  // Per-Student Last Report State
  const [lastReports, setLastReports] = useState<Record<string, {
    readingNew: { mode: string; surah: string; fromAyah: string; toAyah: string; fromPage: string; toPage: string; fromJuz: string; toJuz: string; fromHizb: string; toHizb: string; fromSurah: string; toSurah: string; isAdvancedAyah?: boolean; };
    readingRev: { mode: string; surah: string; fromAyah: string; toAyah: string; fromPage: string; toPage: string; fromJuz: string; toJuz: string; fromHizb: string; toHizb: string; fromSurah: string; toSurah: string; isAdvancedAyah?: boolean; };
    readingOldRev: { mode: string; surah: string; fromAyah: string; toAyah: string; fromPage: string; toPage: string; fromJuz: string; toJuz: string; fromHizb: string; toHizb: string; fromSurah: string; toSurah: string; isAdvancedAyah?: boolean; };
    readingTilawa: { mode: string; surah: string; fromAyah: string; toAyah: string; fromPage: string; toPage: string; fromJuz: string; toJuz: string; fromHizb: string; toHizb: string; fromSurah: string; toSurah: string; isAdvancedAyah?: boolean; };
    homeworkNew: { mode: string; surah: string; from: string; to: string; fromSurah: string; toSurah: string; isAdvancedAyah?: boolean; };
    homeworkRev: { mode: string; surah: string; from: string; to: string; fromSurah: string; toSurah: string; isAdvancedAyah?: boolean; };
    homeworkOldRev: { mode: string; surah: string; from: string; to: string; fromSurah: string; toSurah: string; isAdvancedAyah?: boolean; };
    homeworkTilawa: { mode: string; surah: string; from: string; to: string; fromSurah: string; toSurah: string; isAdvancedAyah?: boolean; };
    noor?: {
      tam: { fromPage: string; toPage: string; fromLine: string; toLine: string };
      sayatim: { fromPage: string; toPage: string; fromLine: string; toLine: string };
    };
    sectionToggles?: {
      readingNew: boolean;
      readingRev: boolean;
      readingOldRev: boolean;
      readingTilawa: boolean;
      homeworkNew: boolean;
      homeworkRev: boolean;
      homeworkOldRev: boolean;
      homeworkTilawa: boolean;
      quranTajweed?: boolean;
    };
    noorDetails?: {
      tam: boolean;
      sayatim: boolean;
    };
    quranTajweed?: {
      currentLessonId: string;
      nextLessonId: string;
    };
    tajweed?: {
      lessonId: string;
      lessonTitle: string;
      topicGroup: string;
      topic: string;
    };
    activeSection?: 'quran' | 'noor' | 'tajweed';
    sendViaWhatsapp?: boolean;
    mergeWithQuran?: boolean;
    isRedoMode?: boolean;
    isRedoModeRev?: boolean;
    isRedoModeOldRev?: boolean;
    isRedoModeTilawa?: boolean;
    excludeReadingNew?: boolean;
    excludeReadingRev?: boolean;
    excludeReadingOldRev?: boolean;
    excludeReadingTilawa?: boolean;
    excludeHomeworkNew?: boolean;
    excludeHomeworkRev?: boolean;
    excludeHomeworkOldRev?: boolean;
    excludeHomeworkTilawa?: boolean;
    excludeNoorTam?: boolean;
    excludeNoorSayatim?: boolean;
    excludeQuranTajweed?: boolean;
    excludeNewFromReport?: boolean;
    customNotes?: string;
    audioLink?: string;
  }>>({});

  // Report Path State
  const [reportPath, setReportPath] = useState<'quran' | 'noor' | 'tajweed'>('quran');
  const [defaultNoorBook, setDefaultNoorBook] = useState<'noor' | 'taasees'>('noor');
  const [visitedNoor, setVisitedNoor] = useState(false);
  const [noorWarningShown, setNoorWarningShown] = useState(false);
  const [mergeWithQuran, setMergeWithQuran] = useState(false);
  const [noorDetails, setNoorDetails] = useState({ tam: false, sayatim: false });
  const [isNoorMirrorMode, setIsNoorMirrorMode] = useState(false);
  const [selectedTajweedLessonId, setSelectedTajweedLessonId] = useState('');
  const [selectedTajweedTopicGroup, setSelectedTajweedTopicGroup] = useState<typeof TAJWEED_TOPIC_GROUPS[number]['id']>('foundation');
  const [selectedTajweedTopic, setSelectedTajweedTopic] = useState(TAJWEED_TOPIC_GROUPS[0].topics[0]);
  const [quranTajweedCurrentLessonId, setQuranTajweedCurrentLessonId] = useState('');
  const [quranTajweedNextLessonId, setQuranTajweedNextLessonId] = useState('');

  // Subscription Class Counter State (per student)
  const [subscriptionSettings, setSubscriptionSettings] = useState<Record<string, {
    enabled: boolean;
    mode: 'subscription' | 'monthly';  // نوع النظام: اشتراك ثابت أو تجديد شهري
    totalClasses: number;               // يُستخدم فقط في نظام الاشتراك
    currentClass: number;
    lastResetMonth?: number;            // آخر شهر تم فيه إعادة التعيين (للتجديد الشهري)
    lastResetYear?: number;             // آخر سنة تم فيها إعادة التعيين
  }>>({});
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  // Tajweed Bank State
  const [tajweedBank, setTajweedBank] = useState<Record<string, import('./types').TajweedLesson>>({});
  const [tajweedAssignments, setTajweedAssignments] = useState<Record<string, import('./types').TajweedAssignment>>({});
  const [tajweedSubmissions, setTajweedSubmissions] = useState<Record<string, import('./types').TajweedSubmission>>({});
  const tajweedSubmissionsRef = useRef(tajweedSubmissions);
  useEffect(() => {
    tajweedSubmissionsRef.current = tajweedSubmissions;
  }, [tajweedSubmissions]);
  const tajweedAssignmentsRef = useRef(tajweedAssignments);
  useEffect(() => {
    tajweedAssignmentsRef.current = tajweedAssignments;
  }, [tajweedAssignments]);
  const [tajweedLessonEditorUiState, setTajweedLessonEditorUiState] = useState<Record<string, TajweedLessonEditorUiState>>({});
  const lastLocalActionTime = useRef<number>(0);
  const [isTajweedBankModalOpen, setIsTajweedBankModalOpen] = useState(false);
  const [isTajweedGradingModalOpen, setIsTajweedGradingModalOpen] = useState(false);
  const [tajweedGradingFocusStudentId, setTajweedGradingFocusStudentId] = useState<string | null>(null);
  const [seenUngradedTajweedAssignmentIds, setSeenUngradedTajweedAssignmentIds] = useState<Set<string>>(new Set());
  const [assigningTajweedForStudent, setAssigningTajweedForStudent] = useState<Student | null>(null);

  const ungradedTajweedAssignmentIdsByStudent = useMemo<Record<string, string[]>>(() => {
    const submissionByAssignmentId = new Map<string, string>();

    Object.values(tajweedSubmissions).forEach((submission) => {
      if (!submission?.assignmentId) return;
      if (!submissionByAssignmentId.has(submission.assignmentId)) {
        submissionByAssignmentId.set(submission.assignmentId, submission.id);
      }
    });

    return Object.values(tajweedAssignments).reduce<Record<string, string[]>>((acc, assignment) => {
      if (!assignment?.id || !assignment.studentId) return acc;
      if (assignment.hiddenFromMainGrading) return acc;

      const hasSubmission = Boolean(
        (assignment.submissionId && tajweedSubmissions[assignment.submissionId]) ||
        submissionByAssignmentId.get(assignment.id)
      );

      const isAwaitingGrading = assignment.status === 'submitted' || (assignment.status !== 'graded' && hasSubmission);
      if (!isAwaitingGrading || assignment.status === 'graded') return acc;

      if (!acc[assignment.studentId]) {
        acc[assignment.studentId] = [];
      }

      acc[assignment.studentId].push(assignment.id);
      return acc;
    }, {});
  }, [tajweedAssignments, tajweedSubmissions]);

  useEffect(() => {
    const activeUngradedIds = new Set<string>(Object.values(ungradedTajweedAssignmentIdsByStudent).flat());

    setSeenUngradedTajweedAssignmentIds((prev) => {
      let changed = false;
      const next = new Set<string>();

      prev.forEach((assignmentId) => {
        if (activeUngradedIds.has(assignmentId)) {
          next.add(assignmentId);
        } else {
          changed = true;
        }
      });

      return changed || next.size !== prev.size ? next : prev;
    });
  }, [ungradedTajweedAssignmentIdsByStudent]);

  const getUnseenUngradedTajweedCount = useCallback((studentId: string) => {
    const assignmentIds = ungradedTajweedAssignmentIdsByStudent[studentId] || [];
    return assignmentIds.filter((assignmentId) => !seenUngradedTajweedAssignmentIds.has(assignmentId)).length;
  }, [ungradedTajweedAssignmentIdsByStudent, seenUngradedTajweedAssignmentIds]);

  const unseenUngradedTajweedStudentsCount = useMemo(() => {
    return Object.values(ungradedTajweedAssignmentIdsByStudent).reduce((count, assignmentIds) => {
      const hasUnseenAssignment = assignmentIds.some((assignmentId) => !seenUngradedTajweedAssignmentIds.has(assignmentId));
      return hasUnseenAssignment ? count + 1 : count;
    }, 0);
  }, [ungradedTajweedAssignmentIdsByStudent, seenUngradedTajweedAssignmentIds]);

  const markUngradedTajweedAssignmentsAsSeen = useCallback((studentId: string | null) => {
    setSeenUngradedTajweedAssignmentIds((prev) => {
      const next = new Set(prev);
      let changed = false;

      const markAsSeen = (assignmentId: string) => {
        if (!next.has(assignmentId)) {
          next.add(assignmentId);
          changed = true;
        }
      };

      if (studentId) {
        (ungradedTajweedAssignmentIdsByStudent[studentId] || []).forEach(markAsSeen);
      } else {
        Object.values(ungradedTajweedAssignmentIdsByStudent).forEach((assignmentIds) => {
          assignmentIds.forEach(markAsSeen);
        });
      }

      return changed ? next : prev;
    });
  }, [ungradedTajweedAssignmentIdsByStudent]);

  const handleSaveTajweedGrading = useCallback((gradedSubmission: import('./types').TajweedSubmission) => {
    if (!gradedSubmission?.id || !gradedSubmission.assignmentId) return;

    setTajweedSubmissions((prev) => ({
      ...prev,
      [gradedSubmission.id]: gradedSubmission,
    }));

    setTajweedAssignments((prev) => {
      const next = { ...prev };
      const assignmentId = gradedSubmission.assignmentId;
      const assignment = next[assignmentId]
        || Object.values(next).find((item) => item.id === assignmentId);

      if (!assignment) return prev;

      const normalizedAssignmentId = assignment.id || assignmentId;
      const existingByKey = next[normalizedAssignmentId] || assignment;

      next[normalizedAssignmentId] = {
        ...existingByKey,
        status: 'graded',
        submissionId: gradedSubmission.id,
      };

      return next;
    });
  }, []);

  const handleRemoveFromMainTajweedGrading = useCallback((assignmentId: string) => {
    if (!assignmentId) return;

    setTajweedAssignments((prev) => {
      const assignment = prev[assignmentId]
        || Object.values(prev).find((item) => item.id === assignmentId);
      if (!assignment) return prev;

      const normalizedAssignmentId = assignment.id || assignmentId;
      const existingByKey = prev[normalizedAssignmentId] || assignment;
      if (existingByKey.hiddenFromMainGrading) return prev;

      return {
        ...prev,
        [normalizedAssignmentId]: {
          ...existingByKey,
          hiddenFromMainGrading: true,
        },
      };
    });
  }, []);

  const tajweedLessons = useMemo(
    () => Object.values(tajweedBank).sort((a, b) => b.createdAt - a.createdAt),
    [tajweedBank]
  );
  const quranTajweedLessonOptions = useMemo(
    (): Array<{ id: string; title: string; group: TajweedLessonGroupKey; parentLessonId?: string }> => (tajweedLessons.length > 0
      ? tajweedLessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        group: inferTajweedLessonGroup(lesson.id, lesson.title, lesson.group),
        parentLessonId: lesson.parentLessonId,
      }))
      : QURAN_TAJWEED_LESSONS.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        group: inferTajweedLessonGroup(lesson.id, lesson.title),
      }))),
    [tajweedLessons]
  );
  const quranTajweedLessonGroupedOptions = useMemo<TajweedGroupedSelectGroup[]>(() => {
    const groupsMap = new Map<TajweedLessonGroupKey, TajweedGroupedSelectGroup>();

    quranTajweedLessonOptions.forEach((lesson) => {
      if (!groupsMap.has(lesson.group)) {
        groupsMap.set(lesson.group, {
          key: lesson.group,
          label: TAJWEED_GROUP_LABELS[lesson.group],
          lessons: [],
        });
      }

      groupsMap.get(lesson.group)!.lessons.push({
        id: lesson.id,
        title: lesson.title,
        parentLessonId: lesson.parentLessonId,
      });
    });

    // Sort lessons in each group to put children under parents
    groupsMap.forEach((group) => {
      const mainLessons = group.lessons.filter((l) => !l.parentLessonId);
      const childrenLessons = group.lessons.filter((l) => l.parentLessonId);
      
      const sorted: Array<{ id: string; title: string; parentLessonId?: string }> = [];
      mainLessons.forEach((parent) => {
        sorted.push(parent);
        const children = childrenLessons.filter((child) => child.parentLessonId === parent.id);
        sorted.push(...children);
      });
      
      const addedIds = new Set(sorted.map((l) => l.id));
      const orphans = group.lessons.filter((l) => !addedIds.has(l.id));
      sorted.push(...orphans);

      group.lessons = sorted;
    });

    return Array.from(groupsMap.values());
  }, [quranTajweedLessonOptions]);
  const defaultQuranTajweedLessonId = quranTajweedLessonOptions[0]?.id || '';

  const normalizeTajweedLabel = useCallback((value: string) => {
    return String(value || '')
      .toLowerCase()
      .replace(/[ـ]/g, '')
      .replace(/[^a-z0-9\u0600-\u06FF\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  const normalizeAssignmentContentLanguage = useCallback((value: unknown): 'ar' | 'en' | null => {
    const raw = String(value || '').toLowerCase().trim();
    if (raw === 'ar' || raw === 'en') return raw;
    return null;
  }, []);

  const getStudentPreferredContentLanguage = useCallback((studentId?: string | null): 'ar' | 'en' | null => {
    if (!studentId) return null;

    const studentName = students.find((item) => item.id === studentId)?.name || '';
    if (!studentName) return null;

    return /[\u0600-\u06FF]/.test(studentName) ? 'ar' : 'en';
  }, [students]);

  const getLessonExamVersionsForAssignment = useCallback((lesson: import('./types').TajweedLesson): import('./types').TajweedExamVersion[] => {
    const versions = Array.isArray(lesson.examVersions) ? lesson.examVersions : [];
    if (versions.length > 0) return versions;

    return [
      {
        id: `${lesson.id || Date.now().toString()}-legacy-v1`,
        name: 'Legacy',
        targetAge: lesson.targetAge || 'all',
        language: lesson.language === 'en' ? 'en' : 'ar',
        questions: Array.isArray(lesson.questions) ? lesson.questions : [],
        createdAt: lesson.createdAt || Date.now(),
      }
    ];
  }, []);

  const getLocalizedTajweedLessonTitleFromLesson = useCallback((
    lesson: import('./types').TajweedLesson | null | undefined,
    lang: 'ar' | 'en' = 'ar',
  ) => {
    if (!lesson) return '';

    const versions = getLessonExamVersionsForAssignment(lesson);
    const readVersionTitle = (version: import('./types').TajweedExamVersion) => String(version.lessonTitle || '').trim();
    const getVersionLanguage = (version: import('./types').TajweedExamVersion): 'ar' | 'en' => (
      normalizeAssignmentContentLanguage(version.language) || (lesson.language === 'en' ? 'en' : 'ar')
    );
    const getVersionTargetAge = (version: import('./types').TajweedExamVersion): 'kids' | 'adults' | 'all' => (
      version.targetAge === 'kids' || version.targetAge === 'adults' || version.targetAge === 'all'
        ? version.targetAge
        : (lesson.targetAge || 'all')
    );

    const byPreferredLanguageAll = versions.find((version) => (
      getVersionLanguage(version) === lang
      && getVersionTargetAge(version) === 'all'
      && !!readVersionTitle(version)
    ));
    if (byPreferredLanguageAll) return readVersionTitle(byPreferredLanguageAll);

    const byPreferredLanguage = versions.find((version) => (
      getVersionLanguage(version) === lang
      && !!readVersionTitle(version)
    ));
    if (byPreferredLanguage) return readVersionTitle(byPreferredLanguage);

    const byAllAudience = versions.find((version) => (
      getVersionTargetAge(version) === 'all'
      && !!readVersionTitle(version)
    ));
    if (byAllAudience) return readVersionTitle(byAllAudience);

    const firstVersionWithTitle = versions.find((version) => !!readVersionTitle(version));
    if (firstVersionWithTitle) return readVersionTitle(firstVersionWithTitle);

    return String(lesson.title || '').trim();
  }, [getLessonExamVersionsForAssignment, normalizeAssignmentContentLanguage]);

  const getPreferredLessonExamVersion = useCallback((
    lesson: import('./types').TajweedLesson,
    options?: {
      preferredLanguage?: 'ar' | 'en' | null;
      preferredTargetAge?: 'kids' | 'adults' | null;
      preferredVersionId?: string | null;
    }
  ): import('./types').TajweedExamVersion | null => {
    const versions = getLessonExamVersionsForAssignment(lesson);
    if (versions.length === 0) return null;

    const preferredLanguage = options?.preferredLanguage || null;
    const preferredTargetAge = options?.preferredTargetAge || null;
    const preferredVersionId = String(options?.preferredVersionId || '').trim();

    const getVersionLanguage = (version: import('./types').TajweedExamVersion): 'ar' | 'en' => (
      normalizeAssignmentContentLanguage(version.language) || (lesson.language === 'en' ? 'en' : 'ar')
    );
    const getVersionTargetAge = (version: import('./types').TajweedExamVersion): 'kids' | 'adults' | 'all' => (
      version.targetAge === 'kids' || version.targetAge === 'adults' || version.targetAge === 'all'
        ? version.targetAge
        : (lesson.targetAge || 'all')
    );

    if (preferredVersionId) {
      const byId = versions.find((version) => String(version.id || '').trim() === preferredVersionId);
      if (byId) {
        const byIdLanguage = getVersionLanguage(byId);
        const byIdTargetAge = getVersionTargetAge(byId);
        const hasLanguageMismatch = !!preferredLanguage && byIdLanguage !== preferredLanguage;
        const hasTargetAgeMismatch = !!preferredTargetAge
          && byIdTargetAge !== 'all'
          && byIdTargetAge !== preferredTargetAge;

        if (!hasLanguageMismatch && !hasTargetAgeMismatch) {
          return byId;
        }
      }
    }

    const matchesTargetAge = (version: import('./types').TajweedExamVersion) => {
      if (!preferredTargetAge) return true;
      const targetAge = getVersionTargetAge(version);
      return targetAge === 'all' || targetAge === preferredTargetAge;
    };

    const matchesLanguage = (version: import('./types').TajweedExamVersion) => {
      if (!preferredLanguage) return true;
      return getVersionLanguage(version) === preferredLanguage;
    };

    const strict = versions.find((version) => matchesTargetAge(version) && matchesLanguage(version));
    if (strict) return strict;

    const byLanguage = versions.find((version) => matchesLanguage(version));
    if (byLanguage) return byLanguage;

    const byTargetAge = versions.find((version) => matchesTargetAge(version));
    if (byTargetAge) return byTargetAge;

    return versions[0];
  }, [getLessonExamVersionsForAssignment, normalizeAssignmentContentLanguage]);

  const resolveAssignableTajweedLesson = useCallback((lessonRefId: string, studentId?: string | null, forcedLanguage?: 'ar' | 'en') => {
    if (!lessonRefId || lessonRefId.startsWith('sep-') || lessonRefId === TAJWEED_NEXT_HIDE || lessonRefId === TAJWEED_NEXT_REPEAT) {
      return null;
    }

    const studentProfile = studentId ? students.find((item) => item.id === studentId) : null;
    const studentName = studentProfile?.name || '';
    const studentTargetAge = studentProfile?.targetAge;
    const preferredLanguage: 'ar' | 'en' | null = forcedLanguage
      || (studentName ? (/[\u0600-\u06FF]/.test(studentName) ? 'ar' : 'en') : null);

    const lessonLanguage = (lesson: import('./types').TajweedLesson): 'ar' | 'en' | 'both' => {
      if (lesson.language === 'en' || lesson.language === 'both') {
        return lesson.language;
      }
      return 'ar';
    };
    const matchesPreferredLanguage = (lesson: import('./types').TajweedLesson) => {
      if (!preferredLanguage) return true;
      const lang = lessonLanguage(lesson);
      if (lang === 'both' || lang === preferredLanguage) return true;

      const versionMatch = getLessonExamVersionsForAssignment(lesson).some((version) => {
        const versionLang = normalizeAssignmentContentLanguage(version.language) || lang;
        return versionLang === preferredLanguage;
      });

      return versionMatch;
    };
    const matchesPreferredTargetAge = (lesson: import('./types').TajweedLesson) => {
      if (!studentTargetAge) return true;
      return lesson.targetAge === 'all' || lesson.targetAge === studentTargetAge;
    };

    const directLesson = tajweedBank[lessonRefId];
    if (directLesson) {
      return { id: lessonRefId, lesson: directLesson };
    }

    const refLesson = QURAN_TAJWEED_LESSONS.find(item => item.id === lessonRefId);
    if (!refLesson && !directLesson) return null;

    const baseTitle = directLesson?.title || refLesson?.title || '';
    const refTitle = normalizeTajweedLabel(baseTitle);
    const bankEntries = Object.entries(tajweedBank);

    const orderedEntries = QURAN_TAJWEED_LESSONS
      .map((smartLesson) => {
        const smartTitle = normalizeTajweedLabel(smartLesson.title);
        return bankEntries.find(([_, lesson]) => normalizeTajweedLabel(lesson.title) === smartTitle) || null;
      })
      .filter((entry): entry is [string, import('./types').TajweedLesson] => !!entry);

    const seen = new Set(orderedEntries.map(([id]) => id));
    const candidates = [...orderedEntries, ...bankEntries.filter(([id]) => !seen.has(id))];

    if (directLesson) {
      const directEntry: [string, import('./types').TajweedLesson] = [lessonRefId, directLesson];
      if (!candidates.some(([candidateId]) => candidateId === lessonRefId)) {
        candidates.unshift(directEntry);
      }
    }

    const exactPreferred = candidates.find(([_, lesson]) => {
      const title = normalizeTajweedLabel(lesson.title);
      return title === refTitle && matchesPreferredLanguage(lesson) && matchesPreferredTargetAge(lesson);
    });
    if (exactPreferred) return { id: exactPreferred[0], lesson: exactPreferred[1] };

    const loosePreferred = candidates.find(([_, lesson]) => {
      const title = normalizeTajweedLabel(lesson.title);
      return !!title
        && (title.includes(refTitle) || refTitle.includes(title))
        && matchesPreferredLanguage(lesson)
        && matchesPreferredTargetAge(lesson);
    });
    if (loosePreferred) return { id: loosePreferred[0], lesson: loosePreferred[1] };

    const exactTargetAge = candidates.find(([_, lesson]) => {
      const title = normalizeTajweedLabel(lesson.title);
      return title === refTitle && matchesPreferredTargetAge(lesson);
    });
    if (exactTargetAge) return { id: exactTargetAge[0], lesson: exactTargetAge[1] };

    const looseTargetAge = candidates.find(([_, lesson]) => {
      const title = normalizeTajweedLabel(lesson.title);
      return !!title
        && (title.includes(refTitle) || refTitle.includes(title))
        && matchesPreferredTargetAge(lesson);
    });
    if (looseTargetAge) return { id: looseTargetAge[0], lesson: looseTargetAge[1] };

    const exact = candidates.find(([_, lesson]) => {
      const title = normalizeTajweedLabel(lesson.title);
      return title === refTitle;
    });
    if (exact) return { id: exact[0], lesson: exact[1] };

    const loose = candidates.find(([_, lesson]) => {
      const title = normalizeTajweedLabel(lesson.title);
      return !!title && (title.includes(refTitle) || refTitle.includes(title));
    });
    if (loose) return { id: loose[0], lesson: loose[1] };

    return null;
  }, [getLessonExamVersionsForAssignment, normalizeAssignmentContentLanguage, normalizeTajweedLabel, students, tajweedBank]);

  const hasPendingTajweedAssignment = useCallback((studentId: string, lessonRefId: string, forcedLanguage?: 'ar' | 'en') => {
    const resolved = resolveAssignableTajweedLesson(lessonRefId, studentId, forcedLanguage);
    if (!resolved) return false;

    return Object.values(tajweedAssignments).some((assignment) => (
      assignment.studentId === studentId &&
      assignment.lessonId === resolved.id &&
      assignment.status === 'pending'
    ));
  }, [resolveAssignableTajweedLesson, tajweedAssignments]);

  const ensureTajweedAssignmentForLesson = useCallback((studentId: string, lessonRefId: string, contentLanguage?: 'ar' | 'en') => {
    const resolved = resolveAssignableTajweedLesson(lessonRefId, studentId, contentLanguage);
    if (!resolved) return;

    const studentProfile = students.find((item) => item.id === studentId) || null;
    const preferredVersion = getPreferredLessonExamVersion(resolved.lesson, {
      preferredLanguage: contentLanguage || null,
      preferredTargetAge: studentProfile?.targetAge || null,
    });
    const resolvedVersionId = preferredVersion?.id;

    setTajweedAssignments(prev => {
      const existingPendingEntry = Object.entries(prev).find(([_, assignment]) => (
        assignment.studentId === studentId &&
        assignment.lessonId === resolved.id &&
        assignment.status === 'pending'
      ));

      if (existingPendingEntry) {
        const [assignmentId, assignment] = existingPendingEntry;
        const nextContentLanguage = contentLanguage || assignment.contentLanguage;
        const nextVersionId = resolvedVersionId || assignment.versionId;

        if (assignment.contentLanguage === nextContentLanguage && assignment.versionId === nextVersionId) return prev;

        return {
          ...prev,
          [assignmentId]: {
            ...assignment,
            contentLanguage: nextContentLanguage,
            versionId: nextVersionId,
          }
        };
      }

      const assignedAt = Date.now();
      const assignmentId = `${studentId}_${resolved.id}_${assignedAt}`;

      return {
        ...prev,
        [assignmentId]: {
          id: assignmentId,
          lessonId: resolved.id,
          studentId,
          assignedAt,
          contentLanguage,
          versionId: resolvedVersionId,
          status: 'pending'
        }
      };
    });
  }, [getPreferredLessonExamVersion, resolveAssignableTajweedLesson, students]);

  const enrichTajweedAssignmentMetadata = useCallback((assignment: import('./types').TajweedAssignment): import('./types').TajweedAssignment => {
    const studentProfile = students.find((item) => item.id === assignment.studentId) || null;
    const inferredLanguage = normalizeAssignmentContentLanguage(assignment.contentLanguage)
      || (studentProfile?.name && /[\u0600-\u06FF]/.test(studentProfile.name) ? 'ar' : 'en');

    const lesson = tajweedBank[assignment.lessonId];
    if (!lesson) {
      return {
        ...assignment,
        contentLanguage: inferredLanguage,
      };
    }

    const preferredVersion = getPreferredLessonExamVersion(lesson, {
      preferredLanguage: inferredLanguage,
      preferredTargetAge: studentProfile?.targetAge || null,
      preferredVersionId: assignment.versionId || null,
    });

    return {
      ...assignment,
      contentLanguage: inferredLanguage,
      versionId: preferredVersion?.id || assignment.versionId,
    };
  }, [getPreferredLessonExamVersion, normalizeAssignmentContentLanguage, students, tajweedBank]);

  const getTajweedQuizNote = useCallback((lang: 'ar' | 'en', studentId: string, lessonRefId: string) => {
    const resolved = resolveAssignableTajweedLesson(lessonRefId, studentId, lang);
    if (!resolved) return '';

    const alreadyPending = hasPendingTajweedAssignment(studentId, lessonRefId, lang);
    if (lang === 'ar') {
      return alreadyPending
        ? '🧪 *اختبار التجويد:* هذا الاختبار مُسند بالفعل في واجبات الطالب.\n'
        : '🧪 *اختبار التجويد:* أسئلة هذا الدرس متاحة في واجبات الطالب.\n';
    }

    return alreadyPending
      ? '🧪 *Tajweed Quiz:* This quiz is already assigned in student assignments.\n'
      : '🧪 *Tajweed Quiz:* Questions for this lesson are available in student assignments.\n';
  }, [hasPendingTajweedAssignment, resolveAssignableTajweedLesson]);

  const mapTajweedLessonRefToBankId = useCallback((
    lessonRefId: string,
    options?: {
      studentId?: string | null;
      forcedLanguage?: 'ar' | 'en' | null;
    }
  ) => {
    if (!lessonRefId || lessonRefId === TAJWEED_NEXT_REPEAT || lessonRefId === TAJWEED_NEXT_HIDE) {
      return lessonRefId;
    }

    if (tajweedBank[lessonRefId]) {
      return lessonRefId;
    }

    if (quranTajweedLessonOptions.some((lesson) => lesson.id === lessonRefId)) {
      return lessonRefId;
    }

    const preferredLanguage = options?.forcedLanguage || getStudentPreferredContentLanguage(options?.studentId);
    const resolved = resolveAssignableTajweedLesson(
      lessonRefId,
      options?.studentId,
      preferredLanguage || undefined,
    );
    if (resolved?.id) {
      return resolved.id;
    }

    const refCandidates = [
      QURAN_TAJWEED_LESSONS.find((item) => item.id === lessonRefId)?.title,
      QURAN_TAJWEED_LESSONS_EN[lessonRefId as keyof typeof QURAN_TAJWEED_LESSONS_EN],
    ]
      .map((value) => normalizeTajweedLabel(String(value || '')))
      .filter(Boolean);

    if (refCandidates.length === 0) {
      return lessonRefId;
    }

    const fallbackByTitle = quranTajweedLessonOptions.find((option) => {
      const lesson = tajweedBank[option.id];
      const versionTitles = lesson
        ? getLessonExamVersionsForAssignment(lesson).map((version) => String(version.lessonTitle || ''))
        : [];
      const aliases = [option.title, lesson?.title || '', ...versionTitles]
        .map((value) => normalizeTajweedLabel(String(value || '')))
        .filter(Boolean);

      return aliases.some((alias) => (
        refCandidates.some((candidate) => (
          alias === candidate || alias.includes(candidate) || candidate.includes(alias)
        ))
      ));
    });

    return fallbackByTitle?.id || lessonRefId;
  }, [
    getLessonExamVersionsForAssignment,
    getStudentPreferredContentLanguage,
    normalizeTajweedLabel,
    quranTajweedLessonOptions,
    resolveAssignableTajweedLesson,
    tajweedBank,
  ]);

  const getTajweedLessonTitle = useCallback((lessonId: string, lang: 'ar' | 'en' = 'ar') => {
    if (!lessonId) return lang === 'ar' ? 'غير محدد' : 'Not specified';

    const bankLesson = tajweedLessons.find((item) => item.id === lessonId);
    if (bankLesson) {
      const localizedTitle = getLocalizedTajweedLessonTitleFromLesson(bankLesson, lang);
      if (localizedTitle) return localizedTitle;
      return bankLesson.title;
    }

    if (lang === 'en') {
      return QURAN_TAJWEED_LESSONS_EN[lessonId]
        || QURAN_TAJWEED_LESSONS.find((item) => item.id === lessonId)?.title
        || lessonId;
    }

    return QURAN_TAJWEED_LESSONS.find((item) => item.id === lessonId)?.title || lessonId;
  }, [getLocalizedTajweedLessonTitleFromLesson, tajweedLessons]);

  // Function to reset monthly session numbers at the start of each month
  const checkAndResetMonthlySessions = useCallback(() => {
    const currentMonth = month;
    const currentYear = year;

    setSubscriptionSettings(prev => {
      let updated = false;
      const next = { ...prev };

      Object.keys(next).forEach(studentId => {
        const setting = next[studentId];
        if (setting.enabled && setting.mode === 'monthly') {
          // First-time / legacy student: just stamp month without resetting counter
          if (setting.lastResetMonth === undefined || setting.lastResetYear === undefined) {
            next[studentId] = { ...setting, lastResetMonth: currentMonth, lastResetYear: currentYear };
            updated = true;
          } else if (setting.lastResetMonth !== currentMonth || setting.lastResetYear !== currentYear) {
            // Moved to a new month — reset counter
            next[studentId] = {
              ...setting,
              currentClass: 0,
              lastResetMonth: currentMonth,
              lastResetYear: currentYear
            };
            updated = true;
          }
        }
      });

      return updated ? next : prev;
    });
  }, [month, year]);

  // --- Tajweed Audio Sync Listener (Phase 3) ---
  useEffect(() => {
    let hasChanges = false;
    const newSubmissions = { ...tajweedSubmissions };

    const processAudioSync = async () => {
      const canSaveTajweedAudio = typeof window !== 'undefined'
        && 'electronAPI' in window
        && typeof window.electronAPI?.saveTajweedAudio === 'function';

      if (!canSaveTajweedAudio) return; // Only run when bridge supports audio saving

      for (const [subId, submission] of Object.entries(newSubmissions)) {
        if (!submission.answers) continue;
        
        let subModified = false;
        
        for (let i = 0; i < submission.answers.length; i++) {
          const ans = submission.answers[i];
          if (ans.audioBase64 && !ans.audioLocalPath) {
             let pureBase64 = ans.audioBase64;
             if (pureBase64.includes('base64,')) {
                 pureBase64 = pureBase64.split('base64,')[1];
             }

             const student = students.find(s => s.id === submission.studentId);
             const studentName = student ? student.name.replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, '') : 'Student';
             const timestamp = new Date().getTime();
             const fileName = `${studentName}_${submission.assignmentId}_${i}_${timestamp}.webm`;

             try {
                const result = await window.electronAPI.saveTajweedAudio(pureBase64, fileName);
                if (result && result.success) {
                    ans.audioLocalPath = result.localPath;
                  // Keep the synced base64 so the recording stays available across devices.
                    subModified = true;
                    hasChanges = true;
                }
             } catch (err) {
                 console.error('Failed to sync audio:', err);
             }
          }
        }
        
        if (subModified) {
          newSubmissions[subId] = submission;
        }
      }

      if (hasChanges) {
        setTajweedSubmissions(newSubmissions);
      }
    };

    processAudioSync();
  }, [tajweedSubmissions, students]);

  // Effect to check on month/year change
  useEffect(() => {
    if (isLoaded) {
      checkAndResetMonthlySessions();
    }
  }, [month, year, isLoaded, checkAndResetMonthlySessions]);

  // Memoize random Hadith to prevent changing on re-renders (e.g. hover states)
  // Sync Noor Sayatim visibility and values with Tam when in Mirror Mode
  useEffect(() => {
    if (isNoorMirrorMode) {
      // 1. Sync Cancelled/Shaded State (Priority)
      setCancelledInputs(prev => {
        const next = { ...prev };
        let changed = false;
        const syncMap: Record<string, string> = {
          'noor-tam-from-page': 'noor-sayatim-from-page',
          'noor-tam-to-page': 'noor-sayatim-to-page',
          'noor-tam-from-line': 'noor-sayatim-from-line',
          'noor-tam-to-line': 'noor-sayatim-to-line'
        };

        Object.entries(syncMap).forEach(([tamKey, sayatimKey]) => {
          // If Tam is cancelled (shaded) and Sayatim is not, OR text is matching
          // Actually just force match if state differs
          if (!!next[tamKey] !== !!next[sayatimKey]) {
            next[sayatimKey] = !!next[tamKey];
            changed = true;
          }
        });

        return changed ? next : prev;
      });

      // 2. Sync Visibility and Values
      if (noorDetails.tam) {
        if (!noorDetails.sayatim) {
          setNoorDetails(prev => ({ ...prev, sayatim: true }));
        } else {
          // Sync values if visible
          const tamLineFrom = (document.getElementById('noor-tam-from-line') as HTMLInputElement)?.value;
          const tamLineTo = (document.getElementById('noor-tam-to-line') as HTMLInputElement)?.value;
          const sayatimLineFromEl = document.getElementById('noor-sayatim-from-line') as HTMLInputElement;
          const sayatimLineToEl = document.getElementById('noor-sayatim-to-line') as HTMLInputElement;

          if (sayatimLineFromEl && tamLineFrom !== undefined && sayatimLineFromEl.value !== tamLineFrom) {
            sayatimLineFromEl.value = tamLineFrom;
          }
          if (sayatimLineToEl && tamLineTo !== undefined && sayatimLineToEl.value !== tamLineTo) {
            sayatimLineToEl.value = tamLineTo;
          }
        }
      }
    }
  }, [isNoorMirrorMode, noorDetails.tam, noorDetails.sayatim]);

  const randomHadith = useMemo(() => {
    return HADITHS[Math.floor(Math.random() * HADITHS.length)];
  }, []); // Empty dependency array = stable for session

  // --- Loading State for Month Switch ---
  const [isTableLoading, setIsTableLoading] = useState(false);
  const [lastReportLanguage, setLastReportLanguage] = useState<'ar' | 'en'>('ar');

  const handleMonthChange = (newMonth: number) => {
    setIsTableLoading(true);
    setShowMonthSelector(false);
    setTimeout(() => {
      setMonth(newMonth);
      setTimeout(() => {
        setIsTableLoading(false);
      }, 50); // Short delay to allow layout reset
    }, 50);
  };

  const handleYearChange = (newYear: number) => {
    setIsTableLoading(true);
    setTimeout(() => {
      setYear(newYear);
      setTimeout(() => {
        setIsTableLoading(false);
      }, 50);
    }, 50);
  };

  const navigateMonth = useCallback((direction: 'next' | 'prev') => {
    setIsTableLoading(true);
    setShowMonthSelector(false);

    setTimeout(() => {
      if (direction === 'prev') {
        setMonth(prev => {
          if (prev === 0) {
            setYear(y => y - 1);
            return 11;
          }
          return prev - 1;
        });
      } else {
        setMonth(prev => {
          if (prev === 11) {
            setYear(y => y + 1);
            return 0;
          }
          return prev + 1;
        });
      }
      setTimeout(() => {
        setIsTableLoading(false);
      }, 50);
    }, 50);
  }, []);

  // Mouse Buttons Navigation (Back/Forward)
  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      // Button 3 is "Back", Button 4 is "Forward"
      // Note: mapping can vary, but standard is 3=back, 4=forward
      if (e.button === 3) {
        e.preventDefault();
        navigateMonth('prev');
      } else if (e.button === 4) {
        e.preventDefault();
        navigateMonth('next');
      }
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [navigateMonth]);

  // --- Initial Load ---
  useEffect(() => {
    async function loadInitialData() {
      if (window.electronAPI) {
        const savedData = await window.electronAPI.loadData();
        if (savedData) {
          if (savedData.students) setStudents(savedData.students);
          if (savedData.attendance) setAttendance(savedData.attendance);
          if (savedData.month !== undefined) setMonth(savedData.month);
          if (savedData.year !== undefined) setYear(savedData.year);
          if (savedData.dayOff !== undefined) setDayOff(savedData.dayOff);
          if (savedData.academyOrder) setAcademyOrder(savedData.academyOrder);
          if (savedData.academyRates) setAcademyRates(savedData.academyRates);
          if (savedData.monthlyObligations) setMonthlyObligations(savedData.monthlyObligations);
          if (savedData.paymentStatus) setPaymentStatus(savedData.paymentStatus);
          if (savedData.autoBackupConfig) setAutoBackupConfig(savedData.autoBackupConfig);
          if (savedData.externalLinks) setExternalLinks(prev => ({ ...prev, ...savedData.externalLinks }));
          if (savedData.dayTransitionTime) setDayTransitionTime(savedData.dayTransitionTime);
          if (savedData.dayTransitionTime) setDayTransitionTime(savedData.dayTransitionTime);
          if (savedData.makeupLinks) setMakeupLinks(savedData.makeupLinks);
          if (savedData.showMakeupLines !== undefined) setShowMakeupLines(savedData.showMakeupLines);
          if (savedData.whatsappTarget) setWhatsappTarget(savedData.whatsappTarget);
          if (savedData.studentProgress) setStudentProgress(savedData.studentProgress);
          if (savedData.preferredModes) setPreferredModes(savedData.preferredModes);
          if (savedData.lastReports) setLastReports(savedData.lastReports);
          if (savedData.defaultNoorBook) setDefaultNoorBook(savedData.defaultNoorBook);
          if (savedData.savedReports) setSavedReports(savedData.savedReports);
          if (savedData.savedReportDrafts) setSavedReportDrafts(savedData.savedReportDrafts);
          if (savedData.subscriptionSettings) setSubscriptionSettings(savedData.subscriptionSettings);
          if (savedData.tajweedBank) setTajweedBank(savedData.tajweedBank);
          if (savedData.tajweedAssignments) setTajweedAssignments(savedData.tajweedAssignments);
          if (savedData.tajweedSubmissions) setTajweedSubmissions(savedData.tajweedSubmissions);
          if (savedData.tajweedLessonEditorUiState) setTajweedLessonEditorUiState(savedData.tajweedLessonEditorUiState);
          if (
            savedData.seenUngradedTajweedVersion === SEEN_UNGRADED_TAJWEED_VERSION &&
            Array.isArray(savedData.seenUngradedTajweedAssignmentIds)
          ) {
            const validIds = savedData.seenUngradedTajweedAssignmentIds
              .filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0);
            setSeenUngradedTajweedAssignmentIds(new Set(validIds));
          } else {
            setSeenUngradedTajweedAssignmentIds(new Set());
          }
          if (savedData.confirmNonTodayAttendance !== undefined) setConfirmNonTodayAttendance(savedData.confirmNonTodayAttendance);
          if (savedData.lastUpdated !== undefined) setLastUpdated(savedData.lastUpdated);
        }
      } else {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          try {
            const savedData = JSON.parse(saved);
            if (savedData.students) setStudents(savedData.students);
            if (savedData.attendance) setAttendance(savedData.attendance);
            if (savedData.month !== undefined) setMonth(savedData.month);
            if (savedData.year !== undefined) setYear(savedData.year);
            if (savedData.dayOff !== undefined) setDayOff(savedData.dayOff);
            if (savedData.academyOrder) setAcademyOrder(savedData.academyOrder);
            if (savedData.academyRates) setAcademyRates(savedData.academyRates);
            if (savedData.monthlyObligations) setMonthlyObligations(savedData.monthlyObligations);
            if (savedData.paymentStatus) setPaymentStatus(savedData.paymentStatus);
            if (savedData.externalLinks) setExternalLinks(prev => ({ ...prev, ...savedData.externalLinks }));
            if (savedData.dayTransitionTime) setDayTransitionTime(savedData.dayTransitionTime);
            if (savedData.dayTransitionTime) setDayTransitionTime(savedData.dayTransitionTime);
            if (savedData.makeupLinks) setMakeupLinks(savedData.makeupLinks);
            if (savedData.showMakeupLines !== undefined) setShowMakeupLines(savedData.showMakeupLines);
            if (savedData.whatsappTarget) setWhatsappTarget(savedData.whatsappTarget);
            if (savedData.studentProgress) setStudentProgress(savedData.studentProgress);
            if (savedData.preferredModes) setPreferredModes(savedData.preferredModes);
            if (savedData.lastReports) setLastReports(savedData.lastReports);
            if (savedData.defaultNoorBook) setDefaultNoorBook(savedData.defaultNoorBook);
            if (savedData.savedReports) setSavedReports(savedData.savedReports);
            if (savedData.savedReportDrafts) setSavedReportDrafts(savedData.savedReportDrafts);
            if (savedData.subscriptionSettings) setSubscriptionSettings(savedData.subscriptionSettings);
            if (savedData.tajweedBank) setTajweedBank(savedData.tajweedBank);
            if (savedData.tajweedAssignments) setTajweedAssignments(savedData.tajweedAssignments);
            if (savedData.tajweedSubmissions) setTajweedSubmissions(savedData.tajweedSubmissions);
            if (savedData.tajweedLessonEditorUiState) setTajweedLessonEditorUiState(savedData.tajweedLessonEditorUiState);
            if (
              savedData.seenUngradedTajweedVersion === SEEN_UNGRADED_TAJWEED_VERSION &&
              Array.isArray(savedData.seenUngradedTajweedAssignmentIds)
            ) {
              const validIds = savedData.seenUngradedTajweedAssignmentIds
                .filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0);
              setSeenUngradedTajweedAssignmentIds(new Set(validIds));
            } else {
              setSeenUngradedTajweedAssignmentIds(new Set());
            }
            if (savedData.confirmNonTodayAttendance !== undefined) setConfirmNonTodayAttendance(savedData.confirmNonTodayAttendance);
            if (savedData.lastUpdated !== undefined) setLastUpdated(savedData.lastUpdated);
          } catch (e) {
            console.error("Failed to parse localStorage data", e);
          }
        }
      }
      setIsLoaded(true);
    }
    loadInitialData();
  }, []);

  // Pull Tajweed submissions from cloud portal and merge into local app state.
  useEffect(() => {
    if (!isLoaded) return;

    let isCancelled = false;

    const mergeCloudTajweedData = async () => {
      try {
        // Step 1: Fetch only the IDs (shallow) for both assignments and submissions
        const [assignmentsShallowRes, submissionsShallowRes] = await Promise.all([
          fetch(`${CLOUD_APPSTATE_BASE_URL}/tajweedAssignments.json?shallow=true`),
          fetch(`${CLOUD_APPSTATE_BASE_URL}/tajweedSubmissions.json?shallow=true`),
        ]);

        if (!assignmentsShallowRes.ok || !submissionsShallowRes.ok || isCancelled) return;

        const remoteAssignmentKeys = (await assignmentsShallowRes.json()) || {};
        const remoteSubmissionsKeys = (await submissionsShallowRes.json()) || {};

        if (isCancelled) return;

        // Step 2: Only fetch full data for assignments that are new or not yet graded
        // (graded assignments are final and don't need re-checking)
        const localAssignments = tajweedAssignmentsRef.current;
        const keysToFetch = Object.keys(remoteAssignmentKeys).filter(key => {
          const local = localAssignments[key];
          if (!local) return true;              // New assignment - must fetch
          if (local.status === 'graded') return false; // Already final - skip
          return true;                          // pending/submitted might have changed
        });

        // Step 3: Fetch full assignment data only for needed keys
        const remoteAssignments: Record<string, any> = {};
        if (keysToFetch.length > 0) {
          const fetchPromises = keysToFetch.map(async (key) => {
            try {
              const res = await fetch(`${CLOUD_APPSTATE_BASE_URL}/tajweedAssignments/${key}.json`);
              if (res.ok) {
                const assignment = await res.json();
                if (assignment && !isCancelled) remoteAssignments[key] = assignment;
              }
            } catch (e) {
              console.warn(`Failed to fetch assignment ${key}:`, e);
            }
          });
          await Promise.all(fetchPromises);
        }

        if (isCancelled) return;

        // Find which submission keys we don't have locally
        const localKeys = Object.keys(tajweedSubmissionsRef.current);
        const newKeys = Object.keys(remoteSubmissionsKeys).filter(k => !localKeys.includes(k));

        let remoteSubmissions: Record<string, any> = {};

        if (newKeys.length > 0) {
          console.log(`Found ${newKeys.length} new submissions on cloud. Fetching incrementally...`);
          // Fetch new submissions in parallel
          const fetchPromises = newKeys.map(async (key) => {
            try {
              const res = await fetch(`${CLOUD_APPSTATE_BASE_URL}/tajweedSubmissions/${key}.json`);
              if (res.ok) {
                const sub = await res.json();
                if (sub && !isCancelled) {
                  remoteSubmissions[key] = sub;
                }
              }
            } catch (e) {
              console.warn(`Failed to fetch submission ${key}:`, e);
            }
          });
          await Promise.all(fetchPromises);
        }

        if (isCancelled) return;

        if (Object.keys(remoteSubmissions).length > 0) {
          setTajweedSubmissions(prev => {
            const next = { ...prev };
            let changed = false;

            Object.entries(remoteSubmissions).forEach(([submissionId, rawSubmission]) => {
              if (!rawSubmission || !rawSubmission.assignmentId || !rawSubmission.studentId) return;

              const normalizedSubmission = {
                ...rawSubmission,
                id: rawSubmission.id || submissionId,
              } as import('./types').TajweedSubmission;

              const existing = next[submissionId];
              if (!existing) {
                next[submissionId] = normalizedSubmission;
                changed = true;
                return;
              }

              const existingAnswersCount = Array.isArray(existing.answers) ? existing.answers.length : 0;
              const remoteAnswersCount = Array.isArray(normalizedSubmission.answers) ? normalizedSubmission.answers.length : 0;
              if (existingAnswersCount === 0 && remoteAnswersCount > 0) {
                next[submissionId] = { ...existing, ...normalizedSubmission };
                changed = true;
              }
            });

            return changed ? next : prev;
          });
        }

        const remoteSubmissionIdByAssignment = new Map<string, string>();
        
        // Populate from local submissions first
        Object.entries(tajweedSubmissionsRef.current).forEach(([submissionId, sub]) => {
          if (sub && sub.assignmentId) {
            remoteSubmissionIdByAssignment.set(sub.assignmentId, sub.id || submissionId);
          }
        });

        // Add/overwrite from newly fetched remoteSubmissions
        Object.entries(remoteSubmissions).forEach(([submissionId, rawSubmission]) => {
          const assignmentId = rawSubmission?.assignmentId;
          if (!assignmentId) return;
          remoteSubmissionIdByAssignment.set(assignmentId, rawSubmission.id || submissionId);
        });

        setTajweedAssignments(prev => {
          const next = { ...prev };
          let changed = false;

          Object.entries(remoteAssignments as Record<string, any>).forEach(([assignmentId, rawAssignment]) => {
            if (!rawAssignment || !rawAssignment.studentId || !rawAssignment.lessonId) return;

            const remoteStatus = (rawAssignment.status || 'pending') as 'pending' | 'submitted' | 'graded';
            const remoteSubmissionId = rawAssignment.submissionId || remoteSubmissionIdByAssignment.get(assignmentId);
            const normalizedAssignment = {
              ...rawAssignment,
              id: rawAssignment.id || assignmentId,
              status: remoteStatus,
              submissionId: remoteSubmissionId,
            } as import('./types').TajweedAssignment;

            const existing = next[assignmentId];
            if (!existing) {
              next[assignmentId] = normalizedAssignment;
              changed = true;
              return;
            }

            const localStatus = (existing.status || 'pending') as 'pending' | 'submitted' | 'graded';
            const mergedStatus = TAJWEED_STATUS_RANK[remoteStatus] > TAJWEED_STATUS_RANK[localStatus]
              ? remoteStatus
              : localStatus;
            const mergedSubmissionId = existing.submissionId || remoteSubmissionId;
            const mergedAssignedAt = Math.max(existing.assignedAt || 0, normalizedAssignment.assignedAt || 0);

            const hasChange =
              mergedStatus !== existing.status ||
              mergedSubmissionId !== existing.submissionId ||
              mergedAssignedAt !== existing.assignedAt;

            if (hasChange) {
              next[assignmentId] = {
                ...existing,
                ...normalizedAssignment,
                status: mergedStatus,
                submissionId: mergedSubmissionId,
                assignedAt: mergedAssignedAt,
              };
              changed = true;
            }
          });

          return changed ? next : prev;
        });
      } catch (err) {
        console.warn('Cloud Tajweed sync skipped:', err);
      }
    };

    mergeCloudTajweedData();
    const syncInterval = window.setInterval(mergeCloudTajweedData, 90_000);

    return () => {
      isCancelled = true;
      window.clearInterval(syncInterval);
    };
  }, [isLoaded]);

  // --- Sync IPC Listener ---
  useEffect(() => {
    if (window.electronAPI?.onCloudSyncSuccess) {
      window.electronAPI.onCloudSyncSuccess((timestamp: number) => {
        setLastUpdated(timestamp);
      });
      return () => {
        if (window.electronAPI?.offCloudSyncSuccess) {
          window.electronAPI.offCloudSyncSuccess();
        }
      };
    }
  }, []);

  // --- Real-time Cloud Sync for Core State ---
  useEffect(() => {
    if (!isLoaded) return;
    let isCancelled = false;

    const pollCloudChanges = async () => {
      try {
        const res = await fetch(`${CLOUD_APPSTATE_BASE_URL}/lastUpdated.json`);
        if (!res.ok || isCancelled) return;
        
        const remoteLastUpdated = await res.json();
        
        // Ensure we are not currently syncing local changes before attempting an overwrite
        if (window.electronAPI?.getSyncStatus) {
          const syncStatus = await window.electronAPI.getSyncStatus();
          if (syncStatus.isSyncing || syncStatus.hasPending) {
            console.log('Local changes pending. Skipping cloud poll to prevent overwriting local state.');
            return;
          }
        }

        // If remote timestamp is newer than our local state, fetch the lightweight core state
        if (remoteLastUpdated && typeof remoteLastUpdated === 'number' && remoteLastUpdated > lastUpdated) {
          console.log(`Cloud state is newer (${remoteLastUpdated} > ${lastUpdated}). Fetching core updates...`);
          
          const fullRes = await fetch(`${CLOUD_APPSTATE_BASE_URL}.json`);
          const fullData = await fullRes.json();
          
          if (isCancelled) return;

          // DOUBLE CHECK: Did the user make any local changes WHILE we were fetching?
          // If so, ABORT to prevent overwriting their new rapid changes!
          if (window.electronAPI?.getSyncStatus) {
            const syncStatus = await window.electronAPI.getSyncStatus();
            if (syncStatus.isSyncing || syncStatus.hasPending || (Date.now() - lastLocalActionTime.current < 5000)) {
              console.log('Local changes were made recently! Aborting cloud state overwrite.');
              return;
            }
          } else if (Date.now() - lastLocalActionTime.current < 5000) {
            console.log('Local changes were made recently! Aborting cloud state overwrite.');
            return;
          }

          if (fullData) {
            if (fullData.students) setStudents(fullData.students);
            if (fullData.attendance) setAttendance(fullData.attendance);
            if (fullData.month !== undefined && fullData.month !== null) setMonth(fullData.month);
            if (fullData.year !== undefined && fullData.year !== null) setYear(fullData.year);
            if (fullData.dayOff !== undefined && fullData.dayOff !== null) setDayOff(fullData.dayOff);
            if (fullData.academyOrder) setAcademyOrder(fullData.academyOrder);
            if (fullData.academyRates) setAcademyRates(fullData.academyRates);
            if (fullData.monthlyObligations) setMonthlyObligations(fullData.monthlyObligations);
            if (fullData.paymentStatus) setPaymentStatus(fullData.paymentStatus);
            if (fullData.makeupLinks) setMakeupLinks(fullData.makeupLinks);
            if (fullData.showMakeupLines !== undefined && fullData.showMakeupLines !== null) setShowMakeupLines(fullData.showMakeupLines);
            
            // New additions for full sync
            if (fullData.savedReports) setSavedReports(fullData.savedReports);
            if (fullData.savedReportDrafts) setSavedReportDrafts(fullData.savedReportDrafts);
            if (fullData.lastReports) setLastReports(fullData.lastReports);
            if (fullData.autoBackupConfig) setAutoBackupConfig(fullData.autoBackupConfig);
            if (fullData.externalLinks) setExternalLinks(fullData.externalLinks);
            if (fullData.dayTransitionTime) setDayTransitionTime(fullData.dayTransitionTime);
            if (fullData.confirmNonTodayAttendance !== undefined) setConfirmNonTodayAttendance(fullData.confirmNonTodayAttendance);
            if (fullData.whatsappTarget) setWhatsappTarget(fullData.whatsappTarget);
            if (fullData.studentProgress) setStudentProgress(fullData.studentProgress);
            if (fullData.preferredModes) setPreferredModes(fullData.preferredModes);
            if (fullData.defaultNoorBook) setDefaultNoorBook(fullData.defaultNoorBook);
            if (fullData.subscriptionSettings) setSubscriptionSettings(fullData.subscriptionSettings);
            if (fullData.tajweedBank) setTajweedBank(fullData.tajweedBank);
            if (fullData.tajweedAssignments) setTajweedAssignments(fullData.tajweedAssignments);
            if (fullData.tajweedSubmissions) setTajweedSubmissions(fullData.tajweedSubmissions);
            if (fullData.tajweedLessonEditorUiState) setTajweedLessonEditorUiState(fullData.tajweedLessonEditorUiState);
          }

          setLastUpdated(remoteLastUpdated);

          // Force an immediate save to local disk, but skip pushing back to Firebase
          if (window.electronAPI && fullData) {
            window.electronAPI.saveData({
              students: fullData.students || students,
              attendance: fullData.attendance || attendance,
              month: fullData.month !== null && fullData.month !== undefined ? fullData.month : month,
              year: fullData.year !== null && fullData.year !== undefined ? fullData.year : year,
              dayOff: fullData.dayOff !== null && fullData.dayOff !== undefined ? fullData.dayOff : dayOff,
              academyOrder: fullData.academyOrder || academyOrder,
              academyRates: fullData.academyRates || academyRates,
              monthlyObligations: fullData.monthlyObligations || monthlyObligations,
              paymentStatus: fullData.paymentStatus || paymentStatus,
              makeupLinks: fullData.makeupLinks || makeupLinks,
              showMakeupLines: fullData.showMakeupLines !== null && fullData.showMakeupLines !== undefined ? fullData.showMakeupLines : showMakeupLines,
              autoBackupConfig: fullData.autoBackupConfig || autoBackupConfig,
              externalLinks: fullData.externalLinks || externalLinks,
              dayTransitionTime: fullData.dayTransitionTime || dayTransitionTime,
              confirmNonTodayAttendance: fullData.confirmNonTodayAttendance !== undefined ? fullData.confirmNonTodayAttendance : confirmNonTodayAttendance,
              whatsappTarget: fullData.whatsappTarget || whatsappTarget,
              studentProgress: fullData.studentProgress || studentProgress,
              preferredModes: fullData.preferredModes || preferredModes,
              lastReports: fullData.lastReports || lastReports,
              defaultNoorBook: fullData.defaultNoorBook || defaultNoorBook,
              savedReports: fullData.savedReports || savedReports,
              savedReportDrafts: fullData.savedReportDrafts || savedReportDrafts,
              subscriptionSettings: fullData.subscriptionSettings || subscriptionSettings,
              tajweedBank: fullData.tajweedBank || tajweedBank,
              tajweedAssignments: fullData.tajweedAssignments || tajweedAssignments,
              tajweedSubmissions: fullData.tajweedSubmissions || tajweedSubmissions,
              tajweedLessonEditorUiState: fullData.tajweedLessonEditorUiState || tajweedLessonEditorUiState,
              seenUngradedTajweedVersion: SEEN_UNGRADED_TAJWEED_VERSION,
              seenUngradedTajweedAssignmentIds: Array.from(seenUngradedTajweedAssignmentIds),
              
              lastUpdated: remoteLastUpdated,
            }, true); // true = skipSync
          }
        }
      } catch (err) {
        console.warn('Background sync check failed:', err);
      }
    };

    // Run first check immediately, then poll every 30 seconds
    pollCloudChanges();
    const pollInterval = window.setInterval(pollCloudChanges, 30_000);

    return () => {
      isCancelled = true;
      window.clearInterval(pollInterval);
    };
  }, [isLoaded, lastUpdated]);


  // UI State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedStudentForDetails, setSelectedStudentForDetails] = useState<Student | null>(null);
  const [selectedAcademyForDetails, setSelectedAcademyForDetails] = useState<string | null>(null);
  const [selectedAcademyForEditing, setSelectedAcademyForEditing] = useState<string | null>(null);
  const [isAddingAcademy, setIsAddingAcademy] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [showMonthSelector, setShowMonthSelector] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMonthlyStatsOpen, setIsMonthlyStatsOpen] = useState(false);
  const [isLastMonthStatsOpen, setIsLastMonthStatsOpen] = useState(false);


  const [actionConfigModal, setActionConfigModal] = useState<{
    isOpen: boolean;
    target: '30m' | '60m' | 'partnership' | 'expenses';
    initialConfig: { type: 'copy' | 'link'; copyVal: string; linkVal: string; };
  }>({
    isOpen: false,
    target: '30m',
    initialConfig: { type: 'link', copyVal: '', linkVal: '' }
  });

  const [actionChoiceModal, setActionChoiceModal] = useState<{
    isOpen: boolean;
    title: string;
    target: '30m' | '60m';
  }>({
    isOpen: false,
    title: '',
    target: '30m'
  });

  const [simpleInputModal, setSimpleInputModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    initialValue: string;
    targetField: 'link30m_copyVal' | 'link30m_linkVal' | 'link60m_copyVal' | 'link60m_linkVal' | null;
  }>({
    isOpen: false,
    title: '',
    description: '',
    initialValue: '',
    targetField: null
  });

  const [webModal, setWebModal] = useState<{
    isOpen: boolean;
    url: string;
    title: string;
  }>({ isOpen: false, url: '', title: '' });

  const [toast, setToast] = useState<{ message: string; show: boolean }>({ message: '', show: false });

  const showToast = (msg: string) => {
    setToast({ message: msg, show: true });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 2500);
  };

  const handleOpenLink = (url: string, title: string = '') => {
    if (!url) {
      showToast('لا يوجد رابط للفتح ⚠️');
      return;
    }
    setWebModal({ isOpen: true, url, title });
  };

  const buildStudentPortalUrl = (student: Student) => {
    const arabicToLatin: Record<string, string> = {
      'ا': 'a', 'أ': 'a', 'إ': 'e', 'آ': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th',
      'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z',
      'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a',
      'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
      'ه': 'h', 'ة': 'a', 'و': 'w', 'ي': 'y', 'ى': 'a', 'ئ': 'e', 'ؤ': 'o'
    };

    let transliteratedName = student.name.toLowerCase().trim();
    for (const [ar, en] of Object.entries(arabicToLatin)) {
      transliteratedName = transliteratedName.replace(new RegExp(ar, 'g'), en);
    }

    const nameSlug = transliteratedName.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const portalUrl = nameSlug
      ? `https://quranreport.vercel.app/${nameSlug}`
      : `https://quranreport.vercel.app/?student=${student.id}`;

    return withStudentPortalRefresh(portalUrl);
  };

  // Helper to check and open link after report
  const checkAndOpenLink = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    const meetingLink = student?.externalLink || (student ? academyRates[student.academy]?.externalLink : null);
    if (meetingLink) {
      const refreshedMeetingLink = withStudentPortalRefresh(meetingLink);
      const shouldOpenExternally = student ? (academyRates[student.academy] as any)?.openLinksExternally : false;
      if (shouldOpenExternally) {
        openExternalLink(refreshedMeetingLink);
      } else {
        handleOpenLink(refreshedMeetingLink, `رابط الحصة: ${student?.name || ''}`);
      }
    }
  };

  const [academyContextMenu, setAcademyContextMenu] = useState<{
    isOpen: boolean;
    isClosing: boolean;
    x: number;
    y: number;
    academy: string;
  }>({ isOpen: false, isClosing: false, x: 0, y: 0, academy: '' });

  // --- Student Drag & Drop State ---
  const [draggedStudentId, setDraggedStudentId] = useState<string | null>(null);
  const [studentDragOverId, setStudentDragOverId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{ id: string; position: 'top' | 'bottom' } | null>(null);

  // --- Missed Classes Context Menu ---
  const [missedContextMenu, setMissedContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    studentId: string;
    studentName: string;
  }>({ isOpen: false, x: 0, y: 0, studentId: '', studentName: '' });


  // --- Multi-Student Selection State ---
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [isTajweedShortcutPressed, setIsTajweedShortcutPressed] = useState(false);
  const [isEditReportShortcutPressed, setIsEditReportShortcutPressed] = useState(false);
  const [hoveredCellKey, setHoveredCellKey] = useState<string | null>(null);
  const longPressTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const longPressTriggeredRef = React.useRef<boolean>(false);
  const [selectedStudentsForCombinedReport, setSelectedStudentsForCombinedReport] = useState<Student[] | null>(null);

  // --- Student Search State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [searchHistoryIndex, setSearchHistoryIndex] = useState<number>(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const closeSearchAndSaveHistory = useCallback((query: string) => {
    setIsSearchOpen(false);
    if (query.trim()) {
      setSearchHistory(prev => {
        if (prev[prev.length - 1] === query.trim()) return prev;
        return [...prev, query.trim()];
      });
      setSearchHistoryIndex(-1);
    }
  }, []);

  // --- Missed Classes Context Menu ---
  const [missedClassesMenu, setMissedClassesMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    studentId: string;
  } | null>(null);

  // Global Keyboard Shortcuts (T for Tajweed, E/Shift for Edit Mode)
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;

      const key = String(event.key || '').toLowerCase();
      const code = event.code;

      // Toggle Missed Count Display (Ctrl+D)
      if ((event.ctrlKey || event.metaKey) && (code === 'KeyD' || key === 'd' || key === 'ي')) {
        event.preventDefault();
        setShowMissedCount(prev => !prev);
        return;
      }

      // Tajweed Grading Shortcut (T)
      if (code === 'KeyT' || key === 't' || key === 'ف' || key === 'ت') {
        setIsTajweedShortcutPressed(true);
      }

      // Edit Report Shortcut (E or Shift)
      if (code === 'KeyE' || key === 'e' || key === 'ث' || event.shiftKey) {
        setIsEditReportShortcutPressed(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = String(event.key || '').toLowerCase();
      const code = event.code;

      // Tajweed Grading Shortcut (T)
      if (code === 'KeyT' || key === 't' || key === 'ف' || key === 'ت') {
        setIsTajweedShortcutPressed(false);
      }

      // Edit Report Shortcut (E or Shift)
      // Note: we check shiftKey on keyDown, but for keyUp we must be careful.
      // If they release E or they release Shift, we should check.
      if (code === 'KeyE' || key === 'e' || key === 'ث' || !event.shiftKey) {
        // If it's the shift key being released OR the E/ArabicE key
        if (code === 'KeyE' || key === 'e' || key === 'ث' || key === 'shift') {
           setIsEditReportShortcutPressed(false);
        }
      }
    };

    const handleWindowBlur = () => {
      setIsTajweedShortcutPressed(false);
      setIsEditReportShortcutPressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, []);

  // --- Makeup Class Linking ---
  const [makeupLinks, setMakeupLinks] = useState<MakeupLink[]>([]);

  const [makeupLinkingMode, setMakeupLinkingMode] = useState<{
    isLoading: boolean;
    active: boolean;
    studentId: string | null;
  }>({ isLoading: false, active: false, studentId: null });

  // Handle internal navigation from main process (intercepted links)
  useEffect(() => {
    if (window.electronAPI?.onNavigateInternal) {
      window.electronAPI.onNavigateInternal((url: string) => {
        handleOpenLink(url, webModal.isOpen ? webModal.title : '');
      });
      return () => {
        window.electronAPI.offNavigateInternal?.();
      };
    }
  }, [handleOpenLink, webModal.isOpen, webModal.title]);

  // Load students + attendance from JSON on mount
  const [hoveredMakeupLink, setHoveredMakeupLink] = useState<string | null>(null);

  // --- Smart Report Modal State ---
  const [smartReportModal, setSmartReportModal] = useState<{
    isOpen: boolean;
    studentId: string;
    dayNum: number;
    undoSnapshot?: any;
    isEditMode?: boolean;
  } | null>(null);

  // Smart Report Modal Section Navigation Shortcuts (A/D)
  useEffect(() => {
    if (!smartReportModal?.isOpen) return;

    const handleModalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      if (e.code === 'KeyA' || e.code === 'KeyD') {
        if (!smartReportModal?.studentId) return;
        e.preventDefault();
        const toQuran = reportPath !== 'quran';
        setReportPath(toQuran ? 'quran' : 'noor');
        if (!toQuran) setVisitedNoor(true);
        setLastReports(prev => ({
          ...prev,
          [smartReportModal.studentId]: { ...prev[smartReportModal.studentId], activeSection: toQuran ? 'quran' : 'noor' }
        }));
      }
    };

    window.addEventListener('keydown', handleModalKeyDown, true);
    return () => window.removeEventListener('keydown', handleModalKeyDown, true);
  }, [smartReportModal?.isOpen, smartReportModal?.studentId, reportPath]);


  // --- Smart Surah End UI Badge (State-driven, zero DOM ID guessing) ---
  useEffect(() => {
    if (!smartReportModal?.isOpen) {
      document.querySelectorAll('.end-badge-ui').forEach(b => b.remove());
      return;
    }
    const studentId = smartReportModal.studentId;
    const report = lastReports[studentId];
    if (!report) return;

    const checks: { id: string; surah: string | undefined; ayah: string | undefined }[] = [
      { id: 'quran-new-to-ayah',    surah: report.readingNew?.toSurah    || report.readingNew?.surah,    ayah: report.readingNew?.toAyah },
      { id: 'quran-rev-to-ayah',    surah: report.readingRev?.toSurah    || report.readingRev?.surah,    ayah: report.readingRev?.toAyah },
      { id: 'quran-oldrev-to-ayah', surah: report.readingOldRev?.toSurah || report.readingOldRev?.surah, ayah: report.readingOldRev?.toAyah },
      { id: 'quran-tilawa-to-ayah', surah: report.readingTilawa?.toSurah || report.readingTilawa?.surah, ayah: report.readingTilawa?.toAyah },
      { id: 'hw-new-to',            surah: report.homeworkNew?.toSurah   || report.homeworkNew?.surah,   ayah: report.homeworkNew?.to },
      { id: 'hw-rev-to',            surah: report.homeworkRev?.toSurah   || report.homeworkRev?.surah,   ayah: report.homeworkRev?.to },
      { id: 'hw-oldrev-to',         surah: report.homeworkOldRev?.toSurah|| report.homeworkOldRev?.surah,ayah: report.homeworkOldRev?.to },
      { id: 'hw-tilawa-to',         surah: report.homeworkTilawa?.toSurah|| report.homeworkTilawa?.surah,ayah: report.homeworkTilawa?.to },
    ];

    checks.forEach(({ id, surah, ayah }) => {
      // querySelectorAll handles duplicate IDs — pick the visible one
      const candidates = Array.from(document.querySelectorAll(`#${id}`)) as HTMLInputElement[];
      const input = candidates.find(el => el.offsetParent !== null) || candidates[0];
      if (!input) return;

      const parent = input.parentElement;
      if (!parent) return;
      let badge = parent.querySelector('.end-badge-ui') as HTMLElement | null;
      let isEnd = false;

      // Fallback: read surah from dom hidden select if state is missing
      const domSurahId = id.replace('-to-ayah', '-surah-select').replace(/-to$/, '-surah-select');
      const resolvedSurah = surah || (document.getElementById(domSurahId) as HTMLInputElement | null)?.value;

      if (resolvedSurah && ayah) {
        const sName = resolvedSurah.replace('سورة ', '').trim();
        const sIdx = SURAHS.indexOf(sName);
        if (sIdx > -1) {
          const val = parseInt(String(ayah).replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]));
          if (!isNaN(val) && val === SURAH_AYAH_COUNTS[sIdx]) isEnd = true;
        }
      }
      if (isEnd) {
        if (!badge) {
          parent.style.position = 'relative';
          badge = document.createElement('span');
          badge.className = 'end-badge-ui absolute left-2 bottom-1 text-[15px] text-emerald-600 font-arabic pointer-events-none font-medium z-10';
          badge.innerText = 'نهاية السورة';
          parent.appendChild(badge);
        }
      } else if (badge) {
        badge.remove();
      }
    });
  }, [lastReports, smartReportModal?.isOpen, smartReportModal?.studentId]);

  // --- Saved Reports State (for viewing past reports) ---
  const [savedReports, setSavedReports] = useState<Record<string, string>>({});
  const [savedReportDrafts, setSavedReportDrafts] = useState<Record<string, any>>({});
  const [savedReportViewModal, setSavedReportViewModal] = useState<{
    isOpen: boolean;
    studentId: string;
    studentName: string;
    dayNum: number;
    report: string;
  } | null>(null);

  // --- Pending Attendance Confirmation (for non-today cells) ---
  const [pendingToggle, setPendingToggle] = useState<{
    studentId: string;
    dayNum: number;
    isShift: boolean;
    isAlt: boolean;
    isCtrl: boolean;
    x: number;
    y: number;
  } | null>(null);

  // Effect: Handle Enter/Escape for pending attendance confirmation
  useEffect(() => {
    if (!pendingToggle) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const { studentId, dayNum, isShift, isAlt, isCtrl } = pendingToggle;
        setPendingToggle(null);
        // Execute the deferred toggle by calling with a bypass flag
        toggleStatusConfirmed(studentId, dayNum, isShift, isAlt, isCtrl);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setPendingToggle(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [pendingToggle]);

  // Effect: Lock body scroll when specific modals are open
  useEffect(() => {
    if (smartReportModal?.isOpen || webModal.isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [smartReportModal?.isOpen, webModal.isOpen]);

  // Effect: Reset section toggles when opening Smart Report Modal
  useEffect(() => {
    if (smartReportModal?.isOpen) {
      const studentId = smartReportModal.studentId;
      const isEditMode = smartReportModal.isEditMode === true;
      const lastReport = lastReports[studentId];
      const savedToggles = lastReport?.sectionToggles;

      // If student has saved section toggles, restore them
      // Otherwise, if no report exists, disable all sections by default
      if (savedToggles) {
        setSectionToggles({
          readingNew: savedToggles.readingNew ?? false,
          readingRev: savedToggles.readingRev ?? false,
          readingOldRev: savedToggles.readingOldRev ?? false,
          readingTilawa: savedToggles.readingTilawa ?? false,
          homeworkNew: savedToggles.homeworkNew ?? false,
          homeworkRev: savedToggles.homeworkRev ?? false,
          homeworkOldRev: savedToggles.homeworkOldRev ?? false,
          homeworkTilawa: savedToggles.homeworkTilawa ?? false,
          quranTajweed: savedToggles.quranTajweed ?? false
        });
      } else {
        setSectionToggles({
          readingNew: false,
          readingRev: false,
          readingOldRev: false,
          readingTilawa: false,
          homeworkNew: false,
          homeworkRev: false,
          homeworkOldRev: false,
          homeworkTilawa: false,
          quranTajweed: false
        });
      }

      // Restore Noor Details (Zawa'id) Toggles
      if (lastReport?.noorDetails) {
        setNoorDetails(lastReport.noorDetails);
      } else {
        setNoorDetails({ tam: false, sayatim: false });
      }

      // Restore Active Section
      let initialPath: 'quran' | 'noor' | 'tajweed' = 'quran';
      if (lastReport?.activeSection) {
        if (lastReport.activeSection === 'noor' && lastReport.mergeWithQuran) {
          initialPath = 'quran';
        } else if (lastReport.activeSection === 'tajweed') {
          initialPath = 'quran';
        } else {
          initialPath = lastReport.activeSection;
        }
      }
      setReportPath(initialPath);

      if (lastReport?.tajweed) {
        setSelectedTajweedLessonId(lastReport.tajweed.lessonId || tajweedLessons[0]?.id || '');
        setSelectedTajweedTopicGroup((lastReport.tajweed.topicGroup as typeof TAJWEED_TOPIC_GROUPS[number]['id']) || 'foundation');
        setSelectedTajweedTopic(lastReport.tajweed.topic || TAJWEED_TOPIC_GROUPS[0].topics[0]);
      } else {
        setSelectedTajweedLessonId(tajweedLessons[0]?.id || '');
        setSelectedTajweedTopicGroup('foundation');
        setSelectedTajweedTopic(TAJWEED_TOPIC_GROUPS[0].topics[0]);
      }

      // Restore WhatsApp Toggle
      if (typeof lastReport?.sendViaWhatsapp === 'boolean') {
        setSendViaWhatsapp(lastReport.sendViaWhatsapp);
      } else {
        setSendViaWhatsapp(false);
      }

      // Restore Merge with Quran Toggle (per student)
      if (typeof lastReport?.mergeWithQuran === 'boolean') {
        setMergeWithQuran(lastReport.mergeWithQuran);
      } else {
        setMergeWithQuran(false);
      }

      // Reset Noor visit tracking for the new report session
      // Considered visited only if starting directly in Noor section
      setVisitedNoor(initialPath === 'noor');
      setNoorWarningShown(false);

      // Restore Redo and Exclude Toggles in Edit Mode, otherwise reset them
      if (isEditMode) {
        setIsRedoMode(lastReport?.isRedoMode ?? false);
        setIsRedoModeRev(lastReport?.isRedoModeRev ?? false);
        setIsRedoModeOldRev(lastReport?.isRedoModeOldRev ?? false);
        setIsRedoModeTilawa(lastReport?.isRedoModeTilawa ?? false);
        setExcludeReadingNew(lastReport?.excludeReadingNew ?? false);
        setExcludeReadingRev(lastReport?.excludeReadingRev ?? false);
        setExcludeReadingOldRev(lastReport?.excludeReadingOldRev ?? false);
        setExcludeReadingTilawa(lastReport?.excludeReadingTilawa ?? false);
        setExcludeHomeworkNew(lastReport?.excludeHomeworkNew ?? false);
        setExcludeHomeworkRev(lastReport?.excludeHomeworkRev ?? false);
        setExcludeHomeworkOldRev(lastReport?.excludeHomeworkOldRev ?? false);
        setExcludeHomeworkTilawa(lastReport?.excludeHomeworkTilawa ?? false);
        setExcludeNoorTam(lastReport?.excludeNoorTam ?? false);
        setExcludeNoorSayatim(lastReport?.excludeNoorSayatim ?? false);
        setExcludeQuranTajweed(lastReport?.excludeQuranTajweed ?? false);
        
        // Backward compatibility for excludeNewFromReport which was previously saved inside homeworkNew
        const fallbackExcludeNew = lastReport?.homeworkNew?.excludeFromReport ?? false;
        setExcludeNewFromReport(lastReport?.excludeNewFromReport ?? fallbackExcludeNew);
        setMasteryDeficiency(lastReport?.homeworkNew?.masteryDeficiency || []);
        setMasteryPanelOpen(false);
        setPrevReportHadExclusion(fallbackExcludeNew);
      } else {
        setIsRedoMode(false);
        setIsRedoModeRev(false);
        setIsRedoModeOldRev(false);
        setIsRedoModeTilawa(false);
        setExcludeReadingNew(false);
        setExcludeReadingRev(false);
        setExcludeReadingOldRev(false);
        setExcludeReadingTilawa(false);
        setExcludeHomeworkNew(false);
        setExcludeHomeworkRev(false);
        setExcludeHomeworkOldRev(false);
        setExcludeHomeworkTilawa(false);
        setExcludeNoorTam(false);
        setExcludeNoorSayatim(false);
        setExcludeQuranTajweed(false);
        setExcludeNewFromReport(false);
        setMasteryDeficiency([]);
        setMasteryPanelOpen(false);
        setPrevReportHadExclusion(false);
      }

      // Restore Custom Notes and Audio Link in Edit Mode
      if (isEditMode) {
        if (lastReport?.customNotes) {
          setShowNotesInput(true);
          setCustomNotesText(lastReport.customNotes);
        } else {
          setShowNotesInput(false);
          setCustomNotesText('');
        }
        setAudioLinkText(lastReport?.audioLink || '');
      } else {
        setShowNotesInput(false);
        setCustomNotesText('');
        setAudioLinkText('');
      }

      // CARRY-OVER: Copy Homework → Reading (All sections in one update)
      // This auto-populates "What Was Done" with the previous "What Will Be Done"
      // Skip carry-over in edit mode: we want the saved report data as-is
      const hasAnyHomework = !isEditMode && (lastReport?.homeworkNew || lastReport?.homeworkRev || lastReport?.homeworkOldRev || lastReport?.homeworkTilawa);

      if (hasAnyHomework) {
        setLastReports(prev => {
          const updates: any = {};

          // Copy Homework New → Reading New
          if (lastReport?.homeworkNew) {
            const hw = lastReport.homeworkNew;
            updates.readingNew = {
              ...prev[studentId]?.readingNew,
              mode: hw.mode,
              surah: hw.surah,
              fromSurah: hw.fromSurah,
              toSurah: hw.toSurah,
              fromAyah: hw.mode === 'ayah' ? hw.from : '',
              toAyah: hw.mode === 'ayah' ? hw.to : '',
              fromPage: hw.mode === 'page' ? hw.from : '',
              toPage: hw.mode === 'page' ? hw.to : '',
              fromJuz: hw.mode === 'juz' ? hw.from : '',
              toJuz: hw.mode === 'juz' ? hw.to : '',
              fromHizb: hw.mode === 'hizb' ? hw.from : '',
              toHizb: hw.mode === 'hizb' ? hw.to : '',
              isAdvancedAyah: hw.isAdvancedAyah
            };

            // Auto-advance Homework New: from = previous to + 1, to = empty
            if (hw.mode === 'ayah' && hw.to) {
              const toWestern = toEnglish(hw.to);
              const toAyah = parseInt(toWestern);
              const surahName = hw.isAdvancedAyah ? (hw.toSurah || hw.surah) : hw.surah;
              const surahIndex = SURAHS.indexOf(surahName);
              const maxAyah = surahIndex >= 0 ? SURAH_AYAH_COUNTS[surahIndex] : 999;

              let advancedFrom: string;
              let advancedSurah = surahName;
              let advancedFromSurah = surahName;

              if (!isNaN(toAyah) && toAyah >= maxAyah && surahIndex < SURAHS.length - 1) {
                // Move to next surah
                advancedSurah = SURAHS[surahIndex + 1];
                advancedFromSurah = SURAHS[surahIndex + 1];
                advancedFrom = toHindiDigits('1');
              } else {
                advancedFrom = !isNaN(toAyah) ? toHindiDigits(String(toAyah + 1)) : '';
              }

              updates.homeworkNew = {
                ...hw,
                from: advancedFrom,
                to: '',
                surah: advancedSurah,
                fromSurah: advancedFromSurah,
                toSurah: advancedSurah,
              };
            } else if (hw.mode === 'page' && hw.to) {
              const toWestern = toEnglish(hw.to);
              const toPage = parseInt(toWestern);
              updates.homeworkNew = {
                ...hw,
                from: !isNaN(toPage) ? toHindiDigits(String(toPage + 1)) : '',
                to: '',
              };
            } else if (hw.mode === 'juz' && hw.to) {
              const toWestern = toEnglish(hw.to);
              const toJuz = parseInt(toWestern);
              updates.homeworkNew = {
                ...hw,
                from: !isNaN(toJuz) ? toHindiDigits(String(toJuz + 1)) : '',
                to: '',
              };
            } else if (hw.mode === 'hizb' && hw.to) {
              const toWestern = toEnglish(hw.to);
              const toHizb = parseInt(toWestern);
              updates.homeworkNew = {
                ...hw,
                from: !isNaN(toHizb) ? toHindiDigits(String(toHizb + 1)) : '',
                to: '',
              };
            }
          }

          // Copy Homework Revision → Reading Revision
          if (lastReport?.homeworkRev) {
            const hw = lastReport.homeworkRev;
            updates.readingRev = {
              ...prev[studentId]?.readingRev,
              mode: hw.mode,
              surah: hw.surah,
              fromSurah: hw.fromSurah,
              toSurah: hw.toSurah,
              fromAyah: hw.mode === 'ayah' ? hw.from : '',
              toAyah: hw.mode === 'ayah' ? hw.to : '',
              fromPage: hw.mode === 'page' ? hw.from : '',
              toPage: hw.mode === 'page' ? hw.to : '',
              fromJuz: hw.mode === 'juz' ? hw.from : '',
              toJuz: hw.mode === 'juz' ? hw.to : '',
              fromHizb: hw.mode === 'hizb' ? hw.from : '',
              toHizb: hw.mode === 'hizb' ? hw.to : '',
              isAdvancedAyah: hw.isAdvancedAyah
            };
          }

          // Auto-link: Revision "to" = New "from" - 1
          if (updates.homeworkNew && updates.homeworkNew.mode === 'ayah' && updates.homeworkNew.from) {
            const newFromWestern = parseInt(toEnglish(updates.homeworkNew.from));
            const newFromSurah = updates.homeworkNew.fromSurah || updates.homeworkNew.surah;

            if (!isNaN(newFromWestern)) {
              let revToAyah: string;
              let revToSurah: string;

              if (newFromWestern <= 1) {
                // New starts at ayah 1 → revision goes to last ayah of previous surah
                const newSurahIndex = SURAHS.indexOf(newFromSurah);
                if (newSurahIndex > 0) {
                  revToSurah = SURAHS[newSurahIndex - 1];
                  revToAyah = toHindiDigits(String(SURAH_AYAH_COUNTS[newSurahIndex - 1]));
                } else {
                  revToSurah = newFromSurah;
                  revToAyah = '';
                }
              } else {
                revToSurah = newFromSurah;
                revToAyah = toHindiDigits(String(newFromWestern - 1));
              }

              const existingHwRev = lastReport?.homeworkRev || {};
              updates.homeworkRev = {
                ...existingHwRev,
                to: revToAyah,
                toSurah: revToSurah,
              };
            }
          }


          // Copy Homework Old Revision → Reading Old Revision
          if (lastReport?.homeworkOldRev) {
            const hw = lastReport.homeworkOldRev;
            updates.readingOldRev = {
              ...prev[studentId]?.readingOldRev,
              mode: hw.mode,
              surah: hw.surah,
              fromSurah: hw.fromSurah,
              toSurah: hw.toSurah,
              fromAyah: hw.mode === 'ayah' ? hw.from : '',
              toAyah: hw.mode === 'ayah' ? hw.to : '',
              fromPage: hw.mode === 'page' ? hw.from : '',
              toPage: hw.mode === 'page' ? hw.to : '',
              fromJuz: hw.mode === 'juz' ? hw.from : '',
              toJuz: hw.mode === 'juz' ? hw.to : '',
              fromHizb: hw.mode === 'hizb' ? hw.from : '',
              toHizb: hw.mode === 'hizb' ? hw.to : '',
              isAdvancedAyah: hw.isAdvancedAyah
            };
          }

          // Explicitly Reset Reading Tilawa (Clean Slate)
          const defaultReadingTilawa = {
            mode: 'ayah',
            surah: lastReport?.homeworkTilawa?.surah || SURAHS[0],
            fromSurah: SURAHS[0],
            toSurah: SURAHS[0],
            fromAyah: '',
            toAyah: '',
            fromPage: '',
            toPage: '',
            fromJuz: '',
            toJuz: '',
            fromHizb: '',
            toHizb: '',
            isAdvancedAyah: false
          };

          if (lastReport?.homeworkTilawa) {
            const hw = lastReport.homeworkTilawa;
            updates.readingTilawa = {
              ...defaultReadingTilawa,
              mode: hw.mode,
              surah: hw.surah,
              fromSurah: hw.fromSurah,
              toSurah: hw.toSurah,
              fromAyah: hw.mode === 'ayah' ? hw.from : '',
              toAyah: hw.mode === 'ayah' ? hw.to : '',
              fromPage: hw.mode === 'page' ? hw.from : '',
              toPage: hw.mode === 'page' ? hw.to : '',
              fromJuz: hw.mode === 'juz' ? hw.from : '',
              toJuz: hw.mode === 'juz' ? hw.to : '',
              fromHizb: hw.mode === 'hizb' ? hw.from : '',
              toHizb: hw.mode === 'hizb' ? hw.to : '',
              isAdvancedAyah: hw.isAdvancedAyah
            };

            // AUTO-SYNC: Calculate "what will be done" (homeworkTilawa) from "what was done" (readingTilawa)
            // if there was a 'to' value saved in the previous report.
            if (hw.mode === 'ayah' && hw.to) {
              const toWestern = toEnglish(hw.to);
              const toAyahNum = parseInt(toWestern);
              const surahName = hw.isAdvancedAyah ? (hw.toSurah || hw.surah) : hw.surah;
              const surahIndex = SURAHS.indexOf(surahName);
              const maxAyah = surahIndex >= 0 ? SURAH_AYAH_COUNTS[surahIndex] : 999;

              let advancedFrom: string;
              let advancedSurah = surahName;
              let advancedFromSurah = surahName;

              if (!isNaN(toAyahNum)) {
                if (toAyahNum >= maxAyah && surahIndex < SURAHS.length - 1) {
                  // Move to next surah
                  advancedSurah = SURAHS[surahIndex + 1];
                  advancedFromSurah = SURAHS[surahIndex + 1];
                  advancedFrom = toHindiDigits('1');
                } else {
                  advancedFrom = toHindiDigits(String(toAyahNum + 1));
                }

                updates.homeworkTilawa = {
                  ...hw,
                  from: advancedFrom,
                  to: '',
                  surah: advancedSurah,
                  fromSurah: advancedFromSurah,
                  toSurah: advancedSurah,
                };
              }
            } else if (hw.mode === 'page' && hw.to) {
              const toWestern = toEnglish(hw.to);
              const toPageNum = parseInt(toWestern);
              updates.homeworkTilawa = {
                ...hw,
                from: !isNaN(toPageNum) ? toHindiDigits(String(toPageNum + 1)) : '',
                to: '',
              };
            }
          } else {
            updates.readingTilawa = defaultReadingTilawa;
          }

          return {
            ...prev,
            [studentId]: {
              ...prev[studentId],
              ...updates
            }
          };
        });

        // Sync local state immediately to reflect deeply copied values (Advanced Toggle, Mode, etc.)
        setActiveAdvancedAyah(prev => ({
          ...prev,
          readingNew: lastReport.homeworkNew ? (lastReport.homeworkNew.isAdvancedAyah || false) : prev.readingNew,
          readingRev: lastReport.homeworkRev ? (lastReport.homeworkRev.isAdvancedAyah || false) : prev.readingRev,
          readingOldRev: lastReport.homeworkOldRev ? (lastReport.homeworkOldRev.isAdvancedAyah || false) : prev.readingOldRev,
          readingTilawa: lastReport.homeworkTilawa ? (lastReport.homeworkTilawa.isAdvancedAyah || false) : prev.readingTilawa
        }));

        setPreferredModes(prev => ({
          ...prev,
          readingNew: lastReport.homeworkNew?.mode || prev.readingNew,
          readingRev: lastReport.homeworkRev?.mode || prev.readingRev,
          readingOldRev: lastReport.homeworkOldRev?.mode || prev.readingOldRev,
          readingTilawa: lastReport.homeworkTilawa?.mode || prev.readingTilawa
        }));
      }

      // Map cancellation state: Homework → Reading (COMPLETE DEEP COPY)
      if (lastReport?.cancelledInputs) {
        const mapped: Record<string, boolean> = {};

        // Map New section (mode-aware mapping)
        if (lastReport.homeworkNew) {
          const mode = lastReport.homeworkNew.mode;

          if (mode === 'ayah') {
            if (lastReport.cancelledInputs['hw-new-from']) mapped['quran-new-from-ayah'] = true;
            if (lastReport.cancelledInputs['hw-new-to']) mapped['quran-new-to-ayah'] = true;
          } else if (mode === 'page') {
            if (lastReport.cancelledInputs['hw-new-from']) mapped['quran-new-from-page'] = true;
            if (lastReport.cancelledInputs['hw-new-to']) mapped['quran-new-to-page'] = true;
          } else if (mode === 'juz') {
            if (lastReport.cancelledInputs['hw-new-from']) mapped['quran-new-from-juz'] = true;
            if (lastReport.cancelledInputs['hw-new-to']) mapped['quran-new-to-juz'] = true;
          } else if (mode === 'hizb') {
            if (lastReport.cancelledInputs['hw-new-from']) mapped['quran-new-from-hizb'] = true;
            if (lastReport.cancelledInputs['hw-new-to']) mapped['quran-new-to-hizb'] = true;
          }
        }

        // Map Revision section (mode-aware mapping)
        if (lastReport.homeworkRev) {
          const mode = lastReport.homeworkRev.mode;

          if (mode === 'ayah') {
            if (lastReport.cancelledInputs['hw-rev-from']) mapped['quran-rev-from-ayah'] = true;
            if (lastReport.cancelledInputs['hw-rev-to']) mapped['quran-rev-to-ayah'] = true;
          } else if (mode === 'page') {
            if (lastReport.cancelledInputs['hw-rev-from']) mapped['quran-rev-from-page'] = true;
            if (lastReport.cancelledInputs['hw-rev-to']) mapped['quran-rev-to-page'] = true;
          } else if (mode === 'juz') {
            if (lastReport.cancelledInputs['hw-rev-from']) mapped['quran-rev-from-juz'] = true;
            if (lastReport.cancelledInputs['hw-rev-to']) mapped['quran-rev-to-juz'] = true;
          } else if (mode === 'hizb') {
            if (lastReport.cancelledInputs['hw-rev-from']) mapped['quran-rev-from-hizb'] = true;
            if (lastReport.cancelledInputs['hw-rev-to']) mapped['quran-rev-to-hizb'] = true;
          }
        }


        // Map Old Revision section (mode-aware mapping)
        if (lastReport.homeworkOldRev) {
          const mode = lastReport.homeworkOldRev.mode;

          if (mode === 'ayah') {
            if (lastReport.cancelledInputs['hw-oldrev-from']) mapped['quran-oldrev-from-ayah'] = true;
            if (lastReport.cancelledInputs['hw-oldrev-to']) mapped['quran-oldrev-to-ayah'] = true;
          } else if (mode === 'page') {
            if (lastReport.cancelledInputs['hw-oldrev-from']) mapped['quran-oldrev-from-page'] = true;
            if (lastReport.cancelledInputs['hw-oldrev-to']) mapped['quran-oldrev-to-page'] = true;
          } else if (mode === 'juz') {
            if (lastReport.cancelledInputs['hw-oldrev-from']) mapped['quran-oldrev-from-juz'] = true;
            if (lastReport.cancelledInputs['hw-oldrev-to']) mapped['quran-oldrev-to-juz'] = true;
          } else if (mode === 'hizb') {
            if (lastReport.cancelledInputs['hw-oldrev-from']) mapped['quran-oldrev-from-hizb'] = true;
            if (lastReport.cancelledInputs['hw-oldrev-to']) mapped['quran-oldrev-to-hizb'] = true;
          }
        }

        // Map Tilawa section (mode-aware mapping)
        if (lastReport.homeworkTilawa) {
          const mode = lastReport.homeworkTilawa.mode;

          if (mode === 'ayah') {
            if (lastReport.cancelledInputs['hw-tilawa-from']) mapped['quran-tilawa-from-ayah'] = true;
            if (lastReport.cancelledInputs['hw-tilawa-to']) mapped['quran-tilawa-to-ayah'] = true;
          } else if (mode === 'page') {
            if (lastReport.cancelledInputs['hw-tilawa-from']) mapped['quran-tilawa-from-page'] = true;
            if (lastReport.cancelledInputs['hw-tilawa-to']) mapped['quran-tilawa-to-page'] = true;
          } else if (mode === 'juz') {
            if (lastReport.cancelledInputs['hw-tilawa-from']) mapped['quran-tilawa-from-juz'] = true;
            if (lastReport.cancelledInputs['hw-tilawa-to']) mapped['quran-tilawa-to-juz'] = true;
          } else if (mode === 'hizb') {
            if (lastReport.cancelledInputs['hw-tilawa-from']) mapped['quran-tilawa-from-hizb'] = true;
            if (lastReport.cancelledInputs['hw-tilawa-to']) mapped['quran-tilawa-to-hizb'] = true;
          }
        }

        // Update both local state and lastReports
        if (Object.keys(mapped).length > 0) {
          // Remove old homework cancellations AND old reading cancellations (Clear slate for new session)
          const cleanedCancelled = { ...lastReport.cancelledInputs };

          // Only delete New homework & Old Reading New state if we're carrying over New homework
          if (lastReport.homeworkNew) {
            // Clean Source (Old Homework)
            delete cleanedCancelled['hw-new-from'];
            delete cleanedCancelled['hw-new-to'];

            // Clean Target (Old Reading - prevent ghost shading)
            const keysToClear = [
              'quran-new-from-ayah', 'quran-new-to-ayah',
              'quran-new-from-page', 'quran-new-to-page',
              'quran-new-from-juz', 'quran-new-to-juz',
              'quran-new-from-hizb', 'quran-new-to-hizb'
            ];
            keysToClear.forEach(k => delete cleanedCancelled[k]);
          }

          // Only delete Revision homework & Old Reading Revision state
          if (lastReport.homeworkRev) {
            delete cleanedCancelled['hw-rev-from'];
            delete cleanedCancelled['hw-rev-to'];

            const keysToClear = [
              'quran-rev-from-ayah', 'quran-rev-to-ayah',
              'quran-rev-from-page', 'quran-rev-to-page',
              'quran-rev-from-juz', 'quran-rev-to-juz',
              'quran-rev-from-hizb', 'quran-rev-to-hizb'
            ];
            keysToClear.forEach(k => delete cleanedCancelled[k]);
          }


          // Only delete Old Revision homework & Old Reading Old Revision state
          if (lastReport.homeworkOldRev) {
            delete cleanedCancelled['hw-oldrev-from'];
            delete cleanedCancelled['hw-oldrev-to'];

            const keysToClear = [
              'quran-oldrev-from-ayah', 'quran-oldrev-to-ayah',
              'quran-oldrev-from-page', 'quran-oldrev-to-page',
              'quran-oldrev-from-juz', 'quran-oldrev-to-juz',
              'quran-oldrev-from-hizb', 'quran-oldrev-to-hizb'
            ];
            keysToClear.forEach(k => delete cleanedCancelled[k]);
          }

          // Only delete Tilawa homework & Old Reading Tilawa state
          if (lastReport.homeworkTilawa) {
            delete cleanedCancelled['hw-tilawa-from'];
            delete cleanedCancelled['hw-tilawa-to'];

            const keysToClear = [
              'quran-tilawa-from-ayah', 'quran-tilawa-to-ayah',
              'quran-tilawa-from-page', 'quran-tilawa-to-page',
              'quran-tilawa-from-juz', 'quran-tilawa-to-juz',
              'quran-tilawa-from-hizb', 'quran-tilawa-to-hizb'
            ];
            keysToClear.forEach(k => delete cleanedCancelled[k]);
          }

          // Merge with mapped reading cancellations
          const newCancelled = { ...cleanedCancelled, ...mapped };
          setCancelledInputs(newCancelled);

          setLastReports(prev => ({
            ...prev,
            [studentId]: {
              ...prev[studentId],
              cancelledInputs: newCancelled
            }
          }));
        }
      }
    }
  }, [smartReportModal?.isOpen, smartReportModal?.studentId]);

  useEffect(() => {
    if (smartReportModal?.isOpen && reportPath === 'tajweed') {
      setReportPath('quran');
    }
  }, [smartReportModal?.isOpen, reportPath]);

  const smartReportStudentTajweedHistory = useMemo(() => {
    const studentId = smartReportModal?.studentId;
    if (!studentId) return [] as Array<{
      assignment: import('./types').TajweedAssignment;
      submission: import('./types').TajweedSubmission;
      lesson?: import('./types').TajweedLesson;
    }>;

    const allSubmissions = Object.values(tajweedSubmissions).filter(Boolean);

    return Object.values(tajweedAssignments)
      .filter((assignment) => (
        assignment &&
        assignment.studentId === studentId &&
        (assignment.status === 'submitted' || assignment.status === 'graded')
      ))
      .map((assignment) => {
        const linkedSubmission = assignment.submissionId
          ? tajweedSubmissions[assignment.submissionId]
          : undefined;

        const fallbackSubmission = allSubmissions
          .filter((submission) => (
            submission &&
            submission.assignmentId === assignment.id &&
            submission.studentId === studentId
          ))
          .sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0))[0];

        const submission = linkedSubmission || fallbackSubmission;
        if (!submission) return null;

        return {
          assignment,
          submission,
          lesson: tajweedBank[assignment.lessonId],
        };
      })
      .filter((item): item is {
        assignment: import('./types').TajweedAssignment;
        submission: import('./types').TajweedSubmission;
        lesson?: import('./types').TajweedLesson;
      } => !!item)
      .sort((a, b) => {
        const aDate = a.submission.submittedAt || a.assignment.assignedAt || 0;
        const bDate = b.submission.submittedAt || b.assignment.assignedAt || 0;
        return bDate - aDate;
      });
  }, [smartReportModal?.studentId, tajweedAssignments, tajweedSubmissions, tajweedBank]);


  const [activeAdvancedAyah, setActiveAdvancedAyah] = useState<{
    readingNew: boolean;
    readingRev: boolean;
    readingOldRev: boolean;
    readingTilawa: boolean;
    homeworkNew: boolean;
    homeworkRev: boolean;
    homeworkOldRev: boolean;
    homeworkTilawa: boolean;
  }>({ readingNew: false, readingRev: false, readingOldRev: false, readingTilawa: false, homeworkNew: false, homeworkRev: false, homeworkOldRev: false, homeworkTilawa: false });

  const [isRedoMode, setIsRedoMode] = useState<boolean>(false);
  const [isRedoModeRev, setIsRedoModeRev] = useState<boolean>(false);
  const [isRedoModeOldRev, setIsRedoModeOldRev] = useState<boolean>(false);
  const [isRedoModeTilawa, setIsRedoModeTilawa] = useState<boolean>(false);

  const [excludeReadingNew, setExcludeReadingNew] = useState<boolean>(false);
  const [excludeReadingRev, setExcludeReadingRev] = useState<boolean>(false);
  const [excludeReadingOldRev, setExcludeReadingOldRev] = useState<boolean>(false);
  const [excludeReadingTilawa, setExcludeReadingTilawa] = useState<boolean>(false);
  const [excludeHomeworkRev, setExcludeHomeworkRev] = useState<boolean>(false);
  const [excludeHomeworkOldRev, setExcludeHomeworkOldRev] = useState<boolean>(false);
  const [excludeHomeworkTilawa, setExcludeHomeworkTilawa] = useState<boolean>(false);
  const [excludeHomeworkNew, setExcludeHomeworkNew] = useState<boolean>(false);
  const [excludeNoorTam, setExcludeNoorTam] = useState<boolean>(false);
  const [excludeNoorSayatim, setExcludeNoorSayatim] = useState<boolean>(false);
  const [excludeQuranTajweed, setExcludeQuranTajweed] = useState<boolean>(false);
  const [showNotesInput, setShowNotesInput] = useState<boolean>(false);
  const [customNotesText, setCustomNotesText] = useState<string>('');
  const [audioLinkText, setAudioLinkText] = useState<string>('');


  // Mastery exclusion: exclude new memorization from report and show mastery message
  const [excludeNewFromReport, setExcludeNewFromReport] = useState<boolean>(false);
  const [masteryDeficiency, setMasteryDeficiency] = useState<string[]>([]);
  const [masteryPanelOpen, setMasteryPanelOpen] = useState<boolean>(false);
  const [prevReportHadExclusion, setPrevReportHadExclusion] = useState<boolean>(false); // tracks PREVIOUS report's exclusion — for reading New blur only

  // Hover state for showing report indicator dots on student row
  const [hoveredStudentId, setHoveredStudentId] = useState<string | null>(null);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [cancelledInputs, setCancelledInputs] = useState<Record<string, boolean>>({}); const inputLongPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleInputPointerDown = (id: string) => {
    // Long-press to REMOVE shading only (not add)
    if (cancelledInputs[id]) {
      inputLongPressTimerRef.current = setTimeout(() => {
        // Remove shading from this input
        setCancelledInputs(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });

        // Persist to lastReports so it doesn't reappear in next report
        if (smartReportModal?.studentId) {
          setLastReports(prev => ({
            ...prev,
            [smartReportModal.studentId]: {
              ...prev[smartReportModal.studentId],
              cancelledInputs: {
                ...prev[smartReportModal.studentId]?.cancelledInputs,
                [id]: false
              }
            }
          }));
        }
      }, 500);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const handleInputPointerUp = () => {
    // Clear the long-press timer
    if (inputLongPressTimerRef.current) {
      clearTimeout(inputLongPressTimerRef.current);
      inputLongPressTimerRef.current = null;
    }
  };

  // Helper: Sync Reading New to Homework New (Redo Mirror)
  const syncRedoValues = useCallback(() => {
    if (!isRedoMode || !smartReportModal?.studentId) return;
    const studentId = smartReportModal.studentId;

    const currentReading = lastReports[studentId]?.readingNew;
    const currentHomework = lastReports[studentId]?.homeworkNew;

    if (!currentReading) return;

    // 1. Sync Mode & Advanced Toggle (if changed)
    // We update preferredModes and activeAdvancedAyah to match readingNew
    if (preferredModes.homeworkNew !== preferredModes.readingNew) {
      setPreferredModes(prev => ({ ...prev, homeworkNew: prev.readingNew }));
    }
    if (activeAdvancedAyah.homeworkNew !== activeAdvancedAyah.readingNew) {
      setActiveAdvancedAyah(prev => ({ ...prev, homeworkNew: prev.readingNew }));
    }

    // 2. Sync Values via State (Robust)
    // We construct the target homework object based on readingNew values
    let nextHomework: any = {
      ...currentHomework,
      mode: currentReading.mode,
      isAdvancedAyah: currentReading.isAdvancedAyah
    };

    // Map fields based on mode
    if (currentReading.mode === 'ayah') {
      nextHomework.surah = currentReading.surah;
      nextHomework.from = currentReading.fromAyah;
      nextHomework.to = currentReading.toAyah;
      // For Advanced Mode - sync both fromSurah and toSurah
      nextHomework.fromSurah = currentReading.fromSurah || currentReading.surah;
      nextHomework.toSurah = currentReading.toSurah || currentReading.surah;
    } else if (currentReading.mode === 'page') {
      nextHomework.from = currentReading.fromPage;
      nextHomework.to = currentReading.toPage;
    } else if (currentReading.mode === 'juz') {
      nextHomework.from = currentReading.fromJuz;
      nextHomework.to = currentReading.toJuz;
    } else if (currentReading.mode === 'hizb') {
      nextHomework.from = currentReading.fromHizb;
      nextHomework.to = currentReading.toHizb;
    } else if (currentReading.mode === 'surah') {
      // If there's a surah mode specific logic
      nextHomework.fromSurah = currentReading.fromSurah;
      nextHomework.toSurah = currentReading.toSurah;
    }

    // Determine if update is needed by comparing JSON stringified versions (deep check simplifier)
    // or checking key fields.
    const isDifferent = JSON.stringify(nextHomework) !== JSON.stringify(currentHomework);

    if (isDifferent) {
      setLastReports(prev => {
        const updated: any = {
          ...prev,
          [studentId]: {
            ...prev[studentId],
            homeworkNew: nextHomework
          }
        };

        // Removed auto-compute for Revision during Redo to prevent overwriting
        // correct Revision values with defaults (like Al-Fatihah).

        return updated;
      });
    }

  }, [isRedoMode, smartReportModal?.studentId, lastReports, preferredModes.readingNew, preferredModes.homeworkNew, activeAdvancedAyah.readingNew, activeAdvancedAyah.homeworkNew]);

  // Effect: Trigger Sync when Redo is ON and RELEVANT states change
  // We monitor the SOURCE (readingNew) and the CONTROL (isRedoMode)
  useEffect(() => {
    if (isRedoMode) {
      syncRedoValues();
    }
  }, [
    isRedoMode,
    syncRedoValues,
    // Monitor key source changes. We don't list 'lastReports' broadly to avoid loops,
    // but the useCallback has 'lastReports' dependency which is updated when state changes.
    // Ideally, we want to React to specific changes in readingNew.
    // However, since 'syncRedoValues' depends on 'lastReports', it will change reference on every update.
    // The internal logic guards against infinite loops by checking 'isDifferent'.
  ]);

  // Helper: Sync Reading Revision to Homework Revision (Redo Mirror)
  const syncRedoValuesRev = useCallback(() => {
    if (!isRedoModeRev || !smartReportModal?.studentId) return;
    const studentId = smartReportModal.studentId;

    const currentReading = lastReports[studentId]?.readingRev;
    const currentHomework = lastReports[studentId]?.homeworkRev;

    if (!currentReading) return;

    // Sync Mode & Advanced Toggle
    if (preferredModes.homeworkRev !== preferredModes.readingRev) {
      setPreferredModes(prev => ({ ...prev, homeworkRev: prev.readingRev }));
    }
    if (activeAdvancedAyah.homeworkRev !== activeAdvancedAyah.readingRev) {
      setActiveAdvancedAyah(prev => ({ ...prev, homeworkRev: prev.readingRev }));
    }

    // Build homework object based on reading values
    let nextHomework: any = {
      ...currentHomework,
      mode: currentReading.mode,
      isAdvancedAyah: currentReading.isAdvancedAyah
    };

    if (currentReading.mode === 'ayah') {
      nextHomework.surah = currentReading.surah;
      nextHomework.from = currentReading.fromAyah;
      nextHomework.to = currentReading.toAyah;
      // For Advanced Mode - sync both fromSurah and toSurah
      nextHomework.fromSurah = currentReading.fromSurah || currentReading.surah;
      nextHomework.toSurah = currentReading.toSurah || currentReading.surah;
    } else if (currentReading.mode === 'page') {
      nextHomework.from = currentReading.fromPage;
      nextHomework.to = currentReading.toPage;
    } else if (currentReading.mode === 'juz') {
      nextHomework.from = currentReading.fromJuz;
      nextHomework.to = currentReading.toJuz;
    } else if (currentReading.mode === 'hizb') {
      nextHomework.from = currentReading.fromHizb;
      nextHomework.to = currentReading.toHizb;
    } else if (currentReading.mode === 'surah') {
      nextHomework.fromSurah = currentReading.fromSurah;
      nextHomework.toSurah = currentReading.toSurah;
    }

    const isDifferent = JSON.stringify(nextHomework) !== JSON.stringify(currentHomework);

    if (isDifferent) {
      setLastReports(prev => ({
        ...prev,
        [studentId]: {
          ...prev[studentId],
          homeworkRev: nextHomework
        }
      }));
    }
  }, [isRedoModeRev, smartReportModal?.studentId, lastReports, preferredModes.readingRev, preferredModes.homeworkRev, activeAdvancedAyah.readingRev, activeAdvancedAyah.homeworkRev]);

  // Helper: Sync Reading Old Revision to Homework Old Revision (Redo Mirror)
  const syncRedoValuesOldRev = useCallback(() => {
    if (!isRedoModeOldRev || !smartReportModal?.studentId) return;
    const studentId = smartReportModal.studentId;

    const currentReading = lastReports[studentId]?.readingOldRev;
    const currentHomework = lastReports[studentId]?.homeworkOldRev;

    if (!currentReading) return;

    // Sync Mode & Advanced Toggle
    if (preferredModes.homeworkOldRev !== preferredModes.readingOldRev) {
      setPreferredModes(prev => ({ ...prev, homeworkOldRev: prev.readingOldRev }));
    }
    if (activeAdvancedAyah.homeworkOldRev !== activeAdvancedAyah.readingOldRev) {
      setActiveAdvancedAyah(prev => ({ ...prev, homeworkOldRev: prev.readingOldRev }));
    }

    // Build homework object based on reading values
    let nextHomework: any = {
      ...currentHomework,
      mode: currentReading.mode,
      isAdvancedAyah: currentReading.isAdvancedAyah
    };

    if (currentReading.mode === 'ayah') {
      nextHomework.surah = currentReading.surah;
      nextHomework.from = currentReading.fromAyah;
      nextHomework.to = currentReading.toAyah;
      nextHomework.fromSurah = currentReading.fromSurah || currentReading.surah;
      nextHomework.toSurah = currentReading.toSurah || currentReading.surah;
    } else if (currentReading.mode === 'page') {
      nextHomework.from = currentReading.fromPage;
      nextHomework.to = currentReading.toPage;
    } else if (currentReading.mode === 'juz') {
      nextHomework.from = currentReading.fromJuz;
      nextHomework.to = currentReading.toJuz;
    } else if (currentReading.mode === 'hizb') {
      nextHomework.from = currentReading.fromHizb;
      nextHomework.to = currentReading.toHizb;
    } else if (currentReading.mode === 'surah') {
      nextHomework.fromSurah = currentReading.fromSurah;
      nextHomework.toSurah = currentReading.toSurah;
    }

    const isDifferent = JSON.stringify(nextHomework) !== JSON.stringify(currentHomework);

    if (isDifferent) {
      setLastReports(prev => ({
        ...prev,
        [studentId]: {
          ...prev[studentId],
          homeworkOldRev: nextHomework
        }
      }));
    }
  }, [isRedoModeOldRev, smartReportModal?.studentId, lastReports, preferredModes.readingOldRev, preferredModes.homeworkOldRev, activeAdvancedAyah.readingOldRev, activeAdvancedAyah.homeworkOldRev]);

  // Helper: Sync Reading Tilawa to Homework Tilawa (Redo Mirror)
  const syncRedoValuesTilawa = useCallback(() => {
    if (!isRedoModeTilawa || !smartReportModal?.studentId) return;
    const studentId = smartReportModal.studentId;

    const currentReading = lastReports[studentId]?.readingTilawa;
    const currentHomework = lastReports[studentId]?.homeworkTilawa;

    if (!currentReading) return;

    // Sync Mode & Advanced Toggle
    if (preferredModes.homeworkTilawa !== preferredModes.readingTilawa) {
      setPreferredModes(prev => ({ ...prev, homeworkTilawa: prev.readingTilawa }));
    }
    if (activeAdvancedAyah.homeworkTilawa !== activeAdvancedAyah.readingTilawa) {
      setActiveAdvancedAyah(prev => ({ ...prev, homeworkTilawa: prev.readingTilawa }));
    }

    // Build homework object based on reading values
    let nextHomework: any = {
      ...currentHomework,
      mode: currentReading.mode,
      isAdvancedAyah: currentReading.isAdvancedAyah
    };

    if (currentReading.mode === 'ayah') {
      nextHomework.surah = currentReading.surah;
      nextHomework.from = currentReading.fromAyah;
      nextHomework.to = currentReading.toAyah;
      nextHomework.toSurah = currentReading.toSurah;
      nextHomework.fromSurah = currentReading.surah;
    } else if (currentReading.mode === 'page') {
      nextHomework.from = currentReading.fromPage;
      nextHomework.to = currentReading.toPage;
    } else if (currentReading.mode === 'juz') {
      nextHomework.from = currentReading.fromJuz;
      nextHomework.to = currentReading.toJuz;
    } else if (currentReading.mode === 'hizb') {
      nextHomework.from = currentReading.fromHizb;
      nextHomework.to = currentReading.toHizb;
    } else if (currentReading.mode === 'surah') {
      nextHomework.fromSurah = currentReading.fromSurah;
      nextHomework.toSurah = currentReading.toSurah;
    }

    const isDifferent = JSON.stringify(nextHomework) !== JSON.stringify(currentHomework);

    if (isDifferent) {
      setLastReports(prev => ({
        ...prev,
        [studentId]: {
          ...prev[studentId],
          homeworkTilawa: nextHomework
        }
      }));
    }
  }, [isRedoModeTilawa, smartReportModal?.studentId, lastReports, preferredModes.readingTilawa, preferredModes.homeworkTilawa, activeAdvancedAyah.readingTilawa, activeAdvancedAyah.homeworkTilawa]);

  // Effect: Trigger Sync for Revision
  useEffect(() => {
    if (isRedoModeRev) {
      syncRedoValuesRev();
    }
  }, [isRedoModeRev, syncRedoValuesRev]);

  // Effect: Trigger Sync for Tilawa
  useEffect(() => {
    if (isRedoModeTilawa) {
      syncRedoValuesTilawa();
    }
  }, [isRedoModeTilawa, syncRedoValuesTilawa]);

  // Effect: Trigger Sync for Old Revision
  useEffect(() => {
    if (isRedoModeOldRev) {
      syncRedoValuesOldRev();
    }
  }, [isRedoModeOldRev, syncRedoValuesOldRev]);


  // Restore Last Report Modes
  useEffect(() => {
    if (smartReportModal?.studentId && lastReports[smartReportModal.studentId]) {
      const reportStudentId = smartReportModal.studentId;
      const reportStudentLanguage = getStudentPreferredContentLanguage(reportStudentId);
      const last = lastReports[smartReportModal.studentId];
      const restoredCurrentRef = last.quranTajweed?.currentLessonId || defaultQuranTajweedLessonId;
      const restoredCurrentId = mapTajweedLessonRefToBankId(restoredCurrentRef, {
        studentId: reportStudentId,
        forcedLanguage: reportStudentLanguage,
      }) || defaultQuranTajweedLessonId;
      const hasCurrentOption = quranTajweedLessonOptions.some((lesson) => lesson.id === restoredCurrentId);

      const restoredNextRef = last.quranTajweed?.nextLessonId || '';
      const restoredNextId = mapTajweedLessonRefToBankId(restoredNextRef, {
        studentId: reportStudentId,
        forcedLanguage: reportStudentLanguage,
      });
      const hasNextOption = quranTajweedLessonOptions.some((lesson) => lesson.id === restoredNextId);

      setPreferredModes({
        readingNew: last.readingNew?.mode || 'ayah',
        readingRev: last.readingRev?.mode || 'ayah',
        readingOldRev: last.readingOldRev?.mode || 'ayah',
        readingTilawa: last.readingTilawa?.mode || 'ayah',
        homeworkNew: last.homeworkNew?.mode || 'ayah',
        homeworkRev: last.homeworkRev?.mode || 'ayah',
        homeworkOldRev: last.homeworkOldRev?.mode || 'ayah',
        homeworkTilawa: last.homeworkTilawa?.mode || 'ayah'
      });
      setActiveAdvancedAyah({
        readingNew: last.readingNew?.isAdvancedAyah || false,
        readingRev: last.readingRev?.isAdvancedAyah || false,
        readingOldRev: last.readingOldRev?.isAdvancedAyah || false,
        readingTilawa: last.readingTilawa?.isAdvancedAyah || false,
        homeworkNew: last.homeworkNew?.isAdvancedAyah || false,
        homeworkRev: last.homeworkRev?.isAdvancedAyah || false,
        homeworkOldRev: last.homeworkOldRev?.isAdvancedAyah || false,
        homeworkTilawa: last.homeworkTilawa?.isAdvancedAyah || false
      });
      setQuranTajweedCurrentLessonId(hasCurrentOption ? restoredCurrentId : defaultQuranTajweedLessonId);
      setQuranTajweedNextLessonId(
        restoredNextId === TAJWEED_NEXT_REPEAT || restoredNextId === TAJWEED_NEXT_HIDE || hasNextOption
          ? restoredNextId
          : ''
      );
      setExcludeNewFromReport(last.homeworkNew?.excludeFromReport || false);
      setMasteryDeficiency(last.homeworkNew?.masteryDeficiency || []);
      setMasteryPanelOpen(false);
      setPrevReportHadExclusion(last.homeworkNew?.excludeFromReport || false);

      // Restore cancellation state for this student
      setCancelledInputs(last.cancelledInputs || {});
    } else {
      // Reset if no history
      setPreferredModes({
        readingNew: 'ayah',
        readingRev: 'ayah',
        readingOldRev: 'ayah',
        readingTilawa: 'ayah',
        homeworkNew: 'ayah',
        homeworkRev: 'ayah',
        homeworkOldRev: 'ayah',
        homeworkTilawa: 'ayah'
      });
      setActiveAdvancedAyah({
        readingNew: false,
        readingRev: false,
        readingOldRev: false,
        readingTilawa: false,
        homeworkNew: false,
        homeworkRev: false,
        homeworkOldRev: false,
        homeworkTilawa: false
      });
      setQuranTajweedCurrentLessonId(defaultQuranTajweedLessonId);
      setQuranTajweedNextLessonId('');
      setExcludeNewFromReport(false);
      setMasteryDeficiency([]);
      setMasteryPanelOpen(false);
      setPrevReportHadExclusion(false);

      // Clear cancellation state when no history
      setCancelledInputs({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    smartReportModal?.studentId,
    smartReportModal?.isOpen,
    defaultQuranTajweedLessonId,
    getStudentPreferredContentLanguage,
    mapTajweedLessonRefToBankId,
    quranTajweedLessonOptions,
  ]);

  // Prevent wheel scrolling on inputs inside the smart report modal — redirect to modal scroll
  // Also redirect scroll from outside the modal (backdrop) into the modal
  useEffect(() => {
    if (!smartReportModal?.isOpen) return;

    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      const modal = document.querySelector('.smart-report-modal-container') as HTMLElement | null;
      if (!modal) return;

      const isInsideModal = modal.contains(target);

      if (!isInsideModal) {
        // Scrolling over the backdrop → redirect to modal
        e.preventDefault();
        modal.scrollBy({ top: e.deltaY * 0.85, behavior: 'instant' });
        return;
      }

      // Inside modal: only intercept inputs/selects (to prevent value change on scroll)
      const isInput = target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA';
      if (!isInput) return;

      // If SearchableSurahSelect dropdown is open, let the list scroll naturally
      const dropdown = target.closest('.relative')?.querySelector('ul');
      if (dropdown) return;

      // Prevent scroll on focused input and redirect to modal
      e.preventDefault();
      e.stopPropagation();
      modal.scrollBy({ top: e.deltaY * 0.85, behavior: 'instant' });
    };

    document.addEventListener('wheel', handleWheel, { passive: false });
    return () => document.removeEventListener('wheel', handleWheel);
  }, [smartReportModal?.isOpen]);

  // Cancel makeup linking mode on global click (that isn't handled by the cell itself)
  useEffect(() => {
    if (makeupLinkingMode?.isActive) {
      const handleClickOutside = (e: MouseEvent) => {
        setMakeupLinkingMode(prev => {
          if (prev?.isActive) {
            // Check if this click came from the source cell (do nothing, let onClick handle)
            // or a valid target (let onClick handle).
            // We can inspect element ID or attributes.
            const target = e.target as HTMLElement;
            const cell = target.closest('td');
            if (cell) {
              // It's a cell. We let the cell's onClick handle it.
              return prev;
            }
            // If not a cell, cancel!
            return null;
          }
          return prev;
        });
      };

      window.addEventListener('click', handleClickOutside);
      return () => window.removeEventListener('click', handleClickOutside);
    }
  }, [makeupLinkingMode]);

  // --- Sticky Header Logic ---
  const stickyHeaderRef = React.useRef<HTMLDivElement>(null);
  const mainRef = React.useRef<HTMLElement>(null);
  const originalHeaderRef = React.useRef<HTMLTableSectionElement>(null);
  const studentHeaderRef = React.useRef<HTMLTableCellElement>(null);
  const originalTableRef = React.useRef<HTMLTableElement>(null);
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [studentWidth, setStudentWidth] = useState<number>(150);
  const [tableWidth, setTableWidth] = useState<number>(0);

  const scrollIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  const stopAutoScroll = useCallback(() => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  }, []);

  const startAutoScroll = useCallback((direction: 'up' | 'down', speedFactor: number) => {
    stopAutoScroll();
    scrollIntervalRef.current = setInterval(() => {
      const scrollAmount = direction === 'up' ? -15 * speedFactor : 15 * speedFactor;
      window.scrollBy(0, scrollAmount);
    }, 16); // ~60fps
  }, [stopAutoScroll]);

  useEffect(() => {
    const handleScroll = () => {
      if (originalHeaderRef.current) {
        const rect = originalHeaderRef.current.getBoundingClientRect();
        setShowStickyHeader(rect.top <= 74);
      } else {
        setShowStickyHeader(false);
      }

      // Close context menu on scroll
      setAcademyContextMenu(prev => {
        if (prev.isOpen) {
          setTimeout(() => setAcademyContextMenu(curr => ({ ...curr, isClosing: false })), 200);
          return { ...prev, isOpen: false, isClosing: true };
        }
        return prev;
      });

      setMissedClassesMenu(null);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Re-evaluate sticky header after month change loading finishes
  useEffect(() => {
    if (!isTableLoading) {
      // Small timeout to ensure DOM is updated and ref is stable
      const timer = setTimeout(() => {
        if (originalHeaderRef.current) {
          const rect = originalHeaderRef.current.getBoundingClientRect();
          setShowStickyHeader(rect.top <= 74);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isTableLoading]);

  // Cancel Makeup Mode on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMakeupLinkingMode(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sync Column and Table Widths
  const [headerSyncOffset, setHeaderSyncOffset] = useState({ width: 0, left: 0 });

  React.useLayoutEffect(() => {
    if (!studentHeaderRef.current || !originalTableRef.current || !mainRef.current) return;

    // Function to perform the sync
    const syncWidths = () => {
      if (studentHeaderRef.current) {
        setStudentWidth(studentHeaderRef.current.getBoundingClientRect().width);
      }
      if (originalTableRef.current) {
        // Use getBoundingClientRect for sub-pixel precision to prevent cumulative drift
        setTableWidth(originalTableRef.current.getBoundingClientRect().width);
      }
      if (mainRef.current) {
        const rect = mainRef.current.getBoundingClientRect();
        setHeaderSyncOffset({
          width: mainRef.current.clientWidth, // Width excluding vertical scrollbar
          left: rect.left
        });
      }
    };

    const observer = new ResizeObserver(syncWidths);

    observer.observe(studentHeaderRef.current);
    observer.observe(originalTableRef.current);
    observer.observe(mainRef.current);

    // Initial sync
    syncWidths();

    return () => observer.disconnect();
  }, [students, month, year, showStickyHeader]);


  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (academyContextMenu.isOpen && !(e.target as Element).closest('.context-menu')) {
        setAcademyContextMenu(prev => ({ ...prev, isOpen: false, isClosing: true }));
        setTimeout(() => setAcademyContextMenu(prev => ({ ...prev, isClosing: false })), 200);
      }
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [academyContextMenu.isOpen]);

  const [prefillAcademy, setPrefillAcademy] = useState<string | null>(null);

  // Exchange Rate State
  const [usdRate, setUsdRate] = useState<number>(0);

  // Confirmation Modal State
  // Dynamic "today" date state that updates automatically in real-time
  const [today, setToday] = useState(() => {
    const now = new Date();
    const [tHour, tMin] = dayTransitionTime.split(':').map(Number);
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    if (currentHour < tHour || (currentHour === tHour && currentMin < tMin)) {
      now.setDate(now.getDate() - 1);
    }
    return {
      day: now.getDate(),
      month: now.getMonth(),
      year: now.getFullYear()
    };
  });

  const todayRef = useRef(today);
  todayRef.current = today;
  const monthRef = useRef(month);
  monthRef.current = month;
  const yearRef = useRef(year);
  yearRef.current = year;

  // Keep "today" date state updated automatically (handles midnight transition and PC wakeup)
  useEffect(() => {
    let timeoutId: any;

    const calculateToday = () => {
      const now = new Date();
      const [tHour, tMin] = dayTransitionTime.split(':').map(Number);
      const currentHour = now.getHours();
      const currentMin = now.getMinutes();

      // Shift date backward if we are before the transition time
      if (currentHour < tHour || (currentHour === tHour && currentMin < tMin)) {
        now.setDate(now.getDate() - 1);
      }
      return {
        day: now.getDate(),
        month: now.getMonth(),
        year: now.getFullYear()
      };
    };

    // Calculate milliseconds until the next transition time occurs
    const getMsUntilNextTransition = () => {
      const now = new Date();
      const [tHour, tMin] = dayTransitionTime.split(':').map(Number);
      const transitionToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), tHour, tMin, 0, 0);
      
      if (now.getTime() < transitionToday.getTime()) {
        return transitionToday.getTime() - now.getTime();
      } else {
        const transitionTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, tHour, tMin, 0, 0);
        return transitionTomorrow.getTime() - now.getTime();
      }
    };

    // Update once immediately when dayTransitionTime changes
    setToday(calculateToday());

    const updateAndSchedule = () => {
      if (timeoutId) clearTimeout(timeoutId);

      const next = calculateToday();
      const prev = todayRef.current;

      if (prev.day !== next.day || prev.month !== next.month || prev.year !== next.year) {
        if (monthRef.current === prev.month) {
          setMonth(next.month);
        }
        if (yearRef.current === prev.year) {
          setYear(next.year);
        }
        setToday(next);
      }

      // Schedule the next check at the exact next transition moment
      const msLeft = getMsUntilNextTransition();
      timeoutId = setTimeout(updateAndSchedule, msLeft);
    };

    // Initial schedule
    const initialMs = getMsUntilNextTransition();
    timeoutId = setTimeout(updateAndSchedule, initialMs);

    // Set up window focus listener (tab switch or PC wake up)
    const handleFocus = () => {
      updateAndSchedule();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [dayTransitionTime]);

  const isTodayColumn = (dayNum: number) => {
    return month === today.month && year === today.year && dayNum === today.day;
  };

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { }
  });

  // Drag and Drop State
  const [draggedAcademyIndex, setDraggedAcademyIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    fetch('https://open.er-api.com/v6/latest/USD')
      .then(res => res.json())
      .then(data => {
        if (data && data.rates && data.rates.EGP) {
          setUsdRate(data.rates.EGP);
        }
      })
      .catch(err => console.error("Failed to fetch exchange rate", err));
  }, []);

  // Close controls and menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.group') && !target.closest('.rounded-2xl') && !target.closest('.context-menu')) {
        setShowControls(false);
        setShowAddMenu(false);
        setAcademyContextMenu(prev => ({ ...prev, isOpen: false }));
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDeleteAcademy = useCallback((academyToDelete: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'حذف الأكاديمية',
      message: `هل أنت متأكد من حذف ${academyToDelete} وجميع طلابها؟ لا يمكن التراجع عن هذا الإجراء.`,
      onConfirm: () => {
        setStudents(prev => prev.filter(s => s.academy !== academyToDelete));
        setAcademyOrder(prev => prev.filter(a => a !== academyToDelete));
        setAcademyRates(prev => {
          const next = { ...prev };
          delete next[academyToDelete];
          return next;
        });
        if (selectedAcademy === academyToDelete) setSelectedAcademy(null);
      }
    });
  }, [selectedAcademy]);

  const handleUpdateAcademy = useCallback((oldName: string, newName: string, rate: number, currency: string, monthlyDeductions: Record<string, number> = {}, billingStartDay: number = 1, externalLink: string = '', holidays: number[] = [], receiveInEGP: boolean = false, disableReports: boolean = false, whatsappNumber: string = '', openLinksExternally: boolean = false, includeReportHeader: boolean = true) => {
    if (!oldName) {
      // Add Mode
      setAcademyOrder(prev => prev.includes(newName) ? prev : [...prev, newName]);
      setAcademyRates(prev => ({ ...prev, [newName]: { rate, currency, monthlyDeductions, billingStartDay, externalLink, holidays, receiveInEGP, disableReports, whatsappNumber, openLinksExternally, includeReportHeader } }));
      setIsAddingAcademy(false);
      return;
    }

    // ... (rest of filtering/student update logic omitted for brevity, but I need to include it in the real replacement)
    // Actually I should provide the full block to be safe.

    // Previous code:
    const is30Min = (d?: string) => d === '30' || d === '٣٠';

    setStudents(prev => prev.map(s => {
      if (s.academy === oldName) {
        let newStudentRate = s.rate;
        let newCurrency = s.location;

        if (s.useAcademyRate) {
          if (is30Min(s.duration)) {
            newStudentRate = rate / 2;
          } else {
            newStudentRate = rate;
          }
          newCurrency = currency;
        }

        return {
          ...s,
          academy: newName,
          rate: newStudentRate,
          location: newCurrency
        };
      }
      return s;
    }));

    setAcademyOrder(prev => prev.map(a => a === oldName ? newName : a));
    setAcademyRates(prev => {
      const next = { ...prev };
      delete next[oldName];
      next[newName] = { rate, currency, monthlyDeductions, billingStartDay, externalLink, holidays, receiveInEGP, disableReports, whatsappNumber, openLinksExternally, includeReportHeader };
      return next;
    });

    if (selectedAcademy === oldName) setSelectedAcademy(newName);
    if (selectedAcademyForDetails === oldName) setSelectedAcademyForDetails(newName);
    if (selectedAcademyForEditing === oldName) setSelectedAcademyForEditing(null);
  }, [selectedAcademy, selectedAcademyForDetails]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedAcademyIndex(index);
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';

    // Remove ghost drag image (user requested: "remove the annoying square ghost")
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; // 1x1 transparent gif
    e.dataTransfer.setDragImage(img, 0, 0);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null); // Reset aesthetic state
    if (draggedAcademyIndex === null || draggedAcademyIndex === targetIndex) return;

    setAcademyOrder(prev => {
      const newOrder = [...prev];
      const [draggedItem] = newOrder.splice(draggedAcademyIndex, 1);
      newOrder.splice(targetIndex, 0, draggedItem);
      return newOrder;
    });
    setDraggedAcademyIndex(null);
  };

  // --- Student Drag & Drop Handlers ---
  const handleStudentDragStart = (e: React.DragEvent, studentId: string) => {
    // Cancel long-press detection when dragging starts
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressTriggeredRef.current = false;

    setDraggedStudentId(studentId);
    e.dataTransfer.setData('studentId', studentId);
    e.dataTransfer.effectAllowed = 'move';

    // Remove ghost image
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(img, 0, 0);
  };

  const handleStudentDragOver = (e: React.DragEvent, studentId: string) => {
    e.preventDefault();
    if (draggedStudentId === studentId) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    const position = mouseY < rect.height / 2 ? 'top' : 'bottom';

    setStudentDragOverId(studentId);
    setDropIndicator({ id: studentId, position });

    // --- Auto-Scroll Logic ---
    const threshold = 120; // Distance from edge to start scrolling
    const viewportHeight = window.innerHeight;
    const mouseY_viewport = e.clientY;

    if (mouseY_viewport < threshold) {
      // Near top: scroll up
      const speedFactor = Math.max(0.2, (threshold - mouseY_viewport) / threshold);
      startAutoScroll('up', speedFactor);
    } else if (mouseY_viewport > viewportHeight - threshold) {
      // Near bottom: scroll down
      const speedFactor = Math.max(0.2, (mouseY_viewport - (viewportHeight - threshold)) / threshold);
      startAutoScroll('down', speedFactor);
    } else {
      stopAutoScroll();
    }
  };

  const handleStudentDrop = (e: React.DragEvent, targetStudentId: string) => {
    e.preventDefault();
    stopAutoScroll();
    const pos = dropIndicator?.position;
    setStudentDragOverId(null);
    setDropIndicator(null);

    if (!draggedStudentId || draggedStudentId === targetStudentId) {
      setDraggedStudentId(null);
      return;
    }

    setStudents(prev => {
      const newStudents = [...prev];
      const draggedIdx = newStudents.findIndex(s => s.id === draggedStudentId);

      if (draggedIdx === -1) return prev;

      const draggedStudent = newStudents[draggedIdx];

      // Remove dragged item first
      const [draggedItem] = newStudents.splice(draggedIdx, 1);

      // Find target index AFTER removal
      const targetIdx = newStudents.findIndex(s => s.id === targetStudentId);
      if (targetIdx === -1) return prev;

      const targetStudent = newStudents[targetIdx];

      // If dragging across a pinned/unpinned boundary, adopt the target's pinned status
      if (draggedItem.isPinnedToEnd !== targetStudent.isPinnedToEnd) {
        draggedItem.isPinnedToEnd = targetStudent.isPinnedToEnd;
      }

      // Insert relative to target
      const finalIdx = pos === 'bottom' ? targetIdx + 1 : targetIdx;
      newStudents.splice(finalIdx, 0, draggedItem);

      return newStudents;
    });
    setDraggedStudentId(null);
  };


  const toggleTopSeparator = (studentId: string) => {
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, hasTopSeparator: !s.hasTopSeparator } : s));
  };

  const toggleBottomSeparator = (studentId: string) => {
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, hasBottomSeparator: !s.hasBottomSeparator } : s));
  };

  const togglePinToEnd = (studentId: string) => {
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, isPinnedToEnd: !s.isPinnedToEnd } : s));
  };

  const copyMissedClassesReport = (studentId: string, lang: 'ar' | 'en' = 'ar') => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const missedClasses: string[] = [];
    const daysInM = new Date(year, month + 1, 0).getDate();

    for (let day = 1; day <= daysInM; day++) {
      const key = `${studentId}_${day}_${month}_${year}`;
      const status = attendance[key];

      if (status === AttendanceStatus.UNEXCUSED_ABSENCE || status === AttendanceStatus.ABSENCE_RED || status === AttendanceStatus.POSTPONED) {
        // Skip POSTPONED days that are linked to a makeup class (already compensated)
        if (status === AttendanceStatus.POSTPONED) {
          const hasLink = makeupLinks.some(l => l.studentId === studentId && l.missedDay === day && l.month === month && l.year === year);
          if (hasLink) continue;
        }

        const date = new Date(year, month, day);
        let line = '';

        if (lang === 'ar') {
          const dayName = DAYS_OF_WEEK[date.getDay()].name;
          const formattedDate = `${day}/${month + 1}`;
          let reason = '';

          if (status === AttendanceStatus.UNEXCUSED_ABSENCE) {
            reason = 'اعتذار من المعلم';
          } else if (status === AttendanceStatus.ABSENCE_RED || status === AttendanceStatus.POSTPONED) {
            reason = 'اعتذار من الطالب';
          }
          line = `• ${dayName} ${formattedDate} (${reason})`;

        } else {
          // English Formating
          const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
          const dateStr = date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
          let reason = '';

          if (status === AttendanceStatus.UNEXCUSED_ABSENCE) {
            reason = 'Teacher Apology';
          } else if (status === AttendanceStatus.ABSENCE_RED || status === AttendanceStatus.POSTPONED) {
            reason = 'Student Apology';
          }
          line = `• ${dayName}, ${dateStr} (${reason})`;
        }

        missedClasses.push(line);
      }
    }

    if (missedClasses.length > 0) {
      const report = missedClasses.join('\r\n\r\n');
      navigator.clipboard.writeText(report);
      showToast(lang === 'ar' ? 'تم نسخ تقرير الحصص الفائتة' : 'Missed classes report copied');
    } else {
      showToast(lang === 'ar' ? 'لا توجد حصص فائتة' : 'No missed classes');
    }
    setMissedClassesMenu(null);
    setSearchQuery('');
  };

  const handleEndEnrollment = (student: Student) => {
    let nextMonth = month + 1;
    let nextYear = year;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear++;
    }

    const updatedStudent: Student = {
      ...student,
      days: [], // Clear scheduled days for current month
      deletedAt: { month: nextMonth, year: nextYear }
    };

    setStudents(prev => prev.map(s => s.id === student.id ? updatedStudent : s));
  };

  const togglePaymentStatus = (studentId: string, targetMonth: number, targetYear: number) => {
    const key = `${studentId}_${targetMonth}_${targetYear}`;
    setPaymentStatus(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Hadith State
  const [hadithIndex, setHadithIndex] = useState(0);

  // --- Effects ---
  // Save to Electron AppData whenever data changes
  useEffect(() => {
    if (!isLoaded) return;
    
    // Update local action timestamp so background sync doesn't overwrite us
    lastLocalActionTime.current = Date.now();
    
    const dataToSave = {
      students,
      attendance,
      month,
      year,
      dayOff,
      academyOrder,
      academyRates,
      monthlyObligations,
      paymentStatus,
      autoBackupConfig,
      externalLinks,
      dayTransitionTime,
      makeupLinks,
      showMakeupLines,
      confirmNonTodayAttendance,
      whatsappTarget,
      studentProgress,
      preferredModes,
      lastReports,
      defaultNoorBook,
      savedReports,
      savedReportDrafts,
      subscriptionSettings,
      tajweedBank,
      tajweedAssignments,
      tajweedSubmissions,
      tajweedLessonEditorUiState,
      seenUngradedTajweedVersion: SEEN_UNGRADED_TAJWEED_VERSION,
      seenUngradedTajweedAssignmentIds: Array.from(seenUngradedTajweedAssignmentIds),
    };
    if (window.electronAPI) {
      window.electronAPI.saveData(dataToSave);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    }
  }, [students, attendance, month, year, dayOff, academyOrder, academyRates, monthlyObligations, paymentStatus, autoBackupConfig, externalLinks, dayTransitionTime, makeupLinks, showMakeupLines, confirmNonTodayAttendance, whatsappTarget, studentProgress, preferredModes, lastReports, savedReports, savedReportDrafts, subscriptionSettings, tajweedBank, tajweedAssignments, tajweedSubmissions, tajweedLessonEditorUiState, seenUngradedTajweedAssignmentIds, isLoaded]);



  const handleExport = useCallback(() => {
    const exportData = {
      students,
      attendance,
      month,
      year,
      dayOff,
      academyOrder,
      academyRates,
      monthlyObligations,
      paymentStatus,
      autoBackupConfig,
      externalLinks,
      dayTransitionTime,
      makeupLinks,
      showMakeupLines,
      confirmNonTodayAttendance,
      whatsappTarget,
      studentProgress,
      preferredModes,
      lastReports,
      defaultNoorBook,
      savedReports,
      savedReportDrafts,
      subscriptionSettings,
      tajweedBank,
      tajweedAssignments,
      tajweedSubmissions,
      tajweedLessonEditorUiState,
      seenUngradedTajweedVersion: SEEN_UNGRADED_TAJWEED_VERSION,
      seenUngradedTajweedAssignmentIds: Array.from(seenUngradedTajweedAssignmentIds),
      version: '1.2.0',
      exportedAt: new Date().toISOString()
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `quran_tracker_backup_${new Date().toLocaleDateString('en-CA')}_${new Date().getHours()}-${new Date().getMinutes()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();

    setAutoBackupConfig(prev => ({ ...prev, lastBackupAt: Date.now() }));
  }, [students, attendance, month, year, dayOff, academyRates, academyOrder, monthlyObligations, paymentStatus, autoBackupConfig, externalLinks]);

  // Auto-backup Logic
  useEffect(() => {
    if (!autoBackupConfig.enabled) return;

    const checkBackup = async () => {
      const now = Date.now();
      const lastBackup = autoBackupConfig.lastBackupAt || 0;
      const intervalMs = autoBackupConfig.interval * 60 * 1000;

      if (now - lastBackup >= intervalMs) {
        // Silent backup to path if configured
        if (autoBackupConfig.backupPath && window.electronAPI?.saveBackupToPath) {
          const exportData = {
            students,
            attendance,
            month,
            year,
            dayOff,
            academyOrder,
            academyRates,
            monthlyObligations,
            paymentStatus,
            autoBackupConfig,
            externalLinks,
            dayTransitionTime,
            makeupLinks,
            showMakeupLines,
            confirmNonTodayAttendance,
            whatsappTarget,
            studentProgress,
            preferredModes,
            lastReports,
            defaultNoorBook,
            savedReports,
            savedReportDrafts,
            subscriptionSettings,
            tajweedBank,
            tajweedAssignments,
            tajweedSubmissions,
            tajweedLessonEditorUiState,
            seenUngradedTajweedVersion: SEEN_UNGRADED_TAJWEED_VERSION,
            seenUngradedTajweedAssignmentIds: Array.from(seenUngradedTajweedAssignmentIds),
            version: '1.2.0',
            exportedAt: new Date().toISOString()
          };
          const result = await window.electronAPI.saveBackupToPath(autoBackupConfig.backupPath, exportData, 10);
          if (result.success) {
            setAutoBackupConfig(prev => ({ ...prev, lastBackupAt: Date.now() }));
          }
        } else {
          // Fallback: browser download
          handleExport();
        }
      }
    };

    // Check every minute
    const timer = setInterval(checkBackup, 60000);
    return () => clearInterval(timer);
  }, [autoBackupConfig, handleExport, students, attendance, month, year, dayOff, academyRates, academyOrder, monthlyObligations, paymentStatus, externalLinks, makeupLinks]);

  // --- Helpers ---
  const daysInMonth = useMemo(() => new Date(year, month + 1, 0).getDate(), [year, month]);

  const getDayOfWeek = useCallback((day: number) => {
    // Note: Day is 1-indexed (1..31)
    return new Date(year, month, day).getDay();
  }, [year, month]);

  const isWeekend = useCallback((day: number) => {
    return getDayOfWeek(day) === dayOff;
  }, [dayOff, getDayOfWeek]);

  const getScheduledCountOnDate = useCallback((student: Student, d: number, m: number = month, y: number = year) => {
    const dow = new Date(y, m, d).getDay();
    const count = student.days?.filter(day => day === dow).length || 0;
    if (count === 0) return 0;
    const startDate = student.dayStartDates?.[dow];
    if (!startDate) return count;
    const currentStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return currentStr >= startDate ? count : 0;
  }, [month, year]);

  const isScheduledOnDate = useCallback((student: Student, d: number, m: number = month, y: number = year) => {
    return getScheduledCountOnDate(student, d, m, y) > 0;
  }, [getScheduledCountOnDate]);

  // --- Grouping ---
  const groupedStudents = useMemo(() => {
    const groups: { [key: string]: Student[] } = {};
    // Initialize groups for all known academies to ensure empty ones show up
    academyOrder.forEach(a => groups[a] = []);

    students.forEach(student => {
      // Filter based on enrollment end date
      if (student.deletedAt) {
        if (year > student.deletedAt.year) return;
        if (year === student.deletedAt.year && month >= student.deletedAt.month) return;
      }

      if (!groups[student.academy]) groups[student.academy] = [];
      groups[student.academy].push(student);
    });

    // Sort each group: Unpinned first, Pinned at the end
    Object.keys(groups).forEach(academy => {
      groups[academy].sort((a, b) => {
        if (a.isPinnedToEnd && !b.isPinnedToEnd) return 1;
        if (!a.isPinnedToEnd && b.isPinnedToEnd) return -1;
        return 0; // Maintain original relative order
      });
    });

    return groups;
  }, [students, academyOrder, month, year]);

  // Sync academyOrder with actual existing academies
  useEffect(() => {
    const currentAcademies = Object.keys(groupedStudents);
    setAcademyOrder(prev => {
      const kept = prev.filter(a => currentAcademies.includes(a));
      const newOnes = currentAcademies.filter(a => !prev.includes(a));
      // Only update if there's a difference to avoid loops
      if (kept.length === prev.length && newOnes.length === 0) return prev;
      return [...kept, ...newOnes];
    });
  }, [groupedStudents]);

  const sortedAcademies = useMemo(() => {
    // Return academies in the saved order
    return academyOrder;
  }, [academyOrder]);

  // --- Keyboard Reordering ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedAcademy) return;

      const currentIndex = academyOrder.indexOf(selectedAcademy);
      if (currentIndex === -1) return;

      let newIndex = -1;

      // RTL: Right Arrow moves "visually right" -> previous index
      //      Left Arrow moves "visually left" -> next index
      if (e.key === 'ArrowRight') {
        newIndex = currentIndex - 1;
      } else if (e.key === 'ArrowLeft') {
        newIndex = currentIndex + 1;
      } else if (e.key === 'Escape' || e.key === 'Enter') {
        setSelectedAcademy(null);
        return;
      }

      if (newIndex >= 0 && newIndex < academyOrder.length && newIndex !== -1) {
        e.preventDefault(); // Prevent scrolling
        const newOrder = [...academyOrder];
        // Swap
        [newOrder[currentIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[currentIndex]];
        setAcademyOrder(newOrder);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedAcademy, academyOrder]);

  // --- Multi-Select Keyboard Handlers ---
  useEffect(() => {
    const handleMultiSelectKeyDown = (e: KeyboardEvent) => {
      if (!isMultiSelectMode) return;

      if (e.key === 'Enter' && selectedStudentIds.size > 0) {
        e.preventDefault();
        // Open combined report modal
        const selectedStudents = students.filter(s => selectedStudentIds.has(s.id));
        setSelectedStudentsForCombinedReport(selectedStudents);
        // Clear selection after opening
        setSelectedStudentIds(new Set());
        setIsMultiSelectMode(false);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedStudentIds(new Set());
        setIsMultiSelectMode(false);
      }
    };

    window.addEventListener('keydown', handleMultiSelectKeyDown);
    return () => window.removeEventListener('keydown', handleMultiSelectKeyDown);
  }, [isMultiSelectMode, selectedStudentIds, students]);

  // --- Close Modals/Menus on Escape ---
  const closeAllModals = useCallback((isCommit = false) => {
    if (!isCommit && smartReportModal?.undoSnapshot) {
      const backup = smartReportModal.undoSnapshot;
      if (backup.attendance) setAttendance(backup.attendance);
      if (backup.subscriptionSettings) setSubscriptionSettings(backup.subscriptionSettings);
      if (backup.past) setPast(backup.past);
      if (backup.lastReports) setLastReports(backup.lastReports);
      if (backup.cancelledInputs) setCancelledInputs(backup.cancelledInputs);
      if (backup.sectionToggles) setSectionToggles(backup.sectionToggles);
      if (backup.reportPath) setReportPath(backup.reportPath === 'tajweed' ? 'quran' : backup.reportPath);
      if (backup.noorDetails) setNoorDetails(backup.noorDetails);
      if (backup.selectedTajweedLessonId !== undefined) setSelectedTajweedLessonId(backup.selectedTajweedLessonId);
      if (backup.selectedTajweedTopicGroup !== undefined) setSelectedTajweedTopicGroup(backup.selectedTajweedTopicGroup);
      if (backup.selectedTajweedTopic !== undefined) setSelectedTajweedTopic(backup.selectedTajweedTopic);
      if (backup.sendViaWhatsapp !== undefined) setSendViaWhatsapp(backup.sendViaWhatsapp);
      if (backup.mergeWithQuran !== undefined) setMergeWithQuran(backup.mergeWithQuran);

      if (backup.isRedoMode !== undefined) setIsRedoMode(backup.isRedoMode);
      if (backup.isRedoModeRev !== undefined) setIsRedoModeRev(backup.isRedoModeRev);
      if (backup.isRedoModeOldRev !== undefined) setIsRedoModeOldRev(backup.isRedoModeOldRev);
      if (backup.isRedoModeTilawa !== undefined) setIsRedoModeTilawa(backup.isRedoModeTilawa);

      if (backup.excludeReadingNew !== undefined) setExcludeReadingNew(backup.excludeReadingNew);
      if (backup.excludeReadingRev !== undefined) setExcludeReadingRev(backup.excludeReadingRev);
      if (backup.excludeReadingOldRev !== undefined) setExcludeReadingOldRev(backup.excludeReadingOldRev);
      if (backup.excludeReadingTilawa !== undefined) setExcludeReadingTilawa(backup.excludeReadingTilawa);
      if (backup.excludeHomeworkNew !== undefined) setExcludeHomeworkNew(backup.excludeHomeworkNew);
      if (backup.excludeHomeworkRev !== undefined) setExcludeHomeworkRev(backup.excludeHomeworkRev);
      if (backup.excludeHomeworkOldRev !== undefined) setExcludeHomeworkOldRev(backup.excludeHomeworkOldRev);
      if (backup.excludeHomeworkTilawa !== undefined) setExcludeHomeworkTilawa(backup.excludeHomeworkTilawa);
      if (backup.excludeNoorTam !== undefined) setExcludeNoorTam(backup.excludeNoorTam);
      if (backup.excludeNoorSayatim !== undefined) setExcludeNoorSayatim(backup.excludeNoorSayatim);
      if (backup.excludeQuranTajweed !== undefined) setExcludeQuranTajweed(backup.excludeQuranTajweed);
      if (backup.excludeNewFromReport !== undefined) setExcludeNewFromReport(backup.excludeNewFromReport);
      if (backup.showNotesInput !== undefined) setShowNotesInput(backup.showNotesInput);
      if (backup.customNotesText !== undefined) setCustomNotesText(backup.customNotesText);
      if (backup.audioLinkText !== undefined) setAudioLinkText(backup.audioLinkText);
    }

    // 1. Core Modals
    setSmartReportModal(null);
    setMissedClassesMenu(null);

    // 2. UI States
    setIsSettingsOpen(false);
    setIsModalOpen(false);
    setIsMonthlyStatsOpen(false);
    setIsLastMonthStatsOpen(false);
    setShowAddMenu(false);
    setShowMonthSelector(false);

    // 3. Selection/Details
    setEditingStudent(null);
    setSelectedStudentForDetails(null);
    setSelectedAcademyForDetails(null);
    setSelectedAcademyForEditing(null);
    setIsAddingAcademy(false);

    // 4. Complex Modals
    setWebModal(prev => ({ ...prev, isOpen: false }));
    setShowSubscriptionModal(false);
    setSavedReportViewModal(null);
    setActionConfigModal(prev => ({ ...prev, isOpen: false }));
    setActionChoiceModal(prev => ({ ...prev, isOpen: false }));
    setSimpleInputModal(prev => ({ ...prev, isOpen: false }));

    // 5. Special Modes
    setMakeupLinkingMode({ isLoading: false, active: false, studentId: null });
    setPendingToggle(null);
  }, [smartReportModal]);

  useEffect(() => {
    const handleGlobalEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeAllModals(false);
      }
    };

    if (window.electronAPI?.onEscapeBtn) {
      window.electronAPI.onEscapeBtn(() => closeAllModals(false));
    }

    window.addEventListener('keydown', handleGlobalEscape);

    return () => {
      window.removeEventListener('keydown', handleGlobalEscape);
      if (window.electronAPI?.offEscapeBtn) {
        window.electronAPI.offEscapeBtn();
      }
    };
  }, [closeAllModals]);

  // --- Ctrl+F Search Shortcut ---
  useEffect(() => {
    const handleSearchShortcut = (e: KeyboardEvent) => {
      // e.code is layout-independent (works with Arabic/English keyboard)
      if (e.ctrlKey && e.code === 'KeyF') {
        // Don't intercept if a modal is open
        const anyModalOpen = isModalOpen || isSettingsOpen || !!selectedStudentForDetails || !!selectedAcademyForDetails || smartReportModal?.isOpen;
        if (anyModalOpen) return;
        e.preventDefault();
        setSearchQuery('');
        setIsSearchOpen(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      // Escape: if search is active (overlay closed) → clear it
      if (e.key === 'Escape' && !isSearchOpen && searchQuery.trim()) {
        const anyModalOpen = isModalOpen || isSettingsOpen || !!selectedStudentForDetails || !!selectedAcademyForDetails || smartReportModal?.isOpen;
        if (anyModalOpen) return;
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handleSearchShortcut);
    return () => window.removeEventListener('keydown', handleSearchShortcut);
  }, [isModalOpen, isSettingsOpen, selectedStudentForDetails, selectedAcademyForDetails, smartReportModal, isSearchOpen, searchQuery]);

  // Auto-exit search mode when opening a report
  useEffect(() => {
    if (smartReportModal?.isOpen) {
      if (isSearchOpen) setIsSearchOpen(false);
      if (searchQuery.trim()) setSearchQuery('');
    }
  }, [smartReportModal?.isOpen, isSearchOpen, searchQuery]);

  // --- Click Outside to Deselect ---
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Don't deselect if clicking inside a student row or context menu
      const target = e.target as HTMLElement;
      if (target.closest('.group\\/student') || target.closest('.context-menu')) return;

      setSelectedAcademy(null);
      setShowMonthSelector(false);
      setMissedClassesMenu(null);


      // Clear multi-selection if clicking outside
      if (isMultiSelectMode) {
        setIsMultiSelectMode(false);
        setSelectedStudentIds(new Set());
      }

      // Clear search when clicking in empty space
      if (searchQuery.trim()) {
        setSearchQuery('');
        setIsSearchOpen(false);
      }
    }
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [isMultiSelectMode]); // Added dependency on isMultiSelectMode

  // --- Shift Logic Helper ---
  const buildSmartReportUndoSnapshot = useCallback(() => ({
    attendance: { ...attendance },
    subscriptionSettings: { ...subscriptionSettings },
    past: [...past],
    lastReports: JSON.parse(JSON.stringify(lastReports || {})),
    cancelledInputs: { ...cancelledInputs },
    sectionToggles: { ...sectionToggles },
    reportPath,
    noorDetails: { ...noorDetails },
    selectedTajweedLessonId,
    selectedTajweedTopicGroup,
    selectedTajweedTopic,
    sendViaWhatsapp,
    mergeWithQuran,
    isRedoMode,
    isRedoModeRev,
    isRedoModeOldRev,
    isRedoModeTilawa,
    excludeReadingNew,
    excludeReadingRev,
    excludeReadingOldRev,
    excludeReadingTilawa,
    excludeHomeworkNew,
    excludeHomeworkRev,
    excludeHomeworkOldRev,
    excludeHomeworkTilawa,
    excludeNoorTam,
    excludeNoorSayatim,
    excludeQuranTajweed,
    excludeNewFromReport,
    showNotesInput,
    customNotesText,
    audioLinkText,
  }), [
    attendance,
    subscriptionSettings,
    past,
    lastReports,
    cancelledInputs,
    sectionToggles,
    reportPath,
    noorDetails,
    selectedTajweedLessonId,
    selectedTajweedTopicGroup,
    selectedTajweedTopic,
    sendViaWhatsapp,
    mergeWithQuran,
    isRedoMode,
    isRedoModeRev,
    isRedoModeOldRev,
    isRedoModeTilawa,
    excludeReadingNew,
    excludeReadingRev,
    excludeReadingOldRev,
    excludeReadingTilawa,
    excludeHomeworkNew,
    excludeHomeworkRev,
    excludeHomeworkOldRev,
    excludeHomeworkTilawa,
    excludeNoorTam,
    excludeNoorSayatim,
    excludeQuranTajweed,
    excludeNewFromReport,
    showNotesInput,
  ]);

  const refreshReportDataFromStorage = useCallback(async () => {
    if (window.electronAPI) {
      const savedData = await window.electronAPI.loadData();
      if (!savedData) return;
      if (savedData.lastReports) setLastReports(savedData.lastReports);
      if (savedData.savedReports) setSavedReports(savedData.savedReports);
      if (savedData.savedReportDrafts) setSavedReportDrafts(savedData.savedReportDrafts);
      return;
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const savedData = JSON.parse(saved);
      if (savedData.lastReports) setLastReports(savedData.lastReports);
      if (savedData.savedReports) setSavedReports(savedData.savedReports);
      if (savedData.savedReportDrafts) setSavedReportDrafts(savedData.savedReportDrafts);
    } catch {
      // Ignore malformed local data and keep current in-memory state.
    }
  }, []);

  const saveReportForDay = useCallback((studentId: string, dayNum: number, reportText: string, updatedDraftData?: any) => {
    const reportKey = `${studentId}_${dayNum}_${month}_${year}`;

    setSavedReports(prev => ({
      ...prev,
      [reportKey]: reportText,
    }));

    const sourceDraft = lastReports[studentId] || {};
    const currentToggles = buildSmartReportUndoSnapshot();
    const draftSnapshot = {
      ...JSON.parse(JSON.stringify(sourceDraft)),
      ...updatedDraftData,
      isRedoMode: currentToggles.isRedoMode,
      isRedoModeRev: currentToggles.isRedoModeRev,
      isRedoModeOldRev: currentToggles.isRedoModeOldRev,
      isRedoModeTilawa: currentToggles.isRedoModeTilawa,
      excludeReadingNew: currentToggles.excludeReadingNew,
      excludeReadingRev: currentToggles.excludeReadingRev,
      excludeReadingOldRev: currentToggles.excludeReadingOldRev,
      excludeReadingTilawa: currentToggles.excludeReadingTilawa,
      excludeHomeworkNew: currentToggles.excludeHomeworkNew,
      excludeHomeworkRev: currentToggles.excludeHomeworkRev,
      excludeHomeworkOldRev: currentToggles.excludeHomeworkOldRev,
      excludeHomeworkTilawa: currentToggles.excludeHomeworkTilawa,
      excludeNoorTam: currentToggles.excludeNoorTam,
      excludeNoorSayatim: currentToggles.excludeNoorSayatim,
      excludeQuranTajweed: currentToggles.excludeQuranTajweed,
      excludeNewFromReport: currentToggles.excludeNewFromReport,
      _dayNum: dayNum,
      _month: month,
      _year: year,
    };

    setSavedReportDrafts(prev => ({
      ...prev,
      [reportKey]: draftSnapshot,
    }));

  }, [
    month,
    year,
    lastReports,
    buildSmartReportUndoSnapshot,
  ]);

  const initializeReportDraft = (studentId: string, dayNum: number, currentMonth: number, currentYear: number) => {
    // Check if the current report is already saved (Editing Mode)
    const reportKey = `${studentId}_${dayNum}_${currentMonth}_${currentYear}`;
    if (savedReports[reportKey]) return; // Do not shift if editing a locked/saved report

    setLastReports(prev => {
      const prevReport = prev[studentId];

      // Check if we already have a DRAFT for this day
      if (prevReport && prevReport._dayNum === dayNum && prevReport._month === currentMonth && prevReport._year === currentYear) {
        return prev;
      }

      // === HOMEWORK -> READING MAPPING ===
      // Reading uses: fromPage/toPage, fromAyah/toAyah, fromJuz/toJuz, fromHizb/toHizb
      // Homework uses: from/to (generic)
      // We need to map based on mode

      // Fallback Logic: If no homework is defined, try to use the previous Reading as a base
      // This ensures we always have *some* context, even if the teacher forgot to assign homework.
      const prevHwNew = prevReport?.homeworkNew?.mode ? prevReport.homeworkNew : (prevReport?.readingNew || {});
      const prevHwRev = prevReport?.homeworkRev?.mode ? prevReport.homeworkRev : (prevReport?.readingRev || {});
      const prevHwTilawa = prevReport?.homeworkTilawa?.mode ? prevReport.homeworkTilawa : (prevReport?.readingTilawa || {});

      // Helper: Map homework/reading to reading format
      const mapHwToReading = (hw: any) => {
        const mode = hw.mode || 'page';

        // Extract generic 'from'/'to' OR specific 'fromPage'/'toPage', etc.
        const valFrom = hw.from || hw.fromPage || hw.fromAyah || hw.fromJuz || hw.fromHizb;
        const valTo = hw.to || hw.toPage || hw.toAyah || hw.toJuz || hw.toHizb;

        const result: any = {
          mode,
          surah: hw.surah,
          fromSurah: hw.fromSurah,
          toSurah: hw.toSurah,
          isAdvancedAyah: hw.isAdvancedAyah,
        };

        // Map extracted values to the correct field based on mode
        if (mode === 'ayah') {
          result.fromAyah = valFrom;
          result.toAyah = valTo;
        } else if (mode === 'juz') {
          result.fromJuz = valFrom;
          result.toJuz = valTo;
        } else if (mode === 'hizb') {
          result.fromHizb = valFrom;
          result.toHizb = valTo;
        } else {
          // page mode (default)
          result.fromPage = valFrom;
          result.toPage = valTo;
        }

        return result;
      };

      // Deep copy helper
      const deepCopy = (obj: any) => JSON.parse(JSON.stringify(obj || {}));

      // NEW SECTION
      const newReadingNew = mapHwToReading(prevHwNew);
      const newHomeworkNew = deepCopy(prevHwNew);

      // REVISION SECTION
      const newReadingRev = mapHwToReading(prevHwRev);
      const newHomeworkRev = deepCopy(prevHwRev);

      // TILAWA SECTION
      const newReadingTilawa = mapHwToReading(prevHwTilawa);
      const newHomeworkTilawa = deepCopy(prevHwTilawa);

      // Noor Al-Bayan rollover for a new report draft:
      // Move previous "next lesson" into today's "current lesson" for faster daily writing.
      const emptyNoorRange = { fromPage: '', toPage: '', fromLine: '', toLine: '' };
      const normalizeNoorRange = (range: any) => ({ ...emptyNoorRange, ...(range || {}) });
      const prevNoor = prevReport?.noor;
      const rolledNoor = prevNoor
        ? {
            book: prevNoor.book,
            tam: normalizeNoorRange(prevNoor.sayatim || prevNoor.tam),
            sayatim: normalizeNoorRange(prevNoor.sayatim),
          }
        : undefined;

      // Quran Tajweed rollover for a new report draft.
      const prevCurrentTajweedLessonRef = prevReport?.quranTajweed?.currentLessonId || defaultQuranTajweedLessonId;
      const prevNextTajweedLessonRef = prevReport?.quranTajweed?.nextLessonId || '';
      const reportStudentLanguage = getStudentPreferredContentLanguage(studentId);
      const prevCurrentTajweedLessonId = mapTajweedLessonRefToBankId(prevCurrentTajweedLessonRef, {
        studentId,
        forcedLanguage: reportStudentLanguage,
      }) || defaultQuranTajweedLessonId;
      const prevNextTajweedLessonId = mapTajweedLessonRefToBankId(prevNextTajweedLessonRef, {
        studentId,
        forcedLanguage: reportStudentLanguage,
      });
      const rolledCurrentTajweedLessonId = (prevNextTajweedLessonId && prevNextTajweedLessonId !== TAJWEED_NEXT_REPEAT && prevNextTajweedLessonId !== TAJWEED_NEXT_HIDE)
        ? prevNextTajweedLessonId
        : prevCurrentTajweedLessonId;

      console.log('[initializeReportDraft] Mapping homework to reading:', {
        prevHwNew,
        newReadingNew,
        prevHwRev,
        newReadingRev,
        prevHwTilawa,
        newReadingTilawa
      });

      return {
        ...prev,
        [studentId]: {
          ...prevReport,
          // New Section
          readingNew: newReadingNew,
          homeworkNew: newHomeworkNew,
          // Revision Section
          readingRev: newReadingRev,
          homeworkRev: newHomeworkRev,
          // Tilawa Section
          readingTilawa: newReadingTilawa,
          homeworkTilawa: newHomeworkTilawa,
          ...(rolledNoor ? { noor: rolledNoor } : {}),
          quranTajweed: {
            currentLessonId: rolledCurrentTajweedLessonId,
            nextLessonId: ''
          },

          // Mark this as a Draft for Today
          _dayNum: dayNum,
          _month: currentMonth,
          _year: currentYear
        }
      };
    });
  };

  // --- Helper: Cleanup Makeup Links when status changes manually ---
  const cleanupBreakLink = (studentId: string, dayNum: number, currentMonth: number, currentYear: number) => {
    const linkIndex = makeupLinks.findIndex(l =>
      l.studentId === studentId &&
      l.month === currentMonth &&
      l.year === currentYear &&
      (l.missedDay === dayNum || l.makeupDay === dayNum)
    );

    if (linkIndex !== -1) {
      const link = makeupLinks[linkIndex];

      // If breaking from Target (Makeup Day) -> DON'T delete the link, just let it revert to pending
      // The missed day stays yellow (postponed) and the link remains visible
      if (link.makeupDay === dayNum) {
        return;
      }

      // If breaking from Source (Missed Day) -> Delete the link and Reset Target (Makeup Day) if EXTRA_DAY
      const newLinks = [...makeupLinks];
      newLinks.splice(linkIndex, 1);
      setMakeupLinks(newLinks);

      if (link.missedDay === dayNum) {
        const targetKey = `${studentId}_${link.makeupDay}_${currentMonth}_${currentYear}`;
        setAttendance(prev => {
          if (prev[targetKey] === AttendanceStatus.EXTRA_DAY) {
            const next = { ...prev };
            delete next[targetKey];
            return next;
          }
          return prev;
        });
      }
    }
  };

  const toggleStatusConfirmed = (studentId: string, dayNum: number, isShift: boolean = false, isAlt: boolean = false, isCtrl: boolean = false) => {
    const key = `${studentId}_${dayNum}_${month}_${year}`;
    const current = attendance[key];
    const student = students.find(s => s.id === studentId);

    // Check if this is a Pending Double Class (Target of a makeup link + currently Present/Extra OR Scheduled Day)
    const pendingDoubleLink = makeupLinks.find(l =>
      l.studentId === studentId &&
      l.month === month &&
      l.year === year &&
      l.makeupDay === dayNum
    );

    // Determine if it's a "Scheduled" day (Red Circle)
    const dayOfWeek = getDayOfWeek(dayNum);
    const isDaySelected = student ? isScheduledOnDate(student, dayNum) : false;

    const isPendingDouble = pendingDoubleLink && (
      current === AttendanceStatus.PRESENT ||
      current === AttendanceStatus.EXTRA_DAY ||
      !current // Any makeup target with no status is pending (whether scheduled or not)
    ) && !isShift && !isAlt;

    // DRAFT MODE SNAPSHOT: Capture exact state before marking attendance
    const undoSnapshot = buildSmartReportUndoSnapshot();

    let next: AttendanceStatus | undefined;

    // Cleanup: We generally cleanup unless we are confirming a pending double
    if (!isPendingDouble) {
      cleanupBreakLink(studentId, dayNum, month, year);
    }

    // Keyboard Modifiers:
    // Shift+Click -> Toggle DOUBLE_CLASS ('2')
    // Alt+Click -> Toggle EXTRA_DAY ('e' - Blue Stroke) or EXEMPT
    // Ctrl+Click -> Toggle EXTRA_DOUBLE ('ed' - Blue Stroke + Red Dot)

    if (isCtrl) {
      if (current === AttendanceStatus.EXTRA_DOUBLE) {
        next = AttendanceStatus.ABSENT; // Clear it
      } else {
        next = AttendanceStatus.EXTRA_DOUBLE;
      }
    } else if (isShift) {
      if (current === AttendanceStatus.DOUBLE_CLASS) {
        next = AttendanceStatus.ABSENT;
      } else {
        next = AttendanceStatus.DOUBLE_CLASS;
      }
    } else if (isAlt) {
      // Check if it's a required day
      const dayOfWeek = getDayOfWeek(dayNum);
      const isDaySelected = student ? isScheduledOnDate(student, dayNum) : false;

      if (isDaySelected) {
        // If it's a required day
        // Special Case for Mixed Students (Double Scheduled):
        // If they clear a day (EXEMPT), Alt+Click should make it EXTRA_DAY (Blue Stroke) instead of Reverting to Scheduled.
        if (current === AttendanceStatus.EXEMPT) {
          next = AttendanceStatus.EXTRA_DAY;
        } else if (current === AttendanceStatus.EXTRA_DAY) {
          // If it's Extra Day on a Scheduled Day, clearing it should go back to EXEMPT (Empty/Cleared)
          next = AttendanceStatus.EXEMPT;
        } else {
          // Normal Case: Toggle Exemption
          next = AttendanceStatus.EXEMPT;
        }
      } else {
        // If NOT a required day, toggle Extra Class (Blue Stroke)
        // User Request: "First thing it does is erase" -> If there is ANY status, clear it.
        if (current) {
          next = AttendanceStatus.ABSENT;
        } else {
          next = AttendanceStatus.EXTRA_DAY;
        }
      }
    } else if (current) {
      if (current === AttendanceStatus.EXTRA_DOUBLE) {
        // User Request: Convert to DOUBLE_CLASS (Green 2)
        next = AttendanceStatus.DOUBLE_CLASS;

        // Also open report/link if available (Optional, but user said "calculate the session", implying mark as done)
        if (!student?.disableReport && !academyRates[student.academy]?.disableReports) {
          initializeReportDraft(studentId, dayNum, month, year);
          setSmartReportModal({
            isOpen: true,
            studentId,
            dayNum,
            undoSnapshot
          });
        } else {
          checkAndOpenLink(studentId);
        }
      } else if (isPendingDouble) {
        // Day already had a status (PRESENT/EXTRA_DAY) + makeup = double class
        next = AttendanceStatus.DOUBLE_CLASS;
        // Open report modal for makeup class
        if (!student?.disableReport && !academyRates[student.academy]?.disableReports) {
          initializeReportDraft(studentId, dayNum, month, year);
          setSmartReportModal({
            isOpen: true,
            studentId,
            dayNum,
            undoSnapshot
          });
        } else {
          checkAndOpenLink(studentId);
        }
      } else if (current === AttendanceStatus.EXTRA_DAY) {
        next = AttendanceStatus.PRESENT;
        // Show Smart Report Modal when marking extra class as present
        // Show Smart Report Modal when marking extra class as present
        if (!student?.disableReport && !academyRates[student.academy]?.disableReports) {
          initializeReportDraft(studentId, dayNum, month, year);
          setSmartReportModal({
            isOpen: true,
            studentId,
            dayNum,
            undoSnapshot
          });
        } else {
          // Reports Disabled: Auto-open meeting link immediately
          const meetingLink = student?.externalLink || academyRates[student.academy]?.externalLink;
          if (meetingLink) {
            const shouldOpenExternally = (academyRates[student.academy] as any)?.openLinksExternally;
            if (shouldOpenExternally) {
              openExternalLink(meetingLink);
            } else {
              handleOpenLink(meetingLink, `رابط الحصة: ${student?.name || ''}`);
            }
          }
        }
      } else {
        next = AttendanceStatus.ABSENT; // Will be deleted
      }
    } else if (isPendingDouble) {
      // Scheduled day (red circle) + makeup = double class; empty day = single makeup class
      next = isDaySelected ? AttendanceStatus.DOUBLE_CLASS : AttendanceStatus.PRESENT;
      // Open report modal for makeup class
      if (!student?.disableReport && !academyRates[student.academy]?.disableReports) {
        initializeReportDraft(studentId, dayNum, month, year);
        setSmartReportModal({
          isOpen: true,
          studentId,
          dayNum,
          undoSnapshot
        });
      } else {
        checkAndOpenLink(studentId);
      }
    } else {
      // Automatic detection based on student's schedule
      const dayOfWeek = getDayOfWeek(dayNum);
      const scheduledSessions = student ? getScheduledCountOnDate(student, dayNum) : 0;

      if (scheduledSessions === 2) {
        next = AttendanceStatus.DOUBLE_CLASS;
      } else {
        next = AttendanceStatus.PRESENT;

        // Auto-open meeting link if available
        // const meetingLink = student?.externalLink || academyRates[student.academy]?.externalLink;
        // if (meetingLink) {
        //   handleOpenLink(meetingLink, `رابط الحصة: ${student?.name || ''}`);
        // }
      }

      // Show Smart Report Modal when marking attendance if not disabled
      if (!student?.disableReport && !academyRates[student.academy]?.disableReports) {
        initializeReportDraft(studentId, dayNum, month, year);
        setSmartReportModal({
          isOpen: true,
          studentId,
          dayNum,
          undoSnapshot
        });
      } else {
        // Reports Disabled: Auto-open meeting link immediately
        const meetingLink = student?.externalLink || academyRates[student.academy]?.externalLink;
        if (meetingLink) {
          const shouldOpenExternally = (academyRates[student.academy] as any)?.openLinksExternally;
          if (shouldOpenExternally) {
            openExternalLink(meetingLink);
          } else {
            handleOpenLink(meetingLink, `رابط الحصة: ${student?.name || ''}`);
          }
        }
      }
    }

    // Save current state to history before making changes
    pushHistorySnapshot();

    // If unmarking (Absent), clear any saved report to ensure fresh sync next time
    if (next === AttendanceStatus.ABSENT) {
      setSavedReports(prev => {
        const newState = { ...prev };
        delete newState[key];
        return newState;
      });
      setSavedReportDrafts(prev => {
        const newState = { ...prev };
        delete newState[key];
        return newState;
      });
      // Also clear any LastReport draft state for this day to be safe 
      // (though initializeReportDraft handles existing drafts, clearing them ensures a truly fresh start)
      setLastReports(prev => {
        const prevReport = prev[studentId];
        if (prevReport && prevReport._dayNum === dayNum && prevReport._month === month && prevReport._year === year) {
          // Clear the daily marker to force re-initialization on next open
          return {
            ...prev,
            [studentId]: {
              ...prevReport,
              _dayNum: undefined
            }
          };
        }
        return prev;
      });
    }

    // Auto-decrement subscription counter when removing a counted status
    const sessionStatuses = [AttendanceStatus.PRESENT, AttendanceStatus.DOUBLE_CLASS, AttendanceStatus.EXTRA_DOUBLE, AttendanceStatus.PAID_ABSENCE, AttendanceStatus.EXTRA_DAY, AttendanceStatus.TRANSFERRED, AttendanceStatus.TRANSFERRED_ABSENT];
    if (current && sessionStatuses.includes(current as AttendanceStatus) && next === AttendanceStatus.ABSENT) {
      const studentSub = subscriptionSettings[studentId];
      if (studentSub?.enabled && studentSub.currentClass > 0) {
        // Determine decrement amount: shift+click DOUBLE_CLASS = 2, others = 1
        const decrement = (current === AttendanceStatus.DOUBLE_CLASS && isShift) ? 2 : 1;
        setSubscriptionSettings(prev => ({
          ...prev,
          [studentId]: {
            ...prev[studentId],
            currentClass: Math.max(0, prev[studentId].currentClass - decrement)
          }
        }));
      }
    }

    // Auto-increment subscription counter when marking a session status
    if (next && sessionStatuses.includes(next as AttendanceStatus)) {
      const studentSub = subscriptionSettings[studentId];
      if (studentSub?.enabled) {
        // Manual shift+click DOUBLE_CLASS counts as 2 sessions
        const increment = (next === AttendanceStatus.DOUBLE_CLASS && isShift) ? 2 : 1;
        setSubscriptionSettings(prev => {
          const cur = prev[studentId].currentClass;
          const total = prev[studentId].totalClasses;
          // In subscription mode, keep incrementing globally to maintain sequence history
          let newClass = cur + increment;
          return {
            ...prev,
            [studentId]: {
              ...prev[studentId],
              currentClass: newClass
            }
          };
        });
      }
    }

    setAttendance(prev => {
      const newState = { ...prev };
      if (next === AttendanceStatus.ABSENT) {
        delete newState[key];
      } else {
        newState[key] = next as AttendanceStatus;
      }
      return newState;
    });
  };

  // Public toggleStatus: intercepts non-today empty cell clicks for confirmation
  const toggleStatus = (studentId: string, dayNum: number, isShift: boolean = false, isAlt: boolean = false, isCtrl: boolean = false, mouseEvent?: React.MouseEvent) => {
    const student = students.find(s => s.id === studentId);
    const isScheduled = student ? isScheduledOnDate(student, dayNum) : false;

    // Only intercept: normal click (no modifiers) + (non-today OR non-scheduled) + currently empty cell
    if (confirmNonTodayAttendance && !isShift && !isAlt && !isCtrl && (!isTodayColumn(dayNum) || !isScheduled)) {
      const key = `${studentId}_${dayNum}_${month}_${year}`;
      const current = attendance[key];
      if (!current) {
        // Defer — show confirmation popup
        const x = mouseEvent?.clientX ?? window.innerWidth / 2;
        const y = mouseEvent?.clientY ?? window.innerHeight / 2;
        setPendingToggle({ studentId, dayNum, isShift, isAlt, isCtrl, x, y });
        return;
      }
    }
    toggleStatusConfirmed(studentId, dayNum, isShift, isAlt, isCtrl);
  };

  const pushHistorySnapshot = () => {
    setPast(prev => {
      const next = [
        ...prev,
        {
          att: attendance,
          sub: subscriptionSettings,
          reports: savedReports,
          reportDrafts: savedReportDrafts,
        }
      ];
      return next.length > 50 ? next.slice(-50) : next;
    });
    setFuture([]);
  };

  // Undo function
  const undo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    // Defensive: handle legacy entries that may not have the { att, sub } shape
    const prevAtt = previous.att || (previous as any);
    const prevSub = previous.sub || subscriptionSettings;
    const prevReports = previous.reports;
    const prevReportDrafts = previous.reportDrafts;
    if (!prevAtt || typeof prevAtt !== 'object') return; // Skip corrupted entries
    setPast(prev => prev.slice(0, -1));
    setFuture(prev => [{
      att: attendance,
      sub: subscriptionSettings,
      reports: savedReports,
      reportDrafts: savedReportDrafts,
    }, ...prev]);
    setAttendance(prevAtt);
    if (previous.sub) setSubscriptionSettings(prevSub);
    if (prevReports && typeof prevReports === 'object') setSavedReports(prevReports);
    if (prevReportDrafts && typeof prevReportDrafts === 'object') setSavedReportDrafts(prevReportDrafts);
  }, [past, attendance, subscriptionSettings, savedReports, savedReportDrafts]);

  // Redo function
  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    // Defensive: handle legacy entries that may not have the { att, sub } shape
    const nextAtt = next.att || (next as any);
    const nextSub = next.sub || subscriptionSettings;
    const nextReports = next.reports;
    const nextReportDrafts = next.reportDrafts;
    if (!nextAtt || typeof nextAtt !== 'object') return; // Skip corrupted entries
    setFuture(prev => prev.slice(1));
    setPast(prev => [...prev, {
      att: attendance,
      sub: subscriptionSettings,
      reports: savedReports,
      reportDrafts: savedReportDrafts,
    }]);
    setAttendance(nextAtt);
    if (next.sub) setSubscriptionSettings(nextSub);
    if (nextReports && typeof nextReports === 'object') setSavedReports(nextReports);
    if (nextReportDrafts && typeof nextReportDrafts === 'object') setSavedReportDrafts(nextReportDrafts);
  }, [future, attendance, subscriptionSettings, savedReports, savedReportDrafts]);

  // Keyboard shortcuts for Undo/Redo
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const hasUndoRedoModifier = e.ctrlKey || e.metaKey;
      const isUndoKey = e.code === 'KeyZ';
      const isRedoKey = e.code === 'KeyY';

      if (hasUndoRedoModifier && (isUndoKey || isRedoKey)) {
        const isScopedModalOpen = Boolean(
          smartReportModal?.isOpen ||
          isTajweedBankModalOpen ||
          isTajweedGradingModalOpen
        );

        // When typing or when these modals are open, let native/browser behavior handle Ctrl+Z/Y.
        if (isTypingTarget(e.target) || isScopedModalOpen) {
          return;
        }

        e.preventDefault();
        if (isUndoKey) {
          undo();
        } else {
          redo();
        }
      }

      // F5 to Refresh
      if (e.code === 'F5') {
        if (e.shiftKey) {
          e.preventDefault();
          const now = new Date();
          setIsTableLoading(true);
          // Small delay to allow UI to show loading state if needed, and reset
          setTimeout(() => {
            setMonth(now.getMonth());
            setYear(now.getFullYear());
            setTimeout(() => {
              setIsTableLoading(false);
            }, 50);
          }, 50);
        } else {
          window.location.reload();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, smartReportModal?.isOpen, isTajweedBankModalOpen, isTajweedGradingModalOpen]);

  const handleAddStudent = (student: Student) => {
    const existingStudent = students.find(s => s.id === student.id);
    const oldDays = existingStudent?.days || [];

    setStudents(prev => {
      const exists = prev.find(s => s.id === student.id);
      if (exists) {
        return prev.map(s => s.id === student.id ? student : s);
      }
      return [...prev, student];
    });

    // Determine today for current-month logic
    const isCurrentMonth = month === today.month && year === today.year;
    const todayDay = isCurrentMonth ? today.day : 0; // 0 means all days are "future" if viewing another month

    if (student.days && student.days.length > 0) {
      setAttendance(prev => {
        const next = { ...prev };
        let hasChanges = false;

        for (let d = 1; d <= daysInMonth; d++) {
          const dayOfWeek = getDayOfWeek(d);
          const key = `${student.id}_${d}_${month}_${year}`;
          const isNewlyScheduled = student.days!.includes(dayOfWeek) && !oldDays.includes(dayOfWeek);
          const isPast = isCurrentMonth && d < todayDay;

          // For newly scheduled days that are in the PAST: mark as EXEMPT (no red circle)
          if (isNewlyScheduled && isPast && !next[key]) {
            next[key] = AttendanceStatus.EXEMPT;
            hasChanges = true;
          }

          // For scheduled days from today onwards: remove EXEMPT to restore red circle
          if (student.days!.includes(dayOfWeek) && !isPast) {
            if (next[key] === AttendanceStatus.EXEMPT) {
              delete next[key];
              hasChanges = true;
            }
          }
        }
        return hasChanges ? next : prev;
      });
    }

    setIsModalOpen(false);
    setEditingStudent(null);
  };

  const deleteStudent = (id: string) => {
    const student = students.find(s => s.id === id);
    if (!student) return;

    setConfirmConfig({
      isOpen: true,
      title: 'حذف الطالب',
      message: `هل أنت متأكد من حذف الطالب "${student.name}"؟ سيتم حذف جميع بيانات الحضور الخاصة به أيضاً.`,
      onConfirm: () => {
        setStudents(prev => prev.filter(s => s.id !== id));
        setAttendance(prev => {
          const next = { ...prev };
          Object.keys(next).forEach(key => {
            if (key.startsWith(`${id}_`)) delete next[key];
          });
          return next;
        });
      }
    });
  };


  const handleImport = (parsed: any) => {
    try {
      if (parsed.students) setStudents(parsed.students);
      if (parsed.attendance) setAttendance(parsed.attendance);
      if (parsed.month !== undefined) setMonth(parsed.month);
      if (parsed.year !== undefined) setYear(parsed.year);
      if (parsed.dayOff !== undefined) setDayOff(parsed.dayOff);
      if (parsed.academyRates) setAcademyRates(parsed.academyRates);
      if (parsed.academyOrder) setAcademyOrder(parsed.academyOrder);
      if (parsed.monthlyObligations) setMonthlyObligations(parsed.monthlyObligations);
      if (parsed.autoBackupConfig) setAutoBackupConfig(parsed.autoBackupConfig);
      if (parsed.externalLinks) setExternalLinks(parsed.externalLinks);
      if (parsed.dayTransitionTime) setDayTransitionTime(parsed.dayTransitionTime);
      if (parsed.makeupLinks) setMakeupLinks(parsed.makeupLinks);
      alert('تم استيراد البيانات بنجاح! ✨');
    } catch (err) {
      alert('حدث خطأ أثناء تحميل البيانات');
    }
  };

  const clearAllData = () => {
    setConfirmConfig({
      isOpen: true,
      title: 'مسح كافة البيانات',
      message: 'هل أنت متأكد من مسح جميع بيانات الطلاب، الحصص، والإعدادات؟ هذا الإجراء نهائي.',
      onConfirm: () => {
        setStudents([]);
        setAttendance({});
        setAcademyRates({});
        setMakeupLinks([]);
        setAcademyOrder([]);
        localStorage.removeItem(STORAGE_KEY);
        setIsSettingsOpen(false);
      }
    });
  };

  const scrollToAcademy = (academy: string) => {
    const el = document.getElementById(`academy-${academy}`);
    if (el) {
      const yOffset = -155; // Offset for sticky headers
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  // --- Render Helpers ---
  const calculateTotal = (studentId: string) => {
    let count = 0;
    for (let i = 1; i <= daysInMonth; i++) {
      const status = attendance[`${studentId}_${i}_${month}_${year}`];
      if (status === AttendanceStatus.PRESENT || status === AttendanceStatus.PAID_ABSENCE) {
        count++;
      } else if (status === AttendanceStatus.DOUBLE_CLASS) {
        count += 2;
      }
    }
    return count;
  };

  const calculateMissed = (studentId: string) => {
    let count = 0;
    const student = students.find(s => s.id === studentId);
    if (!student) return 0;

    for (let i = 1; i <= daysInMonth; i++) {


      const key = `${studentId}_${i}_${month}_${year}`;
      const status = attendance[key];

      if ([AttendanceStatus.ABSENCE_RED, AttendanceStatus.UNEXCUSED_ABSENCE].includes(status as AttendanceStatus)) {
        count++;
      }
    }
    return count;
  };

  // --- Compute missed count row positions for fixed overlay ---
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!showMissedCount) {
      setMissedCountPositions([]);
      return;
    }

    const compute = () => {
      const rows = document.querySelectorAll<HTMLTableRowElement>('tr[data-student-id]');
      const newPositions: Array<{ studentId: string; y: number; height: number; count: number }> = [];

      rows.forEach(row => {
        const sid = row.getAttribute('data-student-id');
        if (!sid) return;
        // Inline count calculation to avoid stale closure
        const student = students.find(s => s.id === sid);
        if (!student) return;
        let count = 0;
        for (let i = 1; i <= daysInMonth; i++) {
          const key = `${sid}_${i}_${month}_${year}`;
          const status = attendance[key];
          if (status === AttendanceStatus.ABSENCE_RED || status === AttendanceStatus.UNEXCUSED_ABSENCE) count++;
        }
        if (count <= 0) return;
        const rect = row.getBoundingClientRect();
        newPositions.push({ studentId: sid, y: rect.top, height: rect.height, count });
      });

      setMissedCountPositions(newPositions);
    };

    const raf = requestAnimationFrame(compute);
    const onUpdate = () => requestAnimationFrame(compute);
    window.addEventListener('scroll', onUpdate, true);
    window.addEventListener('resize', onUpdate);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onUpdate, true);
      window.removeEventListener('resize', onUpdate);
    };
  }, [showMissedCount, students, attendance, month, year, daysInMonth]);


  const getCellColor = (status: AttendanceStatus | undefined, isDayOff: boolean) => {
    if (isDayOff) return 'bg-[#81ffea]'; // Cyan for weekend column

    switch (status) {
      case AttendanceStatus.PRESENT: return 'bg-emerald-500 text-white';
      case AttendanceStatus.TRANSFERRED: return 'bg-emerald-500 text-white';
      case AttendanceStatus.TRANSFERRED_ABSENT: return 'bg-gray-400 text-white';
      case AttendanceStatus.PAID_ABSENCE: return 'bg-gray-400 text-white';
      case AttendanceStatus.POSTPONED: return 'bg-yellow-400 text-black';
      default: return 'bg-red-50 hover:bg-red-100'; // Default Empty/Absent
    }
  };

  const getCellContent = (status: AttendanceStatus | undefined) => {
    switch (status) {
      case AttendanceStatus.PRESENT: return '✓';
      case AttendanceStatus.TRANSFERRED: return <ArrowRight size={16} strokeWidth={3} className="text-white" />;
      case AttendanceStatus.TRANSFERRED_ABSENT: return <ArrowRight size={16} strokeWidth={3} className="text-white" />;
      case AttendanceStatus.PAID_ABSENCE: return '!';
      case AttendanceStatus.POSTPONED: return 'م';
      case AttendanceStatus.UNEXCUSED_ABSENCE: return '–';
      case AttendanceStatus.ABSENCE_RED: return '';
      case AttendanceStatus.EXTRA_DAY: return '';
      case AttendanceStatus.DOUBLE_CLASS: return '2';
      case AttendanceStatus.EXTRA_DOUBLE: return '';
      default: return '';
    }
  };

  const getRemainingClasses = (dayNum: number) => {
    let count = 0;
    const dayOfWeek = getDayOfWeek(dayNum);

    students.forEach(student => {
      // 1. Check if student is active this month
      if (student.deletedAt) {
        if (year > student.deletedAt.year) return;
        if (year === student.deletedAt.year && month >= student.deletedAt.month) return;
      }

      const key = `${student.id}_${dayNum}_${month}_${year}`;
      const status = attendance[key];

      const academyHolidays = academyRates[student.academy]?.holidays || [];
      const isHoliday = academyHolidays.includes(dayOfWeek);
      const isScheduled = isScheduledOnDate(student, dayNum);

      // Check if this slot counts as "Remaining"
      // It is remaining if:
      // A) It's Scheduled AND Not Holiday AND Not Exempt AND Not Done
      // B) It's explicitly marked as EXTRA_DAY (which implies pending extra class)
      // C) It's a Makeup Target (Blue Stroke) AND Not Done

      const isExempt = status === AttendanceStatus.EXEMPT;
      const isDone = [
        AttendanceStatus.PRESENT,
        AttendanceStatus.PAID_ABSENCE,
        AttendanceStatus.POSTPONED,
        AttendanceStatus.UNEXCUSED_ABSENCE,
        AttendanceStatus.ABSENCE_RED, // Assumed dense red is "marked absent" thus done
        AttendanceStatus.DOUBLE_CLASS,
        AttendanceStatus.EXTRA_DOUBLE,
        AttendanceStatus.TRANSFERRED,
        AttendanceStatus.TRANSFERRED_ABSENT
      ].includes(status as AttendanceStatus);

      // Pending Statuses: undefined, null, or EXTRA_DAY
      const isPending = !isExempt && !isDone;

      const isMakeupTarget = makeupLinks.some(l =>
        l.studentId === student.id &&
        l.makeupDay === dayNum &&
        l.month === month &&
        l.year === year
      );

      if (status === AttendanceStatus.EXTRA_DAY || (isMakeupTarget && isPending)) {
        count++;
      } else if (isScheduled && !isHoliday && isPending) {
        count++;
      }
    });

    return count;
  };

  const scrollToFirstPending = (dayNum: number) => {
    const dayOfWeek = getDayOfWeek(dayNum);
    // Find the first student in the visual order that has a pending class

    // Flatten the grouped students to respect the visual order (Academy Order -> Student Order)
    const allStudentsOrdered = sortedAcademies.flatMap(academy => groupedStudents[academy] || []);

    for (const student of allStudentsOrdered) {
      // Check eligibility (copy of logic from getRemainingClasses)
      if (student.deletedAt) {
        if (year > student.deletedAt.year) continue;
        if (year === student.deletedAt.year && month >= student.deletedAt.month) continue;
      }



      const key = `${student.id}_${dayNum}_${month}_${year}`;
      const status = attendance[key];
      const academyHolidays = academyRates[student.academy]?.holidays || [];
      const isHoliday = academyHolidays.includes(dayOfWeek);
      const isScheduled = isScheduledOnDate(student, dayNum);

      const isExempt = status === AttendanceStatus.EXEMPT;
      const isDone = [
        AttendanceStatus.PRESENT,
        AttendanceStatus.PAID_ABSENCE,
        AttendanceStatus.POSTPONED,
        AttendanceStatus.UNEXCUSED_ABSENCE,
        AttendanceStatus.ABSENCE_RED,
        AttendanceStatus.DOUBLE_CLASS,
        AttendanceStatus.EXTRA_DOUBLE,
        AttendanceStatus.TRANSFERRED,
        AttendanceStatus.TRANSFERRED_ABSENT
      ].includes(status as AttendanceStatus);

      const isPending = !isExempt && !isDone;

      const isMakeupTarget = makeupLinks.some(l =>
        l.studentId === student.id &&
        l.makeupDay === dayNum &&
        l.month === month &&
        l.year === year
      );

      if (status === AttendanceStatus.EXTRA_DAY || (isScheduled && !isHoliday && isPending) || (isMakeupTarget && isPending)) {
        // Found the first pending one!
        const element = document.getElementById(`cell-${student.id}-${dayNum}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });

          // Target the circle div inside the cell
          const circle = element.querySelector('.js-cell-circle');
          if (circle) {
            const originalBoxShadow = circle.style.boxShadow; // Keep inline style if any (usually empty)
            const originalBorderColor = circle.style.borderColor;

            circle.style.transition = 'box-shadow 0.3s ease, border-color 0.3s ease';
            // Overwrite existing shadow (hiding the ring) and ensure no border shows
            circle.style.boxShadow = '0 0 8px 1px rgba(239, 68, 68, 0.6)';
            circle.style.borderColor = 'transparent';

            setTimeout(() => {
              circle.style.boxShadow = originalBoxShadow;
              circle.style.borderColor = originalBorderColor;
            }, 1000);
          }
        }
        return;
      }
    }
  };

  // Fixed widths for sticky columns
  const COL_PAY_WIDTH = "100px";
  const COL_COUNT_WIDTH = "100px";

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-[#ffe05d] animate-pulse font-arabic text-2xl">جاري تحميل البيانات...</div>
      </div>
    );
  }

  // --- Search helpers ---
  const normalizeForSearch = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const searchMatches = (name: string) => {
    if (!searchQuery.trim()) return true;
    return normalizeForSearch(name).includes(normalizeForSearch(searchQuery));
  };

  return (
    <div className="min-h-screen pb-20">
      <style>{customStyles}</style>

      {/* Search Overlay */}
      {isSearchOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-start justify-center pt-24 px-4 bg-black/20 backdrop-blur-[2px]"
          onClick={() => { closeSearchAndSaveHistory(searchQuery); }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 p-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 flex-shrink-0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { closeSearchAndSaveHistory(searchQuery); }
                  if (e.key === 'Escape') { setIsSearchOpen(false); setSearchQuery(''); }
                  
                  // Ctrl + Z (Undo / Previous history)
                  if (e.ctrlKey && e.code === 'KeyZ') {
                    e.preventDefault();
                    if (searchHistory.length > 0) {
                      let nextIndex = searchHistoryIndex;
                      if (nextIndex === -1) {
                        nextIndex = searchHistory.length - 1;
                      } else if (nextIndex > 0) {
                        nextIndex -= 1;
                      }
                      setSearchHistoryIndex(nextIndex);
                      setSearchQuery(searchHistory[nextIndex]);
                    }
                  }
                  
                  // Ctrl + Y (Redo / Next history)
                  if (e.ctrlKey && e.code === 'KeyY') {
                    e.preventDefault();
                    if (searchHistory.length > 0) {
                      let nextIndex = searchHistoryIndex;
                      if (nextIndex !== -1) {
                        if (nextIndex < searchHistory.length - 1) {
                          nextIndex += 1;
                          setSearchHistoryIndex(nextIndex);
                          setSearchQuery(searchHistory[nextIndex]);
                        } else {
                          setSearchHistoryIndex(-1);
                          setSearchQuery('');
                        }
                      }
                    }
                  }
                }}
                placeholder="ابحث عن اسم الطالب..."
                className="flex-1 text-xl font-arabic text-gray-800 outline-none bg-transparent placeholder:text-gray-300"
                dir="rtl"
                autoComplete="off"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-gray-300 hover:text-gray-500 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              )}
            </div>
            {searchQuery.trim() && (() => {
              const count = students.filter(s => searchMatches(s.name)).length;
              return (
                <div className="px-4 pb-3 flex items-center justify-between">
                  <span className="text-sm text-gray-400 font-arabic">
                    {count === 0 ? 'لا توجد نتائج' : `${count} طالب`}
                  </span>
                  <button
                    onClick={() => { setIsSearchOpen(false); }}
                    className="text-sm text-[#ffe05d] font-arabic font-bold hover:text-amber-500 transition-colors"
                  >
                    عرض النتائج
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}
      {/* 1. Sticky Top Bar: Navigation & Actions */}
      <nav className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur shadow-lg">
        <div className="flex items-center justify-between p-3 text-white">
          {/* Right: Academies Navigation */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar whitespace-nowrap flex-1 pr-4 px-2 py-2">
            <span className="ml-2 font-arabic text-lg text-gray-300 hidden md:inline">التنقل السريع:</span>

            {sortedAcademies.map((academy, index) => (
              <div
                key={academy}
                role="button"
                tabIndex={0}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDragEnter={() => setDragOverIndex(index)}
                onDragEnd={() => { setDraggedAcademyIndex(null); setDragOverIndex(null); }}
                onDrop={(e) => handleDrop(e, index)}
                onClick={(e) => {
                  if (selectedAcademy === academy) {
                    e.stopPropagation();
                  }
                  scrollToAcademy(academy);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    scrollToAcademy(academy);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setSelectedAcademyForDetails(academy);
                }}
                className={`px-4 py-1.5 rounded-full transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] text-base font-arabic border border-transparent whitespace-nowrap select-none cursor-pointer active:cursor-grabbing flex items-center gap-2 ${selectedAcademy === academy
                  ? 'bg-[#ffe05d] text-gray-900 scale-105 shadow-[0_0_20px_rgba(255,224,93,0.3)] font-bold z-10'
                  : 'bg-gray-700/50 text-gray-200 hover:bg-gray-600/80 hover:text-white hover:border-gray-500'
                  } ${draggedAcademyIndex === index ? 'opacity-40 scale-90 grayscale ring-2 ring-[#ffe05d] ring-offset-2 ring-offset-gray-900 border-dashed border-[#ffe05d]/50' : ''} ${dragOverIndex === index && draggedAcademyIndex !== index ? 'scale-110 -translate-y-1 !bg-gray-600 shadow-xl' : ''}`}
              >
                {academy}
                {academyRates[academy]?.externalLink && (
                  <button
                    type="button"
                    onClick={(e) => openExternalLink(academyRates[academy].externalLink!, e)}
                    className="text-gray-400 hover:text-[#ffe05d] transition-colors"
                    title="فتح ملف الأكاديمية"
                  >
                    <Link size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Left: Actions (Calendar & Add) */}
          <div className="flex items-center gap-3 pl-2 flex-none relative">
            <style>{`
              @keyframes popupBlur {
                0% { opacity: 0; transform: translateY(-10px) scale(0.95); filter: blur(8px); }
                100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
              }
              /* Asymmetric row hover: slow fade-out, fast fade-in */
              .row-hover-tr {
                will-change: background-color;
                transition: background-color 300ms ease-out, opacity 200ms, filter 200ms, transform 200ms;
              }
              .row-hover-tr:hover {
                transition: background-color 150ms ease-out, opacity 200ms, filter 200ms, transform 200ms;
              }
            `}</style>

            {/* Calendar Controls Toggle */}
            <div className="relative flex items-center gap-3">
              {/* Month Name (Clickable) */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMonthSelector(!showMonthSelector);
                    setShowControls(false); // Close other menu if open
                  }}
                  className={`text-xl font-arabic text-white/90 hover:text-white hover:bg-white/10 px-6 py-2 rounded-lg transition-all whitespace-nowrap flex items-center justify-center gap-2 relative ${showControls ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                >
                  {MONTHS[month]}
                </button>

                {/* Month Selector Dropdown */}
                {showMonthSelector && (
                  <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[100]">
                    <div
                      className="bg-white rounded-2xl shadow-xl border border-gray-100 p-2 w-[200px] origin-top overflow-hidden"
                      style={{ animation: 'popupBlur 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto custom-scrollbar p-1">
                        <style>{`
                            .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                            .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
                            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
                        `}</style>
                        {MONTHS.map((m, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              handleMonthChange(i);
                            }}
                            className={`py-3 px-4 rounded-xl text-lg font-arabic transition-all text-center ${month === i
                              ? 'bg-[#ffe05d] text-gray-900 font-bold shadow-sm scale-[1.02]'
                              : 'hover:bg-gray-50 text-gray-600 hover:text-gray-900 hover:scale-[1.02]'
                              }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowControls(!showControls)}
                className={`group flex items-center justify-center w-10 h-10 rounded-full transition-all hover:bg-white/10 ${showControls ? 'bg-white/20 text-[#ffe05d]' : 'text-gray-300'}`}
                title="تاريخ الجدول"
              >
                <Calendar size={22} strokeWidth={2} />
              </button>


              {/* Popup Controls Card */}
              {showControls && (
                <div
                  className="absolute top-12 left-0 flex flex-col gap-3 bg-white p-5 rounded-2xl shadow-2xl border border-gray-100 font-tajawal z-50 w-[300px]"
                  style={{ animation: 'popupBlur 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
                >
                  <div className="flex items-center justify-between text-gray-800 border-b border-gray-100 pb-3 mb-2">
                    <span className="font-bold text-xl">تاريخ الجدول</span>
                    <button onClick={() => setShowControls(false)} className="text-gray-400 hover:text-red-500"><Plus size={24} className="rotate-45" /></button>
                  </div>

                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <label className="text-base font-medium text-gray-600">الشهر:</label>
                      <select
                        value={month}
                        onChange={(e) => handleMonthChange(Number(e.target.value))}
                        className="h-11 w-36 text-center text-lg font-bold border border-gray-200 rounded-xl bg-gray-50 text-gray-800 outline-none focus:border-[#ffe05d] focus:ring-2 focus:ring-[#ffe05d]/20 transition-all font-arabic appearance-none cursor-pointer"
                        style={{ textAlignLast: 'center' }}
                      >
                        {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                      </select>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-base font-medium text-gray-600">السنة:</label>
                      <input
                        type="number"
                        value={year}
                        onChange={(e) => handleYearChange(Number(e.target.value))}
                        dir="ltr"
                        className="h-11 w-36 text-center text-lg font-bold border border-gray-200 rounded-xl bg-gray-50 text-gray-800 outline-none focus:border-[#ffe05d] focus:ring-2 focus:ring-[#ffe05d]/20 transition-all font-english appearance-none"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-base font-medium text-gray-600">يوم الإجازة:</label>
                      <select
                        value={dayOff}
                        onChange={(e) => setDayOff(Number(e.target.value))}
                        className="h-11 w-36 text-center text-lg font-bold border border-gray-200 rounded-xl bg-gray-50 text-gray-800 outline-none focus:border-[#ffe05d] focus:ring-2 focus:ring-[#ffe05d]/20 transition-all font-arabic appearance-none cursor-pointer"
                        style={{ textAlignLast: 'center' }}
                      >
                        {DAYS_OF_WEEK.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>


            {/* Add Action Button */}
            <div className="relative mt-1">
              <button
                onClick={() => setShowAddMenu(!showAddMenu)}
                className={`group flex items-center justify-center w-10 h-10 bg-[#4F46E5] text-white rounded-full hover:bg-[#4338ca] shadow-[0_2px_10px_0_rgba(79,70,229,0.3)] transition-all hover:scale-105 active:scale-95 ${showAddMenu ? 'rotate-45 bg-red-500 hover:bg-red-600' : ''}`}
                title="إضافة..."
              >
                <Plus size={22} strokeWidth={2.5} />
              </button>

              {showAddMenu && (
                <div
                  className="absolute top-12 left-0 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 w-56 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                  style={{ zIndex: 60 }}
                >
                  <button
                    onClick={() => {
                      setIsModalOpen(true);
                      setShowAddMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors text-right"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                      <Plus size={18} />
                    </div>
                    <span className="font-arabic text-2xl">إضافة طالب</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsAddingAcademy(true);
                      setShowAddMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors text-right"
                  >
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                      <Plus size={18} />
                    </div>
                    <span className="font-arabic text-2xl">إضافة أكاديمية</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* 🛠️ Utility Bar: Settings & Stats */}
      <div className="flex items-start py-4" dir="ltr">
        <div className="flex-shrink-0 ml-11">
          <div className="flex gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
            <div className="relative">
              <button
                onClick={() => {
                  setTajweedGradingFocusStudentId(null);
                  setIsTajweedGradingModalOpen(true);
                }}
                className="w-10 h-10 bg-amber-600 text-amber-50 hover:bg-amber-500 hover:text-white rounded-xl flex items-center justify-center shadow-sm transition-all active:scale-95"
                title="تصحيح التجويد"
              >
                <Bell size={20} strokeWidth={2.3} />
              </button>
              {unseenUngradedTajweedStudentsCount > 0 && (
                <div className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm animate-pulse-scale-glow">
                  {toHindiDigits(unseenUngradedTajweedStudentsCount)}
                </div>
              )}
            </div>

            <button
              onClick={() => setIsTajweedBankModalOpen(true)}
              className="w-10 h-10 bg-emerald-700 text-emerald-100 hover:bg-emerald-600 hover:text-white rounded-xl flex items-center justify-center shadow-sm transition-all active:scale-95"
              title="بنك التجويد"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
            </button>
          </div>
        </div>

        <div className="flex-1 flex justify-start px-12" dir="rtl">
          <div className="flex gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="w-10 h-10 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white rounded-xl flex items-center justify-center shadow-sm transition-all active:scale-95"
                title="الإعدادات"
              >
                <Settings size={22} strokeWidth={2} />
              </button>

              <button
                onClick={() => {
                  const type = externalLinks.partnership_type || 'link';
                  const linkVal = externalLinks.partnership_linkVal || externalLinks.partnership || '';
                  const copyVal = externalLinks.partnership_copyVal || '';

                  if (type === 'copy') {
                    if (copyVal) {
                      navigator.clipboard.writeText(copyVal);
                      showToast('تم نسخ التفاصيل! 📝');
                    } else {
                      showToast('لا يوجد نص محفوظ للنسخ (كليك يمين للضبط) 📝');
                    }
                  } else {
                    if (linkVal) {
                      handleOpenLink(linkVal, 'الحسابات');
                    } else {
                      showToast('يرجى إضافة رابط الحسابات أولاً (كليك يمين للضبط)');
                    }
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setActionConfigModal({
                    isOpen: true,
                    target: 'partnership',
                    initialConfig: {
                      type: externalLinks.partnership_type || 'link',
                      copyVal: externalLinks.partnership_copyVal || '',
                      linkVal: externalLinks.partnership_linkVal || externalLinks.partnership || ''
                    }
                  });
                }}
                className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm transition-all active:scale-95 ${(externalLinks.partnership_type === 'copy' && externalLinks.partnership_copyVal) || ((!externalLinks.partnership_type || externalLinks.partnership_type === 'link') && (externalLinks.partnership_linkVal || externalLinks.partnership))
                  ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                  : 'bg-slate-300 text-slate-500 hover:bg-slate-400'
                  }`}
                title={externalLinks.partnership_type === 'copy' ? "الحسابات (نسخ) (كليك يمين للضبط)" : "الحسابات (فتح) (كليك يمين للضبط)"}
              >
                {externalLinks.partnership_type === 'copy' ? <Copy size={20} strokeWidth={2} /> : <Users2 size={22} strokeWidth={2} />}
              </button>

              <button
                onClick={() => {
                  const type = externalLinks.expenses_type || 'link';
                  const linkVal = externalLinks.expenses_linkVal || externalLinks.expenses || '';
                  const copyVal = externalLinks.expenses_copyVal || '';

                  if (type === 'copy') {
                    if (copyVal) {
                      navigator.clipboard.writeText(copyVal);
                      showToast('تم نسخ التفاصيل! 📝');
                    } else {
                      showToast('لا يوجد نص محفوظ للنسخ (كليك يمين للضبط) 📝');
                    }
                  } else {
                    if (linkVal) {
                      handleOpenLink(linkVal, 'المصروفات');
                    } else {
                      showToast('يرجى إضافة رابط المصروفات أولاً (كليك يمين للضبط)');
                    }
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setActionConfigModal({
                    isOpen: true,
                    target: 'expenses',
                    initialConfig: {
                      type: externalLinks.expenses_type || 'link',
                      copyVal: externalLinks.expenses_copyVal || '',
                      linkVal: externalLinks.expenses_linkVal || externalLinks.expenses || ''
                    }
                  });
                }}
                className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm transition-all active:scale-95 ${(externalLinks.expenses_type === 'copy' && externalLinks.expenses_copyVal) || ((!externalLinks.expenses_type || externalLinks.expenses_type === 'link') && (externalLinks.expenses_linkVal || externalLinks.expenses))
                  ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                  : 'bg-slate-300 text-slate-500 hover:bg-slate-400'
                  }`}
                title={externalLinks.expenses_type === 'copy' ? "المصروفات (نسخ) (كليك يمين للضبط)" : "المصروفات (فتح) (كليك يمين للضبط)"}
              >
                {externalLinks.expenses_type === 'copy' ? <Copy size={20} strokeWidth={2} /> : <Banknote size={22} strokeWidth={2} />}
              </button>

              <button
                onClick={() => {
                  const type = externalLinks.taskCompletion_type || 'link';
                  const linkVal = externalLinks.taskCompletion_linkVal || externalLinks.taskCompletion || '';
                  const copyVal = externalLinks.taskCompletion_copyVal || '';

                  if (type === 'copy') {
                    if (copyVal) {
                      navigator.clipboard.writeText(copyVal);
                      showToast('تم نسخ التفاصيل! 📋');
                    } else {
                      showToast('لا يوجد نص محفوظ للنسخ (كليك يمين للضبط) 📝');
                    }
                  } else {
                    if (linkVal) {
                      handleOpenLink(linkVal, 'استخراج مواعيد الطلاب');
                    } else {
                      showToast('يرجى إضافة رابط استخراج مواعيد الطلاب أولاً (كليك يمين للضبط)');
                    }
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setActionConfigModal({
                    isOpen: true,
                    target: 'taskCompletion',
                    initialConfig: {
                      type: externalLinks.taskCompletion_type || 'link',
                      copyVal: externalLinks.taskCompletion_copyVal || '',
                      linkVal: externalLinks.taskCompletion_linkVal || externalLinks.taskCompletion || ''
                    }
                  });
                }}
                className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm transition-all active:scale-95 ${(externalLinks.taskCompletion_type === 'copy' && externalLinks.taskCompletion_copyVal) || ((!externalLinks.taskCompletion_type || externalLinks.taskCompletion_type === 'link') && (externalLinks.taskCompletion_linkVal || externalLinks.taskCompletion))
                  ? 'bg-amber-500 text-white hover:bg-amber-400'
                  : 'bg-slate-300 text-slate-500 hover:bg-slate-400'
                  }`}
                title={externalLinks.taskCompletion_type === 'copy' ? "استخراج مواعيد الطلاب (نسخ) (كليك يمين للضبط)" : "استخراج مواعيد الطلاب (فتح) (كليك يمين للضبط)"}
              >
                {externalLinks.taskCompletion_type === 'copy' ? (
                  <Copy size={20} strokeWidth={2} />
                ) : (
                  <Link size={22} strokeWidth={2.4} aria-hidden="true" />
                )}
              </button>

            </div>

            {/* Quick Links for Session durations */}
            <div className="flex gap-4 bg-white/50 p-1 rounded-2xl border border-slate-100 shadow-sm ml-auto relative z-[60]">
              <button
                onClick={() => {
                  setActionChoiceModal({
                    isOpen: true,
                    title: '٣٠ دقيقة',
                    target: '30m'
                  });
                }}
                className={'w-10 h-10 rounded-xl flex flex-col items-center justify-center transition-all active:scale-90 font-english font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 shadow-sm border border-emerald-100/50'}
                title="٣٠ دقيقة (كليك للاختيار)"
              >
                <span className="text-sm leading-none">30</span>
                <Clock size={12} strokeWidth={2.5} className="mt-0.5" />
              </button>

              <button
                onClick={() => {
                  setActionChoiceModal({
                    isOpen: true,
                    title: '٦٠ دقيقة',
                    target: '60m'
                  });
                }}
                className={'w-10 h-10 rounded-xl flex flex-col items-center justify-center transition-all active:scale-90 font-english font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 shadow-sm border border-emerald-100/50'}
                title="٦٠ دقيقة (كليك للاختيار)"
              >
                <span className="text-sm leading-none">60</span>
                <Clock size={12} strokeWidth={2.5} className="mt-0.5" />
              </button>
            </div>
          </div>

          <button
            onClick={() => setIsMonthlyStatsOpen(true)}
            className="h-10 px-5 bg-[#ffe05d] text-gray-900 rounded-xl flex items-center gap-2 shadow-sm hover:bg-[#fcd030] hover:shadow-md transition-all font-arabic font-bold text-lg"
            title="إحصائيات الشهر"
          >
            <BarChart3 size={20} />
            <span>إحصائيات الشهر</span>
          </button>

          <button
            onClick={() => setIsLastMonthStatsOpen(true)}
            className="h-10 px-5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl flex items-center gap-2 shadow-sm hover:bg-indigo-100 hover:shadow-md transition-all font-arabic font-bold text-lg"
            title="إحصائيات الشهر الماضي"
          >
            <History size={20} />
            <span>إحصائيات الشهر الماضي</span>
          </button>
        </div>
      </div>
      </div>

      <div
        onClick={() => setHadithIndex((prev) => (prev + 1) % HADITHS.length)}
        className="text-center py-6 cursor-pointer select-none transition-all hover:scale-[1.01] active:scale-[0.99] px-4 -mt-14"
      >
        <p
          className="font-arabic text-2xl md:text-3xl font-semibold leading-relaxed"
          style={{
            color: '#d4a017',
            letterSpacing: '0.02em',
            textShadow: '0 0 15px rgba(212, 160, 23, 0.5), 0 0 30px rgba(212, 160, 23, 0.3), 0 0 45px rgba(212, 160, 23, 0.1)'
          }}
        >
          {HADITHS[hadithIndex]}
        </p>
      </div>

      {/* 2. Main Grid */}
      <main
        ref={mainRef}
        className="px-12 pb-6 pt-10 min-h-[calc(100vh-100px)] relative"
      >
        {/* Missed Count Overlay - Fixed positioned, outside the scroll container */}
        {showMissedCount && missedCountPositions.map(({ studentId, y, height, count }) => {
          const tableLeft = tableScrollRef.current?.getBoundingClientRect().left ?? 0;
          return (
            <div
              key={studentId}
              className="fixed z-[5] pointer-events-auto"
              style={{
                top: `${y}px`,
                left: `${tableLeft - 2}px`,
                height: `${height}px`,
                transform: 'translateX(-100%)',
                display: 'flex',
                alignItems: 'center',
                animation: 'missedSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both',
              }}
              onClick={(e) => {
                e.stopPropagation();
                setMissedClassesMenu({
                  isOpen: true,
                  x: tableLeft - 60,
                  y: y + height / 2,
                  studentId
                });
              }}
              title="نسخ تقرير الحصص الفائتة"
            >
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 cursor-pointer group/badge"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(248,250,252,0.9))',
                  borderRadius: '10px 0 0 10px',
                  boxShadow: '-4px 2px 16px -4px rgba(0,0,0,0.18), -1px 0 0 rgba(0,0,0,0.06)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(0,0,0,0.07)',
                  borderRight: 'none',
                }}
              >
                <span className="text-gray-700 text-sm font-bold font-arabic leading-none group-hover/badge:text-black transition-colors">
                  {toHindiDigits(count)}
                </span>
              </div>
            </div>
          );
        })}
        <div 
          ref={tableScrollRef}
          className="bg-white rounded-3xl relative z-10 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.1),0_-8px_30px_-12px_rgba(0,0,0,0.1)] group/table-container w-full overflow-x-auto"
          onScroll={(e) => {
            if (stickyHeaderRef.current) {
              stickyHeaderRef.current.scrollLeft = e.currentTarget.scrollLeft;
            }
            // Close context menu on scroll
            if (academyContextMenu.isOpen) {
              setAcademyContextMenu(prev => ({ ...prev, isOpen: false, isClosing: true }));
              setTimeout(() => setAcademyContextMenu(prev => ({ ...prev, isClosing: false })), 200);
            }
          }}
        >
          {/* Month Name Watermark - Absolute positioned */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-none z-10">
            <span className="font-arabic text-3xl text-slate-400">
              {MONTHS[month]}
            </span>
          </div>

          {isTableLoading ? (
            <div className="h-[60vh] flex items-center justify-center">
              <div className="text-[#ffe05d] animate-pulse font-arabic text-xl">جاري التحديث...</div>
            </div>
          ) : (
            <table
              ref={originalTableRef}
              className="w-full border-separate border-spacing-0 text-center min-w-max"
            >
              <thead
                ref={originalHeaderRef}
                className={`sticky top-[74px] z-30 transition-opacity duration-200 ${showStickyHeader ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
              >
                <tr
                  className="text-white/90 rounded-xl bg-[#002060] group/header"
                  style={{
                    borderRadius: '12px'
                  }}
                >
                  <th
                    ref={studentHeaderRef}
                    className="sticky right-0 z-40 p-4 font-arabic text-2xl min-w-[220px] w-[220px] text-center px-2 font-normal bg-[#002060]"
                    style={{
                      color: 'white',
                      backgroundImage: `
                      radial-gradient(circle at 50% 50%, transparent 0%, #002060 100%),
                      repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 2px, transparent 2px, transparent 10px),
                      repeating-linear-gradient(-45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 2px, transparent 2px, transparent 10px)
                    `,
                      backgroundBlendMode: 'overlay'
                    }}
                  >الطالب</th>

                  {/* Date Columns */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const dayNum = i + 1;
                    const isWknd = isWeekend(dayNum);
                    const isToday = isTodayColumn(dayNum);
                    const remainingCount = getRemainingClasses(dayNum);

                    return (
                      <th
                        key={dayNum}
                        className={`p-3 min-w-[70px] antialiased relative`}
                        style={{
                          backgroundColor: isToday ? 'rgba(255, 224, 93, 0.4)' : isWknd ? 'rgba(129, 255, 234, 0.1)' : 'transparent'
                        }}
                      >
                        {remainingCount > 0 && (
                          <div
                            onClick={(e) => { e.stopPropagation(); scrollToFirstPending(dayNum); }}
                            className={`absolute -top-8 left-1/2 -translate-x-1/2 min-w-[16px] h-4 flex items-center justify-center z-20 transition-all duration-300 cursor-pointer hover:scale-125 active:scale-95 ${isToday ? 'opacity-100' : 'opacity-0 group-hover/header:opacity-100 translate-y-2 group-hover/header:translate-y-0'}`}
                            title="انقر للذهاب لأول حصة متبقية"
                          >
                            <span className="text-[#ffe05d] text-base font-bold font-arabic drop-shadow-md">{toHindiDigits(remainingCount)}</span>
                          </div>
                        )}

                        <div
                          className="font-amiri text-lg antialiased mb-2 text-white tracking-widest"
                          style={{ WebkitTextStroke: '0.5px rgba(0,0,0,0.3)' }}
                        >
                          {DAYS_OF_WEEK[getDayOfWeek(dayNum)].name}
                        </div>
                        <div
                          className={`text-xl font-arabic antialiased transition-all ${isToday ? 'text-gray-900 font-bold scale-110' : 'text-white'}`}
                          style={{ WebkitTextStroke: isToday ? '0' : '0.5px rgba(0,0,0,0.3)' }}
                        >
                          {toHindiDigits(dayNum)}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody className="bg-white">
                {/* Spacer Row */}
                <tr className="h-16 bg-white"><td colSpan={daysInMonth + 1}></td></tr>

                {sortedAcademies.length === 0 && (
                  <tr>
                    <td colSpan={daysInMonth + 1} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-4 text-gray-400">
                        <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center">
                          <Users2 size={40} className="text-gray-300" />
                        </div>
                        <p className="font-arabic text-3xl">لا يوجد طلاب حالياً. قم بإضافة طلاب جدد للبدء.</p>
                      </div>
                    </td>
                  </tr>
                )}

                {sortedAcademies.map(academy => {
                  const academyStudents = groupedStudents[academy] || [];
                  const allHiddenBySearch = searchQuery.trim() !== '' && academyStudents.every(s => !searchMatches(s.name));
                  return (
                  <React.Fragment key={academy}>
                    {/* Section Header */}
                    <tr id={`academy-${academy}`} className={`scroll-mt-40 group ${allHiddenBySearch ? 'hidden' : ''}`}>
                      <td
                        colSpan={daysInMonth + 1}
                        className="bg-gray-50/80 p-4 text-center select-none"
                      >
                        <div
                          onContextMenu={(e) => {
                            e.preventDefault();
                            const rect = e.currentTarget.getBoundingClientRect();
                            setAcademyContextMenu({
                              isOpen: true,
                              isClosing: false,
                              x: rect.right - 220, // Sync viewport coordinates
                              y: rect.bottom + 5,  // Sync viewport coordinates
                              academy: academy
                            });
                          }}
                          className={`inline-flex items-center gap-3 px-6 py-2 bg-white rounded-full shadow-sm border border-gray-100 text-2xl text-gray-800 select-none cursor-pointer hover:bg-gray-50 hover:shadow-md transition-all ${/[a-zA-Z]/.test(academy) ? 'font-english' : 'font-arabic'}`}
                          onClick={() => setSelectedAcademyForDetails(academy)}
                        >
                          <span>{academy}</span>
                          {academyRates[academy]?.externalLink && (
                            <button
                              type="button"
                              onClick={(e) => openExternalLink(academyRates[academy].externalLink!, e)}
                              className="text-gray-400 hover:text-[#002060] transition-colors"
                              title="فتح ملف الأكاديمية"
                            >
                              <Link size={20} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {groupedStudents[academy].map((student, sIdx) => {
                      const totalDays = calculateTotal(student.id);
                      // For Mixed students, rate is the Hourly rate, so we divide by 2 for each 30-min unit
                      const effectiveRate = student.duration === 'خليط' ? student.rate / 2 : student.rate;
                      const totalPay = totalDays * effectiveRate;
                      const unseenUngradedTajweedCount = getUnseenUngradedTajweedCount(student.id);

                      const isEnding = !!student.deletedAt;

                      // Logic to predict expected subscription end day for scheduled students
                      const sub = subscriptionSettings[student.id];
                      let expectedEndDay: number | null = null;
                      if (!isEnding && sub?.enabled && sub.mode === 'subscription' && (student.days?.length ?? 0) > 0) {
                        try {
                          const limit = sub.totalClasses || 8;
                          // If currentClass is 8, 16, etc., it means 8/8 is done.
                          // Remaining in current cycle:
                          const doneInCurrentCycle = sub.currentClass % limit;
                          let remaining = limit - doneInCurrentCycle; 
                          
                          if (remaining > 0) {
                            let currentSimMonth = today.month;
                            let currentSimYear = today.year;
                            let remainingToFind = remaining;
                            let found = false;

                            // Limit search to 12 months for safety
                            for (let m = 0; m < 12; m++) {
                              const isTodayMonth = (currentSimMonth === today.month && currentSimYear === today.year);
                              const isViewMonth = (currentSimMonth === month && currentSimYear === year);
                              
                              const simDaysInMonth = new Date(currentSimYear, currentSimMonth + 1, 0).getDate();
                              const startD = isTodayMonth ? today.day : 1;
                              
                              for (let d = startD; d <= simDaysInMonth; d++) {
                                // Calculate day of week for the simulated date
                                const dow = new Date(currentSimYear, currentSimMonth, d).getDay();
                                if (isScheduledOnDate(student, d, currentSimMonth, currentSimYear)) {
                                  // Account for marks already made
                                  if (!attendance[`${student.id}_${d}_${currentSimMonth}_${currentSimYear}`]) {
                                    remainingToFind--;
                                    if (remainingToFind === 0) {
                                      if (isViewMonth) {
                                        expectedEndDay = d;
                                      }
                                      found = true;
                                      break;
                                    }
                                  }
                                }
                              }
                              
                              if (found) break;
                              
                              currentSimMonth++;
                              if (currentSimMonth > 11) {
                                currentSimMonth = 0;
                                currentSimYear++;
                              }
                            }
                          }
                        } catch (e) {
                          console.error("Failed to calculate expectedEndDay:", e);
                        }
                      }

                      const isSearchHidden = searchQuery.trim() !== '' && !searchMatches(student.name);
                      return (
                        <tr
                          key={student.id}
                          data-student-id={student.id}
                          draggable={true}
                          onDragStart={(e) => handleStudentDragStart(e, student.id)}
                          onDragOver={(e) => handleStudentDragOver(e, student.id)}
                          onDragEnd={() => { setDraggedStudentId(null); setStudentDragOverId(null); stopAutoScroll(); }}
                          onDrop={(e) => handleStudentDrop(e, student.id)}
                          className={`
                            hover:bg-blue-100 rounded-2xl group relative cursor-move row-hover-tr
                            ${isSearchHidden ? 'hidden' : ''}
                            ${draggedStudentId === student.id ? 'opacity-20 grayscale scale-[0.98] blur-[1px]' : ''}
                            ${(student.hasTopSeparator && (student.hasBottomSeparator || student.hasSeparator))
                              ? 'shadow-[0_10px_15px_-8px_rgba(0,0,0,0.1),0_-10px_15px_-8px_rgba(0,0,0,0.1)]'
                              : student.hasTopSeparator
                                ? 'shadow-[0_-10px_15px_-8px_rgba(0,0,0,0.1)]'
                                : (student.hasBottomSeparator || student.hasSeparator)
                                  ? 'shadow-[0_10px_15px_-8px_rgba(0,0,0,0.1)]'
                                  : ''
                            }
                          `}
                        >
                          <td
                            className={`sticky right-0 z-[25] p-0 text-center text-gray-800 whitespace-nowrap cursor-pointer hover:brightness-100 transition-all select-none relative group/student border-none shadow-none min-w-[220px] w-[220px] backdrop-blur-[6px] ${isEnding ? 'opacity-40 grayscale saturate-50' : ''} ${selectedStudentIds.has(student.id) ? 'opacity-60' : ''}`}
                            style={{
                              background: (() => {
                                const rgb = student.color ? {
                                  'red': '244, 63, 94',
                                  'orange': '249, 115, 22',
                                  'green': '16, 185, 129',
                                  'blue': '59, 130, 246',
                                  'purple': '139, 92, 246'
                                }[student.color] || '255, 224, 93' : '255, 224, 93';
                                return `linear-gradient(to left, rgba(${rgb}, 0.08) 95%, rgba(${rgb}, 0) 100%)`;
                              })()
                            }}
                            onClick={(e) => {
                              // Skip if this click was triggered after a long-press
                              if (longPressTriggeredRef.current) {
                                longPressTriggeredRef.current = false;
                                return;
                              }
                              // Ctrl/Cmd + click on student name opens student link directly.
                              if ((e.ctrlKey || e.metaKey) && !isMultiSelectMode && !isTajweedShortcutPressed) {
                                handleOpenLink(buildStudentPortalUrl(student), student.name);
                                return;
                              }
                              // If in multi-select mode, toggle selection instead of opening details
                              if (isMultiSelectMode) {
                                setSelectedStudentIds(prev => {
                                  const newSet = new Set(prev);
                                  if (newSet.has(student.id)) {
                                    newSet.delete(student.id);
                                    // If no students selected, exit multi-select mode
                                    if (newSet.size === 0) {
                                      setIsMultiSelectMode(false);
                                    }
                                  } else {
                                    newSet.add(student.id);
                                  }
                                  return newSet;
                                });
                              } else if (isTajweedShortcutPressed) {
                                markUngradedTajweedAssignmentsAsSeen(student.id);
                                setTajweedGradingFocusStudentId(student.id);
                                setIsTajweedGradingModalOpen(true);
                              } else {
                                setSelectedStudentForDetails(student);
                              }
                            }}
                            onPointerDown={(e) => {
                              // Start long-press timer for multi-select
                              if (longPressTimerRef.current) {
                                clearTimeout(longPressTimerRef.current);
                              }
                              longPressTriggeredRef.current = false;
                              const studentId = student.id;
                              longPressTimerRef.current = setTimeout(() => {
                                // Long press detected - enter multi-select mode
                                longPressTriggeredRef.current = true;
                                setIsMultiSelectMode(true);
                                setSelectedStudentIds(prev => {
                                  const newSet = new Set(prev);
                                  if (newSet.has(studentId)) {
                                    newSet.delete(studentId);
                                  } else {
                                    newSet.add(studentId);
                                  }
                                  return newSet;
                                });
                                longPressTimerRef.current = null;
                              }, 400); // 400ms long-press threshold
                            }}
                            onPointerUp={() => {
                              // Cancel long-press timer if released early
                              if (longPressTimerRef.current) {
                                clearTimeout(longPressTimerRef.current);
                                longPressTimerRef.current = null;
                              }
                            }}
                            onPointerLeave={() => {
                              // Cancel long-press timer if pointer leaves
                              if (longPressTimerRef.current) {
                                clearTimeout(longPressTimerRef.current);
                                longPressTimerRef.current = null;
                              }
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              setEditingStudent(student);
                              setIsModalOpen(true);
                            }}
                          >
                            {/* Selection Indicator */}
                            {selectedStudentIds.has(student.id) && (
                              <div
                                className="absolute inset-0 z-20 pointer-events-none border border-blue-400/50 rounded-sm shadow-[0_0_12px_rgba(59,130,246,0.3)] animate-in fade-in duration-200"
                              >
                                <div className="absolute top-1/2 left-2 -translate-y-1/2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow-md">
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              </div>
                            )}
                            {/* Drop Indicator Logic Line */}
                            {dropIndicator?.id === student.id && (
                              <div
                                className={`absolute right-0 h-[1.5px] bg-blue-400/60 shadow-[0_0_15px_rgba(59,130,246,0.5)] z-[100] transition-all duration-200 pointer-events-none animate-in fade-in zoom-in-y duration-300`}
                                style={{
                                  width: `${tableWidth}px`,
                                  top: dropIndicator.position === 'top' ? '-0.75px' : 'auto',
                                  bottom: dropIndicator.position === 'bottom' ? '-0.75px' : 'auto'
                                }}
                              />
                            )}
                            <div className="w-full h-full p-4 flex items-center justify-center relative">
                              {/* Reorder Controls - Show on Hover - Outside Frame */}
                              <div className="absolute -right-11 top-1/2 -translate-y-1/2 flex items-center gap-0.5 bg-white/95 backdrop-blur-sm shadow-xl border border-gray-100 rounded-lg p-1 opacity-0 translate-x-2 group-hover/student:opacity-20 hover:!opacity-100 group-hover/student:translate-x-0 transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-50">
                                {/* Invisible Bridge to prevent hover loss */}
                                <div className="absolute -left-8 top-0 bottom-0 w-14 bg-transparent" />

                                {/* Separator Buttons Stack */}
                                <div className="flex flex-col gap-0.5 pl-1 ml-0.5">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); toggleTopSeparator(student.id); }}
                                    className={`p-0.5 rounded hover:bg-gray-50 text-gray-400 hover:text-blue-500 transition-colors relative z-10 ${student.hasTopSeparator ? 'text-blue-500 bg-blue-50' : ''}`}
                                    title="إضافة/إزالة خط علوي"
                                  >
                                    <Minus size={12} strokeWidth={3} />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); toggleBottomSeparator(student.id); }}
                                    className={`p-0.5 rounded hover:bg-gray-50 text-gray-400 hover:text-blue-500 transition-colors relative z-10 ${student.hasBottomSeparator ? 'text-blue-500 bg-blue-50' : ''}`}
                                    title="إضافة/إزالة خط سفلي"
                                  >
                                    <Minus size={12} strokeWidth={3} />
                                  </button>
                                </div>

                                {/* Pin Button */}
                                <button
                                  onClick={(e) => { e.stopPropagation(); togglePinToEnd(student.id); }}
                                  className={`p-1 rounded hover:bg-gray-50 text-gray-400 hover:text-red-400 transition-colors relative z-10 border-l border-gray-100 pl-1.5 ml-0.5 ${student.isPinnedToEnd ? 'text-red-400 bg-red-50/50' : ''}`}
                                  title={student.isPinnedToEnd ? "إلغاء التثبيت" : "تثبيت في النهاية"}
                                >
                                  <Pin size={12} strokeWidth={1.5} className={student.isPinnedToEnd ? "" : "-rotate-45"} />
                                </button>
                              </div>

                              <div className={`flex items-center justify-center gap-2 ${/[a-zA-Z]/.test(student.name) ? 'font-english text-xl' : 'font-arabic text-2xl'}`}>
                                <span className={searchQuery.trim() && searchMatches(student.name) ? 'text-amber-600' : ''}>{student.name}</span>
                                {unseenUngradedTajweedCount > 0 && (
                                  <span
                                    className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none shadow-sm"
                                    title="يوجد واجب تجويد غير مصحح"
                                  >
                                    {toHindiDigits(unseenUngradedTajweedCount)}
                                  </span>
                                )}
                                {student.externalLink && (
                                  <button
                                    type="button"
                                    onClick={(e) => openExternalLink(student.externalLink!, e)}
                                    className="text-gray-400 hover:text-[#ffe05d] transition-colors"
                                    title="فتح ملف الطالب"
                                  >
                                    <Link size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Attendance Grid */}
                          {
                            Array.from({ length: daysInMonth }).map((_, i) => {
                              const dayNum = i + 1;
                              const isWknd = isWeekend(dayNum);
                              const isToday = isTodayColumn(dayNum);
                              const key = `${student.id}_${dayNum}_${month}_${year}`;
                              const status = attendance[key];
                              const billingStartDay = academyRates[student.academy]?.billingStartDay || 1;
                              const isDeferredDay = billingStartDay > 1 && dayNum >= billingStartDay;
                              const visualStatus = (() => {
                                if (!status) return status;
                                if (isDeferredDay) {
                                  if (status === AttendanceStatus.PRESENT) return AttendanceStatus.TRANSFERRED;
                                  if (status === AttendanceStatus.ABSENCE_RED || status === AttendanceStatus.UNEXCUSED_ABSENCE || status === AttendanceStatus.PAID_ABSENCE) {
                                    return AttendanceStatus.TRANSFERRED_ABSENT;
                                  }
                                }
                                return status;
                              })();

                              const academyHolidays = academyRates[student.academy]?.holidays || [];
                              const isAcademyHoliday = academyHolidays.includes(getDayOfWeek(dayNum));

                              const scheduledOccurrences = getScheduledCountOnDate(student, dayNum);
                              const isDaySelected = scheduledOccurrences > 0;
                              const isDoubleScheduled = scheduledOccurrences === 2;

                              const makeupLinkForDay = makeupLinks.find(l => l.studentId === student.id && (l.missedDay === dayNum || l.makeupDay === dayNum) && l.month === month && l.year === year);
                              const isMakeupTarget = makeupLinkForDay?.makeupDay === dayNum;
                              const isMakeupSource = makeupLinkForDay?.missedDay === dayNum;

                              // Compute Stable Lanes for this Student (to handle overlaps without intersection)
                              const rowLinks = makeupLinks.filter(l => l.studentId === student.id && l.month === month && l.year === year)
                                .sort((a, b) => Math.min(a.missedDay, a.makeupDay) - Math.min(b.missedDay, b.makeupDay));

                              const laneMap = new Map<string, number>();
                              const lanes: number[] = [];
                              for (const l of rowLinks) {
                                const start = Math.min(l.missedDay, l.makeupDay);
                                const end = Math.max(l.missedDay, l.makeupDay);
                                let assigned = -1;
                                // Find first free lane
                                for (let i = 0; i < lanes.length; i++) {
                                  if (lanes[i] < start) { // Lane is free
                                    assigned = i;
                                    lanes[i] = end;
                                    break;
                                  }
                                }
                                if (assigned === -1) {
                                  assigned = lanes.length;
                                  lanes.push(end);
                                }
                                laneMap.set(`${l.missedDay}-${l.makeupDay}`, assigned);
                              }

                              const activeLinks = rowLinks.filter(l =>
                                dayNum >= Math.min(l.missedDay, l.makeupDay) &&
                                dayNum <= Math.max(l.missedDay, l.makeupDay)
                              );
                              const hasActiveLinks = activeLinks.length > 0;

                              const isLinkHovered = hoveredMakeupLink && rowLinks.some(l =>
                                `${l.studentId}-${l.missedDay}-${l.makeupDay}` === hoveredMakeupLink &&
                                l.makeupDay === dayNum
                              );

                              return (
                                <td
                                  key={dayNum}
                                  id={`cell-${student.id}-${dayNum}`}
                                  onClick={(e) => {
                                    if (longPressTriggeredRef.current) {
                                      longPressTriggeredRef.current = false;
                                      return;
                                    }

                                    // Cancel if clicking on the same source cell while active
                                    if (makeupLinkingMode?.isActive && makeupLinkingMode.studentId === student.id && makeupLinkingMode.sourceDay === dayNum) {
                                      setMakeupLinkingMode(null);
                                      return;
                                    }

                                    if (makeupLinkingMode?.isActive && makeupLinkingMode.studentId === student.id) {
                                      if (dayNum !== makeupLinkingMode.sourceDay) {
                                        const sourceKey = `${student.id}_${makeupLinkingMode.sourceDay}_${month}_${year}`;
                                        const originalStatus = attendance[sourceKey] || AttendanceStatus.ABSENCE_RED; // Default to Red if missing

                                        const newLink: MakeupLink = {
                                          missedDay: makeupLinkingMode.sourceDay,
                                          makeupDay: dayNum,
                                          studentId: student.id,
                                          month,
                                          year,
                                          originalStatus
                                        };
                                        setMakeupLinks(prev => [...prev, newLink]);

                                        // Change original missed day to POSTPONED
                                        setAttendance(prev => ({ ...prev, [sourceKey]: AttendanceStatus.POSTPONED }));

                                        setMakeupLinkingMode(null);
                                      }
                                    } else {
                                      // Unlinking Logic for POSTPONED days
                                      const key = `${student.id}_${dayNum}_${month}_${year}`;
                                      const currentStatus = attendance[key];

                                      if (isEditReportShortcutPressed) {
                                        const isEligibleStatus = currentStatus === AttendanceStatus.PRESENT || currentStatus === AttendanceStatus.DOUBLE_CLASS;
                                        if (isEligibleStatus) {
                                          const reportKey = `${student.id}_${dayNum}_${month}_${year}`;
                                          const savedReport = savedReports[reportKey];

                                          if (!savedReport) {
                                            showToast('لا يوجد تقرير محفوظ لهذا اليوم');
                                            return;
                                          }

                                          const draftSnapshot = savedReportDrafts[reportKey];
                                          if (draftSnapshot) {
                                            setLastReports(prev => ({
                                              ...prev,
                                              [student.id]: {
                                                ...prev[student.id],
                                                ...JSON.parse(JSON.stringify(draftSnapshot)),
                                                _dayNum: dayNum,
                                                _month: month,
                                                _year: year,
                                              }
                                            }));
                                          } else {
                                            // Fallback for older saved reports created before per-day snapshots.
                                            setLastReports(prev => ({
                                              ...prev,
                                              [student.id]: {
                                                ...prev[student.id],
                                                _dayNum: dayNum,
                                                _month: month,
                                                _year: year,
                                              }
                                            }));
                                          }

                                          setSmartReportModal({
                                            isOpen: true,
                                            studentId: student.id,
                                            dayNum,
                                            undoSnapshot: buildSmartReportUndoSnapshot(),
                                            isEditMode: true,
                                          });
                                          return;
                                        }
                                      }

                                      if (currentStatus === AttendanceStatus.POSTPONED) {
                                        const linkIndex = makeupLinks.findIndex(l =>
                                          l.studentId === student.id &&
                                          l.missedDay === dayNum &&
                                          l.month === month &&
                                          l.year === year
                                        );

                                        if (linkIndex !== -1) {
                                          const link = makeupLinks[linkIndex];

                                          // Remove link
                                          const newLinks = [...makeupLinks];
                                          newLinks.splice(linkIndex, 1);
                                          setMakeupLinks(newLinks);

                                          // Revert source day status
                                          const revertedStatus = link.originalStatus || AttendanceStatus.ABSENCE_RED;
                                          setAttendance(prev => ({ ...prev, [key]: revertedStatus }));

                                          // Remove target makeup day status if it's currently EXTRA_DAY or just clear it
                                          // If the user already marked it present, maybe we should keep it?
                                          // User said "cancel connection and cancel the day connected to it (delete any stroke)".
                                          // So we should probably remove the target status if it was seemingly part of this makeup.
                                          // If it was just 'EXTRA_DAY' (the blue ring), we remove it.
                                          // If it became 'PRESENT', maybe we should ask or just leave it?
                                          // The user said "cancel the connected day completely, cancel any stroke". implies removal.
                                          const targetKey = `${student.id}_${link.makeupDay}_${month}_${year}`;
                                          setAttendance(prev => {
                                            const newState = { ...prev };
                                            delete newState[targetKey];
                                            return newState;
                                          });

                                          return; // Skip toggleStatus
                                        }
                                      }

                                      toggleStatus(student.id, dayNum, e.shiftKey, e.altKey, e.ctrlKey || e.metaKey, e);
                                    }
                                  }}
                                  onPointerDown={(e) => {
                                    const key = `${student.id}_${dayNum}_${month}_${year}`;
                                    const currentStatus = attendance[key];

                                    // Long-press for makeup linking on red cells
                                    if (currentStatus === AttendanceStatus.ABSENCE_RED || currentStatus === AttendanceStatus.UNEXCUSED_ABSENCE) {
                                      longPressTriggeredRef.current = false;
                                      longPressTimerRef.current = setTimeout(() => {
                                        longPressTriggeredRef.current = true;
                                        setMakeupLinkingMode({ isActive: true, sourceDay: dayNum, studentId: student.id });
                                        if (navigator.vibrate) navigator.vibrate(50);
                                      }, 250); // Speed up to 250ms
                                    }

                                    // Long-press for viewing saved report on green cells
                                    if (currentStatus === AttendanceStatus.PRESENT || currentStatus === AttendanceStatus.DOUBLE_CLASS) {
                                      longPressTriggeredRef.current = false;
                                      longPressTimerRef.current = setTimeout(() => {
                                        longPressTriggeredRef.current = true;
                                        const reportKey = `${student.id}_${dayNum}_${month}_${year}`;
                                        const savedReport = savedReports[reportKey];
                                        if (savedReport) {
                                          setSavedReportViewModal({
                                            isOpen: true,
                                            studentId: student.id,
                                            studentName: student.name,
                                            dayNum,
                                            report: savedReport
                                          });
                                        } else {
                                          showToast('لا يوجد تقرير محفوظ لهذا اليوم');
                                        }
                                        if (navigator.vibrate) navigator.vibrate(50);
                                      }, 400); // 400ms for viewing reports
                                    }
                                  }}
                                  onPointerUp={() => {
                                    if (longPressTimerRef.current) {
                                      clearTimeout(longPressTimerRef.current);
                                      longPressTimerRef.current = null;
                                    }
                                  }}
                                  onPointerLeave={() => {
                                    if (longPressTimerRef.current) {
                                      clearTimeout(longPressTimerRef.current);
                                      longPressTimerRef.current = null;
                                    }
                                    // Also clear hover timer
                                    if (hoverTimerRef.current) {
                                      clearTimeout(hoverTimerRef.current);
                                      hoverTimerRef.current = null;
                                    }
                                    setHoveredStudentId(null);
                                  }}
                                  onMouseEnter={() => {
                                    const key = `${student.id}_${dayNum}_${month}_${year}`;
                                    const currentStatus = attendance[key];
                                    setHoveredCellKey(key);

                                    // Only trigger for green cells
                                    if (currentStatus === AttendanceStatus.PRESENT || currentStatus === AttendanceStatus.DOUBLE_CLASS || currentStatus === AttendanceStatus.TRANSFERRED) {
                                      hoverTimerRef.current = setTimeout(() => {
                                        setHoveredStudentId(student.id);
                                      }, 1000); // Show dots after 1 second
                                    }
                                  }}
                                  onMouseLeave={() => {
                                    setHoveredCellKey(null);
                                    if (hoverTimerRef.current) {
                                      clearTimeout(hoverTimerRef.current);
                                      hoverTimerRef.current = null;
                                    }
                                    setHoveredStudentId(null);
                                  }}
                                  onMouseDown={(e) => {
                                    if (e.button === 1) { // Middle Click
                                      e.preventDefault();
                                      cleanupBreakLink(student.id, dayNum, month, year);
                                      const key = `${student.id}_${dayNum}_${month}_${year}`;
                                      const currentStatus = attendance[key];

                                      // Save history
                                      pushHistorySnapshot();

                                      let newStat: AttendanceStatus;
                                      if (currentStatus === AttendanceStatus.PRESENT) {
                                        newStat = AttendanceStatus.TRANSFERRED;
                                      } else if (currentStatus === AttendanceStatus.TRANSFERRED) {
                                        // Find what it was before being transferred
                                        const prevStatus = (() => {
                                          for (let i = past.length - 1; i >= 0; i--) {
                                            const prevAtt = past[i].att;
                                            if (prevAtt && prevAtt[key] && prevAtt[key] !== AttendanceStatus.TRANSFERRED && prevAtt[key] !== AttendanceStatus.TRANSFERRED_ABSENT) {
                                              return prevAtt[key];
                                            }
                                          }
                                          return undefined;
                                        })();
                                        newStat = prevStatus || AttendanceStatus.PRESENT;
                                      } else if (currentStatus === AttendanceStatus.ABSENCE_RED) {
                                        newStat = AttendanceStatus.UNEXCUSED_ABSENCE;
                                      } else if (currentStatus === AttendanceStatus.UNEXCUSED_ABSENCE) {
                                        newStat = AttendanceStatus.TRANSFERRED_ABSENT;
                                      } else if (currentStatus === AttendanceStatus.PAID_ABSENCE) {
                                        newStat = AttendanceStatus.TRANSFERRED_ABSENT;
                                      } else if (currentStatus === AttendanceStatus.TRANSFERRED_ABSENT) {
                                        // Find what it was before being transferred
                                        const prevStatus = (() => {
                                          for (let i = past.length - 1; i >= 0; i--) {
                                            const prevAtt = past[i].att;
                                            if (prevAtt && prevAtt[key] && prevAtt[key] !== AttendanceStatus.TRANSFERRED && prevAtt[key] !== AttendanceStatus.TRANSFERRED_ABSENT) {
                                              return prevAtt[key];
                                            }
                                          }
                                          return undefined;
                                        })();
                                        newStat = prevStatus || AttendanceStatus.UNEXCUSED_ABSENCE;
                                      } else {
                                        newStat = AttendanceStatus.ABSENCE_RED;
                                      }

                                      // Update subscription counter if enabled
                                      const studentSub = subscriptionSettings[student.id];
                                      if (studentSub?.enabled) {
                                        const sessionStatuses = [
                                          AttendanceStatus.PRESENT,
                                          AttendanceStatus.DOUBLE_CLASS,
                                          AttendanceStatus.EXTRA_DOUBLE,
                                          AttendanceStatus.PAID_ABSENCE,
                                          AttendanceStatus.EXTRA_DAY,
                                          AttendanceStatus.TRANSFERRED,
                                          AttendanceStatus.TRANSFERRED_ABSENT
                                        ];
                                        const wasClass = sessionStatuses.includes(currentStatus as AttendanceStatus);
                                        const isClass = sessionStatuses.includes(newStat);

                                        if (isClass && !wasClass) {
                                          setSubscriptionSettings(prev => ({
                                            ...prev,
                                            [student.id]: { ...prev[student.id], currentClass: (prev[student.id].currentClass || 0) + 1 }
                                          }));
                                        } else if (!isClass && wasClass) {
                                          setSubscriptionSettings(prev => ({
                                            ...prev,
                                            [student.id]: { ...prev[student.id], currentClass: Math.max(0, (prev[student.id].currentClass || 0) - 1) }
                                          }));
                                        }
                                      }

                                      setAttendance(prev => ({ ...prev, [key]: newStat }));
                                    }
                                  }}
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    cleanupBreakLink(student.id, dayNum, month, year);
                                    const key = `${student.id}_${dayNum}_${month}_${year}`;
                                    const currentStatus = attendance[key];

                                    // Save history
                                    pushHistorySnapshot();

                                    // Toggle between PAID_ABSENCE and POSTPONED
                                    const newStatus = currentStatus === AttendanceStatus.PAID_ABSENCE
                                      ? AttendanceStatus.POSTPONED
                                      : AttendanceStatus.PAID_ABSENCE;

                                    // Auto-decrement when switching FROM paid_absence to postponed
                                    if (currentStatus === AttendanceStatus.PAID_ABSENCE && newStatus === AttendanceStatus.POSTPONED) {
                                      const studentSub = subscriptionSettings[student.id];
                                      if (studentSub?.enabled && studentSub.currentClass > 0) {
                                        setSubscriptionSettings(prev => ({
                                          ...prev,
                                          [student.id]: {
                                            ...prev[student.id],
                                            currentClass: prev[student.id].currentClass - 1
                                          }
                                        }));
                                      }
                                    }

                                    // Auto-increment subscription counter when marking PAID_ABSENCE
                                    if (newStatus === AttendanceStatus.PAID_ABSENCE) {
                                      const studentSub = subscriptionSettings[student.id];
                                      let currentClassNum = null;

                                      if (studentSub?.enabled) {
                                        const cur = studentSub.currentClass;
                                        const total = studentSub.totalClasses;
                                        // In subscription mode, wrap around when reaching totalClasses
                                        const nextClass = (studentSub.mode === 'subscription' && total > 0 && cur >= total) ? 1 : cur + 1;
                                        currentClassNum = nextClass;

                                        setSubscriptionSettings(prev => ({
                                          ...prev,
                                          [student.id]: {
                                            ...prev[student.id],
                                            currentClass: nextClass
                                          }
                                        }));
                                      }

                                      // GENERATE ABSENT REPORT using Last Language
                                      const date = new Date(year, month, dayNum);
                                      const lang = lastReportLanguage;

                                      let reportTitle = lang === 'ar' ? '📖 *تقرير الحصة*' : '📖 *Session Report*';
                                      let dateStr = '';

                                      if (lang === 'ar') {
                                        dateStr = date.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                                        dateStr = toHindiDigits(dateStr);
                                      } else {
                                        const daysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                                        const monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                                        dateStr = `${daysEn[date.getDay()]} ${date.getDate()} ${monthsEn[date.getMonth()]} ${date.getFullYear()}`;
                                      }

                                      let report = `${reportTitle}\n\n${lang === 'ar' ? 'الطالب' : 'Student'}: ${student.name}\n${lang === 'ar' ? 'التاريخ' : 'Date'}: ${dateStr}\n`;

                                      if (currentClassNum) {
                                        const studentSub2 = subscriptionSettings[student.id];
                                        const totalStr = studentSub2?.mode === 'subscription' && studentSub2.totalClasses > 0;
                                        if (lang === 'ar') {
                                          report += `رقم الحصة: ${toHindiDigits(currentClassNum)}${totalStr ? ` من ${toHindiDigits(studentSub2.totalClasses)}` : ''}\n\n(غياب)\n`;
                                        } else {
                                          report += `Class No: ${currentClassNum}${totalStr ? ` of ${studentSub2.totalClasses}` : ''}\n\n(Absent)\n`;
                                        }
                                      } else {
                                        report += `${lang === 'ar' ? 'الحالة: غياب' : 'Status: Absent'}\n`;
                                      }

                                      navigator.clipboard.writeText(report);
                                      showToast(lang === 'ar' ? 'تم نسخ التقرير (غياب) 📋' : 'Absent report copied 📋');

                                      // Auto-open link when marking absence (always, regardless of report settings)
                                      checkAndOpenLink(student.id);

                                      // Clear search when taking action
                                      setSearchQuery('');
                                    }

                                    setAttendance(prev => ({ ...prev, [key]: newStatus }));
                                  }}
                                  className={`select-none ${isDoubleScheduled ? 'relative' : ''} transition-all duration-200
                                      ${(isWknd || isAcademyHoliday) ? 'bg-[#81ffea]/20' : ''}
                                      ${isToday ? 'bg-[#ffe05d]/10' : ''}
                                      ${dayNum === daysInMonth ? 'relative' : ''}
                                      ${makeupLinkingMode?.isActive && makeupLinkingMode.studentId === student.id ? 'cursor-crosshair' : 'cursor-pointer'}
                                      group/cell
                                      ${hasActiveLinks ? 'relative' : ''}
                                  `}
                                >
                                  {/* Connecting Line - Curved Approach - MultiLine with Stable Lanes */}
                                  {showMakeupLines && activeLinks.map((link) => {
                                    // 1. Identify the Left-Most day (Start of the visual line)
                                    const leftMostDay = Math.min(link.missedDay, link.makeupDay);

                                    // 2. Only render the line from the Left-Most cell to avoid fragmentation
                                    if (dayNum !== leftMostDay) return null;

                                    // 3. Calculate Distance for Width
                                    const distance = Math.abs(link.makeupDay - link.missedDay);

                                    const lane = laneMap.get(`${link.missedDay}-${link.makeupDay}`) || 0;
                                    const verticalStep = 3; // Reduced step to save space
                                    const verticalOffset = lane * verticalStep;

                                    // Dynamic height: Ensure all lines top-out at the same ceiling (e.g. 9px from bottom)
                                    // so they don't enter the circle area.
                                    const ceiling = 9;
                                    const calculatedHeight = Math.max(3, ceiling - verticalOffset);

                                    const style = { bottom: `${verticalOffset}px`, zIndex: lane };

                                    // Check Hover State
                                    const linkKey = `${link.studentId}-${link.missedDay}-${link.makeupDay}`;
                                    const isHovered = hoveredMakeupLink === linkKey;

                                    return (
                                      <div
                                        key={`${link.missedDay}-${link.makeupDay}`}
                                        className={`absolute right-[50%] opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out will-change-[opacity] pointer-events-none border-b-[2.5px] border-l-[2.5px] border-r-[2.5px] border-[#FECACA] rounded-bl-[10px] rounded-br-[10px]`}
                                        style={{
                                          ...style,
                                          height: `${calculatedHeight}px`,
                                          zIndex: isHovered ? 50 : lane,
                                          width: `calc(${distance} * 100%)`
                                        }}
                                      />
                                    );
                                  })}

                                  {/* Missed count is now rendered as a fixed overlay outside the table */}

                                  <div className={`
                                w-8 h-8 mx-auto rounded-full flex items-center justify-center text-lg transition-all relative z-10 js-cell-circle
                                ${visualStatus === AttendanceStatus.PRESENT ? (isEditReportShortcutPressed && hoveredCellKey === key ? 'bg-red-500 scale-110 shadow-lg shadow-red-200' : 'bg-emerald-400 scale-100 shadow-md shadow-emerald-200') + ' text-white font-english' : ''}
                                ${(visualStatus === AttendanceStatus.TRANSFERRED) ? 'bg-emerald-400 text-white shadow-md shadow-emerald-200 scale-100 font-english' : ''}
                                ${(visualStatus === AttendanceStatus.TRANSFERRED_ABSENT) ? 'bg-gray-400 text-white shadow-md shadow-gray-200 scale-100 font-english' : ''}
                                ${visualStatus === AttendanceStatus.DOUBLE_CLASS ? (isEditReportShortcutPressed && hoveredCellKey === key ? 'bg-red-500 scale-110 shadow-lg shadow-red-200' : 'bg-emerald-400 scale-100 shadow-md shadow-emerald-200') + ' text-white font-tajawal font-bold' : ''}
                                ${visualStatus === AttendanceStatus.PAID_ABSENCE ? 'bg-gray-400 text-white font-english' : ''}
                                ${visualStatus === AttendanceStatus.POSTPONED ? 'bg-amber-300 text-black font-amiri font-bold text-2xl pb-2' : ''}
                                ${visualStatus === AttendanceStatus.UNEXCUSED_ABSENCE ? 'bg-red-500 text-white font-english' : ''}
                                ${visualStatus === AttendanceStatus.ABSENCE_RED ? 'bg-red-500 text-transparent font-english' : ''}
                                ${(status === AttendanceStatus.EXTRA_DAY || status === AttendanceStatus.EXTRA_DOUBLE || (isMakeupTarget && (!status || status === AttendanceStatus.EXEMPT) && !isDaySelected) || status === AttendanceStatus.EXEMPT || (isMakeupTarget && status === AttendanceStatus.EXEMPT) || (!status && !isWknd && !isAcademyHoliday)) ? `hover:bg-gray-100 active:bg-gray-200 w-2 h-2 rounded-full transition-all duration-200 ease-in-out relative ${status === AttendanceStatus.EXTRA_DAY || status === AttendanceStatus.EXTRA_DOUBLE || (isMakeupTarget && (!status || status === AttendanceStatus.EXEMPT) && !isDaySelected) || (isMakeupTarget && status === AttendanceStatus.EXEMPT) ? 'ring-2 ring-blue-400 bg-transparent scale-110' : (isDoubleScheduled && status !== AttendanceStatus.EXEMPT) ? 'border border-red-300 bg-transparent scale-125 shadow-sm' : (isDaySelected && status !== AttendanceStatus.EXEMPT) ? (dayNum === expectedEndDay ? 'border border-emerald-600 scale-125 shadow-none bg-transparent' : 'border border-red-300 bg-transparent scale-125 shadow-none') : 'bg-gray-200/20 group-hover:bg-gray-300'}` : ''}
                                ${makeupLinkingMode?.isActive && makeupLinkingMode.studentId === student.id && makeupLinkingMode.sourceDay === dayNum ? 'ring-2 ring-red-500 z-20 animate-pulse-scale-glow' : ''}
                                ${isLinkHovered ? 'z-30 animate-pulse-glow-soft' : ''}
                                group-hover/cell:scale-110 group-hover/cell:shadow-[0_0_10px_rgba(0,0,0,0.2)]
                              `}
                                    onMouseEnter={() => {
                                      if (visualStatus === AttendanceStatus.POSTPONED) {
                                        const link = makeupLinks.find(l => l.studentId === student.id && l.missedDay === dayNum && l.month === month && l.year === year);
                                        if (link) {
                                          setHoveredMakeupLink(`${link.studentId}-${link.missedDay}-${link.makeupDay}`);
                                        }
                                      }
                                    }}
                                    onMouseLeave={() => setHoveredMakeupLink(null)}
                                  >
                                    {/* Prepaid Indicator (Arabic, hover only, refined) */}
                                    {subscriptionSettings[student.id]?.enabled && (visualStatus === AttendanceStatus.PRESENT || visualStatus === AttendanceStatus.DOUBLE_CLASS || visualStatus === AttendanceStatus.EXTRA_DOUBLE || visualStatus === AttendanceStatus.PAID_ABSENCE || visualStatus === AttendanceStatus.TRANSFERRED || visualStatus === AttendanceStatus.TRANSFERRED_ABSENT || visualStatus === AttendanceStatus.EXTRA_DAY) && (
                                      <div className="absolute -top-[3.2rem] left-1/2 -translate-x-1/2 whitespace-nowrap text-lg font-bold text-emerald-800 bg-white px-2 py-0.5 rounded-lg shadow-md border border-emerald-100 opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-500 z-[60] pointer-events-none font-arabic" dir="rtl">
                                        {(() => {
                                          const sub = subscriptionSettings[student.id];
                                          // Calculate session number for this specific day
                                          let totalAfter = 0;
                                          for (let d = dayNum + 1; d <= 31; d++) {
                                            const s = attendance[`${student.id}_${d}_${month}_${year}`];
                                            // Count all statuses that visually represent a session
                                            if (s === AttendanceStatus.PRESENT || s === AttendanceStatus.PAID_ABSENCE || s === AttendanceStatus.EXTRA_DOUBLE || s === AttendanceStatus.TRANSFERRED || s === AttendanceStatus.TRANSFERRED_ABSENT || s === AttendanceStatus.EXTRA_DAY) totalAfter += 1;
                                            else if (s === AttendanceStatus.DOUBLE_CLASS) totalAfter += 2;
                                          }
                                          
                                          // IMPROVED: If currentClass shows 2 but we have 2 marks, and we are on the first mark,
                                          // sub.currentClass - totalAfter = 2 - 1 = 1.
                                          // If it shows 1 twice, it means sub.currentClass was only 1.
                                          const daySessionNum = sub.currentClass - totalAfter;
                                          const displayNumRaw = Math.max(1, daySessionNum);
                                          const displayNum = sub.mode === 'subscription' && sub.totalClasses > 0
                                            ? ((displayNumRaw - 1) % sub.totalClasses) + 1
                                            : displayNumRaw;

                                          if (sub.mode === 'monthly') return toHindiDigits(daySessionNum);
                                          // Use Arabic "من" or standard slash with forced LTR alignment if needed for slash direction
                                          return `${toHindiDigits(displayNum)} / ${toHindiDigits(sub.totalClasses)}`;
                                        })()}
                                      </div>
                                    )}

                                    {getCellContent(visualStatus)}
                                    {
                                      (isDoubleScheduled && !status && !isWknd && !isAcademyHoliday) && (
                                        <span className="absolute -bottom-0.5 -right-0.5 w-1 h-1 bg-red-500 rounded-full shadow-[0_0_2px_rgba(239,68,68,0.8)] animate-pulse" />
                                      )
                                    }
                                    {/* Report indicator dot on hover */}
                                    {hoveredStudentId === student.id && (visualStatus === AttendanceStatus.PRESENT || visualStatus === AttendanceStatus.TRANSFERRED || visualStatus === AttendanceStatus.DOUBLE_CLASS) && (
                                      <span
                                        className={`absolute -top-1 -right-1 w-2 h-2 rounded-full shadow-sm transition-all animate-fade-in ${savedReports[`${student.id}_${dayNum}_${month}_${year}`]
                                          ? 'bg-green-400 shadow-green-300'
                                          : 'bg-red-400 shadow-red-300'
                                          }`}
                                      />
                                    )}
                                    {/* Pending Double Indicator (Dot) - only show when still pending, not after confirmed */}
                                    {((isMakeupTarget && (status === AttendanceStatus.EXTRA_DAY || (!status && isDaySelected))) || status === AttendanceStatus.EXTRA_DOUBLE) && (
                                      <span className="absolute -bottom-0.5 -right-0.5 w-1 h-1 bg-red-500 rounded-full shadow-[0_0_2px_rgba(239,68,68,0.8)] z-20" />
                                    )}
                                  </div>
                                </td>
                              );
                            })
                          }
                        </tr>
                      );
                    })}
                  </React.Fragment>
                  );
                })}

              </tbody>
            </table>
          )}
          {/* Decorative Spacer for deep linking */}
          <div className="h-screen relative overflow-hidden bg-gray-50/50">
            {/* 1. Subtle Background Pattern (Geometric) */}
            <div className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: `radial-gradient(#002060 1px, transparent 1px), radial-gradient(#002060 1px, transparent 1px)`,
                backgroundSize: '40px 40px',
                backgroundPosition: '0 0, 20px 20px'
              }}
            />



            <div className="absolute bottom-10 w-full text-center opacity-40 font-amiri text-gray-500">
              <span className="text-xl">{randomHadith || 'سبحان الله وبحمده، سبحان الله العظيم'}</span>
            </div>
          </div>
        </div>
      </main >

      {/* 3. Modal for New Student */}
      {
        isModalOpen && (
          <StudentModal
            onClose={() => {
              setIsModalOpen(false);
              setEditingStudent(null);
              setPrefillAcademy(null);
            }}
            onSave={handleAddStudent}
            onDelete={deleteStudent}
            onEndEnrollment={handleEndEnrollment}
            academies={sortedAcademies}
            student={editingStudent ? {
              ...editingStudent,
              isPrepaid: subscriptionSettings[editingStudent.id]?.enabled,
              prepaidTotal: subscriptionSettings[editingStudent.id]?.totalClasses,
              prepaidCurrent: (subscriptionSettings[editingStudent.id]?.currentClass ?? 0) + 1,
              prepaidMode: subscriptionSettings[editingStudent.id]?.mode
            } : undefined}
            prefillAcademy={prefillAcademy || undefined}
            academyRates={academyRates}
            currentMonth={month}
            currentYear={year}
            onAssignTajweed={editingStudent ? () => {
              setAssigningTajweedForStudent(editingStudent);
              setIsModalOpen(false);
              setEditingStudent(null);
            } : undefined}
            students={students}
            showToast={showToast}
          />
        )
      }
      {
        selectedAcademyForDetails && (
          <AcademyDetailsModal
            academyName={selectedAcademyForDetails}
            students={students}
            attendance={attendance}
            month={month}
            year={year}
            onClose={() => setSelectedAcademyForDetails(null)}
            onDelete={() => {
              handleDeleteAcademy(selectedAcademyForDetails);
              setSelectedAcademyForDetails(null);
            }}
            onUpdate={(oldName, newName, rate, curr, ded, bsd, link, hols, disRep) =>
              handleUpdateAcademy(oldName, newName, rate, curr, ded, bsd, link, hols, academyRates[selectedAcademyForDetails]?.receiveInEGP || false, disRep, academyRates[selectedAcademyForDetails]?.whatsappNumber || '', (academyRates[selectedAcademyForDetails] as any)?.openLinksExternally || false, (academyRates[selectedAcademyForDetails] as any)?.includeReportHeader !== false)
            }
            academyRate={academyRates[selectedAcademyForDetails]}
            usdRate={usdRate}
          />
        )
      }
      {
        selectedAcademyForEditing && (
          <AcademyEditModal
            academyName={selectedAcademyForEditing}
            academyRate={academyRates[selectedAcademyForEditing]}
            onClose={() => setSelectedAcademyForEditing(null)}
            onSave={handleUpdateAcademy}
            onDelete={() => handleDeleteAcademy(selectedAcademyForEditing)}
          />
        )
      }
      {
        isAddingAcademy && (
          <AcademyEditModal
            academyName=""
            onClose={() => setIsAddingAcademy(false)}
            onSave={(old, name, rate, curr, dm, bsd, el, hols, regp, disRep, whatsapp, openExt, incHdr) => handleUpdateAcademy('', name, rate, curr, dm, bsd, el, hols, regp, disRep, whatsapp, openExt, incHdr)}
            isAdd
          />
        )
      }

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmLabel="حذف"
        cancelLabel="إلغاء"
        onConfirm={confirmConfig.onConfirm}
        onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />
      {/* Student Details Modal */}
      {
        selectedStudentForDetails && (
          <StudentDetailsModal
            student={selectedStudentForDetails}
            attendance={attendance}
            month={month}
            year={year}
            onClose={() => setSelectedStudentForDetails(null)}
            usdRate={usdRate}
            onOpenLink={handleOpenLink}
            billingStartDay={academyRates[selectedStudentForDetails.academy]?.billingStartDay || 1}
          />
        )
      }

      {/* Multi-Student Combined Report Modal */}
      {
        selectedStudentsForCombinedReport && selectedStudentsForCombinedReport.length > 0 && (
          <MultiStudentDetailsModal
            students={selectedStudentsForCombinedReport}
            attendance={attendance}
            month={month}
            year={year}
            onClose={() => setSelectedStudentsForCombinedReport(null)}
            usdRate={usdRate}
          />
        )
      }

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        data={{
          students,
          attendance,
          month,
          year,
          dayOff,
          academyRates,
          academyOrder,
          monthlyObligations,
          paymentStatus,
          autoBackupConfig,
          dayTransitionTime,
          showMakeupLines,
          confirmNonTodayAttendance,
          whatsappTarget
        }}
        onImport={handleImport}
        onClearAll={clearAllData}
        onExport={handleExport}
        onUpdateAutoBackup={(config) => setAutoBackupConfig(config)}
        onUpdateDayTransitionTime={setDayTransitionTime}
        onUpdateShowMakeupLines={setShowMakeupLines}
        onUpdateConfirmNonToday={setConfirmNonTodayAttendance}
        onUpdateWhatsappTarget={setWhatsappTarget}
        onSelectBackupFolder={async () => {
          if (window.electronAPI?.selectBackupFolder) {
            const folder = await window.electronAPI.selectBackupFolder();
            if (folder) {
              setAutoBackupConfig(prev => ({ ...prev, backupPath: folder }));
            }
          } else {
            // Fallback for dev/browser mode
            const folder = prompt('أدخل مسار مجلد الحفظ:', autoBackupConfig.backupPath || '');
            if (folder) {
              setAutoBackupConfig(prev => ({ ...prev, backupPath: folder }));
            }
          }
        }}
      />

      {
        isMonthlyStatsOpen && (
          <MonthlyStatsModal
            students={students}
            attendance={attendance}
            month={month}
            year={year}
            usdRate={usdRate}
            onClose={() => setIsMonthlyStatsOpen(false)}
            academyRates={academyRates}
            paymentStatus={paymentStatus}
            onTogglePayment={togglePaymentStatus}
            showPaymentToggles={true}
            initialObligations={(() => {
              const key = `${month}_${year}`;
              if (monthlyObligations[key] !== undefined) return monthlyObligations[key];

              // Sticky Logic: Find most recent past obligation
              // Limit search to 24 months back
              let pMonth = month - 1;
              let pYear = year;

              for (let i = 0; i < 24; i++) {
                if (pMonth < 0) {
                  pMonth = 11;
                  pYear--;
                }
                const pKey = `${pMonth}_${pYear}`;
                if (monthlyObligations[pKey] !== undefined) return monthlyObligations[pKey];
                pMonth--;
              }
              return 0;
            })()}
            onSaveObligations={(amount) => {
              setMonthlyObligations(prev => ({
                ...prev,
                [`${month}_${year}`]: amount
              }));
            }}
          />
        )
      }

      {
        isLastMonthStatsOpen && (() => {
          let prevMonth = month - 1;
          let prevYear = year;
          if (prevMonth < 0) {
            prevMonth = 11;
            prevYear--;
          }
          return (
            <MonthlyStatsModal
              students={students}
              attendance={attendance}
              month={prevMonth}
              year={prevYear}
              usdRate={usdRate}
              onClose={() => setIsLastMonthStatsOpen(false)}
              academyRates={academyRates}
              paymentStatus={paymentStatus}
              onTogglePayment={togglePaymentStatus}
              showPaymentToggles={true}
              initialObligations={monthlyObligations[`${prevMonth}_${prevYear}`] || 0}
              onSaveObligations={(amount) => {
                setMonthlyObligations(prev => ({
                  ...prev,
                  [`${prevMonth}_${prevYear}`]: amount
                }));
              }}
            />
          );
        })()
      }

      <ActionChoiceModal
        isOpen={actionChoiceModal.isOpen}
        onClose={() => setActionChoiceModal(prev => ({ ...prev, isOpen: false }))}
        title={actionChoiceModal.title}
        onCopy={() => {
          const target = actionChoiceModal.target;
          const copyVal = target === '30m' ? externalLinks.link30m_copyVal : externalLinks.link60m_copyVal;
          if (copyVal) {
            navigator.clipboard.writeText(copyVal);
            showToast('تم نسخ النص! 📝');
          } else {
            showToast('لم يتم تعيين نص للنسخ (كليك يمين للإعداد) ⚠️');
          }
        }}
        onCopyContext={(e) => {
          e.preventDefault();
          const target = actionChoiceModal.target;
          const currentVal = target === '30m' ? externalLinks.link30m_copyVal : externalLinks.link60m_copyVal;
          setSimpleInputModal({
            isOpen: true,
            title: 'تعديل النص المنسوخ',
            description: 'أدخل النص الذي سيتم نسخه للحافظة عند اختيار هذا الخيار.',
            initialValue: currentVal || '',
            targetField: target === '30m' ? 'link30m_copyVal' : 'link60m_copyVal'
          });
        }}
        onLink={() => {
          const target = actionChoiceModal.target;
          const linkVal = target === '30m'
            ? (externalLinks.link30m_linkVal || externalLinks.link30m)
            : (externalLinks.link60m_linkVal || externalLinks.link60m);

          if (linkVal) {
            handleOpenLink(linkVal, target === '30m' ? '٣٠ دقيقة' : '٦٠ دقيقة');
          } else {
            showToast('لم يتم تعيين رابط (كليك يمين للإعداد) ⚠️');
          }
        }}
        onLinkContext={(e) => {
          e.preventDefault();
          const target = actionChoiceModal.target;
          const currentVal = target === '30m'
            ? (externalLinks.link30m_linkVal || externalLinks.link30m)
            : (externalLinks.link60m_linkVal || externalLinks.link60m);
          setSimpleInputModal({
            isOpen: true,
            title: 'تعديل رابط الحجز',
            description: 'أدخل الرابط المباشر الذي سيتم فتحه عند اختيار هذا الخيار.',
            initialValue: currentVal || '',
            targetField: target === '30m' ? 'link30m_linkVal' : 'link60m_linkVal'
          });
        }}
      />

      <SimpleInputModal
        isOpen={simpleInputModal.isOpen}
        onClose={() => setSimpleInputModal(prev => ({ ...prev, isOpen: false }))}
        title={simpleInputModal.title}
        description={simpleInputModal.description}
        initialValue={simpleInputModal.initialValue}
        dir={simpleInputModal.targetField?.includes('linkVal') ? 'ltr' : 'auto'}
        onSave={(val) => {
          if (simpleInputModal.targetField) {
            setExternalLinks(prev => {
              const next = { ...prev };
              // @ts-ignore
              next[simpleInputModal.targetField] = val;
              // Sync legacy
              if (simpleInputModal.targetField === 'link30m_linkVal') next.link30m = val;
              if (simpleInputModal.targetField === 'link60m_linkVal') next.link60m = val;
              return next;
            });
            showToast('تم الحفظ بنجاح! ✨');
          }
        }}
      />

      {webModal.isOpen && (
        <WebModal
          isOpen={webModal.isOpen}
          onClose={() => setWebModal(prev => ({ ...prev, isOpen: false }))}
          url={webModal.url}
          title={webModal.title}
          onOpenExternal={(url) => openExternalLink(url)}
        />
      )}

      <ActionConfigModal
        isOpen={actionConfigModal.isOpen}
        onClose={() => setActionConfigModal(prev => ({ ...prev, isOpen: false }))}
        title={
          actionConfigModal.target === '30m' ? 'إعدادات 30 دقيقة' :
            actionConfigModal.target === '60m' ? 'إعدادات 60 دقيقة' :
              actionConfigModal.target === 'partnership' ? 'إعدادات الحسابات' :
                actionConfigModal.target === 'expenses' ? 'إعدادات المصروفات' : 'إعدادات استخراج مواعيد الطلاب'
        }
        description="اختر الإجراء الافتراضي عند النقر، وقم بتعيين النص والرابط."
        initialConfig={actionConfigModal.initialConfig}
        onSave={(config) => {
          setExternalLinks(prev => {
            const next = { ...prev };
            if (actionConfigModal.target === '30m') {
              next.link30m_type = config.type;
              next.link30m_copyVal = config.copyVal;
              next.link30m_linkVal = config.linkVal;
              next.link30m = config.linkVal;
            } else if (actionConfigModal.target === '60m') {
              next.link60m_type = config.type;
              next.link60m_copyVal = config.copyVal;
              next.link60m_linkVal = config.linkVal;
              next.link60m = config.linkVal;
            } else if (actionConfigModal.target === 'partnership') {
              next.partnership_type = config.type;
              next.partnership_copyVal = config.copyVal;
              next.partnership_linkVal = config.linkVal;
              next.partnership = config.linkVal;
            } else if (actionConfigModal.target === 'expenses') {
              next.expenses_type = config.type;
              next.expenses_copyVal = config.copyVal;
              next.expenses_linkVal = config.linkVal;
              next.expenses = config.linkVal;
            } else if (actionConfigModal.target === 'taskCompletion') {
              next.taskCompletion_type = config.type;
              next.taskCompletion_copyVal = config.copyVal;
              next.taskCompletion_linkVal = config.linkVal;
              next.taskCompletion = config.linkVal;
            }
            return next;
          });
          showToast('تم حفظ الإعدادات بنجاح! ✨');
        }}
      />



      {/* Academy Context Menu */}
      {
        (academyContextMenu.isOpen || academyContextMenu.isClosing) && (
          <div
            className={`fixed z-[100] bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 w-56 overflow-hidden transition-all duration-200 ease-out origin-top-right context-menu
            ${academyContextMenu.isOpen && !academyContextMenu.isClosing
                ? 'opacity-100 scale-100 translate-y-0 blur-none'
                : 'opacity-0 scale-95 -translate-y-2 blur-sm pointer-events-none'
              }`}
            style={{
              top: academyContextMenu.y,
              left: academyContextMenu.x
            }}
          >
            <button
              onClick={() => {
                setPrefillAcademy(academyContextMenu.academy);
                setIsModalOpen(true);
                setAcademyContextMenu(prev => ({ ...prev, isOpen: false, isClosing: true }));
                setTimeout(() => setAcademyContextMenu(prev => ({ ...prev, isClosing: false })), 200);
              }}
              className="w-full flex items-center gap-4 px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors text-right"
            >
              <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                <Plus size={18} />
              </div>
              <span className="font-arabic text-2xl">إضافة طالب</span>
            </button>
            <button
              onClick={() => {
                setSelectedAcademyForEditing(academyContextMenu.academy);
                setAcademyContextMenu(prev => ({ ...prev, isOpen: false, isClosing: true }));
                setTimeout(() => setAcademyContextMenu(prev => ({ ...prev, isClosing: false })), 200);
              }}
              className="w-full flex items-center gap-4 px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors text-right"
            >
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                <Settings size={18} />
              </div>
              <span className="font-arabic text-2xl">تعديل</span>
            </button>
          </div>
        )
      }

      {/* Missed Classes Context Menu */}
      {
        missedClassesMenu && missedClassesMenu.isOpen && (
          <div
            className="fixed z-[100] bg-white/90 backdrop-blur-md rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-white/50 py-2.5 w-24 overflow-hidden context-menu flex flex-col gap-0.5"
            style={{
              top: missedClassesMenu.y,
              left: missedClassesMenu.x,
              animation: 'menuSlideIn 0.2s ease-out forwards'
            }}
          >
            <style>{`
              @keyframes menuSlideIn {
                from { opacity: 0; transform: translateY(-8px) scale(0.95); }
                to { opacity: 1; transform: translateY(0) scale(1); }
              }
            `}</style>
            {/* Arabic Option */}
            <button
              onClick={() => copyMissedClassesReport(missedClassesMenu.studentId, 'ar')}
              className="w-full text-center px-4 py-2.5 text-gray-700 hover:bg-white hover:text-blue-600 font-arabic text-xl transition-all block"
            >
              نسخ
            </button>

            {/* English Option */}
            <button
              onClick={() => copyMissedClassesReport(missedClassesMenu.studentId, 'en')}
              className="w-full text-center px-4 py-2 text-gray-700 hover:bg-white hover:text-blue-600 font-english text-base transition-all block"
            >
              Copy
            </button>
          </div>
        )
      }

      {/* Toast Notification */}
      <div className={`fixed bottom-32 right-1/2 translate-x-1/2 z-[200] transition-all duration-300 pointer-events-none ${toast.show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="bg-gray-800/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-3">
          <span className="font-arabic text-xl font-bold">{toast.message}</span>
        </div>
      </div>

      {/* Saved Report View Modal */}
      {savedReportViewModal && savedReportViewModal.isOpen && (() => {
        const reportText = savedReportViewModal.report;
        const isEnglish = /Class Report|Session Summary|Next Session|Student:|Date:|Class Number/i.test(reportText);
        const dir = isEnglish ? 'ltr' : 'rtl';
        const textAlign = isEnglish ? 'left' as const : 'right' as const;

        // Find all saved report days for this student in current month/year
        const studentId = savedReportViewModal.studentId;
        const reportDays = Object.keys(savedReports)
          .filter(key => key.startsWith(`${studentId}_`) && key.endsWith(`_${month}_${year}`))
          .map(key => {
            const parts = key.split('_');
            return parseInt(parts[1]);
          })
          .filter(d => !isNaN(d))
          .sort((a, b) => a - b);

        const currentDayIndex = reportDays.indexOf(savedReportViewModal.dayNum);
        const hasPrev = currentDayIndex > 0;
        const hasNext = currentDayIndex < reportDays.length - 1;

        const navigateTo = (dayNum: number) => {
          const key = `${studentId}_${dayNum}_${month}_${year}`;
          const report = savedReports[key];
          if (report) {
            setSavedReportViewModal(prev => prev ? {
              ...prev,
              dayNum,
              report
            } : null);
          }
        };

        // Parse *text* into bold spans + wrap numbers in system font for English
        const numFontStyle = { fontFamily: "'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif" };
        const renderReportContent = (text: string) => {
          // First split by bold markers *text*
          const parts = text.split(/(\*[^*]+\*)/g);
          return parts.map((part, i) => {
            const boldMatch = part.match(/^\*([^*]+)\*$/);
            if (boldMatch) {
              const inner = boldMatch[1];
              if (isEnglish) {
                // Wrap numbers inside bold text with system font
                const numParts = inner.split(/(\d+)/g);
                return <strong key={i} style={{ fontWeight: 700 }}>{numParts.map((np, ni) =>
                  /^\d+$/.test(np) ? <span key={ni} style={numFontStyle}>{np}</span> : np
                )}</strong>;
              }
              return <strong key={i} style={{ fontWeight: 700 }}>{inner}</strong>;
            }
            if (isEnglish) {
              // Wrap numbers in normal text with system font
              const numParts = part.split(/(\d+)/g);
              return <span key={i}>{numParts.map((np, ni) =>
                /^\d+$/.test(np) ? <span key={ni} style={numFontStyle}>{np}</span> : np
              )}</span>;
            }
            return <span key={i}>{part}</span>;
          });
        };

        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSavedReportViewModal(null)} />
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden max-h-[80vh] flex flex-col">
              {/* Header */}
              <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-4 text-white">
                <h2 className="font-arabic text-2xl text-center">تقرير محفوظ</h2>
                {/* Navigation row */}
                <div className="flex items-center justify-center gap-4 mt-1">
                  <button
                    onClick={() => hasPrev && navigateTo(reportDays[currentDayIndex - 1])}
                    disabled={!hasPrev}
                    className={`p-1.5 rounded-full transition-all ${hasPrev
                      ? 'bg-white/20 hover:bg-white/30 active:scale-90 cursor-pointer'
                      : 'opacity-20 cursor-not-allowed'
                      }`}
                  >
                    <ArrowRight size={18} />
                  </button>
                  <p className="text-center text-black font-arabic text-lg font-bold">
                    {savedReportViewModal.studentName} - يوم {toHindiDigits(savedReportViewModal.dayNum)}
                  </p>
                  <button
                    onClick={() => hasNext && navigateTo(reportDays[currentDayIndex + 1])}
                    disabled={!hasNext}
                    className={`p-1.5 rounded-full transition-all ${hasNext
                      ? 'bg-white/20 hover:bg-white/30 active:scale-90 cursor-pointer'
                      : 'opacity-20 cursor-not-allowed'
                      }`}
                  >
                    <ArrowLeft size={18} />
                  </button>
                </div>
              </div>

              {/* Report Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <pre
                  className={`whitespace-pre-wrap text-gray-700 leading-relaxed bg-gray-50 rounded-xl p-4 border border-gray-100 ${isEnglish
                    ? 'font-english text-base'
                    : 'font-arabic text-xl'
                    }`}
                  style={{
                    direction: dir,
                    textAlign
                  }}
                >
                  {renderReportContent(reportText)}
                </pre>
              </div>

              {/* Actions */}
              <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(savedReportViewModal.report).then(() => {
                      showToast('تم نسخ التقرير ✨');
                    });
                  }}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-arabic font-medium text-lg hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Copy size={18} />
                  نسخ التقرير
                </button>
                <button
                  onClick={() => setSavedReportViewModal(null)}
                  className="py-3 px-6 rounded-xl bg-gray-200 text-gray-700 font-arabic font-medium text-lg hover:bg-gray-300 transition-all"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <StickyHeader
        ref={stickyHeaderRef}
        show={showStickyHeader && !isTableLoading}
        isTableLoading={isTableLoading}
        studentWidth={studentWidth}
        tableWidth={tableWidth}
        month={month}
        year={year}
        daysInMonth={daysInMonth}
        dayOff={dayOff}
        today={today}
        toHindiDigits={toHindiDigits}
        getDayOfWeek={getDayOfWeek}
        getRemainingClasses={getRemainingClasses}
        scrollToFirstPending={scrollToFirstPending}
      />

      {/* Smart Report Modal */}
      {smartReportModal && smartReportModal.isOpen && (() => {
        try {
          const student = students.find(s => s.id === smartReportModal.studentId);
          const studentName = student?.name || 'غير معروف';



          // Get saved progress
          const savedProgress = studentProgress[smartReportModal.studentId];
          const lastReport = lastReports[smartReportModal.studentId];

          // Sync preferredModes with lastReport if available (One-off effect-like behavior on render? No, side-effect during render is bad)
          // Better: Use a useEffect in the main component to sync mode when modal opens.
          // For now, let's just use defaults logic modification.
          // Actually, since this is inside a conditional render block, we can't easily add useEffect here.
          // We will assume the user manually switches or we add a separate useEffect in the main body.

          // Wait, if I change preferredModes HERE, it causes re-render loop. 
          // I will add the useEffect to the main component body instead.

          // Create a simple form
          return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => closeAllModals(false)} />
              <div
                key={`${smartReportModal.studentId}_${lastReports[smartReportModal.studentId]?._dayNum || 'new'}`}
                className="smart-report-modal-container relative bg-white rounded-3xl shadow-2xl w-full max-w-[95vw] lg:max-w-6xl overflow-hidden max-h-[calc(100vh-2rem)] overflow-y-auto"
                onKeyDown={(e) => {
                  const target = e.target as HTMLElement;
                  if (e.key !== 'Tab') return;

                  if (!target.id || (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA')) return;

                  const fieldIdsBySection: Record<string, string[]> = {
                    'quran-new': [
                      'quran-new-surah-select-input',
                      'quran-new-from-surah-input',
                      'quran-new-from-page',
                      'quran-new-from-ayah',
                      'quran-new-to-surah-input',
                      'quran-new-to-page',
                      'quran-new-to-surah-advanced-input',
                      'quran-new-to-ayah',
                    ],
                    'hw-new': [
                      'hw-new-surah-select-input',
                      'hw-new-from-surah-safe-input',
                      'hw-new-from-surah-input',
                      'hw-new-from',
                      'hw-new-to-surah-safe-input',
                      'hw-new-to-surah-advanced-input',
                      'hw-new-to',
                    ],
                    'quran-rev': [
                      'quran-rev-surah-select-input',
                      'quran-rev-from-surah-input',
                      'quran-rev-from-page',
                      'quran-rev-from-juz',
                      'quran-rev-from-hizb',
                      'quran-rev-from-ayah',
                      'quran-rev-to-surah-input',
                      'quran-rev-to-page',
                      'quran-rev-to-juz',
                      'quran-rev-to-hizb',
                      'quran-rev-to-surah-advanced-input',
                      'quran-rev-to-ayah',
                    ],
                    'hw-rev': [
                      'hw-rev-surah-select-input',
                      'hw-rev-from-surah-input',
                      'hw-rev-from',
                      'hw-rev-to-surah-input',
                      'hw-rev-to-surah-advanced-input',
                      'hw-rev-to',
                    ],
                    'quran-oldrev': [
                      'quran-oldrev-surah-select-input',
                      'quran-oldrev-from-surah-input',
                      'quran-oldrev-from-page',
                      'quran-oldrev-from-juz',
                      'quran-oldrev-from-hizb',
                      'quran-oldrev-from-ayah',
                      'quran-oldrev-to-surah-input',
                      'quran-oldrev-to-page',
                      'quran-oldrev-to-juz',
                      'quran-oldrev-to-hizb',
                      'quran-oldrev-to-surah-advanced-input',
                      'quran-oldrev-to-ayah',
                    ],
                    'hw-oldrev': [
                      'hw-oldrev-surah-select-input',
                      'hw-oldrev-from-surah-input',
                      'hw-oldrev-from',
                      'hw-oldrev-to-surah-input',
                      'hw-oldrev-to-surah-advanced-input',
                      'hw-oldrev-to',
                    ],
                    'quran-tilawa': [
                      'quran-tilawa-surah-select-input',
                      'quran-tilawa-from-surah-input',
                      'quran-tilawa-from-page',
                      'quran-tilawa-from-juz',
                      'quran-tilawa-from-hizb',
                      'quran-tilawa-from-ayah',
                      'quran-tilawa-to-surah-input',
                      'quran-tilawa-to-page',
                      'quran-tilawa-to-juz',
                      'quran-tilawa-to-hizb',
                      'quran-tilawa-to-surah-advanced-input',
                      'quran-tilawa-to-ayah',
                    ],
                    'hw-tilawa': [
                      'hw-tilawa-surah-select-input',
                      'hw-tilawa-from-surah-input',
                      'hw-tilawa-from',
                      'hw-tilawa-to-surah-input',
                      'hw-tilawa-to-surah-advanced-input',
                      'hw-tilawa-to',
                    ],
                    'noor-tam': [
                      'noor-tam-from-page',
                      'noor-tam-to-page',
                      'noor-tam-from-line',
                      'noor-tam-to-line'
                    ],
                    'noor-sayatim': [
                      'noor-sayatim-from-page',
                      'noor-sayatim-to-page',
                      'noor-sayatim-from-line',
                      'noor-sayatim-to-line'
                    ],
                    'notes': [
                      'custom-notes-input',
                      'audio-link-input'
                    ]
                  };

                  const flowOrder = [
                    'quran-new', 'hw-new',
                    'quran-rev', 'hw-rev',
                    'quran-oldrev', 'hw-oldrev',
                    'quran-tilawa', 'hw-tilawa',
                    'noor-tam', 'noor-sayatim',
                    'notes'
                  ];

                  const currentKey = Object.keys(fieldIdsBySection).find(key => 
                    fieldIdsBySection[key].includes(target.id)
                  );
                  
                  if (!currentKey) return;

                  const getVisibleElementById = (id: string): HTMLElement | null => {
                    const candidates = Array.from(document.querySelectorAll(`#${id}`)) as HTMLElement[];
                    const visible = candidates.find(node => node.offsetParent !== null && !node.hasAttribute('disabled'));
                    return visible || null;
                  };

                  const getVisibleIdsInOrder = (sectionKey: string): string[] => {
                    const ordered = fieldIdsBySection[sectionKey] || [];
                    const result: string[] = [];
                    for (const id of ordered) {
                      if (result.includes(id)) continue;
                      const el = getVisibleElementById(id);
                      if (el) result.push(id);
                    }
                    return result;
                  };

                  const focusId = (id: string): boolean => {
                    const el = getVisibleElementById(id);
                    if (!el) return false;
                    e.preventDefault();
                    el.focus();
                    return true;
                  };

                  const currentVisibleIds = getVisibleIdsInOrder(currentKey);
                  if (currentVisibleIds.length === 0) return;

                  const currentFirstId = currentVisibleIds[0];
                  const currentLastId = currentVisibleIds[currentVisibleIds.length - 1];

                  // Forward: only jump when currently on the visible last field.
                  if (!e.shiftKey) {
                    if (target.id !== currentLastId) return;
                    const currentIndex = flowOrder.indexOf(currentKey);
                    if (currentIndex === -1) return;

                    for (let i = currentIndex + 1; i < flowOrder.length; i++) {
                      const nextVisibleIds = getVisibleIdsInOrder(flowOrder[i]);
                      if (nextVisibleIds.length > 0 && focusId(nextVisibleIds[0])) return;
                    }
                    // Loop back to start if at the very end
                    for (let i = 0; i < currentIndex; i++) {
                      const nextVisibleIds = getVisibleIdsInOrder(flowOrder[i]);
                      if (nextVisibleIds.length > 0 && focusId(nextVisibleIds[0])) return;
                    }
                    return;
                  }

                  // Backward: only jump when currently on the visible first field.
                  if (target.id !== currentFirstId) return;
                  const currentIndex = flowOrder.indexOf(currentKey);
                  if (currentIndex === -1) return;
                  for (let i = currentIndex - 1; i >= 0; i--) {
                    const prevVisibleIds = getVisibleIdsInOrder(flowOrder[i]);
                    if (prevVisibleIds.length > 0 && focusId(prevVisibleIds[prevVisibleIds.length - 1])) return;
                  }
                  // Loop back to end if at the very start
                  for (let i = flowOrder.length - 1; i > currentIndex; i--) {
                    const prevVisibleIds = getVisibleIdsInOrder(flowOrder[i]);
                    if (prevVisibleIds.length > 0 && focusId(prevVisibleIds[prevVisibleIds.length - 1])) return;
                  }
                }}
              >

                {/* Form */}
                <div className="px-6 lg:px-12 pb-2 pt-8">
                  <div className="pb-2">
                    {/* Path Selection */}
                    <div className="flex gap-2 mb-6 bg-gray-50 p-1 rounded-2xl">
                      <button
                        onClick={() => {
                          setReportPath('quran');
                          setLastReports(prev => ({
                            ...prev,
                            [smartReportModal.studentId]: {
                              ...prev[smartReportModal.studentId],
                              activeSection: 'quran'
                            }
                          }));
                        }}
                         className={`flex-1 py-3 px-4 rounded-xl font-arabic text-lg font-medium transition-all focus:outline-none ${reportPath === 'quran' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500 hover:bg-gray-100'}`}
                      >
                        📖 القرآن الكريم
                      </button>
                      <button
                        onClick={() => {
                          setReportPath('noor');
                          setVisitedNoor(true);
                          setLastReports(prev => ({
                            ...prev,
                            [smartReportModal.studentId]: {
                              ...prev[smartReportModal.studentId],
                              activeSection: 'noor'
                            }
                          }));
                        }}
                         className={`flex-1 py-3 px-4 rounded-xl font-arabic text-lg font-medium transition-all focus:outline-none ${reportPath === 'noor' ? 'bg-white shadow-sm text-amber-600' : 'text-gray-500 hover:bg-gray-100'}`}
                      >
                        🌟 القرائية
                      </button>

                    </div>

                    {/* Tajweed Section */}
                    <div id="tajweed-section" className="hidden">
                      <div className="space-y-2">
                        <h2 className="text-xl font-bold text-sky-800 font-arabic text-center">﴿ التجويد ﴾</h2>
                        <p className="text-sm text-slate-500 font-arabic text-center">اختر درس التجويد الحالي ثم حدّد الموضوع الذي تمت دراسته.</p>
                      </div>

                      <div className="grid lg:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="block text-lg font-medium text-gray-700 font-arabic">درس التجويد الحالي</label>
                          {tajweedLessons.length > 0 ? (
                            <select
                              value={selectedTajweedLessonId}
                              onChange={(e) => {
                                setSelectedTajweedLessonId(e.target.value);
                                const lesson = tajweedLessons.find(item => item.id === e.target.value);
                                if (lesson) {
                                  setLastReports(prev => ({
                                    ...prev,
                                    [smartReportModal.studentId]: {
                                      ...prev[smartReportModal.studentId],
                                      tajweed: {
                                        lessonId: lesson.id,
                                        lessonTitle: lesson.title,
                                        topicGroup: selectedTajweedTopicGroup,
                                        topic: selectedTajweedTopic,
                                      }
                                    }
                                  }));
                                }
                              }}
                              className="w-full p-3 border border-sky-200 rounded-xl bg-white text-slate-800 font-arabic outline-none focus:ring-2 focus:ring-sky-300"
                            >
                              {tajweedLessons.map((lesson) => (
                                <option key={lesson.id} value={lesson.id}>{lesson.title}</option>
                              ))}
                            </select>
                          ) : (
                            <div className="rounded-xl border border-dashed border-sky-200 bg-white p-3 text-slate-500 text-sm font-arabic">
                              لا توجد دروس في بنك التجويد حتى الآن.
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <label className="block text-lg font-medium text-gray-700 font-arabic">موضوع التجويد</label>
                          <div className="grid gap-2">
                            {TAJWEED_TOPIC_GROUPS.map((group) => (
                              <button
                                key={group.id}
                                onClick={() => {
                                  setSelectedTajweedTopicGroup(group.id);
                                  setSelectedTajweedTopic(group.topics[0]);
                                  setLastReports(prev => ({
                                    ...prev,
                                    [smartReportModal.studentId]: {
                                      ...prev[smartReportModal.studentId],
                                      tajweed: {
                                        lessonId: selectedTajweedLessonId,
                                        lessonTitle: tajweedLessons.find(item => item.id === selectedTajweedLessonId)?.title || '',
                                        topicGroup: group.id,
                                        topic: group.topics[0],
                                      }
                                    }
                                  }));
                                }}
                                className={`w-full rounded-xl border px-4 py-3 text-right font-arabic transition-all ${selectedTajweedTopicGroup === group.id ? 'bg-sky-100 border-sky-300 text-sky-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                              >
                                {group.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {selectedTajweedTopicGroup !== 'foundation' && (
                        <div className="space-y-3">
                          <label className="block text-lg font-medium text-gray-700 font-arabic">تفصيل الموضوع</label>
                          <div className="flex flex-wrap gap-2">
                            {TAJWEED_TOPIC_GROUPS.find(group => group.id === selectedTajweedTopicGroup)?.topics.map((topic) => (
                              <button
                                key={topic}
                                onClick={() => {
                                  setSelectedTajweedTopic(topic);
                                  setLastReports(prev => ({
                                    ...prev,
                                    [smartReportModal.studentId]: {
                                      ...prev[smartReportModal.studentId],
                                      tajweed: {
                                        lessonId: selectedTajweedLessonId,
                                        lessonTitle: tajweedLessons.find(item => item.id === selectedTajweedLessonId)?.title || '',
                                        topicGroup: selectedTajweedTopicGroup,
                                        topic,
                                      }
                                    }
                                  }));
                                }}
                                className={`rounded-full px-4 py-2 text-sm font-bold font-arabic transition-all ${selectedTajweedTopic === topic ? 'bg-sky-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                              >
                                {topic}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="rounded-2xl border border-sky-100 bg-white p-4 space-y-2">
                        <p className="text-sm text-slate-500 font-arabic">المعاينة الحالية</p>
                        <p className="font-arabic text-slate-800">الدرس: {tajweedLessons.find(item => item.id === selectedTajweedLessonId)?.title || 'غير محدد'}</p>
                        <p className="font-arabic text-slate-800">الموضوع: {selectedTajweedTopicGroup === 'foundation' ? 'النون والميم المشددتان' : TAJWEED_TOPIC_GROUPS.find(group => group.id === selectedTajweedTopicGroup)?.label || ''}</p>
                        {selectedTajweedTopicGroup !== 'foundation' && <p className="font-arabic text-slate-800">التفصيل: {selectedTajweedTopic}</p>}
                      </div>

                      <div className="rounded-2xl border border-sky-100 bg-white p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-slate-500 font-arabic">الحلول السابقة</p>
                          <span className="inline-flex items-center justify-center rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-bold text-sky-700 font-arabic">
                            {toHindiDigits(smartReportStudentTajweedHistory.length)}
                          </span>
                        </div>

                        {smartReportStudentTajweedHistory.length === 0 ? (
                          <p className="text-sm text-slate-400 font-arabic">لا توجد حلول مرسلة لهذا الطالب حتى الآن.</p>
                        ) : (
                          <div className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                            {smartReportStudentTajweedHistory.map((item, historyIndex) => {
                              const lessonTitle = item.lesson?.title || getTajweedLessonTitle(item.assignment.lessonId, 'ar');
                              const submittedAt = item.submission.submittedAt || item.assignment.assignedAt;
                              const answers = Array.isArray(item.submission.answers) ? item.submission.answers : [];

                              return (
                                <div key={item.submission.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <p className="text-sm font-bold text-slate-700 font-arabic">{toHindiDigits(historyIndex + 1)}. {lessonTitle}</p>
                                      <p className="text-xs text-slate-500 font-arabic">
                                        تاريخ الإرسال: {submittedAt
                                          ? `${toHindiDigits(new Date(submittedAt).getDate())}/${toHindiDigits(new Date(submittedAt).getMonth() + 1)}/${toHindiDigits(new Date(submittedAt).getFullYear())}`
                                          : '-'}
                                      </p>
                                    </div>
                                    <span className={`text-[10px] px-2 py-1 rounded-full font-arabic font-bold ${item.assignment.status === 'graded' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                      {item.assignment.status === 'graded' ? 'مصحح' : 'مرسل'}
                                    </span>
                                  </div>

                                  {answers.length === 0 ? (
                                    <p className="text-xs text-slate-400 font-arabic">لا توجد إجابات محفوظة داخل هذا الإرسال.</p>
                                  ) : (
                                    <div className="space-y-2">
                                      {answers.map((answer, answerIndex) => {
                                        const questionMeta = item.lesson?.questions?.find(q => q.id === answer.questionId) || item.lesson?.questions?.[answerIndex];
                                        const questionText = questionMeta?.text || `سؤال ${toHindiDigits(answerIndex + 1)}`;
                                        const selectedOptionText = (
                                          typeof answer.selectedOptionIndex === 'number' &&
                                          Array.isArray(questionMeta?.options)
                                        )
                                          ? questionMeta.options[answer.selectedOptionIndex] || ''
                                          : '';
                                        const audioSrc = answer.audioLocalPath
                                          ? `local-file://${encodeURIComponent(answer.audioLocalPath)}`
                                          : answer.audioBase64;

                                        return (
                                          <div key={`${item.submission.id}_${answer.questionId}_${answerIndex}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                                            <p className="text-xs font-bold text-slate-700 font-arabic mb-1">{questionText}</p>

                                            {selectedOptionText && (
                                              <p className="text-xs text-slate-600 font-arabic">اختيار الطالب: {selectedOptionText}</p>
                                            )}

                                            {answer.answerText && (
                                              <p className="text-xs text-slate-600 font-arabic whitespace-pre-wrap">{answer.answerText}</p>
                                            )}

                                            {audioSrc && (
                                              <audio
                                                controls
                                                preload="auto"
                                                onClick={(event) => event.stopPropagation()}
                                                src={audioSrc}
                                                className="w-full mt-1"
                                              />
                                            )}

                                            {!selectedOptionText && !answer.answerText && !audioSrc && (
                                              <p className="text-xs text-slate-400 font-arabic">لا توجد إجابة لهذا السؤال.</p>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Book Selection */}
                    <div className={`mb-4 flex justify-start gap-4 items-center ${reportPath === 'noor' ? '' : 'hidden'}`}>
                      <label className="text-xl font-medium text-gray-700 font-arabic">الكتاب:</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setDefaultNoorBook('noor');
                            setLastReports(prev => ({
                              ...prev,
                              [smartReportModal.studentId]: {
                                ...prev[smartReportModal.studentId],
                                noor: {
                                  ...prev[smartReportModal.studentId]?.noor,
                                  book: 'noor'
                                }
                              }
                            }));
                          }}
                          className={`px-4 py-2 rounded-lg font-arabic text-xl transition-all ${(lastReports[smartReportModal.studentId]?.noor?.book || defaultNoorBook) !== 'taasees' ? 'bg-emerald-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                          نور البيان
                        </button>
                        <button
                          onClick={() => {
                            setDefaultNoorBook('taasees');
                            setLastReports(prev => ({
                              ...prev,
                              [smartReportModal.studentId]: {
                                ...prev[smartReportModal.studentId],
                                noor: {
                                  ...prev[smartReportModal.studentId]?.noor,
                                  book: 'taasees'
                                }
                              }
                            }));
                          }}
                          className={`px-4 py-2 rounded-lg font-arabic text-xl transition-all ${(lastReports[smartReportModal.studentId]?.noor?.book || defaultNoorBook) === 'taasees' ? 'bg-emerald-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                          التأسيس
                        </button>
                      </div>
                    </div>

                    {/* Noor Al-Bayan Section (New) */}
                    <div id="noor-section" className={`grid grid-cols-1 lg:grid-cols-2 gap-12 relative bg-[linear-gradient(to_left,transparent_0%,#dbeafe99_15%,#dbeafe99_45%,#fef3c799_55%,#fef3c799_85%,transparent_100%)] rounded-2xl p-4 ${reportPath === 'noor' ? '' : 'hidden'}`}>
                      {/* Vertical Divider Line */}
                      <div className="hidden lg:block absolute left-1/2 top-4 bottom-4 w-px bg-black/15 -translate-x-1/2"></div>
                      <div className="space-y-5">
                        {/* Header: What Was Done */}
                        <div className="space-y-3">
                          <div className="flex flex-col items-center gap-2 py-1">
                            <h2 className="text-xl font-bold text-gray-700 font-arabic text-center py-2 px-10 bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-xl shadow-md">
                              الدرس الحالي
                            </h2>
                            <label className="flex items-center gap-1.5 cursor-pointer hover:bg-white/50 p-1 rounded-md transition-colors">
                              <input
                                type="checkbox"
                                checked={excludeNoorTam}
                                onChange={(e) => setExcludeNoorTam(e.target.checked)}
                                className="w-3.5 h-3.5 text-amber-500 rounded border-gray-300 focus:ring-amber-500"
                              />
                              <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                                {excludeNoorTam ? <EyeOff size={14} /> : <Eye size={14} />}
                                إخفاء من التقرير
                              </span>
                            </label>
                          </div>

                          <div className="flex gap-3 items-end">
                            <div className="flex-1">
                              <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">من صفحة</label>
                              <input
                                id="noor-tam-from-page"
                                type="text"
                                inputMode="numeric"
                                defaultValue={toHindiDigits(lastReports[smartReportModal.studentId]?.noor?.tam?.fromPage || '')}
                                onPointerDown={() => handleInputPointerDown('noor-tam-from-page')}
                                onPointerUp={handleInputPointerUp}
                                onPointerLeave={handleInputPointerUp}
                                onFocus={handleFocus}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
                                  e.target.value = val;
                                  if (isNoorMirrorMode) {
                                    const sayatimEl = document.getElementById('noor-sayatim-from-page') as HTMLInputElement;
                                    if (sayatimEl) {
                                      sayatimEl.value = val;
                                      // No need to dispatch event as these fields are uncontrolled and handled by report generation
                                    }
                                  }
                                }}
                                className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['noor-tam-from-page'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                              />
                            </div>
                            <div className="flex-1">
                              <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">إلى صفحة</label>
                              <input
                                id="noor-tam-to-page"
                                type="text"
                                inputMode="numeric"
                                defaultValue={toHindiDigits(lastReports[smartReportModal.studentId]?.noor?.tam?.toPage || '')}
                                onPointerDown={() => handleInputPointerDown('noor-tam-to-page')}
                                onPointerUp={handleInputPointerUp}
                                onPointerLeave={handleInputPointerUp}
                                onFocus={handleFocus}
                                onKeyDown={(e) => {
                                  if (e.key === 'Tab' && !e.shiftKey) {
                                    e.preventDefault();
                                    const next = document.getElementById('noor-sayatim-from-page') as HTMLInputElement | null;
                                    next?.focus();
                                    next?.select();
                                  }
                                }}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
                                  e.target.value = val;
                                  if (isNoorMirrorMode) {
                                    const sayatimEl = document.getElementById('noor-sayatim-to-page') as HTMLInputElement;
                                    if (sayatimEl) {
                                      sayatimEl.value = val;
                                    }
                                  }
                                }}
                                className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['noor-tam-to-page'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                              />
                            </div>
                            <button
                              onClick={() => setNoorDetails(prev => ({ ...prev, tam: !prev.tam }))}
                              className={`p-3 rounded-xl border transition-all ${noorDetails.tam ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-gray-200 text-gray-400 hover:text-amber-500'}`}
                              title={noorDetails.tam ? "إخفاء التفاصيل" : "إضافة تفاصيل (أسطر)"}
                            >
                              {noorDetails.tam ? <Minus size={24} /> : <Plus size={24} />}
                            </button>
                          </div>

                          {/* Line Details */}
                          {noorDetails.tam && (
                            <div className="flex gap-3 items-end animate-in fade-in slide-in-from-top-2">
                              <div className="flex-1">
                                <input
                                  id="noor-tam-from-line"
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="السطر"
                                  defaultValue={toHindiDigits(lastReports[smartReportModal.studentId]?.noor?.tam?.fromLine || '')}
                                  onPointerDown={() => handleInputPointerDown('noor-tam-from-line')}
                                  onPointerUp={handleInputPointerUp}
                                  onPointerLeave={handleInputPointerUp}
                                  onFocus={handleFocus}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
                                    e.target.value = val;
                                    if (isNoorMirrorMode) {
                                      const sayatimEl = document.getElementById('noor-sayatim-from-line') as HTMLInputElement;
                                      if (sayatimEl) {
                                        sayatimEl.value = val;
                                      }
                                    }
                                  }}
                                  className={`w-full p-3 border border-gray-200 rounded-xl text-center text-lg font-arabic placeholder:text-gray-300 transition-all ${cancelledInputs['noor-tam-from-line'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                                />
                              </div>
                              <div className="flex-1">
                                <input
                                  id="noor-tam-to-line"
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="السطر"
                                  defaultValue={toHindiDigits(lastReports[smartReportModal.studentId]?.noor?.tam?.toLine || '')}
                                  onPointerDown={() => handleInputPointerDown('noor-tam-to-line')}
                                  onPointerUp={handleInputPointerUp}
                                  onPointerLeave={handleInputPointerUp}
                                  onFocus={handleFocus}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
                                    e.target.value = val;
                                    if (isNoorMirrorMode) {
                                      const sayatimEl = document.getElementById('noor-sayatim-to-line') as HTMLInputElement;
                                      if (sayatimEl) {
                                        sayatimEl.value = val;
                                      }
                                    }
                                  }}
                                  className={`w-full p-3 border border-gray-200 rounded-xl text-center text-lg font-arabic placeholder:text-gray-300 transition-all ${cancelledInputs['noor-tam-to-line'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                                />
                              </div>
                              <div className="w-[52px]"></div> {/* Spacer for alignment with + button */}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-5">
                        {/* Header: What Will Be Done */}
                        <div className="space-y-3">
                          <div className="relative flex flex-col items-center gap-2 py-1">
                            <h2 className="text-xl font-bold text-gray-700 font-arabic text-center py-2 px-10 bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-xl shadow-md">
                              الدرس القادم
                            </h2>
                            <label className="flex items-center gap-1.5 cursor-pointer hover:bg-white/50 p-1 rounded-md transition-colors">
                              <input
                                type="checkbox"
                                checked={excludeNoorSayatim}
                                onChange={(e) => setExcludeNoorSayatim(e.target.checked)}
                                className="w-3.5 h-3.5 text-amber-500 rounded border-gray-300 focus:ring-amber-500"
                              />
                              <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                                {excludeNoorSayatim ? <EyeOff size={14} /> : <Eye size={14} />}
                                إخفاء من التقرير
                              </span>
                            </label>
                            <div className="absolute left-0 top-1/2 -translate-y-1/2">
                              <button
                              onClick={() => {
                                const newMode = !isNoorMirrorMode;
                                setIsNoorMirrorMode(newMode);

                                if (newMode) {
                                  const setVal = (id: string, val: string) => {
                                    const el = document.getElementById(id) as HTMLInputElement;
                                    if (el) el.value = val;
                                  };

                                  const tamFrom = (document.getElementById('noor-tam-from-page') as HTMLInputElement)?.value;
                                  const tamTo = (document.getElementById('noor-tam-to-page') as HTMLInputElement)?.value;

                                  if (tamFrom) setVal('noor-sayatim-from-page', tamFrom);
                                  if (tamTo) setVal('noor-sayatim-to-page', tamTo);

                                  // Handle Lines if active
                                  if (noorDetails.tam) {
                                    setNoorDetails(prev => ({ ...prev, sayatim: true }));
                                    // Small timeout to allow render if sayatim details were hidden
                                    setTimeout(() => {
                                      const tamLineFrom = (document.getElementById('noor-tam-from-line') as HTMLInputElement)?.value;
                                      const tamLineTo = (document.getElementById('noor-tam-to-line') as HTMLInputElement)?.value;
                                      if (tamLineFrom) setVal('noor-sayatim-from-line', tamLineFrom);
                                      if (tamLineTo) setVal('noor-sayatim-to-line', tamLineTo);
                                    }, 50);
                                  }
                                }
                              }}
                              className={`px-3 py-1 rounded-md transition-colors flex items-center gap-2 font-arabic text-sm font-bold border shadow-sm ${isNoorMirrorMode ? 'bg-amber-100 border-amber-300 text-amber-700 ring-2 ring-amber-200' : 'bg-white border-amber-200 text-amber-700 hover:bg-amber-50'}`}
                            >
                              <Repeat size={14} className={isNoorMirrorMode ? 'animate-spin-slow' : ''} />
                              {isNoorMirrorMode ? 'نسخ مستمر' : 'إعادة'}
                            </button>
                            </div>
                          </div>

                          <div className="flex gap-3 items-end">
                            <div className="flex-1">
                              <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">من صفحة</label>
                              <input
                                id="noor-sayatim-from-page"
                                type="text"
                                inputMode="numeric"
                                defaultValue={toHindiDigits(lastReports[smartReportModal.studentId]?.noor?.sayatim?.fromPage || '')}
                                onPointerDown={() => handleInputPointerDown('noor-sayatim-from-page')}
                                onPointerUp={handleInputPointerUp}
                                onPointerLeave={handleInputPointerUp}
                                onFocus={handleFocus}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
                                  e.target.value = val;
                                }}
                                className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['noor-sayatim-from-page'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                              />
                            </div>
                            <div className="flex-1">
                              <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">إلى صفحة</label>
                              <input
                                id="noor-sayatim-to-page"
                                type="text"
                                inputMode="numeric"
                                defaultValue={toHindiDigits(lastReports[smartReportModal.studentId]?.noor?.sayatim?.toPage || '')}
                                onPointerDown={() => handleInputPointerDown('noor-sayatim-to-page')}
                                onPointerUp={handleInputPointerUp}
                                onPointerLeave={handleInputPointerUp}
                                onFocus={handleFocus}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
                                  e.target.value = val;
                                }}
                                className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['noor-sayatim-to-page'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                              />
                            </div>
                            <button
                              onClick={() => setNoorDetails(prev => ({ ...prev, sayatim: !prev.sayatim }))}
                              className={`p-3 rounded-xl border transition-all ${noorDetails.sayatim ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-gray-200 text-gray-400 hover:text-amber-500'}`}
                              title={noorDetails.sayatim ? "إخفاء التفاصيل" : "إضافة تفاصيل (أسطر)"}
                            >
                              {noorDetails.sayatim ? <Minus size={24} /> : <Plus size={24} />}
                            </button>
                          </div>

                          {/* Line Details */}
                          {noorDetails.sayatim && (
                            <div className="flex gap-3 items-end animate-in fade-in slide-in-from-top-2">
                              <div className="flex-1">
                                <input
                                  id="noor-sayatim-from-line"
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="السطر"
                                  defaultValue={toHindiDigits(lastReports[smartReportModal.studentId]?.noor?.sayatim?.fromLine || '')}
                                  onPointerDown={() => handleInputPointerDown('noor-sayatim-from-line')}
                                  onPointerUp={handleInputPointerUp}
                                  onPointerLeave={handleInputPointerUp}
                                  onFocus={handleFocus}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
                                    e.target.value = val;
                                  }}
                                  className={`w-full p-3 border border-gray-200 rounded-xl text-center text-lg font-arabic placeholder:text-gray-300 transition-all ${cancelledInputs['noor-sayatim-from-line'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                                />
                              </div>
                              <div className="flex-1">
                                <input
                                  id="noor-sayatim-to-line"
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="السطر"
                                  defaultValue={toHindiDigits(lastReports[smartReportModal.studentId]?.noor?.sayatim?.toLine || '')}
                                  onPointerDown={() => handleInputPointerDown('noor-sayatim-to-line')}
                                  onPointerUp={handleInputPointerUp}
                                  onPointerLeave={handleInputPointerUp}
                                  onFocus={handleFocus}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
                                    e.target.value = val;
                                  }}
                                  className={`w-full p-3 border border-gray-200 rounded-xl text-center text-lg font-arabic placeholder:text-gray-300 transition-all ${cancelledInputs['noor-sayatim-to-line'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                                />
                              </div>
                              <div className="w-[52px]"></div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quran Sections Container */}
                  <div id="quran-section" className={`grid grid-cols-1 lg:grid-cols-2 gap-12 relative bg-[linear-gradient(to_left,transparent_0%,#dbeafe99_15%,#dbeafe99_45%,#fef3c799_55%,#fef3c799_85%,transparent_100%)] rounded-2xl p-4 ${reportPath === 'quran' ? '' : 'hidden'}`}>
                    {/* Vertical Divider Line */}
                    <div className="hidden lg:block absolute left-1/2 top-4 bottom-4 w-px bg-black/15 -translate-x-1/2"></div>
                    {/* Main Header: What Was Done */}
                    <div className="flex justify-center py-1 lg:col-start-1 lg:row-start-1">
                      <h2 className="text-xl font-bold text-gray-700 font-arabic text-center py-2 px-10 bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-xl shadow-md">
                        الدرس الحالي
                      </h2>
                    </div>

                    {/* 1. New Recitation Section (الجديد) */}
                    <div className={`space-y-3 transition-opacity duration-200 lg:col-start-1 lg:row-start-2 ${!sectionToggles.readingNew ? 'opacity-40' : ''}`} onChange={() => { if (isRedoMode) syncRedoValues(); }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSectionToggles(prev => {
                              const next = { ...prev, readingNew: !prev.readingNew };
                              setLastReports(lastPrev => {
                                const studentId = smartReportModal?.studentId;
                                if (!studentId) return lastPrev;
                                return {
                                  ...lastPrev,
                                  [studentId]: {
                                    ...lastPrev[studentId],
                                    sectionToggles: next
                                  }
                                };
                              });
                              return next;
                            })}
                            className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${sectionToggles.readingNew ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 bg-white'}`}
                          >
                            {sectionToggles.readingNew && <Check size={14} strokeWidth={3} />}
                          </button>
                          <h3 className="text-2xl font-bold text-gray-700 font-arabic">الجديد</h3>
                        </div>
                        <div className={`flex gap-1 p-1 bg-gray-100 rounded-lg ${!sectionToggles.readingNew ? 'hidden' : ''}`}>
                          <button
                            id="quran-new-mode-ayah"
                            onClick={() => {
                              setPreferredModes(prev => ({ ...prev, readingNew: 'ayah', homeworkNew: 'ayah' }));
                              setLastReports(prev => {
                                const studentId = smartReportModal?.studentId;
                                if (!studentId) return prev;
                                return {
                                  ...prev,
                                  [studentId]: {
                                    ...prev[studentId],
                                    readingNew: { ...prev[studentId]?.readingNew, mode: 'ayah' },
                                    homeworkNew: { ...prev[studentId]?.homeworkNew, mode: 'ayah' }
                                  }
                                };
                              });
                            }}
                            className={`px-2 py-1 rounded-md text-xs font-arabic font-bold transition-all ${preferredModes.readingNew === 'ayah' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500'}`}
                          >
                            آيات
                          </button>
                          <button
                            id="quran-new-mode-page"
                            onClick={() => {
                              setPreferredModes(prev => ({ ...prev, readingNew: 'page', homeworkNew: 'page' }));
                              setLastReports(prev => {
                                const studentId = smartReportModal?.studentId;
                                if (!studentId) return prev;
                                return {
                                  ...prev,
                                  [studentId]: {
                                    ...prev[studentId],
                                    readingNew: { ...prev[studentId]?.readingNew, mode: 'page' },
                                    homeworkNew: { ...prev[studentId]?.homeworkNew, mode: 'page' }
                                  }
                                };
                              });
                            }}
                            className={`px-2 py-1 rounded-md text-xs font-arabic font-bold transition-all ${preferredModes.readingNew === 'page' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500'}`}
                          >
                            صفحات
                          </button>
                        </div>
                      </div>

                      {sectionToggles.readingNew && (
                        <>
                          <div className="flex items-center gap-5 mb-4 flex-wrap">
                            <label className="flex items-center gap-1.5 cursor-pointer hover:bg-white/50 p-1 rounded-md transition-colors">
                              <input
                                type="checkbox"
                                checked={excludeReadingNew}
                                onChange={(e) => setExcludeReadingNew(e.target.checked)}
                                className="w-3.5 h-3.5 text-amber-500 rounded border-gray-300 focus:ring-amber-500"
                              />
                              <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                                {excludeReadingNew ? <EyeOff size={14} /> : <Eye size={14} />}
                                إخفاء من التقرير
                              </span>
                            </label>

                            {/* Remove Mastery Exclusion button — shown when exclusion active */}
                            {prevReportHadExclusion && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    setPrevReportHadExclusion(false);
                                  }}
                                  className="px-3 py-1 text-sm font-arabic font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                                >
                                  إزالة
                                </button>
                                <span className="text-xs text-gray-400 font-arabic">عدم تضمين الحفظ في التقرير</span>
                              </div>
                            )}
                          </div>

                          {/* New Ayah Inputs (Compact Layout with Advanced Toggle) */}
                          <div id="quran-new-inputs-ayah-container" className={`${preferredModes.readingNew === 'ayah' ? 'flex flex-col gap-3' : 'hidden'} ${prevReportHadExclusion ? 'opacity-40 blur-[1px] pointer-events-none' : ''}`}>
                            {/* Row 1 */}
                            <div className="flex gap-3 items-end">
                              <div className="flex-[2]">
                                <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">
                                  {activeAdvancedAyah.readingNew ? 'من سورة' : 'السورة'}
                                </label>
                                <SearchableSurahSelect
                                  id="quran-new-surah-select"
                                  value={lastReport?.readingNew?.surah || lastReport?.homeworkNew?.surah || savedProgress?.surah || SURAHS[0]}
                                  surahs={SURAHS}
                                  onChange={(val) => {
                                    setLastReports(prev => {
                                      const studentId = smartReportModal?.studentId;
                                      if (!studentId) return prev;
                                      return {
                                        ...prev,
                                        [studentId]: {
                                          ...prev[studentId],
                                          readingNew: {
                                            ...prev[studentId]?.readingNew,
                                            surah: val
                                          }
                                        }
                                      };
                                    });

                                    // Also sync to Homework New (Ma Sayatim) if strict flow?
                                    // Usually ma Sayatim starts where Ma Tam ends.
                                    // But let's just persist for now.
                                  }}
                                />
                              </div>

                              <div className="flex-1">
                                <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">من الآية</label>
                                <input
                                  id="quran-new-from-ayah"
                                  type="text"
                                  inputMode="numeric"
                                  autoComplete="off"
                                  value={toHindiDigits(lastReport?.readingNew?.fromAyah ?? '')}
                                  onPointerDown={() => handleInputPointerDown('quran-new-from-ayah')}
                                  onPointerUp={handleInputPointerUp}
                                  onPointerLeave={handleInputPointerUp}
                                  onFocus={handleFocus}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);

                                    setLastReports(prev => {
                                      const studentId = smartReportModal?.studentId;
                                      if (!studentId) return prev;

                                      let finalVal = val;
                                      if (val) {
                                        const ayahNum = parseInt(val.replace(/[٠-٩]/g, (d) => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]));
                                        if (!isNaN(ayahNum)) {
                                          const currentSurah = (document.getElementById('quran-new-surah-select') as HTMLSelectElement)?.value
                                            || lastReport?.readingNew?.surah
                                            || savedProgress?.surah
                                            || SURAHS[0];
                                          const surahIndex = SURAHS.indexOf(currentSurah);
                                          if (surahIndex !== -1) {
                                            const totalAyahs = SURAH_AYAH_COUNTS[surahIndex];
                                            if (ayahNum > totalAyahs) {
                                              finalVal = toHindiDigits(totalAyahs);
                                            }
                                          }
                                        }
                                      }

                                      const next: any = {
                                        ...prev,
                                        [studentId]: {
                                          ...prev[studentId],
                                          readingNew: {
                                            ...prev[studentId]?.readingNew,
                                            fromAyah: finalVal
                                          }
                                        }
                                      };

                                      // Live sync: Reading Revision "toAyah" = Reading New "fromAyah" - 1
                                      if (preferredModes.readingNew === 'ayah' && finalVal) {
                                        const fromWestern = parseInt(toEnglish(finalVal));
                                        if (!isNaN(fromWestern)) {
                                          const newSurah = prev[studentId]?.readingNew?.surah || SURAHS[0];
                                          let revTo: string;
                                          let revToSurah: string;

                                          if (fromWestern <= 1) {
                                            const idx = SURAHS.indexOf(newSurah);
                                            // Check if review is in "reversed" mode (review from-surah comes after new surah)
                                            const revFromSurah = prev[studentId]?.readingRev?.surah
                                              || (document.getElementById('quran-rev-surah-select') as HTMLSelectElement)?.value
                                              || SURAHS[0];
                                            const revFromIdx = SURAHS.indexOf(revFromSurah);
                                            const isReversed = revFromIdx > idx;

                                            if (isReversed) {
                                              // Reversed: go to last ayah of surah idx+1 (next surah)
                                              if (idx < SURAHS.length - 1) {
                                                revToSurah = SURAHS[idx + 1];
                                                revTo = toHindiDigits(String(SURAH_AYAH_COUNTS[idx + 1]));
                                              } else {
                                                revToSurah = newSurah;
                                                revTo = '';
                                              }
                                            } else {
                                              // Normal: go to last ayah of surah idx-1 (previous surah)
                                              if (idx > 0) {
                                                revToSurah = SURAHS[idx - 1];
                                                revTo = toHindiDigits(String(SURAH_AYAH_COUNTS[idx - 1]));
                                              } else {
                                                revToSurah = newSurah;
                                                revTo = '';
                                              }
                                            }
                                          } else {
                                            revToSurah = newSurah;
                                            revTo = toHindiDigits(String(fromWestern - 1));
                                          }

                                          next[studentId] = {
                                            ...next[studentId],
                                            readingRev: {
                                              ...next[studentId]?.readingRev,
                                              toAyah: revTo,
                                              toSurah: revToSurah,
                                            }
                                          };
                                        }
                                      }

                                      return next;
                                    });
                                  }}
                                  style={{}}
                                  className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['quran-new-from-ayah'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                                />
                              </div>

                              {!activeAdvancedAyah.readingNew && (
                                <div className="flex-1">
                                  <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">إلى الآية</label>
                                  <input
                                    id="quran-new-to-ayah"
                                    onFocus={handleFocus}
                                    onPointerDown={() => handleInputPointerDown('quran-new-to-ayah')}
                                    onPointerUp={handleInputPointerUp}
                                    onPointerLeave={handleInputPointerUp}
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="off"
                                    value={toHindiDigits(lastReport?.readingNew?.toAyah ?? '')}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);

                                      // Strict Capping & Single State Update
                                      setLastReports(prev => {
                                        const studentId = smartReportModal?.studentId;
                                        if (!studentId) return prev;

                                        let finalVal = val;
                                        let nextHomework = null;

                                        if (val) {
                                          const endAyahNum = parseInt(val.replace(/[٠-٩]/g, (d) => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]));
                                          if (!isNaN(endAyahNum)) {
                                            const currentSurah = (document.getElementById('quran-new-surah-select') as HTMLSelectElement)?.value || lastReport?.readingNew?.surah;
                                            const surahIndex = SURAHS.indexOf(currentSurah);

                                            if (surahIndex !== -1) {
                                              const totalAyahs = SURAH_AYAH_COUNTS[surahIndex];

                                              // Check Capping
                                              let validatedAyahNum = endAyahNum;
                                              if (endAyahNum > totalAyahs) {
                                                validatedAyahNum = totalAyahs;
                                                finalVal = toHindiDigits(totalAyahs);
                                              }

                                              // Auto-advance
                                              let nextSurah = currentSurah;
                                              let nextStartAyah = validatedAyahNum + 1;

                                              if (validatedAyahNum >= totalAyahs && surahIndex < SURAHS.length - 1) {
                                                nextSurah = SURAHS[surahIndex + 1];
                                                nextStartAyah = 1;
                                              }

                                              nextHomework = {
                                                mode: 'ayah',
                                                surah: nextSurah,
                                                fromSurah: nextSurah,
                                                from: toHindiDigits(nextStartAyah),
                                                to: ''
                                              };
                                            }
                                          }
                                        }

                                        const newState = {
                                          ...prev,
                                          [studentId]: {
                                            ...prev[studentId],
                                            readingNew: {
                                              ...prev[studentId]?.readingNew,
                                              toAyah: finalVal
                                            }
                                          }
                                        };

                                        if (nextHomework && !isRedoMode) {
                                          newState[studentId].homeworkNew = {
                                            ...newState[studentId]?.homeworkNew,
                                            ...nextHomework
                                          };

                                          // Chain: Revision "to" = New "from" - 1
                                          if (nextHomework.from) {
                                            const hwFromWestern = parseInt(toEnglish(nextHomework.from));
                                            if (!isNaN(hwFromWestern)) {
                                              let revTo: string;
                                              let revToSurah: string;
                                              const hwSurah = nextHomework.fromSurah || nextHomework.surah;

                                              if (hwFromWestern <= 1) {
                                                const idx = SURAHS.indexOf(hwSurah);
                                                if (idx > 0) {
                                                  revToSurah = SURAHS[idx - 1];
                                                  revTo = toHindiDigits(String(SURAH_AYAH_COUNTS[idx - 1]));
                                                } else {
                                                  revToSurah = hwSurah;
                                                  revTo = '';
                                                }
                                              } else {
                                                revToSurah = hwSurah;
                                                revTo = toHindiDigits(String(hwFromWestern - 1));
                                              }

                                              newState[studentId].homeworkRev = {
                                                ...newState[studentId]?.homeworkRev,
                                                to: revTo,
                                                toSurah: revToSurah,
                                              };
                                            }
                                          }
                                        }

                                        return newState;
                                      });
                                    }}
                                    style={{}}
                                    className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['quran-new-to-ayah'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                                  />
                                </div>
                              )}
                            </div>

                            {/* Row 2 (Advanced Mode Only) */}
                            {activeAdvancedAyah.readingNew && (
                              <div className="flex gap-3 items-end">
                                <div className="flex-[2]">
                                  <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">إلى سورة</label>
                                  <SearchableSurahSelect
                                    id="quran-new-to-surah-advanced"
                                    value={lastReport?.readingNew?.toSurah || lastReport?.readingNew?.surah || SURAHS[0]}
                                    surahs={SURAHS}
                                    onChange={(val) => {
                                      setLastReports(prev => {
                                        const studentId = smartReportModal?.studentId;
                                        if (!studentId) return prev;
                                        return {
                                          ...prev,
                                          [studentId]: {
                                            ...prev[studentId],
                                            readingNew: {
                                              ...prev[studentId]?.readingNew,
                                              toSurah: val
                                            }
                                          }
                                        };
                                      });
                                    }}
                                  />
                                </div>

                                <div className="flex-1">
                                  <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">إلى الآية</label>
                                  <input
                                    id="quran-new-to-ayah"
                                    onFocus={handleFocus}
                                    onPointerDown={() => handleInputPointerDown('quran-new-to-ayah')}
                                    onPointerUp={handleInputPointerUp}
                                    onPointerLeave={handleInputPointerUp}
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="off"
                                    value={toHindiDigits(lastReport?.readingNew?.toAyah ?? '')}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);

                                      setLastReports(prev => {
                                        const studentId = smartReportModal?.studentId;
                                        if (!studentId) return prev;

                                        let finalVal = val;
                                        let nextHomework = null;

                                        if (val) {
                                          const endAyahNum = parseInt(val.replace(/[٠-٩]/g, (d) => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]));

                                          if (!isNaN(endAyahNum)) {
                                            const currentSurah = lastReport?.readingNew?.toSurah || lastReport?.readingNew?.surah || SURAHS[0];
                                            const surahIndex = SURAHS.indexOf(currentSurah);

                                            if (surahIndex !== -1) {
                                              const totalAyahs = SURAH_AYAH_COUNTS[surahIndex];
                                              let validatedAyahNum = endAyahNum;

                                              if (endAyahNum > totalAyahs) {
                                                validatedAyahNum = totalAyahs;
                                                finalVal = toHindiDigits(totalAyahs);
                                                e.target.value = finalVal;
                                              }

                                              let nextSurah = currentSurah;
                                              let nextStartAyah = validatedAyahNum + 1;

                                              if (validatedAyahNum >= totalAyahs && surahIndex < SURAHS.length - 1) {
                                                nextSurah = SURAHS[surahIndex + 1];
                                                nextStartAyah = 1;
                                              }

                                              nextHomework = {
                                                mode: 'ayah',
                                                surah: nextSurah,
                                                fromSurah: nextSurah,
                                                from: toHindiDigits(nextStartAyah),
                                                to: ''
                                              };
                                            }
                                          }
                                        }

                                        const newState = {
                                          ...prev,
                                          [studentId]: {
                                            ...prev[studentId],
                                            readingNew: {
                                              ...prev[studentId]?.readingNew,
                                              toAyah: finalVal
                                            }
                                          }
                                        };

                                        if (nextHomework && !isRedoMode) {
                                          newState[studentId].homeworkNew = {
                                            ...newState[studentId]?.homeworkNew,
                                            ...nextHomework
                                          };

                                          // Chain: Revision "to" = New "from" - 1
                                          if (nextHomework.from) {
                                            const hwFromWestern = parseInt(toEnglish(nextHomework.from));
                                            if (!isNaN(hwFromWestern)) {
                                              let revTo: string;
                                              let revToSurah: string;
                                              const hwSurah = nextHomework.fromSurah || nextHomework.surah;

                                              if (hwFromWestern <= 1) {
                                                const idx = SURAHS.indexOf(hwSurah);
                                                if (idx > 0) {
                                                  revToSurah = SURAHS[idx - 1];
                                                  revTo = toHindiDigits(String(SURAH_AYAH_COUNTS[idx - 1]));
                                                } else {
                                                  revToSurah = hwSurah;
                                                  revTo = '';
                                                }
                                              } else {
                                                revToSurah = hwSurah;
                                                revTo = toHindiDigits(String(hwFromWestern - 1));
                                              }

                                              newState[studentId].homeworkRev = {
                                                ...newState[studentId]?.homeworkRev,
                                                to: revTo,
                                                toSurah: revToSurah,
                                              };
                                            }
                                          }
                                        }

                                        return newState;
                                      });
                                    }}
                                    style={{}}
                                    className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['quran-new-to-ayah'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Toggle Button */}
                            <div className="flex justify-center relative z-10">
                              <button
                                onClick={() => setActiveAdvancedAyah(prev => {
                                  const nextVal = !prev.readingNew;
                                  const next = { ...prev, readingNew: nextVal, homeworkNew: nextVal };
                                  setLastReports(lastPrev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return lastPrev;
                                    return {
                                      ...lastPrev,
                                      [studentId]: {
                                        ...lastPrev[studentId],
                                        readingNew: {
                                          ...lastPrev[studentId]?.readingNew,
                                          isAdvancedAyah: nextVal
                                        },
                                        homeworkNew: {
                                          ...lastPrev[studentId]?.homeworkNew,
                                          isAdvancedAyah: nextVal
                                        }
                                      }
                                    };
                                  });
                                  return next;
                                })}
                                className={`p-1 rounded-full border shadow-sm transition-all ${activeAdvancedAyah.readingNew ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-gray-200 text-gray-400 hover:text-indigo-500'}`}
                                title={activeAdvancedAyah.readingNew ? "إلغاء الوضع المتقدم" : "تفعيل الوضع المتقدم (من سورة إلى سورة)"}
                              >
                                {activeAdvancedAyah.readingNew ? <Minus size={14} /> : <Plus size={14} />}
                              </button>
                            </div>
                          </div>

                          {/* New Surah Inputs */}
                          <div id="quran-new-inputs-surah" className={`flex gap-3 items-end ${preferredModes.readingNew === 'surah' ? '' : 'hidden'} ${prevReportHadExclusion ? 'opacity-40 blur-[1px] pointer-events-none' : ''}`}>
                            <div className="flex-1">
                              <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">من سورة</label>
                              <SearchableSurahSelect
                                id="quran-new-from-surah"
                                value={lastReport?.readingNew?.fromSurah || lastReport?.homeworkNew?.fromSurah || SURAHS[0]}
                                surahs={SURAHS}
                                onChange={(val) => {
                                  setLastReports(prev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return prev;
                                    return {
                                      ...prev,
                                      [studentId]: {
                                        ...prev[studentId],
                                        readingNew: {
                                          ...prev[studentId]?.readingNew,
                                          fromSurah: val
                                        }
                                      }
                                    };
                                  });
                                }}
                              />
                            </div>
                            <div className="flex-1">
                              <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">إلى سورة</label>
                              <SearchableSurahSelect
                                id="quran-new-to-surah"
                                value={lastReport?.readingNew?.toSurah || lastReport?.homeworkNew?.toSurah || SURAHS[0]}
                                surahs={SURAHS}
                                onChange={(val) => {
                                  setLastReports(prev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return prev;
                                    return {
                                      ...prev,
                                      [studentId]: {
                                        ...prev[studentId],
                                        readingNew: {
                                          ...prev[studentId]?.readingNew,
                                          toSurah: val
                                        }
                                      }
                                    };
                                  });
                                }}
                              />
                            </div>
                          </div>

                          {/* New Page Inputs */}
                          <div id="quran-new-inputs-page" className={`grid grid-cols-2 gap-3 ${preferredModes.readingNew === 'page' ? '' : 'hidden'} ${prevReportHadExclusion ? 'opacity-40 blur-[1px] pointer-events-none' : ''}`}>
                            <div>
                              <label className="block text-lg font-medium text-gray-700 mb-1 font-arabic">من صفحة</label>
                              <input
                                id="quran-new-from-page"
                                onFocus={handleFocus}
                                onPointerDown={() => handleInputPointerDown('quran-new-from-page')}
                                onPointerUp={handleInputPointerUp}
                                onPointerLeave={handleInputPointerUp}
                                type="text"
                                inputMode="numeric"
                                value={toHindiDigits(lastReport?.readingNew?.fromPage ?? '')}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
                                  setLastReports(prev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return prev;
                                    return {
                                      ...prev,
                                      [studentId]: {
                                        ...prev[studentId],
                                        readingNew: {
                                          ...prev[studentId]?.readingNew,
                                          fromPage: val
                                        }
                                      }
                                    };
                                  });
                                }}
                                className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['quran-new-from-page'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                              />
                            </div>
                            <div>
                              <label className="block text-lg font-medium text-gray-700 mb-1 font-arabic">إلى صفحة</label>
                              <input
                                id="quran-new-to-page"
                                onFocus={handleFocus}
                                onPointerDown={() => handleInputPointerDown('quran-new-to-page')}
                                onPointerUp={handleInputPointerUp}
                                onPointerLeave={handleInputPointerUp}
                                type="text"
                                inputMode="numeric"
                                value={toHindiDigits(lastReport?.readingNew?.toPage ?? '')}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);

                                  // Auto-Advance Calculation
                                  let nextHwStart = '';
                                  if (val) {
                                    const pageNum = parseInt(val.replace(/[٠-٩]/g, (d) => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]));
                                    if (!isNaN(pageNum)) {
                                      nextHwStart = toHindiDigits(pageNum + 1);
                                    }
                                  }

                                  setLastReports(prev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return prev;

                                    const newState = {
                                      ...prev,
                                      [studentId]: {
                                        ...prev[studentId],
                                        readingNew: {
                                          ...prev[studentId]?.readingNew,
                                          toPage: val
                                        }
                                      }
                                    };

                                    // If Auto-Advance triggered, update Homework New in State
                                    if (nextHwStart) {
                                      newState[studentId].homeworkNew = {
                                        ...newState[studentId].homeworkNew,
                                        from: nextHwStart,
                                        to: '' // Clear To field
                                      };
                                    }

                                    return newState;
                                  });
                                }}
                                className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['quran-new-to-page'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* 2. Revision Section (المراجعة) - Default hidden inputs, but section visible */}
                    <div className={`space-y-3 pt-4 border-t border-black/30 transition-opacity duration-200 lg:col-start-1 lg:row-start-3 ${!sectionToggles.readingRev ? 'opacity-40' : ''}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSectionToggles(prev => {
                              const next = { ...prev, readingRev: !prev.readingRev };
                              setLastReports(lastPrev => {
                                const studentId = smartReportModal?.studentId;
                                if (!studentId) return lastPrev;
                                return {
                                  ...lastPrev,
                                  [studentId]: {
                                    ...lastPrev[studentId],
                                    sectionToggles: next
                                  }
                                };
                              });
                              return next;
                            })}
                            className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${sectionToggles.readingRev ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 bg-white'}`}
                          >
                            {sectionToggles.readingRev && <Check size={14} strokeWidth={3} />}
                          </button>
                          <h3 className="text-2xl font-bold text-gray-700 font-arabic">المراجعة</h3>
                        </div>
                        <div className={`flex gap-1 p-1 bg-gray-100 rounded-lg ${!sectionToggles.readingRev ? 'hidden' : ''}`}>
                          <button
                            id="quran-rev-mode-ayah"
                            onClick={() => {
                              setPreferredModes(prev => ({ ...prev, readingRev: 'ayah', homeworkRev: 'ayah' }));
                              setLastReports(prev => {
                                const studentId = smartReportModal?.studentId;
                                if (!studentId) return prev;
                                return {
                                  ...prev,
                                  [studentId]: {
                                    ...prev[studentId],
                                    readingRev: { ...prev[studentId]?.readingRev, mode: 'ayah' },
                                    homeworkRev: { ...prev[studentId]?.homeworkRev, mode: 'ayah' }
                                  }
                                };
                              });
                            }}
                            className={`px-2 py-1 rounded-md text-xs font-arabic font-bold transition-all ${preferredModes.readingRev === 'ayah' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500'}`}
                          >
                            آيات
                          </button>
                          <button
                            id="quran-rev-mode-page"
                            onClick={() => {
                              setPreferredModes(prev => ({ ...prev, readingRev: 'page', homeworkRev: 'page' }));
                              setLastReports(prev => {
                                const studentId = smartReportModal?.studentId;
                                if (!studentId) return prev;
                                return {
                                  ...prev,
                                  [studentId]: {
                                    ...prev[studentId],
                                    readingRev: { ...prev[studentId]?.readingRev, mode: 'page' },
                                    homeworkRev: { ...prev[studentId]?.homeworkRev, mode: 'page' }
                                  }
                                };
                              });
                            }}
                            className={`px-2 py-1 rounded-md text-xs font-arabic font-bold transition-all ${preferredModes.readingRev === 'page' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500'}`}
                          >
                            صفحات
                          </button>
                          <button
                            id="quran-rev-mode-juz"
                            onClick={() => {
                              setPreferredModes(prev => ({ ...prev, readingRev: 'juz', homeworkRev: 'juz' }));
                              setLastReports(prev => {
                                const studentId = smartReportModal?.studentId;
                                if (!studentId) return prev;
                                return {
                                  ...prev,
                                  [studentId]: {
                                    ...prev[studentId],
                                    readingRev: { ...prev[studentId]?.readingRev, mode: 'juz' },
                                    homeworkRev: { ...prev[studentId]?.homeworkRev, mode: 'juz' }
                                  }
                                };
                              });
                            }}
                            className={`px-2 py-1 rounded-md text-xs font-arabic font-bold transition-all ${preferredModes.readingRev === 'juz' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500'}`}
                          >
                            أجزاء
                          </button>
                          <button
                            id="quran-rev-mode-hizb"
                            onClick={() => {
                              setPreferredModes(prev => ({ ...prev, readingRev: 'hizb', homeworkRev: 'hizb' }));
                              setLastReports(prev => {
                                const studentId = smartReportModal?.studentId;
                                if (!studentId) return prev;
                                return {
                                  ...prev,
                                  [studentId]: {
                                    ...prev[studentId],
                                    readingRev: { ...prev[studentId]?.readingRev, mode: 'hizb' },
                                    homeworkRev: { ...prev[studentId]?.homeworkRev, mode: 'hizb' }
                                  }
                                };
                              });
                            }}
                            className={`px-2 py-1 rounded-md text-xs font-arabic font-bold transition-all ${preferredModes.readingRev === 'hizb' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500'}`}
                          >
                            أحزاب
                          </button>
                        </div>
                      </div>

                      {sectionToggles.readingRev && (
                        <>
                          <div className="flex items-center gap-5 mb-4 flex-wrap">
                            <label className="flex items-center gap-1.5 cursor-pointer hover:bg-white/50 p-1 rounded-md transition-colors">
                              <input
                                type="checkbox"
                                checked={excludeReadingRev}
                                onChange={(e) => setExcludeReadingRev(e.target.checked)}
                                className="w-3.5 h-3.5 text-amber-500 rounded border-gray-300 focus:ring-amber-500"
                              />
                              <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                                {excludeReadingRev ? <EyeOff size={14} /> : <Eye size={14} />}
                                إخفاء من التقرير
                              </span>
                            </label>
                          </div>
                          {/* Rev Ayah Inputs (Compact with Advanced Toggle) */}
                          <div id="quran-rev-inputs-ayah-container" className={`${preferredModes.readingRev === 'ayah' ? 'flex flex-col gap-3' : 'hidden'}`}>
                            {/* Row 1 */}
                            <div className="flex gap-3 items-end">
                              <div className="flex-[2]">
                                <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">
                                  {activeAdvancedAyah.readingRev ? 'من سورة' : 'السورة'}
                                </label>
                                <SearchableSurahSelect
                                  id="quran-rev-surah-select"
                                  value={lastReport?.readingRev?.surah || lastReport?.homeworkRev?.surah || savedProgress?.surah || SURAHS[0]}
                                  surahs={SURAHS}
                                  onChange={(val) => {
                                    setLastReports(prev => {
                                      const studentId = smartReportModal?.studentId;
                                      if (!studentId) return prev;
                                      return {
                                        ...prev,
                                        [studentId]: {
                                          ...prev[studentId],
                                          readingRev: {
                                            ...prev[studentId]?.readingRev,
                                            surah: val
                                          }
                                        }
                                      };
                                    });
                                  }}
                                />
                              </div>
                              <div className="flex-1">
                                <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">من الآية</label>
                                <input
                                  id="quran-rev-from-ayah"
                                  onPointerDown={() => handleInputPointerDown('quran-rev-from-ayah')}
                                  onPointerUp={handleInputPointerUp}
                                  onPointerLeave={handleInputPointerUp}
                                  onFocus={handleFocus}
                                  type="text"
                                  inputMode="numeric"
                                  value={toHindiDigits(lastReport?.readingRev?.fromAyah ?? '')}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
                                    setLastReports(prev => {
                                      const studentId = smartReportModal?.studentId;
                                      if (!studentId) return prev;
                                      return {
                                        ...prev,
                                        [studentId]: {
                                          ...prev[studentId],
                                          readingRev: {
                                            ...prev[studentId]?.readingRev,
                                            fromAyah: val
                                          }
                                        }
                                      };
                                    });
                                  }}
                                  style={{}}
                                  className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['quran-rev-from-ayah'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                                />
                              </div>

                              {!activeAdvancedAyah.readingRev && (
                                <div className="flex-1">
                                  <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">إلى الآية</label>
                                  <input
                                    id="quran-rev-to-ayah"
                                    onFocus={handleFocus}
                                    onPointerDown={() => handleInputPointerDown('quran-rev-to-ayah')}
                                    onPointerUp={handleInputPointerUp}
                                    onPointerLeave={handleInputPointerUp}
                                    type="text"
                                    inputMode="numeric"
                                    value={toHindiDigits(lastReport?.readingRev?.toAyah ?? '')}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);

                                      // Strict Capping & Auto-Advance Logic
                                      setLastReports(prev => {
                                        const studentId = smartReportModal?.studentId;
                                        if (!studentId) return prev;

                                        const prevReadingRev = prev[studentId]?.readingRev;
                                        // STRICT Check: Only use toSurah if in Advanced Mode
                                        const isAdvanced = activeAdvancedAyah.readingRev;
                                        const currentSurah = (isAdvanced ? prevReadingRev?.toSurah : prevReadingRev?.surah) || SURAHS[0];

                                        let finalVal = val;
                                        let nextHomework = null;

                                        if (val) {
                                          const endAyahNum = parseInt(val.replace(/[٠-٩]/g, (d) => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]));
                                          if (!isNaN(endAyahNum)) {
                                            const surahIndex = SURAHS.indexOf(currentSurah);

                                            if (surahIndex !== -1) {
                                              const totalAyahs = SURAH_AYAH_COUNTS[surahIndex];

                                              // Check Capping
                                              let validatedAyahNum = endAyahNum;
                                              if (endAyahNum > totalAyahs) {
                                                validatedAyahNum = totalAyahs;
                                                finalVal = toHindiDigits(totalAyahs);
                                              }

                                              // Calculate Auto-Advance
                                              let nextSurah = currentSurah;
                                              let nextStartAyah = validatedAyahNum + 1;

                                              if (validatedAyahNum >= totalAyahs && surahIndex < SURAHS.length - 1) {
                                                nextSurah = SURAHS[surahIndex + 1];
                                                nextStartAyah = 1;
                                              }

                                              nextHomework = {
                                                mode: 'ayah',
                                                surah: nextSurah,
                                                from: toHindiDigits(nextStartAyah),
                                                to: ''
                                              };
                                            }
                                          }
                                        }

                                        const newState = {
                                          ...prev,
                                          [studentId]: {
                                            ...prev[studentId],
                                            readingRev: {
                                              ...prev[studentId]?.readingRev,
                                              toAyah: finalVal
                                            }
                                          }
                                        };

                                        if (nextHomework) {
                                          newState[studentId].homeworkRev = {
                                            ...newState[studentId]?.homeworkRev,
                                            ...nextHomework
                                          };
                                        }

                                        return newState;
                                      });
                                    }}
                                    style={{}}
                                    className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['quran-rev-to-ayah'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                                  />
                                </div>
                              )}
                            </div>

                            {/* Row 2 Advanced */}
                            {activeAdvancedAyah.readingRev && (
                              <div className="flex gap-3 items-end">
                                <div className="flex-[2]">
                                  <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">إلى سورة</label>
                                  <SearchableSurahSelect
                                    id="quran-rev-to-surah-advanced"
                                    value={lastReport?.readingRev?.toSurah || lastReport?.homeworkRev?.toSurah || SURAHS[0]}
                                    surahs={SURAHS}
                                    onChange={(val) => {
                                      setLastReports(prev => {
                                        const studentId = smartReportModal?.studentId;
                                        if (!studentId) return prev;
                                        return {
                                          ...prev,
                                          [studentId]: {
                                            ...prev[studentId],
                                            readingRev: {
                                              ...prev[studentId]?.readingRev,
                                              toSurah: val
                                            }
                                          }
                                        };
                                      });
                                    }}
                                  />
                                </div>
                                <div className="flex-1">
                                  <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">إلى الآية</label>
                                  <input
                                    id="quran-rev-to-ayah"
                                    onFocus={handleFocus}
                                    onPointerDown={() => handleInputPointerDown('quran-rev-to-ayah')}
                                    onPointerUp={handleInputPointerUp}
                                    onPointerLeave={handleInputPointerUp}
                                    type="text"
                                    inputMode="numeric"
                                    value={toHindiDigits(lastReport?.readingRev?.toAyah ?? '')}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);

                                      // Auto-Update State with Logic
                                      setLastReports(prev => {
                                        const studentId = smartReportModal?.studentId;
                                        if (!studentId) return prev;

                                        let finalVal = val;
                                        let nextHomework = null;

                                        if (val) {
                                          const endAyahNum = parseInt(val.replace(/[٠-٩]/g, (d) => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]));
                                          if (!isNaN(endAyahNum)) {
                                            // Use toSurah for Advanced Mode
                                            const currentSurah = lastReport?.readingRev?.toSurah || lastReport?.readingRev?.surah || SURAHS[0];
                                            const surahIndex = SURAHS.indexOf(currentSurah);

                                            if (surahIndex !== -1) {
                                              const totalAyahs = SURAH_AYAH_COUNTS[surahIndex];

                                              // Capping
                                              let validatedAyahNum = endAyahNum;
                                              if (endAyahNum > totalAyahs) {
                                                validatedAyahNum = totalAyahs;
                                                finalVal = toHindiDigits(totalAyahs);
                                              }

                                              // Auto-Advance
                                              let nextSurah = currentSurah;
                                              let nextStartAyah = validatedAyahNum + 1;

                                              if (validatedAyahNum >= totalAyahs && surahIndex < SURAHS.length - 1) {
                                                nextSurah = SURAHS[surahIndex + 1];
                                                nextStartAyah = 1;
                                              }

                                              nextHomework = {
                                                mode: 'ayah',
                                                surah: nextSurah,
                                                from: toHindiDigits(nextStartAyah),
                                                to: ''
                                              };
                                            }
                                          }
                                        }

                                        const newState = {
                                          ...prev,
                                          [studentId]: {
                                            ...prev[studentId],
                                            readingRev: {
                                              ...prev[studentId]?.readingRev,
                                              toAyah: finalVal
                                            }
                                          }
                                        };

                                        if (nextHomework) {
                                          newState[studentId].homeworkRev = {
                                            ...newState[studentId]?.homeworkRev,
                                            ...nextHomework
                                          };
                                        }
                                        return newState;
                                      });
                                    }}
                                    style={{}}
                                    className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['quran-rev-to-ayah'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Toggle */}
                            <div className="flex justify-center relative z-10">
                              <button
                                onClick={() => setActiveAdvancedAyah(prev => {
                                  const nextVal = !prev.readingRev;
                                  const next = { ...prev, readingRev: nextVal, homeworkRev: nextVal };
                                  setLastReports(lastPrev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return lastPrev;
                                    return {
                                      ...lastPrev,
                                      [studentId]: {
                                        ...lastPrev[studentId],
                                        readingRev: {
                                          ...lastPrev[studentId]?.readingRev,
                                          isAdvancedAyah: nextVal
                                        },
                                        homeworkRev: {
                                          ...lastPrev[studentId]?.homeworkRev,
                                          isAdvancedAyah: nextVal
                                        }
                                      }
                                    };
                                  });
                                  return next;
                                })}
                                className={`p-1 rounded-full border shadow-sm transition-all ${activeAdvancedAyah.readingRev ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-gray-200 text-gray-400 hover:text-indigo-500'}`}
                                title={activeAdvancedAyah.readingRev ? "إلغاء الوضع المتقدم" : "تفعيل الوضع المتقدم"}
                              >
                                {activeAdvancedAyah.readingRev ? <Minus size={14} /> : <Plus size={14} />}
                              </button>
                            </div>
                          </div>

                          {/* Rev Surah Inputs */}
                          <div id="quran-rev-inputs-surah" className={`flex gap-3 items-end ${preferredModes.readingRev === 'surah' ? '' : 'hidden'}`}>
                            <div className="flex-1">
                              <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">من سورة</label>
                              <SearchableSurahSelect
                                id="quran-rev-from-surah"
                                value={lastReport?.readingRev?.fromSurah || lastReport?.homeworkRev?.fromSurah || SURAHS[0]}
                                surahs={SURAHS}
                                onChange={(val) => {
                                  setLastReports(prev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return prev;
                                    return {
                                      ...prev,
                                      [studentId]: {
                                        ...prev[studentId],
                                        readingRev: {
                                          ...prev[studentId]?.readingRev,
                                          fromSurah: val
                                        }
                                      }
                                    };
                                  });
                                }}
                              />
                            </div>
                            <div className="flex-1">
                              <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">إلى سورة</label>
                              <SearchableSurahSelect
                                id="quran-rev-to-surah"
                                value={lastReport?.readingRev?.toSurah || lastReport?.homeworkRev?.toSurah || SURAHS[0]}
                                surahs={SURAHS}
                                onChange={(val) => {
                                  setLastReports(prev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return prev;
                                    return {
                                      ...prev,
                                      [studentId]: {
                                        ...prev[studentId],
                                        readingRev: {
                                          ...prev[studentId]?.readingRev,
                                          toSurah: val
                                        }
                                      }
                                    };
                                  });
                                }}
                              />
                            </div>
                          </div>

                          {/* Rev Page Inputs - Default visible for Revision as it's common */}
                          <div id="quran-rev-inputs-page" className={`grid grid-cols-2 gap-3 ${preferredModes.readingRev === 'page' ? '' : 'hidden'}`}>
                            <div>
                              <label className="block text-lg font-medium text-gray-700 mb-1 font-arabic">من صفحة</label>
                              <input
                                id="quran-rev-from-page"
                                onFocus={handleFocus}
                                onPointerDown={() => handleInputPointerDown('quran-rev-from-page')}
                                onPointerUp={handleInputPointerUp}
                                onPointerLeave={handleInputPointerUp}
                                type="text"
                                inputMode="numeric"
                                value={toHindiDigits(lastReport?.readingRev?.fromPage ?? '')}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
                                  setLastReports(prev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return prev;
                                    return {
                                      ...prev,
                                      [studentId]: {
                                        ...prev[studentId],
                                        readingRev: {
                                          ...prev[studentId]?.readingRev,
                                          fromPage: val
                                        }
                                      }
                                    };
                                  });
                                }}
                                className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['quran-rev-from-page'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                              />
                            </div>
                            <div>
                              <label className="block text-lg font-medium text-gray-700 mb-1 font-arabic">إلى صفحة</label>
                              <input
                                id="quran-rev-to-page"
                                onFocus={handleFocus}
                                onPointerDown={() => handleInputPointerDown('quran-rev-to-page')}
                                onPointerUp={handleInputPointerUp}
                                onPointerLeave={handleInputPointerUp}
                                type="text"
                                inputMode="numeric"
                                value={toHindiDigits(lastReport?.readingRev?.toPage ?? '')}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);

                                  // Auto-Advance Next Homework Start Page
                                  if (val) {
                                    const pageNum = parseInt(val.replace(/[٠-٩]/g, (d) => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]));
                                    if (!isNaN(pageNum)) {
                                      const nextStartPage = pageNum + 1;

                                      // Update DOM Input directly for immediate feedback
                                      const hwFromInput = document.getElementById('hw-rev-from') as HTMLInputElement;
                                      if (hwFromInput) {
                                        hwFromInput.value = toHindiDigits(nextStartPage);
                                      }

                                      // Update State (will trigger re-render)
                                      setLastReports(prev => {
                                        const studentId = smartReportModal?.studentId;
                                        if (!studentId) return prev;
                                        return {
                                          ...prev,
                                          [studentId]: {
                                            ...prev[studentId],
                                            // Update Reading as usual
                                            readingRev: {
                                              ...prev[studentId]?.readingRev,
                                              toPage: val
                                            },
                                            // Auto-update Homework From Page
                                            homeworkRev: {
                                              ...prev[studentId]?.homeworkRev,
                                              from: toHindiDigits(nextStartPage)
                                            }
                                          }
                                        };
                                      });
                                      return; // Skip the default setState below since we handled it
                                    }
                                  }

                                  setLastReports(prev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return prev;
                                    return {
                                      ...prev,
                                      [studentId]: {
                                        ...prev[studentId],
                                        readingRev: {
                                          ...prev[studentId]?.readingRev,
                                          toPage: val
                                        }
                                      }
                                    };
                                  });
                                }}
                                className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['quran-rev-to-page'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                              />
                            </div>
                          </div>

                          {/* Rev Juz Inputs */}
                          <div id="quran-rev-inputs-juz" className={`grid grid-cols-2 gap-3 ${preferredModes.readingRev === 'juz' ? '' : 'hidden'}`}>
                            <div>
                              <label className="block text-lg font-medium text-gray-700 mb-1 font-arabic">من جزء</label>
                              <input
                                id="quran-rev-from-juz"
                                onFocus={handleFocus}
                                onPointerDown={() => handleInputPointerDown('quran-rev-from-juz')}
                                onPointerUp={handleInputPointerUp}
                                onPointerLeave={handleInputPointerUp}
                                type="text"
                                inputMode="numeric"
                                value={toHindiDigits(lastReport?.readingRev?.fromJuz ?? '')}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
                                  setLastReports(prev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return prev;
                                    return {
                                      ...prev,
                                      [studentId]: {
                                        ...prev[studentId],
                                        readingRev: {
                                          ...prev[studentId]?.readingRev,
                                          fromJuz: val
                                        }
                                      }
                                    };
                                  });
                                }}
                                className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['quran-rev-from-juz'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                              />
                            </div>
                            <div>
                              <label className="block text-lg font-medium text-gray-700 mb-1 font-arabic">إلى جزء</label>
                              <input
                                id="quran-rev-to-juz"
                                onFocus={handleFocus}
                                onPointerDown={() => handleInputPointerDown('quran-rev-to-juz')}
                                onPointerUp={handleInputPointerUp}
                                onPointerLeave={handleInputPointerUp}
                                type="text"
                                inputMode="numeric"
                                value={toHindiDigits(lastReport?.readingRev?.toJuz ?? '')}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
                                  setLastReports(prev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return prev;
                                    return {
                                      ...prev,
                                      [studentId]: {
                                        ...prev[studentId],
                                        readingRev: {
                                          ...prev[studentId]?.readingRev,
                                          toJuz: val
                                        }
                                      }
                                    };
                                  });
                                }}
                                className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['quran-rev-to-juz'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                              />
                            </div>
                          </div>

                          {/* Rev Hizb Inputs */}
                          <div id="quran-rev-inputs-hizb" className={`grid grid-cols-2 gap-3 ${preferredModes.readingRev === 'hizb' ? '' : 'hidden'}`}>
                            <div>
                              <label className="block text-lg font-medium text-gray-700 mb-1 font-arabic">من حزب</label>
                              <input
                                id="quran-rev-from-hizb"
                                onFocus={handleFocus}
                                onPointerDown={() => handleInputPointerDown('quran-rev-from-hizb')}
                                onPointerUp={handleInputPointerUp}
                                onPointerLeave={handleInputPointerUp}
                                type="text"
                                inputMode="numeric"
                                value={toHindiDigits(lastReport?.readingRev?.fromHizb ?? '')}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
                                  setLastReports(prev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return prev;
                                    return {
                                      ...prev,
                                      [studentId]: {
                                        ...prev[studentId],
                                        readingRev: {
                                          ...prev[studentId]?.readingRev,
                                          fromHizb: val
                                        }
                                      }
                                    };
                                  });
                                }}
                                className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['quran-rev-from-hizb'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                              />
                            </div>
                            <div>
                              <label className="block text-lg font-medium text-gray-700 mb-1 font-arabic">إلى حزب</label>
                              <input
                                id="quran-rev-to-hizb"
                                onFocus={handleFocus}
                                onPointerDown={() => handleInputPointerDown('quran-rev-to-hizb')}
                                onPointerUp={handleInputPointerUp}
                                onPointerLeave={handleInputPointerUp}
                                type="text"
                                inputMode="numeric"
                                value={toHindiDigits(lastReport?.readingRev?.toHizb ?? '')}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
                                  setLastReports(prev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return prev;
                                    return {
                                      ...prev,
                                      [studentId]: {
                                        ...prev[studentId],
                                        readingRev: {
                                          ...prev[studentId]?.readingRev,
                                          toHizb: val
                                        }
                                      }
                                    };
                                  });
                                }}
                                className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['quran-rev-to-hizb'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>


                    {/* 2.5. Old Revision Section (المراجعة البعيدة) - Default hidden inputs, but section visible */}
                    <div className={`space-y-3 pt-4 border-t border-black/30 transition-opacity duration-200 lg:col-start-1 lg:row-start-4 ${!sectionToggles.readingOldRev ? 'opacity-40' : ''}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSectionToggles(prev => {
                              const next = { ...prev, readingOldRev: !prev.readingOldRev };
                              setLastReports(lastPrev => {
                                const studentId = smartReportModal?.studentId;
                                if (!studentId) return lastPrev;
                                return {
                                  ...lastPrev,
                                  [studentId]: {
                                    ...lastPrev[studentId],
                                    sectionToggles: next
                                  }
                                };
                              });
                              return next;
                            })}
                            className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${sectionToggles.readingOldRev ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 bg-white'}`}
                          >
                            {sectionToggles.readingOldRev && <Check size={14} strokeWidth={3} />}
                          </button>
                          <h3 className="text-2xl font-bold text-gray-700 font-arabic">المراجعة البعيدة</h3>
                        </div>
                        <div className={`flex gap-1 p-1 bg-gray-100 rounded-lg ${!sectionToggles.readingOldRev ? 'hidden' : ''}`}>
                          <button
                            id="quran-oldrev-mode-ayah"
                            onClick={() => {
                              setPreferredModes(prev => ({ ...prev, readingOldRev: 'ayah', homeworkOldRev: 'ayah' }));
                              setLastReports(prev => {
                                const studentId = smartReportModal?.studentId;
                                if (!studentId) return prev;
                                return {
                                  ...prev,
                                  [studentId]: {
                                    ...prev[studentId],
                                    readingOldRev: { ...prev[studentId]?.readingOldRev, mode: 'ayah' },
                                    homeworkOldRev: { ...prev[studentId]?.homeworkOldRev, mode: 'ayah' }
                                  }
                                };
                              });
                            }}
                            className={`px-2 py-1 rounded-md text-xs font-arabic font-bold transition-all ${preferredModes.readingOldRev === 'ayah' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500'}`}
                          >
                            آيات
                          </button>
                          <button
                            id="quran-oldrev-mode-page"
                            onClick={() => {
                              setPreferredModes(prev => ({ ...prev, readingOldRev: 'page', homeworkOldRev: 'page' }));
                              setLastReports(prev => {
                                const studentId = smartReportModal?.studentId;
                                if (!studentId) return prev;
                                return {
                                  ...prev,
                                  [studentId]: {
                                    ...prev[studentId],
                                    readingOldRev: { ...prev[studentId]?.readingOldRev, mode: 'page' },
                                    homeworkOldRev: { ...prev[studentId]?.homeworkOldRev, mode: 'page' }
                                  }
                                };
                              });
                            }}
                            className={`px-2 py-1 rounded-md text-xs font-arabic font-bold transition-all ${preferredModes.readingOldRev === 'page' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500'}`}
                          >
                            صفحات
                          </button>
                          <button
                            id="quran-oldrev-mode-juz"
                            onClick={() => {
                              setPreferredModes(prev => ({ ...prev, readingOldRev: 'juz', homeworkOldRev: 'juz' }));
                              setLastReports(prev => {
                                const studentId = smartReportModal?.studentId;
                                if (!studentId) return prev;
                                return {
                                  ...prev,
                                  [studentId]: {
                                    ...prev[studentId],
                                    readingOldRev: { ...prev[studentId]?.readingOldRev, mode: 'juz' },
                                    homeworkOldRev: { ...prev[studentId]?.homeworkOldRev, mode: 'juz' }
                                  }
                                };
                              });
                            }}
                            className={`px-2 py-1 rounded-md text-xs font-arabic font-bold transition-all ${preferredModes.readingOldRev === 'juz' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500'}`}
                          >
                            أجزاء
                          </button>
                          <button
                            id="quran-oldrev-mode-hizb"
                            onClick={() => {
                              setPreferredModes(prev => ({ ...prev, readingOldRev: 'hizb', homeworkOldRev: 'hizb' }));
                              setLastReports(prev => {
                                const studentId = smartReportModal?.studentId;
                                if (!studentId) return prev;
                                return {
                                  ...prev,
                                  [studentId]: {
                                    ...prev[studentId],
                                    readingOldRev: { ...prev[studentId]?.readingOldRev, mode: 'hizb' },
                                    homeworkOldRev: { ...prev[studentId]?.homeworkOldRev, mode: 'hizb' }
                                  }
                                };
                              });
                            }}
                            className={`px-2 py-1 rounded-md text-xs font-arabic font-bold transition-all ${preferredModes.readingOldRev === 'hizb' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500'}`}
                          >
                            أحزاب
                          </button>
                        </div>
                      </div>

                      {sectionToggles.readingOldRev && (
                        <>
                          <div className="flex items-center gap-5 mb-4 flex-wrap">
                            <label className="flex items-center gap-1.5 cursor-pointer hover:bg-white/50 p-1 rounded-md transition-colors">
                              <input
                                type="checkbox"
                                checked={excludeReadingOldRev}
                                onChange={(e) => setExcludeReadingOldRev(e.target.checked)}
                                className="w-3.5 h-3.5 text-amber-500 rounded border-gray-300 focus:ring-amber-500"
                              />
                              <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                                {excludeReadingOldRev ? <EyeOff size={14} /> : <Eye size={14} />}
                                إخفاء من التقرير
                              </span>
                            </label>
                          </div>
                          {/* Rev Ayah Inputs (Compact with Advanced Toggle) */}
                          <div id="quran-oldrev-inputs-ayah-container" className={`${preferredModes.readingOldRev === 'ayah' ? 'flex flex-col gap-3' : 'hidden'}`}>
                            {/* Row 1 */}
                            <div className="flex gap-3 items-end">
                              <div className="flex-[2]">
                                <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">
                                  {activeAdvancedAyah.readingOldRev ? 'من سورة' : 'السورة'}
                                </label>
                                <SearchableSurahSelect
                                  id="quran-oldrev-surah-select"
                                  value={lastReport?.readingOldRev?.surah || lastReport?.homeworkOldRev?.surah || savedProgress?.surah || SURAHS[0]}
                                  surahs={SURAHS}
                                  onChange={(val) => {
                                    setLastReports(prev => {
                                      const studentId = smartReportModal?.studentId;
                                      if (!studentId) return prev;
                                      return {
                                        ...prev,
                                        [studentId]: {
                                          ...prev[studentId],
                                          readingOldRev: {
                                            ...prev[studentId]?.readingOldRev,
                                            surah: val
                                          }
                                        }
                                      };
                                    });
                                  }}
                                />
                              </div>
                              <div className="flex-1">
                                <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">من الآية</label>
                                <input
                                  id="quran-oldrev-from-ayah"
                                  onPointerDown={() => handleInputPointerDown('quran-oldrev-from-ayah')}
                                  onPointerUp={handleInputPointerUp}
                                  onPointerLeave={handleInputPointerUp}
                                  onFocus={handleFocus}
                                  type="text"
                                  inputMode="numeric"
                                  value={toHindiDigits(lastReport?.readingOldRev?.fromAyah ?? '')}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
                                    setLastReports(prev => {
                                      const studentId = smartReportModal?.studentId;
                                      if (!studentId) return prev;
                                      return {
                                        ...prev,
                                        [studentId]: {
                                          ...prev[studentId],
                                          readingOldRev: {
                                            ...prev[studentId]?.readingOldRev,
                                            fromAyah: val
                                          }
                                        }
                                      };
                                    });
                                  }}
                                  style={{}}
                                  className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['quran-oldrev-from-ayah'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                                />
                              </div>

                              {!activeAdvancedAyah.readingOldRev && (
                                <div className="flex-1">
                                  <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">إلى الآية</label>
                                  <input
                                    id="quran-oldrev-to-ayah"
                                    onFocus={handleFocus}
                                    onPointerDown={() => handleInputPointerDown('quran-oldrev-to-ayah')}
                                    onPointerUp={handleInputPointerUp}
                                    onPointerLeave={handleInputPointerUp}
                                    type="text"
                                    inputMode="numeric"
                                    value={toHindiDigits(lastReport?.readingOldRev?.toAyah ?? '')}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);

                                      // Strict Capping & Auto-Advance Logic
                                      setLastReports(prev => {
                                        const studentId = smartReportModal?.studentId;
                                        if (!studentId) return prev;

                                        const prevReadingRev = prev[studentId]?.readingOldRev;
                                        // STRICT Check: Only use toSurah if in Advanced Mode
                                        const isAdvanced = activeAdvancedAyah.readingOldRev;
                                        const currentSurah = (isAdvanced ? prevReadingRev?.toSurah : prevReadingRev?.surah) || SURAHS[0];

                                        let finalVal = val;
                                        let nextHomework = null;

                                        if (val) {
                                          const endAyahNum = parseInt(val.replace(/[٠-٩]/g, (d) => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]));
                                          if (!isNaN(endAyahNum)) {
                                            const surahIndex = SURAHS.indexOf(currentSurah);

                                            if (surahIndex !== -1) {
                                              const totalAyahs = SURAH_AYAH_COUNTS[surahIndex];

                                              // Check Capping
                                              let validatedAyahNum = endAyahNum;
                                              if (endAyahNum > totalAyahs) {
                                                validatedAyahNum = totalAyahs;
                                                finalVal = toHindiDigits(totalAyahs);
                                              }

                                              // Calculate Auto-Advance
                                              let nextSurah = currentSurah;
                                              let nextStartAyah = validatedAyahNum + 1;

                                              if (validatedAyahNum >= totalAyahs && surahIndex < SURAHS.length - 1) {
                                                nextSurah = SURAHS[surahIndex + 1];
                                                nextStartAyah = 1;
                                              }

                                              nextHomework = {
                                                mode: 'ayah',
                                                surah: nextSurah,
                                                from: toHindiDigits(nextStartAyah),
                                                to: ''
                                              };
                                            }
                                          }
                                        }

                                        const newState = {
                                          ...prev,
                                          [studentId]: {
                                            ...prev[studentId],
                                            readingOldRev: {
                                              ...prev[studentId]?.readingOldRev,
                                              toAyah: finalVal
                                            }
                                          }
                                        };

                                        if (nextHomework) {
                                          newState[studentId].homeworkOldRev = {
                                            ...newState[studentId]?.homeworkOldRev,
                                            ...nextHomework
                                          };
                                        }

                                        return newState;
                                      });
                                    }}
                                    style={{}}
                                    className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['quran-oldrev-to-ayah'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                                  />
                                </div>
                              )}
                            </div>

                            {/* Row 2 Advanced */}
                            {activeAdvancedAyah.readingOldRev && (
                              <div className="flex gap-3 items-end">
                                <div className="flex-[2]">
                                  <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">إلى سورة</label>
                                  <SearchableSurahSelect
                                    id="quran-oldrev-to-surah-advanced"
                                    value={lastReport?.readingOldRev?.toSurah || lastReport?.homeworkOldRev?.toSurah || SURAHS[0]}
                                    surahs={SURAHS}
                                    onChange={(val) => {
                                      setLastReports(prev => {
                                        const studentId = smartReportModal?.studentId;
                                        if (!studentId) return prev;
                                        return {
                                          ...prev,
                                          [studentId]: {
                                            ...prev[studentId],
                                            readingOldRev: {
                                              ...prev[studentId]?.readingOldRev,
                                              toSurah: val
                                            }
                                          }
                                        };
                                      });
                                    }}
                                  />
                                </div>
                                <div className="flex-1">
                                  <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">إلى الآية</label>
                                  <input
                                    id="quran-oldrev-to-ayah"
                                    onFocus={handleFocus}
                                    onPointerDown={() => handleInputPointerDown('quran-oldrev-to-ayah')}
                                    onPointerUp={handleInputPointerUp}
                                    onPointerLeave={handleInputPointerUp}
                                    type="text"
                                    inputMode="numeric"
                                    value={toHindiDigits(lastReport?.readingOldRev?.toAyah ?? '')}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);

                                      // Auto-Update State with Logic
                                      setLastReports(prev => {
                                        const studentId = smartReportModal?.studentId;
                                        if (!studentId) return prev;

                                        let finalVal = val;
                                        let nextHomework = null;

                                        if (val) {
                                          const endAyahNum = parseInt(val.replace(/[٠-٩]/g, (d) => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]));
                                          if (!isNaN(endAyahNum)) {
                                            // Use toSurah for Advanced Mode
                                            const currentSurah = lastReport?.readingOldRev?.toSurah || lastReport?.readingOldRev?.surah || SURAHS[0];
                                            const surahIndex = SURAHS.indexOf(currentSurah);

                                            if (surahIndex !== -1) {
                                              const totalAyahs = SURAH_AYAH_COUNTS[surahIndex];

                                              // Capping
                                              let validatedAyahNum = endAyahNum;
                                              if (endAyahNum > totalAyahs) {
                                                validatedAyahNum = totalAyahs;
                                                finalVal = toHindiDigits(totalAyahs);
                                              }

                                              // Auto-Advance
                                              let nextSurah = currentSurah;
                                              let nextStartAyah = validatedAyahNum + 1;

                                              if (validatedAyahNum >= totalAyahs && surahIndex < SURAHS.length - 1) {
                                                nextSurah = SURAHS[surahIndex + 1];
                                                nextStartAyah = 1;
                                              }

                                              nextHomework = {
                                                mode: 'ayah',
                                                surah: nextSurah,
                                                from: toHindiDigits(nextStartAyah),
                                                to: ''
                                              };
                                            }
                                          }
                                        }

                                        const newState = {
                                          ...prev,
                                          [studentId]: {
                                            ...prev[studentId],
                                            readingOldRev: {
                                              ...prev[studentId]?.readingOldRev,
                                              toAyah: finalVal
                                            }
                                          }
                                        };

                                        if (nextHomework) {
                                          newState[studentId].homeworkOldRev = {
                                            ...newState[studentId]?.homeworkOldRev,
                                            ...nextHomework
                                          };
                                        }
                                        return newState;
                                      });
                                    }}
                                    style={{}}
                                    className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['quran-oldrev-to-ayah'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Toggle */}
                            <div className="flex justify-center relative z-10">
                              <button
                                onClick={() => setActiveAdvancedAyah(prev => {
                                  const nextVal = !prev.readingOldRev;
                                  const next = { ...prev, readingOldRev: nextVal, homeworkOldRev: nextVal };
                                  setLastReports(lastPrev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return lastPrev;
                                    return {
                                      ...lastPrev,
                                      [studentId]: {
                                        ...lastPrev[studentId],
                                        readingOldRev: {
                                          ...lastPrev[studentId]?.readingOldRev,
                                          isAdvancedAyah: nextVal
                                        },
                                        homeworkOldRev: {
                                          ...lastPrev[studentId]?.homeworkOldRev,
                                          isAdvancedAyah: nextVal
                                        }
                                      }
                                    };
                                  });
                                  return next;
                                })}
                                className={`p-1 rounded-full border shadow-sm transition-all ${activeAdvancedAyah.readingOldRev ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-gray-200 text-gray-400 hover:text-indigo-500'}`}
                                title={activeAdvancedAyah.readingOldRev ? "إلغاء الوضع المتقدم" : "تفعيل الوضع المتقدم"}
                              >
                                {activeAdvancedAyah.readingOldRev ? <Minus size={14} /> : <Plus size={14} />}
                              </button>
                            </div>
                          </div>

                          {/* Rev Surah Inputs */}
                          <div id="quran-oldrev-inputs-surah" className={`flex gap-3 items-end ${preferredModes.readingOldRev === 'surah' ? '' : 'hidden'}`}>
                            <div className="flex-1">
                              <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">من سورة</label>
                              <SearchableSurahSelect
                                id="quran-oldrev-from-surah"
                                value={lastReport?.readingOldRev?.fromSurah || lastReport?.homeworkOldRev?.fromSurah || SURAHS[0]}
                                surahs={SURAHS}
                                onChange={(val) => {
                                  setLastReports(prev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return prev;
                                    return {
                                      ...prev,
                                      [studentId]: {
                                        ...prev[studentId],
                                        readingOldRev: {
                                          ...prev[studentId]?.readingOldRev,
                                          fromSurah: val
                                        }
                                      }
                                    };
                                  });
                                }}
                              />
                            </div>
                            <div className="flex-1">
                              <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">إلى سورة</label>
                              <SearchableSurahSelect
                                id="quran-oldrev-to-surah"
                                value={lastReport?.readingOldRev?.toSurah || lastReport?.homeworkOldRev?.toSurah || SURAHS[0]}
                                surahs={SURAHS}
                                onChange={(val) => {
                                  setLastReports(prev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return prev;
                                    return {
                                      ...prev,
                                      [studentId]: {
                                        ...prev[studentId],
                                        readingOldRev: {
                                          ...prev[studentId]?.readingOldRev,
                                          toSurah: val
                                        }
                                      }
                                    };
                                  });
                                }}
                              />
                            </div>
                          </div>

                          {/* Rev Page Inputs - Default visible for Revision as it's common */}
                          <div id="quran-oldrev-inputs-page" className={`grid grid-cols-2 gap-3 ${preferredModes.readingOldRev === 'page' ? '' : 'hidden'}`}>
                            <div>
                              <label className="block text-lg font-medium text-gray-700 mb-1 font-arabic">من صفحة</label>
                              <input
                                id="quran-oldrev-from-page"
                                onFocus={handleFocus}
                                onPointerDown={() => handleInputPointerDown('quran-oldrev-from-page')}
                                onPointerUp={handleInputPointerUp}
                                onPointerLeave={handleInputPointerUp}
                                type="text"
                                inputMode="numeric"
                                value={toHindiDigits(lastReport?.readingOldRev?.fromPage ?? '')}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
                                  setLastReports(prev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return prev;
                                    return {
                                      ...prev,
                                      [studentId]: {
                                        ...prev[studentId],
                                        readingOldRev: {
                                          ...prev[studentId]?.readingOldRev,
                                          fromPage: val
                                        }
                                      }
                                    };
                                  });
                                }}
                                className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['quran-oldrev-from-page'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                              />
                            </div>
                            <div>
                              <label className="block text-lg font-medium text-gray-700 mb-1 font-arabic">إلى صفحة</label>
                              <input
                                id="quran-oldrev-to-page"
                                onFocus={handleFocus}
                                onPointerDown={() => handleInputPointerDown('quran-oldrev-to-page')}
                                onPointerUp={handleInputPointerUp}
                                onPointerLeave={handleInputPointerUp}
                                type="text"
                                inputMode="numeric"
                                value={toHindiDigits(lastReport?.readingOldRev?.toPage ?? '')}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);

                                  // Auto-Advance Next Homework Start Page
                                  if (val) {
                                    const pageNum = parseInt(val.replace(/[٠-٩]/g, (d) => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]));
                                    if (!isNaN(pageNum)) {
                                      const nextStartPage = pageNum + 1;

                                      // Update DOM Input directly for immediate feedback
                                      const hwFromInput = document.getElementById('hw-oldrev-from') as HTMLInputElement;
                                      if (hwFromInput) {
                                        hwFromInput.value = toHindiDigits(nextStartPage);
                                      }

                                      // Update State (will trigger re-render)
                                      setLastReports(prev => {
                                        const studentId = smartReportModal?.studentId;
                                        if (!studentId) return prev;
                                        return {
                                          ...prev,
                                          [studentId]: {
                                            ...prev[studentId],
                                            // Update Reading as usual
                                            readingOldRev: {
                                              ...prev[studentId]?.readingOldRev,
                                              toPage: val
                                            },
                                            // Auto-update Homework From Page
                                            homeworkOldRev: {
                                              ...prev[studentId]?.homeworkOldRev,
                                              from: toHindiDigits(nextStartPage)
                                            }
                                          }
                                        };
                                      });
                                      return; // Skip the default setState below since we handled it
                                    }
                                  }

                                  setLastReports(prev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return prev;
                                    return {
                                      ...prev,
                                      [studentId]: {
                                        ...prev[studentId],
                                        readingOldRev: {
                                          ...prev[studentId]?.readingOldRev,
                                          toPage: val
                                        }
                                      }
                                    };
                                  });
                                }}
                                className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['quran-oldrev-to-page'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                              />
                            </div>
                          </div>

                          {/* Rev Juz Inputs */}
                          <div id="quran-oldrev-inputs-juz" className={`grid grid-cols-2 gap-3 ${preferredModes.readingOldRev === 'juz' ? '' : 'hidden'}`}>
                            <div>
                              <label className="block text-lg font-medium text-gray-700 mb-1 font-arabic">من جزء</label>
                              <input
                                id="quran-oldrev-from-juz"
                                onFocus={handleFocus}
                                onPointerDown={() => handleInputPointerDown('quran-oldrev-from-juz')}
                                onPointerUp={handleInputPointerUp}
                                onPointerLeave={handleInputPointerUp}
                                type="text"
                                inputMode="numeric"
                                value={toHindiDigits(lastReport?.readingOldRev?.fromJuz ?? '')}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
                                  setLastReports(prev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return prev;
                                    return {
                                      ...prev,
                                      [studentId]: {
                                        ...prev[studentId],
                                        readingOldRev: {
                                          ...prev[studentId]?.readingOldRev,
                                          fromJuz: val
                                        }
                                      }
                                    };
                                  });
                                }}
                                className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['quran-oldrev-from-juz'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                              />
                            </div>
                            <div>
                              <label className="block text-lg font-medium text-gray-700 mb-1 font-arabic">إلى جزء</label>
                              <input
                                id="quran-oldrev-to-juz"
                                onFocus={handleFocus}
                                onPointerDown={() => handleInputPointerDown('quran-oldrev-to-juz')}
                                onPointerUp={handleInputPointerUp}
                                onPointerLeave={handleInputPointerUp}
                                type="text"
                                inputMode="numeric"
                                value={toHindiDigits(lastReport?.readingOldRev?.toJuz ?? '')}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
                                  setLastReports(prev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return prev;
                                    return {
                                      ...prev,
                                      [studentId]: {
                                        ...prev[studentId],
                                        readingOldRev: {
                                          ...prev[studentId]?.readingOldRev,
                                          toJuz: val
                                        }
                                      }
                                    };
                                  });
                                }}
                                className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['quran-oldrev-to-juz'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                              />
                            </div>
                          </div>

                          {/* Rev Hizb Inputs */}
                          <div id="quran-oldrev-inputs-hizb" className={`grid grid-cols-2 gap-3 ${preferredModes.readingOldRev === 'hizb' ? '' : 'hidden'}`}>
                            <div>
                              <label className="block text-lg font-medium text-gray-700 mb-1 font-arabic">من حزب</label>
                              <input
                                id="quran-oldrev-from-hizb"
                                onFocus={handleFocus}
                                onPointerDown={() => handleInputPointerDown('quran-oldrev-from-hizb')}
                                onPointerUp={handleInputPointerUp}
                                onPointerLeave={handleInputPointerUp}
                                type="text"
                                inputMode="numeric"
                                value={toHindiDigits(lastReport?.readingOldRev?.fromHizb ?? '')}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
                                  setLastReports(prev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return prev;
                                    return {
                                      ...prev,
                                      [studentId]: {
                                        ...prev[studentId],
                                        readingOldRev: {
                                          ...prev[studentId]?.readingOldRev,
                                          fromHizb: val
                                        }
                                      }
                                    };
                                  });
                                }}
                                className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['quran-oldrev-from-hizb'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                              />
                            </div>
                            <div>
                              <label className="block text-lg font-medium text-gray-700 mb-1 font-arabic">إلى حزب</label>
                              <input
                                id="quran-oldrev-to-hizb"
                                onFocus={handleFocus}
                                onPointerDown={() => handleInputPointerDown('quran-oldrev-to-hizb')}
                                onPointerUp={handleInputPointerUp}
                                onPointerLeave={handleInputPointerUp}
                                type="text"
                                inputMode="numeric"
                                value={toHindiDigits(lastReport?.readingOldRev?.toHizb ?? '')}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
                                  setLastReports(prev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return prev;
                                    return {
                                      ...prev,
                                      [studentId]: {
                                        ...prev[studentId],
                                        readingOldRev: {
                                          ...prev[studentId]?.readingOldRev,
                                          toHizb: val
                                        }
                                      }
                                    };
                                  });
                                }}
                                className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['quran-oldrev-to-hizb'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* 3. Tilawa Section (القراءة) */}
                    <div className={`space-y-3 pt-4 border-t border-black/30 transition-opacity duration-200 lg:col-start-1 lg:row-start-5 ${!sectionToggles.readingTilawa ? 'opacity-40' : ''}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSectionToggles(prev => {
                              const next = { ...prev, readingTilawa: !prev.readingTilawa };
                              setLastReports(lastPrev => {
                                const studentId = smartReportModal?.studentId;
                                if (!studentId) return lastPrev;
                                return {
                                  ...lastPrev,
                                  [studentId]: {
                                    ...lastPrev[studentId],
                                    sectionToggles: next
                                  }
                                };
                              });
                              return next;
                            })}
                            className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${sectionToggles.readingTilawa ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 bg-white'}`}
                          >
                            {sectionToggles.readingTilawa && <Check size={14} strokeWidth={3} />}
                          </button>
                          <h3 className="text-2xl font-bold text-gray-700 font-arabic">القراءة</h3>
                        </div>
                        <div className={`flex gap-1 p-1 bg-gray-100 rounded-lg ${!sectionToggles.readingTilawa ? 'hidden' : ''}`}>
                          <button
                            id="quran-tilawa-mode-ayah"
                            onClick={() => {
                              setPreferredModes(prev => ({ ...prev, readingTilawa: 'ayah', homeworkTilawa: 'ayah' }));
                              setLastReports(prev => {
                                const studentId = smartReportModal?.studentId;
                                if (!studentId) return prev;
                                return {
                                  ...prev,
                                  [studentId]: {
                                    ...prev[studentId],
                                    readingTilawa: { ...prev[studentId]?.readingTilawa, mode: 'ayah' },
                                    homeworkTilawa: { ...prev[studentId]?.homeworkTilawa, mode: 'ayah' }
                                  }
                                };
                              });
                            }}
                            className={`px-2 py-1 rounded-md text-xs font-arabic font-bold transition-all ${preferredModes.readingTilawa === 'ayah' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500'}`}
                          >
                            آيات
                          </button>
                          <button
                            id="quran-tilawa-mode-page"
                            onClick={() => {
                              setPreferredModes(prev => ({ ...prev, readingTilawa: 'page', homeworkTilawa: 'page' }));
                              setLastReports(prev => {
                                const studentId = smartReportModal?.studentId;
                                if (!studentId) return prev;
                                return {
                                  ...prev,
                                  [studentId]: {
                                    ...prev[studentId],
                                    readingTilawa: { ...prev[studentId]?.readingTilawa, mode: 'page' },
                                    homeworkTilawa: { ...prev[studentId]?.homeworkTilawa, mode: 'page' }
                                  }
                                };
                              });
                            }}
                            className={`px-2 py-1 rounded-md text-xs font-arabic font-bold transition-all ${preferredModes.readingTilawa === 'page' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500'}`}
                          >
                            صفحات
                          </button>
                          <button
                            id="quran-tilawa-mode-juz"
                            onClick={() => {
                              setPreferredModes(prev => ({ ...prev, readingTilawa: 'juz', homeworkTilawa: 'juz' }));
                              setLastReports(prev => {
                                const studentId = smartReportModal?.studentId;
                                if (!studentId) return prev;
                                return {
                                  ...prev,
                                  [studentId]: {
                                    ...prev[studentId],
                                    readingTilawa: { ...prev[studentId]?.readingTilawa, mode: 'juz' },
                                    homeworkTilawa: { ...prev[studentId]?.homeworkTilawa, mode: 'juz' }
                                  }
                                };
                              });
                            }}
                            className={`px-2 py-1 rounded-md text-xs font-arabic font-bold transition-all ${preferredModes.readingTilawa === 'juz' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500'}`}
                          >
                            أجزاء
                          </button>
                          <button
                            id="quran-tilawa-mode-hizb"
                            onClick={() => {
                              setPreferredModes(prev => ({ ...prev, readingTilawa: 'hizb', homeworkTilawa: 'hizb' }));
                              setLastReports(prev => {
                                const studentId = smartReportModal?.studentId;
                                if (!studentId) return prev;
                                return {
                                  ...prev,
                                  [studentId]: {
                                    ...prev[studentId],
                                    readingTilawa: { ...prev[studentId]?.readingTilawa, mode: 'hizb' },
                                    homeworkTilawa: { ...prev[studentId]?.homeworkTilawa, mode: 'hizb' }
                                  }
                                };
                              });
                            }}
                            className={`px-2 py-1 rounded-md text-xs font-arabic font-bold transition-all ${preferredModes.readingTilawa === 'hizb' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500'}`}
                          >
                            أحزاب
                          </button>
                        </div>
                      </div>

                      {sectionToggles.readingTilawa && (
                        <>
                          <div className="flex items-center gap-5 mb-4 flex-wrap">
                            <label className="flex items-center gap-1.5 cursor-pointer hover:bg-white/50 p-1 rounded-md transition-colors">
                              <input
                                type="checkbox"
                                checked={excludeReadingTilawa}
                                onChange={(e) => setExcludeReadingTilawa(e.target.checked)}
                                className="w-3.5 h-3.5 text-amber-500 rounded border-gray-300 focus:ring-amber-500"
                              />
                              <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                                {excludeReadingTilawa ? <EyeOff size={14} /> : <Eye size={14} />}
                                إخفاء من التقرير
                              </span>
                            </label>
                          </div>
                          {/* Tilawa Ayah Inputs */}
                          <div id="quran-tilawa-inputs-ayah-container" className={`${preferredModes.readingTilawa === 'ayah' ? 'flex flex-col gap-3' : 'hidden'}`}>
                            {/* Row 1 */}
                            <div className="flex gap-3 items-end">
                              <div className="flex-[2]">
                                <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">
                                  {activeAdvancedAyah.readingTilawa ? 'من سورة' : 'السورة'}
                                </label>
                                <SearchableSurahSelect
                                  id="quran-tilawa-surah-select"
                                  value={lastReport?.readingTilawa?.surah || SURAHS[0]}
                                  surahs={SURAHS}
                                  onChange={(val) => {
                                    // Sync to Homework Tilawa (Exact Match)
                                    const hwTilawaSurahSelect = document.getElementById('hw-tilawa-surah-select') as HTMLInputElement;
                                    if (hwTilawaSurahSelect) {
                                      hwTilawaSurahSelect.value = val;
                                    }

                                    // Also sync 'from' and 'to' inputs
                                    const tilawaFromInput = document.getElementById('quran-tilawa-from-ayah') as HTMLInputElement;
                                    const hwTilawaFromInput = document.getElementById('hw-tilawa-from') as HTMLInputElement;
                                    if (tilawaFromInput && hwTilawaFromInput) hwTilawaFromInput.value = tilawaFromInput.value;

                                    const tilawaToInput = document.getElementById('quran-tilawa-to-ayah') as HTMLInputElement;
                                    const hwTilawaToInput = document.getElementById('hw-tilawa-to') as HTMLInputElement;
                                    if (tilawaToInput && hwTilawaToInput) hwTilawaToInput.value = tilawaToInput.value;

                                    setLastReports(prev => {
                                      const studentId = smartReportModal?.studentId;
                                      if (!studentId) return prev;
                                      return {
                                        ...prev,
                                        [studentId]: {
                                          ...prev[studentId],
                                          readingTilawa: {
                                            ...prev[studentId]?.readingTilawa,
                                            surah: val
                                          }
                                        }
                                      };
                                    });
                                  }}
                                />
                              </div>
                              <div className="flex-1">
                                <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">من الآية</label>
                                <input
                                  id="quran-tilawa-from-ayah"
                                  onFocus={handleFocus}
                                  onPointerDown={() => handleInputPointerDown('quran-tilawa-from-ayah')}
                                  onPointerUp={handleInputPointerUp}
                                  onPointerLeave={handleInputPointerUp}
                                  type="text"
                                  inputMode="numeric"
                                  autoComplete="off"
                                  value={toHindiDigits(lastReport?.readingTilawa?.fromAyah || '')}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);

                                    // Sync to Homework Tilawa (Exact Match)
                                    const hwTilawaFromInput = document.getElementById('hw-tilawa-from') as HTMLInputElement;
                                    if (hwTilawaFromInput) hwTilawaFromInput.value = val;

                                    // Also sync surah selection
                                    const tilawaSurahSelect = document.getElementById('quran-tilawa-surah-select') as HTMLSelectElement;
                                    const hwTilawaSurahSelect = document.getElementById('hw-tilawa-surah-select') as HTMLSelectElement;
                                    if (tilawaSurahSelect && hwTilawaSurahSelect) {
                                      hwTilawaSurahSelect.value = tilawaSurahSelect.value;
                                    }
                                    // Also sync to ayah
                                    const tilawaToInput = document.getElementById('quran-tilawa-to-ayah') as HTMLInputElement;
                                    const hwTilawaToInput = document.getElementById('hw-tilawa-to') as HTMLInputElement;
                                    if (tilawaToInput && hwTilawaToInput) {
                                      hwTilawaToInput.value = tilawaToInput.value;
                                    }

                                    setLastReports(prev => {
                                      const studentId = smartReportModal?.studentId;
                                      if (!studentId) return prev;
                                      return {
                                        ...prev,
                                        [studentId]: {
                                          ...prev[studentId],
                                          readingTilawa: {
                                            ...prev[studentId]?.readingTilawa,
                                            fromAyah: val
                                          },
                                          homeworkTilawa: {
                                            ...prev[studentId]?.homeworkTilawa,
                                            from: val,
                                            // Ensure surah is synced in state if it wasn't already (though SurahSelect handles its own sync)
                                            surah: prev[studentId]?.readingTilawa?.surah || prev[studentId]?.homeworkTilawa?.surah
                                          }
                                        }
                                      };
                                    });
                                  }}
                                  className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['quran-tilawa-from-ayah'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                                />
                              </div>
                              {!activeAdvancedAyah.readingTilawa && (
                                <div className="flex-1">
                                  <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">إلى الآية</label>
                                  <input
                                    id="quran-tilawa-to-ayah"
                                    onFocus={handleFocus}
                                    onPointerDown={() => handleInputPointerDown('quran-tilawa-to-ayah')}
                                    onPointerUp={handleInputPointerUp}
                                    onPointerLeave={handleInputPointerUp}
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="off"
                                    value={toHindiDigits(lastReport?.readingTilawa?.toAyah || '')}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);

                                      // Smart Auto-Follow Logic (NOT Mirroring)
                                      if (val) {
                                        const endAyahNum = parseInt(val.replace(/[٠-٩]/g, (d) => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]));
                                        if (!isNaN(endAyahNum)) {
                                          // Get current Surah
                                          const tilawaSurahSelect = document.getElementById('quran-tilawa-surah-select') as HTMLSelectElement;
                                          const currentSurah = tilawaSurahSelect?.value;
                                          const surahIndex = SURAHS.indexOf(currentSurah);

                                          if (surahIndex !== -1) {
                                            const totalAyahs = SURAH_AYAH_COUNTS[surahIndex];

                                            // Validation: Cap at maximum Ayahs
                                            let validatedAyahNum = endAyahNum;
                                            let finalStateVal = val;
                                            if (endAyahNum > totalAyahs) {
                                              validatedAyahNum = totalAyahs;
                                              finalStateVal = toHindiDigits(totalAyahs);
                                              e.target.value = finalStateVal;
                                            }

                                            let nextSurah = currentSurah;
                                            let nextStartAyah = validatedAyahNum + 1;

                                            // If finished current Surah, move to next Surah
                                            if (validatedAyahNum >= totalAyahs && surahIndex < SURAHS.length - 1) {
                                              nextSurah = SURAHS[surahIndex + 1];
                                              nextStartAyah = 1;
                                            }

                                            // Update Homework Tilawa inputs
                                            const hwTilawaSurahSelect = document.getElementById('hw-tilawa-surah-select') as HTMLSelectElement;
                                            const hwTilawaFromInput = document.getElementById('hw-tilawa-from') as HTMLInputElement;
                                            const hwTilawaToInput = document.getElementById('hw-tilawa-to') as HTMLInputElement;
                                            const hwTilawaFromSurah = document.getElementById('hw-tilawa-from-surah') as HTMLSelectElement;
                                            const hwTilawaToSurahSelect = document.getElementById('hw-tilawa-to-surah-advanced') as HTMLSelectElement;

                                            if (hwTilawaSurahSelect) hwTilawaSurahSelect.value = nextSurah;
                                            if (hwTilawaFromSurah) hwTilawaFromSurah.value = nextSurah;
                                            if (hwTilawaToSurahSelect) hwTilawaToSurahSelect.value = nextSurah;

                                            if (hwTilawaFromInput) hwTilawaFromInput.value = toHindiDigits(nextStartAyah);
                                            if (hwTilawaToInput) hwTilawaToInput.value = ""; // Clear "To" field

                                            // Validate Surah State Sync
                                            setLastReports(prev => {
                                              const studentId = smartReportModal?.studentId;
                                              if (!studentId) return prev;
                                              return {
                                                ...prev,
                                                [studentId]: {
                                                  ...prev[studentId],
                                                  readingTilawa: {
                                                    ...prev[studentId]?.readingTilawa,
                                                    toAyah: finalStateVal
                                                  },
                                                  homeworkTilawa: {
                                                    ...prev[studentId]?.homeworkTilawa,
                                                    surah: nextSurah,
                                                    fromSurah: nextSurah,
                                                    from: toHindiDigits(nextStartAyah),
                                                    to: ''
                                                  }
                                                }
                                              };
                                            });
                                            return; // Skip default update
                                          }
                                        }
                                      }

                                      setLastReports(prev => {
                                        const studentId = smartReportModal?.studentId;
                                        if (!studentId) return prev;
                                        return {
                                          ...prev,
                                          [studentId]: {
                                            ...prev[studentId],
                                            readingTilawa: {
                                              ...prev[studentId]?.readingTilawa,
                                              toAyah: val
                                            }
                                          }
                                        };
                                      });
                                    }}
                                    className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['quran-tilawa-to-ayah'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                                  />
                                </div>
                              )}
                            </div>

                            {/* Row 2 Advanced */}
                            {activeAdvancedAyah.readingTilawa && (
                              <div className="flex gap-3 items-end">
                                <div className="flex-[2]">
                                  <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">إلى سورة</label>
                                  <SearchableSurahSelect
                                    id="quran-tilawa-to-surah-advanced"
                                    value={lastReport?.readingTilawa?.toSurah || SURAHS[0]}
                                    surahs={SURAHS}
                                    onChange={(val) => {
                                      // Sync to Homework Tilawa
                                      const hwToSurahSelect = document.getElementById('hw-tilawa-to-surah-advanced') as HTMLInputElement;
                                      if (hwToSurahSelect) {
                                        hwToSurahSelect.value = val;
                                      }

                                      setLastReports(prev => {
                                        const studentId = smartReportModal?.studentId;
                                        if (!studentId) return prev;
                                        return {
                                          ...prev,
                                          [studentId]: {
                                            ...prev[studentId],
                                            readingTilawa: {
                                              ...prev[studentId]?.readingTilawa,
                                              toSurah: val
                                            }
                                          }
                                        };
                                      });
                                    }}
                                  />
                                </div>
                                <div className="flex-1">
                                  <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">إلى الآية</label>
                                  <input
                                    id="quran-tilawa-to-ayah"
                                    onFocus={handleFocus}
                                    onPointerDown={() => handleInputPointerDown('quran-tilawa-to-ayah')}
                                    onPointerUp={handleInputPointerUp}
                                    onPointerLeave={handleInputPointerUp}
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="off"
                                    value={toHindiDigits(lastReport?.readingTilawa?.toAyah || '')}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);

                                      setLastReports(prev => {
                                        const studentId = smartReportModal?.studentId;
                                        if (!studentId) return prev;

                                        let finalVal = val;
                                        let nextHomework = null;

                                        if (val) {
                                          const endAyahNum = parseInt(val.replace(/[٠-٩]/g, (d) => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]));
                                          if (!isNaN(endAyahNum)) {
                                            const currentSurah = prev[studentId]?.readingTilawa?.toSurah || prev[studentId]?.readingTilawa?.surah || SURAHS[0];
                                            const surahIndex = SURAHS.indexOf(currentSurah);
                                            if (surahIndex !== -1) {
                                              const totalAyahs = SURAH_AYAH_COUNTS[surahIndex];
                                              let validatedAyahNum = endAyahNum;

                                              if (endAyahNum > totalAyahs) {
                                                validatedAyahNum = totalAyahs;
                                                finalVal = toHindiDigits(totalAyahs);
                                                e.target.value = finalVal;
                                              }

                                              // Auto-advance calculation
                                              let nextSurah = currentSurah;
                                              let nextStartAyah = validatedAyahNum + 1;

                                              if (validatedAyahNum >= totalAyahs && surahIndex < SURAHS.length - 1) {
                                                nextSurah = SURAHS[surahIndex + 1];
                                                nextStartAyah = 1;
                                              }

                                              nextHomework = {
                                                mode: 'ayah',
                                                surah: nextSurah,
                                                fromSurah: nextSurah,
                                                from: toHindiDigits(nextStartAyah),
                                                to: ''
                                              };
                                            }
                                          }
                                        }

                                        const newState = {
                                          ...prev,
                                          [studentId]: {
                                            ...prev[studentId],
                                            readingTilawa: {
                                              ...prev[studentId]?.readingTilawa,
                                              toAyah: finalVal
                                            }
                                          }
                                        };

                                        if (nextHomework && !isRedoModeTilawa) {
                                          newState[studentId].homeworkTilawa = {
                                            ...newState[studentId]?.homeworkTilawa,
                                            ...nextHomework
                                          };
                                        }

                                        return newState;
                                      });
                                    }}
                                    className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['quran-tilawa-to-ayah'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Toggle */}
                            <div className="flex justify-center relative z-10">
                              <button
                                onClick={() => setActiveAdvancedAyah(prev => {
                                  const nextVal = !prev.readingTilawa;
                                  setLastReports(lastPrev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return lastPrev;
                                    return {
                                      ...lastPrev,
                                      [studentId]: {
                                        ...lastPrev[studentId],
                                        readingTilawa: { ...lastPrev[studentId]?.readingTilawa, isAdvancedAyah: nextVal },
                                        homeworkTilawa: { ...lastPrev[studentId]?.homeworkTilawa, isAdvancedAyah: nextVal }
                                      }
                                    };
                                  });
                                  return { ...prev, readingTilawa: nextVal, homeworkTilawa: nextVal };
                                })}
                                className={`p-1 rounded-full border shadow-sm transition-all ${activeAdvancedAyah.readingTilawa ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-gray-200 text-gray-400 hover:text-indigo-500'}`}
                                title={activeAdvancedAyah.readingTilawa ? "إلغاء الوضع المتقدم" : "تفعيل الوضع المتقدم"}
                              >
                                {activeAdvancedAyah.readingTilawa ? <Minus size={14} /> : <Plus size={14} />}
                              </button>
                            </div>
                          </div>

                          {/* Tilawa Surah Inputs */}
                          <div id="quran-tilawa-inputs-surah" className={`flex gap-3 items-end ${preferredModes.readingTilawa === 'surah' ? '' : 'hidden'}`}>
                            <div className="flex-1">
                              <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">من سورة</label>
                              <SearchableSurahSelect
                                id="quran-tilawa-from-surah"
                                value={lastReport?.readingTilawa?.fromSurah || SURAHS[0]}
                                surahs={SURAHS}
                                onChange={(val) => {
                                  setLastReports(prev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return prev;
                                    return {
                                      ...prev,
                                      [studentId]: {
                                        ...prev[studentId],
                                        readingTilawa: {
                                          ...prev[studentId]?.readingTilawa,
                                          fromSurah: val
                                        }
                                      }
                                    };
                                  });
                                }}
                              />
                            </div>
                            <div className="flex-1">
                              <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">إلى سورة</label>
                              <SearchableSurahSelect
                                id="quran-tilawa-to-surah"
                                value={lastReport?.readingTilawa?.toSurah || SURAHS[0]}
                                surahs={SURAHS}
                                onChange={(val) => {
                                  setLastReports(prev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return prev;
                                    return {
                                      ...prev,
                                      [studentId]: {
                                        ...prev[studentId],
                                        readingTilawa: {
                                          ...prev[studentId]?.readingTilawa,
                                          toSurah: val
                                        }
                                      }
                                    };
                                  });
                                }}
                              />
                            </div>
                          </div>

                          {/* Tilawa Page Inputs */}
                          <div id="quran-tilawa-inputs-page" className={`grid grid-cols-2 gap-3 ${preferredModes.readingTilawa === 'page' ? '' : 'hidden'}`}>
                            <div>
                              <label className="block text-lg font-medium text-gray-700 mb-1 font-arabic">من صفحة</label>
                              <input
                                id="quran-tilawa-from-page"
                                onFocus={handleFocus}
                                onPointerDown={() => handleInputPointerDown('quran-tilawa-from-page')}
                                onPointerUp={handleInputPointerUp}
                                onPointerLeave={handleInputPointerUp}
                                type="text"
                                inputMode="numeric"
                                value={toHindiDigits(lastReport?.readingTilawa?.fromPage || '')}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
                                  e.target.value = val;
                                  setLastReports(prev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return prev;
                                    return {
                                      ...prev,
                                      [studentId]: {
                                        ...prev[studentId],
                                        readingTilawa: {
                                          ...prev[studentId]?.readingTilawa,
                                          fromPage: val
                                        }
                                      }
                                    };
                                  });
                                }}
                                className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['quran-tilawa-from-page'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                              />
                            </div>
                            <div>
                              <label className="block text-lg font-medium text-gray-700 mb-1 font-arabic">إلى صفحة</label>
                              <input
                                id="quran-tilawa-to-page"
                                onFocus={handleFocus}
                                onPointerDown={() => handleInputPointerDown('quran-tilawa-to-page')}
                                onPointerUp={handleInputPointerUp}
                                onPointerLeave={handleInputPointerUp}
                                type="text"
                                inputMode="numeric"
                                value={toHindiDigits(lastReport?.readingTilawa?.toPage || '')}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
                                  e.target.value = val;

                                  // Auto-Advance Logic
                                  if (val) {
                                    const pageNum = parseInt(val.replace(/[٠-٩]/g, (d) => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]));
                                    if (!isNaN(pageNum)) {
                                      const nextStartPage = pageNum + 1;

                                      // Update DOM
                                      const hwTilawaFromPage = document.getElementById('hw-tilawa-from-page') as HTMLInputElement;
                                      if (hwTilawaFromPage) hwTilawaFromPage.value = toHindiDigits(nextStartPage);

                                      setLastReports(prev => {
                                        const studentId = smartReportModal?.studentId;
                                        if (!studentId) return prev;
                                        return {
                                          ...prev,
                                          [studentId]: {
                                            ...prev[studentId],
                                            readingTilawa: {
                                              ...prev[studentId]?.readingTilawa,
                                              toPage: val
                                            },
                                            homeworkTilawa: {
                                              ...prev[studentId]?.homeworkTilawa,
                                              from: toHindiDigits(nextStartPage)
                                            }
                                          }
                                        };
                                      });
                                      return;
                                    }
                                  }

                                  setLastReports(prev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return prev;
                                    return {
                                      ...prev,
                                      [studentId]: {
                                        ...prev[studentId],
                                        readingTilawa: {
                                          ...prev[studentId]?.readingTilawa,
                                          toPage: val
                                        }
                                      }
                                    };
                                  });
                                }}
                                className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['quran-tilawa-to-page'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                              />
                            </div>
                          </div>

                          {/* Tilawa Juz Inputs */}
                          <div id="quran-tilawa-inputs-juz" className={`grid grid-cols-2 gap-3 ${preferredModes.readingTilawa === 'juz' ? '' : 'hidden'}`}>
                            <div>
                              <label className="block text-lg font-medium text-gray-700 mb-1 font-arabic">من جزء</label>
                              <input
                                id="quran-tilawa-from-juz"
                                onFocus={handleFocus}
                                onPointerDown={() => handleInputPointerDown('quran-tilawa-from-juz')}
                                onPointerUp={handleInputPointerUp}
                                onPointerLeave={handleInputPointerUp}
                                type="text"
                                inputMode="numeric"
                                value={toHindiDigits(lastReport?.readingTilawa?.fromJuz || '')}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
                                  setLastReports(prev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return prev;
                                    return {
                                      ...prev,
                                      [studentId]: {
                                        ...prev[studentId],
                                        readingTilawa: {
                                          ...prev[studentId]?.readingTilawa,
                                          fromJuz: val
                                        }
                                      }
                                    };
                                  });
                                }}
                                className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['quran-tilawa-from-juz'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                              />
                            </div>
                            <div>
                              <label className="block text-lg font-medium text-gray-700 mb-1 font-arabic">إلى جزء</label>
                              <input
                                id="quran-tilawa-to-juz"
                                onFocus={handleFocus}
                                onPointerDown={() => handleInputPointerDown('quran-tilawa-to-juz')}
                                onPointerUp={handleInputPointerUp}
                                onPointerLeave={handleInputPointerUp}
                                type="text"
                                inputMode="numeric"
                                value={toHindiDigits(lastReport?.readingTilawa?.toJuz || '')}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
                                  setLastReports(prev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return prev;
                                    return {
                                      ...prev,
                                      [studentId]: {
                                        ...prev[studentId],
                                        readingTilawa: {
                                          ...prev[studentId]?.readingTilawa,
                                          toJuz: val
                                        }
                                      }
                                    };
                                  });
                                }}
                                className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['quran-tilawa-to-juz'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                              />
                            </div>
                          </div>

                          {/* Tilawa Hizb Inputs */}
                          <div id="quran-tilawa-inputs-hizb" className={`grid grid-cols-2 gap-3 ${preferredModes.readingTilawa === 'hizb' ? '' : 'hidden'}`}>
                            <div>
                              <label className="block text-lg font-medium text-gray-700 mb-1 font-arabic">من حزب</label>
                              <input
                                id="quran-tilawa-from-hizb"
                                onFocus={handleFocus}
                                onPointerDown={() => handleInputPointerDown('quran-tilawa-from-hizb')}
                                onPointerUp={handleInputPointerUp}
                                onPointerLeave={handleInputPointerUp}
                                type="text"
                                inputMode="numeric"
                                value={toHindiDigits(lastReport?.readingTilawa?.fromHizb || '')}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
                                  setLastReports(prev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return prev;
                                    return {
                                      ...prev,
                                      [studentId]: {
                                        ...prev[studentId],
                                        readingTilawa: {
                                          ...prev[studentId]?.readingTilawa,
                                          fromHizb: val
                                        }
                                      }
                                    };
                                  });
                                }}
                                className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['quran-tilawa-from-hizb'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                              />
                            </div>
                            <div>
                              <label className="block text-lg font-medium text-gray-700 mb-1 font-arabic">إلى حزب</label>
                              <input
                                id="quran-tilawa-to-hizb"
                                onFocus={handleFocus}
                                onPointerDown={() => handleInputPointerDown('quran-tilawa-to-hizb')}
                                onPointerUp={handleInputPointerUp}
                                onPointerLeave={handleInputPointerUp}
                                type="text"
                                inputMode="numeric"
                                value={toHindiDigits(lastReport?.readingTilawa?.toHizb || '')}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
                                  setLastReports(prev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return prev;
                                    return {
                                      ...prev,
                                      [studentId]: {
                                        ...prev[studentId],
                                        readingTilawa: {
                                          ...prev[studentId]?.readingTilawa,
                                          toHizb: val
                                        }
                                      }
                                    };
                                  });
                                }}
                                className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['quran-tilawa-to-hizb'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>



                    {/* Main Header: What Will Be Done */}
                    <div className="flex justify-center py-1 lg:col-start-2 lg:row-start-1">
                      <h2 className="text-xl font-bold text-gray-700 font-arabic text-center py-2 px-10 bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-xl shadow-md">
                        الدرس القادم
                      </h2>
                    </div>

                    {/* 1. New Homework Section (الجديد) */}
                    <div className={`space-y-3 transition-opacity duration-200 lg:col-start-2 lg:row-start-2 ${!sectionToggles.homeworkNew ? 'opacity-40' : ''}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSectionToggles(prev => {
                              const next = { ...prev, homeworkNew: !prev.homeworkNew };
                              setLastReports(lastPrev => {
                                const studentId = smartReportModal?.studentId;
                                if (!studentId) return lastPrev;
                                return {
                                  ...lastPrev,
                                  [studentId]: {
                                    ...lastPrev[studentId],
                                    sectionToggles: next
                                  }
                                };
                              });
                              return next;
                            })}
                            className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${sectionToggles.homeworkNew ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-gray-300 bg-white'}`}
                          >
                            {sectionToggles.homeworkNew && <Check size={14} strokeWidth={3} />}
                          </button>
                          <h3 className="text-2xl font-bold text-gray-700 font-arabic">الجديد</h3>
                        </div>
                        <div className={`flex gap-1 p-1 bg-gray-100 rounded-lg ${!sectionToggles.homeworkNew ? 'hidden' : ''}`}>
                          <button
                            id="hw-new-mode-ayah"
                            onClick={() => {
                              setPreferredModes(prev => ({ ...prev, homeworkNew: 'ayah' }));
                              setLastReports(prev => {
                                const studentId = smartReportModal?.studentId;
                                if (!studentId) return prev;
                                return { ...prev, [studentId]: { ...prev[studentId], homeworkNew: { ...prev[studentId]?.homeworkNew, mode: 'ayah' } } };
                              });
                            }}
                            className={`px-2 py-1 rounded-md text-xs font-arabic font-bold transition-all ${preferredModes.homeworkNew === 'ayah' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500'}`}
                          >
                            آيات
                          </button>
                          <button
                            id="hw-new-mode-page"
                            onClick={() => {
                              setPreferredModes(prev => ({ ...prev, homeworkNew: 'page' }));
                              setLastReports(prev => {
                                const studentId = smartReportModal?.studentId;
                                if (!studentId) return prev;
                                return { ...prev, [studentId]: { ...prev[studentId], homeworkNew: { ...prev[studentId]?.homeworkNew, mode: 'page' } } };
                              });
                            }}
                            className={`px-2 py-1 rounded-md text-xs font-arabic font-bold transition-all ${preferredModes.homeworkNew === 'page' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500'}`}
                          >
                            صفحات
                          </button>
                        </div>
                      </div>

                      {sectionToggles.homeworkNew && (
                        <>
                          {/* Redo + Mastery Exclusion Checkboxes — Same Row */}
                          <div className="flex items-center gap-5 mb-4 flex-wrap">
                            {/* Redo Checkbox */}
                            <div className="flex items-center gap-2 w-fit">
                              <input
                                type="checkbox"
                                id="hw-new-redo-checkbox"
                                checked={isRedoMode}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setIsRedoMode(checked);

                                  // When enabling redo, copy readingRev → homeworkRev (mirror "ما تم" revision)
                                  if (checked && smartReportModal?.studentId) {
                                    const studentId = smartReportModal.studentId;
                                    setLastReports(prev => {
                                      const readingRev = prev[studentId]?.readingRev;
                                      if (!readingRev) return prev;
                                      return {
                                        ...prev,
                                        [studentId]: {
                                          ...prev[studentId],
                                          homeworkRev: {
                                            ...prev[studentId]?.homeworkRev,
                                            surah: readingRev.surah,
                                            from: readingRev.fromAyah,
                                            to: readingRev.toAyah,
                                            toSurah: readingRev.toSurah,
                                            fromSurah: readingRev.fromSurah || readingRev.surah,
                                            isAdvancedAyah: readingRev.isAdvancedAyah,
                                          }
                                        }
                                      };
                                    });
                                  }
                                }}
                                className="w-5 h-5 text-rose-600 rounded focus:ring-rose-500 border-gray-300"
                              />
                              <label htmlFor="hw-new-redo-checkbox" className="text-base font-bold text-gray-700 font-arabic select-none cursor-pointer">
                                إعادة
                              </label>
                            </div>

                            {/* Mastery Exclusion Checkbox */}
                            <div className="flex items-center gap-2 w-fit">
                              <input
                                type="checkbox"
                                id="hw-new-exclude-checkbox"
                                checked={excludeNewFromReport}
                                onChange={(e) => {
                                  setExcludeNewFromReport(e.target.checked);
                                  if (!e.target.checked) {
                                    setMasteryDeficiency([]);
                                    setMasteryPanelOpen(false);
                                  } else {
                                    setMasteryPanelOpen(true);
                                  }
                                }}
                                className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500 border-gray-300"
                              />
                              <label htmlFor="hw-new-exclude-checkbox" className="text-base font-bold text-gray-700 font-arabic select-none cursor-pointer">
                                عدم تضمين الحفظ في التقرير
                              </label>
                              {/* Inline summary — shown when panel is collapsed and there are selections */}
                              {excludeNewFromReport && !masteryPanelOpen && masteryDeficiency.length > 0 && (
                                <button
                                  onClick={() => setMasteryPanelOpen(true)}
                                  className="text-xs text-amber-500/70 font-arabic hover:text-amber-600 transition-colors cursor-pointer"
                                >
                                  ({masteryDeficiency.map(k => ({ rev: 'المراجعة', oldRev: 'المراجعة البعيدة' }[k])).filter(Boolean).join('، ')})
                                </button>
                              )}
                            </div>

                            <label className="flex items-center gap-1.5 cursor-pointer hover:bg-white/50 p-1 rounded-md transition-colors">
                              <input
                                type="checkbox"
                                checked={excludeHomeworkNew}
                                onChange={(e) => setExcludeHomeworkNew(e.target.checked)}
                                className="w-3.5 h-3.5 text-amber-500 rounded border-gray-300 focus:ring-amber-500"
                              />
                              <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                                {excludeHomeworkNew ? <EyeOff size={14} /> : <Eye size={14} />}
                                إخفاء من التقرير
                              </span>
                            </label>
                          </div>

                          {/* Deficiency Options Panel — collapsible */}
                          {excludeNewFromReport && masteryPanelOpen && (
                            <div className="mb-4 mr-7 p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                              <p className="text-sm font-bold text-amber-700 font-arabic mb-2">الخلل في:</p>
                              {[
                                { key: 'rev', labelAr: 'المراجعة' },
                                { key: 'oldRev', labelAr: 'المراجعة البعيدة' },
                              ].map(opt => (
                                <div key={opt.key} className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    id={`mastery-${opt.key}`}
                                    checked={masteryDeficiency.includes(opt.key)}
                                    onChange={(e) => {
                                      const newDeficiency = e.target.checked
                                        ? [...masteryDeficiency, opt.key]
                                        : masteryDeficiency.filter(k => k !== opt.key);
                                      setMasteryDeficiency(newDeficiency);
                                      // Auto-collapse after selecting at least one option
                                      if (newDeficiency.length > 0 && e.target.checked) {
                                        setMasteryPanelOpen(false);
                                      }
                                    }}
                                    className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 border-gray-300"
                                  />
                                  <label htmlFor={`mastery-${opt.key}`} className="text-base text-gray-700 font-arabic select-none cursor-pointer">
                                    {opt.labelAr}
                                  </label>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Surah Mode Inputs (New) */}
                          <div id="hw-new-inputs-surah-mode" className={`flex gap-3 items-end ${preferredModes.homeworkNew === 'surah' ? '' : 'hidden'} ${excludeNewFromReport ? 'opacity-40 blur-[1px] pointer-events-none' : ''}`}>
                            <div className="flex-1">
                              <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">من سورة</label>
                              <SearchableSurahSelect
                                id="hw-new-from-surah-safe"
                                value={lastReports[smartReportModal?.studentId || '']?.homeworkNew?.fromSurah || SURAHS[0]}
                                surahs={SURAHS}
                                onChange={(val) => {
                                  setLastReports(prev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return prev;
                                    return {
                                      ...prev,
                                      [studentId]: {
                                        ...prev[studentId],
                                        homeworkNew: {
                                          ...prev[studentId]?.homeworkNew,
                                          fromSurah: val
                                        }
                                      }
                                    };
                                  });
                                }}
                              />
                            </div>
                            <div className="flex-1">
                              <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">إلى سورة</label>
                              <SearchableSurahSelect
                                id="hw-new-to-surah-safe"
                                value={lastReports[smartReportModal?.studentId || '']?.homeworkNew?.toSurah || SURAHS[0]}
                                surahs={SURAHS}
                                onChange={(val) => {
                                  setLastReports(prev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return prev;
                                    return {
                                      ...prev,
                                      [studentId]: {
                                        ...prev[studentId],
                                        homeworkNew: {
                                          ...prev[studentId]?.homeworkNew,
                                          toSurah: val
                                        }
                                      }
                                    };
                                  });
                                }}
                              />
                            </div>
                          </div>

                          <div className={`flex flex-col gap-3 ${preferredModes.homeworkNew === 'surah' ? 'hidden' : ''} ${excludeNewFromReport ? 'opacity-40 blur-[1px] pointer-events-none' : ''}`}>
                            <div className="flex gap-3 items-end">
                              <div id="hw-new-surah-container" className={`flex-[2] ${preferredModes.homeworkNew === 'ayah' ? '' : 'hidden'}`}>
                                <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">
                                  {activeAdvancedAyah.homeworkNew ? 'من سورة' : 'السورة'}
                                </label>
                                <SearchableSurahSelect
                                  id="hw-new-surah-select"
                                  value={lastReport?.homeworkNew?.surah || SURAHS[0]}
                                  surahs={SURAHS}
                                  onChange={(val) => {
                                    setLastReports(prev => {
                                      const studentId = smartReportModal?.studentId;
                                      if (!studentId) return prev;
                                      return {
                                        ...prev,
                                        [studentId]: {
                                          ...prev[studentId],
                                          homeworkNew: {
                                            ...prev[studentId]?.homeworkNew,
                                            surah: val
                                          }
                                        }
                                      };
                                    });
                                  }}
                                />
                              </div>

                              <div className="flex-1">
                                <label id="hw-new-label-from" className="block text-xl font-medium text-gray-700 mb-1 font-arabic">
                                  {preferredModes.homeworkNew === 'ayah' ? 'من الآية' :
                                    preferredModes.homeworkNew === 'page' ? 'من صفحة' : ''}
                                </label>
                                <input
                                  id="hw-new-from"
                                  onFocus={handleFocus}
                                  onPointerDown={() => handleInputPointerDown('hw-new-from')}
                                  onPointerUp={handleInputPointerUp}
                                  onPointerLeave={handleInputPointerUp}
                                  type="text"
                                  inputMode="numeric"
                                  autoComplete="off"
                                  value={toHindiDigits(lastReport?.homeworkNew?.from ?? '')}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
                                    setLastReports(prev => {
                                      const studentId = smartReportModal?.studentId;
                                      if (!studentId) return prev;
                                      const next = {
                                        ...prev,
                                        [studentId]: {
                                          ...prev[studentId],
                                          homeworkNew: {
                                            ...prev[studentId]?.homeworkNew,
                                            from: val
                                          }
                                        }
                                      };

                                      // Live sync: Revision "to" = New "from" - 1
                                      if (preferredModes.homeworkNew === 'ayah' && val) {
                                        const fromWestern = parseInt(toEnglish(val));
                                        if (!isNaN(fromWestern)) {
                                          const newSurah = prev[studentId]?.homeworkNew?.surah || SURAHS[0];
                                          let revTo: string;
                                          let revToSurah: string;

                                          if (fromWestern <= 1) {
                                            const idx = SURAHS.indexOf(newSurah);
                                            // Check if review is in "reversed" mode (review from-surah comes after new surah)
                                            const revFromSurah = prev[studentId]?.homeworkRev?.surah
                                              || (document.getElementById('hw-rev-surah-select') as HTMLSelectElement)?.value
                                              || SURAHS[0];
                                            const revFromIdx = SURAHS.indexOf(revFromSurah);
                                            const isReversed = revFromIdx > idx;

                                            if (isReversed) {
                                              // Reversed: go to last ayah of surah idx+1 (next surah)
                                              if (idx < SURAHS.length - 1) {
                                                revToSurah = SURAHS[idx + 1];
                                                revTo = toHindiDigits(String(SURAH_AYAH_COUNTS[idx + 1]));
                                              } else {
                                                revToSurah = newSurah;
                                                revTo = '';
                                              }
                                            } else {
                                              // Normal: go to last ayah of surah idx-1 (previous surah)
                                              if (idx > 0) {
                                                revToSurah = SURAHS[idx - 1];
                                                revTo = toHindiDigits(String(SURAH_AYAH_COUNTS[idx - 1]));
                                              } else {
                                                revToSurah = newSurah;
                                                revTo = '';
                                              }
                                            }
                                          } else {
                                            revToSurah = newSurah;
                                            revTo = toHindiDigits(String(fromWestern - 1));
                                          }

                                          next[studentId] = {
                                            ...next[studentId],
                                            homeworkRev: {
                                              ...next[studentId]?.homeworkRev,
                                              to: revTo,
                                              toSurah: revToSurah,
                                            }
                                          };
                                        }
                                      }

                                      return next;
                                    });
                                  }}
                                  style={{}}
                                  className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['hw-new-from'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                                />
                              </div>

                              <div className={`flex-1 ${(preferredModes.homeworkNew === 'ayah' && activeAdvancedAyah.homeworkNew) ? 'hidden' : ''}`}>
                                <label id="hw-new-label-to" className="block text-xl font-medium text-gray-700 mb-1 font-arabic">
                                  {preferredModes.homeworkNew === 'ayah' ? 'إلى الآية' :
                                    preferredModes.homeworkNew === 'page' ? 'إلى صفحة' : ''}
                                </label>
                                <input
                                  id="hw-new-to"
                                  onFocus={handleFocus}
                                  onPointerDown={() => handleInputPointerDown('hw-new-to')}
                                  onPointerUp={handleInputPointerUp}
                                  onPointerLeave={handleInputPointerUp}
                                  type="text"
                                  inputMode="numeric"
                                  autoComplete="off"
                                  value={toHindiDigits(lastReport?.homeworkNew?.to ?? '')}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
                                    setLastReports(prev => {
                                      const studentId = smartReportModal?.studentId;
                                      if (!studentId) return prev;
                                      return {
                                        ...prev,
                                        [studentId]: {
                                          ...prev[studentId],
                                          homeworkNew: {
                                            ...prev[studentId]?.homeworkNew,
                                            to: val
                                          }
                                        }
                                      };
                                    });

                                    // Validation: Cap at maximum Ayahs
                                    if (val && preferredModes.homeworkNew === 'ayah') {
                                      const ayahNum = parseInt(val.replace(/[٠-٩]/g, (d) => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]));
                                      if (!isNaN(ayahNum)) {
                                        const hwNewSurahSelect = document.getElementById('hw-new-surah-select') as HTMLSelectElement;
                                        const currentSurah = hwNewSurahSelect?.value;
                                        const surahIndex = SURAHS.indexOf(currentSurah);

                                        if (surahIndex !== -1) {
                                          const maxAyahs = SURAH_AYAH_COUNTS[surahIndex];
                                          if (ayahNum > maxAyahs) {
                                            e.target.value = toHindiDigits(maxAyahs);
                                          }
                                        }
                                      }
                                    }
                                    setLastReports(prev => {
                                      const studentId = smartReportModal?.studentId;
                                      if (!studentId) return prev;
                                      return {
                                        ...prev,
                                        [studentId]: {
                                          ...prev[studentId],
                                          homeworkNew: {
                                            ...prev[studentId]?.homeworkNew,
                                            to: e.target.value
                                          }
                                        }
                                      };
                                    });
                                  }}
                                  style={{}}
                                  className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['hw-new-to'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                                />
                              </div>
                            </div>
                            {/* ... (rest will be wrapped soon) */}

                            {(preferredModes.homeworkNew === 'ayah' && activeAdvancedAyah.homeworkNew) && (
                              <div className="flex gap-3 items-end">
                                <div className="flex-[2]">
                                  <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">إلى سورة</label>
                                  <SearchableSurahSelect
                                    id="hw-new-to-surah-advanced"
                                    value={lastReports[smartReportModal?.studentId || '']?.homeworkNew?.toSurah || SURAHS[0]}
                                    surahs={SURAHS}
                                    onChange={(val) => {
                                      setLastReports(prev => {
                                        const studentId = smartReportModal?.studentId;
                                        if (!studentId) return prev;
                                        return {
                                          ...prev,
                                          [studentId]: {
                                            ...prev[studentId],
                                            homeworkNew: {
                                              ...prev[studentId]?.homeworkNew,
                                              toSurah: val
                                            }
                                          }
                                        };
                                      });
                                    }}
                                  />
                                </div>
                                <div className="flex-1">
                                  <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">إلى الآية</label>
                                  <input
                                    id="hw-new-to"
                                    onFocus={handleFocus}
                                    onPointerDown={() => handleInputPointerDown('hw-new-to')}
                                    onPointerUp={handleInputPointerUp}
                                    onPointerLeave={handleInputPointerUp}
                                    type="text"
                                    inputMode="numeric"
                                    value={toHindiDigits(lastReport?.homeworkNew?.to ?? '')}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);

                                      setLastReports(prev => {
                                        const studentId = smartReportModal?.studentId;
                                        if (!studentId) return prev;

                                        let finalVal = val;
                                        if (val) {
                                          const currentSurah = prev[studentId]?.homeworkNew?.toSurah || SURAHS[0];
                                          const surahIndex = SURAHS.indexOf(currentSurah);

                                          if (surahIndex !== -1) {
                                            const totalAyahs = SURAH_AYAH_COUNTS[surahIndex];
                                            const endAyahNum = parseInt(val.replace(/[٠-٩]/g, (d) => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]));

                                            if (!isNaN(endAyahNum) && endAyahNum > totalAyahs) {
                                              finalVal = toHindiDigits(totalAyahs);
                                              e.target.value = finalVal;
                                            }
                                          }
                                        }

                                        return {
                                          ...prev,
                                          [studentId]: {
                                            ...prev[studentId],
                                            homeworkNew: {
                                              ...prev[studentId]?.homeworkNew,
                                              to: finalVal
                                            }
                                          }
                                        };
                                      });
                                    }}
                                    style={{}}
                                    className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['hw-new-to'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                                  />
                                </div>
                              </div>
                            )}

                            {preferredModes.homeworkNew === 'ayah' && (
                              <div className="flex justify-center relative z-10">
                                <button
                                  onClick={() => setActiveAdvancedAyah(prev => {
                                    const nextVal = !prev.homeworkNew;
                                    const next = { ...prev, homeworkNew: nextVal, readingNew: nextVal };
                                    setLastReports(lastPrev => {
                                      const studentId = smartReportModal?.studentId;
                                      if (!studentId) return lastPrev;
                                      return {
                                        ...lastPrev,
                                        [studentId]: {
                                          ...lastPrev[studentId],
                                          homeworkNew: {
                                            ...lastPrev[studentId]?.homeworkNew,
                                            isAdvancedAyah: nextVal
                                          },
                                          readingNew: {
                                            ...lastPrev[studentId]?.readingNew,
                                            isAdvancedAyah: nextVal
                                          }
                                        }
                                      };
                                    });
                                    return next;
                                  })}
                                  className={`p-1 rounded-full border shadow-sm transition-all ${activeAdvancedAyah.homeworkNew ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-gray-200 text-gray-400 hover:text-indigo-500'}`}
                                  title={activeAdvancedAyah.homeworkNew ? "إلغاء الوضع المتقدم" : "تفعيل الوضع المتقدم"}
                                >
                                  {activeAdvancedAyah.homeworkNew ? <Minus size={14} /> : <Plus size={14} />}
                                </button>
                              </div>
                            )}

                          </div>
                        </>
                      )}
                    </div>

                    {/* 2. Revision Homework Section (المراجعة) */}
                    <div className={`space-y-3 pt-4 border-t border-black/30 transition-opacity duration-200 lg:col-start-2 lg:row-start-3 ${!sectionToggles.homeworkRev ? 'opacity-40' : ''}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSectionToggles(prev => {
                              const next = { ...prev, homeworkRev: !prev.homeworkRev };
                              setLastReports(lastPrev => {
                                const studentId = smartReportModal?.studentId;
                                if (!studentId) return lastPrev;
                                return {
                                  ...lastPrev,
                                  [studentId]: {
                                    ...lastPrev[studentId],
                                    sectionToggles: next
                                  }
                                };
                              });
                              return next;
                            })}
                            className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${sectionToggles.homeworkRev ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-gray-300 bg-white'}`}
                          >
                            {sectionToggles.homeworkRev && <Check size={14} strokeWidth={3} />}
                          </button>
                          <h3 className="text-2xl font-bold text-gray-700 font-arabic">المراجعة</h3>
                        </div>
                        <div className={`flex gap-1 p-1 bg-gray-100 rounded-lg ${!sectionToggles.homeworkRev ? 'hidden' : ''}`}>
                          <button
                            id="hw-rev-mode-ayah"
                            onClick={() => {
                              setPreferredModes(prev => ({ ...prev, homeworkRev: 'ayah' }));
                              setLastReports(prev => {
                                const studentId = smartReportModal?.studentId;
                                if (!studentId) return prev;
                                return { ...prev, [studentId]: { ...prev[studentId], homeworkRev: { ...prev[studentId]?.homeworkRev, mode: 'ayah' } } };
                              });
                            }}
                            className={`px-2 py-1 rounded-md text-xs font-arabic font-bold transition-all ${preferredModes.homeworkRev === 'ayah' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500'}`}
                          >
                            آيات
                          </button>
                          <button
                            id="hw-rev-mode-page"
                            onClick={() => {
                              setPreferredModes(prev => ({ ...prev, homeworkRev: 'page' }));
                              setLastReports(prev => {
                                const studentId = smartReportModal?.studentId;
                                if (!studentId) return prev;
                                return { ...prev, [studentId]: { ...prev[studentId], homeworkRev: { ...prev[studentId]?.homeworkRev, mode: 'page' } } };
                              });
                            }}
                            className={`px-2 py-1 rounded-md text-xs font-arabic font-bold transition-all ${preferredModes.homeworkRev === 'page' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500'}`}
                          >
                            صفحات
                          </button>
                          <button
                            id="hw-rev-mode-juz"
                            onClick={() => {
                              setPreferredModes(prev => ({ ...prev, homeworkRev: 'juz' }));
                              setLastReports(prev => {
                                const studentId = smartReportModal?.studentId;
                                if (!studentId) return prev;
                                return { ...prev, [studentId]: { ...prev[studentId], homeworkRev: { ...prev[studentId]?.homeworkRev, mode: 'juz' } } };
                              });
                            }}
                            className={`px-2 py-1 rounded-md text-xs font-arabic font-bold transition-all ${preferredModes.homeworkRev === 'juz' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500'}`}
                          >
                            أجزاء
                          </button>
                          <button
                            id="hw-rev-mode-hizb"
                            onClick={() => {
                              setPreferredModes(prev => ({ ...prev, homeworkRev: 'hizb' }));
                              setLastReports(prev => {
                                const studentId = smartReportModal?.studentId;
                                if (!studentId) return prev;
                                return { ...prev, [studentId]: { ...prev[studentId], homeworkRev: { ...prev[studentId]?.homeworkRev, mode: 'hizb' } } };
                              });
                            }}
                            className={`px-2 py-1 rounded-md text-xs font-arabic font-bold transition-all ${preferredModes.homeworkRev === 'hizb' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500'}`}
                          >
                            أحزاب
                          </button>
                        </div>
                      </div>

                      {sectionToggles.homeworkRev && (
                        <>
                          <div className="flex items-center gap-5 mb-4 flex-wrap">
                            {/* Redo Checkbox (Revision) */}
                            <div className="flex items-center gap-2 w-fit">
                              <input
                                type="checkbox"
                                id="hw-rev-redo-checkbox"
                                checked={isRedoModeRev}
                                onChange={(e) => {
                                  setIsRedoModeRev(e.target.checked);
                                }}
                                className="w-5 h-5 text-rose-600 rounded focus:ring-rose-500 border-gray-300"
                              />
                              <label htmlFor="hw-rev-redo-checkbox" className="text-base font-bold text-gray-700 font-arabic select-none cursor-pointer">
                                إعادة
                              </label>
                            </div>

                            <label className="flex items-center gap-1.5 cursor-pointer hover:bg-white/50 p-1 rounded-md transition-colors">
                              <input
                                type="checkbox"
                                checked={excludeHomeworkRev}
                                onChange={(e) => setExcludeHomeworkRev(e.target.checked)}
                                className="w-3.5 h-3.5 text-amber-500 rounded border-gray-300 focus:ring-amber-500"
                              />
                              <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                                {excludeHomeworkRev ? <EyeOff size={14} /> : <Eye size={14} />}
                                إخفاء من التقرير
                              </span>
                            </label>
                          </div>

                          {/* Surah Mode Inputs (Rev) */}
                          <div id="hw-rev-inputs-surah-mode" className={`flex gap-3 items-end ${preferredModes.homeworkRev === 'surah' ? '' : 'hidden'}`}>
                            <div className="flex-1">
                              <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">من سورة</label>
                              <SearchableSurahSelect
                                id="hw-rev-from-surah"
                                value={lastReports[smartReportModal?.studentId || '']?.homeworkRev?.fromSurah || SURAHS[0]}
                                surahs={SURAHS}
                                onChange={(val) => {
                                  setLastReports(prev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return prev;
                                    return {
                                      ...prev,
                                      [studentId]: {
                                        ...prev[studentId],
                                        homeworkRev: {
                                          ...prev[studentId]?.homeworkRev,
                                          fromSurah: val,
                                          mode: 'surah'
                                        }
                                      }
                                    };
                                  });
                                }}
                              />
                            </div>
                            <div className="flex-1">
                              <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">إلى سورة</label>
                              <SearchableSurahSelect
                                id="hw-rev-to-surah"
                                value={lastReports[smartReportModal?.studentId || '']?.homeworkRev?.toSurah || SURAHS[0]}
                                surahs={SURAHS}
                                onChange={(val) => {
                                  setLastReports(prev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return prev;
                                    return {
                                      ...prev,
                                      [studentId]: {
                                        ...prev[studentId],
                                        homeworkRev: {
                                          ...prev[studentId]?.homeworkRev,
                                          toSurah: val,
                                          mode: 'surah'
                                        }
                                      }
                                    };
                                  });
                                }}
                              />
                            </div>
                          </div>

                          <div className={`flex flex-col gap-3 ${preferredModes.homeworkRev === 'surah' ? 'hidden' : ''}`}>
                            <div className="flex gap-3 items-end">
                              <div id="hw-rev-surah-container" className={`flex-[2] ${preferredModes.homeworkRev === 'ayah' ? '' : 'hidden'}`}>
                                <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">
                                  {activeAdvancedAyah.homeworkRev ? 'من سورة' : 'السورة'}
                                </label>
                                <SearchableSurahSelect
                                  id="hw-rev-surah-select"
                                  value={lastReport?.homeworkRev?.surah || SURAHS[0]}
                                  surahs={SURAHS}
                                  onChange={(val) => {
                                    setLastReports(prev => {
                                      const studentId = smartReportModal?.studentId;
                                      if (!studentId) return prev;
                                      return {
                                        ...prev,
                                        [studentId]: {
                                          ...prev[studentId],
                                          homeworkRev: {
                                            ...prev[studentId]?.homeworkRev,
                                            surah: val,
                                            mode: 'ayah'
                                          }
                                        }
                                      };
                                    });
                                  }}
                                />
                              </div>

                              <div className="flex-1">
                                <label id="hw-rev-label-from" className="block text-xl font-medium text-gray-700 mb-1 font-arabic">
                                  {preferredModes.homeworkRev === 'ayah' ? 'من الآية' :
                                    preferredModes.homeworkRev === 'page' ? 'من صفحة' :
                                      preferredModes.homeworkRev === 'juz' ? 'من جزء' : 'من حزب'}
                                </label>
                                <input
                                  id="hw-rev-from"
                                  onFocus={handleFocus}
                                  onPointerDown={() => handleInputPointerDown('hw-rev-from')}
                                  onPointerUp={handleInputPointerUp}
                                  onPointerLeave={handleInputPointerUp}
                                  type="text"
                                  inputMode="numeric"
                                  autoComplete="off"
                                  value={toHindiDigits(lastReport?.homeworkRev?.from ?? '')}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);

                                    setLastReports(prev => {
                                      const studentId = smartReportModal?.studentId;
                                      if (!studentId) return prev;
                                      return {
                                        ...prev,
                                        [studentId]: {
                                          ...prev[studentId],
                                          homeworkRev: {
                                            ...prev[studentId]?.homeworkRev,
                                            from: val,
                                            mode: preferredModes.homeworkRev || 'page'
                                          }
                                        }
                                      };
                                    });
                                  }}
                                  style={{}}
                                  className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['hw-rev-from'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                                />
                              </div>

                              <div className={`flex-1 ${(preferredModes.homeworkRev === 'ayah' && activeAdvancedAyah.homeworkRev) ? 'hidden' : ''}`}>
                                <label id="hw-rev-label-to" className="block text-xl font-medium text-gray-700 mb-1 font-arabic">
                                  {preferredModes.homeworkRev === 'ayah' ? 'إلى الآية' :
                                    preferredModes.homeworkRev === 'page' ? 'إلى صفحة' :
                                      preferredModes.homeworkRev === 'juz' ? 'إلى جزء' : 'إلى حزب'}
                                </label>
                                <input
                                  id="hw-rev-to"
                                  onFocus={handleFocus}
                                  onPointerDown={() => handleInputPointerDown('hw-rev-to')}
                                  onPointerUp={handleInputPointerUp}
                                  onPointerLeave={handleInputPointerUp}
                                  type="text"
                                  inputMode="numeric"
                                  autoComplete="off"
                                  value={toHindiDigits(lastReport?.homeworkRev?.to ?? '')}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);

                                    setLastReports(prev => {
                                      const studentId = smartReportModal?.studentId;
                                      if (!studentId) return prev;

                                      let finalVal = val;

                                      // Validation: Cap at maximum Ayahs
                                      if (val && preferredModes.homeworkRev === 'ayah') {
                                        const ayahNum = parseInt(val.replace(/[٠-٩]/g, (d) => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]));
                                        if (!isNaN(ayahNum)) {
                                          const currentSurah = prev[studentId]?.homeworkRev?.surah || SURAHS[0];
                                          const surahIndex = SURAHS.indexOf(currentSurah);

                                          if (surahIndex !== -1) {
                                            const maxAyahs = SURAH_AYAH_COUNTS[surahIndex];
                                            if (ayahNum > maxAyahs) {
                                              finalVal = toHindiDigits(maxAyahs);
                                            }
                                          }
                                        }
                                      }

                                      return {
                                        ...prev,
                                        [studentId]: {
                                          ...prev[studentId],
                                          homeworkRev: {
                                            ...prev[studentId]?.homeworkRev,
                                            to: finalVal
                                          }
                                        }
                                      };
                                    });
                                  }}
                                  style={{}}
                                  className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['hw-rev-to'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                                />
                              </div>
                            </div>

                            {(preferredModes.homeworkRev === 'ayah' && activeAdvancedAyah.homeworkRev) && (
                              <div className="flex gap-3 items-end">
                                <div className="flex-[2]">
                                  <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">إلى سورة</label>
                                  <SearchableSurahSelect
                                    id="hw-rev-to-surah-advanced"
                                    value={lastReport?.homeworkRev?.toSurah || SURAHS[0]}
                                    surahs={SURAHS}
                                    onChange={(val) => {
                                      setLastReports(prev => {
                                        const studentId = smartReportModal?.studentId;
                                        if (!studentId) return prev;
                                        return {
                                          ...prev,
                                          [studentId]: {
                                            ...prev[studentId],
                                            homeworkRev: {
                                              ...prev[studentId]?.homeworkRev,
                                              toSurah: val
                                            }
                                          }
                                        };
                                      });
                                    }}
                                  />
                                </div>
                                <div className="flex-1">
                                  <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">إلى الآية</label>
                                  <input
                                    id="hw-rev-to"
                                    onFocus={handleFocus}
                                    onPointerDown={() => handleInputPointerDown('hw-rev-to')}
                                    onPointerUp={handleInputPointerUp}
                                    onPointerLeave={handleInputPointerUp}
                                    type="text"
                                    inputMode="numeric"
                                    value={toHindiDigits(lastReport?.homeworkRev?.to ?? '')}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);

                                      setLastReports(prev => {
                                        const studentId = smartReportModal?.studentId;
                                        if (!studentId) return prev;

                                        let finalVal = val;

                                        // Validation: Cap at maximum Ayahs (using Advanced Mode context)
                                        if (val) {
                                          const ayahNum = parseInt(val.replace(/[٠-٩]/g, (d) => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]));
                                          if (!isNaN(ayahNum)) {
                                            const currentSurah = prev[studentId]?.homeworkRev?.toSurah || prev[studentId]?.homeworkRev?.surah || SURAHS[0];
                                            const surahIndex = SURAHS.indexOf(currentSurah);
                                            if (surahIndex !== -1) {
                                              const maxAyahs = SURAH_AYAH_COUNTS[surahIndex];
                                              if (ayahNum > maxAyahs) {
                                                finalVal = toHindiDigits(maxAyahs);
                                              }
                                            }
                                          }
                                        }

                                        return {
                                          ...prev,
                                          [studentId]: {
                                            ...prev[studentId],
                                            homeworkRev: {
                                              ...prev[studentId]?.homeworkRev,
                                              to: finalVal,
                                              mode: preferredModes.homeworkRev || 'page'
                                            }
                                          }
                                        };
                                      });
                                    }}
                                    style={{}}
                                    className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['hw-rev-to'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                                  />
                                </div>
                              </div>
                            )}

                            {preferredModes.homeworkRev === 'ayah' && (
                              <div className="flex justify-center relative z-10">
                                <button
                                  onClick={() => setActiveAdvancedAyah(prev => {
                                    const nextVal = !prev.homeworkRev;
                                    const next = { ...prev, homeworkRev: nextVal, readingRev: nextVal };
                                    setLastReports(lastPrev => {
                                      const studentId = smartReportModal?.studentId;
                                      if (!studentId) return lastPrev;
                                      return {
                                        ...lastPrev,
                                        [studentId]: {
                                          ...lastPrev[studentId],
                                          homeworkRev: {
                                            ...lastPrev[studentId]?.homeworkRev,
                                            isAdvancedAyah: nextVal
                                          },
                                          readingRev: {
                                            ...lastPrev[studentId]?.readingRev,
                                            isAdvancedAyah: nextVal
                                          }
                                        }
                                      };
                                    });
                                    return next;
                                  })}
                                  className={`p-1 rounded-full border shadow-sm transition-all ${activeAdvancedAyah.homeworkRev ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-gray-200 text-gray-400 hover:text-indigo-500'}`}
                                  title={activeAdvancedAyah.homeworkRev ? "إلغاء الوضع المتقدم" : "تفعيل الوضع المتقدم"}
                                >
                                  {activeAdvancedAyah.homeworkRev ? <Minus size={14} /> : <Plus size={14} />}
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* 2.5. Old Revision Homework Section (المراجعة) */}
                    <div className={`space-y-3 pt-4 border-t border-black/30 transition-opacity duration-200 lg:col-start-2 lg:row-start-4 ${!sectionToggles.homeworkOldRev ? 'opacity-40' : ''}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSectionToggles(prev => {
                              const next = { ...prev, homeworkOldRev: !prev.homeworkOldRev };
                              setLastReports(lastPrev => {
                                const studentId = smartReportModal?.studentId;
                                if (!studentId) return lastPrev;
                                return {
                                  ...lastPrev,
                                  [studentId]: {
                                    ...lastPrev[studentId],
                                    sectionToggles: next
                                  }
                                };
                              });
                              return next;
                            })}
                            className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${sectionToggles.homeworkOldRev ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-gray-300 bg-white'}`}
                          >
                            {sectionToggles.homeworkOldRev && <Check size={14} strokeWidth={3} />}
                          </button>
                          <h3 className="text-2xl font-bold text-gray-700 font-arabic">المراجعة البعيدة</h3>
                        </div>
                        <div className={`flex gap-1 p-1 bg-gray-100 rounded-lg ${!sectionToggles.homeworkOldRev ? 'hidden' : ''}`}>
                          <button
                            id="hw-oldrev-mode-ayah"
                            onClick={() => {
                              setPreferredModes(prev => ({ ...prev, homeworkOldRev: 'ayah' }));
                              setLastReports(prev => {
                                const studentId = smartReportModal?.studentId;
                                if (!studentId) return prev;
                                return { ...prev, [studentId]: { ...prev[studentId], homeworkOldRev: { ...prev[studentId]?.homeworkOldRev, mode: 'ayah' } } };
                              });
                            }}
                            className={`px-2 py-1 rounded-md text-xs font-arabic font-bold transition-all ${preferredModes.homeworkOldRev === 'ayah' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500'}`}
                          >
                            آيات
                          </button>
                          <button
                            id="hw-oldrev-mode-page"
                            onClick={() => {
                              setPreferredModes(prev => ({ ...prev, homeworkOldRev: 'page' }));
                              setLastReports(prev => {
                                const studentId = smartReportModal?.studentId;
                                if (!studentId) return prev;
                                return { ...prev, [studentId]: { ...prev[studentId], homeworkOldRev: { ...prev[studentId]?.homeworkOldRev, mode: 'page' } } };
                              });
                            }}
                            className={`px-2 py-1 rounded-md text-xs font-arabic font-bold transition-all ${preferredModes.homeworkOldRev === 'page' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500'}`}
                          >
                            صفحات
                          </button>
                          <button
                            id="hw-oldrev-mode-juz"
                            onClick={() => {
                              setPreferredModes(prev => ({ ...prev, homeworkOldRev: 'juz' }));
                              setLastReports(prev => {
                                const studentId = smartReportModal?.studentId;
                                if (!studentId) return prev;
                                return { ...prev, [studentId]: { ...prev[studentId], homeworkOldRev: { ...prev[studentId]?.homeworkOldRev, mode: 'juz' } } };
                              });
                            }}
                            className={`px-2 py-1 rounded-md text-xs font-arabic font-bold transition-all ${preferredModes.homeworkOldRev === 'juz' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500'}`}
                          >
                            أجزاء
                          </button>
                          <button
                            id="hw-oldrev-mode-hizb"
                            onClick={() => {
                              setPreferredModes(prev => ({ ...prev, homeworkOldRev: 'hizb' }));
                              setLastReports(prev => {
                                const studentId = smartReportModal?.studentId;
                                if (!studentId) return prev;
                                return { ...prev, [studentId]: { ...prev[studentId], homeworkOldRev: { ...prev[studentId]?.homeworkOldRev, mode: 'hizb' } } };
                              });
                            }}
                            className={`px-2 py-1 rounded-md text-xs font-arabic font-bold transition-all ${preferredModes.homeworkOldRev === 'hizb' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500'}`}
                          >
                            أحزاب
                          </button>
                        </div>
                      </div>

                      {sectionToggles.homeworkOldRev && (
                        <>
                          <div className="flex items-center gap-5 mb-4 flex-wrap">
                            {/* Redo Checkbox (Revision) */}
                            <div className="flex items-center gap-2 w-fit">
                              <input
                                type="checkbox"
                                id="hw-oldrev-redo-checkbox"
                                checked={isRedoModeOldRev}
                                onChange={(e) => {
                                  setIsRedoModeOldRev(e.target.checked);
                                }}
                                className="w-5 h-5 text-rose-600 rounded focus:ring-rose-500 border-gray-300"
                              />
                              <label htmlFor="hw-oldrev-redo-checkbox" className="text-base font-bold text-gray-700 font-arabic select-none cursor-pointer">
                                إعادة
                              </label>
                            </div>

                            <label className="flex items-center gap-1.5 cursor-pointer hover:bg-white/50 p-1 rounded-md transition-colors">
                              <input
                                type="checkbox"
                                checked={excludeHomeworkOldRev}
                                onChange={(e) => setExcludeHomeworkOldRev(e.target.checked)}
                                className="w-3.5 h-3.5 text-amber-500 rounded border-gray-300 focus:ring-amber-500"
                              />
                              <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                                {excludeHomeworkOldRev ? <EyeOff size={14} /> : <Eye size={14} />}
                                إخفاء من التقرير
                              </span>
                            </label>
                          </div>

                          {/* Surah Mode Inputs (Rev) */}
                          <div id="hw-oldrev-inputs-surah-mode" className={`flex gap-3 items-end ${preferredModes.homeworkOldRev === 'surah' ? '' : 'hidden'}`}>
                            <div className="flex-1">
                              <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">من سورة</label>
                              <SearchableSurahSelect
                                id="hw-oldrev-from-surah"
                                value={lastReports[smartReportModal?.studentId || '']?.homeworkOldRev?.fromSurah || SURAHS[0]}
                                surahs={SURAHS}
                                onChange={(val) => {
                                  setLastReports(prev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return prev;
                                    return {
                                      ...prev,
                                      [studentId]: {
                                        ...prev[studentId],
                                        homeworkOldRev: {
                                          ...prev[studentId]?.homeworkOldRev,
                                          fromSurah: val,
                                          mode: 'surah'
                                        }
                                      }
                                    };
                                  });
                                }}
                              />
                            </div>
                            <div className="flex-1">
                              <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">إلى سورة</label>
                              <SearchableSurahSelect
                                id="hw-oldrev-to-surah"
                                value={lastReports[smartReportModal?.studentId || '']?.homeworkOldRev?.toSurah || SURAHS[0]}
                                surahs={SURAHS}
                                onChange={(val) => {
                                  setLastReports(prev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return prev;
                                    return {
                                      ...prev,
                                      [studentId]: {
                                        ...prev[studentId],
                                        homeworkOldRev: {
                                          ...prev[studentId]?.homeworkOldRev,
                                          toSurah: val,
                                          mode: 'surah'
                                        }
                                      }
                                    };
                                  });
                                }}
                              />
                            </div>
                          </div>

                          <div className={`flex flex-col gap-3 ${preferredModes.homeworkOldRev === 'surah' ? 'hidden' : ''}`}>
                            <div className="flex gap-3 items-end">
                              <div id="hw-oldrev-surah-container" className={`flex-[2] ${preferredModes.homeworkOldRev === 'ayah' ? '' : 'hidden'}`}>
                                <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">
                                  {activeAdvancedAyah.homeworkOldRev ? 'من سورة' : 'السورة'}
                                </label>
                                <SearchableSurahSelect
                                  id="hw-oldrev-surah-select"
                                  value={lastReport?.homeworkOldRev?.surah || SURAHS[0]}
                                  surahs={SURAHS}
                                  onChange={(val) => {
                                    setLastReports(prev => {
                                      const studentId = smartReportModal?.studentId;
                                      if (!studentId) return prev;
                                      return {
                                        ...prev,
                                        [studentId]: {
                                          ...prev[studentId],
                                          homeworkOldRev: {
                                            ...prev[studentId]?.homeworkOldRev,
                                            surah: val,
                                            mode: 'ayah'
                                          }
                                        }
                                      };
                                    });
                                  }}
                                />
                              </div>

                              <div className="flex-1">
                                <label id="hw-oldrev-label-from" className="block text-xl font-medium text-gray-700 mb-1 font-arabic">
                                  {preferredModes.homeworkOldRev === 'ayah' ? 'من الآية' :
                                    preferredModes.homeworkOldRev === 'page' ? 'من صفحة' :
                                      preferredModes.homeworkOldRev === 'juz' ? 'من جزء' : 'من حزب'}
                                </label>
                                <input
                                  id="hw-oldrev-from"
                                  onFocus={handleFocus}
                                  onPointerDown={() => handleInputPointerDown('hw-oldrev-from')}
                                  onPointerUp={handleInputPointerUp}
                                  onPointerLeave={handleInputPointerUp}
                                  type="text"
                                  inputMode="numeric"
                                  autoComplete="off"
                                  value={toHindiDigits(lastReport?.homeworkOldRev?.from ?? '')}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);

                                    setLastReports(prev => {
                                      const studentId = smartReportModal?.studentId;
                                      if (!studentId) return prev;
                                      return {
                                        ...prev,
                                        [studentId]: {
                                          ...prev[studentId],
                                          homeworkOldRev: {
                                            ...prev[studentId]?.homeworkOldRev,
                                            from: val,
                                            mode: preferredModes.homeworkOldRev || 'page'
                                          }
                                        }
                                      };
                                    });
                                  }}
                                  style={{}}
                                  className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['hw-oldrev-from'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                                />
                              </div>

                              <div className={`flex-1 ${(preferredModes.homeworkOldRev === 'ayah' && activeAdvancedAyah.homeworkOldRev) ? 'hidden' : ''}`}>
                                <label id="hw-oldrev-label-to" className="block text-xl font-medium text-gray-700 mb-1 font-arabic">
                                  {preferredModes.homeworkOldRev === 'ayah' ? 'إلى الآية' :
                                    preferredModes.homeworkOldRev === 'page' ? 'إلى صفحة' :
                                      preferredModes.homeworkOldRev === 'juz' ? 'إلى جزء' : 'إلى حزب'}
                                </label>
                                <input
                                  id="hw-oldrev-to"
                                  onFocus={handleFocus}
                                  onPointerDown={() => handleInputPointerDown('hw-oldrev-to')}
                                  onPointerUp={handleInputPointerUp}
                                  onPointerLeave={handleInputPointerUp}
                                  type="text"
                                  inputMode="numeric"
                                  autoComplete="off"
                                  value={toHindiDigits(lastReport?.homeworkOldRev?.to ?? '')}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);

                                    setLastReports(prev => {
                                      const studentId = smartReportModal?.studentId;
                                      if (!studentId) return prev;

                                      let finalVal = val;

                                      // Validation: Cap at maximum Ayahs
                                      if (val && preferredModes.homeworkOldRev === 'ayah') {
                                        const ayahNum = parseInt(val.replace(/[٠-٩]/g, (d) => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]));
                                        if (!isNaN(ayahNum)) {
                                          const currentSurah = prev[studentId]?.homeworkOldRev?.surah || SURAHS[0];
                                          const surahIndex = SURAHS.indexOf(currentSurah);

                                          if (surahIndex !== -1) {
                                            const maxAyahs = SURAH_AYAH_COUNTS[surahIndex];
                                            if (ayahNum > maxAyahs) {
                                              finalVal = toHindiDigits(maxAyahs);
                                            }
                                          }
                                        }
                                      }

                                      return {
                                        ...prev,
                                        [studentId]: {
                                          ...prev[studentId],
                                          homeworkOldRev: {
                                            ...prev[studentId]?.homeworkOldRev,
                                            to: finalVal
                                          }
                                        }
                                      };
                                    });
                                  }}
                                  style={{}}
                                  className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['hw-oldrev-to'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                                />
                              </div>
                            </div>

                            {(preferredModes.homeworkOldRev === 'ayah' && activeAdvancedAyah.homeworkOldRev) && (
                              <div className="flex gap-3 items-end">
                                <div className="flex-[2]">
                                  <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">إلى سورة</label>
                                  <SearchableSurahSelect
                                    id="hw-oldrev-to-surah-advanced"
                                    value={lastReport?.homeworkOldRev?.toSurah || SURAHS[0]}
                                    surahs={SURAHS}
                                    onChange={(val) => {
                                      setLastReports(prev => {
                                        const studentId = smartReportModal?.studentId;
                                        if (!studentId) return prev;
                                        return {
                                          ...prev,
                                          [studentId]: {
                                            ...prev[studentId],
                                            homeworkOldRev: {
                                              ...prev[studentId]?.homeworkOldRev,
                                              toSurah: val
                                            }
                                          }
                                        };
                                      });
                                    }}
                                  />
                                </div>
                                <div className="flex-1">
                                  <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">إلى الآية</label>
                                  <input
                                    id="hw-oldrev-to"
                                    onFocus={handleFocus}
                                    onPointerDown={() => handleInputPointerDown('hw-oldrev-to')}
                                    onPointerUp={handleInputPointerUp}
                                    onPointerLeave={handleInputPointerUp}
                                    type="text"
                                    inputMode="numeric"
                                    value={toHindiDigits(lastReport?.homeworkOldRev?.to ?? '')}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);

                                      setLastReports(prev => {
                                        const studentId = smartReportModal?.studentId;
                                        if (!studentId) return prev;

                                        let finalVal = val;

                                        // Validation: Cap at maximum Ayahs (using Advanced Mode context)
                                        if (val) {
                                          const ayahNum = parseInt(val.replace(/[٠-٩]/g, (d) => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]));
                                          if (!isNaN(ayahNum)) {
                                            const currentSurah = prev[studentId]?.homeworkOldRev?.toSurah || prev[studentId]?.homeworkOldRev?.surah || SURAHS[0];
                                            const surahIndex = SURAHS.indexOf(currentSurah);
                                            if (surahIndex !== -1) {
                                              const maxAyahs = SURAH_AYAH_COUNTS[surahIndex];
                                              if (ayahNum > maxAyahs) {
                                                finalVal = toHindiDigits(maxAyahs);
                                              }
                                            }
                                          }
                                        }

                                        return {
                                          ...prev,
                                          [studentId]: {
                                            ...prev[studentId],
                                            homeworkOldRev: {
                                              ...prev[studentId]?.homeworkOldRev,
                                              to: finalVal,
                                              mode: preferredModes.homeworkOldRev || 'page'
                                            }
                                          }
                                        };
                                      });
                                    }}
                                    style={{}}
                                    className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['hw-oldrev-to'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                                  />
                                </div>
                              </div>
                            )}

                            {preferredModes.homeworkOldRev === 'ayah' && (
                              <div className="flex justify-center relative z-10">
                                <button
                                  onClick={() => setActiveAdvancedAyah(prev => {
                                    const nextVal = !prev.homeworkOldRev;
                                    const next = { ...prev, homeworkOldRev: nextVal, readingOldRev: nextVal };
                                    setLastReports(lastPrev => {
                                      const studentId = smartReportModal?.studentId;
                                      if (!studentId) return lastPrev;
                                      return {
                                        ...lastPrev,
                                        [studentId]: {
                                          ...lastPrev[studentId],
                                          homeworkOldRev: {
                                            ...lastPrev[studentId]?.homeworkOldRev,
                                            isAdvancedAyah: nextVal
                                          },
                                          readingOldRev: {
                                            ...lastPrev[studentId]?.readingOldRev,
                                            isAdvancedAyah: nextVal
                                          }
                                        }
                                      };
                                    });
                                    return next;
                                  })}
                                  className={`p-1 rounded-full border shadow-sm transition-all ${activeAdvancedAyah.homeworkOldRev ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-gray-200 text-gray-400 hover:text-indigo-500'}`}
                                  title={activeAdvancedAyah.homeworkOldRev ? "إلغاء الوضع المتقدم" : "تفعيل الوضع المتقدم"}
                                >
                                  {activeAdvancedAyah.homeworkOldRev ? <Minus size={14} /> : <Plus size={14} />}
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* 3. Tilawa Homework Section (القراءة) */}
                    <div className={`space-y-3 pt-4 border-t border-black/30 transition-opacity duration-200 lg:col-start-2 lg:row-start-5 ${!sectionToggles.homeworkTilawa ? 'opacity-40' : ''}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSectionToggles(prev => {
                              const next = { ...prev, homeworkTilawa: !prev.homeworkTilawa };
                              setLastReports(lastPrev => {
                                const studentId = smartReportModal?.studentId;
                                if (!studentId) return lastPrev;
                                return {
                                  ...lastPrev,
                                  [studentId]: {
                                    ...lastPrev[studentId],
                                    sectionToggles: next
                                  }
                                };
                              });
                              return next;
                            })}
                            className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${sectionToggles.homeworkTilawa ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-gray-300 bg-white'}`}
                          >
                            {sectionToggles.homeworkTilawa && <Check size={14} strokeWidth={3} />}
                          </button>
                          <h3 className="text-2xl font-bold text-gray-700 font-arabic">القراءة</h3>
                        </div>
                        <div className={`flex gap-1 p-1 bg-gray-100 rounded-lg ${!sectionToggles.homeworkTilawa ? 'hidden' : ''}`}>
                          <button
                            id="hw-tilawa-mode-ayah"
                            onClick={() => {
                              setPreferredModes(prev => ({ ...prev, homeworkTilawa: 'ayah' }));
                              setLastReports(prev => {
                                const studentId = smartReportModal?.studentId;
                                if (!studentId) return prev;
                                return { ...prev, [studentId]: { ...prev[studentId], homeworkTilawa: { ...prev[studentId]?.homeworkTilawa, mode: 'ayah' } } };
                              });
                            }}
                            className={`px-2 py-1 rounded-md text-xs font-arabic font-bold transition-all ${preferredModes.homeworkTilawa === 'ayah' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500'}`}
                          >
                            آيات
                          </button>
                          <button
                            id="hw-tilawa-mode-page"
                            onClick={() => {
                              setPreferredModes(prev => ({ ...prev, homeworkTilawa: 'page' }));
                              setLastReports(prev => {
                                const studentId = smartReportModal?.studentId;
                                if (!studentId) return prev;
                                return { ...prev, [studentId]: { ...prev[studentId], homeworkTilawa: { ...prev[studentId]?.homeworkTilawa, mode: 'page' } } };
                              });
                            }}
                            className={`px-2 py-1 rounded-md text-xs font-arabic font-bold transition-all ${preferredModes.homeworkTilawa === 'page' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500'}`}
                          >
                            صفحات
                          </button>
                          <button
                            id="hw-tilawa-mode-juz"
                            onClick={() => {
                              setPreferredModes(prev => ({ ...prev, homeworkTilawa: 'juz' }));
                              setLastReports(prev => {
                                const studentId = smartReportModal?.studentId;
                                if (!studentId) return prev;
                                return { ...prev, [studentId]: { ...prev[studentId], homeworkTilawa: { ...prev[studentId]?.homeworkTilawa, mode: 'juz' } } };
                              });
                            }}
                            className={`px-2 py-1 rounded-md text-xs font-arabic font-bold transition-all ${preferredModes.homeworkTilawa === 'juz' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500'}`}
                          >
                            أجزاء
                          </button>
                          <button
                            id="hw-tilawa-mode-hizb"
                            onClick={() => {
                              setPreferredModes(prev => ({ ...prev, homeworkTilawa: 'hizb' }));
                              setLastReports(prev => {
                                const studentId = smartReportModal?.studentId;
                                if (!studentId) return prev;
                                return { ...prev, [studentId]: { ...prev[studentId], homeworkTilawa: { ...prev[studentId]?.homeworkTilawa, mode: 'hizb' } } };
                              });
                            }}
                            className={`px-2 py-1 rounded-md text-xs font-arabic font-bold transition-all ${preferredModes.homeworkTilawa === 'hizb' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500'}`}
                          >
                            أحزاب
                          </button>
                        </div>
                      </div>

                      {sectionToggles.homeworkTilawa && (
                        <>
                          <div className="flex items-center gap-5 mb-4 flex-wrap">
                            {/* Redo Checkbox (Tilawa) */}
                            <div className="flex items-center gap-2 w-fit">
                              <input
                                type="checkbox"
                                id="hw-tilawa-redo-checkbox"
                                checked={isRedoModeTilawa}
                                onChange={(e) => {
                                  setIsRedoModeTilawa(e.target.checked);
                                }}
                                className="w-5 h-5 text-rose-600 rounded focus:ring-rose-500 border-gray-300"
                              />
                              <label htmlFor="hw-tilawa-redo-checkbox" className="text-base font-bold text-gray-700 font-arabic select-none cursor-pointer">
                                إعادة
                              </label>
                            </div>

                            <label className="flex items-center gap-1.5 cursor-pointer hover:bg-white/50 p-1 rounded-md transition-colors">
                              <input
                                type="checkbox"
                                checked={excludeHomeworkTilawa}
                                onChange={(e) => setExcludeHomeworkTilawa(e.target.checked)}
                                className="w-3.5 h-3.5 text-amber-500 rounded border-gray-300 focus:ring-amber-500"
                              />
                              <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                                {excludeHomeworkTilawa ? <EyeOff size={14} /> : <Eye size={14} />}
                                إخفاء من التقرير
                              </span>
                            </label>
                          </div>

                          {/* Homework Tilawa Surah Mode */}
                          <div id="hw-tilawa-inputs-surah-mode" className={`flex gap-3 items-end ${preferredModes.homeworkTilawa === 'surah' ? '' : 'hidden'}`}>
                            <div className="flex-1">
                              <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">من سورة</label>
                              <SearchableSurahSelect
                                id="hw-tilawa-from-surah"
                                value={lastReport?.homeworkTilawa?.fromSurah || SURAHS[0]}
                                surahs={SURAHS}
                                onChange={(val) => {
                                  setLastReports(prev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return prev;
                                    return {
                                      ...prev,
                                      [studentId]: {
                                        ...prev[studentId],
                                        homeworkTilawa: {
                                          ...prev[studentId]?.homeworkTilawa,
                                          fromSurah: val
                                        }
                                      }
                                    };
                                  });
                                }}
                              />
                            </div>
                            <div className="flex-1">
                              <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">إلى سورة</label>
                              <SearchableSurahSelect
                                id="hw-tilawa-to-surah"
                                value={lastReport?.homeworkTilawa?.toSurah || SURAHS[0]}
                                surahs={SURAHS}
                                onChange={(val) => {
                                  setLastReports(prev => {
                                    const studentId = smartReportModal?.studentId;
                                    if (!studentId) return prev;
                                    return {
                                      ...prev,
                                      [studentId]: {
                                        ...prev[studentId],
                                        homeworkTilawa: {
                                          ...prev[studentId]?.homeworkTilawa,
                                          toSurah: val
                                        }
                                      }
                                    };
                                  });
                                }}
                              />
                            </div>
                          </div>

                          {/* Homework Tilawa Other Modes */}
                          <div className={`flex flex-col gap-3 ${preferredModes.homeworkTilawa === 'surah' ? 'hidden' : ''}`}>
                            <div className="flex gap-3 items-end">
                              <div id="hw-tilawa-surah-container" className={`flex-[2] ${preferredModes.homeworkTilawa === 'ayah' ? '' : 'hidden'}`}>
                                <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">
                                  {activeAdvancedAyah.homeworkTilawa ? 'من سورة' : 'السورة'}
                                </label>
                                <SearchableSurahSelect
                                  id="hw-tilawa-surah-select"
                                  value={lastReport?.homeworkTilawa?.surah || SURAHS[0]}
                                  surahs={SURAHS}
                                  onChange={(val) => {
                                    setLastReports(prev => {
                                      const studentId = smartReportModal?.studentId;
                                      if (!studentId) return prev;
                                      return {
                                        ...prev,
                                        [studentId]: {
                                          ...prev[studentId],
                                          homeworkTilawa: {
                                            ...prev[studentId]?.homeworkTilawa,
                                            surah: val
                                          }
                                        }
                                      };
                                    });
                                  }}
                                />
                              </div>
                              <div className="flex-1">
                                <label id="hw-tilawa-label-from" className="block text-xl font-medium text-gray-700 mb-1 font-arabic">
                                  {preferredModes.homeworkTilawa === 'ayah' ? 'من الآية' :
                                    preferredModes.homeworkTilawa === 'page' ? 'من صفحة' :
                                      preferredModes.homeworkTilawa === 'juz' ? 'من جزء' : 'من حزب'}
                                </label>
                                <input
                                  id="hw-tilawa-from"
                                  onFocus={handleFocus}
                                  onPointerDown={() => handleInputPointerDown('hw-tilawa-from')}
                                  onPointerUp={handleInputPointerUp}
                                  onPointerLeave={handleInputPointerUp}
                                  type="text"
                                  inputMode="numeric"
                                  autoComplete="off"
                                  value={toHindiDigits(lastReport?.homeworkTilawa?.from || '')}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);

                                    setLastReports(prev => {
                                      const studentId = smartReportModal?.studentId;
                                      if (!studentId) return prev;
                                      return {
                                        ...prev,
                                        [studentId]: {
                                          ...prev[studentId],
                                          homeworkTilawa: {
                                            ...prev[studentId]?.homeworkTilawa,
                                            from: val
                                          }
                                        }
                                      };
                                    });
                                  }}
                                  className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['hw-tilawa-from'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                                />
                              </div>
                              {!activeAdvancedAyah.homeworkTilawa && (
                                <div className="flex-1">
                                  <label id="hw-tilawa-label-to" className="block text-xl font-medium text-gray-700 mb-1 font-arabic">
                                    {preferredModes.homeworkTilawa === 'ayah' ? 'إلى الآية' :
                                      preferredModes.homeworkTilawa === 'page' ? 'إلى صفحة' :
                                        preferredModes.homeworkTilawa === 'juz' ? 'إلى جزء' : 'إلى حزب'}
                                  </label>
                                  <input
                                    id="hw-tilawa-to"
                                    onFocus={handleFocus}
                                    onPointerDown={() => handleInputPointerDown('hw-tilawa-to')}
                                    onPointerUp={handleInputPointerUp}
                                    onPointerLeave={handleInputPointerUp}
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="off"
                                    value={toHindiDigits(lastReport?.homeworkTilawa?.to ?? '')}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);

                                      // Validation: Cap at maximum Ayahs
                                      let finalVal = val;
                                      if (val && preferredModes.homeworkTilawa === 'ayah') {
                                        const ayahNum = parseInt(val.replace(/[٠-٩]/g, (d) => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]));
                                        if (!isNaN(ayahNum)) {
                                          const hwTilawaSurahSelect = document.getElementById('hw-tilawa-surah-select') as HTMLSelectElement;
                                          const currentSurah = hwTilawaSurahSelect?.value;
                                          const surahIndex = SURAHS.indexOf(currentSurah);

                                          if (surahIndex !== -1) {
                                            const maxAyahs = SURAH_AYAH_COUNTS[surahIndex];
                                            if (ayahNum > maxAyahs) {
                                              finalVal = toHindiDigits(maxAyahs);
                                              e.target.value = finalVal;
                                            }
                                          }
                                        }
                                      }

                                      setLastReports(prev => {
                                        const studentId = smartReportModal?.studentId;
                                        if (!studentId) return prev;
                                        return {
                                          ...prev,
                                          [studentId]: {
                                            ...prev[studentId],
                                            homeworkTilawa: {
                                              ...prev[studentId]?.homeworkTilawa,
                                              to: finalVal
                                            }
                                          }
                                        };
                                      });
                                    }}
                                    className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['hw-tilawa-to'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                                  />
                                </div>
                              )}
                            </div>

                            {/* Row 2 Advanced (Next Session) */}
                            {activeAdvancedAyah.homeworkTilawa && preferredModes.homeworkTilawa === 'ayah' && (
                              <div className="flex gap-3 items-end">
                                <div className="flex-[2]">
                                  <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">إلى سورة</label>
                                  <SearchableSurahSelect
                                    id="hw-tilawa-to-surah-advanced"
                                    value={lastReport?.homeworkTilawa?.toSurah || SURAHS[0]}
                                    surahs={SURAHS}
                                    onChange={(val) => {
                                      setLastReports(prev => {
                                        const studentId = smartReportModal?.studentId;
                                        if (!studentId) return prev;
                                        return {
                                          ...prev,
                                          [studentId]: {
                                            ...prev[studentId],
                                            homeworkTilawa: {
                                              ...prev[studentId]?.homeworkTilawa,
                                              toSurah: val
                                            }
                                          }
                                        };
                                      });
                                    }}
                                  />
                                </div>
                                <div className="flex-1">
                                  <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">إلى الآية</label>
                                  <input
                                    id="hw-tilawa-to"
                                    onFocus={handleFocus}
                                    onPointerDown={() => handleInputPointerDown('hw-tilawa-to')}
                                    onPointerUp={handleInputPointerUp}
                                    onPointerLeave={handleInputPointerUp}
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="off"
                                    value={toHindiDigits(lastReport?.homeworkTilawa?.to ?? '')}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);

                                      setLastReports(prev => {
                                        const studentId = smartReportModal?.studentId;
                                        if (!studentId) return prev;

                                        let finalVal = val;
                                        if (val) {
                                          const currentSurah = prev[studentId]?.homeworkTilawa?.toSurah || SURAHS[0];
                                          const surahIndex = SURAHS.indexOf(currentSurah);

                                          if (surahIndex !== -1) {
                                            const totalAyahs = SURAH_AYAH_COUNTS[surahIndex];
                                            const endAyahNum = parseInt(val.replace(/[٠-٩]/g, (d) => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]));

                                            if (!isNaN(endAyahNum) && endAyahNum > totalAyahs) {
                                              finalVal = toHindiDigits(totalAyahs);
                                              e.target.value = finalVal;
                                            }
                                          }
                                        }

                                        return {
                                          ...prev,
                                          [studentId]: {
                                            ...prev[studentId],
                                            homeworkTilawa: {
                                              ...prev[studentId]?.homeworkTilawa,
                                              to: finalVal
                                            }
                                          }
                                        };
                                      });
                                    }}
                                    className={`w-full p-3 border border-gray-200 rounded-xl text-center text-xl font-arabic transition-all ${cancelledInputs['hw-tilawa-to'] ? 'bg-gray-200 text-transparent' : 'bg-gray-50'}`}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Toggle */}
                            {preferredModes.homeworkTilawa === 'ayah' && (
                              <div className="flex justify-center relative z-10">
                                <button
                                  onClick={() => setActiveAdvancedAyah(prev => {
                                    const next = { ...prev, homeworkTilawa: !prev.homeworkTilawa };
                                    setLastReports(lastPrev => {
                                      const studentId = smartReportModal?.studentId;
                                      if (!studentId) return lastPrev;
                                      return {
                                        ...lastPrev,
                                        [studentId]: {
                                          ...lastPrev[studentId],
                                          homeworkTilawa: {
                                            ...lastPrev[studentId]?.homeworkTilawa,
                                            isAdvancedAyah: next.homeworkTilawa
                                          }
                                        }
                                      };
                                    });
                                    return next;
                                  })}
                                  className={`p-1 rounded-full border shadow-sm transition-all ${activeAdvancedAyah.homeworkTilawa ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-gray-200 text-gray-400 hover:text-indigo-500'}`}
                                  title={activeAdvancedAyah.homeworkTilawa ? "إلغاء الوضع المتقدم" : "تفعيل الوضع المتقدم"}
                                >
                                  {activeAdvancedAyah.homeworkTilawa ? <Minus size={14} /> : <Plus size={14} />}
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* END Quran Sections Container */}
                  </div>

                  {/* Tajweed Simple Section */}
                  <div className={`mt-4 rounded-2xl border border-sky-100 bg-sky-50/70 p-4 space-y-4 ${sectionToggles.quranTajweed ? '' : 'opacity-50'} ${reportPath === 'noor' ? 'hidden' : ''}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSectionToggles(prev => {
                            const next = { ...prev, quranTajweed: !prev.quranTajweed };
                            setLastReports(lastPrev => {
                              const studentId = smartReportModal?.studentId;
                              if (!studentId) return lastPrev;
                              return {
                                ...lastPrev,
                                [studentId]: {
                                  ...lastPrev[studentId],
                                  sectionToggles: next
                                }
                              };
                            });
                            return next;
                          })}
                          className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${sectionToggles.quranTajweed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 bg-white'}`}
                          title={sectionToggles.quranTajweed ? 'إخفاء التجويد من التقرير' : 'إظهار التجويد في التقرير'}
                        >
                          {sectionToggles.quranTajweed && <Check size={14} strokeWidth={3} />}
                        </button>
                        <h3 className="text-xl font-bold text-sky-800 font-arabic">التجويد</h3>
                        <div
                          onClick={() => setExcludeQuranTajweed(!excludeQuranTajweed)}
                          className="mr-1 flex items-center gap-1.5 cursor-pointer hover:bg-white/50 p-1 rounded-md transition-colors select-none"
                        >
                          <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                            {excludeQuranTajweed ? <EyeOff size={14} /> : <Eye size={14} />}
                            إخفاء من التقرير
                          </span>
                        </div>
                      </div>
                    </div>

                    {sectionToggles.quranTajweed && (
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-lg font-medium text-gray-700 mb-1 font-arabic">الدرس التجويدي الحالي</label>
                          <TajweedGroupedHoverSelect
                            value={quranTajweedCurrentLessonId}
                            groups={quranTajweedLessonGroupedOptions}
                            hoverDelayMs={2000}
                            onChange={(currentId) => {
                              setQuranTajweedCurrentLessonId(currentId);
                              setLastReports(prev => ({
                                ...prev,
                                [smartReportModal.studentId]: {
                                  ...prev[smartReportModal.studentId],
                                  quranTajweed: {
                                    currentLessonId: currentId,
                                    nextLessonId: quranTajweedNextLessonId,
                                  }
                                }
                              }));
                            }}
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <label className="text-lg font-medium text-gray-700 font-arabic">الدرس القادم</label>
                            <button
                              type="button"
                              onClick={() => {
                                const repeatedLessonId = quranTajweedCurrentLessonId || defaultQuranTajweedLessonId || '';
                                const nextId = quranTajweedNextLessonId === TAJWEED_NEXT_REPEAT
                                  ? repeatedLessonId
                                  : TAJWEED_NEXT_REPEAT;
                                setQuranTajweedNextLessonId(nextId);
                                setLastReports(prev => ({
                                  ...prev,
                                  [smartReportModal.studentId]: {
                                    ...prev[smartReportModal.studentId],
                                    quranTajweed: {
                                      currentLessonId: quranTajweedCurrentLessonId || defaultQuranTajweedLessonId || repeatedLessonId,
                                      nextLessonId: nextId,
                                    }
                                  }
                                }));
                              }}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-arabic transition-all shrink-0 ${quranTajweedNextLessonId === TAJWEED_NEXT_REPEAT ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white border-sky-200 text-sky-700 hover:bg-sky-50'}`}
                            >
                              <Repeat size={13} />
                              إعادة
                            </button>
                          </div>
                          <TajweedGroupedHoverSelect
                            value={
                              quranTajweedNextLessonId === TAJWEED_NEXT_REPEAT
                                ? (quranTajweedCurrentLessonId || '')
                                : (quranTajweedNextLessonId === TAJWEED_NEXT_HIDE ? '' : quranTajweedNextLessonId)
                            }
                            groups={quranTajweedLessonGroupedOptions}
                            placeholder="اختر الدرس القادم"
                            hoverDelayMs={2000}
                            onChange={(nextId) => {
                              setQuranTajweedNextLessonId(nextId);
                              setLastReports(prev => ({
                                ...prev,
                                [smartReportModal.studentId]: {
                                  ...prev[smartReportModal.studentId],
                                  quranTajweed: {
                                    currentLessonId: quranTajweedCurrentLessonId || defaultQuranTajweedLessonId || nextId,
                                    nextLessonId: nextId,
                                  }
                                }
                              }));
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Custom Notes (Optional) */}
                  <div className={`mt-4 flex flex-col items-center`}>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setShowNotesInput(!showNotesInput);
                      }}
                      className="flex items-center justify-center gap-2 text-base font-bold text-blue-600 hover:text-blue-700 mb-2 font-arabic transition-colors"
                    >
                      {showNotesInput ? <Minus size={18} /> : <Plus size={18} />}
                      {showNotesInput ? 'إخفاء الملاحظات' : 'إضافة ملاحظات'}
                    </button>
                    <div className={`w-2/3 max-w-md flex justify-center transition-all duration-300 ${showNotesInput ? 'opacity-100 scale-100 h-auto mb-4' : 'opacity-0 scale-95 h-0 overflow-hidden pointer-events-none'}`}>
                      <textarea
                        id="custom-notes-input"
                        dir="auto"
                        rows={3}
                        value={customNotesText}
                        onChange={(e) => setCustomNotesText(e.target.value)}
                        onWheel={(e) => e.stopPropagation()}
                        className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-xl font-arabic font-semibold focus:ring-2 focus:ring-blue-300 focus:border-blue-300 transition-all placeholder-gray-300 custom-scrollbar resize-y"
                      />
                    </div>
                  </div>

                  {/* Audio Link (Optional) - always in DOM, hidden in Noor path */}
                  <div className={`mt-2 ${reportPath === 'noor' ? 'hidden' : ''}`}>
                    <label className="flex items-center justify-center gap-2 text-sm font-medium text-gray-400 mb-1.5 font-arabic">
                      🎧 رابط التصحيح الصوتي (اختياري)
                    </label>
                    <div className="flex justify-center">
                      <input
                        id="audio-link-input"
                        type="text"
                        dir="ltr"
                        value={audioLinkText}
                        onChange={(e) => setAudioLinkText(e.target.value)}
                        className="w-2/3 max-w-md p-3 border border-gray-200 rounded-xl bg-gray-50 text-sm font-english text-center focus:ring-2 focus:ring-purple-300 focus:border-purple-300 transition-all placeholder-gray-300"
                      />
                    </div>
                  </div>

                  {/* Actions (Moved outside of Quran Section) */}
                  <div className="space-y-3 mt-5 pb-8">
                    {/* WhatsApp Toggle & Subscription Counter - Compact Row */}
                    <div className="flex items-center justify-center flex-wrap gap-3 mb-2">
                      <label className="flex items-center gap-2 cursor-pointer bg-gray-50 dark:bg-gray-700/50 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
                        <input
                          type="checkbox"
                          checked={sendViaWhatsapp}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            setSendViaWhatsapp(isChecked);
                            setLastReports(prev => {
                              const studentId = smartReportModal?.studentId;
                              if (!studentId) return prev;
                              return {
                                ...prev,
                                [studentId]: {
                                  ...prev[studentId],
                                  sendViaWhatsapp: isChecked
                                }
                              };
                            });
                          }}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-base font-medium text-gray-700 dark:text-gray-200">إرسال عبر واتساب</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer bg-gray-50 dark:bg-gray-700/50 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
                        <input
                          type="checkbox"
                          checked={subscriptionSettings[smartReportModal.studentId]?.enabled || false}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setShowSubscriptionModal(true);
                            } else {
                              setSubscriptionSettings(prev => ({
                                ...prev,
                                [smartReportModal.studentId]: {
                                  ...prev[smartReportModal.studentId],
                                  enabled: false
                                }
                              }));
                            }
                          }}
                          className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                        />
                        <span className="text-base font-medium text-gray-700 dark:text-gray-200">إضافة رقم الحصة</span>
                        {subscriptionSettings[smartReportModal.studentId]?.enabled && (
                          <button
                            onClick={(e) => { e.preventDefault(); setShowSubscriptionModal(true); }}
                            className="text-xs text-blue-600 hover:text-blue-500 underline mr-1"
                          >
                            تعديل
                          </button>
                        )}
                      </label>
                      {subscriptionSettings[smartReportModal.studentId]?.enabled && (
                        <span className="text-base font-medium text-gray-500 font-arabic">
                          {subscriptionSettings[smartReportModal.studentId]?.mode === 'monthly'
                            ? `الحصة ${toHindiDigits(subscriptionSettings[smartReportModal.studentId]?.currentClass ?? 0)}`
                            : `الحصة ${toHindiDigits((((subscriptionSettings[smartReportModal.studentId]?.currentClass ?? 0) - 1 + (subscriptionSettings[smartReportModal.studentId]?.totalClasses || 1)) % (subscriptionSettings[smartReportModal.studentId]?.totalClasses || 1)) + 1)} / ${toHindiDigits(subscriptionSettings[smartReportModal.studentId]?.totalClasses || 8)}`
                          }
                        </span>
                      )}
                      {reportPath === 'noor' && (
                        <div className="flex items-center justify-center gap-2 pr-2">
                          <input
                            type="checkbox"
                            id="merge-quran-check"
                            checked={mergeWithQuran}
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              setMergeWithQuran(isChecked);
                              setLastReports(prev => {
                                const studentId = smartReportModal?.studentId;
                                if (!studentId) return prev;
                                return {
                                  ...prev,
                                  [studentId]: {
                                    ...prev[studentId],
                                    mergeWithQuran: isChecked
                                  }
                                };
                              });
                            }}
                            className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <label htmlFor="merge-quran-check" className="font-arabic text-lg text-gray-700 cursor-pointer select-none">
                            دمج مع القرآن الكريم
                          </label>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-center gap-6">
                      <button
                        onClick={() => {
                          // Warning logic for Noor Al-Bayan section
                          if (reportPath === 'quran' && mergeWithQuran && !visitedNoor && !noorWarningShown) {
                            setNoorWarningShown(true);
                            showToast('⚠️ لم يتم التحقق من قسم نور البيان!');
                            return;
                          }
                          setLastReportLanguage('ar');
                          // --- ARABIC REPORT GENERATION ---
                          // --- ARABIC REPORT GENERATION ---
                          let noorSummaryPart = '';
                          let noorPlanPart = '';
                          let noorConfigPart = {};

                          if (reportPath === 'noor') {
                            const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
                            const months_ar = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
                            const date = new Date(year, month, smartReportModal.dayNum);
                            const dateStr = `${days[date.getDay()]} ${toHindiDigits(date.getDate())} ${months_ar[date.getMonth()]} ${toHindiDigits(date.getFullYear())}`;

                            // Retrieve Noor Values
                            const tamFromPage = (document.getElementById('noor-tam-from-page') as HTMLInputElement)?.value;
                            const tamToPage = (document.getElementById('noor-tam-to-page') as HTMLInputElement)?.value;
                            const tamFromLine = (document.getElementById('noor-tam-from-line') as HTMLInputElement)?.value;
                            const tamToLine = (document.getElementById('noor-tam-to-line') as HTMLInputElement)?.value;
                            const sayatimFromPage = (document.getElementById('noor-sayatim-from-page') as HTMLInputElement)?.value;
                            const sayatimToPage = (document.getElementById('noor-sayatim-to-page') as HTMLInputElement)?.value;
                            const sayatimFromLine = (document.getElementById('noor-sayatim-from-line') as HTMLInputElement)?.value;
                            const sayatimToLine = (document.getElementById('noor-sayatim-to-line') as HTMLInputElement)?.value;

                            // Generate Content
                            const selectedBook = (lastReports[smartReportModal.studentId]?.noor?.book || defaultNoorBook) === 'taasees' ? 'كتاب التأسيس' : 'نور البيان';
                            // Ma Tam
                            if (!excludeNoorTam) {
                              let tamContent = '';
                              if (tamFromPage || tamToPage) {
                                // Page Logic
                                if (cancelledInputs['noor-tam-to-page']) {
                                  tamContent += `صفحة ${tamFromPage}`;
                                } else if (tamToPage?.trim() === '0' || tamToPage?.trim() === '٠') {
                                  // Open range (only when explicitly 0)
                                  tamContent += `من صفحة ${tamFromPage || '?'} لـ...`;
                                } else if (!tamToPage || tamToPage.trim() === '') {
                                  // Empty - single page
                                  tamContent += `صفحة ${tamFromPage}`;
                                } else if (tamFromPage && (tamFromPage === tamToPage)) {
                                  // Same value - single page
                                  tamContent += `صفحة ${tamFromPage}`;
                                } else {
                                  // Normal range
                                  tamContent += `من صفحة ${tamFromPage || '?'} إلى صفحة ${tamToPage || '?'}`;
                                }
                              }

                              if (tamFromLine || tamToLine) {
                                // Line Logic (Appended)
                                if (cancelledInputs['noor-tam-to-line']) {
                                  tamContent += ` (سطر ${tamFromLine})`;
                                } else if (tamToLine?.trim() === '0' || tamToLine?.trim() === '٠') {
                                  // Open range (only when explicitly 0)
                                  tamContent += ` (من سطر ${tamFromLine || '?'} لـ...)`;
                                } else if (!tamToLine || tamToLine.trim() === '') {
                                  // Empty - single line
                                  tamContent += ` (سطر ${tamFromLine || '?'})`;
                                } else {
                                  // Normal range
                                  tamContent += ` (من سطر ${tamFromLine || '?'} إلى سطر ${tamToLine || '?'})`;
                                }
                              }

                              if (tamContent) {
                                const book = (lastReports[smartReportModal.studentId]?.noor?.book || defaultNoorBook);
                                const lessonType = getNoorLessonType(book as any, tamFromPage || '', tamToPage || '', 'ar');
                                if (lessonType) tamContent += ` ← ( ${lessonType} )`;
                              }

                              noorSummaryPart += tamContent || '-';
                              noorSummaryPart += `\n`;
                            }

                            // Ma Sayatim
                            if (!excludeNoorSayatim) {
                              let sayatimContent = '';
                              if (isNoorMirrorMode) sayatimContent += `(إعادة) `;
                              if (sayatimFromPage || sayatimToPage) {
                                // Page Logic
                                if (cancelledInputs['noor-sayatim-to-page']) {
                                  sayatimContent += `صفحة ${sayatimFromPage}`;
                                } else if (sayatimToPage?.trim() === '0' || sayatimToPage?.trim() === '٠') {
                                  // Open range (only when explicitly 0)
                                  sayatimContent += `من صفحة ${sayatimFromPage || '?'} لـ...`;
                                } else if (!sayatimToPage || sayatimToPage.trim() === '') {
                                  // Empty - single page
                                  sayatimContent += `صفحة ${sayatimFromPage}`;
                                } else if (sayatimFromPage && (sayatimFromPage === sayatimToPage)) {
                                  // Same value - single page
                                  sayatimContent += `صفحة ${sayatimFromPage}`;
                                } else {
                                  // Normal range
                                  sayatimContent += `من صفحة ${sayatimFromPage || '?'} إلى صفحة ${sayatimToPage || '?'}`;
                                }
                              }

                              if (sayatimContent) {
                                const book = (lastReports[smartReportModal.studentId]?.noor?.book || defaultNoorBook);
                                const lessonType = getNoorLessonType(book as any, sayatimFromPage || '', sayatimToPage || '', 'ar');
                                if (lessonType) sayatimContent += ` ← ( ${lessonType} )`;
                              }

                              if (sayatimFromLine || sayatimToLine) {
                                // Line Logic
                                if (cancelledInputs['noor-sayatim-to-line']) {
                                  sayatimContent += ` (سطر ${sayatimFromLine})`;
                                } else if (sayatimToLine?.trim() === '0' || sayatimToLine?.trim() === '٠') {
                                  // Open range (only when explicitly 0)
                                  sayatimContent += ` (من سطر ${sayatimFromLine || '?'} لـ...)`;
                                } else if (!sayatimToLine || sayatimToLine.trim() === '') {
                                  // Empty - single line
                                  sayatimContent += ` (سطر ${sayatimFromLine || '?'})`;
                                } else {
                                  // Normal range
                                  sayatimContent += ` (من سطر ${sayatimFromLine || '?'} إلى سطر ${sayatimToLine || '?'})`;
                                }
                              }
                              noorPlanPart += sayatimContent || '-';
                              noorPlanPart += `\n`;
                            }



                            noorConfigPart = {
                              noor: {
                                book: lastReports[smartReportModal.studentId]?.noor?.book || defaultNoorBook,
                                tam: { fromPage: tamFromPage, toPage: tamToPage, fromLine: tamFromLine, toLine: tamToLine },
                                sayatim: { fromPage: sayatimFromPage, toPage: sayatimToPage, fromLine: sayatimFromLine, toLine: sayatimToLine }
                              }
                            };
                          }



                          // Start Report Building
                          if (reportPath === 'tajweed') {
                            const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
                            const months_ar = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
                            const date = new Date(year, month, smartReportModal.dayNum);
                            const dateStr = `${days[date.getDay()]} ${toHindiDigits(date.getDate())} ${months_ar[date.getMonth()]} ${toHindiDigits(date.getFullYear())}`;
                            const sub = subscriptionSettings[smartReportModal.studentId];
                            let classNumLine = '';
                            if (sub && sub.enabled) {
                              const displayClassNumRaw = ((sub.currentClass - 1 + (sub.totalClasses || 1)) % (sub.totalClasses || 1)) + 1;
                              const classNumAr = toHindiDigits(sub.mode === 'monthly' ? (sub.currentClass) : displayClassNumRaw);
                              if (sub.mode === 'monthly') {
                                classNumLine = `رقم الحصة: ${classNumAr}\n`;
                              } else {
                                const isLast = displayClassNum === sub.totalClasses;
                                const totalAr = toHindiDigits(sub.totalClasses);
                                classNumLine = `رقم الحصة: ${classNumAr} من ${totalAr}${isLast ? ' (آخر حصة في الاشتراك)' : ''}\n`;
                              }
                            }

                            const selectedLesson = tajweedLessons.find(item => item.id === selectedTajweedLessonId);
                            const tajweedQuizNote = getTajweedQuizNote('ar', smartReportModal.studentId, selectedTajweedLessonId);
                            const topicGroupData = TAJWEED_TOPIC_GROUPS.find(item => item.id === selectedTajweedTopicGroup) || TAJWEED_TOPIC_GROUPS[0];
                            const tajweedTopicText = selectedTajweedTopicGroup === 'foundation'
                              ? topicGroupData.label
                              : `${topicGroupData.label} - ${selectedTajweedTopic}`;

                            const academySettingsTaj = student ? academyRates[student.academy] : null;
                            const showHeaderTaj = academySettingsTaj?.includeReportHeader !== false;

                            let report = '';
                            if (showHeaderTaj) {
                              report += `📖 *تقرير الحصة*\n\nالطالب: ${studentName}\nالتاريخ: ${dateStr}\n${classNumLine}\nــــــــــــــــــــــــــــــ\n\n`;
                            }
                            report += `🎚️ *التجويد:*\n`;
                            report += `الدرس: ${selectedLesson?.title || 'غير محدد'}\n`;
                            report += `الموضوع: ${tajweedTopicText}\n`;
                            if (tajweedQuizNote) {
                              report += `${tajweedQuizNote}`;
                            }

                            const customNotesVal = customNotesText.trim();
                            if (customNotesVal) {
                              report += `\nــــــــــــــــــــــــــــــ\n\n✏️ *ملاحظات:*\n${customNotesVal}`;
                            }

                            const audioLinkVal = audioLinkText.trim();
                            if (audioLinkVal) {
                              report += `\nــــــــــــــــــــــــــــــ\n\n🎧 *للاستماع إلى التوجيهات:*\n${audioLinkVal}`;
                            }

                            setLastReports(prev => ({
                              ...prev,
                              [smartReportModal.studentId]: {
                                ...prev[smartReportModal.studentId],
                                tajweed: {
                                  lessonId: selectedTajweedLessonId,
                                  lessonTitle: selectedLesson?.title || '',
                                  topicGroup: selectedTajweedTopicGroup,
                                  topic: selectedTajweedTopicGroup === 'foundation' ? topicGroupData.label : selectedTajweedTopic,
                                },
                                activeSection: 'tajweed',
                                customNotes: customNotesVal || '',
                                audioLink: audioLinkVal || ''
                              }
                            }));

                            const _tajweedStudentId = smartReportModal.studentId;
                            const _tajweedDayNum = smartReportModal.dayNum;
                            if (sendViaWhatsapp) {
                              const student = students.find(s => s.id === smartReportModal.studentId);
                              const studentWhatsapp = student?.whatsappNumber;
                              const academyWhatsapp = student ? academyRates[student.academy]?.whatsappNumber : undefined;
                              const finalTarget = studentWhatsapp || academyWhatsapp;

                              if (!finalTarget || finalTarget.trim() === '') {
                                alert('يرجى تحديد رقم واتساب في إعدادات الطالب أو إعدادات الأكاديمية أولاً.');
                                return;
                              }

                              setLastReports(prev => ({
                                ...prev,
                                [smartReportModal.studentId]: {
                                  ...prev[smartReportModal.studentId],
                                  tajweed: {
                                    lessonId: selectedTajweedLessonId,
                                    lessonTitle: selectedLesson?.title || '',
                                    topicGroup: selectedTajweedTopicGroup,
                                    topic: selectedTajweedTopicGroup === 'foundation' ? topicGroupData.label : selectedTajweedTopic,
                                  },
                                  activeSection: 'tajweed',
                                  sendViaWhatsapp: true
                                }
                              }));

                              closeAllModals(true);
                              navigator.clipboard.writeText(report).catch(() => { });
                              checkAndOpenLink(_tajweedStudentId);
                              showToast('جاري الإرسال عبر واتساب... ⏳');
                              window.electronAPI?.sendWhatsAppAuto(finalTarget, report).then((result: any) => {
                                if (result.success) {
                                  saveReportForDay(_tajweedStudentId, _tajweedDayNum, report, {
                                    ...noorConfigPart,
                                    noorDetails,
                                    activeSection: reportPath,
                                    mergeWithQuran,
                                    customNotes: customNotesText.trim(),
                                    audioLink: audioLinkText.trim()
                                  });
                                  ensureTajweedAssignmentForLesson(_tajweedStudentId, selectedTajweedLessonId, 'ar');
                                  showToast('تم الإرسال عبر واتساب ✅');
                                  setSearchQuery('');
                                  new Notification('تم الإرسال ✅', { body: `تم إرسال تقرير ${studentName} عبر واتساب بنجاح` });
                                } else {
                                  showToast('حدث خطأ في الإرسال ❌');
                                  console.error('WhatsApp error:', result.error);
                                }
                              }).catch((err: any) => {
                                console.error('WhatsApp automation error:', err);
                                showToast('حدث خطأ في الإرسال ❌');
                              });
                            } else {
                              navigator.clipboard.writeText(report).then(() => {
                                saveReportForDay(_tajweedStudentId, _tajweedDayNum, report, {
                                  ...noorConfigPart,
                                  noorDetails,
                                  activeSection: reportPath,
                                  mergeWithQuran,
                                  customNotes: customNotesText.trim(),
                                  audioLink: audioLinkText.trim()
                                });
                                ensureTajweedAssignmentForLesson(_tajweedStudentId, selectedTajweedLessonId, 'ar');
                                closeAllModals(true);
                                showToast('تم نسخ تقرير التجويد ✨');
                                setSearchQuery('');
                                checkAndOpenLink(_tajweedStudentId);
                              });
                            }
                            return;
                          }

                          // Check if this is a Noor Al-Bayan Report
                          if (reportPath === 'noor' && !mergeWithQuran) {
                            // Full Noor Report
                            const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
                            const months_ar = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
                            const date = new Date(year, month, smartReportModal.dayNum);
                            const dateStr = `${days[date.getDay()]} ${toHindiDigits(date.getDate())} ${months_ar[date.getMonth()]} ${toHindiDigits(date.getFullYear())}`;

                            // Build header with optional class number
                            const sub = subscriptionSettings[smartReportModal.studentId];
                            let classNumLine = '';
                            if (sub?.enabled) {
                              const displayClassNum = (sub.currentClass % (sub.totalClasses || 1)) + 1;
                              const classNumAr = toHindiDigits(sub.mode === 'monthly' ? (sub.currentClass + 1) : displayClassNum);
                              if (sub.mode === 'monthly') {
                                classNumLine = `رقم الحصة: ${classNumAr}\n`;
                              } else {
                                const isLast = displayClassNum === sub.totalClasses;
                                const totalAr = toHindiDigits(sub.totalClasses);
                                classNumLine = `رقم الحصة: ${classNumAr} من ${totalAr}${isLast ? ' (آخر حصة في الاشتراك)' : ''}\n`;
                              }
                            }

                            const currentBookAr = (lastReports[smartReportModal.studentId]?.noor?.book || defaultNoorBook) === 'taasees' ? 'كتاب التأسيس' : 'نور البيان';
                            const academySettingsNoor = student ? academyRates[student.academy] : null;
                            const showHeaderNoor = academySettingsNoor?.includeReportHeader !== false;

                            let report = '';
                            if (showHeaderNoor) {
                              report += `📖 *تقرير الحصة*\n\nالطالب: ${studentName}\nالتاريخ: ${dateStr}\n${classNumLine}\nــــــــــــــــــــــــــــــ\n\n`;
                            }
                            report += `📚  ( *${currentBookAr}* )\n\n`;
                            if (noorSummaryPart) {
                              report += `*• إنجاز الحصة:*\n${noorSummaryPart}\n`;
                            }
                            if (noorPlanPart) {
                              report += `\n*• حصتنا القادمة:*\n${noorPlanPart}`;
                            }

                            // Foundation Book Listening Link (Arabic - noor only)
                            const isFoundationBookAr = (lastReports[smartReportModal.studentId]?.noor?.book || defaultNoorBook) === 'taasees';
                            const foundationListenPageAr = (() => {
                              const sayatimVal = (document.getElementById('noor-sayatim-from-page') as HTMLInputElement)?.value || '';
                              const tamVal = (document.getElementById('noor-tam-from-page') as HTMLInputElement)?.value || '';
                              return sayatimVal || tamVal;
                            })();
                            if (isFoundationBookAr && foundationListenPageAr) {
                              const pageEng = toEnglish(foundationListenPageAr);
                              report += `\nــــــــــــــــــــــــــــــ\n🎧 *الاستماع:*\nhttps://audio-foundation-book.vercel.app/?page=${pageEng}`;
                            }

                            // Custom Notes
                            const customNotesVal = customNotesText.trim();
                            if (customNotesVal) {
                              report += `\nــــــــــــــــــــــــــــــ\n\n✏️ *ملاحظات:*\n${customNotesVal}`;
                            }

                            // Audio Link Section (always last, with separator)
                            const audioLinkVal = audioLinkText.trim();
                            if (audioLinkVal) {
                              report += `\nــــــــــــــــــــــــــــــ\n\n🎧 *للاستماع إلى التوجيهات:*\n${audioLinkVal}`;
                            }

                            setLastReports(prev => ({
                              ...prev,
                              [smartReportModal.studentId]: {
                                ...prev[smartReportModal.studentId],
                                ...noorConfigPart,
                                noorDetails: noorDetails, // Save current Zawa'id visibility state
                                customNotes: customNotesVal || '',
                                audioLink: audioLinkVal || ''
                              }
                            }));

                            const _studentIdNoor1 = smartReportModal.studentId;
                            const _dayNumNoor1 = smartReportModal.dayNum;

                            if (sendViaWhatsapp) {
                              // Resolve WhatsApp Target (Hierarchy: Student > Academy ONLY)
                              const student = students.find(s => s.id === smartReportModal.studentId);
                              const studentWhatsapp = student?.whatsappNumber;
                              const academyWhatsapp = student ? academyRates[student.academy]?.whatsappNumber : undefined;
                              const finalTarget = studentWhatsapp || academyWhatsapp;

                              if (!finalTarget || finalTarget.trim() === '') {
                                alert('يرجى تحديد رقم واتساب في إعدادات الطالب أو إعدادات الأكاديمية أولاً.');
                                return;
                              }

                              // Send via Puppeteer automation
                              setLastReports(prev => ({
                                ...prev,
                                [smartReportModal.studentId]: {
                                  ...prev[smartReportModal.studentId],
                                  ...noorConfigPart,
                                  sendViaWhatsapp: true
                                }
                              }));
                              closeAllModals(true);
                              // Copy + open link immediately alongside WhatsApp send
                              navigator.clipboard.writeText(report).catch(() => { });
                              checkAndOpenLink(_studentIdNoor1);
                              showToast('جاري الإرسال عبر واتساب... ⏳');
                              window.electronAPI?.sendWhatsAppAuto(finalTarget, report).then((result: any) => {
                                if (result.success) {
                                  saveReportForDay(_studentIdNoor1, _dayNumNoor1, report, {
                                    ...noorConfigPart,
                                    noorDetails,
                                    activeSection: reportPath,
                                    mergeWithQuran,
                                    customNotes: customNotesText.trim(),
                                    audioLink: audioLinkText.trim()
                                  });
                                  showToast('تم الإرسال عبر واتساب ✅');
                                  setSearchQuery('');
                                  new Notification('تم الإرسال ✅', { body: `تم إرسال تقرير ${studentName} عبر واتساب بنجاح` });
                                } else {
                                  showToast('حدث خطأ في الإرسال ❌');
                                  console.error('WhatsApp error:', result.error);
                                }
                              }).catch((err: any) => {
                                console.error('WhatsApp automation error:', err);
                                showToast('حدث خطأ في الإرسال ❌');
                              });
                            } else {
                              navigator.clipboard.writeText(report).then(() => {
                                saveReportForDay(_studentIdNoor1, _dayNumNoor1, report, {
                                  ...noorConfigPart,
                                  noorDetails,
                                  activeSection: reportPath,
                                  mergeWithQuran,
                                  customNotes: customNotesText.trim(),
                                  audioLink: audioLinkText.trim()
                                });
                                closeAllModals(true);
                                showToast('تم نسخ تقرير نور البيان ✨');
                                setSearchQuery('');
                                checkAndOpenLink(_studentIdNoor1);
                              });
                            }
                            return;
                          }

                          // Start Quran Generation (for 'quran' or 'combined')
                          const arReportTajweedLessonId = (sectionToggles.quranTajweed && (reportPath !== 'noor' || mergeWithQuran)) ? quranTajweedCurrentLessonId : '';
                          const arTajweedQuizNote = getTajweedQuizNote('ar', smartReportModal.studentId, arReportTajweedLessonId);


                          // 1. Reading New Values
                          const isQuranNewPageMode = preferredModes.readingNew === 'page';
                          const isQuranNewJuzMode = preferredModes.readingNew === 'juz';
                          const isQuranNewHizbMode = preferredModes.readingNew === 'hizb';
                          const isQuranNewSurahMode = preferredModes.readingNew === 'surah';

                          const quranNewSurah = (document.getElementById('quran-new-surah-select') as HTMLSelectElement)?.value;
                          const quranNewFromSurah = (document.getElementById('quran-new-from-surah') as HTMLSelectElement)?.value || SURAHS[0];
                          const quranNewToSurah = (document.getElementById('quran-new-to-surah') as HTMLSelectElement)?.value || SURAHS[0];
                          const quranNewFromAyah = (document.getElementById('quran-new-from-ayah') as HTMLInputElement)?.value;
                          const quranNewToAyah = (document.getElementById('quran-new-to-ayah') as HTMLInputElement)?.value;
                          const quranNewFromPage = (document.getElementById('quran-new-from-page') as HTMLInputElement)?.value;
                          const quranNewToPage = (document.getElementById('quran-new-to-page') as HTMLInputElement)?.value;
                          const quranNewFromJuz = (document.getElementById('quran-new-from-juz') as HTMLInputElement)?.value;
                          const quranNewToJuz = (document.getElementById('quran-new-to-juz') as HTMLInputElement)?.value;
                          const quranNewFromHizb = (document.getElementById('quran-new-from-hizb') as HTMLInputElement)?.value;
                          const quranNewToHizb = (document.getElementById('quran-new-to-hizb') as HTMLInputElement)?.value;

                          // 2. Reading Revision Values
                          const isQuranRevPageMode = preferredModes.readingRev === 'page';
                          const isQuranRevJuzMode = preferredModes.readingRev === 'juz';
                          const isQuranRevHizbMode = preferredModes.readingRev === 'hizb';
                          const isQuranRevSurahMode = preferredModes.readingRev === 'surah';

                          const quranRevSurah = (document.getElementById('quran-rev-surah-select') as HTMLSelectElement)?.value;
                          const quranRevFromSurah = (document.getElementById('quran-rev-from-surah') as HTMLSelectElement)?.value || SURAHS[0];
                          const quranRevToSurah = (document.getElementById('quran-rev-to-surah') as HTMLSelectElement)?.value || SURAHS[0];
                          const quranRevFromAyah = (document.getElementById('quran-rev-from-ayah') as HTMLInputElement)?.value;
                          const quranRevToAyah = (document.getElementById('quran-rev-to-ayah') as HTMLInputElement)?.value;
                          const quranRevFromPage = (document.getElementById('quran-rev-from-page') as HTMLInputElement)?.value;
                          const quranRevToPage = (document.getElementById('quran-rev-to-page') as HTMLInputElement)?.value;
                          const quranRevFromJuz = (document.getElementById('quran-rev-from-juz') as HTMLInputElement)?.value;
                          const quranRevToJuz = (document.getElementById('quran-rev-to-juz') as HTMLInputElement)?.value;
                          const quranRevFromHizb = (document.getElementById('quran-rev-from-hizb') as HTMLInputElement)?.value;
                          const quranRevToHizb = (document.getElementById('quran-rev-to-hizb') as HTMLInputElement)?.value;

                          // 2.5. Reading Old Revision Values
                          const isQuranOldRevPageMode = preferredModes.readingOldRev === 'page';
                          const isQuranOldRevJuzMode = preferredModes.readingOldRev === 'juz';
                          const isQuranOldRevHizbMode = preferredModes.readingOldRev === 'hizb';
                          const isQuranOldRevSurahMode = preferredModes.readingOldRev === 'surah';

                          const quranOldRevSurah = (document.getElementById('quran-oldrev-surah-select') as HTMLSelectElement)?.value;
                          const quranOldRevFromSurah = (document.getElementById('quran-oldrev-from-surah') as HTMLSelectElement)?.value || SURAHS[0];
                          const quranOldRevToSurah = (document.getElementById('quran-oldrev-to-surah') as HTMLSelectElement)?.value || SURAHS[0];
                          const quranOldRevFromAyah = (document.getElementById('quran-oldrev-from-ayah') as HTMLInputElement)?.value;
                          const quranOldRevToAyah = (document.getElementById('quran-oldrev-to-ayah') as HTMLInputElement)?.value;
                          const quranOldRevFromPage = (document.getElementById('quran-oldrev-from-page') as HTMLInputElement)?.value;
                          const quranOldRevToPage = (document.getElementById('quran-oldrev-to-page') as HTMLInputElement)?.value;
                          const quranOldRevFromJuz = (document.getElementById('quran-oldrev-from-juz') as HTMLInputElement)?.value;
                          const quranOldRevToJuz = (document.getElementById('quran-oldrev-to-juz') as HTMLInputElement)?.value;
                          const quranOldRevFromHizb = (document.getElementById('quran-oldrev-from-hizb') as HTMLInputElement)?.value;
                          const quranOldRevToHizb = (document.getElementById('quran-oldrev-to-hizb') as HTMLInputElement)?.value;

                          // 3. Homework New Values
                          const isHwNewPageMode = preferredModes.homeworkNew === 'page';
                          const isHwNewJuzMode = preferredModes.homeworkNew === 'juz';
                          const isHwNewHizbMode = preferredModes.homeworkNew === 'hizb';
                          const isHwNewSurahMode = preferredModes.homeworkNew === 'surah';
                          const hwNewSurah = (document.getElementById('hw-new-surah-select') as HTMLSelectElement)?.value;
                          const hwNewFromSurah = (document.getElementById('hw-new-from-surah') as HTMLSelectElement)?.value || SURAHS[0];
                          const hwNewToSurah = (document.getElementById('hw-new-to-surah') as HTMLSelectElement)?.value || SURAHS[0];
                          const hwNewToSurahAdvanced = (document.getElementById('hw-new-to-surah-advanced') as HTMLSelectElement)?.value || SURAHS[0];
                          const hwNewFrom = (document.getElementById('hw-new-from') as HTMLInputElement)?.value || '';
                          const hwNewTo = (document.getElementById('hw-new-to') as HTMLInputElement)?.value || '';

                          // 4. Homework Revision Values
                          const isHwRevPageMode = preferredModes.homeworkRev === 'page';
                          const isHwRevJuzMode = preferredModes.homeworkRev === 'juz';
                          const isHwRevHizbMode = preferredModes.homeworkRev === 'hizb';
                          const isHwRevSurahMode = preferredModes.homeworkRev === 'surah';
                          const hwRevSurah = (document.getElementById('hw-rev-surah-select') as HTMLSelectElement)?.value;
                          const hwRevFromSurah = (document.getElementById('hw-rev-from-surah') as HTMLSelectElement)?.value || SURAHS[0];
                          const hwRevToSurah = (document.getElementById('hw-rev-to-surah') as HTMLSelectElement)?.value || SURAHS[0];
                          const hwRevToSurahAdvanced = (document.getElementById('hw-rev-to-surah-advanced') as HTMLSelectElement)?.value || SURAHS[0];
                          const hwRevFrom = (document.getElementById('hw-rev-from') as HTMLInputElement)?.value || '';
                          const hwRevTo = (document.getElementById('hw-rev-to') as HTMLInputElement)?.value || '';

                          // 4.5. Homework Old Revision Values
                          const isHwOldRevPageMode = preferredModes.homeworkOldRev === 'page';
                          const isHwOldRevJuzMode = preferredModes.homeworkOldRev === 'juz';
                          const isHwOldRevHizbMode = preferredModes.homeworkOldRev === 'hizb';
                          const isHwOldRevSurahMode = preferredModes.homeworkOldRev === 'surah';
                          const hwOldRevSurah = (document.getElementById('hw-oldrev-surah-select') as HTMLSelectElement)?.value;
                          const hwOldRevFromSurah = (document.getElementById('hw-oldrev-from-surah') as HTMLSelectElement)?.value || SURAHS[0];
                          const hwOldRevToSurah = (document.getElementById('hw-oldrev-to-surah') as HTMLSelectElement)?.value || SURAHS[0];
                          const hwOldRevToSurahAdvanced = (document.getElementById('hw-oldrev-to-surah-advanced') as HTMLSelectElement)?.value || SURAHS[0];
                          const hwOldRevFrom = (document.getElementById('hw-oldrev-from') as HTMLInputElement)?.value || '';
                          const hwOldRevTo = (document.getElementById('hw-oldrev-to') as HTMLInputElement)?.value || '';

                          // Extract Advanced Surah Values reading
                          const quranNewToSurahAdvanced = (document.getElementById('quran-new-to-surah-advanced') as HTMLSelectElement)?.value || SURAHS[0];
                          const quranRevToSurahAdvanced = (document.getElementById('quran-rev-to-surah-advanced') as HTMLSelectElement)?.value || SURAHS[0];
                          const quranOldRevToSurahAdvanced = (document.getElementById('quran-oldrev-to-surah-advanced') as HTMLSelectElement)?.value || SURAHS[0];


                          // Build Report
                          const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
                          const months_ar = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
                          const date = new Date(year, month, smartReportModal.dayNum);
                          const dateStr = `${days[date.getDay()]} ${toHindiDigits(date.getDate())} ${months_ar[date.getMonth()]} ${toHindiDigits(date.getFullYear())}`;

                          // Build header with optional class number
                          const sub = subscriptionSettings[smartReportModal.studentId];
                          let classNumLine = '';
                          if (sub && sub.enabled) {
                            const displayClassNum = (sub.currentClass % (sub.totalClasses || 1)) + 1;
                            const classNumAr = toHindiDigits(sub.mode === 'monthly' ? (sub.currentClass + 1) : displayClassNum);
                            if (sub.mode === 'monthly') {
                              classNumLine = `رقم الحصة: ${classNumAr}\n`;
                            } else {
                              const isLast = displayClassNum === sub.totalClasses;
                              const totalAr = toHindiDigits(sub.totalClasses);
                              classNumLine = `رقم الحصة: ${classNumAr} من ${totalAr}${isLast ? ' (آخر حصة في الاشتراك)' : ''}\n`;
                            }
                          }

                          const academySettings = student ? academyRates[student.academy] : null;
                          const showHeader = academySettings?.includeReportHeader !== false;

                          const bookNameAr = (lastReports[smartReportModal.studentId]?.noor?.book || defaultNoorBook) === 'taasees' ? 'كتاب التأسيس' : 'نور البيان';
                          const headerAr = (reportPath === 'noor') 
                            ? bookNameAr 
                            : 'تقرير الحصة';

                          let report = '';
                          if (showHeader) {
                            report += `📖 *${headerAr}*\n\nالطالب: ${studentName}\nالتاريخ: ${dateStr}\n${classNumLine}\n*ــــــــــــــــــــــــــــــــــــــ*\n\n`;
                          }

                          report += `✅ *إنجاز الحصة:*\n`;
                          if (mergeWithQuran) {
                            report += `\n📖 *( Quran )* -----\n`;
                          }

                          // Helper to check cancellation
                          const isActive = (id: string, value: string) => !cancelledInputs[id] && value !== '0' && value !== '٠' && value !== '';

                          const formatRangeAr = (prefix: string, fromId: string, fromVal: string, toId: string, toVal: string) => {
                            // 1. Single Value (Shaded/Cancelled)
                            if (cancelledInputs[toId]) {
                              return `${prefix} ${fromVal}`; // e.g. "آية 13" or "سورة المائدة"
                            }

                            // 2. Open Range (Zero only)
                            if (toVal && (toVal.trim() === '0' || toVal.trim() === '٠')) {
                              return `من ${prefix} ${fromVal} لـ...`;
                            }

                            // 3. Single Value (Empty)
                            if (!toVal || toVal.trim() === '') {
                              return `${prefix} ${fromVal}`;
                            }

                            // 4. Normal Range
                            return `من ${prefix} ${fromVal} إلى ${prefix} ${toVal}`;
                          };

                          const formatAyahRange = (surah: string, fromId: string, fromVal: string, toId: string, toVal: string) => {
                            const isFromActive = !cancelledInputs[fromId] && fromVal && fromVal.trim() !== '';
                            const isToCancelled = cancelledInputs[toId];
                            const isToZero = toVal && (toVal.trim() === '0' || toVal.trim() === '٠');
                            const isToEmpty = !toVal || toVal.trim() === '';

                            // CHECK END OF SURAH
                            let isEnd = false;
                            if (surah && toVal) {
                              const sName = surah.replace('سورة ', '');
                              const sIdx = SURAHS.indexOf(sName);
                              if (sIdx > -1) {
                                let numVal = parseInt(toVal.replace(/[٠-٩]/g, d => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]));
                                if (numVal === SURAH_AYAH_COUNTS[sIdx]) isEnd = true;
                              }
                            }

                            if (!isFromActive) return `سورة ${surah}`;

                            if (isToCancelled || isToEmpty) {
                              return `سورة ${surah} (${fromVal})`;
                            }
                            if (isToZero) {
                              return `سورة ${surah} (من ${fromVal} لـ...)`;
                            }
                            if (isEnd) {
                              return `سورة ${surah} (من ${fromVal} إلى نهايتها)`;
                            }
                            return `سورة ${surah} (من ${fromVal} إلى ${toVal})`;
                          };

                          // 5. Tilawa (Reading) Values
                          const isQuranTilawaPageMode = preferredModes.readingTilawa === 'page';
                          const isQuranTilawaJuzMode = preferredModes.readingTilawa === 'juz';
                          const isQuranTilawaHizbMode = preferredModes.readingTilawa === 'hizb';
                          const isQuranTilawaSurahMode = preferredModes.readingTilawa === 'surah';
                          const quranTilawaSurah = (document.getElementById('quran-tilawa-surah-select') as HTMLSelectElement)?.value || SURAHS[0];
                          const quranTilawaFromSurah = (document.getElementById('quran-tilawa-from-surah') as HTMLSelectElement)?.value || SURAHS[0];
                          const quranTilawaToSurah = (document.getElementById('quran-tilawa-to-surah') as HTMLSelectElement)?.value || SURAHS[0];
                          const quranTilawaToSurahAdvanced = (document.getElementById('quran-tilawa-to-surah-advanced') as HTMLSelectElement)?.value || SURAHS[0];
                          const quranTilawaFromAyah = (document.getElementById('quran-tilawa-from-ayah') as HTMLInputElement)?.value;
                          const quranTilawaToAyah = (document.getElementById('quran-tilawa-to-ayah') as HTMLInputElement)?.value;
                          const quranTilawaFromPage = (document.getElementById('quran-tilawa-from-page') as HTMLInputElement)?.value;
                          const quranTilawaToPage = (document.getElementById('quran-tilawa-to-page') as HTMLInputElement)?.value;
                          const quranTilawaFromJuz = (document.getElementById('quran-tilawa-from-juz') as HTMLInputElement)?.value;
                          const quranTilawaToJuz = (document.getElementById('quran-tilawa-to-juz') as HTMLInputElement)?.value;
                          const quranTilawaFromHizb = (document.getElementById('quran-tilawa-from-hizb') as HTMLInputElement)?.value;
                          const quranTilawaToHizb = (document.getElementById('quran-tilawa-to-hizb') as HTMLInputElement)?.value;

                          // Add New Recitation (only if toggle is ON)
                          if (sectionToggles.readingNew && !prevReportHadExclusion && !excludeReadingNew) {
                            report += `\n*• الجديد:*\n`;

                            if (isQuranNewPageMode) {
                              report += formatRangeAr('صفحة', 'quran-new-from-page', quranNewFromPage, 'quran-new-to-page', quranNewToPage);
                            }
                            else if (isQuranNewJuzMode) {
                              report += formatRangeAr('الجزء', 'quran-new-from-juz', quranNewFromJuz, 'quran-new-to-juz', quranNewToJuz);
                            }
                            else if (isQuranNewHizbMode) {
                              report += formatRangeAr('الحزب', 'quran-new-from-hizb', quranNewFromHizb, 'quran-new-to-hizb', quranNewToHizb);
                            }
                            else if (isQuranNewSurahMode) report += `من سورة ${quranNewFromSurah} إلى سورة ${quranNewToSurah}`;
                            else if (activeAdvancedAyah.readingNew) {
                              if (quranNewSurah === quranNewToSurahAdvanced) {
                                // Same Surah -> Use Standard Format
                                report += formatAyahRange(quranNewSurah, 'quran-new-from-ayah', quranNewFromAyah, 'quran-new-to-ayah', quranNewToAyah);
                              } else {
                                // Different Surahs
                                const showFrom = isActive('quran-new-from-ayah', quranNewFromAyah);
                                const showTo = isActive('quran-new-to-ayah', quranNewToAyah);
                                const p1 = showFrom ? `من سورة ${quranNewSurah} آية ${quranNewFromAyah}` : `من سورة ${quranNewSurah}`;
                                const p2 = showTo ? `إلى سورة ${quranNewToSurahAdvanced} آية ${quranNewToAyah}` : `إلى سورة ${quranNewToSurahAdvanced}`;
                                report += `${p1} ${p2}`;
                              }
                            }
                            else {
                              // Default Ayah Mode
                              const surah = quranNewSurah || getEnglishSurahName(SURAHS[0]);
                              report += formatAyahRange(surah, 'quran-new-from-ayah', quranNewFromAyah, 'quran-new-to-ayah', quranNewToAyah);
                            }
                            report += `\n`;
                          }

                          // Add Revision Recitation (only if toggle is ON)
                          if (sectionToggles.readingRev && !excludeReadingRev) {
                            report += `\n*• المراجعة:*\n`;

                            if (isQuranRevPageMode) {
                              report += formatRangeAr('صفحة', 'quran-rev-from-page', quranRevFromPage, 'quran-rev-to-page', quranRevToPage);
                            }
                            else if (isQuranRevJuzMode) {
                              report += formatRangeAr('الجزء', 'quran-rev-from-juz', quranRevFromJuz, 'quran-rev-to-juz', quranRevToJuz);
                            }
                            else if (isQuranRevHizbMode) {
                              report += formatRangeAr('الحزب', 'quran-rev-from-hizb', quranRevFromHizb, 'quran-rev-to-hizb', quranRevToHizb);
                            }
                            else if (isQuranRevSurahMode) report += `من سورة ${quranRevFromSurah} إلى سورة ${quranRevToSurah}`;
                            else if (activeAdvancedAyah.readingRev) {
                              if (quranRevSurah === quranRevToSurahAdvanced) {
                                report += formatAyahRange(quranRevSurah, 'quran-rev-from-ayah', quranRevFromAyah, 'quran-rev-to-ayah', quranRevToAyah);
                              } else {
                                const showFrom = isActive('quran-rev-from-ayah', quranRevFromAyah);
                                const showTo = isActive('quran-rev-to-ayah', quranRevToAyah);
                                const p1 = showFrom ? `من سورة ${quranRevSurah} آية ${quranRevFromAyah}` : `من سورة ${quranRevSurah}`;
                                const p2 = showTo ? `إلى سورة ${quranRevToSurahAdvanced} آية ${quranRevToAyah}` : `إلى سورة ${quranRevToSurahAdvanced}`;
                                report += `${p1} ${p2}`;
                              }
                            }
                            else {
                              const surah = quranRevSurah || getEnglishSurahName(SURAHS[0]);
                              report += formatAyahRange(surah, 'quran-rev-from-ayah', quranRevFromAyah, 'quran-rev-to-ayah', quranRevToAyah);
                            }
                            report += `\n`;
                          }


                          // Add Old Revision Recitation (only if toggle is ON)
                          if (sectionToggles.readingOldRev && !excludeReadingOldRev) {
                            report += `\n*• المراجعة البعيدة:*\n`;

                            if (isQuranOldRevPageMode) {
                              report += formatRangeAr('صفحة', 'quran-oldrev-from-page', quranOldRevFromPage, 'quran-oldrev-to-page', quranOldRevToPage);
                            }
                            else if (isQuranOldRevJuzMode) {
                              report += formatRangeAr('الجزء', 'quran-oldrev-from-juz', quranOldRevFromJuz, 'quran-oldrev-to-juz', quranOldRevToJuz);
                            }
                            else if (isQuranOldRevHizbMode) {
                              report += formatRangeAr('الحزب', 'quran-oldrev-from-hizb', quranOldRevFromHizb, 'quran-oldrev-to-hizb', quranOldRevToHizb);
                            }
                            else if (isQuranOldRevSurahMode) report += `من سورة ${quranOldRevFromSurah} إلى سورة ${quranOldRevToSurah}`;
                            else if (activeAdvancedAyah.readingOldRev) {
                              if (quranOldRevSurah === quranOldRevToSurahAdvanced) {
                                report += formatAyahRange(quranOldRevSurah, 'quran-oldrev-from-ayah', quranOldRevFromAyah, 'quran-oldrev-to-ayah', quranOldRevToAyah);
                              } else {
                                const showFrom = isActive('quran-oldrev-from-ayah', quranOldRevFromAyah);
                                const showTo = isActive('quran-oldrev-to-ayah', quranOldRevToAyah);
                                const p1 = showFrom ? `من سورة ${quranOldRevSurah} آية ${quranOldRevFromAyah}` : `من سورة ${quranOldRevSurah}`;
                                const p2 = showTo ? `إلى سورة ${quranOldRevToSurahAdvanced} آية ${quranOldRevToAyah}` : `إلى سورة ${quranOldRevToSurahAdvanced}`;
                                report += `${p1} ${p2}`;
                              }
                            }
                            else {
                              const surah = quranOldRevSurah || getEnglishSurahName(SURAHS[0]);
                              report += formatAyahRange(surah, 'quran-oldrev-from-ayah', quranOldRevFromAyah, 'quran-oldrev-to-ayah', quranOldRevToAyah);
                            }
                            report += `\n`;
                          }

                          // Add Tilawa (Reading) Section (only if toggle is ON)
                          if (sectionToggles.readingTilawa && !excludeReadingTilawa) {
                            report += `\n*• القراءة:*\n`;
                            if (isQuranTilawaPageMode) {
                              report += formatRangeAr('صفحة', 'quran-tilawa-from-page', quranTilawaFromPage, 'quran-tilawa-to-page', quranTilawaToPage);
                            }
                            else if (isQuranTilawaJuzMode) {
                              report += formatRangeAr('الجزء', 'quran-tilawa-from-juz', quranTilawaFromJuz, 'quran-tilawa-to-juz', quranTilawaToJuz);
                            }
                            else if (isQuranTilawaHizbMode) {
                              report += formatRangeAr('الحزب', 'quran-tilawa-from-hizb', quranTilawaFromHizb, 'quran-tilawa-to-hizb', quranTilawaToHizb);
                            }
                            else if (isQuranTilawaSurahMode) report += `من سورة ${quranTilawaFromSurah} إلى سورة ${quranTilawaToSurah}`;
                            else if (activeAdvancedAyah.readingTilawa) {
                              if (quranTilawaSurah === quranTilawaToSurahAdvanced) {
                                report += formatAyahRange(quranTilawaSurah, 'quran-tilawa-from-ayah', quranTilawaFromAyah, 'quran-tilawa-to-ayah', quranTilawaToAyah);
                              } else {
                                const showFrom = isActive('quran-tilawa-from-ayah', quranTilawaFromAyah);
                                const showTo = isActive('quran-tilawa-to-ayah', quranTilawaToAyah);
                                const p1 = showFrom ? `من سورة ${quranTilawaSurah} آية ${quranTilawaFromAyah}` : `من سورة ${quranTilawaSurah}`;
                                const p2 = showTo ? `إلى سورة ${quranTilawaToSurahAdvanced} آية ${quranTilawaToAyah}` : `إلى سورة ${quranTilawaToSurahAdvanced}`;
                                report += `${p1} ${p2}`;
                              }
                            }
                            else {
                              const surah = quranTilawaSurah || getEnglishSurahName(SURAHS[0]);
                              report += formatAyahRange(surah, 'quran-tilawa-from-ayah', quranTilawaFromAyah, 'quran-tilawa-to-ayah', quranTilawaToAyah);
                            }
                            report += `\n`;
                          }

                          if (sectionToggles.quranTajweed && !excludeQuranTajweed) {
                            const currentTajweedLesson = getTajweedLessonTitle(quranTajweedCurrentLessonId, 'ar');
                            report += `\n*• التجويد:*\n`;
                            report += `${currentTajweedLesson}\n`;
                            // Tajweed Quiz Note removed from summary as per user request
                          }

                          const audioLinkVal = audioLinkText.trim();
                          if (audioLinkVal) {
                            report += `\n*• التوجيهات الصوتية:*\n${audioLinkVal}\n`;
                          }

                          if (mergeWithQuran && noorSummaryPart) {
                            const bookNameEnForAr = (lastReports[smartReportModal.studentId]?.noor?.book || defaultNoorBook) === 'taasees' ? 'Foundation Book' : 'Noor El-Bayan Book';
                            report += `\n📚 *( ${bookNameEnForAr} )* -----\n\n${noorSummaryPart}`;
                          }

                           const planLabelAr = '📝 *حصتنا القادمة:*';
                          report += `\n*ــــــــــــــــــــــــــــــــــــــ*\n\n${planLabelAr}\n`;
                          if (mergeWithQuran) {
                            report += `\n📖 *( Quran )* -----\n`;
                          }

                          // Add New Homework (only if toggle is ON)
                          if (sectionToggles.homeworkNew && !excludeHomeworkNew) {
                            report += `\n*• الجديد:*\n`;

                            if (excludeNewFromReport) {
                              // Mastery exclusion mode: show mastery message if reasons selected, otherwise skip
                              if (masteryDeficiency.length > 0) {
                                const arLabels: Record<string, string> = { rev: 'المراجعة', oldRev: 'المراجعة البعيدة' };
                                const parts = masteryDeficiency.map(k => arLabels[k]).filter(Boolean);
                                report += `يلزم تحقيق الإتقان في (${parts.join('، و')})`;
                              }
                            } else {
                              if (isRedoMode) report += `(إعادة) `;

                              if (isHwNewPageMode) {
                                report += formatRangeAr('صفحة', 'hw-new-from', hwNewFrom, 'hw-new-to', hwNewTo);
                              }
                              else if (isHwNewJuzMode) {
                                report += formatRangeAr('الجزء', 'hw-new-from', hwNewFrom, 'hw-new-to', hwNewTo);
                              }
                              else if (isHwNewHizbMode) {
                                report += formatRangeAr('الحزب', 'hw-new-from', hwNewFrom, 'hw-new-to', hwNewTo);
                              }
                              else if (isHwNewSurahMode) report += `من سورة ${hwNewFromSurah} إلى سورة ${hwNewToSurah}`;
                              else if (activeAdvancedAyah.homeworkNew) {
                                if (hwNewSurah === hwNewToSurahAdvanced) {
                                  report += formatAyahRange(hwNewSurah, 'hw-new-from', hwNewFrom, 'hw-new-to', hwNewTo);
                                } else {
                                  const showFrom = isActive('hw-new-from', hwNewFrom);
                                  const showTo = isActive('hw-new-to', hwNewTo);
                                  const p1 = showFrom ? `من سورة ${hwNewSurah} آية ${hwNewFrom}` : `من سورة ${hwNewSurah}`;
                                  const p2 = showTo ? `إلى سورة ${hwNewToSurahAdvanced} آية ${hwNewTo}` : `إلى سورة ${hwNewToSurahAdvanced}`;
                                  report += `${p1} ${p2}`;
                                }
                              }
                              else {
                                const surah = hwNewSurah || getEnglishSurahName(SURAHS[0]);
                                report += formatAyahRange(surah, 'hw-new-from', hwNewFrom, 'hw-new-to', hwNewTo);
                              }
                            }
                            report += `\n`;
                          }

                          // Add Revision Homework (only if toggle is ON)
                          if (sectionToggles.homeworkRev && !excludeHomeworkRev) {
                            report += `\n*• المراجعة:*\n`;
                            if (isRedoModeRev) report += `(إعادة) `;

                            if (isHwRevPageMode) {
                              report += formatRangeAr('صفحة', 'hw-rev-from', hwRevFrom, 'hw-rev-to', hwRevTo);
                            }
                            else if (isHwRevJuzMode) {
                              report += formatRangeAr('الجزء', 'hw-rev-from', hwRevFrom, 'hw-rev-to', hwRevTo);
                            }
                            else if (isHwRevHizbMode) {
                              report += formatRangeAr('الحزب', 'hw-rev-from', hwRevFrom, 'hw-rev-to', hwRevTo);
                            }
                            else if (isHwRevSurahMode) report += `من سورة ${hwRevFromSurah} إلى سورة ${hwRevToSurah}`;
                            else if (activeAdvancedAyah.homeworkRev) {
                              if (hwRevSurah === hwRevToSurahAdvanced) {
                                report += formatAyahRange(hwRevSurah, 'hw-rev-from', hwRevFrom, 'hw-rev-to', hwRevTo);
                              } else {
                                const showFrom = isActive('hw-rev-from', hwRevFrom);
                                const showTo = isActive('hw-rev-to', hwRevTo);
                                const p1 = showFrom ? `من سورة ${hwRevSurah} آية ${hwRevFrom}` : `من سورة ${hwRevSurah}`;
                                const p2 = showTo ? `إلى سورة ${hwRevToSurahAdvanced} آية ${hwRevTo}` : `إلى سورة ${hwRevToSurahAdvanced}`;
                                report += `${p1} ${p2}`;
                              }
                            }
                            else {
                              const surah = hwRevSurah || getEnglishSurahName(SURAHS[0]);
                              report += formatAyahRange(surah, 'hw-rev-from', hwRevFrom, 'hw-rev-to', hwRevTo);
                            }
                            report += `\n`;
                          }


                          // Add Homework Old Revision (only if toggle is ON)
                          if (sectionToggles.homeworkOldRev && !excludeHomeworkOldRev) {
                            report += `\n*\u2022 المراجعة البعيدة:*\n`;
                            if (isRedoModeOldRev) report += `(إعادة) `;

                            if (isHwOldRevPageMode) {
                              report += formatRangeAr('صفحة', 'hw-oldrev-from', hwOldRevFrom, 'hw-oldrev-to', hwOldRevTo);
                            }
                            else if (isHwOldRevJuzMode) {
                              report += formatRangeAr('الجزء', 'hw-oldrev-from', hwOldRevFrom, 'hw-oldrev-to', hwOldRevTo);
                            }
                            else if (isHwOldRevHizbMode) {
                              report += formatRangeAr('الحزب', 'hw-oldrev-from', hwOldRevFrom, 'hw-oldrev-to', hwOldRevTo);
                            }
                            else if (isHwOldRevSurahMode) report += `من سورة ${hwOldRevFromSurah} إلى سورة ${hwOldRevToSurah}`;
                            else if (activeAdvancedAyah.homeworkOldRev) {
                              if ((hwOldRevSurah || SURAHS[0]) === hwOldRevToSurahAdvanced) {
                                report += formatAyahRange(hwOldRevSurah || getEnglishSurahName(SURAHS[0]), 'hw-oldrev-from', hwOldRevFrom, 'hw-oldrev-to', hwOldRevTo);
                              } else {
                                const showFrom = isActive('hw-oldrev-from', hwOldRevFrom);
                                const showTo = isActive('hw-oldrev-to', hwOldRevTo);
                                const p1 = showFrom ? `من سورة ${hwOldRevSurah || getEnglishSurahName(SURAHS[0])} آية ${hwOldRevFrom}` : `من سورة ${hwOldRevSurah || getEnglishSurahName(SURAHS[0])}`;
                                const p2 = showTo ? `إلى سورة ${hwOldRevToSurahAdvanced} آية ${hwOldRevTo}` : `إلى سورة ${hwOldRevToSurahAdvanced}`;
                                report += `${p1} ${p2}`;
                              }
                            }
                            else {
                              const surah = hwOldRevSurah || getEnglishSurahName(SURAHS[0]);
                              report += formatAyahRange(surah, 'hw-oldrev-from', hwOldRevFrom, 'hw-oldrev-to', hwOldRevTo);
                            }
                            report += `\n`;
                          }

                          // 6. Homework Tilawa (Reading) Values
                          const isHwTilawaPageMode = preferredModes.homeworkTilawa === 'page';
                          const isHwTilawaJuzMode = preferredModes.homeworkTilawa === 'juz';
                          const isHwTilawaHizbMode = preferredModes.homeworkTilawa === 'hizb';
                          const isHwTilawaSurahMode = preferredModes.homeworkTilawa === 'surah';
                          const hwTilawaSurah = (document.getElementById('hw-tilawa-surah-select') as HTMLSelectElement)?.value || SURAHS[0];
                          const hwTilawaFromSurah = (document.getElementById('hw-tilawa-from-surah') as HTMLSelectElement)?.value || SURAHS[0];
                          const hwTilawaToSurah = (document.getElementById('hw-tilawa-to-surah') as HTMLSelectElement)?.value || SURAHS[0];
                          const hwTilawaToSurahAdvanced = (document.getElementById('hw-tilawa-to-surah-advanced') as HTMLSelectElement)?.value || SURAHS[0];
                          const hwTilawaFrom = (document.getElementById('hw-tilawa-from') as HTMLInputElement)?.value || '';
                          const hwTilawaTo = (document.getElementById('hw-tilawa-to') as HTMLInputElement)?.value || '';

                          // Add Homework Tilawa (Reading) Section (only if toggle is ON)
                          if (sectionToggles.homeworkTilawa && !excludeHomeworkTilawa) {
                            report += `\n*• القراءة:*\n`;
                            if (isRedoModeTilawa) report += `(إعادة) `;

                            if (isHwTilawaPageMode) {
                              report += formatRangeAr('صفحة', 'hw-tilawa-from', hwTilawaFrom, 'hw-tilawa-to', hwTilawaTo);
                            }
                            else if (isHwTilawaJuzMode) {
                              report += formatRangeAr('الجزء', 'hw-tilawa-from', hwTilawaFrom, 'hw-tilawa-to', hwTilawaTo);
                            }
                            else if (isHwTilawaHizbMode) {
                              report += formatRangeAr('الحزب', 'hw-tilawa-from', hwTilawaFrom, 'hw-tilawa-to', hwTilawaTo);
                            }
                            else if (isHwTilawaSurahMode) report += `من سورة ${hwTilawaFromSurah} إلى سورة ${hwTilawaToSurah}`;
                            else if (activeAdvancedAyah.homeworkTilawa) {
                              if (hwTilawaSurah === hwTilawaToSurahAdvanced) {
                                report += formatAyahRange(hwTilawaSurah, 'hw-tilawa-from', hwTilawaFrom, 'hw-tilawa-to', hwTilawaTo);
                              } else {
                                const showFrom = isActive('hw-tilawa-from', hwTilawaFrom);
                                const showTo = isActive('hw-tilawa-to', hwTilawaTo);
                                const p1 = showFrom ? `من سورة ${hwTilawaSurah} آية ${hwTilawaFrom}` : `من سورة ${hwTilawaSurah}`;
                                const p2 = showTo ? `إلى سورة ${hwTilawaToSurahAdvanced} آية ${hwTilawaTo}` : `إلى سورة ${hwTilawaToSurahAdvanced}`;
                                report += `${p1} ${p2}`;
                              }
                            }
                            else {
                              const surah = hwTilawaSurah || getEnglishSurahName(SURAHS[0]);
                              report += formatAyahRange(surah, 'hw-tilawa-from', hwTilawaFrom, 'hw-tilawa-to', hwTilawaTo);
                            }

                            report += `\n`;
                          }

                          if (sectionToggles.quranTajweed && !excludeQuranTajweed) {
                            const currentTajweedLesson = getTajweedLessonTitle(quranTajweedCurrentLessonId, 'ar');
                            const nextTajweedLesson = quranTajweedNextLessonId === TAJWEED_NEXT_REPEAT
                              ? currentTajweedLesson
                              : quranTajweedNextLessonId === TAJWEED_NEXT_HIDE || !quranTajweedNextLessonId
                                ? ''
                                : getTajweedLessonTitle(quranTajweedNextLessonId, 'ar');
                            if (nextTajweedLesson || arTajweedQuizNote) {
                              report += `\n*• التجويد:*\n`;
                              if (nextTajweedLesson) {
                                report += `${nextTajweedLesson}\n`;
                              }
                              if (arTajweedQuizNote) {
                                if (nextTajweedLesson) {
                                  report += `\n- *Kindly check the homework section*\n`;
                                } else {
                                  report += `Kindly check the homework section\n`;
                                }
                              }
                            }
                          }



                          // Save Report Config
                          if (mergeWithQuran && noorPlanPart) {
                            const bookNameEnForArPlan = (lastReports[smartReportModal.studentId]?.noor?.book || defaultNoorBook) === 'taasees' ? 'Foundation Book' : 'Noor El-Bayan Book';
                            report += `\n📚 *( ${bookNameEnForArPlan} )* -----\n\n${noorPlanPart}`;

                            // Foundation Book Listening Link (Arabic - merged mode)
                            const isMergedFoundationBookAr = (lastReports[smartReportModal.studentId]?.noor?.book || defaultNoorBook) === 'taasees';
                            const mergedListenPageAr = (() => {
                              const sayatimVal = (document.getElementById('noor-sayatim-from-page') as HTMLInputElement)?.value || '';
                              const tamVal = (document.getElementById('noor-tam-from-page') as HTMLInputElement)?.value || '';
                              return sayatimVal || tamVal;
                            })();
                            if (isMergedFoundationBookAr && mergedListenPageAr) {
                              const mergedPageEng = toEnglish(mergedListenPageAr);
                              report += `\n*• الاستماع:*\nhttps://audio-foundation-book.vercel.app/?page=${mergedPageEng}\n`;
                            }
                          }

                          // Smart End of Surah text replacements for Arabic
                          report = report.replace(/إلى سورة ([^\s]+) آية (\d+|[٠-٩]+)/g, (match, surah, ayahStr) => {
                              const sIdx = SURAHS.indexOf(surah.replace('سورة ', ''));
                              if (sIdx > -1) {
                                  const val = parseInt(ayahStr.replace(/[٠-٩]/g, (d:any) => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]));
                                  if (val === SURAH_AYAH_COUNTS[sIdx]) return `إلى نهاية سورة ${surah}`;
                              }
                              return match;
                          });
                            report = report.replace(/من سورة\s+(.+?)\s+آية\s+(?:1|١)\s+إلى نهاية سورة\s+(.+)/g, 'من سورة $1 إلى سورة $2');

                          // Custom Notes
                          const customNotesVal = customNotesText.trim();
                          if (customNotesVal) {
                            report += `\n*ــــــــــــــــــــــــــــــــــــــ*\n\n✏️ *ملاحظات:*\n${customNotesVal}`;
                          }

                          setLastReports(prev => ({
                            ...prev,
                            [smartReportModal.studentId]: {
                              ...prev[smartReportModal.studentId],
                              ...noorConfigPart,
                              customNotes: customNotesVal || '',
                              audioLink: audioLinkText.trim() || '',
                              readingNew: {
                                mode: preferredModes.readingNew,
                                surah: quranNewSurah,
                                fromAyah: quranNewFromAyah,
                                toAyah: quranNewToAyah,
                                fromPage: quranNewFromPage,
                                toPage: quranNewToPage,
                                fromJuz: quranNewFromJuz,
                                toJuz: quranNewToJuz,
                                fromHizb: quranNewFromHizb,
                                toHizb: quranNewToHizb,
                                fromSurah: quranNewFromSurah,
                                toSurah: activeAdvancedAyah.readingNew ? quranNewToSurahAdvanced : quranNewToSurah,
                                isAdvancedAyah: activeAdvancedAyah.readingNew
                              },
                              readingRev: {
                                mode: preferredModes.readingRev,
                                surah: quranRevSurah,
                                fromAyah: quranRevFromAyah,
                                toAyah: quranRevToAyah,
                                fromPage: quranRevFromPage,
                                toPage: quranRevToPage,
                                fromJuz: quranRevFromJuz,
                                toJuz: quranRevToJuz,
                                fromHizb: quranRevFromHizb,
                                toHizb: quranRevToHizb,
                                fromSurah: quranRevFromSurah,
                                toSurah: activeAdvancedAyah.readingRev ? quranRevToSurahAdvanced : quranRevToSurah,
                                isAdvancedAyah: activeAdvancedAyah.readingRev
                              },
                              homeworkNew: {
                                mode: preferredModes.homeworkNew,
                                surah: hwNewSurah,
                                from: hwNewFrom,
                                to: hwNewTo,
                                fromSurah: hwNewFromSurah,
                                toSurah: activeAdvancedAyah.homeworkNew ? hwNewToSurahAdvanced : hwNewToSurah,
                                isAdvancedAyah: activeAdvancedAyah.homeworkNew,
                                isRedo: isRedoMode,
                                excludeFromReport: excludeNewFromReport,
                                masteryDeficiency: masteryDeficiency
                              },
                              homeworkRev: {
                                mode: preferredModes.homeworkRev,
                                surah: hwRevSurah,
                                from: hwRevFrom,
                                to: hwRevTo,
                                fromSurah: hwRevFromSurah,
                                toSurah: activeAdvancedAyah.homeworkRev ? hwRevToSurahAdvanced : hwRevToSurah,
                                isAdvancedAyah: activeAdvancedAyah.homeworkRev
                              },
                              homeworkTilawa: {
                                mode: preferredModes.homeworkTilawa,
                                surah: hwTilawaSurah,
                                from: hwTilawaFrom,
                                to: hwTilawaTo,
                                fromSurah: hwTilawaFromSurah,
                                toSurah: activeAdvancedAyah.homeworkTilawa ? hwTilawaToSurahAdvanced : hwTilawaToSurah,
                                isAdvancedAyah: activeAdvancedAyah.homeworkTilawa
                              },
                              quranTajweed: {
                                currentLessonId: quranTajweedCurrentLessonId,
                                nextLessonId: quranTajweedNextLessonId
                              },
                              readingTilawa: {
                                mode: preferredModes.readingTilawa,
                                surah: quranTilawaSurah,
                                fromAyah: quranTilawaFromAyah,
                                toAyah: quranTilawaToAyah,
                                fromPage: quranTilawaFromPage,
                                toPage: quranTilawaToPage,
                                fromJuz: quranTilawaFromJuz,
                                toJuz: quranTilawaToJuz,
                                fromHizb: quranTilawaFromHizb,
                                toHizb: quranTilawaToHizb,
                                fromSurah: quranTilawaFromSurah,
                                toSurah: activeAdvancedAyah.readingTilawa ? quranTilawaToSurahAdvanced : quranTilawaToSurah,
                                isAdvancedAyah: activeAdvancedAyah.readingTilawa
                              },
                              sectionToggles: { ...sectionToggles },
                              cancelledInputs: { ...cancelledInputs }
                            }
                          }));

                          if (sendViaWhatsapp) {
                            // Resolve WhatsApp Target (Hierarchy: Student > Academy ONLY)
                            const student = students.find(s => s.id === smartReportModal.studentId);
                            const studentWhatsapp = student?.whatsappNumber;
                            const academyWhatsapp = student ? academyRates[student.academy]?.whatsappNumber : undefined;
                            const finalTarget = studentWhatsapp || academyWhatsapp;

                            if (!finalTarget || finalTarget.trim() === '') {
                              alert('يرجى تحديد رقم واتساب في إعدادات الطالب أو إعدادات الأكاديمية أولاً.');
                              return;
                            }

                            // Send via Puppeteer automation
                            const _arStudentId = smartReportModal.studentId;
                            const _arDayNum = smartReportModal.dayNum;
                            closeAllModals(true);
                            // Copy + open link immediately alongside WhatsApp send
                            navigator.clipboard.writeText(report).catch(() => { });
                            checkAndOpenLink(_arStudentId);
                            showToast('جاري الإرسال عبر واتساب... ⏳');
                            window.electronAPI?.sendWhatsAppAuto(finalTarget, report).then((result: any) => {
                              if (result.success) {
                                const reportKey = `${_arStudentId}_${_arDayNum}_${month}_${year}`;

                                // PERSISTENCE FIX: Ensure lastReports is updated even on WhatsApp send
                                setLastReports(prev => ({
                                  ...prev,
                                  [_arStudentId]: {
                                    ...prev[_arStudentId],
                                    sendViaWhatsapp: true,
                                    ...noorConfigPart,
                                    readingNew: {
                                      mode: preferredModes.readingNew,
                                      surah: quranNewSurah,
                                      fromAyah: quranNewFromAyah,
                                      toAyah: quranNewToAyah,
                                      fromPage: quranNewFromPage,
                                      toPage: quranNewToPage,
                                      fromJuz: quranNewFromJuz,
                                      toJuz: quranNewToJuz,
                                      fromHizb: quranNewFromHizb,
                                      toHizb: quranNewToHizb,
                                      fromSurah: quranNewFromSurah,
                                      toSurah: activeAdvancedAyah.readingNew ? quranNewToSurahAdvanced : quranNewToSurah,
                                      isAdvancedAyah: activeAdvancedAyah.readingNew
                                    },
                                    readingRev: {
                                      mode: preferredModes.readingRev,
                                      surah: quranRevSurah,
                                      fromAyah: quranRevFromAyah,
                                      toAyah: quranRevToAyah,
                                      fromPage: quranRevFromPage,
                                      toPage: quranRevToPage,
                                      fromJuz: quranRevFromJuz,
                                      toJuz: quranRevToJuz,
                                      fromHizb: quranRevFromHizb,
                                      toHizb: quranRevToHizb,
                                      fromSurah: quranRevFromSurah,
                                      toSurah: activeAdvancedAyah.readingRev ? quranRevToSurahAdvanced : quranRevToSurah,
                                      isAdvancedAyah: activeAdvancedAyah.readingRev
                                    },
                                    homeworkNew: {
                                      mode: preferredModes.homeworkNew,
                                      surah: hwNewSurah,
                                      from: hwNewFrom,
                                      to: hwNewTo,
                                      fromSurah: hwNewFromSurah,
                                      toSurah: activeAdvancedAyah.homeworkNew ? hwNewToSurahAdvanced : hwNewToSurah,
                                      isAdvancedAyah: activeAdvancedAyah.homeworkNew,
                                      isRedo: isRedoMode,
                                      excludeFromReport: excludeNewFromReport,
                                      masteryDeficiency: masteryDeficiency
                                    },
                                    homeworkRev: {
                                      mode: preferredModes.homeworkRev,
                                      surah: hwRevSurah,
                                      from: hwRevFrom,
                                      to: hwRevTo,
                                      fromSurah: hwRevFromSurah,
                                      toSurah: activeAdvancedAyah.homeworkRev ? hwRevToSurahAdvanced : hwRevToSurah,
                                      isAdvancedAyah: activeAdvancedAyah.homeworkRev
                                    },
                                    homeworkTilawa: {
                                      mode: preferredModes.homeworkTilawa,
                                      surah: hwTilawaSurah,
                                      from: hwTilawaFrom,
                                      to: hwTilawaTo,
                                      fromSurah: hwTilawaFromSurah,
                                      toSurah: activeAdvancedAyah.homeworkTilawa ? hwTilawaToSurahAdvanced : hwTilawaToSurah,
                                      isAdvancedAyah: activeAdvancedAyah.homeworkTilawa
                                    },
                                    quranTajweed: {
                                      currentLessonId: quranTajweedCurrentLessonId,
                                      nextLessonId: quranTajweedNextLessonId
                                    },
                                    readingTilawa: {
                                      mode: preferredModes.readingTilawa,
                                      surah: quranTilawaSurah,
                                      fromAyah: quranTilawaFromAyah,
                                      toAyah: quranTilawaToAyah,
                                      fromPage: quranTilawaFromPage,
                                      toPage: quranTilawaToPage,
                                      fromJuz: quranTilawaFromJuz,
                                      toJuz: quranTilawaToJuz,
                                      fromHizb: quranTilawaFromHizb,
                                      toHizb: quranTilawaToHizb,
                                      fromSurah: quranTilawaFromSurah,
                                      toSurah: activeAdvancedAyah.readingTilawa ? quranTilawaToSurahAdvanced : quranTilawaToSurah,
                                      isAdvancedAyah: activeAdvancedAyah.readingTilawa
                                    },
                                    sectionToggles: { ...sectionToggles },
                                    cancelledInputs: { ...cancelledInputs }
                                  }
                                }));

                                saveReportForDay(_arStudentId, _arDayNum, report, {
                                  ...noorConfigPart,
                                  noorDetails,
                                  activeSection: reportPath,
                                  mergeWithQuran,
                                  customNotes: customNotesText.trim(),
                                  audioLink: audioLinkText.trim()
                                });
                                ensureTajweedAssignmentForLesson(_arStudentId, arReportTajweedLessonId, 'ar');
                                 if (mergeWithQuran) {
                                   new Notification('تذكير الدمج 📖', { body: `تم دمج تقرير ${studentName} مع القرآن الكريم` });
                                 }

                                showToast('تم الإرسال عبر واتساب ✅');
                                setSearchQuery('');
                                new Notification('تم الإرسال ✅', { body: `تم إرسال تقرير ${studentName} عبر واتساب بنجاح` });
                              } else {
                                showToast('حدث خطأ في الإرسال ❌');
                                console.error('WhatsApp error:', result.error);
                              }
                            }).catch((err: any) => {
                              console.error('WhatsApp automation error:', err);
                              showToast('حدث خطأ في الإرسال ❌');
                            });
                          } else {
                            const _arCopyStudentId = smartReportModal.studentId;
                            const _arCopyDayNum = smartReportModal.dayNum;
                            closeAllModals(true);
                            navigator.clipboard.writeText(report).then(() => {
                              saveReportForDay(_arCopyStudentId, _arCopyDayNum, report, {
                                ...noorConfigPart,
                                noorDetails,
                                activeSection: reportPath,
                                mergeWithQuran,
                                customNotes: customNotesText.trim(),
                                audioLink: audioLinkText.trim()
                              });
                              ensureTajweedAssignmentForLesson(_arCopyStudentId, arReportTajweedLessonId, 'ar');
                               if (mergeWithQuran) {
                                 new Notification('تذكير الدمج 📖', { body: `تم دمج تقرير ${studentName} مع القرآن الكريم` });
                               }

                              showToast('تم نسخ التقرير (عربي) ✨');
                              setSearchQuery('');
                              checkAndOpenLink(_arCopyStudentId);
                            });
                          }
                        }}
                        className="py-4 px-10 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-arabic text-xl font-medium hover:shadow-lg flex items-center justify-center gap-3 min-w-[200px] transition-transform active:scale-95"
                      >
                        {sendViaWhatsapp ? <MessageCircle className="w-6 h-6" /> : '📋'} عربي
                      </button>
                      <button
                        onClick={() => {
                          // Warning logic for Noor Al-Bayan section (English)
                          if (reportPath === 'quran' && mergeWithQuran && !visitedNoor && !noorWarningShown) {
                            setNoorWarningShown(true);
                            showToast('⚠️ You haven\'t checked Noor Al-Bayan!');
                            return;
                          }
                          setLastReportLanguage('en');
                          // --- ENGLISH REPORT GENERATION ---
                          const enReportTajweedLessonId = reportPath === 'tajweed'
                            ? selectedTajweedLessonId
                            : (sectionToggles.quranTajweed && (reportPath !== 'noor' || mergeWithQuran) ? quranTajweedCurrentLessonId : '');
                          const enTajweedQuizNote = getTajweedQuizNote('en', smartReportModal.studentId, enReportTajweedLessonId);
                          // Helper to check cancellation
                          const isActive = (id: string, value: string) => !cancelledInputs[id] && value !== '0';
                          const isCancelled = (id: string) => !!cancelledInputs[id];

                          let noorSummaryPart = '';
                          let noorPlanPart = '';
                          let noorConfigPart = {};

                          if (reportPath === 'noor') {
                            // Local helper
                            const toEn = (str: string | number) => {
                              const s = (str || '').toString();
                              return s.replace(/[٠-٩]/g, d => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]);
                            };

                            const daysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                            const monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                            const date = new Date(year, month, smartReportModal.dayNum);
                            const dateStr = `${daysEn[date.getDay()]} ${date.getDate()} ${monthsEn[date.getMonth()]} ${date.getFullYear()}`;

                            // Retrieve Noor Values
                            // Retrieve Noor Values
                            const tamFromPageInput = document.getElementById('noor-tam-from-page') as HTMLInputElement;
                            const tamToPageInput = document.getElementById('noor-tam-to-page') as HTMLInputElement;
                            const tamFromLineInput = document.getElementById('noor-tam-from-line') as HTMLInputElement;
                            const tamToLineInput = document.getElementById('noor-tam-to-line') as HTMLInputElement;

                            const tamFromPageVal = tamFromPageInput?.value;
                            const tamToPageVal = tamToPageInput?.value;
                            const tamFromLineVal = tamFromLineInput?.value;
                            const tamToLineVal = tamToLineInput?.value;

                            const tamFromPage = toEn(tamFromPageVal);
                            const tamToPage = toEn(tamToPageVal);
                            const tamFromLine = toEn(tamFromLineVal);
                            const tamToLine = toEn(tamToLineVal);

                            const sayatimFromPageInput = document.getElementById('noor-sayatim-from-page') as HTMLInputElement;
                            const sayatimToPageInput = document.getElementById('noor-sayatim-to-page') as HTMLInputElement;
                            const sayatimFromLineInput = document.getElementById('noor-sayatim-from-line') as HTMLInputElement;
                            const sayatimToLineInput = document.getElementById('noor-sayatim-to-line') as HTMLInputElement;

                            const sayatimFromPageVal = sayatimFromPageInput?.value;
                            const sayatimToPageVal = sayatimToPageInput?.value;
                            const sayatimFromLineVal = sayatimFromLineInput?.value;
                            const sayatimToLineVal = sayatimToLineInput?.value;

                            const sayatimFromPage = toEn(sayatimFromPageVal);
                            const sayatimToPage = toEn(sayatimToPageVal);
                            const sayatimFromLine = toEn(sayatimFromLineVal);
                            const sayatimToLine = toEn(sayatimToLineVal);

                            // Update Config
                            noorConfigPart = {
                              noor: {
                                book: lastReports[smartReportModal.studentId]?.noor?.book || defaultNoorBook,
                                tam: {
                                  fromPage: tamFromPageVal,
                                  toPage: tamToPageVal,
                                  fromLine: tamFromLineVal,
                                  toLine: tamToLineVal
                                },
                                sayatim: {
                                  fromPage: sayatimFromPageVal,
                                  toPage: sayatimToPageVal,
                                  fromLine: sayatimFromLineVal,
                                  toLine: sayatimToLineVal
                                }
                              }
                            };

                            // Generate Content
                            const selectedBook = (lastReports[smartReportModal.studentId]?.noor?.book || defaultNoorBook) === 'taasees' ? 'Foundation Book' : 'Noor El-Bayan Book';
                            if (!excludeNoorTam) {
                              let tamContent = '';
                              if (tamFromPage || tamToPage) {
                                // Page Logic
                                if (isCancelled('noor-tam-to-page')) {
                                  // 1. Single Value (Cancelled)
                                  tamContent += `Page ${tamFromPage}`;
                                } else if (tamToPage === '0') {
                                  // 2. Open Range (Zero only)
                                  tamContent += `From Page ${tamFromPage || '?'} to...`;
                                } else if (!tamToPage || tamToPage.trim() === '') {
                                  // 3. Single Value (Empty)
                                  tamContent += `Page ${tamFromPage}`;
                                } else {
                                  // 4. Normal Range
                                  if (tamFromPage && tamFromPage === tamToPage) {
                                    tamContent += `Page ${tamFromPage}`;
                                  } else {
                                    tamContent += `From Page ${tamFromPage || '?'} to Page ${tamToPage || '?'}`;
                                  }
                                }
                              }
                              if (tamFromLine || tamToLine) {
                                // Line Logic
                                if (isCancelled('noor-tam-to-line')) {
                                  tamContent += ` (Line ${tamFromLine || '?'})`;
                                } else if (tamToLine === '0') {
                                  tamContent += ` (From Line ${tamFromLine || '?'} to...)`;
                                } else if (!tamToLine || tamToLine.trim() === '') {
                                  tamContent += ` (Line ${tamFromLine || '?'})`;
                                } else {
                                  if (tamFromPage && tamFromPage === tamToPage) {
                                    tamContent += ` (From Line ${tamFromLine || '?'} to Line ${tamToLine || '?'})`;
                                  } else {
                                    tamContent += ` (From Line ${tamFromLine || '?'} to Line ${tamToLine || '?'})`;
                                  }
                                }
                              }

                              if (tamContent) {
                                const book = (lastReports[smartReportModal.studentId]?.noor?.book || defaultNoorBook);
                                const lessonType = getNoorLessonType(book as any, tamFromPage || '', tamToPage || '', 'en');
                                if (lessonType) tamContent += ` → ( ${lessonType} )`;
                              }

                              noorSummaryPart += tamContent || '-';
                              noorSummaryPart += `\n`;
                            }

                            if (!excludeNoorSayatim) {
                              let sayatimContent = '';
                              if (isNoorMirrorMode) sayatimContent += `(Repeat) `;
                              if (sayatimFromPage || sayatimToPage) {
                                // Page Logic
                                if (isCancelled('noor-sayatim-to-page')) {
                                  sayatimContent += `Page ${sayatimFromPage}`;
                                } else if (sayatimToPage === '0') {
                                  sayatimContent += `From Page ${sayatimFromPage || '?'} to...`;
                                } else if (!sayatimToPage || sayatimToPage.trim() === '') {
                                  sayatimContent += `Page ${sayatimFromPage}`;
                                } else {
                                  if (sayatimFromPage && sayatimFromPage === sayatimToPage) {
                                    sayatimContent += `Page ${sayatimFromPage}`;
                                  } else {
                                    sayatimContent += `From Page ${sayatimFromPage || '?'} to Page ${sayatimToPage || '?'}`;
                                  }
                                }
                              }
                              if (sayatimFromLine || sayatimToLine) {
                                // Line Logic
                                if (isCancelled('noor-sayatim-to-line')) {
                                  sayatimContent += ` (Line ${sayatimFromLine || '?'})`;
                                } else if (sayatimToLine === '0') {
                                  sayatimContent += ` (From Line ${sayatimFromLine || '?'} to...)`;
                                } else if (!sayatimToLine || sayatimToLine.trim() === '') {
                                  sayatimContent += ` (Line ${sayatimFromLine || '?'})`;
                                } else {
                                  if (sayatimFromPage && sayatimFromPage === sayatimToPage) {
                                    sayatimContent += ` (From Line ${sayatimFromLine || '?'} to Line ${sayatimToLine || '?'})`;
                                  } else {
                                    sayatimContent += ` (From Line ${sayatimFromLine || '?'} to Line ${sayatimToLine || '?'})`;
                                  }
                                }
                              }

                              if (sayatimContent) {
                                const book = (lastReports[smartReportModal.studentId]?.noor?.book || defaultNoorBook);
                                const lessonType = getNoorLessonType(book as any, sayatimFromPage || '', sayatimToPage || '', 'en');
                                if (lessonType) sayatimContent += ` → ( ${lessonType} )`;
                              }

                              noorPlanPart += sayatimContent || '-';
                              noorPlanPart += `\n`;
                            }

                            // noorConfigPart already set above with original (non-converted) values

                            if (reportPath === 'noor' && !mergeWithQuran) {
                              // Build header with optional class number
                              const subEn = subscriptionSettings[smartReportModal.studentId];
                              let classNumLineEn = '';
                              if (subEn?.enabled && subEn.currentClass > 0) {
                                if (subEn.mode === 'monthly') {
                                  // Monthly mode: show just the class number
                                  classNumLineEn = `Class Number: ${subEn.currentClass}\n`;
                                } else {
                                  // Subscription mode: show class number with "last class" indicator
                                  const displayClassNumEn = ((subEn.currentClass - 1) % (subEn.totalClasses || 1)) + 1;
                                  const isLastEn = displayClassNumEn === subEn.totalClasses;
                                  classNumLineEn = `Class Number: ${displayClassNumEn} of ${subEn.totalClasses}${isLastEn ? ' (Last class in subscription)' : ''}\n`;
                                }
                              }

                              const academySettingsEn = student ? academyRates[student.academy] : null;
                              const showHeaderEn = academySettingsEn?.includeReportHeader !== false;

                              let report = '';
                              if (showHeaderEn) {
                                report += `📖 *Class Report*\n\nStudent: ${studentName}\nDate: ${dateStr}\n${classNumLineEn}\nــــــــــــــــــــــــــــــ\n\n`;
                              }
                              report += `📚  ( *${selectedBook}* )\n\n`;
                              if (noorSummaryPart) {
                                report += `*• Session Summary:*\n${noorSummaryPart}\n`;
                              }
                              if (noorPlanPart) {
                                report += `\n*• Next Session Plan:*\n${noorPlanPart}`;
                              }

                              // Foundation Book Listening Link (only for taasees/Foundation Book)
                              const isFoundationBook = (lastReports[smartReportModal.studentId]?.noor?.book || defaultNoorBook) === 'taasees';
                              const foundationListenPage = sayatimFromPage || tamFromPage;
                              if (isFoundationBook && foundationListenPage) {
                                const foundationPageEng = toEnglish(foundationListenPage.toString());
                                report += `\nــــــــــــــــــــــــــــــ\n🎧 *Listening:*\nhttps://audio-foundation-book.vercel.app/?page=${foundationPageEng}`;
                              }

                              // Custom Notes
                              const customNotesVal = customNotesText.trim();
                              if (customNotesVal) {
                                report += `\nــــــــــــــــــــــــــــــ\n\n✏️ *Notes:*\n${customNotesVal}`;
                              }

                              // Audio Link Section (always last, with separator)
                              const audioLinkVal = audioLinkText.trim();
                              if (audioLinkVal) {
                                report += `\nــــــــــــــــــــــــــــــ\n\n🎧 *Audio Corrections:*\n${audioLinkVal}`;
                              }
                              setLastReports(prev => ({
                                ...prev,
                                [smartReportModal.studentId]: {
                                  ...prev[smartReportModal.studentId],
                                  ...noorConfigPart,
                                  customNotes: customNotesVal || '',
                                  audioLink: audioLinkVal || ''
                                }
                              }));
                              const _noorEngStudentId = smartReportModal.studentId;
                              const _noorEngDayNum = smartReportModal.dayNum;

                              if (sendViaWhatsapp) {
                                // Resolve WhatsApp Target (Hierarchy: Student > Academy ONLY)
                                const student = students.find(s => s.id === smartReportModal.studentId);
                                const studentWhatsapp = student?.whatsappNumber;
                                const academyWhatsapp = student ? academyRates[student.academy]?.whatsappNumber : undefined;
                                const finalTarget = studentWhatsapp || academyWhatsapp;

                                if (!finalTarget || finalTarget.trim() === '') {
                                  alert('يرجى تحديد رقم واتساب في إعدادات الطالب أو إعدادات الأكاديمية أولاً.');
                                  return;
                                }

                                // Send via Puppeteer automation
                                closeAllModals(true);
                                // Copy + open link immediately alongside WhatsApp send
                                navigator.clipboard.writeText(report).catch(() => { });
                                checkAndOpenLink(_noorEngStudentId);
                                showToast('Sending via WhatsApp... ⏳');
                                window.electronAPI?.sendWhatsAppAuto(finalTarget, report).then((result: any) => {
                                  if (result.success) {
                                    saveReportForDay(_noorEngStudentId, _noorEngDayNum, report, {
                                      ...noorConfigPart,
                                      noorDetails,
                                      activeSection: reportPath,
                                      mergeWithQuran,
                                      customNotes: customNotesText.trim(),
                                      audioLink: audioLinkText.trim()
                                    });
                                    showToast('Sent via WhatsApp ✅');
                                    new Notification('Sent ✅', { body: `Report for ${studentName} sent via WhatsApp` });
                                    setSearchQuery('');
                                    if (mergeWithQuran) {
                                      new Notification('Merge Reminder 📖', { body: `Report for ${studentName} merged with Quran` });
                                    }
                                  } else {
                                    showToast('Failed to send ❌');
                                    console.error('WhatsApp error:', result.error);
                                  }
                                }).catch((err: any) => {
                                  console.error('WhatsApp automation error:', err);
                                  showToast('Failed to send ❌');
                                });
                              } else {
                                navigator.clipboard.writeText(report).then(() => {
                                    saveReportForDay(_noorEngStudentId, _noorEngDayNum, report, {
                                      ...noorConfigPart,
                                      noorDetails,
                                      activeSection: reportPath,
                                      mergeWithQuran,
                                      customNotes: customNotesText.trim(),
                                      audioLink: audioLinkText.trim()
                                    });
                                  closeAllModals(true);
                                  showToast('Report Copied (English) ✨');
                                  checkAndOpenLink(_noorEngStudentId);
                                  setSearchQuery('');
                                });
                              }
                              return;
                            }
                          }




                          // 1. Reading New Values
                          const isQuranNewPageMode = preferredModes.readingNew === 'page';
                          const isQuranNewJuzMode = preferredModes.readingNew === 'juz';
                          const isQuranNewHizbMode = preferredModes.readingNew === 'hizb';
                          const isQuranNewSurahMode = preferredModes.readingNew === 'surah';

                          const quranNewSurahRaw = (document.getElementById('quran-new-surah-select') as HTMLSelectElement)?.value;
                          const quranNewSurah = getEnglishSurahName(quranNewSurahRaw);

                          const quranNewFromSurahRaw = (document.getElementById('quran-new-from-surah') as HTMLSelectElement)?.value || SURAHS[0];
                          const quranNewFromSurah = getEnglishSurahName(toEnglish(quranNewFromSurahRaw));

                          const quranNewToSurahRaw = (document.getElementById('quran-new-to-surah') as HTMLSelectElement)?.value || SURAHS[0];
                          const quranNewToSurah = getEnglishSurahName(toEnglish(quranNewToSurahRaw));

                          const quranNewFromAyah = toEnglish((document.getElementById('quran-new-from-ayah') as HTMLInputElement)?.value || '');
                          const quranNewToAyah = toEnglish((document.getElementById('quran-new-to-ayah') as HTMLInputElement)?.value || '');
                          const quranNewFromPage = toEnglish((document.getElementById('quran-new-from-page') as HTMLInputElement)?.value || '1');
                          const quranNewToPage = toEnglish((document.getElementById('quran-new-to-page') as HTMLInputElement)?.value || '1');
                          const quranNewFromJuz = toEnglish((document.getElementById('quran-new-from-juz') as HTMLInputElement)?.value || '1');
                          const quranNewToJuz = toEnglish((document.getElementById('quran-new-to-juz') as HTMLInputElement)?.value || '1');
                          const quranNewFromHizb = toEnglish((document.getElementById('quran-new-from-hizb') as HTMLInputElement)?.value || '1');
                          const quranNewToHizb = toEnglish((document.getElementById('quran-new-to-hizb') as HTMLInputElement)?.value || '1');

                          const quranNewToSurahAdvancedRaw = (document.getElementById('quran-new-to-surah-advanced') as HTMLSelectElement)?.value || SURAHS[0];
                          const quranNewToSurahAdvanced = getEnglishSurahName(toEnglish(quranNewToSurahAdvancedRaw));

                          // 2. Reading Revision Values
                          const isQuranRevPageMode = preferredModes.readingRev === 'page';
                          const isQuranRevJuzMode = preferredModes.readingRev === 'juz';
                          const isQuranRevHizbMode = preferredModes.readingRev === 'hizb';
                          const isQuranRevSurahMode = preferredModes.readingRev === 'surah';

                          const quranRevSurahRaw = (document.getElementById('quran-rev-surah-select') as HTMLSelectElement)?.value;
                          const quranRevSurah = getEnglishSurahName(quranRevSurahRaw);

                          const quranRevFromSurahRaw = (document.getElementById('quran-rev-from-surah') as HTMLSelectElement)?.value || SURAHS[0];
                          const quranRevFromSurah = getEnglishSurahName(toEnglish(quranRevFromSurahRaw));

                          const quranRevToSurahRaw = (document.getElementById('quran-rev-to-surah') as HTMLSelectElement)?.value || SURAHS[0];
                          const quranRevToSurah = getEnglishSurahName(toEnglish(quranRevToSurahRaw));

                          const quranRevFromAyah = toEnglish((document.getElementById('quran-rev-from-ayah') as HTMLInputElement)?.value || '');
                          const quranRevToAyah = toEnglish((document.getElementById('quran-rev-to-ayah') as HTMLInputElement)?.value || '');
                          const quranRevFromPage = toEnglish((document.getElementById('quran-rev-from-page') as HTMLInputElement)?.value || '1');
                          const quranRevToPage = toEnglish((document.getElementById('quran-rev-to-page') as HTMLInputElement)?.value || '1');
                          const quranRevFromJuz = toEnglish((document.getElementById('quran-rev-from-juz') as HTMLInputElement)?.value || '1');
                          const quranRevToJuz = toEnglish((document.getElementById('quran-rev-to-juz') as HTMLInputElement)?.value || '1');
                          const quranRevFromHizb = toEnglish((document.getElementById('quran-rev-from-hizb') as HTMLInputElement)?.value || '1');
                          const quranRevToHizb = toEnglish((document.getElementById('quran-rev-to-hizb') as HTMLInputElement)?.value || '1');

                          const quranRevToSurahAdvancedRaw = (document.getElementById('quran-rev-to-surah-advanced') as HTMLSelectElement)?.value || SURAHS[0];
                          const quranRevToSurahAdvanced = getEnglishSurahName(toEnglish(quranRevToSurahAdvancedRaw));

                          // 2.5. Reading Old Revision Values
                          const isQuranOldRevPageMode = preferredModes.readingOldRev === 'page';
                          const isQuranOldRevJuzMode = preferredModes.readingOldRev === 'juz';
                          const isQuranOldRevHizbMode = preferredModes.readingOldRev === 'hizb';
                          const isQuranOldRevSurahMode = preferredModes.readingOldRev === 'surah';

                          const quranOldRevSurahRaw = (document.getElementById('quran-oldrev-surah-select') as HTMLSelectElement)?.value;
                          const quranOldRevSurah = getEnglishSurahName(quranOldRevSurahRaw);

                          const quranOldRevFromSurahRaw = (document.getElementById('quran-oldrev-from-surah') as HTMLSelectElement)?.value || SURAHS[0];
                          const quranOldRevFromSurah = getEnglishSurahName(toEnglish(quranOldRevFromSurahRaw));

                          const quranOldRevToSurahRaw = (document.getElementById('quran-oldrev-to-surah') as HTMLSelectElement)?.value || SURAHS[0];
                          const quranOldRevToSurah = getEnglishSurahName(toEnglish(quranOldRevToSurahRaw));

                          const quranOldRevFromAyah = toEnglish((document.getElementById('quran-oldrev-from-ayah') as HTMLInputElement)?.value || '');
                          const quranOldRevToAyah = toEnglish((document.getElementById('quran-oldrev-to-ayah') as HTMLInputElement)?.value || '');
                          const quranOldRevFromPage = toEnglish((document.getElementById('quran-oldrev-from-page') as HTMLInputElement)?.value || '1');
                          const quranOldRevToPage = toEnglish((document.getElementById('quran-oldrev-to-page') as HTMLInputElement)?.value || '1');
                          const quranOldRevFromJuz = toEnglish((document.getElementById('quran-oldrev-from-juz') as HTMLInputElement)?.value || '1');
                          const quranOldRevToJuz = toEnglish((document.getElementById('quran-oldrev-to-juz') as HTMLInputElement)?.value || '1');
                          const quranOldRevFromHizb = toEnglish((document.getElementById('quran-oldrev-from-hizb') as HTMLInputElement)?.value || '1');
                          const quranOldRevToHizb = toEnglish((document.getElementById('quran-oldrev-to-hizb') as HTMLInputElement)?.value || '1');

                          const quranOldRevToSurahAdvancedRaw = (document.getElementById('quran-oldrev-to-surah-advanced') as HTMLSelectElement)?.value || SURAHS[0];
                          const quranOldRevToSurahAdvanced = getEnglishSurahName(toEnglish(quranOldRevToSurahAdvancedRaw));

                          // 5. Reading Tilawa Values
                          const quranTilawaSurahRaw = (document.getElementById('quran-tilawa-surah-select') as HTMLSelectElement)?.value || SURAHS[0];
                          const quranTilawaSurah = getEnglishSurahName(quranTilawaSurahRaw);

                          const quranTilawaFromSurahRaw = (document.getElementById('quran-tilawa-from-surah') as HTMLSelectElement)?.value || SURAHS[0];
                          const quranTilawaFromSurah = getEnglishSurahName(toEnglish(quranTilawaFromSurahRaw));

                          const quranTilawaToSurahRaw = (document.getElementById('quran-tilawa-to-surah') as HTMLSelectElement)?.value || SURAHS[0];
                          const quranTilawaToSurah = getEnglishSurahName(toEnglish(quranTilawaToSurahRaw));

                          const quranTilawaToSurahAdvancedRaw = (document.getElementById('quran-tilawa-to-surah-advanced') as HTMLSelectElement)?.value || SURAHS[0];
                          const quranTilawaToSurahAdvanced = getEnglishSurahName(toEnglish(quranTilawaToSurahAdvancedRaw));

                          const quranTilawaFromAyah = toEnglish((document.getElementById('quran-tilawa-from-ayah') as HTMLInputElement)?.value || '');
                          const quranTilawaToAyah = toEnglish((document.getElementById('quran-tilawa-to-ayah') as HTMLInputElement)?.value || '');
                          const quranTilawaFromPage = toEnglish((document.getElementById('quran-tilawa-from-page') as HTMLInputElement)?.value || '1');
                          const quranTilawaToPage = toEnglish((document.getElementById('quran-tilawa-to-page') as HTMLInputElement)?.value || '1');
                          const quranTilawaFromJuz = toEnglish((document.getElementById('quran-tilawa-from-juz') as HTMLInputElement)?.value || '1');
                          const quranTilawaToJuz = toEnglish((document.getElementById('quran-tilawa-to-juz') as HTMLInputElement)?.value || '1');
                          const quranTilawaFromHizb = toEnglish((document.getElementById('quran-tilawa-from-hizb') as HTMLInputElement)?.value || '1');
                          const quranTilawaToHizb = toEnglish((document.getElementById('quran-tilawa-to-hizb') as HTMLInputElement)?.value || '1');

                          // 3. Homework New Values
                          const isHwNewPageMode = preferredModes.homeworkNew === 'page';
                          const isHwNewJuzMode = preferredModes.homeworkNew === 'juz';
                          const isHwNewHizbMode = preferredModes.homeworkNew === 'hizb';
                          const isHwNewSurahMode = preferredModes.homeworkNew === 'surah';

                          const hwNewSurahRaw = (document.getElementById('hw-new-surah-select') as HTMLSelectElement)?.value;
                          const hwNewSurah = getEnglishSurahName(hwNewSurahRaw);

                          const hwNewFromSurahRaw = (document.getElementById('hw-new-from-surah-safe') as HTMLSelectElement)?.value || SURAHS[0];
                          const hwNewFromSurah = getEnglishSurahName(toEnglish(hwNewFromSurahRaw));

                          const hwNewToSurahRaw = (document.getElementById('hw-new-to-surah-safe') as HTMLSelectElement)?.value || SURAHS[0];
                          const hwNewToSurah = getEnglishSurahName(toEnglish(hwNewToSurahRaw));

                          const hwNewToSurahAdvancedRaw = (document.getElementById('hw-new-to-surah-advanced') as HTMLSelectElement)?.value || SURAHS[0];
                          const hwNewToSurahAdvanced = getEnglishSurahName(toEnglish(hwNewToSurahAdvancedRaw));

                          const hwNewFrom = toEnglish((document.getElementById('hw-new-from') as HTMLInputElement)?.value || '');
                          const hwNewTo = toEnglish((document.getElementById('hw-new-to') as HTMLInputElement)?.value || '');

                          // 4. Homework Revision Values
                          const isHwRevPageMode = preferredModes.homeworkRev === 'page';
                          const isHwRevJuzMode = preferredModes.homeworkRev === 'juz';
                          const isHwRevHizbMode = preferredModes.homeworkRev === 'hizb';
                          const isHwRevSurahMode = preferredModes.homeworkRev === 'surah';

                          const hwRevSurahRaw = (document.getElementById('hw-rev-surah-select') as HTMLSelectElement)?.value;
                          const hwRevSurah = getEnglishSurahName(hwRevSurahRaw);

                          const hwRevFromSurahRaw = (document.getElementById('hw-rev-from-surah') as HTMLSelectElement)?.value || SURAHS[0];
                          const hwRevFromSurah = getEnglishSurahName(toEnglish(hwRevFromSurahRaw));

                          const hwRevToSurahRaw = (document.getElementById('hw-rev-to-surah') as HTMLSelectElement)?.value || SURAHS[0];
                          const hwRevToSurah = getEnglishSurahName(toEnglish(hwRevToSurahRaw));

                          const hwRevToSurahAdvancedRaw = (document.getElementById('hw-rev-to-surah-advanced') as HTMLSelectElement)?.value || SURAHS[0];
                          const hwRevToSurahAdvanced = getEnglishSurahName(toEnglish(hwRevToSurahAdvancedRaw));

                          const hwRevFrom = toEnglish((document.getElementById('hw-rev-from') as HTMLInputElement)?.value || '');
                          const hwRevTo = toEnglish((document.getElementById('hw-rev-to') as HTMLInputElement)?.value || '');

                          // 4.5. Homework Old Revision Values
                          const isHwOldRevPageMode = preferredModes.homeworkOldRev === 'page';
                          const isHwOldRevJuzMode = preferredModes.homeworkOldRev === 'juz';
                          const isHwOldRevHizbMode = preferredModes.homeworkOldRev === 'hizb';
                          const isHwOldRevSurahMode = preferredModes.homeworkOldRev === 'surah';

                          const hwOldRevSurahRaw = (document.getElementById('hw-oldrev-surah-select') as HTMLSelectElement)?.value;
                          const hwOldRevSurah = getEnglishSurahName(hwOldRevSurahRaw);

                          const hwOldRevFromSurahRaw = (document.getElementById('hw-oldrev-from-surah') as HTMLSelectElement)?.value || SURAHS[0];
                          const hwOldRevFromSurah = getEnglishSurahName(toEnglish(hwOldRevFromSurahRaw));

                          const hwOldRevToSurahRaw = (document.getElementById('hw-oldrev-to-surah') as HTMLSelectElement)?.value || SURAHS[0];
                          const hwOldRevToSurah = getEnglishSurahName(toEnglish(hwOldRevToSurahRaw));

                          const hwOldRevToSurahAdvancedRaw = (document.getElementById('hw-oldrev-to-surah-advanced') as HTMLSelectElement)?.value || SURAHS[0];
                          const hwOldRevToSurahAdvanced = getEnglishSurahName(toEnglish(hwOldRevToSurahAdvancedRaw));

                          const hwOldRevFrom = toEnglish((document.getElementById('hw-oldrev-from') as HTMLInputElement)?.value || '');
                          const hwOldRevTo = toEnglish((document.getElementById('hw-oldrev-to') as HTMLInputElement)?.value || '');


                          // Build Report
                          const daysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                          const monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                          const date = new Date(year, month, smartReportModal.dayNum);
                          const dateStr = `${daysEn[date.getDay()]} ${date.getDate()} ${monthsEn[date.getMonth()]} ${date.getFullYear()}`;

                          // Build header with optional class number
                          const subEn = subscriptionSettings[smartReportModal.studentId];
                          let classNumLineEn = '';
                          if (subEn?.enabled) {
                            if (subEn.mode === 'monthly') {
                              classNumLineEn = `Class Number: ${subEn.currentClass}\n`;
                            } else {
                              const displayClassNumEn = ((subEn.currentClass - 1 + (subEn.totalClasses || 1)) % (subEn.totalClasses || 1)) + 1;
                              const isLastEn = displayClassNumEn === subEn.totalClasses;
                              classNumLineEn = `Class Number: ${displayClassNumEn} of ${subEn.totalClasses}${isLastEn ? ' (Last class in subscription)' : ''}\n`;
                            }
                          }

                          const academySettingsEn = student ? academyRates[student.academy] : null;
                          const showHeaderEn = academySettingsEn?.includeReportHeader !== false;

                          const bookNameEn = (lastReports[smartReportModal.studentId]?.noor?.book || defaultNoorBook) === 'taasees' ? 'Foundation Book' : 'Noor El-Bayan Book';
                          const headerEn = (reportPath === 'noor')
                            ? bookNameEn
                            : 'Class Report';

                          let report = '';
                          if (showHeaderEn) {
                            report += `📖 *${headerEn}*\n\nStudent: ${studentName}\nDate: ${dateStr}\n${classNumLineEn}\n*ــــــــــــــــــــــــــــــــــــــ*\n\n`;
                          }

                          report += `✅ *Session Summary:*\n`;
                          if (mergeWithQuran) {
                            report += `\n📖 *( Quran )* -----\n`;
                          }

                          // (Helpers available in scope)

                          const formatRangeEn = (prefix: string, fromId: string, fromVal: string, toId: string, toVal: string, surahName?: string) => {
                            const fromTrim = fromVal ? fromVal.toString().trim() : '';
                            const toTrim = toVal ? toVal.toString().trim() : '';

                            let isEnd = false;
                            if (prefix === 'Ayah' && surahName && toTrim) {
                               const engIdx = SURAHS.findIndex(s => getEnglishSurahName(s) === surahName);
                               if (engIdx > -1 && parseInt(toTrim) === SURAH_AYAH_COUNTS[engIdx]) isEnd = true;
                            }

                            // 1. Single Value (Cancelled 'To')
                            if (isCancelled(toId)) {
                              if (isActive(fromId, fromTrim)) return `${prefix} ${fromTrim}`;
                              return '';
                            }

                            // 2. Open Range (Zero 'To' ONLY)
                            if (toTrim === '0') {
                              if (isActive(fromId, fromTrim)) return `From ${prefix} ${fromTrim} to...`;
                              return '';
                            }

                            // 3. Single Value (Empty 'To')
                            if (!toTrim) {
                              if (isActive(fromId, fromTrim)) return `${prefix} ${fromTrim}`;
                              return '';
                            }

                            // 3. Normal Range
                            if (isActive(fromId, fromTrim) && isActive(toId, toTrim)) {
                              if (fromTrim === toTrim) return `${prefix} ${fromTrim}`;
                              if (isEnd) return `From ${prefix} ${fromTrim} to the end`;
                              return `From ${prefix} ${fromTrim} to ${prefix} ${toTrim}`;
                            }

                            // Fallback
                            if (isActive(fromId, fromTrim)) return `${prefix} ${fromTrim}`;
                            if (isActive(toId, toTrim)) return `${prefix} ${toTrim}`;
                            return '';
                          };

                          // Add New Recitation
                          if (sectionToggles.readingNew && !prevReportHadExclusion && !excludeReadingNew) {
                            report += `\n*• New:*\n`;
                            if (isQuranNewPageMode) {
                              report += formatRangeEn('Page', 'quran-new-from-page', quranNewFromPage, 'quran-new-to-page', quranNewToPage);
                            }
                            else if (isQuranNewJuzMode) {
                              report += formatRangeEn('Juz', 'quran-new-from-juz', quranNewFromJuz, 'quran-new-to-juz', quranNewToJuz);
                            }
                            else if (isQuranNewHizbMode) {
                              report += formatRangeEn('Hizb', 'quran-new-from-hizb', quranNewFromHizb, 'quran-new-to-hizb', quranNewToHizb);
                            }
                            else if (isQuranNewSurahMode) report += `From Surah ${quranNewFromSurah} to Surah ${quranNewToSurah}`;
                            else if (activeAdvancedAyah.readingNew) {
                              const fromAyah = quranNewFromAyah ? quranNewFromAyah.toString().trim() : '';
                              const toAyah = quranNewToAyah ? quranNewToAyah.toString().trim() : '';

                              const isFromValid = !isCancelled('quran-new-from-ayah') && fromAyah !== '';
                              const isToValid = !isCancelled('quran-new-to-ayah') && toAyah !== '' && toAyah !== '0';
                              const isToOpen = !isCancelled('quran-new-to-ayah') && toAyah === '0';

                              if (!isFromValid && !isToValid && !isToOpen) {
                                if (quranNewSurah === quranNewToSurahAdvanced) {
                                  report += `Surah ${quranNewSurah}`;
                                } else {
                                  report += `From Surah ${quranNewSurah} to Surah ${quranNewToSurahAdvanced}`;
                                }
                              } else {
                                if (quranNewSurah === quranNewToSurahAdvanced) {
                                  // Same surah: compact format
                                  if (isFromValid && isToValid) {
                                    if (fromAyah === toAyah) report += `Surah ${quranNewSurah} (${fromAyah})`;
                                    else report += `Surah ${quranNewSurah} (From ${fromAyah} to ${toAyah})`;
                                  } else if (isFromValid && isToOpen) {
                                    report += `Surah ${quranNewSurah} (From ${fromAyah} to...)`;
                                  } else if (isFromValid) {
                                    report += `Surah ${quranNewSurah} (${fromAyah})`;
                                  } else {
                                    report += `Surah ${quranNewSurah}`;
                                  }
                                } else {
                                  const p1 = isFromValid ? `From Surah ${quranNewSurah} Ayah ${fromAyah}` : `From Surah ${quranNewSurah}`;
                                  let p2 = '';
                                  if (isToOpen) p2 = ' to...';
                                  else if (isToValid) {
                                    const toIdx = SURAHS.findIndex(s => getEnglishSurahName(s) === quranNewToSurahAdvanced);
                                    const isEndAyah = toIdx > -1 && parseInt(toAyah) === SURAH_AYAH_COUNTS[toIdx];
                                    p2 = isEndAyah ? ` to the end of Surah ${quranNewToSurahAdvanced}` : ` to Surah ${quranNewToSurahAdvanced} Ayah ${toAyah}`;
                                  }
                                  else if (quranNewToSurahAdvanced && quranNewToSurahAdvanced !== quranNewSurah) p2 = ` to Surah ${quranNewToSurahAdvanced}`;

                                  report += `${p1}${p2}`;
                                }
                              }
                            }
                            else {
                              const surahName = quranNewSurah || getEnglishSurahName(SURAHS[0]);
                              const fromAyah = quranNewFromAyah || '';
                              const toAyah = quranNewToAyah || '';

                              if (isCancelled('quran-new-to-ayah')) {
                                if (fromAyah) report += `Surah ${surahName} (${fromAyah})`;
                                else report += `Surah ${surahName}`;
                              } else if (toAyah === '0') {
                                report += `Surah ${surahName} (From ${fromAyah} to...)`;
                              } else if (!toAyah || toAyah.trim() === '') {
                                if (fromAyah) report += `Surah ${surahName} (${fromAyah})`;
                                else report += `Surah ${surahName}`;
                              } else {
                                if (fromAyah === toAyah) report += `Surah ${surahName} (${fromAyah})`;
                                else report += `Surah ${surahName} (From ${fromAyah} to ${toAyah})`;
                              }
                            }
                            report += `\n`;
                          }

                          // Add Revision Recitation
                          if (sectionToggles.readingRev && !excludeReadingRev) {
                            report += `\n*• Revision:*\n`;
                            if (isQuranRevPageMode) {
                              report += formatRangeEn('Page', 'quran-rev-from-page', quranRevFromPage, 'quran-rev-to-page', quranRevToPage);
                            }
                            else if (isQuranRevJuzMode) {
                              report += formatRangeEn('Juz', 'quran-rev-from-juz', quranRevFromJuz, 'quran-rev-to-juz', quranRevToJuz);
                            }
                            else if (isQuranRevHizbMode) {
                              report += formatRangeEn('Hizb', 'quran-rev-from-hizb', quranRevFromHizb, 'quran-rev-to-hizb', quranRevToHizb);
                            }
                            else if (isQuranRevSurahMode) report += `From Surah ${quranRevFromSurah} to Surah ${quranRevToSurah}`;
                            else if (activeAdvancedAyah.readingRev) {
                              const fromAyah = quranRevFromAyah ? quranRevFromAyah.toString().trim() : '';
                              const toAyah = quranRevToAyah ? quranRevToAyah.toString().trim() : '';

                              const isFromValid = !isCancelled('quran-rev-from-ayah') && fromAyah !== '';
                              const isToValid = !isCancelled('quran-rev-to-ayah') && toAyah !== '' && toAyah !== '0';
                              const isToOpen = !isCancelled('quran-rev-to-ayah') && toAyah === '0';

                              if (!isFromValid && !isToValid && !isToOpen) {
                                if (quranRevSurah === quranRevToSurahAdvanced) {
                                  report += `Surah ${quranRevSurah}`;
                                } else {
                                  report += `From Surah ${quranRevSurah} to Surah ${quranRevToSurahAdvanced}`;
                                }
                              } else {
                                if (quranRevSurah === quranRevToSurahAdvanced) {
                                  // Same surah: compact format
                                  if (isFromValid && isToValid) {
                                    if (fromAyah === toAyah) report += `Surah ${quranRevSurah} (${fromAyah})`;
                                    else report += `Surah ${quranRevSurah} (From ${fromAyah} to ${toAyah})`;
                                  } else if (isFromValid && isToOpen) {
                                    report += `Surah ${quranRevSurah} (From ${fromAyah} to...)`;
                                  } else if (isFromValid) {
                                    report += `Surah ${quranRevSurah} (${fromAyah})`;
                                  } else {
                                    report += `Surah ${quranRevSurah}`;
                                  }
                                } else {
                                  const p1 = isFromValid ? `From Surah ${quranRevSurah} Ayah ${fromAyah}` : `From Surah ${quranRevSurah}`;
                                  let p2 = '';
                                  if (isToOpen) p2 = ' to...';
                                  else if (isToValid) p2 = ` to Surah ${quranRevToSurahAdvanced} Ayah ${toAyah}`;
                                  else if (quranRevToSurahAdvanced && quranRevToSurahAdvanced !== quranRevSurah) p2 = ` to Surah ${quranRevToSurahAdvanced}`;

                                  report += `${p1}${p2}`;
                                }
                              }
                            }
                            else {
                              const surahName = quranRevSurah || getEnglishSurahName(SURAHS[0]);
                              const fromAyah = quranRevFromAyah || '';
                              const toAyah = quranRevToAyah || '';

                              if (isCancelled('quran-rev-to-ayah')) {
                                if (fromAyah) report += `Surah ${surahName} (${fromAyah})`;
                                else report += `Surah ${surahName}`;
                              } else if (toAyah === '0') {
                                report += `Surah ${surahName} (From ${fromAyah} to...)`;
                              } else if (!toAyah || toAyah.trim() === '') {
                                if (fromAyah) report += `Surah ${surahName} (${fromAyah})`;
                                else report += `Surah ${surahName}`;
                              } else {
                                if (fromAyah === toAyah) report += `Surah ${surahName} (${fromAyah})`;
                                else report += `Surah ${surahName} (From ${fromAyah} to ${toAyah})`;
                              }
                            }
                            report += `\n`;
                          }


                          // Add English Old Revision Recitation (only if toggle is ON)
                          if (sectionToggles.readingOldRev && !excludeReadingOldRev) {
                            report += `\n*\u2022 Old Revision:*\n`;

                            if (isQuranOldRevPageMode) {
                              report += formatRangeEn('Page', 'quran-oldrev-from-page', quranOldRevFromPage, 'quran-oldrev-to-page', quranOldRevToPage);
                            }
                            else if (isQuranOldRevJuzMode) {
                              report += formatRangeEn('Juz', 'quran-oldrev-from-juz', quranOldRevFromJuz, 'quran-oldrev-to-juz', quranOldRevToJuz);
                            }
                            else if (isQuranOldRevHizbMode) {
                              report += formatRangeEn('Hizb', 'quran-oldrev-from-hizb', quranOldRevFromHizb, 'quran-oldrev-to-hizb', quranOldRevToHizb);
                            }
                            else if (isQuranOldRevSurahMode) report += `From ${getEnglishSurahName(quranOldRevFromSurah)} to ${getEnglishSurahName(quranOldRevToSurah)}`;
                            else if (activeAdvancedAyah.readingOldRev) {
                              const fromAyah = quranOldRevFromAyah ? quranOldRevFromAyah.toString().trim() : '';
                              const toAyah = quranOldRevToAyah ? quranOldRevToAyah.toString().trim() : '';

                              const isFromValid = !isCancelled('quran-oldrev-from-ayah') && fromAyah !== '';
                              const isToValid = !isCancelled('quran-oldrev-to-ayah') && toAyah !== '' && toAyah !== '0';
                              const isToOpen = !isCancelled('quran-oldrev-to-ayah') && toAyah === '0';

                              if (!isFromValid && !isToValid && !isToOpen) {
                                if (quranOldRevSurah === quranOldRevToSurahAdvanced) {
                                  report += `Surah ${quranOldRevSurah}`;
                                } else {
                                  report += `From Surah ${quranOldRevSurah} to Surah ${quranOldRevToSurahAdvanced}`;
                                }
                              } else {
                                if (quranOldRevSurah === quranOldRevToSurahAdvanced) {
                                  if (isFromValid && isToValid) {
                                    if (fromAyah === toAyah) report += `Surah ${quranOldRevSurah} (${fromAyah})`;
                                    else report += `Surah ${quranOldRevSurah} (From ${fromAyah} to ${toAyah})`;
                                  } else if (isFromValid && isToOpen) {
                                    report += `Surah ${quranOldRevSurah} (From ${fromAyah} to...)`;
                                  } else if (isFromValid) {
                                    report += `Surah ${quranOldRevSurah} (${fromAyah})`;
                                  } else {
                                    report += `Surah ${quranOldRevSurah}`;
                                  }
                                } else {
                                  const p1 = isFromValid ? `From Surah ${quranOldRevSurah} Ayah ${fromAyah}` : `From Surah ${quranOldRevSurah}`;
                                  let p2 = '';
                                  if (isToOpen) p2 = ' to...';
                                  else if (isToValid) p2 = ` to Surah ${quranOldRevToSurahAdvanced} Ayah ${toAyah}`;
                                  else if (quranOldRevToSurahAdvanced && quranOldRevToSurahAdvanced !== quranOldRevSurah) p2 = ` to Surah ${quranOldRevToSurahAdvanced}`;

                                  report += `${p1}${p2}`;
                                }
                              }
                            }
                            else {
                              const surahName = quranOldRevSurah || getEnglishSurahName(SURAHS[0]);
                              const fromAyah = quranOldRevFromAyah || '';
                              const toAyah = quranOldRevToAyah || '';

                              if (isCancelled('quran-oldrev-to-ayah')) {
                                if (fromAyah) report += `Surah ${surahName} (${fromAyah})`;
                                else report += `Surah ${surahName}`;
                              } else if (toAyah === '0') {
                                report += `Surah ${surahName} (From ${fromAyah} to...)`;
                              } else if (!toAyah || toAyah.trim() === '') {
                                if (fromAyah) report += `Surah ${surahName} (${fromAyah})`;
                                else report += `Surah ${surahName}`;
                              } else {
                                if (fromAyah === toAyah) report += `Surah ${surahName} (${fromAyah})`;
                                else report += `Surah ${surahName} (From ${fromAyah} to ${toAyah})`;
                              }
                            }
                            report += `\n`;
                          }

                          // Add Tilawa (Reading) Section
                          if (sectionToggles.readingTilawa && !excludeReadingTilawa) {
                            report += `\n*• Reading:*\n`;
                            if (preferredModes.readingTilawa === 'page') {
                              report += formatRangeEn('Page', 'quran-tilawa-from-page', quranTilawaFromPage, 'quran-tilawa-to-page', quranTilawaToPage);
                            }
                            else if (preferredModes.readingTilawa === 'juz') {
                              report += formatRangeEn('Juz', 'quran-tilawa-from-juz', quranTilawaFromJuz, 'quran-tilawa-to-juz', quranTilawaToJuz);
                            }
                            else if (preferredModes.readingTilawa === 'hizb') {
                              report += formatRangeEn('Hizb', 'quran-tilawa-from-hizb', quranTilawaFromHizb, 'quran-tilawa-to-hizb', quranTilawaToHizb);
                            }
                            else if (preferredModes.readingTilawa === 'surah') report += `From Surah ${quranTilawaFromSurah} to Surah ${quranTilawaToSurah}`;
                            else if (activeAdvancedAyah.readingTilawa) {
                              const fromAyah = quranTilawaFromAyah ? quranTilawaFromAyah.toString().trim() : '';
                              const toAyah = quranTilawaToAyah ? quranTilawaToAyah.toString().trim() : '';

                              const isFromValid = !isCancelled('quran-tilawa-from-ayah') && fromAyah !== '';
                              const isToValid = !isCancelled('quran-tilawa-to-ayah') && toAyah !== '' && toAyah !== '0';
                              const isToOpen = !isCancelled('quran-tilawa-to-ayah') && toAyah === '0';

                              if (!isFromValid && !isToValid && !isToOpen) {
                                if (quranTilawaSurah === quranTilawaToSurahAdvanced) {
                                  report += `Surah ${quranTilawaSurah}`;
                                } else {
                                  report += `From Surah ${quranTilawaSurah} to Surah ${quranTilawaToSurahAdvanced}`;
                                }
                              } else {
                                if (quranTilawaSurah === quranTilawaToSurahAdvanced) {
                                  // Same surah: compact format
                                  if (isFromValid && isToValid) {
                                    if (fromAyah === toAyah) report += `Surah ${quranTilawaSurah} (${fromAyah})`;
                                    else report += `Surah ${quranTilawaSurah} (From ${fromAyah} to ${toAyah})`;
                                  } else if (isFromValid && isToOpen) {
                                    report += `Surah ${quranTilawaSurah} (From ${fromAyah} to...)`;
                                  } else if (isFromValid) {
                                    report += `Surah ${quranTilawaSurah} (${fromAyah})`;
                                  } else {
                                    report += `Surah ${quranTilawaSurah}`;
                                  }
                                } else {
                                  const p1 = isFromValid ? `From Surah ${quranTilawaSurah} Ayah ${fromAyah}` : `From Surah ${quranTilawaSurah}`;
                                  let p2 = '';
                                  if (isToOpen) p2 = ' to...';
                                  else if (isToValid) p2 = ` to Surah ${quranTilawaToSurahAdvanced} Ayah ${toAyah}`;
                                  else if (quranTilawaToSurahAdvanced && quranTilawaToSurahAdvanced !== quranTilawaSurah) p2 = ` to Surah ${quranTilawaToSurahAdvanced}`;

                                  report += `${p1}${p2}`;
                                }
                              }
                            }
                            else {
                              const showFrom = isActive('quran-tilawa-from-ayah', quranTilawaFromAyah);
                              const showTo = isActive('quran-tilawa-to-ayah', quranTilawaToAyah);

                              // Refined inline logic for Tilawa
                              const surahName = quranTilawaSurah || getEnglishSurahName(SURAHS[0]);
                              const fromAyah = quranTilawaFromAyah || '';
                              const toAyah = quranTilawaToAyah || '';

                              if (isCancelled('quran-tilawa-to-ayah')) {
                                if (fromAyah) report += `Surah ${surahName} (${fromAyah})`;
                                else report += `Surah ${surahName}`;
                              } else if (toAyah === '0') {
                                report += `Surah ${surahName} (From ${fromAyah} to...)`;
                              } else if (!toAyah || toAyah.trim() === '') {
                                if (fromAyah) report += `Surah ${surahName} (${fromAyah})`;
                                else report += `Surah ${surahName}`;
                              } else {
                                if (fromAyah === toAyah) report += `Surah ${surahName} (${fromAyah})`;
                                else report += `Surah ${surahName} (From ${fromAyah} to ${toAyah})`;
                              }
                            }
                            report += `\n`;
                          }

                          if (sectionToggles.quranTajweed && !excludeQuranTajweed) {
                            const currentTajweedLesson = getTajweedLessonTitle(quranTajweedCurrentLessonId, 'en');
                            report += `\n*• Tajweed:*\n`;
                            report += `${currentTajweedLesson}\n`;
                            // Tajweed Quiz Note removed from summary as per user request
                          }

                          const audioLinkValEng = audioLinkText.trim();
                          if (audioLinkValEng) {
                            report += `\n*• Audio Corrections:*\n${audioLinkValEng}\n`;
                          }

                          if (mergeWithQuran && noorSummaryPart) {
                            const bookNameEn = (lastReports[smartReportModal.studentId]?.noor?.book || defaultNoorBook) === 'taasees' ? 'Foundation Book' : 'Noor El-Bayan Book';
                            report += `\n📚 *( ${bookNameEn} )* -----\n\n${noorSummaryPart}`;
                          }

                           const planLabelEn = '📝 *Next Session Plan ( Homework ):*';
                          report += `\n*ــــــــــــــــــــــــــــــــــــــ*\n\n${planLabelEn}\n`;
                          if (mergeWithQuran) {
                            report += `\n📖 *( Quran )* -----\n`;
                          }

                          // Add New Homework
                          if (sectionToggles.homeworkNew && !excludeHomeworkNew) {
                            report += `\n*• New:*\n`;

                            if (excludeNewFromReport) {
                              // Mastery exclusion mode: show mastery message if reasons selected, otherwise skip
                              if (masteryDeficiency.length > 0) {
                                const enLabels: Record<string, string> = { rev: 'Revision', oldRev: 'Back Revision' };
                                const parts = masteryDeficiency.map(k => enLabels[k]).filter(Boolean);
                                report += `Mastery is required in (${parts.join(', and ')})`;
                              }
                            } else {
                              if (isRedoMode) report += `(Repeat) `;

                              if (isHwNewPageMode) {
                                report += formatRangeEn('Page', 'hw-new-from', hwNewFrom, 'hw-new-to', hwNewTo);
                              }
                              else if (isHwNewJuzMode) {
                                report += formatRangeEn('Juz', 'hw-new-from', hwNewFrom, 'hw-new-to', hwNewTo);
                              }
                              else if (isHwNewHizbMode) {
                                report += formatRangeEn('Hizb', 'hw-new-from', hwNewFrom, 'hw-new-to', hwNewTo);
                              }
                              else if (isHwNewSurahMode) report += `From Surah ${hwNewFromSurah} to Surah ${hwNewToSurah}`;
                              else if (activeAdvancedAyah.homeworkNew) {
                                const fromAyah = hwNewFrom ? hwNewFrom.toString().trim() : '';
                                const toAyah = hwNewTo ? hwNewTo.toString().trim() : '';

                                const isFromValid = !isCancelled('hw-new-from') && fromAyah !== '';
                                const isToValid = !isCancelled('hw-new-to') && toAyah !== '' && toAyah !== '0';
                                const isToOpen = !isCancelled('hw-new-to') && toAyah === '0';

                                if (!isFromValid && !isToValid && !isToOpen) {
                                  if (hwNewSurah === hwNewToSurahAdvanced) {
                                    report += `Surah ${hwNewSurah}`;
                                  } else {
                                    report += `From Surah ${hwNewSurah} to Surah ${hwNewToSurahAdvanced}`;
                                  }
                                } else {
                                  if (hwNewSurah === hwNewToSurahAdvanced) {
                                    // Same surah: compact format
                                    if (isFromValid && isToValid) {
                                      if (fromAyah === toAyah) report += `Surah ${hwNewSurah} (${fromAyah})`;
                                      else report += `Surah ${hwNewSurah} (From ${fromAyah} to ${toAyah})`;
                                    } else if (isFromValid && isToOpen) {
                                      report += `Surah ${hwNewSurah} (From ${fromAyah} to...)`;
                                    } else if (isFromValid) {
                                      report += `Surah ${hwNewSurah} (${fromAyah})`;
                                    } else {
                                      report += `Surah ${hwNewSurah}`;
                                    }
                                  } else {
                                    const p1 = isFromValid ? `From Surah ${hwNewSurah} Ayah ${fromAyah}` : `From Surah ${hwNewSurah}`;
                                    let p2 = '';
                                    if (isToOpen) p2 = ' to...';
                                    else if (isToValid) p2 = ` to Surah ${hwNewToSurahAdvanced} Ayah ${toAyah}`;
                                    else if (hwNewToSurahAdvanced && hwNewToSurahAdvanced !== hwNewSurah) p2 = ` to Surah ${hwNewToSurahAdvanced}`;

                                    report += `${p1}${p2}`;
                                  }
                                }
                              }
                              else {
                                const surahName = hwNewSurah || getEnglishSurahName(SURAHS[0]);
                                const fromAyah = hwNewFrom || '';
                                const toAyah = hwNewTo || '';

                                if (isCancelled('hw-new-to')) {
                                  if (fromAyah) report += `Surah ${surahName} (${fromAyah})`;
                                  else report += `Surah ${surahName}`;
                                } else if (toAyah === '0') {
                                  report += `Surah ${surahName} (From ${fromAyah} to...)`;
                                } else if (!toAyah || toAyah.trim() === '') {
                                  if (fromAyah) report += `Surah ${surahName} (${fromAyah})`;
                                  else report += `Surah ${surahName}`;
                                } else {
                                  if (fromAyah === toAyah) report += `Surah ${surahName} (${fromAyah})`;
                                  else report += `Surah ${surahName} (From ${fromAyah} to ${toAyah})`;
                                }
                              }
                            }
                            report += `\n`;
                          }

                          // Add Revision Homework
                          if (sectionToggles.homeworkRev && !excludeHomeworkRev) {
                            report += `\n*• Revision:*\n`;
                            if (isRedoModeRev) report += `(Repeat) `;

                            if (isHwRevPageMode) {
                              report += formatRangeEn('Page', 'hw-rev-from', hwRevFrom, 'hw-rev-to', hwRevTo);
                            }
                            else if (isHwRevJuzMode) {
                              report += formatRangeEn('Juz', 'hw-rev-from', hwRevFrom, 'hw-rev-to', hwRevTo);
                            }
                            else if (isHwRevHizbMode) {
                              report += formatRangeEn('Hizb', 'hw-rev-from', hwRevFrom, 'hw-rev-to', hwRevTo);
                            }
                            else if (isHwRevSurahMode) report += `Surah ${hwRevFromSurah} - Surah ${hwRevToSurah}`;
                            else if (activeAdvancedAyah.homeworkRev) {
                              const fromAyah = hwRevFrom ? hwRevFrom.toString().trim() : '';
                              const toAyah = hwRevTo ? hwRevTo.toString().trim() : '';

                              const isFromValid = !isCancelled('hw-rev-from') && fromAyah !== '';
                              const isToValid = !isCancelled('hw-rev-to') && toAyah !== '' && toAyah !== '0';
                              const isToOpen = !isCancelled('hw-rev-to') && toAyah === '0';

                              if (!isFromValid && !isToValid && !isToOpen) {
                                if (hwRevSurah === hwRevToSurahAdvanced) {
                                  report += `Surah ${hwRevSurah}`;
                                } else {
                                  report += `From Surah ${hwRevSurah} to Surah ${hwRevToSurahAdvanced}`;
                                }
                              } else {
                                if (hwRevSurah === hwRevToSurahAdvanced) {
                                  // Same surah: compact format
                                  if (isFromValid && isToValid) {
                                    if (fromAyah === toAyah) report += `Surah ${hwRevSurah} (${fromAyah})`;
                                    else report += `Surah ${hwRevSurah} (From ${fromAyah} to ${toAyah})`;
                                  } else if (isFromValid && isToOpen) {
                                    report += `Surah ${hwRevSurah} (From ${fromAyah} to...)`;
                                  } else if (isFromValid) {
                                    report += `Surah ${hwRevSurah} (${fromAyah})`;
                                  } else {
                                    report += `Surah ${hwRevSurah}`;
                                  }
                                } else {
                                  const p1 = isFromValid ? `From Surah ${hwRevSurah} Ayah ${fromAyah}` : `From Surah ${hwRevSurah}`;
                                  let p2 = '';
                                  if (isToOpen) p2 = ' to...';
                                  else if (isToValid) p2 = ` to Surah ${hwRevToSurahAdvanced} Ayah ${toAyah}`;
                                  else if (hwRevToSurahAdvanced && hwRevToSurahAdvanced !== hwRevSurah) p2 = ` to Surah ${hwRevToSurahAdvanced}`;

                                  report += `${p1}${p2}`;
                                }
                              }
                            }
                            else {
                              const surahName = hwRevSurah || getEnglishSurahName(SURAHS[0]);
                              const fromAyah = hwRevFrom || '';
                              const toAyah = hwRevTo || '';

                              if (isCancelled('hw-rev-to')) {
                                if (fromAyah) report += `Surah ${surahName} (${fromAyah})`;
                                else report += `Surah ${surahName}`;
                              } else if (toAyah === '0') {
                                report += `Surah ${surahName} (From ${fromAyah} to...)`;
                              } else if (!toAyah || toAyah.trim() === '') {
                                if (fromAyah) report += `Surah ${surahName} (${fromAyah})`;
                                else report += `Surah ${surahName}`;
                              } else {
                                if (fromAyah === toAyah) report += `Surah ${surahName} (${fromAyah})`;
                                else report += `Surah ${surahName} (From ${fromAyah} to ${toAyah})`;
                              }
                            }
                            report += `\n`;
                          }


                          // Add Old Revision Homework
                          if (sectionToggles.homeworkOldRev && !excludeHomeworkOldRev) {
                            report += `\n*• Old Revision:*\n`;
                            if (isRedoModeOldRev) report += `(Repeat) `;

                            if (isHwOldRevPageMode) {
                              report += formatRangeEn('Page', 'hw-oldrev-from', hwOldRevFrom, 'hw-oldrev-to', hwOldRevTo);
                            }
                            else if (isHwOldRevJuzMode) {
                              report += formatRangeEn('Juz', 'hw-oldrev-from', hwOldRevFrom, 'hw-oldrev-to', hwOldRevTo);
                            }
                            else if (isHwOldRevHizbMode) {
                              report += formatRangeEn('Hizb', 'hw-oldrev-from', hwOldRevFrom, 'hw-oldrev-to', hwOldRevTo);
                            }
                            else if (isHwOldRevSurahMode) report += `Surah ${hwOldRevFromSurah} - Surah ${hwOldRevToSurah}`;
                            else if (activeAdvancedAyah.homeworkOldRev) {
                              const fromAyah = hwOldRevFrom ? hwOldRevFrom.toString().trim() : '';
                              const toAyah = hwOldRevTo ? hwOldRevTo.toString().trim() : '';

                              const isFromValid = !isCancelled('hw-oldrev-from') && fromAyah !== '';
                              const isToValid = !isCancelled('hw-oldrev-to') && toAyah !== '' && toAyah !== '0';
                              const isToOpen = !isCancelled('hw-oldrev-to') && toAyah === '0';

                              if (!isFromValid && !isToValid && !isToOpen) {
                                if (hwOldRevSurah === hwOldRevToSurahAdvanced) {
                                  report += `Surah ${hwOldRevSurah}`;
                                } else {
                                  report += `From Surah ${hwOldRevSurah} to Surah ${hwOldRevToSurahAdvanced}`;
                                }
                              } else {
                                if (hwOldRevSurah === hwOldRevToSurahAdvanced) {
                                  // Same surah: compact format
                                  if (isFromValid && isToValid) {
                                    if (fromAyah === toAyah) report += `Surah ${hwOldRevSurah} (${fromAyah})`;
                                    else report += `Surah ${hwOldRevSurah} (From ${fromAyah} to ${toAyah})`;
                                  } else if (isFromValid && isToOpen) {
                                    report += `Surah ${hwOldRevSurah} (From ${fromAyah} to...)`;
                                  } else if (isFromValid) {
                                    report += `Surah ${hwOldRevSurah} (${fromAyah})`;
                                  } else {
                                    report += `Surah ${hwOldRevSurah}`;
                                  }
                                } else {
                                  const p1 = isFromValid ? `From Surah ${hwOldRevSurah} Ayah ${fromAyah}` : `From Surah ${hwOldRevSurah}`;
                                  let p2 = '';
                                  if (isToOpen) p2 = ' to...';
                                  else if (isToValid) p2 = ` to Surah ${hwOldRevToSurahAdvanced} Ayah ${toAyah}`;
                                  else if (hwOldRevToSurahAdvanced && hwOldRevToSurahAdvanced !== hwOldRevSurah) p2 = ` to Surah ${hwOldRevToSurahAdvanced}`;

                                  report += `${p1}${p2}`;
                                }
                              }
                            }
                            else {
                              const surahName = hwOldRevSurah || getEnglishSurahName(SURAHS[0]);
                              const fromAyah = hwOldRevFrom || '';
                              const toAyah = hwOldRevTo || '';

                              if (isCancelled('hw-oldrev-to')) {
                                if (fromAyah) report += `Surah ${surahName} (${fromAyah})`;
                                else report += `Surah ${surahName}`;
                              } else if (toAyah === '0') {
                                report += `Surah ${surahName} (From ${fromAyah} to...)`;
                              } else if (!toAyah || toAyah.trim() === '') {
                                if (fromAyah) report += `Surah ${surahName} (${fromAyah})`;
                                else report += `Surah ${surahName}`;
                              } else {
                                if (fromAyah === toAyah) report += `Surah ${surahName} (${fromAyah})`;
                                else report += `Surah ${surahName} (From ${fromAyah} to ${toAyah})`;
                              }
                            }
                            report += `\n`;
                          }

                          // 6. Homework Tilawa (Reading) Values
                          const isHwTilawaPageMode = preferredModes.homeworkTilawa === 'page';
                          const isHwTilawaJuzMode = preferredModes.homeworkTilawa === 'juz';
                          const isHwTilawaHizbMode = preferredModes.homeworkTilawa === 'hizb';
                          const isHwTilawaSurahMode = preferredModes.homeworkTilawa === 'surah';
                          const hwTilawaSurahRaw = (document.getElementById('hw-tilawa-surah-select') as HTMLSelectElement)?.value || SURAHS[0];
                          const hwTilawaSurah = getEnglishSurahName(hwTilawaSurahRaw);

                          const hwTilawaFromSurahRaw = (document.getElementById('hw-tilawa-from-surah') as HTMLSelectElement)?.value || SURAHS[0];
                          const hwTilawaFromSurah = getEnglishSurahName(toEnglish(hwTilawaFromSurahRaw));

                          const hwTilawaToSurahRaw = (document.getElementById('hw-tilawa-to-surah') as HTMLSelectElement)?.value || SURAHS[0];
                          const hwTilawaToSurah = getEnglishSurahName(toEnglish(hwTilawaToSurahRaw));

                          const hwTilawaToSurahAdvancedRaw = (document.getElementById('hw-tilawa-to-surah-advanced') as HTMLSelectElement)?.value || SURAHS[0];
                          const hwTilawaToSurahAdvanced = getEnglishSurahName(toEnglish(hwTilawaToSurahAdvancedRaw));
                          const hwTilawaFrom = toEnglish((document.getElementById('hw-tilawa-from') as HTMLInputElement)?.value || '');
                          const hwTilawaTo = toEnglish((document.getElementById('hw-tilawa-to') as HTMLInputElement)?.value || '');

                          // Add Homework Tilawa
                          if (sectionToggles.homeworkTilawa && !excludeHomeworkTilawa) {
                            report += `\n*• Reading:*\n`;
                            if (isRedoModeTilawa) report += `(Repeat) `;

                            if (isHwTilawaPageMode) {
                              report += formatRangeEn('Page', 'hw-tilawa-from', hwTilawaFrom, 'hw-tilawa-to', hwTilawaTo);
                            }
                            else if (isHwTilawaJuzMode) {
                              report += formatRangeEn('Juz', 'hw-tilawa-from', hwTilawaFrom, 'hw-tilawa-to', hwTilawaTo);
                            }
                            else if (isHwTilawaHizbMode) {
                              report += formatRangeEn('Hizb', 'hw-tilawa-from', hwTilawaFrom, 'hw-tilawa-to', hwTilawaTo);
                            }
                            else if (isHwTilawaSurahMode) report += `From Surah ${hwTilawaFromSurah} to Surah ${hwTilawaToSurah}`;
                            else if (activeAdvancedAyah.homeworkTilawa) {
                              const fromAyah = hwTilawaFrom ? hwTilawaFrom.toString().trim() : '';
                              const toAyah = hwTilawaTo ? hwTilawaTo.toString().trim() : '';

                              const isFromValid = !isCancelled('hw-tilawa-from') && fromAyah !== '';
                              const isToValid = !isCancelled('hw-tilawa-to') && toAyah !== '' && toAyah !== '0';
                              const isToOpen = !isCancelled('hw-tilawa-to') && toAyah === '0';

                              if (!isFromValid && !isToValid && !isToOpen) {
                                if (hwTilawaSurah === hwTilawaToSurahAdvanced) {
                                  report += `Surah ${hwTilawaSurah}`;
                                } else {
                                  report += `From Surah ${hwTilawaSurah} to Surah ${hwTilawaToSurahAdvanced}`;
                                }
                              } else {
                                if (hwTilawaSurah === hwTilawaToSurahAdvanced) {
                                  const isSingleAyah = isFromValid && isToValid && fromAyah === toAyah;
                                  if (isSingleAyah) {
                                    report += `Surah ${hwTilawaSurah} (${fromAyah})`;
                                  } else if (isFromValid && isToValid) {
                                    report += `Surah ${hwTilawaSurah} (From ${fromAyah} to ${toAyah})`;
                                  } else if (isFromValid && isToOpen) {
                                    report += `Surah ${hwTilawaSurah} (From ${fromAyah} to...)`;
                                  } else if (isFromValid) {
                                    report += `Surah ${hwTilawaSurah} (${fromAyah})`;
                                  } else {
                                    report += `Surah ${hwTilawaSurah}`;
                                  }
                                } else {
                                  const p1 = isFromValid ? `From Surah ${hwTilawaSurah} Ayah ${fromAyah}` : `From Surah ${hwTilawaSurah}`;
                                  let p2 = '';
                                  if (isToOpen) p2 = ' to...';
                                  else if (isToValid) p2 = ` to Surah ${hwTilawaToSurahAdvanced} Ayah ${toAyah}`;
                                  else if (hwTilawaToSurahAdvanced && hwTilawaToSurahAdvanced !== hwTilawaSurah) p2 = ` to Surah ${hwTilawaToSurahAdvanced}`;

                                  report += `${p1}${p2}`;
                                }
                              }
                            }
                            else {
                              const surahName = hwTilawaSurah || getEnglishSurahName(SURAHS[0]);
                              const fromAyah = hwTilawaFrom || '';
                              const toAyah = hwTilawaTo || '';

                              if (isCancelled('hw-tilawa-to')) {
                                if (fromAyah) report += `Surah ${surahName} (${fromAyah})`;
                                else report += `Surah ${surahName}`;
                              } else if (toAyah === '0') {
                                report += `Surah ${surahName} (From ${fromAyah} to...)`;
                              } else if (!toAyah || toAyah.trim() === '') {
                                if (fromAyah) report += `Surah ${surahName} (${fromAyah})`;
                                else report += `Surah ${surahName}`;
                              } else {
                                if (fromAyah === toAyah) report += `Surah ${surahName} (${fromAyah})`;
                                else report += `Surah ${surahName} (From ${fromAyah} to ${toAyah})`;
                              }
                            }

                            report += `\n`;
                          }

                          if (sectionToggles.quranTajweed && !excludeQuranTajweed) {
                            const currentTajweedLesson = getTajweedLessonTitle(quranTajweedCurrentLessonId, 'en');
                            const nextTajweedLesson = quranTajweedNextLessonId === TAJWEED_NEXT_REPEAT
                              ? currentTajweedLesson
                              : quranTajweedNextLessonId === TAJWEED_NEXT_HIDE || !quranTajweedNextLessonId
                                ? ''
                                : getTajweedLessonTitle(quranTajweedNextLessonId, 'en');
                            if (nextTajweedLesson || enTajweedQuizNote) {
                              report += `\n*• Tajweed:*\n`;
                              if (nextTajweedLesson) {
                                report += `${nextTajweedLesson}\n`;
                              }
                              if (enTajweedQuizNote) {
                                if (nextTajweedLesson) {
                                  report += `\n- *Kindly check the homework section*\n`;
                                } else {
                                  report += `Kindly check the homework section\n`;
                                }
                              }
                            }
                          }



                          // Save Report Config (English - Logic is same, saving the raw inputs)
                          // Note: English inputs are already converted to English digits for the report string,
                          // but for 'lastReports' state we might want to store them in a consistent format (e.g. English digits)
                          // so they restore correctly. The 'toEnglish' function was used on the retrieved values above.
                          if (mergeWithQuran && noorPlanPart) {
                            const bookNameEn = (lastReports[smartReportModal.studentId]?.noor?.book || defaultNoorBook) === 'taasees' ? 'Foundation Book' : 'Noor El-Bayan Book';
                            report += `\n📚 *( ${bookNameEn} )* -----\n\n${noorPlanPart}`;

                            // Foundation Book Listening Link (merged mode)
                            const isMergedFoundationBook = (lastReports[smartReportModal.studentId]?.noor?.book || defaultNoorBook) === 'taasees';
                            const mergedFoundationListenPage = (() => {
                              const toEn2 = (v: string) => v.replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]);
                              const sayatimVal = toEn2((document.getElementById('noor-sayatim-from-page') as HTMLInputElement)?.value || '');
                              const tamVal = toEn2((document.getElementById('noor-tam-from-page') as HTMLInputElement)?.value || '');
                              return sayatimVal || tamVal;
                            })();
                            if (isMergedFoundationBook && mergedFoundationListenPage) {
                              const mergedFoundationPageEng = toEnglish(mergedFoundationListenPage.toString());
                              report += `\n*• Listening:*\nhttps://audio-foundation-book.vercel.app/?page=${mergedFoundationPageEng}\n`;
                            }
                          }

                          // Smart End of Surah text replacements for English
                          report = report.replace(/to Surah ([a-zA-Z\s\-']+) Ayah (\d+)/gi, (match, surah, ayahStr) => {
                              const sIdx = SURAHS.findIndex(s => getEnglishSurahName(s).toLowerCase() === surah.trim().toLowerCase());
                              if (sIdx > -1) {
                                  if (parseInt(ayahStr) === SURAH_AYAH_COUNTS[sIdx]) return `to the end of Surah ${surah.trim()}`;
                              }
                              return match;
                          });
                            report = report.replace(/From Surah\s+(.+?)\s+Ayah\s+1\s+to the end of Surah\s+(.+)/gi, 'From Surah $1 to Surah $2');
                          report = report.replace(/Surah ([a-zA-Z\s\-']+) \(From (.*?) to (\d+)\)/gi, (match, surah, fromStr, ayahStr) => {
                              const sIdx = SURAHS.findIndex(s => getEnglishSurahName(s).toLowerCase() === surah.trim().toLowerCase());
                              if (sIdx > -1) {
                                  if (parseInt(ayahStr) === SURAH_AYAH_COUNTS[sIdx]) return `Surah ${surah.trim()} (From ${fromStr} to the end)`;
                              }
                              return match;
                          });

                          // Custom Notes
                          const customNotesValEng = customNotesText.trim();
                          if (customNotesValEng) {
                            report += `\n*ــــــــــــــــــــــــــــــــــــــ*\n\n✏️ *Notes:*\n${customNotesValEng}`;
                          }

                          setLastReports(prev => ({
                            ...prev,
                            [smartReportModal.studentId]: {
                              ...prev[smartReportModal.studentId],
                              ...noorConfigPart,
                              customNotes: customNotesValEng || '',
                              audioLink: audioLinkText.trim() || '',
                              readingNew: {
                                mode: preferredModes.readingNew,
                                surah: quranNewSurahRaw,
                                fromAyah: quranNewFromAyah,
                                toAyah: quranNewToAyah,
                                fromPage: quranNewFromPage,
                                toPage: quranNewToPage,
                                fromJuz: quranNewFromJuz,
                                toJuz: quranNewToJuz,
                                fromHizb: quranNewFromHizb,
                                toHizb: quranNewToHizb,
                                fromSurah: quranNewFromSurahRaw,
                                toSurah: preferredModes.readingNew === 'surah' ? quranNewToSurahRaw : (activeAdvancedAyah.readingNew ? quranNewToSurahAdvancedRaw : quranNewToSurahRaw),
                                isAdvancedAyah: activeAdvancedAyah.readingNew
                              },
                              readingRev: {
                                mode: preferredModes.readingRev,
                                surah: quranRevSurahRaw,
                                fromAyah: quranRevFromAyah,
                                toAyah: quranRevToAyah,
                                fromPage: quranRevFromPage,
                                toPage: quranRevToPage,
                                fromJuz: quranRevFromJuz,
                                toJuz: quranRevToJuz,
                                fromHizb: quranRevFromHizb,
                                toHizb: quranRevToHizb,
                                fromSurah: quranRevFromSurahRaw,
                                toSurah: preferredModes.readingRev === 'surah' ? quranRevToSurahRaw : (activeAdvancedAyah.readingRev ? quranRevToSurahAdvancedRaw : quranRevToSurahRaw),
                                isAdvancedAyah: activeAdvancedAyah.readingRev
                              },
                              homeworkNew: {
                                mode: preferredModes.homeworkNew,
                                surah: hwNewSurahRaw,
                                from: hwNewFrom,
                                to: hwNewTo,
                                fromSurah: hwNewFromSurahRaw,
                                toSurah: preferredModes.homeworkNew === 'surah' ? hwNewToSurahRaw : (activeAdvancedAyah.homeworkNew ? hwNewToSurahAdvancedRaw : hwNewToSurahRaw),
                                isAdvancedAyah: activeAdvancedAyah.homeworkNew,
                                isRedo: isRedoMode,
                                excludeFromReport: excludeNewFromReport,
                                masteryDeficiency: masteryDeficiency
                              },
                              homeworkRev: {
                                mode: preferredModes.homeworkRev,
                                surah: hwRevSurahRaw,
                                from: hwRevFrom,
                                to: hwRevTo,
                                fromSurah: hwRevFromSurahRaw,
                                toSurah: preferredModes.homeworkRev === 'surah' ? hwRevToSurahRaw : (activeAdvancedAyah.homeworkRev ? hwRevToSurahAdvancedRaw : hwRevToSurahRaw),
                                isAdvancedAyah: activeAdvancedAyah.homeworkRev
                              },
                              homeworkTilawa: {
                                mode: preferredModes.homeworkTilawa,
                                surah: hwTilawaSurahRaw,
                                from: hwTilawaFrom,
                                to: hwTilawaTo,
                                fromSurah: hwTilawaFromSurahRaw,
                                toSurah: preferredModes.homeworkTilawa === 'surah' ? hwTilawaToSurahRaw : (activeAdvancedAyah.homeworkTilawa ? hwTilawaToSurahAdvancedRaw : hwTilawaToSurahRaw),
                                isAdvancedAyah: activeAdvancedAyah.homeworkTilawa
                              },
                              quranTajweed: {
                                currentLessonId: quranTajweedCurrentLessonId,
                                nextLessonId: quranTajweedNextLessonId
                              },
                              readingTilawa: {
                                mode: preferredModes.readingTilawa,
                                surah: quranTilawaSurahRaw,
                                fromAyah: quranTilawaFromAyah,
                                toAyah: quranTilawaToAyah,
                                fromPage: quranTilawaFromPage,
                                toPage: quranTilawaToPage,
                                fromJuz: quranTilawaFromJuz,
                                toJuz: quranTilawaToJuz,
                                fromHizb: quranTilawaFromHizb,
                                toHizb: quranTilawaToHizb,
                                fromSurah: quranTilawaFromSurahRaw,
                                toSurah: preferredModes.readingTilawa === 'surah' ? quranTilawaToSurahRaw : (activeAdvancedAyah.readingTilawa ? quranTilawaToSurahAdvancedRaw : quranTilawaToSurahRaw),
                                isAdvancedAyah: activeAdvancedAyah.readingTilawa
                              },
                              sectionToggles: { ...sectionToggles },
                              cancelledInputs: { ...cancelledInputs }
                            }
                          }));

                          const _engStudentId = smartReportModal.studentId;
                          const _engDayNum = smartReportModal.dayNum;

                          if (sendViaWhatsapp) {
                            // Resolve WhatsApp Target (Hierarchy: Student > Academy ONLY)
                            // 1. Get Student specific number
                            const student = students.find(s => s.id === smartReportModal.studentId);
                            const studentWhatsapp = student?.whatsappNumber;

                            // 2. Get Academy specific number
                            const academyWhatsapp = student ? academyRates[student.academy]?.whatsappNumber : undefined;

                            // 3. Resolve Target (No Global Fallback)
                            const finalTarget = studentWhatsapp || academyWhatsapp;

                            // Check if we have a valid target
                            if (!finalTarget || finalTarget.trim() === '') {
                              alert('يرجى تحديد رقم واتساب في إعدادات الطالب أو إعدادات الأكاديمية أولاً.');
                              return;
                            }

                            // Send via Puppeteer automation using the resolved target
                            closeAllModals(true);
                            // Copy + open link immediately alongside WhatsApp send
                            navigator.clipboard.writeText(report).catch(() => { });
                            checkAndOpenLink(_engStudentId);
                            showToast(`Sending to ${finalTarget}... ⏳`);
                            window.electronAPI?.sendWhatsAppAuto(finalTarget, report).then((result: any) => {
                              if (result.success) {
                                // Save report for later viewing
                                const reportKey = `${_engStudentId}_${_engDayNum}_${month}_${year}`;

                                // PERSISTENCE FIX: Ensure lastReports is updated even on WhatsApp send
                                setLastReports(prev => ({
                                  ...prev,
                                  [_engStudentId]: {
                                    ...prev[_engStudentId],
                                    sendViaWhatsapp: true,
                                    // Merge current state values to ensure they are saved
                                    readingNew: {
                                      mode: preferredModes.readingNew,
                                      surah: quranNewSurahRaw,
                                      fromAyah: quranNewFromAyah,
                                      toAyah: quranNewToAyah,
                                      fromPage: quranNewFromPage,
                                      toPage: quranNewToPage,
                                      fromJuz: quranNewFromJuz,
                                      toJuz: quranNewToJuz,
                                      fromHizb: quranNewFromHizb,
                                      toHizb: quranNewToHizb,
                                      fromSurah: quranNewFromSurahRaw,
                                      toSurah: preferredModes.readingNew === 'surah' ? quranNewToSurahRaw : (activeAdvancedAyah.readingNew ? quranNewToSurahAdvancedRaw : quranNewToSurahRaw),
                                      isAdvancedAyah: activeAdvancedAyah.readingNew
                                    },
                                    readingRev: {
                                      mode: preferredModes.readingRev,
                                      surah: quranRevSurahRaw,
                                      fromAyah: quranRevFromAyah,
                                      toAyah: quranRevToAyah,
                                      fromPage: quranRevFromPage,
                                      toPage: quranRevToPage,
                                      fromJuz: quranRevFromJuz,
                                      toJuz: quranRevToJuz,
                                      fromHizb: quranRevFromHizb,
                                      toHizb: quranRevToHizb,
                                      fromSurah: quranRevFromSurahRaw,
                                      toSurah: preferredModes.readingRev === 'surah' ? quranRevToSurahRaw : (activeAdvancedAyah.readingRev ? quranRevToSurahAdvancedRaw : quranRevToSurahRaw),
                                      isAdvancedAyah: activeAdvancedAyah.readingRev
                                    },
                                    homeworkNew: {
                                      mode: preferredModes.homeworkNew,
                                      surah: hwNewSurahRaw,
                                      from: hwNewFrom,
                                      to: hwNewTo,
                                      fromSurah: hwNewFromSurahRaw,
                                      toSurah: preferredModes.homeworkNew === 'surah' ? hwNewToSurahRaw : (activeAdvancedAyah.homeworkNew ? hwNewToSurahAdvancedRaw : hwNewToSurahRaw),
                                      isAdvancedAyah: activeAdvancedAyah.homeworkNew,
                                      isRedo: isRedoMode,
                                      excludeFromReport: excludeNewFromReport,
                                      masteryDeficiency: masteryDeficiency
                                    },
                                    homeworkRev: {
                                      mode: preferredModes.homeworkRev,
                                      surah: hwRevSurahRaw,
                                      from: hwRevFrom,
                                      to: hwRevTo,
                                      fromSurah: hwRevFromSurahRaw,
                                      toSurah: preferredModes.homeworkRev === 'surah' ? hwRevToSurahRaw : (activeAdvancedAyah.homeworkRev ? hwRevToSurahAdvancedRaw : hwRevToSurahRaw),
                                      isAdvancedAyah: activeAdvancedAyah.homeworkRev
                                    },
                                    homeworkTilawa: {
                                      mode: preferredModes.homeworkTilawa,
                                      surah: hwTilawaSurahRaw,
                                      from: hwTilawaFrom,
                                      to: hwTilawaTo,
                                      fromSurah: hwTilawaFromSurahRaw,
                                      toSurah: preferredModes.homeworkTilawa === 'surah' ? hwTilawaToSurahRaw : (activeAdvancedAyah.homeworkTilawa ? hwTilawaToSurahAdvancedRaw : hwTilawaToSurahRaw),
                                      isAdvancedAyah: activeAdvancedAyah.homeworkTilawa
                                    },
                                    quranTajweed: {
                                      currentLessonId: quranTajweedCurrentLessonId,
                                      nextLessonId: quranTajweedNextLessonId
                                    },
                                    readingTilawa: {
                                      mode: preferredModes.readingTilawa,
                                      surah: quranTilawaSurahRaw,
                                      fromAyah: quranTilawaFromAyah,
                                      toAyah: quranTilawaToAyah,
                                      fromPage: quranTilawaFromPage,
                                      toPage: quranTilawaToPage,
                                      fromJuz: quranTilawaFromJuz,
                                      toJuz: quranTilawaToJuz,
                                      fromHizb: quranTilawaFromHizb,
                                      toHizb: quranTilawaToHizb,
                                      fromSurah: quranTilawaFromSurahRaw,
                                      toSurah: preferredModes.readingTilawa === 'surah' ? quranTilawaToSurahRaw : (activeAdvancedAyah.readingTilawa ? quranTilawaToSurahAdvancedRaw : quranTilawaToSurahRaw),
                                      isAdvancedAyah: activeAdvancedAyah.readingTilawa
                                    },
                                    sectionToggles: { ...sectionToggles },
                                    cancelledInputs: { ...cancelledInputs }
                                  }
                                }));

                                saveReportForDay(_engStudentId, _engDayNum, report, {
                                  ...noorConfigPart,
                                  noorDetails,
                                  activeSection: reportPath,
                                  mergeWithQuran,
                                  customNotes: customNotesText.trim(),
                                  audioLink: audioLinkText.trim()
                                });
                                ensureTajweedAssignmentForLesson(_engStudentId, enReportTajweedLessonId, 'en');

                                showToast('Sent via WhatsApp ✅');
                                new Notification('Sent ✅', { body: `Report for ${studentName} sent via WhatsApp` });
                              } else {
                                showToast('Failed to send ❌');
                                console.error('WhatsApp error:', result.error);
                              }
                            }).catch((err: any) => {
                              console.error('WhatsApp automation error:', err);
                              showToast('Failed to send ❌');
                            });
                          } else {
                            navigator.clipboard.writeText(report).then(() => {
                              saveReportForDay(_engStudentId, _engDayNum, report, {
                                ...noorConfigPart,
                                noorDetails,
                                activeSection: reportPath,
                                mergeWithQuran,
                                customNotes: customNotesText.trim(),
                                audioLink: audioLinkText.trim()
                              });
                              ensureTajweedAssignmentForLesson(_engStudentId, enReportTajweedLessonId, 'en');

                              closeAllModals(true);
                              showToast('Report Copied (English) ✨');
                              checkAndOpenLink(_engStudentId);

                              // PERSISTENCE FIX: Force save to lastReports on Clipboard Copy (Match Arabic behavior)
                              setLastReports(prev => ({
                                ...prev,
                                [_engStudentId]: {
                                  ...prev[_engStudentId],
                                  ...noorConfigPart,
                                  readingNew: {
                                    mode: preferredModes.readingNew,
                                    surah: quranNewSurahRaw,
                                    fromAyah: quranNewFromAyah,
                                    toAyah: quranNewToAyah,
                                    fromPage: quranNewFromPage,
                                    toPage: quranNewToPage,
                                    fromJuz: quranNewFromJuz,
                                    toJuz: quranNewToJuz,
                                    fromHizb: quranNewFromHizb,
                                    toHizb: quranNewToHizb,
                                    fromSurah: quranNewFromSurahRaw,
                                    toSurah: preferredModes.readingNew === 'surah' ? quranNewToSurahRaw : (activeAdvancedAyah.readingNew ? quranNewToSurahAdvancedRaw : quranNewToSurahRaw),
                                    isAdvancedAyah: activeAdvancedAyah.readingNew
                                  },
                                  readingRev: {
                                    mode: preferredModes.readingRev,
                                    surah: quranRevSurahRaw,
                                    fromAyah: quranRevFromAyah,
                                    toAyah: quranRevToAyah,
                                    fromPage: quranRevFromPage,
                                    toPage: quranRevToPage,
                                    fromJuz: quranRevFromJuz,
                                    toJuz: quranRevToJuz,
                                    fromHizb: quranRevFromHizb,
                                    toHizb: quranRevToHizb,
                                    fromSurah: quranRevFromSurahRaw,
                                    toSurah: preferredModes.readingRev === 'surah' ? quranRevToSurahRaw : (activeAdvancedAyah.readingRev ? quranRevToSurahAdvancedRaw : quranRevToSurahRaw),
                                    isAdvancedAyah: activeAdvancedAyah.readingRev
                                  },
                                  homeworkNew: {
                                    mode: preferredModes.homeworkNew,
                                    surah: hwNewSurahRaw,
                                    from: hwNewFrom,
                                    to: hwNewTo,
                                    fromSurah: hwNewFromSurahRaw,
                                    toSurah: preferredModes.homeworkNew === 'surah' ? hwNewToSurahRaw : (activeAdvancedAyah.homeworkNew ? hwNewToSurahAdvancedRaw : hwNewToSurahRaw),
                                    isAdvancedAyah: activeAdvancedAyah.homeworkNew,
                                    isRedo: isRedoMode,
                                    excludeFromReport: excludeNewFromReport,
                                    masteryDeficiency: masteryDeficiency
                                  },
                                  homeworkRev: {
                                    mode: preferredModes.homeworkRev,
                                    surah: hwRevSurahRaw,
                                    from: hwRevFrom,
                                    to: hwRevTo,
                                    fromSurah: hwRevFromSurahRaw,
                                    toSurah: preferredModes.homeworkRev === 'surah' ? hwRevToSurahRaw : (activeAdvancedAyah.homeworkRev ? hwRevToSurahAdvancedRaw : hwRevToSurahRaw),
                                    isAdvancedAyah: activeAdvancedAyah.homeworkRev
                                  },
                                  homeworkTilawa: {
                                    mode: preferredModes.homeworkTilawa,
                                    surah: hwTilawaSurahRaw,
                                    from: hwTilawaFrom,
                                    to: hwTilawaTo,
                                    fromSurah: hwTilawaFromSurahRaw,
                                    toSurah: preferredModes.homeworkTilawa === 'surah' ? hwTilawaToSurahRaw : (activeAdvancedAyah.homeworkTilawa ? hwTilawaToSurahAdvancedRaw : hwTilawaToSurahRaw),
                                    isAdvancedAyah: activeAdvancedAyah.homeworkTilawa
                                  },
                                  quranTajweed: {
                                    currentLessonId: quranTajweedCurrentLessonId,
                                    nextLessonId: quranTajweedNextLessonId
                                  },
                                  readingTilawa: {
                                    mode: preferredModes.readingTilawa,
                                    surah: quranTilawaSurahRaw,
                                    fromAyah: quranTilawaFromAyah,
                                    toAyah: quranTilawaToAyah,
                                    fromPage: quranTilawaFromPage,
                                    toPage: quranTilawaToPage,
                                    fromJuz: quranTilawaFromJuz,
                                    toJuz: quranTilawaToJuz,
                                    fromHizb: quranTilawaFromHizb,
                                    toHizb: quranTilawaToHizb,
                                    fromSurah: quranTilawaFromSurahRaw,
                                    toSurah: preferredModes.readingTilawa === 'surah' ? quranTilawaToSurahRaw : (activeAdvancedAyah.readingTilawa ? quranTilawaToSurahAdvancedRaw : quranTilawaToSurahRaw),
                                    isAdvancedAyah: activeAdvancedAyah.readingTilawa
                                  },
                                  sectionToggles: { ...sectionToggles },
                                  cancelledInputs: { ...cancelledInputs }
                                }
                              }));
                            });
                          }
                        }}
                        className="py-4 px-10 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-normal text-xl font-medium hover:shadow-lg flex items-center justify-center gap-3 min-w-[200px] transition-transform active:scale-95"
                      >
                        {sendViaWhatsapp ? <MessageCircle className="w-6 h-6" /> : '📋'} English
                      </button>
                    </div>


                    {/* Subscription Settings Modal */}
                    {showSubscriptionModal && (
                      <div
                        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
                        onClick={() => setShowSubscriptionModal(false)}
                        onKeyDown={(e) => e.key === 'Escape' && setShowSubscriptionModal(false)}
                      >
                        <div className="bg-white rounded-2xl shadow-xl p-6 w-80 animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
                          <h3 className="text-xl font-bold text-gray-800 mb-4 text-center font-arabic">إعدادات رقم الحصة</h3>

                          <div className="space-y-4">
                            {/* Mode Selection */}
                            <div>
                              <label className="block text-base font-semibold text-gray-700 mb-2 font-arabic">نوع النظام</label>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setSubscriptionSettings(prev => ({
                                      ...prev,
                                      [smartReportModal.studentId]: {
                                        ...prev[smartReportModal.studentId],
                                        mode: 'subscription',
                                        totalClasses: prev[smartReportModal.studentId]?.totalClasses || 8,
                                        currentClass: prev[smartReportModal.studentId]?.currentClass ?? 0,
                                        enabled: true
                                      }
                                    }));
                                  }}
                                  className={`flex-1 py-2.5 px-3 rounded-lg font-arabic text-base font-semibold transition-colors ${(subscriptionSettings[smartReportModal.studentId]?.mode || 'subscription') === 'subscription'
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                  اشتراك ثابت
                                </button>
                                <button
                                  onClick={() => {
                                    setSubscriptionSettings(prev => ({
                                      ...prev,
                                      [smartReportModal.studentId]: {
                                        ...prev[smartReportModal.studentId],
                                        mode: 'monthly',
                                        totalClasses: prev[smartReportModal.studentId]?.totalClasses || 8,
                                        currentClass: prev[smartReportModal.studentId]?.currentClass ?? 0,
                                        enabled: true,
                                        lastResetMonth: month,
                                        lastResetYear: year
                                      }
                                    }));
                                  }}
                                  className={`flex-1 py-2.5 px-3 rounded-lg font-arabic text-base font-semibold transition-colors ${subscriptionSettings[smartReportModal.studentId]?.mode === 'monthly'
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                  تجديد شهري
                                </button>
                              </div>
                            </div>

                            {/* Current Class - First */}
                            <div>
                              <label className="block text-base font-semibold text-gray-700 mb-1 font-arabic">رقم الحصة الحالية</label>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={toHindiDigits(subscriptionSettings[smartReportModal.studentId]?.currentClass ?? 0)}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => {
                                  const rawVal = e.target.value.replace(/[٠-٩]/g, d => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]);
                                  const val = parseInt(rawVal) || 1;
                                  const currentMode = subscriptionSettings[smartReportModal.studentId]?.mode || 'subscription';
                                  const maxVal = currentMode === 'subscription'
                                    ? (subscriptionSettings[smartReportModal.studentId]?.totalClasses || 100)
                                    : 100;
                                  if (val >= 1 && val <= maxVal) {
                                    setSubscriptionSettings(prev => ({
                                      ...prev,
                                      [smartReportModal.studentId]: {
                                        ...prev[smartReportModal.studentId],
                                        mode: prev[smartReportModal.studentId]?.mode || 'subscription',
                                        totalClasses: prev[smartReportModal.studentId]?.totalClasses || 8,
                                        currentClass: val,
                                        enabled: true
                                      }
                                    }));
                                  }
                                }}
                                className="w-full p-3 border border-gray-200 rounded-xl text-center text-lg bg-gray-50 font-arabic"
                              />
                            </div>

                            {/* Total Classes - Only show for subscription mode */}
                            {(subscriptionSettings[smartReportModal.studentId]?.mode || 'subscription') === 'subscription' && (
                              <div>
                                <label className="block text-base font-semibold text-gray-700 mb-1 font-arabic">عدد حصص الاشتراك</label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={toHindiDigits(subscriptionSettings[smartReportModal.studentId]?.totalClasses || 8)}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => {
                                    const rawVal = e.target.value.replace(/[٠-٩]/g, d => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]);
                                    const val = parseInt(rawVal) || 8;
                                    if (val >= 1 && val <= 100) {
                                      setSubscriptionSettings(prev => ({
                                        ...prev,
                                        [smartReportModal.studentId]: {
                                          ...prev[smartReportModal.studentId],
                                          mode: prev[smartReportModal.studentId]?.mode || 'subscription',
                                          totalClasses: val,
                                          currentClass: Math.min(prev[smartReportModal.studentId]?.currentClass ?? 0, val - 1),
                                          enabled: true
                                        }
                                      }));
                                    }
                                  }}
                                  className="w-full p-3 border border-gray-200 rounded-xl text-center text-lg bg-gray-50 font-arabic"
                                />
                              </div>
                            )}
                          </div>

                          <div className="flex gap-3 mt-6">
                            <button
                              onClick={() => {
                                setSubscriptionSettings(prev => ({
                                  ...prev,
                                  [smartReportModal.studentId]: {
                                    mode: prev[smartReportModal.studentId]?.mode || 'subscription',
                                    totalClasses: prev[smartReportModal.studentId]?.totalClasses || 8,
                                    currentClass: prev[smartReportModal.studentId]?.currentClass ?? 0,
                                    enabled: true,
                                    ...(prev[smartReportModal.studentId]?.mode === 'monthly' && {
                                      lastResetMonth: prev[smartReportModal.studentId]?.lastResetMonth || month,
                                      lastResetYear: prev[smartReportModal.studentId]?.lastResetYear || year
                                    })
                                  }
                                }));
                                setShowSubscriptionModal(false);
                              }}
                              className="flex-1 py-2 px-4 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-arabic"
                            >
                              حفظ
                            </button>
                            <button
                              onClick={() => setShowSubscriptionModal(false)}
                              className="flex-1 py-2 px-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-arabic"
                            >
                              إلغاء
                            </button>
                          </div>
                        </div>
                      </div>
                    )}


                  </div>

                </div>
              </div>
            </div>
          );
        } catch (error) {
          console.error("Error rendering Smart Report Modal:", error);
          return null;
        }
      })()}

      {/* --- Pending Attendance Confirmation Popup --- */}
      {pendingToggle && (
        <div
          className="fixed inset-0 z-[300]"
          onClick={() => setPendingToggle(null)}
        >
          <div
            className="absolute bg-white rounded-2xl shadow-2xl px-5 py-3 border border-gray-200 animate-in zoom-in fade-in duration-150 flex items-center gap-3"
            style={{
              left: `${Math.min(pendingToggle.x, window.innerWidth - 220)}px`,
              top: `${Math.min(pendingToggle.y - 50, window.innerHeight - 70)}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-lg font-arabic text-gray-700 whitespace-nowrap" dir="rtl">هل أنت متأكد؟</p>
            <button
              onClick={() => {
                const { studentId, dayNum, isShift, isAlt, isCtrl } = pendingToggle;
                setPendingToggle(null);
                toggleStatusConfirmed(studentId, dayNum, isShift, isAlt, isCtrl);
              }}
              className="w-8 h-8 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition-colors shadow-sm active:scale-90"
            >
              <Check size={18} strokeWidth={3} />
            </button>
          </div>
        </div>
      )}

      {/* --- Multi-Student Details Modal --- */}
      {selectedStudentsForCombinedReport && (
        <MultiStudentDetailsModal
          students={selectedStudentsForCombinedReport}
          attendance={attendance}
          onClose={() => setSelectedStudentsForCombinedReport(null)}
          month={month}
          year={year}
          usdRate={usdRate}
        />
      )}

      {/* --- Tajweed Bank Modal --- */}
      <TajweedBankModal 
        isOpen={isTajweedBankModalOpen} 
        onClose={() => setIsTajweedBankModalOpen(false)} 
        bank={tajweedBank} 
        onSaveBank={(newBank) => setTajweedBank(newBank)}
        lessonEditorUiState={tajweedLessonEditorUiState}
        onUpdateLessonEditorUiState={(lessonId, nextState) => {
          setTajweedLessonEditorUiState((prev) => ({
            ...prev,
            [lessonId]: {
              ...prev[lessonId],
              ...nextState,
            },
          }));
        }}
      />

      {/* --- Tajweed Assign Modal --- */}
      {assigningTajweedForStudent && (
        <TajweedAssignModal
           isOpen={true}
           onClose={() => setAssigningTajweedForStudent(null)}
           student={assigningTajweedForStudent}
           bank={tajweedBank}
           onAssign={(assignment) => {
             const enrichedAssignment = enrichTajweedAssignmentMetadata(assignment);
             setTajweedAssignments(prev => ({ ...prev, [enrichedAssignment.id]: enrichedAssignment }));
           }}
        />
      )}
      {/* --- Tajweed Grading Modal --- */}
      <TajweedGradingModal
         isOpen={isTajweedGradingModalOpen}
        onClose={() => {
          if (tajweedGradingFocusStudentId) {
            markUngradedTajweedAssignmentsAsSeen(tajweedGradingFocusStudentId);
          }
          setIsTajweedGradingModalOpen(false);
          setTajweedGradingFocusStudentId(null);
        }}
         bank={tajweedBank}
         assignments={tajweedAssignments}
         submissions={tajweedSubmissions}
         students={students}
        onSaveGrading={handleSaveTajweedGrading}
        onRemoveFromMainGrading={handleRemoveFromMainTajweedGrading}
        focusStudentId={tajweedGradingFocusStudentId}
        onViewStudentPage={markUngradedTajweedAssignmentsAsSeen}
      />
    </div >
  );
}

const StickyHeader = React.forwardRef<HTMLDivElement, {
  show: boolean;
  isTableLoading?: boolean;
  studentWidth: number;
  tableWidth: number;
  month: number;
  year: number;
  daysInMonth: number;
  dayOff: number;
  today: { day: number; month: number; year: number };
  toHindiDigits: (n: number | string) => string;
  getDayOfWeek: (d: number) => number;
  getRemainingClasses: (dayNum: number) => number;
  scrollToFirstPending: (dayNum: number) => void;
}>(({ show, isTableLoading, studentWidth, tableWidth, month, year, daysInMonth, dayOff, today, toHindiDigits, getDayOfWeek, getRemainingClasses, scrollToFirstPending }, ref) => {
  const isWeekend = (day: number) => getDayOfWeek(day) === dayOff;
  const isTodayColumn = (dayNum: number) => {
    return month === today.month && year === today.year && dayNum === today.day;
  };

  return (
    <div
      className={`fixed top-[74px] left-0 right-0 z-40 px-12 pointer-events-none will-change-[transform,opacity] ${isTableLoading ? 'transition-none opacity-0 invisible' : 'transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1)'} ${show ? 'opacity-100 translate-y-0 visible' : 'opacity-0 -translate-y-2 invisible'
        }`}
    >
      <div
        className="bg-[#002060] shadow-md border-b border-gray-200 relative"
      >
        <div ref={ref} className="overflow-hidden">
          <table
            style={{ width: tableWidth, minWidth: tableWidth }}
            className="w-full border-separate border-spacing-0 text-center"
          >
            <thead>
              <tr className="text-white/90 bg-[#002060] group/header">
                <th
                  className="sticky right-0 z-50 p-4 font-arabic text-2xl text-center px-2 font-normal bg-[#002060]"
                  style={{
                    width: studentWidth,
                    minWidth: studentWidth,
                    color: 'white',
                    backgroundImage: `
                      radial-gradient(circle at 50% 50%, transparent 0%, #002060 100%),
                      repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 2px, transparent 2px, transparent 10px),
                      repeating-linear-gradient(-45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 2px, transparent 2px, transparent 10px)
                    `,
                    backgroundBlendMode: 'overlay',
                  }}
                >الطالب</th>
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const isWknd = isWeekend(dayNum);
                  const isToday = isTodayColumn(dayNum);

                  return (
                    <th
                      key={dayNum}
                      className={`p-3 min-w-[70px] antialiased relative`}
                      style={{
                        backgroundColor: isToday ? 'rgba(255, 224, 93, 0.4)' : isWknd ? 'rgba(129, 255, 234, 0.1)' : 'transparent'
                      }}
                    >
                      {getRemainingClasses(dayNum) > 0 && (
                        <div
                          onClick={(e) => { e.stopPropagation(); scrollToFirstPending(dayNum); }}
                          className={`absolute -top-8 left-1/2 -translate-x-1/2 min-w-[16px] h-4 flex items-center justify-center z-20 transition-all duration-300 cursor-pointer hover:scale-125 active:scale-95 pointer-events-auto ${isToday ? 'opacity-100' : 'opacity-0 group-hover/header:opacity-100 translate-y-2 group-hover/header:translate-y-0'}`}
                          title="انقر للذهاب لأول حصة متبقية"
                        >
                          <span className="text-[#ffe05d] text-base font-bold font-arabic drop-shadow-md">{toHindiDigits(getRemainingClasses(dayNum))}</span>
                        </div>
                      )}
                      <div
                        className="font-amiri text-lg antialiased mb-2 text-white tracking-widest"
                        style={{ WebkitTextStroke: '0.5px rgba(0,0,0,0.3)' }}
                      >
                        {DAYS_OF_WEEK[getDayOfWeek(dayNum)].name}
                      </div>
                      <div
                        className={`text-xl font-arabic antialiased transition-all ${isToday ? 'text-gray-900 font-bold scale-110' : 'text-white'}`}
                        style={{ WebkitTextStroke: isToday ? '0' : '0.5px rgba(0,0,0,0.3)' }}
                      >
                        {toHindiDigits(dayNum)}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
          </table>
        </div>
      </div>
    </div>
  );
});

export default App;