declare global {
    interface Window {
        electronAPI: {
            platform?: string;
            saveData: (data: any, skipSync?: boolean) => Promise<{ success: boolean; error?: string }>;
            loadData: () => Promise<any>;
            saveZoom?: (zoomFactor: number) => Promise<{ success: boolean; error?: string }>;
            loadZoom?: () => Promise<number | null>;
            saveTajweedAudio: (base64Data: string, fileName: string) => Promise<{ success: boolean; localPath?: string; error?: string }>;
            openExternal: (url: string, options?: { background?: boolean; reuseExisting?: boolean }) => Promise<{ success: boolean; reused?: boolean; error?: string }>;
            sendWhatsAppAuto: (targetName: string, message: string) => Promise<{ success: boolean; error?: string }>;
            selectBackupFolder: () => Promise<string | null>;
            saveBackupToPath: (folderPath: string, data: any, maxFiles?: number) => Promise<{ success: boolean; filePath?: string; totalFiles?: number; error?: string }>;
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
    isSyncing: boolean;
    hasPending: boolean;
    error: string | null;
    lastSuccessAt: number | null;
}

export { };
