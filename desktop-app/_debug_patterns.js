const fs = require('fs');
const filePath = 'App.tsx';
const lines = fs.readFileSync(filePath, 'utf8').split('\n');

let fixes = 0;

function replaceLine(lineNum, findStr, replaceStr) {
    // lineNum is 1-indexed
    const idx = lineNum - 1;
    if (lines[idx] && lines[idx].includes(findStr)) {
        lines[idx] = lines[idx].replace(findStr, replaceStr);
        console.log(`Line ${lineNum}: REPLACED "${findStr.substring(0, 40)}..."`);
        fixes++;
        return true;
    } else {
        console.log(`Line ${lineNum}: NOT FOUND "${findStr.substring(0, 40)}..." - actual: "${(lines[idx] || '').substring(0, 80)}"`);
        return false;
    }
}

function insertAfterLine(lineNum, newLines) {
    // Insert newLines array after lineNum (1-indexed)
    lines.splice(lineNum, 0, ...newLines);
    console.log(`After line ${lineNum}: INSERTED ${newLines.length} lines`);
    fixes++;
}

// ====== ARABIC QURAN WHATSAPP (around line 10585-10690) ======
// FIX B: Add capture vars + early close before showToast
// Line 10585 is: "               // Send via Puppeteer automation"
// We want to insert before line 10586 (showToast)
// Currently lines 10585-10587:
// 10585: "                               // Send via Puppeteer automation"
// 10586: "                               showToast('جاري الإرسال عبر واتساب... ⏳');"
// 10587: "                               window.electronAPI?.sendWhatsAppAuto..."

// Find line with "Send via Puppeteer automation" for arabic (2nd occurrence)
let arLineIdx = -1;
let occurrences = 0;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('PERSISTENCE FIX: Ensure lastReports is updated even on WhatsApp send')) {
        console.log(`Found PERSISTENCE FIX at line ${i + 1}: ${lines[i].substring(0, 80)}`);
        // This is inside the Arabic Quran .then()
        // The setLastReports starts a few lines after
        // Find [smartReportModal.studentId] after this
        for (let j = i; j < Math.min(i + 5, lines.length); j++) {
            console.log(`  Line ${j + 1}: ${lines[j].substring(0, 100)}`);
        }
    }
}

// Find "PERSISTENCE FIX" line - the one for Arabic Quran
let persistLine = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('PERSISTENCE FIX: Ensure lastReports is updated even on WhatsApp send')) {
        persistLine = i + 1; // 1-indexed
        console.log(`\nPERSISTENCE FIX at line ${persistLine}`);
        // Show surrounding context
        for (let j = Math.max(0, i - 3); j < Math.min(lines.length, i + 10); j++) {
            console.log(`  ${j + 1}: ${JSON.stringify(lines[j]).substring(0, 120)}`);
        }
        break;
    }
}

// Find ...noorConfigPart after persist line
if (persistLine > 0) {
    for (let i = persistLine; i < Math.min(persistLine + 10, lines.length); i++) {
        if (lines[i].includes('...noorConfigPart')) {
            console.log(`\n...noorConfigPart at line ${i + 1}: ${JSON.stringify(lines[i]).substring(0, 120)}`);
            // Check if next line is readingNew
            console.log(`  Next: ${JSON.stringify(lines[i + 1]).substring(0, 120)}`);
        }
    }
}

// Find "Sending to" pattern (English)
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Sending to') && lines[i].includes('finalTarget')) {
        console.log(`\n"Sending to finalTarget" at line ${i + 1}: ${JSON.stringify(lines[i]).substring(0, 120)}`);
        for (let j = Math.max(0, i - 2); j < Math.min(lines.length, i + 5); j++) {
            console.log(`  ${j + 1}: ${JSON.stringify(lines[j]).substring(0, 120)}`);
        }
    }
}

// Find "prev[smartReportModal.studentId]" near "Merge current state"
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Merge current state values to ensure they are saved')) {
        console.log(`\n"Merge current state" at line ${i + 1}`);
        for (let j = Math.max(0, i - 3); j < Math.min(lines.length, i + 3); j++) {
            console.log(`  ${j + 1}: ${JSON.stringify(lines[j]).substring(0, 120)}`);
        }
    }
}

// Find "Send via WhatsApp" toast patterns
let sendToasts = [];
for (let i = 0; i < lines.length; i++) {
    if ((lines[i].includes('جاري الإرسال عبر واتساب') || lines[i].includes('Sending via WhatsApp') || lines[i].includes('Sending to')) && lines[i].includes('Toast')) {
        sendToasts.push(i + 1);
    }
}
console.log(`\nSend toasts at lines: ${sendToasts.join(', ')}`);

console.log(`\nDone. fixes would be: ${fixes}`);
