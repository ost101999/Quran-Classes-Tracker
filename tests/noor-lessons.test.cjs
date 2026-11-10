const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../services/noorLessons.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const mod = { exports: {} };
vm.runInNewContext(code, { module: mod, exports: mod.exports });
const { getNoorLessonType, normalizeNoorEndPage, nextNoorPages, copyNoorInputs } = mod.exports;

test('Noor lesson names use the revised page boundaries, including the final review', () => {
  const ranges = [[1,6,'حركة الفتح'], [7,11,'حركة الكسر'], [12,15,'حركة الضم'], [16,17,'مراجعة الحركات'], [18,21,'المد بالألف'], [22,25,'المد بالياء'], [26,29,'المد بالواو'], [30,32,'مراجعة المدود'], [33,43,'السكون'], [44,46,'التنوين بالفتح'], [47,49,'التنوين بالكسر'], [50,51,'التنوين بالضم'], [52,55,'مراجعة التنوين'], [56,59,'الشدة مع الفتح'], [60,63,'الشدة مع الكسر'], [64,68,'الشدة مع الضم'], [69,70,'الشدة مع التنوين - نهاية الكتاب'], [71,73,'مراجعة عامة']];
  for (const [first, last, label] of ranges) {
    assert.equal(getNoorLessonType('noor', String(first), '', 'ar'), label);
    assert.equal(getNoorLessonType('noor', String(last), '', 'ar'), label);
  }
  assert.equal(getNoorLessonType('noor', '70', '71', 'ar'), 'الشدة مع التنوين - نهاية الكتاب - مراجعة عامة');
  assert.equal(getNoorLessonType('noor', '71', '73', 'en'), 'General Review');
  assert.equal(getNoorLessonType('noor', '74', '', 'ar'), '');
  assert.equal(getNoorLessonType('taasees', '٧', '', 'ar'), 'الحروف ج ح خ');
});

test('end pages above 73 are capped for Noor while 0 and Foundation Book remain unchanged', () => {
  assert.equal(normalizeNoorEndPage('74', 'noor'), '٧٣');
  assert.equal(normalizeNoorEndPage('٩٩٩', 'noor'), '٧٣');
  assert.equal(normalizeNoorEndPage('73', 'noor'), '٧٣');
  assert.equal(normalizeNoorEndPage('0', 'noor'), '٠');
  assert.equal(normalizeNoorEndPage('', 'noor'), '');
  assert.equal(normalizeNoorEndPage('74', 'taasees'), '٧٤');
});

test('repeat copies current pages and lines, including empty values that clear old homework', () => {
  const fields = {
    'noor-tam-from-page': { value: '٣٠' }, 'noor-tam-to-page': { value: '' },
    'noor-sayatim-from-page': { value: '٢٤' }, 'noor-sayatim-to-page': { value: '٢٥' },
    'noor-tam-from-line': { value: '٢' }, 'noor-tam-to-line': { value: '٥' },
    'noor-sayatim-from-line': { value: '' }, 'noor-sayatim-to-line': { value: '٩' },
  };
  copyNoorInputs({ getElementById: id => fields[id] || null }, ['from-page', 'to-page', 'from-line', 'to-line']);
  assert.equal(fields['noor-sayatim-from-page'].value, '٣٠');
  assert.equal(fields['noor-sayatim-to-page'].value, '');
  assert.equal(fields['noor-sayatim-from-line'].value, '٢');
  assert.equal(fields['noor-sayatim-to-line'].value, '٥');
});

test('continuation starts on the following page and stops at the end of Noor', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(nextNoorPages('١١'))), { from: '١٢', to: '٠' });
  assert.deepEqual(JSON.parse(JSON.stringify(nextNoorPages('72'))), { from: '٧٣', to: '٠' });
  assert.deepEqual(JSON.parse(JSON.stringify(nextNoorPages('٧٣'))), { from: '', to: '' });
  assert.equal(nextNoorPages('٠'), null);
  assert.equal(nextNoorPages(''), null);
});
