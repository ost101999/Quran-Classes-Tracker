const { MAP_FIELDS, CORE_FIELDS } = require('./sync-schema');
function sanitizeKeys(obj) {
    if (Array.isArray(obj)) return obj.map(sanitizeKeys);
    if (obj !== null && typeof obj === 'object') {
        return Object.fromEntries(Object.keys(obj).map(key => [String(key).replace(/[.#$\[\]\/]/g, '_'), sanitizeKeys(obj[key])]));
    }
    return obj;
}

function buildFirebasePatch(data, lastSyncedState) {
    const current = sanitizeKeys(data);
    const previous = sanitizeKeys(lastSyncedState || {});
    const patch = {};
    for (const key of Object.keys(current)) {
        // Local receipt marker, not a user edit; the sender sets the cloud
        // revision only when there is an actual data change.
        if (!CORE_FIELDS.includes(key)) continue;
        const currVal = current[key];
        const lastVal = previous[key];
        if (MAP_FIELDS.has(key)) {
            const currObj = currVal && typeof currVal === 'object' ? currVal : {};
            const lastObj = lastVal && typeof lastVal === 'object' ? lastVal : {};
            for (const subKey of Object.keys(currObj)) {
                if (JSON.stringify(currObj[subKey]) !== JSON.stringify(lastObj[subKey])) patch[`${key}/${subKey}`] = currObj[subKey];
            }
            for (const subKey of Object.keys(lastObj)) {
                if (currObj[subKey] === undefined) patch[`${key}/${subKey}`] = null;
            }
        } else if (JSON.stringify(currVal) !== JSON.stringify(lastVal)) {
            patch[key] = currVal;
        }
    }
    return patch;
}

module.exports = { buildFirebasePatch, sanitizeKeys };
