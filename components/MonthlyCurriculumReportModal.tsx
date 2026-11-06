import React, { useState, useMemo, useEffect } from 'react';
import { X, Copy, Check, ListFilter, Layers, MessageCircle, FileText } from 'lucide-react';
import { Student, AttendanceRecord, AttendanceStatus, TajweedLesson } from '../types';
import { MONTHS, SURAHS, SURAH_AYAH_COUNTS } from '../constants';
import ReportMonthNavigation, { useReportMonth } from './ReportMonthNavigation';

const SURAHS_EN = [
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
    'Al-Masad', 'Al-Ikhlas', 'Al-Falaq', 'An-Nas'
];

const QURAN_TAJWEED_LESSONS_MAP: Record<string, { ar: string; en: string }> = {
    'tajweed-foundation': { ar: 'النون والميم المشددتان', en: 'Stressed Noon and Meem' },
    'tajweed-nun-izhar': { ar: 'الإظهار الحلقي', en: 'Izhar Halqi' },
    'tajweed-nun-idgham': { ar: 'الإدغام', en: 'Idgham' },
    'tajweed-nun-iqlab': { ar: 'الإقلاب', en: 'Iqlab' },
    'tajweed-nun-ikhfa': { ar: 'الإخفاء الحقيقي', en: 'Ikhfa Haqiqi' },
    'tajweed-meem-ikhfa': { ar: 'الإخفاء الشفوي', en: 'Ikhfa Shafawi' },
    'tajweed-meem-idgham': { ar: 'الإدغام الشفوي (إدغام المتماثلين)', en: 'Idgham Shafawi (Idgham Al-Mutamathilain)' },
    'tajweed-meem-izhar': { ar: 'الإظهار الشفوي', en: 'Izhar Shafawi' },
};

const toWesternDigits = (str: string | number | undefined | null): string => {
    if (str === null || str === undefined) return '';
    return str.toString().replace(/[٠-٩]/g, (d) => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]);
};

const toHindiDigits = (num: number | string | undefined | null): string => {
    if (num === null || num === undefined) return '';
    return num.toString().replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
};

const getEnglishSurahName = (surahName: string): string => {
    const clean = (surahName || '').replace(/^سورة\s+/, '').trim();
    const idx = SURAHS.indexOf(clean);
    if (idx !== -1) return SURAHS_EN[idx];
    return clean;
};

const getArabicSurahName = (surahName: string): string => {
    const clean = (surahName || '').replace(/^Surah\s+/i, '').replace(/^سورة\s+/, '').trim();
    const arIdx = SURAHS.indexOf(clean);
    if (arIdx !== -1) return SURAHS[arIdx];
    const enIdx = SURAHS_EN.findIndex(s => s.toLowerCase() === clean.toLowerCase());
    if (enIdx !== -1) return SURAHS[enIdx];
    return clean;
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

const getNoorLessonTypeRange = (book: 'noor' | 'taasees', p1: number, p2: number, lang: 'ar' | 'en'): string => {
    if (isNaN(p1)) return '';
    const end = isNaN(p2) ? p1 : p2;
    const startP = Math.min(p1, end);
    const endP = Math.max(p1, end);
    const uniqueLessons: string[] = [];
    for (let i = startP; i <= endP; i++) {
        const type = getSingleLessonType(book, i, lang);
        if (type && !uniqueLessons.includes(type)) uniqueLessons.push(type);
    }
    if (uniqueLessons.length === 0) return '';
    if (uniqueLessons.length === 1) return uniqueLessons[0];
    if (book === 'taasees') {
        if (lang === 'en') {
            const combined = uniqueLessons.map(l => l.replace('The letters ', '').replace('The letter ', '')).join(' ');
            return `The letters ${combined}`;
        } else {
            const combined = uniqueLessons.map(l => l.replace('الحروف ', '').replace('الحرف ', '')).join(' ');
            return `الحروف ${combined}`;
        }
    }
    return uniqueLessons.join(' - ');
};

interface QuranEntry {
    day: number;
    mode: 'ayah' | 'page' | 'juz' | 'hizb' | 'surah' | 'raw';
    surah?: string;
    toSurah?: string;
    fromNum?: number;
    toNum?: number;
    isOpenRange?: boolean;
    rawAr?: string;
    rawEn?: string;
}

interface NoorEntry {
    day: number;
    book: 'noor' | 'taasees';
    fromPage?: number;
    toPage?: number;
    fromLine?: number;
    toLine?: number;
    rawText?: string;
}

interface TajweedEntry {
    day: number;
    titleAr: string;
    titleEn: string;
}

interface NoteEntry {
    day: number;
    text: string;
}

// Helper to parse raw text lines for fallback when draft is unavailable
function parseRawQuranLine(line: string, day: number): QuranEntry | null {
    const clean = line.trim();
    if (!clean || clean === '-') return null;
    const wLine = toWesternDigits(clean);

    // 1. Page mode: من صفحة X إلى صفحة Y / Page X / From Page X to Page Y
    const pageRangeAr = wLine.match(/من\s+صفحة\s+(\d+)\s+إلى\s+صفحة\s+(\d+)/);
    if (pageRangeAr) {
        return { day, mode: 'page', fromNum: parseInt(pageRangeAr[1]), toNum: parseInt(pageRangeAr[2]) };
    }
    const pageSingleAr = wLine.match(/^صفحة\s+(\d+)$/);
    if (pageSingleAr) {
        return { day, mode: 'page', fromNum: parseInt(pageSingleAr[1]), toNum: parseInt(pageSingleAr[1]) };
    }
    const pageRangeEn = wLine.match(/From\s+Page\s+(\d+)\s+to\s+(?:Page\s+)?(\d+)/i);
    if (pageRangeEn) {
        return { day, mode: 'page', fromNum: parseInt(pageRangeEn[1]), toNum: parseInt(pageRangeEn[2]) };
    }
    const pageSingleEn = wLine.match(/^Page\s+(\d+)$/i);
    if (pageSingleEn) {
        return { day, mode: 'page', fromNum: parseInt(pageSingleEn[1]), toNum: parseInt(pageSingleEn[1]) };
    }

    // 2. Juz mode
    const juzRangeAr = wLine.match(/من\s+الجزء\s+(\d+)\s+إلى\s+الجزء\s+(\d+)/);
    if (juzRangeAr) {
        return { day, mode: 'juz', fromNum: parseInt(juzRangeAr[1]), toNum: parseInt(juzRangeAr[2]) };
    }
    const juzSingleAr = wLine.match(/^الجزء\s+(\d+)$/);
    if (juzSingleAr) {
        return { day, mode: 'juz', fromNum: parseInt(juzSingleAr[1]), toNum: parseInt(juzSingleAr[1]) };
    }
    const juzRangeEn = wLine.match(/From\s+Juz\s+(\d+)\s+to\s+(?:Juz\s+)?(\d+)/i);
    if (juzRangeEn) {
        return { day, mode: 'juz', fromNum: parseInt(juzRangeEn[1]), toNum: parseInt(juzRangeEn[2]) };
    }
    const juzSingleEn = wLine.match(/^Juz\s+(\d+)$/i);
    if (juzSingleEn) {
        return { day, mode: 'juz', fromNum: parseInt(juzSingleEn[1]), toNum: parseInt(juzSingleEn[1]) };
    }

    // 3. Hizb mode
    const hizbRangeAr = wLine.match(/من\s+الحزب\s+(\d+)\s+إلى\s+الحزب\s+(\d+)/);
    if (hizbRangeAr) {
        return { day, mode: 'hizb', fromNum: parseInt(hizbRangeAr[1]), toNum: parseInt(hizbRangeAr[2]) };
    }
    const hizbSingleAr = wLine.match(/^الحزب\s+(\d+)$/);
    if (hizbSingleAr) {
        return { day, mode: 'hizb', fromNum: parseInt(hizbSingleAr[1]), toNum: parseInt(hizbSingleAr[1]) };
    }

    // 4. Surah range mode: من سورة X إلى سورة Y (without Ayah)
    const surahRangeAr = wLine.match(/^من\s+سورة\s+([^\d()]+?)\s+إلى\s+سورة\s+([^\d()]+)$/);
    if (surahRangeAr) {
        const s1 = getArabicSurahName(surahRangeAr[1]);
        const s2 = getArabicSurahName(surahRangeAr[2]);
        return { day, mode: 'surah', surah: s1, toSurah: s2 };
    }
    const surahRangeEn = wLine.match(/^From\s+Surah\s+([^\d()]+?)\s+to\s+(?:the\s+end\s+of\s+)?Surah\s+([^\d()]+)$/i);
    if (surahRangeEn) {
        const s1 = getArabicSurahName(surahRangeEn[1]);
        const s2 = getArabicSurahName(surahRangeEn[2]);
        return { day, mode: 'surah', surah: s1, toSurah: s2 };
    }

    // 5. Same Surah Ayah range: سورة X (من A إلى B) or سورة X (من A إلى نهايتها) or سورة X (A)
    const ayahSameAr = wLine.match(/^سورة\s+([^(]+?)\s*\(\s*من\s+(\d+)\s+إلى\s+(?:(\d+)|نهايتها)\s*\)$/);
    if (ayahSameAr) {
        const s = getArabicSurahName(ayahSameAr[1]);
        const fromA = parseInt(ayahSameAr[2]);
        const sIdx = SURAHS.indexOf(s);
        const toA = ayahSameAr[3] ? parseInt(ayahSameAr[3]) : (sIdx !== -1 ? SURAH_AYAH_COUNTS[sIdx] : undefined);
        return { day, mode: 'ayah', surah: s, toSurah: s, fromNum: fromA, toNum: toA };
    }
    const ayahSingleAr = wLine.match(/^سورة\s+([^(]+?)\s*\(\s*(\d+)\s*\)$/);
    if (ayahSingleAr) {
        const s = getArabicSurahName(ayahSingleAr[1]);
        const a = parseInt(ayahSingleAr[2]);
        return { day, mode: 'ayah', surah: s, toSurah: s, fromNum: a, toNum: a };
    }
    const surahOnlyAr = wLine.match(/^سورة\s+([^(]+)$/);
    if (surahOnlyAr) {
        const s = getArabicSurahName(surahOnlyAr[1]);
        const sIdx = SURAHS.indexOf(s);
        return { day, mode: 'ayah', surah: s, toSurah: s, fromNum: 1, toNum: sIdx !== -1 ? SURAH_AYAH_COUNTS[sIdx] : undefined };
    }

    const ayahSameEn = wLine.match(/^Surah\s+([^(]+?)\s*\(\s*From\s+(\d+)\s+to\s+(?:(\d+)|the\s+end)\s*\)$/i);
    if (ayahSameEn) {
        const s = getArabicSurahName(ayahSameEn[1]);
        const fromA = parseInt(ayahSameEn[2]);
        const sIdx = SURAHS.indexOf(s);
        const toA = ayahSameEn[3] ? parseInt(ayahSameEn[3]) : (sIdx !== -1 ? SURAH_AYAH_COUNTS[sIdx] : undefined);
        return { day, mode: 'ayah', surah: s, toSurah: s, fromNum: fromA, toNum: toA };
    }
    const ayahSingleEn = wLine.match(/^Surah\s+([^(]+?)\s*\(\s*(\d+)\s*\)$/i);
    if (ayahSingleEn) {
        const s = getArabicSurahName(ayahSingleEn[1]);
        const a = parseInt(ayahSingleEn[2]);
        return { day, mode: 'ayah', surah: s, toSurah: s, fromNum: a, toNum: a };
    }
    const surahOnlyEn = wLine.match(/^Surah\s+([^(]+)$/i);
    if (surahOnlyEn) {
        const s = getArabicSurahName(surahOnlyEn[1]);
        const sIdx = SURAHS.indexOf(s);
        return { day, mode: 'ayah', surah: s, toSurah: s, fromNum: 1, toNum: sIdx !== -1 ? SURAH_AYAH_COUNTS[sIdx] : undefined };
    }

    // 6. Advanced Cross-Surah Ayah range: من سورة X آية A إلى سورة Y آية B
    const advAr = wLine.match(/^من\s+سورة\s+(.+?)(?:\s+آية\s+(\d+))?\s+إلى\s+سورة\s+(.+?)(?:\s+آية\s+(\d+))?$/);
    if (advAr) {
        const s1 = getArabicSurahName(advAr[1]);
        const s2 = getArabicSurahName(advAr[3]);
        return {
            day,
            mode: 'ayah',
            surah: s1,
            toSurah: s2,
            fromNum: advAr[2] ? parseInt(advAr[2]) : 1,
            toNum: advAr[4] ? parseInt(advAr[4]) : undefined,
        };
    }

    const advEn = wLine.match(/^From\s+Surah\s+(.+?)(?:\s+Ayah\s+(\d+))?\s+to\s+(?:the\s+end\s+of\s+)?Surah\s+(.+?)(?:\s+Ayah\s+(\d+))?$/i);
    if (advEn) {
        const s1 = getArabicSurahName(advEn[1]);
        const s2 = getArabicSurahName(advEn[3]);
        const s2Idx = SURAHS.indexOf(s2);
        const isEndOfSurah = /to\s+the\s+end\s+of\s+Surah/i.test(wLine);
        return {
            day,
            mode: 'ayah',
            surah: s1,
            toSurah: s2,
            fromNum: advEn[2] ? parseInt(advEn[2]) : 1,
            toNum: advEn[4] ? parseInt(advEn[4]) : (isEndOfSurah && s2Idx !== -1 ? SURAH_AYAH_COUNTS[s2Idx] : undefined),
        };
    }

    return { day, mode: 'raw', rawAr: clean, rawEn: clean };
}

function formatSingleQuranEntry(entry: QuranEntry, lang: 'ar' | 'en'): string {
    if (entry.mode === 'raw') {
        return lang === 'ar' ? (entry.rawAr || '') : (entry.rawEn || '');
    }

    const fmtNum = (n?: number) => {
        if (n === undefined || isNaN(n)) return '';
        return lang === 'ar' ? toHindiDigits(n) : n.toString();
    };

    if (entry.mode === 'page') {
        const f = entry.fromNum;
        const t = entry.toNum ?? f;
        if (f === undefined) return '';
        if (lang === 'ar') {
            return f === t ? `صفحة ${fmtNum(f)}` : `من صفحة ${fmtNum(f)} إلى صفحة ${fmtNum(t)}`;
        } else {
            return f === t ? `Page ${fmtNum(f)}` : `From Page ${fmtNum(f)} to Page ${fmtNum(t)}`;
        }
    }

    if (entry.mode === 'juz') {
        const f = entry.fromNum;
        const t = entry.toNum ?? f;
        if (f === undefined) return '';
        if (lang === 'ar') {
            return f === t ? `الجزء ${fmtNum(f)}` : `من الجزء ${fmtNum(f)} إلى الجزء ${fmtNum(t)}`;
        } else {
            return f === t ? `Juz ${fmtNum(f)}` : `From Juz ${fmtNum(f)} to Juz ${fmtNum(t)}`;
        }
    }

    if (entry.mode === 'hizb') {
        const f = entry.fromNum;
        const t = entry.toNum ?? f;
        if (f === undefined) return '';
        if (lang === 'ar') {
            return f === t ? `الحزب ${fmtNum(f)}` : `من الحزب ${fmtNum(f)} إلى الحزب ${fmtNum(t)}`;
        } else {
            return f === t ? `Hizb ${fmtNum(f)}` : `From Hizb ${fmtNum(f)} to Hizb ${fmtNum(t)}`;
        }
    }

    if (entry.mode === 'surah') {
        const s1Ar = getArabicSurahName(entry.surah || '');
        const s2Ar = getArabicSurahName(entry.toSurah || s1Ar);
        const s1 = lang === 'ar' ? s1Ar : getEnglishSurahName(s1Ar);
        const s2 = lang === 'ar' ? s2Ar : getEnglishSurahName(s2Ar);
        if (!s1) return '';
        if (lang === 'ar') {
            return s1 === s2 ? `سورة ${s1}` : `من سورة ${s1} إلى سورة ${s2}`;
        } else {
            return s1 === s2 ? `Surah ${s1}` : `From Surah ${s1} to Surah ${s2}`;
        }
    }

    if (entry.mode === 'ayah') {
        const s1Ar = getArabicSurahName(entry.surah || '');
        const s2Ar = getArabicSurahName(entry.toSurah || s1Ar);
        const s1 = lang === 'ar' ? s1Ar : getEnglishSurahName(s1Ar);
        const s2 = lang === 'ar' ? s2Ar : getEnglishSurahName(s2Ar);
        const f = entry.fromNum;
        const t = entry.toNum;
        const s1Idx = SURAHS.indexOf(s1Ar);
        const s2Idx = SURAHS.indexOf(s2Ar);
        const maxAyahS1 = s1Idx !== -1 ? SURAH_AYAH_COUNTS[s1Idx] : -1;
        const maxAyahS2 = s2Idx !== -1 ? SURAH_AYAH_COUNTS[s2Idx] : -1;

        if (s1Ar === s2Ar) {
            if (!f && !t) {
                return lang === 'ar' ? `سورة ${s1}` : `Surah ${s1}`;
            }
            if (f === 1 && t !== undefined && t === maxAyahS1) {
                return lang === 'ar' ? `سورة ${s1} كاملة (من ١ إلى ${fmtNum(t)})` : `Surah ${s1} (Complete: 1 to ${fmtNum(t)})`;
            }
            if (t === undefined || f === t) {
                if (entry.isOpenRange) {
                    return lang === 'ar' ? `سورة ${s1} (من ${fmtNum(f)} لـ...)` : `Surah ${s1} (From ${fmtNum(f)} to...)`;
                }
                return lang === 'ar' ? `سورة ${s1} (الآية ${fmtNum(f)})` : `Surah ${s1} (Ayah ${fmtNum(f)})`;
            }
            const isEnd = t === maxAyahS1;
            if (lang === 'ar') {
                return isEnd
                    ? `سورة ${s1} (من الآية ${fmtNum(f)} إلى نهايتها - آية ${fmtNum(t)})`
                    : `سورة ${s1} (من الآية ${fmtNum(f)} إلى الآية ${fmtNum(t)})`;
            } else {
                return isEnd
                    ? `Surah ${s1} (From Ayah ${fmtNum(f)} to the end - Ayah ${fmtNum(t)})`
                    : `Surah ${s1} (From Ayah ${fmtNum(f)} to Ayah ${fmtNum(t)})`;
            }
        } else {
            // Cross-surah
            if (lang === 'ar') {
                const p1 = f ? `من سورة ${s1} (آية ${fmtNum(f)})` : `من سورة ${s1}`;
                const isEnd = t !== undefined && t === maxAyahS2;
                const p2 = t ? (isEnd ? `إلى نهاية سورة ${s2}` : `إلى سورة ${s2} (آية ${fmtNum(t)})`) : `إلى سورة ${s2}`;
                return `${p1} ${p2}`;
            } else {
                const p1 = f ? `From Surah ${s1} (Ayah ${fmtNum(f)})` : `From Surah ${s1}`;
                const isEnd = t !== undefined && t === maxAyahS2;
                const p2 = t ? (isEnd ? `to the end of Surah ${s2}` : `to Surah ${s2} (Ayah ${fmtNum(t)})`) : `to Surah ${s2}`;
                return `${p1} ${p2}`;
            }
        }
    }

    return '';
}

// Smart Merger for Quran Entries across the entire month
function mergeMonthlyQuranEntries(entries: QuranEntry[], lang: 'ar' | 'en'): string[] {
    if (entries.length === 0) return [];

    // Group contiguous or same-type entries smartly
    const merged: QuranEntry[] = [];

    for (const curr of entries) {
        const clone: QuranEntry = { ...curr };
        if (merged.length === 0) {
            merged.push(clone);
            continue;
        }

        const prev = merged[merged.length - 1];

        // Case 1: Both are 'page', 'juz', or 'hizb'
        if ((clone.mode === 'page' || clone.mode === 'juz' || clone.mode === 'hizb') && prev.mode === clone.mode) {
            if (prev.fromNum !== undefined && clone.fromNum !== undefined) {
                const prevStart = Math.min(prev.fromNum, prev.toNum ?? prev.fromNum);
                const prevEnd = Math.max(prev.fromNum, prev.toNum ?? prev.fromNum);
                const currStart = Math.min(clone.fromNum, clone.toNum ?? clone.fromNum);
                const currEnd = Math.max(clone.fromNum, clone.toNum ?? clone.fromNum);

                // Merge if contiguous, overlapping, or sequential in the month
                prev.fromNum = Math.min(prevStart, currStart);
                prev.toNum = Math.max(prevEnd, currEnd);
                continue;
            }
        }

        // Case 2: Both are 'surah' mode
        if (clone.mode === 'surah' && prev.mode === 'surah' && prev.surah && clone.surah) {
            prev.toSurah = clone.toSurah || clone.surah;
            continue;
        }

        // Case 3: Both are 'ayah' mode
        if (clone.mode === 'ayah' && prev.mode === 'ayah') {
            const prevS1 = getArabicSurahName(prev.surah || '');
            const prevS2 = getArabicSurahName(prev.toSurah || prevS1);
            const currS1 = getArabicSurahName(clone.surah || '');
            const currS2 = getArabicSurahName(clone.toSurah || currS1);

            // If same surah! Merge from min ayah to max ayah covered in that surah
            if (prevS1 === prevS2 && currS1 === currS2 && prevS1 === currS1) {
                const pStart = prev.fromNum ?? 1;
                const pEnd = prev.toNum ?? pStart;
                const cStart = clone.fromNum ?? 1;
                const cEnd = clone.toNum ?? cStart;
                prev.fromNum = Math.min(pStart, cStart);
                prev.toNum = Math.max(pEnd, cEnd);
                prev.isOpenRange = false;
                continue;
            }

            // If previous ended at Surah X and current started at Surah X, and it's a cross-surah progression
            if (prevS2 === currS1 && prevS1 !== currS2) {
                prev.toSurah = currS2;
                prev.toNum = clone.toNum;
                continue;
            }
        }

        // Case 4: Identical raw text
        if (clone.mode === 'raw' && prev.mode === 'raw' && prev.rawAr === clone.rawAr) {
            continue;
        }

        merged.push(clone);
    }

    // Second pass: if the same single surah appears in non-adjacent sessions (e.g. Surah Al-Baqara on Day 1, then Day 10),
    // combine ranges for the same single surah so each surah appears cleanly once with its full span!
    const finalMerged: QuranEntry[] = [];
    for (const item of merged) {
        if (item.mode === 'ayah') {
            const s1 = getArabicSurahName(item.surah || '');
            const s2 = getArabicSurahName(item.toSurah || s1);
            if (s1 && s1 === s2) {
                const existing = finalMerged.find(
                    e => e.mode === 'ayah' && getArabicSurahName(e.surah || '') === s1 && getArabicSurahName(e.toSurah || s1) === s1
                );
                if (existing) {
                    const eStart = existing.fromNum ?? 1;
                    const eEnd = existing.toNum ?? eStart;
                    const iStart = item.fromNum ?? 1;
                    const iEnd = item.toNum ?? iStart;
                    existing.fromNum = Math.min(eStart, iStart);
                    existing.toNum = Math.max(eEnd, iEnd);
                    continue;
                }
            }
        }
        finalMerged.push(item);
    }

    return finalMerged.map(e => formatSingleQuranEntry(e, lang)).filter(Boolean);
}

function mergeMonthlyNoorEntries(entries: NoorEntry[], lang: 'ar' | 'en'): string[] {
    if (entries.length === 0) return [];
    const results: string[] = [];

    // Group by book ('noor' vs 'taasees')
    const byBook: Record<'noor' | 'taasees', NoorEntry[]> = { noor: [], taasees: [] };
    for (const e of entries) {
        byBook[e.book || 'noor'].push(e);
    }

    for (const book of ['noor', 'taasees'] as const) {
        const list = byBook[book];
        if (list.length === 0) continue;

        const bookLabel = book === 'taasees'
            ? (lang === 'ar' ? 'كتاب التأسيس' : 'Foundation Book')
            : (lang === 'ar' ? 'نور البيان' : 'Noor Al-Bayan');

        const numericEntries = list.filter(e => e.fromPage !== undefined && !isNaN(e.fromPage));
        if (numericEntries.length > 0) {
            const first = numericEntries[0];
            const last = numericEntries[numericEntries.length - 1];
            const allPages = numericEntries.flatMap(e => [e.fromPage!, e.toPage ?? e.fromPage!]);
            const minPage = Math.min(...allPages);
            const maxPage = Math.max(...allPages);

            const fmtNum = (n: number) => lang === 'ar' ? toHindiDigits(n) : n.toString();
            let rangeText = '';
            if (minPage === maxPage) {
                rangeText = lang === 'ar' ? `صفحة ${fmtNum(minPage)}` : `Page ${fmtNum(minPage)}`;
            } else {
                rangeText = lang === 'ar'
                    ? `من صفحة ${fmtNum(minPage)} إلى صفحة ${fmtNum(maxPage)}`
                    : `From Page ${fmtNum(minPage)} to Page ${fmtNum(maxPage)}`;
            }

            // Include starting line and ending line if available on first/last
            const startLine = first.fromLine;
            const endLine = last.toLine || last.fromLine;
            if (minPage === maxPage && startLine) {
                if (endLine && endLine !== startLine) {
                    rangeText += lang === 'ar'
                        ? ` (من سطر ${fmtNum(startLine)} إلى سطر ${fmtNum(endLine)})`
                        : ` (From Line ${fmtNum(startLine)} to Line ${fmtNum(endLine)})`;
                } else {
                    rangeText += lang === 'ar' ? ` (سطر ${fmtNum(startLine)})` : ` (Line ${fmtNum(startLine)})`;
                }
            }

            const lessons = getNoorLessonTypeRange(book, minPage, maxPage, lang);
            if (lessons) {
                rangeText += lang === 'ar' ? ` ← ( ${lessons} )` : ` → ( ${lessons} )`;
            }

            results.push(`${bookLabel}: ${rangeText}`);
        } else {
            // Fallback to unique raw text
            const rawSet = Array.from(new Set(list.map(e => e.rawText).filter(Boolean)));
            if (rawSet.length > 0) {
                results.push(`${bookLabel}: ${rawSet.join(' ، ')}`);
            }
        }
    }

    return results;
}

function extractReadingFromDraftSub(sub: any, day: number): QuranEntry | null {
    if (!sub) return null;
    const mode = sub.mode || 'ayah';
    const parseNum = (v: any): number | undefined => {
        if (v === undefined || v === null || v === '') return undefined;
        const w = toWesternDigits(v).trim();
        if (!w) return undefined;
        const n = parseInt(w, 10);
        return isNaN(n) ? undefined : n;
    };

    if (mode === 'page') {
        const f = parseNum(sub.fromPage);
        const t = parseNum(sub.toPage);
        if (f === undefined && t === undefined) return null;
        return { day, mode: 'page', fromNum: f ?? t, toNum: (t === 0 ? f : t) ?? f };
    }
    if (mode === 'juz') {
        const f = parseNum(sub.fromJuz);
        const t = parseNum(sub.toJuz);
        if (f === undefined && t === undefined) return null;
        return { day, mode: 'juz', fromNum: f ?? t, toNum: (t === 0 ? f : t) ?? f };
    }
    if (mode === 'hizb') {
        const f = parseNum(sub.fromHizb);
        const t = parseNum(sub.toHizb);
        if (f === undefined && t === undefined) return null;
        return { day, mode: 'hizb', fromNum: f ?? t, toNum: (t === 0 ? f : t) ?? f };
    }
    if (mode === 'surah') {
        const s1 = getArabicSurahName(sub.fromSurah || sub.surah || '');
        const s2 = getArabicSurahName(sub.toSurah || s1);
        if (!s1) return null;
        return { day, mode: 'surah', surah: s1, toSurah: s2 };
    }

    // Ayah mode
    const s1 = getArabicSurahName(sub.surah || '');
    const s2 = sub.isAdvancedAyah ? getArabicSurahName(sub.toSurah || s1) : s1;
    if (!s1) return null;
    const f = parseNum(sub.fromAyah);
    const rawTo = toWesternDigits(sub.toAyah).trim();
    const isOpen = rawTo === '0';
    const t = isOpen ? undefined : parseNum(sub.toAyah);

    return {
        day,
        mode: 'ayah',
        surah: s1,
        toSurah: s2 || s1,
        fromNum: f,
        toNum: t,
        isOpenRange: isOpen,
    };
}

function parseSavedReportRawText(reportText: string, day: number) {
    const result: {
        readingNew?: QuranEntry;
        readingRev?: QuranEntry;
        readingOldRev?: QuranEntry;
        readingTilawa?: QuranEntry;
        noor?: NoorEntry;
        tajweed?: TajweedEntry;
        note?: string;
    } = {};

    if (!reportText) return result;

    // Extract Notes first
    const notesMatch = reportText.match(/(?:✏️\s*\*?(?:ملاحظات|Notes):?\*?\s*\n)([\s\S]*?)(?:\n(?:🎧|ــــ|\*ــــ)|$)/i);
    if (notesMatch && notesMatch[1]?.trim()) {
        result.note = notesMatch[1].trim();
    }

    // Check if standalone Tajweed report
    if (/🎚️\s*\*?(?:التجويد|Tajweed)/i.test(reportText)) {
        const lessonMatch = reportText.match(/(?:الدرس|Lesson):\s*(.+)/i);
        const topicMatch = reportText.match(/(?:الموضوع|Topic):\s*(.+)/i);
        const title = [lessonMatch?.[1]?.trim(), topicMatch?.[1]?.trim()].filter(Boolean).join(' - ');
        if (title) {
            result.tajweed = { day, titleAr: title, titleEn: title };
        }
    }

    // Check if Noor report or has Noor section
    const isFoundation = /كتاب التأسيس|Foundation Book/i.test(reportText);
    const isNoorBook = /نور البيان|Noor El-Bayan|Noor Al-Bayan/i.test(reportText);

    // Isolate Session Summary (إنجاز الحصة) before Next Session Plan (حصتنا القادمة / Next Session)
    const summaryPart = reportText.split(/📝|(?:\*•\s*(?:حصتنا القادمة|Next Session Plan))/i)[0] || reportText;

    // Parse bullet sections inside summaryPart
    const newMatch = summaryPart.match(/\*•\s*(?:الجديد|New):?\*\s*\n([^\n*]+)/i);
    if (newMatch && newMatch[1]?.trim()) {
        const parsed = parseRawQuranLine(newMatch[1].trim(), day);
        if (parsed) result.readingNew = parsed;
    }

    const revMatch = summaryPart.match(/\*•\s*(?:المراجعة|Revision):?\*\s*\n([^\n*]+)/i);
    if (revMatch && revMatch[1]?.trim()) {
        const parsed = parseRawQuranLine(revMatch[1].trim(), day);
        if (parsed) result.readingRev = parsed;
    }

    const oldRevMatch = summaryPart.match(/\*•\s*(?:المراجعة البعيدة|Old Revision):?\*\s*\n([^\n*]+)/i);
    if (oldRevMatch && oldRevMatch[1]?.trim()) {
        const parsed = parseRawQuranLine(oldRevMatch[1].trim(), day);
        if (parsed) result.readingOldRev = parsed;
    }

    const tilawaMatch = summaryPart.match(/\*•\s*(?:القراءة|Reading):?\*\s*\n([^\n*]+)/i);
    if (tilawaMatch && tilawaMatch[1]?.trim()) {
        const parsed = parseRawQuranLine(tilawaMatch[1].trim(), day);
        if (parsed) result.readingTilawa = parsed;
    }

    const tajweedMatch = summaryPart.match(/\*•\s*(?:التجويد|Tajweed):?\*\s*\n([^\n*]+)/i);
    if (tajweedMatch && tajweedMatch[1]?.trim()) {
        const tText = tajweedMatch[1].trim();
        result.tajweed = { day, titleAr: tText, titleEn: tText };
    }

    // Noor summary extraction
    if (isFoundation || isNoorBook) {
        const book: 'noor' | 'taasees' = isFoundation ? 'taasees' : 'noor';
        let noorLine = '';
        const standaloneNoorMatch = summaryPart.match(/\*•\s*(?:إنجاز الحصة|Session Summary):?\*\s*\n([^\n*]+)/i);
        const mergedNoorMatch = summaryPart.match(/📚\s*\*\(\s*(?:Foundation Book|Noor El-Bayan Book|كتاب التأسيس|نور البيان)\s*\)\*\s*-----\s*\n+([^\n*]+)/i);
        if (standaloneNoorMatch && standaloneNoorMatch[1]?.trim()) {
            noorLine = standaloneNoorMatch[1].trim();
        } else if (mergedNoorMatch && mergedNoorMatch[1]?.trim()) {
            noorLine = mergedNoorMatch[1].trim();
        }
        if (noorLine && noorLine !== '-') {
            const wNoor = toWesternDigits(noorLine);
            const pRange = wNoor.match(/(?:من\s+صفحة|From\s+Page)\s+(\d+)\s+(?:إلى\s+صفحة|to\s+Page)\s+(\d+)/i);
            const pSingle = wNoor.match(/(?:^صفحة|^Page)\s+(\d+)/i);
            if (pRange) {
                result.noor = { day, book, fromPage: parseInt(pRange[1]), toPage: parseInt(pRange[2]), rawText: noorLine };
            } else if (pSingle) {
                result.noor = { day, book, fromPage: parseInt(pSingle[1]), toPage: parseInt(pSingle[1]), rawText: noorLine };
            } else {
                result.noor = { day, book, rawText: noorLine };
            }
        }
    }

    return result;
}

export interface MonthlyReportData {
    reportDays: number[];
    attendedSessionsCount: number;
    readingNew: QuranEntry[];
    readingRev: QuranEntry[];
    readingOldRev: QuranEntry[];
    readingTilawa: QuranEntry[];
    tajweed: TajweedEntry[];
    noor: NoorEntry[];
    notes: NoteEntry[];
}

export function collectMonthlyReportData(
    student: Student,
    month: number,
    year: number,
    savedReports: Record<string, string>,
    savedReportDrafts: Record<string, any>,
    attendance: AttendanceRecord,
    tajweedBank: TajweedLesson[]
): MonthlyReportData {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const data: MonthlyReportData = {
        reportDays: [],
        attendedSessionsCount: 0,
        readingNew: [],
        readingRev: [],
        readingOldRev: [],
        readingTilawa: [],
        tajweed: [],
        noor: [],
        notes: [],
    };

    const resolveTajweedTitle = (lessonId: string, fallbackTitle?: string): { ar: string; en: string } => {
        if (QURAN_TAJWEED_LESSONS_MAP[lessonId]) {
            return QURAN_TAJWEED_LESSONS_MAP[lessonId];
        }
        const fromBank = tajweedBank.find(l => l.id === lessonId);
        if (fromBank) {
            return { ar: fromBank.title, en: fromBank.title };
        }
        const fb = fallbackTitle || lessonId || '';
        return { ar: fb, en: fb };
    };

    for (let d = 1; d <= daysInMonth; d++) {
        const key = `${student.id}_${d}_${month}_${year}`;
        const status = attendance[key];
        if (status === AttendanceStatus.PRESENT) data.attendedSessionsCount += 1;
        else if (status === AttendanceStatus.DOUBLE_CLASS) data.attendedSessionsCount += 2;

        const rawReport = savedReports[key];
        const draft = savedReportDrafts[key];

        if (!rawReport && !draft) continue;
        data.reportDays.push(d);

        const parsedRaw = rawReport ? parseSavedReportRawText(rawReport, d) : {};

        if (draft) {
            const activeSection = draft.activeSection || 'quran';
            const mergeWithQuran = !!draft.mergeWithQuran;
            const toggles = draft.sectionToggles || {
                readingNew: true,
                readingRev: true,
                readingOldRev: false,
                readingTilawa: false,
                quranTajweed: false,
            };

            if (activeSection === 'tajweed') {
                if (draft.tajweed?.lessonTitle || draft.tajweed?.topic) {
                    const tTitle = [draft.tajweed.lessonTitle, draft.tajweed.topic].filter(Boolean).join(' - ');
                    data.tajweed.push({ day: d, titleAr: tTitle, titleEn: tTitle });
                } else if (parsedRaw.tajweed) {
                    data.tajweed.push(parsedRaw.tajweed);
                }
            } else if (activeSection === 'noor' && !mergeWithQuran) {
                if (!draft.excludeNoorTam && draft.noor?.tam) {
                    const tam = draft.noor.tam;
                    const fp = parseInt(toWesternDigits(tam.fromPage));
                    const tp = parseInt(toWesternDigits(tam.toPage));
                    const fl = parseInt(toWesternDigits(tam.fromLine));
                    const tl = parseInt(toWesternDigits(tam.toLine));
                    if (!isNaN(fp) || !isNaN(tp)) {
                        data.noor.push({
                            day: d,
                            book: draft.noor.book || 'noor',
                            fromPage: !isNaN(fp) ? fp : tp,
                            toPage: !isNaN(tp) && tp !== 0 ? tp : (!isNaN(fp) ? fp : undefined),
                            fromLine: !isNaN(fl) ? fl : undefined,
                            toLine: !isNaN(tl) && tl !== 0 ? tl : undefined,
                        });
                    } else if (parsedRaw.noor) {
                        data.noor.push(parsedRaw.noor);
                    }
                } else if (parsedRaw.noor) {
                    data.noor.push(parsedRaw.noor);
                }
            } else {
                // Quran or Merged
                if (toggles.readingNew && !draft.excludeReadingNew) {
                    const entry = parsedRaw.readingNew || extractReadingFromDraftSub(draft.readingNew, d);
                    if (entry) data.readingNew.push(entry);
                }
                if (toggles.readingRev && !draft.excludeReadingRev) {
                    const entry = parsedRaw.readingRev || extractReadingFromDraftSub(draft.readingRev, d);
                    if (entry) data.readingRev.push(entry);
                }
                if (toggles.readingOldRev && !draft.excludeReadingOldRev) {
                    const entry = parsedRaw.readingOldRev || extractReadingFromDraftSub(draft.readingOldRev, d);
                    if (entry) data.readingOldRev.push(entry);
                }
                if (toggles.readingTilawa && !draft.excludeReadingTilawa) {
                    const entry = parsedRaw.readingTilawa || extractReadingFromDraftSub(draft.readingTilawa, d);
                    if (entry) data.readingTilawa.push(entry);
                }
                if (toggles.quranTajweed && !draft.excludeQuranTajweed && draft.quranTajweed?.currentLessonId) {
                    const resolved = resolveTajweedTitle(draft.quranTajweed.currentLessonId);
                    if (resolved.ar) {
                        data.tajweed.push({ day: d, titleAr: resolved.ar, titleEn: resolved.en });
                    }
                } else if (parsedRaw.tajweed) {
                    data.tajweed.push(parsedRaw.tajweed);
                }

                if (mergeWithQuran && !draft.excludeNoorTam && draft.noor?.tam) {
                    const tam = draft.noor.tam;
                    const fp = parseInt(toWesternDigits(tam.fromPage));
                    const tp = parseInt(toWesternDigits(tam.toPage));
                    const fl = parseInt(toWesternDigits(tam.fromLine));
                    const tl = parseInt(toWesternDigits(tam.toLine));
                    if (!isNaN(fp) || !isNaN(tp)) {
                        data.noor.push({
                            day: d,
                            book: draft.noor.book || 'noor',
                            fromPage: !isNaN(fp) ? fp : tp,
                            toPage: !isNaN(tp) && tp !== 0 ? tp : (!isNaN(fp) ? fp : undefined),
                            fromLine: !isNaN(fl) ? fl : undefined,
                            toLine: !isNaN(tl) && tl !== 0 ? tl : undefined,
                        });
                    } else if (parsedRaw.noor) {
                        data.noor.push(parsedRaw.noor);
                    }
                }
            }

            const noteStr = (draft.customNotes || parsedRaw.note || '').trim();
            if (noteStr) {
                data.notes.push({ day: d, text: noteStr });
            }
        } else {
            // Fallback to parsedRaw only
            if (parsedRaw.readingNew) data.readingNew.push(parsedRaw.readingNew);
            if (parsedRaw.readingRev) data.readingRev.push(parsedRaw.readingRev);
            if (parsedRaw.readingOldRev) data.readingOldRev.push(parsedRaw.readingOldRev);
            if (parsedRaw.readingTilawa) data.readingTilawa.push(parsedRaw.readingTilawa);
            if (parsedRaw.tajweed) data.tajweed.push(parsedRaw.tajweed);
            if (parsedRaw.noor) data.noor.push(parsedRaw.noor);
            if (parsedRaw.note) data.notes.push({ day: d, text: parsedRaw.note });
        }
    }

    return data;
}

export interface MonthlyReportFormatOptions {
    lang: 'ar' | 'en';
    style: 'merged' | 'detailed';
    includeHeader: boolean;
    includeStats: boolean;
    includeNew: boolean;
    includeRev: boolean;
    includeOldRev: boolean;
    includeTilawa: boolean;
    includeTajweed: boolean;
    includeNoor: boolean;
    includeNotes: boolean;
}

export function buildMonthlyCurriculumReportText(
    student: Student,
    month: number,
    year: number,
    data: MonthlyReportData,
    options: MonthlyReportFormatOptions
): string {
    const isEn = options.lang === 'en';
    const monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthLabel = isEn
        ? `${monthsEn[month]} ${year}`
        : `${MONTHS[month]} ${toHindiDigits(year)}`;

    const fmtDay = (d: number) => isEn ? `Day ${d}/${month + 1}` : `يوم ${toHindiDigits(d)}/${toHindiDigits(month + 1)}`;
    const sessionsCount = Math.max(data.attendedSessionsCount, data.reportDays.length);

    const lines: string[] = [];

    if (options.includeHeader) {
        if (isEn) {
            lines.push(`📊 *Monthly Progress Report*`);
            lines.push('');
            lines.push(`👤 *Student:* ${student.name}`);
            lines.push(`🗓️ *Month:* ${monthLabel}`);
            if (options.includeStats && sessionsCount > 0) {
                lines.push(`📚 *Completed Sessions:* ${sessionsCount} ${sessionsCount === 1 ? 'Session' : 'Sessions'}`);
            }
            lines.push('');
            lines.push('*ــــــــــــــــــــــــــــــــــــــ*');
        } else {
            lines.push(`📊 *التقرير الشهري الشامل*`);
            lines.push('');
            lines.push(`👤 *الطالب:* ${student.name}`);
            lines.push(`🗓️ *الشهر:* ${monthLabel}`);
            if (options.includeStats && sessionsCount > 0) {
                const sessionWord = sessionsCount === 1 ? 'حصة' : sessionsCount === 2 ? 'حصتان' : sessionsCount >= 3 && sessionsCount <= 10 ? 'حصص' : 'حصة';
                lines.push(`📚 *إجمالي الحصص المنجزة:* ${toHindiDigits(sessionsCount)} ${sessionWord}`);
            }
            lines.push('');
            lines.push('*ــــــــــــــــــــــــــــــــــــــ*');
        }
    }

    const hasQuranSection =
        (options.includeNew && data.readingNew.length > 0) ||
        (options.includeRev && data.readingRev.length > 0) ||
        (options.includeOldRev && data.readingOldRev.length > 0) ||
        (options.includeTilawa && data.readingTilawa.length > 0);

    if (hasQuranSection) {
        lines.push('');
        lines.push(isEn ? `📖 *First: The Noble Quran:*` : `📖 *أولاً: جانب القرآن الكريم:*`);

        // 1. New Memorization
        if (options.includeNew && data.readingNew.length > 0) {
            lines.push('');
            lines.push(isEn ? `*• New Memorization:*` : `*• الحفظ الجديد:*`);
            if (options.style === 'merged') {
                const mergedLines = mergeMonthlyQuranEntries(data.readingNew, options.lang);
                mergedLines.forEach(l => lines.push(mergedLines.length > 1 ? `- ${l}` : l));
            } else {
                data.readingNew.forEach(e => {
                    const txt = formatSingleQuranEntry(e, options.lang);
                    if (txt) lines.push(`- (${fmtDay(e.day)}): ${txt}`);
                });
            }
        }

        // 2. Near Revision
        if (options.includeRev && data.readingRev.length > 0) {
            lines.push('');
            lines.push(isEn ? `*• Revision:*` : `*• المراجعة القريبة:*`);
            if (options.style === 'merged') {
                const mergedLines = mergeMonthlyQuranEntries(data.readingRev, options.lang);
                mergedLines.forEach(l => lines.push(mergedLines.length > 1 ? `- ${l}` : l));
            } else {
                data.readingRev.forEach(e => {
                    const txt = formatSingleQuranEntry(e, options.lang);
                    if (txt) lines.push(`- (${fmtDay(e.day)}): ${txt}`);
                });
            }
        }

        // 3. Old Revision
        if (options.includeOldRev && data.readingOldRev.length > 0) {
            lines.push('');
            lines.push(isEn ? `*• Old Revision:*` : `*• المراجعة البعيدة:*`);
            if (options.style === 'merged') {
                const mergedLines = mergeMonthlyQuranEntries(data.readingOldRev, options.lang);
                mergedLines.forEach(l => lines.push(mergedLines.length > 1 ? `- ${l}` : l));
            } else {
                data.readingOldRev.forEach(e => {
                    const txt = formatSingleQuranEntry(e, options.lang);
                    if (txt) lines.push(`- (${fmtDay(e.day)}): ${txt}`);
                });
            }
        }

        // 4. Reading / Tilawa
        if (options.includeTilawa && data.readingTilawa.length > 0) {
            lines.push('');
            lines.push(isEn ? `*• Reading (Tilawa):*` : `*• التلاوة والقراءة:*`);
            if (options.style === 'merged') {
                const mergedLines = mergeMonthlyQuranEntries(data.readingTilawa, options.lang);
                mergedLines.forEach(l => lines.push(mergedLines.length > 1 ? `- ${l}` : l));
            } else {
                data.readingTilawa.forEach(e => {
                    const txt = formatSingleQuranEntry(e, options.lang);
                    if (txt) lines.push(`- (${fmtDay(e.day)}): ${txt}`);
                });
            }
        }
    }

    // Tajweed Section
    if (options.includeTajweed && data.tajweed.length > 0) {
        lines.push('');
        if (hasQuranSection) lines.push('*ــــــــــــــــــــــــــــــــــــــ*');
        lines.push('');
        lines.push(isEn ? `🎚️ *Tajweed Rules:*` : `🎚️ *جانب التجويد:*`);
        if (options.style === 'merged') {
            const uniqueTitles = Array.from(
                new Set(data.tajweed.map(t => (isEn ? t.titleEn : t.titleAr).trim()).filter(Boolean))
            );
            uniqueTitles.forEach(t => {
                lines.push(uniqueTitles.length > 1 ? `- ${t}` : t);
            });
        } else {
            data.tajweed.forEach(t => {
                const title = isEn ? t.titleEn : t.titleAr;
                if (title) lines.push(`- (${fmtDay(t.day)}): ${title}`);
            });
        }
    }

    // Noor / Foundation Section
    if (options.includeNoor && data.noor.length > 0) {
        lines.push('');
        if (hasQuranSection || (options.includeTajweed && data.tajweed.length > 0)) {
            lines.push('*ــــــــــــــــــــــــــــــــــــــ*');
        }
        lines.push('');
        lines.push(isEn ? `📚 *Reading Foundation (Noor Al-Bayan):*` : `📚 *جانب القرائية والتأسيس:*`);
        if (options.style === 'merged') {
            const mergedNoor = mergeMonthlyNoorEntries(data.noor, options.lang);
            mergedNoor.forEach(l => lines.push(mergedNoor.length > 1 ? `- ${l}` : l));
        } else {
            data.noor.forEach(e => {
                const singleMerged = mergeMonthlyNoorEntries([e], options.lang);
                if (singleMerged[0]) {
                    lines.push(`- (${fmtDay(e.day)}): ${singleMerged[0]}`);
                }
            });
        }
    }

    // Notes Section
    if (options.includeNotes && data.notes.length > 0) {
        lines.push('');
        lines.push('*ــــــــــــــــــــــــــــــــــــــ*');
        lines.push('');
        lines.push(isEn ? `✏️ *Teacher's Notes:*` : `✏️ *ملاحظات وتوجيهات الشهر:*`);
        if (options.style === 'merged') {
            const uniqueNotes = Array.from(new Set(data.notes.map(n => n.text.trim()).filter(Boolean)));
            uniqueNotes.forEach(n => {
                lines.push(uniqueNotes.length > 1 ? `- ${n}` : n);
            });
        } else {
            data.notes.forEach(n => {
                lines.push(`- (${fmtDay(n.day)}): ${n.text}`);
            });
        }
    }

    return lines.join('\n').trim();
}

export interface MonthlySectionBlock {
    id: string;
    title: string;
    icon: string;
    accentColor: string;
    bgLight: string;
    borderLight: string;
    subSections: {
        label?: string;
        items: string[];
    }[];
}

export function buildMonthlyStructuredBlocks(
    month: number,
    data: MonthlyReportData,
    options: MonthlyReportFormatOptions
): MonthlySectionBlock[] {
    const isEn = options.lang === 'en';
    const fmtDay = (d: number) => isEn ? `Day ${d}/${month + 1}` : `يوم ${toHindiDigits(d)}/${toHindiDigits(month + 1)}`;
    const blocks: MonthlySectionBlock[] = [];

    const quranSubs: { label?: string; items: string[] }[] = [];

    if (options.includeNew && data.readingNew.length > 0) {
        const items = options.style === 'merged'
            ? mergeMonthlyQuranEntries(data.readingNew, options.lang)
            : data.readingNew.map(e => {
                const txt = formatSingleQuranEntry(e, options.lang);
                return txt ? `(${fmtDay(e.day)}): ${txt}` : '';
            }).filter(Boolean);
        if (items.length > 0) {
            quranSubs.push({ label: isEn ? 'New Memorization' : 'الحفظ الجديد', items });
        }
    }

    if (options.includeRev && data.readingRev.length > 0) {
        const items = options.style === 'merged'
            ? mergeMonthlyQuranEntries(data.readingRev, options.lang)
            : data.readingRev.map(e => {
                const txt = formatSingleQuranEntry(e, options.lang);
                return txt ? `(${fmtDay(e.day)}): ${txt}` : '';
            }).filter(Boolean);
        if (items.length > 0) {
            quranSubs.push({ label: isEn ? 'Near Revision' : 'المراجعة القريبة', items });
        }
    }

    if (options.includeOldRev && data.readingOldRev.length > 0) {
        const items = options.style === 'merged'
            ? mergeMonthlyQuranEntries(data.readingOldRev, options.lang)
            : data.readingOldRev.map(e => {
                const txt = formatSingleQuranEntry(e, options.lang);
                return txt ? `(${fmtDay(e.day)}): ${txt}` : '';
            }).filter(Boolean);
        if (items.length > 0) {
            quranSubs.push({ label: isEn ? 'Old Revision' : 'المراجعة البعيدة', items });
        }
    }

    if (options.includeTilawa && data.readingTilawa.length > 0) {
        const items = options.style === 'merged'
            ? mergeMonthlyQuranEntries(data.readingTilawa, options.lang)
            : data.readingTilawa.map(e => {
                const txt = formatSingleQuranEntry(e, options.lang);
                return txt ? `(${fmtDay(e.day)}): ${txt}` : '';
            }).filter(Boolean);
        if (items.length > 0) {
            quranSubs.push({ label: isEn ? 'Reading (Tilawa)' : 'التلاوة والقراءة', items });
        }
    }

    if (quranSubs.length > 0) {
        blocks.push({
            id: 'quran',
            title: isEn ? 'The Noble Quran' : 'جانب القرآن الكريم',
            icon: '📖',
            accentColor: '#059669',
            bgLight: '#ecfdf5',
            borderLight: '#a7f3d0',
            subSections: quranSubs,
        });
    }

    if (options.includeTajweed && data.tajweed.length > 0) {
        const items = options.style === 'merged'
            ? Array.from(new Set(data.tajweed.map(t => (isEn ? t.titleEn : t.titleAr).trim()).filter(Boolean)))
            : data.tajweed.map(t => {
                const title = isEn ? t.titleEn : t.titleAr;
                return title ? `(${fmtDay(t.day)}): ${title}` : '';
            }).filter(Boolean);
        if (items.length > 0) {
            blocks.push({
                id: 'tajweed',
                title: isEn ? 'Tajweed Rules' : 'جانب التجويد',
                icon: '🎚️',
                accentColor: '#0284c7',
                bgLight: '#f0f9ff',
                borderLight: '#bae6fd',
                subSections: [{ items }],
            });
        }
    }

    if (options.includeNoor && data.noor.length > 0) {
        const items = options.style === 'merged'
            ? mergeMonthlyNoorEntries(data.noor, options.lang)
            : data.noor.map(e => {
                const single = mergeMonthlyNoorEntries([e], options.lang)[0];
                return single ? `(${fmtDay(e.day)}): ${single}` : '';
            }).filter(Boolean);
        if (items.length > 0) {
            blocks.push({
                id: 'noor',
                title: isEn ? 'Reading Foundation (Noor Al-Bayan)' : 'جانب القرائية والتأسيس',
                icon: '📚',
                accentColor: '#d97706',
                bgLight: '#fffbeb',
                borderLight: '#fde68a',
                subSections: [{ items }],
            });
        }
    }

    if (options.includeNotes && data.notes.length > 0) {
        const items = options.style === 'merged'
            ? Array.from(new Set(data.notes.map(n => n.text.trim()).filter(Boolean)))
            : data.notes.map(n => `(${fmtDay(n.day)}): ${n.text}`);
        if (items.length > 0) {
            blocks.push({
                id: 'notes',
                title: isEn ? "Teacher's Notes" : 'ملاحظات وتوجيهات الشهر',
                icon: '✏️',
                accentColor: '#7c3aed',
                bgLight: '#f5f3ff',
                borderLight: '#ddd6fe',
                subSections: [{ items }],
            });
        }
    }

    return blocks;
}

export function buildMonthlyPdfHtmlDocument(
    student: Student,
    month: number,
    year: number,
    data: MonthlyReportData,
    options: MonthlyReportFormatOptions
): string {
    const isEn = options.lang === 'en';
    const dir = isEn ? 'ltr' : 'rtl';
    const monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthLabel = isEn
        ? `${monthsEn[month]} ${year}`
        : `${MONTHS[month]} ${toHindiDigits(year)}`;
    const sessionsCount = Math.max(data.attendedSessionsCount, data.reportDays.length);
    const sessionsDisplay = isEn ? `${sessionsCount}` : toHindiDigits(sessionsCount);
    const blocks = buildMonthlyStructuredBlocks(month, data, options);

    const escapeHtml = (s: string) =>
        (s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

    const sectionsHtml = blocks.map(block => {
        const subsHtml = block.subSections.map(sub => {
            const labelHtml = sub.label
                ? `<div class="sub-title" style="color: ${block.accentColor};">${escapeHtml(sub.label)}</div>`
                : '';
            const itemsHtml = sub.items.map(item => `<li class="item-row">${escapeHtml(item)}</li>`).join('');
            return `
                <div class="sub-block">
                    ${labelHtml}
                    <ul class="items-list">
                        ${itemsHtml}
                    </ul>
                </div>
            `;
        }).join('');

        return `
            <div class="section-card" style="border-color: ${block.borderLight};">
                <div class="section-header" style="background: ${block.bgLight}; border-bottom: 1px solid ${block.borderLight};">
                    <span class="section-icon">${block.icon}</span>
                    <span class="section-title" style="color: ${block.accentColor};">${escapeHtml(block.title)}</span>
                </div>
                <div class="section-body">
                    ${subsHtml}
                </div>
            </div>
        `;
    }).join('');

    return `<!DOCTYPE html>
<html lang="${isEn ? 'en' : 'ar'}" dir="${dir}">
<head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(student.name)} - ${escapeHtml(monthLabel)}</title>
    <style>
        @page {
            size: A4;
            margin: 10mm;
        }
        * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #1f2937;
            font-family: ${isEn ? "'Segoe UI', Roboto, Arial, sans-serif" : "'Segoe UI', 'Traditional Arabic', 'Amiri', Tahoma, Arial, sans-serif"};
            direction: ${dir};
        }
        .page-container {
            max-width: 780px;
            margin: 0 auto;
            border: 2px solid #d1fae5;
            border-radius: 24px;
            overflow: hidden;
            background: #ffffff;
        }
        .header-banner {
            background: linear-gradient(135deg, #059669 0%, #0d9488 55%, #0891b2 100%);
            color: #ffffff;
            padding: 26px 30px;
            text-align: center;
        }
        .report-badge {
            display: inline-block;
            background: rgba(255, 255, 255, 0.18);
            border: 1px solid rgba(255, 255, 255, 0.35);
            padding: 4px 16px;
            border-radius: 999px;
            font-size: 14px;
            font-weight: 700;
            margin-bottom: 8px;
        }
        .student-name {
            margin: 4px 0 0;
            font-size: 28px;
            font-weight: 800;
            letter-spacing: 0.3px;
        }
        .meta-bar {
            display: flex;
            justify-content: center;
            flex-wrap: wrap;
            gap: 14px;
            padding: 14px 24px;
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
        }
        .meta-chip {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 7px 16px;
            font-size: 15px;
            font-weight: 700;
            color: #334155;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .meta-chip strong {
            color: #059669;
        }
        .content-area {
            padding: 22px 26px;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        .section-card {
            border: 1.5px solid #e2e8f0;
            border-radius: 18px;
            overflow: hidden;
            background: #ffffff;
            page-break-inside: avoid;
        }
        .section-header {
            padding: 11px 18px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .section-icon {
            font-size: 20px;
        }
        .section-title {
            font-size: 19px;
            font-weight: 800;
        }
        .section-body {
            padding: 14px 20px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .sub-block {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        .sub-title {
            font-size: 15.5px;
            font-weight: 800;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .sub-title::before {
            content: '•';
            font-size: 18px;
        }
        .items-list {
            margin: 0;
            padding-${isEn ? 'left' : 'right'}: 20px;
            list-style-type: disc;
        }
        .item-row {
            font-size: 16px;
            line-height: 1.65;
            color: #1e293b;
            font-weight: 600;
            margin-bottom: 3px;
        }
        .footer-bar {
            text-align: center;
            padding: 12px 20px;
            background: #f8fafc;
            border-top: 1px solid #e2e8f0;
            color: #64748b;
            font-size: 13px;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="page-container">
        <div class="header-banner">
            <div class="report-badge">${isEn ? '📊 Monthly Progress Report' : '📊 التقرير الشهري الشامل'}</div>
            <h1 class="student-name">${escapeHtml(student.name)}</h1>
        </div>
        <div class="meta-bar">
            <div class="meta-chip">
                <span>🗓️ ${isEn ? 'Month:' : 'الشهر:'}</span>
                <strong>${escapeHtml(monthLabel)}</strong>
            </div>
            ${options.includeStats && sessionsCount > 0 ? `
            <div class="meta-chip">
                <span>📚 ${isEn ? 'Completed Sessions:' : 'إجمالي الحصص المنجزة:'}</span>
                <strong>${sessionsDisplay} ${isEn ? (sessionsCount === 1 ? 'Session' : 'Sessions') : (sessionsCount === 1 ? 'حصة' : sessionsCount === 2 ? 'حصتان' : sessionsCount >= 3 && sessionsCount <= 10 ? 'حصص' : 'حصة')}</strong>
            </div>
            ` : ''}
        </div>
        <div class="content-area">
            ${sectionsHtml}
        </div>
        <div class="footer-bar">
            ${isEn ? 'May Allah bless your efforts and grant you steadfastness with the Noble Quran ✨' : 'بارك الله في جهودكم وزادكم توفيقاً وثباتاً مع كتاب الله الكريم ✨'}
        </div>
    </div>
</body>
</html>`;
}

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    student: Student;
    initialMonth: number;
    initialYear: number;
    savedReports: Record<string, string>;
    savedReportDrafts: Record<string, any>;
    attendance: AttendanceRecord;
    tajweedBank: TajweedLesson[];
    onSendWhatsApp?: (reportText: string) => void;
}

export default function MonthlyCurriculumReportModal({
    isOpen,
    onClose,
    student,
    initialMonth,
    initialYear,
    savedReports,
    savedReportDrafts,
    attendance,
    tajweedBank,
    onSendWhatsApp,
}: ModalProps) {
    const { month, year, changeMonth } = useReportMonth(initialMonth, initialYear, isOpen);
    const isNameEnglish = /[a-zA-Z]/.test(student.name);

    const [lang, setLang] = useState<'ar' | 'en'>(isNameEnglish ? 'en' : 'ar');
    const [style, setStyle] = useState<'merged' | 'detailed'>('merged');
    const [includeHeader, setIncludeHeader] = useState(true);
    const [includeStats, setIncludeStats] = useState(true);
    const [includeNew, setIncludeNew] = useState(true);
    const [includeRev, setIncludeRev] = useState(true);
    const [includeOldRev, setIncludeOldRev] = useState(true);
    const [includeTilawa, setIncludeTilawa] = useState(true);
    const [includeTajweed, setIncludeTajweed] = useState(true);
    const [includeNoor, setIncludeNoor] = useState(true);
    const [includeNotes, setIncludeNotes] = useState(false);

    const [customEditedText, setCustomEditedText] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Reset manual edits when parameters change
    useEffect(() => {
        setCustomEditedText(null);
    }, [student.id, month, year, lang, style, includeHeader, includeStats, includeNew, includeRev, includeOldRev, includeTilawa, includeTajweed, includeNoor, includeNotes]);

    const monthlyData = useMemo(() => {
        return collectMonthlyReportData(student, month, year, savedReports, savedReportDrafts, attendance, tajweedBank);
    }, [student, month, year, savedReports, savedReportDrafts, attendance, tajweedBank]);

    const formatOptions: MonthlyReportFormatOptions = useMemo(() => ({
        lang,
        style,
        includeHeader,
        includeStats,
        includeNew,
        includeRev,
        includeOldRev,
        includeTilawa,
        includeTajweed,
        includeNoor,
        includeNotes,
    }), [lang, style, includeHeader, includeStats, includeNew, includeRev, includeOldRev, includeTilawa, includeTajweed, includeNoor, includeNotes]);

    const generatedText = useMemo(() => {
        return buildMonthlyCurriculumReportText(student, month, year, monthlyData, formatOptions);
    }, [student, month, year, monthlyData, formatOptions]);

    const finalReportText = customEditedText !== null ? customEditedText : generatedText;

    if (!isOpen) return null;

    const hasAnyData =
        monthlyData.readingNew.length > 0 ||
        monthlyData.readingRev.length > 0 ||
        monthlyData.readingOldRev.length > 0 ||
        monthlyData.readingTilawa.length > 0 ||
        monthlyData.tajweed.length > 0 ||
        monthlyData.noor.length > 0 ||
        monthlyData.notes.length > 0;

    const handleCopy = async () => {
        if (!finalReportText) return;
        try {
            await navigator.clipboard.writeText(finalReportText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy monthly report:', err);
        }
    };

    const aspectChips = [
        { key: 'stats', labelAr: 'عدد الحصص', labelEn: 'Sessions Count', count: Math.max(monthlyData.attendedSessionsCount, monthlyData.reportDays.length), active: includeStats, toggle: () => setIncludeStats(!includeStats) },
        { key: 'new', labelAr: 'الحفظ الجديد', labelEn: 'New', count: monthlyData.readingNew.length, active: includeNew, toggle: () => setIncludeNew(!includeNew) },
        { key: 'rev', labelAr: 'المراجعة القريبة', labelEn: 'Revision', count: monthlyData.readingRev.length, active: includeRev, toggle: () => setIncludeRev(!includeRev) },
        { key: 'oldRev', labelAr: 'المراجعة البعيدة', labelEn: 'Old Revision', count: monthlyData.readingOldRev.length, active: includeOldRev, toggle: () => setIncludeOldRev(!includeOldRev) },
        { key: 'tilawa', labelAr: 'التلاوة والقراءة', labelEn: 'Reading', count: monthlyData.readingTilawa.length, active: includeTilawa, toggle: () => setIncludeTilawa(!includeTilawa) },
        { key: 'tajweed', labelAr: 'التجويد', labelEn: 'Tajweed', count: monthlyData.tajweed.length, active: includeTajweed, toggle: () => setIncludeTajweed(!includeTajweed) },
        { key: 'noor', labelAr: 'القرائية / التأسيس', labelEn: 'Noor / Foundation', count: monthlyData.noor.length, active: includeNoor, toggle: () => setIncludeNoor(!includeNoor) },
        { key: 'notes', labelAr: 'ملاحظات الحصص', labelEn: 'Notes', count: monthlyData.notes.length, active: includeNotes, toggle: () => setIncludeNotes(!includeNotes) },
    ].filter(c => c.count > 0 || c.key === 'stats');

    return (
        <div
            className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 font-arabic"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
                dir="rtl"
            >
                {/* Header */}
                <div className="relative bg-gradient-to-l from-[#064e3b] via-[#065f46] to-[#0f766e] px-6 py-5 text-white">
                    <button
                        onClick={onClose}
                        className="absolute left-5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
                        title="إغلاق"
                    >
                        <X size={22} />
                    </button>

                    <div className="flex items-center justify-center">
                        <h2 className="text-2xl font-bold font-arabic tracking-wide">
                            التقرير الشهري
                        </h2>
                    </div>
                    <p className="text-center text-emerald-100/90 text-lg mt-1 font-bold">
                        {student.name} — {student.academy}
                    </p>
                </div>

                {/* Month Navigation */}
                <ReportMonthNavigation
                    month={month}
                    year={year}
                    changeMonth={changeMonth}
                />

                {/* Controls Bar */}
                <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2.5">
                    {/* Style Toggle: Merged vs Detailed */}
                    <div className="flex items-center bg-white p-1 rounded-2xl border border-gray-200 shadow-sm">
                        <button
                            type="button"
                            onClick={() => setStyle('merged')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-arabic transition-all ${
                                style === 'merged'
                                    ? 'bg-[#065f46] text-white shadow-sm font-bold'
                                    : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            <Layers size={15} />
                            <span>ملخص مدمج</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setStyle('detailed')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-arabic transition-all ${
                                style === 'detailed'
                                    ? 'bg-[#065f46] text-white shadow-sm font-bold'
                                    : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            <ListFilter size={15} />
                            <span>تفصيلي بالحصة</span>
                        </button>
                    </div>

                    {/* Language Toggle */}
                    <div className="flex items-center bg-white p-1 rounded-2xl border border-gray-200 shadow-sm">
                        <button
                            type="button"
                            onClick={() => setLang('ar')}
                            className={`px-3.5 py-1.5 rounded-xl text-sm font-arabic transition-all ${
                                lang === 'ar'
                                    ? 'bg-blue-600 text-white shadow-sm font-bold'
                                    : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            العربية
                        </button>
                        <button
                            type="button"
                            onClick={() => setLang('en')}
                            className={`px-3.5 py-1.5 rounded-xl text-sm font-english transition-all ${
                                lang === 'en'
                                    ? 'bg-blue-600 text-white shadow-sm font-bold'
                                    : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            English
                        </button>
                    </div>
                </div>

                {/* Aspect Filter Chips */}
                {hasAnyData && (
                    <div className="px-6 py-3 bg-white border-b border-gray-100 flex flex-wrap items-center gap-2">
                        <span className="text-sm text-gray-400 font-arabic ml-1">الجوانب المشمولة:</span>
                        {aspectChips.map(chip => (
                            <button
                                key={chip.key}
                                type="button"
                                onClick={chip.toggle}
                                className={`px-3 py-1 rounded-full text-sm font-arabic flex items-center gap-1.5 border transition-all ${
                                    chip.active
                                        ? 'bg-emerald-50/80 border-emerald-200 text-[#065f46] font-bold shadow-sm'
                                        : 'bg-gray-50 border-gray-200 text-gray-400 line-through'
                                }`}
                            >
                                <span>{chip.labelAr}</span>
                                <span className={`text-xs px-1.5 py-0.2 rounded-full ${chip.active ? 'bg-emerald-200/60 text-[#064e3b]' : 'bg-gray-200 text-gray-500'}`}>
                                    {toHindiDigits(chip.count)}
                                </span>
                            </button>
                        ))}
                    </div>
                )}

                {/* Report Body / Editable Preview */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                    {!hasAnyData ? (
                        <div className="text-center py-12 px-4 bg-white rounded-2xl border border-dashed border-gray-200 space-y-3">
                            <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto">
                                <FileText size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-700 font-arabic">
                                لا توجد تقارير يومية محفوظة لهذا الطالب في شهر {MONTHS[month]} {toHindiDigits(year)}
                            </h3>
                            <p className="text-gray-500 text-base font-arabic max-w-md mx-auto">
                                يتم تجميع التقرير الشهري تلقائياً من التقارير اليومية المحفوظة للطالب من أول يوم لآخر يوم في الشهر في كل جانب (القرآن، المراجعة، التجويد، القرائية).
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between text-base font-medium text-gray-600 px-1">
                                <span>
                                    تم استخلاص البيانات من <strong className="text-[#065f46]">{toHindiDigits(monthlyData.reportDays.length)}</strong> تقرير محفوظ
                                </span>
                                {customEditedText !== null && (
                                    <button
                                        type="button"
                                        onClick={() => setCustomEditedText(null)}
                                        className="text-blue-600 hover:underline text-sm font-normal"
                                    >
                                        استعادة النص التلقائي ↺
                                    </button>
                                )}
                            </div>
                            <textarea
                                value={finalReportText}
                                onChange={(e) => setCustomEditedText(e.target.value)}
                                dir={lang === 'en' ? 'ltr' : 'rtl'}
                                className={`w-full min-h-[280px] p-5 rounded-2xl bg-white border border-gray-200 shadow-inner text-gray-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#065f46]/30 focus:border-[#065f46] resize-y ${
                                    lang === 'en' ? 'font-english text-base text-left' : 'font-arabic text-xl text-right'
                                }`}
                            />
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-white border-t border-gray-100 flex flex-wrap items-center gap-2.5">
                    {/* Copy Text Button */}
                    <button
                        type="button"
                        disabled={!hasAnyData}
                        onClick={handleCopy}
                        className={`flex-1 min-w-[150px] py-3 px-4 rounded-2xl text-white font-arabic font-bold text-lg shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 ${
                            !hasAnyData
                                ? 'bg-gray-300 cursor-not-allowed'
                                : copied
                                    ? 'bg-[#064e3b]'
                                    : 'bg-[#065f46] hover:bg-[#047857]'
                        }`}
                    >
                        {copied ? <Check size={20} strokeWidth={3} /> : <Copy size={19} />}
                        <span>{copied ? 'تم نسخ النص ✨' : 'نسخ النص'}</span>
                    </button>

                    {onSendWhatsApp && hasAnyData && (
                        <button
                            type="button"
                            onClick={() => onSendWhatsApp(finalReportText)}
                            className="py-3 px-4 rounded-2xl bg-[#15803d] hover:bg-[#166534] text-white font-arabic font-bold text-lg shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95"
                            title="إرسال عبر واتساب"
                        >
                            <MessageCircle size={19} />
                            <span>واتساب</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={onClose}
                        className="py-3 px-5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-arabic font-bold text-lg transition-all"
                    >
                        إغلاق
                    </button>
                </div>
            </div>
        </div>
    );
}

