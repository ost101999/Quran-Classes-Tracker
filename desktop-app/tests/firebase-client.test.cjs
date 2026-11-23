const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { Readable } = require('node:stream');
const { createFirebaseClient } = require('../firebase-client');

function transport(responseStatus = 200) {
    const calls = [];
    const requestImpl = (url, options, callback) => {
        const req = new EventEmitter();
        const call = { url, options, body: '' };
        calls.push(call);
        req.setTimeout = () => req;
        req.write = data => { call.body += data; };
        req.end = () => process.nextTick(() => {
            // Match the real Firebase REST restriction that caused startup failure.
            const incompatible = url.includes('print=silent') && !!options.headers['if-match'];
            const status = incompatible ? 400 : responseStatus;
            const body = status === 204 ? '' : JSON.stringify(status === 200 ? { text: 'a changed record' } : { error: 'precondition' });
            const res = Readable.from(body ? [Buffer.from(body)] : []);
            res.statusCode = status;
            res.headers = { etag: '"response-hash"' };
            req.emit('response', res);
            callback(res);
        });
        req.destroy = error => req.emit('error', error);
        return req;
    };
    return { calls, client: createFirebaseClient('https://example.test/appState', { requestImpl }) };
}

test('conditional PUT uses If-Match without print=silent and discards echoed data', async () => {
    const { client, calls } = transport();
    const response = await client.put('savedReports/report 1', { text: 'local' }, '"old-hash"');
    assert.equal(calls[0].url, 'https://example.test/appState/savedReports/report%201.json');
    assert.equal(calls[0].options.headers['if-match'], '"old-hash"');
    assert.deepEqual(JSON.parse(calls[0].body), { text: 'local' });
    assert.equal(response.status, 200);
    assert.equal(response.value, null);
    assert.ok(response.bytes > 0);
});

test('conditional PUT reports 412 so conflicts are detected', async () => {
    const { client } = transport(412);
    await assert.rejects(client.put('savedReports/a', 'local', '"old-hash"'), { status: 412 });
});

test('silent probes and unconditional writes still avoid downloading response data', async () => {
    const { client, calls } = transport(204);
    await client.probe('tajweedBank');
    await client.put('__syncIndex/savedReports/a', 'hash');
    assert.match(calls[0].url, /tajweedBank\.json\?print=silent$/);
    assert.equal(calls[0].options.headers['X-Firebase-ETag'], 'true');
    assert.match(calls[1].url, /__syncIndex\/savedReports\/a\.json\?print=silent$/);
    assert.equal(calls[1].options.headers['if-match'], undefined);
});
