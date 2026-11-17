import React, { useEffect, useState } from 'react';
import { Code2, LoaderCircle } from 'lucide-react';

export default function DevModeButton() {
    const [status, setStatus] = useState<{ available: boolean; active: boolean } | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => { void window.electronAPI?.devModeStatus?.().then(setStatus); }, []);
    if (!status?.available) return null;
    const toggle = async () => {
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            const storage: Record<string, string> = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key !== null) storage[key] = localStorage.getItem(key) || '';
            }
            const result = await window.electronAPI.devModeToggle!(storage);
            if (!result.ok) { if (!result.canceled) setError(result.error || 'تعذر تشغيل وضع التطوير.'); setBusy(false); }
        } catch { setError('تعذر تشغيل وضع التطوير.'); setBusy(false); }
    };
    return <div className="relative z-40">
        <button type="button" onClick={() => void toggle()} disabled={busy} title={status.active ? 'العودة للنسخة المثبتة' : 'تشغيل وضع التطوير'} aria-label={status.active ? 'العودة للنسخة المثبتة' : 'تشغيل وضع التطوير'} className={`flex h-11 w-11 items-center justify-center rounded-2xl border shadow-lg transition disabled:opacity-60 ${status.active ? 'border-indigo-400 bg-indigo-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:text-indigo-600'}`}>
            {busy ? <LoaderCircle size={20} className="animate-spin motion-reduce:animate-none" /> : <Code2 size={20} />}
        </button>
        {error && <div role="alert" className="absolute top-full left-0 mt-2 w-64 rounded-xl bg-white p-3 text-sm text-red-600 shadow-lg" dir="rtl">{error}<button type="button" className="mr-2 underline" onClick={() => setError('')}>إغلاق</button></div>}
    </div>;
}
