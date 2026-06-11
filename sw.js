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
    // GET 以外・http(s) 以外（blob: 等）はキャッシュ対象外
    if (e.request.method !== 'GET') return;
    const url = new URL(e.request.url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

    // CDN リソース (Monaco Editor): cache-first — ネットワーク取得後キャッシュし、次回以降はキャッシュから返す
    if (url.hostname === 'cdnjs.cloudflare.com') {
        e.respondWith(
            caches.open(CACHE_CDN).then(cache =>
                cache.match(e.request).then(cached => {
                    if (cached) return cached;
                    return fetch(e.request).then(res => {
                        if (res.ok) cache.put(e.request, res.clone()).catch(() => {});
                        return res;
                    });
                })
            ).catch(() => new Response('', { status: 503, statusText: 'Service Unavailable' }))
        );
        return;
    }

    // 同一オリジン: network-first — オフライン時はキャッシュから返す
    if (url.origin === self.location.origin) {
        e.respondWith(
            fetch(e.request)
                .then(res => {
                    // 正常レスポンスのみキャッシュ（404等で正常キャッシュを上書きしない）
                    if (res.ok) {
                        const clone = res.clone();
                        caches.open(CACHE_APP).then(c => c.put(e.request, clone)).catch(() => {});
                    }
                    return res;
                })
                .catch(() => caches.match(e.request).then(c => c || new Response('', { status: 503, statusText: 'Service Unavailable' })))
        );
    }
});
