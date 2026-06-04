import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, BookOpen, Calendar, CheckCircle2, Clock3, ExternalLink, FileAudio, FileText, Mic, PauseCircle, PlayCircle, Send, Video } from 'lucide-react';
import './App.css';

type QuestionType = 'multiple_choice' | 'text' | 'audio';
type TajweedContentLanguage = 'ar' | 'en';
type TajweedLessonLanguage = 'ar' | 'en' | 'both';

const QUESTION_TYPE_ORDER: QuestionType[] = ['multiple_choice', 'text', 'audio'];
const QUESTION_TYPE_SECTION_LABELS: Record<QuestionType, { ar: string; en: string }> = {
  multiple_choice: { ar: 'أسئلة الاختيار من متعدد', en: 'Multiple Choice' },
  text: { ar: 'الأسئلة المقالية', en: 'Written Questions' },
  audio: { ar: 'أسئلة التسجيل الصوتي', en: 'Audio Questions' },
};

interface Student {
  id: string;
  name: string;
  academy: string;
  zoomLink?: string;
  duration?: string;
}

interface TajweedQuestion {
  id: string;
  type: QuestionType;
  text: string;
  options?: string[];
  textAr?: string;
  textEn?: string;
  optionsAr?: string[];
  optionsEn?: string[];
  correctOptionIndex?: number;
  points?: number;
}

interface TajweedExamVersion {
  id: string;
  lessonTitle?: string;
  language?: TajweedContentLanguage;
  targetAge?: 'kids' | 'adults' | 'all';
  videoUrl?: string;
  pdfUrl?: string;
  questions: TajweedQuestion[];
  createdAt?: number;
}

interface TajweedLesson {
  id: string;
  title: string;
  language?: TajweedLessonLanguage;
  targetAge?: 'kids' | 'adults' | 'all';
  questions: TajweedQuestion[];
  examVersions?: TajweedExamVersion[];
  videoUrl?: string;
  pdfUrl?: string;
}

interface TajweedAssignment {
  id: string;
  lessonId: string;
  studentId: string;
  assignedAt: number;
  contentLanguage?: TajweedContentLanguage;
  versionId?: string;
  status: 'pending' | 'submitted' | 'graded';
  submissionId?: string;
  deadline?: number;
}

interface QuestionAnswer {
  questionId: string;
  answerText?: string;
  selectedOptionIndex?: number;
  audioBase64?: string;
  audioLocalPath?: string;
  grade?: number;
  teacherNote?: string;
  isCorrect?: boolean;
}

interface TajweedSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  submittedAt: number;
  answers: QuestionAnswer[];
  totalGrade?: number;
  overallNote?: string;
}

interface AppState {
  students: Student[];
  attendance: Record<string, string>;
  month: number;
  year: number;
  lastReports?: Record<string, any>;
  tajweedBank?: Record<string, TajweedLesson>;
  tajweedAssignments?: Record<string, TajweedAssignment>;
  tajweedSubmissions?: Record<string, TajweedSubmission>;
}

interface DraftAnswer {
  questionId: string;
  answerText?: string;
  selectedOptionIndex?: number;
  audioBase64?: string;
  audioPreviewUrl?: string;
}

const API_BASE = 'https://quran-classes-tracker-default-rtdb.firebaseio.com';

const arabicMonths = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const toHindiDigits = (num: number | string): string => num.toString().replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

const toDate = (timestamp?: number) => {
  if (!timestamp) return 'غير محدد';
  const date = new Date(timestamp);
  return `${toHindiDigits(date.getDate())} ${arabicMonths[date.getMonth()]} ${toHindiDigits(date.getFullYear())}`;
};

const getScheduleLink = (durationStr?: string) => {
  if (!durationStr) return null;
  const normalized = durationStr.toString().replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).trim();
  if (normalized === '30') return 'https://zcal.co/i/tYjuo5JV';
  if (normalized === '45') return 'https://zcal.co/i/ThNRhEes';
  if (normalized === '60') return 'https://zcal.co/i/_yKMg4po';
  return null;
};

const getStudentPreferredQuestionLanguage = (studentName?: string): TajweedContentLanguage => {
  const name = String(studentName || '').trim();
  if (!name) return 'ar';
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(name) ? 'ar' : 'en';
};

const getLocalizedQuestionText = (
  question: TajweedQuestion,
  _lesson: TajweedLesson | null,
  preferredLanguage: TajweedContentLanguage,
): string => {
  if (preferredLanguage === 'en') {
    return question.textEn || question.text || question.textAr || '';
  }
  return question.textAr || question.text || question.textEn || '';
};

const getYouTubeEmbedUrl = (url?: string) => {
  if (!url) return '';
  let videoId = '';
  try {
    if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1].split('?')[0];
    } else if (url.includes('youtube.com/watch')) {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      videoId = urlObj.searchParams.get('v') || '';
    } else if (url.includes('youtube.com/embed/')) {
      return url;
    }
  } catch (e) {}
  return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
};

const getLocalizedQuestionOptions = (
  question: TajweedQuestion,
  _lesson: TajweedLesson | null,
  preferredLanguage: TajweedContentLanguage,
): string[] => {
  if (preferredLanguage === 'en') {
    return question.optionsEn || question.options || question.optionsAr || [];
  }
  return question.optionsAr || question.options || question.optionsEn || [];
};

const normalizeAssignmentLanguage = (value?: string | null): TajweedContentLanguage | null => {
  const raw = String(value || '').toLowerCase().trim();
  if (!raw) return null;

  if (
    raw === 'ar'
    || raw === 'arabic'
    || raw === 'ara'
    || raw === 'ar-sa'
    || raw === 'ar-eg'
    || raw === 'عربي'
    || raw === 'عربى'
    || raw === 'العربية'
  ) {
    return 'ar';
  }

  if (
    raw === 'en'
    || raw === 'english'
    || raw === 'eng'
    || raw === 'en-us'
    || raw === 'en-gb'
    || raw === 'إنجليزي'
    || raw === 'انجليزي'
    || raw === 'الإنجليزية'
    || raw === 'الانجليزية'
  ) {
    return 'en';
  }

  return null;
};

const getLessonExamVersions = (lesson?: TajweedLesson | null): TajweedExamVersion[] => {
  if (!lesson) return [];

  const versions = Array.isArray(lesson.examVersions) ? lesson.examVersions : [];
  if (versions.length > 0) return versions;

  return [
    {
      id: `${lesson.id || Date.now().toString()}-legacy-v1`,
      language: lesson.language === 'en' ? 'en' : 'ar',
      targetAge: lesson.targetAge || 'all',
      questions: Array.isArray(lesson.questions) ? lesson.questions : [],
      createdAt: Date.now(),
    }
  ];
};

const getAssignmentExamVersion = (
  assignment: TajweedAssignment | null,
  lesson: TajweedLesson | null,
  fallbackLanguage?: TajweedContentLanguage | null,
): TajweedExamVersion | null => {
  const versions = getLessonExamVersions(lesson);
  if (versions.length === 0) return null;

  const requestedVersionId = String(assignment?.versionId || '').trim();
  if (requestedVersionId) {
    const byId = versions.find((version) => String(version.id || '').trim() === requestedVersionId);
    if (byId) return byId;
  }

  const requestedLanguage = normalizeAssignmentLanguage(assignment?.contentLanguage);
  if (requestedLanguage) {
    const byLanguage = versions.find((version) => normalizeAssignmentLanguage(version.language) === requestedLanguage);
    if (byLanguage) return byLanguage;
  }

  const normalizedFallbackLanguage = normalizeAssignmentLanguage(fallbackLanguage);
  if (normalizedFallbackLanguage) {
    const byFallbackLanguage = versions.find((version) => normalizeAssignmentLanguage(version.language) === normalizedFallbackLanguage);
    if (byFallbackLanguage) return byFallbackLanguage;
  }

  return versions[0];
};

function App() {
  const searchParams = new URLSearchParams(window.location.search);
  const studentId = searchParams.get('student');

  const [data, setData] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState<'overview' | 'assignments' | 'history'>('overview');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [draftAnswersByAssignment, setDraftAnswersByAssignment] = useState<Record<string, Record<string, DraftAnswer>>>({});
  const [recordingQuestionId, setRecordingQuestionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingMetaRef = useRef<{ assignmentId: string; questionId: string } | null>(null);
  const assignmentScrollRef = useRef<HTMLDivElement | null>(null);

  const CACHE_KEY = `student_cache_${studentId}`;
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  const fetchData = async () => {
    if (!studentId) {
      setError('رابط الطالب غير صالح. يرجى التأكد من الرابط.');
      setLoading(false);
      return;
    }

    // ── Try cache first for instant display ──────────────────────────
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { ts, payload } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) {
          setData(payload);
          setSelectedMonth(new Date().getMonth());
          setSelectedYear(new Date().getFullYear());
          setLoading(false);
          // Still refresh in the background silently
          refreshInBackground(studentId);
          return;
        }
      }
    } catch { /* ignore cache errors */ }

    // ── No valid cache → fetch in parallel (targeted paths only) ─────
    try {
      const [
        studentsRes,
        attendanceRes,
        lastReportsRes,
        tajweedBankRes,
        tajweedAssignmentsRes,
      ] = await Promise.all([
        axios.get(`${API_BASE}/appState/students.json`),
        axios.get(`${API_BASE}/appState/attendance.json`),
        axios.get(`${API_BASE}/appState/lastReports/${encodeURIComponent(studentId)}.json`),
        axios.get(`${API_BASE}/appState/tajweedBank.json`),
        axios.get(`${API_BASE}/appState/tajweedAssignments.json`),
      ]);

      // Submissions are only fetched lazily (see below), skip here to keep load fast
      const payload: AppState = {
        students: Array.isArray(studentsRes.data) ? studentsRes.data : Object.values(studentsRes.data || {}),
        attendance: attendanceRes.data || {},
        month: new Date().getMonth(),
        year: new Date().getFullYear(),
        lastReports: studentsRes.data
          ? { [studentId]: lastReportsRes.data }
          : {},
        tajweedBank: tajweedBankRes.data || {},
        tajweedAssignments: tajweedAssignmentsRes.data || {},
        tajweedSubmissions: {},
      };

      setData(payload);
      setSelectedMonth(new Date().getMonth());
      setSelectedYear(new Date().getFullYear());
      setError('');

      // Cache for next visit
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), payload }));
      } catch { /* storage full – ignore */ }

      // Lazily fetch submissions (can contain heavy audio base64)
      fetchSubmissions(studentId, payload);
    } catch {
      setError('حدث خطأ أثناء جلب البيانات. الرجاء المحاولة لاحقاً.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmissions = async (sid: string, existingData: AppState) => {
    try {
      const res = await axios.get(`${API_BASE}/appState/tajweedSubmissions.json`);
      const submissions: Record<string, TajweedSubmission> = res.data || {};
      // Only keep submissions belonging to this student
      const filtered = Object.fromEntries(
        Object.entries(submissions).filter(([, sub]) => sub.studentId === sid),
      );
      setData((prev) => prev ? { ...prev, tajweedSubmissions: filtered } : prev);
      // Update cache with submissions
      try {
        const updatedPayload = { ...existingData, tajweedSubmissions: filtered };
        localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), payload: updatedPayload }));
      } catch { /* ignore */ }
    } catch { /* submissions failing is non-critical */ }
  };

  const refreshInBackground = async (sid: string) => {
    try {
      const [
        studentsRes,
        attendanceRes,
        lastReportsRes,
        tajweedBankRes,
        tajweedAssignmentsRes,
      ] = await Promise.all([
        axios.get(`${API_BASE}/appState/students.json`),
        axios.get(`${API_BASE}/appState/attendance.json`),
        axios.get(`${API_BASE}/appState/lastReports/${encodeURIComponent(sid)}.json`),
        axios.get(`${API_BASE}/appState/tajweedBank.json`),
        axios.get(`${API_BASE}/appState/tajweedAssignments.json`),
      ]);

      const payload: AppState = {
        students: Array.isArray(studentsRes.data) ? studentsRes.data : Object.values(studentsRes.data || {}),
        attendance: attendanceRes.data || {},
        month: new Date().getMonth(),
        year: new Date().getFullYear(),
        lastReports: { [sid]: lastReportsRes.data },
        tajweedBank: tajweedBankRes.data || {},
        tajweedAssignments: tajweedAssignmentsRes.data || {},
        tajweedSubmissions: {},
      };

      setData(payload);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), payload }));
      } catch { /* ignore */ }

      fetchSubmissions(sid, payload);
    } catch { /* background refresh – ignore errors */ }
  };

  useEffect(() => {
    fetchData();
  }, [studentId]);

  useEffect(() => {
    return () => {
      Object.values(draftAnswersByAssignment).forEach((answersMap) => {
        Object.values(answersMap).forEach((answer) => {
          if (answer.audioPreviewUrl) {
            URL.revokeObjectURL(answer.audioPreviewUrl);
          }
        });
      });
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [draftAnswersByAssignment]);

  const student = useMemo(() => data?.students?.find((s) => s.id === studentId), [data, studentId]);
  const preferredQuestionLanguage = useMemo<TajweedContentLanguage>(
    () => getStudentPreferredQuestionLanguage(student?.name),
    [student?.name],
  );

  const attendance = data?.attendance || {};
  const availableMonths = useMemo(() => {
    if (!student) return [{ month: new Date().getMonth(), year: new Date().getFullYear() }];
    const monthsSet = new Set<string>();

    Object.keys(attendance).forEach((key) => {
      const [id, _day, month, year] = key.split('_');
      if (id === student.id) {
        const monthNo = Number(month);
        const yearNo = Number(year);
        if (!Number.isNaN(monthNo) && !Number.isNaN(yearNo)) {
          monthsSet.add(`${yearNo}_${monthNo}`);
        }
      }
    });

    const now = new Date();
    monthsSet.add(`${now.getFullYear()}_${now.getMonth()}`);

    return Array.from(monthsSet)
      .map((key) => {
        const [year, month] = key.split('_').map(Number);
        return { month, year };
      })
      .sort((a, b) => (a.year === b.year ? a.month - b.month : a.year - b.year));
  }, [attendance, student]);

  const selectedMonthIndex = availableMonths.findIndex((m) => m.month === selectedMonth && m.year === selectedYear);
  const canGoPrev = selectedMonthIndex > 0;
  const canGoNext = selectedMonthIndex >= 0 && selectedMonthIndex < availableMonths.length - 1;

  const visitsData = useMemo(() => {
    if (!student) return { visitsCount: 0, presentDays: [] as number[] };
    let visitsCount = 0;
    const presentDays: number[] = [];

    Object.entries(attendance).forEach(([key, status]) => {
      const [id, day, month, year] = key.split('_');
      if (id !== student.id) return;
      if (Number(month) !== selectedMonth || Number(year) !== selectedYear) return;
      if (status === '1' || status === '!' || status === '2' || status === 'e' || status === 'ed') {
        visitsCount += status === '2' || status === 'ed' ? 2 : 1;
        presentDays.push(Number(day));
      }
    });

    presentDays.sort((a, b) => a - b);
    return { visitsCount, presentDays };
  }, [attendance, selectedMonth, selectedYear, student]);

  const bank = data?.tajweedBank || {};
  const assignments = data?.tajweedAssignments || {};
  const submissions = data?.tajweedSubmissions || {};

  const pendingAssignments = useMemo(
    () => Object.values(assignments)
      .filter((item) => item.studentId === studentId && item.status === 'pending' && bank[item.lessonId])
      .sort((a, b) => b.assignedAt - a.assignedAt),
    [assignments, bank, studentId],
  );

  const historyAssignments = useMemo(
    () => Object.values(assignments)
      .filter((item) => item.studentId === studentId && (item.status === 'submitted' || item.status === 'graded'))
      .sort((a, b) => b.assignedAt - a.assignedAt),
    [assignments, studentId],
  );

  useEffect(() => {
    if (!pendingAssignments.length) {
      setSelectedAssignmentId(null);
      return;
    }
    const stillExists = pendingAssignments.some((assignment) => assignment.id === selectedAssignmentId);
    if (!stillExists) {
      setSelectedAssignmentId(pendingAssignments[0].id);
    }
  }, [pendingAssignments, selectedAssignmentId]);

  const selectedAssignment = selectedAssignmentId ? assignments[selectedAssignmentId] : null;
  const selectedLesson = selectedAssignment ? bank[selectedAssignment.lessonId] : null;
  const selectedAssignmentVersion = useMemo(
    () => getAssignmentExamVersion(selectedAssignment, selectedLesson, preferredQuestionLanguage),
    [preferredQuestionLanguage, selectedAssignment, selectedLesson],
  );
  const selectedLessonQuestions = useMemo(
    () => (Array.isArray(selectedAssignmentVersion?.questions) ? selectedAssignmentVersion.questions : (selectedLesson?.questions || [])),
    [selectedAssignmentVersion, selectedLesson],
  );
  const latestPendingAssignment = pendingAssignments[0] || null;
  const latestPendingLesson = latestPendingAssignment ? bank[latestPendingAssignment.lessonId] : null;

  const selectedAssignmentLanguage = useMemo<TajweedContentLanguage>(() => {
    const fromAssignment = normalizeAssignmentLanguage(selectedAssignment?.contentLanguage);
    if (fromAssignment) return fromAssignment;

    const fromVersion = normalizeAssignmentLanguage(selectedAssignmentVersion?.language);
    if (fromVersion) return fromVersion;

    return preferredQuestionLanguage;
  }, [preferredQuestionLanguage, selectedAssignment?.contentLanguage, selectedAssignmentVersion?.language]);

  const selectedLessonQuestionSections = useMemo(() => {
    if (!selectedLesson) return [] as Array<{ type: QuestionType; title: string; questions: TajweedQuestion[] }>;

    return QUESTION_TYPE_ORDER
      .map((type) => ({
        type,
        title: selectedAssignmentLanguage === 'en' ? QUESTION_TYPE_SECTION_LABELS[type].en : QUESTION_TYPE_SECTION_LABELS[type].ar,
        questions: selectedLessonQuestions.filter((question) => question.type === type),
      }))
      .filter((section) => section.questions.length > 0);
  }, [selectedAssignmentLanguage, selectedLesson, selectedLessonQuestions]);

  useEffect(() => {
    const shouldLockScroll = activeTab === 'assignments' && !!selectedAssignment && !!selectedLesson;
    if (!shouldLockScroll) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleWheel = (event: WheelEvent) => {
      const container = assignmentScrollRef.current;
      if (!container) return;
      if (container.scrollHeight <= container.clientHeight) return;

      event.preventDefault();
      container.scrollBy({ top: event.deltaY, left: 0, behavior: 'auto' });
    };

    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('wheel', handleWheel);
      document.body.style.overflow = previousOverflow;
    };
  }, [activeTab, selectedAssignment, selectedLesson]);

  const upsertDraft = (assignmentId: string, questionId: string, updates: Partial<DraftAnswer>) => {
    setDraftAnswersByAssignment((prev) => {
      const currentAssignmentAnswers = prev[assignmentId] || {};
      const currentAnswer = currentAssignmentAnswers[questionId] || { questionId };

      if (currentAnswer.audioPreviewUrl && updates.audioPreviewUrl && currentAnswer.audioPreviewUrl !== updates.audioPreviewUrl) {
        URL.revokeObjectURL(currentAnswer.audioPreviewUrl);
      }

      return {
        ...prev,
        [assignmentId]: {
          ...currentAssignmentAnswers,
          [questionId]: {
            ...currentAnswer,
            ...updates,
          },
        },
      };
    });
  };

  const startRecording = async (assignmentId: string, questionId: string) => {
    setStatusMessage('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setStatusMessage('المتصفح الحالي لا يدعم التسجيل الصوتي.');
      return;
    }

    if (recordingQuestionId) {
      setStatusMessage('يوجد تسجيل يعمل حالياً. أوقفه أولاً.');
      return;
    }

    try {
      const preferredAudioConstraints: MediaStreamConstraints = {
        audio: {
          channelCount: 1,
          sampleRate: 48000,
          sampleSize: 16,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(preferredAudioConstraints);
      } catch {
        // Fallback to browser defaults if advanced constraints are rejected.
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      // AAC in MP4 plays on Safari/iOS; WebM Opus typically does not in <audio>.
      const mimeCandidates = [
        'audio/mp4;codecs=mp4a.40.2',
        'audio/mp4;codecs=mp4a',
        'audio/mp4',
        'audio/webm;codecs=opus',
        'audio/webm',
      ];

      const selectedMimeType = typeof MediaRecorder.isTypeSupported === 'function'
        ? (mimeCandidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || '')
        : '';

      const recorderOptions: MediaRecorderOptions = {
        audioBitsPerSecond: 128000,
      };

      if (selectedMimeType) {
        recorderOptions.mimeType = selectedMimeType;
      }

      const recorder = new MediaRecorder(stream, recorderOptions);
      const finalMimeType = recorder.mimeType || selectedMimeType || 'audio/webm';

      chunksRef.current = [];
      streamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recordingMetaRef.current = { assignmentId, questionId };
      setRecordingQuestionId(questionId);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const meta = recordingMetaRef.current;
        if (!meta) return;

        const blob = new Blob(chunksRef.current, { type: finalMimeType });
        const fileReader = new FileReader();
        const previewUrl = URL.createObjectURL(blob);

        fileReader.onloadend = () => {
          const dataUrl = typeof fileReader.result === 'string' ? fileReader.result : '';
          upsertDraft(meta.assignmentId, meta.questionId, {
            questionId: meta.questionId,
            audioBase64: dataUrl,
            audioPreviewUrl: previewUrl,
          });
        };
        fileReader.readAsDataURL(blob);

        stream.getTracks().forEach((track) => track.stop());
        chunksRef.current = [];
        streamRef.current = null;
        mediaRecorderRef.current = null;
        recordingMetaRef.current = null;
        setRecordingQuestionId(null);
      };

      recorder.start();
    } catch {
      setStatusMessage('تعذر تشغيل الميكروفون. تأكد من منح صلاحية التسجيل.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const removeAudioDraft = (assignmentId: string, questionId: string) => {
    setDraftAnswersByAssignment((prev) => {
      const currentAssignmentAnswers = prev[assignmentId] || {};
      const currentAnswer = currentAssignmentAnswers[questionId];
      if (!currentAnswer) return prev;

      if (currentAnswer.audioPreviewUrl) {
        URL.revokeObjectURL(currentAnswer.audioPreviewUrl);
      }

      return {
        ...prev,
        [assignmentId]: {
          ...currentAssignmentAnswers,
          [questionId]: {
            ...currentAnswer,
            audioBase64: undefined,
            audioPreviewUrl: undefined,
          },
        },
      };
    });
  };

  const submitSelectedAssignment = async () => {
    if (!selectedAssignment || !selectedLesson || !student) return;

    const assignmentDraft = draftAnswersByAssignment[selectedAssignment.id] || {};

    const hasMissing = selectedLesson.questions.some((question) => {
      const answer = assignmentDraft[question.id];
      if (question.type === 'text') return !answer?.answerText?.trim();
      if (question.type === 'multiple_choice') return answer?.selectedOptionIndex === undefined;
      return !answer?.audioBase64;
    });

    if (hasMissing) {
      setStatusMessage('يرجى حل جميع الأسئلة قبل الإرسال.');
      return;
    }

    const submissionId = `${selectedAssignment.id}_sub_${Date.now()}`;
    const submission: TajweedSubmission = {
      id: submissionId,
      assignmentId: selectedAssignment.id,
      studentId: student.id,
      submittedAt: Date.now(),
      answers: selectedLesson.questions.map((question) => {
        const draft = assignmentDraft[question.id] || { questionId: question.id };
        return {
          questionId: question.id,
          answerText: draft.answerText,
          selectedOptionIndex: draft.selectedOptionIndex,
          audioBase64: draft.audioBase64,
        };
      }),
    };

    setIsSubmitting(true);
    setStatusMessage('');

    try {
      await axios.put(`${API_BASE}/appState/tajweedSubmissions/${encodeURIComponent(submissionId)}.json`, submission);
      await axios.patch(`${API_BASE}/appState/tajweedAssignments/${encodeURIComponent(selectedAssignment.id)}.json`, {
        status: 'submitted',
        submissionId,
      });

      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tajweedSubmissions: {
            ...(prev.tajweedSubmissions || {}),
            [submissionId]: submission,
          },
          tajweedAssignments: {
            ...(prev.tajweedAssignments || {}),
            [selectedAssignment.id]: {
              ...selectedAssignment,
              status: 'submitted',
              submissionId,
            },
          },
        };
      });

      setStatusMessage('تم إرسال الواجب بنجاح. بارك الله فيك.');
      setActiveTab('history');
    } catch {
      setStatusMessage('تعذر إرسال الإجابات حالياً. حاول مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="portal-shell" dir="rtl">
        <div className="loading-ring" />
      </div>
    );
  }

  if (error || !data || !student) {
    return (
      <div className="portal-shell" dir="rtl">
        <div className="alert-card">
          <AlertCircle size={44} className="text-rose-500" />
          <h1 className="text-2xl font-bold">تعذر فتح الصفحة</h1>
          <p className="text-slate-600">{error || 'لا يوجد سجل للطالب المطلوب.'}</p>
          <button onClick={fetchData} className="rounded-2xl bg-slate-900 px-5 py-3 text-white">إعادة المحاولة</button>
        </div>
      </div>
    );
  }

  const scheduleLink = getScheduleLink(student.duration);
  const studentReport = data.lastReports?.[student.id];

  return (
    <div className="portal-shell" dir="rtl">
      <motion.header className="portal-header" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <div>
          <p className="text-sky-100/90 text-sm mb-1">بوابة الطالب</p>
          <h1 className="text-3xl font-extrabold mb-1 break-words">{student.name}</h1>
          <p className="text-sky-100/90 flex items-center gap-2"><BookOpen size={18} /> {student.academy}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5 sm:mt-0">
          {student.zoomLink && (
            <a href={student.zoomLink} target="_blank" rel="noreferrer" className="action-chip">
              <Video size={16} /> الالتحاق بالحصة
            </a>
          )}
          {scheduleLink && (
            <a href={scheduleLink} target="_blank" rel="noreferrer" className="action-chip">
              <Calendar size={16} /> جدولة حصة
            </a>
          )}
        </div>
      </motion.header>

      <main className="max-w-6xl mx-auto px-4 pb-10 space-y-5">
        <div className="tab-strip">
          <button onClick={() => setActiveTab('overview')} className={activeTab === 'overview' ? 'tab-btn tab-btn-active' : 'tab-btn'}>لوحة الطالب</button>
          <button onClick={() => setActiveTab('assignments')} className={activeTab === 'assignments' ? 'tab-btn tab-btn-active' : 'tab-btn'}>
            واجبات التجويد
            {pendingAssignments.length > 0 && (
              <span className="mr-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-rose-600 px-2 text-xs font-bold text-white">
                {toHindiDigits(pendingAssignments.length)}
              </span>
            )}
          </button>
          <button onClick={() => setActiveTab('history')} className={activeTab === 'history' ? 'tab-btn tab-btn-active' : 'tab-btn'}>سجل التجويد</button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.section key="overview" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">
              <div className="glass-card flex items-center justify-between">
                <button disabled={!canGoPrev} onClick={() => {
                  if (!canGoPrev) return;
                  const prev = availableMonths[selectedMonthIndex - 1];
                  setSelectedMonth(prev.month);
                  setSelectedYear(prev.year);
                }} className="nav-month-btn">السابق</button>

                <div className="text-center">
                  <p className="text-slate-500 text-sm">الشهر المعروض</p>
                  <p className="text-2xl font-bold text-slate-900">{arabicMonths[selectedMonth]} {toHindiDigits(selectedYear)}</p>
                </div>

                <button disabled={!canGoNext} onClick={() => {
                  if (!canGoNext) return;
                  const next = availableMonths[selectedMonthIndex + 1];
                  setSelectedMonth(next.month);
                  setSelectedYear(next.year);
                }} className="nav-month-btn">التالي</button>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="glass-card text-center">
                  <CheckCircle2 className="mx-auto text-emerald-600 mb-2" size={28} />
                  <p className="text-slate-500">عدد الحصص</p>
                  <p className="text-4xl font-black text-slate-900">{toHindiDigits(visitsData.visitsCount)}</p>
                </div>
                <div className="glass-card text-center">
                  <Clock3 className="mx-auto text-amber-600 mb-2" size={28} />
                  <p className="text-slate-500 mb-3">أيام الحضور</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {visitsData.presentDays.length ? visitsData.presentDays.map((day) => (
                      <span key={day} className="rounded-full bg-slate-900 text-white px-3 py-1 text-sm">{toHindiDigits(day)}</span>
                    )) : <span className="text-slate-400">لا توجد بيانات</span>}
                  </div>
                </div>
              </div>

              <div className="glass-card">
                <h2 className="text-xl font-bold mb-3 flex items-center gap-2"><FileText size={18} /> آخر تقرير</h2>
                {studentReport ? (
                  <div className="space-y-3 text-sm">
                    {studentReport.readingNew?.surah && <p><strong>الجديد:</strong> {studentReport.readingNew.surah}</p>}
                    {studentReport.readingRev?.surah && <p><strong>المراجعة:</strong> {studentReport.readingRev.surah}</p>}
                    {studentReport.homeworkNew?.surah && <p><strong>واجب الحفظ:</strong> {studentReport.homeworkNew.surah}</p>}
                  </div>
                ) : <p className="text-slate-500">لا يوجد تقرير محفوظ بعد.</p>}
              </div>

              <div className="glass-card">
                <h2 className="text-xl font-bold mb-3 flex items-center gap-2"><BookOpen size={18} /> اختبار التجويد المرتبط</h2>
                {latestPendingAssignment && latestPendingLesson ? (
                  <div className="space-y-3 text-sm">
                    <p><strong>الدرس:</strong> {latestPendingLesson.title}</p>
                    <p><strong>تاريخ الإسناد:</strong> {toDate(latestPendingAssignment.assignedAt)}</p>
                    <p><strong>عدد الأسئلة:</strong> {toHindiDigits(latestPendingLesson.questions.length)}</p>
                    <button
                      onClick={() => {
                        setSelectedAssignmentId(latestPendingAssignment.id);
                        setActiveTab('assignments');
                      }}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-white font-bold hover:bg-emerald-700 transition-colors"
                    >
                      فتح الاختبار الآن
                    </button>
                  </div>
                ) : (
                  <p className="text-slate-500">لا يوجد اختبار تجويد جديد حالياً.</p>
                )}
              </div>
            </motion.section>
          )}

          {activeTab === 'assignments' && (
            <motion.section key="assignments" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="grid lg:grid-cols-[320px_1fr] gap-5">
              <aside className="glass-card h-fit">
                <h2 className="text-xl font-bold mb-3">الواجبات المسندة</h2>
                <div className="space-y-3">
                  {pendingAssignments.length === 0 && <p className="text-slate-500">لا يوجد واجب تجويد حاليًا.</p>}
                  {pendingAssignments.map((assignment) => (
                    <button key={assignment.id} onClick={() => setSelectedAssignmentId(assignment.id)} className={selectedAssignmentId === assignment.id ? 'assignment-item assignment-item-active' : 'assignment-item'}>
                      <p className="font-bold text-right">{bank[assignment.lessonId]?.title || 'درس غير متاح'}</p>
                      <p className="text-xs text-slate-500 text-right">تاريخ الإسناد: {toDate(assignment.assignedAt)}</p>
                      <p className="text-xs text-slate-500 text-right">الموعد النهائي: {toDate(assignment.deadline)}</p>
                    </button>
                  ))}
                </div>
              </aside>

              <div ref={assignmentScrollRef} className="glass-card max-h-[78vh] overflow-y-auto overscroll-contain">
                {!selectedLesson || !selectedAssignment ? (
                  <p className="text-slate-500">اختر واجبًا من القائمة لبدء الحل.</p>
                ) : (
                  <>
                    <div className="border-b border-slate-200 pb-4 mb-5">
                      <h3 className="text-2xl font-extrabold">{selectedLesson.title}</h3>
                      <p className="text-slate-500 mt-1">أجب على جميع الأسئلة ثم اضغط إرسال.</p>
                    </div>

                    {(selectedAssignmentVersion?.videoUrl || selectedLesson.videoUrl) && (
                      <div className="mb-6">
                        <button
                          onClick={() => setShowVideo(!showVideo)}
                          className="flex items-center gap-3 p-4 w-full rounded-2xl bg-rose-50 border border-rose-100 text-rose-800 hover:bg-rose-100 transition-colors shadow-sm"
                        >
                          <Video className="text-rose-600" />
                          <div className="flex-1 text-right">
                            <p className="font-bold font-arabic text-lg">{showVideo ? 'إغلاق الفيديو' : 'شاهد شرح الدرس (فيديو)'}</p>
                            <p className="text-sm opacity-80 font-arabic">{showVideo ? 'اضغط للإغلاق' : 'اضغط لمشاهدة شرح المعلم لهذا الدرس'}</p>
                          </div>
                          <PlayCircle size={20} className={showVideo ? 'rotate-180 transition-transform' : ''} />
                        </button>
                        
                        {showVideo && (
                          <div className="mt-4 animate-fade">
                            <iframe
                              className="w-full aspect-video rounded-2xl shadow-lg border border-slate-200"
                              src={getYouTubeEmbedUrl(selectedAssignmentVersion?.videoUrl || selectedLesson.videoUrl || '')}
                              title="شرح الدرس مرئي"
                              allowFullScreen
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {(selectedAssignmentVersion?.pdfUrl || selectedLesson.pdfUrl) && (
                      <div className="mb-6">
                        {(() => {
                          const url = (selectedAssignmentVersion?.pdfUrl || selectedLesson.pdfUrl || '');
                          const urlLower = url.toLowerCase();
                          const isPdf = urlLower.startsWith('data:application/pdf') || urlLower.endsWith('.pdf') || urlLower.includes('.pdf?');
                          const isHtmlOrWeb = urlLower.startsWith('data:text/html') || urlLower.includes('.html') || urlLower.includes('.php') || (urlLower.startsWith('http') && !isPdf);
                          const isImage = urlLower.startsWith('data:image/') || urlLower.endsWith('.svg') || urlLower.endsWith('.png') || urlLower.endsWith('.jpg') || urlLower.endsWith('.jpeg');
                          
                          // Helper to create blob URL from data URL
                          const getSafeUrl = (rawUrl: string) => {
                            if (rawUrl.startsWith('data:text/html')) {
                              try {
                                const [meta, data] = rawUrl.split(',');
                                const isBase64 = meta.includes('base64');
                                const bin = isBase64 ? atob(data) : decodeURIComponent(data);
                                const arr = new Uint8Array(bin.length);
                                for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
                                const blob = new Blob([arr], { type: 'text/html' });
                                return URL.createObjectURL(blob);
                              } catch (e) {
                                console.error('Blob creation failed', e);
                                return rawUrl;
                              }
                            }
                            return rawUrl;
                          };

                          const handleOpenNewTab = (e: React.MouseEvent) => {
                            if (url.startsWith('data:')) {
                              e.preventDefault();
                              window.open(getSafeUrl(url), '_blank');
                            }
                          };

                          if (isImage) {
                            return (
                              <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <FileText size={18} className="text-slate-500" />
                                    <span className="font-bold text-slate-700 font-arabic">شرح الدرس (صورة)</span>
                                  </div>
                                  <a 
                                    href={url} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    onClick={handleOpenNewTab}
                                    className="text-sky-600 text-sm font-bold flex items-center gap-1 hover:text-sky-700"
                                  >
                                    <span>فتح في نافذة جديدة</span>
                                    <ExternalLink size={14} />
                                  </a>
                                </div>
                                <div className="p-4 flex justify-center bg-slate-50">
                                  <img
                                    src={url}
                                    className="max-w-full h-auto rounded-lg shadow-sm cursor-zoom-in"
                                    alt="شرح الدرس"
                                    onClick={() => window.open(url, '_blank')}
                                  />
                                </div>
                              </div>
                            );
                          }

                          if (isHtmlOrWeb) {
                            const safeUrl = getSafeUrl(url);
                            return (
                              <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <FileText size={18} className="text-slate-500" />
                                    <span className="font-bold text-slate-700 font-arabic">شرح الدرس</span>
                                  </div>
                                  <a 
                                    href={url} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    onClick={handleOpenNewTab}
                                    className="text-sky-600 text-sm font-bold flex items-center gap-1 hover:text-sky-700"
                                  >
                                    <span>فتح في نافذة جديدة</span>
                                    <ExternalLink size={14} />
                                  </a>
                                </div>
                                <iframe
                                  src={safeUrl}
                                  className="w-full h-[50vh] border-none bg-white rounded-xl shadow-inner"
                                  title="محتوى شرح الدرس"
                                  sandbox="allow-scripts allow-same-origin"
                                />
                              </div>
                            );
                          }

                          return (
                            <a
                              href={selectedAssignmentVersion?.pdfUrl || selectedLesson.pdfUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-800 hover:bg-emerald-100 transition-colors shadow-sm"
                            >
                              <FileText className="text-emerald-600" />
                              <div className="flex-1 text-right">
                                <p className="font-bold font-arabic text-lg">فتح ملف شرح الدرس (PDF)</p>
                                <p className="text-sm opacity-80 font-arabic">اضغط هنا لمراجعة شرح الدرس قبل البدء</p>
                              </div>
                              <ExternalLink size={20} className="opacity-40" />
                            </a>
                          );
                        })()}
                      </div>
                    )}

                    <div className="space-y-5">
                      {selectedLessonQuestionSections.map((section) => (
                        <section key={section.type} className="space-y-3">
                          <div className="rounded-xl bg-slate-100/80 px-3 py-2">
                            <h4 className="font-bold text-slate-700">{section.title}</h4>
                          </div>

                          <div className="space-y-4">
                            {section.questions.map((question, idx) => {
                              const answer = draftAnswersByAssignment[selectedAssignment.id]?.[question.id];
                              const localizedQuestionText = getLocalizedQuestionText(question, selectedLesson, selectedAssignmentLanguage);
                              const localizedQuestionOptions = getLocalizedQuestionOptions(question, selectedLesson, selectedAssignmentLanguage);

                              const renderMixedArabicEnglish = (text, defaultClass = '') => {
                                if (!text || typeof text !== 'string') return text;
                                const regex = /([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF٠-٩]+(?:[\s]*[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF٠-٩]+)*)/g;
                                const parts = text.split(regex);
                                if (parts.length === 1) return text;
                                
                                return parts.map((part, index) => {
                                  if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF٠-٩]/.test(part)) {
                                    return <span key={index} className={`font-uthman leading-relaxed text-[1.15em] mx-1 inline-block ${defaultClass}`} dir="rtl">{part}</span>;
                                  }
                                  return <span key={index}>{part}</span>;
                                });
                              };

                              return (
                                <div key={question.id} className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                                  <p className="font-bold mb-3">{toHindiDigits(idx + 1)}. {renderMixedArabicEnglish(localizedQuestionText)}</p>

                                  {question.type === 'text' && (
                                    <textarea
                                      value={answer?.answerText || ''}
                                      onChange={(event) => upsertDraft(selectedAssignment.id, question.id, { questionId: question.id, answerText: event.target.value })}
                                      placeholder="اكتب إجابتك هنا"
                                      className="w-full rounded-xl border border-slate-300 p-3 min-h-24 outline-none focus:border-sky-500"
                                    />
                                  )}

                                  {question.type === 'multiple_choice' && (
                                    <div className="space-y-2">
                                      {localizedQuestionOptions.map((option, optionIdx) => (
                                        <label key={`${question.id}_${optionIdx}`} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 cursor-pointer">
                                          <input
                                            type="radio"
                                            checked={answer?.selectedOptionIndex === optionIdx}
                                            onChange={() => upsertDraft(selectedAssignment.id, question.id, {
                                              questionId: question.id,
                                              selectedOptionIndex: optionIdx,
                                            })}
                                            className="shrink-0"
                                          />
                                          <span>{renderMixedArabicEnglish(option)}</span>
                                        </label>
                                      ))}
                                    </div>
                                  )}

                                  {question.type === 'audio' && (
                                    <div className="space-y-3">
                                      <div className="flex flex-wrap gap-2">
                                        {recordingQuestionId === question.id ? (
                                          <button onClick={stopRecording} className="record-btn bg-rose-600 text-white">
                                            <PauseCircle size={16} /> إيقاف التسجيل
                                          </button>
                                        ) : (
                                          <button onClick={() => startRecording(selectedAssignment.id, question.id)} className="record-btn bg-sky-700 text-white">
                                            <Mic size={16} /> بدء التسجيل
                                          </button>
                                        )}
                                        {!!answer?.audioBase64 && (
                                          <button onClick={() => removeAudioDraft(selectedAssignment.id, question.id)} className="record-btn bg-slate-200 text-slate-700">
                                            حذف التسجيل
                                          </button>
                                        )}
                                      </div>
                                      {!!answer?.audioPreviewUrl && (
                                        <audio controls src={answer.audioPreviewUrl} className="w-full" />
                                      )}
                                      {!answer?.audioPreviewUrl && <p className="text-sm text-slate-500">سجل تلاوتك أو نطقك لهذا السؤال.</p>}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      ))}
                    </div>

                    {statusMessage && (
                      <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-amber-800 text-sm">
                        {statusMessage}
                      </div>
                    )}

                    <button disabled={isSubmitting} onClick={submitSelectedAssignment} className="mt-5 w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white px-5 py-4 text-lg font-bold flex items-center justify-center gap-2">
                      <Send size={18} /> {isSubmitting ? 'جاري الإرسال...' : 'إرسال الواجب'}
                    </button>
                  </>
                )}
              </div>
            </motion.section>
          )}

          {activeTab === 'history' && (
            <motion.section key="history" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
              {historyAssignments.length === 0 && (
                <div className="glass-card">
                  <p className="text-slate-500">لا يوجد سجل تجويد حتى الآن.</p>
                </div>
              )}

              {historyAssignments.map((assignment) => {
                const lesson = bank[assignment.lessonId];
                const lessonVersion = getAssignmentExamVersion(assignment, lesson, preferredQuestionLanguage);
                const assignmentLanguage = normalizeAssignmentLanguage(assignment.contentLanguage)
                  || normalizeAssignmentLanguage(lessonVersion?.language)
                  || preferredQuestionLanguage;
                const historyQuestions = Array.isArray(lessonVersion?.questions)
                  ? lessonVersion.questions
                  : (lesson?.questions || []);
                const submission = assignment.submissionId ? submissions[assignment.submissionId] : undefined;
                const maxTotal = historyQuestions.reduce((total, question) => total + (question.points || 0), 0);

                return (
                  <div key={assignment.id} className="glass-card">
                    <div className="flex flex-wrap gap-3 justify-between items-center mb-4">
                      <div>
                        <h3 className="text-xl font-extrabold">{lesson?.title || 'درس محذوف'}</h3>
                        <p className="text-sm text-slate-500">تاريخ الإسناد: {toDate(assignment.assignedAt)}</p>
                        {submission && <p className="text-sm text-slate-500">تاريخ الإرسال: {toDate(submission.submittedAt)}</p>}
                      </div>
                      <span className={assignment.status === 'graded' ? 'rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-sm font-bold' : 'rounded-full bg-amber-100 text-amber-700 px-3 py-1 text-sm font-bold'}>
                        {assignment.status === 'graded' ? 'تم التصحيح' : 'قيد التصحيح'}
                      </span>
                    </div>

                    {submission?.overallNote && (
                      <div className="rounded-2xl bg-sky-50 border border-sky-100 px-4 py-3 text-sky-900 mb-3">
                        <p className="font-semibold">ملاحظة عامة من المعلم:</p>
                        <p>{submission.overallNote}</p>
                      </div>
                    )}

                    {assignment.status === 'graded' && (
                      <p className="font-bold mb-3 text-lg">
                        الدرجة النهائية: {toHindiDigits(submission?.totalGrade ?? 0)}{maxTotal ? ` / ${toHindiDigits(maxTotal)}` : ''}
                      </p>
                    )}

                    <div className="space-y-3">
                      {historyQuestions.map((question, index) => {
                        const answer = submission?.answers.find((item) => item.questionId === question.id);
                        const localizedQuestionText = getLocalizedQuestionText(question, lesson, assignmentLanguage);
                        const localizedQuestionOptions = getLocalizedQuestionOptions(question, lesson, assignmentLanguage);
                        const selectedChoice = localizedQuestionOptions?.[answer?.selectedOptionIndex ?? -1];
                        const isGraded = assignment.status === 'graded';
                        const maxPoints = Number(question.points || 0);

                        const multipleChoiceIsCorrect = question.type === 'multiple_choice'
                          && typeof answer?.selectedOptionIndex === 'number'
                          && typeof question.correctOptionIndex === 'number'
                          ? answer.selectedOptionIndex === question.correctOptionIndex
                          : null;

                        const binaryIsCorrect = (question.type === 'audio' || question.type === 'text')
                          ? (typeof answer?.isCorrect === 'boolean'
                            ? answer.isCorrect
                            : (typeof answer?.grade === 'number' && maxPoints > 0
                              ? answer.grade > 0
                              : null))
                          : null;

                        return (
                          <div key={question.id} className="rounded-xl border border-slate-200 p-3 bg-white/80">
                            <p className="font-bold mb-2">{index + 1}. {localizedQuestionText}</p>

                            {question.type === 'text' && (
                              <p className="text-slate-700">{answer?.answerText || 'لا توجد إجابة نصية.'}</p>
                            )}

                            {question.type === 'multiple_choice' && (
                              <p className="text-slate-700 flex flex-wrap items-center gap-2">
                                <span>الإجابة المختارة: {selectedChoice || 'غير محددة'}</span>
                                {isGraded && typeof multipleChoiceIsCorrect === 'boolean' && (
                                  <strong className={multipleChoiceIsCorrect ? 'text-emerald-700' : 'text-rose-700'}>
                                    {multipleChoiceIsCorrect ? 'صح' : 'خطأ'}
                                  </strong>
                                )}
                              </p>
                            )}

                            {question.type === 'audio' && (
                              <div className="space-y-2">
                                {answer?.audioBase64 ? (
                                  <audio controls src={answer.audioBase64} className="w-full" />
                                ) : (
                                  <p className="text-slate-500 flex items-center gap-2"><FileAudio size={16} /> التسجيل الصوتي محفوظ لدى الإدارة.</p>
                                )}
                              </div>
                            )}

                            {isGraded && (
                              <div className="mt-2 text-sm text-slate-700 space-y-1">
                                {(question.type === 'audio' || question.type === 'text') && typeof binaryIsCorrect === 'boolean' && (
                                  <p>
                                    {question.type === 'audio' ? 'تقييم السؤال الصوتي:' : 'تقييم السؤال:'}{' '}
                                    <strong className={binaryIsCorrect ? 'text-emerald-700' : 'text-rose-700'}>
                                      {binaryIsCorrect ? 'صح' : 'خطأ'}
                                    </strong>
                                  </p>
                                )}
                                <p>درجة السؤال: <strong>{toHindiDigits(answer?.grade ?? 0)}{question.points ? ` / ${toHindiDigits(question.points)}` : ''}</strong></p>
                                {answer?.teacherNote && <p>ملاحظة المعلم: {answer.teacherNote}</p>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
