const http = require('http');
const { randomUUID } = require('crypto');

const EXTENSION_ORIGIN = 'chrome-extension://fglnbaanfedkjkciegfabjnfnocbggeh';
const PORT = 39271;

// Only the bundled extension can receive URLs. Ordinary web pages cannot read
// responses from this loopback server, including through a CORS preflight.
function createChromeTabBridge({ onFocus, port = PORT } = {}) {
    const waiters = new Set();
    const jobs = new Map();
    const server = http.createServer((req, res) => {
        if (req.headers.origin !== EXTENSION_ORIGIN || req.headers['x-tracker-extension'] !== '1') {
            res.writeHead(403).end();
            return;
        }
        res.setHeader('Access-Control-Allow-Origin', EXTENSION_ORIGIN);
        res.setHeader('Cache-Control', 'no-store');
        if (req.method === 'POST' && req.url === '/next') {
            const waiter = { res, timer: setTimeout(() => finishWaiter(waiter, null), 20000) };
            waiters.add(waiter);
            req.on('close', () => { clearTimeout(waiter.timer); waiters.delete(waiter); });
        } else if (req.method === 'POST' && req.url === '/result') {
            let body = '';
            req.on('data', chunk => { body += chunk; if (body.length > 4096) req.destroy(); });
            req.on('end', () => {
                try {
                    const result = JSON.parse(body);
                    const job = jobs.get(result.id);
                    if (job) {
                        const found = result.found === true;
                        if (found && typeof result.title === 'string' && result.title && onFocus) {
                            Promise.resolve().then(() => onFocus(result.title)).catch(error => console.error('Could not bring Chrome to the front:', error));
                        }
                        job.finish(found);
                    }
                    res.writeHead(204).end();
                } catch { res.writeHead(400).end(); }
            });
        } else {
            res.writeHead(404).end();
        }
    });
    server.on('error', error => console.error('Chrome tab bridge unavailable:', error.message));

    function finishWaiter(waiter, job) {
        clearTimeout(waiter.timer);
        waiters.delete(waiter);
        if (!waiter.res.destroyed) {
            waiter.res.writeHead(200, { 'Content-Type': 'application/json' });
            waiter.res.end(JSON.stringify(job));
        }
    }

    async function focusExisting(url) {
        // A report may be copied while the extension is reconnecting its poll.
        let waiter = waiters.values().next().value;
        for (let i = 0; !waiter && i < 30; i++) {
            await new Promise(resolve => setTimeout(resolve, 100));
            waiter = waiters.values().next().value;
        }
        if (!waiter) return false;
        return new Promise(resolve => {
            const id = randomUUID();
            const timer = setTimeout(() => { jobs.delete(id); resolve(false); }, 8000);
            jobs.set(id, { finish: found => { clearTimeout(timer); jobs.delete(id); resolve(found); } });
            finishWaiter(waiter, { id, url });
        });
    }

    return {
        start: () => server.listen(port, '127.0.0.1'),
        focusExisting,
        stop: () => {
            for (const waiter of waiters) finishWaiter(waiter, null);
            for (const job of jobs.values()) job.finish(false);
            server.close();
            server.closeAllConnections();
        }
    };
}

module.exports = { createChromeTabBridge };
