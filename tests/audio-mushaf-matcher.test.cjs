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
const { publishAudioSessionToCloud } = require('../audio-mushaf/publisher');
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
  assert.equal(res.prunedCount, 1);
  assert.equal(store['/audioMushafSessions/s1.json'], undefined);
  assert.equal(Object.keys(store['/audioMushafIndex/st1.json']).length, 3);
});
