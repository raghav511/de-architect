/* Animated step-through figures for chapters. A chapter asks for one with <div data-fig="name"></div>;
   mdEl() calls FIGS.mount(), which swaps it for a stepper (‹ step › Play). Each step is an SVG and one caption. */
const FIGS = (() => {
  const C = { ink: '#12202F', mu: '#4E5B66', ln: '#C9CFC4', bg: '#fff', te: '#0B7A67', teL: '#DDF1EA', bl: '#2B59C3', blL: '#E4ECFA', am: '#E08A1E', amL: '#FFF7EA', amD: '#7A3E05', re: '#B4432A', reL: '#FDF0EC', pl: '#7A3E9D', plL: '#EFE4F5' };
  const X = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const T = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-size="${o.fs || 13}" font-weight="${o.b ? 700 : 500}" fill="${o.c || C.ink}" text-anchor="${o.a || 'middle'}" font-family="${o.mono ? 'JetBrains Mono,Menlo,monospace' : 'Source Sans 3,system-ui,sans-serif'}">${X(s)}</text>`;
  /* a box with centred text; text too wide for the box wraps onto two lines (and the font shrinks if it still does not fit) */
  const fit = (s, w, o) => { const fs = o.fs || 13, k = o.mono ? .6 : .5; if (String(s).length * fs * k <= w - 14) return [[s], fs]; const m = s.length / 2; let at = -1; for (let d = 0; d < m; d++) { if (s[Math.floor(m + d)] === ' ') { at = Math.floor(m + d); break; } if (s[Math.floor(m - d)] === ' ') { at = Math.floor(m - d); break; } } if (at < 0) return [[s], fs]; const ls = [s.slice(0, at), s.slice(at + 1)], long = Math.max(...ls.map(l => l.length)); return [ls, Math.min(fs, (w - 14) / (long * k))]; };
  const B = (x, y, w, h, s, o = {}) => { let r = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.r == null ? 7 : o.r}" fill="${o.f || C.bg}" stroke="${o.s || C.ln}" stroke-width="${o.sw || 1.5}"${o.dash ? ' stroke-dasharray="5 4"' : ''}/>`; if (s) { const [ls, fs] = fit(String(s), w, o), lh = fs * 1.25; ls.forEach((l, i) => { r += T(x + w / 2, y + h / 2 + 4.5 + (i - (ls.length - 1) / 2) * lh, l, Object.assign({}, o, { fs: +fs.toFixed(1) })); }); } return r; };
  const A = (x1, y1, x2, y2, c = C.mu, o = {}) => { const a = Math.atan2(y2 - y1, x2 - x1), h = 8; return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${o.w || 2}"${o.dash ? ' stroke-dasharray="5 4"' : ''}/><path d="M${x2} ${y2} L${x2 - h * Math.cos(a - .45)} ${y2 - h * Math.sin(a - .45)} L${x2 - h * Math.cos(a + .45)} ${y2 - h * Math.sin(a + .45)}Z" fill="${c}"/>`; };
  const W = 640, H = 270;

  /* 1. Isolation: the lost update, then the fix with a row lock */
  const iso = () => {
    const ev = [[0, 'BEGIN · read seat 12A → free', C.bl], [1, 'BEGIN · read seat 12A → free', C.pl], [0, 'set booked_by = Ann · COMMIT', C.bl], [1, 'set booked_by = Raj · COMMIT', C.re]];
    const fx = [[0, 'BEGIN · SELECT … FOR UPDATE → free (row locked)', C.bl], [1, 'BEGIN · SELECT … FOR UPDATE → waits…', C.am], [0, 'set booked_by = Ann · COMMIT (lock released)', C.bl], [1, 'now reads booked_by = Ann → stop, seat taken', C.te]];
    const draw = (list, n, seat, warn) => {
      let s = T(16, 24, 'Session 1 (Ann)', { a: 'start', b: 1, c: C.bl }) + T(16, 150, 'Session 2 (Raj)', { a: 'start', b: 1, c: C.pl });
      s += `<line x1="16" y1="122" x2="452" y2="122" stroke="${C.ln}" stroke-dasharray="3 4"/>` + T(452, 116, 'time →', { a: 'end', c: C.mu, fs: 12 });
      list.slice(0, n).forEach((e, i) => { const y = e[0] ? 162 : 36; s += B(16 + i * 28, y + (i > 1 ? 40 : 0), 330, 30, e[1], { s: e[2], f: i === n - 1 ? (e[2] === C.re ? C.reL : e[2] === C.te ? C.teL : C.amL) : C.bg, fs: 12.5, a: 'middle' }); });
      s += B(480, 80, 144, 78, '', { f: seat[1], s: seat[2], sw: 2 }) + T(552, 104, 'row: seat 12A', { b: 1, fs: 12.5 }) + T(552, 128, seat[0], { mono: 1, fs: 12.5, c: seat[2] });
      if (warn) s += B(470, 176, 164, 74, '', { f: warn[1], s: warn[2] }) + T(552, 200, warn[0], { b: 1, fs: 12.5, c: warn[2] }) + T(552, 222, warn[3], { fs: 12 }) + T(552, 240, warn[4] || '', { fs: 12 });
      return s;
    };
    const free = ['free', C.teL, C.te], ann = ['Ann', C.blL, C.bl], raj = ['Raj', C.reL, C.re];
    return { title: 'Two bookings, one seat (READ COMMITTED)', steps: [
      [draw(ev, 0, free), 'Ann and Raj try to book seat 12A at the same moment. Each session runs: read the seat; if it is free, write my name; commit.'],
      [draw(ev, 1, free), 'Session 1 reads the seat. It is free.'],
      [draw(ev, 2, free), 'Session 2 reads it too. Session 1 has not committed, so Session 2 also sees free. READ COMMITTED allows this.'],
      [draw(ev, 3, ann), 'Session 1 writes Ann and commits.'],
      [draw(ev, 4, raj, ['Lost update', C.reL, C.re, 'Raj overwrote Ann.', 'Both got a ticket.']), 'Session 2 writes Raj and commits. Ann\'s booking is silently gone: a lost update. Both sessions did nothing wrong on their own.'],
      [draw(fx, 2, free, ['Fix 1: lock the row', C.amL, C.amD, 'FOR UPDATE makes', 'session 2 wait.']), 'Fix 1: read with SELECT … FOR UPDATE. Session 1 takes a row lock; Session 2\'s locking read waits for it.'],
      [draw(fx, 4, ann, ['One booking', C.teL, C.te, 'Raj sees the seat', 'is taken.']), 'Session 1 commits and the lock is released. Session 2 now reads Ann and stops. Other fixes: one UPDATE … WHERE booked_by IS NULL (check the row count), a unique constraint, or SERIALIZABLE with a retry.']
    ] };
  };

  /* 2. Pages: rows live in pages; indexes point at them; row store vs column store */
  const pages = () => {
    const rows = [[1, 3, 9, 14], [7, 2, 11, 5], [20, 16, 8, 4]];
    const heap = (hp, hr) => rows.map((p, i) => B(250 + i * 128, 40, 116, 150, '', { f: hp === i ? C.amL : C.bg, s: hp === i ? C.am : C.ln, sw: hp === i ? 2.5 : 1.5 }) + T(308 + i * 128, 60, 'page ' + i + ' · 8 KB', { b: 1, fs: 12 }) + p.map((id, k) => B(260 + i * 128, 70 + k * 29, 96, 23, 'id ' + id + ' · …', { fs: 11.5, mono: 1, f: hr && hr[0] === i && hr[1] === k ? C.am : C.soft || '#F8F9F5', c: hr && hr[0] === i && hr[1] === k ? '#fff' : C.ink })).join('')).join('');
    const idx = hl => { const keys = [[1, 0, 0], [5, 1, 3], [7, 1, 0], [9, 0, 2], [14, 0, 3]]; return B(16, 40, 200, 190, '', { s: C.bl }) + T(116, 60, 'index on id (sorted)', { b: 1, fs: 12, c: C.bl }) + keys.map((k, i) => B(28, 70 + i * 30, 176, 24, k[0] + ' → page ' + k[1] + ', slot ' + k[2], { fs: 11.5, mono: 1, f: hl === k[0] ? C.bl : C.blL, s: C.bl, c: hl === k[0] ? '#fff' : C.ink })).join(''); };
    const cols = () => { let s = T(160, 30, 'Row store: a row\'s columns together', { b: 1 }) + T(480, 30, 'Column store: a column\'s values together', { b: 1 });
      [['1', 'Pune', '250'], ['2', 'Goa', '90'], ['3', 'Pune', '410']].forEach((r, i) => { s += B(40, 50 + i * 40, 240, 30, 'id ' + r[0] + ' | ' + r[1] + ' | amount ' + r[2], { mono: 1, fs: 12, f: C.amL, s: C.am }); });
      [['id', '1 2 3', C.bg], ['city', 'Pune Goa Pune', C.bg], ['amount', '250 90 410', C.teL]].forEach((c, i) => { s += B(360, 50 + i * 40, 240, 30, c[0] + ': ' + c[1], { mono: 1, fs: 12, f: c[2], s: c[2] === C.teL ? C.te : C.ln, sw: c[2] === C.teL ? 2.5 : 1.5 }); });
      return s + T(160, 200, 'SUM(amount) reads every page of every row', { fs: 12.5, c: C.amD }) + T(480, 200, 'SUM(amount) reads only the amount column,', { fs: 12.5, c: C.te }) + T(480, 218, 'compressed well because values are alike', { fs: 12.5, c: C.te }) + T(320, 252, 'OLTP (one order at a time) likes rows · analytics (sum over millions) likes columns', { fs: 12.5, c: C.mu }); };
    return { title: 'Where a row actually lives', steps: [
      [heap(), 'A table on disk is a file of fixed-size pages (8 KB in Postgres, 16 KB in MySQL). Each page holds many rows. In Postgres the main table file is called the heap.'],
      [idx() + heap(), 'An index is a separate structure, kept sorted by its key. Each entry says where the row is: which page and which slot.'],
      [idx(7) + heap(), 'WHERE id = 7: the database finds 7 in the index, which says page 1, slot 0.'],
      [idx(7) + heap(1, [1, 0]) + A(204, 145, 376, 80, C.am), 'To return that one row it reads all of page 1. Disks and memory work in pages, so reading one row costs a whole page. That is why "how many pages?" is the real cost question.'],
      [idx() + heap() + B(16, 234, 608, 34, 'Postgres: indexes point at (page, slot). MySQL InnoDB: rows sit inside the primary key tree; secondary indexes store the primary key.', { fs: 12, f: C.plL, s: C.pl }), 'Primary versus secondary keys differ by engine. In InnoDB the table is the primary key B+tree, so a secondary index lookup does a second lookup by primary key. A big primary key makes every secondary index bigger.'],
      [cols(), 'Row versus column layout. A row store keeps a row together, good for reading or changing one order. A column store keeps each column together, good for aggregating one column over millions of rows.']
    ] };
  };

  /* 3. Scans: which pages each plan touches */
  const scans = () => {
    const pg = (on, order) => Array.from({ length: 10 }, (_, i) => B(30 + i * 60, 120, 50, 54, 'p' + i, { b: 1, f: on.includes(i) ? C.amL : C.bg, s: on.includes(i) ? C.am : C.ln, sw: on.includes(i) ? 2.5 : 1.5 }) + (order && order.includes(i) ? T(55 + i * 60, 192, '#' + (order.indexOf(i) + 1), { fs: 12, b: 1, c: C.amD }) : '')).join('') + T(30, 110, 'table pages (heap)', { c: C.mu, fs: 12, a: 'start' });
    const ix = (s, c) => B(150, 24, 340, 44, s, { f: c || C.blL, s: C.bl, fs: 12.5 });
    const note = (s, c) => B(30, 212, 580, 40, s, { fs: 12.5, f: c ? c[0] : C.soft || '#F8F9F5', s: c ? c[1] : C.ln });
    return { title: 'How the planner reads a table', steps: [
      [pg([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) + note('Seq scan: read every page in order. Best when the query needs a large share of the rows.'), 'Sequential (table) scan: read every page from first to last and test each row. Reading in order is fast per page, so for "most of the table" this wins.'],
      [ix('index on city · city = \'Goa\' → 3 rows') + pg([7, 2, 5], [7, 2, 5]) + A(280, 68, 445, 118, C.bl) + A(310, 68, 145, 118, C.bl) + A(340, 68, 325, 118, C.bl) + note('Index scan: jump to each row through the index. Few rows → few pages. Order follows the index, not the disk.'), 'Index scan: walk the index for matching keys and fetch each row\'s page. Great for a few rows. For many rows the random page jumps cost more than a full scan.'],
      [ix('index on city · city = \'Pune\' → 3,000 rows') + pg([1, 2, 4, 5, 7, 8], [1, 2, 4, 5, 7, 8]) + note('Bitmap scan: collect page numbers from the index first, then read those pages once each, in disk order.', [C.teL, C.te]), 'Bitmap index scan: first build a list (a bitmap) of pages that contain matches, then read each page once, in disk order. The middle ground between index scan and seq scan. It can also AND or OR two indexes.'],
      [ix('index on (city, amount) · SELECT amount WHERE city = \'Goa\'', C.teL) + pg([]) + note('Index-only scan: the index already holds every column the query needs, so the table is not read (Postgres also checks the visibility map).', [C.teL, C.te]), 'Index-only scan: when every column the query asks for is in the index (key columns plus INCLUDE columns), the heap is skipped. This is why SELECT * can turn a cheap plan into an expensive one.'],
      [B(30, 30, 580, 160, '', { f: C.bg }) + T(320, 58, 'The planner estimates rows from table statistics, then picks the cheapest plan', { b: 1, fs: 13 }) + T(320, 92, 'few matching rows  →  index scan', { mono: 1, fs: 13, c: C.bl }) + T(320, 118, 'some rows  →  bitmap index scan', { mono: 1, fs: 13, c: C.te }) + T(320, 144, 'most rows  →  sequential scan', { mono: 1, fs: 13, c: C.amD }) + T(320, 172, 'EXPLAIN shows the choice; EXPLAIN ANALYZE runs it and shows real rows and time', { fs: 12.5, c: C.mu }) + note('Stale statistics give bad estimates and bad plans: run ANALYZE after big loads.'), 'Why "I have an index but it does a full scan": the planner thinks too many rows match, the statistics are stale, the column is wrapped in a function, or the types do not match. Read EXPLAIN ANALYZE and compare estimated rows with actual rows.']
    ] };
  };

  /* 4. B+tree: lookup, range scan, B-tree contrast, random keys */
  const bplus = () => {
    const leaves = [[5, 12, 18], [20, 27, 35], [40, 51, 63]];
    const tree = (o = {}) => {
      let s = B(250, 20, 140, 36, '20 | 40', { b: 1, mono: 1, f: o.root ? C.blL : C.bg, s: o.root ? C.bl : C.ln, sw: o.root ? 2.5 : 1.5 });
      leaves.forEach((l, i) => { const x = 40 + i * 205, on = (o.leaf || []).includes(i); s += `<line x1="${290 + i * 30}" y1="56" x2="${x + 80}" y2="110" stroke="${on ? C.bl : C.ln}" stroke-width="${on ? 2.5 : 1.5}"/>`;
        s += B(x, 110, 160, 40, '', { f: on ? C.blL : C.bg, s: on ? C.bl : C.ln, sw: on ? 2.5 : 1.5 }) + l.map((k, j) => T(x + 28 + j * 52, 135, k, { mono: 1, b: 1, c: (o.keys || []).includes(k) ? C.amD : C.ink, fs: 14 })).join('');
        if (i < 2) s += A(x + 160, 130, x + 205, 130, o.walk ? C.am : C.mu, { w: o.walk ? 2.5 : 1.5 }); });
      return s + T(320, 172, 'leaves hold all keys (and rows or row pointers) and link to the next leaf →', { fs: 12, c: C.mu });
    };
    const note = s => B(30, 196, 580, 56, '', { f: C.amL, s: C.am }) + s.map((l, i) => T(320, 218 + i * 20, l, { fs: 12.5 })).join('');
    return { title: 'B+tree: the index inside almost every database', steps: [
      [tree() + note(['Internal nodes hold only keys that guide the search.', 'Each node is one page, so one node can hold hundreds of keys.']), 'A B+tree. The root and internal nodes hold only separator keys. All keys sit in the leaves, which are linked left to right.'],
      [tree({ root: 1 }) + note(['Find 27: 27 ≥ 20 and < 40, so take the middle branch.', 'One page read per level.']), 'Lookup of 27 starts at the root. Comparing with the separators picks the middle child.'],
      [tree({ root: 1, leaf: [1], keys: [27] }) + note(['Found in the leaf after 2 page reads.', 'A billion rows fit in about 4 levels.']), 'The leaf has 27. The cost is the tree height, usually 3 or 4 pages even for a billion rows, and the top levels stay in memory.'],
      [tree({ root: 1, leaf: [0, 1, 2], keys: [18, 20, 27, 35, 40], walk: 1 }) + note(['Range 15–45: find 15 once, then follow leaf links until a key passes 45.', 'No climbing back up the tree.']), 'Range query 15 to 45: descend once to the first leaf, then walk the leaf links. This is why B+trees make BETWEEN, ORDER BY and range scans cheap.'],
      [B(40, 24, 260, 150, '', { s: C.pl }) + T(170, 48, 'Original B-tree', { b: 1, c: C.pl }) + T(170, 78, 'keys AND values in every node', { fs: 12.5 }) + T(170, 100, 'fewer keys per page → taller tree', { fs: 12.5 }) + T(170, 122, 'range scan jumps up and down', { fs: 12.5 }) + B(340, 24, 260, 150, '', { s: C.te }) + T(470, 48, 'B+tree', { b: 1, c: C.te }) + T(470, 78, 'values only in leaves', { fs: 12.5 }) + T(470, 100, 'more keys per page → shallower', { fs: 12.5 }) + T(470, 122, 'leaves linked for ranges', { fs: 12.5 }) + note(['Databases use B+trees. Keep keys small: a small key fits more per page.']), 'B-tree versus B+tree. Putting values only in the leaves packs more keys into each internal page, so the tree is shallower, and the leaf links make range scans sequential.'],
      [tree({ leaf: [2], keys: [63] }) + note(['Increasing keys (bigint, UUIDv7, time-ordered ids) all go to the right-most leaf: cache-friendly.', 'Random UUIDv4 keys land on random leaves: page splits, half-empty pages, more I/O.']), 'Why random UUID primary keys hurt: each insert goes to a random leaf, which may not be in memory and may have to split. Time-ordered keys append to the right edge instead.']
    ] };
  };

  /* 5. Partitioning vs sharding, and consistent hashing */
  const shard = () => {
    const cx = 200, cy = 132, R = 92, pt = d => [cx + R * Math.cos((d - 90) * Math.PI / 180), cy + R * Math.sin((d - 90) * Math.PI / 180)];
    const keys = [20, 55, 100, 140, 170, 205, 250, 290, 320, 345];
    const owner = (k, ns) => { const s = ns.slice().sort((a, b) => a[0] - b[0]); return (s.find(n => n[0] >= k) || s[0])[1]; };
    const COL = { A: C.bl, B: C.te, C: C.pl, D: C.am };
    const ring = (ns, moved) => {
      let s = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${C.ln}" stroke-width="3"/>`;
      keys.forEach(k => { const [x, y] = pt(k), o = owner(k, ns), mv = moved && moved.includes(k); s += `<circle cx="${x}" cy="${y}" r="${mv ? 8 : 6}" fill="${COL[o]}" stroke="${mv ? C.ink : '#fff'}" stroke-width="2"/>`; });
      ns.forEach(([d, n]) => { const [x, y] = pt(d); s += B(x - 16, y - 14, 32, 28, n, { b: 1, f: COL[n], s: COL[n], c: '#fff', r: 14 }); });
      return s;
    };
    const side = l => B(340, 30, 284, 200, '', { f: C.bg }) + l.map((x, i) => T(356, 58 + i * 24, x, { a: 'start', fs: 12.5, b: i === 0, c: i === 0 ? C.ink : C.ink })).join('');
    const N3 = [[60, 'A'], [180, 'B'], [300, 'C']], N4 = N3.concat([[240, 'D']]);
    const moved = keys.filter(k => owner(k, N3) !== owner(k, N4));
    return { title: 'Partitioning, sharding and consistent hashing', steps: [
      [B(30, 30, 270, 200, '', { s: C.bl }) + T(165, 54, 'Partitioning: one database', { b: 1, c: C.bl }) + ['trips_2026_01', 'trips_2026_02', 'trips_2026_03'].map((t, i) => B(60, 72 + i * 44, 210, 34, t, { mono: 1, fs: 12, f: C.blL, s: C.bl })).join('') + B(340, 30, 270, 200, '', { s: C.te }) + T(475, 54, 'Sharding: many databases', { b: 1, c: C.te }) + ['server 1: users a–h', 'server 2: users i–p', 'server 3: users q–z'].map((t, i) => B(370, 72 + i * 44, 210, 34, t, { mono: 1, fs: 12, f: C.teL, s: C.te })).join('') + T(320, 254, 'Partitioning splits a table inside one server; sharding spreads rows across servers.', { fs: 12.5, c: C.mu }), 'Partitioning splits one big table into smaller tables inside the same database, so queries and maintenance touch less data. Sharding puts different rows on different servers, so writes and storage scale out, at the cost of cross-shard queries and transactions.'],
      [ring(N3) + side(['Consistent hashing', 'Hash each server and each key', 'to a point on a ring.', 'A key belongs to the next', 'server clockwise.', 'Colours show the owner.']), 'Consistent hashing: servers and keys are hashed onto the same ring, and each key is stored on the first server clockwise from it.'],
      [ring(N4, moved) + side(['Add server D', 'Only keys between B and D', 'move to D (outlined).', moved.length + ' of ' + keys.length + ' keys moved.', 'With hash % N, going from 3 to 4', 'servers moves about 75% of keys.']), 'Adding server D moves only the keys in the arc it takes over. With plain hash(key) % N, changing N remaps most keys at once. Real systems give each server many points (virtual nodes) to even out the load.'],
      [side(['Shard only when you must', '1. Index and tune queries', '2. Add read replicas', '3. Partition big tables', '4. Then shard, by a key that', '   keeps a request on one shard']) + B(30, 30, 280, 200, '', { f: C.amL, s: C.am }) + T(170, 60, 'Sharding costs', { b: 1, c: C.amD }) + ['joins across shards', 'transactions across shards', 'resharding as data grows', 'a routing layer to keep right'].map((t, i) => T(170, 92 + i * 28, '• ' + t, { fs: 12.5 })).join(''), 'Sharding adds lasting complexity. Try indexing, replicas and partitioning first. When you do shard, pick a key (tenant id, user id) that keeps each request on one shard.']
    ] };
  };

  /* 6. Locks: deadlock and the fix */
  const dead = () => {
    const st = (a, b, l1, l2, msg, c) => {
      let s = B(250, 40, 140, 44, 'row A', { b: 1, f: a ? C.amL : C.bg, s: a ? C.am : C.ln }) + B(250, 160, 140, 44, 'row B', { b: 1, f: b ? C.amL : C.bg, s: b ? C.am : C.ln });
      s += B(30, 96, 150, 50, 'Session 1', { b: 1, f: C.blL, s: C.bl }) + B(460, 96, 150, 50, 'Session 2', { b: 1, f: C.plL, s: C.pl });
      (l1 || []).forEach(([to, wait]) => { s += A(180, 121, 250, to === 'A' ? 62 : 182, wait ? C.re : C.bl, { dash: wait, w: 2.5 }); });
      (l2 || []).forEach(([to, wait]) => { s += A(460, 121, 390, to === 'A' ? 62 : 182, wait ? C.re : C.pl, { dash: wait, w: 2.5 }); });
      return s + (msg ? B(30, 222, 580, 36, msg, { fs: 12.5, f: c ? c[0] : C.amL, s: c ? c[1] : C.am }) : '');
    };
    return { title: 'Locks and a deadlock', steps: [
      [st(0, 0, [], [], 'Shared locks (reads) can be held together; an exclusive lock (write) excludes everyone else.'), 'Two sessions each transfer money between accounts A and B. Writes take exclusive row locks, held until commit.'],
      [st(1, 0, [['A']], [], 'Session 1 updates A and holds its lock.'), 'Session 1 updates row A and locks it.'],
      [st(1, 1, [['A']], [['B']], 'Session 2 updates B and holds its lock.'), 'Session 2, going the other way, updates row B and locks it.'],
      [st(1, 1, [['A'], ['B', 1]], [['B']], 'Session 1 now needs B. It waits for Session 2.'), 'Session 1 now needs row B. B is locked, so Session 1 waits (dashed line).'],
      [st(1, 1, [['A'], ['B', 1]], [['B'], ['A', 1]], 'Session 2 needs A. Each waits for the other: a deadlock.', [C.reL, C.re]), 'Session 2 needs row A, held by Session 1. Each waits for the other forever: a deadlock.'],
      [st(1, 1, [['A'], ['B']], [], 'The database detects the cycle and aborts Session 2; Session 1 finishes. The app retries Session 2.', [C.teL, C.te]), 'The database\'s deadlock detector finds the cycle and aborts one session with an error; the other continues. Your code must catch the error and retry.'],
      [st(0, 0, [], [], 'Avoid it: lock rows in one fixed order, e.g. SELECT … WHERE id IN (A, B) ORDER BY id FOR UPDATE.', [C.teL, C.te]), 'Prevention: always lock rows in the same order (lowest id first), keep transactions short, and do slow work before BEGIN. Two-phase locking (take locks, then release all at commit) is what makes this serializable, and also what makes deadlocks possible.']
    ] };
  };

  /* 7. Replication: sync vs async, lag and failover */
  const repl = () => {
    const st = (o) => {
      let s = B(24, 104, 110, 50, 'app', { b: 1 }) + B(240, 104, 150, 50, o.pDead ? 'primary ✕' : 'primary', { b: 1, f: o.pDead ? C.reL : C.blL, s: o.pDead ? C.re : C.bl }) + B(490, 104, 130, 50, o.promoted ? 'new primary' : 'replica', { b: 1, f: C.teL, s: C.te });
      s += T(315, 176, 'last write: ' + o.p, { mono: 1, fs: 12.5 }) + T(555, 176, 'last write: ' + o.r, { mono: 1, fs: 12.5, c: o.r < o.p ? C.re : C.te });
      (o.ar || []).forEach(a => { s += A(...a); });
      return s + (o.msg ? B(24, 206, 596, 50, '', { f: o.c ? o.c[0] : C.amL, s: o.c ? o.c[1] : C.am }) + o.msg.map((l, i) => T(322, 226 + i * 20, l, { fs: 12.5 })).join('') : '') + (o.top ? T(320, 40, o.top, { b: 1, fs: 14 }) : '');
    };
    return { title: 'Replication: synchronous vs asynchronous', steps: [
      [st({ p: 103, r: 103, top: 'Synchronous', ar: [[134, 122, 238, 122, C.bl], [390, 122, 488, 122, C.bl], [488, 140, 390, 140, C.te], [238, 140, 134, 140, C.te]], msg: ['The primary waits for the replica to confirm before telling the app "committed".', 'No committed write is lost if the primary dies, but every commit is slower.'], c: [C.teL, C.te] }), 'Synchronous replication: the commit returns only after the replica has the change. Safe, but each write pays a network round trip, and a slow replica slows every write.'],
      [st({ p: 104, r: 101, top: 'Asynchronous', ar: [[134, 122, 238, 122, C.bl], [238, 140, 134, 140, C.te], [390, 122, 488, 122, C.mu, { dash: 1 }]], msg: ['The app gets "committed" from the primary alone; the replica catches up later.', 'Fast writes, but the replica lags: here it is 3 writes behind.'] }), 'Asynchronous replication: the primary answers right away and ships the change in the background. The replica lags behind by some writes or seconds.'],
      [st({ p: 104, r: 101, top: 'Read from a lagging replica', ar: [[134, 132, 488, 132, C.am]], msg: ['A user saves a new address (write 104), then reads from the replica and sees the old one.', 'Fix: read your own writes from the primary for a short time after writing.'] }), 'Lag shows up as stale reads: a user writes, then reads from a replica that has not applied the write yet and sees old data.'],
      [st({ p: 104, r: 101, pDead: 1, promoted: 1, top: 'Failover with async', msg: ['The primary crashes; the replica is promoted. Writes 102–104 never reached it.', 'They were acknowledged to users and are now lost.'], c: [C.reL, C.re] }), 'If the primary fails, a replica is promoted. With async replication, writes the old primary acknowledged but had not shipped are lost. Many teams run one synchronous replica plus async ones as the middle ground.'],
      [B(30, 30, 280, 200, '', { s: C.bl }) + T(170, 56, 'Primary / standby', { b: 1, c: C.bl }) + ['one node takes writes', 'replicas serve reads', 'simple, no write conflicts', 'failover needs care'].map((t, i) => T(170, 88 + i * 28, '• ' + t, { fs: 12.5 })).join('') + B(330, 30, 280, 200, '', { s: C.pl }) + T(470, 56, 'Multi-primary', { b: 1, c: C.pl }) + ['several nodes take writes', 'writes in many regions', 'two nodes can change one row', 'conflicts must be resolved'].map((t, i) => T(470, 88 + i * 28, '• ' + t, { fs: 12.5 })).join(''), 'Primary/standby is the common setup. Multi-primary lets several nodes accept writes, but the same row can change in two places, so you need a conflict rule (last writer wins, merge, or avoid it by routing each key to one home).']
    ] };
  };

  /* 8. WAL: commit, crash and recovery */
  const wal = () => {
    const st = o => {
      let s = B(24, 30, 120, 44, 'UPDATE id=7', { mono: 1, fs: 12 }) + B(200, 30, 200, 70, '', { f: o.memGone ? C.reL : C.bg, s: o.memGone ? C.re : C.bl, dash: o.memGone }) + T(300, 50, 'memory (buffer pool)', { b: 1, fs: 12, c: C.bl }) + (o.memGone ? T(300, 80, 'lost in the crash', { c: C.re, fs: 12.5 }) : B(225, 60, 150, 30, 'page 1 · id 7 = ' + o.mem + (o.dirty ? ' (dirty)' : ''), { mono: 1, fs: 11.5, f: o.dirty ? C.amL : C.teL, s: o.dirty ? C.am : C.te }));
      s += B(200, 140, 200, 60, '', { s: C.te }) + T(300, 160, 'WAL file on disk (append only)', { b: 1, fs: 12, c: C.te }) + (o.wal ? B(220, 168, 160, 24, o.wal, { mono: 1, fs: 11.5, f: C.teL, s: C.te }) : '');
      s += B(456, 140, 160, 60, '', { s: C.ln }) + T(536, 160, 'table file on disk', { b: 1, fs: 12 }) + B(472, 168, 128, 24, 'id 7 = ' + o.disk, { mono: 1, fs: 11.5 });
      (o.ar || []).forEach(a => { s += A(...a); });
      return s + (o.msg ? B(24, 214, 592, 44, o.msg, { fs: 12.5, f: o.c ? o.c[0] : C.amL, s: o.c ? o.c[1] : C.am }) : '');
    };
    return { title: 'Write-ahead log: how a commit survives a crash', steps: [
      [st({ mem: 'Pune', disk: 'Pune', ar: [[144, 52, 198, 66, C.bl]], msg: 'The change is made to the page in memory first. Writing the 8 KB page to disk on every commit would be slow and random.' }), 'An UPDATE changes the row in the page cached in memory (the buffer pool). The page is now dirty: newer than the copy on disk.'],
      [st({ mem: 'Goa', dirty: 1, disk: 'Pune', wal: 'lsn 88: id 7 → Goa', ar: [[385, 100, 385, 138, C.te]], msg: 'Before COMMIT returns, a small record of the change is appended to the WAL and flushed (fsync). Appends are fast and sequential.', c: [C.teL, C.te] }), 'Before the commit is acknowledged, a small record of the change is appended to the write-ahead log and flushed to disk. Appending is sequential, so it is fast. Durability, the D in ACID, comes from this step.'],
      [st({ memGone: 1, disk: 'Pune', wal: 'lsn 88: id 7 → Goa', msg: 'Crash! Memory is lost. The table file still says Pune, but the WAL on disk says Goa.', c: [C.reL, C.re] }), 'The server crashes. The dirty page in memory is gone, and the table file still has the old value.'],
      [st({ mem: 'Goa', dirty: 1, disk: 'Pune', wal: 'lsn 88: id 7 → Goa', ar: [[385, 138, 385, 102, C.te]], msg: 'Restart: redo replays the WAL from the last checkpoint and the page is Goa again. No committed write is lost.', c: [C.teL, C.te] }), 'On restart the database replays (redoes) the WAL from the last checkpoint onto the pages. Every committed change comes back. Undo information rolls back transactions that never committed.'],
      [st({ mem: 'Goa', disk: 'Goa', wal: 'before lsn 88: can be recycled', ar: [[400, 75, 520, 138, C.bl]], msg: 'Checkpoint: dirty pages are written to the table file in the background; older WAL is no longer needed.' }), 'A checkpoint writes dirty pages to the table files in the background, so the WAL before it can be recycled. One logical change can cause several physical writes (WAL, page, full-page image, index pages): write amplification.']
    ] };
  };

  const DEF = { isolation: iso, pages, scans, bplus, shard, deadlock: dead, replication: repl, wal };
  const cache = {};
  function build(name) {
    const f = cache[name] || (cache[name] = DEF[name] && DEF[name]());
    if (!f) return null;
    let i = 0, timer = null;
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pic = document.createElement('div'); pic.className = 'figsvg';
    const cap = document.createElement('p'); cap.className = 'figcap'; cap.setAttribute('aria-live', 'polite');
    const cnt = document.createElement('span'); cnt.className = 'lbl'; cnt.style.minWidth = '52px'; cnt.style.textAlign = 'center';
    const btn = (label, txt, fn) => { const b = document.createElement('button'); b.className = 'btn sm'; b.setAttribute('aria-label', label); b.textContent = txt; b.onclick = fn; return b; };
    const play = btn('Play the steps', 'Play', () => { if (timer) stop(); else { timer = setInterval(() => { if (!document.body.contains(pic)) return stop(); i = (i + 1) % f.steps.length; draw(); if (i === f.steps.length - 1) stop(); }, 3200); play.textContent = 'Pause'; } });
    const stop = () => { clearInterval(timer); timer = null; play.textContent = 'Play'; };
    const go = d => { stop(); i = (i + d + f.steps.length) % f.steps.length; draw(); };
    function draw() {
      const [s, c] = f.steps[i];
      pic.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${X(f.title)}, step ${i + 1}: ${X(c).replace(/"/g, '&quot;')}">${s}</svg>`;
      cap.textContent = c; cnt.textContent = (i + 1) + ' / ' + f.steps.length;
    }
    const wrap = document.createElement('figure'); wrap.className = 'fig dfig'; wrap.dataset.figName = name;
    const head = document.createElement('div'); head.className = 'row wrap';
    const t = document.createElement('b'); t.className = 'grow'; t.textContent = f.title;
    const ctl = document.createElement('div'); ctl.className = 'row'; ctl.style.gap = '6px';
    ctl.append(btn('Previous step', '‹', () => go(-1)), cnt, btn('Next step', '›', () => go(1)), play);
    head.append(t, ctl); wrap.append(head, pic, cap);
    draw();
    if (typeof cleanup !== 'undefined') cleanup.push(stop);
    if (!reduce) { /* start playing only once the figure scrolls into view */
      if ('IntersectionObserver' in window) { const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); if (!timer && i === 0) play.onclick(); } }, { threshold: .6 }); io.observe(wrap); }
    }
    return wrap;
  }
  function mount(root) { root.querySelectorAll('div[data-fig]').forEach(d => { const f = build(d.dataset.fig); if (f) d.replaceWith(f); }); }
  return { mount, build, names: Object.keys(DEF) };
})();
