import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface SearchableSurahSelectProps {
    value?: string;
    defaultValue?: string;
    onChange: (value: string) => void;
    surahs: string[];
    label?: string;
    id?: string;
    className?: string;
}

const toHindiDigits = (num: number | string) => {
    return num.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)]);
};

const SearchableSurahSelect: React.FC<SearchableSurahSelectProps> = ({
    value,
    defaultValue,
    onChange,
    surahs,
    label,
    id,
    className
}) => {
    const initialValue = value !== undefined ? value : (defaultValue || '');

    // Internal state
    const [isOpen, setIsOpen] = useState(false);
    const [internalValue, setInternalValue] = useState(initialValue);
    const [query, setQuery] = useState('');
    const [dropUp, setDropUp] = useState(false);

    const [highlightedIndex, setHighlightedIndex] = useState(0);

    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const itemRefs = useRef<Map<string, HTMLLIElement | null>>(new Map());
    const ignoreScrollRef = useRef(false);

    // Sync internal value
    useEffect(() => {
        if (value !== undefined) {
            setInternalValue(value);
        }
    }, [value]);

    const formatDisplay = React.useCallback((surahName: string) => {
        if (!surahName) return '';
        const index = surahs.indexOf(surahName);
        if (index === -1) return surahName;
        return `${toHindiDigits(index + 1)} . ${surahName}`;
    }, [surahs]);

    useEffect(() => {
        if (!isOpen) {
            setQuery(formatDisplay(internalValue));
        }
    }, [internalValue, isOpen, formatDisplay]);

    const handleSelect = React.useCallback((surah: string) => {
        setInternalValue(surah);
        onChange(surah);
        setIsOpen(false);
        setQuery(formatDisplay(surah));
    }, [onChange, formatDisplay]);



    // Scroll to selected (Initial Open Only)
    useEffect(() => {
        if (isOpen && internalValue && listRef.current) {
            const selectedElement = itemRefs.current.get(internalValue);
            if (selectedElement) {
                // Manual scroll calculation to prevent parent scrolling
                const list = listRef.current;
                const elementTop = selectedElement.offsetTop;
                const elementHeight = selectedElement.offsetHeight;
                const listHeight = list.clientHeight;

                // Center the element in the list
                list.scrollTop = elementTop - (listHeight / 2) + (elementHeight / 2);
            }
        }
    }, [isOpen]); // Run once when opened

    const isQueryMatchingValue = query === formatDisplay(internalValue);

    const filteredSurahs = React.useMemo(() => surahs.filter(originalSurah => {
        if (isQueryMatchingValue) return true;
        if (!query) return true;
        const normalize = (s: string) => s.toLowerCase().replace(/[٠-٩]/g, d => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]);
        const q = normalize(query);
        const s = normalize(originalSurah);
        const index = surahs.indexOf(originalSurah) + 1;
        return s.includes(q) || index.toString().includes(q) || toHindiDigits(index).includes(q);
    }), [surahs, query, isQueryMatchingValue]);

    // Refs for closure-safe access in event listeners
    const isOpenRef = useRef(isOpen);
    const filteredSurahsRef = useRef(filteredSurahs);
    const highlightedIndexRef = useRef(highlightedIndex);
    const internalValueRef = useRef(internalValue);

    useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
    useEffect(() => { filteredSurahsRef.current = filteredSurahs; }, [filteredSurahs]);
    useEffect(() => { highlightedIndexRef.current = highlightedIndex; }, [highlightedIndex]);
    useEffect(() => { internalValueRef.current = internalValue; }, [internalValue]);

    const commitSelection = React.useCallback(() => {
        if (isOpenRef.current) {
            const currentFiltered = filteredSurahsRef.current;
            const currentIndex = highlightedIndexRef.current;
            if (currentFiltered[currentIndex]) {
                handleSelect(currentFiltered[currentIndex]);
            } else if (currentFiltered.length > 0) {
                handleSelect(currentFiltered[0]);
            } else {
                setIsOpen(false);
                setQuery(formatDisplay(internalValueRef.current));
            }
        }
    }, [handleSelect, formatDisplay]);

    // Handle outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                commitSelection();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [commitSelection]);

    const handleBlur = (e: React.FocusEvent) => {
        // If we're clicking inside the container (e.g. on a list item), don't auto-commit
        if (containerRef.current && containerRef.current.contains(e.relatedTarget as Node)) {
            return;
        }
        commitSelection();
    };

    // Scroll to highlighted index
    useEffect(() => {
        if (isOpen && filteredSurahs[highlightedIndex] && !ignoreScrollRef.current && listRef.current) {
            const highlightedSurah = filteredSurahs[highlightedIndex];
            const element = itemRefs.current.get(highlightedSurah);
            if (element) {
                const list = listRef.current;
                const elementTop = element.offsetTop;
                const elementHeight = element.offsetHeight;
                const listHeight = list.clientHeight;
                const scrollTop = list.scrollTop;

                // Check if out of view
                if (elementTop < scrollTop) {
                    list.scrollTop = elementTop;
                } else if (elementTop + elementHeight > scrollTop + listHeight) {
                    list.scrollTop = elementTop + elementHeight - listHeight;
                }
            }
        }
    }, [highlightedIndex, isOpen, filteredSurahs]);


    // Drop direction
    useEffect(() => {
        if (isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            const dropdownHeight = 320;

            if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
                setDropUp(true);
            } else {
                setDropUp(false);
            }
        }
    }, [isOpen]);

    // Sync highlighted index with selected value on open
    useEffect(() => {
        if (isOpen && internalValue) {
            const index = filteredSurahs.indexOf(internalValue);
            if (index !== -1) {
                setHighlightedIndex(index);
            }
        }
    }, [isOpen, internalValue, filteredSurahs]);



    // Reset highlighted index when query changes
    useEffect(() => {
        setHighlightedIndex(0);
    }, [query]);

    const handleInputFocus = () => {
        setIsOpen(true);
        setQuery(formatDisplay(internalValue));
        setTimeout(() => inputRef.current?.select(), 0);
    };

    const handleInputClick = () => {
        if (!isOpen) {
            setIsOpen(true);
            setQuery(formatDisplay(internalValue));
        }
        inputRef.current?.select();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        ignoreScrollRef.current = false;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!isOpen) {
                setIsOpen(true);
            } else {
                setHighlightedIndex(prev => Math.min(prev + 1, filteredSurahs.length - 1));
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (!isOpen) {
                setIsOpen(true);
            } else {
                setHighlightedIndex(prev => Math.max(prev - 1, 0));
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            commitSelection();
        } else if (e.key === 'Escape') {
            setIsOpen(false);
            setQuery(formatDisplay(internalValue));
            inputRef.current?.blur();
        } else if (e.key === 'Tab') {
            if (isOpen) {
                commitSelection();
            }
        }
    };

    return (
        <div className={`relative ${className || ''}`} ref={containerRef}>
            <input type="hidden" id={id} value={internalValue} />
            {label && (
                <label className="block text-xl font-medium text-gray-700 mb-1 font-arabic">
                    {label}
                </label>
            )}

            <div className="relative">
                <input
                    ref={inputRef}
                    id={id ? `${id}-input` : undefined}
                    type="text"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
                    onFocus={handleInputFocus}
                    onBlur={handleBlur}
                    onClick={handleInputClick}
                    onKeyDown={handleKeyDown}
                    onWheel={(e) => {
                        // When dropdown is closed, don't let wheel scroll the input — bubble up to modal
                        if (!isOpen) {
                            e.currentTarget.blur();
                        }
                        // When open, the dropdown <ul> handles its own scroll
                    }}
                    className="w-full py-3 px-4 pl-12 border border-gray-200 rounded-xl bg-gray-50 font-arabic text-gray-800 text-xl leading-relaxed focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all text-right"
                    placeholder="اختر سورة..."
                    dir="rtl"
                    autoComplete="off"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <ChevronDown size={20} />
                </div>
            </div>

            {/* Scrollbar-hide styles injected via style tag or class */}
            <style>
                {`
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                `}
            </style>

            {isOpen && (
                <ul
                    ref={listRef}
                    className={`absolute left-0 right-0 max-h-80 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-2xl z-[9999] animate-in fade-in zoom-in-95 duration-100 no-scrollbar ${dropUp ? 'bottom-full mb-2' : 'top-full mt-2'
                        }`}
                    style={{
                        position: 'absolute',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
                    }}
                >
                    {filteredSurahs.map((surah, index) => {
                        const originalIndex = surahs.indexOf(surah);
                        const isSelected = internalValue === surah;
                        const isHighlighted = index === highlightedIndex;
                        return (
                            <li
                                key={surah}
                                ref={(el) => { if (el) itemRefs.current.set(surah, el); else itemRefs.current.delete(surah); }}
                            >
                                <button
                                    type="button"
                                    tabIndex={-1}
                                    onClick={() => handleSelect(surah)}
                                    onMouseEnter={() => {
                                        ignoreScrollRef.current = true;
                                        setHighlightedIndex(index);
                                    }}
                                    className={`w-full text-right px-4 py-3 font-arabic text-lg flex items-center justify-between transition-colors ${isHighlighted
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : isSelected
                                            ? 'bg-emerald-50 text-emerald-700'
                                            : 'text-gray-700 hover:bg-emerald-50'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold font-english ${isHighlighted ? 'bg-emerald-200 text-emerald-900' : 'bg-emerald-100 text-emerald-800'}`}>
                                            {toHindiDigits(originalIndex + 1)}
                                        </span>
                                        <span>{surah}</span>
                                    </div>
                                    {isSelected && <Check size={18} className="text-emerald-600" />}
                                </button>
                            </li>
                        );
                    })}
                    {filteredSurahs.length === 0 && (
                        <li className="p-4 text-center text-gray-500 font-arabic">لا توجد نتائج</li>
                    )}
                </ul>
            )}
        </div>
    );
};

export default SearchableSurahSelect;
