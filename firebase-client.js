const https = require('node:https');

function createFirebaseClient(baseUrl, { idleTimeoutMs = 60000 } = {}) {
    function request(path, { method = 'GET', value, silent = false, etag } = {}) {
        const encoded = path.split('/').map(encodeURIComponent).join('/');
        const url = `${baseUrl}/${encoded}.json${silent ? '?print=silent' : ''}`;
        const body = value === undefined ? null : JSON.stringify(value);
        return new Promise((resolve, reject) => {
            const headers = { 'X-Firebase-ETag': 'true' };
            if (etag) headers['if-match'] = etag;
            if (body !== null) {
                headers['Content-Type'] = 'application/json';
                headers['Content-Length'] = Buffer.byteLength(body);
            }
            const req = https.request(url, { method, headers }, res => {
                const chunks = [];
                res.on('data', chunk => chunks.push(chunk));
                res.on('aborted', () => reject(new Error('Firebase response interrupted')));
                res.on('error', reject);
                res.on('end', () => {
                    const status = res.statusCode || 0;
                    if (status < 200 || status >= 300) {
                        const error = new Error(`Firebase ${method} ${path}: HTTP ${status}`);
                        error.status = status;
                        reject(error);
                        return;
                    }
                    try {
                        const text = Buffer.concat(chunks).toString('utf8');
                        resolve({ value: text ? JSON.parse(text) : null, etag: res.headers.etag, status, bytes: Buffer.byteLength(text) });
                    } catch (error) { reject(error); }
                });
            });
            // Inactivity timeout, not a deadline that interrupts an active large download.
            req.setTimeout(idleTimeoutMs, () => req.destroy(new Error('Firebase connection stalled')));
            const deadline = setTimeout(() => req.destroy(new Error('Firebase connection could not be established')), idleTimeoutMs);
            req.on('response', () => clearTimeout(deadline));
            req.on('error', error => { clearTimeout(deadline); reject(error); });
            if (body !== null) req.write(body);
            req.end();
        });
    }
    return {
        probe: path => request(path, { silent: true }),
        read: path => request(path),
        put: (path, value, etag) => request(path, { method: 'PUT', value, etag, silent: true }),
    };
}
module.exports = { createFirebaseClient };
