const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(require('node:path').join(__dirname, '../services/whatsappStudentSync.ts'), 'utf8');
const mod = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: mod.exports });
const { applyWhatsAppMatches, whatsappDifferences } = mod.exports;

test('fills only empty targets and preserves existing and renamed students', () => {
  const students = [{ id: '1', name: 'Ali' }, { id: '2', name: 'Sara', whatsappNumber: '201234567890' }, { id: '3', name: 'Renamed' }];
  const requests = [{ id: '1', name: 'Ali' }, { id: '2', name: 'Sara' }, { id: '3', name: 'Old' }];
  const matches = { '1': '123456789@lid', '2': '987654321@lid', '3': '123456789@lid' };
  const result = applyWhatsAppMatches(students, requests, matches);
  assert.equal(result[0].whatsappNumber, matches['1']);
  assert.equal(result[1].whatsappNumber, students[1].whatsappNumber);
  assert.equal(result[2].whatsappNumber, undefined);
  assert.equal(applyWhatsAppMatches(result, requests, matches), result);
});

test('alerts only on different destinations and recognizes equivalent phone formats', () => {
  const students = [{ id: '1', name: 'Ali', whatsappNumber: '01234567890' }, { id: '2', name: 'Sara', whatsappNumber: '123456789@lid' }];
  const differences = whatsappDifferences(students, { '1': '201234567890@c.us', '2': '987654321@lid' });
  assert.equal(differences.length, 1);
  assert.equal(differences[0].studentName, 'Sara');
  assert.equal(differences[0].current, '123456789@lid');
  assert.equal(differences[0].target, '987654321@lid');
});
