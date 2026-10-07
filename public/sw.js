/* chat PWA service worker */

const CACHE = 'chat-shell-13addsd';
const PRECACHE = [
  '/',
  '/index.html',
  '/login.html',
  '/manifest.webmanifest',
  '/assets/script/auth-gate.js',
  '/assets/script/boot-offline.js',
  '/assets/script/offline-store.js',
  '/assets/script/pwa-register.js',
  '/assets/style/style.css',
  '/assets/style/home.css',
  '/assets/style/login.css',
  '/assets/style/presence.css',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => Promise.all(
    PRECACHE.map(url => cache.add(url).catch(() => undefined))
  )));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

function isApi(pathname) {
  return pathname.startsWith('/auth') || pathname.startsWith('/messages') ||
    pathname.startsWith('/conversation') || pathname.startsWith('/users') ||
    pathname.startsWith('/push') || pathname.startsWith('/uploads') ||
    pathname.startsWith('/socket.io') || pathname.startsWith('/calls');
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || isApi(url.pathname)) return;

  if (req.mode === 'navigate') {
    event.respondWith(navigate(req));
  } else {
    event.respondWith(asset(req));
  }
});

async function navigate(req) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(CACHE);
      // Cache the exact navigation URL. Never overwrite /index.html with another route.
      await cache.put(req, res.clone());
    }
    return res;
  } catch {
    const cache = await caches.open(CACHE);
    return (await cache.match(req)) || (await cache.match('/index.html')) || offlinePage();
  }
}

async function asset(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok) await cache.put(req, res.clone());
    return res;
  } catch {
    return new Response('', { status: 503, statusText: 'Offline asset missing' });
  }
}

self.addEventListener('sync', event => {
  if (event.tag !== 'chat-outbox-sync') return;
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach(client => client.postMessage({ type: 'CHAT_OUTBOX_SYNC' }));
  })());
});

self.addEventListener('push', event => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { body: event.data.text() }; }
  const title = data.title || 'Chat';
  const options = {
    body: data.body || 'New message',
    icon: '/assets/static/icons/icon-192.png',
    badge: '/assets/static/icons/icon-192.png',
    tag: data.tag || 'chat-message',
    data: { url: data.url || '/index.html', conversationId: data.conversationId || null },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || '/index.html';
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client && target) await client.navigate(target);
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});

function offlinePage() {
  return new Response('<!doctype html><meta charset=utf-8><title>Offline</title><body style="font-family:sans-serif;padding:24px"><h1>Offline</h1><p>Open the app once online to cache the shell.</p></body>', {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
