// Keep the latest local snapshot until the server has acknowledged it.
function createSyncQueue({ send, savePending, clearPending, onChange = () => {}, debounceMs = 5000, retryMs = 10000, maxRetryMs = 60000 }) {
    let pending = null;
    let active = null;
    let timer = null;
    let error = null;
    let lastSuccessAt = null;
    let retryDelay = retryMs;

    const status = () => ({ isSyncing: !!active, hasPending: !!pending || !!active, error, lastSuccessAt });
    const notify = () => onChange(status());
    const schedule = (delay) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => { timer = null; void run(); }, delay);
    };
    const enqueue = (data) => {
        pending = data;
        try {
            savePending(data);
        } catch (err) {
            error = err instanceof Error ? err.message : String(err);
            console.error('Could not save pending sync:', err);
        }
        schedule(debounceMs);
        notify();
    };
    const run = async () => {
        if (active) return active;
        if (!pending) return;
        if (timer) { clearTimeout(timer); timer = null; }
        const snapshot = pending;
        pending = null;
        active = (async () => {
            try {
                // Retry a failed pending-file write before attempting the network.
                savePending(snapshot);
                const timestamp = await send(snapshot);
                error = null;
                retryDelay = retryMs;
                if (timestamp) lastSuccessAt = timestamp;
                if (!pending) clearPending();
            } catch (err) {
                error = err instanceof Error ? err.message : String(err);
                // Newer snapshots include the changes from the failed snapshot.
                if (!pending) pending = snapshot;
                console.error('Firebase Sync Error:', err);
            }
        })();
        notify();
        await active;
        active = null;
        if (pending) {
            schedule(error ? retryDelay : 0);
            if (error) retryDelay = Math.min(retryDelay * 2, maxRetryMs);
        }
        notify();
    };
    const flush = async () => {
        if (timer) { clearTimeout(timer); timer = null; }
        if (active) await active;
        // Let run's continuation finish updating its state.
        await Promise.resolve();
        if (pending) await run();
        return status();
    };
    return { enqueue, flush, status };
}

module.exports = { createSyncQueue };
