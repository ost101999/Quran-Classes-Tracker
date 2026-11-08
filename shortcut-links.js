const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const SHORTCUTS_PATH = path.join(os.homedir(), 'iCloudDrive', 'iCloud~dk~simonbs~Scriptable', 'MyShortcuts.ini');

function normalizeName(value) {
    return String(value || '').normalize('NFKC').toLowerCase()
        .replace(/[\u200e\u200f\u061c\u200b\u200c\u200d\ufeff]/g, '')
        .trim().replace(/\s+/g, ' ');
}

function folderName(filePath) {
    const parts = filePath.split(/[\\/]/).filter(Boolean);
    const folder = (parts[parts.length - 2] || '').replace(/[\u200e\u200f\u061c\u200b\u200c\u200d\ufeff]/g, '').trim();
    return normalizeName(folder.replace(/^[\d٠-٩۰-۹]+[\sـ._-]*/, ''));
}

function zoomLink(value) {
    try {
        const url = new URL(value.trim());
        if (url.protocol === 'zoommtg:' && url.hostname === 'zoom.us' && url.pathname === '/join') {
            const meeting = url.searchParams.get('confno');
            if (!meeting || !/^\d+$/.test(meeting)) return '';
            const result = new URL(`https://zoom.us/j/${meeting}`);
            const password = url.searchParams.get('pwd');
            if (password) result.searchParams.set('pwd', password);
            return result.href;
        }
        if (url.protocol === 'https:' && (url.hostname === 'zoom.us' || url.hostname.endsWith('.zoom.us'))) return url.href;
    } catch { /* Ignore non-URL fields. */ }
    return '';
}

function driveLink(value) {
    try {
        const url = new URL(value.trim());
        if (url.protocol !== 'https:' || url.hostname !== 'drive.google.com') return '';
        const match = url.pathname.match(/^\/file\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/);
        const id = match ? match[1] : (/^\/(?:open|uc)$/.test(url.pathname) ? url.searchParams.get('id') : null);
        return id && /^[a-zA-Z0-9_-]+$/.test(id) ? url.href : '';
    } catch { return ''; }
}

function zoomIdentity(value) {
    const url = new URL(value);
    const meeting = url.pathname.match(/^\/(?:j|wc\/join)\/(\d+)\/?$/)?.[1];
    return meeting ? JSON.stringify([meeting, url.searchParams.get('pwd') || '']) : url.href;
}

function driveIdentity(value) {
    const url = new URL(value);
    const id = url.pathname.match(/^\/file\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/)?.[1] || url.searchParams.get('id');
    return JSON.stringify([id, url.searchParams.get('resourcekey') || '']);
}

function parseShortcuts(content) {
    const groups = new Map();
    let inFiles = false;
    for (const line of String(content).replace(/^\uFEFF/, '').split(/\r?\n/)) {
        const header = line.trim().match(/^\[([^\]]+)\]$/);
        if (header) { inFiles = header[1].toLowerCase() === 'files'; continue; }
        if (!inFiles) continue;
        const equals = line.indexOf('=');
        if (equals < 1) continue;
        const title = line.slice(0, equals).trim();
        const fields = line.slice(equals + 1).split('|').map(part => part.trim());
        const filePath = fields[0];
        if (!filePath) continue;
        const zoom = zoomLink(fields[1] || '');
        const drive = driveLink(fields[4] || '');
        if (!zoom && !drive && !fields[4]) continue;
        const key = filePath.toLowerCase();
        if (!groups.has(key)) groups.set(key, { id: crypto.createHash('sha256').update(key).digest('hex'), folderId: crypto.createHash('sha256').update(key.replace(/[\\/][^\\/]+$/, '')).digest('hex'), path: filePath, titles: [], zooms: new Map(), drives: new Map(), invalidDrive: false, isQuran: false, isReading: false });
        const group = groups.get(key);
        if (!group.titles.includes(title)) group.titles.push(title);
        if (zoom && !group.zooms.has(zoomIdentity(zoom))) group.zooms.set(zoomIdentity(zoom), zoom);
        if (drive && !group.drives.has(driveIdentity(drive))) group.drives.set(driveIdentity(drive), drive);
        if (fields[4] && !drive) group.invalidDrive = true;
        if (/(?:quran|qur'an|moshaf|mushaf|مصحف|القرآن|القران)/i.test(title + ' ' + filePath.split(/[\\/]/).pop())) group.isQuran = true;
        if (/(?:reading|noor[\s_-]*(?:al|el)?[\s_-]*bay(?:an|aan)|foundation|قراءة|القراءة|قرائي|نور\s*البيان|تأسيس|تاسيس|القاعدة\s*النورانية|القاعدة\s*البغدادية)/i.test(title + ' ' + filePath.split(/[\\/]/).pop())) group.isReading = true;
    }
    return [...groups.values()].map(group => ({
        id: group.id, folderId: group.folderId, path: group.path, titles: group.titles, isQuran: group.isQuran, isReading: group.isReading && !group.isQuran,
        zoomLink: group.zooms.size === 1 ? [...group.zooms.values()][0] : '',
        quranLink: group.isQuran && group.drives.size === 1 ? [...group.drives.values()][0] : '',
        readingLink: group.isReading && !group.isQuran && group.drives.size === 1 ? [...group.drives.values()][0] : '',
        readingLinkInvalid: group.isReading && !group.isQuran && group.invalidDrive,
        readingConflict: group.drives.size > 1,
        zoomConflict: group.zooms.size > 1,
        conflict: group.zooms.size > 1 || (group.isQuran && group.drives.size > 1),
    }));
}

function findReadingMatches(groups, name) {
    const normalized = normalizeName(name);
    if (!normalized) return [];
    return groups.filter(group => group.isReading && folderName(group.path) === normalized)
        .map(group => ({ ...group, exact: true }));
}

function findMatches(groups, name) {
    const normalized = normalizeName(name);
    if (!normalized) return [];
    return groups.filter(group => group.isQuran && folderName(group.path) === normalized)
        .map(group => ({ ...group, exact: true }));
}

function isExistingFile(filePath) {
    try { return fs.statSync(filePath).isFile(); } catch { return false; }
}

function readMatches(students) {
    try {
        const requestedNames = new Set(students.map(student => normalizeName(student.name)).filter(Boolean));
        const relevant = parseShortcuts(fs.readFileSync(SHORTCUTS_PATH, 'utf8'))
            .filter(group => (group.isQuran || group.isReading) && requestedNames.has(folderName(group.path)));
        const groups = [], missing = [];
        for (const group of relevant) (isExistingFile(group.path) ? groups : missing).push(group);
        return { available: true, matches: Object.fromEntries(students.map(student => [student.id, findMatches(groups, student.name)])), readingMatches: Object.fromEntries(students.map(student => [student.id, findReadingMatches(groups, student.name)])), missingReadingMatches: Object.fromEntries(students.map(student => [student.id, findReadingMatches(missing, student.name)])), groups };
    } catch (error) {
        return { available: false, matches: {}, readingMatches: {}, missingReadingMatches: {}, groups: [], error: error.code || 'READ_ERROR' };
    }
}

module.exports = { normalizeName, folderName, zoomLink, driveLink, parseShortcuts, findMatches, findReadingMatches, isExistingFile, readMatches };
