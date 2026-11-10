const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../services/oldRevisionRedo.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const mod = { exports: {} };
vm.runInNewContext(code, { module: mod, exports: mod.exports });
const { buildOldRevisionRedo } = mod.exports;
const plain = value => JSON.parse(JSON.stringify(value));

test('redo copies the displayed ayah range even when the reading has no saved mode', () => {
  const homework = { mode: 'ayah', surah: 'الفاتحة', from: '٣', to: '' };
  const reading = { fromAyah: '١', toAyah: '٢' };
  const next = buildOldRevisionRedo(reading, homework, 'ayah', true, 'الفاتحة');
  assert.deepEqual(plain(next), { mode: 'ayah', surah: 'الفاتحة', from: '١', to: '٢', isAdvancedAyah: true, fromSurah: 'الفاتحة', toSurah: 'الفاتحة' });
  const edited = buildOldRevisionRedo({ ...reading, toAyah: '٤' }, next, 'ayah', true, 'الفاتحة');
  assert.equal(edited.to, '٤');
  assert.equal(buildOldRevisionRedo({ ...reading, toAyah: '' }, edited, 'ayah', true, 'الفاتحة').to, '');
});

test('advanced mode mirrors both displayed surahs and the saved progress fallback', () => {
  const next = buildOldRevisionRedo({ fromAyah: '٥', toAyah: '٢', toSurah: 'آل عمران' }, {}, 'ayah', true, 'الفاتحة', 'البقرة');
  assert.equal(next.fromSurah, 'البقرة');
  assert.equal(next.toSurah, 'آل عمران');
  assert.equal(next.from, '٥');
  assert.equal(next.to, '٢');
});

test('redo uses the selected mode and copies its current endpoints', () => {
  for (const [mode, fromKey, toKey] of [['page', 'fromPage', 'toPage'], ['juz', 'fromJuz', 'toJuz'], ['hizb', 'fromHizb', 'toHizb']]) {
    const next = buildOldRevisionRedo({ [fromKey]: '٣', [toKey]: '٥' }, { mode: 'ayah', from: '٦', to: '' }, mode, false, 'الفاتحة');
    assert.equal(next.mode, mode);
    assert.equal(next.from, '٣');
    assert.equal(next.to, '٥');
  }
  const surahs = buildOldRevisionRedo({ fromSurah: 'البقرة', toSurah: 'النساء' }, {}, 'surah', false, 'الفاتحة');
  assert.equal(surahs.fromSurah, 'البقرة');
  assert.equal(surahs.toSurah, 'النساء');
});
