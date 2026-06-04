const fs = require('fs');
const filePath = 'App.tsx';
const lines = fs.readFileSync(filePath, 'utf8').split('\n');
let fixes = 0;

// Helper to check and fix a specific line
function fixLine(lineNum1, searchStr, replaceStr) {
    const i = lineNum1 - 1;
    if (i >= 0 && i < lines.length && lines[i].includes(searchStr)) {
        lines[i] = lines[i].replace(searchStr, replaceStr);
        fixes++;
        return true;
    }
    return false;
}

// Helper to insert lines after lineNum1
function insertAfter(lineNum1, newLinesArr) {
    lines.splice(lineNum1, 0, ...newLinesArr);
    fixes++;
}

// ============================================================
// AREA 1: Arabic Quran WhatsApp (lines ~10585-10692)
// PERSISTENCE FIX found at line 10592
// noorConfigPart at line ~10596
// Goal: add spread + sendViaWhatsapp before readingNew
// ============================================================

// Find the exact line with ...noorConfigPart for the Arabic Quran case
// We know persistence fix is at 10592, and noorConfigPart right after
let arNoorConfigLine = -1;
for (let i = 10591; i < 10602; i++) {
    if (lines[i] && lines[i].includes('...noorConfigPart') && !lines[i - 5 < 0 ? 0 : i - 5].includes('_studentIdNoor1')) {
        arNoorConfigLine = i + 1; // 1-indexed
        break;
    }
}
console.log(`Arabic Quran ...noorConfigPart at line: ${arNoorConfigLine}`);
if (arNoorConfigLine > 0) {
    console.log(`  Line content: ${lines[arNoorConfigLine - 1].substring(0, 100)}`);
    console.log(`  Prev line: ${lines[arNoorConfigLine - 2].substring(0, 100)}`);
}

// Fix: insert "...prev[smartReportModal.studentId]," before "...noorConfigPart,"
// and add "sendViaWhatsapp: true," after noorConfigPart
if (arNoorConfigLine > 0) {
    const indent = lines[arNoorConfigLine - 1].match(/^(\s*)/)[1];
    // Insert spread before noorConfigPart
    insertAfter(arNoorConfigLine - 1, [`${indent}...prev[smartReportModal.studentId],`]);
    fixes++;
    console.log('Inserted prev spread for Arabic Quran');
    // Now noorConfigPart is at arNoorConfigLine (0-indexed shifted by 1)
    // Insert sendViaWhatsapp after it
    const newNoorLine = arNoorConfigLine; // after insert, noorConfigPart is now at this line
    insertAfter(newNoorLine, [`${indent}sendViaWhatsapp: true,`]);
    fixes++;
    console.log('Inserted sendViaWhatsapp for Arabic Quran');
}

// Fix: early close for Arabic Quran - find "showToast('جاري الإرسال عبر واتساب... ⏳');"
// that comes BEFORE the window.electronAPI call for the Arabic quran case
// We search starting from line 10580
let arToastLine = -1;
for (let i = 10578; i < 10600; i++) {
    if (lines[i] && lines[i].includes('\u062c\u0627\u0631\u064a \u0627\u0644\u0625\u0631\u0633\u0627\u0644 \u0639\u0628\u0631 \u0648\u0627\u062a\u0633\u0627\u0628')) {
        arToastLine = i + 1;
        break;
    }
}
console.log(`Arabic Quran showToast line: ${arToastLine}`);
if (arToastLine > 0) {
    console.log(`  Content: ${lines[arToastLine - 1].substring(0, 80)}`);
    // Insert before toast: capture vars + setSmartReportModal(null)
    const indent = lines[arToastLine - 1].match(/^(\s*)/)[1];
    insertAfter(arToastLine - 1, [
        `${indent}const _arStudentId = smartReportModal.studentId;`,
        `${indent}const _arDayNum = smartReportModal.dayNum;`,
        `${indent}setSmartReportModal(null);`
    ]);
    console.log('Inserted early close for Arabic Quran');
}

// Fix: checkAndOpenLink(smartReportModal.studentId) -> checkAndOpenLink(_arStudentId) in Arabic Quran .then()
// and remove setSmartReportModal(null) from .then success
// Find the success block - after setSavedReports and before "} else {" in arabic quran area
for (let i = 10670; i < 10710; i++) {
    if (lines[i] && lines[i].includes('checkAndOpenLink(smartReportModal.studentId)')) {
        lines[i] = lines[i].replace('checkAndOpenLink(smartReportModal.studentId)', 'checkAndOpenLink(_arStudentId)');
        fixes++;
        console.log(`Fixed checkAndOpenLink ref at line ${i + 1}`);
        break;
    }
}

// Remove setSmartReportModal(null) from Arabic Quran .then() success if present
for (let i = 10670; i < 10710; i++) {
    if (lines[i] && lines[i].includes('setSmartReportModal(null)') && !lines[i].includes('//') && i > arToastLine) {
        lines.splice(i, 1);
        fixes++;
        console.log(`Removed setSmartReportModal(null) from .then() at (was) line ${i + 1}`);
        break;
    }
}

// ============================================================
// AREA 2: English Quran WhatsApp (around line 11908)
// Add sendViaWhatsapp and early close  
// ============================================================

// Find "...prev[smartReportModal.studentId]," near "Merge current state"
let engMergeLine = -1;
for (let i = 11895; i < 11930; i++) {
    if (lines[i] && lines[i].includes('...prev[smartReportModal.studentId]') && !lines[i + 2].includes('noorConfigPart')) {
        engMergeLine = i + 1;
        break;
    }
}
console.log(`English Quran prev spread line: ${engMergeLine}`);
if (engMergeLine > 0) {
    const indent = lines[engMergeLine - 1].match(/^(\s*)/)[1];
    // Insert sendViaWhatsapp right after the prev spread line
    insertAfter(engMergeLine, [`${indent}sendViaWhatsapp: true,`]);
    console.log('Inserted sendViaWhatsapp for English Quran');
}

// Find "Sending to" toast for English and insert early close before it
let engToastLine = -1;
for (let i = 11870; i < 11910; i++) {
    if (lines[i] && lines[i].includes('Sending to') && lines[i].includes('finalTarget')) {
        engToastLine = i + 1;
        break;
    }
}
console.log(`English Quran Sending toast line: ${engToastLine}`);
if (engToastLine > 0) {
    const indent = lines[engToastLine - 1].match(/^(\s*)/)[1];
    insertAfter(engToastLine - 1, [
        `${indent}const _engStudentId = smartReportModal.studentId;`,
        `${indent}const _engDayNum = smartReportModal.dayNum;`,
        `${indent}setSmartReportModal(null);`
    ]);
    console.log('Inserted early close for English Quran');
}

// Fix checkAndOpenLink in English .then()
for (let i = 11990; i < 12030; i++) {
    if (lines[i] && lines[i].includes('checkAndOpenLink(smartReportModal.studentId)')) {
        lines[i] = lines[i].replace('checkAndOpenLink(smartReportModal.studentId)', 'checkAndOpenLink(_engStudentId)');
        fixes++;
        console.log(`Fixed English checkAndOpenLink at line ${i + 1}`);
        break;
    }
}

// Remove setSmartReportModal(null) from English .then() success
for (let i = 11990; i < 12030; i++) {
    if (lines[i] && lines[i].includes('setSmartReportModal(null)') && !lines[i].includes('//') && engToastLine > 0 && (i + 1) > engToastLine) {
        lines.splice(i, 1);
        fixes++;
        console.log(`Removed English setSmartReportModal(null) from .then() at (was) line ${i + 1}`);
        break;
    }
}

// Add notification after showToast('Sent via WhatsApp') in English
for (let i = 11990; i < 12030; i++) {
    if (lines[i] && lines[i].includes("showToast('Sent via WhatsApp") && !lines[i + 1].includes('new Notification')) {
        const indent = lines[i].match(/^(\s*)/)[1];
        const studentNameRef = 'studentName';
        insertAfter(i + 1, [`${indent}new Notification('Sent \u2705', { body: \`Report for \${${studentNameRef}} sent via WhatsApp\` });`]);
        console.log(`Added English notification after line ${i + 1}`);
        break;
    }
}

// ============================================================
// AREA 3: Noor English (around line 10906) - early close + notification
// ============================================================
let noorEngToastLine = -1;
for (let i = 10895; i < 10915; i++) {
    if (lines[i] && lines[i].includes('Sending via WhatsApp')) {
        noorEngToastLine = i + 1;
        break;
    }
}
console.log(`Noor English Sending toast line: ${noorEngToastLine}`);
if (noorEngToastLine > 0) {
    const indent = lines[noorEngToastLine - 1].match(/^(\s*)/)[1];
    insertAfter(noorEngToastLine - 1, [
        `${indent}const _noorEngStudentId = smartReportModal.studentId;`,
        `${indent}const _noorEngDayNum = smartReportModal.dayNum;`,
        `${indent}setSmartReportModal(null);`
    ]);
    console.log('Inserted early close for Noor English');
}

// Fix Noor English .then() success
for (let i = 10920; i < 10960; i++) {
    if (lines[i] && lines[i].includes('checkAndOpenLink(smartReportModal.studentId)')) {
        lines[i] = lines[i].replace('checkAndOpenLink(smartReportModal.studentId)', 'checkAndOpenLink(_noorEngStudentId)');
        fixes++;
        console.log(`Fixed Noor English checkAndOpenLink at line ${i + 1}`);
        break;
    }
}

for (let i = 10920; i < 10960; i++) {
    if (lines[i] && lines[i].includes('setSmartReportModal(null)') && !lines[i].includes('//') && noorEngToastLine > 0 && (i + 1) > noorEngToastLine) {
        lines.splice(i, 1);
        fixes++;
        console.log(`Removed Noor English setSmartReportModal(null) at (was) line ${i + 1}`);
        break;
    }
}

for (let i = 10920; i < 10960; i++) {
    if (lines[i] && lines[i].includes("showToast('Sent via WhatsApp") && !lines[i + 1].includes('new Notification')) {
        const indent = lines[i].match(/^(\s*)/)[1];
        insertAfter(i + 1, [`${indent}new Notification('Sent \u2705', { body: \`Report for \${studentName} sent via WhatsApp\` });`]);
        console.log(`Added Noor English notification after line ${i + 1}`);
        break;
    }
}

// Write the file
fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log(`\nTotal fixes applied: ${fixes}`);
