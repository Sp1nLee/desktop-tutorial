// Service Worker — 2026世界杯看板 离线缓存
const CACHE_NAME = 'worldcup2026-v3';
const STATIC_ASSETS = [
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
  console.log('[SW] 正在安装 v2...');
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

// ============ Activate: 清理旧版本缓存 + 通知客户端刷新 ============
self.addEventListener('activate', (event) => {
  console.log('[SW] 激活 v2');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => {
          console.log('[SW] 清理旧缓存:', key);
          return caches.delete(key);
        })
      );
    }).then(() => {
      // 接管所有客户端，通知刷新
      return self.clients.claim().then(() => {
        // 广播消息给所有页面：SW 已更新
        return self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: 'SW_UPDATED', version: 'v2' });
          });
        });
      });
    })
  );
});

// ============ Message: 处理来自页面的消息 ============
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] 收到 SKIP_WAITING 消息，立即激活');
    self.skipWaiting();
  }
});

// ============ Fetch: 缓存策略 ============
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isDataFile = DATA_PATTERNS.some((p) => p.test(url.pathname));
  const isHtml = event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/');

  // 对于 HTML 页面：Network-first（确保用户始终看到最新版本），失败回退缓存
  if (isHtml) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            // 离线且无缓存 → 返回 index.html 的缓存副本
            return caches.match('./index.html');
          });
        })
    );
    return;
  }

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
