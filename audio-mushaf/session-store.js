const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const WIN_Z_STORAGE_DIR = 'Z:\\تسجيلات الطلبة الصوتية\\المصحح الصوتي';
const HAS_WIN_Z_STORAGE = process.platform === 'win32' && fs.existsSync('Z:\\تسجيلات الطلبة الصوتية');
const SESSIONS_ROOT_DIR = HAS_WIN_Z_STORAGE
    ? path.join(WIN_Z_STORAGE_DIR, 'sessions')
    : path.join(os.homedir(), '.quran-audio-corrector', 'sessions');
const HUD_STATE_PATH = path.join(os.homedir(), '.quran-audio-corrector', 'hud-state.json');
const OUTPUT_HTML_DIR = HAS_WIN_Z_STORAGE
    ? WIN_Z_STORAGE_DIR
    : path.join(os.homedir(), 'Documents', 'المصحح الصوتي');

function loadHudState(statePath = HUD_STATE_PATH) {
    try {
        if (!fs.existsSync(statePath)) return {};
        const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function saveHudState(patch = {}, statePath = HUD_STATE_PATH) {
    const current = loadHudState(statePath);
    const next = { ...current, ...patch, updatedAt: Date.now() };
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    const tmp = `${statePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8');
    fs.renameSync(tmp, statePath);
    return next;
}

function normalizeText(value) {
    return String(value || '')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[\u200e\u200f\u061c\u200b\u200c\u200d\ufeff]/g, '')
        .trim()
        .replace(/\s+/g, ' ');
}

function sanitizeSegment(value) {
    const cleaned = String(value || 'student')
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
        .replace(/\s+/g, '_')
        .trim();
    return cleaned || 'student';
}

function getTodayDateStr() {
    return new Date().toLocaleDateString('en-CA');
}

function getStudentSessionKey(studentName, studentId, dateStr = getTodayDateStr()) {
    const namePart = sanitizeSegment(normalizeText(studentName || studentId || 'student'));
    return `${dateStr}__${namePart}`;
}

function getSessionDir(sessionKey, rootDir = SESSIONS_ROOT_DIR) {
    return path.join(rootDir, sanitizeSegment(sessionKey));
}

function loadSession(sessionKey, rootDir = SESSIONS_ROOT_DIR) {
    const dir = getSessionDir(sessionKey, rootDir);
    const metaPath = path.join(dir, 'session.json');
    if (!fs.existsSync(metaPath)) return null;
    try {
        return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch {
        return null;
    }
}

function saveSession(session, rootDir = SESSIONS_ROOT_DIR) {
    const dir = getSessionDir(session.sessionKey, rootDir);
    fs.mkdirSync(path.join(dir, 'audio'), { recursive: true });
    const metaPath = path.join(dir, 'session.json');
    const tmpPath = `${metaPath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(session, null, 2), 'utf8');
    fs.renameSync(tmpPath, metaPath);
    return session;
}

function loadOrCreateSession({
    studentId = '',
    studentName = 'طالب',
    sourcePdfPath = '',
    dateStr = getTodayDateStr(),
    rootDir = SESSIONS_ROOT_DIR,
} = {}) {
    const sessionKey = getStudentSessionKey(studentName, studentId, dateStr);
    const existing = loadSession(sessionKey, rootDir);
    if (existing) {
        let changed = false;
        if (sourcePdfPath && existing.sourcePdfPath !== sourcePdfPath) {
            existing.sourcePdfPath = sourcePdfPath;
            changed = true;
        }
        if (studentId && existing.studentId !== studentId) {
            existing.studentId = studentId;
            changed = true;
        }
        if (changed) saveSession(existing, rootDir);
        return existing;
    }
    const created = {
        sessionKey,
        studentId,
        studentName,
        sourcePdfPath,
        dateStr,
        startedAt: Date.now(),
        lastRecordedAt: null,
        clips: [],
    };
    return saveSession(created, rootDir);
}

function shiftDateStr(dateStr, deltaDays) {
    const m = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return '';
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + deltaDays));
    return d.toISOString().slice(0, 10);
}

function findSessionForStudentOnDate({ studentId, studentName, dateStr, rootDir }) {
    const byNameKey = getStudentSessionKey(studentName, studentId, dateStr);
    const exact = loadSession(byNameKey, rootDir);
    if (exact && Array.isArray(exact.clips) && exact.clips.length > 0) return exact;
    if (!fs.existsSync(rootDir)) return exact;

    const normTarget = normalizeText(studentName);
    let bestMatch = exact;
    for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
        if (!entry.isDirectory() || !entry.name.startsWith(`${dateStr}__`)) continue;
        const candidate = loadSession(entry.name, rootDir);
        if (!candidate) continue;
        if (
            (studentId && candidate.studentId === studentId) ||
            (normTarget && normalizeText(candidate.studentName) === normTarget)
        ) {
            if (!bestMatch || (candidate.clips?.length || 0) > (bestMatch.clips?.length || 0)) {
                bestMatch = candidate;
            }
        }
    }
    return bestMatch;
}

function findSessionForStudent({ studentId, studentName, dateStr = getTodayDateStr(), rootDir = SESSIONS_ROOT_DIR } = {}) {
    const todayReal = getTodayDateStr();
    const candidateDates = [];
    const pushDate = (d) => { if (d && !candidateDates.includes(d)) candidateDates.push(d); };
    pushDate(dateStr);
    pushDate(shiftDateStr(dateStr, 1));
    pushDate(shiftDateStr(dateStr, -1));
    pushDate(todayReal);

    let firstMatch = null;
    for (const d of candidateDates) {
        const found = findSessionForStudentOnDate({ studentId, studentName, dateStr: d, rootDir });
        if (!firstMatch && found) firstMatch = found;
        if (found && Array.isArray(found.clips) && found.clips.length > 0) return found;
    }
    return firstMatch;
}

function addAudioClipToSession(sessionKey, { buffer, ext = 'mp3', startedAt, endedAt, durationMs }, rootDir = SESSIONS_ROOT_DIR) {
    const session = loadSession(sessionKey, rootDir);
    if (!session) throw new Error('Session not found');
    const clipId = `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const fileName = `${clipId}.${ext}`;
    const audioDir = path.join(getSessionDir(sessionKey, rootDir), 'audio');
    fs.mkdirSync(audioDir, { recursive: true });
    fs.writeFileSync(path.join(audioDir, fileName), Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));

    const clip = {
        id: clipId,
        fileName,
        startedAt: Number(startedAt) || Date.now(),
        endedAt: Number(endedAt) || Date.now(),
        durationMs: Number(durationMs) || 0,
        manualPage: null,
        manualXPercent: null,
        manualYPercent: null,
    };
    session.clips = Array.isArray(session.clips) ? [...session.clips, clip] : [clip];
    if (Array.isArray(session.undoneClips) && session.undoneClips.length > 0) {
        for (const oldClip of session.undoneClips) {
            if (!oldClip?.fileName) continue;
            const oldPath = path.join(audioDir, oldClip.fileName);
            try { if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath); } catch { /* ignore */ }
        }
        session.undoneClips = [];
    }
    session.lastRecordedAt = clip.endedAt;
    saveSession(session, rootDir);
    return { session, clip };
}

function removeClipFromSession(sessionKey, clipId = null, rootDir = SESSIONS_ROOT_DIR) {
    const session = loadSession(sessionKey, rootDir);
    if (!session || !Array.isArray(session.clips) || session.clips.length === 0) {
        return { session, removed: null };
    }
    const idx = clipId ? session.clips.findIndex(c => c.id === clipId) : session.clips.length - 1;
    if (idx === -1) return { session, removed: null };

    const [removed] = session.clips.splice(idx, 1);
    if (clipId) {
        // Explicit delete from review modal deletes the audio file permanently
        const audioPath = path.join(getSessionDir(sessionKey, rootDir), 'audio', removed.fileName);
        try { if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath); } catch { /* ignore */ }
    } else {
        // Soft undo pushes onto redo stack so F21 / Redo can restore it cleanly
        session.undoneClips = Array.isArray(session.undoneClips) ? [...session.undoneClips, removed] : [removed];
    }
    session.lastRecordedAt = session.clips.length ? session.clips[session.clips.length - 1].endedAt : null;
    saveSession(session, rootDir);
    return { session, removed };
}

function redoClipInSession(sessionKey, rootDir = SESSIONS_ROOT_DIR) {
    const session = loadSession(sessionKey, rootDir);
    if (!session || !Array.isArray(session.undoneClips) || session.undoneClips.length === 0) {
        return { session, restored: null };
    }
    const audioDir = path.join(getSessionDir(sessionKey, rootDir), 'audio');
    let restored = null;
    while (session.undoneClips.length > 0) {
        const candidate = session.undoneClips.pop();
        if (candidate?.fileName && fs.existsSync(path.join(audioDir, candidate.fileName))) {
            restored = candidate;
            break;
        }
    }
    if (!restored) {
        saveSession(session, rootDir);
        return { session, restored: null };
    }
    session.clips = Array.isArray(session.clips) ? [...session.clips, restored] : [restored];
    session.lastRecordedAt = session.clips.length ? session.clips[session.clips.length - 1].endedAt : null;
    saveSession(session, rootDir);
    return { session, restored };
}

function updateClipManualPin(sessionKey, clipId, { pdfPage, xPercent, yPercent }, rootDir = SESSIONS_ROOT_DIR) {
    const session = loadSession(sessionKey, rootDir);
    if (!session) return null;
    const clip = (session.clips || []).find(c => c.id === clipId);
    if (!clip) return null;
    clip.manualPage = Number.isInteger(pdfPage) ? pdfPage : null;
    clip.manualXPercent = Number.isFinite(xPercent) ? xPercent : null;
    clip.manualYPercent = Number.isFinite(yPercent) ? yPercent : null;
    saveSession(session, rootDir);
    return session;
}

function readClipAudioDataUrl(sessionKey, fileName, rootDir = SESSIONS_ROOT_DIR) {
    const filePath = path.join(getSessionDir(sessionKey, rootDir), 'audio', path.basename(fileName));
    if (!fs.existsSync(filePath)) return '';
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === '.mp3' ? 'audio/mpeg' : ext === '.m4a' ? 'audio/mp4' : 'audio/wav';
    return `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`;
}

function getQuranTrackerStudents() {
    const appData = process.platform === 'darwin'
        ? path.join(os.homedir(), 'Library', 'Application Support', 'quran-classes-tracker', 'data.json')
        : path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'quran-classes-tracker', 'data.json');
    try {
        if (!fs.existsSync(appData)) return [];
        const raw = JSON.parse(fs.readFileSync(appData, 'utf8'));
        return Array.isArray(raw.students) ? raw.students.filter(s => s && !s.deletedAt) : [];
    } catch {
        return [];
    }
}

function readShortcutMushafs() {
    const macDrive = path.join(os.homedir(), 'Library', 'CloudStorage', 'GoogleDrive-ost101999@gmail.com');
    const candidates = process.platform === 'darwin'
        ? [
            path.join(macDrive, 'ملفاتي', 'Scripts', 'MyShortcuts.ini'),
            path.join(os.homedir(), 'Library', 'Mobile Documents', 'iCloud~dk~simonbs~Scriptable', 'Documents', 'MyShortcuts.ini'),
        ]
        : [
            'G:\\ملفاتي\\Scripts\\MyShortcuts.ini',
            path.join(os.homedir(), 'iCloudDrive', 'iCloud~dk~simonbs~Scriptable', 'MyShortcuts.ini'),
        ];

    let iniPath = null;
    let bestTime = -Infinity;
    for (const c of candidates) {
        try {
            const st = fs.statSync(c);
            if (st.isFile() && st.mtimeMs > bestTime) {
                bestTime = st.mtimeMs;
                iniPath = c;
            }
        } catch { /* skip */ }
    }
    if (!iniPath) return [];

    const toLocal = (rawPath) => {
        if (process.platform !== 'darwin') return rawPath;
        if (String(rawPath).toLowerCase().startsWith('g:\\')) {
            return path.join(macDrive, String(rawPath).slice(3).replace(/\\/g, '/'));
        }
        return rawPath;
    };

    const entries = [];
    let inFiles = false;
    for (const line of fs.readFileSync(iniPath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
        const hdr = line.trim().match(/^\[([^\]]+)\]$/);
        if (hdr) { inFiles = hdr[1].toLowerCase() === 'files'; continue; }
        if (!inFiles) continue;
        const eq = line.indexOf('=');
        if (eq < 1) continue;
        const title = line.slice(0, eq).trim();
        const fields = line.slice(eq + 1).split('|').map(x => x.trim());
        const rawPath = fields[0];
        if (!rawPath || path.extname(rawPath).toLowerCase() !== '.pdf') continue;
        if (!/(?:quran|qur'an|moshaf|mushaf|مصحف|القرآن|القران)/i.test(`${title} ${path.basename(rawPath)}`)) continue;
        const localPath = toLocal(rawPath);
        const parts = localPath.split(/[\\/]/).filter(Boolean);
        const rawFolder = (parts[parts.length - 2] || '').replace(/[\u200e\u200f\u061c\u200b\u200c\u200d\ufeff]/g, '');
        const parentFolder = rawFolder.replace(/^[\d٠-٩۰-۹]+[\sـ._-]*/, '').trim();
        entries.push({
            title,
            localPath,
            fileName: path.basename(localPath),
            parentFolder,
        });
    }
    return entries;
}

function findXodoLocalStateDirs(localAppData = process.env.LOCALAPPDATA) {
    if (!localAppData || !fs.existsSync(localAppData)) return [];
    const packagesDir = path.join(localAppData, 'Packages');
    if (!fs.existsSync(packagesDir)) return [];
    const out = [];
    try {
        for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
            if (!entry.isDirectory() || !/xododocs/i.test(entry.name)) continue;
            const localState = path.join(packagesDir, entry.name, 'LocalState');
            if (fs.existsSync(localState)) out.push(localState);
        }
    } catch { /* ignore */ }
    return out;
}

function parseXodoFileNameMapping(mappingFilePath) {
    if (!mappingFilePath || !fs.existsSync(mappingFilePath)) return [];
    try {
        const raw = fs.readFileSync(mappingFilePath);
        const xml = raw.length >= 2 && raw[0] === 0xff && raw[1] === 0xfe
            ? raw.toString('utf16le')
            : raw.toString('utf8');
        const pairs = [];
        const re = /<Key>(.*?)<\/Key>\s*<Value>(.*?)<\/Value>/gs;
        let match;
        while ((match = re.exec(xml))) {
            const key = match[1].trim();
            const value = match[2].trim();
            if (key && value) pairs.push({ key, value });
        }
        return pairs;
    } catch {
        return [];
    }
}

function readXodoOpenDocuments(localAppData = process.env.LOCALAPPDATA) {
    const docs = [];
    for (const localState of findXodoLocalStateDirs(localAppData)) {
        const mapping = parseXodoFileNameMapping(path.join(localState, 'FileNameMapping.txt'));
        const byValue = new Map(mapping.map(p => [normalizeText(p.value), p.key]));
        const openDir = path.join(localState, 'OpenDocuments');
        if (!fs.existsSync(openDir)) continue;
        try {
            for (const folder of fs.readdirSync(openDir, { withFileTypes: true })) {
                if (!folder.isDirectory()) continue;
                const subDir = path.join(openDir, folder.name);
                for (const fileEntry of fs.readdirSync(subDir, { withFileTypes: true })) {
                    if (!fileEntry.isFile() || path.extname(fileEntry.name).toLowerCase() !== '.pdf') continue;
                    const openCopyPath = path.join(subDir, fileEntry.name);
                    try {
                        const st = fs.statSync(openCopyPath);
                        const originalPath = byValue.get(normalizeText(openCopyPath)) || '';
                        docs.push({
                            fileName: fileEntry.name,
                            openCopyPath,
                            originalPath,
                            mtimeMs: st.mtimeMs,
                        });
                    } catch { /* ignore */ }
                }
            }
        } catch { /* ignore */ }
    }
    docs.sort((a, b) => b.mtimeMs - a.mtimeMs);
    return docs;
}

function resolveLatestPdfCopyForReading(sourcePdfPath, localAppData = process.env.LOCALAPPDATA) {
    if (!sourcePdfPath || !fs.existsSync(sourcePdfPath)) return sourcePdfPath;
    if (process.platform !== 'win32' && !localAppData) return sourcePdfPath;
    try {
        const srcStat = fs.statSync(sourcePdfPath);
        const normTarget = normalizeText(sourcePdfPath);
        const match = readXodoOpenDocuments(localAppData).find(d => d.originalPath && normalizeText(d.originalPath) === normTarget);
        if (match && match.mtimeMs > srcStat.mtimeMs + 500 && fs.existsSync(match.openCopyPath)) {
            return match.openCopyPath;
        }
    } catch { /* ignore */ }
    return sourcePdfPath;
}

function matchWindowTitleToStudent(windowTitleOrFileName, explicitFilePath = '') {
    const cleanTitle = String(windowTitleOrFileName || '')
        .replace(/\s*-\s*(Xodo|Adobe Acrobat.*|Acrobat.*)$/i, '')
        .trim();
    if (!cleanTitle && !explicitFilePath) return null;

    const students = getQuranTrackerStudents();
    const shortcuts = readShortcutMushafs();
    const normTitle = normalizeText(cleanTitle);
    const normBase = normalizeText(path.basename(explicitFilePath || cleanTitle, '.pdf'));

    // 1. Direct path match with shortcuts
    let matchedShortcut = null;
    if (explicitFilePath) {
        const normExplicit = normalizeText(explicitFilePath);
        matchedShortcut = shortcuts.find(s => normalizeText(s.localPath) === normExplicit) || null;
    }
    if (!matchedShortcut && cleanTitle) {
        matchedShortcut = shortcuts.find(s => {
            const sf = normalizeText(path.basename(s.fileName, '.pdf'));
            return sf === normBase || sf === normTitle || normTitle.includes(sf) || sf.includes(normTitle);
        }) || null;
    }

    // 2. Match student from shortcut folder or window title substring
    let matchedStudent = null;
    if (matchedShortcut) {
        const normFolder = normalizeText(matchedShortcut.parentFolder);
        matchedStudent = students.find(s => normalizeText(s.name) === normFolder) || null;
    }
    if (!matchedStudent && normTitle) {
        const sortedStudents = [...students].sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0));
        matchedStudent = sortedStudents.find(s => {
            const n = normalizeText(s.name);
            return n.length >= 2 && (normTitle.includes(n) || normBase.includes(n));
        }) || null;
        if (matchedStudent && !matchedShortcut) {
            const n = normalizeText(matchedStudent.name);
            matchedShortcut = shortcuts.find(s => normalizeText(s.parentFolder) === n) || null;
        }
    }

    const sourcePdfPath = explicitFilePath && fs.existsSync(explicitFilePath)
        ? explicitFilePath
        : (matchedShortcut && fs.existsSync(matchedShortcut.localPath) ? matchedShortcut.localPath : '');

    if (!matchedStudent && !sourcePdfPath) return null;
    return {
        studentId: matchedStudent?.id || '',
        studentName: matchedStudent?.name || matchedShortcut?.parentFolder || path.basename(sourcePdfPath || cleanTitle, '.pdf'),
        sourcePdfPath,
        detectedTitle: cleanTitle || path.basename(sourcePdfPath),
    };
}

function pruneOldFilesByExtension(dir, maxFilesToKeep, ext = '.html', protectedPath = '') {
    const limit = Number(maxFilesToKeep);
    if (!Number.isInteger(limit) || limit < 1 || !dir || !fs.existsSync(dir)) return 0;
    const resolvedKeep = protectedPath ? path.resolve(protectedPath) : '';
    const candidates = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ext.toLowerCase()) continue;
        const fullPath = path.join(dir, entry.name);
        if (resolvedKeep && path.resolve(fullPath) === resolvedKeep) continue;
        try {
            const st = fs.statSync(fullPath);
            candidates.push({ path: fullPath, mtimeMs: st.mtimeMs });
        } catch { /* skip */ }
    }
    candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
    const maxOthers = Math.max(0, limit - (resolvedKeep ? 1 : 0));
    let deleted = 0;
    for (const oldFile of candidates.slice(maxOthers)) {
        try { fs.unlinkSync(oldFile.path); deleted++; } catch { /* ignore */ }
    }
    return deleted;
}

module.exports = {
    SESSIONS_ROOT_DIR,
    HUD_STATE_PATH,
    OUTPUT_HTML_DIR,
    loadHudState,
    saveHudState,
    normalizeText,
    sanitizeSegment,
    getTodayDateStr,
    getStudentSessionKey,
    getSessionDir,
    loadSession,
    saveSession,
    loadOrCreateSession,
    findSessionForStudent,
    addAudioClipToSession,
    removeClipFromSession,
    redoClipInSession,
    updateClipManualPin,
    readClipAudioDataUrl,
    getQuranTrackerStudents,
    readShortcutMushafs,
    parseXodoFileNameMapping,
    readXodoOpenDocuments,
    resolveLatestPdfCopyForReading,
    matchWindowTitleToStudent,
    pruneOldFilesByExtension,
};
