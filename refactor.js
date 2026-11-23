const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(filePath, 'utf8');

const oldStudentResolution = \`      const { students, attendance, month, year, savedReports } = activeData;
      const toSlug = (name) => {
        const arabicToLatin = {
          'ا': 'a', 'أ': 'a', 'إ': 'e', 'آ': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th',
          'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z',
          'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a',
          'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
          'ه': 'h', 'ة': 'a', 'و': 'w', 'ي': 'y', 'ى': 'a', 'ئ': 'e', 'ؤ': 'o'
        };
        let transliterated = name.toLowerCase().trim();
        for (const [ar, en] of Object.entries(arabicToLatin)) {
          transliterated = transliterated.replace(new RegExp(ar, 'g'), en);
        }
        return transliterated.replace(/\\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      };
      const student = isTourMode
        ? students[0]
        : (nameSlug
          ? students.find(s => toSlug(s.name) === nameSlug)
          : students.find(s => String(s.id) === String(studentId)));\`;

content = content.replace(oldStudentResolution, '');
content = content.replace('const { students, attendance, month, year, savedReports } = activeData;', '');

const newStudentResolution = \`      const activeData = isTourMode ? mockData : data;

      const { students, attendance, month, year, savedReports } = activeData || {};
      const toSlug = (name) => {
        const arabicToLatin = {
          'ا': 'a', 'أ': 'a', 'إ': 'e', 'آ': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th',
          'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z',
          'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a',
          'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
          'ه': 'h', 'ة': 'a', 'و': 'w', 'ي': 'y', 'ى': 'a', 'ئ': 'e', 'ؤ': 'o'
        };
        let transliterated = name.toLowerCase().trim();
        for (const [ar, en] of Object.entries(arabicToLatin)) {
          transliterated = transliterated.replace(new RegExp(ar, 'g'), en);
        }
        return transliterated.replace(/\\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      };

      const student = activeData ? (isTourMode
        ? students[0]
        : (nameSlug
          ? students.find(s => toSlug(s.name) === nameSlug)
          : students.find(s => String(s.id) === String(studentId)))) : null;

      const isArabic = student ? /[\\u0600-\\u06FF]/.test(student.name) : false;
      const fontClass = isArabic ? "font-amiri" : "font-sans";
      const headerFontClass = isArabic ? "font-amiri" : "font-cinzel";

      const arabicMonthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
      const currentMonthNames = isArabic ? arabicMonthNames : monthNames;
      
      const arabicWeekDays = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
      const currentWeekDays = isArabic ? arabicWeekDays : weekDays;

      const t = isArabic ? {
        studentNotFound: "لم يتم العثور على الطالب",
        noRecord: "لا يوجد سجل لهذا الطالب في النظام.",
        monthlySchedule: "سجل الحضور والغياب",
        classesAttended: "حصص الحضور",
        missedClasses: "حصص الغياب",
        present: "حاضر",
        absent: "غائب",
        compensated: "تعويض",
        scheduled: "مجدولة",
        reportAvailable: "التقرير متاح",
        joinClass: "دخول الحصة",
        scheduleClass: "طلب جدولة",
        dailyReport: "التقرير المفصل",
        completedInClass: "مــا تـم إنجــازه",
        homeworkNextClass: "الـواجب والـقادم",
        feedbackNotes: "ملاحظـــات إضـافيــة",
        otherDetails: "تفاصيل أخرى",
        audio: "الــصوتيــات",
        audioRecording: "تسجيل صوتي",
        noDetails: "لا توجد تفاصيل إضافية.",
        errorTitle: "خطأ",
        errorLoad: "فشل تحميل البيانات. يرجى المحاولة لاحقاً.",
        invalidLink: "رابط غير صالح. يرجى التأكد من الرابط.",
        
        tourProfileTitle: "ملف الطالب",
        tourProfileDesc: "هنا يظهر اسم الطالب وملفه الشخصي.",
        tourMonthTitle: "الشهر الحالي",
        tourMonthDesc: "يعرض الشهر والسنة الحالية المحددة.",
        tourCalendarTitle: "سجل الحضور",
        tourCalendarDesc: "يعرض التقويم سجل الحضور بشكل مرئي. دعنا نشرح الألوان.",
        tourGreenTitle: "حاضر (أخضر)",
        tourGreenDesc: "أخضر = حاضر. مثال على يوم حضر فيه الطالب بنجاح.",
        tourRedTitle: "غائب (أحمر)",
        tourRedDesc: "أحمر = غائب. الطالب تغيب عن هذه الحصة المجدولة.",
        tourYellowTitle: "تم التعويض (أصفر)",
        tourYellowDesc: "أصفر = تم التعويض. غياب بعذر وتم تعويضه لاحقاً.",
        tourViewReportTitle: "عرض التقرير",
        tourViewReportDesc: "اضغط على أيقونة المستند لعرض التقرير المفصل للحصة.",
        tourDetailTitle: "التقرير المفصل",
        tourDetailDesc: "يعرض كل ما تمت مناقشته في الحصة، بما في ذلك الحفظ الجديد، المراجعة، الواجبات، والملاحظات.",
        tourCompletedTitle: "ما تم إنجازه",
        tourCompletedDesc: "تفاصيل الحفظ الجديد والمراجعة خلال الحصة.",
        tourHomeworkTitle: "الواجب والمطلوب",
        tourHomeworkDesc: "الواجبات والمطلوب تحضيره للحصة القادمة.",
        tourFeedbackTitle: "ملاحظات إضافية",
        tourFeedbackDesc: "ملاحظات وتوجيهات هامة من المعلم.",
        tourAudioTitle: "الصوتيات",
        tourAudioDesc: "روابط للتسجيلات الصوتية من المعلم للمساعدة في التدريب.",
        tourStatsTitle: "الإحصائيات",
        tourStatsDesc: "ملخص لإجمالي حصص الحضور والغياب خلال الشهر.",
        tourActionsTitle: "إجراءات سريعة",
        tourActionsDesc: "استخدم هذه الأزرار لدخول حصة زوم أو جدولة حصة جديدة."
      } : {
        studentNotFound: "Student Not Found",
        noRecord: "There is no record for this student in the system.",
        monthlySchedule: "Monthly Schedule",
        classesAttended: "Classes Attended",
        missedClasses: "Missed Classes",
        present: "Present",
        absent: "Absent",
        compensated: "Compensated",
        scheduled: "Scheduled",
        reportAvailable: "Report Available",
        joinClass: "Join Class",
        scheduleClass: "Schedule Class",
        dailyReport: "Daily Report",
        completedInClass: "Completed In Class",
        homeworkNextClass: "Homework & Next Class",
        feedbackNotes: "Feedback & Notes",
        otherDetails: "Other Details",
        audio: "Audio",
        audioRecording: "Audio Recording",
        noDetails: "No details provided.",
        errorTitle: "Error",
        errorLoad: "Failed to load data. Please try again later.",
        invalidLink: "Invalid student link. Please check the URL.",
        
        tourProfileTitle: "Student Profile",
        tourProfileDesc: "This is the student name and profile header.",
        tourMonthTitle: "Current Month",
        tourMonthDesc: "Displays the current month and year being viewed.",
        tourCalendarTitle: "Monthly Schedule",
        tourCalendarDesc: "The calendar shows attendance visually. We will break down the colors for you.",
        tourGreenTitle: "Present (Green)",
        tourGreenDesc: "Green = Present. For example, the student successfully attended class on this day.",
        tourRedTitle: "Absent (Red)",
        tourRedDesc: "Red = Absent. The student missed this scheduled class.",
        tourYellowTitle: "Compensated (Yellow)",
        tourYellowDesc: "Yellow = Compensated. This was an excused absence that has been made up for.",
        tourViewReportTitle: "View Report",
        tourViewReportDesc: "Click the document icon",
        tourDetailTitle: "Detailed Report",
        tourDetailDesc: "Displays everything discussed in the session, including new memorization, homework, notes, and audio attachments.",
        tourCompletedTitle: "Completed In Class",
        tourCompletedDesc: "Details about the Quran revision and new memorization.",
        tourHomeworkTitle: "Homework & Next Class",
        tourHomeworkDesc: "Your assignments and what to prepare for the upcoming class.",
        tourFeedbackTitle: "Feedback & Notes",
        tourFeedbackDesc: "Important observations and tips from your teacher.",
        tourAudioTitle: "Audio Corrections",
        tourAudioDesc: "Links to voice recordings from your teacher to help you practice.",
        tourStatsTitle: "Statistics",
        tourStatsDesc: "Summary of total attended and missed classes for the month.",
        tourActionsTitle: "Quick Actions",
        tourActionsDesc: "Use these buttons to join a Zoom class or schedule a new session."
      };
\`;

content = content.replace('      const activeData = isTourMode ? mockData : data;', newStudentResolution);

// Replace tour steps text
content = content.replace(/title: 'Student Profile'/g, "title: t.tourProfileTitle");
content = content.replace(/description: 'This is the student name and profile header\\.'/g, "description: t.tourProfileDesc");

content = content.replace(/title: 'Current Month'/g, "title: t.tourMonthTitle");
content = content.replace(/description: 'Displays the current month and year being viewed\\.'/g, "description: t.tourMonthDesc");

content = content.replace(/title: 'Monthly Schedule'/g, "title: t.tourCalendarTitle");
content = content.replace(/description: 'The calendar shows attendance visually\\. We will break down the colors for you\\.'/g, "description: t.tourCalendarDesc");

content = content.replace(/title: 'Present \\(Green\\)'/g, "title: t.tourGreenTitle");
content = content.replace(/description: 'Green = Present\\. For example, the student successfully attended class on this day\\.'/g, "description: t.tourGreenDesc");

content = content.replace(/title: 'Absent \\(Red\\)'/g, "title: t.tourRedTitle");
content = content.replace(/description: 'Red = Absent\\. The student missed this scheduled class\\.'/g, "description: t.tourRedDesc");

content = content.replace(/title: 'Compensated \\(Yellow\\)'/g, "title: t.tourYellowTitle");
content = content.replace(/description: 'Yellow = Compensated\\. This was an excused absence that has been made up for\\.'/g, "description: t.tourYellowDesc");

content = content.replace(/title: 'View Report'/g, "title: t.tourViewReportTitle");
content = content.replace(/description: 'Click the document icon'/g, "description: t.tourViewReportDesc");

content = content.replace(/title: 'Detailed Report'/g, "title: t.tourDetailTitle");
content = content.replace(/description: 'Displays everything discussed in the session, including new memorization, homework, notes, and audio attachments\\.'/g, "description: t.tourDetailDesc");

content = content.replace(/title: 'Completed In Class'/g, "title: t.tourCompletedTitle");
content = content.replace(/description: 'Details about the Quran revision and new memorization\\.'/g, "description: t.tourCompletedDesc");

content = content.replace(/title: 'Homework & Next Class'/g, "title: t.tourHomeworkTitle");
content = content.replace(/description: 'Your assignments and what to prepare for the upcoming class\\.'/g, "description: t.tourHomeworkDesc");

content = content.replace(/title: 'Feedback & Notes'/g, "title: t.tourFeedbackTitle");
content = content.replace(/description: 'Important observations and tips from your teacher\\.'/g, "description: t.tourFeedbackDesc");

content = content.replace(/title: 'Audio Corrections'/g, "title: t.tourAudioTitle");
content = content.replace(/description: 'Links to voice recordings from your teacher to help you practice\\.'/g, "description: t.tourAudioDesc");

content = content.replace(/title: 'Statistics'/g, "title: t.tourStatsTitle");
content = content.replace(/description: 'Summary of total attended and missed classes for the month\\.'/g, "description: t.tourStatsDesc");

content = content.replace(/title: 'Quick Actions'/g, "title: t.tourActionsTitle");
content = content.replace(/description: 'Use these buttons to join a Zoom class or schedule a new session\\.'/g, "description: t.tourActionsDesc");

// Ensure correct React JSX formatting
content = content.replace(
  '<div className="max-w-4xl mx-auto p-4 md:p-8 pb-20 relative">',
  '<div className={\`max-w-4xl mx-auto p-4 md:p-8 pb-20 relative \${fontClass}\`} dir={isArabic ? "rtl" : "ltr"}>'
);

content = content.replace(
  /<div className="min-h-screen flex flex-col items-center justify-center p-6 text-center animate-fade">\s*<i data-lucide="alert-circle" className="text-red-400 mb-4 w-16 h-16"><\/i>\s*<h1 className="text-2xl font-cinzel font-bold text-white mb-2">Error<\/h1>\s*<p className="text-slate-400">\{error \|\| 'No data found'\}<\/p>\s*<\/div>/g, 
  \`<div className={\\\`min-h-screen flex flex-col items-center justify-center p-6 text-center animate-fade \${fontClass}\\\`} dir={isArabic ? "rtl" : "ltr"}>
            <i data-lucide="alert-circle" className="text-red-400 mb-4 w-16 h-16"></i>
            <h1 className={\\\`text-2xl font-bold text-white mb-2 \${headerFontClass}\\\`}>{t ? t.errorTitle : 'Error'}</h1>
            <p className="text-slate-400">{error || (t ? t.errorLoad : 'No data found')}</p>
          </div>\`
);

content = content.replace(
  /<div className="min-h-screen flex flex-col items-center justify-center p-6 text-center animate-fade">\s*<i data-lucide="user-x" className="text-islamic-gold mb-4 w-16 h-16"><\/i>\s*<h1 className="text-2xl font-cinzel font-bold text-white mb-2">Student Not Found<\/h1>\s*<p className="text-slate-400">There is no record for this student in the system.<\/p>\s*<FloatingHelpButton \/>\s*<\/div>/g, 
  \`<div className={\\\`min-h-screen flex flex-col items-center justify-center p-6 text-center animate-fade \${fontClass}\\\`} dir={isArabic ? "rtl" : "ltr"}>
            <i data-lucide="user-x" className="text-islamic-gold mb-4 w-16 h-16"></i>
            <h1 className={\\\`text-2xl font-bold text-white mb-2 \${headerFontClass}\\\`}>{t ? t.studentNotFound : 'Student Not Found'}</h1>
            <p className="text-slate-400">{t ? t.noRecord : 'There is no record for this student in the system.'}</p>
            <FloatingHelpButton />
          </div>\`
);

// Month Display
content = content.replace(
  '<h2 className="text-2xl font-cinzel font-bold text-islamic-light flex items-center gap-3">',
  '<h2 className={\`text-2xl font-bold text-islamic-light flex items-center gap-3 \${headerFontClass}\`}>'
);
content = content.replace('{monthNames[month]} {year}', '{currentMonthNames[month]} {year}');

// Monthly Schedule
content = content.replace(
  '<h2 className="text-xl md:text-2xl font-cinzel font-semibold mb-6 text-center text-white flex items-center justify-center gap-3">',
  '<h2 className={\`text-xl md:text-2xl font-semibold mb-6 text-center text-white flex items-center justify-center gap-3 \${headerFontClass}\`}>'
);
content = content.replace('Monthly Schedule', '{t.monthlySchedule}');

// WeekDays map
content = content.replace('weekDays.map(day =>', 'currentWeekDays.map(day =>');
content = content.replace(
  '<div key={day} className="text-center font-cinzel font-bold text-slate-400 text-sm py-2">',
  '<div key={day} className={\`text-center font-bold text-slate-400 text-sm py-2 \${headerFontClass}\`}>'
);

// Legend mapping - precise replacing to avoid messing up generic spans
content = content.replace('bg-emerald-400"></div> Present', 'bg-emerald-400"></div> {t.present}');
content = content.replace('bg-red-400"></div> Absent', 'bg-red-400"></div> {t.absent}');
content = content.replace('bg-amber-400"></div> Compensated', 'bg-amber-400"></div> {t.compensated}');
content = content.replace('border-islamic-gold/50"></div> Scheduled', 'border-islamic-gold/50"></div> {t.scheduled}');
content = content.replace('h-2.5"></i></div> Report Available', 'h-2.5"></i></div> {t.reportAvailable}');

// Classes Attended & Missed Classes stats
content = content.replace('>Classes Attended</p>', '>{t.classesAttended}</p>');
content = content.replace('>Missed Classes</p>', '>{t.missedClasses}</p>');

// Join Class / Schedule Class links
content = content.replace('>Join Class</span>', '>{t.joinClass}</span>');
content = content.replace('>Schedule Class</span>', '>{t.scheduleClass}</span>');

// Internal Modal Logic
content = content.replace('className="absolute top-3 right-3 text-slate-400', 'className={\`absolute top-3 \${isArabic ? "left-3" : "right-3"} text-slate-400');
content = content.replace(
  '<h3 className="text-base md:text-2xl font-cinzel font-bold text-islamic-light border-b border-islamic-gold/20 pb-2 md:pb-4">',
  '<h3 className={\`text-base md:text-2xl font-bold text-islamic-light border-b border-islamic-gold/20 pb-2 md:pb-4 \${headerFontClass}\`}>'
);
content = content.replace('Daily Report', '{t.dailyReport}');
content = content.replace('{monthNames[month]} {selectedReport.day}, {year}', '{currentMonthNames[month]} {selectedReport.day}, {year}');

// renderSectionGroup
const renderSectionGroupReplacement = \`const renderSectionGroup = (sections, typeLabelClass, sideBorderClass, typeName, tourId) => {
        if (sections.length === 0) return null;
        return (
          <div id={tourId} className="mb-6">
            <h5 className={\\\`text-[10px] uppercase font-bold tracking-widest mb-3 flex items-center gap-2 \${typeLabelClass}\\\`}>
              <div className="h-px flex-1 bg-current opacity-20"></div>
              {typeName}
              <div className="h-px flex-1 bg-current opacity-20"></div>
            </h5>
            <div className={\\\`\${isArabic ? 'pr-4 border-r-[3px]' : 'pl-4 border-l-[3px]'} space-y-3 \${sideBorderClass}\\\`}>\`;

content = content.replace(/const renderSectionGroup[\s\S]*?<div className={`pl - 4 border - l -\[3px\] space - y - 3 \${ sideBorderClass } `}>\n/, renderSectionGroupReplacement);

// Modal calls to renderSectionGroup
content = content.replace('"Completed In Class"', 't.completedInClass');
content = content.replace('"Homework & Next Class"', 't.homeworkNextClass');
content = content.replace('"Feedback & Notes"', 't.feedbackNotes');
content = content.replace('"Other Details"', 't.otherDetails');

// Audio text
content = content.replace(
  '<div className="h-px flex-1 bg-current opacity-20"></div>\\s*Audio\\s*<div className="h-px flex-1 bg-current opacity-20"></div>',
  '<div className="h-px flex-1 bg-current opacity-20"></div>\\n                              {t.audio}\\n                              <div className="h-px flex-1 bg-current opacity-20"></div>'
);

content = content.replace(/'Audio Recording'/g, "t.audioRecording");

content = content.replace("{section.content || <span className=\\\"opacity-40 italic\\\">No details provided.</span>}", "{section.content || <span className=\\\"opacity-40 italic\\\">{t.noDetails}</span>}");

// Student Header
content = content.replace(
  '<h1 className="text-4xl md:text-5xl font-cinzel font-bold text-white">',
  '<h1 className={\`text-4xl md:text-5xl font-bold text-white \${headerFontClass}\`}>'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Refactor script executed completely.');
