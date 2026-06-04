const fs = require('fs');
const filePath = 'App.tsx';
const lines = fs.readFileSync(filePath, 'utf8').split('\n');
let fixes = 0;

// Fix the self-referencing variable on line 9971 (0-indexed: 9970)
// "const _studentIdNoor1 = _studentIdNoor1;" -> "const _studentIdNoor1 = smartReportModal.studentId;"
// But smartReportModal is still valid here (before setSmartReportModal(null))
// So we need to capture it BEFORE the setLastReports call
// Actually the structure is:
// 1. setLastReports(...smartReportModal.studentId...) <- uses it fine
// 2. const _studentIdNoor1 = _studentIdNoor1;  <- BUG: self-reference
// 3. const _dayNumNoor1 = smartReportModal.dayNum;
// 4. setSmartReportModal(null);
// The setLastReports call ALSO uses smartReportModal.studentId - that's fine (it's still set)
// We just need to fix the self-reference: 
for (let i = 9960; i < 9985; i++) {
    if (lines[i] && lines[i].includes('const _studentIdNoor1 = _studentIdNoor1')) {
        lines[i] = lines[i].replace('const _studentIdNoor1 = _studentIdNoor1', 'const _studentIdNoor1 = smartReportModal.studentId');
        fixes++;
        console.log(`Fixed self-reference at line ${i + 1}: ${lines[i].trim()}`);
        break;
    }
}

// Also fix the setLastReports key for Noor1 area - it uses smartReportModal.studentId 
// which is fine since it's called before setSmartReportModal(null)
// No need to change those references in setLastReports

// Verify: also check that [setSmartReportModal.studentId] in .then() of noor English is not referencing smartReportModal
for (let i = 10940; i < 10980; i++) {
    if (lines[i] && lines[i].includes('smartReportModal.studentId') && !lines[i].includes('//')) {
        lines[i] = lines[i]
            .replace(/smartReportModal\.studentId/g, '_noorEngStudentId')
            .replace(/smartReportModal\.dayNum/g, '_noorEngDayNum');
        fixes++;
        console.log(`Fixed Noor English ref at line ${i + 1}: ${lines[i].trim().substring(0, 80)}`);
    }
}

// Check English Quran .then() for any remaining smartReportModal refs
for (let i = 12000; i < 12040; i++) {
    if (lines[i] && lines[i].includes('smartReportModal.studentId') && !lines[i].includes('//')) {
        lines[i] = lines[i]
            .replace(/smartReportModal\.studentId/g, '_engStudentId')
            .replace(/smartReportModal\.dayNum/g, '_engDayNum');
        fixes++;
        console.log(`Fixed English Quran ref at line ${i + 1}: ${lines[i].trim().substring(0, 80)}`);
    }
}

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log(`\nFixes applied: ${fixes}`);
