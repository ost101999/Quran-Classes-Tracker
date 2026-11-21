const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const cache = new Map();
function loadTs(relPath) {
  const fullPath = path.resolve(__dirname, '..', relPath);
  if (cache.has(fullPath)) return cache.get(fullPath);

  const source = fs.readFileSync(fullPath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;

  const mod = { exports: {} };
  cache.set(fullPath, mod.exports);

  const localRequire = (spec) => {
    if (spec.startsWith('./') || spec.startsWith('../')) {
      const target = path.resolve(path.dirname(fullPath), spec);
      for (const ext of ['', '.ts', '.tsx', '.js']) {
        if (fs.existsSync(target + ext) && fs.statSync(target + ext).isFile()) {
          if (ext === '.js' || target.endsWith('.js')) return require(target + ext);
          return loadTs(path.relative(path.resolve(__dirname, '..'), target + ext));
        }
      }
    }
    return require(spec);
  };

  new Function('module', 'exports', 'require', transpiled)(mod, mod.exports, localRequire);
  cache.set(fullPath, mod.exports);
  return mod.exports;
}

const {
  mushafPageForVerse,
  resolveReportSectionPages,
  buildCustomMushafPlan,
} = loadTs('services/quranPages.ts');

test('maps standard Madinah Mushaf verses to exact pages 1..604', () => {
  assert.equal(mushafPageForVerse(1, 1), 1);
  assert.equal(mushafPageForVerse(1, 7), 1);
  assert.equal(mushafPageForVerse(2, 1), 2);
  assert.equal(mushafPageForVerse(2, 5), 2);
  assert.equal(mushafPageForVerse(2, 6), 3);
  assert.equal(mushafPageForVerse(2, 282), 48);
  assert.equal(mushafPageForVerse(18, 1), 293);
  assert.equal(mushafPageForVerse(67, 1), 562);
  assert.equal(mushafPageForVerse(78, 1), 582);
  assert.equal(mushafPageForVerse(112, 1), 604);
  assert.equal(mushafPageForVerse(114, 6), 604);
  assert.equal(mushafPageForVerse(115, 1), null);
});

test('resolves all Smart Report modes (ayah, advanced ayah, page, juz, hizb, surah) with Hindi/Western digits', () => {
  assert.deepEqual(
    (() => {
      const r = resolveReportSectionPages({ mode: 'ayah', surah: 'البقرة', fromAyah: '١', toAyah: '١٦' });
      return { startPage: r.startPage, endPage: r.endPage };
    })(),
    { startPage: 2, endPage: 3 }
  );

  assert.deepEqual(
    (() => {
      const r = resolveReportSectionPages({ mode: 'ayah', surah: 'سورة النبأ', fromAyah: '', toAyah: '' });
      return { startPage: r.startPage, endPage: r.endPage };
    })(),
    { startPage: 582, endPage: 583 }
  );

  assert.deepEqual(
    (() => {
      const r = resolveReportSectionPages({
        mode: 'ayah',
        isAdvancedAyah: true,
        surah: 'الناس',
        toSurah: 'الفلق',
        fromAyah: '1',
        toAyah: '5',
      });
      return { startPage: r.startPage, endPage: r.endPage };
    })(),
    { startPage: 604, endPage: 604 }
  );

  assert.deepEqual(
    (() => {
      const r = resolveReportSectionPages({ mode: 'page', fromPage: '٢٢', toPage: '٢٥' });
      return { startPage: r.startPage, endPage: r.endPage };
    })(),
    { startPage: 22, endPage: 25 }
  );

  assert.deepEqual(
    (() => {
      const r = resolveReportSectionPages({ mode: 'page', fromPage: '١٠', toPage: '٢٠', toCancelled: true });
      return { startPage: r.startPage, endPage: r.endPage };
    })(),
    { startPage: 10, endPage: 10 }
  );

  assert.deepEqual(
    (() => {
      const r = resolveReportSectionPages({ mode: 'juz', fromJuz: '١', toJuz: '' });
      return { startPage: r.startPage, endPage: r.endPage };
    })(),
    { startPage: 1, endPage: 21 }
  );

  assert.deepEqual(
    (() => {
      const r = resolveReportSectionPages({ mode: 'juz', fromJuz: '2', toJuz: '2' });
      return { startPage: r.startPage, endPage: r.endPage };
    })(),
    { startPage: 22, endPage: 41 }
  );

  assert.deepEqual(
    (() => {
      const r = resolveReportSectionPages({ mode: 'hizb', fromHizb: '١', toHizb: '١' });
      return { startPage: r.startPage, endPage: r.endPage };
    })(),
    { startPage: 1, endPage: 11 }
  );

  assert.deepEqual(
    (() => {
      const r = resolveReportSectionPages({ mode: 'surah', fromSurah: 'الملك', toSurah: 'القلم' });
      return { startPage: r.startPage, endPage: r.endPage };
    })(),
    { startPage: 562, endPage: 566 }
  );
});

test('buildCustomMushafPlan defaults to homework sections ordered rev -> oldRev -> new -> tilawa and respects reading/custom settings', () => {
  const reportData = {
    readingNew: { mode: 'ayah', surah: 'الملك', fromAyah: '١', toAyah: '١٢' },
    readingRev: { mode: 'juz', fromJuz: '٣٠', toJuz: '٣٠' },
    readingOldRev: { mode: 'page', fromPage: '٢', toPage: '٣' },
    readingTilawa: { mode: 'surah', fromSurah: 'الفاتحة', toSurah: 'الفاتحة' },
    homeworkNew: { mode: 'ayah', surah: 'الملك', from: '١٣', to: '٣٠' },
    homeworkRev: { mode: 'juz', from: '٢٩', to: '٢٩' },
  };
  const sectionToggles = {
    readingNew: true,
    readingRev: true,
    readingOldRev: true,
    readingTilawa: true,
    homeworkNew: true,
    homeworkRev: true,
  };

  const defaultHwPlan = buildCustomMushafPlan({ reportData, sectionToggles });
  assert.deepEqual(defaultHwPlan.map(s => [s.key, s.startPage, s.endPage]), [
    ['rev', 562, 581],
    ['new', 563, 564],
  ]);

  const plan = buildCustomMushafPlan({
    reportData,
    sectionToggles,
    settings: { mushafTargetSection: 'reading' },
  });
  assert.deepEqual(plan.map(s => s.key), ['rev', 'oldRev', 'new', 'tilawa']);
  assert.equal(plan[0].titleEn, 'Revision');
  assert.equal(plan[1].titleEn, 'Old Revision');
  assert.deepEqual(plan.map(s => [s.startPage, s.endPage]), [
    [582, 604],
    [2, 3],
    [562, 562],
    [1, 1],
  ]);

  const filteredPlan = buildCustomMushafPlan({
    reportData,
    sectionToggles,
    exclusions: { tilawa: true },
    settings: {
      mushafTargetSection: 'reading',
      mushafIncludedSections: { rev: true, oldRev: false, new: true, tilawa: true },
      mushafSectionOrder: ['new', 'rev', 'oldRev', 'tilawa'],
    },
  });
  assert.deepEqual(filteredPlan.map(s => s.key), ['new', 'rev']);
});
