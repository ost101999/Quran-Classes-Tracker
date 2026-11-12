const { app, BrowserWindow, ipcMain, shell, protocol, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { sendWahaMessage } = require('./waha-send');
const { createChromeTabBridge } = require('./chrome-tab-bridge');
const { focusChromeWindow } = require('./chrome-window-focus');
const { createSyncQueue } = require('./sync-queue');
const { sanitizeKeys } = require('./firebase-patch');
const { createFirebaseClient } = require('./firebase-client');
const { createSelectiveSync, cloudProjection, get } = require('./selective-sync');
const { readMatches } = require('./shortcut-links');
const { readTargets } = require('./whatsapp-integration');
const { createCalendarSchedules } = require('./calendar-schedules');
const { registerAppUpdates } = require('./app-update');
const getCalendarSchedules = createCalendarSchedules();
ipcMain.handle('get-calendar-schedules', (_event, students, force, review, dayTransitionTime) => getCalendarSchedules(students, { force: force === true, review: review === true, dayTransitionTime }));
const chromeTabBridge = createChromeTabBridge({ onFocus: focusChromeWindow });

ipcMain.handle('get-shortcut-links', (_event, students) => {
    const requests = Array.isArray(students) ? students.filter(s => s && typeof s.id === 'string' && typeof s.name === 'string') : [];
    return readMatches(requests);
});

ipcMain.handle('get-whatsapp-targets', (_event, students) => process.platform === 'darwin' && Array.isArray(students) ? readTargets(students.filter(s => s && typeof s.id === 'string' && typeof s.name === 'string')) : { available: false, matches: {} });

// Helper for waiting
const waitForTimeout = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let mainWindow;
// Normalize URLs so shell.openExternal can reliably open them
function normalizeUrl(url) {
    const s = (url || '').toString().trim();
    if (!s) return '';
    // If no scheme is provided, assume https
    if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(s)) return `https://${s}`;
    return s;
}

function getChromePath() {
    if (process.platform === 'darwin') {
        const macPath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
        if (fs.existsSync(macPath)) return macPath;
        return null;
    }
    
    if (process.platform === 'win32') {
        const candidates = [
            'C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
            'C:\\\\Program Files (x86)\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
            path.join(process.env.LOCALAPPDATA || '', 'Google\\\\Chrome\\\\Application\\\\chrome.exe'),
        ];
        for (const p of candidates) {
            try {
                if (p && fs.existsSync(p)) return p;
            } catch {
                // ignore
            }
        }
    }
    return null;
}

async function openExternalMaximized(url) {
    const chromePath = getChromePath();
    if (chromePath) {
        // Force a new Chrome window that starts maximized
        try {
            const child = spawn(chromePath, ['--new-window', '--start-maximized', url], {
                detached: true,
                stdio: 'ignore',
            });
            child.unref();
            return true;
        } catch (e) {
            console.error('Failed to spawn Chrome directly:', e);
        }
    }

    if (process.platform === 'darwin') {
        try {
            const child = spawn('open', ['-a', 'Google Chrome', '-n', '--args', '--start-maximized', url], {
                detached: true,
                stdio: 'ignore'
            });
            child.unref();
            return true;
        } catch (e) {
            shell.openExternal(url).catch(() => {});
            return true;
        }
    }

    // Fallback: ask Windows to open URL (may reuse existing browser window size)
    try {
        const ps = spawn('powershell', [
            '-NoProfile',
            '-Command',
            `Start-Process -FilePath "${url}" -WindowStyle Maximized`
        ]);
        ps.on('error', (err) => {
            console.error('PowerShell spawn error:', err);
            shell.openExternal(url).catch(() => { });
        });
        return true;
    } catch (e) {
        console.error('Maximized open fallback failed:', e);
        return false;
    }
}

// --- WhatsApp IPC Handler ---
ipcMain.handle('send-whatsapp-auto', async (event, data) => {
    if (process.platform === 'darwin') {
        const { targetName, message } = data || {};
        if (typeof targetName !== 'string' || typeof message !== 'string' || !targetName.trim() || !message.trim()) return { success: false, error: 'بيانات الإرسال غير مكتملة.' };
        const helper = path.join(app.getPath('home'), 'MyAutoScripts', '5- My Programs', '1- Google Calender Magic Opener', 'Support Files', 'whatsapp_mac.py');
        return await new Promise(resolve => {
            const child = spawn('/usr/bin/python3', [helper], { stdio: ['pipe', 'pipe', 'pipe'] });
            let out = '', settled = false;
            const finish = result => { if (!settled) { settled = true; resolve(result); } };
            child.stdout.on('data', chunk => { out += chunk; });
            child.on('error', () => finish({ success: false, error: 'تعذر تشغيل خدمة واتساب.' }));
            child.on('close', () => { try { const result = JSON.parse(out); finish({ success: !!result.ok, error: result.error }); } catch { finish({ success: false, error: 'تعذر التأكد من الإرسال. راجع المحادثة قبل إعادة المحاولة.' }); } });
            child.stdin.on('error', () => {});
            child.stdin.end(JSON.stringify({ target: targetName, text: message }) + '\n');
        });
    }
    const { targetName, message } = data || {};
    return sendWahaMessage(targetName, message);
});

// --- Open External Links ---
ipcMain.handle('open-external', async (event, url, options) => {
    const normalizedUrl = normalizeUrl(url);
    if (!normalizedUrl) return { success: false, error: 'Empty URL' };

    if (options?.reuseExisting && await chromeTabBridge.focusExisting(normalizedUrl)) {
        return { success: true, reused: true };
    }

    if (options && options.background && process.platform === 'win32') {
        try {
            // Radical Strategy: "The Iron Dome"
            // 1. "Shield Up": Force window to stay on top of everything
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.setAlwaysOnTop(true, 'screen-saver');
            }

            // 2. "Lock Focus": Aggressively reclaim focus every 5ms
            // This fights the OS trying to give focus to the new browser window
            const focusInterval = setInterval(() => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.focus();
                    mainWindow.moveTop();
                }
            }, 5);

            // 3. Launch via PowerShell as Minimized
            // Start-Process allows us to specify WindowStyle Minimized directly
            const ps = spawn('powershell', [
                '-NoProfile',
                '-Command',
                `Start-Process -FilePath "${normalizedUrl}" -WindowStyle Minimized`
            ]);

            ps.on('error', (err) => {
                console.error('PowerShell spawn error:', err);
                shell.openExternal(normalizedUrl); // Fallback
            });

            // 4. Cleanup after 3 seconds (sufficient time for browser to launch and settle)
            setTimeout(() => {
                clearInterval(focusInterval);
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.setAlwaysOnTop(false); // Release the shield
                    mainWindow.focus(); // Final ensure focus
                }
            }, 3000);

        } catch (error) {
            console.error('Background open error:', error);
            shell.openExternal(normalizedUrl);
        }
    } else if (options && options.background && mainWindow) {
        // ... (Non-Windows logic remains same or similar fallback) ...
        try {
            mainWindow.setAlwaysOnTop(true, 'screen-saver');
            const focusInterval = setInterval(() => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.focus();
                    mainWindow.moveTop();
                }
            }, 50);

            shell.openExternal(normalizedUrl).catch(err => console.error('Failed to open external URL:', err));

            setTimeout(() => {
                clearInterval(focusInterval);
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.setAlwaysOnTop(false);
                    mainWindow.focus();
                }
            }, 2000);
        } catch (error) {
            console.error('Background open error:', error);
        }
    } else {
        // Default behavior: open externally (non-background / no options)
        try {
            if (process.platform === 'win32') {
                // On Windows, prefer forcing a maximized Chrome window when available
                await openExternalMaximized(normalizedUrl);
                return { success: true };
            }

            await shell.openExternal(normalizedUrl);
            return { success: true };
        } catch (error) {
            console.error('Failed to open external URL:', error);
            return { success: false, error: error.message };
        }
    }

    return { success: true };
});


function createWindow() {
    if (process.platform === 'darwin') {
        const dockIconPath = path.join(__dirname, 'public/ChatGPT Image 21 يناير 2026، 04_27_04 ص.png  ( 2 ).png');
        if (fs.existsSync(dockIconPath)) {
            app.dock.setIcon(dockIconPath);
        }
    }

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: process.platform === 'win32'
            ? path.join(__dirname, 'public/ChatGPT Image 21 يناير 2026، 04_27_04 ص.png  ( 2 ).ico')
            : path.join(__dirname, 'public/ChatGPT Image 21 يناير 2026، 04_27_04 ص.png  ( 2 ).png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    const template = [
        ...(process.platform === 'darwin' ? [{
            label: app.name,
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        }] : []),
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    if (process.platform !== 'darwin') {
        mainWindow.setAutoHideMenuBar(true);
        mainWindow.setMenuBarVisibility(false);
    }

    const isDev = !app.isPackaged;
    
    // Determine dynamic port
    let port = process.env.PORT || 5173;
    const portArgIndex = process.argv.indexOf('--port');
    if (portArgIndex !== -1 && process.argv.length > portArgIndex + 1) {
        port = parseInt(process.argv[portArgIndex + 1], 10);
    }

    const startUrl = isDev
        ? `http://localhost:${port}`
        : `file://${path.join(__dirname, 'dist/index.html')}`;

    mainWindow.maximize();
    mainWindow.loadURL(startUrl);

    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => (mainWindow = null));

    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.type === 'keyDown') {
            const hasCmdOrCtrl = input.control || input.meta;
            const isR = input.code === 'KeyR';
            const isF5 = input.code === 'F5';

            // Refresh shortcuts: F5 (without shift), Ctrl+R, Cmd+R
            if (isF5 || (hasCmdOrCtrl && isR)) {
                if (input.shift) {
                    if (isR) {
                        mainWindow.webContents.reloadIgnoringCache();
                        event.preventDefault();
                    }
                    // For Shift+F5, let it pass through to React
                } else {
                    mainWindow.webContents.reload();
                    event.preventDefault();
                }
            }

            // DevTools: Ctrl+Shift+I / Cmd+Option+I
            const isDevTools = (process.platform === 'darwin' && input.alt && input.meta && input.code === 'KeyI') ||
                               (process.platform !== 'darwin' && input.control && input.shift && input.code === 'KeyI');
            if (isDevTools) {
                mainWindow.webContents.toggleDevTools();
                event.preventDefault();
            }

            if (input.key === 'Escape') {
                mainWindow.webContents.send('escape-pressed');
            }
        }
    });

    // Intercept internal links and redirect to WebModal
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.includes('quranreport.vercel.app')) {
            mainWindow.webContents.send('navigate-internal', url);
            return { action: 'deny' };
        }
        // For actual external links, open in system browser but deny the new electron window
        shell.openExternal(url);
        return { action: 'deny' };
    });
}

function resolveLocalFilePathFromUrl(requestUrl) {
    const raw = String(requestUrl || '').replace(/^local-file:\/\//i, '');
    const decoded = decodeURIComponent(raw);
    // Handle Windows URLs like /C:/Users/... produced by URL parsing
    return decoded.replace(/^\/([a-zA-Z]:[\\/])/, '$1');
}

function registerLocalFileProtocol() {
    try {
        protocol.registerFileProtocol('local-file', (request, callback) => {
            try {
                const filePath = resolveLocalFilePathFromUrl(request.url);
                if (!filePath || !fs.existsSync(filePath)) {
                    callback({ error: -6 }); // FILE_NOT_FOUND
                    return;
                }
                callback({ path: filePath });
            } catch (error) {
                console.error('Failed to resolve local-file request:', request.url, error);
                callback({ error: -2 }); // FAILED
            }
        });
    } catch (error) {
        console.error('Failed to register local-file protocol:', error);
    }
}

app.whenReady().then(() => {
    registerAppUpdates({ app, ipcMain, shell, dialog, getMainWindow: () => mainWindow });
    chromeTabBridge.start();
    registerLocalFileProtocol();
    createWindow();
    initializeLastSyncedState();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

// --- Data Persistence IPC ---
const DATA_PATH = path.join(app.getPath('userData'), 'data.json');
const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');
const TAJWEED_BANK_PATH = path.join(app.getPath('userData'), 'tajweed-bank.json');
const TAJWEED_SUBMISSIONS_PATH = path.join(app.getPath('userData'), 'tajweed-submissions.json');
const TAJWEED_AUDIO_DIR = process.platform === 'win32'
    ? 'Z:\\تسجيلات الطلبة الصوتية'
    : path.join(app.getPath('userData'), 'tajweed-audio');
const CLOUD_APPSTATE_URL = 'https://quran-classes-tracker-default-rtdb.firebaseio.com/appState.json';

// Durable baseline, conditional record uploads, and hash-verified incremental reads.
const LAST_SYNCED_PATH = path.join(app.getPath('userData'), 'last-synced-state.json');
const PENDING_SYNC_PATH = path.join(app.getPath('userData'), 'pending-sync.json');
const SYNC_METADATA_PATH = path.join(app.getPath('userData'), 'sync-metadata.json');
function writeJsonAtomic(file, value) {
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(value));
    fs.renameSync(`${file}.tmp`, file);
}
function readJson(file, fallback = {}) {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
}
let syncEngine;
let localRevision = 0;
let stagedPull = null;
let pullSequence = 0;
let operation = Promise.resolve();
function withSyncLock(work) {
    const result = operation.then(work);
    operation = result.catch(() => {});
    return result;
}
const initializeLastSyncedState = () => {
    // Fail closed on corrupt metadata; never turn an unreadable baseline into an
    // empty baseline and overwrite cloud records. Existing backups stay intact.
    syncEngine = createSelectiveSync({
        client: createFirebaseClient(CLOUD_APPSTATE_URL.replace(/\.json$/, '')),
        baseline: readJson(LAST_SYNCED_PATH),
        metadata: readJson(SYNC_METADATA_PATH),
        saveBaseline: data => writeJsonAtomic(LAST_SYNCED_PATH, data),
        saveMetadata: data => writeJsonAtomic(SYNC_METADATA_PATH, data),
        archiveConflict: data => {
            const folder = path.join(app.getPath('userData'), 'sync-conflicts');
            fs.mkdirSync(folder, { recursive: true });
            writeJsonAtomic(path.join(folder, `${Date.now()}-${require('node:crypto').randomUUID()}.json`), data);
        },
    });
    const local = readJson(DATA_PATH, readJson(PENDING_SYNC_PATH, null));
    if (local && (fs.existsSync(PENDING_SYNC_PATH) || Object.keys(syncEngine.patchFor(local)).length || syncEngine.hasNotification())) queueFirebaseSync(local);
};
const performFirebaseSync = data => withSyncLock(async () => {
    stagedPull = null;
    const timestamp = await syncEngine.push(data);
    if (timestamp && mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('cloud-sync-success', timestamp);
    return timestamp;
});

const syncQueue = createSyncQueue({
    send: performFirebaseSync,
    savePending: (data) => {
        const tempPath = `${PENDING_SYNC_PATH}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify(data));
        fs.renameSync(tempPath, PENDING_SYNC_PATH);
    },
    clearPending: () => { if (fs.existsSync(PENDING_SYNC_PATH)) fs.unlinkSync(PENDING_SYNC_PATH); },
    onChange: (status) => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('sync-status', status);
    },
});
const queueFirebaseSync = (data) => syncQueue.enqueue(data);

ipcMain.handle('get-sync-status', () => ({ ...syncQueue.status(), conflict: !!syncEngine?.conflicts().length }));
ipcMain.handle('retry-sync', () => syncQueue.flush());

let cloudPullPromise = null;
ipcMain.handle('get-cloud-changes', () => {
    if (cloudPullPromise) return cloudPullPromise;
    cloudPullPromise = withSyncLock(async () => {
        if (!syncEngine) return { busy: true };
        if (syncQueue.status().hasPending) return { busy: true };
        const revision = localRevision;
        const result = await syncEngine.pull();
        if (revision !== localRevision || syncQueue.status().hasPending) return { busy: true };
        const token = ++pullSequence;
        stagedPull = { token, revision, baseline: result.baseline };
        return { changes: result.changes, token };
    }).finally(() => { cloudPullPromise = null; });
    return cloudPullPromise;
});
ipcMain.handle('get-sync-conflicts', () => {
    if (!syncEngine) return [];
    const conflicts = syncEngine.conflicts();
    if (!conflicts.length) return [];
    const local = cloudProjection(readJson(DATA_PATH), syncEngine.baseline());
    return conflicts.map(item => ({ ...item, localValue: get(local, item.path) }));
});
ipcMain.handle('resolve-sync-conflict', (_event, conflictPath, choice, etag) => withSyncLock(async () => {
    const { localizeAudioPaths } = await import('./localize-audio.mjs');
    const revision = localRevision;
    const data = readJson(DATA_PATH);
    const result = await syncEngine.resolve(conflictPath, choice, etag, data);
    if (result.changed || revision !== localRevision) return { success: false, changed: true };
    // Locate the original local key (report keys may contain Firebase-forbidden dots).
    const keys = result.path.split('/');
    let node = data;
    for (const key of keys.slice(0, -1)) {
        const localKey = Object.keys(node).find(candidate => Object.keys(sanitizeKeys({ [candidate]: true }))[0] === key) || key;
        if (!Object.hasOwn(node, localKey)) Object.defineProperty(node, localKey, { value: {}, writable: true, enumerable: true, configurable: true });
        node = node[localKey];
    }
    const key = Object.keys(node).find(candidate => Object.keys(sanitizeKeys({ [candidate]: true }))[0] === keys.at(-1)) || keys.at(-1);
    if (result.value === null) delete node[key];
    else Object.defineProperty(node, key, { value: localizeAudioPaths(result.value, node[key]), writable: true, enumerable: true, configurable: true });
    writeLocalData(data);
    localRevision++;
    stagedPull = null;
    syncQueue.enqueue(data);
    syncEngine.finishResolution(conflictPath);
    if (!syncEngine.conflicts().length) setImmediate(() => { void syncQueue.flush(); });
    return { success: true };
}));

ipcMain.handle('save-zoom', async (event, zoomFactor) => {
    try {
        let settings = {};
        if (fs.existsSync(SETTINGS_PATH)) {
            try {
                settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
            } catch (e) {
                console.error('Failed to parse settings.json:', e);
            }
        }
        settings.appZoomLevel = zoomFactor;
        fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
        return { success: true };
    } catch (error) {
        console.error('Failed to save zoom:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('load-zoom', async () => {
    try {
        if (fs.existsSync(SETTINGS_PATH)) {
            const data = fs.readFileSync(SETTINGS_PATH, 'utf8');
            const settings = JSON.parse(data);
            if (settings && typeof settings.appZoomLevel === 'number') {
                return settings.appZoomLevel;
            }
        }
    } catch (error) {
        console.error('Failed to load zoom:', error);
    }
    return null;
});

function writeLocalData(data) {
    writeJsonAtomic(DATA_PATH, data);
    if (Object.hasOwn(data, 'tajweedBank')) writeJsonAtomic(TAJWEED_BANK_PATH, data.tajweedBank || {});
    if (Object.hasOwn(data, 'tajweedSubmissions')) writeJsonAtomic(TAJWEED_SUBMISSIONS_PATH, data.tajweedSubmissions || {});
}
ipcMain.handle('save-data', async (_event, data, skipSync, token) => {
    try {
        if (skipSync) {
            if (!stagedPull || stagedPull.token !== token || stagedPull.revision !== localRevision || syncQueue.status().hasPending) {
                return { success: false, busy: true, error: 'Local data changed while receiving cloud data' };
            }
            // Commit local data before the baseline; a crash can at worst cause a
            // redundant conditional upload, never acknowledge data not saved locally.
            writeLocalData(data);
            syncEngine.commit(stagedPull.baseline);
            stagedPull = null;
        } else {
            writeLocalData(data);
            localRevision++;
            stagedPull = null;
            if (syncQueue.status().hasPending || Object.keys(syncEngine.patchFor(data)).length || syncEngine.hasNotification()) queueFirebaseSync(data);
        }
        return { success: true };
    } catch (error) {
        console.error('Failed to save data:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('load-data', async () => {
    try {
        let parsedData = null;

        if (fs.existsSync(DATA_PATH)) {
            const data = fs.readFileSync(DATA_PATH, 'utf8');
            parsedData = JSON.parse(data);
        }

        if (fs.existsSync(TAJWEED_BANK_PATH)) {
            try {
                const bankRaw = fs.readFileSync(TAJWEED_BANK_PATH, 'utf8');
                const parsedBank = JSON.parse(bankRaw);

                if (parsedBank && typeof parsedBank === 'object' && !Array.isArray(parsedBank)) {
                    parsedData = parsedData && typeof parsedData === 'object' ? parsedData : {};
                    parsedData.tajweedBank = parsedBank;
                }
            } catch (bankError) {
                console.error('Failed to load Tajweed bank backup file:', bankError);
            }
        }

        if (fs.existsSync(TAJWEED_SUBMISSIONS_PATH)) {
            try {
                const submissionsRaw = fs.readFileSync(TAJWEED_SUBMISSIONS_PATH, 'utf8');
                const parsedSubmissions = JSON.parse(submissionsRaw);

                if (parsedSubmissions && typeof parsedSubmissions === 'object' && !Array.isArray(parsedSubmissions)) {
                    parsedData = parsedData && typeof parsedData === 'object' ? parsedData : {};
                    parsedData.tajweedSubmissions = parsedSubmissions;
                }
            } catch (submissionError) {
                console.error('Failed to load Tajweed submissions backup file:', submissionError);
            }
        }

        return parsedData; // Can be null if no files exist
    } catch (error) {
        console.error('Failed to load data:', error);
        return null;
    }
});

ipcMain.handle('save-tajweed-audio', async (event, base64Data, fileName) => {
    try {
        if (typeof base64Data !== 'string' || !base64Data.trim()) {
            return { success: false, error: 'Invalid audio payload' };
        }

        const raw = base64Data.includes('base64,') ? base64Data.split('base64,')[1] : base64Data;
        const safeBaseName = (typeof fileName === 'string' && fileName.trim() ? fileName.trim() : `tajweed_${Date.now()}.webm`)
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');

        const hasExt = path.extname(safeBaseName).length > 0;
        const finalFileName = hasExt ? safeBaseName : `${safeBaseName}.webm`;

        if (!fs.existsSync(TAJWEED_AUDIO_DIR)) {
            fs.mkdirSync(TAJWEED_AUDIO_DIR, { recursive: true });
        }

        const localPath = path.join(TAJWEED_AUDIO_DIR, finalFileName);
        fs.writeFileSync(localPath, Buffer.from(raw, 'base64'));

        return { success: true, localPath };
    } catch (error) {
        console.error('Failed to save Tajweed audio:', error);
        return { success: false, error: error.message };
    }
});

// --- Export Monthly Report to PDF ---
ipcMain.handle('export-monthly-pdf', async (event, { htmlContent, defaultFileName }) => {
    let pdfWindow = null;
    try {
        const safeName = (defaultFileName || 'Monthly_Report.pdf').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
        const saveResult = await dialog.showSaveDialog(mainWindow, {
            title: 'حفظ التقرير الشهري PDF',
            defaultPath: path.join(app.getPath('downloads'), safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`),
            filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
        });

        if (saveResult.canceled || !saveResult.filePath) {
            return { success: false, canceled: true };
        }

        pdfWindow = new BrowserWindow({
            width: 850,
            height: 1150,
            show: false,
            webPreferences: {
                offscreen: true,
                contextIsolation: true
            }
        });

        await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
        // Give fonts and layout a brief moment to settle
        await waitForTimeout(450);

        const pdfBuffer = await pdfWindow.webContents.printToPDF({
            printBackground: true,
            pageSize: 'A4',
            margins: {
                marginType: 'custom',
                top: 0.35,
                bottom: 0.35,
                left: 0.35,
                right: 0.35
            }
        });

        fs.writeFileSync(saveResult.filePath, pdfBuffer);
        shell.openPath(saveResult.filePath).catch(() => {});

        return { success: true, filePath: saveResult.filePath };
    } catch (error) {
        console.error('Failed to export PDF:', error);
        return { success: false, error: error.message };
    } finally {
        if (pdfWindow && !pdfWindow.isDestroyed()) {
            pdfWindow.close();
        }
    }
});

// --- Select Folder Dialog ---
ipcMain.handle('select-backup-folder', async () => {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'اختر مجلد الحفظ التلقائي'
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
});

// --- Save Backup to Path (Silent, Rotating) ---
ipcMain.handle('save-backup-to-path', async (event, { folderPath, data, maxFiles }) => {
    try {
        if (!folderPath || !data) return { success: false, error: 'Missing folderPath or data' };

        const max = maxFiles || 10;

        // Ensure folder exists
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }

        // Generate filename with timestamp
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const filename = `quran_tracker_backup_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}.json`;
        const filePath = path.join(folderPath, filename);

        // Write the backup file
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

        // Rotate: get all backup files, sort by modification time, delete oldest if exceeding max
        const allFiles = fs.readdirSync(folderPath)
            .filter(f => f.startsWith('quran_tracker_backup_') && f.endsWith('.json'))
            .map(f => ({
                name: f,
                path: path.join(folderPath, f),
                mtime: fs.statSync(path.join(folderPath, f)).mtimeMs
            }))
            .sort((a, b) => b.mtime - a.mtime); // Newest first

        if (allFiles.length > max) {
            const toDelete = allFiles.slice(max);
            for (const file of toDelete) {
                fs.unlinkSync(file.path);
            }
        }

        return { success: true, filePath, totalFiles: Math.min(allFiles.length, max) };
    } catch (error) {
        console.error('Failed to save backup:', error);
        return { success: false, error: error.message };
    }
});

let allowQuit = false;
let quitInProgress = false;
// Try the pending upload before a normal application quit. A forced OS shutdown
// can bypass this event; the pending snapshot will still be retried next launch.
app.on('before-quit', async (event) => {
    if (!allowQuit && syncQueue.status().hasPending) {
        event.preventDefault();
        if (quitInProgress) return;
        quitInProgress = true;
        const status = await syncQueue.flush();
        if (status.hasPending) {
            const result = await dialog.showMessageBox({
                type: 'warning',
                buttons: ['العودة للتطبيق', 'إغلاق رغم عدم المزامنة'],
                defaultId: 0,
                cancelId: 0,
                title: 'المزامنة لم تكتمل',
                message: 'توجد تعديلات لم تُرفع بعد.',
                detail: 'ستظل محفوظة على هذا الجهاز وستُحاول المزامنة مرة أخرى عند فتح التطبيق. لن تظهر على الجهاز الآخر حتى تنجح المزامنة.',
            });
            if (result.response === 0) {
                quitInProgress = false;
                if (!mainWindow || mainWindow.isDestroyed()) createWindow();
                return;
            }
        }
        allowQuit = true;
        app.quit();
        return;
    }

});
