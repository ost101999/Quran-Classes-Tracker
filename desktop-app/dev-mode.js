const fs = require('fs');
const path = require('path');
const net = require('net');
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');

const FULL_DEV_ENV = 'QCT_DEV_FULL';
const INSTALLED_APP_ENV = 'QCT_INSTALLED_APP_PATH';
const DESKTOP_FOLDER = 'desktop-app';
const ENGINE_FILES = [
    'main.js',
    'preload.js',
    'dev-mode.js',
    'app-update.js',
    'calendar-schedules.js',
    'chrome-tab-bridge.js',
    'sync-queue.js',
    'sync-merge.js',
    'selective-sync.js',
    'firebase-client.js',
    'firebase-patch.js',
    'firebase-hash.js',
];

function registerDevMode({ app, ipcMain, dialog, getMainWindow }) {
    let child = null;
    let active = process.env[FULL_DEV_ENV] === '1';
    let fullSource = process.env[FULL_DEV_ENV] === '1';
    let busy = false;
    let snapshot = null;
    let fullDevUrl = null;
    const appPath = app.getAppPath();
    const desktopPath = path.join(appPath, DESKTOP_FOLDER);
    const baselineRoot = fs.existsSync(path.join(desktopPath, 'main.js')) ? desktopPath : appPath;
    const installedUrl = pathToFileURL(path.join(baselineRoot, 'dist', 'index.html')).href;
    const handoffFile = () => path.join(app.getPath('userData'), 'dev-storage-handoff.json');

    const stop = () => {
        if (child) {
            try { child.kill(); } catch { /* ignore */ }
            child = null;
        }
    };
    app.on('will-quit', stop);

    const validRoot = (root) =>
        Boolean(root) &&
        fs.existsSync(path.join(root, 'package.json')) &&
        fs.existsSync(path.join(root, 'vite.config.ts')) &&
        fs.existsSync(path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'));

    const resolveDesktopRoot = (root) =>
        root && [path.join(root, DESKTOP_FOLDER), root].find(validRoot);

    const findRoot = () => {
        const roots = [];
        try {
            const saved = fs.readFileSync(path.join(app.getPath('userData'), 'project-root.txt'), 'utf8').trim();
            if (saved) roots.push(saved);
        } catch { /* ignore */ }
        try {
            const meta = JSON.parse(fs.readFileSync(path.join(app.getAppPath(), 'project-meta.json'), 'utf8'));
            if (meta?.projectRoot) roots.push(meta.projectRoot);
        } catch { /* ignore */ }
        roots.push(app.getAppPath());
        for (const root of roots) {
            const desktopRoot = resolveDesktopRoot(root);
            if (desktopRoot) return desktopRoot;
        }
        return null;
    };

    const getElectronBinary = (root) => {
        if (!root) return null;
        const bin = process.platform === 'darwin'
            ? path.join(root, 'node_modules', 'electron', 'dist', 'Electron.app', 'Contents', 'MacOS', 'Electron')
            : path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe');
        return fs.existsSync(bin) ? bin : null;
    };

    const getInstalledAppPath = () => {
        if (process.env[INSTALLED_APP_ENV] && fs.existsSync(process.env[INSTALLED_APP_ENV])) {
            return process.env[INSTALLED_APP_ENV];
        }
        if (app.isPackaged) {
            return process.platform === 'darwin'
                ? path.resolve(process.execPath, '../../..')
                : process.execPath;
        }
        return null;
    };

    const fileHash = (filePath) => {
        try {
            if (!fs.existsSync(filePath)) return 'missing';
            return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
        } catch {
            return 'error';
        }
    };

    const baselineHashes = new Map(
        ENGINE_FILES.map((rel) => [rel, fileHash(path.join(baselineRoot, rel))])
    );

    const hasEngineChanges = (root = findRoot()) => {
        if (!root) return false;
        return ENGINE_FILES.some((rel) => {
            const base = baselineHashes.get(rel);
            const live = fileHash(path.join(root, rel));
            return base !== live;
        });
    };

    const saveStorageHandoff = (storage) => {
        if (!storage || typeof storage !== 'object') return;
        try {
            fs.writeFileSync(handoffFile(), JSON.stringify(storage), 'utf8');
        } catch { /* ignore */ }
    };

    const readAndClearStorageHandoff = () => {
        try {
            const fp = handoffFile();
            if (!fs.existsSync(fp)) return null;
            const parsed = JSON.parse(fs.readFileSync(fp, 'utf8'));
            fs.unlinkSync(fp);
            return parsed;
        } catch {
            return null;
        }
    };

    const freePort = () => new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            server.close(() => resolve(port));
        });
    });

    const waitForServer = (port, processRef) => new Promise((resolve, reject) => {
        const deadline = Date.now() + 30000;
        let ended = false;
        const poll = () => {
            if (ended) return;
            if (processRef.exitCode !== null || processRef.signalCode !== null) {
                ended = true;
                return reject(new Error('توقف خادم التطوير قبل بدء التشغيل.'));
            }
            if (Date.now() > deadline) {
                ended = true;
                return reject(new Error('انتهت مهلة تشغيل وضع التطوير.'));
            }
            const request = http.get(`http://127.0.0.1:${port}/`, (response) => {
                response.resume();
                if (response.statusCode === 200) {
                    ended = true;
                    resolve();
                } else {
                    setTimeout(poll, 250);
                }
            });
            request.setTimeout(500, () => request.destroy());
            request.on('error', () => setTimeout(poll, 250));
        };
        poll();
    });

    const startViteServer = async (root) => {
        stop();
        const port = await freePort();
        child = spawn(
            process.execPath,
            [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
            {
                cwd: root,
                env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
                stdio: 'ignore',
                windowsHide: true,
            }
        );
        child.on('error', () => { /* ignore */ });
        await waitForServer(port, child);
        return `http://127.0.0.1:${port}/`;
    };

    const delayedSpawn = (cmd, args, cwd, envObj) => {
        const helperScript = `
          const { spawn } = require('child_process');
          const cfg = JSON.parse(process.argv[1]);
          setTimeout(() => {
            try {
              const p = spawn(cfg.cmd, cfg.args, { cwd: cfg.cwd, env: cfg.env, detached: true, stdio: 'ignore', windowsHide: false });
              p.unref();
            } catch {}
          }, 400);
        `;
        const launcher = spawn(
            process.execPath,
            ['-e', helperScript, JSON.stringify({ cmd, args, cwd, env: envObj })],
            {
                env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
                detached: true,
                stdio: 'ignore',
                windowsHide: true,
            }
        );
        launcher.unref();
    };

    const launchFullSourceProcess = (root, storage) => {
        const electronBin = getElectronBinary(root);
        if (!electronBin) return false;
        saveStorageHandoff(storage);
        const installedAppPath = getInstalledAppPath();
        const childEnv = { ...process.env, [FULL_DEV_ENV]: '1' };
        delete childEnv.ELECTRON_RUN_AS_NODE;
        delete childEnv.VITE_DEV_SERVER_URL;
        if (installedAppPath) childEnv[INSTALLED_APP_ENV] = installedAppPath;
        stop();
        try { app.releaseSingleInstanceLock?.(); } catch { /* ignore */ }
        delayedSpawn(electronBin, ['.'], root, childEnv);
        setTimeout(() => app.exit(0), 60);
        return true;
    };

    const launchInstalledProcess = (storage) => {
        const installedAppPath = getInstalledAppPath();
        if (!installedAppPath) return false;
        saveStorageHandoff(storage);
        const childEnv = { ...process.env };
        delete childEnv.ELECTRON_RUN_AS_NODE;
        delete childEnv[FULL_DEV_ENV];
        delete childEnv[INSTALLED_APP_ENV];
        delete childEnv.VITE_DEV_SERVER_URL;
        stop();
        try { app.releaseSingleInstanceLock?.(); } catch { /* ignore */ }
        if (process.platform === 'darwin') {
            delayedSpawn('open', ['-n', installedAppPath], process.cwd(), childEnv);
        } else {
            delayedSpawn(installedAppPath, [], path.dirname(installedAppPath), childEnv);
        }
        setTimeout(() => app.exit(0), 60);
        return true;
    };

    const resolveProjectRootWithDialog = async (win) => {
        let root = findRoot();
        if (root) return { root };
        const choice = await dialog.showOpenDialog(win || undefined, {
            title: 'اختر مجلد مشروع Quran Classes Tracker',
            properties: ['openDirectory'],
        });
        if (choice.canceled) return { canceled: true };
        root = resolveDesktopRoot(choice.filePaths[0]);
        if (!root) {
            return { error: 'مجلد المشروع غير صالح أو اعتماديات التطوير غير مثبتة.' };
        }
        fs.writeFileSync(path.join(app.getPath('userData'), 'project-root.txt'), root, 'utf8');
        return { root };
    };

    const clearProjectCache = (root) => {
        const normalizedRoot = fs.realpathSync(root) + path.sep;
        const nmPrefix = path.join(root, 'node_modules') + path.sep;
        for (const cachedKey of Object.keys(require.cache)) {
            if (cachedKey.startsWith(normalizedRoot) && !cachedKey.startsWith(nmPrefix)) {
                delete require.cache[cachedKey];
            }
        }
    };

    const requireModule = (relPath) => {
        if (active) {
            const root = findRoot();
            if (root) {
                const candidate = path.resolve(root, relPath);
                try {
                    const resolved = require.resolve(candidate);
                    if (fs.existsSync(resolved)) {
                        clearProjectCache(root);
                        return require(resolved);
                    }
                } catch { /* fallback to packaged module */ }
            }
        }
        return require(path.resolve(baselineRoot, relPath));
    };

    const isAvailable = () => app.isPackaged || fullSource;

    const getStatus = () => {
        const root = findRoot();
        return {
            available: isAvailable(),
            active,
            fullSource,
            mainOutdated: Boolean(active || fullSource) ? hasEngineChanges(root) : false,
            canRelaunchInstalled: Boolean(getInstalledAppPath()),
        };
    };

    ipcMain.handle('dev-mode:status', () => getStatus());

    ipcMain.handle('dev-mode:restore', () => {
        const mem = snapshot;
        snapshot = null;
        return mem || readAndClearStorageHandoff();
    });

    ipcMain.handle('dev-mode:toggle', async (event, payload) => {
        const win = getMainWindow();
        if (!isAvailable() || !win || event.sender !== win.webContents || busy) {
            return { ok: false, error: 'تعذر تغيير وضع التطوير.' };
        }
        const storage = payload && payload.__isDevAction ? payload.storage : payload;
        const requestedAction = payload && payload.__isDevAction ? payload.action : 'auto';
        busy = true;
        try {
            const resolved = await resolveProjectRootWithDialog(win);
            if (resolved.canceled) return { ok: false, canceled: true };
            if (resolved.error || !resolved.root) return { ok: false, error: resolved.error || 'تعذر تحديد مجلد المشروع.' };
            const { root } = resolved;

            if (requestedAction === 'relaunch-full' || (!active && hasEngineChanges(root) && getElectronBinary(root))) {
                if (launchFullSourceProcess(root, storage)) {
                    return { ok: true, relaunching: true };
                }
            }

            if (active && requestedAction === 'auto' && hasEngineChanges(root) && getElectronBinary(root)) {
                if (launchFullSourceProcess(root, storage)) {
                    return { ok: true, relaunching: true };
                }
            }

            if (active && fullSource) {
                if (launchInstalledProcess(storage)) {
                    return { ok: true, relaunching: true };
                }
                return { ok: false, error: 'تعذر العثور على مسار النسخة المثبتة.' };
            }

            let target = installedUrl;
            if (!active) {
                target = await startViteServer(root);
            }
            snapshot = storage;
            const entering = !active;
            setImmediate(async () => {
                try {
                    active = entering;
                    await win.loadURL(target);
                    if (!entering) stop();
                } catch {
                    stop();
                    active = false;
                    try { await win.loadURL(installedUrl); } catch { /* ignore */ }
                    dialog.showErrorBox('وضع التطوير', 'تعذر تحميل الواجهة.');
                } finally {
                    busy = false;
                }
            });
            return { ok: true };
        } catch (error) {
            stop();
            return { ok: false, error: String(error?.message || error) };
        } finally {
            if (!snapshot) busy = false;
        }
    });

    const prepareFullDevUrl = async () => {
        if (!fullSource) return null;
        const root = findRoot();
        if (!root) return null;
        try {
            fullDevUrl = await startViteServer(root);
            return fullDevUrl;
        } catch {
            return null;
        }
    };

    return {
        isActive: () => active,
        isFullSource: () => fullSource,
        requireModule,
        prepareFullDevUrl,
        getOverrideStartUrl: () => fullDevUrl,
    };
}

module.exports = { registerDevMode };
