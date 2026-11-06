declare global {
    interface Window {
        electronAPI: {
            platform?: string;
            saveData: (data: any, skipSync?: boolean, token?: number) => Promise<{ success: boolean; busy?: boolean; error?: string }>;
            getCloudChanges?: () => Promise<{ busy?: boolean; changes?: Record<string, any>; token?: number }>;
            getSyncConflicts?: () => Promise<any[]>;
            resolveSyncConflict?: (path: string, choice: 'local' | 'remote', etag: string) => Promise<{ success: boolean; changed?: boolean }>;
            loadData: () => Promise<any>;
            saveZoom?: (zoomFactor: number) => Promise<{ success: boolean; error?: string }>;
            loadZoom?: () => Promise<number | null>;
            saveTajweedAudio: (base64Data: string, fileName: string) => Promise<{ success: boolean; localPath?: string; error?: string }>;
            openExternal: (url: string, options?: { background?: boolean; reuseExisting?: boolean }) => Promise<{ success: boolean; reused?: boolean; error?: string }>;
            sendWhatsAppAuto: (targetName: string, message: string) => Promise<{ success: boolean; error?: string }>;
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

export { };
