// Firebase Realtime Database's wire hash for ordinary JSON (no priorities).
// Algorithm follows the Apache-2.0 Firebase JS SDK LeafNode/ChildrenNode hash
// and name ordering: https://github.com/firebase/firebase-js-sdk/tree/main/packages/database/src/core/snap
const { createHash } = require('node:crypto');

const sha1 = value => createHash('sha1').update(value, 'utf8').digest('base64');
function integerKey(key) {
    if (!/^-?(0*)\d{1,10}$/.test(key)) return null;
    const number = Number(key);
    return number >= -2147483648 && number <= 2147483647 ? number : null;
}
function compareKeys(a, b) {
    const x = integerKey(a), y = integerKey(b);
    if (x !== null && y !== null) return x - y || a.length - b.length;
    if (x !== null) return -1;
    if (y !== null) return 1;
    return a < b ? -1 : a > b ? 1 : 0;
}
function hashChildren(hashes) {
    const text = Object.keys(hashes).sort(compareKeys)
        .filter(key => hashes[key])
        .map(key => `:${key}:${hashes[key]}`).join('');
    return text ? sha1(text) : '';
}
function firebaseHash(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
        if (Object.keys(value).some(key => key.startsWith('.'))) throw new Error('Firebase metadata is not supported in app data');
        return hashChildren(Object.fromEntries(Object.entries(value).map(([key, child]) => [key, firebaseHash(child)])));
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new Error('Invalid JSON number');
        const bytes = Buffer.alloc(8);
        bytes.writeDoubleBE(value);
        return sha1(`number:${bytes.toString('hex')}`);
    }
    return sha1(`${typeof value}:${value}`);
}
function normalizeEtag(etag) {
    if (!etag) throw new Error('Firebase did not return an ETag');
    const value = etag.replace(/^"|"$/g, '');
    return value === 'null_etag' ? '' : value;
}

module.exports = { firebaseHash, hashChildren, normalizeEtag };
