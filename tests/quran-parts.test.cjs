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
const { quranPartRange } = load('services/quranParts.ts');
const { SURAH_AYAH_COUNTS } = load('constants.ts');
test('juz and hizb ranges include the verse before the next boundary', () => {
  assert.deepEqual(quranPartRange('juz', 1, SURAH_AYAH_COUNTS), { startSurah: 1, startAyah: 1, endSurah: 2, endAyah: 141 });
  assert.deepEqual(quranPartRange('hizb', 1, SURAH_AYAH_COUNTS), { startSurah: 1, startAyah: 1, endSurah: 2, endAyah: 74 });
  assert.deepEqual(quranPartRange('juz', 30, SURAH_AYAH_COUNTS), { startSurah: 78, startAyah: 1, endSurah: 114, endAyah: 6 });
  assert.equal(quranPartRange('hizb', 61, SURAH_AYAH_COUNTS), null);
  for (const kind of ['juz', 'hizb']) for (let n = 1; n <= (kind === 'juz' ? 30 : 60); n++) {
    const range = quranPartRange(kind, n, SURAH_AYAH_COUNTS);
    assert.ok(range.startAyah >= 1 && range.startAyah <= SURAH_AYAH_COUNTS[range.startSurah - 1]);
    assert.ok(range.endAyah >= 1 && range.endAyah <= SURAH_AYAH_COUNTS[range.endSurah - 1]);
  }
});
