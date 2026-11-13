import React, { useEffect, useRef, useState } from 'react';
import { Bell, LoaderCircle, X } from 'lucide-react';

type UpdateInfo = { status: 'available' | 'up-to-date' | 'error'; current?: string; latest?: string };

const UpdateBanner: React.FC = () => {
    const [info, setInfo] = useState<UpdateInfo | null>(null);
    const [open, setOpen] = useState(false);
    const [checking, setChecking] = useState(false);
    const [starting, setStarting] = useState(false);
    const [startError, setStartError] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const checkingRef = useRef(false);
    const mounted = useRef(true);

    const check = async () => {
        if (checkingRef.current || !window.electronAPI?.checkForUpdates) return;
        checkingRef.current = true;
        setChecking(true);
        try {
            const result = await window.electronAPI.checkForUpdates();
            if (mounted.current) setInfo(result);
        } catch {
            if (mounted.current) setInfo({ status: 'error' });
        } finally {
            checkingRef.current = false;
            if (mounted.current) setChecking(false);
        }
    };

    useEffect(() => {
        mounted.current = true;
        void check();
        return () => { mounted.current = false; };
    }, []);

    useEffect(() => {
        if (!open) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
                if (document.activeElement instanceof HTMLElement && containerRef.current?.contains(document.activeElement)) {
                    document.activeElement.blur();
                }
            }
        };
        const onPointerDown = (event: PointerEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('pointerdown', onPointerDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('pointerdown', onPointerDown);
        };
    }, [open]);

    if (!window.electronAPI?.checkForUpdates) return null;

    const startUpdate = async () => {
        setStarting(true);
        setStartError(false);
        try {
            const result = await window.electronAPI?.startUpdate?.();
            if (!result?.started) setStartError(true);
        } catch {
            setStartError(true);
        } finally {
            setStarting(false);
        }
    };

    return (
        <div ref={containerRef} className="relative z-40 w-fit" dir="rtl">
            {open && (
                <div className="absolute top-full left-0 mt-3 w-72 rounded-2xl border border-gray-100 bg-white p-4 shadow-2xl" role="status" aria-live="polite">
                    <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق" className="absolute left-3 top-3 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X size={16} /></button>
                    <h3 className="pl-6 text-lg font-bold text-gray-800">تحديثات البرنامج</h3>
                    <p className="mt-2 text-sm leading-6 text-gray-500" style={{ fontFamily: "AcmeWeb, Acme, sans-serif" }}>
                        {checking ? 'جارٍ البحث عن تحديثات...' : info?.status === 'available' ? <>تحديث جديد متاح {info.latest && <bdi dir="ltr" style={{ fontFamily: 'AcmeWeb, Acme, sans-serif' }}>(v{info.latest})</bdi>}</> : info?.status === 'up-to-date' ? 'البرنامج محدّث لآخر إصدار.' : 'تعذّر التحقق من التحديثات. حاول مرة أخرى.'}
                    </p>
                    {startError && <p className="mt-2 text-sm text-red-600">تعذّر تشغيل أداة التحديث. تأكد من مجلد المشروع وحاول مرة أخرى.</p>}
                    {info?.status === 'available' && !checking && (
                        <button type="button" disabled={starting} onClick={() => void startUpdate()} className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
                            {starting ? 'جارٍ التشغيل...' : 'تحديث'}
                        </button>
                    )}
                </div>
            )}
            <button type="button" aria-label="التحقق من تحديثات البرنامج" aria-expanded={open} title="تحديثات البرنامج" onClick={() => { setOpen(true); setStartError(false); void check(); }} className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-600 shadow-lg transition hover:bg-gray-50 hover:text-indigo-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">
                {checking ? <LoaderCircle size={20} className="animate-spin motion-reduce:animate-none" /> : <Bell size={20} />}
                {info?.status === 'available' && <span aria-hidden="true" className="update-indicator" />}
            </button>
        </div>
    );
};

export default UpdateBanner;
