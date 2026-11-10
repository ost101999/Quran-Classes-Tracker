const getSingleLessonType = (book: 'noor' | 'taasees', p: number, lang: 'ar' | 'en') => {
  if (book === 'noor') {
    if (p < 1 || p > 73) return '';
    if (p >= 71) return lang === 'ar' ? 'مراجعة عامة' : 'General Review';
    p += 7;
    if (p >= 1 && p <= 13) return lang === 'ar' ? 'حركة الفتح' : 'Fatha';
    if (p >= 14 && p <= 18) return lang === 'ar' ? 'حركة الكسر' : 'Kasra';
    if (p >= 19 && p <= 22) return lang === 'ar' ? 'حركة الضم' : 'Damma';
    if (p >= 23 && p <= 24) return lang === 'ar' ? 'مراجعة الحركات' : 'Harakat Review';
    if (p >= 25 && p <= 28) return lang === 'ar' ? 'المد بالألف' : 'Madd with Alif';
    if (p >= 29 && p <= 32) return lang === 'ar' ? 'المد بالياء' : 'Madd with Yaa';
    if (p >= 33 && p <= 36) return lang === 'ar' ? 'المد بالواو' : 'Madd with Waw';
    if (p >= 37 && p <= 39) return lang === 'ar' ? 'مراجعة المدود' : 'Mudood Review';
    if (p >= 40 && p <= 50) return lang === 'ar' ? 'السكون' : 'Sukun';
    if (p >= 51 && p <= 53) return lang === 'ar' ? 'التنوين بالفتح' : 'Tanween with Fatha';
    if (p >= 54 && p <= 56) return lang === 'ar' ? 'التنوين بالكسر' : 'Tanween with Kasra';
    if (p >= 57 && p <= 58) return lang === 'ar' ? 'التنوين بالضم' : 'Tanween with Damma';
    if (p >= 59 && p <= 62) return lang === 'ar' ? 'مراجعة التنوين' : 'Tanween Review';
    if (p >= 63 && p <= 66) return lang === 'ar' ? 'الشدة مع الفتح' : 'Shadda with Fatha';
    if (p >= 67 && p <= 70) return lang === 'ar' ? 'الشدة مع الكسر' : 'Shadda with Kasra';
    if (p >= 71 && p <= 75) return lang === 'ar' ? 'الشدة مع الضم' : 'Shadda with Damma';
    if (p >= 76 && p <= 77) return lang === 'ar' ? 'الشدة مع التنوين - نهاية الكتاب' : 'Shadda with Tanween - End of Book';
  } else {
    // Foundation Book
    if (p >= 1 && p <= 4) return lang === 'ar' ? 'الحروف أ ب ت ث' : 'The letters أ ب ت ث';
    if (p >= 5 && p <= 8) return lang === 'ar' ? 'الحروف ج ح خ' : 'The letters ج ح خ';
    if (p >= 9 && p <= 13) return lang === 'ar' ? 'الحروف د ذ' : 'The letters د ذ';
    if (p >= 14 && p <= 18) return lang === 'ar' ? 'الحروف ر ز' : 'The letters ر ز';
    if (p >= 19 && p <= 23) return lang === 'ar' ? 'الحروف س ش' : 'The letters س ش';
    if (p >= 24 && p <= 29) return lang === 'ar' ? 'الحروف ص ض' : 'The letters ص ض';
    if (p >= 30 && p <= 33) return lang === 'ar' ? 'الحروف ط ظ' : 'The letters ط ظ';
    if (p >= 34 && p <= 38) return lang === 'ar' ? 'الحروف ع غ' : 'The letters ع غ';
    if (p >= 39 && p <= 43) return lang === 'ar' ? 'الحروف ف ق' : 'The letters ف ق';
    if (p >= 44 && p <= 48) return lang === 'ar' ? 'الحروف ك ل' : 'The letters ك ل';
    if (p >= 49 && p <= 53) return lang === 'ar' ? 'الحروف م ن' : 'The letters م ن';
    if (p >= 54 && p <= 58) return lang === 'ar' ? 'الحرف و' : 'The letter و';
    if (p >= 59 && p <= 63) return lang === 'ar' ? 'الحرف ي - نهاية الكتاب' : 'The letter ي - End of Book';
  }
  return '';
};

export const getNoorLessonType = (book: 'noor' | 'taasees', fromPageStr: string, toPageStr: string, lang: 'ar' | 'en') => {
  if (!fromPageStr) return '';
  const fromEn = fromPageStr.replace(/[٠-٩]/g, d => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]);
  const p1 = parseInt(fromEn);
  if (isNaN(p1)) return '';

  const type1 = getSingleLessonType(book, p1, lang);

  // If no toPage, or it's cancelled/0, just return type1
  if (!toPageStr || toPageStr.trim() === '0' || toPageStr.trim() === '٠') return type1;

  const toEn = toPageStr.replace(/[٠-٩]/g, d => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]);
  const p2 = parseInt(toEn);
  if (isNaN(p2) || p1 === p2) return type1;

  const startP = Math.min(p1, p2);
  const endP = Math.max(p1, p2);

  const uniqueLessons: string[] = [];
  for (let i = startP; i <= endP; i++) {
    const type = getSingleLessonType(book, i, lang);
    if (type && !uniqueLessons.includes(type)) {
      uniqueLessons.push(type);
    }
  }

  if (uniqueLessons.length === 0) return '';
  if (uniqueLessons.length === 1) return uniqueLessons[0];

  if (book === 'taasees') {
    if (lang === 'en') {
      const isAllLetters = uniqueLessons.every(l => l.startsWith('The letters ') || l.startsWith('The letter '));
      if (isAllLetters) {
        const combinedLetters = uniqueLessons.map(l => l.replace('The letters ', '').replace('The letter ', '')).join(' ');
        return `The letters ${combinedLetters}`;
      }
    } else if (lang === 'ar') {
      const isAllLetters = uniqueLessons.every(l => l.startsWith('الحروف ') || l.startsWith('الحرف '));
      if (isAllLetters) {
        const combinedLetters = uniqueLessons.map(l => l.replace('الحروف ', '').replace('الحرف ', '')).join(' ');
        return `الحروف ${combinedLetters}`;
      }
    }
  }

  return uniqueLessons.join(' - ');
};

export function normalizeNoorEndPage(value: string, book: 'noor' | 'taasees'): string {
  const normalized = value.replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
  const western = normalized.replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]);
  return book === 'noor' && /^\d+$/.test(western) && Number(western) > 73 ? '٧٣' : normalized;
}

export function copyNoorInputs(root: Pick<Document, 'getElementById'>, parts: string[]): void {
  for (const part of parts) {
    const source = root.getElementById(`noor-tam-${part}`) as HTMLInputElement | null;
    const target = root.getElementById(`noor-sayatim-${part}`) as HTMLInputElement | null;
    if (source && target) target.value = source.value;
  }
}
