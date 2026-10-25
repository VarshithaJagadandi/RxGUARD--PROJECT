const V = 'rxguard-v2', FILES = ['./', 'index.html', 'css/style.css', 'js/data.js', 'js/engine.js', 'js/i18n.js', 'js/i18n.more.js', 'js/app.js', 'assets/logo.svg', 'favicon.svg', 'manifest.webmanifest'];
self.addEventListener('install', e => e.waitUntil(caches.open(V).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));
