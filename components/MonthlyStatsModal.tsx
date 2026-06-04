import React, { useState } from 'react';
import { X, TrendingUp, Calendar, DollarSign, Wallet, ChevronDown, ChevronUp, Save } from 'lucide-react';
import { Student, AttendanceRecord, AttendanceStatus } from '../types';

interface Props {
    students: Student[];
    attendance: AttendanceRecord;
    month: number;
    year: number;
    usdRate: number;
    onClose: () => void;
    initialObligations: number;
    onSaveObligations: (amount: number) => void;
    paymentStatus?: Record<string, boolean>;
    onTogglePayment?: (studentId: string, month: number, year: number) => void;
    academyRates?: Record<string, any>;
    showPaymentToggles?: boolean;
}

// Helper to convert Western digits to Hindi
const toHindiDigits = (num: number | string): string => {
    return num.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)]).replace('.', '٫');
};

// Helper to convert Hindi digits to Western
const toWesternDigits = (str: string): string => {
    if (!str) return '';
    return str.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
};

const MONTHS = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

const MonthlyStatsModal: React.FC<Props> = ({ students, attendance, month, year, usdRate, onClose, academyRates, initialObligations, onSaveObligations, paymentStatus, onTogglePayment, showPaymentToggles }) => {
    const [showEgpDetails, setShowEgpDetails] = useState(false);
    const [showUsdDetails, setShowUsdDetails] = useState(false);
    const [obligations, setObligations] = useState<string>(initialObligations ? initialObligations.toLocaleString('en-US') : '');

    // Format input with thousand separators (Standard English)
    const formatNumberInput = (value: string) => {
        // Remove non-digit chars (keep only 0-9)
        const cleanValue = value.replace(/[^\d]/g, '');
        if (!cleanValue) return '';
        // Format with separators
        return Number(cleanValue).toLocaleString('en-US');
    };

    const handleObligationsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const formatted = formatNumberInput(value);
        setObligations(formatted);
    };

    const handlePreviousBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const formatted = formatNumberInput(value);
        setPreviousBalance(formatted);
    };

    const getObligationsValue = () => {
        if (!obligations) return 0;
        return Number(obligations.replace(/,/g, ''));
    };

    const isDirtyObligations = getObligationsValue() !== (initialObligations || 0);

    const calculateStats = () => {
        let egpTotal = 0;
        let usdTotal = 0;
        let deferredEgpTotal = 0;
        let deferredUsdTotal = 0;

        const egpStudents: { id: string; name: string; amount: number; academy: string; isAggregated?: boolean }[] = [];
        const usdStudents: { id: string; name: string; amount: number; academy: string; isAggregated?: boolean }[] = [];

        const egpAggregated: Record<string, number> = {};
        const usdAggregated: Record<string, number> = {};

        // Count classes per student for this month/year
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Determine Previous Month
        let prevMonth = month - 1;
        let prevYear = year;
        if (prevMonth < 0) {
            prevMonth = 11;
            prevYear = year - 1;
        }
        const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();

        students.forEach(student => {
            const isDeletedThisMonth = student.deletedAt && (
                year > student.deletedAt.year || 
                (year === student.deletedAt.year && month >= student.deletedAt.month)
            );

            let currentCycleClasses = 0;
            let deferredClasses = 0;

            // Get billing start day or default to 1 (Normal month)
            const billingStartDay = academyRates?.[student.academy]?.billingStartDay || 1;

            // 1. Calculate from Previous Month (Tail) if Applicable (Billing Cycle Start Logic)
            if (billingStartDay > 1) {
                for (let d = billingStartDay; d <= daysInPrevMonth; d++) {
                    const key = `${student.id}_${d}_${prevMonth}_${prevYear}`;
                    const status = attendance[key];
                    if (status === AttendanceStatus.PRESENT || status === AttendanceStatus.PAID_ABSENCE || status === AttendanceStatus.UNEXCUSED_ABSENCE || status === AttendanceStatus.ABSENCE_RED) {
                        currentCycleClasses++;
                    } else if (status === AttendanceStatus.DOUBLE_CLASS) {
                        currentCycleClasses += 2;
                    }
                }
            }

            // 1.5 Scan Previous Month for TRANSFERRED classes (from ANY day, regardless of billing cycle)
            // These are classes marked as "Transferred to Next Month" in the previous month, so they must be billed NOW.
            for (let d = 1; d <= daysInPrevMonth; d++) {
                const key = `${student.id}_${d}_${prevMonth}_${prevYear}`;
                const status = attendance[key];
                if (status === AttendanceStatus.TRANSFERRED || status === AttendanceStatus.TRANSFERRED_ABSENT) {
                    currentCycleClasses++;
                }
            }

            // 2. Calculate from Current Month (Head) and Deferred (Tail)
            for (let d = 1; d <= daysInMonth; d++) {
                const key = `${student.id}_${d}_${month}_${year}`;
                const status = attendance[key];

                let classValue = 0;
                if (status === AttendanceStatus.PRESENT || status === AttendanceStatus.PAID_ABSENCE) {
                    classValue = 1;
                } else if (status === AttendanceStatus.DOUBLE_CLASS || status === AttendanceStatus.EXTRA_DOUBLE) {
                    // DOUBLE_CLASS and EXTRA_DOUBLE count as 2 sessions for payment
                    classValue = 2;
                }

                if (classValue > 0) {
                    if (billingStartDay > 1 && d >= billingStartDay) {
                        // Days >= StartDay belong to NEXT cycle (Deferred)
                        deferredClasses += classValue;
                    } else {
                        // Days < StartDay belong to CURRENT cycle
                        currentCycleClasses += classValue;
                    }
                }
            }

            if (isDeletedThisMonth && currentCycleClasses === 0 && deferredClasses === 0) {
                return;
            }

            const currency = student.location || 'جنيه';

            // Calculate amount based on payment basis
            let studentAmount = 0;
            if (student.paymentBasis === 'بالساعة' || student.duration === 'خليط') {
                const durationMin = student.duration === 'خليط' ? 30 : (parseInt(toWesternDigits(student.duration || '٣٠')) || 30);
                studentAmount = (currentCycleClasses * durationMin / 60) * student.rate;
            } else {
                studentAmount = currentCycleClasses * student.rate;
            }

            const isSpecial = student.academy === 'خاص' || student.academy.includes('خاص');

            // Check if this is a USD academy that receives payment in EGP
            const academyReceivesInEGP = academyRates?.[student.academy]?.receiveInEGP === true;

            if (currency === 'جنيه') {
                egpTotal += studentAmount;
                if (isSpecial) {
                    egpStudents.push({ id: student.id, name: student.name, amount: studentAmount, academy: student.academy });
                } else {
                    egpAggregated[student.academy] = (egpAggregated[student.academy] || 0) + studentAmount;
                }
            } else if (currency === 'دولار') {
                if (academyReceivesInEGP) {
                    // Convert to EGP and add to EGP totals
                    const amountInEGP = studentAmount * usdRate;
                    egpTotal += amountInEGP;
                    if (isSpecial) {
                        egpStudents.push({ id: student.id, name: student.name, amount: amountInEGP, academy: student.academy });
                    } else {
                        egpAggregated[student.academy] = (egpAggregated[student.academy] || 0) + amountInEGP;
                    }
                } else {
                    usdTotal += studentAmount;
                    if (isSpecial) {
                        usdStudents.push({ id: student.id, name: student.name, amount: studentAmount, academy: student.academy });
                    } else {
                        usdAggregated[student.academy] = (usdAggregated[student.academy] || 0) + studentAmount;
                    }
                }
            }

            // Deferred Calculation
            if (deferredClasses > 0) {
                let deferredAmount = 0;
                if (student.paymentBasis === 'بالساعة' || student.duration === 'خليط') {
                    const durationMin = student.duration === 'خليط' ? 30 : (parseInt(toWesternDigits(student.duration || '٣٠')) || 30);
                    deferredAmount = (deferredClasses * durationMin / 60) * student.rate;
                } else {
                    deferredAmount = deferredClasses * student.rate;
                }

                if (currency === 'جنيه') {
                    deferredEgpTotal += deferredAmount;
                } else if (currency === 'دولار') {
                    if (academyReceivesInEGP) {
                        // Convert deferred USD to EGP
                        deferredEgpTotal += deferredAmount * usdRate;
                    } else {
                        deferredUsdTotal += deferredAmount;
                    }
                }
            }
        });

        // Handle Academy Deductions (Applied to current cycle)
        const monthKey = `${month}_${year}`;
        if (academyRates) {
            Object.entries(academyRates).forEach(([academyName, rateInfo]) => {
                const deduction = rateInfo.monthlyDeductions?.[monthKey] ?? rateInfo.deductedMinutes ?? 0;
                if (deduction > 0) {
                    const deductionAmount = (deduction / 60) * rateInfo.rate;
                    if (rateInfo.currency === 'جنيه') {
                        if (egpAggregated[academyName]) {
                            egpAggregated[academyName] = Math.max(0, egpAggregated[academyName] - deductionAmount);
                        }
                        egpTotal = Math.max(0, egpTotal - deductionAmount);
                    } else if (rateInfo.currency === 'دولار') {
                        if (rateInfo.receiveInEGP) {
                            // Deduct from EGP total (converted)
                            const convertedDeduction = deductionAmount * usdRate;
                            if (egpAggregated[academyName]) {
                                egpAggregated[academyName] = Math.max(0, egpAggregated[academyName] - convertedDeduction);
                            }
                            egpTotal = Math.max(0, egpTotal - convertedDeduction);
                        } else {
                            if (usdAggregated[academyName]) {
                                usdAggregated[academyName] = Math.max(0, usdAggregated[academyName] - deductionAmount);
                            }
                            usdTotal = Math.max(0, usdTotal - deductionAmount);
                        }
                    }
                }
            });
        }

        // Add Aggregated Academies to the lists
        Object.entries(egpAggregated).forEach(([academyName, amount]) => {
            egpStudents.push({ id: academyName, name: academyName, amount, academy: academyName, isAggregated: true });
        });
        Object.entries(usdAggregated).forEach(([academyName, amount]) => {
            usdStudents.push({ id: academyName, name: academyName, amount, academy: academyName, isAggregated: true });
        });

        return {
            egpTotal,
            usdTotal,
            deferredEgpTotal,
            deferredUsdTotal,
            totalInEgp: egpTotal + (usdTotal * usdRate),
            egpStudents: egpStudents.sort((a, b) => {
                const isPaidA = !!paymentStatus?.[`${a.id}_${month}_${year}`];
                const isPaidB = !!paymentStatus?.[`${b.id}_${month}_${year}`];
                if (isPaidA !== isPaidB) return isPaidA ? 1 : -1;
                return b.amount - a.amount;
            }),
            usdStudents: usdStudents.sort((a, b) => {
                const isPaidA = !!paymentStatus?.[`${a.id}_${month}_${year}`];
                const isPaidB = !!paymentStatus?.[`${b.id}_${month}_${year}`];
                if (isPaidA !== isPaidB) return isPaidA ? 1 : -1;
                return b.amount - a.amount;
            })
        };
    };

    const stats = calculateStats();

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 font-arabic"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="relative p-6 text-center border-b border-gray-100 bg-gray-50/50 flex-none">
                    <button
                        onClick={onClose}
                        className="absolute left-6 top-1/2 -translate-y-1/2 p-2 hover:bg-red-50 hover:text-red-500 rounded-full text-gray-400 transition-colors"
                    >
                        <X size={24} />
                    </button>
                    <h2 className="text-3xl font-bold text-gray-800">إحصائيات {MONTHS[month]} {toHindiDigits(year)}</h2>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4 overflow-y-auto no-scrollbar">

                    {/* Main Stats Cards */}
                    <div className="grid grid-cols-1 gap-4">

                        {/* EGP Stats */}
                        <div
                            className="bg-emerald-50/50 rounded-2xl border border-emerald-100 overflow-hidden transition-all duration-300 cursor-pointer hover:bg-emerald-50"
                            onClick={() => setShowEgpDetails(!showEgpDetails)}
                        >
                            <div className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                                        <Wallet size={24} />
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl text-gray-500 font-normal">الدخل بالمصري</div>
                                        <div className="text-3xl font-bold text-gray-800 font-amiri flex items-baseline gap-1">
                                            <span>{toHindiDigits(stats.egpTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }))}</span>
                                            <span className="text-xl opacity-50 font-arabic font-normal">ج م</span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowEgpDetails(!showEgpDetails);
                                    }}
                                    className="p-2 hover:bg-emerald-100 rounded-full text-emerald-600 transition-colors"
                                >
                                    {showEgpDetails ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                                </button>
                            </div>

                            {showEgpDetails && stats.egpStudents.length > 0 && (
                                <div className="border-t border-emerald-100 bg-white/50 animate-in slide-in-from-top-2 duration-200 p-4 space-y-2">
                                    {stats.egpStudents.map((s, i) => {
                                        const isPaid = paymentStatus?.[`${s.id}_${month}_${year}`];
                                        const isSpecial = s.academy === 'خاص' || s.academy.includes('خاص');
                                        return (
                                            <div
                                                key={i}
                                                className={`flex justify-between items-center text-xl py-2 px-3 rounded-xl transition-all ${isSpecial ? 'bg-amber-50 border border-amber-100' : ''}`}
                                            >
                                                <div className="flex flex-col">
                                                    <span className={`font-medium text-xl ${isPaid ? 'text-emerald-700' : 'text-gray-700'}`}>
                                                        {s.name}
                                                    </span>
                                                    {!s.isAggregated && <span className="text-sm text-gray-400">({s.academy})</span>}
                                                </div>

                                                <div className="flex items-center gap-4">
                                                    <span className="font-amiri font-bold text-xl text-emerald-600 flex items-baseline gap-1">
                                                        <span>{toHindiDigits(s.amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }))}</span>
                                                        <span className="text-sm opacity-50 font-arabic font-normal">ج م</span>
                                                    </span>
                                                    {showPaymentToggles && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onTogglePayment?.(s.id, month, year);
                                                            }}
                                                            className={`px-3 py-1 rounded-full text-sm font-normal transition-all border ${isPaid
                                                                ? 'bg-emerald-500 text-black border-emerald-500'
                                                                : 'bg-white text-red-500 border-red-200 hover:bg-red-50'
                                                                }`}
                                                        >
                                                            {isPaid ? 'تم الدفع' : 'لم يدفع'}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* USD Stats */}
                        <div
                            className="bg-blue-50/50 rounded-2xl border border-blue-100 overflow-hidden transition-all duration-300 cursor-pointer hover:bg-blue-50"
                            onClick={() => setShowUsdDetails(!showUsdDetails)}
                        >
                            <div className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                                        <DollarSign size={24} />
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl text-gray-500 font-normal">الدخل الدولاري</div>
                                        <div className="text-3xl font-bold text-gray-800 font-amiri flex items-baseline gap-1">
                                            <span>{toHindiDigits(stats.usdTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }))}</span>
                                            <span className="text-xl opacity-50 font-light" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>$</span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowUsdDetails(!showUsdDetails);
                                    }}
                                    className="p-2 hover:bg-blue-100 rounded-full text-blue-600 transition-colors"
                                >
                                    {showUsdDetails ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                                </button>
                            </div>

                            {showUsdDetails && stats.usdStudents.length > 0 && (
                                <div className="border-t border-blue-100 bg-white/50 animate-in slide-in-from-top-2 duration-200 p-4 space-y-2">
                                    {stats.usdStudents.map((s, i) => {
                                        const isPaid = paymentStatus?.[`${s.id}_${month}_${year}`];
                                        const isSpecial = s.academy === 'خاص' || s.academy.includes('خاص');
                                        return (
                                            <div
                                                key={i}
                                                className={`flex justify-between items-center text-xl py-2 px-3 rounded-xl transition-all ${isSpecial ? 'bg-amber-50 border border-amber-100' : ''}`}
                                            >
                                                <div className="flex flex-col">
                                                    <span className={`font-medium text-xl ${isPaid ? 'text-blue-700' : 'text-gray-700'}`}>
                                                        {s.name}
                                                    </span>
                                                    {!s.isAggregated && <span className="text-sm text-gray-400">({s.academy})</span>}
                                                </div>

                                                <div className="flex items-center gap-4">
                                                    <span className="font-amiri font-bold text-xl text-blue-600 flex items-baseline gap-1">
                                                        <span>{toHindiDigits(s.amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }))}</span>
                                                        <span className="text-sm opacity-50 font-light" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>$</span>
                                                    </span>
                                                    {showPaymentToggles && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onTogglePayment?.(s.id, month, year);
                                                            }}
                                                            className={`px-3 py-1 rounded-full text-sm font-normal transition-all border ${isPaid
                                                                ? 'bg-emerald-500 text-black border-emerald-500'
                                                                : 'bg-white text-red-500 border-red-200 hover:bg-red-50'
                                                                }`}
                                                        >
                                                            {isPaid ? 'تم الدفع' : 'لم يدفع'}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                    }
                                </div>
                            )}
                        </div>

                        {/* Total Stats */}
                        <div className="bg-amber-50/50 rounded-2xl border border-amber-100 overflow-hidden p-6 mt-2 relative">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <TrendingUp size={80} />
                            </div>
                            <div className="text-center space-y-1 relative z-10">
                                <div className="text-xl text-amber-600 font-bold">إجمالي دخل الدورة الحالية (بالمصري)</div>
                                <div className="text-5xl font-bold text-gray-900 font-amiri py-2">
                                    {toHindiDigits(stats.totalInEgp.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }))} جنيه
                                </div>
                                <div className="text-lg text-gray-400 font-normal">
                                    تم حساب الدولار بسعر: {toHindiDigits(usdRate.toFixed(2))} ج.م
                                </div>
                            </div>
                        </div>

                        {/* Deferred Income */}
                        {(stats.deferredEgpTotal > 0 || stats.deferredUsdTotal > 0) && (
                            <div className="bg-purple-50/50 rounded-2xl border border-purple-100 overflow-hidden p-4 relative">
                                <div className="flex items-center justify-between text-purple-800">
                                    <div className="text-xl font-bold">مؤجل للشهر القادم (بعد يوم {toHindiDigits(academyRates?.[Object.keys(academyRates)[0]]?.billingStartDay || 1)})</div>
                                    <div className="text-2xl font-bold font-amiri">
                                        {toHindiDigits((stats.deferredEgpTotal + (stats.deferredUsdTotal * usdRate)).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }))} جنيه
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Calculation Section */}
                        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 space-y-4">

                            {/* Obligations Input */}
                            <div className="flex items-center justify-between gap-4">
                                <label className="text-xl font-bold text-slate-700 whitespace-nowrap">الالتزامات (-):</label>
                                <div className="flex items-center gap-2 w-full">
                                    <input
                                        type="text"
                                        value={obligations}
                                        onChange={handleObligationsChange}
                                        placeholder="0"
                                        className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-2xl font-bold text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-slate-400 transition-transform font-english dir-ltr"
                                        style={{ direction: 'ltr' }}
                                    />
                                    <button
                                        onClick={() => onSaveObligations(getObligationsValue())}
                                        className={`p-2 rounded-full transition-all duration-300 ${isDirtyObligations
                                            ? 'opacity-100 text-emerald-600 hover:bg-emerald-50'
                                            : 'opacity-20 text-slate-400 pointer-events-none'
                                            }`}
                                        title="حفظ"
                                    >
                                        <Save size={24} />
                                    </button>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-200">
                                <div className="flex flex-col items-center text-center space-y-2">
                                    <div className="text-xl font-bold text-emerald-600">الفائض الصافي</div>
                                    <div className="text-5xl font-bold text-emerald-700 font-amiri flex items-baseline gap-2">
                                        <span>{toHindiDigits((stats.totalInEgp - getObligationsValue()).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }))}</span>
                                        <span className="text-xl font-normal opacity-50 font-arabic">جنيه مصري</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div >
    );
};

export default MonthlyStatsModal;
