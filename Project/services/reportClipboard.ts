export const CONCISE_AUTO_COMPLETE_NOTICE_AR =
  'تم إرسال التقرير بناء على إكمال حصص أيام الشهر وعند حدوث أي ظرف يتم الخصم من حساب الشهر القادم';

export const CONCISE_AUTO_COMPLETE_NOTICE_EN =
  "This report has been sent based on completing the remaining scheduled classes for this month; in case of any unforeseen circumstance, it will be deducted from next month's account.";

async function defaultWriteClipboardText(text: string): Promise<void> {
  const value = String(text ?? '');
  if (typeof window !== 'undefined' && window.electronAPI?.copyTextToClipboard) {
    try {
      const res = await window.electronAPI.copyTextToClipboard(value);
      if (res?.success) return;
    } catch { /* fall through to navigator.clipboard */ }
  }
  await navigator.clipboard.writeText(value);
}

/**
 * Copies a text report to the clipboard. When `includeCompletionNotice` is true (concise mode
 * with auto-completed upcoming classes), writes the notice first and the report after a short
 * delay so Windows Clipboard History keeps the report #1 (`Ctrl+V`) and the notice #2 (`Win+V`).
 */
export async function copyReportTextToClipboard(
  reportText: string,
  options: {
    includeCompletionNotice: boolean;
    isEnglish: boolean;
    delayMs?: number;
    writeText?: (text: string) => Promise<void>;
  }
): Promise<void> {
  const writer = options.writeText || defaultWriteClipboardText;
  if (options.includeCompletionNotice) {
    const notice = options.isEnglish
      ? CONCISE_AUTO_COMPLETE_NOTICE_EN
      : CONCISE_AUTO_COMPLETE_NOTICE_AR;
    await writer(notice);
    await new Promise(resolve => setTimeout(resolve, options.delayMs ?? 600));
  }
  await writer(reportText);
}
