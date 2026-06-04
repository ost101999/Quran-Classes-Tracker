import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSave: (value: string) => void;
    title: string;
    description: string;
    initialValue: string;
    placeholder?: string;
    dir?: 'rtl' | 'ltr';
}

const SimpleInputModal: React.FC<Props> = ({ isOpen, onClose, onSave, title, description, initialValue, placeholder, dir = 'auto' }) => {
    const [value, setValue] = useState(initialValue);

    useEffect(() => {
        if (isOpen) setValue(initialValue);
    }, [isOpen, initialValue]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 font-arabic" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
                <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-gray-800">{title}</h3>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <X size={20} className="text-gray-500" />
                        </button>
                    </div>

                    <p className="text-gray-500 text-sm mb-4">{description}</p>

                    <input
                        type="text"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder={placeholder}
                        dir={dir}
                        autoFocus
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/50 outline-none transition-all text-lg mb-6 text-gray-700 bg-gray-50 focus:bg-white"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                onSave(value);
                                onClose();
                            }
                        }}
                    />

                    <button
                        onClick={() => {
                            onSave(value);
                            onClose();
                        }}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        <Save size={20} />
                        <span>حفظ</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SimpleInputModal;
