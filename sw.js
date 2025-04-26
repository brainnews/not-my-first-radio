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

// Install event - cache assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
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

// Fetch event - serve from cache, fall back to network
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);

    // Special handling for audio streams
    if (isAudioStream(url.href)) {
        event.respondWith(
            fetch(request)
                .catch(error => {
                    console.error('Error fetching audio stream:', error);
                    // Return a custom error response that the app can handle
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

    // For non-audio requests, use the cache-first strategy
    event.respondWith(
        caches.match(request)
            .then(response => {
                // Return cached response if found
                if (response) {
                    return response;
                }

                // Clone the request
                const fetchRequest = request.clone();

                // Make network request and cache the response
                return fetch(fetchRequest).then(response => {
                    // Check if valid response
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }

                    // Clone the response
                    const responseToCache = response.clone();

                    // Cache the response
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(request, responseToCache);
                        });

                    return response;
                });
            })
    );
}); 