type RevisionReading = {
  surah?: string; fromSurah?: string; toSurah?: string;
  fromAyah?: string; toAyah?: string; fromPage?: string; toPage?: string;
  fromJuz?: string; toJuz?: string; fromHizb?: string; toHizb?: string;
};
type RevisionHomework = {
  mode?: string; surah?: string; fromSurah?: string; toSurah?: string;
  from?: string; to?: string; isAdvancedAyah?: boolean;
};

// Mirror the values actually shown in the current lesson, including its
// displayed surah fallbacks when older reports have incomplete data.
export function buildOldRevisionRedo(
  reading: RevisionReading | undefined,
  homework: RevisionHomework | undefined,
  mode: string,
  advanced: boolean,
  defaultSurah: string,
  progressSurah?: string,
): RevisionHomework {
  const source = reading || {};
  const next: RevisionHomework = { ...homework, mode, isAdvancedAyah: advanced };
  if (mode === 'ayah') {
    const surah = source.surah || homework?.surah || progressSurah || defaultSurah;
    next.surah = surah;
    next.fromSurah = surah;
    next.toSurah = advanced ? source.toSurah || homework?.toSurah || defaultSurah : surah;
    next.from = source.fromAyah || '';
    next.to = source.toAyah || '';
  } else if (mode === 'page') {
    next.from = source.fromPage || '';
    next.to = source.toPage || '';
  } else if (mode === 'juz') {
    next.from = source.fromJuz || '';
    next.to = source.toJuz || '';
  } else if (mode === 'hizb') {
    next.from = source.fromHizb || '';
    next.to = source.toHizb || '';
  } else if (mode === 'surah') {
    next.fromSurah = source.fromSurah || homework?.fromSurah || defaultSurah;
    next.toSurah = source.toSurah || homework?.toSurah || defaultSurah;
  }
  return next;
}
