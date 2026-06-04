import React, { useRef, useState } from 'react';
import { X, Calendar, Clock, Copy, Check, Wallet, FileText, AlignLeft, DollarSign, ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';
import { Student, AttendanceRecord, AttendanceStatus } from '../types';
import { toBlob } from 'html-to-image';

interface Props {
    students: Student[];
    attendance: AttendanceRecord;
    onClose: () => void;
    month: number;
    year: number;
    usdRate: number;
}

// Helper to convert Hindi digits to Western
const toWesternDigits = (str: string): string => {
    if (!str) return '';
    return str.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
};

// Helper to convert Western digits to Hindi
const toHindiDigits = (num: number | string): string => {
    return num.toString()
        .replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)])
        .replace(/\./g, ",")
        .replace('،', ",");
};

const getHoursPlural = (num: number): string => {
    const n = Math.floor(Math.abs(num));
    if (n === 1) return 'ساعة';
    if (n === 2) return 'ساعتان';
    if (n >= 3 && n <= 10) return 'ساعات';
    return 'ساعة';
};

const getSessionsPlural = (num: number): string => {
    const n = Math.abs(num);
    if (n === 1) return 'حصة';
    if (n === 2) return 'حصتان';
    if (n >= 3 && n <= 10) return 'حصص';
    return 'حصة';
};

const MultiStudentDetailsModal: React.FC<Props> = ({ students, attendance, onClose, month, year, usdRate }) => {
    const reportRef = useRef<HTMLDivElement>(null);
    const [isCopying, setIsCopying] = useState(false);
    const [includePricing, setIncludePricing] = useState(true);
    const [showCopyMenu, setShowCopyMenu] = useState(false);
    const [textSelectMode, setTextSelectMode] = useState(false);
    const [imageSelectMode, setImageSelectMode] = useState(false);
    const [paypalSelectMode, setPaypalSelectMode] = useState(false);

    // Determine language based on first student's name
    const hasEnglishName = students.some(s => /[a-zA-Z]/.test(s.name));
    const [reportLanguage, setReportLanguage] = useState<'ar' | 'en'>('ar');
    const isEnglish = reportLanguage === 'en';

    // Combined student names
    const combinedNames = students.map(s => s.name).join('، ');

    // Calculate combined stats
    const getCombinedStats = () => {
        let totalSessionCount = 0;
        let totalHours = 0;
        let totalDueAmount = 0;

        students.forEach(student => {
            let sessionCount = 0;
            let unitsCount = 0;

            // Count sessions for this student
            Object.entries(attendance).forEach(([key, status]) => {
                const [id, , keyMonth, keyYear] = key.split('_');
                if (id === student.id && parseInt(keyMonth) === month && parseInt(keyYear) === year) {
                    if (status === AttendanceStatus.PRESENT || status === AttendanceStatus.PAID_ABSENCE) {
                        sessionCount++;
                        unitsCount++;
                    } else if (status === AttendanceStatus.DOUBLE_CLASS) {
                        sessionCount++;    // 1 Visit
                        unitsCount += 2;   // 2 Units
                    }
                }
            });

            totalSessionCount += sessionCount;

            // Calculate hours
            const normalizedDuration = toWesternDigits(student.duration || '60');
            const durationMinutes = parseInt(normalizedDuration);

            if (!isNaN(durationMinutes)) {
                totalHours += Math.round((unitsCount * durationMinutes / 60) * 4) / 4;
            } else if (student.duration === 'خليط') {
                totalHours += Math.round(unitsCount * 0.5 * 4) / 4;
            }

            // Calculate amount
            const dueAmount = (student.paymentBasis === 'بالساعة')
                ? (unitsCount * (parseInt(toWesternDigits(student.duration || '٣٠')) || 30) / 60) * student.rate
                : unitsCount * student.rate;
            totalDueAmount += dueAmount;
        });

        return { totalSessionCount, totalHours, totalDueAmount };
    };

    const stats = getCombinedStats();

    // Determine currency (use first student's currency)
    const currency = students[0]?.location || 'جنيه';
    const formattedAmount = stats.totalDueAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    const handleCopy = async (withPricing: boolean) => {
        if (!reportRef.current || isCopying) return;

        setIncludePricing(withPricing);
        setShowCopyMenu(false);
        setIsCopying(true);

        setTimeout(async () => {
            try {
                const blob = await toBlob(reportRef.current!, {
                    backgroundColor: '#ffffff',
                    pixelRatio: 3,
                    cacheBust: true,
                    skipAutoScale: true,
                    style: {
                        transform: 'scale(1)',
                        transformOrigin: 'top left',
                    },
                    fontEmbedCSS: '' // Prevent external font CSS inlining which causes SecurityError
                });

                if (blob) {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    setTimeout(() => setIsCopying(false), 2000);
                }
            } catch (err) {
                console.error('Failed to copy report:', err);
                setIsCopying(false);
            }
        }, 100);
    };

    const handleCopyText = async (withPricing: boolean = false, withPaypal: boolean = true) => {
        // Use the passed year and month for the report date
        const dateForMonthName = new Date(year, month, 1);
        const currentMonthName = dateForMonthName.toLocaleDateString(isEnglish ? 'en-US' : 'ar-SA', { month: 'long', year: 'numeric' });
        const lines: string[] = [];

        // Header - date only (no academy name)
        if (isEnglish) {
            lines.push(`🗓️ ${currentMonthName}`);
        } else {
            lines.push(`🗓️ ${currentMonthName}`);
        }
        lines.push('');

        // Students Breakdown
        students.forEach(student => {
            let visitsCount = 0; // Number of distinct sessions attended
            let unitsCount = 0;  // Units for billing/hours calculation

            Object.entries(attendance).forEach(([key, status]) => {
                const [id, , keyMonth, keyYear] = key.split('_');
                if (id === student.id && parseInt(keyMonth) === month && parseInt(keyYear) === year) {
                    if (status === AttendanceStatus.PRESENT || status === AttendanceStatus.PAID_ABSENCE) {
                        visitsCount++;
                        unitsCount++;
                    } else if (status === AttendanceStatus.DOUBLE_CLASS) {
                        visitsCount++;
                        unitsCount += 2;
                    }
                }
            });

            const normalizedDuration = toWesternDigits(student.duration);
            const durationMinutes = parseInt(normalizedDuration);
            let durationVal = 0;
            if (!isNaN(durationMinutes)) {
                durationVal = durationMinutes / 60;
            } else {
                if (student.duration === '٣٠' || student.duration === '30' || student.duration === 'خليط') durationVal = 0.5;
                else durationVal = 1;
            }

            const studentHoursRaw = Math.round(unitsCount * durationVal * 4) / 4;
            const formattedHours = Number.isInteger(studentHoursRaw) ? studentHoursRaw.toString() : parseFloat(studentHoursRaw.toFixed(2)).toString();

            if (visitsCount > 0) {
                if (isEnglish) {
                    lines.push(`🔹 *${student.name.trim()}*`);
                    lines.push(`   ${formattedHours} Hours  |  ${visitsCount} Sessions`);
                } else {
                    lines.push(`🔹 *${student.name.trim()}*`);
                    lines.push(`   ${toHindiDigits(formattedHours)} ${getHoursPlural(studentHoursRaw)}  |  ${toHindiDigits(visitsCount)} ${getSessionsPlural(visitsCount)}`);
                }
                lines.push('');
            }
        });

        lines.push('──────────────');

        // Footer (Totals)
        if (isEnglish) {
            lines.push(`*Total:*`);
            lines.push(`⏱️ ${Number.isInteger(stats.totalHours) ? stats.totalHours : parseFloat(stats.totalHours.toFixed(2))} Hours`);
            lines.push(`📚 ${stats.totalSessionCount} Sessions`);
        } else {
            lines.push(`*الإجمالي:*`);
            lines.push(`⏱️ ${toHindiDigits(Number.isInteger(stats.totalHours) ? stats.totalHours : parseFloat(stats.totalHours.toFixed(2)))} ${getHoursPlural(stats.totalHours)}`);
            lines.push(`📚 ${toHindiDigits(stats.totalSessionCount)} ${getSessionsPlural(stats.totalSessionCount)}`);
        }

        if (withPricing) {
            lines.push('');
            lines.push('──────────────');
            lines.push(isEnglish ? '*Payment Details:*' : '*تفاصيل الحساب:*');

            const formattedAmount = stats.totalDueAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

            if (isEnglish) {
                lines.push(`${formattedAmount} ${currency === 'دولار' ? 'USD' : (currency === 'جنيه' ? 'L.E' : currency)}`);
            } else {
                lines.push(`${toHindiDigits(formattedAmount)} ${currency}`);
            }
        }

        if (withPaypal) {
            lines.push('');
            lines.push('──────────────');
            lines.push('https://paypal.me/ost101999');
        }

        try {
            await navigator.clipboard.writeText(lines.join('\n'));
            setIsCopying(true);
            setTimeout(() => setIsCopying(false), 2000);
            setShowCopyMenu(false);
            setTextSelectMode(false); // Close text menu after copy
        } catch (err) {
            console.error('Failed to copy text:', err);
        }
    };


    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 font-arabic"
            onClick={onClose}
        >
            {/* Hidden capture template */}
            <div className="fixed -left-[9999px] top-0 overflow-hidden">
                <div
                    ref={reportRef}
                    dir={isEnglish ? 'ltr' : 'rtl'}
                    className="bg-white p-12 w-[650px] flex flex-col items-center text-center rounded-[50px] shadow-2xl"
                    style={{ fontFamily: isEnglish ? '"Acme", sans-serif' : "'DecoType Naskh', cursive" }}
                >
                    <div className="w-full pb-10">
                        <h2 className={`font-bold text-gray-900 ${isEnglish ? 'text-4xl' : 'text-5xl'} tracking-tight leading-relaxed`}>
                            {combinedNames}
                        </h2>
                        <p className={`text-gray-400 mt-3 font-medium ${isEnglish ? 'text-2xl' : 'text-3xl'}`}>
                            {isEnglish ? 'Combined Attendance Report' : 'تقرير الحضور المجمع'}
                        </p>
                    </div>

                    <div className="w-full grid grid-cols-2 gap-8 mb-10 px-4">
                        {isEnglish ? (
                            <>
                                {/* Sessions Card */}
                                <div className="bg-[#eff6ff] border border-[#dbeafe] p-10 rounded-[45px] flex flex-col items-center gap-6 shadow-sm">
                                    <div className="w-20 h-20 bg-[#dbeafe] text-[#2563eb] rounded-full flex items-center justify-center shadow-sm">
                                        <Calendar size={40} strokeWidth={2.5} />
                                    </div>
                                    <span
                                        className="text-8xl font-bold text-gray-900 leading-none"
                                        style={{ fontFamily: '"Tajawal", sans-serif' }}
                                    >
                                        {stats.totalSessionCount}
                                    </span>
                                    <span className="text-gray-600 font-normal text-3xl">Sessions</span>
                                </div>

                                {/* Hours Card */}
                                <div className="bg-[#fffbeb] border border-[#fef3c7] p-10 rounded-[45px] flex flex-col items-center gap-6 shadow-sm">
                                    <div className="w-20 h-20 bg-[#fef3c7] text-[#d97706] rounded-full flex items-center justify-center shadow-sm">
                                        <Clock size={40} strokeWidth={2.5} />
                                    </div>
                                    <span
                                        className="text-8xl font-bold text-gray-900 leading-none"
                                        style={{ fontFamily: '"Tajawal", sans-serif' }}
                                    >
                                        {Number.isInteger(stats.totalHours) ? stats.totalHours : parseFloat(stats.totalHours.toFixed(2))}
                                    </span>
                                    <span className="text-gray-600 font-normal text-3xl">Hours</span>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Sessions Card (Right side in RTL) */}
                                <div className="bg-[#eff6ff] border border-[#dbeafe] p-10 rounded-[45px] flex flex-col items-center gap-6 shadow-sm">
                                    <div className="w-20 h-20 bg-[#dbeafe] text-[#2563eb] rounded-full flex items-center justify-center shadow-sm">
                                        <Calendar size={40} strokeWidth={2.5} />
                                    </div>
                                    <span className="text-8xl font-bold text-gray-900 leading-none">
                                        {toHindiDigits(stats.totalSessionCount)}
                                    </span>
                                    <span className="text-gray-600 font-normal text-4xl">عدد الحصص</span>
                                </div>

                                {/* Hours Card (Left side in RTL) */}
                                <div className="bg-[#fffbeb] border border-[#fef3c7] p-10 rounded-[45px] flex flex-col items-center gap-6 shadow-sm">
                                    <div className="w-20 h-20 bg-[#fef3c7] text-[#d97706] rounded-full flex items-center justify-center shadow-sm">
                                        <Clock size={40} strokeWidth={2.5} />
                                    </div>
                                    <span className="text-8xl font-bold text-gray-900 leading-none">
                                        {toHindiDigits(Number.isInteger(stats.totalHours) ? stats.totalHours : parseFloat(stats.totalHours.toFixed(2)))}
                                    </span>
                                    <span className="text-gray-600 font-normal text-4xl">عدد الساعات</span>
                                </div>
                            </>
                        )}
                    </div>

                    {includePricing && (
                        <div className="w-full space-y-6 px-4">
                            <div className="bg-gray-50/50 rounded-[45px] p-10 border border-gray-100 flex flex-col gap-6">
                                <div className={`flex justify-between items-center flex-row`}>
                                    <span className={`font-normal text-gray-800 ${isEnglish ? 'text-4xl' : 'text-4xl'}`}>
                                        {isEnglish ? 'Total Due' : 'إجمالي المستحق'}
                                    </span>
                                    <span
                                        className={`font-normal text-[#d4af37] ${isEnglish ? 'text-5xl' : 'text-5xl'} leading-none`}
                                        style={{
                                            fontFamily: isEnglish ? '"Tajawal", sans-serif' : 'inherit',
                                            WebkitTextStroke: '0',
                                            textShadow: 'none'
                                        }}
                                    >
                                        {isEnglish ? formattedAmount : toHindiDigits(formattedAmount)} {isEnglish ? (currency === 'دولار' ? 'USD' : (currency === 'جنيه' ? 'L.E' : currency)) : currency}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="pt-10 text-gray-500 text-2xl font-bold">
                        {new Date(year, month, 1).toLocaleDateString(isEnglish ? 'en-US' : 'ar-SA', { month: 'long', year: 'numeric' })}
                    </div>
                </div>
            </div>

            <div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="relative p-6 text-center border-b border-gray-100 bg-gray-50/50">
                    <button
                        onClick={onClose}
                        className="absolute left-6 top-1/2 -translate-y-1/2 p-2 hover:bg-red-50 hover:text-red-500 rounded-full text-gray-400 transition-colors"
                    >
                        <X size={24} />
                    </button>

                    <div className="absolute right-6 top-1/2 -translate-y-1/2">
                        <button
                            onClick={() => setShowCopyMenu(!showCopyMenu)}
                            className={`p-2 rounded-full transition-all duration-300 ${isCopying ? 'bg-emerald-50 text-emerald-500 scale-110' : 'hover:bg-blue-50 text-blue-600 hover:scale-110 active:scale-95'
                                }`}
                            title={isEnglish ? 'Copy Report' : 'نسخ التقرير'}
                        >
                            {isCopying ? <Check size={24} strokeWidth={3} /> : <Copy size={24} strokeWidth={2.5} />}
                        </button>

                        {/* Copy Menu Dropdown */}
                        {showCopyMenu && (
                            <>
                                <div className="fixed inset-0 z-[100]" onClick={() => { setShowCopyMenu(false); setTextSelectMode(false); setImageSelectMode(false); }} />
                                <div className="absolute right-0 mt-3 w-64 bg-white/90 backdrop-blur-xl rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-white/40 p-2 z-[110] animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200 origin-top-right">
                                    <div className="flex flex-col gap-1">

                                        {!textSelectMode && !imageSelectMode ? (
                                            <>
                                                {/* Language Toggle */}
                                                <div className="flex bg-gray-100/50 p-1 rounded-[18px] mb-1">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setReportLanguage('ar'); }}
                                                        className={`flex-1 py-2 text-sm font-arabic rounded-[14px] transition-all duration-300 ${!isEnglish ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                                                    >العربية</button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setReportLanguage('en'); }}
                                                        className={`flex-1 py-2 text-sm font-medium rounded-[14px] transition-all duration-300 ${isEnglish ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                                                    >English</button>
                                                </div>

                                                <button
                                                    onClick={() => setTextSelectMode(true)}
                                                    className="w-full flex items-center justify-between px-4 py-4 hover:bg-emerald-600 group transition-all duration-300 rounded-[18px] text-right"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center group-hover:bg-white/20 group-hover:text-white transition-all duration-300">
                                                            <AlignLeft size={22} strokeWidth={2.2} />
                                                        </div>
                                                        <span className="text-gray-600 group-hover:text-white font-normal text-xl font-arabic leading-relaxed whitespace-nowrap">نسخ النص</span>
                                                    </div>
                                                    <ChevronLeft size={20} className="text-gray-300 group-hover:text-white/70 transition-colors" />
                                                </button>

                                                <div className="h-px bg-gray-100/50 mx-4 my-1" />

                                                <button
                                                    onClick={() => setImageSelectMode(true)}
                                                    className="w-full flex items-center justify-between px-4 py-4 hover:bg-blue-600 group transition-all duration-300 rounded-[18px] text-right"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:bg-white/20 group-hover:text-white transition-all duration-300">
                                                            <ImageIcon size={22} strokeWidth={2.2} />
                                                        </div>
                                                        <span className="text-gray-700 group-hover:text-white font-normal text-xl font-arabic leading-relaxed whitespace-nowrap">نسخ الصورة</span>
                                                    </div>
                                                    <ChevronLeft size={20} className="text-gray-300 group-hover:text-white/70 transition-colors" />
                                                </button>
                                            </>
                                        ) : imageSelectMode ? (
                                            <>
                                                <div className="flex items-center px-2 pb-2 mb-1 border-b border-gray-100/50">
                                                    <button
                                                        onClick={() => setImageSelectMode(false)}
                                                        className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                                                    >
                                                        <ChevronRight size={20} />
                                                    </button>
                                                    <span className="flex-1 text-center text-gray-400 font-arabic text-sm">خيارات الصورة</span>
                                                    <div className="w-9" />
                                                </div>

                                                <button
                                                    onClick={() => handleCopy(true)}
                                                    className="w-full flex items-center justify-between px-4 py-4 hover:bg-blue-600 group transition-all duration-300 rounded-[18px] text-right"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:bg-white/20 group-hover:text-white transition-all duration-300">
                                                            <Wallet size={22} strokeWidth={2.2} />
                                                        </div>
                                                        <span className="text-gray-600 group-hover:text-white font-normal text-xl font-arabic leading-relaxed whitespace-nowrap">مع السعر (كامل)</span>
                                                    </div>
                                                </button>

                                                <div className="h-px bg-gray-100/50 mx-4 my-1" />

                                                <button
                                                    onClick={() => handleCopy(false)}
                                                    className="w-full flex items-center justify-between px-4 py-4 hover:bg-blue-600 group transition-all duration-300 rounded-[18px] text-right"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:bg-white/20 group-hover:text-white transition-all duration-300">
                                                            <FileText size={22} strokeWidth={2.2} />
                                                        </div>
                                                        <span className="text-gray-600 group-hover:text-white font-normal text-xl font-arabic leading-relaxed whitespace-nowrap">بدون السعر (ملخص)</span>
                                                    </div>
                                                </button>
                                            </>
                                        ) : paypalSelectMode ? (
                                            <>
                                                <div className="flex items-center px-2 pb-2 mb-1 border-b border-gray-100/50">
                                                    <button
                                                        onClick={() => setPaypalSelectMode(false)}
                                                        className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                                                    >
                                                        <ChevronRight size={20} />
                                                    </button>
                                                    <span className="flex-1 text-center text-gray-400 font-arabic text-sm">خيارات بايبال</span>
                                                    <div className="w-9" />
                                                </div>

                                                <button
                                                    onClick={() => { handleCopyText(true, true); setPaypalSelectMode(false); setTextSelectMode(false); }}
                                                    className="w-full flex items-center justify-between px-4 py-4 hover:bg-emerald-600 group transition-all duration-300 rounded-[18px] text-right"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center group-hover:bg-white/20 group-hover:text-white transition-all duration-300">
                                                            <Check size={22} strokeWidth={2.2} />
                                                        </div>
                                                        <span className="text-gray-600 group-hover:text-white font-normal text-xl font-arabic leading-relaxed whitespace-nowrap">مع بايبال</span>
                                                    </div>
                                                </button>

                                                <div className="h-px bg-gray-100/50 mx-4 my-1" />

                                                <button
                                                    onClick={() => { handleCopyText(true, false); setPaypalSelectMode(false); setTextSelectMode(false); }}
                                                    className="w-full flex items-center justify-between px-4 py-4 hover:bg-emerald-600 group transition-all duration-300 rounded-[18px] text-right"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center group-hover:bg-white/20 group-hover:text-white transition-all duration-300">
                                                            <X size={22} strokeWidth={2.2} />
                                                        </div>
                                                        <span className="text-gray-600 group-hover:text-white font-normal text-xl font-arabic leading-relaxed whitespace-nowrap">بدون بايبال</span>
                                                    </div>
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex items-center px-2 pb-2 mb-1 border-b border-gray-100/50">
                                                    <button
                                                        onClick={() => setTextSelectMode(false)}
                                                        className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                                                    >
                                                        <ChevronRight size={20} />
                                                    </button>
                                                    <span className="flex-1 text-center text-gray-400 font-arabic text-sm">خيارات النص</span>
                                                    <div className="w-9" />
                                                </div>

                                                <button
                                                    onClick={() => setPaypalSelectMode(true)}
                                                    className="w-full flex items-center justify-between px-4 py-4 hover:bg-emerald-600 group transition-all duration-300 rounded-[18px] text-right"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center group-hover:bg-white/20 group-hover:text-white transition-all duration-300">
                                                            <AlignLeft size={22} strokeWidth={2.2} />
                                                            <DollarSign size={14} className="absolute bottom-1 right-1" strokeWidth={3} />
                                                        </div>
                                                        <span className="text-gray-600 group-hover:text-white font-normal text-xl font-arabic leading-relaxed whitespace-nowrap">مع السعر (كامل)</span>
                                                    </div>
                                                    <ChevronLeft size={20} className="text-gray-300 group-hover:text-white/70 transition-colors" />
                                                </button>

                                                <div className="h-px bg-gray-100/50 mx-4 my-1" />

                                                <button
                                                    onClick={() => handleCopyText(false, false)}
                                                    className="w-full flex items-center justify-between px-4 py-4 hover:bg-emerald-600 group transition-all duration-300 rounded-[18px] text-right"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center group-hover:bg-white/20 group-hover:text-white transition-all duration-300">
                                                            <AlignLeft size={22} strokeWidth={2.2} />
                                                        </div>
                                                        <span className="text-gray-600 group-hover:text-white font-normal text-xl font-arabic leading-relaxed whitespace-nowrap">بدون السعر (ملخص)</span>
                                                    </div>
                                                </button>
                                            </>
                                        )}

                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <h2 className={`font-bold text-gray-800 pt-2 text-2xl font-arabic leading-relaxed px-16 break-words`}>{combinedNames}</h2>
                    <p className={`text-gray-500 text-lg mt-1 font-arabic`}>تقرير مجمع ({toHindiDigits(students.length)} طلاب)</p>
                </div >

                {/* Content */}
                < div className="p-8 space-y-6" >

                    {/* Stats Cards */}
                    < div className="grid grid-cols-2 gap-4" >
                        {/* Sessions Count */}
                        < div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 text-center space-y-2" >
                            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Calendar size={24} />
                            </div>
                            <div className="text-4xl font-bold text-gray-800 font-amiri">{toHindiDigits(stats.totalSessionCount)}</div>
                            <div className="text-lg text-gray-500 font-medium font-amiri">عدد الحصص</div>
                        </div >

                        {/* Hours Count */}
                        < div className="bg-amber-50/50 p-6 rounded-2xl border border-amber-100 text-center space-y-2" >
                            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Clock size={24} />
                            </div>
                            <div className="text-4xl font-bold text-gray-800 font-amiri">
                                {toHindiDigits(Number.isInteger(stats.totalHours) ? stats.totalHours : parseFloat(stats.totalHours.toFixed(2)))}
                            </div>
                            <div className="text-lg text-gray-500 font-medium font-amiri">عدد الساعات</div>
                        </div >
                    </div >

                    {/* Info Section */}
                    < div className="bg-gray-50 rounded-2xl p-6 border border-gray-100" >
                        {/* Main Amount Row */}
                        < div className="flex items-center justify-between" >
                            <div className="text-gray-600 font-bold text-xl font-arabic">
                                إجمالي المستحق
                            </div>
                            <div className="text-3xl font-bold text-[#d4af37] font-amiri">
                                {toHindiDigits(formattedAmount)} {currency}
                            </div>
                        </div >

                        {/* Egyptian Equivalent (for USD) */}
                        {
                            currency === 'دولار' && usdRate > 0 && (
                                <div className="text-center space-y-4 pt-6 mt-6 border-t border-dashed border-gray-200">
                                    <div className="text-gray-400 text-xl">يعادله بالمصري حالياً</div>
                                    <div className="inline-flex items-center gap-2 px-6 py-3 bg-green-50 rounded-xl">
                                        <span className="text-3xl font-bold text-green-600 font-amiri">
                                            {(() => {
                                                const egpAmount = stats.totalDueAmount * usdRate;
                                                const formatted = egpAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
                                                return toHindiDigits(formatted);
                                            })()} جنيه
                                        </span>
                                    </div>
                                </div>
                            )
                        }
                    </div >

                    {/* Individual student breakdown */}
                    < div className="pt-4 mt-2 border-t border-gray-100/30" >
                        <div className="text-gray-400 text-sm font-arabic mb-3">تفاصيل الطلاب:</div>
                        <div className="space-y-2">
                            {students.map(student => {
                                let sessionCount = 0;
                                Object.entries(attendance).forEach(([key, status]) => {
                                    const [id, , keyMonth, keyYear] = key.split('_');
                                    if (id === student.id && parseInt(keyMonth) === month && parseInt(keyYear) === year) {
                                        if (status === AttendanceStatus.PRESENT || status === AttendanceStatus.PAID_ABSENCE) {
                                            sessionCount++;
                                        } else if (status === AttendanceStatus.DOUBLE_CLASS) {
                                            sessionCount++; // Count as 1 visit
                                        }
                                    }
                                });
                                return (
                                    <div key={student.id} className="flex items-center justify-between text-gray-500 text-base">
                                        <span className="font-arabic">{student.name}</span>
                                        <span className="font-amiri">{toHindiDigits(sessionCount)} حصة</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div >

                </div >
            </div >
        </div >
    );
};

export default MultiStudentDetailsModal;
