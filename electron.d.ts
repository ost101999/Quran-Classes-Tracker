declare global {
    interface Window {
        electronAPI: {
            saveData: (data: any) => Promise<{ success: boolean; error?: string }>;
            loadData: () => Promise<any>;
            saveTajweedAudio: (base64Data: string, fileName: string) => Promise<{ success: boolean; localPath?: string; error?: string }>;
            openExternal: (url: string, options?: { background?: boolean }) => Promise<void>;
            sendWhatsAppAuto: (targetName: string, message: string) => Promise<{ success: boolean; error?: string }>;
            selectBackupFolder: () => Promise<string | null>;
            saveBackupToPath: (folderPath: string, data: any, maxFiles?: number) => Promise<{ success: boolean; filePath?: string; totalFiles?: number; error?: string }>;
            onEscapeBtn: (callback: () => void) => void;
            offEscapeBtn: () => void;
            onNavigateInternal?: (callback: (url: string) => void) => void;
            offNavigateInternal?: () => void;
            getSyncStatus?: () => Promise<{ isSyncing: boolean, hasPending: boolean }>;
            onCloudSyncSuccess?: (callback: (timestamp: number) => void) => void;
            offCloudSyncSuccess?: () => void;
        };
    }
}

export { };
