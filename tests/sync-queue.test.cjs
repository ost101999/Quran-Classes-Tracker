const test = require('node:test');
const assert = require('node:assert/strict');
const { createSyncQueue } = require('../sync-queue');

test('failed upload remains pending and is retried without another edit', async () => {
    let saved = null;
    let attempts = 0;
    const queue = createSyncQueue({
        debounceMs: 1, retryMs: 5,
        savePending: data => { saved = data; },
        clearPending: () => { saved = null; },
        send: async () => { if (++attempts === 1) throw new Error('offline'); return 123; },
    });
    queue.enqueue({ value: 1 });
    await new Promise(resolve => setTimeout(resolve, 3));
    assert.equal(queue.status().hasPending, true);
    assert.deepEqual(saved, { value: 1 });
    await new Promise(resolve => setTimeout(resolve, 40));
    assert.equal(attempts, 2);
    assert.equal(queue.status().hasPending, false);
    assert.equal(queue.status().lastSuccessAt, 123);
    assert.equal(saved, null);
});

test('a newer edit survives failure of an upload already in progress', async () => {
    let rejectFirst;
    let saved = null;
    const sent = [];
    const queue = createSyncQueue({
        debounceMs: 10000, retryMs: 10000,
        savePending: data => { saved = data; },
        clearPending: () => { saved = null; },
        send: data => {
            sent.push(data);
            if (sent.length === 1) return new Promise((_, reject) => { rejectFirst = reject; });
            return Promise.resolve(456);
        },
    });
    queue.enqueue({ value: 1 });
    const first = queue.flush();
    await Promise.resolve();
    queue.enqueue({ value: 2 });
    rejectFirst(new Error('offline'));
    await first;
    if (queue.status().hasPending) await queue.flush();
    assert.deepEqual(sent, [{ value: 1 }, { value: 2 }]);
    assert.equal(saved, null);
    assert.equal(queue.status().hasPending, false);
});
