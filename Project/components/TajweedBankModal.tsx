import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Plus, Trash2, Edit2, Save, ArrowRight, ChevronDown, ChevronUp, Youtube, File, Shuffle, Check, Upload } from 'lucide-react';
import { TajweedLesson, TajweedQuestion, TajweedExamVersion, QuestionType, TajweedContentLanguage } from '../types';

type BuiltInLessonGroupKey = 'nun' | 'meem' | 'foundation' | 'independent';
type LessonGroupKey = string;

type OrderedSection =
  | {
    type: 'group';
    id: string;
    rank: number;
    group: { key: LessonGroupKey; label: string; lessons: TajweedLesson[] };
  }
  | {
    type: 'independent';
    id: string;
    rank: number;
    lesson: TajweedLesson;
  };

const GROUP_LABELS: Record<BuiltInLessonGroupKey, string> = {
  nun: 'أحكام النون الساكنة والتنوين',
  meem: 'أحكام الميم الساكنة',
  foundation: 'دروس أساسية',
  independent: 'مستقل',
};

const BUILT_IN_GROUP_ORDER: BuiltInLessonGroupKey[] = ['nun', 'meem', 'foundation', 'independent'];
const BUILT_IN_GROUP_KEYS = new Set<BuiltInLessonGroupKey>(BUILT_IN_GROUP_ORDER);

const STATIC_GROUP_OPTIONS: Array<{ key: BuiltInLessonGroupKey; label: string }> = [
  { key: 'nun', label: 'أحكام النون الساكنة والتنوين' },
  { key: 'meem', label: 'أحكام الميم الساكنة' },
  { key: 'independent', label: 'مستقل' },
];

const TARGET_AGE_OPTIONS: Array<{ key: TajweedLesson['targetAge']; label: string }> = [
  { key: 'all', label: 'الجميع' },
  { key: 'kids', label: 'أطفال' },
  { key: 'adults', label: 'كبار' },
];

const LESSON_LANGUAGE_OPTIONS: Array<{ key: TajweedContentLanguage; label: string }> = [
  { key: 'ar', label: 'عربي' },
  { key: 'en', label: 'English' },
];

const QUESTION_TYPE_ORDER: QuestionType[] = ['multiple_choice', 'text', 'audio'];
const QUESTION_TYPE_RANK: Record<QuestionType, number> = {
  multiple_choice: 0,
  text: 1,
  audio: 2,
};

const QUESTION_TYPE_SECTION_LABELS: Record<QuestionType, { ar: string; en: string }> = {
  multiple_choice: { ar: 'أسئلة الاختيار من متعدد', en: 'Multiple Choice Questions' },
  text: { ar: 'الأسئلة المقالية', en: 'Essay Questions' },
  audio: { ar: 'أسئلة التسجيل الصوتي', en: 'Audio Recording Questions' },
};

const toArabicDigits = (value: number | string) => String(value).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d, 10)]);

const getTargetAgeLabel = (targetAge: TajweedLesson['targetAge']) => (
  TARGET_AGE_OPTIONS.find((option) => option.key === targetAge)?.label || 'الجميع'
);

const getLanguageLabelByKey = (language: TajweedContentLanguage) => (
  LESSON_LANGUAGE_OPTIONS.find((option) => option.key === language)?.label || 'عربي'
);

const buildAutoExamVersionName = (
  targetAge: TajweedLesson['targetAge'],
  lessonLanguage: TajweedContentLanguage,
) => `${getTargetAgeLabel(targetAge)} / ${getLanguageLabelByKey(lessonLanguage)}`;

const detectInputDirection = (value: string, fallback: 'rtl' | 'ltr' = 'rtl'): 'rtl' | 'ltr' => {
  const text = String(value || '').trim();
  if (!text) return fallback;

  const firstStrong = text.match(/[A-Za-z\u0600-\u06FF]/);
  if (!firstStrong) return fallback;

  return /[A-Za-z]/.test(firstStrong[0]) ? 'ltr' : 'rtl';
};

const getLabelDirection = (value: string): 'rtl' | 'ltr' => {
  const text = String(value || '').trim();
  if (!text) return 'rtl';

  const hasArabic = /[\u0600-\u06FF]/.test(text);
  const hasLatin = /[A-Za-z]/.test(text);

  if (hasArabic && !hasLatin) return 'rtl';
  if (hasLatin && !hasArabic) return 'ltr';

  return detectInputDirection(text, 'rtl');
};

const renderDirectionAwareLabel = (value: string) => {
  const normalized = String(value || '').trim() || 'نسخة بدون اسم';
  const parts = normalized.split('/').map((part) => part.trim()).filter(Boolean);

  if (parts.length === 2) {
    const [firstPart, secondPart] = parts;

    return (
      <>
        <span dir={getLabelDirection(firstPart)} style={{ unicodeBidi: 'plaintext' }}>{firstPart}</span>
        <span className="px-0.5">/</span>
        <span dir={getLabelDirection(secondPart)} style={{ unicodeBidi: 'plaintext' }}>{secondPart}</span>
      </>
    );
  }

  return <span dir={getLabelDirection(normalized)} style={{ unicodeBidi: 'plaintext' }}>{normalized}</span>;
};

const normalizeGroupName = (value: string) => String(value || '').replace(/\s+/g, ' ').trim();

const getGroupLabel = (groupKey: string) => {
  if (groupKey === 'nun' || groupKey === 'meem' || groupKey === 'foundation' || groupKey === 'independent') {
    return GROUP_LABELS[groupKey];
  }
  return groupKey || GROUP_LABELS.independent;
};

const resolveLessonLanguage = (lesson?: TajweedLesson | null): TajweedContentLanguage => {
  if (lesson?.language === 'en') {
    return 'en';
  }
  return 'ar';
};

const getVersionTargetAge = (
  version?: TajweedExamVersion | null,
  lesson?: TajweedLesson | null,
): TajweedLesson['targetAge'] => {
  if (version?.targetAge === 'kids' || version?.targetAge === 'adults' || version?.targetAge === 'all') {
    return version.targetAge;
  }
  if (lesson?.targetAge === 'kids' || lesson?.targetAge === 'adults' || lesson?.targetAge === 'all') {
    return lesson.targetAge;
  }
  return 'all';
};

const getVersionLanguage = (
  version?: TajweedExamVersion | null,
  lesson?: TajweedLesson | null,
): TajweedContentLanguage => {
  if (version?.language === 'en' || version?.language === 'ar') {
    return version.language;
  }
  return resolveLessonLanguage(lesson);
};

const getLessonLanguageLabel = (lesson?: TajweedLesson | null) => {
  const lang = resolveLessonLanguage(lesson);
  return LESSON_LANGUAGE_OPTIONS.find((item) => item.key === lang)?.label || 'عربي';
};

const getExplicitVersionLessonTitle = (version?: TajweedExamVersion | null) => (
  String(version?.lessonTitle || '')
);

const getResolvedLessonTitleForVersion = (
  lesson?: TajweedLesson | null,
  version?: TajweedExamVersion | null,
) => {
  const versionTitle = getExplicitVersionLessonTitle(version);
  if (versionTitle) return versionTitle;
  return String(lesson?.title || '');
};

const pickLessonTitleByLanguage = (
  lesson: TajweedLesson,
  versions: TajweedExamVersion[],
  preferredLanguage: TajweedContentLanguage,
) => {
  const findBy = (predicate: (version: TajweedExamVersion) => boolean) => (
    versions.find((version) => predicate(version) && !!getExplicitVersionLessonTitle(version))
  );

  const byPreferredLanguageAll = findBy((version) => (
    getVersionLanguage(version, lesson) === preferredLanguage
    && getVersionTargetAge(version, lesson) === 'all'
  ));
  if (byPreferredLanguageAll) return getExplicitVersionLessonTitle(byPreferredLanguageAll);

  const byPreferredLanguage = findBy((version) => getVersionLanguage(version, lesson) === preferredLanguage);
  if (byPreferredLanguage) return getExplicitVersionLessonTitle(byPreferredLanguage);

  const byAllAudience = findBy((version) => getVersionTargetAge(version, lesson) === 'all');
  if (byAllAudience) return getExplicitVersionLessonTitle(byAllAudience);

  const firstTitled = versions.find((version) => !!getExplicitVersionLessonTitle(version));
  if (firstTitled) return getExplicitVersionLessonTitle(firstTitled);

  return String(lesson.title || '').trim();
};

const getQuestionTextForLanguage = (question: TajweedQuestion, lang: TajweedContentLanguage) => {
  if (lang === 'en') {
    return question.textEn ?? question.text ?? '';
  }
  return question.textAr ?? question.text ?? '';
};

const getQuestionOptionsForLanguage = (question: TajweedQuestion, lang: TajweedContentLanguage) => {
  if (lang === 'en') {
    return question.optionsEn ?? question.options ?? [];
  }
  return question.optionsAr ?? question.options ?? [];
};

const getQuestionEditorLanguage = (lesson: TajweedLesson | null, version?: TajweedExamVersion | null): TajweedContentLanguage => {
  if (!lesson) return 'ar';
  return getVersionLanguage(version, lesson);
};

const stripLegacyGuidanceText = (value: string): string => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';

  if (normalized === 'اكتب سؤالك هنا...' || normalized === 'Write your question here...') {
    return '';
  }

  return value;
};

const stripLegacyGuidanceOption = (value: string): string => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';

  if (
    normalized === 'اختيار جديد'
    || normalized === 'New option'
    || /^اختيار\s*[0-9٠-٩]+$/.test(normalized)
    || /^Option\s*[0-9٠-٩]+$/i.test(normalized)
  ) {
    return '';
  }

  return value;
};

const normalizeQuestionForEditor = (question: TajweedQuestion): TajweedQuestion => {
  const textAr = stripLegacyGuidanceText(question.textAr ?? question.text ?? '');
  const textEn = stripLegacyGuidanceText(question.textEn ?? '');

  const optionsAr = question.type === 'multiple_choice'
    ? (question.optionsAr ?? question.options ?? ['', '', '']).map(stripLegacyGuidanceOption)
    : undefined;
  const optionsEn = question.type === 'multiple_choice'
    ? (question.optionsEn ?? ['', '', '']).map(stripLegacyGuidanceOption)
    : undefined;

  const normalizedText = stripLegacyGuidanceText(question.text ?? textAr);
  const normalizedOptions = question.type === 'multiple_choice'
    ? (question.options ?? optionsAr ?? ['', '', '']).map(stripLegacyGuidanceOption)
    : undefined;

  return {
    ...question,
    text: normalizedText,
    options: normalizedOptions,
    textAr,
    textEn,
    optionsAr,
    optionsEn,
  };
};

const normalizeExamVersionForEditor = (
  version: TajweedExamVersion,
  fallbackIndex: number,
  fallbackCreatedAt: number,
  fallbackTargetAge: TajweedLesson['targetAge'],
  fallbackLanguage: TajweedContentLanguage,
  fallbackLessonTitle: string,
): TajweedExamVersion => {
  const safeId = String(version.id || `${fallbackCreatedAt}-v${fallbackIndex + 1}`);
  const safeName = normalizeGroupName(version.name || '') || `نسخة ${toArabicDigits(fallbackIndex + 1)}`;
  const safeTargetAge = version.targetAge === 'kids' || version.targetAge === 'adults' || version.targetAge === 'all'
    ? version.targetAge
    : fallbackTargetAge;
  const safeLanguage = version.language === 'en' || version.language === 'ar'
    ? version.language
    : fallbackLanguage;

  return {
    ...version,
    id: safeId,
    name: safeName,
    lessonTitle: String(version.lessonTitle ?? fallbackLessonTitle).trim(),
    targetAge: safeTargetAge,
    language: safeLanguage,
    videoUrl: String(version.videoUrl ?? '').trim(),
    pdfUrl: String(version.pdfUrl ?? '').trim(),
    createdAt: typeof version.createdAt === 'number' ? version.createdAt : (fallbackCreatedAt - fallbackIndex),
    questions: Array.isArray(version.questions) ? version.questions.map(normalizeQuestionForEditor) : [],
  };
};

const buildLegacyExamVersion = (lesson: TajweedLesson): TajweedExamVersion => ({
  id: `${lesson.id || Date.now().toString()}-v1`,
  name: `نسخة ${toArabicDigits(1)}`,
  lessonTitle: String(lesson.title || '').trim(),
  targetAge: getVersionTargetAge(undefined, lesson),
  language: getVersionLanguage(undefined, lesson),
  videoUrl: String(lesson.videoUrl || '').trim(),
  pdfUrl: String(lesson.pdfUrl || '').trim(),
  createdAt: lesson.createdAt || Date.now(),
  questions: Array.isArray(lesson.questions) ? lesson.questions.map(normalizeQuestionForEditor) : [],
});

const normalizeExamVersionsForEditor = (lesson: TajweedLesson): TajweedExamVersion[] => {
  const rawVersions = Array.isArray(lesson.examVersions) && lesson.examVersions.length > 0
    ? lesson.examVersions
    : [buildLegacyExamVersion(lesson)];
  const fallbackCreatedAt = lesson.createdAt || Date.now();
  const fallbackTargetAge = getVersionTargetAge(undefined, lesson);
  const fallbackLanguage = getVersionLanguage(undefined, lesson);
  const fallbackLessonTitle = String(lesson.title || '').trim();

  return rawVersions.map((version, index) => normalizeExamVersionForEditor(
    version,
    index,
    fallbackCreatedAt,
    fallbackTargetAge,
    fallbackLanguage,
    fallbackLessonTitle,
  ));
};

const cloneQuestions = (questions: TajweedQuestion[]): TajweedQuestion[] => {
  const seed = Date.now().toString();

  return questions.map((question, index) => ({
    ...question,
    id: `${seed}-${index + 1}`,
    options: question.options ? [...question.options] : undefined,
    optionsAr: question.optionsAr ? [...question.optionsAr] : undefined,
    optionsEn: question.optionsEn ? [...question.optionsEn] : undefined,
  }));
};

const normalizeLessonForEditor = (lesson: TajweedLesson): TajweedLesson => {
  const examVersions = normalizeExamVersionsForEditor(lesson);
  const defaultVersion = examVersions[0];

  return {
    ...lesson,
    language: resolveLessonLanguage(lesson),
    examVersions,
    questions: defaultVersion ? defaultVersion.questions : [],
  };
};

const withAutoNamedExamVersions = (
  lesson: TajweedLesson,
  preferredVersionId?: string,
): TajweedLesson => {
  const versions = normalizeExamVersionsForEditor(lesson).map((version) => {
    const existingName = normalizeGroupName(version.name || '');
    const shouldRenameThisVersion = preferredVersionId ? version.id === preferredVersionId : false;
    const versionTargetAge = getVersionTargetAge(version, lesson);
    const versionLanguage = getVersionLanguage(version, lesson);
    const computedName = buildAutoExamVersionName(versionTargetAge, versionLanguage);

    return {
      ...version,
      targetAge: versionTargetAge,
      language: versionLanguage,
      name: shouldRenameThisVersion ? computedName : (existingName || computedName),
    };
  });

  const selectedVersion = preferredVersionId
    ? versions.find((version) => version.id === preferredVersionId)
    : undefined;
  const fallbackVersion = selectedVersion || versions[0];

  return {
    ...lesson,
    language: getVersionLanguage(fallbackVersion, lesson),
    targetAge: getVersionTargetAge(fallbackVersion, lesson),
    examVersions: versions,
    questions: fallbackVersion ? fallbackVersion.questions : [],
  };
};

const inferGroupFromTitle = (title: string): BuiltInLessonGroupKey | null => {
  if (title.includes('الإظهار الشفوي') || title.includes('الإخفاء الشفوي') || title.includes('الإدغام الشفوي')) {
    return 'meem';
  }
  if (title.includes('الإظهار الحلقي') || title.includes('الإقلاب') || title.includes('الإخفاء الحقيقي') || title.includes('الإدغام')) {
    return 'nun';
  }
  return null;
};

const inferGroupFromDefaultId = (id: string): BuiltInLessonGroupKey | null => {
  if (id.startsWith('tajweed-nun-')) return 'nun';
  if (id.startsWith('tajweed-meem-')) return 'meem';
  if (id === 'tajweed-foundation') return 'independent';
  return null;
};

const getLessonGroupKey = (lesson: TajweedLesson): LessonGroupKey => {
  const rawGroup = normalizeGroupName((lesson as TajweedLesson & { group?: string }).group || '');
  if (rawGroup && rawGroup !== 'foundation' && rawGroup !== 'other') {
    return rawGroup;
  }

  const byDefaultId = inferGroupFromDefaultId(lesson.id);
  if (byDefaultId) return byDefaultId;

  const byTitle = inferGroupFromTitle(lesson.title);
  if (byTitle) return byTitle;

  return 'independent';
};

interface TajweedBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  bank: Record<string, TajweedLesson>;
  onSaveBank: (newBank: Record<string, TajweedLesson>) => void;
  lessonEditorUiState: Record<string, { showLessonSettings: boolean; activeVersionId?: string }>;
  onUpdateLessonEditorUiState: (
    lessonId: string,
    nextState: { showLessonSettings?: boolean; activeVersionId?: string }
  ) => void;
}

export default function TajweedBankModal({
  isOpen,
  onClose,
  bank,
  onSaveBank,
  lessonEditorUiState,
  onUpdateLessonEditorUiState,
}: TajweedBankModalProps) {
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [currentLesson, setCurrentLesson] = useState<TajweedLesson | null>(null);
  const [activeVersionId, setActiveVersionId] = useState('');
  const [showLessonSettings, setShowLessonSettings] = useState(false);
  const [openEditPicker, setOpenEditPicker] = useState<'targetAge' | 'group' | 'language' | 'parent' | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [expandedGroupInPicker, setExpandedGroupInPicker] = useState<string | null>(null);
  const [draggingLesson, setDraggingLesson] = useState<{ lessonId: string; groupKey: LessonGroupKey } | null>(null);
  const [draggingGroupKey, setDraggingGroupKey] = useState<LessonGroupKey | null>(null);
  const [dropPreview, setDropPreview] = useState<{ groupKey: LessonGroupKey; lessonId: string | null; dropAfterTarget: boolean } | null>(null);
  const draggingLessonRef = useRef<{ lessonId: string; groupKey: LessonGroupKey } | null>(null);
  const draggingGroupKeyRef = useRef<LessonGroupKey | null>(null);
  const explanationFileInputRef = useRef<HTMLInputElement>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('tajweed_bank_expanded_groups');
    return saved ? JSON.parse(saved) : {
      nun: false,
      meem: false,
      foundation: false,
      independent: false,
    };
  });
  const [expandedQuestionSections, setExpandedQuestionSections] = useState<Record<QuestionType, boolean>>({
    multiple_choice: true,
    text: true,
    audio: true,
  });

  const [expandedLessons, setExpandedLessons] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('tajweed_bank_expanded_lessons');
    return saved ? JSON.parse(saved) : {};
  });

  const [draggingQuestionId, setDraggingQuestionId] = useState<string | null>(null);
  const [draggingVersionId, setDraggingVersionId] = useState<string | null>(null);

  const sortedLessons = useMemo(
    () => Object.values(bank).sort((a, b) => b.createdAt - a.createdAt),
    [bank]
  );

  const potentialParents = useMemo(() => {
    if (!currentLesson) return [];
    return Object.values(bank).filter((lesson) => 
      lesson.id !== currentLesson.id && !lesson.parentLessonId
    );
  }, [bank, currentLesson]);

  const { groupedLessons, independentLessons, childrenMap } = useMemo(() => {
    const grouped = new Map<string, TajweedLesson[]>();
    const independent: TajweedLesson[] = [];
    const children = new Map<string, TajweedLesson[]>();

    // First pass: find children
    sortedLessons.forEach((lesson) => {
      if (lesson.parentLessonId) {
        if (!children.has(lesson.parentLessonId)) {
          children.set(lesson.parentLessonId, []);
        }
        children.get(lesson.parentLessonId)!.push(lesson);
      }
    });

    // Second pass: build main lists (exclude children from top level)
    sortedLessons.forEach((lesson) => {
      if (lesson.parentLessonId) return; // Skip children at top level

      const key = getLessonGroupKey(lesson);
      if (key === 'independent') {
        independent.push(lesson);
        return;
      }

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(lesson);
    });

    const dynamicGroupKeys = Array.from(grouped.keys())
      .filter((key) => !BUILT_IN_GROUP_KEYS.has(key as BuiltInLessonGroupKey))
      .sort((a, b) => a.localeCompare(b, 'ar'));

    const orderedGroupKeys = [
      ...BUILT_IN_GROUP_ORDER.filter((key) => key !== 'independent'),
      ...dynamicGroupKeys,
    ];

    const visibleGroupedLessons = orderedGroupKeys
      .map((key) => ({ key, label: getGroupLabel(key), lessons: grouped.get(key) || [] }))
      .filter((group) => group.lessons.length > 0);

    return {
      groupedLessons: visibleGroupedLessons,
      independentLessons: independent,
      childrenMap: children,
    };
  }, [sortedLessons]);

  const customGroupKeys = useMemo(() => {
    const keys = new Map<string, string>();

    sortedLessons.forEach((lesson) => {
      const groupKey = getLessonGroupKey(lesson);
      if (groupKey && !BUILT_IN_GROUP_KEYS.has(groupKey as BuiltInLessonGroupKey)) {
        const normalized = groupKey.toLowerCase();
        if (!keys.has(normalized)) {
          keys.set(normalized, groupKey);
        }
      }
    });

    const currentGroup = normalizeGroupName(currentLesson?.group || '');
    if (currentGroup && !BUILT_IN_GROUP_KEYS.has(currentGroup as BuiltInLessonGroupKey)) {
      const normalized = currentGroup.toLowerCase();
      if (!keys.has(normalized)) {
        keys.set(normalized, currentGroup);
      }
    }

    return Array.from(keys.values()).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [sortedLessons, currentLesson]);

  const lessonGroupOptions = useMemo(() => {
    const customOptions = customGroupKeys.map((key) => ({
      key,
      label: key,
      isCustom: true,
    }));

    return [
      ...STATIC_GROUP_OPTIONS.filter((option) => option.key !== 'independent').map((option) => ({
        key: option.key,
        label: option.label,
        isCustom: false,
      })),
      ...customOptions,
      { key: 'independent', label: GROUP_LABELS.independent, isCustom: false },
    ];
  }, [customGroupKeys]);

  const orderedSections = useMemo<OrderedSection[]>(() => {
    const groupSections: OrderedSection[] = groupedLessons.map((group) => ({
      type: 'group',
      id: `group-${group.key}`,
      rank: group.lessons[0]?.createdAt || 0,
      group,
    }));

    const independentSectionItems: OrderedSection[] = independentLessons.map((lesson) => ({
      type: 'independent',
      id: `independent-${lesson.id}`,
      rank: lesson.createdAt,
      lesson,
    }));

    return [...groupSections, ...independentSectionItems].sort((a, b) => b.rank - a.rank);
  }, [groupedLessons, independentLessons]);

  useEffect(() => {
    if (!isOpen) {
      setView('list');
      setCurrentLesson(null);
      setActiveVersionId('');
      setShowLessonSettings(false);
      setNewGroupName('');
      setExpandedQuestionSections({
        multiple_choice: true,
        text: true,
        audio: true,
      });
      draggingLessonRef.current = null;
      draggingGroupKeyRef.current = null;
      setDraggingLesson(null);
      setDraggingGroupKey(null);
      setOpenEditPicker(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCreateLesson = () => {
    const oldestCreatedAt = sortedLessons[sortedLessons.length - 1]?.createdAt;
    const createdAtForNewLesson = oldestCreatedAt !== undefined ? oldestCreatedAt - 1 : Date.now();
    const newLessonId = Date.now().toString();

    const newLesson: TajweedLesson = {
      id: newLessonId,
      title: '',
      targetAge: 'all',
      group: 'independent',
      language: 'ar',
      videoUrl: '',
      pdfUrl: '',
      questions: [],
      examVersions: [
        {
          id: `${newLessonId}-v1`,
          name: buildAutoExamVersionName('all', 'ar'),
          lessonTitle: '',
          targetAge: 'all',
          language: 'ar',
          questions: [],
          createdAt: createdAtForNewLesson,
        },
      ],
      createdAt: createdAtForNewLesson
    };
    const normalizedNewLesson = withAutoNamedExamVersions(normalizeLessonForEditor(newLesson));
    setCurrentLesson(normalizedNewLesson);
    setActiveVersionId(normalizedNewLesson.examVersions?.[0]?.id || '');
    setShowLessonSettings(false);
    setNewGroupName('');
    setOpenEditPicker(null);
    setView('edit');
  };

  const handleEditLesson = (lesson: TajweedLesson, versionId?: string) => {
    const normalizedLesson = withAutoNamedExamVersions(normalizeLessonForEditor({
      ...lesson,
      group: getLessonGroupKey(lesson),
    }));
    const savedEditorState = lessonEditorUiState[lesson.id];
    const fallbackVersionId = normalizedLesson.examVersions?.[0]?.id || '';
    
    // Prioritize versionId if provided directly from a tag click
    const preferredVersionId = versionId || (
      savedEditorState?.activeVersionId
      && normalizedLesson.examVersions?.some((version) => version.id === savedEditorState.activeVersionId)
      ? savedEditorState.activeVersionId
      : fallbackVersionId
    );

    setCurrentLesson(normalizedLesson);
    setActiveVersionId(preferredVersionId);
    setShowLessonSettings(!!savedEditorState?.showLessonSettings);
    setNewGroupName('');
    setOpenEditPicker(null);
    setView('edit');
  };

  const handleDeleteLesson = (id: string) => {
    const newBank = { ...bank };
    delete newBank[id];
    onSaveBank(newBank);
  };

  const handleAddCustomGroup = () => {
    if (!currentLesson) return;

    const rawName = normalizeGroupName(newGroupName);
    if (!rawName) return;

    const existingOption = lessonGroupOptions.find((option) => option.key.toLowerCase() === rawName.toLowerCase());
    const resolvedKey = existingOption?.key || rawName;

    setCurrentLesson({ ...currentLesson, group: resolvedKey });
    setNewGroupName('');
    setOpenEditPicker(null);
  };

  const handleDeleteCustomGroup = (groupKey: string) => {
    const normalizedTarget = normalizeGroupName(groupKey).toLowerCase();
    if (!normalizedTarget) return;

    const nextBank: Record<string, TajweedLesson> = { ...bank };
    let changed = false;

    Object.values(nextBank).forEach((lesson) => {
      const lessonGroup = normalizeGroupName(getLessonGroupKey(lesson)).toLowerCase();
      if (lessonGroup !== normalizedTarget) return;

      nextBank[lesson.id] = {
        ...lesson,
        group: 'independent',
      };
      changed = true;
    });

    if (!changed) return;

    onSaveBank(nextBank);

    if (currentLesson && normalizeGroupName(currentLesson.group || '').toLowerCase() === normalizedTarget) {
      setCurrentLesson({ ...currentLesson, group: 'independent' });
    }
  };

  const getLessonExamVersions = (lesson: TajweedLesson): TajweedExamVersion[] => {
    const versions = Array.isArray(lesson.examVersions) ? lesson.examVersions : [];
    if (versions.length > 0) return versions;
    return normalizeExamVersionsForEditor(lesson);
  };

  const getActiveLessonExamVersion = (lesson: TajweedLesson): TajweedExamVersion | null => {
    const versions = getLessonExamVersions(lesson);
    if (versions.length === 0) return null;

    if (activeVersionId) {
      const selected = versions.find((version) => version.id === activeVersionId);
      if (selected) return selected;
    }

    return versions[0];
  };

  const applyQuestionsToActiveVersion = (
    lesson: TajweedLesson,
    updateQuestions: (questions: TajweedQuestion[]) => TajweedQuestion[],
  ): TajweedLesson => {
    const versions = getLessonExamVersions(lesson);
    if (versions.length === 0) return lesson;

    const activeVersion = getActiveLessonExamVersion(lesson) || versions[0];
    const selectedVersionId = activeVersion.id;
    const updatedVersions = versions.map((version) => (
      version.id === selectedVersionId
        ? { ...version, questions: updateQuestions(version.questions) }
        : version
    ));
    const refreshedActiveVersion = updatedVersions.find((version) => version.id === selectedVersionId) || updatedVersions[0];

    return {
      ...lesson,
      examVersions: updatedVersions,
      questions: refreshedActiveVersion.questions,
    };
  };

  const switchExamVersion = (versionId: string) => {
    if (!currentLesson) return;

    const versions = getLessonExamVersions(currentLesson);
    const targetVersion = versions.find((version) => version.id === versionId);
    if (!targetVersion) return;

    setCurrentLesson({
      ...currentLesson,
      targetAge: getVersionTargetAge(targetVersion, currentLesson),
      language: getVersionLanguage(targetVersion, currentLesson),
      examVersions: versions,
      questions: targetVersion.questions,
    });
    setActiveVersionId(targetVersion.id);
    onUpdateLessonEditorUiState(currentLesson.id, { activeVersionId: targetVersion.id });
  };

  const addExamVersion = () => {
    if (!currentLesson) return;

    const versions = getLessonExamVersions(currentLesson);
    const activeVersion = getActiveLessonExamVersion(currentLesson) || versions[0];
    const activeTargetAge = getVersionTargetAge(activeVersion, currentLesson);
    const activeLanguage = getVersionLanguage(activeVersion, currentLesson);
    const nextIndex = versions.length + 1;
    const newVersion: TajweedExamVersion = {
      id: `${Date.now()}-v${nextIndex}`,
      name: buildAutoExamVersionName(activeTargetAge, activeLanguage),
      lessonTitle: getResolvedLessonTitleForVersion(currentLesson, activeVersion),
      targetAge: activeTargetAge,
      language: activeLanguage,
      videoUrl: '',
      pdfUrl: '',
      questions: cloneQuestions(activeVersion?.questions || []),
      createdAt: Date.now(),
    };

    const updatedLesson: TajweedLesson = {
      ...currentLesson,
      examVersions: [...versions, newVersion],
      questions: newVersion.questions,
    };

    setCurrentLesson(updatedLesson);
    setActiveVersionId(newVersion.id);
    setShowLessonSettings(true);
    setOpenEditPicker(null);
    onUpdateLessonEditorUiState(currentLesson.id, {
      showLessonSettings: true,
      activeVersionId: newVersion.id,
    });
  };

  const updateLessonTitleForActiveVersion = (nextTitle: string) => {
    if (!currentLesson) return;

    const versions = getLessonExamVersions(currentLesson);
    if (versions.length === 0) {
      setCurrentLesson({ ...currentLesson, title: nextTitle });
      return;
    }

    const targetVersion = (activeVersionId
      ? versions.find((version) => version.id === activeVersionId)
      : undefined) || versions[0];

    const updatedVersions = versions.map((version) => (
      version.id === targetVersion.id
        ? { ...version, lessonTitle: nextTitle }
        : version
    ));
    const refreshedActiveVersion = updatedVersions.find((version) => version.id === targetVersion.id) || updatedVersions[0];
    const updatedLessonBase: TajweedLesson = {
      ...currentLesson,
      examVersions: updatedVersions,
      questions: refreshedActiveVersion.questions,
    };

    const canonicalArabicTitle = pickLessonTitleByLanguage(updatedLessonBase, updatedVersions, 'ar')
      || String(currentLesson.title || '').trim()
      || String(nextTitle || '').trim();

    setCurrentLesson({
      ...updatedLessonBase,
      title: canonicalArabicTitle,
    });
  };

  const handleExplanationFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        updateLessonMetaForActiveVersion({ pdfUrl: result });
      }
    };

    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const updateLessonMetaForActiveVersion = (
    updates: {
      targetAge?: TajweedLesson['targetAge'];
      language?: TajweedContentLanguage;
      videoUrl?: string;
      pdfUrl?: string;
    }
  ) => {
    if (!currentLesson) return;

    const versions = getLessonExamVersions(currentLesson);
    if (versions.length === 0) return;

    const targetVersion = (activeVersionId
      ? versions.find((version) => version.id === activeVersionId)
      : undefined) || versions[0];

    const currentTargetAge = getVersionTargetAge(targetVersion, currentLesson);
    const currentLanguage = getVersionLanguage(targetVersion, currentLesson);
    const nextTargetAge = updates.targetAge ?? currentTargetAge;
    const nextLanguage = updates.language ?? currentLanguage;
    const nextVideoUrl = updates.videoUrl !== undefined
      ? String(updates.videoUrl || '').trim()
      : String(targetVersion.videoUrl || '').trim();
    const nextPdfUrl = updates.pdfUrl !== undefined
      ? String(updates.pdfUrl || '').trim()
      : String(targetVersion.pdfUrl || '').trim();

    const nextVersionName = buildAutoExamVersionName(nextTargetAge, nextLanguage);
    const updatedVersions = versions.map((version) => (
      version.id === targetVersion.id
        ? {
          ...version,
          targetAge: nextTargetAge,
          language: nextLanguage,
          name: nextVersionName,
          videoUrl: nextVideoUrl,
          pdfUrl: nextPdfUrl,
        }
        : version
    ));
    const refreshedActiveVersion = updatedVersions.find((version) => version.id === targetVersion.id) || updatedVersions[0];

    setCurrentLesson({
      ...currentLesson,
      targetAge: nextTargetAge,
      language: nextLanguage,
      examVersions: updatedVersions,
      questions: refreshedActiveVersion.questions,
    });
  };

  const deleteExamVersion = (versionId: string) => {
    if (!currentLesson) return;

    const versions = getLessonExamVersions(currentLesson);
    if (versions.length <= 1) return;

    const filteredVersions = versions.filter((version) => version.id !== versionId);
    if (filteredVersions.length === 0) return;

    const preferredNextId = activeVersionId === versionId ? filteredVersions[0].id : activeVersionId;
    const nextActiveVersion = filteredVersions.find((version) => version.id === preferredNextId) || filteredVersions[0];
    const updatedLesson: TajweedLesson = {
      ...currentLesson,
      targetAge: getVersionTargetAge(nextActiveVersion, currentLesson),
      language: getVersionLanguage(nextActiveVersion, currentLesson),
      examVersions: filteredVersions,
      questions: nextActiveVersion.questions,
    };

    setCurrentLesson(updatedLesson);
    setActiveVersionId(nextActiveVersion.id);
    onUpdateLessonEditorUiState(currentLesson.id, { activeVersionId: nextActiveVersion.id });
  };

  const normalizeQuestionForSave = (question: TajweedQuestion, lessonLanguage: TajweedContentLanguage): TajweedQuestion => {
    const textAr = (question.textAr ?? '').trim();
    const textEn = (question.textEn ?? '').trim();
    const optionsAr = question.optionsAr?.map((opt) => String(opt || '').trim()) || [];
    const optionsEn = question.optionsEn?.map((opt) => String(opt || '').trim()) || [];

    const fallbackText = (question.text || '').trim();
    const fallbackOptions = question.options?.map((opt) => String(opt || '').trim()) || [];

    const resolvedText = lessonLanguage === 'en'
      ? (textEn || fallbackText || textAr)
      : (textAr || fallbackText || textEn);

    const resolvedOptions = question.type === 'multiple_choice'
      ? (lessonLanguage === 'en'
        ? (optionsEn.length > 0 ? optionsEn : (fallbackOptions.length > 0 ? fallbackOptions : optionsAr))
        : (optionsAr.length > 0 ? optionsAr : (fallbackOptions.length > 0 ? fallbackOptions : optionsEn)))
      : undefined;

    return {
      ...question,
      text: resolvedText,
      options: resolvedOptions,
      textAr,
      textEn,
      optionsAr: question.type === 'multiple_choice' ? optionsAr : undefined,
      optionsEn: question.type === 'multiple_choice' ? optionsEn : undefined,
    };
  };

  const sortQuestionsByType = (questions: TajweedQuestion[]) => (
    [...questions].sort((a, b) => QUESTION_TYPE_RANK[a.type] - QUESTION_TYPE_RANK[b.type])
  );

  const saveCurrentLesson = () => {
    if (!currentLesson) return;

    const autoNamedLesson = withAutoNamedExamVersions(currentLesson, activeVersionId);
    const normalizedGroup = normalizeGroupName(autoNamedLesson.group || '') || 'independent';
    const lessonExamVersions = getLessonExamVersions(autoNamedLesson).map((version) => {
      const versionLanguage = getVersionLanguage(version, autoNamedLesson);
      const versionTargetAge = getVersionTargetAge(version, autoNamedLesson);

      return {
        ...version,
        lessonTitle: String(version.lessonTitle ?? autoNamedLesson.title ?? '').trim(),
        language: versionLanguage,
        targetAge: versionTargetAge,
        questions: sortQuestionsByType(version.questions.map((question) => normalizeQuestionForSave(question, versionLanguage))),
      };
    });
    const selectedVersion = lessonExamVersions.find((version) => version.id === activeVersionId) || lessonExamVersions[0] || null;
    const selectedLessonLanguage = getVersionLanguage(selectedVersion, autoNamedLesson);
    const selectedLessonTargetAge = getVersionTargetAge(selectedVersion, autoNamedLesson);
    const fallbackQuestions = sortQuestionsByType(autoNamedLesson.questions.map((question) => normalizeQuestionForSave(question, selectedLessonLanguage)));
    const canonicalBankLessonTitle = pickLessonTitleByLanguage(autoNamedLesson, lessonExamVersions, 'ar')
      || String(autoNamedLesson.title || '').trim()
      || '';

    const newBank = {
      ...bank,
      [autoNamedLesson.id]: {
        ...autoNamedLesson,
        title: canonicalBankLessonTitle,
        videoUrl: '',
        pdfUrl: '',
        language: selectedLessonLanguage,
        targetAge: selectedLessonTargetAge,
        group: normalizedGroup,
        questions: selectedVersion ? selectedVersion.questions : fallbackQuestions,
        examVersions: lessonExamVersions,
      }
    };
    onSaveBank(newBank);
    setNewGroupName('');
    setOpenEditPicker(null);
    setView('list');
  };

  const toggleGroup = (groupKey: LessonGroupKey) => {
    setExpandedGroups((prev) => {
      const next = { ...prev, [groupKey]: !prev[groupKey] };
      localStorage.setItem('tajweed_bank_expanded_groups', JSON.stringify(next));
      return next;
    });
  };

  const clearDraggingLesson = () => {
    draggingLessonRef.current = null;
    setDraggingLesson(null);
    setDropPreview(null);
  };

  const clearDraggingGroup = () => {
    draggingGroupKeyRef.current = null;
    setDraggingGroupKey(null);
    setDropPreview(null);
  };

  const getDraggingLessonValue = () => draggingLessonRef.current || draggingLesson;
  const getDraggingGroupValue = () => draggingGroupKeyRef.current || draggingGroupKey;
  const getDraggingLessonFromEvent = (e: React.DragEvent): { lessonId: string; groupKey: LessonGroupKey } | null => {
    try {
      const rawPayload = e.dataTransfer.getData('application/x-tajweed-lesson');
      if (rawPayload) {
        const parsed = JSON.parse(rawPayload) as { lessonId?: string; groupKey?: string };
        const lessonId = String(parsed?.lessonId || '').trim();
        if (lessonId && bank[lessonId]) {
          return {
            lessonId,
            groupKey: getLessonGroupKey(bank[lessonId]),
          };
        }
      }
    } catch {
      // Ignore parse errors and continue with fallback strategy.
    }

    try {
      const plainLessonId = String(e.dataTransfer.getData('text/plain') || '').trim();
      if (plainLessonId && bank[plainLessonId]) {
        return {
          lessonId: plainLessonId,
          groupKey: getLessonGroupKey(bank[plainLessonId]),
        };
      }
    } catch {
      // Ignore if dataTransfer access is blocked.
    }

    return getDraggingLessonValue();
  };

  const handleLessonDragStart = (e: React.DragEvent, lessonId: string, groupKey: LessonGroupKey) => {
    const payload = { lessonId, groupKey };
    draggingLessonRef.current = payload;
    setDraggingLesson(payload);
    setDropPreview(null);
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('application/x-tajweed-lesson', JSON.stringify(payload));
      e.dataTransfer.setData('text/plain', lessonId);
    } catch {
      // Ignore if browser blocks custom drag data.
    }
  };

  const handleLessonDragOver = (e: React.DragEvent, lessonId: string) => {
    const activeDraggingLesson = getDraggingLessonFromEvent(e);
    if (!activeDraggingLesson) return;
    if (activeDraggingLesson.lessonId === lessonId) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const applyGroupOrder = (
    nextBank: Record<string, TajweedLesson>,
    lessons: TajweedLesson[],
    seed: number
  ) => {
    lessons.forEach((item, index) => {
      nextBank[item.id] = {
        ...nextBank[item.id],
        createdAt: seed - index,
      };
    });
  };

  const moveLessonByDrop = (
    targetGroupKey: LessonGroupKey,
    targetLessonId?: string,
    dragged?: { lessonId: string; groupKey: LessonGroupKey } | null,
    dropAfterTarget: boolean = false,
  ) => {
    const activeDraggingLesson = dragged || getDraggingLessonValue();
    if (!activeDraggingLesson) return;

    const { lessonId, groupKey: sourceGroupKey } = activeDraggingLesson;
    const movedLesson = bank[lessonId];
    if (!movedLesson) return;

    const nextBank = { ...bank };
    const sourceLessons = sortedLessons.filter((item) => getLessonGroupKey(item) === sourceGroupKey);
    const targetLessons = sortedLessons.filter((item) => getLessonGroupKey(item) === targetGroupKey);

    // If an independent lesson is dropped on a group header area, keep it independent
    // and place it right above that group section.
    if (sourceGroupKey === 'independent' && targetGroupKey !== 'independent' && !targetLessonId) {
      const targetAnchor = targetLessons[0]?.createdAt || Date.now();
      nextBank[lessonId] = {
        ...nextBank[lessonId],
        group: 'independent',
        createdAt: targetAnchor + 1,
      };
      onSaveBank(nextBank);
      clearDraggingLesson();
      return;
    }

    if (sourceGroupKey === targetGroupKey) {
      const withoutMoved = sourceLessons.filter((item) => item.id !== lessonId);
      let safeInsertAt = withoutMoved.length;

      if (targetLessonId) {
        const targetIndex = withoutMoved.findIndex((item) => item.id === targetLessonId);
        if (targetIndex >= 0) {
          safeInsertAt = dropAfterTarget ? targetIndex + 1 : targetIndex;
        }
      }

      const reordered = [
        ...withoutMoved.slice(0, safeInsertAt),
        movedLesson,
        ...withoutMoved.slice(safeInsertAt),
      ];
      const stableSeed = sourceLessons[0]?.createdAt || Date.now();
      applyGroupOrder(nextBank, reordered, stableSeed);
      onSaveBank(nextBank);
      clearDraggingLesson();
      return;
    }

    const movedWithNewGroup: TajweedLesson = {
      ...movedLesson,
      group: targetGroupKey,
    };
    nextBank[lessonId] = movedWithNewGroup;

    const sourceWithoutMoved = sourceLessons.filter((item) => item.id !== lessonId);
    const targetWithoutMoved = targetLessons.filter((item) => item.id !== lessonId);
    let safeInsertAt = targetWithoutMoved.length;
    if (targetLessonId) {
      const targetIndex = targetWithoutMoved.findIndex((item) => item.id === targetLessonId);
      if (targetIndex >= 0) {
        safeInsertAt = dropAfterTarget ? targetIndex + 1 : targetIndex;
      }
    }

    const newTargetOrder = [
      ...targetWithoutMoved.slice(0, safeInsertAt),
      movedWithNewGroup,
      ...targetWithoutMoved.slice(safeInsertAt),
    ];

    const now = Date.now();
    applyGroupOrder(nextBank, newTargetOrder, now);
    applyGroupOrder(nextBank, sourceWithoutMoved, now - 10000);

    onSaveBank(nextBank);
    clearDraggingLesson();
  };

  const handleLessonDrop = (e: React.DragEvent, targetGroupKey: LessonGroupKey, targetLessonId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    const activeDraggingLesson = getDraggingLessonFromEvent(e);
    if (!activeDraggingLesson) return;
    if (targetLessonId && activeDraggingLesson.lessonId === targetLessonId) return;

    const currentTarget = e.currentTarget as HTMLElement | null;
    const shouldInsertAfterTarget = !!(
      targetLessonId
      && currentTarget
      && e.clientY > (currentTarget.getBoundingClientRect().top + (currentTarget.getBoundingClientRect().height / 2))
    );

    moveLessonByDrop(targetGroupKey, targetLessonId, activeDraggingLesson, shouldInsertAfterTarget);
  };

  const resolveSectionDropTarget = (
    sectionElement: HTMLElement,
    targetGroupKey: LessonGroupKey,
    draggingLessonId: string,
    clientY: number,
  ): { targetLessonId?: string; dropAfterTarget?: boolean } => {
    const lessonCards = Array.from(sectionElement.querySelectorAll<HTMLElement>('[data-lesson-card="true"]'))
      .filter((node) => {
        const lessonId = String(node.dataset.lessonId || '').trim();
        const lessonGroup = String(node.dataset.lessonGroup || '').trim();
        return lessonId && lessonId !== draggingLessonId && lessonGroup === targetGroupKey;
      });

    if (lessonCards.length === 0) return {};

    for (const node of lessonCards) {
      const lessonId = String(node.dataset.lessonId || '').trim();
      if (!lessonId) continue;

      const rect = node.getBoundingClientRect();
      const midpointY = rect.top + (rect.height / 2);
      if (clientY <= midpointY) {
        return { targetLessonId: lessonId, dropAfterTarget: false };
      }
    }

    const lastNode = lessonCards[lessonCards.length - 1];
    const lastLessonId = String(lastNode?.dataset.lessonId || '').trim();
    if (!lastLessonId) return {};

    return { targetLessonId: lastLessonId, dropAfterTarget: true };
  };

  const updateDropPreview = (
    groupKey: LessonGroupKey,
    lessonId: string | null,
    dropAfterTarget: boolean,
  ) => {
    setDropPreview((prev) => {
      if (
        prev
        && prev.groupKey === groupKey
        && prev.lessonId === lessonId
        && prev.dropAfterTarget === dropAfterTarget
      ) {
        return prev;
      }

      return { groupKey, lessonId, dropAfterTarget };
    });
  };

  const handleSectionDrop = (e: React.DragEvent, targetGroupKey: LessonGroupKey) => {
    e.preventDefault();
    e.stopPropagation();

    const activeDraggingLesson = getDraggingLessonFromEvent(e);
    if (!activeDraggingLesson) return;

    const sectionElement = e.currentTarget as HTMLElement | null;
    if (!sectionElement) {
      moveLessonByDrop(targetGroupKey, undefined, activeDraggingLesson, false);
      return;
    }

    const { targetLessonId, dropAfterTarget } = resolveSectionDropTarget(
      sectionElement,
      targetGroupKey,
      activeDraggingLesson.lessonId,
      e.clientY,
    );

    moveLessonByDrop(targetGroupKey, targetLessonId, activeDraggingLesson, !!dropAfterTarget);
  };

  const handleIndependentDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const activeDraggingLesson = getDraggingLessonFromEvent(e);
    if (!activeDraggingLesson) return;

    moveLessonByDrop('independent', undefined, activeDraggingLesson, false);
  };

  const handleSectionDragOver = (e: React.DragEvent, targetGroupKey: LessonGroupKey) => {
    const activeDraggingLesson = getDraggingLessonFromEvent(e);
    if (!activeDraggingLesson) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const sectionElement = e.currentTarget as HTMLElement | null;
    if (!sectionElement) return;

    const { targetLessonId, dropAfterTarget } = resolveSectionDropTarget(
      sectionElement,
      targetGroupKey,
      activeDraggingLesson.lessonId,
      e.clientY,
    );

    updateDropPreview(targetGroupKey, targetLessonId || null, !!dropAfterTarget);
  };

  const handleGroupDragStart = (e: React.DragEvent, groupKey: LessonGroupKey) => {
    draggingGroupKeyRef.current = groupKey;
    setDraggingGroupKey(groupKey);
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/tajweed-group', groupKey);
    } catch {
      // Ignore if browser blocks custom drag data.
    }
  };

  const handleGroupDragOver = (e: React.DragEvent, targetGroupKey: LessonGroupKey) => {
    const activeDraggingGroup = getDraggingGroupValue();
    if (!activeDraggingGroup || activeDraggingGroup === targetGroupKey) return;
    e.preventDefault();
    e.stopPropagation();
  };

  const handleGroupDrop = (e: React.DragEvent, targetGroupKey: LessonGroupKey) => {
    const activeDraggingGroup = getDraggingGroupValue();
    if (!activeDraggingGroup || activeDraggingGroup === targetGroupKey) return;

    e.preventDefault();
    e.stopPropagation();

    const sourceGroupLessons = sortedLessons.filter((item) => getLessonGroupKey(item) === activeDraggingGroup);
    const targetGroupLessons = sortedLessons.filter((item) => getLessonGroupKey(item) === targetGroupKey);
    if (sourceGroupLessons.length === 0 || targetGroupLessons.length === 0) {
      clearDraggingGroup();
      return;
    }

    const sourceAnchor = sourceGroupLessons[0].createdAt;
    const targetAnchor = targetGroupLessons[0].createdAt;
    const newBank = { ...bank };

    sourceGroupLessons.forEach((lesson, index) => {
      newBank[lesson.id] = {
        ...newBank[lesson.id],
        createdAt: targetAnchor - index,
      };
    });

    targetGroupLessons.forEach((lesson, index) => {
      newBank[lesson.id] = {
        ...newBank[lesson.id],
        createdAt: sourceAnchor - index,
      };
    });

    onSaveBank(newBank);
    clearDraggingGroup();
  };

  const handleGroupDragEnd = () => {
    clearDraggingGroup();
  };

  const handleLessonDragEnd = () => {
    clearDraggingLesson();
  };

  const renderLessonCard = (lesson: TajweedLesson, groupKey: LessonGroupKey) => {
    const isPreviewTarget = dropPreview?.groupKey === groupKey && dropPreview?.lessonId === lesson.id;
    const showPreviewBefore = !!isPreviewTarget && !dropPreview?.dropAfterTarget;
    const showPreviewAfter = !!isPreviewTarget && !!dropPreview?.dropAfterTarget;

    const lessonExamVersions = normalizeExamVersionsForEditor(lesson).map((version) => ({
      ...version,
      name: normalizeGroupName(version.name || '') || buildAutoExamVersionName(
        getVersionTargetAge(version, lesson),
        getVersionLanguage(version, lesson),
      ),
    }));
    const bankLessonTitle = pickLessonTitleByLanguage(lesson, lessonExamVersions, 'ar')
      || String(lesson.title || '').trim()
      || 'بدون عنوان';

    const lessonChildren = childrenMap.get(lesson.id) || [];
    const isSubLesson = !!lesson.parentLessonId;
    const isExpanded = expandedLessons[lesson.id] ?? true;

    return (
      <div key={lesson.id}>
        <div
          data-lesson-card="true"
          data-lesson-id={lesson.id}
          data-lesson-group={groupKey}
          className={`relative w-full transition-colors select-none ${
            isSubLesson 
              ? 'bg-slate-50/70 px-3 py-2 rounded-xl border border-slate-200/60 shadow-none hover:border-emerald-200' 
              : 'bg-white px-4 py-3 rounded-2xl border border-gray-200 shadow-sm hover:border-emerald-300'
          } ${isPreviewTarget ? 'border-emerald-300' : ''}`}
        >
          {showPreviewBefore && (
            <div className="pointer-events-none absolute -top-1 left-3 right-3 h-3 z-40 animate-pulse">
              <div className="absolute left-0 right-0 top-1 h-[2px] rounded-full bg-gradient-to-r from-transparent via-emerald-400/90 to-transparent" />
              <div className="absolute left-0 right-0 top-0.5 h-[4px] rounded-full bg-gradient-to-r from-transparent via-emerald-300/35 to-transparent blur-sm" />
            </div>
          )}

          {showPreviewAfter && (
            <div className="pointer-events-none absolute -bottom-1 left-3 right-3 h-3 z-40 animate-pulse">
              <div className="absolute left-0 right-0 top-1 h-[2px] rounded-full bg-gradient-to-r from-transparent via-emerald-400/90 to-transparent" />
              <div className="absolute left-0 right-0 top-0.5 h-[4px] rounded-full bg-gradient-to-r from-transparent via-emerald-300/35 to-transparent blur-sm" />
            </div>
          )}

          <div
            aria-hidden="true"
            draggable
            onDragStart={(e) => handleLessonDragStart(e, lesson.id, groupKey)}
            onDragEnd={handleLessonDragEnd}
            onClick={() => {
              if (lessonChildren.length > 0) {
                setExpandedLessons(prev => {
                  const next = {
                    ...prev,
                    [lesson.id]: !(prev[lesson.id] ?? true)
                  };
                  localStorage.setItem('tajweed_bank_expanded_lessons', JSON.stringify(next));
                  return next;
                });
              }
            }}
            className="absolute inset-0 rounded-2xl z-20 cursor-grab active:cursor-grabbing"
          />

          <div className="relative flex items-center justify-between gap-2 pointer-events-none">
            <div className="flex-1 min-w-0 relative z-30">
              <div className="flex items-center gap-3 text-sm text-gray-500 font-arabic flex-wrap">
                <h3 className={`${isSubLesson ? 'text-lg' : 'text-[22px]'} font-normal text-gray-800 font-arabic flex items-center gap-2`}>
                  {bankLessonTitle}
                  {lessonChildren.length > 0 && (
                    <ChevronDown size={18} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                  )}
                </h3>
                {lessonExamVersions.map((version) => {
                  const hasQuestions = (version.questions || []).length > 0;
                  const hasPdf = !!version.pdfUrl;
                  const hasVideo = !!version.videoUrl;
                  const isReady = hasQuestions && hasPdf && hasVideo;
                  
                  return (
                    <button
                      key={version.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditLesson(lesson, version.id);
                      }}
                      className={`relative pointer-events-auto ${isSubLesson ? 'text-[13px] px-1.5 py-1' : 'text-[15px] px-2 py-1.5'} ${
                        isSubLesson 
                          ? 'bg-white text-emerald-600 border border-emerald-600/25 hover:bg-emerald-50 hover:text-emerald-700' 
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300'
                      } rounded-md font-arabic transition-all active:scale-95 ${
                        isReady ? 'pr-3' : ''
                      }`}
                      dir="auto"
                      style={{ unicodeBidi: 'isolate' }}
                    >
                      {isReady && (
                        <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-sm border border-white z-10">
                          <Check size={8} strokeWidth={5} />
                        </div>
                      )}
                      {renderDirectionAwareLabel(version.name)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="relative z-30 flex gap-2 shrink-0 pointer-events-auto">
              <button
                onClick={() => handleEditLesson(lesson)}
                className={`${isSubLesson ? 'h-8 w-8' : 'h-9 w-9'} text-gray-600 bg-gray-50 border border-gray-200 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-center cursor-default`}
                title="تعديل الاسم وإدارة الاختبار"
                aria-label="إدارة الدرس"
              >
                <Edit2 size={16} />
              </button>
              <button
                onClick={() => handleDeleteLesson(lesson.id)}
                className={`${isSubLesson ? 'h-8 w-8' : 'h-9 w-9'} text-gray-500 bg-gray-50 border border-gray-200 hover:bg-gray-100 hover:text-gray-700 rounded-lg transition-colors flex items-center justify-center cursor-default`}
                title="حذف"
                aria-label="حذف الدرس"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>

        {lessonChildren.length > 0 && (
          <div
            className={`overflow-hidden transition-[max-height,transform,margin] duration-700 ease-out ${isExpanded ? 'max-h-[500px] mt-3 translate-y-0' : 'max-h-0 mt-0 -translate-y-1 pointer-events-none'}`}
          >
            <div className={`mr-6 space-y-3 transition-opacity duration-500 ease-out ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
              {lessonChildren.map((child) => renderLessonCard(child, groupKey))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleQuestionDragStart = (e: React.DragEvent, qId: string) => {
    setDraggingQuestionId(qId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleQuestionDragOver = (e: React.DragEvent, qId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleQuestionDrop = (e: React.DragEvent, targetQId: string) => {
    e.preventDefault();
    if (!draggingQuestionId || draggingQuestionId === targetQId) return;

    if (!currentLesson) return;
    setCurrentLesson(applyQuestionsToActiveVersion(currentLesson, (questions) => {
      const sourceIndex = questions.findIndex((q) => q.id === draggingQuestionId);
      const targetIndex = questions.findIndex((q) => q.id === targetQId);
      if (sourceIndex === -1 || targetIndex === -1) return questions;

      const sourceQ = questions[sourceIndex];
      const targetQ = questions[targetIndex];

      if (sourceQ.type !== targetQ.type) return questions;

      const newQuestions = [...questions];
      newQuestions.splice(sourceIndex, 1);
      const newTargetIndex = newQuestions.findIndex((q) => q.id === targetQId);
      newQuestions.splice(newTargetIndex, 0, sourceQ);

      return newQuestions;
    }));
    setDraggingQuestionId(null);
  };

  const handleVersionDragStart = (e: React.DragEvent, versionId: string) => {
    setDraggingVersionId(versionId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleVersionDragOver = (e: React.DragEvent, versionId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleVersionDrop = (e: React.DragEvent, targetVersionId: string) => {
    e.preventDefault();
    if (!draggingVersionId || draggingVersionId === targetVersionId) return;

    if (!currentLesson) return;
    const versions = [...(currentLesson.examVersions || [])];
    const sourceIndex = versions.findIndex((v) => v.id === draggingVersionId);
    const targetIndex = versions.findIndex((v) => v.id === targetVersionId);
    
    if (sourceIndex === -1 || targetIndex === -1) return;

    const sourceVersion = versions[sourceIndex];
    versions.splice(sourceIndex, 1);
    const newTargetIndex = versions.findIndex((v) => v.id === targetVersionId);
    versions.splice(newTargetIndex, 0, sourceVersion);

    setCurrentLesson({
      ...currentLesson,
      examVersions: versions,
    });
    setDraggingVersionId(null);
  };

  const addQuestion = (type: QuestionType) => {
    if (!currentLesson) return;

    const activeVersion = getActiveLessonExamVersion(currentLesson);
    const lessonLanguage = getVersionLanguage(activeVersion, currentLesson);
    const defaultArabicText = '';
    const defaultEnglishText = '';
    const defaultArabicOptions = ['', '', ''];
    const defaultEnglishOptions = ['', '', ''];

    const newQ: TajweedQuestion = {
      id: Date.now().toString(),
      type,
      text: lessonLanguage === 'en' ? defaultEnglishText : defaultArabicText,
      textAr: defaultArabicText,
      textEn: defaultEnglishText,
      options: type === 'multiple_choice' ? (lessonLanguage === 'en' ? defaultEnglishOptions : defaultArabicOptions) : undefined,
      optionsAr: type === 'multiple_choice' ? defaultArabicOptions : undefined,
      optionsEn: type === 'multiple_choice' ? defaultEnglishOptions : undefined,
      correctOptionIndex: type === 'multiple_choice' ? 0 : undefined
    };
    setCurrentLesson(applyQuestionsToActiveVersion(currentLesson, (questions) => [...questions, newQ]));
    setExpandedQuestionSections((prev) => ({ ...prev, [type]: true }));
  };

  const updateQuestion = (qId: string, updates: Partial<TajweedQuestion>) => {
    if (!currentLesson) return;
    setCurrentLesson(applyQuestionsToActiveVersion(
      currentLesson,
      (questions) => questions.map((q) => (q.id === qId ? { ...q, ...updates } : q)),
    ));
  };

  const deleteQuestion = (qId: string) => {
    if (!currentLesson) return;
    setCurrentLesson(applyQuestionsToActiveVersion(
      currentLesson,
      (questions) => questions.filter((q) => q.id !== qId),
    ));
  };

  const moveQuestion = (qId: string, direction: 'up' | 'down') => {
    if (!currentLesson) return;
    setCurrentLesson(applyQuestionsToActiveVersion(currentLesson, (questions) => {
      const index = questions.findIndex((q) => q.id === qId);
      if (index === -1) return questions;

      const newQuestions = [...questions];
      const type = newQuestions[index].type;

      if (direction === 'up') {
        let prevIndex = -1;
        for (let i = index - 1; i >= 0; i--) {
          if (newQuestions[i].type === type) {
            prevIndex = i;
            break;
          }
        }
        if (prevIndex !== -1) {
          [newQuestions[index], newQuestions[prevIndex]] = [newQuestions[prevIndex], newQuestions[index]];
        }
      } else {
        let nextIndex = -1;
        for (let i = index + 1; i < newQuestions.length; i++) {
          if (newQuestions[i].type === type) {
            nextIndex = i;
            break;
          }
        }
        if (nextIndex !== -1) {
          [newQuestions[index], newQuestions[nextIndex]] = [newQuestions[nextIndex], newQuestions[index]];
        }
      }

      return newQuestions;
    }));
  };

  const randomizeCorrectOptionsIndices = () => {
    if (!currentLesson) return;

    setCurrentLesson(applyQuestionsToActiveVersion(
      currentLesson,
      (questions) => questions.map((q) => {
        if (q.type !== 'multiple_choice') return q;

        const currentOptions = q.optionsAr ?? q.options ?? [];
        if (currentOptions.length <= 1) return q;

        // Shuffle indices to apply same permutation to all language options
        const indices = currentOptions.map((_, i) => i);
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [indices[i], indices[j]] = [indices[j], indices[i]];
        }

        const oldCorrectIndex = q.correctOptionIndex ?? 0;
        const newCorrectIndex = indices.indexOf(oldCorrectIndex);

        const permute = (arr?: string[]) => {
          if (!arr || arr.length === 0) return undefined;
          return indices.map((idx) => arr[idx] ?? '');
        };

        return {
          ...q,
          options: permute(q.options),
          optionsAr: permute(q.optionsAr),
          optionsEn: permute(q.optionsEn),
          correctOptionIndex: newCorrectIndex === -1 ? 0 : newCorrectIndex,
        };
      })
    ));
  };

  const currentLessonExamVersions = currentLesson ? getLessonExamVersions(currentLesson) : [];
  const activeExamVersion = currentLesson
    ? (currentLessonExamVersions.find((version) => version.id === activeVersionId) || currentLessonExamVersions[0] || null)
    : null;
  const activeVersionTargetAge = getVersionTargetAge(activeExamVersion, currentLesson);
  const activeVersionLanguage = getVersionLanguage(activeExamVersion, currentLesson);
  const activeVersionLessonTitle = currentLesson
    ? getResolvedLessonTitleForVersion(currentLesson, activeExamVersion)
    : '';
  const activeQuestionLang = getQuestionEditorLanguage(currentLesson, activeExamVersion);
  const activeExamQuestions = activeExamVersion?.questions || [];
  const questionSections = QUESTION_TYPE_ORDER
    .map((type) => {
      const questions = activeExamQuestions.filter((question) => question.type === type);
      const labels = QUESTION_TYPE_SECTION_LABELS[type];

      return {
        type,
        title: activeQuestionLang === 'en' ? labels.en : labels.ar,
        questions,
      };
    })
    .filter((section) => section.questions.length > 0);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div className="bg-emerald-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden" dir="rtl" onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-emerald-800 text-white p-6 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            {view === 'edit' && (
              <button 
                onClick={saveCurrentLesson}
                className="p-2 hover:bg-white/20 rounded-xl transition-colors"
              >
                <ArrowRight size={24} />
              </button>
            )}
            <h2 className="text-2xl font-bold font-arabic">
              {view === 'list' ? 'بنك التجويد (الدروس والاختبارات)' : 'تعديل الدرس'}
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-xl transition-colors text-emerald-100 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 hide-scrollbar">
          {view === 'list' ? (
            <div className="space-y-6">
              <button
                onClick={handleCreateLesson}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-white border border-emerald-300 text-emerald-700 rounded-xl hover:bg-emerald-50 transition-colors font-arabic font-bold"
              >
                <Plus size={20} />
                أضف درس تجويد جديد
              </button>

              {Object.keys(bank).length === 0 ? (
                <div className="text-center text-gray-400 py-10 font-arabic">
                  لا يوجد دروس في البنك حالياً. قم بإضافة درس جديد.
                </div>
              ) : (
                <div className="space-y-6">
                  {orderedSections.map((section) => {
                    if (section.type === 'independent') {
                      return <div key={section.id}>{renderLessonCard(section.lesson, 'independent')}</div>;
                    }

                    const { group } = section;
                    const isExpanded = expandedGroups[group.key];

                    return (
                      <div
                        key={section.id}
                        className="space-y-3"
                        onDragOver={(e) => handleSectionDragOver(e, group.key)}
                        onDrop={(e) => handleSectionDrop(e, group.key)}
                      >
                        <button
                          type="button"
                          draggable
                          onDragStart={(e) => handleGroupDragStart(e, group.key)}
                          onDragOver={(e) => handleGroupDragOver(e, group.key)}
                          onDrop={(e) => handleGroupDrop(e, group.key)}
                          onDragEnd={handleGroupDragEnd}
                          onClick={() => toggleGroup(group.key)}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-between"
                        >
                          <h3 className="font-arabic font-normal text-red-600 text-xl">{group.label}</h3>
                          <span className="flex items-center gap-2 text-slate-600 font-arabic text-sm">
                            ({toArabicDigits(group.lessons.length)})
                            <ChevronDown size={18} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                          </span>
                        </button>
                        <div
                          className={`overflow-hidden transition-[max-height,transform] duration-500 ease-out ${isExpanded ? 'max-h-[3000px] translate-y-0' : 'max-h-0 -translate-y-1 pointer-events-none'}`}
                        >
                          <div className={`grid gap-4 pt-3 transition-opacity duration-500 ease-out ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
                            {group.lessons.map((lesson) => renderLessonCard(lesson, group.key))}
                          </div>

                          {dropPreview?.groupKey === group.key && !dropPreview.lessonId && (
                            <div className="mt-2 mx-1 h-3 relative animate-pulse">
                              <div className="absolute inset-x-0 top-1 h-[2px] rounded-full bg-gradient-to-r from-transparent via-emerald-400/90 to-transparent" />
                              <div className="absolute inset-x-0 top-0.5 h-[4px] rounded-full bg-gradient-to-r from-transparent via-emerald-300/35 to-transparent blur-sm" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {draggingLesson && draggingLesson.groupKey !== 'independent' && (
                    <div
                      onDragOver={(e) => handleSectionDragOver(e, 'independent')}
                      onDrop={handleIndependentDrop}
                      className="border-2 border-dashed border-gray-300 rounded-2xl py-4 px-5 text-center font-arabic text-gray-500 bg-white"
                    >
                      إفلات هنا لتحويل الدرس إلى مستقل
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            currentLesson && (
              <div className="space-y-6">
                {/* Lesson Info */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {currentLessonExamVersions.map((version) => {
                      const isActive = activeExamVersion?.id === version.id;
                      return (
                        <div
                          key={version.id}
                          draggable
                          onDragStart={(e) => handleVersionDragStart(e, version.id)}
                          onDragOver={(e) => handleVersionDragOver(e, version.id)}
                          onDrop={(e) => handleVersionDrop(e, version.id)}
                          onDragEnd={() => setDraggingVersionId(null)}
                          className={`inline-flex items-center gap-1 rounded-lg border cursor-move transition-all ${isActive ? 'bg-emerald-50 border-emerald-300' : 'bg-gray-50 border-gray-200'} ${draggingVersionId === version.id ? 'opacity-40 scale-95' : 'opacity-100 scale-100'}`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              const isSameVersion = activeExamVersion?.id === version.id;
                              switchExamVersion(version.id);
                              setShowLessonSettings((prev) => {
                                if (!isSameVersion) {
                                  onUpdateLessonEditorUiState(currentLesson.id, {
                                    showLessonSettings: true,
                                    activeVersionId: version.id,
                                  });
                                  return true;
                                }
                                const next = !prev;
                                if (!next) {
                                  setOpenEditPicker(null);
                                }
                                onUpdateLessonEditorUiState(currentLesson.id, {
                                  showLessonSettings: next,
                                  activeVersionId: version.id,
                                });
                                return next;
                              });
                            }}
                            className={`px-2.5 py-1 font-arabic text-sm rounded-lg ${isActive ? 'text-emerald-800 font-bold' : 'text-gray-700 hover:text-gray-900'}`}
                          >
                            <span dir="auto" style={{ unicodeBidi: 'isolate' }} className="inline-flex items-center">
                              {renderDirectionAwareLabel(version.name || 'نسخة بدون اسم')}
                            </span>
                            <span className="mr-1 text-[11px] text-gray-500">({toArabicDigits(version.questions.length)})</span>
                          </button>
                          {currentLessonExamVersions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => deleteExamVersion(version.id)}
                              className="p-1 text-red-500 hover:text-red-700 rounded-md"
                              title="حذف النسخة"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      onClick={addExamVersion}
                      className="h-8 px-3 rounded-lg border border-dashed border-slate-400 bg-white text-slate-700 font-arabic text-sm hover:border-emerald-400 hover:text-emerald-700 hover:bg-emerald-50/40 transition-colors inline-flex items-center gap-1.5"
                    >
                      <Plus size={14} />
                      نسخة جديدة
                    </button>
                  </div>

                  {showLessonSettings && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start pt-1">
                      <div className="md:order-1">
                        <label className="inline-block text-emerald-800 font-bold font-arabic mb-2 text-lg bg-emerald-50 px-3 py-1 rounded-lg">عنوان الدرس</label>
                        <input
                          type="text"
                          value={activeVersionLessonTitle}
                          onChange={(e) => updateLessonTitleForActiveVersion(e.target.value)}
                          placeholder="اكتب عنوان الدرس"
                          dir={detectInputDirection(activeVersionLessonTitle, 'rtl')}
                          className={`w-full h-[46px] px-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-xl ${detectInputDirection(activeVersionLessonTitle, 'rtl') === 'ltr' ? 'text-left' : 'font-arabic text-right'}`}
                        />
                      </div>

                      <div className="md:order-5">
                        <div className="flex items-center gap-2 mb-2">
                          <label className="inline-block text-rose-800 font-bold font-arabic text-lg bg-rose-50 px-3 py-1 rounded-lg">رابط يوتيوب</label>
                          {currentLesson?.parentLessonId && (
                            <button
                              type="button"
                              onClick={() => updateLessonMetaForActiveVersion({ videoUrl: activeExamVersion?.videoUrl === '__EXCLUDED__' ? '' : '__EXCLUDED__' })}
                              className={`text-xs font-arabic ${activeExamVersion?.videoUrl === '__EXCLUDED__' ? 'text-emerald-600 hover:text-emerald-800' : 'text-red-600 hover:text-red-800'}`}
                            >
                              {activeExamVersion?.videoUrl === '__EXCLUDED__' ? 'تضمين الرابط' : 'استبعاد الرابط'}
                            </button>
                          )}
                        </div>
                        <input
                          type="url"
                          value={activeExamVersion?.videoUrl === '__EXCLUDED__' ? '' : (activeExamVersion?.videoUrl || '')}
                          onChange={(e) => updateLessonMetaForActiveVersion({ videoUrl: e.target.value })}
                          dir={activeExamVersion?.videoUrl === '__EXCLUDED__' ? 'rtl' : detectInputDirection(activeExamVersion?.videoUrl || '', 'rtl')}
                          disabled={activeExamVersion?.videoUrl === '__EXCLUDED__'}
                          className={`w-full h-[46px] px-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none ${activeExamVersion?.videoUrl === '__EXCLUDED__' ? 'bg-[repeating-linear-gradient(45deg,#f9fafb,#f9fafb_10px,#f3f4f6_10px,#f3f4f6_20px)] text-gray-400 font-arabic text-right' : (detectInputDirection(activeExamVersion?.videoUrl || '', 'rtl') === 'ltr' ? 'text-left' : 'font-arabic text-right')}`}
                        />
                      </div>

                      <div className="md:order-6">
                        <div className="flex items-center gap-2 mb-2">
                          <label className="inline-block text-slate-800 font-bold font-arabic text-lg bg-slate-100 px-3 py-1 rounded-lg">رابط ملف الشرح</label>
                          {currentLesson?.parentLessonId && (
                            <button
                              type="button"
                              onClick={() => updateLessonMetaForActiveVersion({ pdfUrl: activeExamVersion?.pdfUrl === '__EXCLUDED__' ? '' : '__EXCLUDED__' })}
                              className={`text-xs font-arabic ${activeExamVersion?.pdfUrl === '__EXCLUDED__' ? 'text-emerald-600 hover:text-emerald-800' : 'text-red-600 hover:text-red-800'}`}
                            >
                              {activeExamVersion?.pdfUrl === '__EXCLUDED__' ? 'تضمين الملف' : 'استبعاد الملف'}
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          {(() => {
                            const pdfValue = activeExamVersion?.pdfUrl || '';
                            const isLargeData = pdfValue.startsWith('data:') && pdfValue.length > 500;
                            const isExcluded = pdfValue === '__EXCLUDED__';
                            const displayValue = isExcluded ? '' : (isLargeData ? `[ملف مرفوع - ${(pdfValue.length / 1024).toFixed(1)} KB]` : pdfValue);
                            
                            return (
                              <>
                                {isLargeData ? (
                                  <div
                                    dir="rtl"
                                    className="w-full h-[46px] pl-20 pr-3 border border-gray-300 rounded-xl text-sm bg-slate-50 text-emerald-700 flex items-center justify-between"
                                  >
                                    <span className="font-arabic">
                                      [ملف مرفوع - <span className="font-sans">{(pdfValue.length / 1024).toFixed(1)}</span> KB]
                                    </span>
                                  </div>
                                ) : (
                                  <input
                                    type="text"
                                    value={displayValue}
                                    onChange={(e) => updateLessonMetaForActiveVersion({ pdfUrl: e.target.value })}
                                    dir={isExcluded ? 'rtl' : detectInputDirection(pdfValue, 'rtl')}
                                    disabled={isExcluded}
                                    className={`w-full h-[46px] pl-10 pr-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none ${isExcluded ? 'bg-[repeating-linear-gradient(45deg,#f9fafb,#f9fafb_10px,#f3f4f6_10px,#f3f4f6_20px)] text-gray-400 font-arabic text-right' : (detectInputDirection(pdfValue, 'rtl') === 'ltr' ? 'text-left' : 'font-arabic text-right')}`}
                                  />
                                )}
                                <div className="absolute left-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                                  {isLargeData && (
                                    <button
                                      type="button"
                                      onClick={() => updateLessonMetaForActiveVersion({ pdfUrl: '' })}
                                      title="حذف الملف"
                                      className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                                    >
                                      <X size={16} />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => explanationFileInputRef.current?.click()}
                                    title="رفع ملف جديد من الجهاز"
                                    className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-slate-50 rounded-lg transition-colors"
                                  >
                                    <Upload size={18} />
                                  </button>
                                </div>
                              </>
                            );
                          })()}
                          <input
                            type="file"
                            ref={explanationFileInputRef}
                            className="hidden"
                            accept="*/*"
                            onChange={handleExplanationFileUpload}
                          />
                        </div>
                      </div>

                      <div className="md:order-3">
                        <label className="inline-block text-amber-800 font-bold font-arabic mb-2 text-lg bg-amber-50 px-3 py-1 rounded-lg">الفئة المستهدفة</label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setOpenEditPicker((prev) => prev === 'targetAge' ? null : 'targetAge')}
                            className="w-full h-[46px] px-3 rounded-xl border border-gray-300 bg-white text-gray-700 font-arabic text-xl flex items-center justify-between hover:border-emerald-400 transition-colors"
                          >
                            <span>{getTargetAgeLabel(activeVersionTargetAge)}</span>
                            <ChevronDown size={18} className={`transition-transform ${openEditPicker === 'targetAge' ? 'rotate-180' : ''}`} />
                          </button>

                          {openEditPicker === 'targetAge' && (
                            <div className="absolute top-full right-0 mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-xl z-20 overflow-hidden">
                              {TARGET_AGE_OPTIONS.map((option) => (
                                <button
                                  key={option.key}
                                  type="button"
                                  onClick={() => {
                                    updateLessonMetaForActiveVersion({ targetAge: option.key });
                                    setOpenEditPicker(null);
                                  }}
                                  className={`w-full text-right px-4 py-2.5 font-arabic font-bold transition-colors border-b border-gray-100 last:border-b-0 ${activeVersionTargetAge === option.key ? 'bg-emerald-50 text-emerald-700' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="md:order-2">
                        <label className="inline-block text-sky-800 font-bold font-arabic mb-2 text-lg bg-sky-50 px-3 py-1 rounded-lg">المجموعة</label>
                        <div className="relative">
                          {(() => {
                            const selectedGroup = normalizeGroupName(currentLesson.group || '') || getLessonGroupKey(currentLesson);
                            return (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setOpenEditPicker((prev) => prev === 'group' ? null : 'group')}
                                  className="w-full h-[46px] px-3 rounded-xl border border-gray-300 bg-white text-gray-700 font-arabic text-xl flex items-center justify-between hover:border-sky-400 transition-colors"
                                >
                                  <span>
                                    {getGroupLabel(selectedGroup)}
                                    {currentLesson?.parentLessonId && bank[currentLesson.parentLessonId] && ` (${bank[currentLesson.parentLessonId].title})`}
                                  </span>
                                  <ChevronDown size={18} className={`transition-transform ${openEditPicker === 'group' ? 'rotate-180' : ''}`} />
                                </button>

                                {openEditPicker === 'group' && (
                                  <div className="absolute top-full right-0 mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-xl z-20 overflow-hidden">
                                    <div className="max-h-[320px] overflow-y-auto">
                                      {lessonGroupOptions.map((option) => {
                                        const isExpanded = expandedGroupInPicker === option.key;
                                        const groupLessons = Object.values(bank).filter((l) => 
                                          getLessonGroupKey(l) === option.key && !l.parentLessonId && l.id !== currentLesson?.id
                                        );

                                        return (
                                          <div key={option.key} className="border-b border-gray-100 last:border-b-0">
                                            <div
                                              className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 font-arabic font-bold transition-colors ${selectedGroup === option.key ? 'bg-sky-50 text-sky-700' : 'bg-white text-gray-700'}`}
                                            >
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setCurrentLesson({ ...currentLesson!, group: option.key, parentLessonId: undefined });
                                                  setExpandedGroupInPicker(isExpanded ? null : option.key);
                                                }}
                                                className="flex-1 text-right flex items-center justify-between"
                                              >
                                                <span>{option.label}</span>
                                                {groupLessons.length > 0 && (
                                                  <ChevronDown size={16} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                )}
                                              </button>
                                              {option.isCustom && (
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteCustomGroup(option.key);
                                                  }}
                                                  className="text-red-500 hover:text-red-700 text-xs"
                                                  title="حذف المجموعة"
                                                >
                                                  حذف
                                                </button>
                                              )}
                                            </div>

                                            {isExpanded && groupLessons.length > 0 && (
                                              <div className="bg-gray-50 py-1 pr-6 pl-2 space-y-1">
                                                {groupLessons.map((lesson) => (
                                                  <button
                                                    key={lesson.id}
                                                    type="button"
                                                    onClick={() => {
                                                      setCurrentLesson({ ...currentLesson!, parentLessonId: lesson.id, group: option.key });
                                                      setOpenEditPicker(null);
                                                    }}
                                                    className={`w-full text-right px-3 py-1.5 text-sm font-arabic font-bold transition-colors rounded-lg flex items-center gap-2 ${currentLesson?.parentLessonId === lesson.id ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:bg-gray-100'}`}
                                                  >
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                    {lesson.title}
                                                  </button>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <div className="p-2.5 bg-slate-50 border-t border-slate-200">
                                      <div className="flex gap-2">
                                        <input
                                          type="text"
                                          value={newGroupName}
                                          onChange={(e) => setNewGroupName(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              handleAddCustomGroup();
                                            }
                                          }}
                                          placeholder="اسم المجموعة"
                                          dir={detectInputDirection(newGroupName, 'rtl')}
                                          className={`flex-1 p-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-sky-400 ${detectInputDirection(newGroupName, 'rtl') === 'ltr' ? 'text-left' : 'font-arabic text-right'}`}
                                        />
                                        <button
                                          type="button"
                                          onClick={handleAddCustomGroup}
                                          className="h-9 w-9 rounded-lg bg-sky-600 text-white flex items-center justify-center hover:bg-sky-700 transition-colors"
                                          title="إضافة مجموعة"
                                        >
                                          <Plus size={15} />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>



                      <div className="md:order-4">
                        <label className="inline-block text-violet-800 font-bold font-arabic mb-2 text-lg bg-violet-50 px-3 py-1 rounded-lg">لغة الاختبار</label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setOpenEditPicker((prev) => prev === 'language' ? null : 'language')}
                            className="w-full h-[46px] px-3 rounded-xl border border-gray-300 bg-white text-gray-700 font-arabic text-xl flex items-center justify-between hover:border-violet-400 transition-colors"
                          >
                            <span>{getLanguageLabelByKey(activeVersionLanguage)}</span>
                            <ChevronDown size={18} className={`transition-transform ${openEditPicker === 'language' ? 'rotate-180' : ''}`} />
                          </button>

                          {openEditPicker === 'language' && (
                            <div className="absolute top-full right-0 mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-xl z-20 overflow-hidden">
                              {LESSON_LANGUAGE_OPTIONS.map((option) => (
                                <button
                                  key={option.key}
                                  type="button"
                                  onClick={() => {
                                    updateLessonMetaForActiveVersion({ language: option.key });
                                    setOpenEditPicker(null);
                                  }}
                                  className={`w-full text-right px-4 py-2.5 transition-colors border-b border-gray-100 last:border-b-0 ${option.key === 'en' ? 'font-sans' : 'font-arabic font-bold'} ${activeVersionLanguage === option.key ? 'bg-violet-50 text-violet-700' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Questions */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold text-gray-800 font-arabic">
                        اختبار الدرس{activeExamVersion ? ` • ${activeExamVersion.name || 'نسخة بدون اسم'}` : ''}
                      </h3>
                      <span className="text-xs px-2 py-1 rounded-md bg-slate-100 text-slate-600 font-arabic">
                        {activeVersionLanguage === 'en' ? 'English only' : 'عربي فقط'}
                      </span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => addQuestion('multiple_choice')} className="px-4 py-2 bg-purple-100 text-purple-700 rounded-xl font-arabic font-bold hover:bg-purple-200 transition-colors text-sm">
                        + سؤال اختياري
                      </button>
                      <button onClick={() => addQuestion('text')} className="px-4 py-2 bg-blue-100 text-blue-700 rounded-xl font-arabic font-bold hover:bg-blue-200 transition-colors text-sm">
                        + سؤال مقالي
                      </button>
                      <button onClick={() => addQuestion('audio')} className="px-4 py-2 bg-orange-100 text-orange-700 rounded-xl font-arabic font-bold hover:bg-orange-200 transition-colors text-sm">
                        + تسجيل صوتي
                      </button>
                    </div>
                  </div>

                  {questionSections.map((section) => {
                    const isSectionExpanded = expandedQuestionSections[section.type] ?? true;

                    return (
                      <div key={section.type} className="space-y-3">
                        <button
                          type="button"
                          onClick={() => setExpandedQuestionSections((prev) => ({ ...prev, [section.type]: !isSectionExpanded }))}
                          className="w-full flex items-center justify-between rounded-xl bg-white px-4 py-2.5 hover:bg-slate-50 transition-all duration-200 border border-transparent hover:border-slate-100"
                          dir={activeQuestionLang === 'en' ? 'ltr' : 'rtl'}
                        >
                          <div className="flex items-center gap-3">
                            <h4 className={`font-bold text-red-600 ${activeQuestionLang === 'en' ? 'text-sm tracking-wide uppercase' : 'font-arabic text-lg'}`}>
                              {section.title}
                            </h4>
                            {section.type === 'multiple_choice' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  randomizeCorrectOptionsIndices();
                                }}
                                className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors text-[10px] border border-amber-200/50"
                                title="توزيع الإجابات الصحيحة بشكل عشوائي"
                              >
                                <Shuffle size={12} className="shrink-0" />
                                <span className="font-arabic font-bold">توزيع عشوائي</span>
                              </button>
                            )}
                          </div>
                          <span className="flex items-center gap-2">
                            <span className={`text-sm px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold font-['Acme']`}>
                              {activeQuestionLang === 'en' ? section.questions.length : toArabicDigits(section.questions.length)}
                            </span>
                            <ChevronDown size={16} className={`text-slate-500 transition-transform duration-300 ${isSectionExpanded ? 'rotate-180' : ''}`} />
                          </span>
                        </button>

                        <div className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${isSectionExpanded ? 'max-h-[6000px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}`}>
                          <div className="space-y-3 pt-1">
                            {section.questions.map((q, index) => {
                          const localizedQuestionText = getQuestionTextForLanguage(q, activeQuestionLang);
                          const localizedOptions = getQuestionOptionsForLanguage(q, activeQuestionLang);
                          const renderedOptions = q.type === 'multiple_choice'
                            ? (localizedOptions.length > 0 ? localizedOptions : ['', '', ''])
                            : [];

                          return (
                            <div
                              key={q.id}
                              draggable
                              onDragStart={(e) => handleQuestionDragStart(e, q.id)}
                              onDragOver={(e) => handleQuestionDragOver(e, q.id)}
                              onDrop={(e) => handleQuestionDrop(e, q.id)}
                              onDragEnd={() => setDraggingQuestionId(null)}
                              className={`bg-white p-5 rounded-2xl border border-black relative transition-all cursor-move ${draggingQuestionId === q.id ? 'opacity-40 scale-95' : 'opacity-100 scale-100'}`}
                            >
                              <div className="absolute top-4 left-4 flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => moveQuestion(q.id, 'up')}
                                  disabled={index === 0}
                                  className={`p-2 rounded-lg transition-colors ${index === 0 ? 'text-slate-200 cursor-not-allowed' : 'text-slate-500 hover:text-emerald-500 hover:bg-slate-100'}`}
                                  title="نقل لأعلى"
                                >
                                  <ChevronUp size={20} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveQuestion(q.id, 'down')}
                                  disabled={index === section.questions.length - 1}
                                  className={`p-2 rounded-lg transition-colors ${index === section.questions.length - 1 ? 'text-slate-200 cursor-not-allowed' : 'text-slate-500 hover:text-emerald-500 hover:bg-slate-100'}`}
                                  title="نقل لأسفل"
                                >
                                  <ChevronDown size={20} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteQuestion(q.id)}
                                  className="p-2 text-slate-500 hover:text-rose-500 hover:bg-slate-100 rounded-lg transition-colors"
                                  title="حذف السؤال"
                                >
                                  <Trash2 size={20} />
                                </button>
                              </div>

                              <div className="mb-3 flex items-center gap-2 flex-wrap">
                                <span className="font-arabic font-bold text-xl text-slate-900">
                                  سؤال {toArabicDigits(index + 1)}
                                </span>
                                <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-arabic text-xs font-bold">
                                  {q.type === 'audio' ? 'تسجيل صوتي' : q.type === 'multiple_choice' ? 'اختيار من متعدد' : 'سؤال مقالي'}
                                </span>
                              </div>

                              <textarea
                                value={localizedQuestionText}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (activeQuestionLang === 'en') {
                                    updateQuestion(q.id, {
                                      textEn: value,
                                      ...(activeQuestionLang === 'en' ? { text: value } : {}),
                                    });
                                  } else {
                                    updateQuestion(q.id, {
                                      textAr: value,
                                      text: value,
                                    });
                                  }
                                }}
                                dir={activeQuestionLang === 'en' ? 'ltr' : 'rtl'}
                                className={`w-full p-3 min-h-[100px] outline-none resize-none mb-3 bg-slate-50/30 rounded-lg border border-slate-100 focus:ring-1 focus:ring-slate-200 focus:border-slate-200 leading-relaxed font-normal ${activeQuestionLang === 'ar' ? 'font-quran text-2xl text-right' : 'font-grading-mixed text-xl text-left'}`}
                                placeholder={activeQuestionLang === 'en' ? 'Question text...' : 'نص السؤال...'}
                              />

                              {q.type === 'multiple_choice' && (
                                <div className="space-y-2">
                                  <p className="text-xs text-slate-500 font-arabic px-1">
                                    {activeQuestionLang === 'en' ? 'Mark the correct option' : 'حدد الإجابة الصحيحة'}
                                  </p>
                                  <div className="space-y-1 rounded-lg border border-slate-100 bg-slate-50/40 p-1.5">
                                    {renderedOptions.map((opt, oIndex) => (
                                      <label
                                        key={oIndex}
                                        className={`flex gap-2 items-center px-2 py-2 rounded-lg border transition-colors ${q.correctOptionIndex === oIndex
                                          ? 'bg-emerald-50/80 border-emerald-100'
                                          : 'border-transparent hover:bg-white/70'
                                        }`}
                                      >
                                        <input
                                          type="radio"
                                          name={`correct_${q.id}`}
                                          checked={q.correctOptionIndex === oIndex}
                                          onChange={() => updateQuestion(q.id, { correctOptionIndex: oIndex })}
                                          className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                                          title="تحديد كإجابة صحيحة"
                                        />
                                        <input
                                          type="text"
                                          value={opt}
                                          onChange={(e) => {
                                            const newOptions = [...renderedOptions];
                                            newOptions[oIndex] = e.target.value;
                                            if (activeQuestionLang === 'en') {
                                              updateQuestion(q.id, {
                                                optionsEn: newOptions,
                                                ...(activeQuestionLang === 'en' ? { options: newOptions } : {}),
                                              });
                                            } else {
                                              updateQuestion(q.id, {
                                                optionsAr: newOptions,
                                                options: newOptions,
                                              });
                                            }
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Backspace' && opt === '' && renderedOptions.length > 1) {
                                              e.preventDefault();
                                              const nextOptions = renderedOptions.filter((_, i) => i !== oIndex);
                                              let nextCorrectIndex = q.correctOptionIndex;
                                              if (q.correctOptionIndex === oIndex) {
                                                nextCorrectIndex = 0;
                                              } else if (q.correctOptionIndex !== undefined && q.correctOptionIndex > oIndex) {
                                                nextCorrectIndex = q.correctOptionIndex - 1;
                                              }

                                              if (activeQuestionLang === 'en') {
                                                updateQuestion(q.id, {
                                                  optionsEn: nextOptions,
                                                  correctOptionIndex: nextCorrectIndex,
                                                  ...(activeQuestionLang === 'en' ? { options: nextOptions } : {}),
                                                });
                                              } else {
                                                updateQuestion(q.id, {
                                                  optionsAr: nextOptions,
                                                  options: nextOptions,
                                                  correctOptionIndex: nextCorrectIndex,
                                                });
                                              }
                                            }
                                          }}
                                          dir={activeQuestionLang === 'en' ? 'ltr' : 'rtl'}
                                          className={`flex-1 bg-transparent outline-none font-normal ${activeQuestionLang === 'ar' ? 'font-quran text-xl text-right' : 'font-grading-mixed text-lg text-left'}`}
                                          placeholder={activeQuestionLang === 'en'
                                            ? `Option ${toArabicDigits(oIndex + 1)}`
                                            : `الاختيار ${toArabicDigits(oIndex + 1)}`}
                                        />
                                      </label>
                                    ))}
                                  </div>
                                  <button
                                    onClick={() => {
                                      const nextOptions = [...renderedOptions, ''];
                                      if (activeQuestionLang === 'en') {
                                        updateQuestion(q.id, {
                                          optionsEn: nextOptions,
                                          ...(activeQuestionLang === 'en' ? { options: nextOptions } : {}),
                                        });
                                      } else {
                                        updateQuestion(q.id, {
                                          optionsAr: nextOptions,
                                          options: nextOptions,
                                        });
                                      }
                                    }}
                                    className="text-emerald-700 font-arabic text-sm font-bold hover:text-emerald-800 transition-colors"
                                  >
                                    {activeQuestionLang === 'en' ? '+ Add option' : '+ إضافة خيار آخر'}
                                  </button>
                                </div>
                              )}
                            </div>
                            );
                          })}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {(activeExamVersion?.questions.length || 0) === 0 && (
                    <div className="text-center text-gray-400 py-6 border-2 border-dashed border-gray-300 rounded-2xl font-arabic">
                      أضف أسئلة لهذا الدرس من الأزرار العلوية للحفظ.
                    </div>
                  )}
                </div>
              </div>
            )
          )}
        </div>

        {/* Footer for Edit */}
        {view === 'edit' && currentLesson && (
          <div className="bg-white border-t border-gray-200 p-6 flex justify-end shrink-0">
            <button
              onClick={saveCurrentLesson}
              className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold font-arabic flex items-center gap-2 hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
            >
              <Save size={20} />
              حفظ الدرس
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
