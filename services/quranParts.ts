// Quran structural metadata: Tanzil (https://tanzil.net/docs/Quran_Metadata), CC BY 3.0.
const juzStarts: [number, number][] = [[1, 1], [2, 142], [2, 253], [3, 93], [4, 24], [4, 148], [5, 82], [6, 111], [7, 88], [8, 41], [9, 93], [11, 6], [12, 53], [15, 1], [17, 1], [18, 75], [21, 1], [23, 1], [25, 21], [27, 56], [29, 46], [33, 31], [36, 28], [39, 32], [41, 47], [46, 1], [51, 31], [58, 1], [67, 1], [78, 1]];
const hizbStarts: [number, number][] = [[1, 1], [2, 75], [2, 142], [2, 203], [2, 253], [3, 15], [3, 93], [3, 171], [4, 24], [4, 88], [4, 148], [5, 27], [5, 82], [6, 36], [6, 111], [7, 1], [7, 88], [7, 171], [8, 41], [9, 34], [9, 93], [10, 26], [11, 6], [11, 84], [12, 53], [13, 19], [15, 1], [16, 51], [17, 1], [17, 99], [18, 75], [20, 1], [21, 1], [22, 1], [23, 1], [24, 21], [25, 21], [26, 111], [27, 56], [28, 51], [29, 46], [31, 22], [33, 31], [34, 24], [36, 28], [37, 145], [39, 32], [40, 41], [41, 47], [43, 24], [46, 1], [48, 18], [51, 31], [55, 1], [58, 1], [62, 1], [67, 1], [72, 1], [78, 1], [87, 1]];
export function quranPartRange(kind: 'juz' | 'hizb', number: number, counts: number[]) {
  const starts = kind === 'juz' ? juzStarts : hizbStarts;
  if (!Number.isInteger(number) || number < 1 || number > starts.length) return null;
  const [surah, ayah] = starts[number - 1];
  const next = starts[number];
  const endSurah = next ? (next[1] === 1 ? next[0] - 1 : next[0]) : counts.length;
  const endAyah = next && next[1] > 1 ? next[1] - 1 : counts[endSurah - 1];
  return { startSurah: surah, startAyah: ayah, endSurah, endAyah };
}
export function quranPartForVerse(surah: number, ayah: number, counts: number[]) {
  if (!Number.isInteger(surah) || !Number.isInteger(ayah) || surah < 1 || surah > counts.length || ayah < 1 || ayah > counts[surah - 1]) return null;
  let index = 0;
  hizbStarts.forEach(([s, a], i) => { if (s < surah || (s === surah && a <= ayah)) index = i; });
  return { juz: Math.floor(index / 2) + 1, hizb: index % 2 + 1 };
}
