const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { firebaseHash, hashChildren, normalizeEtag } = require('../firebase-hash');
const sha = text => createHash('sha1').update(text).digest('base64');
test('Firebase primitive hashes use type prefixes and IEEE754 numbers', () => {
    assert.equal(firebaseHash('تقرير الطالب'), sha('string:تقرير الطالب'));
    assert.equal(firebaseHash(false), sha('boolean:false'));
    assert.equal(firebaseHash(1), sha('number:3ff0000000000000'));
    assert.equal(firebaseHash(0), sha('number:0000000000000000'));
    for (const empty of [null, {}, [], { empty: null }]) assert.equal(firebaseHash(empty), '');
    assert.equal(normalizeEtag('"null_etag"'), '');
});
test('numeric children use Firebase ordering and arrays match wire objects', () => {
    assert.equal(hashChildren({ '10': 'ten', '2': 'two', a: 'a' }), sha(':2:two:10:ten:a:a'));
    assert.equal(firebaseHash(['a', 'b']), firebaseHash({ 0: 'a', 1: 'b' }));
    assert.equal(firebaseHash({ a: true, b: null }), firebaseHash({ a: true }));
});
