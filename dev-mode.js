const fs = require('fs');
const path = require('path');
const net = require('net');
const http = require('http');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');

function registerDevMode({ app, ipcMain, dialog, getMainWindow }) {
    let child = null;
    let active = false;
    let busy = false;
    let snapshot = null;
    const installedUrl = pathToFileURL(path.join(app.getAppPath(), 'dist', 'index.html')).href;
    const stop = () => { if (child) { child.kill(); child = null; } };
    app.on('will-quit', stop);
    const validRoot = root => root && fs.existsSync(path.join(root, 'package.json')) && fs.existsSync(path.join(root, 'vite.config.ts')) && fs.existsSync(path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'));
    const findRoot = () => {
        const roots = [];
        try { roots.push(fs.readFileSync(path.join(app.getPath('userData'), 'project-root.txt'), 'utf8').trim()); } catch {}
        try { roots.push(JSON.parse(fs.readFileSync(path.join(app.getAppPath(), 'project-meta.json'), 'utf8')).projectRoot); } catch {}
        roots.push(app.getAppPath());
        return roots.find(validRoot);
    };
    const freePort = () => new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); });
    });
    const waitForServer = (port, processRef) => new Promise((resolve, reject) => {
        const deadline = Date.now() + 30000;
        let ended = false;
        const poll = () => {
            if (ended) return;
            if (processRef.exitCode !== null || processRef.signalCode !== null) { ended = true; return reject(new Error('توقف خادم التطوير قبل بدء التشغيل.')); }
            if (Date.now() > deadline) { ended = true; return reject(new Error('انتهت مهلة تشغيل وضع التطوير.')); }
            const request = http.get(`http://127.0.0.1:${port}/`, response => { response.resume(); if (response.statusCode === 200) { ended = true; resolve(); } else setTimeout(poll, 250); });
            request.setTimeout(500, () => request.destroy());
            request.on('error', () => setTimeout(poll, 250));
        };
        poll();
    });
    ipcMain.handle('dev-mode:status', () => ({ available: app.isPackaged, active }));
    ipcMain.handle('dev-mode:restore', () => { const result = snapshot; snapshot = null; return result; });
    ipcMain.handle('dev-mode:toggle', async (event, storage) => {
        const win = getMainWindow();
        if (!app.isPackaged || !win || event.sender !== win.webContents || busy) return { ok: false, error: 'تعذر تغيير وضع التطوير.' };
        busy = true;
        try {
            let target = installedUrl;
            if (!active) {
                let root = findRoot();
                if (!root) {
                    const choice = await dialog.showOpenDialog(win, { title: 'اختر مجلد مشروع Quran Classes Tracker', properties: ['openDirectory'] });
                    if (choice.canceled) return { ok: false, canceled: true };
                    root = choice.filePaths[0];
                    if (!validRoot(root)) return { ok: false, error: 'مجلد المشروع غير صالح أو اعتماديات التطوير غير مثبتة.' };
                    fs.writeFileSync(path.join(app.getPath('userData'), 'project-root.txt'), root, 'utf8');
                }
                const port = await freePort();
                child = spawn(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, stdio: 'ignore', windowsHide: true });
                child.on('error', () => {});
                await waitForServer(port, child);
                target = `http://127.0.0.1:${port}/`;
            }
            snapshot = storage;
            const entering = !active;
            setImmediate(async () => {
                try { active = entering; await win.loadURL(target); if (!entering) stop(); }
                catch (error) { stop(); active = false; try { await win.loadURL(installedUrl); } catch {} dialog.showErrorBox('وضع التطوير', 'تعذر تحميل الواجهة.'); }
                finally { busy = false; }
            });
            return { ok: true };
        } catch (error) { stop(); return { ok: false, error: String(error.message || error) }; }
        finally { if (!snapshot) busy = false; }
    });
}
module.exports = { registerDevMode };
