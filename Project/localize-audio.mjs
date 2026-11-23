// A cloud recording is portable; a filesystem path belongs to one device.
// Reuse an existing path only when it still refers to the same recording.
export function localizeAudioPaths(incoming, local) {
    if (!incoming || typeof incoming !== 'object') return incoming;
    if (Array.isArray(incoming)) return incoming.map((item, index) => localizeAudioPaths(item, local?.[index]));
    return Object.fromEntries(Object.entries(incoming).flatMap(([key, value]) => {
        if (key === 'audioLocalPath') {
            return local?.audioLocalPath && incoming.audioBase64 === local.audioBase64
                ? [[key, local.audioLocalPath]] : [];
        }
        return [[key, localizeAudioPaths(value, local?.[key])]];
    }));
}
