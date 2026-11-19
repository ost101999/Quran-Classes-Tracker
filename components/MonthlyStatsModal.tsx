import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X, TrendingUp, Calendar, DollarSign, Wallet, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { Student, AttendanceRecord, MakeupLink } from '../types';
import { calculateMonthlyStats } from '../services/monthlyStats';

interface Props {
    students: Student[];
    attendance: AttendanceRecord;
    month: number;
    year: number;
    currentMonth: number;
    currentYear: number;
    usdRate: number;
    onClose: () => void;
    onNavigateMonth: (offset: number) => void;
    initialObligations: number;
    onSaveObligations: (amount: number) => void;
    paymentStatus?: Record<string, boolean>;
    onTogglePayment?: (studentId: string, month: number, year: number) => void;
    academyRates?: Record<string, any>;
    makeupLinks?: MakeupLink[];
    dayTransitionTime?: string;
    showPaymentToggles?: boolean;
    initiallyExpanded?: boolean;
}

// Helper to convert Western digits to Hindi
const toHindiDigits = (num: number | string): string => {
    return num.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)]).replace('.', '٫');
};

const formatCurrencyNumber = (value: number): string =>
    toHindiDigits(value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }));

const formatClassesCountLabel = (count: number): string => {
    const num = toHindiDigits(count);
    if (count === 1) return 'حصة واحدة';
    if (count === 2) return 'حصتان';
    if (count >= 3 && count <= 10) return `${num} حصص`;
    return `${num} حصة`;
};

const MONTHS = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

const IncomeDetails: React.FC<{ expanded: boolean; currency: 'egp' | 'usd'; children: React.ReactNode }> = ({ expanded, currency, children }) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const [contentHeight, setContentHeight] = useState(0);

    useLayoutEffect(() => {
        const content = contentRef.current;
        if (!content) return;
        const measure = () => setContentHeight(content.offsetHeight);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(content);
        return () => observer.disconnect();
    }, []);

    return (
        <div
            className={`monthly-stats-details monthly-stats-details-${currency} ${expanded ? 'is-open' : ''}`}
            style={{ height: expanded ? contentHeight : 0 }}
            aria-hidden={!expanded}
            inert={!expanded}
        >
            <div ref={contentRef}>{children}</div>
        </div>
    );
};

const MonthlyStatsModal: React.FC<Props> = ({ students, attendance, month, year, currentMonth, currentYear, usdRate, onClose, onNavigateMonth, academyRates, makeupLinks, dayTransitionTime, initialObligations, onSaveObligations, paymentStatus, onTogglePayment, showPaymentToggles, initiallyExpanded = false }) => {
    const [showEgpDetails, setShowEgpDetails] = useState(initiallyExpanded);
    const [showUsdDetails, setShowUsdDetails] = useState(initiallyExpanded);
    const previousPeriod = useRef(year * 12 + month);
    const currentMonthDetails = useRef({ egp: false, usd: false });
    const [obligations, setObligations] = useState<string>(initialObligations ? initialObligations.toLocaleString('en-US') : '');

    useLayoutEffect(() => {
        const currentPeriod = year * 12 + month;
        if (currentPeriod !== previousPeriod.current && currentPeriod === currentYear * 12 + currentMonth) {
            setShowEgpDetails(currentMonthDetails.current.egp);
            setShowUsdDetails(currentMonthDetails.current.usd);
        } else if (currentPeriod < previousPeriod.current) {
            setShowEgpDetails(true);
            setShowUsdDetails(true);
        }
        previousPeriod.current = currentPeriod;
        setObligations(initialObligations ? initialObligations.toLocaleString('en-US') : '');
    }, [month, year, currentMonth, currentYear, initialObligations]);

    const toggleDetails = (currency: 'egp' | 'usd') => {
        const next = currency === 'egp' ? !showEgpDetails : !showUsdDetails;
        if (year === currentYear && month === currentMonth) {
            currentMonthDetails.current[currency] = next;
        }
        if (currency === 'egp') setShowEgpDetails(next);
        else setShowUsdDetails(next);
    };

    useEffect(() => {
        const preventNavigation = (event: MouseEvent) => {
            if (event.button === 3 || event.button === 4) event.preventDefault();
        };
        const handleMouseUp = (event: MouseEvent) => {
            if (event.button !== 3 && event.button !== 4) return;
            event.preventDefault();
            event.stopPropagation();
            onNavigateMonth(event.button === 3 ? -1 : 1);
        };
        document.addEventListener('mousedown', preventNavigation, true);
        document.addEventListener('auxclick', preventNavigation, true);
        document.addEventListener('mouseup', handleMouseUp, true);
        return () => {
            document.removeEventListener('mousedown', preventNavigation, true);
            document.removeEventListener('auxclick', preventNavigation, true);
            document.removeEventListener('mouseup', handleMouseUp, true);
        };
    }, [onNavigateMonth]);

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

    const getObligationsValue = () => {
        if (!obligations) return 0;
        return Number(obligations.replace(/,/g, ''));
    };

    const isDirtyObligations = getObligationsValue() !== (initialObligations || 0);

    const stats = calculateMonthlyStats({
        students,
        attendance,
        month,
        year,
        usdRate,
        academyRates,
        paymentStatus,
        makeupLinks,
        dayTransitionTime,
    });

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 font-arabic monthly-stats-overlay"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden monthly-stats-dialog flex flex-col max-h-[90vh]"
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
                    <div className="flex items-center justify-center gap-1 sm:gap-3 pl-8">
                        <button type="button" onClick={() => onNavigateMonth(1)} aria-label="الشهر التالي" title="الشهر التالي" className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"><ChevronRight size={22} /></button>
                        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 whitespace-nowrap">إحصائيات {MONTHS[month]} {toHindiDigits(year)}</h2>
                        <button type="button" onClick={() => onNavigateMonth(-1)} aria-label="الشهر السابق" title="الشهر السابق" className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"><ChevronLeft size={22} /></button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4 overflow-y-auto no-scrollbar">

                    {/* Main Stats Cards */}
                    <div className="grid grid-cols-1 gap-4">

                        {/* EGP Stats */}
                        <div
                            className="bg-emerald-50/50 rounded-2xl border border-emerald-100 overflow-hidden transition-all duration-300 cursor-pointer hover:bg-emerald-50"
                            onClick={() => toggleDetails('egp')}
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
                                        toggleDetails('egp');
                                    }}
                                    aria-expanded={showEgpDetails}
                                    aria-label="تفاصيل الدخل بالمصري"
                                    className="p-2 hover:bg-emerald-100 rounded-full text-emerald-600 transition-colors"
                                >
                                    {showEgpDetails ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                                </button>
                            </div>

                            <IncomeDetails currency="egp" expanded={showEgpDetails && stats.egpStudents.length > 0}>
                                <div className="border-t border-emerald-100 bg-white/50 p-4 space-y-2">
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
                            </IncomeDetails>
                        </div>

                        {/* USD Stats */}
                        <div
                            className="bg-blue-50/50 rounded-2xl border border-blue-100 overflow-hidden transition-all duration-300 cursor-pointer hover:bg-blue-50"
                            onClick={() => toggleDetails('usd')}
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
                                        toggleDetails('usd');
                                    }}
                                    aria-expanded={showUsdDetails}
                                    aria-label="تفاصيل الدخل الدولاري"
                                    className="p-2 hover:bg-blue-100 rounded-full text-blue-600 transition-colors"
                                >
                                    {showUsdDetails ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                                </button>
                            </div>

                            <IncomeDetails currency="usd" expanded={showUsdDetails && stats.usdStudents.length > 0}>
                                <div className="border-t border-blue-100 bg-white/50 p-4 space-y-2">
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
                            </IncomeDetails>
                        </div>

                        {/* Total Stats */}
                        <div
                            tabIndex={0}
                            aria-label={`إجمالي دخل الدورة الحالية بالمصري ${formatCurrencyNumber(stats.totalInEgp)} جنيه، المتوقع بنهاية الدورة ${formatCurrencyNumber(stats.projectedTotalInEgp)} جنيه`}
                            className="group bg-amber-50/50 rounded-2xl border border-amber-100 overflow-hidden p-6 mt-2 relative transition-colors duration-200 hover:bg-emerald-50/50 hover:border-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-10 transition-colors duration-200 group-hover:text-emerald-600">
                                <TrendingUp size={80} />
                            </div>
                            <div className="text-center space-y-1 relative z-10 transition-opacity duration-200 group-hover:opacity-0 group-focus-within:opacity-0">
                                <div className="text-xl text-amber-600 font-bold">إجمالي دخل الدورة الحالية (بالمصري)</div>
                                <div className="text-5xl font-bold text-gray-900 font-amiri py-2">
                                    {formatCurrencyNumber(stats.totalInEgp)} جنيه
                                </div>
                                <div className="text-lg text-gray-400 font-normal">
                                    تم حساب الدولار بسعر: {toHindiDigits(usdRate.toFixed(2))} ج.م
                                </div>
                            </div>
                            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center space-y-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
                                <div className="text-xl text-emerald-700 font-bold">الدخل المتوقع بنهاية الدورة (بالمصري)</div>
                                <div className="text-5xl font-bold text-gray-900 font-amiri py-2">
                                    {formatCurrencyNumber(stats.projectedTotalInEgp)} جنيه
                                </div>
                                <div className="text-base sm:text-lg text-emerald-700/80 font-normal">
                                    {stats.remainingProjectedClasses > 0
                                        ? `متبقي متوقع: +${formatCurrencyNumber(stats.remainingProjectedInEgp)} ج.م (${formatClassesCountLabel(stats.remainingProjectedClasses)})`
                                        : 'اكتملت حصص الدورة الحالية'}
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
