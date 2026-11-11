const path = require('path');
const fs = require('fs');
const { execFileSync, spawn } = require('child_process');

const REPO = 'ost101999/Quran-Classes-Tracker';
const BRANCH = 'main';
const TOOLS_DIR = 'build-tools';
const MAC_SCRIPT = 'BuildAndInstallMac.command';
const WIN_SCRIPT = 'Build.ps1';

function isVersionNewer(candidate, current) {
    const parts = value => String(value).replace(/^v/i, '').split(/[.-]/).map(part => Number.parseInt(part, 10) || 0);
    const a = parts(candidate);
    const b = parts(current);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const diff = (a[i] || 0) - (b[i] || 0);
        if (diff !== 0) return diff > 0;
    }
    return false;
}

/**
 * Version = <major>.<minor>.<number of commits>.  Installed builds carry it in
 * package.json (written by build-with-version.cjs); dev runs compute it from git.
 */
function registerAppUpdates({ app, ipcMain, shell, dialog, getMainWindow }) {
    let cachedVersion = null;
    let latestUrl = `https://github.com/${REPO}/commits/${BRANCH}`;

    function getCurrentVersion() {
        if (cachedVersion) return cachedVersion;
        const base = app.getVersion();
        cachedVersion = base;
        if (!app.isPackaged) {
            try {
                const count = Number.parseInt(execFileSync('git', ['rev-list', '--count', 'HEAD'], {
                    cwd: app.getAppPath(),
                    encoding: 'utf8',
                    stdio: ['ignore', 'pipe', 'ignore']
                }).trim(), 10);
                if (Number.isFinite(count) && count > 0) {
                    const [major, minor] = base.split('.');
                    cachedVersion = `${Number.parseInt(major, 10) || 0}.${Number.parseInt(minor, 10) || 0}.${count}`;
                }
            } catch { /* keep package.json version */ }
        }
        return cachedVersion;
    }

    async function fetchLatestVersion() {
        const response = await fetch(`https://api.github.com/repos/${REPO}/commits?sha=${BRANCH}&per_page=1`, {
            headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Quran-Classes-Tracker' },
            signal: AbortSignal.timeout(15000)
        });
        if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
        const link = response.headers.get('link') || '';
        const last = link.match(/[?&]page=(\d+)>;\s*rel="last"/i);
        let count = last ? Number.parseInt(last[1], 10) : 0;
        if (!count) {
            const commits = await response.json();
            count = Array.isArray(commits) ? commits.length : 0;
        }
        if (!Number.isFinite(count) || count <= 0) throw new Error('Could not read the commit count');
        const [major, minor] = getCurrentVersion().split('.');
        return `${Number.parseInt(major, 10) || 0}.${Number.parseInt(minor, 10) || 0}.${count}`;
    }

    function scriptName() {
        return process.platform === 'darwin' ? MAC_SCRIPT : WIN_SCRIPT;
    }

    function findBuildScript() {
        const roots = [];
        try {
            const saved = fs.readFileSync(path.join(app.getPath('userData'), 'project-root.txt'), 'utf8').trim();
            if (saved) roots.push(saved);
        } catch { /* not saved yet */ }
        try {
            const meta = JSON.parse(fs.readFileSync(path.join(app.getAppPath(), 'project-meta.json'), 'utf8'));
            if (meta.projectRoot) roots.push(meta.projectRoot);
        } catch { /* no build metadata */ }
        roots.push(app.getAppPath());

        for (const root of roots) {
            const candidate = path.join(root, TOOLS_DIR, scriptName());
            if (fs.existsSync(candidate)) return candidate;
        }
        return null;
    }

    ipcMain.handle('app-update:check', async () => {
        const current = getCurrentVersion();
        try {
            const latest = await fetchLatestVersion();
            return { status: isVersionNewer(latest, current) ? 'available' : 'up-to-date', current, latest };
        } catch (error) {
            return { status: 'error', current, error: String(error && error.message || error) };
        }
    });

    ipcMain.handle('app-update:start', async () => {
        let script = findBuildScript();

        if (!script) {
            const win = getMainWindow();
            const picked = await dialog.showOpenDialog(win || undefined, {
                title: 'اختر مجلد مشروع Quran Classes Tracker',
                properties: ['openDirectory']
            });
            if (!picked.canceled && picked.filePaths[0]) {
                try {
                    fs.writeFileSync(path.join(app.getPath('userData'), 'project-root.txt'), picked.filePaths[0], 'utf8');
                } catch { /* ignore */ }
                script = findBuildScript();
            }
        }

        if (!script) {
            await shell.openExternal(latestUrl);
            return { started: false };
        }

        if (process.platform === 'darwin') {
            spawn('open', [script], { detached: true, stdio: 'ignore' }).unref();
        } else {
            spawn('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-NoExit', '-File', script], {
                detached: true,
                stdio: 'ignore'
            }).unref();
        }
        return { started: true };
    });
}

module.exports = { registerAppUpdates };

