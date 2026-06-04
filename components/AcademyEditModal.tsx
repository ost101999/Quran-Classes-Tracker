import React, { useState } from 'react';
import { X, Link, Trash2, Check, Phone, ChevronLeft, FileText } from 'lucide-react';
import { DAYS_OF_WEEK as DAYS } from '../constants';

interface Props {
    academyName: string;
    academyRate?: {
        rate: number;
        currency: string;
        billingStartDay?: number;
        externalLink?: string;
        holidays?: number[];
        receiveInEGP?: boolean;
        disableReports?: boolean;
        whatsappNumber?: string;
        openLinksExternally?: boolean;
        monthlyDeductions?: Record<string, number>;
        includeReportHeader?: boolean;
    };
    onClose: () => void;
    onSave: (oldName: string, newName: string, rate: number, currency: string, monthlyDeductions: Record<string, number>, billingStartDay?: number, externalLink?: string, holidays?: number[], receiveInEGP?: boolean, disableReports?: boolean, whatsappNumber?: string, openLinksExternally?: boolean, includeReportHeader?: boolean) => void;
    onDelete?: () => void;
    isAdd?: boolean;
}

// Helper functions
const toHindiDigits = (str: string): string => {
    return str.replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)]);
};

const toWesternDigits = (str: string): string => {
    return str.replace(/[٠-٩]/g, d => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]);
};

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

const AcademyEditModal: React.FC<Props> = ({ academyName, academyRate, onClose, onSave, onDelete, isAdd }) => {
    const [name, setName] = useState(isAdd ? '' : academyName);
    const [rate, setRate] = useState(academyRate?.rate ? toHindiDigits(academyRate.rate.toString()) : '');
    const [currency, setCurrency] = useState(academyRate?.currency || 'جنيه');
    const [billingStartDay, setBillingStartDay] = useState<string>(academyRate?.billingStartDay ? toHindiDigits(academyRate.billingStartDay.toString()) : '١');
    const [externalLink, setExternalLink] = useState(academyRate?.externalLink || '');
    const [whatsappNumber, setWhatsappNumber] = useState(academyRate?.whatsappNumber || '');
    const [holidays, setHolidays] = useState<number[]>(academyRate?.holidays || []);
    const [receiveInEGP, setReceiveInEGP] = useState(academyRate?.receiveInEGP || false);
    const [disableReports, setDisableReports] = useState(academyRate?.disableReports || false);
    const [openLinksExternally, setOpenLinksExternally] = useState(academyRate?.openLinksExternally || false);
    const [includeReportHeader, setIncludeReportHeader] = useState(academyRate?.includeReportHeader !== false);
    const [showReportSettings, setShowReportSettings] = useState(false);

    const toggleHoliday = (dayId: number) => {
        setHolidays(prev =>
            prev.includes(dayId) ? prev.filter(id => id !== dayId) : [...prev, dayId]
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) return;

        const finalRate = Number(toWesternDigits(rate).replace(',', '.'));
        const finalStartDay = Number(toWesternDigits(billingStartDay));
        onSave(academyName, name, isNaN(finalRate) ? 0 : finalRate, currency, academyRate?.monthlyDeductions || {}, isNaN(finalStartDay) ? 1 : finalStartDay, externalLink, holidays, currency === 'دولار' ? receiveInEGP : false, disableReports, whatsappNumber, openLinksExternally, includeReportHeader);
        onClose();
    };

    const inputClasses = "w-full p-3 bg-gray-50 text-gray-800 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-[#ffe05d] focus:bg-white transition-all placeholder-gray-400 text-right text-xl";

    return (
        <div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 font-arabic"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 super-scroller max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* === Sliding container (2 panels side by side) === */}
                <div
                    className="flex transition-transform duration-300 ease-in-out will-change-transform"
                    style={{ transform: showReportSettings ? 'translateX(100%)' : 'translateX(0)' }}
                >
                    {/* ─────── Panel 0: Main form ─────── */}
                    <section className="w-full flex-shrink-0">
                        {/* Header */}
                        <div className="relative p-6 text-center border-b border-gray-100">
                            <button
                                onClick={onClose}
                                className="absolute left-6 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                            >
                                <X size={24} />
                            </button>
                            <h2 className="text-3xl font-arabic text-gray-800 pt-2">{isAdd ? 'إضافة أكاديمية جديدة' : 'تعديل بيانات الأكاديمية'}</h2>
                            {!isAdd && (
                                <button
                                    type="button"
                                    onClick={() => setShowReportSettings(true)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-base font-bold text-gray-500 hover:text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-xl transition-all border border-transparent hover:border-blue-200 group shadow-sm bg-gray-50"
                                >
                                    <span className="font-arabic">تعديل التقرير</span>
                                    <ChevronLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
                                </button>
                            )}
                        </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="space-y-2">
                        <label className="block text-2xl font-bold text-gray-600 pr-1">اسم الأكاديمية</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className={`${inputClasses} ${/[a-zA-Z]/.test(name) ? 'font-english' : 'font-arabic'}`}
                            placeholder="اسم الأكاديمية"
                        />
                    </div>

                    <div className="flex gap-4">
                        <div className="space-y-2 flex-[2]">
                            <label className="block text-2xl font-bold text-gray-600 pr-1">أجر الساعة</label>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={rate}
                                onChange={e => {
                                    const val = e.target.value.replace(/[^0-9٠-٩.]/g, '');
                                    setRate(toHindiDigits(val));
                                }}
                                className={`${inputClasses} text-center font-english`}
                                placeholder="٠"
                            />
                        </div>

                        <div className="space-y-2 flex-1">
                            <label className="block text-2xl font-bold text-gray-600 pr-1">العملة</label>
                            <select
                                value={currency}
                                onChange={e => setCurrency(e.target.value)}
                                className={`${inputClasses} text-center text-xl appearance-none cursor-pointer`}
                                style={{ textAlignLast: 'center' }}
                            >
                                <option value="جنيه">جنيه</option>
                                <option value="دولار">دولار</option>
                                <option value="ريال">ريال</option>
                            </select>
                        </div>
                    </div>

                    {/* Receive in EGP Option - Only for USD */}
                    {currency === 'دولار' && (
                        <div className="flex items-center gap-3 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                            <input
                                type="checkbox"
                                id="receiveInEGP"
                                checked={receiveInEGP}
                                onChange={(e) => setReceiveInEGP(e.target.checked)}
                                className="w-5 h-5 rounded accent-blue-500 cursor-pointer"
                            />
                            <label htmlFor="receiveInEGP" className="cursor-pointer select-none flex items-baseline gap-3">
                                <span className="text-2xl text-gray-700 font-amiri" style={{ letterSpacing: '0.08em' }}>القبض بالمصري</span>
                                <span className="text-lg text-gray-700 font-tajawal opacity-50">(يحول للجنيه في الإحصائيات)</span>
                            </label>
                        </div>
                    )}



                    <div className="space-y-4">
                        <label className="block text-xl font-bold text-gray-600 pr-1">أيام أجازة الأكاديمية (اختياري)</label>
                        <div className="flex flex-wrap gap-2 justify-center bg-gray-50/50 p-4 rounded-2xl border-2 border-dashed border-gray-100">
                            {DAYS.map(day => (
                                <button
                                    key={day.id}
                                    type="button"
                                    onClick={() => toggleHoliday(day.id)}
                                    className={`
                                        w-12 h-12 rounded-full font-arabic text-lg transition-all border-2
                                        ${holidays.includes(day.id)
                                            ? 'bg-red-500 text-white border-red-400 shadow-md shadow-red-200'
                                            : 'bg-white text-gray-500 border-gray-100 hover:border-gray-200'}
                                    `}
                                >
                                    {day.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Academy Link */}
                    <div className="space-y-2">
                        <label className="text-lg font-medium text-gray-400 block pr-1">رابط الأكاديمية</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={externalLink || ''}
                                onChange={e => setExternalLink(e.target.value)}
                                className="w-full p-2.5 bg-gray-50/50 border border-gray-100 rounded-lg focus:outline-none focus:border-gray-300 focus:bg-white transition-all placeholder-gray-300 text-left font-english text-base dir-ltr text-gray-700"
                                placeholder=""
                                dir="ltr"
                            />
                            {isValidUrl(externalLink) && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
                                    <Check size={14} />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* WhatsApp for Academy */}
                    <div className="space-y-2">
                        <label className="text-lg font-medium text-gray-400 block pr-1">رقم واتساب / اسم المجموعة (الافتراضي)</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={whatsappNumber || ''}
                                onChange={e => setWhatsappNumber(e.target.value)}
                                className="w-full p-2.5 bg-gray-50/50 border border-gray-100 rounded-lg focus:outline-none focus:border-gray-300 focus:bg-white transition-all placeholder-gray-300 text-left font-english text-base dir-ltr text-gray-700"
                                placeholder=""
                                dir="ltr"
                            />
                            {whatsappNumber?.length > 2 && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
                                    <Check size={14} />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Billing Start Day */}
                    <div className="space-y-2">
                        <label className="text-lg font-medium text-gray-400 block pr-1">بداية دورة الحساب (يوم)</label>
                        <div className="relative">
                            <input
                                type="text"
                                inputMode="numeric"
                                value={billingStartDay}
                                onChange={e => {
                                    const val = e.target.value.replace(/[^0-9٠-٩]/g, '');
                                    if (val === '' || (Number(toWesternDigits(val)) >= 1 && Number(toWesternDigits(val)) <= 31)) {
                                        setBillingStartDay(toHindiDigits(val));
                                    }
                                }}
                                className="w-full p-2.5 bg-gray-50/50 border border-gray-100 rounded-lg focus:outline-none focus:border-gray-300 focus:bg-white transition-all placeholder-gray-300 text-center font-arabic text-base text-gray-700"
                                placeholder="١"
                            />
                        </div>
                    </div>




                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => setDisableReports(!disableReports)}>
                        <input
                            type="checkbox"
                            checked={disableReports}
                            onChange={(e) => setDisableReports(e.target.checked)}
                            className="w-5 h-5 rounded accent-gray-600 cursor-pointer"
                            id="disableReportsParams"
                        />
                        <label htmlFor="disableReportsParams" className="cursor-pointer select-none text-xl font-bold text-gray-600">
                            تعطيل التقارير
                        </label>
                        <span className="text-sm text-gray-400 font-medium mr-auto">
                            (لن يظهر زر التقرير للطلاب)
                        </span>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => setOpenLinksExternally(!openLinksExternally)}>
                        <input
                            type="checkbox"
                            checked={openLinksExternally}
                            onChange={(e) => setOpenLinksExternally(e.target.checked)}
                            className="w-5 h-5 rounded accent-gray-600 cursor-pointer"
                            id="openLinksExternallyParam"
                        />
                        <label htmlFor="openLinksExternallyParam" className="cursor-pointer select-none text-xl font-bold text-gray-600">
                            فتح الروابط خارجيًا
                        </label>
                        <span className="text-sm text-gray-400 font-medium mr-auto">
                            (يفتح رابط الحصة في المتصفح الخارجي)
                        </span>
                    </div>
                    <div className="pt-6 flex gap-3">
                        <button
                            type="submit"
                            className="flex-[2] py-3 bg-[#ffe05d] text-gray-900 text-2xl font-arabic rounded-xl hover:bg-[#fcd030] hover:shadow-lg hover:shadow-[#ffe05d]/20 active:scale-[0.98] transition-all pb-4"
                        >
                            {isAdd ? 'إضافة الأكاديمية' : 'حفظ التعديلات'}
                        </button>

                        {!isAdd && onDelete && (
                            <button
                                type="button"
                                onClick={() => {
                                    onDelete();
                                    onClose();
                                }}
                                className="w-14 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 hover:text-red-600 transition-all flex items-center justify-center pb-1 border border-red-100"
                                title="حذف الأكاديمية"
                            >
                                <Trash2 size={24} strokeWidth={2} />
                            </button>
                        )}
                    </div>
                </form>
            </section>
            {/* ─── End Panel 0 ─── */}

            {/* ─── Panel 1: إعدادات التقرير ─── */}
            <section className="w-full flex-shrink-0">
                <div className="relative p-6 text-center border-b border-gray-100">
                    <button
                        type="button"
                        onClick={() => setShowReportSettings(false)}
                        className="absolute right-6 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                        title="رجوع"
                    >
                        <ChevronLeft size={24} style={{ transform: 'scaleX(-1)' }} />
                    </button>
                    <h2 className="text-3xl font-arabic text-gray-800 pt-2">إعدادات التقرير</h2>
                </div>

                <div className="p-8 space-y-6">
                    <div className="space-y-4">
                        <div
                            className="flex items-center gap-4 p-5 bg-white rounded-2xl border-2 border-gray-100 cursor-pointer hover:border-[#ffe05d] hover:bg-gray-50 transition-all group shadow-sm"
                            onClick={() => setIncludeReportHeader(!includeReportHeader)}
                        >
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${includeReportHeader ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                                <FileText size={24} />
                            </div>
                            <div className="flex-1">
                                <label className="block text-xl font-bold text-gray-700 cursor-pointer select-none">
                                    تضمين رأس التقرير
                                </label>
                            </div>
                            <input
                                type="checkbox"
                                checked={includeReportHeader}
                                onChange={(e) => setIncludeReportHeader(e.target.checked)}
                                className="w-6 h-6 rounded-lg accent-blue-500 cursor-pointer"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>

                        {/* Add more settings here in the future if needed */}
                    </div>

                    <button
                        type="button"
                        onClick={() => handleSubmit({ preventDefault: () => { } } as React.FormEvent)}
                        className="w-full py-3 bg-[#ffe05d] text-gray-900 text-xl font-bold font-arabic rounded-xl hover:bg-[#fcd030] hover:shadow-lg hover:shadow-[#ffe05d]/20 active:scale-[0.98] transition-all pb-4"
                    >
                        حفظ جميع الإعدادات
                    </button>
                </div>
            </section>
            {/* ─── End Panel 1 ─── */}
        </div>
    </div>
</div>
    );
};

export default AcademyEditModal;
