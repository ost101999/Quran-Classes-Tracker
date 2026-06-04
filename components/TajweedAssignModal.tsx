import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { TajweedLesson, TajweedAssignment, Student } from '../types';

interface TajweedAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  bank: Record<string, TajweedLesson>;
  onAssign: (assignment: TajweedAssignment) => void;
}

export default function TajweedAssignModal({ isOpen, onClose, student, bank, onAssign }: TajweedAssignModalProps) {
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [deadline, setDeadline] = useState('');

  if (!isOpen) return null;

  const studentTargetAge = student.targetAge;
  const lessons = Object.values(bank).filter((lesson) => {
    if (!studentTargetAge) return true;
    return lesson.targetAge === 'all' || lesson.targetAge === studentTargetAge;
  });

  const handleAssign = () => {
    if (!selectedLessonId) return;
    
    // Assignment ID: studentId_lessonId_timestamp
    const assignmentId = `${student.id}_${selectedLessonId}_${Date.now()}`;
    
    const newAssignment: TajweedAssignment = {
      id: assignmentId,
      studentId: student.id,
      lessonId: selectedLessonId,
      assignedAt: Date.now(),
      status: 'pending',
      deadline: deadline ? new Date(deadline).getTime() : undefined
    };

    onAssign(newAssignment);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md flex flex-col shadow-2xl relative overflow-hidden" dir="rtl">
        {/* Header */}
        <div className="bg-emerald-700 text-white p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold font-arabic">إسناد واجب تجويد</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6 bg-gray-50/50">
          <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl border border-emerald-100 font-arabic text-center relative overflow-hidden">
             <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-200/50 rounded-full -translate-y-1/2 translate-x-1/2 blur-lg"></div>
             الطالب: <span className="font-bold text-lg">{student.name}</span>
             {studentTargetAge && (
              <div className="text-sm mt-1 text-emerald-700/90">الفئة: {studentTargetAge === 'kids' ? 'صغار' : 'كبار'}</div>
             )}
          </div>

          <div className="space-y-2">
            <label className="block font-bold text-gray-700 font-arabic">اختر الدرس / الاختبار</label>
            {lessons.length === 0 ? (
                <div className="text-sm text-red-500 font-arabic p-3 bg-red-50 rounded-lg border border-red-100">
                لا يوجد دروس متاحة لهذه الفئة حالياً. أضف درساً مناسباً أو غيّر فئة الطالب.
                </div>
            ) : (
                <select 
                value={selectedLessonId}
                onChange={(e) => setSelectedLessonId(e.target.value)}
                className="w-full p-4 border border-gray-300 rounded-xl font-arabic outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500 appearance-none bg-white cursor-pointer"
                >
                <option value="" disabled>-- اختر الدرس --</option>
                {lessons.map(l => (
                    <option key={l.id} value={l.id}>{l.title} ({l.questions.length} أسئلة)</option>
                ))}
                </select>
            )}
          </div>

          <div className="space-y-2">
            <label className="block font-bold text-gray-700 font-arabic">موعد التسليم (اختياري)</label>
            <input 
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full p-4 border border-gray-300 rounded-xl font-arabic outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500 bg-white cursor-pointer"
            />
          </div>

          <div className="pt-4">
            <button 
                onClick={handleAssign}
                disabled={!selectedLessonId}
                className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold font-arabic text-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
            >
                <Check size={24} />
                إسناد الواجب
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
