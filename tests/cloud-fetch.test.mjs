import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchCloudEntries } from '../cloud-fetch.mjs';

test('queued downloads receive their own timeout and respect the concurrency limit', async () => {
    let active = 0;
    let peak = 0;
    const progress = [];
    const fetcher = async (url, { signal }) => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, 15);
            signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
        });
        active--;
        return { ok: true, json: async () => url };
    };
    const result = await fetchCloudEntries('https://example.test', ['a', 'b', 'c', 'd', 'e', 'f'], {
        fetcher, concurrency: 2, timeoutMs: 100, onProgress: (done, total) => progress.push([done, total]),
    });
    assert.equal(result.length, 6);
    assert.equal(peak, 2);
    assert.deepEqual(progress, [[1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6]]);
    assert.deepEqual(result.map(item => item.key), ['a', 'b', 'c', 'd', 'e', 'f']);
});

test('a failed download is retried without refetching successful entries', async () => {
    const calls = {};
    const fetcher = async url => {
        const key = url.split('/').at(-1);
        calls[key] = (calls[key] || 0) + 1;
        if (key === 'b.json' && calls[key] === 1) throw new Error('temporary');
        return { ok: true, json: async () => key };
    };
    const result = await fetchCloudEntries('https://example.test', ['a', 'b'], { fetcher });
    assert.deepEqual(calls, { 'a.json': 1, 'b.json': 2 });
    assert.deepEqual(result.map(item => item.data), ['a.json', 'b.json']);
});

test('an active slow download can exceed the inactivity timeout', async () => {
    const fetcher = async (_url, { signal }) => {
        const encoder = new TextEncoder();
        const chunks = ['[', '1', ',', '2', ']'];
        return { ok: true, body: new ReadableStream({
            async pull(controller) {
                await new Promise(resolve => setTimeout(resolve, 15));
                if (signal.aborted) return controller.error(signal.reason);
                if (chunks.length) controller.enqueue(encoder.encode(chunks.shift()));
                else controller.close();
            },
        }) };
    };
    const result = await fetchCloudEntries('https://example.test', ['a'], { fetcher, timeoutMs: 50 });
    assert.deepEqual(result[0].data, [1, 2]);
});

test('cancellation stops an in-flight download', async () => {
    const controller = new AbortController();
    const fetcher = (_url, { signal }) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    });
    const pending = fetchCloudEntries('https://example.test', ['a'], { fetcher, signal: controller.signal });
    controller.abort();
    await assert.rejects(pending);
});
