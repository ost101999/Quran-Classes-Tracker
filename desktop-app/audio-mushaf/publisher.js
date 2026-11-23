const crypto = require('node:crypto');
const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { sanitizeSegment, pruneOldFilesByExtension } = require('./session-store');
const { MUSHAF_620_FRAME, isSupported620Pdf } = require('./mushaf-crop-data');

const DEFAULT_FIREBASE_URL = 'https://quran-classes-tracker-default-rtdb.firebaseio.com';
const DEFAULT_WEB_BASE_URL = 'https://o-quran.vercel.app';
const SHORT_ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ARABIC_TO_LATIN_MAP = {
    'ا': 'a', 'أ': 'a', 'إ': 'e', 'آ': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th',
    'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z',
    'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a',
    'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
    'ه': 'h', 'ة': 'a', 'و': 'w', 'ي': 'y', 'ى': 'a', 'ئ': 'e', 'ؤ': 'o',
};

function buildStudentShortSlug(studentName) {
    let text = String(studentName || '').replace(/[\u064B-\u065F\u0670\u0640]/g, '').toLowerCase().trim();
    for (const [ar, en] of Object.entries(ARABIC_TO_LATIN_MAP)) {
        text = text.replace(new RegExp(ar, 'g'), en);
    }
    const words = text.replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 2);
    return words.join('-') || 's';
}

function randomShortCode(len = 2) {
    const bytes = crypto.randomBytes(len);
    let out = '';
    for (let i = 0; i < len; i++) {
        out += SHORT_ID_ALPHABET[bytes[i] % SHORT_ID_ALPHABET.length];
    }
    return out;
}

async function generateShortStudentSessionId(studentName, existingIndex, firebaseBaseUrl, requestImpl) {
    const slug = buildStudentShortSlug(studentName);
    for (let attempt = 0; attempt < 16; attempt++) {
        const candidate = `${slug}-${randomShortCode(attempt < 12 ? 2 : 3)}`;
        if (Object.prototype.hasOwnProperty.call(existingIndex, candidate)) continue;
        try {
            const taken = await httpJsonRequest(
                `${firebaseBaseUrl}/audioMushafSessions/${encodeURIComponent(candidate)}.json?shallow=true`,
                { method: 'GET' },
                requestImpl
            );
            if (taken) continue;
        } catch { /* proceed if check fails transiently */ }
        return candidate;
    }
    return `${slug}-${randomShortCode(4)}`;
}

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

const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatLessonDate(dateStr, isAr) {
    const m = String(dateStr || '').trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!m) return isAr ? toHindiDigits(dateStr) : String(dateStr || '');
    const year = Number(m[1]);
    const monthIdx = Number(m[2]) - 1;
    const day = Number(m[3]);
    if (monthIdx < 0 || monthIdx > 11) return isAr ? toHindiDigits(dateStr) : String(dateStr || '');
    if (isAr) {
        return `${toHindiDigits(day)} ${AR_MONTHS[monthIdx]} ${toHindiDigits(year)}`;
    }
    return `${day} ${EN_MONTHS[monthIdx]} ${year}`;
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
    cropRequests = null,
    pdfjsModulePath,
    pdfjsWorkerPath,
    scale = 1.6,
    jpegQuality = 0.84,
}) {
    if (!BrowserWindow) throw new Error('BrowserWindow is required to render PDF pages');
    if (!pdfBytes && (!pdfPath || !fs.existsSync(pdfPath))) throw new Error('ملف مصحف الطالب غير موجود.');
    const normalizedCrops = Array.isArray(cropRequests) && cropRequests.length > 0
        ? cropRequests.filter(r => r && r.key && Number.isInteger(r.pdfPage) && r.pdfPage >= 1)
        : null;
    const uniquePages = normalizedCrops
        ? [...new Set(normalizedCrops.map(r => r.pdfPage))]
        : [...new Set((pageNumbers || []).filter(p => Number.isInteger(p) && p >= 1))];
    if (uniquePages.length === 0) return {};

    const requestsByPage = {};
    if (normalizedCrops) {
        for (const req of normalizedCrops) {
            if (!requestsByPage[req.pdfPage]) requestsByPage[req.pdfPage] = [];
            requestsByPage[req.pdfPage].push(req);
        }
    }

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
        const frameMeta = MUSHAF_620_FRAME;

        const rendered = await win.webContents.executeJavaScript(`
            (async () => {
                const pdfjsLib = await import(${JSON.stringify(moduleUrl)});
                pdfjsLib.GlobalWorkerOptions.workerSrc = ${JSON.stringify(workerUrl)};
                const binStr = atob(${JSON.stringify(pdfBase64)});
                const bytes = new Uint8Array(binStr.length);
                for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
                const doc = await pdfjsLib.getDocument({ data: bytes, verbosity: 0, disableWorker: true }).promise;
                const reqMap = ${JSON.stringify(requestsByPage)};
                const frame = ${JSON.stringify(frameMeta)};
                const hasCropMode = ${JSON.stringify(!!normalizedCrops)};
                const is620Layout = doc.numPages >= 618 && doc.numPages <= 625;
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

                    const reqs = hasCropMode ? (reqMap[pageNum] || []) : [{ key: String(pageNum), pdfPage: pageNum, crop: null }];
                    const aspectOk = Math.abs((viewport.width / viewport.height) - frame.aspectRatio) <= 0.035;
                    for (const req of reqs) {
                        const crop = req.crop;
                        if (!crop || !crop.isCropped || !is620Layout || !aspectOk) {
                            out[req.key] = {
                                imageDataUrl: canvas.toDataURL('image/jpeg', ${Number(jpegQuality) || 0.84}),
                                width: canvas.width,
                                height: canvas.height,
                                srcHeight: canvas.height,
                                outHeight: canvas.height,
                                srcY0: 0,
                                padTop: 0,
                                cropApplied: false,
                            };
                            continue;
                        }
                        const srcW = canvas.width;
                        const srcH = canvas.height;
                        const srcY0 = Math.max(0, Math.round(crop.topFrac * srcH));
                        const srcY1 = Math.min(srcH, Math.round(crop.botFrac * srcH));
                        const cropH = Math.max(24, srcY1 - srcY0);
                        const padTop = crop.drawTopBar ? Math.max(8, Math.round(srcH * 0.014)) : 0;
                        const padBot = crop.drawBotBar ? Math.max(8, Math.round(srcH * 0.014)) : 0;
                        const outH = cropH + padTop + padBot;
                        const outCanvas = document.createElement('canvas');
                        outCanvas.width = srcW;
                        outCanvas.height = outH;
                        const octx = outCanvas.getContext('2d', { alpha: false });
                        octx.fillStyle = '#ffffff';
                        octx.fillRect(0, 0, srcW, outH);
                        octx.drawImage(canvas, 0, srcY0, srcW, cropH, 0, padTop, srcW, cropH);

                        const barW = Math.max(2, Math.round(frame.borderWidthFrac * srcH));
                        const bx0 = Math.round(frame.borderLeftFrac * srcW);
                        const bx1 = Math.round(frame.borderRightFrac * srcW);
                        octx.fillStyle = frame.borderColor || '#aba000';
                        if (crop.drawTopBar) {
                            octx.fillRect(bx0, Math.max(0, padTop - Math.floor(barW / 2)), bx1 - bx0, barW);
                        }
                        if (crop.drawBotBar) {
                            octx.fillRect(bx0, Math.min(outH - barW, padTop + cropH - Math.ceil(barW / 2)), bx1 - bx0, barW);
                        }
                        out[req.key] = {
                            imageDataUrl: outCanvas.toDataURL('image/jpeg', ${Number(jpegQuality) || 0.84}),
                            width: srcW,
                            height: outH,
                            srcHeight: srcH,
                            outHeight: outH,
                            srcY0,
                            padTop,
                            cropApplied: true,
                        };
                    }
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
    const displayDate = formatLessonDate(dateStr, isAr);
    const acmeFontCss = buildAcmeFontCss();

    const getCleanTabLabel = (sec) => {
        const rawAr = String(sec.titleAr || '').replace(/^(?:الدرس الحالي|الدرس القادم)\s*:\s*/u, '').trim();
        const rawEn = String(sec.titleEn || rawAr || sec.key || '').trim();
        return isAr ? (rawAr || rawEn) : (rawEn || rawAr);
    };

    const renderTabButton = (sec, idx) => {
        const theme = SECTION_COLORS[sec.key] || SECTION_COLORS.new;
        const tabLabel = getCleanTabLabel(sec);
        const pinCount = (sec.pages || []).reduce((acc, p) => acc + (p.markers || []).length, 0);
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

        const nextSec = secIdx + 1 < sections.length ? sections[secIdx + 1] : null;
        const nextTheme = nextSec ? (SECTION_COLORS[nextSec.key] || SECTION_COLORS.new) : null;
        const nextSecTitle = nextSec
            ? (isAr ? (nextSec.titleAr || nextSec.titleEn) : (nextSec.groupTitleEn ? `${nextSec.groupTitleEn} · ${getCleanTabLabel(nextSec)}` : (nextSec.titleEn || nextSec.titleAr)))
            : '';
        const nextSecSummary = nextSec ? (isAr ? (nextSec.summaryAr || nextSec.summaryEn) : (nextSec.summaryEn || nextSec.summaryAr)) : '';
        const nextHintMarkup = nextSec ? `
                <div class="next-sec-hint" style="--next-accent:${nextTheme.accent};">
                    <button type="button" class="next-sec-btn" onclick="selectMushafSection(${secIdx + 1})">
                        <span class="next-sec-main">
                            <span class="next-sec-dot"></span>
                            <span class="next-sec-kicker">${isAr ? 'القسم التالي:' : 'Next:'}</span>
                            <span class="next-sec-name">${escapeHtml(nextSecTitle)}</span>
                        </span>
                        <span class="next-sec-side">
                            ${nextSecSummary ? `<span class="next-sec-summary">${escapeHtml(nextSecSummary)}</span>` : ''}
                            <span class="next-sec-arrow">${isAr ? '←' : '→'}</span>
                        </span>
                    </button>
                </div>` : '';

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
                ${nextHintMarkup}
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
  .mushaf-section.is-visible .section-banner {
    animation: bannerRevealSettle 0.95s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .next-sec-hint {
    padding-top: 8px;
    opacity: 0.25;
    transform: translateY(6px);
    transition: opacity 0.45s ease, transform 0.45s ease;
  }
  .next-sec-hint.is-near-bottom { opacity: 0.72; transform: translateY(0); }
  .next-sec-hint:hover { opacity: 1; }
  .container.is-show-all .next-sec-hint { display: none; }
  .next-sec-btn {
    width: 100%;
    appearance: none;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(15, 23, 42, 0.5);
    backdrop-filter: blur(12px);
    border-radius: 16px;
    padding: 12px 16px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    color: #cbd5e1;
    cursor: pointer;
    font-family: 'Acme', "Segoe UI", Tahoma, sans-serif;
    transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }
  .next-sec-btn:hover { background: rgba(30, 41, 59, 0.78); border-color: rgba(255, 255, 255, 0.24); color: #ffffff; }
  .next-sec-btn:active { transform: scale(0.99); }
  .next-sec-main { display: inline-flex; align-items: center; gap: 9px; min-width: 0; }
  .next-sec-dot { width: 8px; height: 8px; border-radius: 999px; background: var(--next-accent, #34d399); box-shadow: 0 0 8px var(--next-accent, #34d399); flex-shrink: 0; }
  .next-sec-kicker { font-size: 0.84rem; color: #94a3b8; flex-shrink: 0; }
  .next-sec-name { font-size: 0.98rem; color: inherit; }
  .next-sec-side { display: inline-flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .next-sec-summary { font-size: 0.78rem; color: #94a3b8; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09); border-radius: 999px; padding: 2px 10px; }
  .next-sec-arrow { font-size: 0.95rem; color: #94a3b8; }
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
    --pin-ty: -140%;
    transform: translate(-50%, var(--pin-ty));
    width: 24px;
    height: 24px;
    border-radius: 999px;
    border: 1.5px solid rgba(255, 255, 255, 0.80);
    background: rgba(16, 185, 129, 0.50);
    opacity: 0.75;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    cursor: pointer;
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.18);
    transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1), background 0.2s ease, border-color 0.2s ease, opacity 0.2s ease, box-shadow 0.2s ease;
    z-index: 10;
    -webkit-tap-highlight-color: transparent;
  }
  .audio-pin::after {
    content: "";
    position: absolute;
    inset: -7px;
  }
  .pin-ring { display: none; }
  .audio-pin:hover,
  .audio-pin:focus-visible {
    opacity: 1;
    border-color: #ffffff;
    background: linear-gradient(135deg, #10b981, #059669);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.42);
    transform: translate(-50%, var(--pin-ty)) scale(1.18);
    z-index: 20;
  }
  .audio-pin.playing {
    opacity: 1;
    border-color: #ffffff;
    background: linear-gradient(135deg, #ef4444, #dc2626);
    transform: translate(-50%, var(--pin-ty)) scale(1.28);
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
  @keyframes bannerRevealSettle {
    0% {
      opacity: 0;
      transform: translateY(10px) scale(0.985);
      box-shadow: 0 0 0 0 rgba(0, 0, 0, 0);
    }
    45% {
      opacity: 1;
      transform: translateY(0) scale(1.012);
      box-shadow: 0 14px 34px -4px var(--sec-glow), 0 0 0 1px var(--sec-accent);
    }
    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
      box-shadow: 0 10px 26px -10px var(--sec-glow);
    }
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
    .audio-pin { width: 28px; height: 28px; font-size: 13px; }
  }
</style>
</head>
<body>
  <div class="shell">
    <div class="header">
      <h1>${escapeHtml(titleText)}</h1>
      <div class="meta-row">
        <span class="pill-badge">${escapeHtml(displayDate)}</span>
        ${totalPins > 0 ? `<span class="legend-chip">🔊 ${isAr ? `${toHindiDigits(totalPins)} تصحيح صوتي` : `${totalPins} Voice`}</span>` : ''}
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
  function updateNextHintState() {
    var doc = document.documentElement;
    var remaining = doc.scrollHeight - (window.scrollY + window.innerHeight);
    var isNear = remaining <= 220;
    document.querySelectorAll('.next-sec-hint').forEach(function(el) {
      el.classList.toggle('is-near-bottom', isNear);
    });
  }
  function selectMushafSection(target) {
    stopAllAudio();
    var container = document.querySelector('.container');
    if (container) container.classList.toggle('is-show-all', String(target) === 'all');
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
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
    requestAnimationFrame(updateNextHintState);
  }
  window.addEventListener('scroll', updateNextHintState, { passive: true });
  window.addEventListener('resize', updateNextHintState, { passive: true });
  requestAnimationFrame(updateNextHintState);
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
  function snapStagePinsToWhiteGap(stageEl) {
    if (!stageEl || stageEl.getAttribute('data-gap-scanned') === '1') return;
    var imgEl = stageEl.querySelector('img');
    var pins = stageEl.querySelectorAll('.audio-pin');
    if (!imgEl || !pins.length) return;
    var w = imgEl.naturalWidth || imgEl.width;
    var h = imgEl.naturalHeight || imgEl.height;
    if (!w || !h) return;
    stageEl.setAttribute('data-gap-scanned', '1');
    try {
      var canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(imgEl, 0, 0, w, h);
      var imgData = ctx.getImageData(0, 0, w, h).data;
      function isBlackInk(x, y) {
        var idx = (y * w + x) * 4;
        var r = imgData[idx], g = imgData[idx + 1], b = imgData[idx + 2];
        return r < 165 && g < 165 && b < 165 && (Math.max(r, g, b) - Math.min(r, g, b)) < 48;
      }
      var halfW = Math.max(8, Math.round(w * 0.017));
      var wideW = Math.max(24, Math.round(w * 0.08));
      var maxUp = Math.max(36, Math.round(w * 0.088));
      var maxDown = Math.max(14, Math.round(w * 0.032));
      var minGapLen = Math.max(4, Math.round(w * 0.010));
      pins.forEach(function(pinEl) {
        var xPct = parseFloat(pinEl.style.left);
        var yPct = parseFloat(pinEl.style.top);
        if (!isFinite(xPct) || !isFinite(yPct)) return;
        var cx = Math.round((xPct / 100) * w);
        var cy = Math.round((yPct / 100) * h);
        var yMin = Math.max(4, cy - maxUp);
        var yMax = Math.min(h - 5, cy + maxDown);
        var lenY = yMax - yMin + 1;
        var localCounts = new Int16Array(lenY);
        var wideCounts = new Int16Array(lenY);
        var xL0 = Math.max(0, cx - halfW), xL1 = Math.min(w - 1, cx + halfW);
        var xW0 = Math.max(0, cx - wideW), xW1 = Math.min(w - 1, cx + wideW);
        for (var y = yMin; y <= yMax; y++) {
          var lc = 0, wc = 0;
          for (var x = xL0; x <= xL1; x++) if (isBlackInk(x, y)) lc++;
          for (var xw = xW0; xw <= xW1; xw += 2) if (isBlackInk(xw, y)) wc++;
          localCounts[y - yMin] = lc;
          wideCounts[y - yMin] = wc;
        }
        var seedTop = Math.max(yMin, cy - Math.round(w * 0.048));
        var seedBot = Math.min(yMax, cy - Math.round(w * 0.010));
        var bestInterval = null;
        var bestScore = -1e9;
        [true, false].some(function(strict) {
          function isRowClear(ry) {
            var lc = localCounts[ry - yMin];
            var wc = wideCounts[ry - yMin];
            return strict ? (lc === 0 && wc <= 3) : (lc <= 1 && wc <= 5);
          }
          var ry = yMin;
          while (ry <= yMax) {
            if (isRowClear(ry)) {
              var g0 = ry;
              while (ry + 1 <= yMax && isRowClear(ry + 1)) ry++;
              var g1 = ry;
              var overlap = Math.min(g1, seedBot) - Math.max(g0, seedTop);
              if (overlap >= 0) {
                var segLen = g1 - g0 + 1;
                var mid = 0.5 * (g0 + g1);
                var distPen = Math.abs(mid - (cy - w * 0.030)) * 0.35;
                var score = segLen - distPen;
                if (score > bestScore) {
                  bestScore = score;
                  bestInterval = [g0, g1];
                }
              }
            }
            ry++;
          }
          return !!(bestInterval && (bestInterval[1] - bestInterval[0] + 1) >= minGapLen);
        });
        var midY = bestInterval ? 0.5 * (bestInterval[0] + bestInterval[1]) : (cy - w * 0.0265);
        pinEl.style.top = ((midY / h) * 100).toFixed(2) + '%';
        pinEl.style.setProperty('--pin-ty', '-50%');
      });
    } catch (e) {}
  }
  document.querySelectorAll('.page-stage').forEach(function(stageEl) {
    var imgEl = stageEl.querySelector('img');
    if (!imgEl) return;
    if (imgEl.complete && imgEl.naturalWidth) {
      snapStagePinsToWhiteGap(stageEl);
    } else {
      imgEl.addEventListener('load', function() { snapStagePinsToWhiteGap(stageEl); }, { once: true });
    }
  });
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
    const indexUrl = `${firebaseBaseUrl}/audioMushafIndex/${encodeURIComponent(studentKey)}.json`;
    let existingIndex = {};
    try {
        existingIndex = (await httpJsonRequest(indexUrl, { method: 'GET' }, requestImpl)) || {};
    } catch {
        existingIndex = {};
    }

    const hasCustomId = typeof sessionPayload.sessionId === 'string' && sessionPayload.sessionId.trim().length > 0;
    const sessionId = hasCustomId
        ? sanitizeSegment(sessionPayload.sessionId)
        : await generateShortStudentSessionId(sessionPayload.studentName || studentKey, existingIndex, firebaseBaseUrl, requestImpl);

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
        url: `${String(webBaseUrl).replace(/\/+$/, '')}/m/${encodeURIComponent(sessionId)}`,
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
