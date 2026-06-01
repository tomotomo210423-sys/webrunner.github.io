// Web File Runner Ver.2.0 - Service Worker
const CACHE_APP = 'wfr-app-v2.0';
const CACHE_CDN = 'wfr-cdn-v2.0';

const PRECACHE_URLS = ['./'];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_APP).then(c => c.addAll(PRECACHE_URLS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k !== CACHE_APP && k !== CACHE_CDN).map(k => caches.delete(k))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);

    // CDN リソース (Monaco Editor): cache-first — ネットワーク取得後キャッシュし、次回以降はキャッシュから返す
    if (url.hostname === 'cdnjs.cloudflare.com') {
        e.respondWith(
            caches.open(CACHE_CDN).then(cache =>
                cache.match(e.request).then(cached => {
                    if (cached) return cached;
                    return fetch(e.request).then(res => {
                        if (res.ok) cache.put(e.request, res.clone());
                        return res;
                    }).catch(() => cached || new Response('', { status: 503 }));
                })
            )
        );
        return;
    }

    // 同一オリジン: network-first — オフライン時はキャッシュから返す
    if (url.origin === self.location.origin) {
        e.respondWith(
            fetch(e.request)
                .then(res => {
                    const clone = res.clone();
                    caches.open(CACHE_APP).then(c => c.put(e.request, clone));
                    return res;
                })
                .catch(() => caches.match(e.request).then(c => c || new Response('', { status: 503 })))
        );
    }
});
