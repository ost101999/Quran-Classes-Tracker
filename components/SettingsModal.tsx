import React, { useRef } from 'react';
import { X, Download, Upload, Shield, Database, Trash2, Clock, Calendar, Info, ChevronDown, Link, MessageCircle, FolderOpen, ShieldCheck } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    data: {
        students: any[];
        attendance: any;
        month: number;
        year: number;
        dayOff: number;
        academyRates?: any;
        academyOrder?: string[];
        monthlyObligations?: any;
        paymentStatus?: any;
        autoBackupConfig?: {
            enabled: boolean;
            interval: number;
            lastBackupAt: number | null;
            backupPath?: string;
        };
        dayTransitionTime?: string;
        showMakeupLines?: boolean;
        confirmNonTodayAttendance?: boolean;

    };
    onImport: (data: any) => void;
    onClearAll: () => void;
    onExport: () => void;
    onUpdateAutoBackup: (config: any) => void;
    onUpdateDayTransitionTime: (time: string) => void;
    onUpdateShowMakeupLines: (show: boolean) => void;
    onUpdateShowMakeupLines: (show: boolean) => void;
    onUpdateConfirmNonToday: (confirm: boolean) => void;
    onSelectBackupFolder?: () => void;
}

const SettingsModal: React.FC<Props> = ({ isOpen, onClose, data, onImport, onClearAll, onExport, onUpdateAutoBackup, onUpdateDayTransitionTime, onUpdateShowMakeupLines, onUpdateConfirmNonToday, onSelectBackupFolder }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isInfoOpen, setIsInfoOpen] = React.useState(false);
    const [isAutoBackupExpanded, setIsAutoBackupExpanded] = React.useState(false);

    if (!isOpen) return null;

    const autoBackup = data.autoBackupConfig || { enabled: false, interval: 60, lastBackupAt: null, backupPath: '' };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parsed = JSON.parse(e.target?.result as string);
                if (parsed.students && parsed.attendance) {
                    onImport(parsed);
                    alert('تم استيراد البيانات بنجاح! ✨');
                } else {
                    alert('الملف المختار غير صالح أو تالف.');
                }
            } catch (err) {
                alert('حدث خطأ أثناء قراءة الملف.');
            }
        };
        reader.readAsText(file);
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 font-arabic"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300 border border-white/20"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="relative p-6 text-center border-b border-gray-100 bg-gray-50/50">
                    <button
                        onClick={onClose}
                        className="absolute left-6 top-1/2 -translate-y-1/2 p-2 hover:bg-red-50 hover:text-red-500 rounded-full text-gray-400 transition-all active:scale-95"
                    >
                        <X size={24} />
                    </button>
                    <div className="flex flex-col items-center">
                        <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-2 shadow-sm">
                            <Shield size={26} />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800">إعدادات النظام</h2>
                        <p className="text-lg text-gray-500 mt-1">إدارة البيانات والنسخ الاحتياطي</p>
                    </div>
                </div>

                {/* Content */}
                <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {/* Data Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-gray-400 px-1">
                            <Database size={18} />
                            <span className="text-sm font-bold tracking-wider uppercase">البيانات والنسخ الاحتياطي</span>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            {/* Export Button */}
                            <button
                                onClick={onExport}
                                className="group flex items-center justify-between p-4 bg-blue-50/50 hover:bg-blue-50 border border-blue-100 rounded-2xl transition-all active:scale-[0.98]"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-blue-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                                        <Upload size={20} />
                                    </div>
                                    <div className="text-right space-y-1">
                                        <div className="font-bold text-gray-800 text-2xl">تصدير النسخة</div>
                                        <div className="text-lg text-blue-800 opacity-50">حفظ جميع البيانات يدوياً</div>
                                    </div>
                                </div>
                            </button>

                            {/* Import Button */}
                            <button
                                onClick={handleImportClick}
                                className="group flex items-center justify-between p-4 bg-emerald-50/50 hover:bg-emerald-50 border border-emerald-100 rounded-2xl transition-all active:scale-[0.98]"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
                                        <Download size={20} />
                                    </div>
                                    <div className="text-right space-y-1">
                                        <div className="font-bold text-gray-800 text-2xl">استيراد النسخة</div>
                                        <div className="text-lg text-emerald-800 opacity-50">استرجاع البيانات من ملف سابق</div>
                                    </div>
                                </div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept=".json"
                                    onChange={handleFileChange}
                                />
                            </button>

                            {/* Auto Backup Toggle */}
                            <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-2xl space-y-4">
                                <div className="flex items-center justify-between">
                                    <div
                                        className="flex items-center gap-4 cursor-pointer flex-1"
                                        onClick={() => autoBackup.enabled && setIsAutoBackupExpanded(!isAutoBackupExpanded)}
                                    >
                                        <div className="w-10 h-10 bg-amber-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-amber-200">
                                            <Clock size={20} />
                                        </div>
                                        <div className="text-right space-y-1">
                                            <div className="font-bold text-gray-800 text-2xl">الحفظ التلقائي</div>
                                            <div className="text-lg text-amber-800 opacity-50 whitespace-nowrap">حفظ تلقائي كل فترة</div>
                                        </div>
                                        {autoBackup.enabled && (
                                            <ChevronDown size={18} className={`text-amber-400 transition-transform duration-300 ${isAutoBackupExpanded ? 'rotate-180' : ''}`} />
                                        )}
                                    </div>
                                    <button
                                        onClick={() => onUpdateAutoBackup({ ...autoBackup, enabled: !autoBackup.enabled })}
                                        className={`w-14 h-8 rounded-full transition-all relative ${autoBackup.enabled ? 'bg-amber-500' : 'bg-gray-300'}`}
                                    >
                                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${autoBackup.enabled ? 'right-7' : 'right-1'}`} />
                                    </button>
                                </div>

                                {autoBackup.enabled && isAutoBackupExpanded && (
                                    <div className="flex flex-col gap-4 pt-2 border-t border-amber-100/50 animate-in slide-in-from-top-2 duration-200">
                                        <label className="text-sm font-bold text-amber-800">تكرار النسخ:</label>
                                        <div className="grid grid-cols-4 gap-2">
                                            {[30, 60, 360, 1440].map(val => (
                                                <button
                                                    key={val}
                                                    onClick={() => onUpdateAutoBackup({ ...autoBackup, interval: val })}
                                                    className={`py-2 px-1 rounded-xl text-base font-tajawal font-bold transition-all ${autoBackup.interval === val
                                                        ? 'bg-amber-500 text-white shadow-md'
                                                        : 'bg-white text-gray-400 border border-amber-100'
                                                        }`}
                                                >
                                                    {val < 60 ? `${val} دقيقة` : val < 1440 ? `${val / 60} ساعة` : '٢٤ ساعة'}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Backup Folder Picker */}
                                        <div className="pt-2 border-t border-amber-100/50 space-y-2">
                                            <label className="text-sm font-bold text-amber-800">مسار الحفظ:</label>
                                            <button
                                                onClick={onSelectBackupFolder}
                                                className="w-full flex items-center gap-3 p-3 bg-white hover:bg-amber-50 border border-amber-200 rounded-xl transition-all active:scale-[0.98] text-right"
                                            >
                                                <FolderOpen size={20} className="text-amber-600 shrink-0" />
                                                {autoBackup.backupPath ? (
                                                    <span className="text-sm text-gray-700 font-mono truncate flex-1 text-left" dir="ltr">{autoBackup.backupPath}</span>
                                                ) : (
                                                    <span className="text-sm text-gray-400 flex-1">اختر مجلد الحفظ...</span>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Day Transition Setting */}
                            <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-indigo-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                                        <Calendar size={20} />
                                    </div>
                                    <div className="text-right space-y-1">
                                        <div className="font-bold text-gray-800 text-2xl">ساعة بدء اليوم</div>
                                        <div className="text-lg text-indigo-600 opacity-50 whitespace-nowrap">تحديد متى ينتقل الشريط ليوم جديد</div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-4 pt-2 border-t border-indigo-100/50">
                                    <div className="flex items-center justify-between px-2">
                                        <span className="text-lg font-bold text-indigo-700">وقت البدء:</span>
                                        <input
                                            type="time"
                                            value={data.dayTransitionTime || "00:00"}
                                            onChange={(e) => onUpdateDayTransitionTime(e.target.value)}
                                            className="h-12 px-4 rounded-xl border border-indigo-200 bg-white text-indigo-700 font-tajawal font-bold text-xl shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Appearance Settings - Makeup Lines */}
                            <div className="p-4 bg-rose-50/50 border border-rose-100 rounded-2xl space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-rose-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-rose-200">
                                            <Link size={20} />
                                        </div>
                                        <div className="text-right space-y-1">
                                            <div className="font-bold text-gray-800 text-2xl">خطوط التعويض</div>
                                            <div className="text-lg text-rose-800 opacity-50 whitespace-nowrap">عرض الخطوط المتصلة بين الحصص</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => onUpdateShowMakeupLines(!data.showMakeupLines)}
                                        className={`w-14 h-8 rounded-full transition-all relative ${data.showMakeupLines ? 'bg-rose-500' : 'bg-gray-300'}`}
                                    >
                                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${data.showMakeupLines ? 'right-7' : 'right-1'}`} />
                                    </button>
                                </div>
                            </div>

                            {/* Confirm Non-Today Attendance */}
                            <div className="p-4 bg-cyan-50/50 border border-cyan-100 rounded-2xl space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-cyan-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-cyan-200">
                                            <ShieldCheck size={20} />
                                        </div>
                                        <div className="text-right space-y-1">
                                            <div className="font-bold text-gray-800 text-2xl">تأكيد الحضور</div>
                                            <div className="text-lg text-cyan-800 opacity-50 whitespace-nowrap">تأكيد عند تعليم يوم غير اليوم</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => onUpdateConfirmNonToday(!data.confirmNonTodayAttendance)}
                                        className={`w-14 h-8 rounded-full transition-all relative ${data.confirmNonTodayAttendance ? 'bg-cyan-500' : 'bg-gray-300'}`}
                                    >
                                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${data.confirmNonTodayAttendance ? 'right-7' : 'right-1'}`} />
                                    </button>
                                </div>
                            </div>



                            {/* Clear All Button */}
                            <button
                                onClick={onClearAll}
                                className="group flex items-center justify-between p-4 bg-red-50/30 hover:bg-red-50 border border-red-100 rounded-2xl transition-all active:scale-[0.98] mt-2"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
                                        <Trash2 size={20} />
                                    </div>
                                    <div className="text-right space-y-1">
                                        <div className="font-bold text-red-600 text-2xl">مسح كافة البيانات</div>
                                        <div className="text-base text-red-400 font-medium opacity-50">تحذير: هذا الإجراء لا يمكن التراجع عنه</div>
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Collapsible Information Section - Moved to Bottom */}
                    <div className="space-y-3 pt-2">
                        <button
                            onClick={() => setIsInfoOpen(!isInfoOpen)}
                            className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-2xl border border-gray-200 transition-all font-arabic group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                    <Info size={20} />
                                </div>
                                <span className="text-xl font-bold text-gray-700">معلومات ودليل الاستخدام</span>
                            </div>
                            <ChevronDown size={20} className={`text-gray-400 transition-transform duration-300 ${isInfoOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isInfoOpen && (
                            <div className="bg-gradient-to-br from-indigo-50/30 to-white border border-indigo-100/50 rounded-2xl p-6 space-y-6 animate-in slide-in-from-top-4 duration-300">
                                <div className="space-y-4">
                                    <h4 className="text-lg font-bold text-indigo-700 border-b border-indigo-100 pb-2">💡 أساسيات الاستخدام</h4>
                                    <ul className="space-y-3 text-lg text-gray-600 leading-relaxed">
                                        <li>• <strong className="text-gray-800">إدارة الجداول:</strong> كليك شمال للتبديل بين (حاضر/غائب)، كليك يمين لتبديل (اعتذار/تأجيل).</li>
                                        <li>• <strong className="text-gray-800">الزمن الخليط:</strong> في نافذة الطالب، اضغط على اليوم <span className="text-indigo-600 font-bold">مرة واحدة</span> لـ 30 دقيقة، و<span className="text-indigo-600 font-bold">مرتين</span> لـ 60 دقيقة.</li>
                                        <li>• <strong className="text-gray-800">الروابط السريعة:</strong> كليك شمال للنَسخ، <span className="bg-gray-200 px-1 rounded">Ctrl + Click</span> لفتح الرابط، كليك يمين للضبط.</li>
                                    </ul>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-lg font-bold text-indigo-700 border-b border-indigo-100 pb-2">⌨️ اختصارات لوحة المفاتيح</h4>
                                    <div className="grid grid-cols-1 gap-2 text-base font-tajawal">
                                        <div className="flex justify-between p-2 bg-white rounded-lg border border-gray-50">
                                            <span className="text-gray-800 font-bold">التراجع / الإعادة</span>
                                            <span className="text-gray-400 font-english">Ctrl+Z / Ctrl+Y</span>
                                        </div>
                                        <div className="flex justify-between p-2 bg-white rounded-lg border border-gray-50">
                                            <span className="text-gray-800 font-bold">علامة الحصة المضاعفة</span>
                                            <span className="text-gray-400 font-english">Shift + Click</span>
                                        </div>
                                        <div className="flex justify-between p-2 bg-white rounded-lg border border-gray-50">
                                            <span className="text-gray-800 font-bold">علامة التنبيه الزرقاء</span>
                                            <span className="text-gray-400 font-english">Alt + Click</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-lg font-bold text-indigo-700 border-b border-indigo-100 pb-2">🛡️ الحفاظ على البيانات</h4>
                                    <p className="text-lg text-gray-600 font-tajawal leading-relaxed">
                                        يتم حفظ البيانات تلقائياً في المتصفح. لضمان أقصى حماية، يُنصح بتفعيل <strong className="text-amber-600">الحفظ التلقائي</strong> وتحميل نسخة احتياطية يدوياً كل أسبوع.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* App Version Info */}
                    <div className="pt-4 text-center border-t border-gray-100">
                        <div className="text-gray-500 text-base font-medium opacity-50">إصدار النظام ١.٢.٠</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
