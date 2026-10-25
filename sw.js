/* Network-first for app files so updates arrive; cache as offline fallback. Pyodide comes from the CDN and is cached by the browser. */
const CACHE = 'data-architect-1.3.0';
const CORE = ['./', 'index.html', 'css/app.css?v=1.3.0', 'js/plan.js?v=1.3.0', 'js/app.js?v=1.3.0', 'js/py.js?v=1.3.0', 'js/worker.js', 'py/minispark.py', 'py/runtime.py', 'data/bank/dsa.json', 'data/bank/sql.json', 'data/bank/spark.json', 'data/bank/py.json', 'data/projects.json', 'data/design.json', 'data/git.json', 'data/news.json', 'data/extensions.json', 'manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.endsWith('version.json')) return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request).then(m => m || caches.match('index.html'))));
});
