// 🔥 版本控制 - 修改版本號會清除舊快取
const VERSION = '1.0.0';
const CACHE_NAME = `ai-gate-static-v${VERSION}`;
const DYNAMIC_CACHE = `ai-gate-dynamic-v${VERSION}`;
const OFFLINE_CACHE = `ai-gate-offline-v${VERSION}`;

// 🔥 靜態資源 - 安裝時立即快取
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/offline.html',
    '/manifest.json',
    '/R0.png'
];

// 🔥 圖標資源 - 安裝時快取
const ICON_ASSETS = [
    '/icons/icon-72x72.png',
    '/icons/icon-96x96.png',
    '/icons/icon-128x128.png',
    '/icons/icon-144x144.png',
    '/icons/icon-152x152.png',
    '/icons/icon-192x192.png',
    '/icons/icon-384x384.png',
    '/icons/icon-512x512.png',
    '/icons/apple-touch-icon.png',
    '/icons/favicon-32x32.png',
    '/icons/favicon-16x16.png'
];

// 🔥 應用圖標 - 動態快取
const APP_ICONS = [
    '/app1.png',
    '/app2.png',
    '/app3.png',
    '/app4.png',
    '/app5.png',
    '/app6.png',
    '/app7.png',
    '/app8.png',
    '/app9.png',
    '/app10.png'
];

// 🔥 字體資源 - 動態快取
const FONT_URLS = [
    'https://fonts.googleapis.com/css2',
    'https://fonts.gstatic.com'
];

// 🔥 快取大小限制
const MAX_DYNAMIC_CACHE_SIZE = 50;
const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 天


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
    console.log('🔄 Service Worker 啟動中...');

    event.waitUntil(
        Promise.all([
            // 🔥 清理舊版本快取
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        // 保留當前版本的快取
                        if (cacheName.includes(`v${VERSION}`)) {
                            return null;
                        }
                        console.log('🗑️ 刪除舊快取:', cacheName);
                        return caches.delete(cacheName);
                    })
                );
            }),

            // 🔥 清理過期的動態快取
            caches.open(DYNAMIC_CACHE).then(cache => {
                return cache.keys().then(requests => {
                    const now = Date.now();
                    return Promise.all(
                        requests.map(request => {
                            return cache.match(request).then(response => {
                                if (!response) return null;

                                const cachedDate = new Date(response.headers.get('date')).getTime();
                                const age = now - cachedDate;

                                // 刪除超過 7 天的快取
                                if (age > MAX_CACHE_AGE) {
                                    console.log('🗑️ 刪除過期快取:', request.url);
                                    return cache.delete(request);
                                }
                            });
                        })
                    );
                });
            }),

            // 🔥 限制動態快取大小
            limitCacheSize(DYNAMIC_CACHE, MAX_DYNAMIC_CACHE_SIZE)
        ]).then(() => {
            console.log('✅ Service Worker 已啟動並完成清理');
            return self.clients.claim();
        })
    );
});

// 🔥 快取大小限制函數
function limitCacheSize(cacheName, maxSize) {
    return caches.open(cacheName).then(cache => {
        return cache.keys().then(keys => {
            if (keys.length > maxSize) {
                console.log(`🗑️ 快取超過限制 (${keys.length}/${maxSize})，刪除最舊的項目`);
                return cache.delete(keys[0]).then(() => {
                    return limitCacheSize(cacheName, maxSize);
                });
            }
        });
    });
}


// 攔截請求 - Cache First 策略
self.addEventListener('fetch', (event) => {
    // 跳過非 GET 請求
    if (event.request.method !== 'GET') return;

    // 跳過 Chrome Extension 請求
    if (event.request.url.startsWith('chrome-extension://')) return;

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }

                return fetch(event.request)
                    .then(fetchResponse => {
                        // 檢查是否為有效回應
                        if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type === 'error') {
                            return fetchResponse;
                        }

                        // 動態快取新資源
                        const responseToCache = fetchResponse.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });

                        return fetchResponse;
                    })
                    .catch(() => {
                        // 🔥 增強離線處理
                        // 如果是導航請求（頁面請求），返回離線頁面
                        if (event.request.mode === 'navigate') {
                            return caches.match('/offline.html');
                        }

                        // 如果是圖片請求，返回預設圖片
                        if (event.request.destination === 'image') {
                            return caches.match('/icons/icon-192x192.png');
                        }

                        // 其他請求返回離線頁面
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
// ==================== 🔥 步驟 10：後台同步和推送通知 ====================

// 🔥 後台同步 - 處理離線時的操作
self.addEventListener('sync', (event) => {
    console.log('🔄 後台同步觸發:', event.tag);

    if (event.tag === 'sync-data') {
        event.waitUntil(syncData());
    }
});

async function syncData() {
    try {
        console.log('📡 開始同步數據...');
        
        // 這裡可以添加需要同步的數據邏輯
        // 例如：上傳離線時收集的數據
        
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'SYNC_COMPLETE',
                message: '數據同步完成'
            });
        });

        console.log('✅ 數據同步成功');
    } catch (error) {
        console.error('❌ 數據同步失敗:', error);
        throw error;
    }
}

// 🔥 推送通知 - 接收推送消息
self.addEventListener('push', (event) => {
    console.log('📬 收到推送通知');

    let notificationData = {
        title: 'AI-GATE 通知',
        body: '您有新的消息',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-96x96.png',
        tag: 'ai-gate-notification',
        requireInteraction: false,
        data: {
            url: '/'
        }
    };

    // 如果推送包含數據，使用推送的數據
    if (event.data) {
        try {
            const pushData = event.data.json();
            notificationData = {
                ...notificationData,
                ...pushData
            };
        } catch (e) {
            notificationData.body = event.data.text();
        }
    }

    event.waitUntil(
        self.registration.showNotification(notificationData.title, notificationData)
    );
});

// 🔥 通知點擊 - 處理用戶點擊通知
self.addEventListener('notificationclick', (event) => {
    console.log('👆 通知被點擊');

    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clientList => {
                // 如果已有窗口打開，聚焦到該窗口
                for (let client of clientList) {
                    if (client.url === urlToOpen && 'focus' in client) {
                        return client.focus();
                    }
                }
                // 否則打開新窗口
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// 🔥 消息通信 - 與主頁面通信
self.addEventListener('message', (event) => {
    console.log('📨 收到消息:', event.data);

    if (event.data.type === 'SKIP_WAITING') {
        // 立即激活新版本
        self.skipWaiting();
    }

    if (event.data.type === 'GET_VERSION') {
        // 返回當前版本
        event.ports[0].postMessage({
            type: 'VERSION',
            version: VERSION
        });
    }

    if (event.data.type === 'CLEAR_CACHE') {
        // 清除所有快取
        event.waitUntil(
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        console.log('🗑️ 清除快取:', cacheName);
                        return caches.delete(cacheName);
                    })
                );
            }).then(() => {
                event.ports[0].postMessage({
                    type: 'CACHE_CLEARED',
                    success: true
                });
            })
        );
    }
});

// 🔥 性能監控 - 記錄快取命中率
let cacheHits = 0;
let cacheMisses = 0;

self.addEventListener('fetch', (event) => {
    const startTime = Date.now();

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    cacheHits++;
                    const loadTime = Date.now() - startTime;
                    console.log(`✅ 快取命中 (${loadTime}ms):`, event.request.url);
                    return response;
                }

                cacheMisses++;
                console.log('❌ 快取未命中:', event.request.url);

                return fetch(event.request)
                    .then(fetchResponse => {
                        const loadTime = Date.now() - startTime;
                        console.log(`🌐 網路載入 (${loadTime}ms):`, event.request.url);

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
                        if (event.request.mode === 'navigate') {
                            return caches.match('/offline.html');
                        }
                        if (event.request.destination === 'image') {
                            return caches.match('/icons/icon-192x192.png');
                        }
                        return caches.match('/offline.html');
                    });
            })
    );
});

// 🔥 定期報告快取統計
setInterval(() => {
    const total = cacheHits + cacheMisses;
    if (total > 0) {
        const hitRate = ((cacheHits / total) * 100).toFixed(2);
        console.log(`📊 快取統計 - 命中率: ${hitRate}% (${cacheHits}/${total})`);
    }
}, 60000); // 每分鐘報告一次

// 🔥 錯誤處理
self.addEventListener('error', (event) => {
    console.error('❌ Service Worker 錯誤:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('❌ 未處理的 Promise 拒絕:', event.reason);
});

console.log(`🚀 Service Worker v${VERSION} 已載入`);
