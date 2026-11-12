const fs = require('fs');
const path = require('path');
const os = require('os');
const { normalizeName, folderName, titleStudentName } = require('./shortcut-links');

function targetsFromIni(text, students) {
    const sections = { files: [], whatsapp: [] };
    let section = '';
    for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
        const header = line.trim().match(/^\[([^\]]+)\]$/);
        if (header) { section = header[1].toLowerCase(); continue; }
        const i = line.indexOf('=');
        if (i > 0 && sections[section]) sections[section].push([line.slice(0, i).trim(), line.slice(i + 1).trim()]);
    }
    const profiles = new Map();
    for (const [key, value] of sections.whatsapp) {
        const fields = value.split('|');
        if (fields[0] !== 'v1' || !fields[1]) continue;
        const target = fields[1].replace(/%0D/gi, '\r').replace(/%0A/gi, '\n').replace(/%7C/gi, '|').replace(/%25/gi, '%').trim();
        if (!/^(?:\+?[\d ()-]{10,22}|\d{5,20}(?:-\d{5,20})?@g\.us|\d{5,20}@(c\.us|lid))$/i.test(target)) continue;
        const k = normalizeName(key);
        if (!profiles.has(k)) profiles.set(k, new Set());
        profiles.get(k).add(target);
    }
    const names = new Map();
    const add = (name, target) => { if (!name) return; if (!names.has(name)) names.set(name, new Set()); names.get(name).add(target); };
    for (const [key, targets] of profiles) for (const target of targets) add(key, target);
    for (const [title, value] of sections.files) {
        const targets = profiles.get(normalizeName(title));
        if (!targets) continue;
        for (const target of targets) { add(folderName(value.split('|')[0]), target); add(titleStudentName(title), target); }
    }
    const counts = new Map();
    for (const student of students) { const n = normalizeName(student.name); counts.set(n, (counts.get(n) || 0) + 1); }
    return Object.fromEntries(students.flatMap(student => {
        const n = normalizeName(student.name), found = names.get(n);
        return n && counts.get(n) === 1 && found?.size === 1 ? [[student.id, [...found][0]]] : [];
    }));
}
function readTargets(students) {
    try {
        const file = path.join(os.homedir(), 'Library', 'Mobile Documents', 'iCloud~dk~simonbs~Scriptable', 'Documents', 'MyShortcuts.ini');
        const data = fs.readFileSync(file);
        const text = data[0] === 0xff && data[1] === 0xfe ? data.toString('utf16le') : data.toString('utf8');
        return { available: true, matches: targetsFromIni(text, students) };
    } catch { return { available: false, matches: {} }; }
}
module.exports = { targetsFromIni, readTargets };
