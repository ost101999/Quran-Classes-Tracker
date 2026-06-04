const CACHE_NAME = 'quran-tracker-pwa-v1';

self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
    // Pass-through fetch to always get fresh data (ideal for this simple setup)
    e.respondWith(fetch(e.request).catch(() => new Response('Offline Mode Not Fully Supported Yet')));
});
