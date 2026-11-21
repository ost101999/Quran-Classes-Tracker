const fs = require('fs');
const http = require('http');
const path = require('path');

const SETTINGS_FILE = 'C:\\WhatsAppReminders\\.env';
const UNCERTAIN = 'تعذر التأكد من نتيجة الإرسال. راجع المحادثة قبل إعادة المحاولة، وتأكد من تشغيل WAHA واتصال واتساب.';

function normalizeTarget(input) {
    if (typeof input !== 'string') return '';
    let value = input.trim().replace(/[٠-٩۰-۹]/g, digit => {
        const code = digit.charCodeAt(0);
        return String(code >= 0x6f0 ? code - 0x6f0 : code - 0x660);
    });
    try {
        const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
        const host = url.hostname.toLowerCase().replace(/^www\./, '');
        if (host === 'wa.me') value = url.pathname.slice(1);
        else if (host === 'whatsapp.com' || host.endsWith('.whatsapp.com')) value = url.searchParams.get('phone') || url.searchParams.get('to') || '';
    } catch { /* Validate the original value below. */ }
    value = value.replace(/[\s()]/g, '');
    if (/^\d{5,20}(?:-\d{5,20})?@g\.us$/i.test(value) || /^\d{5,20}@lid$/i.test(value)) return value.toLowerCase();
    value = value.replace(/-/g, '');
    if (/^1203\d{14,16}$/.test(value)) return `${value}@g.us`;
    if (/^\d{10,15}@c\.us$/i.test(value)) return value.toLowerCase();
    value = value.replace(/^\+/, '').replace(/^00/, '');
    if (/^01\d{9}$/.test(value)) value = `20${value.slice(1)}`;
    return /^\d{10,15}$/.test(value) ? `${value}@c.us` : '';
}

function readApiKey(file = SETTINGS_FILE) {
    const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
    const line = text.split(/\r?\n/).find(item => /^\s*WAHA_API_KEY\s*=/.test(item));
    if (!line) throw new Error('missing key');
    const value = line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
    if (!value) throw new Error('missing key');
    return value;
}

function postWahaJson(endpointUrl, payload, apiKey, timeout = 15000) {
    const body = JSON.stringify(payload);
    return new Promise(resolve => {
        let settled = false;
        const finish = result => { if (!settled) { settled = true; resolve(result); } };
        const req = http.request(endpointUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'X-Api-Key': apiKey },
        }, res => {
            res.resume();
            res.on('error', () => finish({ success: false, error: UNCERTAIN }));
            res.on('aborted', () => finish({ success: false, error: UNCERTAIN }));
            res.on('end', () => {
                if (res.statusCode === 200 || res.statusCode === 201) finish({ success: true });
                else if (res.statusCode === 401 || res.statusCode === 403) finish({ success: false, error: 'تعذر الدخول إلى WAHA؛ راجع مفتاح API في برنامج التذكير.' });
                else finish({ success: false, error: `رفض WAHA الإرسال أو تعذر تأكيده (HTTP ${res.statusCode}). راجع المحادثة وحالة الخدمة قبل إعادة المحاولة.` });
            });
        });
        req.setTimeout(timeout, () => req.destroy());
        req.on('error', () => finish({ success: false, error: UNCERTAIN }));
        req.end(body);
    });
}

async function sendWahaMessage(target, text, options = {}) {
    const chatId = normalizeTarget(target);
    if (!chatId) return { success: false, error: 'أدخل رقم واتساب بمفتاح الدولة أو معرّف المحادثة الكامل.' };
    if (typeof text !== 'string' || !text.trim()) return { success: false, error: 'بيانات الإرسال غير مكتملة.' };
    let key;
    try { key = readApiKey(options.settingsFile); }
    catch { return { success: false, error: 'تعذر قراءة مفتاح WAHA من إعدادات برنامج التذكير.' }; }
    return postWahaJson(
        options.url || 'http://127.0.0.1:3000/api/sendText',
        { chatId, text, session: 'default' },
        key,
        options.timeout || 15000
    );
}

async function sendWahaFile(target, filePath, caption = '', options = {}) {
    const chatId = normalizeTarget(target);
    if (!chatId) return { success: false, error: 'أدخل رقم واتساب بمفتاح الدولة أو معرّف المحادثة الكامل.' };
    if (!filePath || typeof filePath !== 'string' || !fs.existsSync(filePath)) {
        return { success: false, error: 'ملف المصحف غير موجود للإرسال.' };
    }
    let key;
    try { key = readApiKey(options.settingsFile); }
    catch { return { success: false, error: 'تعذر قراءة مفتاح WAHA من إعدادات برنامج التذكير.' }; }
    let base64Data;
    try {
        base64Data = fs.readFileSync(filePath).toString('base64');
    } catch {
        return { success: false, error: 'تعذر قراءة ملف المصحف لإرساله عبر واتساب.' };
    }
    const ext = path.extname(filePath).toLowerCase();
    const mimetype = ext === '.html' || ext === '.htm' ? 'text/html' : 'application/pdf';
    return postWahaJson(
        options.url || 'http://127.0.0.1:3000/api/sendFile',
        {
            session: 'default',
            chatId,
            caption: typeof caption === 'string' ? caption : '',
            file: {
                mimetype,
                filename: path.basename(filePath),
                data: base64Data,
            },
        },
        key,
        options.timeout || 60000
    );
}

module.exports = { normalizeTarget, readApiKey, sendWahaMessage, sendWahaFile };
