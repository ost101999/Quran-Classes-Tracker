import React, { useState, useEffect } from 'react';
import { X, Globe, Copy, Check, MousePointerClick } from 'lucide-react';

interface ActionConfig {
    type: 'copy' | 'link';
    copyVal: string;
    linkVal: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSave: (config: ActionConfig) => void;
    title: string;
    description: string;
    initialConfig: ActionConfig;
}

const ActionConfigModal: React.FC<Props> = ({ isOpen, onClose, onSave, title, description, initialConfig }) => {
    const [config, setConfig] = useState<ActionConfig>(initialConfig);

    useEffect(() => {
        if (isOpen) setConfig(initialConfig);
    }, [isOpen, initialConfig]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 font-arabic" onClick={onClose}>
            <div className="bg-white rounded-[2.5rem] shadow-[0_20px_70px_-10px_rgba(0,0,0,0.15)] w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300 border border-white/40" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="relative p-8 text-center border-b border-gray-100 bg-gradient-to-b from-indigo-50/50 to-white">
                    <button onClick={onClose} className="absolute left-8 top-8 p-2.5 hover:bg-rose-50 hover:text-rose-500 rounded-full text-gray-400 transition-all active:scale-90 bg-white/50 shadow-sm">
                        <X size={20} />
                    </button>
                    <div className="flex flex-col items-center">
                        <div className="w-16 h-16 bg-indigo-600 text-white rounded-[1.25rem] flex items-center justify-center mb-4 shadow-xl shadow-indigo-200 ring-4 ring-indigo-50">
                            <MousePointerClick size={32} strokeWidth={1.5} />
                        </div>
                        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-800 to-gray-600">{title}</h2>
                        <p className="text-lg text-gray-500 mt-2 max-w-[280px] leading-relaxed">{description}</p>
                    </div>
                </div>

                {/* Content */}
                <div className="p-8 space-y-8 bg-white">

                    {/* Mode Selection */}
                    <div className="grid grid-cols-2 gap-3 p-1 bg-gray-100 rounded-2xl">
                        <button
                            onClick={() => setConfig({ ...config, type: 'copy' })}
                            className={`flex flex-col items-center justify-center gap-2 py-3 rounded-xl transition-all font-bold text-lg ${config.type === 'copy'
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-gray-400 hover:bg-gray-200/50'
                                }`}
                        >
                            <Copy size={20} />
                            نسخ نص
                        </button>
                        <button
                            onClick={() => setConfig({ ...config, type: 'link' })}
                            className={`flex flex-col items-center justify-center gap-2 py-3 rounded-xl transition-all font-bold text-lg ${config.type === 'link'
                                    ? 'bg-white text-emerald-600 shadow-sm'
                                    : 'text-gray-400 hover:bg-gray-200/50'
                                }`}
                        >
                            <Globe size={20} />
                            فتح رابط
                        </button>
                    </div>

                    {/* Fields */}
                    <div className="space-y-6">
                        {/* Copy Text Input */}
                        <div className={`space-y-3 transition-opacity duration-200 ${config.type === 'copy' ? 'opacity-100' : 'opacity-40 grayscale'}`}>
                            <div className="flex justify-between items-center px-1">
                                <label className="text-sm font-bold text-gray-400 uppercase tracking-wider">النص المراد نسخه</label>
                                {config.type === 'copy' && <Check size={16} className="text-indigo-500" />}
                            </div>
                            <input
                                type="text"
                                value={config.copyVal}
                                onChange={(e) => setConfig({ ...config, copyVal: e.target.value })}
                                placeholder="مثلاً: تفاصيل الحصة..."
                                className="w-full h-14 px-5 rounded-2xl border-2 border-gray-100 bg-gray-50/50 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all outline-none font-sans text-lg text-gray-700 placeholder:text-gray-300"
                            />
                        </div>

                        {/* Link Input */}
                        <div className={`space-y-3 transition-opacity duration-200 ${config.type === 'link' ? 'opacity-100' : 'opacity-40 grayscale'}`}>
                            <div className="flex justify-between items-center px-1">
                                <label className="text-sm font-bold text-gray-400 uppercase tracking-wider">رابط الحجز المباشر</label>
                                {config.type === 'link' && <Check size={16} className="text-emerald-500" />}
                            </div>
                            <input
                                type="url"
                                value={config.linkVal}
                                onChange={(e) => setConfig({ ...config, linkVal: e.target.value })}
                                placeholder="https://example.com/bo..."
                                dir="ltr"
                                className="w-full h-14 px-5 rounded-2xl border-2 border-gray-100 bg-gray-50/50 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100 transition-all outline-none font-sans text-lg text-gray-700 placeholder:text-gray-300"
                            />
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            onSave(config);
                            onClose();
                        }}
                        className={`w-full py-4 text-white rounded-2xl font-bold text-2xl shadow-[0_15px_30px_-5px_rgba(0,0,0,0.1)] transition-all active:scale-[0.97] flex items-center justify-center gap-3 ${config.type === 'copy'
                                ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                            }`}
                    >
                        حفظ الإعدادات
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ActionConfigModal;
