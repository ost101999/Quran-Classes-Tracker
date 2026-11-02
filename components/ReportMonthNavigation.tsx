import React, { useCallback, useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';

export function useReportMonth(initialMonth: number, initialYear: number, mouseNavigation = false) {
    const [period, setPeriod] = useState({ month: initialMonth, year: initialYear });
    const changeMonth = useCallback((offset: number) => {
        setPeriod(current => {
            const date = new Date(current.year, current.month + offset, 1);
            return { month: date.getMonth(), year: date.getFullYear() };
        });
    }, []);

    useEffect(() => {
        if (!mouseNavigation) return;
        const preventNavigation = (event: MouseEvent) => {
            if (event.button === 3 || event.button === 4) event.preventDefault();
        };
        const handleMouseUp = (event: MouseEvent) => {
            if (event.button !== 3 && event.button !== 4) return;
            event.preventDefault();
            event.stopPropagation();
            const offset = event.button === 3 ? -1 : 1;
            setPeriod(current => {
                const today = new Date();
                if (offset > 0 && current.year * 12 + current.month >= today.getFullYear() * 12 + today.getMonth()) return current;
                const date = new Date(current.year, current.month + offset, 1);
                return { month: date.getMonth(), year: date.getFullYear() };
            });
        };
        document.addEventListener('mousedown', preventNavigation, true);
        document.addEventListener('auxclick', preventNavigation, true);
        document.addEventListener('mouseup', handleMouseUp, true);
        return () => {
            document.removeEventListener('mousedown', preventNavigation, true);
            document.removeEventListener('auxclick', preventNavigation, true);
            document.removeEventListener('mouseup', handleMouseUp, true);
        };
    }, [mouseNavigation]);
    return { ...period, changeMonth };
}

export default function ReportMonthNavigation({ month, year, changeMonth, isPaid, onTogglePayment, paymentLabel }: {
    month: number;
    year: number;
    changeMonth: (offset: number) => void;
    isPaid?: boolean;
    onTogglePayment?: (month: number, year: number) => void;
    paymentLabel?: string;
}) {
    const today = new Date();
    const isCurrentOrFuture = year * 12 + month >= today.getFullYear() * 12 + today.getMonth();
    const label = new Intl.DateTimeFormat('ar-EG-u-ca-gregory', { month: 'long', year: 'numeric' })
        .format(new Date(year, month, 1));

    return (
        <div className="relative flex items-center justify-center gap-3 py-2 border-b border-gray-100" dir="ltr">
            {onTogglePayment && (
                <button type="button" onClick={() => onTogglePayment(month, year)} aria-pressed={!!isPaid}
                    aria-label={`${paymentLabel || 'حالة الدفع'}: ${isPaid ? 'تم الدفع، اضغط لإلغاء الدفع' : 'لم يدفع، اضغط لتسجيل الدفع'}`}
                    title={`${paymentLabel || 'حالة الدفع'}: ${isPaid ? 'تم الدفع' : 'لم يدفع'}`}
                    className={`report-payment-toggle absolute left-6 flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${isPaid ? 'is-paid border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-200' : 'border-gray-300 bg-white text-gray-300 hover:border-emerald-400 hover:text-emerald-500'}`}>
                    <Check size={17} strokeWidth={2.8} />
                </button>
            )}
            <style>{`@keyframes report-payment-pop { 0% { transform: scale(.8); } 55% { transform: scale(1.16); } 100% { transform: scale(1); } }
                .report-payment-toggle.is-paid { animation: report-payment-pop 350ms ease-out; }
                @media (prefers-reduced-motion: reduce) { .report-payment-toggle { animation: none !important; transition: none !important; } }`}</style>
            <button type="button" onClick={() => changeMonth(-1)} aria-label="الشهر السابق" title="الشهر السابق"
                className="p-2 rounded-full text-blue-600 hover:bg-blue-50 transition-colors">
                <ChevronLeft size={20} />
            </button>
            <span className="min-w-32 text-center text-gray-600 font-semibold" aria-live="polite">{label}</span>
            <button type="button" onClick={() => changeMonth(1)} disabled={isCurrentOrFuture} aria-label="الشهر التالي" title="الشهر التالي"
                className="p-2 rounded-full text-blue-600 hover:bg-blue-50 transition-colors disabled:text-gray-300 disabled:cursor-not-allowed disabled:hover:bg-transparent">
                <ChevronRight size={20} />
            </button>
        </div>
    );
}
