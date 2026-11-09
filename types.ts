export enum AttendanceStatus {
  PRESENT = '1',
  PAID_ABSENCE = '!',
  PAID_ABSENCE_DOUBLE = '!2', // Grey with ! and Red Dot (Count as two classes)
  POSTPONED = 'م',
  UNEXCUSED_ABSENCE = 'x', // Red with white dash
  ABSENCE_RED = 'r', // Completely red
  EXTRA_DAY = 'e',   // Red stroke reminder
  DOUBLE_CLASS = '2', // Count as two classes
  ABSENT = '', // Empty/Red
  EXEMPT = 'exempt', // Exempt from required day (removes red stroke)
  TRANSFERRED = 't', // Transferred to next month (Green with arrow)
  TRANSFERRED_ABSENT = 'ta', // Transferred absent to next month (Red with arrow)
  EXTRA_DOUBLE = 'ed', // Extra Day with Double Time (Blue Stroke + Red Dot)
}

export interface MakeupLink {
  missedDay: number;      // Day of the missed class
  makeupDay: number;      // Day of the makeup class
  studentId: string;
  month: number;
  year: number;
  originalStatus?: AttendanceStatus;
}

export interface AcademyRate {
  rate: number;
  currency: string;
  isArchived?: boolean;
  deductedMinutes?: number;
  monthlyDeductions?: Record<string, number>;
  billingStartDay?: number;
  externalLink?: string;
  holidays?: number[]; // Days of week (0-6) that are off for this academy
  disableReports?: boolean; // If true, reports are disabled for all students in this academy
  whatsappNumber?: string; // WhatsApp number/group for this academy
  openLinksExternally?: boolean; // If true, session links open in external browser
  showAnimationBeforeLink?: boolean; // If true, display the class number animation overlay before opening
}

export interface StudyPlan {
  isActive: boolean;
  targetType: 'pages' | 'verses';
  from: number;
  to: number;
  totalClasses: number;
  portionPerClass: number;
  startDate: string;
  endDate: string;
}

export interface CalendarSchedule {
  source: 'google-calendar';
  name: string;
  weekStart: string;
  weekEnd: string;
  timeMin: string;
  timeMax: string;
  updatedAt: string;
  status: 'ready' | 'empty';
  message: string;
  slots: { start: string; timeZone: string }[];
}

export interface CalendarSchedulesResult {
  available: boolean;
  schedules: Record<string, CalendarSchedule>;
  reviews?: Record<string, CalendarReviewSnapshot>;
  error?: string;
}

export interface CalendarOccurrence {
  id: string;
  start: string;
  end: string;
  originalStart?: string;
  timeZone: string;
  colorId: string;
  recurring: boolean;
}
export interface CalendarReviewSnapshot {
  name: string;
  fetchedAt: string;
  events: CalendarOccurrence[];
  archivedIds?: string[];
  archivedStarts?: string[];
  weeklyDays?: number[];
  weeklyExpandedDays?: number[];
  weeklySignature?: string;
}
export interface CalendarProposal {
  id: string;
  kind: 'scheduled' | 'red' | 'moved' | 'weekly' | 'reset';
  detectedAt: string;
  event?: CalendarOccurrence;
  from?: string;
  days?: number[];
  signature?: string;
  reason?: 'green' | 'one-off';
}
export interface CalendarReviewState {
  name: string;
  observed: Record<string, { event: CalendarOccurrence; revision: number; present?: boolean }>;
  pending: CalendarProposal[];
  decisions: Record<string, { action: string; at: string }>;
  weeklySignature?: string;
}
export interface ScheduleHistoryEntry {
  before: string;
  days: number[];
  dayStartDates?: Record<number, string>;
}

export interface Student {
  id: string;
  name: string;
  academy: string;
  targetAge?: 'kids' | 'adults';
  location: string;
  rate: number;
  days?: number[];
  duration?: string;
  paymentBasis?: string;
  useAcademyRate?: boolean;
  externalLink?: string;
  deletedAt?: { month: number; year: number };
  hasSeparator?: boolean;
  hasTopSeparator?: boolean;
  hasBottomSeparator?: boolean;
  color?: string;
  isPinnedToEnd?: boolean;
  disableReport?: boolean;
  whatsappNumber?: string; // WhatsApp number for sending reports
  zoomLink?: string; // Link for Zoom or other platform for the student web app
  quranLink?: string; // Google Drive file shared with this student
  readingLink?: string; // Google Drive reading book shared with this student
  shortcutSourceId?: string; // Confirmed shortcut file identity, without exposing the local path
  readingShortcutSourceId?: string;
  acknowledgedMissingReadingIds?: string[]; // Missing shortcut paths already reviewed by the user
  shortcutAutoMatchDisabled?: boolean; // New students without a confirmed shortcut need review
  shortcutNotRequired?: boolean; // This student intentionally has no shortcut links
  scheduleMessage?: string; // WhatsApp-style schedule text to display in the student portal
  calendarSchedule?: CalendarSchedule;
  calendarReview?: CalendarReviewState;
  scheduleHistory?: ScheduleHistoryEntry[];
  isPrepaid?: boolean;
  prepaidTotal?: number;
  prepaidCurrent?: number;
  prepaidMode?: 'subscription' | 'monthly';
  dayStartDates?: Record<number, string>; // Maps day of week (0-6) to start date (YYYY-MM-DD)
  studyPlan?: StudyPlan;
}

export interface AttendanceRecord {
  [key: string]: AttendanceStatus; // key format: `studentId_dayIndex` (e.g., "123_5" for 5th day of month)
}

export interface AppState {
  students: Student[];
  attendance: AttendanceRecord;
  month: number;
  year: number;
  dayOff: number; // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
  academyRates?: Record<string, AcademyRate>;
  monthlyObligations?: Record<string, number>; // key format: `month_year`
  paymentStatus?: Record<string, boolean>;    // key format: `studentId_or_academyName_month_year`
  makeupLinks?: MakeupLink[];  // Track makeup class relationships
  showMakeupLines?: boolean;   // Toggle visibility of connection lines

  // Tajweed System
  tajweedBank?: Record<string, TajweedLesson>; // key is lessonId
  tajweedAssignments?: Record<string, TajweedAssignment>; // key is assignmentId
  tajweedSubmissions?: Record<string, TajweedSubmission>; // key is submissionId

  studentNotesHistory?: Record<string, string[]>; // History of custom notes per student

  lastUpdated?: number; // Tracks remote sync timestamp
}

export interface LessonProgress {
  path: 'quran' | 'reading' | 'tajweed';
  // Quran path
  surah?: string;
  fromAyah?: number;
  toAyah?: number;
  // Reading path (Noor Al-Bayan)
  fromPage?: number;
  toPage?: number;
  fromLine?: number;
  toLine?: number;
  book?: 'noor' | 'taasees';
  // Tajweed path
  tajweedLessonId?: string;
  tajweedLessonTitle?: string;
  tajweedTopicGroup?: string;
  tajweedTopic?: string;
  // Timestamp
  lastUpdated?: number;
}

export type QuestionType = 'multiple_choice' | 'text' | 'audio';

export type TajweedContentLanguage = 'ar' | 'en';
export type TajweedLessonLanguage = 'ar' | 'en' | 'both';

export interface TajweedQuestion {
  id: string;
  type: QuestionType;
  text: string;
  options?: string[]; // For multiple choice
  textAr?: string;
  textEn?: string;
  optionsAr?: string[];
  optionsEn?: string[];
  correctOptionIndex?: number; // Optional: auto grade
}

export interface TajweedExamVersion {
  id: string;
  name: string;
  lessonTitle?: string;
  targetAge?: 'kids' | 'adults' | 'all';
  language?: TajweedContentLanguage;
  videoUrl?: string;
  pdfUrl?: string;
  questions: TajweedQuestion[];
  createdAt: number;
}

export interface TajweedLesson {
  id: string;
  title: string;
  group?: string;
  parentLessonId?: string;
  videoUrl?: string;
  pdfUrl?: string;
  language?: TajweedLessonLanguage;
  targetAge: 'kids' | 'adults' | 'all';
  questions: TajweedQuestion[];
  examVersions?: TajweedExamVersion[];
  createdAt: number;
}

export interface TajweedAssignment {
  id: string;
  lessonId: string;
  studentId: string;
  assignedAt: number;
  contentLanguage?: TajweedContentLanguage;
  versionId?: string;
  status: 'pending' | 'submitted' | 'graded';
  submissionId?: string; // Links to the submission
  hiddenFromMainGrading?: boolean; // Hidden in teacher main grading list only
  deadline?: number;
}

export interface QuestionAnswer {
  questionId: string;
  answerText?: string;
  selectedOptionIndex?: number;
  audioLocalPath?: string; // After syncing to PC, it gets saved here
  audioBase64?: string; // Temporarily used for transit
  grade?: number;
  teacherNote?: string;
  isCorrect?: boolean;
}

export interface TajweedSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  submittedAt: number;
  answers: QuestionAnswer[];
  totalGrade?: number;
  overallNote?: string;
}
