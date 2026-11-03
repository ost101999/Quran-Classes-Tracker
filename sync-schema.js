const MAP_FIELDS = new Set([
    'attendance', 'academyRates', 'monthlyObligations', 'paymentStatus',
    'studentProgress', 'lastReports', 'studentNotesHistory', 'savedReports',
    'savedReportDrafts', 'subscriptionSettings', 'tajweedBank',
    'tajweedAssignments', 'tajweedSubmissions', 'tajweedLessonEditorUiState',
]);
const CORE_FIELDS = [
    'students', 'attendance', 'month', 'year', 'dayOff', 'academyOrder', 'academyRates',
    'monthlyObligations', 'paymentStatus', 'autoBackupConfig', 'externalLinks', 'dayTransitionTime',
    'makeupLinks', 'showMakeupLines', 'confirmNonTodayAttendance', 'whatsappTarget', 'whatsappMode',
    'studentProgress', 'preferredModes', 'defaultNoorBook', 'subscriptionSettings',
    'seenUngradedTajweedVersion', 'seenUngradedTajweedAssignmentIds', 'studentNotesHistory',
    'lastReports', 'tajweedBank', 'savedReports', 'savedReportDrafts', 'tajweedLessonEditorUiState',
    'tajweedAssignments', 'tajweedSubmissions',
];
module.exports = { MAP_FIELDS, CORE_FIELDS };
