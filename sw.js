'use strict';
/* Wave — service worker. Кэширует оболочку приложения; музыку и API Jamendo не трогает. */
const VER = 'wave-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png'
];
const SWR_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com', 'telegram.org'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VER).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VER).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* Переходы по страницам: сеть, при ошибке — кэшированный index.html */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(r => { const copy = r.clone(); caches.open(VER).then(c => c.put('./index.html', copy)); return r; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  /* Свои файлы: сначала кэш, затем сеть */
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(r => {
        if (r.ok) { const copy = r.clone(); caches.open(VER).then(c => c.put(req, copy)); }
        return r;
      }))
    );
    return;
  }

  /* Шрифты и библиотеки: отдаём из кэша и обновляем в фоне */
  if (SWR_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.open(VER).then(c => c.match(req).then(hit => {
        const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => hit);
        return hit || net;
      }))
    );
  }
  /* Всё остальное (Jamendo API и аудио) идёт напрямую, без кэша */
});
