const test = require('node:test');
const assert = require('node:assert/strict');
const { createSelectiveSync, get, set } = require('../selective-sync');
const { firebaseHash, hashChildren } = require('../firebase-hash');
const copy = value => JSON.parse(JSON.stringify(value));
const tag = value => `"${firebaseHash(value) || 'null_etag'}"`;
function server(initial) {
    const data = copy(initial), reads = [], writes = [], probes = [];
    let beforePut;
    return {
        data, reads, writes, probes,
        hook: fn => { beforePut = fn; },
        client: {
            async probe(path) { probes.push(path); return { etag: tag(get(data, path)) }; },
            async read(path) { reads.push(path); const value = copy(get(data, path)); return { value, etag: tag(value) }; },
            async put(path, value, etag) {
                if (beforePut) await beforePut(path, value, etag);
                if (etag && etag !== tag(get(data, path))) throw Object.assign(new Error('precondition'), { status: 412 });
                writes.push(path);
                set(data, path, value?.['.sv'] === 'timestamp' ? Date.now() : value);
                return { etag: tag(get(data, path)) };
            },
        },
    };
}
function addIndex(data, field) {
    data.__syncIndex ||= {};
    data.__syncIndex[field] = Object.fromEntries(Object.entries(data[field] || {}).map(([id, value]) => [id, firebaseHash(value)]));
}
const initial = () => ({ savedReports: { a: 'old A', b: 'old B' }, tajweedBank: { lesson: { audio: 'very large content' } }, month: 10 });

test('unchanged startup transfers no application data, including a bank without a previous index', async () => {
    const data = initial(), cloud = server(data);
    const engine = createSelectiveSync({ client: cloud.client, baseline: data });
    const result = await engine.pull();
    assert.deepEqual(result.changes, {});
    assert.ok(cloud.reads.every(path => path.startsWith('__syncIndex/')));
    assert.equal(hashChildren(cloud.data.__syncIndex.tajweedBank), firebaseHash(data.tajweedBank));
});

test('one changed report downloads only that record, never the bank or full reports', async () => {
    const data = initial(), remote = copy(data);
    remote.savedReports.a = 'new A'; addIndex(remote, 'savedReports');
    const cloud = server(remote), engine = createSelectiveSync({ client: cloud.client, baseline: data });
    const result = await engine.pull();
    assert.deepEqual(result.changes, { savedReports: { a: 'new A', b: 'old B' } });
    assert.deepEqual(cloud.reads.filter(path => !path.startsWith('__syncIndex')), ['savedReports/a']);
    assert.equal(engine.baseline().savedReports.a, 'old A', 'pull is staged until caller commits');
    engine.commit(result.baseline);
    assert.equal(engine.baseline().savedReports.a, 'new A');
});

test('deleted records apply without downloading other records', async () => {
    const data = initial(), remote = copy(data);
    delete remote.savedReports.a; addIndex(remote, 'savedReports');
    const cloud = server(remote), engine = createSelectiveSync({ client: cloud.client, baseline: data });
    assert.deepEqual((await engine.pull()).changes.savedReports, { b: 'old B' });
    assert.ok(!cloud.reads.includes('savedReports/b'));
});

test('old writer with stale index triggers only a changed-section fallback, then repairs the index', async () => {
    const data = initial(), remote = copy(data);
    addIndex(remote, 'savedReports'); remote.savedReports.a = 'legacy edit';
    const cloud = server(remote), engine = createSelectiveSync({ client: cloud.client, baseline: data });
    assert.equal((await engine.pull()).changes.savedReports.a, 'legacy edit');
    assert.ok(cloud.reads.includes('savedReports'));
    assert.ok(!cloud.reads.includes('tajweedBank'));
    assert.equal(hashChildren(cloud.data.__syncIndex.savedReports), firebaseHash(remote.savedReports));
});

test('two devices create different reports before receiving: both converge without deleting either report', async () => {
    const data = initial(), cloud = server(data);
    const win = createSelectiveSync({ client: cloud.client, baseline: data });
    const mac = createSelectiveSync({ client: cloud.client, baseline: data });
    const winData = copy(data), macData = copy(data);
    winData.savedReports.windows = 'Brother Abel'; macData.savedReports.mac = 'new student';
    await win.push(winData); await mac.push(macData);
    win.commit((await win.pull()).baseline); mac.commit((await mac.pull()).baseline);
    assert.deepEqual(win.baseline().savedReports, mac.baseline().savedReports);
    assert.equal(mac.baseline().savedReports.windows, 'Brother Abel');
    assert.equal(win.baseline().savedReports.mac, 'new student');
    assert.ok(!cloud.reads.includes('tajweedBank'));
});

test('same report conflict preserves both copies and requires an explicit reviewed choice', async () => {
    const data = initial(), cloud = server(data), archives = [];
    const first = createSelectiveSync({ client: cloud.client, baseline: data });
    const second = createSelectiveSync({ client: cloud.client, baseline: data, archiveConflict: item => archives.push(item) });
    const a = copy(data), b = copy(data); a.savedReports.a = 'Windows'; b.savedReports.a = 'Mac';
    await first.push(a);
    await assert.rejects(second.push(b), { code: 'SYNC_CONFLICT' });
    assert.equal(cloud.data.savedReports.a, 'Windows');
    assert.equal(archives[0].localValue, 'Mac');
    const conflict = second.conflicts()[0];
    const resolution = await second.resolve(conflict.path, 'local', conflict.remoteEtag, b);
    assert.equal(resolution.changed, false);
    second.finishResolution(conflict.path);
    await second.push(b);
    assert.equal(cloud.data.savedReports.a, 'Mac');
});

test('cloud edit during conflict review requires a new review', async () => {
    const data = initial(), cloud = server(data);
    cloud.data.savedReports.a = 'remote';
    const engine = createSelectiveSync({ client: cloud.client, baseline: data });
    const local = copy(data); local.savedReports.a = 'local';
    await assert.rejects(engine.push(local));
    const conflict = engine.conflicts()[0];
    cloud.data.savedReports.a = 'newer remote';
    assert.equal((await engine.resolve(conflict.path, 'local', conflict.remoteEtag, local)).changed, true);
    assert.equal(cloud.data.savedReports.a, 'newer remote');
    assert.equal(engine.conflicts()[0].remoteValue, 'newer remote');
});

test('edit between preflight and conditional write cannot be overwritten', async () => {
    const data = initial(), cloud = server(data);
    const engine = createSelectiveSync({ client: cloud.client, baseline: data });
    const local = copy(data); local.savedReports.a = 'local';
    cloud.hook(path => { if (path === 'savedReports/a') cloud.data.savedReports.a = 'concurrent'; });
    await assert.rejects(engine.push(local), { code: 'SYNC_CONFLICT' });
    assert.equal(cloud.data.savedReports.a, 'concurrent');
});

test('failed index write retries acknowledged data without creating a false conflict', async () => {
    const data = initial(), cloud = server(data);
    const engine = createSelectiveSync({ client: cloud.client, baseline: data });
    const local = copy(data); local.savedReports.a = 'local';
    cloud.hook(path => { if (path === '__syncIndex/savedReports/a') throw new Error('offline'); });
    await assert.rejects(engine.push(local), /offline/);
    assert.equal(cloud.data.savedReports.a, 'local');
    cloud.hook(null); await engine.push(local);
    assert.equal(cloud.writes.filter(path => path === 'savedReports/a').length, 1);
    assert.equal(engine.conflicts().length, 0);
});

test('notification survives restart after data was acknowledged', async () => {
    const data = initial(), cloud = server(data);
    let baseline = data, metadata;
    const engine = createSelectiveSync({ client: cloud.client, baseline, saveBaseline: value => baseline = copy(value), saveMetadata: value => metadata = copy(value) });
    const local = copy(data); local.savedReports.a = 'local';
    cloud.hook(path => { if (path === 'lastUpdated') throw new Error('offline'); });
    await assert.rejects(engine.push(local));
    assert.equal(metadata.needsNotify, true);
    cloud.hook(null);
    const restarted = createSelectiveSync({ client: cloud.client, baseline, metadata });
    await restarted.push(local);
    assert.equal(typeof cloud.data.lastUpdated, 'number');
    assert.equal(restarted.hasNotification(), false);
});

test('conflict state survives restart and remote choice leaves unrelated edits pending', async () => {
    const data = initial(), cloud = server(data); let metadata;
    cloud.data.savedReports.a = 'remote';
    const local = copy(data); local.savedReports.a = 'local'; local.savedReports.new = 'keep me';
    let engine = createSelectiveSync({ client: cloud.client, baseline: data, saveMetadata: value => metadata = value });
    await assert.rejects(engine.push(local));
    engine = createSelectiveSync({ client: cloud.client, baseline: data, metadata });
    const item = engine.conflicts()[0];
    const result = await engine.resolve(item.path, 'remote', item.remoteEtag, local);
    set(local, result.path, result.value); engine.finishResolution(item.path);
    await engine.push(local);
    assert.equal(cloud.data.savedReports.a, 'remote');
    assert.equal(cloud.data.savedReports.new, 'keep me');
});

test('device paths are excluded from uploads but report edits still sync', () => {
    const data = { autoBackupConfig: { enabled: true, backupPath: 'C:\\backup' }, tajweedSubmissions: { a: { audioLocalPath: 'C:\\audio', answer: 'old' } } };
    const engine = createSelectiveSync({ client: {}, baseline: data });
    const local = copy(data); local.autoBackupConfig.backupPath = '/backup'; local.tajweedSubmissions.a.audioLocalPath = '/audio';
    assert.deepEqual(engine.patchFor(local), {});
    local.tajweedSubmissions.a.answer = 'new';
    assert.equal(engine.patchFor(local)['tajweedSubmissions/a'].answer, 'new');
});

test('a record changing during download is not committed as the indexed version', async () => {
    const data = initial(), remote = copy(data);
    remote.savedReports.a = 'indexed'; addIndex(remote, 'savedReports');
    const cloud = server(remote), read = cloud.client.read;
    cloud.client.read = async path => {
        if (path === 'savedReports/a') cloud.data.savedReports.a = 'newer';
        return read(path);
    };
    const engine = createSelectiveSync({ client: cloud.client, baseline: data });
    await assert.rejects(engine.pull(), /Cloud changed during sync/);
    assert.equal(engine.baseline().savedReports.a, 'old A');
});

test('preflight detects a conflict before writing unrelated records', async () => {
    const data = initial(), cloud = server(data);
    cloud.data.savedReports.b = 'remote B';
    const local = copy(data); local.savedReports.a = 'local A'; local.savedReports.b = 'local B';
    const engine = createSelectiveSync({ client: cloud.client, baseline: data });
    await assert.rejects(engine.push(local), { code: 'SYNC_CONFLICT' });
    assert.deepEqual(cloud.writes, []);
});
