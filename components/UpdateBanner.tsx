import React, { useEffect, useState } from 'react';

type UpdateInfo = { status: 'available' | 'up-to-date' | 'error'; current?: string; latest?: string };

const UpdateBanner: React.FC = () => {
    const [info, setInfo] = useState<UpdateInfo | null>(null);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        window.electronAPI?.checkForUpdates?.()
            .then(result => { if (!cancelled) setInfo(result); })
            .catch(() => undefined);
        return () => { cancelled = true; };
    }, []);

    if (dismissed || info?.status !== 'available') return null;

    return (
        <div className="fixed bottom-4 left-4 z-[2000] bg-white rounded-xl shadow-2xl p-4 max-w-sm w-full border border-gray-100" dir="rtl">
            <h3 className="text-sm font-bold text-gray-800">تحديث جديد متاح {info.latest ? `(v${info.latest})` : ''}</h3>
            <p className="text-xs text-gray-500 mt-1">اضغط تحديث لتشغيل أداة التحديث والتثبيت التلقائي لجهازك.</p>
            <div className="mt-3 flex justify-end gap-2">
                <button onClick={() => setDismissed(true)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-bold transition">
                    إغلاق
                </button>
                <button
                    onClick={() => { setDismissed(true); void window.electronAPI?.startUpdate?.(); }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition"
                >
                    تحديث
                </button>
            </div>
        </div>
    );
};

export default UpdateBanner;
