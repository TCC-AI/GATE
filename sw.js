const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `ai-gate-${CACHE_VERSION}`;

// 需要快取的靜態資源
const STATIC_CACHE = [
    '/',
    '/index.html',
    '/offline.html',
    '/manifest.json',
    '/R0.png',
    '/app1.png',
    '/app2.png',
    '/app3.png',
    '/app4.png',
    '/app5.png',
    '/app6.png',
    '/app7.png',
    '/app8.png',
    '/app9.png',
    '/app10.png',
    '/icon-192x192.png',
    '/icon-512x512.png',
    // Google Fonts（可選）
    'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700;900&family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;600;700&display=swap'
];

// 安裝事件 - 預快取資源
self.addEventListener('install', (event) => {
    console.log('[SW] 安裝中...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] 快取靜態資源');
                return cache.addAll(STATIC_CACHE);
            })
            .then(() => self.skipWaiting())
            .catch(err => console.error('[SW] 快取失敗:', err))
    );
});

// 啟動事件 - 清理舊快取
self.addEventListener('activate', (event) => {
    console.log('[SW] 啟動中...');
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name => name.startsWith('ai-gate-') && name !== CACHE_NAME)
                        .map(name => {
                            console.log('[SW] 刪除舊快取:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => self.clients.claim())
    );
});

// 攔截請求 - Cache First 策略
self.addEventListener('fetch', (event) => {
    // 跳過非 GET 請求
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    console.log('[SW] 從快取返回:', event.request.url);
                    return cachedResponse;
                }

                // 快取中沒有，發起網路請求
                return fetch(event.request)
                    .then(response => {
                        // 只快取成功的響應
                        if (!response || response.status !== 200 || response.type === 'error') {
                            return response;
                        }

                        // 複製響應（因為 response 只能使用一次）
                        const responseToCache = response.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    })
                    .catch(() => {
                        // 網路失敗，返回離線頁面
                        console.log('[SW] 網路失敗，返回離線頁面');
                        return caches.match('/offline.html');
                    });
            })
    );
});

// 監聽消息（用於手動更新快取）
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
