const fs = require('fs');
const content = fs.readFileSync('c:/My App/Quran Classes Tracker/App.tsx', 'utf8');
const lines = content.split('\n');

// 1. Find setPreferredModes in the 'if (smartReportModal...)' block (restore logic)
// Start searching around line 1280
let restoreStart = -1;
for (let i = 1280; i < 1300; i++) {
    if (lines[i] && lines[i].includes('setPreferredModes({') && lines[i - 3] && lines[i - 3].includes('Restore Last Report Modes')) {
        restoreStart = i;
        break;
    }
}

// 2. Find setActiveAdvancedAyah in the 'if' block
let restoreAdvancedStart = -1;
for (let i = restoreStart + 5; i < restoreStart + 20; i++) {
    if (lines[i] && lines[i].includes('setActiveAdvancedAyah({')) {
        restoreAdvancedStart = i;
        break;
    }
}

// 3. Find setPreferredModes in the 'else' block
let elseStart = -1;
for (let i = restoreAdvancedStart + 10; i < restoreAdvancedStart + 30; i++) {
    if (lines[i] && lines[i].includes('Reset if no history')) {
        // next line potentially
        if (lines[i + 1].includes('setPreferredModes')) elseStart = i + 1;
        break;
    }
}

// 4. Find setActiveAdvancedAyah in the 'else' block
let elseAdvancedStart = -1;
for (let i = elseStart + 5; i < elseStart + 20; i++) {
    if (lines[i] && lines[i].includes('setActiveAdvancedAyah({')) {
        elseAdvancedStart = i;
        break;
    }
}

console.log('Indices:', { restoreStart, restoreAdvancedStart, elseStart, elseAdvancedStart });

let newLines = [...lines];

if (elseAdvancedStart > 0) {
    // Insert readingOldRev: false,
    // Insert homeworkOldRev: false,
    // AFTER readingRev line
    let insertAt = -1;
    for (let i = elseAdvancedStart; i < elseAdvancedStart + 10; i++) {
        if (newLines[i].includes('readingRev: false,')) {
            insertAt = i + 1;
            break;
        }
    }
    if (insertAt > 0) newLines.splice(insertAt, 0, "        readingOldRev: false,");

    // AFTER homeworkRev line
    insertAt = -1;
    for (let i = elseAdvancedStart; i < elseAdvancedStart + 15; i++) {
        if (newLines[i].includes('homeworkRev: false,')) {
            insertAt = i + 1;
            break;
        }
    }
    if (insertAt > 0) newLines.splice(insertAt, 0, "        homeworkOldRev: false,");
}

if (elseStart > 0) {
    // Insert readingOldRev: 'ayah',
    // Insert homeworkOldRev: 'ayah',
    let insertAt = -1;
    for (let i = elseStart; i < elseStart + 10; i++) {
        if (newLines[i].includes("readingRev: 'ayah',")) {
            insertAt = i + 1;
            break;
        }
    }
    if (insertAt > 0) newLines.splice(insertAt, 0, "        readingOldRev: 'ayah',");

    insertAt = -1;
    for (let i = elseStart; i < elseStart + 15; i++) {
        if (newLines[i].includes("homeworkRev: 'ayah',")) {
            insertAt = i + 1;
            break;
        }
    }
    if (insertAt > 0) newLines.splice(insertAt, 0, "        homeworkOldRev: 'ayah',");
}

if (restoreAdvancedStart > 0) {
    // Insert readingOldRev: last.readingOldRev?.isAdvancedAyah || false,
    let insertAt = -1;
    for (let i = restoreAdvancedStart; i < restoreAdvancedStart + 10; i++) {
        if (newLines[i].includes('readingRev: last.readingRev?.isAdvancedAyah')) {
            insertAt = i + 1;
            break;
        }
    }
    if (insertAt > 0) newLines.splice(insertAt, 0, "        readingOldRev: last.readingOldRev?.isAdvancedAyah || false,");

    insertAt = -1;
    for (let i = restoreAdvancedStart; i < restoreAdvancedStart + 15; i++) {
        if (newLines[i].includes('homeworkRev: last.homeworkRev?.isAdvancedAyah')) {
            insertAt = i + 1;
            break;
        }
    }
    if (insertAt > 0) newLines.splice(insertAt, 0, "        homeworkOldRev: last.homeworkOldRev?.isAdvancedAyah || false,");
}

if (restoreStart > 0) {
    // Insert readingOldRev: last.readingOldRev?.mode || 'ayah',
    let insertAt = -1;
    for (let i = restoreStart; i < restoreStart + 10; i++) {
        if (newLines[i].includes('readingRev: last.readingRev?.mode')) {
            insertAt = i + 1;
            break;
        }
    }
    if (insertAt > 0) newLines.splice(insertAt, 0, "        readingOldRev: last.readingOldRev?.mode || 'ayah',");

    insertAt = -1;
    for (let i = restoreStart; i < restoreStart + 15; i++) {
        if (newLines[i].includes('homeworkRev: last.homeworkRev?.mode')) {
            insertAt = i + 1;
            break;
        }
    }
    if (insertAt > 0) newLines.splice(insertAt, 0, "        homeworkOldRev: last.homeworkOldRev?.mode || 'ayah',");
}

fs.writeFileSync('c:/My App/Quran Classes Tracker/App.tsx', newLines.join('\n'), 'utf8');
console.log('Done. New total lines:', newLines.length);
