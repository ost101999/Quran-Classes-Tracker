const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PDFDocument, PDFName } = require('pdf-lib');

const { resolveStudentMushafFile } = require('../shortcut-links');
const { mapMushafPagesToPdfPages, generateCustomMushafPdf } = require('../custom-mushaf');

test('resolveStudentMushafFile uses ONLY the student Mushaf PDF without falling back to master', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mushaf-shortcuts-'));
  try {
    const studentPdf = path.join(tmpDir, '16 Bilal', "1 Bilal's Quran book.pdf");
    const masterPdf = path.join(tmpDir, '21ـ موارد أساسية', '1ـ المصحف.pdf');
    fs.mkdirSync(path.dirname(studentPdf), { recursive: true });
    fs.mkdirSync(path.dirname(masterPdf), { recursive: true });
    fs.writeFileSync(studentPdf, '%PDF-1.4\n');
    fs.writeFileSync(masterPdf, '%PDF-1.4\n');

    const iniPath = path.join(tmpDir, 'MyShortcuts.ini');
    fs.writeFileSync(iniPath, [
      '[Files]',
      `Bilal Quran=${studentPdf}|https://zoom.us/j/1|1||https://drive.google.com/file/d/bilal_id/view`,
      `Master Mushaf=${masterPdf}||||`,
    ].join('\n'), 'utf8');

    const byName = resolveStudentMushafFile({ studentName: 'Bilal', shortcutsPath: iniPath });
    assert.equal(byName.found, true);
    assert.equal(byName.path, studentPdf);

    const byDrive = resolveStudentMushafFile({
      studentName: 'Different Name',
      quranLink: 'https://drive.google.com/open?id=bilal_id',
      shortcutsPath: iniPath,
    });
    assert.equal(byDrive.found, true);
    assert.equal(byDrive.path, studentPdf);

    const noMasterFallback = resolveStudentMushafFile({ studentName: 'Other Student', shortcutsPath: iniPath });
    assert.equal(noMasterFallback.found, false);
    assert.equal(noMasterFallback.reason, 'NO_STUDENT_MUSHAF');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('mapMushafPagesToPdfPages handles 620, 622, 604, and 605 page Mushaf layouts accurately', () => {
  // 620-page standard Mushaf: p1 & p2 share PDF page 2; p3..604 match PDF 3..604
  assert.deepEqual(mapMushafPagesToPdfPages(1, 2, 620, 0), [2]);
  assert.deepEqual(mapMushafPagesToPdfPages(1, 4, 620, 0), [2, 3, 4]);
  assert.deepEqual(mapMushafPagesToPdfPages(604, 604, 620, 0), [604]);

  // 622-page Mushaf (2 extra index/duplicate front pages): p3 -> PDF p5
  assert.deepEqual(mapMushafPagesToPdfPages(3, 5, 622, 0), [5, 6, 7]);

  // 604-page raw Mushaf
  assert.deepEqual(mapMushafPagesToPdfPages(1, 3, 604, 0), [1, 2, 3]);

  // 605-page (1 cover + 604 Mushaf)
  assert.deepEqual(mapMushafPagesToPdfPages(1, 3, 605, 0), [2, 3, 4]);

  // Optional custom offset
  assert.deepEqual(mapMushafPagesToPdfPages(10, 11, 620, 1), [11, 12]);
});

test('generateCustomMushafPdf extracts pages with divider pages while preserving student PDF error annotations', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'custom-mushaf-gen-'));
  try {
    const sourcePdfPath = path.join(tmpDir, 'StudentMushaf.pdf');
    const outDir = path.join(tmpDir, 'مصاحف الطلبة');

    // Create a synthetic 620-page-like test PDF: 5 pages with an annotation on page index 2 (1-based page 3)
    const srcDoc = await PDFDocument.create();
    for (let i = 0; i < 6; i++) {
      const page = srcDoc.addPage([475, 885]);
      page.drawText(`Source Page ${i + 1}`, { x: 40, y: 400 });
    }
    const annotRef = srcDoc.context.register(
      srcDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Highlight',
        Rect: [50, 700, 200, 725],
        C: [1, 1, 0],
      })
    );
    srcDoc.getPage(2).node.set(PDFName.of('Annots'), srcDoc.context.obj([annotRef]));
    srcDoc.getPage(4).node.set(PDFName.of('Annots'), srcDoc.context.obj([annotRef]));
    fs.writeFileSync(sourcePdfPath, await srcDoc.save());

    // Minimal headless PDF divider stub using pdf-lib itself (no Electron window needed in unit test)
    const stubRenderHtmlToPdf = async (html, widthPt, heightPt) => {
      const divDoc = await PDFDocument.create();
      const page = divDoc.addPage([widthPt, heightPt]);
      page.drawText(html.includes('bar') ? 'Banner' : 'Divider', {
        x: 10,
        y: Math.max(6, heightPt / 2),
        size: 10,
      });
      return await divDoc.save();
    };

    const res = await generateCustomMushafPdf({
      studentName: 'Bilal',
      sourcePdfPath,
      outputDir: outDir,
      dateStr: '2026-11-21',
      dividerStyle: 'both',
      language: 'ar',
      sections: [
        {
          key: 'rev',
          titleAr: 'المراجعة القريبة',
          titleEn: 'Near Revision',
          summaryAr: 'من صفحة ٣ إلى صفحة ٤',
          summaryEn: 'Pages 3-4',
          startPage: 3,
          endPage: 4,
        },
        {
          key: 'new',
          titleAr: 'الجديد',
          titleEn: 'New Memorization',
          summaryAr: 'صفحة ٥',
          summaryEn: 'Page 5',
          startPage: 5,
          endPage: 5,
        },
      ],
      renderHtmlToPdf: stubRenderHtmlToPdf,
    });

    assert.equal(res.success, true);
    assert.ok(fs.existsSync(res.filePath));
    // Expected layout: [Divider rev, p3, p4, Divider new, p5] => 5 pages
    assert.equal(res.totalOutputPages, 5);

    const outDoc = await PDFDocument.load(fs.readFileSync(res.filePath));
    assert.equal(outDoc.getPageCount(), 5);
    assert.equal(Math.round(outDoc.getPage(0).getSize().width), 475);
    assert.equal(Math.round(outDoc.getPage(0).getSize().height), 885);

    // Copied p3 (index 1 in output) and p5 (index 4 in output) must keep /Annots
    assert.ok(outDoc.getPage(1).node.lookup(PDFName.of('Annots')), 'Expected error highlight annotation preserved on page 3');
    assert.ok(outDoc.getPage(4).node.lookup(PDFName.of('Annots')), 'Expected error highlight annotation preserved on page 5');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
