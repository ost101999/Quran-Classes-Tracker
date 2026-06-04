import React, { useRef, useState } from 'react';
import { X, Calendar, Clock, Calculator, Copy, Check, DollarSign, Wallet, FileText, AlignLeft, ChevronLeft, ChevronRight, Image as ImageIcon, Link } from 'lucide-react';
import { Student, AttendanceRecord, AttendanceStatus } from '../types';
import { toBlob } from 'html-to-image';

interface Props {
    student: Student;
    attendance: AttendanceRecord;
    onClose: () => void;
    month: number;
    year: number;
    usdRate: number;
    onOpenLink?: (url: string, title?: string) => void;
    billingStartDay?: number;
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

export default function StudentDetailsModal({ student, attendance, onClose, month, year, usdRate, onOpenLink, billingStartDay = 1 }: Props) {
    const reportRef = useRef<HTMLDivElement>(null);
    const [isCopying, setIsCopying] = useState(false);
    const [isCopyingLink, setIsCopyingLink] = useState(false);
    const [includePricing, setIncludePricing] = useState(true);
    const [showCopyMenu, setShowCopyMenu] = useState(false);
    const [textSelectMode, setTextSelectMode] = useState(false);
    const [imageSelectMode, setImageSelectMode] = useState(false);
    const [paypalSelectMode, setPaypalSelectMode] = useState(false);
    const [reportLanguage, setReportLanguage] = useState<'ar' | 'en'>(/[a-zA-Z]/.test(student.name) ? 'en' : 'ar');
    const isEnglish = reportLanguage === 'en';
    const isNameEnglish = /[a-zA-Z]/.test(student.name);

    // Calculate stats
    const getStudentStats = () => {
        let visitsCount = 0;
        let unitsCount = 0;
        let transferredCount = 0;

        // Iterate through all days to count PRESENT status for this student
        Object.entries(attendance).forEach(([key, status]) => {
            // Key format: "studentId_day_month_year" (e.g., "1_15_0_2026")
            const parts = key.split('_');
            const id = parts[0];
            const dayNum = parseInt(parts[1]);
            const keyMonth = parseInt(parts[2]);
            const keyYear = parseInt(parts[3]);

            if (id === student.id && keyMonth === month && keyYear === year) {
                if (billingStartDay > 1 && dayNum >= billingStartDay) {
                    return; // Skip, transferred to next month
                }
                if (status === AttendanceStatus.PRESENT || status === AttendanceStatus.PAID_ABSENCE) {
                    visitsCount++;
                    unitsCount++;
                } else if (status === AttendanceStatus.DOUBLE_CLASS) {
                    visitsCount++;     // Counts as 1 visit
                    unitsCount += 2;   // Counts as 2 units for billing/time
                }
            }
        });

        // Scan previous month for TRANSFERRED sessions
        // These are sessions marked as transferred in the previous month, so they count for THIS month.
        let prevMonth = month - 1;
        let prevYear = year;
        if (prevMonth < 0) {
            prevMonth = 11;
            prevYear = year - 1;
        }
        const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();

        for (let d = 1; d <= daysInPrevMonth; d++) {
            const key = `${student.id}_${d}_${prevMonth}_${prevYear}`;
            const status = attendance[key];
            const isTransferred = status === AttendanceStatus.TRANSFERRED || 
                                  status === AttendanceStatus.TRANSFERRED_ABSENT ||
                                  (billingStartDay > 1 && d >= billingStartDay && (
                                      status === AttendanceStatus.PRESENT || 
                                      status === AttendanceStatus.PAID_ABSENCE || 
                                      status === AttendanceStatus.DOUBLE_CLASS ||
                                      status === AttendanceStatus.UNEXCUSED_ABSENCE ||
                                      status === AttendanceStatus.ABSENCE_RED
                                  ));

            if (isTransferred) {
                const count = (status === AttendanceStatus.DOUBLE_CLASS) ? 2 : 1;
                visitsCount++;
                unitsCount += count;
                transferredCount += count;
            }
        }

        // Calculate hours
        let hours = 0;
        let durationText = '';

        const normalizedDuration = toWesternDigits(student.duration);
        const durationMinutes = parseInt(normalizedDuration);

        if (!isNaN(durationMinutes)) {
            hours = Math.round((unitsCount * durationMinutes) / 60 * 4) / 4;
            durationText = `${student.duration} دقيقة`;
        } else if (student.duration === 'خليط') {
            hours = unitsCount * 0.5;
            durationText = 'خليط (٣٠/٦٠ دقيقة)';
        } else {
            // text or unspecified
            durationText = student.duration || 'غير محدد';
        }

        return { sessionCount: visitsCount, unitsCount, hours, durationText, transferredCount };
    };

    const stats = getStudentStats();

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

    const handleCopyWebLink = async (e?: React.MouseEvent) => {
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
        const url = nameSlug
            ? `https://quranreport.vercel.app/${nameSlug}`
            : `https://quranreport.vercel.app/?student=${student.id}`;

        if (e && (e.ctrlKey || e.metaKey)) {
            if (onOpenLink) {
                onOpenLink(url, student.name);
                return;
            }
        }

        try {
            await navigator.clipboard.writeText(url);
            setIsCopyingLink(true);
            setTimeout(() => setIsCopyingLink(false), 2000);
        } catch (err) {
            console.error('Failed to copy link:', err);
        }
    };

    const handleCopyText = async (withPricing: boolean = false, withPaypal: boolean = true) => {
        // Use the passed year and month for the report date
        const dateForMonthName = new Date(year, month, 1);
        const currentMonthName = dateForMonthName.toLocaleDateString(isEnglish ? 'en-US' : 'ar-SA', { month: 'long', year: 'numeric' });
        const lines: string[] = [];

        // Header - date only for single student
        if (isEnglish) {
            lines.push(`🗓️ ${currentMonthName}`);
        } else {
            lines.push(`🗓️ ${currentMonthName}`);
        }
        lines.push('');

        // Use computed student stats
        const visitsCount = stats.sessionCount;
        const unitsCount = stats.unitsCount;

        const normalizedDuration = toWesternDigits(student.duration);
        const durationMinutes = parseInt(normalizedDuration);
        let durationVal = 0;
        if (!isNaN(durationMinutes)) {
            durationVal = durationMinutes / 60;
        } else {
            if (student.duration === '٣٠' || student.duration === '30' || student.duration === 'خليط') durationVal = 0.5;
            else durationVal = 1;
        }

        // Use unitsCount for hours calculation logic similar to Academy modal
        // In Academy modal: studentHours = studentClasses * durationVal
        // Here, we track unitsCount carefully. 
        // Logic check: Academy logic:
        // if PRESENT/PAID_ABSENCE -> classes++
        // if DOUBLE -> classes += 2
        // hours = classes * durationVal

        // This matches 'unitsCount' here exactly.
        const studentHours = Math.round(unitsCount * durationVal * 4) / 4;
        const fmtHours = (n: number) => Number.isInteger(n) ? n.toString() : parseFloat(n.toFixed(2)).toString();

        lines.push('──────────────');


        // Footer (Totals)
        if (isEnglish) {
            lines.push(`*Total:*`);
            lines.push(`⏱️ ${fmtHours(studentHours)} Hours`);
            lines.push(`📚 ${visitsCount} Sessions`);
        } else {
            lines.push(`*الإجمالي:*`);
            lines.push(`⏱️ ${toHindiDigits(fmtHours(studentHours))} ${getHoursPlural(studentHours)}`);
            lines.push(`📚 ${toHindiDigits(visitsCount)} ${getSessionsPlural(visitsCount)}`);
        }

        if (withPricing) {
            lines.push('');
            lines.push('──────────────');
            lines.push(isEnglish ? '*Payment Details:*' : '*تفاصيل الحساب:*');

            // Calculate total again or reuse (better to calc here for safety in text context)
            const dueAmount = (student.paymentBasis === 'بالساعة')
                ? (unitsCount * (parseInt(toWesternDigits(student.duration || '٣٠')) || 30) / 60) * student.rate
                : unitsCount * student.rate;

            const formattedAmount = dueAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
            const curr = student.location || 'جنيه';

            if (isEnglish) {
                lines.push(`${formattedAmount} ${curr === 'دولار' ? 'USD' : (curr === 'جنيه' ? 'L.E' : curr)}`);
            } else {
                lines.push(`${toHindiDigits(formattedAmount)} ${curr}`);
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
        } catch (err) {
            console.error('Failed to copy text:', err);
        }
    };


    const totalDueAmount = (student.paymentBasis === 'بالساعة')
        ? (stats.unitsCount * (parseInt(toWesternDigits(student.duration || '٣٠')) || 30) / 60) * student.rate
        : stats.unitsCount * student.rate;

    const formattedAmount = totalDueAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 font-arabic"
            onClick={onClose}
        >
            {/* Hidden capture template - PIXEL PERFECT REFINEMENT */}
            <div className="fixed -left-[9999px] top-0 overflow-hidden">
                <div
                    ref={reportRef}
                    dir={isEnglish ? 'ltr' : 'rtl'}
                    className="bg-white p-12 w-[650px] flex flex-col items-center text-center rounded-[50px] shadow-2xl"
                    style={{ fontFamily: isEnglish ? '"Acme", sans-serif' : "'DecoType Naskh', cursive" }}
                >
                    <div className="w-full pb-10">
                        <h2 className={`font-bold text-gray-900 ${isEnglish ? 'text-5xl' : 'text-6xl'} tracking-tight`}>
                            {student.name}
                        </h2>
                        <p className={`text-gray-400 mt-3 font-medium ${isEnglish ? 'text-2xl' : 'text-3xl'}`}>
                            {isEnglish ? 'Attendance Report' : 'تقرير الحضور'}
                        </p>
                    </div>

                    <div className="w-full grid grid-cols-2 gap-8 mb-10 px-4">
                        {/* Right side in Arabic (Sessions), Left side in English (Sessions) */}
                        {isEnglish ? (
                            <>
                                {/* Sessions Card */}
                                <div className="bg-[#eff6ff] border border-[#dbeafe] p-10 rounded-[45px] flex flex-col items-center gap-6 shadow-sm">
                                    <div className="w-20 h-20 bg-[#dbeafe] text-[#2563eb] rounded-full flex items-center justify-center shadow-sm">
                                        <Calendar size={40} strokeWidth={2.5} />
                                    </div>
                                    <span
                                        className="text-8xl font-bold text-gray-900 leading-none flex flex-col items-center"
                                        style={{ fontFamily: '"Tajawal", sans-serif' }}
                                    >
                                        {stats.sessionCount}
                                        {stats.transferredCount > 0 && (
                                            <span className="text-2xl text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 font-normal mt-2" title="Included Transferred Sessions">
                                                +{stats.transferredCount} ↩
                                            </span>
                                        )}
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
                                        {Number.isInteger(stats.hours) ? stats.hours : stats.hours}
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
                                    <span className="text-8xl font-bold text-gray-900 leading-none flex flex-col items-center">
                                        {toHindiDigits(stats.sessionCount)}
                                        {stats.transferredCount > 0 && (
                                            <span className="text-2xl text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 font-normal mt-2" title="حصص مرحلة من الشهر السابق">
                                                +{toHindiDigits(stats.transferredCount)} ↩
                                            </span>
                                        )}
                                    </span>
                                    <span className="text-gray-600 font-normal text-4xl">عدد الحصص</span>
                                </div>

                                {/* Hours Card (Left side in RTL) */}
                                <div className="bg-[#fffbeb] border border-[#fef3c7] p-10 rounded-[45px] flex flex-col items-center gap-6 shadow-sm">
                                    <div className="w-20 h-20 bg-[#fef3c7] text-[#d97706] rounded-full flex items-center justify-center shadow-sm">
                                        <Clock size={40} strokeWidth={2.5} />
                                    </div>
                                    <span className="text-8xl font-bold text-gray-900 leading-none">
                                        {toHindiDigits(stats.hours)}
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
                                        {isEnglish ? formattedAmount : toHindiDigits(formattedAmount)} {isEnglish ? (student.location === 'دولار' ? 'USD' : (student.location === 'جنيه' ? 'L.E' : student.location)) : student.location}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="text-gray-500 font-semibold text-xl mb-6">
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

                    <div className="absolute right-6 top-1/2 -translate-y-1/2 flex gap-2">
                        <button
                            onClick={(e) => handleCopyWebLink(e)}
                            className={`p-2 rounded-full transition-all duration-300 ${isCopyingLink ? 'bg-emerald-50 text-emerald-500 scale-110' : 'hover:bg-purple-50 text-purple-600 hover:scale-110 active:scale-95'
                                }`}
                            title={isEnglish ? 'Copy Web Link' : 'نسخ رابط الطالب'}
                        >
                            {isCopyingLink ? <Check size={24} strokeWidth={3} /> : <Link size={24} strokeWidth={2.5} />}
                        </button>

                        <button
                            onClick={() => setShowCopyMenu(!showCopyMenu)}
                            className={`p-2 rounded-full transition-all duration-300 ${isCopying ? 'bg-emerald-50 text-emerald-500 scale-110' : 'hover:bg-blue-50 text-blue-600 hover:scale-110 active:scale-95'
                                }`}
                            title={isEnglish ? 'Copy Report' : 'نسخ التقرير'}
                        >
                            {isCopying ? <Check size={24} strokeWidth={3} /> : <Copy size={24} strokeWidth={2.5} />}
                        </button>

                        {/* Copy Menu Dropdown */}
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

                    <h2
                        className={`font-bold text-gray-800 pt-2 px-20 break-words ${isNameEnglish ? 'text-2xl font-english' : 'text-3xl font-arabic'}`}
                        onClick={(e) => {
                            if (e.ctrlKey || e.metaKey) {
                                handleCopyWebLink(e);
                            }
                        }}
                        title={isEnglish ? 'Ctrl+Click to open student portal' : 'Ctrl+Click لفتح واجهة الطالب'}
                    >
                        {student.name}
                    </h2>
                    <p className={`text-gray-500 text-lg mt-1 ${isNameEnglish ? 'font-english' : 'font-arabic'}`}>{student.academy}</p>
                </div>

                {/* Content */}
                <div className="p-8 space-y-6">

                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* Sessions Count */}
                        <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 text-center space-y-2">
                            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Calendar size={24} />
                            </div>
                            <div className="text-4xl font-bold text-gray-800 font-amiri flex items-center justify-center gap-2">
                                {toHindiDigits(stats.sessionCount)}
                                {stats.transferredCount > 0 && (
                                    <span className="text-sm text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 font-normal self-center" title="حصص مرحلة من الشهر السابق">
                                        +{toHindiDigits(stats.transferredCount)} ↩
                                    </span>
                                )}
                            </div>
                            <div className="text-lg text-gray-500 font-medium font-amiri">عدد الحصص</div>
                        </div>

                        {/* Hours Count */}
                        <div className="bg-amber-50/50 p-6 rounded-2xl border border-amber-100 text-center space-y-2">
                            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Clock size={24} />
                            </div>
                            <div className="text-4xl font-bold text-gray-800 font-amiri">
                                {toHindiDigits(Number.isInteger(stats.hours) ? stats.hours : parseFloat(stats.hours.toFixed(2)))}
                            </div>
                            <div className="text-lg text-gray-500 font-medium font-amiri">عدد الساعات</div>
                        </div>
                    </div>

                    {/* Info Section */}
                    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                        {/* Main Amount Row - Label RIGHT, Amount LEFT */}
                        <div className="flex items-center justify-between">
                            <div className="text-gray-600 font-bold text-xl font-arabic">
                                إجمالي المستحق
                            </div>
                            <div className="text-3xl font-bold text-[#d4af37] font-amiri">
                                {toHindiDigits(formattedAmount)} {student.location}
                            </div>
                        </div>

                        {/* Egyptian Equivalent (for USD) */}
                        {student.location === 'دولار' && usdRate > 0 && (
                            <div className="text-center space-y-4 pt-6 mt-6 border-t border-dashed border-gray-200">
                                <div className="text-gray-400 text-xl">يعادله بالمصري حالياً</div>
                                <div className="inline-flex items-center gap-2 px-6 py-3 bg-green-50 rounded-xl">
                                    <span className="text-3xl font-bold text-green-600 font-amiri">
                                        {(() => {
                                            const egpAmount = totalDueAmount * usdRate;
                                            const formatted = egpAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
                                            return toHindiDigits(formatted);
                                        })()} جنيه
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>


                    {/* Footer / Bottom Margin Info */}
                    <div className="pt-4 mt-2 flex flex-row items-center justify-center gap-8 text-red-300 text-lg font-arabic opacity-70 border-t border-gray-100/30">
                        <span>مدة الحصة: {toHindiDigits(stats.durationText)}</span>
                        <span className="w-0.5 h-4 bg-red-200/50"></span>
                        <span>{student.paymentBasis === 'بالساعة' ? 'سعر الساعة' : 'سعر الحصة'}: {toHindiDigits(student.rate)} {student.location}</span>
                    </div>

                </div>
            </div>
        </div>
    );
};


