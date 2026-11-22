const zlib = require('node:zlib');
const { PDFDocument, PDFName, PDFNumber, PDFRawStream } = require('pdf-lib');

const ANNOTATION_SUBTYPES = new Set([
    '/Ink',
    '/Highlight',
    '/Square',
    '/Underline',
    '/Squiggly',
    '/StrikeOut',
    '/Circle',
    '/Polygon',
    '/FreeText',
]);

function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
}

function pdfObjToString(val) {
    if (!val) return '';
    if (typeof val.decodeText === 'function') {
        try { return val.decodeText(); } catch { /* fall through */ }
    }
    if (typeof val.asString === 'function') {
        try { return val.asString(); } catch { /* fall through */ }
    }
    return String(val);
}

/**
 * Parses a standard PDF date string like (D:20260905212826Z) or D:20261121224015+02'00'
 * into Unix epoch milliseconds.
 */
function parsePdfDate(raw) {
    const cleaned = pdfObjToString(raw).trim().replace(/^\(|\)$/g, '').replace(/^D:/i, '');
    if (!cleaned) return null;
    const match = cleaned.match(
        /^(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?(?:(Z)|([+-])(\d{2})'?(\d{2})'?)?$/i
    );
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2] || '1') - 1;
    const day = Number(match[3] || '1');
    const hour = Number(match[4] || '0');
    const minute = Number(match[5] || '0');
    const second = Number(match[6] || '0');
    if (match[7]) {
        return Date.UTC(year, month, day, hour, minute, second);
    }
    if (match[8]) {
        const sign = match[8] === '-' ? -1 : 1;
        const offHours = Number(match[9] || '0');
        const offMins = Number(match[10] || '0');
        const offsetMs = sign * (offHours * 60 + offMins) * 60 * 1000;
        return Date.UTC(year, month, day, hour, minute, second) - offsetMs;
    }
    return new Date(year, month, day, hour, minute, second).getTime();
}

function parsePdfNumberArray(arrObj) {
    if (!arrObj) return null;
    const items = typeof arrObj.asArray === 'function' ? arrObj.asArray() : (Array.isArray(arrObj) ? arrObj : null);
    if (!items) return null;
    const nums = items.map(item => (typeof item?.asNumber === 'function' ? item.asNumber() : Number(item)));
    return nums.every(Number.isFinite) ? nums : null;
}

function isYellowRgb(color) {
    if (!Array.isArray(color)) return false;
    if (color.length === 3) {
        const [r, g, b] = color;
        return r >= 0.7 && g >= 0.7 && b <= 0.45;
    }
    if (color.length === 4) {
        const [c, m, y, k] = color;
        return c <= 0.25 && m <= 0.25 && y >= 0.6 && k <= 0.2;
    }
    return false;
}

/**
 * Maps a PDF /Rect [x1, y1, x2, y2] onto percentage coordinates (0..100)
 * from top-left of the full rendered PDF page, invariant to viewer zoom or scroll.
 */
function rectToPagePercent(rect, cropBox, rotationAngle = 0) {
    if (!Array.isArray(rect) || rect.length < 4 || !cropBox || !cropBox.width || !cropBox.height) {
        return { xPercent: 50, yPercent: 50, boxWidthPercent: 4, boxHeightPercent: 3 };
    }
    const minX = Math.min(rect[0], rect[2]);
    const maxX = Math.max(rect[0], rect[2]);
    const minY = Math.min(rect[1], rect[3]);
    const maxY = Math.max(rect[1], rect[3]);

    const cx = (minX + maxX) / 2;
    // Place the marker near the upper edge of the highlighted word so Quran text stays readable
    const anchorY = minY + (maxY - minY) * 0.85;

    const u = (cx - cropBox.x) / cropBox.width;
    const vFromBottom = (anchorY - cropBox.y) / cropBox.height;
    const rot = ((Number(rotationAngle) || 0) % 360 + 360) % 360;

    let nx;
    let ny;
    if (rot === 90) {
        nx = vFromBottom;
        ny = u;
    } else if (rot === 180) {
        nx = 1 - u;
        ny = vFromBottom;
    } else if (rot === 270) {
        nx = 1 - vFromBottom;
        ny = 1 - u;
    } else {
        nx = u;
        ny = 1 - vFromBottom;
    }

    const rawW = ((maxX - minX) / cropBox.width) * 100;
    const rawH = ((maxY - minY) / cropBox.height) * 100;
    return {
        xPercent: Number(clamp(nx * 100, 2, 98).toFixed(2)),
        yPercent: Number(clamp(ny * 100, 2, 98).toFixed(2)),
        boxWidthPercent: Number(clamp(rot === 90 || rot === 270 ? rawH : rawW, 1, 96).toFixed(2)),
        boxHeightPercent: Number(clamp(rot === 90 || rot === 270 ? rawW : rawH, 1, 96).toFixed(2)),
    };
}

/**
 * Extracts non-link annotations with timestamps and normalized full-page coordinates from a PDF.
 */
async function extractPdfAnnotations(pdfDocOrBytes, { pageNumbers = null } = {}) {
    const doc = pdfDocOrBytes instanceof PDFDocument
        ? pdfDocOrBytes
        : await PDFDocument.load(pdfDocOrBytes, { ignoreEncryption: true });

    const pageCount = doc.getPageCount();
    const targetPages = pageNumbers
        ? [...new Set(pageNumbers.filter(p => Number.isInteger(p) && p >= 1 && p <= pageCount))].sort((a, b) => a - b)
        : Array.from({ length: pageCount }, (_, i) => i + 1);

    const results = [];
    for (const pdfPage of targetPages) {
        const page = doc.getPage(pdfPage - 1);
        const annotsObj = page.node.lookup(PDFName.of('Annots'));
        if (!annotsObj || typeof annotsObj.asArray !== 'function') continue;

        const cropBox = typeof page.getCropBox === 'function'
            ? page.getCropBox()
            : { x: 0, y: 0, ...page.getSize() };
        const rotation = typeof page.getRotation === 'function' ? page.getRotation()?.angle || 0 : 0;

        const refs = annotsObj.asArray();
        for (let idx = 0; idx < refs.length; idx++) {
            const obj = doc.context.lookup(refs[idx]);
            if (!obj || typeof obj.get !== 'function') continue;
            const subtype = obj.get(PDFName.of('Subtype'))?.toString() || '';
            if (!ANNOTATION_SUBTYPES.has(subtype)) continue;

            const rect = parsePdfNumberArray(obj.get(PDFName.of('Rect')));
            if (!rect || rect.length < 4) continue;

            const color = parsePdfNumberArray(obj.get(PDFName.of('C')));
            const createdAtMs = parsePdfDate(obj.get(PDFName.of('CreationDate')));
            const updatedAtMs = parsePdfDate(obj.get(PDFName.of('M')));
            const timestampMs = createdAtMs ?? updatedAtMs;
            const coords = rectToPagePercent(rect, cropBox, rotation);

            results.push({
                indexInPage: idx,
                pdfPage,
                subtype: subtype.replace(/^\//, ''),
                rect,
                color,
                isYellow: isYellowRgb(color),
                createdAtMs,
                updatedAtMs,
                timestampMs,
                ...coords,
            });
        }
    }
    return results;
}

/**
 * Matches session audio clips against PDF annotations created during the lesson window,
 * preserving manual drag/pin overrides and chronological ordering.
 */
function matchClipsToAnnotations(clips = [], annotations = [], { sessionStartedAt = 0, preWindowMs = 180000 } = {}) {
    const validClips = Array.isArray(clips) ? clips : [];

    const earliestClipAt = validClips.reduce((min, clip) => {
        const ts = Number(clip.startedAt || clip.endedAt || 0);
        return ts > 0 && ts < min ? ts : min;
    }, Infinity);
    const baseWindowStart = sessionStartedAt > 0
        ? (Number.isFinite(earliestClipAt) ? Math.min(sessionStartedAt, earliestClipAt) : sessionStartedAt)
        : (Number.isFinite(earliestClipAt) ? earliestClipAt : 0);
    const minAnnotTime = baseWindowStart > 0 ? baseWindowStart - preWindowMs : 0;

    const candidates = (Array.isArray(annotations) ? annotations : []).filter(annot => {
        if (!annot) return false;
        if (annot.timestampMs == null) return false;
        return annot.timestampMs >= minAnnotTime;
    });

    if (validClips.length === 0) {
        const unmatchedNewAnnotations = candidates.filter(a => a.isYellow);
        return { markers: [], unmatchedClips: [], unmatchedNewAnnotations };
    }

    const markers = [];
    const autoClips = [];
    const usedAnnots = new Set();

    for (const clip of validClips) {
        if (
            Number.isInteger(clip.manualPage) && clip.manualPage >= 1 &&
            Number.isFinite(clip.manualXPercent) && Number.isFinite(clip.manualYPercent)
        ) {
            markers.push({
                clipId: clip.id,
                audioFileName: clip.fileName,
                durationMs: clip.durationMs || 0,
                startedAt: clip.startedAt,
                endedAt: clip.endedAt,
                pdfPage: clip.manualPage,
                xPercent: clamp(clip.manualXPercent, 2, 98),
                yPercent: clamp(clip.manualYPercent, 2, 98),
                source: 'manual',
            });
        } else {
            autoClips.push(clip);
        }
    }

    // Score each candidate against each auto clip and resolve 1-to-1 greedily by tightest timestamp fit
    const pairs = [];
    autoClips.forEach((clip, cIdx) => {
        const start = Number(clip.startedAt || clip.endedAt || 0);
        const end = Number(clip.endedAt || clip.startedAt || start);
        const mid = (start + end) / 2;

        candidates.forEach((annot, aIdx) => {
            const ts = annot.timestampMs;
            // Allow drawing highlight slightly before recording or up to 90s after stopping recording
            if (ts < start - 60000 || ts > end + 120000) return;

            let timeDist;
            if (ts >= start - 5000 && ts <= end + 5000) {
                timeDist = Math.abs(ts - start) * 0.25;
            } else {
                timeDist = Math.min(Math.abs(ts - start), Math.abs(ts - end), Math.abs(ts - mid)) + 5000;
            }
            const score = timeDist - (annot.isYellow ? 1500 : 0);
            pairs.push({ cIdx, aIdx, score });
        });
    });

    pairs.sort((a, b) => a.score - b.score);
    const assignedClip = new Map();
    for (const pair of pairs) {
        if (assignedClip.has(pair.cIdx) || usedAnnots.has(pair.aIdx)) continue;
        assignedClip.set(pair.cIdx, candidates[pair.aIdx]);
        usedAnnots.add(pair.aIdx);
    }

    const unmatchedClips = [];
    autoClips.forEach((clip, cIdx) => {
        const annot = assignedClip.get(cIdx);
        if (!annot) {
            unmatchedClips.push(clip);
            return;
        }
        markers.push({
            clipId: clip.id,
            audioFileName: clip.fileName,
            durationMs: clip.durationMs || 0,
            startedAt: clip.startedAt,
            endedAt: clip.endedAt,
            pdfPage: annot.pdfPage,
            xPercent: annot.xPercent,
            yPercent: annot.yPercent,
            subtype: annot.subtype,
            isYellow: annot.isYellow,
            matchedAtMs: annot.timestampMs,
            source: 'matched',
        });
    });

    markers.sort((a, b) => (a.pdfPage - b.pdfPage) || ((a.startedAt || 0) - (b.startedAt || 0)));

    const manualMarkers = markers.filter(m => m.source === 'manual');
    const unmatchedNewAnnotations = candidates.filter((annot, idx) => {
        if (usedAnnots.has(idx) || !annot.isYellow) return false;
        return !manualMarkers.some(m => (
            m.pdfPage === annot.pdfPage &&
            Math.hypot((m.xPercent || 0) - (annot.xPercent || 0), (m.yPercent || 0) - (annot.yPercent || 0)) < 6
        ));
    });

    return { markers, unmatchedClips, unmatchedNewAnnotations };
}

/**
 * Recolors specified annotations (e.g., yellow highlights with no voice clip)
 * to translucent green [0, 1, 0] in an in-memory copy of the PDF without touching disk files.
 */
async function recolorAnnotationsToGreenInPdfBytes(pdfBytes, targetAnnotations = []) {
    if (!targetAnnotations || targetAnnotations.length === 0) return pdfBytes;
    const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const pageCount = doc.getPageCount();
    const byPage = new Map();
    for (const item of targetAnnotations) {
        if (!Number.isInteger(item?.pdfPage) || !Number.isInteger(item?.indexInPage)) continue;
        if (item.pdfPage < 1 || item.pdfPage > pageCount) continue;
        if (!byPage.has(item.pdfPage)) byPage.set(item.pdfPage, new Set());
        byPage.get(item.pdfPage).add(item.indexInPage);
    }
    if (byPage.size === 0) return pdfBytes;

    for (const [pdfPage, idxSet] of byPage.entries()) {
        const page = doc.getPage(pdfPage - 1);
        const annotsObj = page.node.lookup(PDFName.of('Annots'));
        if (!annotsObj || typeof annotsObj.asArray !== 'function') continue;
        const refs = annotsObj.asArray();
        for (const idx of idxSet) {
            if (idx < 0 || idx >= refs.length) continue;
            const obj = doc.context.lookup(refs[idx]);
            if (!obj || typeof obj.set !== 'function') continue;
            obj.set(PDFName.of('C'), doc.context.obj([0, 1, 0]));

            const apRef = obj.get(PDFName.of('AP'));
            if (!apRef) continue;
            try {
                const ap = doc.context.lookup(apRef);
                const nRef = ap && typeof ap.get === 'function' ? ap.get(PDFName.of('N')) : null;
                const nStream = nRef ? doc.context.lookup(nRef) : null;
                if (nStream instanceof PDFRawStream) {
                    const filterStr = String(nStream.dict.get(PDFName.of('Filter')) || '');
                    const rawContents = nStream.contents;
                    let text = null;
                    let deflated = false;
                    if (filterStr.includes('FlateDecode')) {
                        text = zlib.inflateSync(rawContents).toString('latin1');
                        deflated = true;
                    } else if (!filterStr || filterStr === 'undefined') {
                        text = Buffer.from(rawContents).toString('latin1');
                    }
                    if (text !== null) {
                        const updatedText = text.replace(/\b1(?:\.0+)?\s+1(?:\.0+)?\s+0(?:\.0+)?\s+(RG|rg|SCN|scn)\b/g, '0 1 0 $1');
                        if (updatedText !== text) {
                            const outBuf = deflated
                                ? zlib.deflateSync(Buffer.from(updatedText, 'latin1'))
                                : Buffer.from(updatedText, 'latin1');
                            nStream.contents = new Uint8Array(outBuf);
                            nStream.dict.set(PDFName.of('Length'), PDFNumber.of(outBuf.length));
                        }
                    }
                }
            } catch {
                try { obj.delete(PDFName.of('AP')); } catch { /* ignore */ }
            }
        }
    }
    return await doc.save();
}

function defaultMapPages(startPage, endPage, pdfPageCount, offset = 0) {
    if (!Number.isInteger(pdfPageCount) || pdfPageCount < 1) return [];
    const lo = clamp(Math.min(startPage, endPage), 1, 604);
    const hi = clamp(Math.max(startPage, endPage), 1, 604);
    const extraOffset = Number.isFinite(offset) ? Math.trunc(offset) : 0;
    const pages = [];
    for (let p = lo; p <= hi; p++) {
        let base;
        if (pdfPageCount === 604) base = p;
        else if (pdfPageCount === 605) base = p + 1;
        else if (pdfPageCount >= 618 && pdfPageCount <= 630) {
            const extraFront = Math.max(0, pdfPageCount - 620);
            base = extraFront + (p <= 2 ? 2 : p);
        } else {
            base = p <= 2 ? 2 : p;
        }
        const pdfPage = clamp(base + extraOffset, 1, pdfPageCount);
        if (pages[pages.length - 1] !== pdfPage) pages.push(pdfPage);
    }
    return pages;
}

/**
 * Merges Smart Report sections (with dividers) and audio correction markers.
 * Any marked PDF page outside the report sections is added under an extra corrections section
 * so neither report pages nor extra lesson corrections are dropped.
 */
function mergeReportAndAudioSections({
    reportSections = [],
    markers = [],
    unmatchedNewAnnotations = [],
    includeExtraPages = true,
    totalSourcePages,
    pageOffset = 0,
    mapPagesFn = defaultMapPages,
}) {
    const validMarkers = Array.isArray(markers) ? markers : [];
    const markersByPdfPage = new Map();
    for (const marker of validMarkers) {
        if (!Number.isInteger(marker.pdfPage) || marker.pdfPage < 1) continue;
        if (!markersByPdfPage.has(marker.pdfPage)) markersByPdfPage.set(marker.pdfPage, []);
        markersByPdfPage.get(marker.pdfPage).push(marker);
    }
    if (includeExtraPages) {
        for (const annot of (Array.isArray(unmatchedNewAnnotations) ? unmatchedNewAnnotations : [])) {
            if (!Number.isInteger(annot?.pdfPage) || annot.pdfPage < 1) continue;
            if (!markersByPdfPage.has(annot.pdfPage)) markersByPdfPage.set(annot.pdfPage, []);
        }
    }

    const coveredPages = new Set();
    const sections = [];

    for (const sec of (Array.isArray(reportSections) ? reportSections : [])) {
        const pdfPages = Array.isArray(sec.pdfPages) && sec.pdfPages.length > 0
            ? sec.pdfPages
            : mapPagesFn(sec.startPage, sec.endPage, totalSourcePages, pageOffset);
        if (!pdfPages.length) continue;

        const pages = pdfPages.map(pdfPage => {
            coveredPages.add(pdfPage);
            return {
                pdfPage,
                markers: markersByPdfPage.get(pdfPage) || [],
            };
        });
        sections.push({
            key: sec.key || 'section',
            group: sec.group || '',
            groupTitleAr: sec.groupTitleAr || '',
            groupTitleEn: sec.groupTitleEn || '',
            titleAr: sec.titleAr || '',
            titleEn: sec.titleEn || '',
            summaryAr: sec.summaryAr || '',
            summaryEn: sec.summaryEn || '',
            startPage: sec.startPage,
            endPage: sec.endPage,
            verseSpan: sec.verseSpan || null,
            pages,
        });
    }

    const extraPages = includeExtraPages
        ? [...markersByPdfPage.keys()]
            .filter(p => !coveredPages.has(p))
            .sort((a, b) => a - b)
        : [];

    if (extraPages.length > 0) {
        sections.push({
            key: 'corrections',
            titleAr: sections.length > 0 ? 'تصحيحات إضافية من الحصة' : 'تصحيحات الحصة',
            titleEn: sections.length > 0 ? 'Additional Lesson Corrections' : 'Lesson Corrections',
            summaryAr: extraPages.length === 1 ? `صفحة ${extraPages[0]}` : `${extraPages.length} صفحات`,
            summaryEn: extraPages.length === 1 ? `Page ${extraPages[0]}` : `${extraPages.length} pages`,
            startPage: extraPages[0],
            endPage: extraPages[extraPages.length - 1],
            pages: extraPages.map(pdfPage => ({
                pdfPage,
                markers: markersByPdfPage.get(pdfPage) || [],
            })),
        });
    }

    const allPdfPages = [];
    const seen = new Set();
    for (const sec of sections) {
        for (const p of sec.pages) {
            if (!seen.has(p.pdfPage)) {
                seen.add(p.pdfPage);
                allPdfPages.push(p.pdfPage);
            }
        }
    }

    return { sections, allPdfPages };
}

module.exports = {
    parsePdfDate,
    rectToPagePercent,
    extractPdfAnnotations,
    matchClipsToAnnotations,
    recolorAnnotationsToGreenInPdfBytes,
    mergeReportAndAudioSections,
    clamp,
};
