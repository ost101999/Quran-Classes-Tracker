const BRIDGE = 'http://127.0.0.1:39271';
const headers = { 'X-Tracker-Extension': '1' };
let polling = false;

function comparableUrl(value) {
    try {
        const url = new URL(value);
        if (url.hostname === 'quranreport.vercel.app') url.searchParams.delete('_ts');
        return url.href;
    } catch { return null; }
}

async function handleJob(job) {
    let found = false;
    let title = '';
    try {
        const target = comparableUrl(job.url);
        const tabs = await chrome.tabs.query({});
        const tab = tabs.find(item => target && comparableUrl(item.url) === target);
        if (tab && tab.id != null && tab.windowId != null) {
            // Refresh only the student portal, whose report data may have changed.
            const isPortal = new URL(job.url).hostname === 'quranreport.vercel.app';
            await chrome.tabs.update(tab.id, isPortal ? { active: true, url: job.url } : { active: true });
            const window = await chrome.windows.get(tab.windowId);
            await chrome.windows.update(tab.windowId, window.state === 'minimized'
                ? { state: 'normal', focused: true } : { focused: true });
            title = tab.title || '';
            found = true;
        }
    } catch (error) { console.error('Could not activate the matching tab:', error); }
    await fetch(`${BRIDGE}/result`, { method: 'POST', headers, body: JSON.stringify({ id: job.id, found, title }) });
}

async function poll() {
    if (polling) return;
    polling = true;
    try {
        while (true) {
            const response = await fetch(`${BRIDGE}/next`, { method: 'POST', headers });
            if (!response.ok) break;
            const job = await response.json();
            if (job) await handleJob(job);
        }
    } catch { /* The desktop application may not be running. */ }
    finally {
        polling = false;
        setTimeout(poll, 2000);
    }
}

chrome.alarms.create('reconnect', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(() => poll());
chrome.runtime.onStartup.addListener(() => poll());
chrome.runtime.onInstalled.addListener(() => poll());
poll();
