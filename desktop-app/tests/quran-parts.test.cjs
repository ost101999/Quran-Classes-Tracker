const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('module', 'exports', 'require', code)(mod, mod.exports, require);
  return mod.exports;
}
const { quranPartRange, quranRubSpanRange, quranPartForVerse, quranRubForVerse } = load('services/quranParts.ts');
const { SURAH_AYAH_COUNTS } = load('constants.ts');
test('juz, hizb and rub ranges include the verse before the next boundary', () => {
  assert.deepEqual(quranPartRange('juz', 1, SURAH_AYAH_COUNTS), { startSurah: 1, startAyah: 1, endSurah: 2, endAyah: 141 });
  assert.deepEqual(quranPartRange('hizb', 1, SURAH_AYAH_COUNTS), { startSurah: 1, startAyah: 1, endSurah: 2, endAyah: 74 });
  assert.deepEqual(quranPartRange('rub', 1, SURAH_AYAH_COUNTS), { startSurah: 1, startAyah: 1, endSurah: 2, endAyah: 25 });
  assert.deepEqual(quranPartRange('rub', 2, SURAH_AYAH_COUNTS), { startSurah: 2, startAyah: 26, endSurah: 2, endAyah: 43 });
  assert.deepEqual(quranPartRange('rub', 8, SURAH_AYAH_COUNTS), { startSurah: 2, startAyah: 124, endSurah: 2, endAyah: 141 });
  assert.deepEqual(quranPartRange('juz', 30, SURAH_AYAH_COUNTS), { startSurah: 78, startAyah: 1, endSurah: 114, endAyah: 6 });
  assert.deepEqual(quranPartRange('rub', 240, SURAH_AYAH_COUNTS), { startSurah: 100, startAyah: 9, endSurah: 114, endAyah: 6 });
  assert.equal(quranPartRange('hizb', 61, SURAH_AYAH_COUNTS), null);
  assert.equal(quranPartRange('rub', 241, SURAH_AYAH_COUNTS), null);
  for (const [kind, max] of [['juz', 30], ['hizb', 60], ['rub', 240]]) for (let n = 1; n <= max; n++) {
    const range = quranPartRange(kind, n, SURAH_AYAH_COUNTS);
    assert.ok(range.startAyah >= 1 && range.startAyah <= SURAH_AYAH_COUNTS[range.startSurah - 1]);
    assert.ok(range.endAyah >= 1 && range.endAyah <= SURAH_AYAH_COUNTS[range.endSurah - 1]);
  }
  for (let j = 1; j <= 30; j++) {
    const juzRange = quranPartRange('juz', j, SURAH_AYAH_COUNTS);
    const firstRub = quranPartRange('rub', (j - 1) * 8 + 1, SURAH_AYAH_COUNTS);
    const lastRub = quranPartRange('rub', j * 8, SURAH_AYAH_COUNTS);
    assert.equal(juzRange.startSurah, firstRub.startSurah);
    assert.equal(juzRange.startAyah, firstRub.startAyah);
    assert.equal(juzRange.endSurah, lastRub.endSurah);
    assert.equal(juzRange.endAyah, lastRub.endAyah);
  }
});
test('predicts the juz, local hizb, and local rub from an ayah', () => {
  assert.deepEqual(quranPartForVerse(2, 74, SURAH_AYAH_COUNTS), { juz: 1, hizb: 1 });
  assert.deepEqual(quranPartForVerse(2, 75, SURAH_AYAH_COUNTS), { juz: 1, hizb: 2 });
  assert.deepEqual(quranPartForVerse(2, 142, SURAH_AYAH_COUNTS), { juz: 2, hizb: 1 });
  assert.equal(quranPartForVerse(2, 287, SURAH_AYAH_COUNTS), null);
  assert.deepEqual(quranRubForVerse(1, 1, SURAH_AYAH_COUNTS), { juz: 1, hizb: 1, rub: 1 });
  assert.deepEqual(quranRubForVerse(2, 26, SURAH_AYAH_COUNTS), { juz: 1, hizb: 1, rub: 2 });
  assert.deepEqual(quranRubForVerse(2, 75, SURAH_AYAH_COUNTS), { juz: 1, hizb: 2, rub: 5 });
  assert.deepEqual(quranRubForVerse(2, 141, SURAH_AYAH_COUNTS), { juz: 1, hizb: 2, rub: 8 });
  assert.deepEqual(quranRubForVerse(100, 9, SURAH_AYAH_COUNTS), { juz: 30, hizb: 2, rub: 8 });
  assert.deepEqual(quranRubSpanRange(2, 4, SURAH_AYAH_COUNTS), { startSurah: 2, startAyah: 26, endSurah: 2, endAyah: 74 });
  assert.deepEqual(quranRubSpanRange(3, 6, SURAH_AYAH_COUNTS), { startSurah: 2, startAyah: 44, endSurah: 2, endAyah: 105 });
  assert.equal(quranRubSpanRange(5, 3, SURAH_AYAH_COUNTS), null);
});
