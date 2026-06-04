import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface Props {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    onConfirm: () => void;
    onClose: () => void;
    isDestructive?: boolean;
}

const ConfirmModal: React.FC<Props> = ({
    isOpen,
    title,
    message,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onClose,
    isDestructive = true
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 font-arabic" dir="rtl">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in fade-in duration-300 border border-gray-100">
                <div className="p-8">
                    {/* Header/Icon */}
                    <div className="flex flex-col items-center text-center space-y-4">
                        <div className={`p-4 rounded-3xl ${isDestructive ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'}`}>
                            <AlertTriangle size={40} strokeWidth={1.5} />
                        </div>

                        <h3 className="text-3xl font-bold text-gray-800">{title}</h3>
                        <p className="text-xl text-gray-500 leading-relaxed font-amiri">
                            {message}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-3 mt-8">
                        <button
                            onClick={() => {
                                onConfirm();
                                onClose();
                            }}
                            className={`w-full py-4 rounded-2xl text-2xl font-bold transition-all transform active:scale-95 shadow-lg ${isDestructive
                                    ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-200'
                                    : 'bg-[#ffe05d] text-gray-900 hover:bg-[#fcd030] shadow-[#ffe05d]/20'
                                }`}
                        >
                            {confirmLabel}
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full py-4 rounded-2xl text-xl font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all font-arabic"
                        >
                            {cancelLabel}
                        </button>
                    </div>
                </div>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-6 left-6 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all"
                >
                    <X size={24} />
                </button>
            </div>
        </div>
    );
};

export default ConfirmModal;
