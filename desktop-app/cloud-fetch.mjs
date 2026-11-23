// Start the timeout only when a request leaves the local concurrency queue.
export async function fetchCloudEntries(baseUrl, keys, {
    fetcher = globalThis.fetch,
    concurrency = 4,
    timeoutMs = 60000,
    attempts = 2,
    signal,
    onProgress,
    onBytes,
} = {}) {
    const controller = new AbortController();
    const sharedSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    const results = new Array(keys.length);
    let nextIndex = 0;
    let completed = 0;
    const received = new Array(keys.length).fill(0);
    let lastByteNotification = 0;

    async function worker() {
        while (!sharedSignal.aborted) {
            const index = nextIndex++;
            if (index >= keys.length) return;
            const key = keys[index];
            let lastError;
            for (let attempt = 0; attempt < attempts; attempt++) {
                if (sharedSignal.aborted) throw sharedSignal.reason;
                const requestController = new AbortController();
                let timeout;
                const resetTimeout = () => {
                    clearTimeout(timeout);
                    timeout = setTimeout(() => requestController.abort(new Error(`Download stalled for ${timeoutMs} ms`)), timeoutMs);
                };
                try {
                    received[index] = 0;
                    resetTimeout();
                    const requestSignal = AbortSignal.any([sharedSignal, requestController.signal]);
                    const res = await fetcher(`${baseUrl}/${key}.json`, { cache: 'no-store', signal: requestSignal });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    let data;
                    if (res.body?.getReader) {
                        const reader = res.body.getReader();
                        const decoder = new TextDecoder();
                        const chunks = [];
                        while (true) {
                            const { value, done } = await reader.read();
                            if (done) break;
                            resetTimeout();
                            received[index] += value.byteLength;
                            chunks.push(decoder.decode(value, { stream: true }));
                            const now = Date.now();
                            if (onBytes && now - lastByteNotification >= 500) {
                                lastByteNotification = now;
                                onBytes(received.reduce((sum, n) => sum + n, 0));
                            }
                        }
                        chunks.push(decoder.decode());
                        data = JSON.parse(chunks.join(''));
                    } else {
                        data = await res.json();
                    }
                    results[index] = { key, data };
                    completed++;
                    onBytes?.(received.reduce((sum, n) => sum + n, 0));
                    onProgress?.(completed, keys.length);
                    lastError = null;
                    break;
                } catch (err) {
                    if (sharedSignal.aborted) throw sharedSignal.reason;
                    lastError = err;
                } finally {
                    clearTimeout(timeout);
                }
            }
            if (lastError) {
                controller.abort();
                throw new Error(`Failed to fetch ${key}: ${lastError.message || lastError}`);
            }
        }
        if (sharedSignal.aborted) throw sharedSignal.reason;
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, keys.length) }, worker));
    return results;
}
