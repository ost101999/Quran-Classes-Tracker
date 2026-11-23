const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { registerDevMode } = require('../dev-mode');

test('dev-mode detects engine changes and live-reloads backend modules when full source is active', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qct-devmode-'));
    try {
        const baselineDir = path.join(tmp, 'baseline');
        const repoDir = path.join(tmp, 'project');
        const projectDir = path.join(repoDir, 'desktop-app');
        const userDataDir = path.join(tmp, 'userData');
        fs.mkdirSync(path.join(baselineDir, 'audio-mushaf'), { recursive: true });
        fs.mkdirSync(path.join(projectDir, 'node_modules', 'vite', 'bin'), { recursive: true });
        fs.mkdirSync(path.join(projectDir, 'audio-mushaf'), { recursive: true });
        fs.mkdirSync(userDataDir, { recursive: true });

        fs.writeFileSync(path.join(baselineDir, 'main.js'), 'const v = 1;\n', 'utf8');
        fs.writeFileSync(path.join(projectDir, 'main.js'), 'const v = 1;\n', 'utf8');
        fs.writeFileSync(path.join(projectDir, 'package.json'), '{}', 'utf8');
        fs.writeFileSync(path.join(projectDir, 'vite.config.ts'), '', 'utf8');
        fs.writeFileSync(path.join(projectDir, 'node_modules', 'vite', 'bin', 'vite.js'), '', 'utf8');
        fs.writeFileSync(path.join(userDataDir, 'project-root.txt'), repoDir, 'utf8');

        const helperFile = path.join(projectDir, 'audio-mushaf', 'sample.js');
        fs.writeFileSync(helperFile, 'module.exports = { value: "first" };\n', 'utf8');

        const handlers = new Map();
        const prevFull = process.env.QCT_DEV_FULL;
        process.env.QCT_DEV_FULL = '1';
        try {
            const devMode = registerDevMode({
                app: {
                    isPackaged: false,
                    getAppPath: () => baselineDir,
                    getPath: () => userDataDir,
                    on: () => {},
                },
                ipcMain: {
                    handle: (name, fn) => handlers.set(name, fn),
                },
                dialog: {},
                getMainWindow: () => null,
            });

            assert.equal(devMode.isActive(), true);
            assert.equal(devMode.requireModule('./audio-mushaf/sample.js').value, 'first');

            fs.writeFileSync(helperFile, 'module.exports = { value: "second" };\n', 'utf8');
            assert.equal(devMode.requireModule('./audio-mushaf/sample.js').value, 'second');

            assert.equal(handlers.get('dev-mode:status')().mainOutdated, false);
            fs.writeFileSync(path.join(projectDir, 'main.js'), 'const v = 2;\n', 'utf8');
            assert.equal(handlers.get('dev-mode:status')().mainOutdated, true);
        } finally {
            if (prevFull === undefined) delete process.env.QCT_DEV_FULL;
            else process.env.QCT_DEV_FULL = prevFull;
        }
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
});
