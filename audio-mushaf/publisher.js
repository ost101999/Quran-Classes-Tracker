const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { sanitizeSegment, pruneOldFilesByExtension } = require('./session-store');

const DEFAULT_FIREBASE_URL = 'https://quran-classes-tracker-default-rtdb.firebaseio.com';
const DEFAULT_WEB_BASE_URL = 'https://project-mw5jh.vercel.app';

const SECTION_COLORS = {
    rev: { accent: '#60a5fa', strong: '#2563eb', bg: 'rgba(37, 99, 235, 0.16)', border: 'rgba(96, 165, 250, 0.45)', glow: 'rgba(59, 130, 246, 0.28)' },
    oldRev: { accent: '#fbbf24', strong: '#d97706', bg: 'rgba(217, 119, 6, 0.16)', border: 'rgba(251, 191, 36, 0.45)', glow: 'rgba(245, 158, 11, 0.28)' },
    new: { accent: '#34d399', strong: '#059669', bg: 'rgba(5, 150, 105, 0.16)', border: 'rgba(52, 211, 153, 0.45)', glow: 'rgba(16, 185, 129, 0.28)' },
    tilawa: { accent: '#a78bfa', strong: '#7c3aed', bg: 'rgba(124, 58, 237, 0.16)', border: 'rgba(167, 139, 250, 0.45)', glow: 'rgba(139, 92, 246, 0.28)' },
    corrections: { accent: '#2dd4bf', strong: '#0d9488', bg: 'rgba(13, 148, 136, 0.16)', border: 'rgba(45, 212, 191, 0.45)', glow: 'rgba(20, 184, 166, 0.28)' },
};

let cachedAcmeFontCss = null;

function buildAcmeFontCss() {
    if (cachedAcmeFontCss !== null) return cachedAcmeFontCss;
    const candidates = [
        path.join(__dirname, '..', 'public', 'fonts', 'Acme-Regular.ttf'),
        path.join(__dirname, 'fonts', 'Acme-Regular.ttf'),
        'C:\\My App\\Quran Classes Tracker\\public\\fonts\\Acme-Regular.ttf',
        'C:\\My App\\Quran Classes Tracker\\dist\\fonts\\Acme-Regular.ttf',
    ];
    for (const candidate of candidates) {
        try {
            if (fs.existsSync(candidate)) {
                const b64 = fs.readFileSync(candidate).toString('base64');
                cachedAcmeFontCss = `@font-face { font-family: 'Acme'; font-weight: 400; font-style: normal; font-display: swap; src: url('data:font/ttf;base64,${b64}') format('truetype'); }`;
                return cachedAcmeFontCss;
            }
        } catch { /* try next */ }
    }
    cachedAcmeFontCss = '';
    return cachedAcmeFontCss;
}

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
    const resolvedPdfJs = (pdfjsModulePath || require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).replace('app.asar', 'app.asar.unpacked');
    const resolvedWorker = (pdfjsWorkerPath || require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')).replace('app.asar', 'app.asar.unpacked');

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
        const helperHtml = path.join(__dirname, 'pdf-render-helper.html').replace('app.asar', 'app.asar.unpacked');
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
    const acmeFontCss = buildAcmeFontCss();

    const getCleanTabLabel = (sec) => {
        const rawAr = String(sec.titleAr || '').replace(/^(?:الدرس الحالي|الدرس القادم)\s*:\s*/u, '').trim();
        const rawEn = String(sec.titleEn || rawAr || sec.key || '').trim();
        return isAr ? (rawAr || rawEn) : (rawEn || rawAr);
    };

    const renderTabButton = (sec, idx) => {
        const theme = SECTION_COLORS[sec.key] || SECTION_COLORS.new;
        const tabLabel = getCleanTabLabel(sec);
        const pageCount = (sec.pages || []).length;
        const pinCount = (sec.pages || []).reduce((acc, p) => acc + (p.markers || []).length, 0);
        const pageBadge = isAr ? `${toHindiDigits(pageCount)} ص` : `${pageCount}p`;
        const pinBadge = pinCount > 0 ? (isAr ? `🔊 ${toHindiDigits(pinCount)}` : `🔊 ${pinCount}`) : '';

        return `
            <button
                type="button"
                class="sec-tab${idx === 0 ? ' is-active' : ''}"
                data-tab-index="${idx}"
                style="--sec-accent:${theme.accent};--sec-strong:${theme.strong};--sec-bg:${theme.bg};--sec-border:${theme.border};--sec-glow:${theme.glow};"
                onclick="selectMushafSection(${idx})"
            >
                <span class="sec-dot"></span>
                <span class="sec-tab-label">${escapeHtml(tabLabel)}</span>
                <span class="sec-tab-count">${escapeHtml(pageBadge)}</span>
                ${pinBadge ? `<span class="sec-tab-audio">${escapeHtml(pinBadge)}</span>` : ''}
            </button>
        `;
    };

    const hasReadingGroup = sections.some(s => s.group === 'reading');
    const hasHomeworkGroup = sections.some(s => s.group === 'homework');
    const showGroupedTabs = hasReadingGroup && hasHomeworkGroup;

    let tabsMarkup = '';
    if (showGroupedTabs) {
        const readingItems = sections.map((sec, idx) => ({ sec, idx })).filter(x => x.sec.group === 'reading');
        const homeworkItems = sections.map((sec, idx) => ({ sec, idx })).filter(x => x.sec.group === 'homework');
        const allBtn = `
            <button type="button" class="sec-tab sec-tab-all" data-tab-index="all" onclick="selectMushafSection('all')">
                <span class="sec-tab-label">${isAr ? 'عرض الكل' : 'Show All'}</span>
            </button>
        `;
        tabsMarkup = `
            <div class="tabs-groups">
                <div class="tab-group-card">
                    <div class="tab-group-title">${isAr ? 'الدرس الحالي' : 'Current Lesson'}</div>
                    <div class="tab-row">${readingItems.map(x => renderTabButton(x.sec, x.idx)).join('')}</div>
                </div>
                <div class="tab-group-card">
                    <div class="tab-group-title">${isAr ? 'الدرس القادم' : 'Next Lesson'}</div>
                    <div class="tab-row">${homeworkItems.map(x => renderTabButton(x.sec, x.idx)).join('')}</div>
                </div>
            </div>
            <div class="tab-all-row">${allBtn}</div>
        `;
    } else if (sections.length > 0) {
        const allBtn = sections.length > 1
            ? `<button type="button" class="sec-tab sec-tab-all" data-tab-index="all" onclick="selectMushafSection('all')"><span class="sec-tab-label">${isAr ? 'الكل' : 'All'}</span></button>`
            : '';
        tabsMarkup = `
            <div class="tab-row">${sections.map((sec, idx) => renderTabButton(sec, idx)).join('')}${allBtn}</div>
        `;
    }

    const totalPins = sections.reduce(
        (sum, sec) => sum + (sec.pages || []).reduce((pSum, p) => pSum + (p.markers || []).length, 0),
        0
    );

    const sectionsHtml = sections.map((sec, secIdx) => {
        const theme = SECTION_COLORS[sec.key] || SECTION_COLORS.new;
        const secTitle = isAr ? (sec.titleAr || sec.titleEn) : (sec.groupTitleEn ? `${sec.groupTitleEn} · ${getCleanTabLabel(sec)}` : (sec.titleEn || sec.titleAr));
        const secSummary = isAr ? (sec.summaryAr || sec.summaryEn) : (sec.summaryEn || sec.summaryAr);

        const pagesHtml = (sec.pages || []).map((p, pageIdx) => {
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
                    <span class="pin-ring"></span>
                    <span class="pin-icon">🔊</span>
                    <audio id="${escapeHtml(m.id)}" preload="none" src="${m.audioDataUrl}"></audio>
                </button>
            `).join('');

            return `
                <div class="mushaf-page-wrap" style="--page-order:${pageIdx};">
                    <div class="page-badge">${escapeHtml(pageLabel)}</div>
                    <div class="page-stage">
                        <img src="${p.imageDataUrl}" alt="${escapeHtml(pageLabel)}" loading="lazy" />
                        ${markersHtml}
                    </div>
                </div>
            `;
        }).join('');

        return `
            <section
                class="mushaf-section${secIdx === 0 ? ' is-visible' : ''}"
                data-section-index="${secIdx}"
                style="--sec-accent:${theme.accent};--sec-strong:${theme.strong};--sec-bg:${theme.bg};--sec-border:${theme.border};--sec-glow:${theme.glow};"
            >
                <div class="section-banner">
                    <div class="sec-title-wrap">
                        <span class="sec-dot"></span>
                        <span class="sec-title">${escapeHtml(secTitle)}</span>
                    </div>
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
  ${acmeFontCss}
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Acme', -apple-system, BlinkMacSystemFont, "Segoe UI", "Tahoma", "Amiri", sans-serif;
    background: radial-gradient(circle at top center, #0f1f3a 0%, #070d1a 55%, #040710 100%);
    color: #f8fafc;
    min-height: 100vh;
    padding: 18px 12px 64px;
  }
  .shell { max-width: 840px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px; }
  .header {
    background: linear-gradient(135deg, rgba(30, 41, 59, 0.92), rgba(15, 23, 42, 0.96));
    backdrop-filter: blur(14px);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 22px;
    padding: 18px 22px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    box-shadow: 0 18px 45px rgba(0, 0, 0, 0.45);
    animation: panelEnter 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .header h1 {
    font-family: 'Acme', "Segoe UI", Tahoma, sans-serif;
    font-size: 1.45rem;
    font-weight: 400;
    letter-spacing: 0.02em;
    color: #34d399;
  }
  .header .meta-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .pill-badge {
    font-family: 'Acme', "Segoe UI", sans-serif;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.12);
    color: #e2e8f0;
    font-size: 0.85rem;
    padding: 5px 12px;
    border-radius: 999px;
  }
  .hint {
    font-size: 0.86rem;
    color: #94a3b8;
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
  }
  .legend-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    border-radius: 999px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.08);
    font-size: 0.8rem;
    color: #cbd5e1;
  }
  .tabs-shell {
    position: sticky;
    top: 10px;
    z-index: 40;
    background: rgba(10, 17, 32, 0.86);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 20px;
    padding: 12px;
    box-shadow: 0 14px 36px rgba(0, 0, 0, 0.5);
    animation: panelEnter 0.5s 0.06s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .tabs-groups { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; }
  .tab-group-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px;
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .tab-group-title {
    font-family: 'Acme', "Segoe UI", Tahoma, sans-serif;
    font-size: 0.88rem;
    color: #94a3b8;
    letter-spacing: 0.03em;
    padding: 0 4px;
  }
  .tab-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .tab-all-row { margin-top: 8px; display: flex; justify-content: flex-end; }
  .sec-tab {
    --sec-accent: #34d399;
    --sec-strong: #059669;
    --sec-bg: rgba(16, 185, 129, 0.14);
    --sec-border: rgba(52, 211, 153, 0.45);
    --sec-glow: rgba(16, 185, 129, 0.28);
    font-family: 'Acme', "Segoe UI", Tahoma, sans-serif;
    appearance: none;
    border: 1px solid rgba(255,255,255,0.14);
    background: rgba(30, 41, 59, 0.65);
    color: #cbd5e1;
    border-radius: 13px;
    padding: 8px 13px;
    font-size: 0.98rem;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: transform 0.22s cubic-bezier(0.22, 1, 0.36, 1), background 0.22s ease, border-color 0.22s ease, box-shadow 0.25s ease, color 0.2s ease;
    -webkit-tap-highlight-color: transparent;
  }
  .sec-tab:hover {
    transform: translateY(-2px);
    background: rgba(51, 65, 85, 0.8);
    border-color: var(--sec-border);
    color: #ffffff;
  }
  .sec-tab:active { transform: scale(0.96); }
  .sec-tab.is-active {
    background: var(--sec-bg);
    border-color: var(--sec-accent);
    color: #ffffff;
    transform: translateY(-1px);
    box-shadow: 0 8px 22px -6px var(--sec-glow), 0 0 0 1px var(--sec-border);
  }
  .sec-tab-all {
    --sec-accent: #38bdf8;
    --sec-bg: rgba(56, 189, 248, 0.16);
    --sec-border: rgba(56, 189, 248, 0.45);
    --sec-glow: rgba(56, 189, 248, 0.25);
    font-size: 0.85rem;
    padding: 6px 12px;
  }
  .sec-dot {
    width: 9px;
    height: 9px;
    border-radius: 999px;
    background: var(--sec-accent);
    box-shadow: 0 0 8px var(--sec-accent);
    flex-shrink: 0;
  }
  .sec-tab-count {
    font-size: 0.78rem;
    padding: 2px 7px;
    border-radius: 999px;
    background: rgba(255,255,255,0.1);
    color: #e2e8f0;
  }
  .sec-tab-audio {
    font-size: 0.78rem;
    padding: 2px 7px;
    border-radius: 999px;
    background: rgba(16, 185, 129, 0.22);
    color: #6ee7b7;
  }
  .container { display: flex; flex-direction: column; gap: 26px; }
  .mushaf-section { display: none; flex-direction: column; gap: 18px; }
  .mushaf-section.is-visible {
    display: flex;
    animation: secPanelIn 0.42s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .section-banner {
    background: var(--sec-bg);
    border: 1.5px solid var(--sec-border);
    border-radius: 16px;
    padding: 12px 18px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    box-shadow: 0 10px 26px -10px var(--sec-glow);
  }
  .sec-title-wrap { display: inline-flex; align-items: center; gap: 10px; }
  .sec-title {
    font-family: 'Acme', "Segoe UI", Tahoma, sans-serif;
    font-size: 1.2rem;
    color: #ffffff;
    letter-spacing: 0.02em;
  }
  .sec-summary {
    font-family: 'Acme', "Segoe UI", Tahoma, sans-serif;
    font-size: 0.92rem;
    color: var(--sec-accent);
    background: rgba(15, 23, 42, 0.55);
    padding: 4px 12px;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.08);
  }
  .mushaf-page-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    animation: pageSlideUp 0.42s calc(var(--page-order, 0) * 55ms) cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .page-badge {
    font-family: 'Acme', "Segoe UI", sans-serif;
    background: rgba(255,255,255,0.09);
    border: 1px solid rgba(255,255,255,0.12);
    color: #e2e8f0;
    font-size: 0.88rem;
    padding: 4px 14px;
    border-radius: 999px;
  }
  .page-stage {
    position: relative;
    display: inline-block;
    width: 100%;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 18px 46px rgba(0,0,0,0.55);
    border: 1px solid rgba(255,255,255,0.15);
    background: #fff;
    transition: transform 0.25s ease;
  }
  .page-stage img { display: block; width: 100%; height: auto; }
  .audio-pin {
    position: absolute;
    transform: translate(-50%, -85%);
    width: 30px;
    height: 30px;
    border-radius: 999px;
    border: 2px solid #ffffff;
    background: linear-gradient(135deg, #10b981, #059669);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    cursor: pointer;
    box-shadow: 0 5px 14px rgba(0,0,0,0.45);
    transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1), background 0.2s ease, box-shadow 0.2s ease;
    z-index: 10;
    -webkit-tap-highlight-color: transparent;
  }
  .pin-ring { display: none; }
  .audio-pin:hover { transform: translate(-50%, -85%) scale(1.18); z-index: 20; }
  .audio-pin.playing {
    background: linear-gradient(135deg, #ef4444, #dc2626);
    transform: translate(-50%, -85%) scale(1.28);
    box-shadow: 0 0 0 6px rgba(239,68,68,0.32);
    z-index: 30;
  }
  .audio-pin.playing .pin-ring {
    display: block;
    position: absolute;
    inset: -6px;
    border-radius: 999px;
    border: 2px solid rgba(239, 68, 68, 0.75);
    animation: pinPulse 1.2s ease-out infinite;
    pointer-events: none;
  }
  @keyframes panelEnter {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes secPanelIn {
    from { opacity: 0; transform: translateY(14px) scale(0.985); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes pageSlideUp {
    from { opacity: 0; transform: translateY(18px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes pinPulse {
    0% { transform: scale(0.95); opacity: 0.9; }
    100% { transform: scale(1.65); opacity: 0; }
  }
  @media (min-width: 768px) {
    .audio-pin { width: 34px; height: 34px; font-size: 15px; }
  }
</style>
</head>
<body>
  <div class="shell">
    <div class="header">
      <h1>${escapeHtml(titleText)}</h1>
      <div class="meta-row">
        <span class="pill-badge">${escapeHtml(displayDate)}</span>
      </div>
      <div class="hint">
        <span>${isAr ? 'اختر القسم لعرض صفحاته، واضغط على أي علامة 🔊 لسماع التصحيح.' : 'Select a section below to view its pages, and tap 🔊 to listen.'}</span>
        ${totalPins > 0 ? `<span class="legend-chip">🔊 ${isAr ? `${toHindiDigits(totalPins)} تصحيح صوتي` : `${totalPins} Voice Corrections`}</span>` : ''}
        <span class="legend-chip">🟢 ${isAr ? 'تظليل أخضر = حفظ' : 'Green = Memorization'}</span>
      </div>
    </div>

    ${tabsMarkup ? `<div class="tabs-shell">${tabsMarkup}</div>` : ''}
    <div class="container">${sectionsHtml}</div>
  </div>
<script>
  function stopAllAudio() {
    document.querySelectorAll('audio').forEach(function(a) { a.pause(); a.currentTime = 0; });
    document.querySelectorAll('.audio-pin').forEach(function(b) { b.classList.remove('playing'); });
  }
  function selectMushafSection(target) {
    stopAllAudio();
    document.querySelectorAll('.sec-tab').forEach(function(btn) {
      btn.classList.toggle('is-active', String(btn.getAttribute('data-tab-index')) === String(target));
    });
    document.querySelectorAll('.mushaf-section').forEach(function(sec) {
      var show = target === 'all' || String(sec.getAttribute('data-section-index')) === String(target);
      if (show) {
        sec.classList.remove('is-visible');
        void sec.offsetWidth;
        sec.classList.add('is-visible');
      } else {
        sec.classList.remove('is-visible');
      }
    });
  }
  function togglePinAudio(btn, audioId) {
    var audio = document.getElementById(audioId);
    if (!audio) return;
    var wasPlaying = btn.classList.contains('playing');
    stopAllAudio();
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
