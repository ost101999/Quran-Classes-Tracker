const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    saveData: (data, skipSync) => ipcRenderer.invoke('save-data', data, skipSync),
    loadData: () => ipcRenderer.invoke('load-data'),
    saveTajweedAudio: (base64Data, fileName) => ipcRenderer.invoke('save-tajweed-audio', base64Data, fileName),
    openExternal: (url, options) => ipcRenderer.invoke('open-external', url, options),
    sendWhatsAppAuto: (targetName, message) => ipcRenderer.invoke('send-whatsapp-auto', { targetName, message }),
    selectBackupFolder: () => ipcRenderer.invoke('select-backup-folder'),
    saveBackupToPath: (folderPath, data, maxFiles) => ipcRenderer.invoke('save-backup-to-path', { folderPath, data, maxFiles }),
    onEscapeBtn: (callback) => ipcRenderer.on('escape-pressed', callback),
    offEscapeBtn: () => ipcRenderer.removeAllListeners('escape-pressed'),
    onNavigateInternal: (callback) => ipcRenderer.on('navigate-internal', (_event, url) => callback(url)),
    offNavigateInternal: () => ipcRenderer.removeAllListeners('navigate-internal'),
    getSyncStatus: () => ipcRenderer.invoke('get-sync-status'),
    onCloudSyncSuccess: (callback) => ipcRenderer.on('cloud-sync-success', (_event, timestamp) => callback(timestamp)),
    offCloudSyncSuccess: () => ipcRenderer.removeAllListeners('cloud-sync-success'),
});
