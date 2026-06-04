import React, { useState, useEffect, useMemo } from 'react';
import { X, BookOpen, FileText, Copy, Check, Mic } from 'lucide-react';
import { Student, LessonProgress } from '../types';

// Quran Surahs data (114 surahs)
const SURAHS = [
    'الفاتحة', 'البقرة', 'آل عمران', 'النساء', 'المائدة', 'الأنعام', 'الأعراف', 'الأنفال',
    'التوبة', 'يونس', 'هود', 'يوسف', 'الرعد', 'إبراهيم', 'الحجر', 'النحل',
    'الإسراء', 'الكهف', 'مريم', 'طه', 'الأنبياء', 'الحج', 'المؤمنون', 'النور',
    'الفرقان', 'الشعراء', 'النمل', 'القصص', 'العنكبوت', 'الروم', 'لقمان', 'السجدة',
    'الأحزاب', 'سبأ', 'فاطر', 'يس', 'الصافات', 'ص', 'الزمر', 'غافر',
    'فصلت', 'الشورى', 'الزخرف', 'الدخان', 'الجاثية', 'الأحقاف', 'محمد', 'الفتح',
    'الحجرات', 'ق', 'الذاريات', 'الطور', 'النجم', 'القمر', 'الرحمن', 'الواقعة',
    'الحديد', 'المجادلة', 'الحشر', 'الممتحنة', 'الصف', 'الجمعة', 'المنافقون', 'التغابن',
    'الطلاق', 'التحريم', 'الملك', 'القلم', 'الحاقة', 'المعارج', 'نوح', 'الجن',
    'المزمل', 'المدثر', 'القيامة', 'الإنسان', 'المرسلات', 'النبأ', 'النازعات', 'عبس',
    'التكوير', 'الانفطار', 'المطففين', 'الانشقاق', 'البروج', 'الطارق', 'الأعلى', 'الغاشية',
    'الفجر', 'البلد', 'الشمس', 'الليل', 'الضحى', 'الشرح', 'التين', 'العلق',
    'القدر', 'البينة', 'الزلزلة', 'العاديات', 'القارعة', 'التكاثر', 'العصر', 'الهمزة',
    'الفيل', 'قريش', 'الماعون', 'الكوثر', 'الكافرون', 'النصر', 'المسد', 'الإخلاص',
    'الفلق', 'الناس'
];

// Helper to convert to Hindi digits
const toHindiDigits = (num: number | string) => {
    return num.toString()
        .replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)])
        .replace(/\./g, ",");
};

// Format date in Arabic
const formatArabicDate = (date: Date) => {
    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    return `${days[date.getDay()]} ${toHindiDigits(date.getDate())} ${months[date.getMonth()]} ${toHindiDigits(date.getFullYear())}`;
};

interface SmartReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (progress: LessonProgress, report: string) => void;
    student: Student;
    initialProgress?: LessonProgress;
    dayNum: number;
    month: number;
    year: number;
}

const SmartReportModal: React.FC<SmartReportModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    student,
    initialProgress,
    dayNum,
    month,
    year,
}) => {
    // Path selection
    const [path, setPath] = useState<'quran' | 'reading'>(initialProgress?.path || 'quran');

    // Quran path state
    const [surah, setSurah] = useState(initialProgress?.surah || SURAHS[0]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    // Sync searchQuery with surah state (e.g. when loaded from initialProgress)
    useEffect(() => {
        // We don't want to sync search query with surah anymore in the new design
        // because search query is for filtering, and surah is the selected value.
        // We start with empty search or maybe just keep it empty.
        setSearchQuery('');
    }, [surah]);

    const [fromAyah, setFromAyah] = useState(initialProgress?.fromAyah || 1);
    const [toAyah, setToAyah] = useState(initialProgress?.toAyah || 10);

    // Reading path state
    const [fromPage, setFromPage] = useState(initialProgress?.fromPage || 1);
    const [toPage, setToPage] = useState(initialProgress?.toPage || 1);
    const [fromLine, setFromLine] = useState(initialProgress?.fromLine || 1);
    const [toLine, setToLine] = useState(initialProgress?.toLine || 10);
    const [book, setBook] = useState<'noor' | 'taasees'>(initialProgress?.book || 'noor');

    // Audio link state
    const [audioLink, setAudioLink] = useState('');

    // Copy state
    const [copied, setCopied] = useState(false);

    // Search input ref
    const searchInputRef = React.useRef<HTMLInputElement>(null);

    // Modal container ref (for scroll fix)
    const modalRef = React.useRef<HTMLDivElement>(null);

    // Shared wheel handler for all inputs — prevents value change, scrolls modal instead
    const handleInputWheel = (e: React.WheelEvent<HTMLInputElement>) => {
        e.preventDefault();
        e.stopPropagation();
        const modal = modalRef.current;
        if (modal && modal.scrollHeight > modal.clientHeight) {
            modal.scrollBy({ top: e.deltaY * 0.85, behavior: 'instant' });
        }
    };

    // Ctrl+F to focus search (Now opens the search view)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                setIsSearching(true);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Auto-focus search input when searching starts
    useEffect(() => {
        if (isSearching) {
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 100);
        }
    }, [isSearching]);

    // Reset audio link when modal opens
    useEffect(() => {
        if (isOpen) {
            setAudioLink('');
            setCopied(false);
        }
    }, [isOpen]);

    // Update state when initialProgress changes
    useEffect(() => {
        if (initialProgress) {
            setPath(initialProgress.path || 'quran');
            if (initialProgress.surah) setSurah(initialProgress.surah);
            if (initialProgress.fromAyah) setFromAyah(initialProgress.fromAyah);
            if (initialProgress.toAyah) setToAyah(initialProgress.toAyah);
            if (initialProgress.fromPage) setFromPage(initialProgress.fromPage);
            if (initialProgress.toPage) setToPage(initialProgress.toPage);
            if (initialProgress.fromLine) setFromLine(initialProgress.fromLine);
            if (initialProgress.toLine) setToLine(initialProgress.toLine);
            if (initialProgress.book) setBook(initialProgress.book);
        }
    }, [initialProgress]);

    // Generate report
    const generateReport = useMemo(() => {
        const date = new Date(year, month, dayNum);
        const dateStr = formatArabicDate(date);

        const audioSection = audioLink.trim()
            ? `\n\n🎧 *للاستماع إلى التوجيهات:*\n${audioLink.trim()}`
            : '';

        if (path === 'quran') {
            return `📖 *تقرير الحصة*

الطالب: ${student.name}
التاريخ: ${dateStr}

*المقروء:*
سورة ${surah}
من الآية ${toHindiDigits(fromAyah)} إلى الآية ${toHindiDigits(toAyah)}

✅ تم بحمد الله${audioSection}`;
        } else {
            const bookNameAr = book === 'taasees' ? 'كتاب التأسيس' : 'نور البيان';
            return `📖 *تقرير الحصة*

الطالب: ${student.name}
التاريخ: ${dateStr}

ــــــــــــــــــــــــــــــ

📚  ( *${bookNameAr}* )

*• المقروء:*
${fromPage === toPage || !toPage ? `صفحة ${toHindiDigits(fromPage)}` : `من صفحة ${toHindiDigits(fromPage)} إلى صفحة ${toHindiDigits(toPage)}`}
${(fromLine || toLine) ? (fromLine === toLine || !toLine ? `(سطر ${toHindiDigits(fromLine)})` : `(من السطر ${toHindiDigits(fromLine)} إلى السطر ${toHindiDigits(toLine)})`) : ''}

✅ تم بحمد الله${audioSection}`;
        }
    }, [path, book, student.name, surah, fromAyah, toAyah, fromPage, toPage, fromLine, toLine, dayNum, month, year, audioLink]);

    const handleCopyAndConfirm = async () => {
        try {
            await navigator.clipboard.writeText(generateReport);
            setCopied(true);

            const progress: LessonProgress = {
                path,
                surah: path === 'quran' ? surah : undefined,
                fromAyah: path === 'quran' ? fromAyah : undefined,
                toAyah: path === 'quran' ? toAyah : undefined,
                fromPage: path === 'reading' ? fromPage : undefined,
                toPage: path === 'reading' ? toPage : undefined,
                fromLine: path === 'reading' ? fromLine : undefined,
                toLine: path === 'reading' ? toLine : undefined,
                book: path === 'reading' ? book : undefined,
                lastUpdated: Date.now(),
            };

            setTimeout(() => {
                onConfirm(progress, generateReport);
            }, 300);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleSkip = () => {
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={handleSkip}
            />

            {/* Modal */}
            <div ref={modalRef} className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md animate-[slideUp_0.3s_ease-out] overflow-y-auto" style={{ maxHeight: '90vh' }}>
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-5 rounded-t-3xl">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold font-arabic">التقرير الذكي</h2>
                        <button
                            onClick={handleSkip}
                            className="p-2 hover:bg-white/20 rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                    <p className="text-emerald-100 text-sm mt-1 font-arabic">{student.name}</p>
                </div>

                {/* Path Selection */}
                <div className="p-4 border-b border-gray-100">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPath('quran')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-arabic text-sm font-medium transition-all duration-200 ${path === 'quran'
                                ? 'bg-emerald-100 text-emerald-700 shadow-sm'
                                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                                }`}
                        >
                            <BookOpen size={18} />
                            القرآن الكريم
                        </button>
                        <button
                            onClick={() => setPath('reading')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-arabic text-sm font-medium transition-all duration-200 ${path === 'reading'
                                ? 'bg-amber-100 text-amber-700 shadow-sm'
                                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                                }`}
                        >
                            <FileText size={18} />
                            نور البيان
                        </button>
                    </div>
                </div>

                {/* Form Content */}
                <div className="p-5 space-y-4">
                    {path === 'quran' ? (
                        <>
                            {/* Surah Selection - Radical Redesign */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2 font-arabic">السورة</label>
                                <button
                                    onClick={() => {
                                        setSearchQuery('');
                                        setIsSearching(true);
                                    }}
                                    className="w-full p-4 border-2 border-emerald-100 rounded-xl bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-300 transition-all group flex items-center justify-between"
                                >
                                    <span className="font-arabic text-xl text-emerald-800 font-bold">{surah}</span>
                                    <span className="text-emerald-400 text-sm font-arabic group-hover:text-emerald-600">اضغط للتغيير 🔍</span>
                                </button>
                            </div>

                            {/* Ayah Range */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2 font-arabic">من الآية</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={fromAyah}
                                        onChange={(e) => setFromAyah(parseInt(e.target.value) || 1)}
                                        onWheel={handleInputWheel}
                                        className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-center font-english focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2 font-arabic">إلى الآية</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={toAyah}
                                        onChange={(e) => setToAyah(parseInt(e.target.value) || fromAyah)}
                                        onWheel={handleInputWheel}
                                        className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-center font-english focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                                    />
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Book Selection */}
                            <div className="flex gap-2 mb-4">
                                <button
                                    onClick={() => setBook('noor')}
                                    className={`flex-1 py-2 rounded-lg font-arabic text-xs font-bold transition-all ${book === 'noor' ? 'bg-amber-500 text-white shadow-md' : 'bg-gray-100 text-gray-400'}`}
                                >
                                    نور البيان
                                </button>
                                <button
                                    onClick={() => setBook('taasees')}
                                    className={`flex-1 py-2 rounded-lg font-arabic text-xs font-bold transition-all ${book === 'taasees' ? 'bg-amber-500 text-white shadow-md' : 'bg-gray-100 text-gray-400'}`}
                                >
                                    كتاب التأسيس
                                </button>
                            </div>

                            {/* Page Range */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2 font-arabic">من صفحة</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={fromPage}
                                        onChange={(e) => setFromPage(parseInt(e.target.value) || 1)}
                                        onWheel={handleInputWheel}
                                        className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-center font-english focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2 font-arabic">إلى صفحة</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={toPage}
                                        onChange={(e) => setToPage(parseInt(e.target.value) || fromPage)}
                                        onWheel={handleInputWheel}
                                        className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-center font-english focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                                    />
                                </div>
                            </div>

                            {/* Line Range */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2 font-arabic">من السطر</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={fromLine}
                                        onChange={(e) => setFromLine(parseInt(e.target.value) || 1)}
                                        onWheel={handleInputWheel}
                                        className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-center font-english focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2 font-arabic">إلى السطر</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={toLine}
                                        onChange={(e) => setToLine(parseInt(e.target.value) || fromLine)}
                                        onWheel={handleInputWheel}
                                        className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-center font-english focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Audio Link */}
                <div className="mx-5 mb-4">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-2 font-arabic">
                        <Mic size={14} className="text-purple-400" />
                        رابط التسجيل الصوتي (اختياري)
                    </label>
                    <input
                        type="text"
                        value={audioLink}
                        onChange={(e) => setAudioLink(e.target.value)}
                        placeholder="https://..."
                        dir="ltr"
                        className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-sm font-english focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all placeholder-gray-300"
                    />
                </div>

                {/* Report Preview */}
                <div className="mx-5 mb-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap font-arabic leading-relaxed" dir="rtl">
                        {generateReport}
                    </pre>
                </div>

                {/* Actions */}
                <div className="p-5 pt-0 flex gap-3">
                    <button
                        onClick={handleSkip}
                        className="flex-1 py-3 px-4 rounded-xl border border-gray-200 text-gray-600 font-arabic font-medium hover:bg-gray-50 transition-all"
                    >
                        تخطي
                    </button>
                    <button
                        onClick={handleCopyAndConfirm}
                        className={`flex-1 py-3 px-4 rounded-xl font-arabic font-medium flex items-center justify-center gap-2 transition-all duration-200 ${copied
                            ? 'bg-green-500 text-white'
                            : path === 'quran'
                                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:shadow-lg'
                                : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:shadow-lg'
                            }`}
                    >
                        {copied ? (
                            <>
                                <Check size={18} />
                                تم النسخ
                            </>
                        ) : (
                            <>
                                <Copy size={18} />
                                نسخ التقرير
                            </>
                        )}
                    </button>
                </div>

                {/* --- Radical Search Overlay --- */}
                {isSearching && (
                    <div className="absolute inset-0 z-[60] bg-white flex flex-col animate-[fadeIn_0.2s_ease-out]">
                        <div className="p-4 bg-emerald-50 border-b border-emerald-100 flex items-center gap-3">
                            <button
                                onClick={() => setIsSearching(false)}
                                className="p-2 hover:bg-emerald-100 rounded-full text-emerald-700 transition-colors"
                            >
                                <X size={24} />
                            </button>
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="flex-1 bg-white border-2 border-emerald-200 rounded-xl px-4 py-2 text-right font-arabic text-lg focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 placeholder-emerald-300"
                                placeholder="اكتب اسم السورة..."
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {SURAHS.filter(s => s.includes(searchQuery) || searchQuery === '').map((s) => (
                                <button
                                    key={s}
                                    onClick={() => {
                                        setSurah(s);
                                        setIsSearching(false);
                                    }}
                                    className={`w-full text-right px-5 py-4 rounded-xl font-arabic text-lg transition-all flex items-center justify-between group ${surah === s ? 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-200' : 'hover:bg-gray-50 text-gray-700'}`}
                                >
                                    <span>{s}</span>
                                    <span className={`text-sm group-hover:text-emerald-500 font-english ${surah === s ? 'text-emerald-600' : 'text-gray-300'}`}>
                                        {toHindiDigits(SURAHS.indexOf(s) + 1)}
                                    </span>
                                </button>
                            ))}
                            {SURAHS.filter(s => s.includes(searchQuery)).length === 0 && (
                                <div className="text-center py-10 text-gray-400 font-arabic">
                                    لا توجد سورة بهذا الاسم
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
        </div>
    );
};

export default SmartReportModal;
