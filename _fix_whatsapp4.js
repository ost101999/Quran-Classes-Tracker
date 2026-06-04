const fs = require('fs');
const filePath = 'App.tsx';
const lines = fs.readFileSync(filePath, 'utf8').split('\n');
let fixes = 0;

// Fix Noor English .then() reportKey (line ~10916)
for (let i = 10910; i < 10925; i++) {
    if (lines[i] && lines[i].includes('reportKey') && lines[i].includes('smartReportModal.studentId')) {
        lines[i] = lines[i]
            .replace(/smartReportModal\.studentId/g, '_noorEngStudentId')
            .replace(/smartReportModal\.dayNum/g, '_noorEngDayNum');
        fixes++;
        console.log(`Fixed Noor English reportKey at line ${i + 1}: ${lines[i].trim().substring(0, 80)}`);
        break;
    }
}

// Fix English Quran .then() reportKey (line ~11919)
for (let i = 11915; i < 11925; i++) {
    if (lines[i] && lines[i].includes('reportKey') && lines[i].includes('smartReportModal.studentId')) {
        lines[i] = lines[i]
            .replace(/smartReportModal\.studentId/g, '_engStudentId')
            .replace(/smartReportModal\.dayNum/g, '_engDayNum');
        fixes++;
        console.log(`Fixed English Quran reportKey at line ${i + 1}: ${lines[i].trim().substring(0, 80)}`);
        break;
    }
}

// Fix English Quran setLastReports key [smartReportModal.studentId] (line ~11924)
for (let i = 11919; i < 11930; i++) {
    if (lines[i] && lines[i].includes('[smartReportModal.studentId]') && lines[i].includes('{')) {
        lines[i] = lines[i].replace('[smartReportModal.studentId]', '[_engStudentId]');
        fixes++;
        console.log(`Fixed English Quran setLastReports key at line ${i + 1}`);
        break;
    }
}

// Fix English Quran setLastReports prev spread (line ~11925)
for (let i = 11919; i < 11930; i++) {
    if (lines[i] && lines[i].includes('...prev[smartReportModal.studentId]')) {
        lines[i] = lines[i].replace('...prev[smartReportModal.studentId]', '...prev[_engStudentId]');
        fixes++;
        console.log(`Fixed English Quran prev spread at line ${i + 1}`);
        break;
    }
}

// Fix English clipboard copy setLastReports - prev spread uses smartReportModal.studentId (line ~12041)
for (let i = 12035; i < 12050; i++) {
    if (lines[i] && lines[i].includes('...prev[smartReportModal.studentId]')) {
        lines[i] = lines[i].replace('...prev[smartReportModal.studentId]', '...prev[_engStudentId]');
        fixes++;
        console.log(`Fixed English clipboard prev spread at line ${i + 1}`);
        break;
    }
}

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log(`\nFixes applied: ${fixes}`);
