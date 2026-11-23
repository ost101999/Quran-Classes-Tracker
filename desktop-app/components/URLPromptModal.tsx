import React, { useState, useEffect } from 'react';
import { X, Globe, Save } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSave: (url: string) => void;
    title: string;
    description: string;
    initialValue: string;
}

const URLPromptModal: React.FC<Props> = ({ isOpen, onClose, onSave, title, description, initialValue }) => {
    const [url, setUrl] = useState(initialValue);

    useEffect(() => {
        if (isOpen) setUrl(initialValue);
    }, [isOpen, initialValue]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 font-arabic" onClick={onClose}>
            <div className="bg-white rounded-[2.5rem] shadow-[0_20px_70px_-10px_rgba(0,0,0,0.15)] w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-500 border border-white/40" onClick={(e) => e.stopPropagation()}>
                <div className="relative p-8 text-center border-b border-gray-100 bg-gradient-to-b from-indigo-50/50 to-white">
                    <button onClick={onClose} className="absolute left-8 top-8 p-2.5 hover:bg-rose-50 hover:text-rose-500 rounded-full text-gray-400 transition-all active:scale-90 bg-white/50 shadow-sm">
                        <X size={20} />
                    </button>
                    <div className="flex flex-col items-center">
                        <div className="w-16 h-16 bg-indigo-600 text-white rounded-[1.25rem] flex items-center justify-center mb-4 shadow-xl shadow-indigo-200 ring-4 ring-indigo-50">
                            <Globe size={32} strokeWidth={1.5} />
                        </div>
                        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-800 to-gray-600">{title}</h2>
                        <p className="text-lg text-gray-500 mt-2 max-w-[280px] leading-relaxed">{description}</p>
                    </div>
                </div>

                <div className="p-10 space-y-8 bg-white">
                    <div className="space-y-3">
                        <div className="flex justify-between items-center px-1">
                            <label className="text-sm font-bold text-gray-400 uppercase tracking-wider">الرابط المباشر</label>
                            <span className="text-[10px] bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full font-bold">URL</span>
                        </div>
                        <div className="relative group">
                            <input
                                type="url"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://example.com"
                                dir="ltr"
                                className="w-full h-14 px-5 rounded-2xl border-2 border-gray-100 bg-gray-50/50 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all outline-none font-sans text-lg text-gray-700 placeholder:text-gray-300"
                                autoFocus
                            />
                            <div className="absolute inset-0 rounded-2xl bg-indigo-500/5 opacity-0 group-focus-within:opacity-100 pointer-events-none transition-opacity" />
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            onSave(url);
                            onClose();
                        }}
                        className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold text-2xl shadow-[0_15px_30px_-5px_rgba(79,70,229,0.4)] hover:bg-indigo-700 hover:shadow-[0_20px_40px_-5px_rgba(79,70,229,0.5)] transition-all active:scale-[0.97] flex items-center justify-center gap-3 group"
                    >
                        <Save size={24} className="group-hover:rotate-12 transition-transform" />
                        حفظ الرابط
                    </button>

                    <p className="text-center text-gray-400 text-sm font-medium">سيتم حفظ الرابط محلياً في المتصفح</p>
                </div>
            </div>
        </div>
    );
};

export default URLPromptModal;
