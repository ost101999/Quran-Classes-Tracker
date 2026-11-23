const fs = require('fs');
const content = fs.readFileSync('c:/My App/Quran Classes Tracker/App.tsx', 'utf8');
const lines = content.split('\n');

let newLines = [];
let insideRestoreEffect = false;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    newLines.push(line);

    // Detect start of Restore Effect to limit scope if needed, 
    // but unique strings might be enough.
    if (line.includes('Restore Last Report Modes')) {
        insideRestoreEffect = true;
    }
    // Reset if we leave the effect (heuristic)
    if (insideRestoreEffect && line.includes('Cancel makeup linking')) {
        insideRestoreEffect = false;
    }

    if (insideRestoreEffect) {
        // 1. Restore Logic (readingRev)
        if (line.includes("readingRev: last.readingRev?.mode || 'ayah',")) {
            newLines.push("        readingOldRev: last.readingOldRev?.mode || 'ayah',");
        }
        // 2. Restore Logic (homeworkRev)
        if (line.includes("homeworkRev: last.homeworkRev?.mode || 'ayah',")) {
            newLines.push("        homeworkOldRev: last.homeworkOldRev?.mode || 'ayah',");
        }
        // 3. Restore Logic (activeAdvancedAyah reading)
        if (line.includes("readingRev: last.readingRev?.isAdvancedAyah || false,")) {
            newLines.push("        readingOldRev: last.readingOldRev?.isAdvancedAyah || false,");
        }
        // 4. Restore Logic (activeAdvancedAyah homework)
        if (line.includes("homeworkRev: last.homeworkRev?.isAdvancedAyah || false,")) {
            newLines.push("        homeworkOldRev: last.homeworkOldRev?.isAdvancedAyah || false,");
        }

        // 5. Reset Logic (readingRev) - check indentation to avoid duplicates if possible, matches "readingRev: 'ayah',"
        // The reset block has 8 spaces indentation usually
        if (line.trim() === "readingRev: 'ayah',") {
            // Double check it's inside the else block of restore
            // The restore block has "readingNew: 'ayah'," before it.
            newLines.push("        readingOldRev: 'ayah',");
        }
        // 6. Reset Logic (homeworkRev)
        if (line.trim() === "homeworkRev: 'ayah',") {
            newLines.push("        homeworkOldRev: 'ayah',");
        }

        // 7. Reset Logic (activeAdvancedAyah reading)
        // matches "readingRev: false,"
        if (line.trim() === "readingRev: false,") {
            newLines.push("        readingOldRev: false,");
        }
        // 8. Reset Logic (activeAdvancedAyah homework)
        if (line.trim() === "homeworkRev: false,") {
            newLines.push("        homeworkOldRev: false,");
        }
    }
}

fs.writeFileSync('c:/My App/Quran Classes Tracker/App.tsx', newLines.join('\n'), 'utf8');
console.log('Done. Lines processed:', lines.length, 'New length:', newLines.length);
