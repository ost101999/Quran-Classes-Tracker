import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface TajweedGroupedSelectLesson {
  id: string;
  title: string;
  parentLessonId?: string;
}

export interface TajweedGroupedSelectGroup {
  key: string;
  label: string;
  lessons: TajweedGroupedSelectLesson[];
}

interface TajweedGroupedHoverSelectProps {
  value: string;
  groups: TajweedGroupedSelectGroup[];
  onChange: (lessonId: string) => void;
  placeholder?: string;
  hoverDelayMs?: number;
  disabled?: boolean;
}

export default function TajweedGroupedHoverSelect({
  value,
  groups,
  onChange,
  placeholder = 'اختر الدرس',
  hoverDelayMs = 2000,
  disabled = false,
}: TajweedGroupedHoverSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hoverTimerRef = useRef<number | null>(null);

  const selectedLesson = useMemo(() => {
    for (const group of groups) {
      const found = group.lessons.find((lesson) => lesson.id === value);
      if (found) return found;
    }
    return null;
  }, [groups, value]);

  const selectedGroupKey = useMemo(() => {
    for (const group of groups) {
      if (group.lessons.some((lesson) => lesson.id === value)) {
        return group.key;
      }
    }
    return null;
  }, [groups, value]);

  const clearHoverTimer = () => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const closeMenu = () => {
    clearHoverTimer();
    setIsOpen(false);
    setExpandedGroupKey(null);
  };

  const handleGroupMouseEnter = (groupKey: string) => {
    clearHoverTimer();
    hoverTimerRef.current = window.setTimeout(() => {
      setExpandedGroupKey(groupKey);
      hoverTimerRef.current = null;
    }, Math.max(0, hoverDelayMs));
  };

  const handleSelectLesson = (lessonId: string) => {
    onChange(lessonId);
    closeMenu();
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        closeMenu();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      clearHoverTimer();
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          if (disabled) return;
          if (isOpen) {
            setIsOpen(false);
            setExpandedGroupKey(null);
            clearHoverTimer();
            return;
          }

          clearHoverTimer();
          setExpandedGroupKey(selectedGroupKey);
          setIsOpen(true);
        }}
        disabled={disabled}
        className="w-full p-3 pl-10 border border-sky-200 rounded-xl bg-white text-slate-800 font-arabic text-right outline-none focus:ring-2 focus:ring-sky-300 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <span className={selectedLesson ? 'text-slate-800' : 'text-slate-400'}>
          {selectedLesson?.title || placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-sky-200 bg-white shadow-xl">
          <div className="max-h-72 overflow-y-auto custom-scrollbar">
            {groups.map((group) => (
              <div
                key={group.key}
                className="border-b border-sky-100 last:border-b-0"
                onMouseEnter={() => handleGroupMouseEnter(group.key)}
                onMouseLeave={clearHoverTimer}
              >
                <button
                  type="button"
                  onClick={() => {
                    clearHoverTimer();
                    setExpandedGroupKey((prev) => (prev === group.key ? null : group.key));
                  }}
                  className="w-full px-3 py-1.5 bg-sky-50/80 hover:bg-sky-100 text-sky-700 font-arabic text-xs"
                >
                  <span className="flex items-center gap-2">
                    <span className="h-px flex-1 bg-sky-300/70" />
                    <span className="whitespace-nowrap">{group.label}</span>
                    <span className="h-px flex-1 bg-sky-300/70" />
                  </span>
                </button>

                {expandedGroupKey === group.key && (
                  <div className="py-0.5">
                    {group.lessons.map((lesson, index) => {
                      const isSubLesson = !!lesson.parentLessonId;
                      const toHindiDigits = (n: number) => n.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)]);
                      const mainLessonNumber = !isSubLesson ? group.lessons.slice(0, index).filter(l => !l.parentLessonId).length + 1 : 0;
                      
                      return (
                        <button
                          key={lesson.id}
                          type="button"
                          onClick={() => handleSelectLesson(lesson.id)}
                          className={`w-full py-2 text-right font-arabic transition-colors flex items-center ${isSubLesson ? 'pr-[60px] text-sm' : 'px-3 text-base'} ${value === lesson.id ? 'bg-sky-600 text-white' : `${isSubLesson ? 'text-slate-500' : 'text-slate-700'} hover:bg-sky-50`}`}
                        >
                          {isSubLesson && (
                            <span className={`w-2 h-px ${value === lesson.id ? 'bg-sky-200' : 'bg-slate-300'} ml-1.5 shrink-0`} />
                          )}
                          <span className="flex-1 text-right">
                            {!isSubLesson && (
                              <span className={`${value === lesson.id ? 'text-white' : 'text-slate-400'} ml-1`}>{toHindiDigits(mainLessonNumber)} - </span>
                            )}
                            {lesson.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
