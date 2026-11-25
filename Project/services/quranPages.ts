import { SURAHS, SURAH_AYAH_COUNTS } from '../constants';
import { quranPartRange } from './quranParts';
import type { MushafSectionKey, StudentReportSettings } from '../types';

export const SURAHS_EN: readonly string[] = [
  'Al-Fatiha', 'Al-Baqara', 'Al-Imran', 'An-Nisa', "Al-Ma'idah", "Al-An'am", "Al-A'raf", 'Al-Anfal', 'At-Tawbah', 'Yunus',
  'Hud', 'Yusuf', "Ar-Ra'd", 'Ibrahim', 'Al-Hijr', 'An-Nahl', 'Al-Isra', 'Al-Kahf', 'Maryam', 'Ta-Ha',
  'Al-Anbiya', 'Al-Hajj', "Al-Mu'minun", 'An-Nur', 'Al-Furqan', "Ash-Shu'ara", 'An-Naml', 'Al-Qasas', 'Al-Ankabut', 'Ar-Rum',
  'Luqman', 'As-Sajdah', 'Al-Ahzab', 'Saba', 'Fatir', 'Ya-Sin', 'As-Saffat', 'Sad', 'Az-Zumar', 'Ghafir',
  'Fussilat', 'Ash-Shura', 'Az-Zukhruf', 'Ad-Dukhan', 'Al-Jathiyah', 'Al-Ahqaf', 'Muhammad', 'Al-Fath', 'Al-Hujurat', 'Qaf',
  'Adh-Dhariyat', 'At-Tur', 'An-Najm', 'Al-Qamar', 'Ar-Rahman', "Al-Waqi'ah", 'Al-Hadid', 'Al-Mujadila', 'Al-Hashr', 'Al-Mumtahanah',
  'As-Saff', "Al-Jumu'ah", 'Al-Munafiqun', 'At-Taghabun', 'At-Talaq', 'At-Tahrim', 'Al-Mulk', 'Al-Qalam', 'Al-Haqqah', "Al-Ma'arij",
  'Nuh', 'Al-Jinn', 'Al-Muzzammil', 'Al-Muddaththir', 'Al-Qiyamah', 'Al-Insan', 'Al-Mursalat', 'An-Naba', "An-Nazi'at", 'Abasa',
  'At-Takwir', 'Al-Infitar', 'Al-Mutaffifin', 'Al-Inshiqaq', 'Al-Buruj', 'At-Tariq', "Al-A'la", 'Al-Ghashiyah', 'Al-Fajr', 'Al-Balad',
  'Ash-Shams', 'Al-Layl', 'Ad-Duha', 'Ash-Sharh', 'At-Tin', 'Al-Alaq', 'Al-Qadr', 'Al-Bayyinah', 'Az-Zalzalah', 'Al-Adiyat',
  "Al-Qari'ah", 'At-Takathur', 'Al-Asr', 'Al-Humazah', 'Al-Fil', 'Quraysh', "Al-Ma'un", 'Al-Kawthar', 'Al-Kafirun', 'An-Nasr',
  'Al-Masad', 'Al-Ikhlas', 'Al-Falaq', 'An-Nas',
];

// Madinah Mushaf (King Fahd Complex) 604-page verse start boundaries: [surah, ayah]
export const MUSHAF_PAGE_STARTS: ReadonlyArray<readonly [number, number]> = [
  [1, 1], [2, 1], [2, 6], [2, 17], [2, 25], [2, 30], [2, 38], [2, 49], [2, 58], [2, 62], [2, 70], [2, 77], [2, 84], [2, 89], [2, 94], [2, 102],
  [2, 106], [2, 113], [2, 120], [2, 127], [2, 135], [2, 142], [2, 146], [2, 154], [2, 164], [2, 170], [2, 177], [2, 182], [2, 187], [2, 191], [2, 197], [2, 203],
  [2, 211], [2, 216], [2, 220], [2, 225], [2, 231], [2, 234], [2, 238], [2, 246], [2, 249], [2, 253], [2, 257], [2, 260], [2, 265], [2, 270], [2, 275], [2, 282],
  [2, 283], [3, 1], [3, 10], [3, 16], [3, 23], [3, 30], [3, 38], [3, 46], [3, 53], [3, 62], [3, 71], [3, 78], [3, 84], [3, 92], [3, 101], [3, 109],
  [3, 116], [3, 122], [3, 133], [3, 141], [3, 149], [3, 154], [3, 158], [3, 166], [3, 174], [3, 181], [3, 187], [3, 195], [4, 1], [4, 7], [4, 12], [4, 15],
  [4, 20], [4, 24], [4, 27], [4, 34], [4, 38], [4, 45], [4, 52], [4, 60], [4, 66], [4, 75], [4, 80], [4, 87], [4, 92], [4, 95], [4, 102], [4, 106],
  [4, 114], [4, 122], [4, 128], [4, 135], [4, 141], [4, 148], [4, 155], [4, 163], [4, 171], [4, 176], [5, 3], [5, 6], [5, 10], [5, 14], [5, 18], [5, 24],
  [5, 32], [5, 37], [5, 42], [5, 46], [5, 51], [5, 58], [5, 65], [5, 71], [5, 77], [5, 83], [5, 90], [5, 96], [5, 104], [5, 109], [5, 114], [6, 1],
  [6, 9], [6, 19], [6, 28], [6, 36], [6, 45], [6, 53], [6, 60], [6, 69], [6, 74], [6, 82], [6, 91], [6, 95], [6, 102], [6, 111], [6, 119], [6, 125],
  [6, 132], [6, 138], [6, 143], [6, 147], [6, 152], [6, 158], [7, 1], [7, 12], [7, 23], [7, 31], [7, 38], [7, 44], [7, 52], [7, 58], [7, 68], [7, 74],
  [7, 82], [7, 88], [7, 96], [7, 105], [7, 121], [7, 131], [7, 138], [7, 144], [7, 150], [7, 156], [7, 160], [7, 164], [7, 171], [7, 179], [7, 188], [7, 196],
  [8, 1], [8, 9], [8, 17], [8, 26], [8, 34], [8, 41], [8, 46], [8, 53], [8, 62], [8, 70], [9, 1], [9, 7], [9, 14], [9, 21], [9, 27], [9, 32],
  [9, 37], [9, 41], [9, 48], [9, 55], [9, 62], [9, 69], [9, 73], [9, 80], [9, 87], [9, 94], [9, 100], [9, 107], [9, 112], [9, 118], [9, 123], [10, 1],
  [10, 7], [10, 15], [10, 21], [10, 26], [10, 34], [10, 43], [10, 54], [10, 62], [10, 71], [10, 79], [10, 89], [10, 98], [10, 107], [11, 6], [11, 13], [11, 20],
  [11, 29], [11, 38], [11, 46], [11, 54], [11, 63], [11, 72], [11, 82], [11, 89], [11, 98], [11, 109], [11, 118], [12, 5], [12, 15], [12, 23], [12, 31], [12, 38],
  [12, 44], [12, 53], [12, 64], [12, 70], [12, 79], [12, 87], [12, 96], [12, 104], [13, 1], [13, 6], [13, 14], [13, 19], [13, 29], [13, 35], [13, 43], [14, 6],
  [14, 11], [14, 19], [14, 25], [14, 34], [14, 43], [15, 1], [15, 16], [15, 32], [15, 52], [15, 71], [15, 91], [16, 7], [16, 15], [16, 27], [16, 35], [16, 43],
  [16, 55], [16, 65], [16, 73], [16, 80], [16, 88], [16, 94], [16, 103], [16, 111], [16, 119], [17, 1], [17, 8], [17, 18], [17, 28], [17, 39], [17, 50], [17, 59],
  [17, 67], [17, 76], [17, 87], [17, 97], [17, 105], [18, 5], [18, 16], [18, 21], [18, 28], [18, 35], [18, 46], [18, 54], [18, 62], [18, 75], [18, 84], [18, 98],
  [19, 1], [19, 12], [19, 26], [19, 39], [19, 52], [19, 65], [19, 77], [19, 96], [20, 13], [20, 38], [20, 52], [20, 65], [20, 77], [20, 88], [20, 99], [20, 114],
  [20, 126], [21, 1], [21, 11], [21, 25], [21, 36], [21, 45], [21, 58], [21, 73], [21, 82], [21, 91], [21, 102], [22, 1], [22, 6], [22, 16], [22, 24], [22, 31],
  [22, 39], [22, 47], [22, 56], [22, 65], [22, 73], [23, 1], [23, 18], [23, 28], [23, 43], [23, 60], [23, 75], [23, 90], [23, 105], [24, 1], [24, 11], [24, 21],
  [24, 28], [24, 32], [24, 37], [24, 44], [24, 54], [24, 59], [24, 62], [25, 3], [25, 12], [25, 21], [25, 33], [25, 44], [25, 56], [25, 68], [26, 1], [26, 20],
  [26, 40], [26, 61], [26, 84], [26, 112], [26, 137], [26, 160], [26, 184], [26, 207], [27, 1], [27, 14], [27, 23], [27, 36], [27, 45], [27, 56], [27, 64], [27, 77],
  [27, 89], [28, 6], [28, 14], [28, 22], [28, 29], [28, 36], [28, 44], [28, 51], [28, 60], [28, 71], [28, 78], [28, 85], [29, 7], [29, 15], [29, 24], [29, 31],
  [29, 39], [29, 46], [29, 53], [29, 64], [30, 6], [30, 16], [30, 25], [30, 33], [30, 42], [30, 51], [31, 1], [31, 12], [31, 20], [31, 29], [32, 1], [32, 12],
  [32, 21], [33, 1], [33, 7], [33, 16], [33, 23], [33, 31], [33, 36], [33, 44], [33, 51], [33, 55], [33, 63], [34, 1], [34, 8], [34, 15], [34, 23], [34, 32],
  [34, 40], [34, 49], [35, 4], [35, 12], [35, 19], [35, 31], [35, 39], [35, 45], [36, 13], [36, 28], [36, 41], [36, 55], [36, 71], [37, 1], [37, 25], [37, 52],
  [37, 77], [37, 103], [37, 127], [37, 154], [38, 1], [38, 17], [38, 27], [38, 43], [38, 62], [38, 84], [39, 6], [39, 11], [39, 22], [39, 32], [39, 41], [39, 48],
  [39, 57], [39, 68], [39, 75], [40, 8], [40, 17], [40, 26], [40, 34], [40, 41], [40, 50], [40, 59], [40, 67], [40, 78], [41, 1], [41, 12], [41, 21], [41, 30],
  [41, 39], [41, 47], [42, 1], [42, 11], [42, 16], [42, 23], [42, 32], [42, 45], [42, 52], [43, 11], [43, 23], [43, 34], [43, 48], [43, 61], [43, 74], [44, 1],
  [44, 19], [44, 40], [45, 1], [45, 14], [45, 23], [45, 33], [46, 6], [46, 15], [46, 21], [46, 29], [47, 1], [47, 12], [47, 20], [47, 30], [48, 1], [48, 10],
  [48, 16], [48, 24], [48, 29], [49, 5], [49, 12], [50, 1], [50, 16], [50, 36], [51, 7], [51, 31], [51, 52], [52, 15], [52, 32], [53, 1], [53, 27], [53, 45],
  [54, 7], [54, 28], [54, 50], [55, 17], [55, 41], [55, 68], [56, 17], [56, 51], [56, 77], [57, 4], [57, 12], [57, 19], [57, 25], [58, 1], [58, 7], [58, 12],
  [58, 22], [59, 4], [59, 10], [59, 17], [60, 1], [60, 6], [60, 12], [61, 6], [62, 1], [62, 9], [63, 5], [64, 1], [64, 10], [65, 1], [65, 6], [66, 1],
  [66, 8], [67, 1], [67, 13], [67, 27], [68, 16], [68, 43], [69, 9], [69, 35], [70, 11], [70, 40], [71, 11], [72, 1], [72, 14], [73, 1], [73, 20], [74, 18],
  [74, 48], [75, 20], [76, 6], [76, 26], [77, 20], [78, 1], [78, 31], [79, 16], [80, 1], [81, 1], [82, 1], [83, 7], [83, 35], [85, 1], [86, 1], [87, 16],
  [89, 1], [89, 24], [91, 1], [92, 15], [95, 1], [97, 1], [98, 8], [100, 10], [103, 1], [106, 1], [109, 1], [112, 1],
];

export const DEFAULT_MUSHAF_SECTION_ORDER: ReadonlyArray<MushafSectionKey> = ['rev', 'oldRev', 'new', 'tilawa'];

export const MUSHAF_SECTION_LABELS: Record<MushafSectionKey, { ar: string; en: string }> = {
  rev: { ar: 'المراجعة القريبة', en: 'Revision' },
  oldRev: { ar: 'المراجعة البعيدة', en: 'Old Revision' },
  new: { ar: 'الجديد', en: 'New Memorization' },
  tilawa: { ar: 'القراءة', en: 'Reading' },
};

export interface ReportSectionInput {
  mode?: string;
  surah?: string;
  fromSurah?: string;
  toSurah?: string;
  fromAyah?: string | number;
  toAyah?: string | number;
  fromPage?: string | number;
  toPage?: string | number;
  fromJuz?: string | number;
  toJuz?: string | number;
  fromHizb?: string | number;
  toHizb?: string | number;
  from?: string | number;
  to?: string | number;
  isAdvancedAyah?: boolean;
  fromCancelled?: boolean;
  toCancelled?: boolean;
}

export interface VerseSpanRange {
  startSurah: number;
  startAyah: number;
  endSurah: number;
  endAyah: number;
}

export interface ResolvedMushafSection {
  key: MushafSectionKey;
  group?: 'reading' | 'homework';
  groupTitleAr?: string;
  groupTitleEn?: string;
  titleAr: string;
  titleEn: string;
  summaryAr: string;
  summaryEn: string;
  startPage: number;
  endPage: number;
  verseSpan?: VerseSpanRange;
}

export function toWesternDigits(value: string | number | undefined | null): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}

function toHindiDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}

function clamp(num: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, num));
}

function parsePositiveInt(raw: string | number | undefined | null): number | null {
  const cleaned = toWesternDigits(raw).replace(/[^\d]/g, '');
  if (!cleaned) return null;
  const num = parseInt(cleaned, 10);
  return Number.isInteger(num) ? num : null;
}

export function normalizeSurahIndex(name: string | undefined | null): number {
  const cleaned = String(name || '')
    .replace(/^سورة\s+/, '')
    .replace(/^Surah\s+/i, '')
    .trim();
  if (!cleaned) return 0;

  const arIdx = SURAHS.indexOf(cleaned);
  if (arIdx !== -1) return arIdx + 1;

  const lower = cleaned.toLowerCase();
  const enIdx = SURAHS_EN.findIndex((item) => item.toLowerCase() === lower);
  if (enIdx !== -1) return enIdx + 1;

  return 0;
}

export function mushafPageForVerse(
  surah: number,
  ayah: number,
  counts: readonly number[] = SURAH_AYAH_COUNTS
): number | null {
  if (!Number.isInteger(surah) || surah < 1 || surah > counts.length) return null;
  const maxAyah = counts[surah - 1];
  const clampedAyah = clamp(Number.isInteger(ayah) ? ayah : 1, 1, maxAyah);

  let matchedPage = 1;
  for (let i = 0; i < MUSHAF_PAGE_STARTS.length; i++) {
    const [ps, pa] = MUSHAF_PAGE_STARTS[i];
    if (ps < surah || (ps === surah && pa <= clampedAyah)) {
      matchedPage = i + 1;
    } else {
      break;
    }
  }
  return matchedPage;
}

export function mushafPageRangeForVerseSpan(
  startSurah: number,
  startAyah: number,
  endSurah: number,
  endAyah: number,
  counts: readonly number[] = SURAH_AYAH_COUNTS
): { startPage: number; endPage: number } | null {
  const s1 = clamp(startSurah, 1, counts.length);
  const s2 = clamp(endSurah, 1, counts.length);
  const a1 = clamp(startAyah, 1, counts[s1 - 1]);
  const a2 = clamp(endAyah, 1, counts[s2 - 1]);

  const p1 = mushafPageForVerse(s1, a1, counts);
  const p2 = mushafPageForVerse(s2, a2, counts);
  if (p1 === null || p2 === null) return null;
  return {
    startPage: Math.min(p1, p2),
    endPage: Math.max(p1, p2),
  };
}

function formatSurahVerseSummary(
  s1: number,
  a1: number | null,
  s2: number,
  a2: number | null,
  lang: 'ar' | 'en'
): string {
  const name1 = lang === 'ar' ? SURAHS[s1 - 1] : SURAHS_EN[s1 - 1];
  const name2 = lang === 'ar' ? SURAHS[s2 - 1] : SURAHS_EN[s2 - 1];
  const d = (n: number) => (lang === 'ar' ? toHindiDigits(n) : String(n));

  if (s1 === s2) {
    if (a1 === null && a2 === null) {
      return lang === 'ar' ? `سورة ${name1}` : `Surah ${name1}`;
    }
    if (a1 !== null && (a2 === null || a1 === a2)) {
      return lang === 'ar' ? `سورة ${name1} (${d(a1)})` : `Surah ${name1} (${d(a1)})`;
    }
    const startA = a1 ?? 1;
    const endA = a2 ?? SURAH_AYAH_COUNTS[s2 - 1];
    return lang === 'ar'
      ? `سورة ${name1} (من ${d(startA)} إلى ${d(endA)})`
      : `Surah ${name1} (${d(startA)}–${d(endA)})`;
  }

  if (a1 === null && a2 === null) {
    return lang === 'ar' ? `من سورة ${name1} إلى سورة ${name2}` : `Surah ${name1} to Surah ${name2}`;
  }
  const p1 = a1 !== null
    ? (lang === 'ar' ? `من سورة ${name1} آية ${d(a1)}` : `Surah ${name1} (${d(a1)})`)
    : (lang === 'ar' ? `من سورة ${name1}` : `Surah ${name1}`);
  const p2 = a2 !== null
    ? (lang === 'ar' ? `إلى سورة ${name2} آية ${d(a2)}` : `Surah ${name2} (${d(a2)})`)
    : (lang === 'ar' ? `إلى سورة ${name2}` : `Surah ${name2}`);
  return lang === 'ar' ? `${p1} ${p2}` : `${p1} – ${p2}`;
}

export function resolveReportSectionPages(
  section: ReportSectionInput | undefined | null,
  counts: readonly number[] = SURAH_AYAH_COUNTS
): { startPage: number; endPage: number; summaryAr: string; summaryEn: string; verseSpan ?: VerseSpanRange } | null {
    if (!section) return null;
    const mode = section.mode || 'ayah';

    if (mode === 'page') {
      if (section.fromCancelled) return null;
      const rawFrom = parsePositiveInt(section.fromPage ?? section.from);
      if (rawFrom === null || rawFrom < 1) return null;
      const rawToVal = section.toCancelled ? null : parsePositiveInt(section.toPage ?? section.to);
      const startPage = clamp(rawFrom, 1, 604);
      const endPage = rawToVal !== null && rawToVal > 0 ? clamp(rawToVal, 1, 604) : startPage;
      const lo = Math.min(startPage, endPage);
      const hi = Math.max(startPage, endPage);
      const summaryAr = lo === hi ? `صفحة ${toHindiDigits(lo)}` : `من صفحة ${toHindiDigits(lo)} إلى صفحة ${toHindiDigits(hi)}`;
      const summaryEn = lo === hi ? `Page ${lo}` : `Pages ${lo}–${hi}`;
      return { startPage: lo, endPage: hi, summaryAr, summaryEn };
    }

    if (mode === 'juz' || mode === 'hizb') {
      if (section.fromCancelled) return null;
      const rawFrom = parsePositiveInt(mode === 'juz' ? (section.fromJuz ?? section.from) : (section.fromHizb ?? section.from));
      if (rawFrom === null || rawFrom < 1) return null;
      const maxPart = mode === 'juz' ? 30 : 60;
      const rawToVal = section.toCancelled
        ? null
        : parsePositiveInt(mode === 'juz' ? (section.toJuz ?? section.to) : (section.toHizb ?? section.to));
      const fromPart = clamp(rawFrom, 1, maxPart);
      const toPart = rawToVal !== null && rawToVal > 0 ? clamp(rawToVal, 1, maxPart) : fromPart;
      const lo = Math.min(fromPart, toPart);
      const hi = Math.max(fromPart, toPart);
      const startRange = quranPartRange(mode, lo, [...counts]);
      const endRange = quranPartRange(mode, hi, [...counts]);
      if (!startRange || !endRange) return null;
      const pageSpan = mushafPageRangeForVerseSpan(
        startRange.startSurah,
        startRange.startAyah,
        endRange.endSurah,
        endRange.endAyah,
        counts
      );
      if (!pageSpan) return null;
      const labelAr = mode === 'juz' ? 'الجزء' : 'الحزب';
      const labelEn = mode === 'juz' ? 'Juz' : 'Hizb';
      const summaryAr = lo === hi
        ? `${labelAr} ${toHindiDigits(lo)}`
        : `من ${labelAr} ${toHindiDigits(lo)} إلى ${labelAr} ${toHindiDigits(hi)}`;
      const summaryEn = lo === hi ? `${labelEn} ${lo}` : `${labelEn} ${lo}–${hi}`;
      return { ...pageSpan, summaryAr, summaryEn };
    }

    if (mode === 'surah') {
      const s1 = normalizeSurahIndex(section.fromSurah || section.surah);
      if (!s1) return null;
      const s2 = normalizeSurahIndex(section.toSurah) || s1;
      const loS = Math.min(s1, s2);
      const hiS = Math.max(s1, s2);
      const pageSpan = mushafPageRangeForVerseSpan(loS, 1, hiS, counts[hiS - 1], counts);
      if (!pageSpan) return null;
      return {
        ...pageSpan,
        summaryAr: formatSurahVerseSummary(loS, null, hiS, null, 'ar'),
        summaryEn: formatSurahVerseSummary(loS, null, hiS, null, 'en'),
        verseSpan: { startSurah: loS, startAyah: 1, endSurah: hiS, endAyah: counts[hiS - 1] },
      };
    }

    // Default: 'ayah' (supports both standard single-surah and advanced cross-surah mode)
    const s1 = normalizeSurahIndex(section.surah || section.fromSurah) || 1;
    const s2 = section.isAdvancedAyah
      ? (normalizeSurahIndex(section.toSurah) || s1)
      : s1;

    const rawFromVal = section.fromCancelled ? null : parsePositiveInt(section.fromAyah ?? section.from);
    const rawToVal = section.toCancelled ? null : parsePositiveInt(section.toAyah ?? section.to);
    const hasFrom = rawFromVal !== null && rawFromVal > 0;
    const hasTo = rawToVal !== null && rawToVal > 0;

    let effStartAyah: number;
    let effEndAyah: number;
    let dispFrom: number | null = null;
    let dispTo: number | null = null;

    if (!hasFrom && !hasTo) {
      effStartAyah = 1;
      effEndAyah = counts[s2 - 1];
    } else if (hasFrom && !hasTo) {
      effStartAyah = clamp(rawFromVal!, 1, counts[s1 - 1]);
      dispFrom = effStartAyah;
      if (s1 === s2) {
        effEndAyah = effStartAyah;
      } else {
        effEndAyah = counts[s2 - 1];
      }
    } else if (!hasFrom && hasTo) {
      effStartAyah = 1;
      effEndAyah = clamp(rawToVal!, 1, counts[s2 - 1]);
      dispTo = effEndAyah;
    } else {
      effStartAyah = clamp(rawFromVal!, 1, counts[s1 - 1]);
      effEndAyah = clamp(rawToVal!, 1, counts[s2 - 1]);
      dispFrom = effStartAyah;
      dispTo = effEndAyah;
    }

    let vStartSurah: number;
    let vStartAyah: number;
    let vEndSurah: number;
    let vEndAyah: number;

    if (s1 > s2) {
      // Reverse Surah order (e.g. An-Nas 114 back to Al-Bayyinah 98 or Al-Zalzalah 99):
      // Include from Ayah 1 of the earlier Surah (s2), and expand full end Surah when starting at Ayah 1.
      vStartSurah = s2;
      vStartAyah = 1;
      vEndSurah = s1;
      vEndAyah = (!hasFrom || effStartAyah === 1 || effStartAyah >= counts[s1 - 1])
        ? counts[s1 - 1]
        : effStartAyah;
    } else if (s1 === s2 && effStartAyah > effEndAyah) {
      vStartSurah = s1;
      vStartAyah = effEndAyah;
      vEndSurah = s1;
      vEndAyah = effStartAyah;
    } else {
      vStartSurah = s1;
      vStartAyah = effStartAyah;
      vEndSurah = s2;
      vEndAyah = effEndAyah;
    }

    const pageSpan = mushafPageRangeForVerseSpan(vStartSurah, vStartAyah, vEndSurah, vEndAyah, counts);
    if (!pageSpan) return null;
    return {
      ...pageSpan,
      summaryAr: formatSurahVerseSummary(s1, dispFrom, s2, dispTo, 'ar'),
      summaryEn: formatSurahVerseSummary(s1, dispFrom, s2, dispTo, 'en'),
      verseSpan: {
        startSurah: vStartSurah,
        startAyah: vStartAyah,
        endSurah: vEndSurah,
        endAyah: vEndAyah,
      },
    };
  }

  export function resolveEffectiveReportSettings(
  settings?: StudentReportSettings | null
): StudentReportSettings {
  const outputFormat = settings?.mushafUnifiedV2
    ? (settings.mushafOutputFormat || 'web_link')
    : 'web_link';
  return {
    includeStudentDashboardLink: !!settings?.includeStudentDashboardLink,
    autoCompleteReport: settings?.autoCompleteReport !== false,
    customMushafEnabled: !!settings?.customMushafEnabled,
    mushafUnifiedV2: true,
    mushafOutputFormat: outputFormat,
    mushafTargetSection: 'both',
    mushafSectionOrder: [...DEFAULT_MUSHAF_SECTION_ORDER],
    mushafIncludedSections: { rev: true, oldRev: true, new: true, tilawa: true },
    mushafDividerStyle: settings?.mushafDividerStyle || 'both',
    mushafLanguage: 'auto',
    mushafPageOffset: 0,
    mushafAutoOpen: false,
    mushafAutoSendWhatsapp: true,
  };
}

export function normalizeSectionOrder(order?: MushafSectionKey[]): MushafSectionKey[] {
    const seen = new Set<MushafSectionKey>();
    const result: MushafSectionKey[] = [];
    for (const key of order || []) {
      if ((key === 'rev' || key === 'oldRev' || key === 'new' || key === 'tilawa') && !seen.has(key)) {
        seen.add(key);
        result.push(key);
      }
    }
    for (const fallbackKey of DEFAULT_MUSHAF_SECTION_ORDER) {
      if (!seen.has(fallbackKey)) {
        seen.add(fallbackKey);
        result.push(fallbackKey);
      }
    }
    return result;
  }

  export function buildCustomMushafPlan(params: {
    reportData: Record<string, any> | undefined;
    sectionToggles?: Record<string, boolean>;
    cancelledInputs?: Record<string, boolean>;
    exclusions?: Partial<Record<MushafSectionKey, boolean>>;
    readingExclusions?: Partial<Record<MushafSectionKey, boolean>>;
    homeworkExclusions?: Partial<Record<MushafSectionKey, boolean>>;
    settings?: StudentReportSettings;
    counts?: readonly number[];
  }): ResolvedMushafSection[] {
    const {
      reportData,
      sectionToggles,
      cancelledInputs = {},
      exclusions = {},
      readingExclusions,
      homeworkExclusions,
      settings,
      counts = SURAH_AYAH_COUNTS,
    } = params;
    if (!reportData) return [];

    const targetMode = settings?.mushafTargetSection || 'homework';
    const order = normalizeSectionOrder(settings?.mushafSectionOrder);
    const includedMap = settings?.mushafIncludedSections;
    const isBoth = targetMode === 'both';

    const collectSectionsForKind = (
      targetKind: 'reading' | 'homework',
      kindExclusions: Partial<Record<MushafSectionKey, boolean>>
    ): ResolvedMushafSection[] => {
      const keyConfig: Record<MushafSectionKey, {
        reportKey: string;
        toggleKey: string;
        fromCancelId: string;
        toCancelId: string;
      }> = targetKind === 'homework'
          ? {
            rev: { reportKey: 'homeworkRev', toggleKey: 'homeworkRev', fromCancelId: 'hw-rev-from', toCancelId: 'hw-rev-to' },
            oldRev: { reportKey: 'homeworkOldRev', toggleKey: 'homeworkOldRev', fromCancelId: 'hw-oldrev-from', toCancelId: 'hw-oldrev-to' },
            new: { reportKey: 'homeworkNew', toggleKey: 'homeworkNew', fromCancelId: 'hw-new-from', toCancelId: 'hw-new-to' },
            tilawa: { reportKey: 'homeworkTilawa', toggleKey: 'homeworkTilawa', fromCancelId: 'hw-tilawa-from', toCancelId: 'hw-tilawa-to' },
          }
          : {
            rev: { reportKey: 'readingRev', toggleKey: 'readingRev', fromCancelId: 'quran-rev-from-ayah', toCancelId: 'quran-rev-to-ayah' },
            oldRev: { reportKey: 'readingOldRev', toggleKey: 'readingOldRev', fromCancelId: 'quran-oldrev-from-ayah', toCancelId: 'quran-oldrev-to-ayah' },
            new: { reportKey: 'readingNew', toggleKey: 'readingNew', fromCancelId: 'quran-new-from-ayah', toCancelId: 'quran-new-to-ayah' },
            tilawa: { reportKey: 'readingTilawa', toggleKey: 'readingTilawa', fromCancelId: 'quran-tilawa-from-ayah', toCancelId: 'quran-tilawa-to-ayah' },
          };

      const groupTitleAr = targetKind === 'reading' ? 'الدرس الحالي' : 'الدرس القادم';
      const groupTitleEn = targetKind === 'reading' ? "Current Lesson" : 'Next Lesson';
      const collected: ResolvedMushafSection[] = [];

      for (const key of order) {
        if (includedMap && includedMap[key] === false) continue;
        if (kindExclusions[key]) continue;

        const cfg = keyConfig[key];
        const toggles = sectionToggles ?? reportData.sectionToggles;
        if (toggles && toggles[cfg.toggleKey] === false) continue;

        const raw = reportData[cfg.reportKey] as ReportSectionInput | undefined;
        if (!raw) continue;

        const mode = raw.mode || 'ayah';
        const fromCancelId = targetKind === 'reading' && mode !== 'ayah'
          ? `quran-${key === 'oldRev' ? 'oldrev' : key}-from-${mode}`
          : cfg.fromCancelId;
        const toCancelId = targetKind === 'reading' && mode !== 'ayah'
          ? `quran-${key === 'oldRev' ? 'oldrev' : key}-to-${mode}`
          : cfg.toCancelId;

        const resolved = resolveReportSectionPages(
          {
            ...raw,
            fromCancelled: !!cancelledInputs[fromCancelId],
            toCancelled: !!cancelledInputs[toCancelId],
          },
          counts
        );
        if (!resolved) continue;

        collected.push({
          key,
          group: targetKind,
          groupTitleAr,
          groupTitleEn,
          titleAr: isBoth ? `${groupTitleAr}: ${MUSHAF_SECTION_LABELS[key].ar}` : MUSHAF_SECTION_LABELS[key].ar,
          titleEn: MUSHAF_SECTION_LABELS[key].en,
          ...resolved,
        });
      }
      return collected;
    };

    if (isBoth) {
      return [
        ...collectSectionsForKind('reading', readingExclusions ?? exclusions),
        ...collectSectionsForKind('homework', homeworkExclusions ?? exclusions),
      ];
    }
    const singleKind = targetMode === 'reading' ? 'reading' : 'homework';
    const singleExcl = singleKind === 'reading'
      ? (readingExclusions ?? exclusions)
      : (homeworkExclusions ?? exclusions);
    return collectSectionsForKind(singleKind, singleExcl);
  }
