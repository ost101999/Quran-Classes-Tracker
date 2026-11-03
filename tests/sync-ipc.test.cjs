const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { createSyncQueue } = require('../sync-queue');
const { createSelectiveSync, cloudProjection, get, set } = require('../selective-sync');
const { sanitizeKeys } = require('../firebase-patch');
const { firebaseHash } = require('../firebase-hash');
const copy = value => JSON.parse(JSON.stringify(value));
const etag = value => `"${firebaseHash(value) || 'null_etag'}"`;
function harness(t) {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'quran-sync-ipc-test-'));
    t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
    const data = { students: [], savedReports: { old: 'base' }, tajweedBank: { a: { title: 'bank', questions: [] } } };
    for (const file of ['data.json', 'last-synced-state.json']) fs.writeFileSync(path.join(folder, file), JSON.stringify(data));
    const remote = copy(data), handlers = new Map();
    const client = {
        async probe(key) { return { etag: etag(get(remote, key)) }; },
        async read(key) { const value = copy(get(remote, key)); return { value, etag: etag(value) }; },
        async put(key, value, expected) {
            if (expected && expected !== etag(get(remote, key))) throw Object.assign(new Error('conflict'), { status: 412 });
            set(remote, key, value?.['.sv'] ? Date.now() : value);
            return {};
        },
    };
    const source = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
    // Exercise the actual main-process IPC handlers against a temporary profile,
    // not copies of their race checks. No Electron launch or network is involved.
    const code = source.slice(source.indexOf("const DATA_PATH ="), source.indexOf("ipcMain.handle('load-data'"));
    const context = vm.createContext({
        fs, path, process, console, require, setTimeout, clearTimeout, setImmediate,
        app: { getPath: () => folder }, mainWindow: null,
        ipcMain: { handle: (key, handler) => handlers.set(key, handler) },
        createSyncQueue, createSelectiveSync, cloudProjection, get, sanitizeKeys,
        localizeAudioModule: import('../localize-audio.mjs'),
        createFirebaseClient: () => client,
    });
    vm.runInContext(`${code.replace("await import('./localize-audio.mjs')", "await localizeAudioModule")}\ninitializeLastSyncedState();`, context);
    return { data, remote, call: (name, ...args) => handlers.get(name)(null, ...args), disk: file => JSON.parse(fs.readFileSync(path.join(folder, file), 'utf8')) };
}

test('main rejects a staged pull if a local save happened while receiving it', async t => {
    const h = harness(t);
    h.remote.savedReports.remote = 'incoming';
    const staged = await h.call('get-cloud-changes');
    const local = copy(h.data); local.savedReports.local = 'new local';
    assert.equal((await h.call('save-data', local, false)).success, true);
    const result = await h.call('save-data', { ...local, ...staged.changes }, true, staged.token);
    assert.equal(result.busy, true);
    assert.equal(h.disk('data.json').savedReports.local, 'new local');
    await h.call('retry-sync');
    const received = await h.call('get-cloud-changes');
    assert.equal(received.changes.savedReports.remote, 'incoming');
    assert.equal(received.changes.savedReports.local, 'new local');
});

test('main commits received records and raw baseline together; repeating a save produces no upload', async t => {
    const h = harness(t);
    h.remote.savedReports.remote = 'incoming';
    const received = await h.call('get-cloud-changes');
    const merged = { ...h.data, ...received.changes };
    assert.equal((await h.call('save-data', merged, true, received.token)).success, true);
    assert.equal(h.disk('last-synced-state.json').savedReports.remote, 'incoming');
    assert.equal((await h.call('save-data', merged, false)).success, true);
    assert.equal((await h.call('get-sync-status')).hasPending, false);
});

test('resolving through IPC preserves other edits, persists choice, and resumes the queue', async t => {
    const h = harness(t);
    h.remote.savedReports.old = 'remote edit';
    const local = copy(h.data); local.savedReports.old = 'local edit'; local.savedReports.new = 'unrelated';
    await h.call('save-data', local, false);
    await h.call('retry-sync');
    const [conflict] = await h.call('get-sync-conflicts');
    assert.equal(conflict.localValue, 'local edit');
    const result = await h.call('resolve-sync-conflict', conflict.path, 'remote', conflict.remoteEtag);
    assert.equal(result.success, true);
    await new Promise(resolve => setImmediate(resolve));
    await h.call('retry-sync');
    assert.equal(h.disk('data.json').savedReports.old, 'remote edit');
    assert.equal(h.remote.savedReports.new, 'unrelated');
    assert.equal((await h.call('get-sync-status')).hasPending, false);
    assert.equal((await h.call('get-sync-conflicts')).length, 0);
});
