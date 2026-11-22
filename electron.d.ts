declare global {
    interface Window {
        electronAPI: {
            platform?: string;
            devModeStatus?: () => Promise<{ available: boolean; active: boolean }>;
            devModeToggle?: (storage: Record<string, string>) => Promise<{ ok: boolean; canceled?: boolean; error?: string }>;
            devModeRestore?: () => Promise<Record<string, string> | null>;
            saveData: (data: any, skipSync?: boolean, token?: number) => Promise<{ success: boolean; busy?: boolean; error?: string }>;
            getCloudChanges?: () => Promise<{ busy?: boolean; changes?: Record<string, any>; token?: number }>;
            getSyncConflicts?: () => Promise<any[]>;
            resolveSyncConflict?: (path: string, choice: 'local' | 'remote', etag: string) => Promise<{ success: boolean; changed?: boolean }>;
            loadData: () => Promise<any>;
            getWhatsAppTargets?: (students: { id: string; name: string }[]) => Promise<{ available: boolean; matches: Record<string, string> }>;
            getShortcutLinks?: (students: { id: string; name: string }[]) => Promise<ShortcutLinksResult>;
            resolveStudentMushaf?: (payload: { studentName?: string; shortcutSourceId?: string; quranLink?: string }) => Promise<ResolveStudentMushafResult>;
            generateCustomMushaf?: (payload: GenerateCustomMushafPayload) => Promise<GenerateCustomMushafResult>;
            getStudentAudioSession?: (payload: { studentId?: string; studentName?: string; dateStr?: string }) => Promise<{ hasSession: boolean; clipsCount: number; sessionKey?: string; lastRecordedAt?: number | null }>;
            openMushafFolder?: () => Promise<{ success: boolean; outputDir?: string; error?: string }>;
            openMushafFile?: (filePath: string) => Promise<{ success: boolean; error?: string }>;
            copyFileToClipboard?: (filePath: string) => Promise<{ success: boolean; error?: string }>;
            copyTextToClipboard?: (text: string) => Promise<{ success: boolean; error?: string }>;
            getCalendarSchedules?: (students: { id: string; name: string }[], force?: boolean, review?: boolean, dayTransitionTime?: string) => Promise<import('./types').CalendarSchedulesResult>;
            saveZoom?: (zoomFactor: number) => Promise<{ success: boolean; error?: string }>;
            loadZoom?: () => Promise<number | null>;
            saveTajweedAudio: (base64Data: string, fileName: string) => Promise<{ success: boolean; localPath?: string; error?: string }>;
            openExternal: (url: string, options?: { background?: boolean; reuseExisting?: boolean }) => Promise<{ success: boolean; reused?: boolean; error?: string }>;
            sendWhatsAppAuto: (targetName: string, message: string, options?: { expectAttachment?: boolean }) => Promise<{ success: boolean; error?: string }>;
            sendWhatsAppFile?: (targetName: string, filePath: string, caption?: string) => Promise<{ success: boolean; unsupported?: boolean; error?: string }>;
            releaseWhatsAppSession?: () => Promise<{ success: boolean }>;
            selectBackupFolder: () => Promise<string | null>;
            saveBackupToPath: (folderPath: string, data: any, maxFiles?: number) => Promise<{ success: boolean; filePath?: string; totalFiles?: number; error?: string }>;
            exportMonthlyPdf?: (htmlContent: string, defaultFileName?: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
            onEscapeBtn: (callback: () => void) => void;
            offEscapeBtn: () => void;
            onNavigateInternal?: (callback: (url: string) => void) => void;
            offNavigateInternal?: () => void;
            getSyncStatus?: () => Promise<SyncStatus>;
            retrySync?: () => Promise<SyncStatus>;
            onSyncStatus?: (callback: (status: SyncStatus) => void) => void;
            offSyncStatus?: () => void;
            onCloudSyncSuccess?: (callback: (timestamp: number) => void) => void;
            offCloudSyncSuccess?: () => void;
            onCloudMergedFields?: (callback: (fields: Record<string, any>) => void) => void;
            offCloudMergedFields?: () => void;
            checkForUpdates?: () => Promise<{ status: 'available' | 'up-to-date' | 'error'; current?: string; latest?: string; error?: string }>;
            startUpdate?: () => Promise<{ started: boolean }>;
        };
    }
}

interface SyncStatus {
    conflict?: boolean;
    isSyncing: boolean;
    hasPending: boolean;
    error: string | null;
    lastSuccessAt: number | null;
}

interface ShortcutLinkMatch {
    id: string;
    path: string;
    folderId: string;
    titles: string[];
    isQuran: boolean;
    isReading: boolean;
    zoomLink: string;
    quranLink: string;
    readingLink: string;
    readingLinkInvalid: boolean;
    readingConflict: boolean;
    zoomConflict: boolean;
    conflict: boolean;
    exact?: boolean;
}

interface ShortcutLinksResult {
    available: boolean;
    matches: Record<string, ShortcutLinkMatch[]>;
    readingMatches: Record<string, ShortcutLinkMatch[]>;
    missingReadingMatches: Record<string, ShortcutLinkMatch[]>;
    folderHints?: Record<string, string[]>;
    groups: ShortcutLinkMatch[];
    error?: string;
}

interface ResolveStudentMushafResult {
    found: boolean;
    path?: string;
    fileName?: string;
    shortcutId?: string;
    reason?: string;
    error?: string;
    outputDir?: string;
}

interface CustomMushafSectionPayload {
    key: 'rev' | 'oldRev' | 'new' | 'tilawa';
    titleAr: string;
    titleEn: string;
    summaryAr: string;
    summaryEn: string;
    startPage: number;
    endPage: number;
}

interface GenerateCustomMushafPayload {
    studentId?: string;
    studentName: string;
    shortcutSourceId?: string;
    quranLink?: string;
    outputFormat?: 'pdf' | 'web_link' | 'html';
    sections: CustomMushafSectionPayload[];
    dividerStyle?: 'page' | 'banner' | 'both';
    language?: 'ar' | 'en';
    pageOffset?: number;
    dateStr?: string;
    autoOpen?: boolean;
}

interface GenerateCustomMushafResult {
    success: boolean;
    mode?: 'pdf' | 'web_link' | 'html';
    url?: string;
    sessionId?: string;
    filePath?: string;
    fileName?: string;
    totalOutputPages?: number;
    sourceFileName?: string;
    sectionsCount?: number;
    clipsCount?: number;
    unmatchedCount?: number;
    reason?: string;
    error?: string;
}

export { };
