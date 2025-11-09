// ==================== 路徑配置 ====================
const BASE_PATH = '/GATE';
const VERSION = '1.0.0';
const CACHE_NAME = `ai-gate-static-v${VERSION}`;
const DYNAMIC_CACHE = `ai-gate-dynamic-v${VERSION}`;

const STATIC_ASSETS = [
    `${BASE_PATH}/`,
    `${BASE_PATH}/index.html`,
    `${BASE_PATH}/manifest.json`,
    `${BASE_PATH}/R0.png`
];

const ICON_ASSETS = [
    `${BASE_PATH}/icons/icon-72x72.png`,
    `${BASE_PATH}/icons/icon-96x96.png`,
    `${BASE_PATH}/icons/icon-128x128.png`,
    `${BASE_PATH}/icons/icon-144x144.png`,
    `${BASE_PATH}/icons/icon-152x152.png`,
    `${BASE_PATH}/icons/icon-192x192.png`,
    `${BASE_PATH}/icons/icon-384x384.png`,
    `${BASE_PATH}/icons/icon-512x512.png`,
    `${BASE_PATH}/icons/apple-touch-icon.png`,
    `${BASE_PATH}/icons/favicon-32x32.png`,
    `${BASE_PATH}/icons/favicon-16x16.png`
];

const APP_ICONS = [
    `${BASE_PATH}/app1.png`,
    `${BASE_PATH}/app2.png`,
    `${BASE_PATH}/app3.png`,
    `${BASE_PATH}/app4.png`,
    `${BASE_PATH}/app5.png`,
    `${BASE_PATH}/app7.png`,
    `${BASE_PATH}/app8.png`,
    `${BASE_PATH}/app9.png`,
    `${BASE_PATH}/app10.png`
];

// ==================== Install 事件 ====================
self.addEventListener('install', (event) => {
    console.log('🔧 Service Worker 安裝中...');

    event.waitUntil(
        Promise.all([
            caches.open(CACHE_NAME).then(cache => {
                console.log('📦 快取靜態資源...');
                return cache.addAll([...STATIC_ASSETS, ...ICON_ASSETS]);
            }),
            caches.open(DYNAMIC_CACHE).then(cache => {
                console.log('📦 快取應用圖標...');
                return cache.addAll(APP_ICONS.filter(icon => icon));
            })
        ]).then(() => {
            console.log('✅ Service Worker 安裝完成');
            return self.skipWaiting();
        }).catch(error => {
            console.error('❌ 快取失敗:', error);
        })
    );
});

// ==================== Activate 事件 ====================
self.addEventListener('activate', (event) => {
    console.log('🔄 Service Worker 啟動中...');

    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName.includes(`v${VERSION}`)) {
                        return null;
                    }
                    console.log('🗑️ 刪除舊快取:', cacheName);
                    return caches.delete(cacheName);
                })
            );
        }).then(() => {
            console.log('✅ Service Worker 已啟動');
            return self.clients.claim();
        })
    );
});

// ==================== Fetch 事件 ====================
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    if (event.request.url.startsWith('chrome-extension://')) return;

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }

                return fetch(event.request)
                    .then(fetchResponse => {
                        if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type === 'error') {
                            return fetchResponse;
                        }

                        const responseToCache = fetchResponse.clone();
                        caches.open(DYNAMIC_CACHE)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });

                        return fetchResponse;
                    })
                    .catch(() => {
                        // 離線時返回快取的資源
                        return caches.match(`${BASE_PATH}/index.html`);
                    });
            })
    );
});

// ==================== 消息通信 ====================
self.addEventListener('message', (event) => {
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

console.log(`🚀 Service Worker v${VERSION} 已載入`);
