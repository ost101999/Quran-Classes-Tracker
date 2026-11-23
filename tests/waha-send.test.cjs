const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { normalizeTarget, sendWahaMessage, sendWahaFile } = require('../waha-send');

test('normalizes numbers and preserves exact WhatsApp identifiers', () => {
    assert.equal(normalizeTarget('٠١٢٣٤٥٦٧٨٩٠'), '201234567890@c.us');
    assert.equal(normalizeTarget('https://wa.me/201234567890'), '201234567890@c.us');
    assert.equal(normalizeTarget('123456789-123456@g.us'), '123456789-123456@g.us');
    assert.equal(normalizeTarget('123456789012345@lid'), '123456789012345@lid');
    assert.equal(normalizeTarget('Student 201234567890'), '');
});

test('sends the exact report once and handles WAHA responses and connection errors', async t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'waha-test-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const settingsFile = path.join(dir, '.env');
    fs.writeFileSync(settingsFile, 'WAHA_API_KEY="test-key"\n');
    let requests = [];
    let status = 201;
    const server = http.createServer((req, res) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            requests.push({ url: req.url, key: req.headers['x-api-key'], body: JSON.parse(body) });
            res.writeHead(status);
            res.end('{}');
        });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => server.close());
    const url = `http://127.0.0.1:${server.address().port}/api/sendText`;
    const options = { settingsFile, url };
    assert.deepEqual(await sendWahaMessage('123456789-123456@g.us', 'تقرير\nثانٍ', options), { success: true });
    assert.deepEqual(requests, [{ url: '/api/sendText', key: 'test-key', body: { chatId: '123456789-123456@g.us', text: 'تقرير\nثانٍ', session: 'default' } }]);
    status = 401;
    assert.match((await sendWahaMessage('201234567890', 'text', options)).error, /مفتاح/);
    status = 500;
    assert.match((await sendWahaMessage('201234567890', 'text', options)).error, /راجع المحادثة/);
    assert.equal((await sendWahaMessage('name', 'text', options)).success, false);
    assert.equal(requests.length, 3);
    await new Promise(resolve => server.close(resolve));
    assert.match((await sendWahaMessage('201234567890', 'text', options)).error, /راجع المحادثة/);
});

test('sendWahaFile uploads PDF base64 to /api/sendFile and handles missing file', async t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'waha-file-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const settingsFile = path.join(dir, '.env');
    fs.writeFileSync(settingsFile, 'WAHA_API_KEY="file-key"\n');
    const pdfPath = path.join(dir, 'Bilal - 2026-11-21.pdf');
    fs.writeFileSync(pdfPath, '%PDF-1.4\ntest');

    const received = [];
    const server = http.createServer((req, res) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            received.push({ url: req.url, key: req.headers['x-api-key'], body: JSON.parse(body) });
            res.writeHead(201);
            res.end('{}');
        });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => server.close());

    const options = { settingsFile, url: `http://127.0.0.1:${server.address().port}/api/sendFile` };
    assert.deepEqual(await sendWahaFile('201234567890', pdfPath, '', options), { success: true });
    assert.equal(received.length, 1);
    assert.equal(received[0].url, '/api/sendFile');
    assert.equal(received[0].key, 'file-key');
    assert.equal(received[0].body.chatId, '201234567890@c.us');
    assert.equal(received[0].body.file.mimetype, 'application/pdf');
    assert.equal(received[0].body.file.filename, 'Bilal - 2026-11-21.pdf');
    assert.equal(Buffer.from(received[0].body.file.data, 'base64').toString('utf8'), '%PDF-1.4\ntest');

    const missing = await sendWahaFile('201234567890', path.join(dir, 'missing.pdf'), '', options);
    assert.equal(missing.success, false);
});
