const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

const SECTION_THEMES = {
    rev: { accent: '#1d4ed8', bg: '#eff6ff', border: '#93c5fd', badge: '#dbeafe' },
    oldRev: { accent: '#b45309', bg: '#fffbeb', border: '#fcd34d', badge: '#fef3c7' },
    new: { accent: '#047857', bg: '#ecfdf5', border: '#6ee7b7', badge: '#d1fae5' },
    tilawa: { accent: '#6d28d9', bg: '#f5f3ff', border: '#c4b5fd', badge: '#ede9fe' },
};

function toHindiDigits(val) {
    return String(val ?? '').replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}

function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function sanitizeFileSegment(name) {
    const cleaned = String(name || 'Student')
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
        .replace(/\s+/g, ' ')
        .trim();
    return cleaned || 'Student';
}

function getDefaultMushafOutputDir(app) {
    if (process.platform === 'win32') {
        return 'Z:\\مصاحف الطلبة';
    }
    return path.join(app.getPath('userData'), 'student-mushafs');
}

/**
 * Maps a Madinah Mushaf page span (1..604) to 1-based page numbers inside a student's PDF.
 * Handles 604-page raw PDFs, 605-page (1 cover + 604), and 620+ digital Mushaf PDFs
 * where PDF page 1 is index and PDF page 2 combines Al-Fatiha (p.1) + start of Al-Baqarah (p.2).
 */
function mapMushafPagesToPdfPages(startPage, endPage, pdfPageCount, offset = 0) {
    if (!Number.isInteger(pdfPageCount) || pdfPageCount < 1) return [];
    const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
    const lo = clamp(Math.min(startPage, endPage), 1, 604);
    const hi = clamp(Math.max(startPage, endPage), 1, 604);
    const extraOffset = Number.isFinite(offset) ? Math.trunc(offset) : 0;
    const pages = [];

    for (let p = lo; p <= hi; p++) {
        let base;
        if (pdfPageCount === 604) {
            base = p;
        } else if (pdfPageCount === 605) {
            base = p + 1;
        } else if (pdfPageCount >= 618 && pdfPageCount <= 630) {
            const extraFront = Math.max(0, pdfPageCount - 620);
            base = extraFront + (p <= 2 ? 2 : p);
        } else {
            base = p <= 2 ? 2 : p;
        }
        const pdfPage = clamp(base + extraOffset, 1, pdfPageCount);
        if (pages[pages.length - 1] !== pdfPage) {
            pages.push(pdfPage);
        }
    }
    return pages;
}

function buildDividerHtml({ section, language, studentName, dateStr, pageCount, widthPt, heightPt }) {
    const isAr = language !== 'en';
    const theme = SECTION_THEMES[section.key] || SECTION_THEMES.new;
    const title = isAr ? section.titleAr : section.titleEn;
    const summary = isAr ? section.summaryAr : section.summaryEn;
    const pageSpan = isAr
        ? (section.startPage === section.endPage
            ? `صفحة ${toHindiDigits(section.startPage)}`
            : `صفحات ${toHindiDigits(section.startPage)} – ${toHindiDigits(section.endPage)} (${toHindiDigits(pageCount)} صفحات)`)
        : (section.startPage === section.endPage
            ? `Page ${section.startPage}`
            : `Pages ${section.startPage} – ${section.endPage} (${pageCount} pages)`);
    const safeStudent = escapeHtml(studentName);
    const safeDate = escapeHtml(isAr ? toHindiDigits(dateStr) : dateStr);

    return `<!DOCTYPE html>
<html dir="${isAr ? 'rtl' : 'ltr'}" lang="${isAr ? 'ar' : 'en'}">
<head>
<meta charset="utf-8" />
<style>
  @page { size: ${widthPt}pt ${heightPt}pt; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: ${widthPt}pt;
    height: ${heightPt}pt;
    overflow: hidden;
    background: #fdfbf4;
    font-family: 'Segoe UI', 'Tahoma', 'Arial', sans-serif;
    color: #1f2937;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .outer {
    width: 100%;
    height: 100%;
    padding: 24pt;
    display: flex;
  }
  .frame {
    flex: 1;
    border: 2.5pt solid ${theme.border};
    border-radius: 18pt;
    background: linear-gradient(180deg, ${theme.bg} 0%, #fdfbf4 42%, ${theme.bg} 100%);
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 32pt 26pt;
  }
  .inner-border {
    position: absolute;
    inset: 8pt;
    border: 1pt dashed ${theme.border};
    border-radius: 13pt;
    pointer-events: none;
  }
  .pill {
    display: inline-block;
    padding: 12pt 30pt;
    border-radius: 999pt;
    background: ${theme.badge};
    border: 2pt solid ${theme.border};
    color: ${theme.accent};
    font-size: 36pt;
    font-weight: 800;
    letter-spacing: ${isAr ? '0' : '0.02em'};
    margin-bottom: 24pt;
    box-shadow: 0 4pt 14pt rgba(0,0,0,0.06);
  }
  .summary {
    font-size: 21pt;
    font-weight: 700;
    color: #111827;
    line-height: 1.65;
    margin-bottom: 18pt;
    max-width: 90%;
  }
  .pages {
    font-size: 14pt;
    font-weight: 600;
    color: #4b5563;
    background: #ffffff;
    border: 1pt solid #e5e7eb;
    padding: 7pt 18pt;
    border-radius: 999pt;
  }
  .footer {
    position: absolute;
    bottom: 22pt;
    left: 24pt;
    right: 24pt;
    font-size: 12pt;
    color: #6b7280;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 10pt;
  }
</style>
</head>
<body>
  <div class="outer">
    <div class="frame">
      <div class="inner-border"></div>
      <div class="pill">${escapeHtml(title)}</div>
      <div class="summary">${escapeHtml(summary)}</div>
      <div class="pages">${escapeHtml(pageSpan)}</div>
      <div class="footer">
        <span>${safeStudent}</span>
        <span>${safeDate}</span>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function buildBannerHtml({ section, language, widthPt, bannerHeightPt = 28 }) {
    const isAr = language !== 'en';
    const theme = SECTION_THEMES[section.key] || SECTION_THEMES.new;
    const title = isAr ? section.titleAr : section.titleEn;
    const summary = isAr ? section.summaryAr : section.summaryEn;
    return `<!DOCTYPE html>
<html dir="${isAr ? 'rtl' : 'ltr'}" lang="${isAr ? 'ar' : 'en'}">
<head>
<meta charset="utf-8" />
<style>
  @page { size: ${widthPt}pt ${bannerHeightPt}pt; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: ${widthPt}pt;
    height: ${bannerHeightPt}pt;
    overflow: hidden;
    background: ${theme.bg};
    font-family: 'Segoe UI', 'Tahoma', 'Arial', sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .bar {
    width: 100%;
    height: 100%;
    border-bottom: 1.5pt solid ${theme.border};
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 18pt;
    font-size: 11.5pt;
    font-weight: 700;
    color: ${theme.accent};
  }
  .sub {
    color: #374151;
    font-weight: 600;
    font-size: 10pt;
  }
</style>
</head>
<body>
  <div class="bar">
    <span>${escapeHtml(title)}</span>
    <span class="sub">${escapeHtml(summary)}</span>
  </div>
</body>
</html>`;
}

function createElectronHtmlRenderer(BrowserWindow) {
    let win = null;
    const ensureWindow = () => {
        if (!win || win.isDestroyed()) {
            win = new BrowserWindow({
                width: 700,
                height: 1000,
                show: false,
                webPreferences: {
                    offscreen: true,
                    contextIsolation: true,
                },
            });
        }
        return win;
    };

    return {
        async renderHtmlToPdf(html, widthPt, heightPt) {
            const targetWin = ensureWindow();
            await targetWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
            await targetWin.webContents.executeJavaScript('document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true').catch(() => {});
            return await targetWin.webContents.printToPDF({
                printBackground: true,
                preferCSSPageSize: true,
                pageSize: {
                    width: Math.max(1, widthPt / 72),
                    height: Math.max(1, heightPt / 72),
                },
                margins: { marginType: 'none' },
            });
        },
        close() {
            if (win && !win.isDestroyed()) {
                win.close();
                win = null;
            }
        },
    };
}

async function embedSinglePageNormalized(outputPdf, rawPdfBytes, targetWidth, targetHeight) {
    const src = await PDFDocument.load(rawPdfBytes);
    const srcPage = src.getPage(0);
    const { width, height } = srcPage.getSize();
    const sameSize = Math.abs(width - targetWidth) < 1 && Math.abs(height - targetHeight) < 1;
    if (sameSize || !srcPage.node.Contents()) {
        const [copied] = await outputPdf.copyPages(src, [0]);
        copied.setSize(targetWidth, targetHeight);
        return outputPdf.addPage(copied);
    }
    const [embedded] = await outputPdf.embedPdf(src, [0]);
    const page = outputPdf.addPage([targetWidth, targetHeight]);
    page.drawPage(embedded, {
        x: 0,
        y: 0,
        width: targetWidth,
        height: targetHeight,
    });
    return page;
}

async function generateCustomMushafPdf({
    studentName,
    sourcePdfPath,
    sections,
    dividerStyle = 'page',
    language = 'ar',
    pageOffset = 0,
    dateStr,
    outputDir,
    renderHtmlToPdf,
    BrowserWindow,
}) {
    if (!sourcePdfPath || !fs.existsSync(sourcePdfPath)) {
        return { success: false, error: 'ملف مصحف الطالب غير موجود.' };
    }
    if (!Array.isArray(sections) || sections.length === 0) {
        return { success: false, error: 'لا توجد صفحات محددة في التقرير لتوليد المصحف.' };
    }

    const sourceBytes = fs.readFileSync(sourcePdfPath);
    const sourcePdf = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
    const totalSourcePages = sourcePdf.getPageCount();
    if (totalSourcePages < 1) {
        return { success: false, error: 'ملف مصحف الطالب فارغ أو غير صالح.' };
    }

    const resolvedSections = [];
    for (const section of sections) {
        const pdfPages = mapMushafPagesToPdfPages(section.startPage, section.endPage, totalSourcePages, pageOffset);
        if (pdfPages.length > 0) {
            resolvedSections.push({ ...section, pdfPages });
        }
    }

    if (resolvedSections.length === 0) {
        return { success: false, error: 'تعذّر مطابقة صفحات التقرير مع صفحات مصحف الطالب.' };
    }

    const firstPageIdx = resolvedSections[0].pdfPages[0] - 1;
    const refPage = sourcePdf.getPage(firstPageIdx);
    const { width: targetWidth, height: targetHeight } = refPage.getSize();

    const todayStr = dateStr || new Date().toLocaleDateString('en-CA');
    const resolvedOutDir = outputDir;
    fs.mkdirSync(resolvedOutDir, { recursive: true });

    const outputFileName = `${sanitizeFileSegment(studentName)} - ${sanitizeFileSegment(todayStr)}.pdf`;
    const outputFilePath = path.join(resolvedOutDir, outputFileName);

    const outputPdf = await PDFDocument.create();
    const renderer = renderHtmlToPdf
        ? { renderHtmlToPdf, close: () => {} }
        : createElectronHtmlRenderer(BrowserWindow);

    const includeDividerPage = dividerStyle === 'page' || dividerStyle === 'both';
    const includeTopBanner = dividerStyle === 'banner' || dividerStyle === 'both';
    const bannerHeightPt = 28;

    try {
        for (const section of resolvedSections) {
            if (includeDividerPage) {
                const dividerHtml = buildDividerHtml({
                    section,
                    language,
                    studentName,
                    dateStr: todayStr,
                    pageCount: section.pdfPages.length,
                    widthPt: targetWidth,
                    heightPt: targetHeight,
                });
                const dividerPdfBytes = await renderer.renderHtmlToPdf(dividerHtml, targetWidth, targetHeight);
                await embedSinglePageNormalized(outputPdf, dividerPdfBytes, targetWidth, targetHeight);
            }

            let embeddedBanner = null;
            if (includeTopBanner) {
                const bannerHtml = buildBannerHtml({
                    section,
                    language,
                    widthPt: targetWidth,
                    bannerHeightPt,
                });
                const bannerBytes = await renderer.renderHtmlToPdf(bannerHtml, targetWidth, bannerHeightPt);
                const bannerDoc = await PDFDocument.load(bannerBytes);
                [embeddedBanner] = await outputPdf.embedPdf(bannerDoc, [0]);
            }

            const zeroBasedIndices = section.pdfPages.map(p => p - 1);
            const copiedPages = await outputPdf.copyPages(sourcePdf, zeroBasedIndices);
            for (const copied of copiedPages) {
                outputPdf.addPage(copied);
                if (embeddedBanner) {
                    const { width: w, height: h } = copied.getSize();
                    copied.drawPage(embeddedBanner, {
                        x: 0,
                        y: h - bannerHeightPt,
                        width: w,
                        height: bannerHeightPt,
                    });
                }
            }
        }
    } finally {
        renderer.close();
    }

    const pdfBytes = await outputPdf.save();
    const tempPath = `${outputFilePath}.tmp`;
    fs.writeFileSync(tempPath, pdfBytes);
    fs.renameSync(tempPath, outputFilePath);

    return {
        success: true,
        filePath: outputFilePath,
        fileName: outputFileName,
        totalOutputPages: outputPdf.getPageCount(),
        sourceFileName: path.basename(sourcePdfPath),
        sectionsCount: resolvedSections.length,
    };
}

module.exports = {
    getDefaultMushafOutputDir,
    sanitizeFileSegment,
    mapMushafPagesToPdfPages,
    buildDividerHtml,
    buildBannerHtml,
    generateCustomMushafPdf,
};
