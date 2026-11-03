const { firebaseHash, hashChildren, normalizeEtag } = require('./firebase-hash');
const { buildFirebasePatch, sanitizeKeys } = require('./firebase-patch');
const { CORE_FIELDS, MAP_FIELDS } = require('./sync-schema');
const clone = value => JSON.parse(JSON.stringify(value));
const get = (data, path) => path.split('/').reduce((node, key) => node && Object.hasOwn(node, key) ? node[key] : undefined, data) ?? null;
function set(data, path, value) {
    const keys = path.split('/');
    let node = data;
    for (const key of keys.slice(0, -1)) {
        if (!Object.hasOwn(node, key) || !node[key] || typeof node[key] !== 'object') Object.defineProperty(node, key, { value: {}, writable: true, enumerable: true, configurable: true });
        node = node[key];
    }
    if (value === null || value === undefined) delete node[keys.at(-1)];
    else Object.defineProperty(node, keys.at(-1), { value: clone(value), writable: true, enumerable: true, configurable: true });
}
const indexOf = value => Object.fromEntries(Object.entries(value || {}).map(([key, child]) => [key, firebaseHash(child)]).filter(([, hash]) => hash));
const conflictError = () => Object.assign(new Error('يوجد تعديل مختلف على الجهاز الآخر. راجع النسختين قبل متابعة الرفع.'), { code: 'SYNC_CONFLICT' });
async function mapLimit(items, work, count = 4) {
    let cursor = 0;
    // Wait for every worker even on failure: no writes may outlive the operation's lock.
    const results = await Promise.allSettled(Array.from({ length: Math.min(count, items.length) }, async () => {
        while (cursor < items.length) await work(items[cursor++]);
    }));
    const failure = results.find(result => result.status === 'rejected');
    if (failure) throw failure.reason;
}

// Local filesystem locations must never count as user changes to cloud content.
function cloudProjection(data, baseline) {
    const result = sanitizeKeys(data);
    function preserveLocalPaths(value, previous) {
        if (!value || typeof value !== 'object') return;
        for (const key of Object.keys(value)) {
            if (key === 'audioLocalPath' || key === 'backupPath') {
                if (previous?.[key] !== undefined) value[key] = previous[key];
                else delete value[key];
            } else preserveLocalPaths(value[key], previous?.[key]);
        }
    }
    preserveLocalPaths(result, baseline);
    return result;
}

function createSelectiveSync({ client, baseline = {}, metadata = {}, saveBaseline = () => {}, saveMetadata = () => {}, archiveConflict = () => {} }) {
    let base = sanitizeKeys(baseline);
    const meta = { indexedHashes: {}, conflicts: {}, needsNotify: false, ...metadata };
    const persist = () => saveMetadata(clone(meta));
    const commit = next => { saveBaseline(next); base = clone(next); };
    const patchFor = data => buildFirebasePatch(cloudProjection(data, base), base);
    const conflicts = () => clone(Object.values(meta.conflicts));
    async function rememberConflict(path, localValue, remote) {
        const item = { path, baseValue: get(base, path), localValue, remoteValue: remote.value, remoteEtag: remote.etag, detectedAt: Date.now() };
        archiveConflict(item); // Durable copies before exposing the conflict or rebasing anything.
        meta.conflicts[path] = item;
        persist();
    }
    async function updateIndex(path, value) {
        const [field, id] = path.split('/');
        if (id && MAP_FIELDS.has(field)) await client.put(`__syncIndex/${field}/${id}`, firebaseHash(value) || null);
    }
    async function push(data) {
        if (conflicts().length) throw conflictError();
        const patch = patchFor(data);
        const paths = Object.keys(patch);
        const probes = {};
        await mapLimit(paths, async path => {
            const remote = await client.probe(path);
            probes[path] = remote;
            const hash = normalizeEtag(remote.etag);
            if (hash !== firebaseHash(patch[path]) && hash !== firebaseHash(get(base, path))) {
                await rememberConflict(path, patch[path], await client.read(path));
            }
        });
        if (conflicts().length) throw conflictError();
        if (paths.length) { meta.needsNotify = true; persist(); }
        const next = clone(base);
        try {
            for (const path of paths) {
                if (normalizeEtag(probes[path].etag) !== firebaseHash(patch[path])) {
                    try { await client.put(path, patch[path], probes[path].etag); }
                    catch (error) {
                        if (error.status === 412) {
                            await rememberConflict(path, patch[path], await client.read(path));
                            throw conflictError();
                        }
                        throw error;
                    }
                }
                // If this fails, leave the old baseline so retry repairs the index too.
                await updateIndex(path, patch[path]);
                set(next, path, patch[path]);
            }
        } finally {
            // Remember acknowledged records even if a later record fails.
            if (firebaseHash(next) !== firebaseHash(base)) commit(next);
        }
        if (meta.needsNotify) {
            await client.put('lastUpdated', { '.sv': 'timestamp' });
            meta.needsNotify = false;
            persist();
            return Date.now();
        }
        return null;
    }
    async function ensureIndex(field, value, hash, oldIndex) {
        if (!MAP_FIELDS.has(field) || (!oldIndex && meta.indexedHashes[field] === hash)) return;
        const index = oldIndex || await client.read(`__syncIndex/${field}`);
        if (hashChildren(index.value || {}) !== hash) {
            try { await client.put(`__syncIndex/${field}`, indexOf(value), index.etag); }
            catch (error) { if (error.status !== 412) throw error; return; }
        }
        meta.indexedHashes[field] = hash;
    }
    async function pull() {
        if (conflicts().length) throw conflictError();
        const changes = {};
        const next = clone(base);
        await mapLimit(CORE_FIELDS, async field => {
            const remote = await client.probe(field);
            const hash = normalizeEtag(remote.etag);
            if (hash === firebaseHash(base[field])) {
                await ensureIndex(field, base[field], hash);
                return;
            }
            let value;
            let index;
            if (MAP_FIELDS.has(field)) {
                index = await client.read(`__syncIndex/${field}`);
                if (hashChildren(index.value || {}) === hash) {
                    value = clone(base[field] || {});
                    const ids = new Set([...Object.keys(value), ...Object.keys(index.value || {})]);
                    await mapLimit([...ids], async id => {
                        const expected = index.value?.[id] || '';
                        if (firebaseHash(value[id]) === expected) return;
                        if (!expected) { delete value[id]; return; }
                        const record = await client.read(`${field}/${id}`);
                        if (firebaseHash(record.value) !== expected) throw new Error('Cloud changed during sync; retrying');
                        value[id] = record.value;
                    });
                    if (firebaseHash(value) !== hash) throw new Error('Cloud index verification failed');
                }
            }
            if (value === undefined) {
                const full = await client.read(field);
                value = full.value;
                const fullHash = firebaseHash(value);
                if (fullHash !== normalizeEtag(full.etag)) throw new Error('Cloud response verification failed');
                await ensureIndex(field, value, fullHash, index);
            }
            changes[field] = value;
            set(next, field, value);
        });
        persist();
        return { changes, baseline: next };
    }
    // User-reviewed resolution rebases onto the exact remote copy shown. A newer
    // cloud edit requires another review; push still uses conditional PUT after this.
    async function resolve(path, choice, expectedEtag, localData) {
        const item = meta.conflicts[path];
        if (!item || item.remoteEtag !== expectedEtag) return { changed: true };
        const remote = await client.read(path);
        if (remote.etag !== expectedEtag) {
            await rememberConflict(path, get(cloudProjection(localData, base), path), remote);
            return { changed: true };
        }
        if (!['local', 'remote'].includes(choice)) throw new Error('Invalid conflict choice');
        archiveConflict({ ...item, localValue: get(cloudProjection(localData, base), path), resolvedAt: Date.now(), choice });
        const next = clone(base);
        set(next, path, remote.value);
        commit(next);
        // Caller persists chosen local snapshot before clearing the durable conflict.
        return { changed: false, path, value: choice === 'remote' ? remote.value : get(cloudProjection(localData, base), path) };
    }
    function finishResolution(path) { delete meta.conflicts[path]; persist(); }
    return { push, pull, commit, patchFor, conflicts, resolve, finishResolution, baseline: () => clone(base), hasNotification: () => meta.needsNotify };
}
module.exports = { createSelectiveSync, cloudProjection, mapLimit, set, get };
