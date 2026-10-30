/* Network-first for app files so updates arrive; cache as offline fallback. Module files are cached at install; the Python runtime from the CDN is kept once fetched. */
const CACHE = 'data-architect-1.13.0';
/* every module file, so lessons, quizzes and the plan work offline from the first visit (tools/validate.py checks this list) */
const PROGRAM = ['a01', 'a02', 'a03', 'a04', 'a05', 'c01', 'c02', 'c03', 'c04', 'c05', 'c06', 'c07', 'c08', 'c09', 'c10', 'c11', 'c12', 'd01', 'j01', 'm01', 'm02', 'm03', 'p01', 'p02', 'p03', 'p04', 'p05', 'p06', 'r01', 's00', 's01', 's02', 's03', 's04', 's05', 's06', 's07', 's08', 's09', 's10', 's11', 's12'];
const CORE = ['./', 'index.html', 'js/term.js?v=1.13.0', 'css/app.css?v=1.13.0', 'js/plan.js?v=1.13.0', 'js/coach.js?v=1.13.0', 'js/grader.js?v=1.13.0', 'js/cc.js?v=1.13.0', 'js/app.js?v=1.13.0', 'js/py.js?v=1.13.0', 'js/worker.js', 'py/minilake.py', 'py/minispark.py', 'py/runtime.py', 'data/bank/dsa.json', 'data/bank/sql.json', 'data/bank/spark.json', 'data/bank/py.json', 'data/projects.json', 'data/design.json', 'data/git.json', 'data/news.json', 'data/extensions.json', 'manifest.webmanifest', 'js/vendor/marked.min.js?v=12.0.2'].concat(PROGRAM.map(m => 'data/program/' + m + '.txt'));
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== RUNTIME && k !== VMCACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });
/* tapping the update notification opens (or focuses) the app */
self.addEventListener('notificationclick', e => { e.notification.close(); e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => { const w = ws.find(x => 'focus' in x); return w ? w.focus() : self.clients.openWindow((e.notification.data && e.notification.data.url) || './'); })); });
/* the Python runtime and libraries come from a CDN at fixed versions: keep them once fetched, so coding works offline */
const RUNTIME = 'data-architect-runtime-v1', VMCACHE = 'data-architect-vm3';
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method === 'GET' && u.hostname === 'cdn.jsdelivr.net' && /\/(pyodide\/v[\d.]+|npm\/marked@[\d.]+)\//.test(u.pathname)) {
    e.respondWith(caches.open(RUNTIME).then(c => c.match(e.request).then(m => m || fetch(e.request).then(r => { if (r.ok || r.type === 'opaque') c.put(e.request, r.clone()); return r; }))));
    return;
  }
  /* the in-app terminal (vm/): about 30 MB that changes only when VMV in js/term.js is bumped, so keep it across app updates */
  if (e.request.method === 'GET' && u.origin === location.origin && /\/vm\//.test(u.pathname)) {
    e.respondWith(caches.open(VMCACHE).then(c => c.match(e.request).then(m => m || fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }))));
    return;
  }
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.endsWith('version.json')) return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request).then(m => m || (e.request.mode === 'navigate' ? caches.match('index.html') : new Response('', { status: 503, statusText: 'offline' })))));
});
