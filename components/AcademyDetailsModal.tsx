import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, Clock, Copy, Check, Wallet, FileText, AlignLeft, DollarSign, ChevronRight, ChevronLeft, Trash2, Edit2, ShieldAlert, ExternalLink, RotateCcw, Users, Image as ImageIcon } from 'lucide-react';
import { Student, AttendanceRecord, AttendanceStatus } from '../types';
import { toBlob } from 'html-to-image';

interface Props {
    academyName: string;
    students: Student[];
    attendance: AttendanceRecord;
    month: number;
    onClose: () => void;
    onDelete: () => void;
    onUpdate: (oldName: string, newName: string, rate: number, currency: string, monthlyDeductions: Record<string, number>, billingStartDay: number, externalLink: string, holidays: number[], disableReports?: boolean) => void;
    academyRate?: { rate: number; currency: string; deductedMinutes?: number; monthlyDeductions?: Record<string, number>; billingStartDay?: number; externalLink?: string; holidays?: number[], disableReports?: boolean };
    month: number;
    year: number;
    usdRate: number;
}

// Helper to convert Hindi digits to Western
const toWesternDigits = (str: string): string => {
    if (!str) return '';
    return str.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
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

// Helper to convert Western digits to Hindi
const toHindiDigits = (num: number | string): string => {
    return num.toString()
        .replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)])
        .replace(/\./g, ",");
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

const AcademyDetailsModal: React.FC<Props> = ({ academyName, students, attendance, month, year, onClose, onDelete, onUpdate, academyRate, usdRate }) => {
    const reportRef = useRef<HTMLDivElement>(null);
    const [isCopying, setIsCopying] = useState(false);
    const [includePricing, setIncludePricing] = useState(true);
    const [includeBreakdown, setIncludeBreakdown] = useState(false);
    const [showCopyMenu, setShowCopyMenu] = useState(false);
    const [textSelectMode, setTextSelectMode] = useState(false);
    const [imageSelectMode, setImageSelectMode] = useState(false);
    const [paypalSelectMode, setPaypalSelectMode] = useState(false);
    const [reportLanguage, setReportLanguage] = useState<'ar' | 'en'>(/[a-zA-Z]/.test(academyName) ? 'en' : 'ar');
    const isEnglish = reportLanguage === 'en';
    const isNameEnglish = /[a-zA-Z]/.test(academyName);

    const fmtHours = (n: number) => Number.isInteger(n) ? n.toString() : parseFloat(n.toFixed(2)).toString();

    const activeStudents = students.filter(s => s.academy === academyName);

    const getStudentStatsForAcademy = (student: Student) => {
        let studentClasses = 0;
        let studentTransferred = 0;

        // Iterate through all days to count PRESENT status for this student
        Object.entries(attendance).forEach(([key, status]) => {
            const parts = key.split('_');
            const id = parts[0];
            const dayNum = parseInt(parts[1]);
            const keyMonth = parseInt(parts[2]);
            const keyYear = parseInt(parts[3]);

            if (id === student.id && keyMonth === month && keyYear === year) {
                const billingStartDay = academyRate?.billingStartDay || 1;
                if (billingStartDay > 1 && dayNum >= billingStartDay) {
                    return; // Skip: transferred/deferred to next month
                }
                if (status === AttendanceStatus.PRESENT || status === AttendanceStatus.PAID_ABSENCE) {
                    studentClasses++;
                } else if (status === AttendanceStatus.DOUBLE_CLASS) {
                    studentClasses += 2;
                }
            }
        });

        // Scan previous month for TRANSFERRED sessions
        let prevMonth = month - 1;
        let prevYear = year;
        if (prevMonth < 0) {
            prevMonth = 11;
            prevYear = year - 1;
        }
        const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();
        const billingStartDay = academyRate?.billingStartDay || 1;

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
                studentClasses += count;
                studentTransferred += count;
            }
        }

        const normalizedDuration = toWesternDigits(student.duration);
        const durationMinutes = parseInt(normalizedDuration);

        let durationVal = 0;
        if (!isNaN(durationMinutes)) {
            durationVal = durationMinutes / 60;
        } else {
            if (student.duration === '٣٠' || student.duration === '30' || student.duration === 'خليط') durationVal = 0.5;
            else durationVal = 1;
        }

        const studentHours = studentClasses * durationVal;

        return { studentClasses, studentTransferred, studentHours, durationVal };
    };

    // Calculate aggregated stats
    const getAcademyStats = () => {
        let totalClasses = 0;
        let totalHours = 0;
        let totalTransferred = 0;
        const incomeByCurrency: Record<string, number> = {};

        activeStudents.forEach(student => {
            const { studentClasses, studentTransferred, studentHours, durationVal } = getStudentStatsForAcademy(student);

            totalTransferred += studentTransferred;
            totalClasses += studentClasses;
            totalHours += studentHours;

            // Calculate income
            const currency = student.location || 'جنيه';
            if (!incomeByCurrency[currency]) incomeByCurrency[currency] = 0;

            if (student.paymentBasis === 'بالساعة' || student.duration === 'خليط') {
                incomeByCurrency[currency] += studentClasses * durationVal * student.rate;
            } else {
                incomeByCurrency[currency] += studentClasses * student.rate;
            }
        });

        // Apply Month-Specific Deduction (Fallback to old format if necessary)
        const monthKey = `${month}_${year}`;
        const deduction = academyRate?.monthlyDeductions?.[monthKey] ?? academyRate?.deductedMinutes ?? 0;
        if (deduction > 0) {
            totalHours = Math.max(0, totalHours - (deduction / 60));

            // Apply income deduction to the academy's specific currency
            const academyCurrency = academyRate?.currency || 'جنيه';
            if (!incomeByCurrency[academyCurrency]) incomeByCurrency[academyCurrency] = 0;
            incomeByCurrency[academyCurrency] = Math.max(0, incomeByCurrency[academyCurrency] - ((deduction / 60) * (academyRate?.rate || 0)));
        }

        return { totalClasses, totalHours, incomeByCurrency, appliedDeduction: deduction, totalTransferred };
    };

    const stats = getAcademyStats();
    const currencies = Object.keys(stats.incomeByCurrency);

    const [confirmDelete, setConfirmDelete] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const monthKey = `${month}_${year}`;
    const initialDeduction = academyRate?.monthlyDeductions?.[monthKey] ?? academyRate?.deductedMinutes ?? 0;
    const [editedDeduction, setEditedDeduction] = useState(initialDeduction);
    const [editedName, setEditedName] = useState(academyName);
    const [editedRate, setEditedRate] = useState(academyRate?.rate || 0);
    const [editedCurrency, setEditedCurrency] = useState(academyRate?.currency || 'جنيه');
    const [editedBillingStartDay, setEditedBillingStartDay] = useState(academyRate?.billingStartDay || 1);
    const [editedLink, setEditedLink] = useState(academyRate?.externalLink || '');
    const [deductionHistory, setDeductionHistory] = useState<number[]>([initialDeduction]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [editedDisableReports, setEditedDisableReports] = useState(academyRate?.disableReports || false);

    const handleCopy = async (withPricing: boolean, withBreakdown: boolean = false) => {
        if (!reportRef.current || isCopying) return;

        // Temporarily set the states for capture
        setIncludePricing(withPricing);
        setIncludeBreakdown(withBreakdown);
        setShowCopyMenu(false);
        setIsCopying(true);

        // Small delay to ensure state update is reflected in the hidden DOM
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

        // Header
        if (isEnglish) {
            lines.push(`*${academyName.trim()}*`);
            lines.push(`🗓️ ${currentMonthName}`);
        } else {
            lines.push(`*${academyName.trim()}*`);
            lines.push(`🗓️ ${currentMonthName}`);
        }
        lines.push('');

        // Students Breakdown
        const academyStudents = activeStudents;

        academyStudents.forEach(student => {
            const { studentClasses, studentHours } = getStudentStatsForAcademy(student);
            const formattedHours = fmtHours(studentHours);

            // Only add if they have stats
            if (studentClasses > 0) {
                if (isEnglish) {
                    lines.push(`🔹 *${student.name.trim()}*`);
                    lines.push(`   ${formattedHours} Hours  |  ${studentClasses} Sessions`);
                } else {
                    lines.push(`🔹 *${student.name.trim()}*`);
                    lines.push(`   ${toHindiDigits(formattedHours)} ${getHoursPlural(studentHours)}  |  ${toHindiDigits(studentClasses)} ${getSessionsPlural(studentClasses)}`);
                }
                lines.push('');
            }
        });

        lines.push('──────────────');

        // Footer (Totals)
        if (isEnglish) {
            lines.push(`*Total:*`);
            lines.push(`⏱️ ${fmtHours(stats.totalHours)} Hours`);
            lines.push(`📚 ${stats.totalClasses} Sessions`);
        } else {
            lines.push(`*الإجمالي:*`);
            lines.push(`⏱️ ${toHindiDigits(fmtHours(stats.totalHours))} ${getHoursPlural(stats.totalHours)}`);
            lines.push(`📚 ${toHindiDigits(stats.totalClasses)} ${getSessionsPlural(stats.totalClasses)}`);
        }

        if (withPricing) {
            lines.push('');
            lines.push('──────────────');
            lines.push(isEnglish ? '*Payment Details:*' : '*تفاصيل الحساب:*');

            currencies.forEach(curr => {
                const amount = stats.incomeByCurrency[curr];
                const formattedAmount = amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
                if (isEnglish) {
                    lines.push(`${formattedAmount} ${curr === 'دولار' ? 'USD' : (curr === 'جنيه' ? 'L.E' : curr)}`);
                } else {
                    lines.push(`${toHindiDigits(formattedAmount)} ${curr}`);
                }
            });
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

    const undoDeduction = () => {
        if (historyIndex > 0) {
            const prev = deductionHistory[historyIndex - 1];
            setEditedDeduction(prev);
            setHistoryIndex(historyIndex - 1);
            const newMonthlyDeductions = { ...(academyRate?.monthlyDeductions || {}) };
            newMonthlyDeductions[`${month}_${year}`] = prev;
            onUpdate(academyName, editedName, editedRate, editedCurrency, newMonthlyDeductions, editedBillingStartDay, editedLink, academyRate?.holidays || [], editedDisableReports);
        }
    };

    const redoDeduction = () => {
        if (historyIndex < deductionHistory.length - 1) {
            const next = deductionHistory[historyIndex + 1];
            setEditedDeduction(next);
            setHistoryIndex(historyIndex + 1);
            const newMonthlyDeductions = { ...(academyRate?.monthlyDeductions || {}) };
            newMonthlyDeductions[`${month}_${year}`] = next;
            onUpdate(academyName, editedName, editedRate, editedCurrency, newMonthlyDeductions, editedBillingStartDay, editedLink, academyRate?.holidays || [], editedDisableReports);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const activeElement = document.activeElement;
            const isInputFocused = activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement;

            if (!isInputFocused) return;

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                if (e.shiftKey) {
                    e.preventDefault();
                    redoDeduction();
                } else {
                    e.preventDefault();
                    undoDeduction();
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                redoDeduction();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [historyIndex, deductionHistory, editedName, editedRate, editedCurrency, editedDeduction]);

    const handleSave = () => {
        const newMonthlyDeductions = { ...(academyRate?.monthlyDeductions || {}) };
        newMonthlyDeductions[`${month}_${year}`] = editedDeduction;
        onUpdate(academyName, editedName, editedRate, editedCurrency, newMonthlyDeductions, editedBillingStartDay, editedLink, academyRate?.holidays || [], editedDisableReports);
        setIsEditing(false);
    };

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
                            {academyName}
                        </h2>
                        <p className={`text-gray-400 mt-3 font-medium ${isEnglish ? 'text-2xl' : 'text-3xl'}`}>
                            {isEnglish ? 'Academy Report' : 'تقرير الأكاديمية'}
                        </p>
                    </div>

                    <div className="w-full grid grid-cols-2 gap-8 mb-10 px-4">
                        {/* Right side in Arabic (Sessions), Left side in English (Sessions) */}
                        {isEnglish ? (
                            <>
                                {/* Hours Card */}
                                <div className="bg-[#fffbeb] border border-[#fef3c7] p-10 rounded-[45px] flex flex-col items-center gap-6 shadow-sm">
                                    <div className="w-20 h-20 bg-[#fef3c7] text-[#d97706] rounded-full flex items-center justify-center shadow-sm">
                                        <Clock size={40} strokeWidth={2.5} />
                                    </div>
                                    <span
                                        className="text-8xl font-bold text-gray-900 leading-none"
                                        style={{ fontFamily: '"Tajawal", sans-serif' }}
                                    >
                                        {fmtHours(stats.totalHours)}
                                    </span>
                                    <span className="text-gray-600 font-normal text-3xl">Hours</span>
                                </div>

                                {/* Sessions Card */}
                                <div className="bg-[#eff6ff] border border-[#dbeafe] p-10 rounded-[45px] flex flex-col items-center gap-6 shadow-sm">
                                    <div className="w-20 h-20 bg-[#dbeafe] text-[#2563eb] rounded-full flex items-center justify-center shadow-sm">
                                        <Calendar size={40} strokeWidth={2.5} />
                                    </div>
                                    <span
                                        className="text-8xl font-bold text-gray-900 leading-none flex flex-col items-center"
                                        style={{ fontFamily: '"Tajawal", sans-serif' }}
                                    >
                                        {stats.totalClasses}
                                        {stats.totalTransferred > 0 && (
                                            <span className="text-2xl text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 font-normal mt-2" title="Included Transferred Sessions">
                                                +{stats.totalTransferred} ↩
                                            </span>
                                        )}
                                    </span>
                                    <span className="text-gray-600 font-normal text-3xl">Sessions</span>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Hours Card (Left side in RTL) */}
                                <div className="bg-[#fffbeb] border border-[#fef3c7] p-10 rounded-[45px] flex flex-col items-center gap-6 shadow-sm">
                                    <div className="w-20 h-20 bg-[#fef3c7] text-[#d97706] rounded-full flex items-center justify-center shadow-sm">
                                        <Clock size={40} strokeWidth={2.5} />
                                    </div>
                                    <span className="text-8xl font-bold text-gray-900 leading-none">
                                        {toHindiDigits(fmtHours(stats.totalHours))}
                                    </span>
                                    <span className="text-gray-600 font-normal text-4xl">عدد الساعات</span>
                                </div>

                                {/* Sessions Card (Right side in RTL) */}
                                <div className="bg-[#eff6ff] border border-[#dbeafe] p-10 rounded-[45px] flex flex-col items-center gap-6 shadow-sm">
                                    <div className="w-20 h-20 bg-[#dbeafe] text-[#2563eb] rounded-full flex items-center justify-center shadow-sm">
                                        <Calendar size={40} strokeWidth={2.5} />
                                    </div>
                                    <span className="text-8xl font-bold text-gray-900 leading-none flex flex-col items-center">
                                        {toHindiDigits(stats.totalClasses)}
                                        {stats.totalTransferred > 0 && (
                                            <span className="text-2xl text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 font-normal mt-2" title="حصص مرحلة من الشهر السابق">
                                                +{toHindiDigits(stats.totalTransferred)} ↩
                                            </span>
                                        )}
                                    </span>
                                    <span className="text-gray-600 font-normal text-4xl">عدد الحصص</span>
                                </div>
                            </>
                        )}
                    </div>

                    {includePricing && (
                        <div className="w-full space-y-6 px-4">
                            {currencies.map(curr => (
                                <div key={curr} className="bg-gray-50/50 rounded-[45px] p-10 border border-gray-100 flex flex-col gap-6">
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
                                            {isEnglish ? stats.incomeByCurrency[curr].toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : toHindiDigits(stats.incomeByCurrency[curr].toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }))} {isEnglish ? (curr === 'دولار' ? 'USD' : (curr === 'جنيه' ? 'L.E' : curr)) : curr}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {includeBreakdown && (
                        <div className="w-full px-4 mt-2">
                            <div className="bg-gray-50/50 rounded-[45px] p-8 border border-gray-100 overflow-hidden">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-gray-200">
                                            <th className={`pb-4 text-gray-400 font-medium ${isEnglish ? 'text-xl text-left' : 'text-2xl text-right'} px-4`}>
                                                {isEnglish ? 'Student' : 'الطالب'}
                                            </th>
                                            <th className={`pb-4 text-gray-400 font-medium ${isEnglish ? 'text-xl text-center' : 'text-2xl text-center'} px-4`}>
                                                {isEnglish ? 'Sessions' : 'الحصص'}
                                            </th>
                                            <th className={`pb-4 text-gray-400 font-medium ${isEnglish ? 'text-xl text-center' : 'text-2xl text-center'} px-4`}>
                                                {isEnglish ? 'Hours' : 'الساعات'}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {activeStudents.map(student => {
                                            const { studentClasses, studentHours } = getStudentStatsForAcademy(student);

                                            return (
                                                <tr key={student.id}>
                                                    <td className={`py-4 ${isEnglish ? 'text-2xl text-left' : 'text-3xl text-right'} px-4 text-gray-700`}>
                                                        {student.name}
                                                    </td>
                                                    <td className={`py-4 text-center ${isEnglish ? 'text-2xl' : 'text-3xl'} px-4 text-gray-600`}>
                                                        {isEnglish ? studentClasses : toHindiDigits(studentClasses)}
                                                    </td>
                                                    <td className={`py-4 ${isEnglish ? 'text-2xl text-center font-semibold' : 'text-3xl text-center font-semibold'} px-4 text-gray-800`}>
                                                        {isEnglish ? fmtHours(studentHours) : toHindiDigits(fmtHours(studentHours))}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
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
                <div className="relative z-10 p-5 text-center border-b border-gray-100 bg-gray-50/50">
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
                            title={isEnglish ? 'Copy Academy Report' : 'نسخ تقرير الأكاديمية'}
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

                                                {/* Academy Specific: Hours Report */}
                                                <div className="h-px bg-gray-100/50 mx-4 my-1" />

                                                <button
                                                    onClick={() => handleCopy(true, true)}
                                                    className="w-full flex items-center justify-between px-4 py-4 hover:bg-blue-600 group transition-all duration-300 rounded-[18px] text-right"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:bg-white/20 group-hover:text-white transition-all duration-300">
                                                            <Users size={22} strokeWidth={2.2} />
                                                        </div>
                                                        <span className="text-gray-600 group-hover:text-white font-normal text-xl font-arabic leading-relaxed whitespace-nowrap">مفصل بالطلبة</span>
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

                    {
                        !isEditing ? (
                            <div className="pt-2">
                                <h2 className={`text-2xl font-bold text-gray-800 cursor-pointer hover:text-blue-600 transition-colors ${isNameEnglish ? 'font-english' : 'font-arabic'}`} onClick={() => setIsEditing(true)}>
                                    {academyName}
                                </h2>
                                <p className={`text-gray-500 text-xl mt-1 ${isEnglish ? 'font-english' : 'font-arabic'}`}>{isEnglish ? 'Academy Report' : 'تقرير الأكاديمية'}</p>
                            </div>
                        ) : (
                            <div className="pt-2 px-10 space-y-3">
                                <input
                                    autoFocus
                                    value={editedName}
                                    onChange={(e) => setEditedName(e.target.value)}
                                    className="w-full text-center text-xl font-bold border-b-2 border-blue-500 outline-none bg-transparent"
                                />
                                <div className="flex items-center justify-center gap-3">
                                    <label className="text-sm text-gray-500">سعر الساعة:</label>
                                    <input
                                        type="number"
                                        value={editedRate}
                                        onChange={(e) => setEditedRate(Number(e.target.value))}
                                        className="w-20 text-center border rounded-lg p-1"
                                    />
                                    <select
                                        value={editedCurrency}
                                        onChange={(e) => setEditedCurrency(e.target.value)}
                                        className="border rounded-lg p-1 text-sm text-gray-600"
                                    >
                                        <option value="جنيه">جنيه</option>
                                        <option value="دولار">دولار</option>
                                        <option value="ريال">ريال</option>
                                    </select>
                                </div>
                                <div className="flex items-center justify-center gap-3">
                                    <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
                                        {isValidUrl(editedLink) && (
                                            <div className="flex items-center gap-1 animate-in fade-in zoom-in duration-300">
                                                <div className="bg-emerald-100 text-emerald-600 rounded-full p-0.5 shadow-sm border border-emerald-200">
                                                    <Check size={12} strokeWidth={4} />
                                                </div>
                                            </div>
                                        )}
                                        <label className="text-sm text-gray-500 font-arabic whitespace-nowrap">الرابط:</label>
                                    </div>
                                    <input
                                        value={editedLink}
                                        onChange={(e) => setEditedLink(e.target.value)}
                                        placeholder="رابط ملف الأكاديمية"
                                        className={`flex-1 border rounded-lg p-1 text-xs dir-ltr transition-all duration-300 ${isValidUrl(editedLink) ? 'text-gray-900 font-medium' : 'text-gray-400'}`}
                                        style={{ direction: 'ltr' }}
                                    />
                                </div>
                                <div className="flex items-center justify-center gap-2 pt-2">
                                    <input
                                        type="checkbox"
                                        id="disableReportsInline"
                                        checked={editedDisableReports}
                                        onChange={(e) => setEditedDisableReports(e.target.checked)}
                                        className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                                    />
                                    <label htmlFor="disableReportsInline" className="text-sm text-gray-500 cursor-pointer select-none">
                                        تعطيل التقارير
                                    </label>
                                </div>
                                <div className="flex justify-center gap-2 mt-4">
                                    <button
                                        onClick={handleSave}
                                        className="bg-blue-600 text-white px-4 py-1.5 rounded-xl text-sm font-bold shadow-lg shadow-blue-200"
                                    >
                                        حفظ
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsEditing(false);
                                            setEditedName(academyName);
                                        }}
                                        className="bg-gray-100 text-gray-600 px-4 py-1.5 rounded-xl text-sm"
                                    >
                                        إلغاء
                                    </button>
                                </div>
                            </div>
                        )
                    }
                </div >

                {/* Content */}
                < div className="p-6 space-y-4" >

                    {/* Stats Cards */}
                    < div className="grid grid-cols-2 gap-4" >
                        {/* Total Hours */}
                        < div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100 text-center space-y-1" >
                            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Clock size={24} />
                            </div>
                            <div className="text-4xl font-bold text-gray-800 font-amiri">
                                {toHindiDigits(fmtHours(stats.totalHours))}
                            </div>
                            <div className="text-lg text-gray-500 font-medium font-amiri">عدد الساعات</div>
                        </div >

                        {/* Total Classes */}
                        < div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 text-center space-y-1" >
                            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Calendar size={24} />
                            </div>
                            <div className="text-4xl font-bold text-gray-800 font-amiri flex items-center justify-center gap-2">
                                {toHindiDigits(stats.totalClasses)}
                                {stats.totalTransferred > 0 && (
                                    <span className="text-sm text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 font-normal self-center" title="حصص مرحلة من الشهر السابق">
                                        +{toHindiDigits(stats.totalTransferred)} ↩
                                    </span>
                                )}
                            </div>
                            <div className="text-lg text-gray-500 font-medium font-amiri">عدد الحصص</div>
                        </div >
                    </div >

                    {/* Income Section */}
                    < div className="bg-gray-50 rounded-2xl p-5 space-y-3" >
                        {
                            currencies.length > 0 ? currencies.map(curr => (
                                <div key={curr} className="space-y-4">
                                    {/* Main Amount Row - Label RIGHT, Amount LEFT */}
                                    <div className="flex items-center justify-between border-b border-gray-200 pb-4">
                                        <div className="text-gray-600 font-bold text-xl">
                                            إجمالي المستحق
                                        </div>
                                        <div className="text-2xl font-bold text-[#d4af37] font-amiri">
                                            {toHindiDigits(stats.incomeByCurrency[curr].toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }))} {curr}
                                        </div>
                                    </div>

                                    {/* Hour Rate Info - Moved here */}
                                    {academyRate && (
                                        <div className="text-center -mt-2">
                                            <span className="text-red-300 text-lg font-arabic opacity-80">
                                                سعر الساعة: {toHindiDigits(academyRate.rate)} {academyRate.currency}
                                            </span>
                                        </div>
                                    )}

                                    {/* Egyptian Equivalent (for USD) */}
                                    {curr === 'دولار' && usdRate > 0 && (
                                        <div className="text-center space-y-3 pt-2">
                                            <div className="text-gray-400 text-xl">يعادله بالمصري حالياً</div>
                                            <div className="inline-flex items-center gap-2 px-6 py-3 bg-green-50 rounded-xl">
                                                <span className="text-2xl font-bold text-green-600">
                                                    {toHindiDigits((stats.incomeByCurrency[curr] * usdRate).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }))} جنيه
                                                </span>
                                            </div>
                                            <div className="text-lg text-gray-400">
                                                سعر الصرف: ١ دولار = {toHindiDigits(usdRate.toFixed(2))} جنيه
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )) : (
                                <div className="text-center text-gray-400 py-2">لا يوجد دخل مسجل</div>
                            )
                        }
                    </div >

                    {/* Pill Design for Deduction - Conditional Theme */}
                    < div className="flex items-center justify-center pt-0" >
                        <div className={`
                            inline-flex items-center gap-4 px-5 py-2 rounded-full border shadow-sm transition-all duration-300
                            ${editedDeduction > 0
                                ? 'bg-red-50/50 border-red-100 hover:bg-red-50'
                                : 'bg-gray-50/50 border-gray-100 hover:bg-gray-50'
                            }
                        `}>
                            <div className="flex items-center gap-1.5">
                                <Clock size={16} className={editedDeduction > 0 ? 'text-red-400' : 'text-gray-400'} />
                                <span className={`text-xl font-medium whitespace-nowrap ${editedDeduction > 0 ? 'text-red-500' : 'text-gray-500'}`}>
                                    خصم دقائق
                                </span>
                            </div>
                            <div className="flex items-center gap-1">
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={editedDeduction === 0 ? '' : editedDeduction.toString()}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => {
                                        const western = toWesternDigits(e.target.value).replace(/\D/g, '');
                                        const val = western === '' ? 0 : parseInt(western);

                                        setEditedDeduction(val);
                                        const newMonthlyDeductions = { ...(academyRate?.monthlyDeductions || {}) };
                                        newMonthlyDeductions[`${month}_${year}`] = val;
                                        onUpdate(academyName, editedName, editedRate, editedCurrency, newMonthlyDeductions, editedBillingStartDay, editedLink, academyRate?.holidays || [], editedDisableReports);

                                        // Update history
                                        const newHistory = deductionHistory.slice(0, historyIndex + 1);
                                        newHistory.push(val);
                                        setDeductionHistory(newHistory);
                                        setHistoryIndex(newHistory.length - 1);
                                    }}
                                    className={`
                                        w-16 text-center text-3xl font-bold bg-transparent outline-none font-tajawal transition-colors
                                        ${editedDeduction > 0 ? 'text-red-600' : 'text-gray-400'}
                                    `}
                                    placeholder=""
                                    style={{ direction: 'ltr' }}
                                />
                                <span className={`${editedDeduction > 0 ? 'text-red-300' : 'text-gray-300'} font-tajawal`}>دقيقة</span>
                            </div>
                        </div>
                    </div >

                    {/* Delete Action */}
                    < div className="pt-3 border-t border-gray-100" >
                        {!confirmDelete ? (
                            <button
                                onClick={() => setConfirmDelete(true)}
                                className="w-full flex items-center justify-center gap-3 text-red-500 border-2 border-red-200 hover:bg-red-50/50 py-2.5 rounded-2xl transition-all text-xl"
                            >
                                <Trash2 size={24} strokeWidth={2} />
                                <span>حذف الأكاديمية</span>
                            </button>
                        ) : (
                            <div className="flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 bg-red-50 p-3 rounded-2xl border-2 border-red-200">
                                <span className="text-lg text-red-700 font-bold pr-2">تأكيد الحذف النهائي؟</span>
                                <div className="flex gap-2 mr-auto">
                                    <button
                                        onClick={onDelete}
                                        className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-xl text-lg font-bold shadow-lg shadow-red-200 transition-all active:scale-95"
                                    >
                                        حذف
                                    </button>
                                    <button
                                        onClick={() => setConfirmDelete(false)}
                                        className="bg-white text-gray-600 px-6 py-2 rounded-xl text-lg border border-gray-200 hover:bg-gray-100 transition-all"
                                    >
                                        تراجع
                                    </button>
                                </div>
                            </div>
                        )}
                    </div >

                </div >
            </div >
        </div >
    );
};

export default AcademyDetailsModal;
