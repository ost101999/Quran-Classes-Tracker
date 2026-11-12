const test = require('node:test');
const assert = require('node:assert/strict');
const { targetsFromIni } = require('../whatsapp-integration');
const data = `[Files]\nAli Quran=G:\\students\\Ali\\Quran.pdf|zoom\nAli Reading=G:\\students\\Ali\\Reading.pdf|zoom\nSara Quran=G:\\students\\Sara\\Quran.pdf|zoom\n[WhatsApp]\nAli Quran=v1|12345678901@c.us|الطالب|تلقائي|في الانتظار|\nAli Reading=v1|12345678901@c.us|الطالب|تلقائي|في الانتظار|\nSara Quran=v1|123456789-123456@g.us|الطالب|تلقائي|في الانتظار|`;
test('maps book profiles to unique student folders', () => {
  assert.deepEqual(targetsFromIni(data, [{ id:'1',name:'Ali' }, { id:'2',name:'Sara' }]), { '1':'12345678901@c.us', '2':'123456789-123456@g.us' });
});
test('does not select among different targets or duplicate student names', () => {
  const conflicting = data.replace('Ali Reading=v1|12345678901@c.us', 'Ali Reading=v1|10987654321@c.us');
  assert.deepEqual(targetsFromIni(conflicting, [{ id:'1',name:'Ali' }]), {});
  assert.deepEqual(targetsFromIni(data, [{ id:'1',name:'Ali' }, { id:'2',name:'Ali' }]), {});
});
test('does not import a chat name as a WhatsApp identifier', () => {
  assert.deepEqual(targetsFromIni('[WhatsApp]\nAli=v1|Ali Group|x|y|z|', [{ id:'1',name:'Ali' }]), {});
});
