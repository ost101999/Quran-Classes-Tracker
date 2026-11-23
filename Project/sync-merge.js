const { firebaseHash } = require('./firebase-hash');

const clone = value => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
const sameCloudValue = (a, b) => firebaseHash(a) === firebaseHash(b);
const AUTO_CALENDAR_KEYS = new Set(['calendarReview', 'calendarSchedule', 'scheduleMessage']);

function parseTimestamp(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
}

function mergeCalendarSchedule(baseVal, localVal, remoteVal) {
    if (sameCloudValue(localVal, baseVal)) return clone(remoteVal);
    if (sameCloudValue(remoteVal, baseVal)) return clone(localVal);
    if (sameCloudValue(localVal, remoteVal)) return clone(localVal);
    const localTime = parseTimestamp(localVal?.updatedAt);
    const remoteTime = parseTimestamp(remoteVal?.updatedAt);
    return clone(localTime > remoteTime ? localVal : remoteVal);
}

function mergeCalendarReview(baseVal, localVal, remoteVal) {
    if (sameCloudValue(localVal, baseVal)) return clone(remoteVal);
    if (sameCloudValue(remoteVal, baseVal)) return clone(localVal);
    if (sameCloudValue(localVal, remoteVal)) return clone(localVal);
    if (!localVal || typeof localVal !== 'object') return clone(remoteVal);
    if (!remoteVal || typeof remoteVal !== 'object') return clone(localVal);

    const decisions = { ...(remoteVal.decisions || {}) };
    for (const [id, localDec] of Object.entries(localVal.decisions || {})) {
        const remoteDec = decisions[id];
        if (!remoteDec || parseTimestamp(localDec?.decidedAt) > parseTimestamp(remoteDec?.decidedAt)) {
            decisions[id] = clone(localDec);
        }
    }

    const observed = { ...(remoteVal.observed || {}) };
    for (const [eventId, localObs] of Object.entries(localVal.observed || {})) {
        const remoteObs = observed[eventId];
        if (!remoteObs || (localObs?.revision || 0) > (remoteObs?.revision || 0)) {
            observed[eventId] = clone(localObs);
        }
    }

    const pendingById = new Map();
    for (const item of [...(remoteVal.pending || []), ...(localVal.pending || [])]) {
        if (!item || !item.id || decisions[item.id]) continue;
        const prev = pendingById.get(item.id);
        if (!prev || parseTimestamp(item.detectedAt) > parseTimestamp(prev.detectedAt)) {
            pendingById.set(item.id, clone(item));
        }
    }

    return {
        ...clone(remoteVal),
        name: remoteVal.name || localVal.name,
        observed,
        pending: Array.from(pendingById.values()),
        decisions,
        weeklySignature: remoteVal.weeklySignature || localVal.weeklySignature,
    };
}

function onlyAutoCalendarChanged(student, baselineStudent) {
    if (!student || !baselineStudent) return false;
    const keys = new Set([...Object.keys(student), ...Object.keys(baselineStudent)]);
    for (const key of keys) {
        if (AUTO_CALENDAR_KEYS.has(key)) continue;
        if (!sameCloudValue(student[key], baselineStudent[key])) return false;
    }
    return true;
}

function sameSequence(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
}

function computeMergedOrder(baseArr, localArr, remoteArr) {
    const baseIds = (baseArr || []).map(s => s?.id).filter(Boolean);
    const localIds = (localArr || []).map(s => s?.id).filter(Boolean);
    const remoteIds = (remoteArr || []).map(s => s?.id).filter(Boolean);
    const baseSet = new Set(baseIds);
    const localSet = new Set(localIds);
    const remoteSet = new Set(remoteIds);

    const sharedBaseForLocal = baseIds.filter(id => localSet.has(id));
    const sharedLocal = localIds.filter(id => baseSet.has(id));
    const sharedBaseForRemote = baseIds.filter(id => remoteSet.has(id));
    const sharedRemote = remoteIds.filter(id => baseSet.has(id));

    const localReordered = !sameSequence(sharedBaseForLocal, sharedLocal);
    const remoteReordered = !sameSequence(sharedBaseForRemote, sharedRemote);

    const primaryIds = (localReordered && !remoteReordered) ? localIds : remoteIds;
    const secondaryIds = (localReordered && !remoteReordered) ? remoteIds : localIds;
    const result = [...primaryIds];
    const inResult = new Set(result);

    for (let i = 0; i < secondaryIds.length; i++) {
        const id = secondaryIds[i];
        if (inResult.has(id)) continue;
        // Only insert items that did not exist in base (additions from the secondary side),
        // or items kept by conflict resolution (handled afterwards if still missing).
        if (baseSet.has(id)) continue;
        let insertAt = result.length;
        for (let j = i - 1; j >= 0; j--) {
            const prevIdx = result.indexOf(secondaryIds[j]);
            if (prevIdx !== -1) { insertAt = prevIdx + 1; break; }
        }
        result.splice(insertAt, 0, id);
        inResult.add(id);
    }

    for (const id of secondaryIds) {
        if (!inResult.has(id)) {
            result.push(id);
            inResult.add(id);
        }
    }
    return result;
}

function mergeStudentRecord(baseStudent, localStudent, remoteStudent, { prefer } = {}) {
    if (!baseStudent && !localStudent) return { student: clone(remoteStudent), conflicts: [] };
    if (!baseStudent && !remoteStudent) return { student: clone(localStudent), conflicts: [] };
    const base = baseStudent || {};
    const local = localStudent || {};
    const remote = remoteStudent || {};

    if (localStudent && remoteStudent) {
        if (sameCloudValue(local, remote)) return { student: clone(local), conflicts: [] };
        if (baseStudent && sameCloudValue(local, base)) return { student: clone(remote), conflicts: [] };
        if (baseStudent && sameCloudValue(remote, base)) return { student: clone(local), conflicts: [] };
    }

    const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
    const merged = {};
    const fieldConflicts = [];

    const localSchedTime = parseTimestamp(local.calendarSchedule?.updatedAt);
    const remoteSchedTime = parseTimestamp(remote.calendarSchedule?.updatedAt);

    for (const key of keys) {
        const bVal = base[key];
        const lVal = local[key];
        const rVal = remote[key];

        if (key === 'calendarSchedule') {
            const val = mergeCalendarSchedule(bVal, lVal, rVal);
            if (val !== undefined) merged[key] = val;
            continue;
        }
        if (key === 'calendarReview') {
            const val = mergeCalendarReview(bVal, lVal, rVal);
            if (val !== undefined) merged[key] = val;
            continue;
        }
        if (key === 'scheduleMessage') {
            if (sameCloudValue(lVal, bVal)) { if (rVal !== undefined) merged[key] = clone(rVal); }
            else if (sameCloudValue(rVal, bVal)) { if (lVal !== undefined) merged[key] = clone(lVal); }
            else if (sameCloudValue(lVal, rVal)) { if (lVal !== undefined) merged[key] = clone(lVal); }
            else {
                const chosen = localSchedTime > remoteSchedTime ? lVal : rVal;
                if (chosen !== undefined) merged[key] = clone(chosen);
            }
            continue;
        }

        const localChanged = !sameCloudValue(lVal, bVal);
        const remoteChanged = !sameCloudValue(rVal, bVal);

        if (!localChanged && !remoteChanged) {
            if (lVal !== undefined) merged[key] = clone(lVal);
            else if (rVal !== undefined) merged[key] = clone(rVal);
        } else if (!localChanged) {
            if (rVal !== undefined) merged[key] = clone(rVal);
        } else if (!remoteChanged) {
            if (lVal !== undefined) merged[key] = clone(lVal);
        } else if (sameCloudValue(lVal, rVal)) {
            if (lVal !== undefined) merged[key] = clone(lVal);
            else if (rVal !== undefined) merged[key] = clone(rVal);
        } else if (prefer === 'local') {
            if (lVal !== undefined) merged[key] = clone(lVal);
        } else if (prefer === 'remote') {
            if (rVal !== undefined) merged[key] = clone(rVal);
        } else {
            fieldConflicts.push({ field: key, baseValue: clone(bVal), localValue: clone(lVal), remoteValue: clone(rVal) });
            if (rVal !== undefined) merged[key] = clone(rVal);
        }
    }

    return { student: merged, conflicts: fieldConflicts };
}

function mergeStudents(baseArr = [], localArr = [], remoteArr = [], { prefer } = {}) {
    const safeBase = Array.isArray(baseArr) ? baseArr : [];
    const safeLocal = Array.isArray(localArr) ? localArr : [];
    const safeRemote = Array.isArray(remoteArr) ? remoteArr : [];

    const byId = arr => new Map(arr.filter(s => s && s.id).map(s => [s.id, s]));
    const baseMap = byId(safeBase);
    const localMap = byId(safeLocal);
    const remoteMap = byId(safeRemote);

    const orderedIds = computeMergedOrder(safeBase, safeLocal, safeRemote);
    const merged = [];
    const conflicts = [];

    for (const id of orderedIds) {
        const b = baseMap.get(id);
        const l = localMap.get(id);
        const r = remoteMap.get(id);

        if (b && l && !r) {
            // Deleted on remote
            if (sameCloudValue(l, b) || onlyAutoCalendarChanged(l, b)) continue;
            if (prefer === 'remote') continue;
            if (prefer === 'local') { merged.push(clone(l)); continue; }
            conflicts.push({ studentId: id, studentName: l.name || id, type: 'deleted_remote', fields: [{ field: '__deleted__', localValue: 'موجود ومعدّل', remoteValue: 'محذوف' }] });
            continue;
        }

        if (b && !l && r) {
            // Deleted on local
            if (sameCloudValue(r, b) || onlyAutoCalendarChanged(r, b)) continue;
            if (prefer === 'local') continue;
            if (prefer === 'remote') { merged.push(clone(r)); continue; }
            conflicts.push({ studentId: id, studentName: r.name || id, type: 'deleted_local', fields: [{ field: '__deleted__', localValue: 'محذوف', remoteValue: 'موجود ومعدّل' }] });
            continue;
        }

        if (!l && !r) continue;

        const res = mergeStudentRecord(b, l, r, { prefer });
        merged.push(res.student);
        if (res.conflicts.length) {
            conflicts.push({
                studentId: id,
                studentName: res.student.name || l?.name || r?.name || id,
                type: 'field_conflict',
                fields: res.conflicts,
            });
        }
    }

    return { merged, conflicts };
}

function mergeArrayByKey(baseArr = [], localArr = [], remoteArr = [], keyFn = item => JSON.stringify(item)) {
    const safeBase = Array.isArray(baseArr) ? baseArr : [];
    const safeLocal = Array.isArray(localArr) ? localArr : [];
    const safeRemote = Array.isArray(remoteArr) ? remoteArr : [];

    if (sameCloudValue(safeLocal, safeBase)) return { merged: clone(safeRemote), conflicts: [] };
    if (sameCloudValue(safeRemote, safeBase)) return { merged: clone(safeLocal), conflicts: [] };
    if (sameCloudValue(safeLocal, safeRemote)) return { merged: clone(safeLocal), conflicts: [] };

    const baseKeys = new Set(safeBase.map(keyFn));
    const localKeys = new Set(safeLocal.map(keyFn));
    const remoteKeys = new Set(safeRemote.map(keyFn));

    const result = [];
    const seen = new Set();

    for (const item of safeRemote) {
        const k = keyFn(item);
        if (baseKeys.has(k) && !localKeys.has(k)) continue; // deleted locally
        if (!seen.has(k)) { seen.add(k); result.push(clone(item)); }
    }
    for (const item of safeLocal) {
        const k = keyFn(item);
        if (baseKeys.has(k) && !remoteKeys.has(k)) continue; // deleted remotely
        if (!seen.has(k)) { seen.add(k); result.push(clone(item)); }
    }
    return { merged: result, conflicts: [] };
}

const MERGEABLE_PATHS = new Set(['students', 'academyOrder', 'makeupLinks', 'seenUngradedTajweedAssignmentIds']);

function canAutoMerge(path) {
    return MERGEABLE_PATHS.has(path);
}

function mergePath(path, baseVal, localVal, remoteVal, options = {}) {
    if (path === 'students') return mergeStudents(baseVal, localVal, remoteVal, options);
    if (path === 'academyOrder' || path === 'seenUngradedTajweedAssignmentIds') {
        return mergeArrayByKey(baseVal, localVal, remoteVal, item => String(item));
    }
    if (path === 'makeupLinks') {
        return mergeArrayByKey(baseVal, localVal, remoteVal, item => item?.id ? String(item.id) : JSON.stringify(item));
    }
    return { merged: options.prefer === 'local' ? clone(localVal) : clone(remoteVal), conflicts: [] };
}

module.exports = {
    sameCloudValue,
    mergeCalendarSchedule,
    mergeCalendarReview,
    mergeStudents,
    mergeArrayByKey,
    canAutoMerge,
    mergePath,
};
