import React, { useState } from 'react';
import { X, ExternalLink, RefreshCw, Lock, CircleMinus, CirclePlus } from 'lucide-react';

const toHindiDigits = (num: number | string) => {
    return num.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)]);
};

interface Props {
    isOpen: boolean;
    onClose: () => void;
    url: string;
    title?: string;
    onOpenExternal: (url: string) => void;
}

const WebModal: React.FC<Props> = ({ isOpen, onClose, url, title, onOpenExternal }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [zoom, setZoom] = useState(1);
    const [isCtrlPressed, setIsCtrlPressed] = useState(false);
    const isInitialLoadRef = React.useRef(true);

    // Reset state when modal opens or URL changes
    React.useEffect(() => {
        if (isOpen) {
            setIsLoading(true);
            setIsCtrlPressed(false);

            // Load saved zoom for this URL
            const savedZoom = localStorage.getItem(`webmodal_zoom_${url}`);
            isInitialLoadRef.current = true; // Mark as loading
            setZoom(savedZoom ? parseFloat(savedZoom) : 1);

            // Safety timeout: Remove loading spinner after 8 seconds if iframe hangs
            const timer = setTimeout(() => {
                setIsLoading(false);
                isInitialLoadRef.current = false; // Loading complete
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isOpen, url]);

    // Save zoom whenever it changes (but skip initial load)
    React.useEffect(() => {
        if (isOpen && url && !isInitialLoadRef.current) {
            localStorage.setItem(`webmodal_zoom_${url}`, zoom.toString());
        }
    }, [zoom, url, isOpen]);

    // Track Ctrl key and handle window blur
    React.useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Control' || e.key === 'Meta') setIsCtrlPressed(true);
            if (e.key === 'Escape') onClose();
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Control' || e.key === 'Meta') setIsCtrlPressed(false);
        };
        const handleBlur = () => {
            setIsCtrlPressed(false);
        };

        // When iframe steals focus, ESC doesn't reach the parent window.
        // Poll for focus return: when user presses ESC inside many iframes,
        // focus returns to the parent. We detect this and close.
        let blurredToIframe = false;
        const handleWindowBlur = () => {
            // Check if focus went to the iframe
            setTimeout(() => {
                if (document.activeElement?.tagName === 'IFRAME') {
                    blurredToIframe = true;
                }
            }, 0);
        };
        const handleWindowFocus = () => {
            if (blurredToIframe) {
                blurredToIframe = false;
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleBlur);
        window.addEventListener('blur', handleWindowBlur);
        window.addEventListener('focus', handleWindowFocus);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);
            window.removeEventListener('blur', handleWindowBlur);
            window.removeEventListener('focus', handleWindowFocus);
        };
    }, [isOpen, onClose]);

    // Handle global IPC Escape (bypasses iframe focus stealing)
    React.useEffect(() => {
        if (!isOpen) return;
        if (window.electronAPI && window.electronAPI.onEscapeBtn) {
            window.electronAPI.onEscapeBtn(() => {
                onClose();
            });
            return () => {
                window.electronAPI.offEscapeBtn();
            };
        }
    }, [isOpen, onClose]);

    // Prevent body scroll when modal is open
    React.useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = '';
            };
        }
    }, [isOpen]);

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            // e.preventDefault(); // Moved to passive listener avoidance if needed, but React handles this.
            // Actually, we usually want to prevent browser zoom, but here we just do our custom zoom.
            const delta = e.deltaY * -0.01;
            setZoom(prev => Math.min(Math.max(0.5, prev + delta), 3));
        }
    };

    // ...

    // In render, apply pointer-events style
    // ...
    const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 3));
    const handleZoomOut = () => setZoom(prev => Math.max(0.5, prev - 0.1));

    return (
        <div
            className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-[95vw] h-[85vh] flex flex-col overflow-hidden border border-white/20 relative"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gray-50 border-b border-gray-200 p-4 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4 flex-1">
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
                            title="إغلاق"
                        >
                            <X size={20} />
                        </button>

                        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-gray-200 shadow-sm flex-1 max-w-xl">
                            <Lock size={14} className="text-emerald-500" />
                            <span className="text-sm text-gray-600 truncate font-mono">{url}</span>
                            {zoom !== 1 && (
                                <span className="text-xs text-indigo-500 font-bold ml-2 font-arabic">
                                    ٪{toHindiDigits((zoom * 100).toFixed(0))}
                                </span>
                            )}
                        </div>

                        <button
                            onClick={() => {
                                const iframe = document.getElementById('web-modal-iframe') as HTMLIFrameElement;
                                if (iframe) {
                                    setIsLoading(true);
                                    iframe.src = iframe.src;
                                }
                            }}
                            className="p-2 hover:bg-gray-200 rounded-full text-gray-500"
                            title="تحديث"
                        >
                            <RefreshCw size={18} />
                        </button>

                        {/* Zoom Controls */}
                        <div className="flex items-center bg-gray-200 rounded-full p-1">
                            <button
                                onClick={handleZoomOut}
                                className="p-1 hover:bg-white rounded-full text-gray-600 transition-all"
                                title="تصغير (Zoom Out)"
                            >
                                <CircleMinus size={16} />
                            </button>
                            <button
                                onClick={() => setZoom(1)}
                                className="px-2 text-xs font-bold text-gray-600 hover:text-indigo-600 min-w-[40px] text-center"
                                title="إعادة تعيين (Reset)"
                            >
                                ٪{toHindiDigits((zoom * 100).toFixed(0))}
                            </button>
                            <button
                                onClick={handleZoomIn}
                                className="p-1 hover:bg-white rounded-full text-gray-600 transition-all"
                                title="تكبير (Zoom In)"
                            >
                                <CirclePlus size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-gray-400 text-sm hidden md:inline">{title || 'متصفح داخلي'}</span>
                        <button
                            onClick={() => onOpenExternal(url)}
                            className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-4 py-2 rounded-xl text-sm font-bold transition-colors"
                        >
                            <span>فتح في المتصفح</span>
                            <ExternalLink size={16} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div
                    className="flex-1 relative bg-gray-100 overflow-hidden"
                    onWheelCapture={handleWheel}
                >
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        </div>
                    )}
                    {url && (
                        <iframe
                            key={url}
                            id="web-modal-iframe"
                            src={url}
                            className={`w-full h-full border-0 mx-auto block transition-all duration-300 ease-out ${isCtrlPressed ? 'pointer-events-none' : ''}`}
                            style={{
                                zoom: zoom
                            }}
                            onLoad={() => setIsLoading(false)}
                            onError={() => setIsLoading(false)}
                            title="Embedded Browser"
                            allow="camera; microphone; fullscreen; clipboard-read; clipboard-write"
                        />
                    )}
                    {!url && (
                        <div className="flex items-center justify-center h-full text-gray-400 font-arabic text-lg">
                            لا يوجد رابط للعرض
                        </div>
                    )}
                </div>

                {/* Footer Hint */}
                <div className="bg-white border-t border-gray-100 py-1 px-4 text-center flex justify-between items-center">
                    <p className="text-[10px] text-gray-400">
                        استخدم Ctrl/Cmd + العجلة للتكبير/التصغير
                    </p>
                    <p className="text-[10px] text-gray-400">
                        بعض المواقع (مثل Google Meet) قد لا تعمل داخل النافذة المنبثقة لأسباب أمنية. استخدم "فتح في المتصفح" إذا واجهت مشكلة.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default WebModal;
