const test = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument, PDFName } = require('pdf-lib');
const {
  parsePdfDate,
  rectToPagePercent,
  extractPdfAnnotations,
  matchClipsToAnnotations,
  mergeReportAndAudioSections,
} = require('../audio-mushaf/annotation-matcher');
const { publishAudioSessionToCloud, buildInteractiveHtml } = require('../audio-mushaf/publisher');
const { EventEmitter } = require('node:events');

test('extracts PDF annotations, matches audio timestamps invariant to zoom, and merges report sections', async () => {
  const doc = await PDFDocument.create();
  for (let i = 0; i < 4; i++) doc.addPage([500, 1000]);

  const t1 = Date.UTC(2026, 10, 21, 20, 10, 15);
  doc.getPage(1).node.set(PDFName.of('Annots'), doc.context.obj([
    doc.context.register(doc.context.obj({
      Type: 'Annot',
      Subtype: 'Ink',
      Rect: [200, 700, 300, 740],
      C: [1, 1, 0],
      CreationDate: 'D:20261121201016Z',
    })),
  ]));

  const annots = await extractPdfAnnotations(await doc.save());
  assert.equal(annots.length, 1);
  assert.equal(parsePdfDate('D:20261121201016Z'), t1 + 1000);
  const coords = rectToPagePercent([200, 700, 300, 740], { x: 0, y: 0, width: 500, height: 1000 }, 0);
  assert.equal(coords.xPercent, 50);

  const { markers, unmatchedClips } = matchClipsToAnnotations(
    [{ id: 'c1', fileName: 'c1.mp3', startedAt: t1, endedAt: t1 + 4000, durationMs: 4000 }],
    annots,
    { sessionStartedAt: t1 - 5000 }
  );
  assert.equal(unmatchedClips.length, 0);
  assert.equal(markers.length, 1);

  const merged = mergeReportAndAudioSections({
    reportSections: [{ key: 'rev', titleAr: 'المراجعة القريبة', startPage: 2, endPage: 2, pdfPages: [2] }],
    markers,
    totalSourcePages: 4,
  });
  assert.deepEqual(merged.allPdfPages, [2]);
  assert.equal(merged.sections[0].pages[0].markers.length, 1);
});

test('publishAudioSessionToCloud keeps only newest 3 sessions per student', async () => {
  const store = {
    '/audioMushafIndex/st1.json': { s1: 10, s2: 20, s3: 30 },
    '/audioMushafSessions/s1.json': { id: 's1' },
    '/audioMushafSessions/s2.json': { id: 's2' },
    '/audioMushafSessions/s3.json': { id: 's3' },
  };
  const mockReq = (urlStr, opts, cb) => {
    const u = new URL(urlStr);
    const req = new EventEmitter();
    let body = '';
    req.setTimeout = () => {};
    req.destroy = () => {};
    req.write = (c) => { body += String(c); };
    req.end = () => {
      const res = new EventEmitter();
      res.statusCode = 200;
      let out = 'null';
      if (opts.method === 'GET') out = JSON.stringify(store[u.pathname] ?? null);
      else if (opts.method === 'PUT') { store[u.pathname] = body ? JSON.parse(body) : null; out = body; }
      else if (opts.method === 'DELETE') delete store[u.pathname];
      cb(res);
      res.emit('data', Buffer.from(out));
      res.emit('end');
    };
    return req;
  };
  const res = await publishAudioSessionToCloud({ studentId: 'st1', studentName: 'Ali', dateStr: '2026-11-21', createdAt: 40, sections: [] }, {
    maxSessionsPerStudent: 3,
    requestImpl: mockReq,
  });
  assert.match(res.sessionId, /^[a-z0-9]{6}$/);
  assert.equal(res.url, `https://qm7.vercel.app/m/${res.sessionId}`);
  assert.equal(res.prunedCount, 1);
  assert.equal(store['/audioMushafSessions/s1.json'], undefined);
  assert.equal(Object.keys(store['/audioMushafIndex/st1.json']).length, 3);
});

test('mergeReportAndAudioSections drops out-of-report pages when includeExtraPages is false and buildInteractiveHtml renders Acme animated tabs', () => {
  const merged = mergeReportAndAudioSections({
    reportSections: [
      { key: 'rev', group: 'reading', groupTitleAr: 'الدرس الحالي', groupTitleEn: 'Current Lesson', titleAr: 'المراجعة القريبة', titleEn: 'Revision', startPage: 2, endPage: 3, pdfPages: [2, 3] },
      { key: 'new', group: 'homework', groupTitleAr: 'الدرس القادم', groupTitleEn: 'Next Lesson', titleAr: 'الجديد', titleEn: 'New Memorization', startPage: 4, endPage: 4, pdfPages: [4] },
    ],
    markers: [
      { clipId: 'in_rep', pdfPage: 2, xPercent: 40, yPercent: 30 },
      { clipId: 'out_rep', pdfPage: 1, xPercent: 50, yPercent: 60 },
    ],
    includeExtraPages: false,
    totalSourcePages: 10,
  });

  assert.deepEqual(merged.allPdfPages, [2, 3, 4]);
  assert.equal(merged.sections.length, 2);

  const html = buildInteractiveHtml({
    studentName: 'Zohair Sayed',
    dateStr: '2026-11-22',
    language: 'en',
    sections: merged.sections.map(sec => ({
      ...sec,
      pages: sec.pages.map(p => ({ ...p, imageDataUrl: 'data:image/jpeg;base64,AA==', markers: p.markers.map(m => ({ ...m, id: m.clipId, audioDataUrl: 'data:audio/mpeg;base64,AA==' })) })),
    })),
  });

  assert.match(html, /font-family:\s*'Acme'/);
  assert.match(html, /selectMushafSection/);
  assert.match(html, /secPanelIn/);
  assert.match(html, /Current Lesson/);
  assert.match(html, /Next Lesson/);
  assert.match(html, /Revision/);
  assert.match(html, /New Memorization/);
});

test('620-page Mushaf crop solver scopes Surah Al-Bayyinah (1-8) and mid-surah ranges cleanly and remaps markers', () => {
  const {
    resolvePdfPagesForVerseSpan620,
    computePageCropForVerseSpan620,
    transformMarkerForCrop,
  } = require('../audio-mushaf/mushaf-crop-data');

  const bayyinahSpan = { startSurah: 98, startAyah: 1, endSurah: 98, endAyah: 8 };
  assert.deepEqual(resolvePdfPagesForVerseSpan620(bayyinahSpan, 620, 0), [598, 599]);

  // Sub-range only on page 599 (ayahs 6-8) should resolve ONLY page 599
  assert.deepEqual(resolvePdfPagesForVerseSpan620({ startSurah: 98, startAyah: 6, endSurah: 98, endAyah: 8 }, 620, 0), [599]);

  const crop598 = computePageCropForVerseSpan620(598, bayyinahSpan, 620, 0);
  assert.equal(crop598.isCropped, true);
  assert.equal(crop598.drawTopBar, true);
  assert.equal(crop598.drawBotBar, false);
  assert.ok(crop598.topFrac > 0.5 && crop598.topFrac < 0.56);

  const crop599 = computePageCropForVerseSpan620(599, bayyinahSpan, 620, 0);
  assert.equal(crop599.isCropped, true);
  assert.equal(crop599.drawTopBar, false);
  assert.equal(crop599.drawBotBar, true);
  assert.ok(crop599.botFrac > 0.33 && crop599.botFrac < 0.37);

  // Pin in Al-Qadr (above Al-Bayyinah on p598) should be excluded; pin inside Al-Bayyinah should remap into 0..100
  assert.equal(transformMarkerForCrop({ clipId: 'qadr', yPercent: 35 }, crop598), null);
  const inside = transformMarkerForCrop({ clipId: 'bayyinah_4', yPercent: 80 }, crop598);
  assert.ok(inside && inside.yPercent > 40 && inside.yPercent < 70);

  // Al-Fatihah on PDF page 2 crops only top half
  const cropFatiha = computePageCropForVerseSpan620(2, { startSurah: 1, startAyah: 1, endSurah: 1, endAyah: 7 }, 620, 0);
  assert.equal(cropFatiha.isCropped, true);
  assert.equal(cropFatiha.drawTopBar, false);
  assert.equal(cropFatiha.drawBotBar, true);
  assert.ok(cropFatiha.botFrac < 0.55);
});
