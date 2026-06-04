// Service Worker — 2026世界杯看板 离线缓存
const CACHE_NAME = 'worldcup2026-v1';
const STATIC_ASSETS = [
  './index.html',
  './data/bundle.js',
  './js/echarts.min.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png'
];

const DATA_PATTERNS = [
  /^\.\/data\//,
];

// ============ Install: 预缓存所有静态资源 ============
self.addEventListener('install', (event) => {
  console.log('[SW] 正在安装 v1...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] 预缓存静态资源...');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      console.log('[SW] 预缓存完成，强制激活');
      return self.skipWaiting();
    })
  );
});

// ============ Activate: 清理旧版本缓存 ============
self.addEventListener('activate', (event) => {
  console.log('[SW] 激活 v1');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => {
          console.log('[SW] 清理旧缓存:', key);
          return caches.delete(key);
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// ============ Fetch: 缓存策略 ============
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isDataFile = DATA_PATTERNS.some((p) => p.test(url.pathname));

  // 对于数据 JSON 文件：Network-first（获取最新数据），失败回退缓存
  if (isDataFile) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // 网络成功 → 更新缓存
          if (response.ok) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
          }
          return response;
        })
        .catch(() => {
          // 网络失败 → 读缓存
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            // 实在没有，返回空数据
            return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
          });
        })
    );
    return;
  }

  // 对于静态资源：Cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      // 缓存未命中 → 网络
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        }
        return response;
      });
    })
  );
});
