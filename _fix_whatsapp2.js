const fs = require('fs');
const filePath = 'App.tsx';
const lines = fs.readFileSync(filePath, 'utf8').split('\n');
let fixes = 0;

// Fix: All smartReportModal references inside .then() callbacks
// These are NOW null since we call setSmartReportModal(null) before the async call

// AREA 1: Arabic Quran .then() - fix reportKey + setLastReports key
// Find "reportKey = `${smartReportModal.studentId}_${smartReportModal.dayNum}" 
// that comes after the Arabic send command (_arStudentId should be defined above)
for (let i = 10585; i < 10610; i++) {
    if (lines[i] && lines[i].includes('reportKey') && lines[i].includes('smartReportModal.studentId')) {
        const before = lines.slice(Math.max(0, i - 5), i).join('\n');
        // Check it's in the Arabic area (near _arStudentId)
        if (before.includes('_arStudentId') || before.includes('_arDayNum')) {
            // Already references Arabic vars nearby
        }
        // Replace in this line
        lines[i] = lines[i]
            .replace('smartReportModal.studentId', '_arStudentId')
            .replace('smartReportModal.dayNum', '_arDayNum');
        fixes++;
        console.log(`Fixed reportKey at line ${i + 1}: ${lines[i].trim().substring(0, 80)}`);
        break;
    }
}

// Fix [smartReportModal.studentId] key in setLastReports for Arabic Quran
for (let i = 10590; i < 10615; i++) {
    if (lines[i] && lines[i].trim() === '[smartReportModal.studentId]: {') {
        lines[i] = lines[i].replace('[smartReportModal.studentId]', '[_arStudentId]');
        fixes++;
        console.log(`Fixed setLastReports key at line ${i + 1}`);
        break;
    }
}

// Fix ...prev[smartReportModal.studentId] inside setLastReports for Arabic Quran
for (let i = 10590; i < 10615; i++) {
    if (lines[i] && lines[i].includes('...prev[smartReportModal.studentId]')) {
        // Check context - we want the one after _arStudentId
        lines[i] = lines[i].replace('...prev[smartReportModal.studentId]', '...prev[_arStudentId]');
        fixes++;
        console.log(`Fixed prev spread key at line ${i + 1}`);
        break;
    }
}

// AREA 2: Also fix the "// Save report for later viewing" comment that might be present  
for (let i = 10585; i < 10600; i++) {
    if (lines[i] && lines[i].includes('// Save report for later viewing')) {
        lines.splice(i, 1); // Remove the comment
        console.log(`Removed "Save report" comment at line ${i + 1}`);
        break;
    }
}

// AREA 3: English Quran .then() - fix reportKey + setLastReports + checkAndOpenLink
// Find English reportKey
for (let i = 11980; i < 12020; i++) {
    if (lines[i] && lines[i].includes('reportKey') && lines[i].includes('smartReportModal.studentId')) {
        lines[i] = lines[i]
            .replace('smartReportModal.studentId', '_engStudentId')
            .replace('smartReportModal.dayNum', '_engDayNum');
        fixes++;
        console.log(`Fixed English reportKey at line ${i + 1}`);
    }
    if (lines[i] && lines[i].trim() === '[smartReportModal.studentId]: {') {
        lines[i] = lines[i].replace('[smartReportModal.studentId]', '[_engStudentId]');
        fixes++;
        console.log(`Fixed English setLastReports key at line ${i + 1}`);
    }
}

// Fix English checkAndOpenLink ref
for (let i = 12000; i < 12040; i++) {
    if (lines[i] && lines[i].includes('checkAndOpenLink(smartReportModal.studentId)')) {
        lines[i] = lines[i].replace('checkAndOpenLink(smartReportModal.studentId)', 'checkAndOpenLink(_engStudentId)');
        fixes++;
        console.log(`Fixed English checkAndOpenLink at line ${i + 1}`);
    }
}

// AREA 4: Noor English .then() - fix any smartReportModal refs
for (let i = 10930; i < 10970; i++) {
    if (lines[i] && lines[i].includes('reportKey') && lines[i].includes('smartReportModal')) {
        lines[i] = lines[i]
            .replace('smartReportModal.studentId', '_noorEngStudentId')
            .replace('smartReportModal.dayNum', '_noorEngDayNum');
        fixes++;
        console.log(`Fixed Noor English reportKey at line ${i + 1}`);
    }
    if (lines[i] && lines[i].includes('checkAndOpenLink(smartReportModal.studentId)')) {
        lines[i] = lines[i].replace('checkAndOpenLink(smartReportModal.studentId)', 'checkAndOpenLink(_noorEngStudentId)');
        fixes++;
        console.log(`Fixed Noor English checkAndOpenLink at line ${i + 1}`);
    }
}

// AREA 5: Noor Arabic 1st location - fix any remaining smartReportModal refs after it was set to null
for (let i = 9970; i < 10005; i++) {
    if (lines[i] && lines[i].includes('smartReportModal.studentId') && !lines[i].includes('//')) {
        lines[i] = lines[i]
            .replace('smartReportModal.studentId', '_studentIdNoor1')
            .replace('smartReportModal.dayNum', '_dayNumNoor1');
        fixes++;
        console.log(`Fixed Noor1 Arabic ref at line ${i + 1}: ${lines[i].trim().substring(0, 80)}`);
    }
}

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log(`\nTotal additional fixes: ${fixes}`);
