import React, { useState, useEffect, useRef } from 'react';
import { X, Trash2, Clock, Link, Check, Phone, ChevronDown, ChevronLeft } from 'lucide-react';
import { Student } from '../types';
import { DAYS_OF_WEEK } from '../constants';

interface Props {
  onClose: () => void;
  onSave: (student: Student) => void;
  onDelete?: (id: string) => void;
  academies: string[];
  student?: Student;
  academyRates?: Record<string, { rate: number; currency: string; holidays?: number[] }>;
  onEndEnrollment?: (student: Student) => void;
  prefillAcademy?: string;
  currentMonth: number;
  currentYear: number;
  onAssignTajweed?: () => void;
  students?: Student[];
  showToast?: (msg: string) => void;
}

// Convert Western numerals to Hindi numerals
const toHindiDigits = (str: string): string => {
  return str.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)]);
};

// Convert Hindi numerals back to Western for storage
const toWesternDigits = (str: string): string => {
  return str.toString().replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
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

const StudentModal: React.FC<Props> = ({ onClose, onSave, onDelete, onEndEnrollment, academies, student, academyRates, prefillAcademy, currentMonth, currentYear, onAssignTajweed, students, showToast }) => {
  const [name, setName] = useState(student?.name || '');
  const [academy, setAcademy] = useState(student?.academy || prefillAcademy || '');
  const [studentTargetAge, setStudentTargetAge] = useState<'kids' | 'adults'>(student?.targetAge || 'adults');
  const [currency, setCurrency] = useState(student?.location || 'جنيه');
  const [rate, setRate] = useState(student?.rate ? toHindiDigits(student.rate.toString()) : '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>(student?.days || []);
  const [duration, setDuration] = useState(student?.duration || '٣٠');
  const [paymentBasis, setPaymentBasis] = useState(student?.paymentBasis || 'بالحصة');
  const [useAcademyRate, setUseAcademyRate] = useState(student?.useAcademyRate ?? false);
  const [externalLink, setExternalLink] = useState(student?.externalLink || '');
  const [color, setColor] = useState(student?.color || '');
  const [disableReport, setDisableReport] = useState(student?.disableReport ?? false);
  const [whatsappNumber, setWhatsappNumber] = useState(student?.whatsappNumber || '');
  const [zoomLink, setZoomLink] = useState(student?.zoomLink || '');
  const [scheduleMessage, setScheduleMessage] = useState(student?.scheduleMessage || '');
  const [showStudentWeb, setShowStudentWeb] = useState(false);
  const [isEndingEnrollment, setIsEndingEnrollment] = useState(!!student?.deletedAt);
  const [dayStartDates, setDayStartDates] = useState<Record<number, string>>(student?.dayStartDates || {});
  const formRef = useRef<HTMLFormElement>(null);

  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Update dayStartDates automatically when selectedDays changes
  useEffect(() => {
    setDayStartDates(prev => {
      const next = { ...prev };
      let changed = false;
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      selectedDays.forEach(dayId => {
        // If it's a new day (not in original student and not in prev state)
        const wasOriginallyPresent = student?.days?.includes(dayId);
        if (!next[dayId] && (!student || !wasOriginallyPresent)) {
          next[dayId] = todayStr;
          changed = true;
        }
      });

      // Cleanup removed days
      Object.keys(next).forEach(dayIdStr => {
        const dayId = parseInt(dayIdStr);
        if (!selectedDays.includes(dayId)) {
          delete next[dayId];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [selectedDays, student]);

  // Sync rate and basis when academy or duration changes, if using academy rate
  React.useEffect(() => {
    if (useAcademyRate && academyRates && academyRates[academy]) {
      const { rate: acRate, currency: acCurrency } = academyRates[academy];

      // Dynamic Calculation:
      const normalizedDuration = toWesternDigits(duration);

      let displayPrice = acRate;
      if (duration === 'خليط') {
        displayPrice = acRate;
      } else {
        // Proportional calculation: (minutes / 60) × hourly rate
        const mins = parseInt(normalizedDuration) || 30;
        displayPrice = (mins / 60) * acRate;
      }

      setRate(toHindiDigits(displayPrice.toString()));
      setCurrency(acCurrency);

      // Auto-set basis for Academy Rate
      if (normalizedDuration === '60' || duration === 'خليط') {
        setPaymentBasis('بالساعة');
      } else {
        setPaymentBasis('بالحصة');
      }
    }
  }, [academy, useAcademyRate, academyRates, duration]);

  // Auto-switch Payment Basis based on Duration (General Rule)
  React.useEffect(() => {
    const normalized = toWesternDigits(duration);
    if (normalized === '60' || duration === 'خليط') {
      setPaymentBasis('بالساعة');
    } else {
      // 30 min or custom duration → per-session
      setPaymentBasis('بالحصة');
    }
  }, [duration]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !academy || !rate) return;

    const savedStudent: Student = {
      ...student,
      id: student?.id || Date.now().toString(),
      name,
      academy,
      targetAge: studentTargetAge,
      location: currency,
      rate: Number(toWesternDigits(rate).replace(',', '.')),
      duration,
      paymentBasis,
      useAcademyRate,
      externalLink,
      color,
      disableReport,
      whatsappNumber: whatsappNumber, // Store as is (number or group name)
      zoomLink,
      scheduleMessage,
      deletedAt: isEndingEnrollment ? (() => {
        let dMonth = currentMonth + 1;
        let dYear = currentYear;
        if (dMonth > 11) {
          dMonth = 0;
          dYear++;
        }
        return { month: dMonth, year: dYear };
      })() : undefined,
      days: isEndingEnrollment ? [] : selectedDays,
      dayStartDates: isEndingEnrollment ? {} : dayStartDates
    };

    if (name && students) {
      const isDuplicate = students.some(s =>
        s.name.trim() === name.trim() && s.id !== student?.id
      );
      if (isDuplicate) {
        if (showToast) {
          showToast('⚠️ هذا الاسم موجود مسبقاً لطالب آخر!');
        } else {
          alert('⚠️ هذا الاسم موجود مسبقاً لطالب آخر!');
        }
        return;
      }
    }

    onSave(savedStudent);
  };

  const filteredAcademies = academies.filter(ac =>
    ac.toLowerCase().includes(academy.toLowerCase()) && ac !== academy
  );

  const inputClasses = "w-full px-10 py-2 bg-gray-50 text-gray-900 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-[#ffe05d] focus:bg-white transition-all placeholder-gray-400 text-right text-[25px]";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 font-arabic"
      onClick={onClose}
      onWheel={(e) => {
        if (formRef.current) {
          formRef.current.scrollTop += e.deltaY;
        }
      }}
    >
      <div
        className="student-modal-card bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* === Sliding container (2 panels side by side) === */}
        <div
          className="flex transition-transform duration-300 ease-in-out will-change-transform"
          style={{ transform: showStudentWeb ? 'translateX(100%)' : 'translateX(0)' }}
        >

          {/* ─────── Panel 0: Main form ─────── */}
          <section className="w-full flex-shrink-0">

            {/* Header */}
            <div className="relative p-6 text-center border-b border-gray-100">
              <button onClick={onClose} className="absolute left-6 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                <X size={24} />
              </button>
              <h2 className="text-3xl font-arabic text-gray-800 pt-2">{student ? 'تعديل بيانات الطالب' : 'إضافة طالب'}</h2>
              {student && (
                <button
                  type="button"
                  onClick={() => setShowStudentWeb(true)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-base font-bold text-gray-500 hover:text-amber-600 hover:bg-amber-50 px-4 py-2 rounded-xl transition-all border border-transparent hover:border-amber-200 group shadow-sm bg-gray-50"
                >
                  <span className="font-arabic">واجهة الطالب</span>
                  <ChevronLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
                </button>
              )}
            </div>

            <form ref={formRef} onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto overscroll-contain max-h-[calc(95vh-90px)]">
              <div className="space-y-2">
                <label className="block text-2xl font-bold text-gray-600 pr-1">اسم الطالب</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(toHindiDigits(e.target.value))}
                  className={`${inputClasses} ${/[a-zA-Z]/.test(name) ? 'font-english text-lg' : 'font-arabic text-[25px]'}`}
                  placeholder=""
                />
              </div>


              <div className="space-y-2 relative">
                <label className="block text-2xl font-bold text-gray-600 pr-1">الأكاديمية</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={academy}
                    onChange={e => {
                      setAcademy(toHindiDigits(e.target.value));
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    className={`${inputClasses} ${/[a-zA-Z]/.test(academy) ? 'font-english text-xl' : 'font-arabic text-[25px]'}`}
                    placeholder=""
                    autoComplete="off"
                  />
                  {showSuggestions && filteredAcademies.length > 0 && (
                    <div className="absolute top-full right-0 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto">
                      {filteredAcademies.map(ac => (
                        <div
                          key={ac}
                          onClick={() => {
                            setAcademy(ac);
                            setShowSuggestions(false);
                          }}
                          className={`px-6 py-4 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-none text-gray-700 transition-colors text-right text-[22px] ${/[a-zA-Z]/.test(ac) ? 'font-english' : 'font-arabic'}`}
                        >
                          {ac}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-2xl font-bold text-gray-600 pr-1">زمن الحصة</label>
                <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100">
                  {['٣٠', '٦٠', 'خليط'].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDuration(d)}
                      className={`flex-1 py-1 rounded-lg text-2xl transition-all ${duration === d
                        ? 'bg-white text-gray-800 shadow-sm font-bold border border-gray-100'
                        : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                      {d}
                    </button>
                  ))}
                  {/* Custom duration button */}
                  <button
                    type="button"
                    onClick={() => { if (['٣٠', '٦٠', 'خليط'].includes(duration)) setDuration(''); }}
                    className={`flex-1 py-1 rounded-lg text-xl transition-all ${!['٣٠', '٦٠', 'خليط'].includes(duration)
                      ? 'bg-white text-gray-800 shadow-sm font-bold border border-gray-100'
                      : 'text-gray-400 hover:text-gray-600'
                      }`}
                  >
                    ✏️
                  </button>
                </div>
                {/* Custom duration input */}
                {!['٣٠', '٦٠', 'خليط'].includes(duration) && (
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    value={duration}
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9٠-٩]/g, '');
                      setDuration(toHindiDigits(val));
                    }}
                    placeholder=""
                    className="w-full px-4 py-2 bg-gray-50 border-2 border-[#ffe05d] rounded-xl text-center text-2xl font-arabic focus:outline-none placeholder-gray-200"
                  />
                )}
              </div>

              <div className="row flex gap-4">
                <div className={`space-y-2 flex-1 transition-all duration-300 ${useAcademyRate ? 'opacity-60' : ''}`}>
                  <label className="block text-2xl font-bold text-gray-600 pr-1">
                    {useAcademyRate ? (duration === 'خليط' ? 'سعر الساعة (محسوب)' : 'سعر الحصة (محسوب)') : 'السعر'}
                  </label>
                  <input
                    type="text"
                    required
                    inputMode="decimal"
                    value={rate}
                    readOnly={useAcademyRate}
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9٠-٩.]/g, '');
                      setRate(toHindiDigits(val));
                    }}
                    className={`${inputClasses} text-center ${useAcademyRate ? 'border-red-300 bg-red-50/50' : ''}`}
                    placeholder="٠"
                  />
                </div>

                <div className={`space-y-2 flex-1 transition-all duration-300 ${useAcademyRate ? 'opacity-60' : ''}`}>
                  <label className="block text-2xl font-bold text-gray-600 pr-1">العملة</label>
                  <select
                    value={currency}
                    disabled={useAcademyRate}
                    onChange={e => setCurrency(e.target.value)}
                    className={`${inputClasses} text-center text-2xl px-6 py-3 appearance-none cursor-pointer leading-relaxed ${useAcademyRate ? 'border-red-300 bg-red-50/50' : ''}`}
                    style={{ textAlignLast: 'center' }}
                  >
                    <option value="جنيه">جنيه</option>
                    <option value="دولار">دولار</option>
                    <option value="يورو">يورو</option>
                  </select>
                </div>

                <div className={`space-y-2 flex-1 ${useAcademyRate ? 'opacity-60' : ''}`}>
                  <label className="block text-2xl font-bold text-gray-600 pr-1">النظام</label>
                  <select
                    value={duration === 'خليط' ? 'بالساعة' : paymentBasis}
                    disabled={useAcademyRate || duration === 'خليط'}
                    onChange={e => setPaymentBasis(e.target.value)}
                    className={`${inputClasses} text-center text-2xl px-6 py-3 appearance-none cursor-pointer leading-relaxed ${useAcademyRate ? 'border-red-300 bg-red-50/50' : ''}`}
                    style={{ textAlignLast: 'center' }}
                  >
                    <option value="بالحصة">بالحصة</option>
                    <option value="بالساعة">بالساعة</option>
                  </select>
                </div>
              </div>

              {academy && academyRates && academyRates[academy] && (
                <div className="flex flex-col gap-2">
                  <div className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${useAcademyRate ? 'bg-red-50/50 border-red-300/30' : 'bg-gray-50/50 border-gray-100'}`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="useAcademyRate"
                        checked={useAcademyRate}
                        onChange={e => setUseAcademyRate(e.target.checked)}
                        className="w-5 h-5 accent-red-500 cursor-pointer"
                      />
                      <label htmlFor="useAcademyRate" className="text-xl font-bold text-gray-700 cursor-pointer select-none">
                        اتباع سعر الأكاديمية
                      </label>
                    </div>
                  </div>
                </div>
              )}


              <div className="space-y-2">
                <label className="block text-2xl font-bold text-gray-600 pr-1">الأيام</label>
                <div className="student-modal-days-row flex flex-nowrap gap-1.5 overflow-x-auto justify-center bg-gray-50 p-2 rounded-xl border border-gray-100 no-scrollbar">
                  {[...DAYS_OF_WEEK].sort((a, b) => (a.id === 6 ? -1 : b.id === 6 ? 1 : a.id - b.id)).filter(d => d.id !== 5).map((day) => {
                    const occurrences = selectedDays.filter(d => d === day.id).length;
                    const isSelected = occurrences > 0;
                    const isDouble = occurrences === 2;

                    const academyHolidays = academyRates?.[academy]?.holidays || [];
                    const isHoliday = academyHolidays.includes(day.id);

                    return (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => {
                          setSelectedDays(prev => {
                            if (duration === 'خليط') {
                              // Triple toggle: 0 -> 1 -> 2 -> 0
                              if (occurrences === 0) return [...prev, day.id];
                              if (occurrences === 1) return [...prev, day.id];
                              return prev.filter(d => d !== day.id);
                            } else {
                              // Normal toggle
                              return prev.includes(day.id)
                                ? prev.filter(d => d !== day.id)
                                : [...prev, day.id];
                            }
                          });
                        }}
                        className={`relative px-3.5 py-2.5 rounded-xl text-[22px] font-neirizi transition-all whitespace-nowrap min-w-[65px] flex flex-col items-center justify-center ${isSelected
                          ? `bg-[#ffe05d] text-gray-900 shadow-sm ${isDouble ? 'ring-2 ring-gray-900 ring-offset-2' : ''}`
                          : 'bg-white text-gray-500 border border-gray-200 hover:border-[#ffe05d] hover:text-gray-900'
                          } ${isHoliday ? 'opacity-40 grayscale-[0.8] saturate-50' : ''}`}
                        title={isHoliday ? 'هذا اليوم أجازة للأكاديمية' : undefined}
                      >
                        {day.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-8 mt-4 border-t border-gray-100 flex flex-col gap-6">
                <div className="flex items-center gap-4">
                  <label className="text-lg font-medium text-gray-400 flex items-center gap-2 whitespace-nowrap font-neirizi w-32">
                    <Link size={18} className="text-gray-300" />
                    رابط خارجي
                  </label>
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={externalLink}
                      onChange={e => setExternalLink(e.target.value)}
                      className={`${inputClasses} py-1.5 px-4 !text-sm border-gray-200 focus:border-gray-300 bg-white text-left font-english ${isValidUrl(externalLink) ? 'text-gray-900 pr-10' : 'text-gray-400'}`}
                      dir="ltr"
                      placeholder=""
                    />
                    {isValidUrl(externalLink) && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 animate-in fade-in zoom-in slide-in-from-right-2 duration-300">
                        <div className="bg-emerald-100 text-emerald-600 rounded-full p-1 shadow-sm border border-emerald-200">
                          <Check size={12} strokeWidth={4} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <label className="text-lg font-medium text-gray-400 flex items-center gap-2 whitespace-nowrap font-neirizi w-32">
                    <Phone size={18} className="text-gray-300" />
                    رقم واتساب / اسم المجموعة
                  </label>
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={whatsappNumber}
                      onChange={e => setWhatsappNumber(e.target.value)}
                      className={`${inputClasses} py-1.5 px-4 !text-sm border-gray-200 focus:border-gray-300 bg-white text-left font-english ${whatsappNumber.length > 2 ? 'text-gray-900 pr-10' : 'text-gray-400'}`}
                      dir="ltr"
                      placeholder=""
                    />
                    {whatsappNumber.length > 2 && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 animate-in fade-in zoom-in slide-in-from-right-2 duration-300">
                        <div className="bg-green-100 text-green-600 rounded-full p-1 shadow-sm border border-green-200">
                          <Check size={12} strokeWidth={4} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <label className="text-lg font-medium text-gray-400 w-32">خيارات إضافية</label>
                  <div className="flex-1 flex items-center justify-between">
                    {/* Student Color */}
                    <div className="flex items-center gap-2">
                      <div className="flex justify-center gap-1.5 bg-gray-50 p-1.5 rounded-lg border border-gray-100/50">
                        {[
                          { id: '', bg: 'bg-white', border: 'border-gray-200' },
                          { id: 'red', bg: 'bg-rose-100', border: 'border-rose-400' },
                          { id: 'orange', bg: 'bg-orange-100', border: 'border-orange-400' },
                          { id: 'green', bg: 'bg-emerald-100', border: 'border-emerald-400' },
                          { id: 'blue', bg: 'bg-blue-100', border: 'border-blue-400' },
                          { id: 'purple', bg: 'bg-violet-100', border: 'border-violet-400' },
                        ].map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setColor(c.id)}
                            className={`w-8 h-8 rounded-full border transition-all duration-200 flex items-center justify-center ${c.bg
                              } ${c.border} ${color === c.id
                                ? 'ring-2 ring-offset-1 ring-gray-300 scale-110 shadow-sm'
                                : 'hover:scale-105 opacity-60 hover:opacity-100'
                              }`}
                            title={c.id || 'افتراضي'}
                          >
                            {color === c.id && <Check size={14} className={`stroke-[3px] ${c.id ? 'text-gray-600' : 'text-gray-400'}`} />}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Disable Report */}
                    <div className="flex items-center gap-2 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer" onClick={() => setDisableReport(!disableReport)}>
                      <input
                        type="checkbox"
                        id="disableReport"
                        checked={disableReport}
                        onChange={e => setDisableReport(e.target.checked)}
                        className="w-4 h-4 accent-gray-500 cursor-pointer"
                      />
                      <label htmlFor="disableReport" className="text-base text-gray-500 cursor-pointer select-none">
                        تعطيل التقرير
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 mt-4 border-t border-gray-100 flex items-stretch gap-3">
                {student && (onDelete || onEndEnrollment) ? (
                  <div className="flex w-full gap-3">
                    <button
                      type="submit"
                      className="flex-[2] py-3 bg-[#ffe05d] text-gray-900 text-xl font-bold font-arabic rounded-xl hover:bg-[#fcd030] hover:shadow-lg hover:shadow-[#ffe05d]/20 active:scale-[0.98] transition-all pb-3.5"
                    >
                      تعديل
                    </button>

                    {/* End Enrollment Toggle */}
                    <button
                      type="button"
                      onClick={() => setIsEndingEnrollment(!isEndingEnrollment)}
                      className={`w-14 rounded-xl transition-all flex items-center justify-center border ${isEndingEnrollment
                        ? 'bg-red-500 text-white border-red-600 hover:bg-red-600 shadow-md ring-2 ring-red-200'
                        : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100'
                        }`}
                      title={isEndingEnrollment ? "تراجع عن إنهاء الاشتراك" : "حذف ما تبقى (إنهاء الاشتراك)"}
                    >
                      {isEndingEnrollment ? <X size={22} strokeWidth={2.5} /> : <Clock size={22} strokeWidth={2} />}
                    </button>

                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => {
                          onDelete(student.id);
                          onClose();
                        }}
                        className="w-14 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-all flex items-center justify-center border border-red-100"
                        title="حذف الطالب نهائياً"
                      >
                        <Trash2 size={22} strokeWidth={2} />
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="submit"
                    className="w-full py-3 bg-[#ffe05d] text-gray-900 text-2xl font-arabic rounded-xl hover:bg-[#fcd030] hover:shadow-lg hover:shadow-[#ffe05d]/20 active:scale-[0.98] transition-all pb-4"
                  >
                    حفظ
                  </button>
                )}
              </div>
            </form>
          </section>
          {/* ─── End Panel 0 ─── */}

          {/* ─── Panel 1: واجهة الطالب ─── */}
          <section className="w-full flex-shrink-0">
            <div className="relative p-6 text-center border-b border-gray-100">
              <button
                type="button"
                onClick={() => setShowStudentWeb(false)}
                className="absolute right-6 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                title="رجوع"
              >
                <ChevronLeft size={24} style={{ transform: 'scaleX(-1)' }} />
              </button>
              <h2 className="text-3xl font-arabic text-gray-800 pt-2">واجهة الطالب</h2>
            </div>

            <div className="p-8 space-y-6 overflow-y-auto overscroll-contain max-h-[calc(95vh-90px)]">
              {/* Zoom Link */}
              <div className="space-y-2">
                <label className="block text-xl font-bold text-gray-600 flex items-center gap-2">
                  <Link size={18} className="text-gray-400" />
                  رابط زوم
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={zoomLink}
                    onChange={e => setZoomLink(e.target.value)}
                    className={`w-full px-4 py-2.5 bg-gray-50 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-[#ffe05d] focus:bg-white transition-all text-sm font-english text-left ${isValidUrl(zoomLink) ? 'text-gray-900 pr-10' : 'text-gray-400'}`}
                    dir="ltr"
                  />
                  {isValidUrl(zoomLink) && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="bg-emerald-100 text-emerald-600 rounded-full p-1 border border-emerald-200">
                        <Check size={12} strokeWidth={4} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Schedule Message */}
              <div className="space-y-2">
                <label className="block text-xl font-bold text-gray-600 flex items-center gap-2">
                  <span>🕒</span>
                  رسالة الجدول (من الواتساب)
                </label>
                <textarea
                  value={scheduleMessage}
                  onChange={e => setScheduleMessage(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-[#ffe05d] focus:bg-white transition-all text-sm font-english text-left resize-y min-h-[130px]"
                  dir="ltr"
                  rows={5}
                />
              </div>

              {/* Student Age Group */}
              <div className="space-y-2">
                <label className="block text-xl font-bold text-gray-600 font-arabic">فئة الطالب</label>
                <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100">
                  <button
                    type="button"
                    onClick={() => setStudentTargetAge('kids')}
                    className={`flex-1 py-2 rounded-lg text-lg font-arabic transition-all ${studentTargetAge === 'kids'
                      ? 'bg-white text-emerald-700 shadow-sm border border-emerald-200 font-bold'
                      : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    صغار
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudentTargetAge('adults')}
                    className={`flex-1 py-2 rounded-lg text-lg font-arabic transition-all ${studentTargetAge === 'adults'
                      ? 'bg-white text-emerald-700 shadow-sm border border-emerald-200 font-bold'
                      : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    كبار
                  </button>
                </div>
              </div>

              {/* Save */}
              <button
                type="button"
                onClick={() => handleSubmit({ preventDefault: () => { } } as React.FormEvent)}
                className="w-full py-3 bg-[#ffe05d] text-gray-900 text-xl font-bold font-arabic rounded-xl hover:bg-[#fcd030] hover:shadow-lg hover:shadow-[#ffe05d]/20 active:scale-[0.98] transition-all pb-4"
              >
                حفظ
              </button>
            </div>
          </section>
          {/* ─── End Panel 1 ─── */}

        </div>
        {/* === End sliding container === */}

      </div>
    </div>
  );
};

export default StudentModal;
