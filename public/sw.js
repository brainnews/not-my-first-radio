const CACHE_NAME = 'nmfr-cache-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json',
    '/icons/icon192.png',
    '/icons/icon512.png',
    '/icons/favicon.ico',
    '/icons/favicon-16x16.png',
    '/icons/favicon-32x32.png'
];

// Files to check for updates
const FILES_TO_CHECK = [
    '/index.html',
    '/styles.css',
    '/app.js'
];

// Install event - cache assets
self.addEventListener('install', event => {
    // Skip waiting to activate the new service worker immediately
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    // Claim clients to ensure the new service worker takes control immediately
    event.waitUntil(
        Promise.all([
            // Clean up old caches
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME) {
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            // Take control of all clients
            clients.claim()
        ])
    );
});

// Helper function to check if a URL is an audio stream
function isAudioStream(url) {
    const audioExtensions = ['.mp3', '.aac', '.m3u', '.m3u8', '.pls', '.xspf'];
    const audioPatterns = ['/stream', '/listen', '/radio', '/live', '/broadcast', '/audio', '/media', '/play', '/player'];
    
    const lowerUrl = url.toLowerCase();
    return audioExtensions.some(ext => lowerUrl.includes(ext)) ||
           audioPatterns.some(pattern => lowerUrl.includes(pattern));
}

// Helper function to check if a file has changed
async function checkFileForUpdates(url) {
    try {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(url);
        
        if (!cachedResponse) return true;

        const networkResponse = await fetch(url, { cache: 'no-store' });
        
        if (!networkResponse.ok) return false;

        const cachedText = await cachedResponse.text();
        const networkText = await networkResponse.text();

        return cachedText !== networkText;
    } catch (error) {
        console.error('Error checking file for updates:', error);
        return false;
    }
}

// Fetch event - network first strategy for HTML and JS, cache first for others
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);

    // Special handling for audio streams
    if (isAudioStream(url.href)) {
        event.respondWith(
            fetch(request)
                .catch(error => {
                    console.error('Error fetching audio stream:', error);
                    return new Response(JSON.stringify({
                        error: 'Failed to load stream',
                        url: url.href
                    }), {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                    });
                })
        );
        return;
    }

    // Check for updates in specific files
    if (FILES_TO_CHECK.includes(url.pathname)) {
        event.respondWith(
            (async () => {
                const hasUpdate = await checkFileForUpdates(url.pathname);
                
                if (hasUpdate) {
                    // Notify clients about the update
                    const clients = await self.clients.matchAll();
                    clients.forEach(client => {
                        client.postMessage({
                            type: 'UPDATE_AVAILABLE',
                            file: url.pathname
                        });
                    });
                }

                // Network-first strategy for these files
                try {
                    const response = await fetch(request);
                    const responseToCache = response.clone();
                    const cache = await caches.open(CACHE_NAME);
                    await cache.put(request, responseToCache);
                    return response;
                } catch (error) {
                    return caches.match(request);
                }
            })()
        );
        return;
    }

    // Cache-first strategy for other assets
    event.respondWith(
        caches.match(request)
            .then(response => {
                if (response) {
                    // Check if the cached response is stale
                    fetch(request)
                        .then(networkResponse => {
                            if (networkResponse.ok) {
                                const responseToCache = networkResponse.clone();
                                caches.open(CACHE_NAME)
                                    .then(cache => {
                                        cache.put(request, responseToCache);
                                    });
                            }
                        })
                        .catch(() => {
                            // Network request failed, continue using cached response
                        });
                    return response;
                }

                // If not in cache, fetch from network
                return fetch(request)
                    .then(response => {
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(request, responseToCache);
                            });

                        return response;
                    });
            })
    );
});

// Add message event listener to handle update notifications
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
}); 