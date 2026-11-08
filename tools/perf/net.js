/* A shaping proxy for speed tests: every byte the browser sends or receives goes through one pipe with a fixed
   round trip and bandwidth, so Chromium and WebKit see the same network, service worker requests included
   (DevTools network emulation skips those, and WebKit has none).
   startNet({ rtt: 150, down: 9e6, up: 1.5e6 }) -> { port, front(port), bytes(), close() }   (rtt in ms, bandwidth in bits/s)
   port is a forward proxy for the browser (https sites); front(8844) opens a shaped 127.0.0.1 port in front of a local server,
   since browsers send loopback straight past a proxy, and the app must stay on 127.0.0.1 for its service worker. */
const http = require('http'), net = require('net');

/* a pacer hands out the time each chunk arrives: one way delay plus its turn on the shared line */
function pacer(bps, delay) {
  let free = 0;
  return n => { const now = Date.now(), at = Math.max(now + delay, free); free = Math.max(free, now) + n * 8000 / bps; return at; };
}
function startNet(o) {
  o = Object.assign({ rtt: 150, down: 9e6, up: 1.5e6 }, o);
  const downP = pacer(o.down, o.rtt / 2), upP = pacer(o.up, o.rtt / 2); let got = 0;
  /* each connection keeps its chunks in a queue and delivers them strictly in order (timers alone can fire out of order on a busy machine) */
  const shape = (from, to, p, count) => {
    const q = []; let timer = null;
    const pump = () => { timer = null; while (q.length && q[0].at <= Date.now()) { const c = q.shift(); if (c.end) { to.end(); continue; } if (count) got += c.b.length; if (!to.destroyed) to.write(c.b); } if (q.length) timer = setTimeout(pump, q[0].at - Date.now()); };
    const push = c => { q.push(c); if (!timer) timer = setTimeout(pump, Math.max(0, q[0].at - Date.now())); };
    from.on('data', b => push({ at: p(b.length), b })); from.on('end', () => push({ at: p(0), end: true })); from.on('error', () => to.destroy());
  };
  const srv = http.createServer((req, res) => { /* plain http (the local server) */
    const u = new URL(req.url);
    const up = http.request({ host: u.hostname, port: u.port || 80, path: u.pathname + u.search, method: req.method, headers: req.headers }, r => { setTimeout(() => { res.writeHead(r.statusCode, r.headers); shape(r, res, downP, true); }, upP(0) - Date.now()); });
    up.on('error', () => { res.writeHead(502); res.end(); });
    shape(req, up, upP, false);
  });
  srv.on('connect', (req, sock, head) => { /* https tunnels (the live site, Google, fonts) */
    const [host, port] = req.url.split(':');
    const up = net.connect(+port || 443, host, () => { sock.write('HTTP/1.1 200 OK\r\n\r\n'); if (head.length) up.write(head); shape(sock, up, upP, false); shape(up, sock, downP, true); });
    up.on('error', () => sock.destroy()); sock.on('error', () => up.destroy());
  });
  srv.keepAliveTimeout = 30000;
  const fronts = [];
  const front = target => new Promise(r => { const f = net.createServer(sock => { const up = net.connect(target, '127.0.0.1', () => { shape(sock, up, upP, false); shape(up, sock, downP, true); }); up.on('error', () => sock.destroy()); sock.on('error', () => up.destroy()); }); fronts.push(f); f.listen(0, '127.0.0.1', () => r(f.address().port)); });
  const close = () => Promise.all([srv].concat(fronts).map(x => new Promise(c => { x.closeAllConnections && x.closeAllConnections(); x.close(() => c()); setTimeout(c, 500); })));
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r({ port: srv.address().port, front, bytes: () => got, close })));
}
module.exports = { startNet };
