import React, { useCallback, useEffect, useState } from 'react';
import { Code2, LoaderCircle, RefreshCw } from 'lucide-react';

type DevStatus = {
    available: boolean;
    active: boolean;
    fullSource?: boolean;
    mainOutdated?: boolean;
};

export default function DevModeButton() {
    const [status, setStatus] = useState<DevStatus | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const refreshStatus = useCallback(() => {
        void window.electronAPI?.devModeStatus?.().then(setStatus).catch(() => {});
    }, []);

    useEffect(() => {
        refreshStatus();
        const onFocus = () => refreshStatus();
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [refreshStatus]);

    if (!status?.available) return null;

    const readLocalStorage = (): Record<string, string> => {
        const storage: Record<string, string> = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key !== null) storage[key] = localStorage.getItem(key) || '';
        }
        return storage;
    };

    const toggle = async () => {
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            const storage = readLocalStorage();
            const result = await window.electronAPI.devModeToggle!(storage);
            if (!result.ok) {
                if (!result.canceled) setError(result.error || 'تعذر تشغيل وضع التطوير.');
                setBusy(false);
            }
        } catch {
            setError('تعذر تشغيل وضع التطوير.');
            setBusy(false);
        }
    };

    const titleText = status.active
        ? status.mainOutdated
            ? 'يوجد تحديث في محرك التشغيل — اضغط لإعادة التشغيل بالكود الجديد بدون بناء'
            : status.fullSource
            ? 'وضع المطور الكامل نشط — اضغط للعودة للنسخة المثبتة'
            : 'وضع المطور نشط (الواجهة والملفات الحية) — اضغط للعودة للنسخة المثبتة'
        : 'تشغيل وضع المطور (بدون إعادة بناء)';

    return <div className="relative z-40">
        <button
            type="button"
            onClick={() => void toggle()}
            disabled={busy}
            title={titleText}
            aria-label={titleText}
            className={`relative flex h-11 w-11 items-center justify-center rounded-2xl border shadow-lg transition disabled:opacity-60 ${
                status.active
                    ? 'border-indigo-400 bg-indigo-600 text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:text-indigo-600'
            }`}
        >
            {busy
                ? <LoaderCircle size={20} className="animate-spin motion-reduce:animate-none" />
                : status.active && status.mainOutdated
                ? <RefreshCw size={20} />
                : <Code2 size={20} />}
            {status.active && status.mainOutdated && !busy && (
                <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-white bg-amber-400 animate-pulse" />
            )}
        </button>
        {error && <div role="alert" className="absolute top-full left-0 mt-2 w-64 rounded-xl bg-white p-3 text-sm text-red-600 shadow-lg" dir="rtl">{error}<button type="button" className="mr-2 underline" onClick={() => setError('')}>إغلاق</button></div>}
    </div>;
}
