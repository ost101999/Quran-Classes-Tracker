import React from 'react';
import { X, Globe, Copy, Clock } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onCopy: () => void;
    onLink: () => void;
    onCopyContext: (e: React.MouseEvent) => void;
    onLinkContext: (e: React.MouseEvent) => void;
    title: string;
}

const ActionChoiceModal: React.FC<Props> = ({ isOpen, onClose, onCopy, onLink, onCopyContext, onLinkContext, title }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 font-arabic" onClick={onClose}>
            <div className="bg-white rounded-[2.5rem] shadow-[0_20px_70px_-10px_rgba(0,0,0,0.15)] w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-300 border border-white/40" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="relative p-6 text-center border-b border-gray-100 bg-gradient-to-b from-indigo-50/50 to-white">
                    <button onClick={onClose} className="absolute left-6 top-6 p-2 hover:bg-rose-50 hover:text-rose-500 rounded-full text-gray-400 transition-all active:scale-90 bg-white/50 shadow-sm">
                        <X size={20} />
                    </button>
                    <div className="flex flex-col items-center">
                        <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    <button
                        onClick={() => {
                            onLink();
                            onClose();
                        }}
                        onContextMenu={onLinkContext}
                        className="w-full group relative flex items-center p-4 bg-emerald-50 hover:bg-emerald-100 rounded-2xl transition-all border border-emerald-100 active:scale-[0.98]"
                        title="كليك للفتح، كليك يمين لتعديل الرابط"
                    >
                        <div className="w-12 h-12 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200 group-hover:scale-110 transition-transform">
                            <Copy size={24} />
                        </div>
                        <div className="flex-1 text-right pr-4">
                            <span className="block font-bold text-gray-800 text-xl group-hover:text-emerald-700 transition-colors">المواعيد المتاحة ( مكتوبة )</span>
                        </div>
                    </button>

                    <button
                        onClick={() => {
                            onCopy();
                            onClose();
                        }}
                        onContextMenu={onCopyContext}
                        className="w-full group relative flex items-center p-4 bg-indigo-50 hover:bg-indigo-100 rounded-2xl transition-all border border-indigo-100 active:scale-[0.98]"
                        title="كليك للنسخ، كليك يمين لتعديل النص"
                    >
                        <div className="w-12 h-12 bg-indigo-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 group-hover:scale-110 transition-transform">
                            <Globe size={24} />
                        </div>
                        <div className="flex-1 text-right pr-4">
                            <span className="block font-bold text-gray-800 text-xl group-hover:text-indigo-700 transition-colors">نسخ رابط الحجز المباشر</span>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ActionChoiceModal;
