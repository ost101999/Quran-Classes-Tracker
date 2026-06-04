import React, { useEffect, useState } from 'react';
import { X, Check, Eye, EyeOff } from 'lucide-react';
import { TajweedLesson, TajweedAssignment, TajweedSubmission, Student } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  bank: Record<string, TajweedLesson>;
  assignments: Record<string, TajweedAssignment>;
  submissions: Record<string, TajweedSubmission>;
  students: Student[];
    onSaveGrading: (submission: TajweedSubmission) => void;
    onRemoveFromMainGrading?: (assignmentId: string) => void;
    focusStudentId?: string | null;
    onViewStudentPage?: (studentId: string) => void;
}

export default function TajweedGradingModal({ isOpen, onClose, bank, assignments, submissions, students, onSaveGrading, onRemoveFromMainGrading, focusStudentId = null, onViewStudentPage }: Props) {
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  
  // Temporary state for the grading being edited
  const [editingSubmission, setEditingSubmission] = useState<TajweedSubmission | null>(null);

    const toArabicDigits = (value: number | string | undefined | null) => {
        if (value === null || value === undefined) return '';
        return String(value).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)] || d);
    };

    const formatArabicDate = (timestamp?: number) => {
        if (!timestamp) return { date: '-', time: '' };
        const date = new Date(timestamp);
        const day = toArabicDigits(date.getDate());
        const month = toArabicDigits(date.getMonth() + 1);
        const year = toArabicDigits(date.getFullYear());
        
        const hours = date.getHours();
        const minutes = toArabicDigits(date.getMinutes().toString().padStart(2, '0'));
        const ampm = hours >= 12 ? 'م' : 'ص';
        const displayHours = toArabicDigits(hours % 12 || 12);
        
        // We return components separately for precise UI placement
        return {
            date: `\u200f${day} / ${month} / ${year}`,
            time: `\u200f${displayHours}:${minutes} ${ampm}`
        };
    };

  const submissionByAssignmentId = Object.values(submissions).reduce<Record<string, TajweedSubmission>>((acc, submission) => {
      if (!submission?.assignmentId) return acc;
      if (!acc[submission.assignmentId]) {
          acc[submission.assignmentId] = submission;
      }
      return acc;
  }, {});

  const getAssignmentDisplayStatus = (assignment: TajweedAssignment): 'pending' | 'submitted' | 'graded' => {
      if (assignment.status === 'graded') return 'graded';
      if (assignment.status === 'submitted') return 'submitted';
      return submissionByAssignmentId[assignment.id] ? 'submitted' : 'pending';
  };

  const candidateAssignments = Object.values(assignments).filter((assignment) => {
      if (!focusStudentId && assignment.hiddenFromMainGrading) return false;
      if (!focusStudentId) return true;
      return assignment.studentId === focusStudentId;
  });

  const submittedAssignments = candidateAssignments
      .filter((assignment) => {
          const status = getAssignmentDisplayStatus(assignment);
          return status === 'submitted' || status === 'graded';
      })
      .sort((a, b) => {
          const aStatus = getAssignmentDisplayStatus(a);
          const bStatus = getAssignmentDisplayStatus(b);

          if (aStatus === 'submitted' && bStatus === 'graded') return -1;
          if (aStatus === 'graded' && bStatus === 'submitted') return 1;

          const aSubmission = submissionByAssignmentId[a.id];
          const bSubmission = submissionByAssignmentId[b.id];
          const aDate = aSubmission?.submittedAt || a.assignedAt || 0;
          const bDate = bSubmission?.submittedAt || b.assignedAt || 0;
          return bDate - aDate;
      });

  const getStudentName = (id: string) => students.find(s => s.id === id)?.name || 'طالب محذوف';
  const getLessonTitle = (id: string, language?: 'ar' | 'en') => {
      const lesson = bank[id];
      if (!lesson) return 'درس محذوف';
      if (language === 'en') {
          const version = getAssignmentExamVersion(currentAssignment, lesson, language);
          if (version?.lessonTitle) return version.lessonTitle;
      }
      return lesson.title || 'بدون عنوان';
  };

    const getPreferredQuestionLanguage = (studentId: string, assignment?: TajweedAssignment | null): 'ar' | 'en' => {
        if (assignment?.contentLanguage) return assignment.contentLanguage;
        const name = getStudentName(studentId);
        return /[\u0600-\u06FF]/.test(name) ? 'ar' : 'en';
    };

    // Mirrors the student app's getLessonExamVersions
    const getLessonExamVersions = (lesson: TajweedLesson | null) => {
        if (!lesson) return [];
        const versions = Array.isArray(lesson.examVersions) ? lesson.examVersions : [];
        if (versions.length > 0) return versions;
        // Synthetic legacy version using the lesson's own questions
        return [{
            id: `${lesson.id}-legacy-v1`,
            language: (lesson.language === 'en' ? 'en' : 'ar') as 'ar' | 'en',
            questions: lesson.questions || [],
        }];
    };

    // Mirrors the student app's getAssignmentExamVersion
    const getAssignmentExamVersion = (assignment: TajweedAssignment | null, lesson: TajweedLesson | null, fallbackLanguage: 'ar' | 'en') => {
        const versions = getLessonExamVersions(lesson);
        if (versions.length === 0) return null;

        // 1. Match by explicit versionId
        const versionId = String(assignment?.versionId || '').trim();
        if (versionId) {
            const byId = versions.find(v => String(v.id || '').trim() === versionId);
            if (byId) return byId;
        }

        // 2. Match by contentLanguage
        const lang = assignment?.contentLanguage;
        if (lang) {
            const byLang = versions.find(v => v.language === lang);
            if (byLang) return byLang;
        }

        // 3. Match by fallback (student name heuristic)
        const byFallback = versions.find(v => v.language === fallbackLanguage);
        if (byFallback) return byFallback;

        return versions[0];
    };

    const getLocalizedQuestionText = (question: any, language: 'ar' | 'en') => {
        if (language === 'en') {
            return question.textEn || question.text || question.textAr || '';
        }
        return question.textAr || question.text || question.textEn || '';
    };

    const getLocalizedQuestionOptions = (question: any, language: 'ar' | 'en') => {
        if (language === 'en') {
            return question.optionsEn || question.options || question.optionsAr || [];
        }
        return question.optionsAr || question.options || question.optionsEn || [];
    };

    const getQuestionPoints = (question: any) => {
        const parsed = Number(question?.points);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    };

    const applySimpleCorrectness = (submission: TajweedSubmission, question: any, isCorrect: boolean | undefined) => {
        const nextAnswers = Array.isArray(submission.answers) ? [...submission.answers] : [];
        const answerIndex = nextAnswers.findIndex((a) => a.questionId === question.id);
        const previousAnswer = answerIndex >= 0
            ? nextAnswers[answerIndex]
            : ({ questionId: question.id } as TajweedSubmission['answers'][number]);

        const nextAnswer = {
            ...previousAnswer,
            questionId: question.id,
            isCorrect,
            grade: isCorrect === true ? getQuestionPoints(question) : 0,
        };

        if (answerIndex >= 0) {
            nextAnswers[answerIndex] = nextAnswer;
        } else {
            nextAnswers.push(nextAnswer);
        }

        return {
            ...submission,
            answers: nextAnswers,
        } as TajweedSubmission;
    };

    const buildGradedSubmission = (baseSubmission?: TajweedSubmission | null) => {
        const sourceSubmission = baseSubmission || editingSubmission;
        if (!sourceSubmission) return null;

        const existingByQuestionId = new Map((sourceSubmission.answers || []).map((answer) => [answer.questionId, answer]));
        let totalGrade = 0;

        const gradedAnswers = displayQuestions.map((question: any, index: number) => {
            const existingAnswer = existingByQuestionId.get(question.id)
                || sourceSubmission.answers[index]
                || ({ questionId: question.id } as TajweedSubmission['answers'][number]);

            const maxPoints = getQuestionPoints(question);

            if (question.type === 'multiple_choice') {
                const isCorrect = typeof existingAnswer.selectedOptionIndex === 'number'
                    && existingAnswer.selectedOptionIndex === question.correctOptionIndex;
                const grade = isCorrect ? maxPoints : 0;
                totalGrade += grade;
                return {
                    ...existingAnswer,
                    questionId: question.id,
                    isCorrect,
                    grade,
                };
            }

            if (question.type === 'text' || question.type === 'audio') {
                const hasSimpleDecision = typeof existingAnswer.isCorrect === 'boolean';
                const grade = hasSimpleDecision
                    ? (existingAnswer.isCorrect ? maxPoints : 0)
                    : (typeof existingAnswer.grade === 'number' ? existingAnswer.grade : 0);
                totalGrade += grade;
                return {
                    ...existingAnswer,
                    questionId: question.id,
                    grade,
                };
            }

            const grade = typeof existingAnswer.grade === 'number' ? existingAnswer.grade : 0;
            totalGrade += grade;
            return {
                ...existingAnswer,
                questionId: question.id,
                grade,
            };
        });

        const displayedQuestionIds = new Set(displayQuestions.map((question: any) => question.id));
        const remainingAnswers = (sourceSubmission.answers || []).filter((answer) => !displayedQuestionIds.has(answer.questionId));

        return {
            ...sourceSubmission,
            answers: [...gradedAnswers, ...remainingAnswers],
            totalGrade,
        } as TajweedSubmission;
    };

    const handleSetSimpleCorrectness = (question: any, isCorrect: boolean) => {
        if (!editingSubmission) return;
        if (question.type !== 'text' && question.type !== 'audio') return;

        const answer = editingSubmission.answers.find(a => a.questionId === question.id);
        const currentIsCorrect = answer?.isCorrect;
        const nextIsCorrect = currentIsCorrect === isCorrect ? undefined : isCorrect;

        const updatedSubmission = applySimpleCorrectness(editingSubmission, question, nextIsCorrect);
        const gradedSubmission = buildGradedSubmission(updatedSubmission);
        if (!gradedSubmission) return;

        setEditingSubmission(gradedSubmission);
        onSaveGrading(gradedSubmission);
    };

    const resolveSubmissionForAssignment = (assignment: TajweedAssignment | undefined) => {
        if (!assignment) return null;
        if (assignment.submissionId && submissions[assignment.submissionId]) {
            return submissions[assignment.submissionId];
        }
        if (submissionByAssignmentId[assignment.id]) {
            return submissionByAssignmentId[assignment.id];
        }
        return Object.values(submissions).find((submission) => (
            submission.assignmentId === assignment.id && submission.studentId === assignment.studentId
        )) || null;
    };

  const handleSelectSubmission = (assignmentId: string) => {
    const assignment = assignments[assignmentId];
        const submission = resolveSubmissionForAssignment(assignment);
    if (submission) {
        setEditingSubmission(JSON.parse(JSON.stringify(submission))); // Deep copy
        setSelectedSubmissionId(submission.id);
    }
  };

  const handleRemoveFromMainList = (assignmentId: string, event: React.MouseEvent) => {
      event.stopPropagation();
      onRemoveFromMainGrading?.(assignmentId);

      const remaining = submittedAssignments.filter((item) => item.id !== assignmentId);
      if (currentAssignment?.id === assignmentId) {
          if (remaining.length > 0) {
              handleSelectSubmission(remaining[0].id);
          } else {
              setSelectedSubmissionId(null);
              setEditingSubmission(null);
          }
      }
  };

    const currentAssignment = editingSubmission
        ? Object.values(assignments).find(a => a.submissionId === editingSubmission.id || a.id === editingSubmission.assignmentId)
        : null;
    const currentLesson = currentAssignment ? bank[currentAssignment.lessonId] : null;

    // Resolve the same exam version the student actually saw (mirrors student app)
    const fallbackLang = currentAssignment ? getPreferredQuestionLanguage(currentAssignment.studentId) : 'ar';
    const currentVersion = getAssignmentExamVersion(currentAssignment, currentLesson, fallbackLang);
    // Questions to display — from the version the student answered
    const displayQuestions: any[] = currentVersion?.questions || currentLesson?.questions || [];
    // Language to display the exam in
    const displayLanguage: 'ar' | 'en' = currentAssignment
        ? getPreferredQuestionLanguage(currentAssignment.studentId, currentAssignment)
        : (currentVersion?.language === 'en' ? 'en' : 'ar');

  useEffect(() => {
      if (!isOpen) return;

      if (submittedAssignments.length === 0) {
          setSelectedSubmissionId(null);
          setEditingSubmission(null);
          return;
      }

      const hasCurrentInList = currentAssignment
          ? submittedAssignments.some((assignment) => assignment.id === currentAssignment.id)
          : false;

      if (!hasCurrentInList) {
          handleSelectSubmission(submittedAssignments[0].id);
      }
  }, [isOpen, focusStudentId, submittedAssignments]);

  useEffect(() => {
      if (!isOpen) return;

      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      return () => {
          document.body.style.overflow = previousOverflow;
      };
  }, [isOpen]);

  useEffect(() => {
      if (!isOpen || !selectedSubmissionId) return;
      const selectedSubmission = submissions[selectedSubmissionId];
      if (!selectedSubmission?.studentId) return;
      onViewStudentPage?.(selectedSubmission.studentId);
  }, [isOpen, selectedSubmissionId, submissions, onViewStudentPage]);

  const focusStudentName = focusStudentId ? getStudentName(focusStudentId) : null;

    if (!isOpen) return null;

    const isEn = displayLanguage === 'en';
    return (
        <div
            className={`fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/55 backdrop-blur-md p-4 font-arabic`}
            onClick={onClose}
        >
            <div
                className="bg-white rounded-[36px] shadow-[0_30px_90px_rgba(2,6,23,0.35)] w-full max-w-[1150px] h-[88vh] flex overflow-hidden border border-slate-200/90 overscroll-contain"
                dir="rtl"
                onClick={(event) => event.stopPropagation()}
            >
        
        {/* Sidebar - Submissions List */}
        <div className="w-[24%] min-w-[250px] bg-gradient-to-b from-slate-50 to-white border-l border-slate-200/80 flex flex-col">
            <div className="relative h-[108px] p-6 border-b border-slate-200 bg-gradient-to-l from-white via-amber-50/30 to-white shadow-sm z-10 flex items-center">
                <div className={focusStudentName ? 'w-full text-center' : ''}>
                    <h2 className={`text-[1.7rem] font-bold font-arabic leading-tight ${focusStudentName ? 'text-[#3b1414] text-center' : 'text-slate-800'}`}>
                        {focusStudentName || 'التصحيح المتبقي'}
                    </h2>
                </div>
                <button
                  onClick={onClose}
                  className="absolute left-6 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
                >
                    <X size={24} />
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3">
                {submittedAssignments.length === 0 ? (
                    <div className="text-center text-slate-400 py-10 font-quran text-lg">
                        {focusStudentName ? 'لا يوجد لهذا الطالب واجبات مرسلة للتصحيح حالياً' : 'لا يوجد واجبات للتصحيح حالياً'}
                    </div>
                ) : (
                    submittedAssignments.map(assignment => {
                        const isSelected = currentAssignment?.id === assignment.id;
                        const submissionDate = submissionByAssignmentId[assignment.id]?.submittedAt || assignment.assignedAt;
                        
                        return (
                            <button
                                key={assignment.id}
                                onClick={() => handleSelectSubmission(assignment.id)}
                                className={`relative w-full text-right p-4 rounded-xl border transition-all ${
                                    isSelected
                                      ? 'bg-emerald-50 border-emerald-300 shadow-md shadow-emerald-100/70'
                                      : 'bg-white border-slate-200 shadow-sm hover:border-slate-300'
                                }`}
                            >
                                {!focusStudentName && (
                                    <span
                                        onClick={(event) => handleRemoveFromMainList(assignment.id, event)}
                                        title="إخفاء من الرئيسية"
                                        className="group absolute -top-1.5 -left-1.5 z-10 inline-flex items-center justify-center h-6 w-6 rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-rose-100 hover:text-rose-700 hover:border-rose-200 shadow-sm transition-colors"
                                    >
                                        <Eye size={12} className="group-hover:hidden" />
                                        <EyeOff size={12} className="hidden group-hover:block" />
                                    </span>
                                )}
                                <div className="flex justify-between items-start mb-2 gap-3">
                                    <div className="min-w-0 flex-1">
                                        {!focusStudentName && (() => {
                                            const sName = getStudentName(assignment.studentId);
                                            const isAr = /[\u0600-\u06FF]/.test(sName);
                                            return (
                                                <div className="mb-1">
                                                    <p className={`font-bold font-arabic text-[1.05rem] min-w-0 truncate ${isAr ? 'text-right' : 'text-left'} ${isSelected ? 'text-emerald-700' : 'text-slate-700'}`}>
                                                        {sName}
                                                    </p>
                                                </div>
                                            );
                                        })()}
                                        <div className="mt-1 flex items-center justify-between gap-2">
                                            <p className={`font-medium font-arabic text-[1.15rem] truncate min-w-0 flex-1 ${isSelected ? 'text-emerald-800' : 'text-slate-800'}`}>
                                                {getLessonTitle(assignment.lessonId)}
                                            </p>
                                        </div>
                                        <div className="text-[1rem] font-normal text-slate-500 mt-2 flex justify-between items-center w-full gap-2">
                                            {(() => {
                                                const { date: d, time: t } = formatArabicDate(submissionDate);
                                                return (
                                                    <>
                                                        <span className="font-arabic opacity-80">{d}</span>
                                                        <span className="font-arabic opacity-80">{t}</span>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                    <span
                                      className={`mt-1 h-2.5 w-2.5 rounded-full flex-shrink-0 ${isSelected ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                      aria-hidden="true"
                                    />
                                </div>
                            </button>
                        );
                    })
                )}
            </div>
        </div>

        {/* Main Content - Grading View */}
        <div className="flex-1 flex flex-col bg-white/95">
            {!editingSubmission || !currentLesson ? (
                <div className="flex-1 flex items-center justify-center text-slate-400 font-arabic flex-col gap-4">
                    <Check size={64} className="text-slate-200" />
                    <p className="text-2xl">اختر واجباً من القائمة للبدء في التصحيح</p>
                </div>
            ) : (
                <>
                    <div className="h-[108px] p-6 border-b border-slate-200 bg-gradient-to-l from-white via-amber-50/35 to-white flex items-center" dir={displayLanguage === 'en' ? 'ltr' : 'rtl'}>
                        <div className={`w-full ${displayLanguage === 'en' ? 'text-left' : 'text-right'}`}>
                            <h2 className={`text-[1.8rem] font-bold font-arabic text-slate-800`}>
                                {getLessonTitle(currentAssignment!.lessonId, displayLanguage)}
                            </h2>
                            {!focusStudentName && (() => {
                                const preferredLanguage = getPreferredQuestionLanguage(currentAssignment!.studentId, currentAssignment);
                                const isEn = preferredLanguage === 'en';
                                return (
                                    <p className={`mt-2 text-slate-600 ${isEn ? 'text-[1.4rem] font-grading-mixed' : 'text-2xl font-quran'}`}>
                                        {isEn ? 'Student:' : 'الطالب:'} <span className="font-normal text-slate-800">{getStudentName(currentAssignment!.studentId)}</span>
                                    </p>
                                );
                            })()}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto overscroll-contain p-8 space-y-6 bg-gradient-to-b from-slate-50/80 to-white">
                        {displayQuestions.map((question: any, index: number) => {
                            const answer = editingSubmission.answers.find(a => a.questionId === question.id) || editingSubmission.answers[index];
                            const isEn = displayLanguage === 'en';

                            const localizedQuestionText = getLocalizedQuestionText(question, displayLanguage);
                            const localizedQuestionOptions = getLocalizedQuestionOptions(question, displayLanguage);

                            
                            return (
                                <div key={question.id} className="bg-white/95 p-6 rounded-3xl border border-slate-200 shadow-sm shadow-slate-200/60" dir={isEn ? 'ltr' : 'rtl'}>
                                    <div className="flex gap-4">
                                            <div className={`w-11 h-11 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center font-bold text-2xl flex-shrink-0 ${isEn ? 'font-sans' : 'font-quran'}`}>
                                                {isEn ? (index + 1) : toArabicDigits(index + 1)}
                                            </div>
                                        <div className="flex-1">
                                            <div className="mb-4">
                                                <h3 className={`font-normal leading-relaxed text-slate-800 ${isEn ? 'text-[1.55rem] font-grading-mixed' : 'text-[1.75rem] font-quran'}`}>{localizedQuestionText}</h3>
                                            </div>
                                            
                                            {/* Answer Display */}
                                            <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-200 min-h-[70px]">
                                                {question.type === 'text' && (
                                                    <p className={`text-slate-700 whitespace-pre-wrap leading-relaxed ${isEn ? 'text-[1.4rem] font-grading-mixed' : 'text-2xl font-quran'}`}>
                                                        {answer?.answerText || <span className="text-slate-400 italic font-arabic text-xl">{isEn ? 'Student did not answer this question' : 'لم يُجب الطالب على هذا السؤال'}</span>}
                                                    </p>
                                                )}
                                                
                                                {question.type === 'multiple_choice' && (
                                                    <div className="space-y-2">
                                                        {localizedQuestionOptions?.map((opt, optIdx) => (
                                                                <div key={optIdx} className={`p-3 rounded-lg border ${isEn ? 'text-[1.2rem] font-grading-mixed' : 'text-[1.3rem] font-quran'} ${
                                                                    answer?.selectedOptionIndex === optIdx 
                                                                        ? (optIdx === question.correctOptionIndex 
                                                                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700' 
                                                                            : 'bg-red-50 border-red-300 text-red-700') 
                                                                        : (optIdx === question.correctOptionIndex 
                                                                            ? 'bg-emerald-50/60 border-emerald-200 text-emerald-600 border-dashed' 
                                                                            : 'bg-white border-slate-200 text-slate-600')
                                                                }`}>
                                                                {opt}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {question.type === 'audio' && (
                                                    <div className="flex flex-col gap-3">
                                                        {answer?.audioLocalPath ? (
                                                            <div className="w-full">
                                                                <span className={`text-sm text-slate-500 mb-2 block ${isEn ? 'font-grading-mixed' : 'font-quran'}`}>{isEn ? 'Locally saved file:' : 'الملف المحفوظ محلياً:'}</span>
                                                                <audio
                                                                  controls
                                                                  preload="auto"
                                                                  onClick={(event) => event.stopPropagation()}
                                                                  src={`local-file://${encodeURIComponent(answer.audioLocalPath)}`}
                                                                  className="w-full"
                                                                />
                                                            </div>
                                                        ) : answer?.audioBase64 ? (
                                                            <div className="w-full">
                                                                <audio
                                                                  controls
                                                                  preload="auto"
                                                                  onClick={(event) => event.stopPropagation()}
                                                                  src={answer.audioBase64}
                                                                  className="w-full"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <span className={`text-slate-400 italic ${isEn ? 'font-grading-mixed text-base' : 'font-quran text-xl'}`}>{isEn ? 'No audio file attached' : 'لم يتم إرفاق ملف صوتي'}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {(question.type === 'text' || question.type === 'audio') && (
                                                <div className="bg-transparent pt-0 pb-1 -mt-2">
                                                    <div className="flex flex-wrap justify-center items-center gap-3">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSetSimpleCorrectness(question, true)}
                                                            className={`min-w-[110px] px-5 py-2.5 rounded-xl font-bold transition-colors ${answer?.isCorrect === true
                                                                ? 'bg-emerald-100 text-emerald-800'
                                                                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'}`}
                                                        >
                                                            {isEn ? 'Correct' : 'صح'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSetSimpleCorrectness(question, false)}
                                                            className={`min-w-[110px] px-5 py-2.5 rounded-xl font-bold transition-colors ${answer?.isCorrect === false
                                                                ? 'bg-rose-100 text-rose-800'
                                                                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'}`}
                                                        >
                                                            {isEn ? 'Wrong' : 'غلط'}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                            
                                        </div>
                                    </div>
                                </div>
                            )
                        })}

                    </div>

                </>
            )}
        </div>
      </div>
    </div>
  );
}
