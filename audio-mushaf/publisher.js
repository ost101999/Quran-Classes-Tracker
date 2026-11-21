const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { sanitizeSegment, pruneOldFilesByExtension } = require('./session-store');

const DEFAULT_FIREBASE_URL = 'https://quran-classes-tracker-default-rtdb.firebaseio.com';
const DEFAULT_WEB_BASE_URL = 'https://project-mw5jh.vercel.app';

const SECTION_COLORS = {
    rev: { accent: '#1d4ed8', bg: '#eff6ff', border: '#93c5fd' },
    oldRev: { accent: '#b45309', bg: '#fffbeb', border: '#fcd34d' },
    new: { accent: '#047857', bg: '#ecfdf5', border: '#6ee7b7' },
    tilawa: { accent: '#6d28d9', bg: '#f5f3ff', border: '#c4b5fd' },
    corrections: { accent: '#0f766e', bg: '#f0fdfa', border: '#5eead4' },
};

function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function toHindiDigits(val) {
    return String(val ?? '').replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}

function httpJsonRequest(urlString, { method = 'GET', body } = {}, requestImpl = https.request) {
    const payload = body === undefined ? null : JSON.stringify(body);
    return new Promise((resolve, reject) => {
        const headers = {};
        if (payload !== null) {
            headers['Content-Type'] = 'application/json';
            headers['Content-Length'] = Buffer.byteLength(payload);
        }
        const req = requestImpl(urlString, { method, headers }, res => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('error', reject);
            res.on('end', () => {
                const status = res.statusCode || 0;
                const text = Buffer.concat(chunks).toString('utf8');
                if (status < 200 || status >= 300) {
                    const err = new Error(`Firebase HTTP ${status}: ${text.slice(0, 150)}`);
                    err.status = status;
                    reject(err);
                    return;
                }
                try {
                    resolve(text ? JSON.parse(text) : null);
                } catch {
                    resolve(text);
                }
            });
        });
        req.setTimeout(30000, () => req.destroy(new Error('انتهت مهلة الاتصال بالخادم السحابي.')));
        req.on('error', reject);
        if (payload !== null) req.write(payload);
        req.end();
    });
}

/**
 * Renders specified 1-based PDF pages (including Xodo/Acrobat annotations) to JPEG data URLs
 * inside an offscreen Electron BrowserWindow using pdfjs-dist.
 */
async function renderPdfPagesToImages({
    BrowserWindow,
    pdfPath,
    pdfBytes = null,
    pageNumbers,
    pdfjsModulePath,
    pdfjsWorkerPath,
    scale = 1.6,
    jpegQuality = 0.84,
}) {
    if (!BrowserWindow) throw new Error('BrowserWindow is required to render PDF pages');
    if (!pdfBytes && (!pdfPath || !fs.existsSync(pdfPath))) throw new Error('ملف مصحف الطالب غير موجود.');
    const uniquePages = [...new Set((pageNumbers || []).filter(p => Number.isInteger(p) && p >= 1))];
    if (uniquePages.length === 0) return {};

    const pdfBase64 = Buffer.from(pdfBytes || fs.readFileSync(pdfPath)).toString('base64');
    const resolvedPdfJs = pdfjsModulePath || require.resolve('pdfjs-dist/legacy/build/pdf.mjs');
    const resolvedWorker = pdfjsWorkerPath || require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');

    const win = new BrowserWindow({
        width: 1000,
        height: 1400,
        show: false,
        webPreferences: {
            offscreen: true,
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    try {
        const helperHtml = path.join(__dirname, 'pdf-render-helper.html');
        if (fs.existsSync(helperHtml)) {
            await win.loadFile(helperHtml);
        } else {
            await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<!DOCTYPE html><html><body></body></html>'));
        }
        const moduleUrl = pathToFileURL(resolvedPdfJs).href;
        const workerUrl = pathToFileURL(resolvedWorker).href;

        const rendered = await win.webContents.executeJavaScript(`
            (async () => {
                const pdfjsLib = await import(${JSON.stringify(moduleUrl)});
                pdfjsLib.GlobalWorkerOptions.workerSrc = ${JSON.stringify(workerUrl)};
                const binStr = atob(${JSON.stringify(pdfBase64)});
                const bytes = new Uint8Array(binStr.length);
                for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
                const doc = await pdfjsLib.getDocument({ data: bytes, verbosity: 0, disableWorker: true }).promise;
                const out = {};
                for (const pageNum of ${JSON.stringify(uniquePages)}) {
                    if (pageNum < 1 || pageNum > doc.numPages) continue;
                    const page = await doc.getPage(pageNum);
                    const viewport = page.getViewport({ scale: ${Number(scale) || 1.6} });
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.round(viewport.width);
                    canvas.height = Math.round(viewport.height);
                    const ctx = canvas.getContext('2d', { alpha: false });
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    await page.render({ canvasContext: ctx, viewport, annotationMode: 2 }).promise;
                    out[String(pageNum)] = {
                        imageDataUrl: canvas.toDataURL('image/jpeg', ${Number(jpegQuality) || 0.84}),
                        width: canvas.width,
                        height: canvas.height,
                    };
                }
                return out;
            })()
        `, true);
        return rendered || {};
    } finally {
        if (!win.isDestroyed()) win.close();
    }
}

function buildInteractiveHtml({
    studentName,
    dateStr,
    language = 'ar',
    sections = [],
}) {
    const isAr = language !== 'en';
    const titleText = isAr ? `المصحف الصوتي — ${studentName}` : `Audio Mushaf — ${studentName}`;
    const displayDate = isAr ? toHindiDigits(dateStr) : dateStr;

    const sectionsHtml = sections.map(sec => {
        const theme = SECTION_COLORS[sec.key] || SECTION_COLORS.new;
        const secTitle = isAr ? (sec.titleAr || sec.titleEn) : (sec.titleEn || sec.titleAr);
        const secSummary = isAr ? (sec.summaryAr || sec.summaryEn) : (sec.summaryEn || sec.summaryAr);

        const pagesHtml = (sec.pages || []).map(p => {
            const pageLabel = isAr ? `صفحة ${toHindiDigits(p.pdfPage)}` : `Page ${p.pdfPage}`;
            const markersHtml = (p.markers || []).map((m, idx) => `
                <button
                    type="button"
                    class="audio-pin"
                    style="left:${m.xPercent}%;top:${m.yPercent}%;"
                    data-audio-id="${escapeHtml(m.id)}"
                    title="${isAr ? 'استماع للتصحيح' : 'Play correction'} (${idx + 1})"
                    onclick="togglePinAudio(this, '${escapeHtml(m.id)}')"
                >
                    <span class="pin-icon">🔊</span>
                    <audio id="${escapeHtml(m.id)}" preload="none" src="${m.audioDataUrl}"></audio>
                </button>
            `).join('');

            return `
                <div class="mushaf-page-wrap">
                    <div class="page-badge">${escapeHtml(pageLabel)}</div>
                    <div class="page-stage">
                        <img src="${p.imageDataUrl}" alt="${escapeHtml(pageLabel)}" loading="lazy" />
                        ${markersHtml}
                    </div>
                </div>
            `;
        }).join('');

        return `
            <section class="mushaf-section">
                <div class="section-banner" style="background:${theme.bg};border-color:${theme.border};color:${theme.accent};">
                    <span class="sec-title">${escapeHtml(secTitle)}</span>
                    ${secSummary ? `<span class="sec-summary">${escapeHtml(secSummary)}</span>` : ''}
                </div>
                ${pagesHtml}
            </section>
        `;
    }).join('');

    return `<!DOCTYPE html>
<html lang="${isAr ? 'ar' : 'en'}" dir="${isAr ? 'rtl' : 'ltr'}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
<title>${escapeHtml(titleText)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Tahoma", "Amiri", sans-serif;
    background: #0f172a;
    color: #f8fafc;
    min-height: 100vh;
    padding: 16px 12px 48px;
  }
  .header {
    max-width: 820px;
    margin: 0 auto 20px;
    background: #1e293b;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 18px;
    padding: 16px 20px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .header h1 { font-size: 1.25rem; font-weight: 700; color: #34d399; }
  .header .meta { font-size: 0.9rem; color: #cbd5e1; }
  .hint { font-size: 0.85rem; color: #94a3b8; margin-top: 4px; width: 100%; }
  .container { max-width: 820px; margin: 0 auto; display: flex; flex-direction: column; gap: 28px; }
  .mushaf-section { display: flex; flex-direction: column; gap: 16px; }
  .section-banner {
    border: 1.5px solid;
    border-radius: 14px;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    font-weight: 700;
    font-size: 1.05rem;
  }
  .sec-summary { font-weight: 600; font-size: 0.92rem; color: #334155; }
  .mushaf-page-wrap { display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .page-badge {
    background: rgba(255,255,255,0.08);
    color: #cbd5e1;
    font-size: 0.85rem;
    font-weight: 600;
    padding: 4px 12px;
    border-radius: 999px;
  }
  .page-stage {
    position: relative;
    display: inline-block;
    width: 100%;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 12px 35px rgba(0,0,0,0.45);
    border: 1px solid rgba(255,255,255,0.12);
    background: #fff;
  }
  .page-stage img { display: block; width: 100%; height: auto; }
  .audio-pin {
    position: absolute;
    transform: translate(-50%, -85%);
    width: 28px;
    height: 28px;
    border-radius: 999px;
    border: 2px solid #ffffff;
    background: rgba(16, 185, 129, 0.92);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    cursor: pointer;
    box-shadow: 0 3px 10px rgba(0,0,0,0.4);
    transition: transform 0.2s ease, background 0.2s ease;
    z-index: 10;
    -webkit-tap-highlight-color: transparent;
  }
  .audio-pin:hover { transform: translate(-50%, -85%) scale(1.18); z-index: 20; }
  .audio-pin.playing {
    background: #ef4444;
    transform: translate(-50%, -85%) scale(1.3);
    box-shadow: 0 0 0 6px rgba(239,68,68,0.3);
    z-index: 30;
  }
  @media (min-width: 768px) {
    .audio-pin { width: 32px; height: 32px; font-size: 15px; }
  }
</style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(titleText)}</h1>
    <div class="meta">${escapeHtml(displayDate)}</div>
    <div class="hint">${isAr ? 'اضغط على أي علامة صوت 🔊 للاستماع لتصحيح التلاوة.' : 'Tap any 🔊 marker above a word to listen to the correction.'}</div>
  </div>
  <div class="container">${sectionsHtml}</div>
<script>
  function togglePinAudio(btn, audioId) {
    var audio = document.getElementById(audioId);
    if (!audio) return;
    var wasPlaying = btn.classList.contains('playing');
    document.querySelectorAll('audio').forEach(function(a) { a.pause(); a.currentTime = 0; });
    document.querySelectorAll('.audio-pin').forEach(function(b) { b.classList.remove('playing'); });
    if (wasPlaying) return;
    btn.classList.add('playing');
    audio.play().catch(function() { btn.classList.remove('playing'); });
    audio.onended = function() { btn.classList.remove('playing'); };
  }
</script>
</body>
</html>`;
}

function saveInteractiveHtmlFile({
    outputDir,
    studentName,
    dateStr,
    html,
    maxFilesToKeep = null,
}) {
    fs.mkdirSync(outputDir, { recursive: true });
    const cleanName = sanitizeSegment(studentName).replace(/_/g, ' ');
    const cleanDate = sanitizeSegment(dateStr);
    const fileName = `${cleanName} - ${cleanDate}.html`;
    const filePath = path.join(outputDir, fileName);
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, html, 'utf8');
    fs.renameSync(tempPath, filePath);
    if (maxFilesToKeep) {
        pruneOldFilesByExtension(outputDir, maxFilesToKeep, '.html', filePath);
    }
    return { success: true, filePath, fileName };
}

/**
 * Publishes an audio Mushaf session to Firebase RTDB and prunes older sessions
 * so at most `maxSessionsPerStudent` (default 3) remain per student.
 */
async function publishAudioSessionToCloud(sessionPayload, {
    firebaseBaseUrl = DEFAULT_FIREBASE_URL,
    webBaseUrl = DEFAULT_WEB_BASE_URL,
    maxSessionsPerStudent = 3,
    requestImpl = https.request,
} = {}) {
    const studentKey = sanitizeSegment((sessionPayload.studentId || sessionPayload.studentName || 'student').toLowerCase());
    const createdAt = Number(sessionPayload.createdAt) || Date.now();
    const sessionId = `${studentKey}_${sanitizeSegment(sessionPayload.dateStr || 'lesson')}_${createdAt.toString(36)}`;

    const payload = {
        ...sessionPayload,
        id: sessionId,
        studentKey,
        createdAt,
    };

    await httpJsonRequest(`${firebaseBaseUrl}/audioMushafSessions/${encodeURIComponent(sessionId)}.json`, {
        method: 'PUT',
        body: payload,
    }, requestImpl);

    const indexUrl = `${firebaseBaseUrl}/audioMushafIndex/${encodeURIComponent(studentKey)}.json`;
    let existingIndex = {};
    try {
        existingIndex = (await httpJsonRequest(indexUrl, { method: 'GET' }, requestImpl)) || {};
    } catch {
        existingIndex = {};
    }
    const nextIndex = { ...existingIndex, [sessionId]: createdAt };
    const entries = Object.entries(nextIndex).sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0));
    const kept = entries.slice(0, maxSessionsPerStudent);
    const pruned = entries.slice(maxSessionsPerStudent);

    const updatedIndexMap = Object.fromEntries(kept);
    await httpJsonRequest(indexUrl, { method: 'PUT', body: updatedIndexMap }, requestImpl);

    for (const [oldId] of pruned) {
        await httpJsonRequest(`${firebaseBaseUrl}/audioMushafSessions/${encodeURIComponent(oldId)}.json`, {
            method: 'DELETE',
        }, requestImpl).catch(() => { });
    }

    return {
        success: true,
        sessionId,
        url: `${webBaseUrl}/?mushaf=${encodeURIComponent(sessionId)}`,
        prunedCount: pruned.length,
    };
}

module.exports = {
    DEFAULT_FIREBASE_URL,
    DEFAULT_WEB_BASE_URL,
    httpJsonRequest,
    renderPdfPagesToImages,
    buildInteractiveHtml,
    saveInteractiveHtmlFile,
    publishAudioSessionToCloud,
};
