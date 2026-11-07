/* Design simulator (#/sim): draw a data system as boxes and wires, push traffic through it, break parts of it and
   read what happens: throughput, p50/p99, errors, consumer lag, bottlenecks and a rough monthly cost.
   The engine is a fluid model, one step per simulated second (SIM.step); SIM.run plays a whole scenario headless,
   which is what "Check my design" and the tests use. Designs live in S.sim.d (synced per design, newer edit wins). */
'use strict';

/* ---------------- components ---------------- */
/* cap = requests or events per second one replica handles; lat = ms per request at low load; cost = $ per replica per month.
   route: all = every request calls each wire out; split = shared between wires out; miss = only cache misses go on.
   async = a buffer: producers do not wait, consumers read at their own pace (backlog = lag) */
const SIM_CAT = { src: ['Sources', 'var(--muted)'], edge: ['Edge and routing', 'var(--blue)'], compute: ['Compute', 'var(--teal)'], stream: ['Streams and queues', 'var(--amber)'], store: ['Storage and serving', 'var(--plum)'], ops: ['Orchestration and quality', 'var(--blue-d)'], ext: ['Outside', 'var(--red)'] };
const SIM_K = {
  client: { t: 'Users', cat: 'src', ab: 'USR', rps: 1000, d: 'Traffic source: people or apps sending requests' },
  producer: { t: 'Event producers', cat: 'src', ab: 'PRD', rps: 2000, d: 'Apps or devices emitting events' },
  files: { t: 'File drops', cat: 'src', ab: 'FIL', rps: 500, d: 'Vendor or partner files (SFTP, S3 drops), as records per second' },
  bi: { t: 'BI dashboards', cat: 'src', ab: 'BI', rps: 50, d: 'Analysts and dashboards sending queries (Looker, Tableau, Superset)' },
  cdn: { t: 'CDN', cat: 'edge', ab: 'CDN', cap: 50000, lat: 12, cost: 80, route: 'miss', hit: 0.8, d: 'Edge cache for content that many people read' },
  gw: { t: 'API gateway', cat: 'edge', ab: 'GW', cap: 10000, lat: 4, cost: 60, route: 'split', d: 'Auth, routing and an optional rate limit' },
  lb: { t: 'Load balancer', cat: 'edge', ab: 'LB', cap: 40000, lat: 2, cost: 25, route: 'split', d: 'Spreads requests across the boxes behind it' },
  svc: { t: 'Service', cat: 'compute', ab: 'SVC', cap: 800, lat: 25, cost: 70, route: 'all', d: 'Application servers; can auto-scale' },
  fn: { t: 'Serverless function', cat: 'compute', ab: 'FN', cap: 1000, lat: 45, cost: 0, perRps: 0.9, route: 'all', auto: true, max: 200, d: 'Scales by itself; you pay per request' },
  stream: { t: 'Stream processor', cat: 'compute', ab: 'STR', cap: 4000, lat: 30, cost: 120, route: 'all', d: 'Flink or Spark Structured Streaming tasks; one task per partition at most' },
  orch: { t: 'Airflow', cat: 'ops', ab: 'AF', cap: 200, lat: 500, cost: 300, route: 'all', d: 'Scheduler and workers that start tasks; replicas = workers, capacity = tasks started per second' },
  dbt: { t: 'dbt models', cat: 'ops', ab: 'DBT', cap: 5000, lat: 900, cost: 40, route: 'all', d: 'SQL transforms that build tables in the warehouse or lake' },
  dq: { t: 'Data quality checks', cat: 'ops', ab: 'DQ', cap: 10000, lat: 30, cost: 30, route: 'all', d: 'Contracts and tests (Great Expectations, dbt tests, Soda) run on the data as it lands' },
  registry: { t: 'Schema registry', cat: 'ops', ab: 'SR', cap: 20000, lat: 2, cost: 40, route: 'all', d: 'Checks every producer\'s schema; blocks breaking changes before they reach readers' },
  embed: { t: 'Embedding model', cat: 'compute', ab: 'EMB', cap: 300, lat: 60, cost: 250, route: 'all', d: 'Turns text into vectors (GPU or hosted model)' },
  trino: { t: 'Query engine (Trino)', cat: 'compute', ab: 'TRN', cap: 60, lat: 1200, cost: 260, route: 'all', d: 'Federated SQL over the lake; replicas = workers' },
  spark: { t: 'Spark job', cat: 'compute', ab: 'SPK', cap: 8000, lat: 1500, cost: 200, route: 'all', d: 'Executors in a batch or micro-batch job' },
  kafka: { t: 'Kafka topic', cat: 'stream', ab: 'KFK', cap: 30000, lat: 5, cost: 150, route: 'all', async: true, parts: 12, d: 'Durable log; replicas = brokers; partitions cap how many consumers can work' },
  queue: { t: 'Queue', cat: 'stream', ab: 'Q', cap: 5000, lat: 8, cost: 20, route: 'split', async: true, d: 'Work queue (SQS-style); each message goes to one worker' },
  dlq: { t: 'Dead-letter queue', cat: 'stream', ab: 'DLQ', cap: 5000, lat: 5, cost: 10, route: 'split', async: true, d: 'Holds records that failed, so one bad record does not stop the pipeline' },
  connect: { t: 'Kafka Connect sink', cat: 'stream', ab: 'KC', cap: 5000, lat: 50, cost: 80, route: 'all', d: 'Connector tasks that copy a topic into a store (S3, warehouse, search)' },
  cdc: { t: 'CDC connector', cat: 'stream', ab: 'CDC', cap: 3000, lat: 150, cost: 60, route: 'all', tail: true, d: 'Debezium-style: reads the database log and emits change events' },
  pg: { t: 'Postgres (OLTP)', cat: 'store', ab: 'DB', cap: 3000, lat: 6, cost: 180, route: 'all', d: 'Primary database; replicas here are read copies' },
  cache: { t: 'Redis cache', cat: 'store', ab: 'CHE', cap: 60000, lat: 1, cost: 90, route: 'miss', hit: 0.9, d: 'In-memory cache; misses go to the box behind it' },
  kv: { t: 'Serving store', cat: 'store', ab: 'KV', cap: 10000, lat: 4, cost: 220, route: 'all', d: 'Key-value store (Cassandra, DynamoDB) for fast lookups' },
  lake: { t: 'Lake (object store)', cat: 'store', ab: 'S3', cap: 20000, lat: 40, cost: 25, route: 'all', d: 'Iceberg or Delta tables on object storage' },
  wh: { t: 'Warehouse', cat: 'store', ab: 'WH', cap: 300, lat: 800, cost: 400, route: 'all', d: 'Snowflake or BigQuery: big scans, few concurrent queries' },
  olap: { t: 'Real-time OLAP', cat: 'store', ab: 'OLP', cap: 2000, lat: 40, cost: 350, route: 'all', d: 'ClickHouse, Pinot or Druid: fast aggregates for dashboards and user-facing analytics' },
  feature: { t: 'Feature store', cat: 'store', ab: 'FS', cap: 15000, lat: 5, cost: 260, route: 'all', d: 'Online features for models (Feast, Tecton); offline copy in the lake' },
  catalog: { t: 'Table catalog', cat: 'store', ab: 'CAT', cap: 3000, lat: 15, cost: 50, route: 'all', d: 'Iceberg REST, Glue, Unity or Polaris: where engines find table metadata' },
  doc: { t: 'Document DB', cat: 'store', ab: 'DOC', cap: 6000, lat: 5, cost: 200, route: 'all', d: 'MongoDB or DynamoDB documents for app data' },
  search: { t: 'Search index', cat: 'store', ab: 'IDX', cap: 2000, lat: 20, cost: 250, route: 'all', d: 'Full-text index (OpenSearch)' },
  vector: { t: 'Vector store', cat: 'store', ab: 'VEC', cap: 1500, lat: 30, cost: 200, route: 'all', d: 'Embedding index for retrieval' },
  llm: { t: 'LLM API', cat: 'ext', ab: 'LLM', cap: 50, lat: 1800, cost: 0, perRps: 2600, route: 'all', d: 'A hosted model; slow, rate-limited and priced per call' },
  ext: { t: 'Third-party API', cat: 'ext', ab: 'API', cap: 1000, lat: 120, cost: 0, route: 'all', d: 'A partner API you do not control' },
  custom: { t: 'Custom box', cat: 'compute', ab: 'BOX', cap: 1000, lat: 20, cost: 50, route: 'all', d: 'Your own component: set capacity, latency and cost' }
};
const simIsSrc = n => SIM_K[n.k].cat === 'src';

/* ---------------- failures ---------------- */
/* on: node, edge or all. f(n) returns how the target changes while the failure is active */
const SIM_CHAOS = [
  ['Infrastructure', [
    ['crash', 'Box crashes', 'node', 'It stops serving. With a standby, it fails over in 3 seconds.'],
    ['cpu', 'CPU saturation', 'node', 'Each replica does a third of its usual work.'],
    ['leak', 'Memory leak', 'node', 'Capacity drains away a little every second until it is fixed.'],
    ['disk', 'Disk full', 'node', 'A store rejects every write.'],
    ['az', 'Zone outage', 'all', 'Half of every box\'s replicas disappear at once.']]],
  ['Network', [
    ['slow', 'Latency on a wire', 'edge', 'Adds 300 ms to every call on the selected wire.'],
    ['part', 'Network partition', 'edge', 'Nothing gets through the selected wire.'],
    ['loss', 'Packet loss', 'edge', '20% of calls on the selected wire fail.']]],
  ['Traffic', [
    ['spike', 'Traffic spike', 'all', 'Every source sends 4 times as much.'],
    ['herd', 'Thundering herd', 'all', 'Clients retry together: 3 times the traffic, easing off.']]],
  ['Data', [
    ['stampede', 'Cache stampede', 'node', 'The cache is cold: every request misses and goes to the store behind it.'],
    ['lag', 'Replication or connector lag', 'node', 'A replica, CDC connector or consumer runs at a fifth of its speed.'],
    ['hot', 'Hot partition', 'node', 'One key gets most events: consumers of this topic can use only a quarter of its partitions.'],
    ['broker', 'Broker lost', 'node', 'A Kafka topic loses half its brokers while partitions move.'],
    ['poison', 'Bad records', 'node', 'A reader keeps retrying records it cannot parse and stalls. Wired to a dead-letter queue, it parks them and goes on.'],
    ['schema', 'Breaking schema change', 'node', 'A producer renames a field. Readers fail, unless a schema registry blocks the change at the producer.'],
    ['backfill', 'Backfill', 'node', 'A source replays history: three times its usual rate.']]],
  ['Outside', [
    ['extslow', 'Partner API slow', 'node', 'Responses take 10 times longer.'],
    ['extlimit', 'Partner rate limit', 'node', 'Only 30% of calls are accepted.']]]
];
const SIM_CH = {}; SIM_CHAOS.forEach(g => g[1].forEach(c => { SIM_CH[c[0]] = { id: c[0], t: c[1], on: c[2], d: c[3] }; }));

/* ---------------- engine ---------------- */
const SIM = {
  newRt(d) { return { t: 0, reps: {}, backlog: {}, crashAt: {}, leak: {}, herdAt: null, hist: [], chaos: [] }; },
  active(rt, t) { return rt.chaos.filter(c => t >= (c.from || 0) && (c.to == null || t < c.to)); },
  order(d) { /* Kahn's order from the sources; boxes in loops go last, and their back wires are ignored */
    const indeg = {}, out = {}; d.nodes.forEach(n => { indeg[n.id] = 0; out[n.id] = []; });
    d.edges.forEach(e => { if (indeg[e.b] != null && out[e.a]) { indeg[e.b]++; out[e.a].push(e); } });
    const q = d.nodes.filter(n => !indeg[n.id]).map(n => n.id), seen = new Set(), ord = [];
    while (q.length) { const id = q.shift(); if (seen.has(id)) continue; seen.add(id); ord.push(id); out[id].forEach(e => { if (--indeg[e.b] === 0) q.push(e.b); }); }
    d.nodes.forEach(n => { if (!seen.has(n.id)) ord.push(n.id); });
    const pos = {}; ord.forEach((id, i) => { pos[id] = i; });
    return { ord, out: id => (out[id] || []).filter(e => pos[e.b] > pos[id]), pos };
  },
  step(d, rt, dt) {
    dt = dt || 1; const t = rt.t, act = SIM.active(rt, t), N = {}; d.nodes.forEach(n => { N[n.id] = n; });
    const on = (id, ty) => act.some(c => c.type === ty && c.target === id), any = ty => act.some(c => c.type === ty);
    const { ord, out } = SIM.order(d), inc = {}, R = {};
    let mult = any('spike') ? 4 : 1;
    if (any('herd')) { if (rt.herdAt == null) rt.herdAt = t; mult *= 1 + 2 * Math.max(0, 1 - (t - rt.herdAt) / 30); } else rt.herdAt = null;
    const pullFrom = {}; /* consumers of a buffer lag instead of failing */
    d.edges.forEach(e => { if (N[e.a] && N[e.b] && (SIM_K[N[e.a].k].async || SIM_K[N[e.b].k].tail)) pullFrom[e.b] = e.a; }); /* a CDC connector tails the database log: it lags, it never fails the writes */
    ord.forEach(id => {
      const n = N[id], K = SIM_K[n.k], r = R[id] = { inn: inc[id] || 0, served: 0, drop: 0, cap: 0, u: 0, lat: 0, reps: 0 };
      if (simIsSrc(n)) { r.inn = r.served = (n.rps != null ? n.rps : K.rps) * (d.mult || 1) * mult * (on(id, 'backfill') ? 3 : 1); }
      else {
        const base = n.n || 1; let reps = rt.reps[id] != null ? rt.reps[id] : base;
        if (any('az')) reps = Math.max(1, Math.floor(reps / 2));
        let h = 1;
        if (on(id, 'crash')) { if (rt.crashAt[id] == null) rt.crashAt[id] = t; h = n.standby && t - rt.crashAt[id] >= 3 ? 1 : 0; } else delete rt.crashAt[id];
        if (on(id, 'cpu')) h *= 0.33;
        if (on(id, 'leak')) { rt.leak[id] = Math.min(0.95, (rt.leak[id] || 0) + 0.04 * dt); h *= 1 - rt.leak[id]; } else delete rt.leak[id];
        if (on(id, 'disk') && K.cat === 'store') h = 0;
        if (on(id, 'lag')) h *= 0.2;
        if (on(id, 'broker')) h *= 0.5;
        if (on(id, 'extlimit')) h *= 0.3;
        if (on(id, 'poison')) { const dq = d.edges.some(e => e.a === id && N[e.b] && N[e.b].k === 'dlq'); h *= dq ? 0.95 : 0.1; r.poison = dq ? 'parked' : 'stalled'; }
        if (on(id, 'schema')) { const guarded = d.nodes.some(x => x.k === 'registry' && d.edges.some(e => e.a === x.id || e.b === x.id)); if (!guarded) h = 0; r.schema = guarded ? 'blocked at the producer' : 'readers fail'; }
        const src = pullFrom[id] && N[pullFrom[id]];
        if (src && src.k === 'kafka' && (n.k === 'stream' || n.k === 'spark' || n.k === 'svc' || n.k === 'fn' || n.k === 'custom')) { /* one consumer task per partition */
          const parts = Math.max(1, Math.floor((src.parts || SIM_K.kafka.parts) / (on(src.id, 'hot') ? 4 : 1))); r.idle = Math.max(0, reps - parts); reps = Math.min(reps, parts);
        }
        r.reps = reps; r.cap = (n.cap != null ? n.cap : K.cap) * reps * h;
        if (n.limit && n.k === 'gw') r.cap = Math.min(r.cap, n.limit);
        const offered = r.inn + (K.async || K.tail ? (rt.backlog[id] || 0) / dt : 0);
        if (K.async) { r.accepted = Math.min(r.inn, r.cap); r.drop = r.inn - r.accepted; r.served = r.accepted; r.offer = r.accepted + (rt.backlog[id] || 0) / dt; }
        else if (pullFrom[id]) { r.served = Math.min(offered, r.cap); r.drop = 0; if (K.tail) { rt.backlog[id] = Math.max(0, (offered - r.served) * dt); r.lag = rt.backlog[id]; r.fresh = r.lag / Math.max(1, r.inn); } }
        else { r.served = Math.min(r.inn, r.cap); r.drop = r.inn - r.served; }
        r.u = r.cap > 0 ? Math.min(1.5, (K.async ? r.inn : offered) / r.cap) : (r.inn > 0 ? 1.5 : 0);
        const hit = on(id, 'stampede') ? 0 : (n.hit != null ? n.hit : K.hit || 0);
        r.hit = hit;
        let own = (n.lat != null ? n.lat : K.lat) * (1 + 2 * Math.pow(Math.min(r.u, 1), 4)) + (r.u > 1 ? 400 * (r.u - 1) : 0);
        if (on(id, 'extslow')) own *= 10;
        r.own = own;
        if (n.auto || K.auto) { /* scale out when busy, back in when quiet; one step every 2 seconds */
          const mx = n.max || K.max || 30; rt.cool = rt.cool || {}; rt.cool[id] = (rt.cool[id] || 0) - dt;
          if (rt.cool[id] <= 0) { const cur = rt.reps[id] != null ? rt.reps[id] : base; if (r.u > 0.75 && cur < mx) { rt.reps[id] = Math.min(mx, cur + Math.max(1, Math.ceil(cur * 0.3))); rt.cool[id] = 2; } else if (r.u < 0.3 && cur > base) { rt.reps[id] = Math.max(base, cur - 1); rt.cool[id] = 2; } }
        }
      }
      const outs = out(id), K2 = SIM_K[n.k], send = K2.async ? r.offer : r.served;
      outs.forEach(e => {
        const toDlq = N[e.b] && N[e.b].k === 'dlq', rest = outs.filter(x => !(N[x.b] && N[x.b].k === 'dlq'));
        let v = toDlq ? (r.poison === 'parked' ? send * 0.05 : 0) : K2.route === 'split' ? send / Math.max(1, rest.length) : K2.route === 'miss' ? send * (1 - (r.hit || 0)) : send;
        e._loss = on(e.id, 'part') ? 1 : on(e.id, 'loss') ? 0.2 : 0; e._ms = on(e.id, 'slow') ? 300 : 0;
        e._v = v; inc[e.b] = (inc[e.b] || 0) + v * (1 - e._loss);
      });
    });
    /* buffers: what the slowest reader did not take stays as lag */
    ord.forEach(id => { const n = N[id], K = SIM_K[n.k]; if (!K.async) return; const outs = out(id); const r = R[id];
      if (!outs.length) { rt.backlog[id] = 0; r.lag = 0; return; }
      const parts = K.route === 'split' ? outs.reduce((a, e) => a + Math.min(e._v, R[e.b].served * (e._v / Math.max(1e-9, R[e.b].inn))), 0) : Math.min(...outs.map(e => Math.min(e._v, R[e.b].served * (e._v / Math.max(1e-9, R[e.b].inn)))));
      rt.backlog[id] = Math.max(0, (r.offer - parts) * dt); r.lag = rt.backlog[id]; r.fresh = r.lag / Math.max(1, r.inn); });
    /* latency and success, from the leaves back to the sources; buffers cut the chain (producers do not wait) */
    for (let i = ord.length - 1; i >= 0; i--) {
      const id = ord[i], n = N[id], K = SIM_K[n.k], r = R[id], outs = out(id).filter(e => !K.async && !(N[e.b] && (N[e.b].k === 'dlq' || SIM_K[N[e.b].k].tail)));
      const ok0 = simIsSrc(n) || r.inn <= 0 ? 1 : r.served / r.inn;
      let dl = 0, d99 = 0, dok = 1;
      if (outs.length) {
        const parts = outs.map(e => { const c = R[e.b]; return { l: (c.lat || 0) + e._ms, l99: (c.p99 || 0) + e._ms, ok: (c.ok == null ? 1 : c.ok) * (1 - e._loss) }; });
        if (K.route === 'split') { dl = parts.reduce((a, p) => a + p.l, 0) / parts.length; d99 = Math.max(...parts.map(p => p.l99)); dok = parts.reduce((a, p) => a + p.ok, 0) / parts.length; }
        else { const f = K.route === 'miss' ? 1 - (r.hit || 0) : 1; dl = f * parts.reduce((a, p) => a + p.l, 0); d99 = (K.route === 'miss' && f < 0.02 ? 0 : 1) * parts.reduce((a, p) => a + p.l99, 0); dok = parts.reduce((a, p) => a * (1 - f + f * p.ok), 1); }
      }
      const own = simIsSrc(n) ? 0 : r.own;
      r.lat = own + dl; r.p99 = own * (2 + 2.5 * Math.pow(Math.min(r.u, 1.2), 2)) + d99; r.ok = ok0 * dok;
    }
    const srcs = d.nodes.filter(simIsSrc), tot = srcs.reduce((a, n) => a + R[n.id].inn, 0);
    const p50 = tot ? srcs.reduce((a, n) => a + R[n.id].lat * R[n.id].inn, 0) / tot : 0;
    const p99 = srcs.length ? Math.max(...srcs.map(n => R[n.id].p99)) : 0;
    const err = tot ? 100 * (1 - srcs.reduce((a, n) => a + R[n.id].ok * R[n.id].inn, 0) / tot) : 0;
    const lagN = d.nodes.filter(n => SIM_K[n.k].async || SIM_K[n.k].tail), lag = lagN.reduce((a, n) => a + (R[n.id].lag || 0), 0);
    const fresh = Math.max(0, ...lagN.map(n => R[n.id].fresh || 0));
    const hot = d.nodes.filter(n => !simIsSrc(n) && R[n.id] && (R[n.id].u >= 0.85 || R[n.id].drop > 0.5 || (R[n.id].lag || 0) > R[n.id].inn)).map(n => n.id);
    const m = { t, rps: tot, p50, p99, err: Math.max(0, err), lag, fresh, hot, R, cost: SIM.cost(d, rt, R).total };
    rt.t += dt; rt.last = m; rt.hist.push({ t, rps: tot, ok: tot * (1 - m.err / 100), p50, p99, err: m.err, lag }); if (rt.hist.length > 240) rt.hist.shift();
    return m;
  },
  cost(d, rt, R) {
    const rows = d.nodes.filter(n => !simIsSrc(n)).map(n => { const K = SIM_K[n.k], reps = rt && rt.reps[n.id] != null ? rt.reps[n.id] : (n.n || 1); const c = (n.cost != null ? n.cost : K.cost) * reps + (K.perRps ? K.perRps * ((R && R[n.id] && R[n.id].served) || 0) : 0); return [n, reps, Math.round(c)]; });
    return { rows, total: rows.reduce((a, r) => a + r[2], 0) };
  },
  /* play a whole scenario without drawing: chaos is [{type, target, from, to}] with targets as box or wire ids */
  run(d, secs, chaos) { const rt = SIM.newRt(d); rt.chaos = (chaos || []).map(c => Object.assign({}, c)); const ms = []; for (let i = 0; i < secs; i++) ms.push(SIM.step(d, rt, 1)); return { ms, rt }; },
  grade(d, sc) {
    const { ms } = SIM.run(d, sc.secs || 60, simChaosFor(d, sc.chaos)), half = ms.slice(Math.floor(ms.length / 2)), avg = (a, k) => a.reduce((s, m) => s + m[k], 0) / Math.max(1, a.length), last = ms[ms.length - 1];
    const G = sc.goals, res = [];
    if (G.err != null) { const v = avg(ms, 'err'); res.push(['Errors over the run', v.toFixed(1) + '%', '≤ ' + G.err + '%', v <= G.err]); }
    if (G.p99 != null) { const v = avg(half, 'p99'); res.push(['p99 latency (second half)', Math.round(v) + ' ms', '≤ ' + G.p99 + ' ms', v <= G.p99]); }
    if (G.fresh != null) { const v = last.fresh; res.push(['Data freshness at the end', v.toFixed(1) + ' s behind', '≤ ' + G.fresh + ' s', v <= G.fresh]); }
    if (G.cost != null) { const v = SIM.cost(d).total; res.push(['Monthly cost (as designed)', '$' + v.toLocaleString(), '≤ $' + G.cost.toLocaleString(), v <= G.cost]); }
    return { res, pass: res.every(r => r[3]) };
  }
};
/* scenario chaos names a box by kind (first box of that kind) or a wire by "kindA>kindB" */
function simChaosFor(d, list) {
  return (list || []).map(c => { let target = null;
    if (c.on && c.on.includes('>')) { const [a, b] = c.on.split('>'); const e = d.edges.find(e => { const x = d.nodes.find(n => n.id === e.a), y = d.nodes.find(n => n.id === e.b); return x && y && x.k === a && y.k === b; }); target = e && e.id; }
    else if (c.on) { const n = d.nodes.find(n => n.k === c.on); target = n && n.id; }
    return { type: c.type, target, from: c.from, to: c.to }; });
}

/* ---------------- scenarios ---------------- */
/* each is a starting design plus a challenge; the starting design fails at least one goal on purpose */
const SIM_SC = [
  { id: 'skeleton', mid: 's01', lvl: 'Beginner', t: 'Walking skeleton: events to the lake', secs: 60,
    q: 'Producers send 3,000 events a second into Kafka; one streaming task writes them to the lake. Keep the lake no more than 5 seconds behind.',
    hint: 'Look at the stream processor\'s load bar. One task handles 4,000 a second at best, and less when busy. Add a replica.',
    goals: { fresh: 5, err: 1 },
    nodes: [['producer', 40, 140, { rps: 3000 }], ['kafka', 260, 140, { n: 1, parts: 6 }], ['stream', 480, 140, { n: 1, cap: 2500 }], ['lake', 700, 140]], edges: [[0, 1], [1, 2], [2, 3]] },
  { id: 'partitions', mid: 's05', lvl: 'Intermediate', t: 'Real time: partitions cap parallelism', secs: 60,
    q: '40,000 events a second, a topic with 6 partitions, and stream tasks that each handle 4,000 a second. Keep freshness under 5 seconds.',
    hint: 'Adding stream replicas past 6 does nothing (they sit idle). Raise the topic\'s partitions first, then the replicas.',
    goals: { fresh: 5, err: 1 },
    nodes: [['producer', 40, 140, { rps: 40000 }], ['kafka', 260, 140, { n: 2, parts: 6 }], ['stream', 480, 140, { n: 6 }], ['kv', 700, 140, { n: 5 }]], edges: [[0, 1], [1, 2], [2, 3]] },
  { id: 'hotkey', mid: 's05', lvl: 'Advanced', t: 'Real time: a hot key', secs: 80,
    chaos: [{ type: 'hot', on: 'kafka', from: 10, to: 60 }],
    q: 'One customer floods the topic from second 10 to 60, so a quarter of the partitions carry the load. Be no more than 2 seconds behind at the end.',
    hint: 'With a hot key, only a quarter of the partitions are useful. Headroom (more partitions and tasks than the steady load needs) lets the lag drain once it passes.',
    goals: { fresh: 2, err: 1 },
    nodes: [['producer', 40, 140, { rps: 15000 }], ['kafka', 260, 140, { n: 1, parts: 12 }], ['stream', 480, 140, { n: 4 }], ['lake', 700, 140]], edges: [[0, 1], [1, 2], [2, 3]] },
  { id: 'dlq', mid: 's05', lvl: 'Intermediate', t: 'Real time: one bad record', secs: 90,
    chaos: [{ type: 'poison', on: 'stream', from: 10, to: 70 }],
    q: 'From second 10, some events cannot be parsed. The stream task retries them forever and the whole pipeline stalls. Be under 5 seconds behind at the end.',
    hint: 'Add a Dead-letter queue and wire the stream processor to it. Bad records are parked there for later, and the good ones keep flowing.',
    goals: { fresh: 5, err: 1 },
    nodes: [['producer', 40, 140, { rps: 3000 }], ['kafka', 260, 140, { parts: 6 }], ['stream', 480, 140, { n: 2 }], ['lake', 700, 140]], edges: [[0, 1], [1, 2], [2, 3]] },
  { id: 'schema', mid: 's06', lvl: 'Intermediate', t: 'A breaking schema change', secs: 90,
    chaos: [{ type: 'schema', on: 'stream', from: 20, to: 60 }],
    q: 'At second 20 a team renames a field in the events it sends. Every reader fails until they ship a fix 40 seconds later. Be under 5 seconds behind at the end.',
    hint: 'Add a Schema registry and wire the producers to it. With compatibility checks on, the breaking change is refused at the producer and readers never see it.',
    goals: { fresh: 5, err: 1 },
    nodes: [['producer', 40, 140, { rps: 2000 }], ['kafka', 260, 140, { parts: 6 }], ['stream', 480, 140, { n: 1 }], ['lake', 700, 140]], edges: [[0, 1], [1, 2], [2, 3]] },
  { id: 'dashboards', mid: 's10', lvl: 'Intermediate', t: 'Dashboards on the warehouse', secs: 60,
    q: '400 dashboard queries a second hit a warehouse that runs about 300 at once. Get errors under 1% and p99 under 2 seconds, for at most $1,500 a month.',
    hint: 'Serve dashboards from a Real-time OLAP store (loaded from the warehouse or the stream), or put a cache in front of the warehouse for repeated queries.',
    goals: { err: 1, p99: 2000, cost: 1500 },
    nodes: [['bi', 40, 140, { rps: 400 }], ['wh', 300, 140]], edges: [[0, 1]] },
  { id: 'rag', mid: 'a05', lvl: 'Advanced', t: 'RAG under a rate limit', secs: 60,
    chaos: [{ type: 'extlimit', on: 'llm', from: 15, to: 45 }],
    q: '30 questions a second: the service embeds each one, looks up the vector store, then calls the LLM. The provider cuts your rate limit for 30 seconds. Keep errors under 2%.',
    hint: 'Put a cache between the service and the LLM API (a semantic cache: repeated questions get the stored answer without a call). Fewer calls also cut the bill.',
    goals: { err: 2 },
    nodes: [['client', 40, 140, { rps: 30 }], ['svc', 240, 140, { n: 2 }], ['embed', 460, 60], ['vector', 680, 60], ['llm', 460, 220]], edges: [[0, 1], [1, 2], [2, 3], [1, 4]] },
  { id: 'spark', mid: 's03', lvl: 'Intermediate', t: 'Spark under load', secs: 60,
    q: '30,000 events a second land in Kafka; a Spark job with 2 executors (8,000 a second each) writes them to the lake. Stop the lag from growing.',
    hint: 'Executors you add only help if the topic has enough partitions for them.',
    goals: { fresh: 5, err: 1 },
    nodes: [['producer', 40, 140, { rps: 30000 }], ['kafka', 260, 140, { n: 1, parts: 12 }], ['spark', 480, 140, { n: 2 }], ['lake', 700, 140, { n: 2 }]], edges: [[0, 1], [1, 2], [2, 3]] },
  { id: 'cdc', mid: 's06', lvl: 'Intermediate', t: 'CDC that catches up', secs: 90,
    chaos: [{ type: 'lag', on: 'cdc', from: 10, to: 40 }],
    q: 'An app writes 2,500 changes a second to Postgres; a CDC connector streams them to the lake through Kafka. The connector slows down for 30 seconds. Be under 10 seconds behind by the end.',
    hint: 'After the slow spell the connector must read the new changes and the backlog. Spare capacity (a second connector task) decides how fast it catches up.',
    goals: { fresh: 10, err: 1 },
    nodes: [['client', 40, 60, { rps: 2500 }], ['svc', 240, 60, { n: 4 }], ['pg', 440, 60], ['cdc', 440, 220], ['kafka', 640, 220, { parts: 6 }], ['lake', 840, 220]], edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]] },
  { id: 'serving', mid: 's10', lvl: 'Intermediate', t: 'Serving reads at scale', secs: 60,
    q: '20,000 reads a second reach 10 service replicas and one Postgres. Get errors under 1% and p99 under 250 ms, for at most $4,000 a month.',
    hint: 'Scale the service so it runs well under 100% (p99 climbs fast near full load), and put a Redis cache between the service and Postgres: Service → Cache → Postgres.',
    goals: { err: 1, p99: 250, cost: 4000 },
    nodes: [['client', 40, 140, { rps: 20000 }], ['lb', 240, 140], ['svc', 440, 140, { n: 10 }], ['pg', 680, 140]], edges: [[0, 1], [1, 2], [2, 3]] },
  { id: 'stampede', mid: 's10', lvl: 'Advanced', t: 'Survive a cache stampede', secs: 60,
    chaos: [{ type: 'stampede', on: 'cache', from: 20, to: 30 }],
    q: 'A healthy read path, until the cache goes cold for 10 seconds and every request falls through to Postgres. Keep errors over the run under 3%.',
    hint: 'The store behind a cache must survive a cold cache for a while: read replicas on Postgres (raise its replicas), or a serving store sized for misses.',
    goals: { err: 3 },
    nodes: [['client', 40, 140, { rps: 15000 }], ['lb', 240, 140], ['svc', 440, 140, { n: 24 }], ['cache', 640, 140], ['pg', 840, 140]], edges: [[0, 1], [1, 2], [2, 3], [3, 4]] },
  { id: 'failover', mid: 's09', lvl: 'Intermediate', t: 'Database failover', secs: 90,
    chaos: [{ type: 'crash', on: 'pg', from: 20, to: 70 }],
    q: 'The primary database crashes at second 20 and stays down for 50 seconds. Keep errors over the run under 5%.',
    hint: 'Select Postgres and turn on a standby: it takes over in 3 seconds. That is your recovery time objective.',
    goals: { err: 5 },
    nodes: [['client', 40, 140, { rps: 3000 }], ['lb', 240, 140], ['svc', 440, 140, { n: 5 }], ['pg', 680, 140]], edges: [[0, 1], [1, 2], [2, 3]] },
  { id: 'zone', mid: 's09', lvl: 'Advanced', t: 'Lose a zone', secs: 60,
    chaos: [{ type: 'az', from: 15, to: 45 }],
    q: 'A whole availability zone goes away for 30 seconds: every box loses half its replicas. Keep errors under 2%.',
    hint: 'N+1 is not enough when a zone takes half your capacity: run each tier at under 50% load, or let it auto-scale.',
    goals: { err: 2, cost: 3500 },
    nodes: [['client', 40, 140, { rps: 4000 }], ['lb', 240, 140], ['svc', 440, 140, { n: 6 }], ['cache', 640, 140, { n: 2 }], ['pg', 840, 140, { n: 2 }]], edges: [[0, 1], [1, 2], [2, 3], [3, 4]] },
  { id: 'budget', mid: 's07', lvl: 'Beginner', t: 'Right-size on a budget', secs: 60,
    q: 'This read path is over-provisioned. Keep errors under 1% and p99 under 250 ms while cutting the bill to $1,500 a month.',
    hint: 'Each service replica handles 800 a second. 8,000 a second needs about 13 at 75% load, not 30. The cache leaves Postgres little to do.',
    goals: { err: 1, p99: 250, cost: 1500 },
    nodes: [['client', 40, 140, { rps: 8000 }], ['lb', 240, 140], ['svc', 440, 140, { n: 30 }], ['cache', 640, 140, { n: 2 }], ['pg', 840, 140, { n: 3 }]], edges: [[0, 1], [1, 2], [2, 3], [3, 4]] },
  { id: 'spike', mid: 's11', lvl: 'Intermediate', t: 'Launch-day spike', secs: 90,
    chaos: [{ type: 'spike', from: 20, to: 50 }],
    q: 'A launch sends 4 times the traffic for 30 seconds. Keep errors over the run under 5% without paying for peak all day ($3,000 a month as designed).',
    hint: 'Turn on auto-scale for the service with a high enough maximum, and check every tier: one gateway replica handles 10,000 a second.',
    goals: { err: 5, cost: 3000 },
    nodes: [['client', 40, 140, { rps: 4000 }], ['gw', 240, 140], ['svc', 440, 140, { n: 7 }], ['kv', 680, 140, { n: 3 }]], edges: [[0, 1], [1, 2], [2, 3]] },
  { id: 'partner', mid: 's11', lvl: 'Intermediate', t: 'A slow partner API', secs: 60,
    chaos: [{ type: 'extslow', on: 'ext', from: 15, to: 45 }],
    q: 'Each order calls a partner API inline. When the partner slows down 10 times, your p99 explodes. Keep p99 under 300 ms.',
    hint: 'Take the partner call off the request path: Service → Queue → Function → Partner API. A queue cuts the wait.',
    goals: { p99: 300, err: 1 },
    nodes: [['client', 40, 140, { rps: 500 }], ['svc', 260, 140, { n: 2 }], ['pg', 500, 60], ['ext', 500, 220]], edges: [[0, 1], [1, 2], [1, 3]] },
  /* staff scale (module 10.3): each fails at the numbers in the chapter until fixed */
  { id: 'million', mid: 's10', lvl: 'Staff', t: 'One million events a second', secs: 60,
    q: '1,000,000 events a second (about 1 GB/s at 1 KB each). The topic has 128 partitions and one stream task reads each, at about 4,000 events (4 MB) a second. Keep freshness under 5 seconds.',
    hint: 'Per-partition throughput sets the floor: 1,000,000 ÷ 4,000 = 250 partitions at full speed, so about 300 with headroom, and a task for each.',
    goals: { fresh: 5 },
    nodes: [['producer', 40, 140, { rps: 1000000, name: 'Apps (1M events/s)' }], ['kafka', 260, 140, { n: 50, parts: 128 }], ['stream', 480, 140, { n: 128 }], ['lake', 700, 140, { n: 60 }]], edges: [[0, 1], [1, 2], [2, 3]] },
  { id: 'prefix', mid: 's10', lvl: 'Staff', t: 'S3 request rate per prefix', secs: 60,
    q: 'A backfill writes 20,000 objects a second under one S3 prefix. S3 accepts about 3,500 writes a second per prefix, then answers 503 Slow Down. Keep errors under 1%.',
    hint: 'S3 scales by prefix: spread the keys over several prefixes (a hash at the start of the key, or date and hour folders), each with its own 3,500 a second.',
    goals: { err: 1 },
    nodes: [['files', 40, 140, { rps: 20000, name: 'Backfill writes' }], ['spark', 260, 140, { n: 4 }], ['lake', 480, 140, { n: 1, cap: 3500, name: 'S3 prefix (3,500 writes/s each)' }]], edges: [[0, 1], [1, 2]] },
  { id: 'petabyte', mid: 's10', lvl: 'Staff', t: 'Backfill on a budget', secs: 60,
    q: 'A three-year backfill reads 80,000 records a second for days. It runs on 40 on-demand executors that are mostly idle. Keep errors under 1% and the bill under $2,000 a month of runtime.',
    hint: 'Size to the throughput (80,000 ÷ 8,000 = 10 executors, plus headroom), and run a restartable backfill on spot capacity at about a third of the price.',
    goals: { err: 1, cost: 2000 },
    nodes: [['files', 40, 140, { rps: 80000, name: 'Three years of raw files' }], ['spark', 260, 140, { n: 40 }], ['lake', 480, 140, { n: 5 }]], edges: [[0, 1], [1, 2]] },
  { id: 'region', mid: 's09', lvl: 'Staff', t: 'Lose a region: RPO and RTO', secs: 80,
    chaos: [{ type: 'lag', on: 'cdc', from: 10, to: 70 }, { type: 'crash', on: 'pg', from: 30, to: 70 }],
    q: 'Writes go to the primary region and replicate to the second region through CDC. The link slows, then the primary database dies. Promise an RPO under 5 seconds (replica freshness) and an RTO of seconds (errors under 5% over the run, which allows a few seconds of failover).',
    hint: 'RTO: a hot standby takes over in seconds. RPO: the replica is only as fresh as replication, so give the link enough parallel apply to stay seconds behind even when slowed.',
    goals: { err: 5, fresh: 5 },
    nodes: [['client', 40, 140, { rps: 3000 }], ['svc', 240, 140, { n: 6 }], ['pg', 440, 140, { n: 2, name: 'Primary region DB' }], ['cdc', 640, 140, { name: 'Cross-region replication' }], ['kv', 840, 140, { n: 2, name: 'Second region copy' }]], edges: [[0, 1], [1, 2], [2, 3], [3, 4]] }
];
function simFromSc(sc) {
  const ids = sc.nodes.map((x, i) => 'n' + (i + 1));
  return { id: 'sc-' + sc.id, sid: sc.id, name: sc.t, mult: 1, at: Date.now(),
    nodes: sc.nodes.map((x, i) => Object.assign({ id: ids[i], k: x[0], x: x[1], y: x[2], name: SIM_K[x[0]].t }, x[3] || {})),
    edges: sc.edges.map((e, i) => ({ id: 'e' + (i + 1), a: ids[e[0]], b: ids[e[1]] })) };
}

/* ---------------- hints: a ladder per challenge ---------------- */
/* look = where to look, idea = the principle (and the module that teaches it), fix = what to change; Show me plays fix as steps.
   A fix step: set (box kind, field, value), add (kind, wired from a box kind), insert (kind between two box kinds) or reroute (wire a → new kind instead of a → b) */
const SIM_HINTS = {
  skeleton: { look: 'Run traffic and watch the stream processor\'s load bar and the Lag number in the top bar.', idea: 'A reader slower than its writers falls behind forever: lag grows by the gap every second. Capacity must beat the arrival rate with headroom.', change: 'Give the stream processor more replicas (a topic can feed as many readers as it has partitions).',
    fix: [{ set: 'stream', f: 'n', v: 2, why: 'Two tasks handle 5,000 a second; 3,000 arrive.' }] },
  partitions: { look: 'Select the stream processor while traffic runs: some of its replicas are idle.', idea: 'In a consumer group each partition goes to one reader, so a topic with 6 partitions can keep at most 6 readers busy.', change: 'Raise the topic\'s partitions first, then the stream replicas to match.',
    fix: [{ set: 'kafka', f: 'parts', v: 12, why: '12 partitions allow up to 12 readers.' }, { set: 'stream', f: 'n', v: 12, why: '12 tasks of 4,000 a second = 48,000, above the 40,000 arriving.' }] },
  hotkey: { look: 'Watch Lag between second 10 and 60, then how fast it drains.', idea: 'A hot key sends most events to a few partitions, so only their readers work. Headroom decides how fast the lag drains afterwards.', change: 'Many more partitions and tasks than the steady load needs.',
    fix: [{ set: 'kafka', f: 'parts', v: 48, why: 'With a hot key a quarter of the partitions carry the load: 48 leaves 12 useful.' }, { set: 'stream', f: 'n', v: 24, why: 'Enough tasks to use those partitions and drain the backlog fast.' }] },
  dlq: { look: 'Inject nothing: the story does. Watch the stream processor drop to a tenth of its speed at second 10.', idea: 'A poison record retried forever blocks its partition (head-of-line blocking). Park failures aside and keep going.', change: 'Add a Dead-letter queue wired from the stream processor.',
    fix: [{ add: 'dlq', from: 'stream', why: 'Bad records are parked in the DLQ; good ones keep flowing.' }] },
  schema: { look: 'At second 20 the stream processor stops (load 0, Lag climbing).', idea: 'Readers depend on the shape of events. A registry with compatibility rules refuses a breaking schema at the producer, before any reader sees it.', change: 'Add a Schema registry and wire the producers to it.',
    fix: [{ add: 'registry', from: 'producer', why: 'The registry checks every schema at the producer and refuses breaking changes.' }] },
  dashboards: { look: 'The warehouse box is red: more queries than it runs at once.', idea: 'Warehouses scan big data for a few queries at a time. Dashboards need many small, fast aggregates: a serving layer for analytics.', change: 'Point the dashboards at a Real-time OLAP store (or a cache) instead of the warehouse.',
    fix: [{ reroute: 'olap', a: 'bi', b: 'wh', why: 'An OLAP store answers dashboard aggregates in tens of ms, thousands at once.' }] },
  rag: { look: 'Watch errors from second 15: the LLM API accepts only 30% of calls.', idea: 'Every call you do not make is one the provider cannot reject. Cache answers to repeated questions (a semantic cache).', change: 'Put a cache between the service and the LLM API.',
    fix: [{ insert: 'cache', a: 'svc', b: 'llm', o: { hit: 0.6 }, why: 'A semantic cache answers 60% of questions without calling the LLM.' }] },
  spark: { look: 'Lag grows from the start: the Spark job is at 100% load.', idea: 'Throughput = executors × rate per executor, as long as the topic has enough partitions to split the work.', change: 'Add Spark executors (replicas).',
    fix: [{ set: 'spark', f: 'n', v: 5, why: '5 executors of 8,000 a second = 40,000, above the 30,000 arriving.' }] },
  cdc: { look: 'Watch the CDC box from second 10 to 40, and how long Lag takes to come back down.', idea: 'After an outage a reader must handle new changes plus the backlog: spare capacity decides recovery time.', change: 'A second connector task.',
    fix: [{ set: 'cdc', f: 'n', v: 2, why: 'Two tasks double the catch-up speed after the slow spell.' }] },
  serving: { look: 'The service and Postgres are both red: 20,000 reads a second against 8,000 and 3,000 capacity.', idea: 'Scale the stateless tier out; protect the database with a cache so most reads never reach it. Keep load under about 85% or p99 climbs.', change: 'More service replicas, and a cache between the service and Postgres.',
    fix: [{ set: 'svc', f: 'n', v: 30, why: '30 × 800 = 24,000 a second: about 83% load at 20,000.' }, { insert: 'cache', a: 'svc', b: 'pg', why: '90% of reads come from memory; Postgres sees 2,000 a second.' }] },
  stampede: { look: 'At second 20 the cache misses everything and Postgres turns red.', idea: 'Size the store behind a cache for the miss rate of a cold cache, not the usual hit rate.', change: 'More read capacity on Postgres (replicas).',
    fix: [{ set: 'pg', f: 'n', v: 6, why: 'Six read copies absorb the cold-cache burst of 15,000 a second.' }] },
  failover: { look: 'From second 20 Postgres is down and errors jump to near 100%.', idea: 'Recovery time objective: how long you are down. A hot standby takes over in seconds; a rebuild takes much longer.', change: 'Turn on the hot standby for Postgres.',
    fix: [{ set: 'pg', f: 'standby', v: true, why: 'The standby takes over in 3 seconds instead of 50.' }] },
  zone: { look: 'At second 15 every box loses half its replicas; the service turns red.', idea: 'Plan for losing a zone: each tier must carry the load on half its replicas (run under 50%).', change: 'More service replicas and Postgres copies.',
    fix: [{ set: 'svc', f: 'n', v: 12, why: '6 left after the outage × 800 = 4,800 a second, above 4,000.' }, { set: 'pg', f: 'n', v: 3, why: 'Enough copies to survive the zone loss.' }] },
  budget: { look: 'Open the Cost tab: most of the bill is idle service replicas.', idea: 'Right-size from the numbers: replicas = load ÷ capacity per replica ÷ target load (about 75%).', change: 'Cut the service to about 13 replicas, Postgres and the cache to 1.',
    fix: [{ set: 'svc', f: 'n', v: 13, why: '8,000 ÷ 800 ÷ 0.77 ≈ 13 replicas.' }, { set: 'pg', f: 'n', v: 1, why: 'The cache leaves Postgres 800 reads a second.' }, { set: 'cache', f: 'n', v: 1, why: 'One cache node handles 60,000 a second.' }] },
  spike: { look: 'From second 20 traffic is 4 times higher: watch the gateway and the service.', idea: 'Auto-scaling handles spikes without paying for peak all day, but every tier must scale, including the edge.', change: 'Auto-scale the service with a high maximum, and a second gateway.',
    fix: [{ set: 'svc', f: 'auto', v: true, why: 'The service adds replicas when it passes 75% load.' }, { set: 'svc', f: 'max', v: 40, why: 'High enough for 16,000 a second.' }, { set: 'gw', f: 'n', v: 2, why: 'One gateway handles 10,000 a second; the spike is 16,000.' }] },
  partner: { look: 'From second 15 the partner API takes 10 times longer and p99 follows it.', idea: 'Do not make users wait for work they do not need right away: hand it to a queue and reply at once.', change: 'Service → Queue → Function → Partner API.',
    fix: [{ insert: 'queue', a: 'svc', b: 'ext', why: 'The service hands the call to a queue and replies at once.' }, { insert: 'fn', a: 'queue', b: 'ext', why: 'A function calls the partner in the background.' }] },
  million: { look: 'The stream tasks are all busy and lag grows: there are 128 partitions, so no more than 128 tasks can read.', idea: 'Per-partition throughput: a partition (and the one task reading it) moves a few MB a second, so partitions = peak rate ÷ per-partition rate, with headroom (module 10.3).', change: 'Raise the topic to 300 partitions, then run 300 stream tasks.',
    fix: [{ set: 'kafka', f: 'parts', v: 300, why: '1,000,000 ÷ 4,000 is 250 partitions; 300 leaves room for peaks.' }, { set: 'stream', f: 'n', v: 300, why: 'One task per partition reads them all.' }] },
  prefix: { look: 'The S3 box is red and errors are near 80%: 20,000 writes a second against 3,500 for one prefix.', idea: 'S3 request rates are per prefix: about 3,500 writes and 5,500 reads a second each (module 10.3). Spread keys over prefixes.', change: 'Write under 8 hashed prefixes (8 × 3,500 = 28,000 a second).',
    fix: [{ set: 'lake', f: 'n', v: 8, why: 'Eight hash prefixes at the start of the key give eight times the request rate.' }] },
  petabyte: { look: 'Cost is far over budget while the Spark load bar is low: 40 executors for work that needs about 10.', idea: 'Unit economics: size compute to the throughput target, and put restartable batch work on spot capacity (module 10.3, unit costs table).', change: 'Run 12 executors on spot pricing.',
    fix: [{ set: 'spark', f: 'n', v: 12, why: '80,000 ÷ 8,000 is 10 executors; 12 leaves headroom.' }, { set: 'spark', f: 'cost', v: 70, why: 'Spot capacity costs about a third of on-demand; a backfill that redoes one partition on interruption can use it.' }] },
  region: { look: 'From second 10 the second region falls behind; at second 30 the primary dies and errors jump.', idea: 'RPO is how much data you can lose (how far the replica lags); RTO is how long you are down (how fast you fail over). Design for both numbers (module 10.5).', change: 'A hot standby for the primary, and three parallel replication tasks.',
    fix: [{ set: 'pg', f: 'standby', v: true, why: 'The standby takes over in 3 seconds: an RTO of seconds.' }, { set: 'cdc', f: 'n', v: 3, why: 'Three apply tasks keep the second region seconds behind even when the link slows: an RPO of seconds.' }] }
};
const SIM_HINT_COST = [0, 5, 15, 35, 75]; /* marks lost in an exam after opening hint 1, 2, 3 or Show me */
/* apply one fix step to a design; returns the id of the box it changed or added */
function simApplyFix(d, f) {
  const byK = k => d.nodes.find(n => n.k === k), nid = p => { let i = 1; while (d.nodes.some(n => n.id === p + i) || d.edges.some(e => e.id === p + i)) i++; return p + i; };
  const mk = (k, x, y, o) => { const n = Object.assign({ id: nid('n'), k, x, y, name: SIM_K[k].t }, o || {}); d.nodes.push(n); return n; };
  const wire = (a, b) => { if (!d.edges.some(e => e.a === a && e.b === b)) d.edges.push({ id: nid('e'), a, b }); };
  if (f.set) { const n = byK(f.set); if (!n) return null; n[f.f] = f.v; return n.id; }
  if (f.add) { const a = byK(f.from); if (!a) return null; const n = byK(f.add) || mk(f.add, a.x + (SIM_K[f.add].cat === 'ops' ? 0 : 220), a.y + 160, f.o); wire(a.id, n.id); return n.id; }
  if (f.insert) { const a = byK(f.a), b = byK(f.b); if (!a || !b) return null; d.edges = d.edges.filter(e => !(e.a === a.id && e.b === b.id)); const n = mk(f.insert, Math.round((a.x + b.x) / 2), Math.round((a.y + b.y) / 2) + 110, f.o); wire(a.id, n.id); wire(n.id, b.id); return n.id; }
  if (f.reroute) { const a = byK(f.a), b = byK(f.b); if (!a) return null; d.edges = d.edges.filter(e => !(e.a === a.id && b && e.b === b.id)); const n = mk(f.reroute, (b ? b.x : a.x + 220), (b ? b.y : a.y) + 160, f.o); wire(a.id, n.id); return n.id; }
  return null;
}

/* ---------------- review: suggestions and patterns ---------------- */
function simReview(d, m) {
  const N = {}; d.nodes.forEach(n => { N[n.id] = n; });
  const ins = id => d.edges.filter(e => e.b === id).map(e => N[e.a]).filter(Boolean), outs = id => d.edges.filter(e => e.a === id).map(e => N[e.b]).filter(Boolean);
  const tips = [], pats = [];
  if (!d.nodes.some(simIsSrc)) tips.push(['Add a source', 'Nothing sends traffic yet. Add Users or Event producers and wire them in.']);
  d.nodes.forEach(n => {
    const K = SIM_K[n.k], nm = n.name || K.t, r = m && m.R[n.id];
    if (!simIsSrc(n) && !ins(n.id).length) tips.push([nm + ' gets nothing', 'No wire comes in, so it does no work. Drag from a box\'s right dot to it.']);
    if (simIsSrc(n) && !outs(n.id).length) tips.push([nm + ' is not wired', 'Its traffic goes nowhere. Wire it to the first box.']);
    if ((K.cat === 'store' || n.k === 'kafka') && (n.n || 1) < 2 && !n.standby && n.k !== 'lake') tips.push([nm + ' is a single point of failure', 'One replica and no standby: a crash stops everything that needs it. Add a replica or turn on a standby.']);
    if (n.k === 'pg' && ins(n.id).some(x => x.k === 'svc') && !ins(n.id).some(x => x.k === 'cache') && r && r.inn > 2000) tips.push(['Read load on ' + nm, 'Over 2,000 reads a second reach the database directly. A cache in front (Service → Cache → Postgres) takes most of them.']);
    if (n.k === 'ext' && ins(n.id).some(x => x.k === 'svc')) tips.push(['Partner API on the request path', 'Every request waits for ' + nm + '. Put a queue in between so a slow partner does not slow your users.']);
    if (r && r.idle) tips.push([nm + ': ' + r.idle + ' idle', 'More consumers than partitions. Raise the topic\'s partitions or remove replicas.']);
    if (r && r.u >= 0.85) tips.push([nm + ' is at ' + Math.round(r.u * 100) + '% load', 'Little headroom: latency rises fast near 100%. Add replicas or turn on auto-scale.']);
    if (n.k === 'wh' && ins(n.id).some(x => x.k === 'svc' || x.k === 'lb' || x.k === 'bi')) tips.push(['Dashboards and users on the warehouse', 'A warehouse runs a few hundred queries at once. Serve that traffic from a real-time OLAP store, a cache or a serving store loaded from it.']);
    if ((n.k === 'stream' || n.k === 'connect') && ins(n.id).some(x => x.k === 'kafka') && !outs(n.id).some(x => x.k === 'dlq')) tips.push([nm + ' has no dead-letter queue', 'One record it cannot parse will stall its partition. Wire it to a Dead-letter queue.']);
    if (n.k === 'llm' && !ins(n.id).some(x => x.k === 'cache' || x.k === 'queue')) tips.push(['Every request calls the LLM', 'Slow, rate-limited and priced per call. A semantic cache or a queue in front protects users and the bill.']);
  });
  if (d.nodes.some(n => n.k === 'kafka') && !d.nodes.some(n => n.k === 'registry')) tips.push(['No schema registry', 'Any producer can change its events and break every reader. Add a Schema registry and wire the producers to it.']);
  if (d.nodes.some(n => n.k === 'lake' || n.k === 'wh') && !d.nodes.some(n => n.k === 'dq')) tips.push(['No data quality checks', 'Bad data lands silently. Add checks where data lands (contracts, dbt tests) so problems stop before dashboards.']);
  d.nodes.forEach(n => {
    const o = outs(n.id).map(x => x.k), i = ins(n.id).map(x => x.k);
    if (n.k === 'cache' && o.some(k => k === 'pg' || k === 'kv')) pats.push(['Cache-aside', (n.name || 'Cache') + ' answers hits; misses read the store behind it.']);
    if (n.k === 'cdc') pats.push(['Change data capture', 'Changes are read from the database log, not by polling tables, so the app needs no dual writes.']);
    if (n.k === 'kafka' && o.length > 1) pats.push(['Fan-out by topic', o.length + ' independent readers each get every event and keep their own offsets.']);
    if ((n.k === 'queue' || n.k === 'kafka') && i.includes('svc')) pats.push(['Async boundary', 'The service hands work to ' + (n.name || 'the queue') + ' and replies at once; workers catch up.']);
    if (n.k === 'lb' && o.length > 1) pats.push(['Horizontal scale', 'The load balancer spreads requests over ' + o.length + ' targets.']);
    if (n.k === 'kv' && i.some(k => k === 'stream' || k === 'spark')) pats.push(['Precomputed serving', 'A pipeline writes results ahead of time so reads are simple lookups (CQRS style).']);
    if (n.standby) pats.push(['Hot standby', (n.name || SIM_K[n.k].t) + ' fails over in about 3 seconds.']);
  });
  return { tips, pats: pats.filter((p, i) => pats.findIndex(q => q[0] === p[0]) === i) };
}

/* ---------------- state ---------------- */
function simState() { if (!S.sim || typeof S.sim !== 'object') S.sim = {}; if (!S.sim.d || typeof S.sim.d !== 'object') S.sim.d = {}; if (!S.sim.done || typeof S.sim.done !== 'object') S.sim.done = {}; return S.sim; }
function simList() { return Object.values(simState().d).filter(x => x && !x.del && Array.isArray(x.nodes)).sort((a, b) => (b.at || 0) - (a.at || 0)); }
function simBlank(name) { const id = 'd' + Date.now().toString(36); return { id, name: name || 'My design', mult: 1, at: Date.now(), nodes: [{ id: 'n1', k: 'client', x: 60, y: 140, name: 'Users', rps: 1000 }], edges: [] }; }
function simPack(d) { return btoa(unescape(encodeURIComponent(JSON.stringify({ v: 1, name: d.name, mult: d.mult, sid: d.sid, nodes: d.nodes, edges: d.edges })))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function simUnpack(s) { const j = JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))); return simClean(j); }
function simClean(j) { /* imported files and links are untrusted: keep only known kinds and plain numbers */
  if (!j || !Array.isArray(j.nodes)) throw new Error('not a design');
  const num = v => (typeof v === 'number' && isFinite(v)) ? v : undefined, ids = new Set();
  const nodes = j.nodes.filter(n => n && SIM_K[n.k]).slice(0, 80).map((n, i) => { const id = String(n.id || 'n' + i).slice(0, 20); ids.add(id); const o = { id, k: n.k, x: num(n.x) || 0, y: num(n.y) || 0, name: String(n.name || SIM_K[n.k].t).slice(0, 40) }; ['n', 'cap', 'lat', 'cost', 'hit', 'parts', 'rps', 'max', 'limit'].forEach(k => { if (num(n[k]) != null) o[k] = num(n[k]); }); if (n.auto) o.auto = true; if (n.standby) o.standby = true; return o; });
  const edges = (j.edges || []).filter(e => e && ids.has(String(e.a)) && ids.has(String(e.b)) && e.a !== e.b).slice(0, 200).map((e, i) => ({ id: String(e.id || 'e' + i).slice(0, 20), a: String(e.a), b: String(e.b) }));
  return { id: 'd' + Date.now().toString(36), name: String(j.name || 'Imported design').slice(0, 60), sid: SIM_SC.some(s => s.id === j.sid) ? j.sid : undefined, mult: num(j.mult) || 1, at: Date.now(), nodes, edges };
}

/* ---------------- screen ---------------- */
const apx = (p, ...xs) => p.append(...xs.filter(x => x != null && x !== false)); /* append, skipping optional pieces */
const SIM_W = 150, SIM_H = 66, SIM_NS = 'http://www.w3.org/2000/svg';
const sv = (tag, a, kids) => { const e = document.createElementNS(SIM_NS, tag); for (const k in (a || {})) if (a[k] != null) e.setAttribute(k, a[k]); (kids || []).forEach(c => c && e.appendChild(c)); return e; };
let simTab = 'build', simScFilter = 'all', simLastD = null;
const simMode = {}, simLvl = {}; /* per challenge, this session: learn, practice or exam; hints opened outside exams */
function simEx(sid) { const st = simState(); if (!st.ex || typeof st.ex !== 'object') st.ex = {}; const x = st.ex[sid] = st.ex[sid] || {}; if (!x.cur) x.cur = { lvl: 0, rev: 0, t0: Date.now() }; return x; }
function simTeachTpl(key) { const D = typeof DATA !== 'undefined' && DATA.design && DATA.design[key]; return SIM_TPL.find(t => t.id === key) || (D && SIM_TPL.find(t => t.re.test(D.title + ' ' + D.prompt))) || SIM_TPL[3]; }
function vSim(a, b, c) {
  const st = simState();
  if (a === 'share' && b) { try { const d = simUnpack(b); st.d[d.id] = d; st.cur = d.id; save(); toast('Shared design added: ' + d.name); } catch (e) { toast('That link does not hold a design.'); } location.replace('#/sim'); return; }
  if (a === 'sc' && b) { const sc = SIM_SC.find(s => s.id === b); if (sc) { const id = 'sc-' + sc.id; if (!st.d[id] || st.d[id].del) st.d[id] = simFromSc(sc); st.cur = id; simTab = 'goal'; simLastD = id; if (c === 'exam') { simMode[sc.id] = 'exam'; const x = simEx(sc.id); if (!x.cur.lvl && !x.cur.rev) x.cur.t0 = Date.now(); } save(); } location.replace('#/sim'); return; }
  if (a === 'teach' && b) { /* Teach me this design: a module's design problem, or a starter, built box by box */
    const t = simTeachTpl(b), D = typeof DATA !== 'undefined' && DATA.design && DATA.design[b], id = 'teach-' + b;
    if (!st.d[id] || st.d[id].del) st.d[id] = { id, name: 'Learn: ' + (D ? D.title : t.t), mult: 1, at: Date.now(), nodes: [], edges: [], teach: { tpl: t.id, mid: D ? b : null, step: 0, map: {} } };
    st.cur = id; simTab = 'build'; simLastD = id; save(); location.replace('#/sim'); return; }
  let d = st.d[st.cur]; if (!d || d.del) { d = simList()[0]; if (!d) { d = simBlank(); st.d[d.id] = d; } st.cur = d.id; }
  const sc = d.sid && SIM_SC.find(s => s.id === d.sid);
  if (simLastD !== d.id) { simTab = sc ? 'goal' : 'build'; simLastD = d.id; } /* a scenario opens on its challenge */
  const mode = () => sc ? simMode[sc.id] || (st.done[sc.id] ? 'practice' : 'learn') : null;
  const lvlOf = () => !sc ? 0 : mode() === 'exam' ? simEx(sc.id).cur.lvl : Math.max(simLvl[sc.id] || 0, mode() === 'learn' ? 1 : 0);
  const gated = () => (sc && mode() === 'exam') || !!d.live; /* suggestions are hints in an exam or a live mock sketch */
  let showMsg = null, lastGrade = null, rt = SIM.newRt(d), m = null, running = false, speed = 1, sel = null, vb = { x: 0, y: 0, w: 960, h: 420 }, zones = false;
  const undo = [], redo = [];
  const snap = () => JSON.stringify({ nodes: d.nodes, edges: d.edges });
  const touch = () => { d.at = Date.now(); save(); };
  const change = fn => { lastGrade = null; undo.push(snap()); if (undo.length > 60) undo.shift(); redo.length = 0; fn(); teachSync(); touch(); draw(); panel(); };
  const restore = (from, to) => { if (!from.length) return; to.push(snap()); const j = JSON.parse(from.pop()); d.nodes = j.nodes; d.edges = j.edges; sel = null; touch(); draw(); panel(); };
  const N = id => d.nodes.find(n => n.id === id);
  const nid = p => { let i = 1; while (d.nodes.some(n => n.id === p + i) || d.edges.some(e => e.id === p + i)) i++; return p + i; };

  /* status strip: always visible */
  const strip = el('div', { class: 'simstrip', role: 'status', 'aria-live': 'off' });
  const paintStrip = () => { const cost = SIM.cost(d, rt, m && m.R).total; strip.textContent = '';
    const cell = (l, v, cls) => el('span', { class: 'simstat' + (cls ? ' ' + cls : '') }, [el('small', { text: l }), el('b', { class: 'mono', text: v })]);
    apx(strip, cell('In', m ? Math.round(m.rps).toLocaleString() + '/s' : '—'), cell('p50', m ? Math.round(m.p50) + ' ms' : '—'), cell('p99', m ? Math.round(m.p99) + ' ms' : '—', m && m.p99 > 500 ? 'bad' : ''),
      cell('Errors', m ? m.err.toFixed(1) + '%' : '—', m && m.err > 1 ? 'bad' : ''), cell('Lag', m ? (m.fresh ? m.fresh.toFixed(1) + ' s' : '0 s') : '—', m && m.fresh > 5 ? 'bad' : ''), cell('Hot spots', m ? String(m.hot.length) : '—', m && m.hot.length ? 'warn' : ''), cell('Cost', '$' + cost.toLocaleString() + '/mo'));
  };

  /* canvas */
  const cv = sv('svg', { class: 'simcv', role: 'application', 'aria-label': 'Design canvas. Drag boxes to move them; drag from a box\'s right dot to another box to wire them.', tabindex: '0' });
  const defs = sv('defs', {}, [sv('marker', { id: 'simarr', viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' }, [sv('path', { d: 'M0 0L10 5L0 10z', fill: 'var(--muted)' })])]);
  const gZ = sv('g'), gE = sv('g'), gN = sv('g'), ghost = sv('path', { class: 'simghost', d: '' });
  cv.append(defs, gZ, gE, ghost, gN);
  const setVB = () => cv.setAttribute('viewBox', [vb.x, vb.y, vb.w, vb.h].map(Math.round).join(' '));
  const pt = ev => { const r = cv.getBoundingClientRect(); return { x: vb.x + (ev.clientX - r.left) / r.width * vb.w, y: vb.y + (ev.clientY - r.top) / r.height * vb.h }; };
  const fit = () => { if (!d.nodes.length) { vb = { x: 0, y: 0, w: 960, h: 420 }; setVB(); return; } const xs = d.nodes.map(n => n.x), ys = d.nodes.map(n => n.y); const x0 = Math.min(...xs) - 40, y0 = Math.min(...ys) - 40, x1 = Math.max(...xs) + SIM_W + 40, y1 = Math.max(...ys) + SIM_H + 40; const r = cv.getBoundingClientRect(), ar = r.width && r.height ? r.width / r.height : 2.3; let w = Math.max(x1 - x0, 820), h = Math.max(y1 - y0, 260); if (w / h > ar) h = w / ar; else w = h * ar; vb = { x: x0 - (w - (x1 - x0)) / 2, y: y0 - (h - (y1 - y0)) / 2, w, h }; setVB(); };
  const inView = n => n.x >= vb.x && n.y >= vb.y && n.x + SIM_W <= vb.x + vb.w && n.y + SIM_H <= vb.y + vb.h;
  const zoom = (f, c) => { c = c || { x: vb.x + vb.w / 2, y: vb.y + vb.h / 2 }; const w = Math.min(6000, Math.max(240, vb.w * f)), h = vb.h * w / vb.w; vb = { x: c.x - (c.x - vb.x) * w / vb.w, y: c.y - (c.y - vb.y) * h / vb.h, w, h }; setVB(); };
  const ePath = (a, b) => { const x1 = a.x + SIM_W, y1 = a.y + SIM_H / 2, x2 = b.x, y2 = b.y + SIM_H / 2, k = Math.max(40, Math.abs(x2 - x1) / 2); return 'M' + x1 + ' ' + y1 + ' C' + (x1 + k) + ' ' + y1 + ' ' + (x2 - k) + ' ' + y2 + ' ' + x2 + ' ' + y2; };
  function draw() {
    gE.textContent = ''; gN.textContent = ''; gZ.textContent = '';
    if (zones) { const cols = ['src', 'edge', 'compute', 'stream', 'store', 'ext']; cols.forEach(c => { const xs = d.nodes.filter(n => SIM_K[n.k].cat === c); if (!xs.length) return; const x0 = Math.min(...xs.map(n => n.x)) - 14, x1 = Math.max(...xs.map(n => n.x)) + SIM_W + 14, y0 = Math.min(...xs.map(n => n.y)) - 34, y1 = Math.max(...xs.map(n => n.y)) + SIM_H + 14; gZ.append(sv('rect', { class: 'simzone', x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 14, style: '--c:' + SIM_CAT[c][1] }), Object.assign(sv('text', { class: 'simzt', x: x0 + 12, y: y0 + 20 }), { textContent: SIM_CAT[c][0] })); }); }
    d.edges.forEach(e => { const a = N(e.a), b = N(e.b); if (!a || !b) return; const flow = m && m.R[a.id] ? (SIM_K[a.k].async ? m.R[a.id].offer : m.R[a.id].served) : 0;
      const bad = rt.chaos.some(c => c.target === e.id && SIM.active(rt, rt.t).includes(c));
      const g = sv('g', { class: 'simedge' + (sel && sel.e === e.id ? ' on' : '') + (running && flow > 0 ? ' flow' : '') + (bad ? ' bad' : '') + (e._trace ? ' trace' : ''), 'data-id': e.id, tabindex: '0', role: 'button', 'aria-label': 'Wire from ' + (a.name || a.k) + ' to ' + (b.name || b.k) });
      const p = ePath(a, b); apx(g, sv('path', { class: 'hit', d: p }), sv('path', { class: 'ln', d: p, 'marker-end': 'url(#simarr)' }));
      g.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); sel = { e: e.id }; draw(); panel(); } });
      gE.append(g); });
    d.nodes.forEach(n => {
      const K = SIM_K[n.k], r = m && m.R[n.id], col = SIM_CAT[K.cat][1], hot = m && m.hot.includes(n.id), down = r && !simIsSrc(n) && r.cap === 0;
      const g = sv('g', { class: 'simnode' + (sel && sel.n === n.id ? ' on' : '') + (hot ? ' hot' : '') + (down ? ' down' : ''), 'data-id': n.id, 'data-k': n.k, transform: 'translate(' + n.x + ' ' + n.y + ')', tabindex: '0', role: 'button', 'aria-label': (n.name || K.t) + ', ' + K.t + (r ? ', ' + Math.round(r.inn) + ' per second, ' + Math.round((r.u || 0) * 100) + '% load' : '') });
      g.style.setProperty('--c', col);
      const tx = (x, y, s, cls) => { const t = sv('text', { x, y, class: cls }); t.textContent = s; return t; };
      apx(g, sv('rect', { class: 'box', width: SIM_W, height: SIM_H, rx: 12 }), sv('rect', { class: 'tag', x: 8, y: 8, width: 34, height: 16, rx: 4 }), tx(25, 20, K.ab, 'ab'), tx(48, 21, (n.name || K.t).slice(0, 15), 'nm'));
      const reps = rt.reps[n.id] != null ? rt.reps[n.id] : (n.n || 1);
      if (!simIsSrc(n)) apx(g, tx(SIM_W - 8, 21, '×' + reps + (n.standby ? '+S' : '') + (n.auto || K.auto ? ' A' : ''), 'rp'));
      if (r) { apx(g, tx(10, 42, Math.round(simIsSrc(n) ? r.inn : r.served).toLocaleString() + '/s' + (simIsSrc(n) ? '' : ' · ' + Math.round((r.own || 0) * (2 + 2.5 * Math.pow(Math.min(r.u, 1.2), 2))) + 'ms'), 'rd'));
        if (!simIsSrc(n)) { const u = Math.min(1, r.u || 0); apx(g, sv('rect', { class: 'ub', x: 10, y: 50, width: SIM_W - 20, height: 6, rx: 3 }), sv('rect', { class: 'uf' + (u >= 0.85 ? ' hi' : u >= 0.6 ? ' mid' : ''), x: 10, y: 50, width: Math.max(2, (SIM_W - 20) * u), height: 6, rx: 3 })); }
        if (r.lag > 1) apx(g, tx(SIM_W - 8, 42, 'lag ' + (r.fresh || 0).toFixed(1) + 's', 'lg'));
      } else apx(g, tx(10, 44, simIsSrc(n) ? ((n.rps != null ? n.rps : K.rps) * (d.mult || 1)).toLocaleString() + '/s' : (n.cap != null ? n.cap : K.cap).toLocaleString() + '/s each', 'rd sub'));
      apx(g, sv('circle', { class: 'port', cx: SIM_W, cy: SIM_H / 2, r: 9, 'data-port': n.id }), sv('circle', { class: 'inport', cx: 0, cy: SIM_H / 2, r: 4 }));
      g.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); if (sel && sel.wiring && sel.n !== n.id) { simWire(sel.n, n.id); return; } sel = { n: n.id }; simTab = 'build'; draw(); panel(); } }); /* tap or Enter on a second box while wiring finishes the wire */
      gN.append(g);
    });
    paintStrip(); paintNar();
  }
  /* pointers: drag a box, drag from its right dot to wire, drag the background to pan, two fingers to zoom */
  const pts = new Map(); let drag = null, pinch = null;
  cv.addEventListener('pointerdown', ev => {
    cv.focus({ preventScroll: true }); pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pts.size === 2) { const [p1, p2] = [...pts.values()]; pinch = { dist: Math.hypot(p1.x - p2.x, p1.y - p2.y), vb: Object.assign({}, vb) }; drag = null; return; }
    const p = pt(ev), port = ev.target.closest('[data-port]'), ng = ev.target.closest('.simnode'), eg = ev.target.closest('.simedge');
    try { cv.setPointerCapture(ev.pointerId); } catch (x) { }
    if (port) drag = { kind: 'wire', from: port.getAttribute('data-port'), p0: p, moved: false };
    else if (ng) { const n = N(ng.getAttribute('data-id')); drag = { kind: 'node', id: n.id, dx: p.x - n.x, dy: p.y - n.y, p0: p, moved: false, before: snap() }; }
    else if (eg) drag = { kind: 'edge', id: eg.getAttribute('data-id'), p0: p, moved: false };
    else drag = { kind: 'pan', c0: { x: ev.clientX, y: ev.clientY }, vb0: Object.assign({}, vb), moved: false };
  });
  cv.addEventListener('pointermove', ev => {
    if (pts.has(ev.pointerId)) pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pinch && pts.size === 2) { const [p1, p2] = [...pts.values()], dist = Math.hypot(p1.x - p2.x, p1.y - p2.y); vb = Object.assign({}, pinch.vb); zoom(pinch.dist / Math.max(20, dist)); return; }
    if (!drag) return; const p = pt(ev);
    if (Math.hypot(p.x - (drag.p0 ? drag.p0.x : 0), p.y - (drag.p0 ? drag.p0.y : 0)) > 4 || (drag.c0 && Math.hypot(ev.clientX - drag.c0.x, ev.clientY - drag.c0.y) > 4)) drag.moved = true;
    if (drag.kind === 'node' && drag.moved) { const n = N(drag.id); n.x = Math.round((p.x - drag.dx) / 10) * 10; n.y = Math.round((p.y - drag.dy) / 10) * 10; const g = gN.querySelector('[data-id="' + n.id + '"]'); if (g) g.setAttribute('transform', 'translate(' + n.x + ' ' + n.y + ')'); gE.querySelectorAll('.simedge').forEach(ge => { const e = d.edges.find(x => x.id === ge.getAttribute('data-id')); if (e && (e.a === n.id || e.b === n.id)) ge.querySelectorAll('path').forEach(pp => pp.setAttribute('d', ePath(N(e.a), N(e.b)))); }); }
    else if (drag.kind === 'wire') { const a = N(drag.from); ghost.setAttribute('d', 'M' + (a.x + SIM_W) + ' ' + (a.y + SIM_H / 2) + ' L' + p.x + ' ' + p.y); }
    else if (drag.kind === 'pan' && drag.moved) { const r = cv.getBoundingClientRect(); vb.x = drag.vb0.x - (ev.clientX - drag.c0.x) / r.width * vb.w; vb.y = drag.vb0.y - (ev.clientY - drag.c0.y) / r.height * vb.h; setVB(); }
  });
  const up = ev => {
    pts.delete(ev.pointerId); if (pinch) { if (pts.size < 2) pinch = null; return; }
    if (!drag) return; const dr = drag; drag = null; ghost.setAttribute('d', '');
    if (dr.kind === 'node') { if (dr.moved) { undo.push(dr.before); redo.length = 0; touch(); draw(); } else if (sel && sel.wiring && sel.n !== dr.id) simWire(sel.n, dr.id); else { sel = { n: dr.id }; simTab = 'build'; draw(); panel(); } }
    else if (dr.kind === 'wire') { const tgt = document.elementFromPoint(ev.clientX, ev.clientY), g = tgt && tgt.closest && tgt.closest('.simnode'); if (dr.moved && g) simWire(dr.from, g.getAttribute('data-id')); else if (!dr.moved) { sel = { n: dr.from, wiring: true }; simTab = 'build'; draw(); panel(); toast('Now tap the box to wire it to.'); } }
    else if (dr.kind === 'edge') { sel = { e: dr.id }; simTab = 'build'; draw(); panel(); }
    else if (dr.kind === 'pan' && !dr.moved) { if (sel && sel.wiring) { sel = null; } else sel = null; draw(); panel(); }
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', ev => { ev.preventDefault(); zoom(ev.deltaY > 0 ? 1.1 : 0.9, pt(ev)); }, { passive: false });
  function simWire(a, b) { if (a === b || d.edges.some(e => e.a === a && e.b === b)) { sel = null; draw(); panel(); return; } if (simIsSrc(N(b))) { toast('Sources only send traffic; wire from them, not to them.'); return; } change(() => { const id = nid('e'); d.edges.push({ id, a, b }); sel = { e: id }; }); }
  const key = ev => {
    if (!document.body.contains(cv)) return; const tg = ev.target; if (tg && /INPUT|TEXTAREA|SELECT/.test(tg.tagName)) return;
    const mod = ev.metaKey || ev.ctrlKey;
    if (mod && ev.key.toLowerCase() === 'z') { ev.preventDefault(); ev.shiftKey ? restore(redo, undo) : restore(undo, redo); }
    else if ((ev.key === 'Delete' || ev.key === 'Backspace') && sel) { ev.preventDefault(); delSel(); }
    else if (sel && sel.n && /^Arrow/.test(ev.key) && (tg === cv || cv.contains(tg))) { ev.preventDefault(); change(() => { const n = N(sel.n); const s = ev.shiftKey ? 50 : 10; if (ev.key === 'ArrowLeft') n.x -= s; if (ev.key === 'ArrowRight') n.x += s; if (ev.key === 'ArrowUp') n.y -= s; if (ev.key === 'ArrowDown') n.y += s; }); const g = gN.querySelector('[data-id="' + sel.n + '"]'); if (g) g.focus(); }
    else if (ev.key === 'Escape' && sel) { sel = null; draw(); panel(); }
  };
  document.addEventListener('keydown', key); cleanup.push(() => document.removeEventListener('keydown', key));
  function delSel() { if (!sel) return; change(() => { if (sel.n) { d.nodes = d.nodes.filter(n => n.id !== sel.n); d.edges = d.edges.filter(e => e.a !== sel.n && e.b !== sel.n); } else if (sel.e) d.edges = d.edges.filter(e => e.id !== sel.e); sel = null; }); }
  function addNode(k, at) {
    change(() => { const last = d.nodes.reduce((a, n) => !a || n.x > a.x ? n : a, null); const c = at || (last ? { x: last.x + 220, y: last.y } : { x: vb.x + vb.w / 2 - SIM_W / 2, y: vb.y + vb.h / 2 - SIM_H / 2 }); let x = Math.round(c.x / 10) * 10, y = Math.round(c.y / 10) * 10; while (d.nodes.some(n => Math.abs(n.x - x) < 30 && Math.abs(n.y - y) < 30)) { x += 30; y += 30; }
      const id = nid('n'), n = { id, k, x, y, name: SIM_K[k].t }; if (simIsSrc(n)) n.rps = SIM_K[k].rps; d.nodes.push(n);
      if (sel && sel.n && N(sel.n) && !simIsSrc(n) && N(sel.n).id !== id && !at) { d.edges.push({ id: nid('e'), a: sel.n, b: id }); n.x = N(sel.n).x + 220; n.y = N(sel.n).y; }
      sel = { n: id }; }); const nn = N(sel.n); if (nn && !inView(nn)) fit();
  }
  function layout() { /* columns by depth from the sources, rows in order */
    change(() => { const { ord } = SIM.order(d), depth = {}; ord.forEach(id => { const ins = d.edges.filter(e => e.b === id).map(e => depth[e.a]).filter(v => v != null); depth[id] = ins.length ? Math.max(...ins) + 1 : 0; });
      const cols = {}; ord.forEach(id => { (cols[depth[id]] = cols[depth[id]] || []).push(id); });
      Object.keys(cols).forEach(c => cols[c].forEach((id, i) => { const n = N(id); n.x = 40 + c * 220; n.y = 40 + i * 110 + (c % 2) * 20; })); }); fit();
  }

  /* ---- sim loop ---- */
  let loop = null;
  const tick = () => { m = SIM.step(d, rt, 0.25 * speed); draw(); if (simTab === 'metrics' || simTab === 'run' || simTab === 'cost') panelLive(); };
  const play = on => { running = on; clearInterval(loop); loop = null; if (on) loop = setInterval(tick, 250); playB.textContent = on ? 'Pause' : (m ? 'Resume' : 'Run traffic'); playB.setAttribute('aria-pressed', String(on)); draw(); };
  cleanup.push(() => clearInterval(loop));
  const playB = el('button', { class: 'btn pri sm simplay', 'aria-pressed': 'false', onclick: () => play(!running) }, 'Run traffic');
  const resetSim = () => { const ch = rt.chaos; rt = SIM.newRt(d); rt.chaos = []; m = null; play(false); void ch; draw(); panel(); };

  /* ---- toolbar ---- */
  const tb = (lbl, ic, fn) => el('button', { class: 'btn icon sm', title: lbl, 'aria-label': lbl, onclick: fn }, typeof ic === 'string' && ic.length < 3 ? ic : svg(ic, 18));
  const tools = el('div', { class: 'simtools' }, [
    tb('Zoom in', '+', () => zoom(0.8)), tb('Zoom out', '−', () => zoom(1.25)), tb('Fit to screen', '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', fit),
    tb('Auto layout', '<rect x="3" y="4" width="6" height="5" rx="1"/><rect x="15" y="4" width="6" height="5" rx="1"/><rect x="15" y="15" width="6" height="5" rx="1"/><path d="M9 6.5h6M18 9v6"/>', layout),
    tb('Layout zones', '<rect x="3" y="3" width="8" height="18" rx="2"/><rect x="13" y="3" width="8" height="18" rx="2"/>', () => { zones = !zones; draw(); }),
    tb('Undo', '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/>', () => restore(undo, redo)), tb('Redo', '<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 000 10h3"/>', () => restore(redo, undo))]);
  const canvasCard = el('section', { class: 'card simcard' }, [cv, tools, el('div', { class: 'simrun' }, [playB, el('button', { class: 'btn sm', onclick: resetSim, text: 'Reset' })])]);
  /* drag a component from the palette onto the canvas (pointer events, so it works on iPad and iPhone too) */
  const palDrag = (ev, k) => { if (ev.pointerType === 'mouse' && ev.button !== 0) return; const x0 = ev.clientX, y0 = ev.clientY; let chip = null;
    const mv = e => { if (!chip && Math.hypot(e.clientX - x0, e.clientY - y0) > 8) { chip = el('div', { class: 'simdragchip', text: SIM_K[k].t }); document.body.appendChild(chip); } if (chip) { chip.style.left = e.clientX + 'px'; chip.style.top = e.clientY + 'px'; } };
    const end = e => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', end); if (!chip) return; chip.remove(); const r = cv.getBoundingClientRect(); if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) { const p = pt(e); addNode(k, { x: p.x - SIM_W / 2, y: p.y - SIM_H / 2 }); } ev.target.dataset.dragged = '1'; setTimeout(() => { delete ev.target.dataset.dragged; }, 0); };
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', end); };

  /* ---- design picker ---- */
  const nameIn = el('input', { class: 'simname', value: d.name, 'aria-label': 'Design name', maxlength: '60' }); nameIn.addEventListener('input', () => { d.name = nameIn.value || 'Untitled'; touch(); });
  const pick = el('select', { class: 'btn sm', 'aria-label': 'Open a design', onchange: async e => { const v = e.target.value; e.target.value = d.id;
    if (v === '+new') { const nd = simBlank('Design ' + (simList().length + 1)); st.d[nd.id] = nd; st.cur = nd.id; save(); route(); }
    else if (v === '+dup') { const nd = JSON.parse(JSON.stringify(d)); nd.id = 'd' + Date.now().toString(36); nd.name = d.name + ' (copy)'; nd.at = Date.now(); delete nd.del; st.d[nd.id] = nd; st.cur = nd.id; save(); route(); }
    else if (v === '+del') { d.del = Date.now(); d.at = d.del; const was = d.id; st.cur = null; save(); toast('Design removed.', () => { delete st.d[was].del; st.d[was].at = Date.now(); st.cur = was; save(); route(); }); route(); }
    else if (v === '+imp') impIn.click();
    else if (v.startsWith('+tpl:')) { simNewFrom(v.slice(5)); route(); }
    else { st.cur = v; save(); route(); } } },
    simList().map(x => el('option', { value: x.id, selected: x.id === d.id ? 'selected' : null, text: x.name })).concat([el('option', { value: '+new', text: '+ New blank design' })].concat(SIM_TPL.map(t => el('option', { value: '+tpl:' + t.id, text: '+ Start from: ' + t.t })), [ el('option', { value: '+dup', text: 'Duplicate this design' }), el('option', { value: '+imp', text: 'Import a JSON file…' }), el('option', { value: '+del', text: 'Remove this design' })])));
  const impIn = el('input', { type: 'file', accept: '.json,application/json', class: 'sr', 'aria-label': 'Import a design file', onchange: e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => { try { const nd = simClean(JSON.parse(t)); st.d[nd.id] = nd; st.cur = nd.id; save(); toast('Imported ' + nd.name); route(); } catch (x) { toast('That file is not a design.'); } }); } });
  const dl = (blob, name) => { const a = el('a', { href: URL.createObjectURL(blob), download: name }); document.body.appendChild(a); a.click(); a.remove(); };
  const fileName = ext => (d.name || 'design').replace(/[^\w-]+/g, '-').toLowerCase() + '.' + ext;
  const exportPng = () => { const c2 = cv.cloneNode(true), r = cv.getBoundingClientRect(), cs = getComputedStyle(document.documentElement); c2.setAttribute('width', r.width * 2); c2.setAttribute('height', r.height * 2);
    let s = new XMLSerializer().serializeToString(c2); s = s.replace(/var\(--([\w-]+)\)/g, (x, v) => cs.getPropertyValue('--' + v).trim() || '#888');
    const st2 = '<style>.box{fill:' + cs.getPropertyValue('--card') + ';stroke:#888}.ln{fill:none;stroke:#888;stroke-width:2}.hit{fill:none;stroke:none}text{font:600 12px sans-serif;fill:' + cs.getPropertyValue('--ink') + '}.ab{font-size:9px;fill:#fff;text-anchor:middle}.rp,.lg{text-anchor:end}.tag{fill:#556}.ub{fill:#ddd}.uf{fill:#0B7A67}.port,.inport{fill:#888}.simghost{display:none}</style>';
    s = s.replace(/(<svg[^>]*>)/, '$1' + st2); const img = new Image(); img.onload = () => { const c = el('canvas', { width: r.width * 2, height: r.height * 2 }); const x = c.getContext('2d'); x.fillStyle = cs.getPropertyValue('--bg') || '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0); c.toBlob(b => b && dl(b, fileName('png'))); }; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s); };
  const shareUrl = () => location.href.split('#')[0] + '#/sim/share/' + simPack(d);
  const share = async () => { const u = shareUrl(); try { if (navigator.share && matchMedia('(pointer:coarse)').matches) { await navigator.share({ title: d.name, url: u }); return; } await navigator.clipboard.writeText(u); toast('Link copied. Anyone with it gets their own copy of this design.'); } catch (e) { toast('Copy this link: ' + u.slice(0, 60) + '…', null, 8000); } };
  const exportMenu = el('details', { class: 'simexp' }, [el('summary', { class: 'btn sm', text: 'Save and share' }), el('div', { class: 'simmenu' }, [
    el('button', { class: 'btn sm', onclick: () => dl(new Blob([JSON.stringify({ v: 1, name: d.name, sid: d.sid, mult: d.mult, nodes: d.nodes, edges: d.edges }, null, 1)], { type: 'application/json' }), fileName('json')), text: 'Download JSON' }),
    el('button', { class: 'btn sm', onclick: exportPng, text: 'Download picture (PNG)' }),
    el('button', { class: 'btn sm', onclick: share, text: 'Copy share link' }),
    el('button', { class: 'btn sm', onclick: () => impIn.click(), text: 'Import JSON' }),
    el('span', { class: 'muted', style: { fontSize: '13px' }, text: 'Designs save as you work and sync with your progress.' })])]);

  /* ---- side panel: one task at a time ---- */
  const TABS = [['build', 'Build'], ['run', 'Run'], ['break', 'Break'], ['metrics', 'Metrics'], ['cost', 'Cost'], ['review', 'Review'], ['goal', sc ? 'Challenge' : 'Scenarios']];
  const tabRow = el('div', { class: 'simtabs', role: 'tablist', 'aria-label': 'Simulator panels' });
  const body = el('div', { class: 'stack simbody', role: 'tabpanel' });
  const live = el('div', { class: 'stack' });
  function panel() {
    tabRow.textContent = ''; TABS.forEach(([k, t]) => tabRow.appendChild(el('button', { role: 'tab', id: 'simt_' + k, 'aria-selected': String(simTab === k), onclick: () => { simTab = k; panel(); }, text: t })));
    body.textContent = ''; live.textContent = '';
    ({ build: pBuild, run: pRun, break: pBreak, metrics: pMetrics, cost: pCost, review: pReview, goal: pGoal })[simTab]();
    paintNar(); paintCoach();
  }
  function panelLive() { if (simTab === 'run') liveRun(); else if (simTab === 'metrics') liveMetrics(); else if (simTab === 'cost') liveCost(); }
  const num = (lbl, val, set, o) => { o = o || {}; const id = 'sim_' + lbl.replace(/\W+/g, '_').toLowerCase(); const i = el('input', { type: 'number', id, inputmode: 'decimal', value: val, min: o.min != null ? o.min : 0, max: o.max, step: o.step || 1 }); i.addEventListener('change', () => { const v = +i.value; if (!isFinite(v)) return; change(() => set(Math.max(o.min != null ? o.min : 0, o.max != null ? Math.min(o.max, v) : v))); }); return el('div', { class: 'field' }, [el('label', { for: id, class: 'lbl', text: lbl }), i]); };
  const stepper = (lbl, val, set, mn, mx) => el('div', { class: 'field' }, [el('span', { class: 'lbl', text: lbl }), el('div', { class: 'row', style: { gap: '6px' } }, [el('button', { class: 'btn icon sm', 'aria-label': 'Fewer ' + lbl.toLowerCase(), onclick: () => change(() => set(Math.max(mn, val - 1))), text: '−' }), el('b', { class: 'mono simrep', text: String(val) }), el('button', { class: 'btn icon sm', 'aria-label': 'More ' + lbl.toLowerCase(), onclick: () => change(() => set(Math.min(mx, val + 1))), text: '+' })])]);
  const check = (lbl, val, set) => { const id = 'sim_c_' + lbl.replace(/\W+/g, '_').toLowerCase(); const i = el('input', { type: 'checkbox', id, checked: val ? 'checked' : null }); i.addEventListener('change', () => change(() => set(i.checked))); return el('label', { class: 'row simck', for: id }, [i, el('span', { text: lbl })]); };
  function pBuild() {
    if (sel && sel.n && N(sel.n)) {
      const n = N(sel.n), K = SIM_K[n.k];
      const nm = el('input', { value: n.name || K.t, id: 'sim_nm', maxlength: '40' }); nm.addEventListener('change', () => change(() => { n.name = nm.value.trim() || K.t; }));
      const f = [el('div', { class: 'field' }, [el('label', { for: 'sim_nm', class: 'lbl', text: 'Name' }), nm])];
      if (simIsSrc(n)) f.push(num('Requests per second', n.rps != null ? n.rps : K.rps, v => { n.rps = v; }, { step: 100 }));
      else {
        f.push(stepper('Replicas', n.n || 1, v => { n.n = v; delete rt.reps[n.id]; }, 1, 200));
        f.push(el('div', { class: 'simgrid2' }, [num('Capacity per replica (/s)', n.cap != null ? n.cap : K.cap, v => { n.cap = v; }, { step: 100 }), num('Latency at low load (ms)', n.lat != null ? n.lat : K.lat, v => { n.lat = v; }), num('Cost per replica ($/mo)', n.cost != null ? n.cost : K.cost, v => { n.cost = v; }, { step: 10 }),
          K.route === 'miss' ? num('Hit ratio (%)', Math.round(100 * (n.hit != null ? n.hit : K.hit)), v => { n.hit = Math.min(100, v) / 100; }, { max: 100 }) : null,
          n.k === 'kafka' ? num('Partitions', n.parts || K.parts, v => { n.parts = Math.max(1, v); }, { min: 1, max: 1000 }) : null,
          n.k === 'gw' ? num('Rate limit (/s, 0 = off)', n.limit || 0, v => { n.limit = v || undefined; }, { step: 100 }) : null]));
        if (K.cat === 'compute' && !K.auto) f.push(check('Auto-scale when busy', !!n.auto, v => { n.auto = v || undefined; }));
        if (n.auto || K.auto) f.push(num('Most replicas when scaling', n.max || K.max || 30, v => { n.max = Math.max(1, v); }, { min: 1, max: 500 }));
        if (K.cat === 'store' || n.k === 'kafka' || n.k === 'svc') f.push(check('Hot standby (fails over in 3 s)', !!n.standby, v => { n.standby = v || undefined; }));
      }
      apx(body, el('div', { class: 'row' }, [el('span', { class: 'simab', style: { background: SIM_CAT[K.cat][1] }, text: K.ab }), el('h3', { class: 'grow', text: K.t }), el('button', { class: 'btn sm', onclick: () => { sel = null; panel(); draw(); }, text: 'Done' })]),
        el('p', { class: 'muted', style: { margin: 0, fontSize: '14px' }, text: K.d + (K.route === 'split' ? '. Shares its traffic between the wires out.' : K.route === 'miss' ? '. Only misses go on.' : K.async ? '. Readers pull at their own pace.' : '') }), ...f,
        el('div', { class: 'row wrap', style: { gap: '8px' } }, [el('button', { class: 'btn sm', onclick: () => { sel = { n: n.id, wiring: true }; draw(); toast('Now tap the box to wire it to.'); }, text: 'Wire to…' }), el('button', { class: 'btn sm', onclick: () => change(() => { const c = JSON.parse(JSON.stringify(n)); c.id = nid('n'); c.x += 30; c.y += 30; d.nodes.push(c); sel = { n: c.id }; }), text: 'Duplicate' }), el('button', { class: 'btn sm warn', onclick: delSel, text: 'Delete' })]));
      return;
    }
    if (sel && sel.e) { const e = d.edges.find(x => x.id === sel.e); if (e) { apx(body, el('h3', { text: 'Wire' }), el('p', { style: { margin: 0 }, text: (N(e.a).name || N(e.a).k) + ' → ' + (N(e.b).name || N(e.b).k) }), el('p', { class: 'muted', style: { margin: 0, fontSize: '14px' }, text: 'Break it from the Break tab: add latency, cut it, or drop packets.' }), el('div', { class: 'row wrap', style: { gap: '8px' } }, [el('button', { class: 'btn sm', onclick: () => { simTab = 'break'; panel(); }, text: 'Break this wire' }), el('button', { class: 'btn sm warn', onclick: delSel, text: 'Delete wire' })])); return; } }
    const q = el('input', { type: 'search', class: 'simsearch', placeholder: 'Find a component', 'aria-label': 'Find a component' });
    const list = el('div', { class: 'stack', style: { gap: '10px' } });
    const fill = () => { list.textContent = ''; const s = q.value.trim().toLowerCase(); Object.keys(SIM_CAT).forEach(c => { const ks = Object.keys(SIM_K).filter(k => SIM_K[k].cat === c && (!s || (SIM_K[k].t + ' ' + SIM_K[k].d).toLowerCase().includes(s))); if (!ks.length) return;
      apx(list, el('div', { class: 'stack', style: { gap: '6px' } }, [el('span', { class: 'lbl', text: SIM_CAT[c][0] }), el('div', { class: 'simpal' }, ks.map(k => el('button', { class: 'simcomp', 'data-k': k, title: SIM_K[k].d, onpointerdown: ev => palDrag(ev, k), onclick: ev => { if (ev.currentTarget.dataset.dragged) return; addNode(k); } }, [el('span', { class: 'simab', style: { background: SIM_CAT[c][1] }, text: SIM_K[k].ab }), el('span', { class: 'grow' }, [el('b', { text: SIM_K[k].t }), el('small', { text: SIM_K[k].d })])])))])); }); };
    q.addEventListener('input', fill); fill();
    if (d.nodes.length <= 1 && !d.edges.length) apx(body, el('span', { class: 'lbl', text: 'Quick start' }), simQuickRow(id => change(() => { const t = simFromSc(SIM_TPL.find(x => x.id === id)); d.nodes = t.nodes; d.edges = t.edges; if (/^(My design|Design \d+)$/.test(d.name)) { d.name = t.name; nameIn.value = t.name; } sel = null; fit(); })), el('span', { class: 'lbl', text: 'Or build from parts' }));
    apx(body, el('p', { class: 'muted', style: { margin: 0, fontSize: '14px' }, text: 'Tap a component to add it (wired after the selected box), or drag it onto the canvas. Drag from a box\'s right dot to another box to wire them.' }), q, list);
  }
  function pRun() {
    const mult = el('input', { type: 'range', id: 'sim_mult', min: '0.25', max: '10', step: '0.25', value: d.mult || 1 }), mv = el('b', { class: 'mono', text: '×' + (d.mult || 1) });
    mult.addEventListener('input', () => { d.mult = +mult.value; mv.textContent = '×' + d.mult; touch(); if (!running) draw(); });
    apx(body, el('div', { class: 'row wrap', style: { gap: '8px' } }, [el('button', { class: 'btn pri', onclick: () => play(!running), text: running ? 'Pause' : 'Run traffic' }), el('button', { class: 'btn', onclick: resetSim, text: 'Reset' }),
      el('div', { class: 'seg', role: 'group', 'aria-label': 'Speed' }, [1, 2, 4].map(s => el('button', { 'aria-selected': String(speed === s), onclick: () => { speed = s; panel(); }, text: s + '×' })))]),
      el('div', { class: 'field' }, [el('label', { for: 'sim_mult', class: 'lbl' }, ['Traffic: every source × ', mv]), mult]),
      el('div', { class: 'row wrap', style: { gap: '8px' } }, [el('button', { class: 'btn sm', onclick: trace, text: 'Trace one request' })]), live);
    liveRun();
  }
  function trace() { /* follow one request from a source, choosing a wire the way the boxes route */
    const src = d.nodes.find(simIsSrc); if (!src) { toast('Add a source first.'); return; }
    if (!m) m = SIM.step(d, rt, 0.25);
    const hops = [], seen = new Set(), { out } = SIM.order(d), path = [];
    const walk = id => { if (seen.has(id) || hops.length > 20) return; seen.add(id); const n = N(id), K = SIM_K[n.k], r = m.R[id]; hops.push([n.name || K.t, simIsSrc(n) ? 0 : Math.round(r.own || 0), K.async ? 'returns at once; readers pick it up later' : K.route === 'miss' ? (Math.random() < (r.hit || 0) ? 'hit' : 'miss') : '']);
      if (K.route === 'miss' && hops[hops.length - 1][2] === 'hit') return; const o = out(id); if (!o.length) return; const next = K.route === 'split' ? [o[Math.floor(Math.random() * o.length)]] : o; next.forEach(e => { path.push(e); if (!K.async) walk(e.b); }); };
    walk(src.id); d.edges.forEach(e => { e._trace = path.includes(e); }); draw(); setTimeout(() => { d.edges.forEach(e => { delete e._trace; }); draw(); }, 3000);
    const tot = hops.reduce((a, h) => a + h[1], 0);
    live.prepend(el('div', { class: 'card pad stack simtrace' }, [el('b', { text: 'One request: about ' + tot + ' ms' }), el('ol', { style: { margin: 0, paddingLeft: '20px' } }, hops.map(h => el('li', { text: h[0] + (h[1] ? ' · ' + h[1] + ' ms' : '') + (h[2] ? ' · ' + h[2] : '') })))]));
  }
  function liveRun() { const box = live.querySelector('.simlive') || live.appendChild(el('div', { class: 'simlive stack' })); box.textContent = '';
    if (!m) { apx(box, el('p', { class: 'muted', style: { margin: 0 }, text: 'Run traffic to see each box\'s load. Boxes turn amber at 85% load and red when they drop requests or fall behind.' })); return; }
    apx(box, el('div', { class: 'list' }, d.nodes.filter(n => !simIsSrc(n)).map(n => { const r = m.R[n.id] || {}; return el('div', { class: 'item' }, [el('span', { class: 'grow t', text: n.name || SIM_K[n.k].t }), el('span', { class: 's mono', text: Math.round(r.served || 0).toLocaleString() + '/s · ' + Math.round((r.u || 0) * 100) + '%' + (r.drop > 0.5 ? ' · drops ' + Math.round(r.drop) + '/s' : '') + (r.lag > 1 ? ' · lag ' + (r.fresh || 0).toFixed(1) + ' s' : '') + (r.idle ? ' · ' + r.idle + ' idle' : '') })]); }))); }
  function pBreak() {
    const act = SIM.active(rt, rt.t), nm = id => { const n = N(id); if (n) return n.name || SIM_K[n.k].t; const e = d.edges.find(x => x.id === id); return e ? (N(e.a).name || '') + ' → ' + (N(e.b).name || '') : 'everything'; };
    apx(body, el('p', { class: 'muted', style: { margin: 0, fontSize: '14px' }, text: 'Select a box or wire on the canvas, then inject a failure. Traffic starts by itself. Remove a failure to watch the system recover.' }));
    if (rt.chaos.length) apx(body, el('div', { class: 'stack', style: { gap: '6px' } }, [el('span', { class: 'lbl', text: 'Active failures' })].concat(rt.chaos.map((c, i) => el('div', { class: 'row simact' }, [el('span', { class: 'grow', text: SIM_CH[c.type].t + ' · ' + nm(c.target) + (act.includes(c) ? '' : ' (scheduled)') }), el('button', { class: 'btn sm', onclick: () => { rt.chaos.splice(i, 1); panel(); draw(); }, text: 'Fix' })])))));
    SIM_CHAOS.forEach(([g, items]) => apx(body, el('div', { class: 'stack', style: { gap: '6px' } }, [el('span', { class: 'lbl', text: g })].concat(items.map(([id, t, on, ds]) => el('div', { class: 'row simchaos' }, [el('span', { class: 'grow' }, [el('b', { text: t }), el('small', { text: ds })]), el('button', { class: 'btn sm', 'data-chaos': id, onclick: () => inject(id, on), text: 'Inject' })]))))));
  }
  function inject(id, on) {
    let target = null;
    if (on === 'node') { target = sel && sel.n; const fits = { crash: k => SIM_K[k].cat !== 'src', stampede: k => SIM_K[k].route === 'miss', hot: k => k === 'kafka', broker: k => k === 'kafka', disk: k => SIM_K[k].cat === 'store', extslow: k => k === 'ext' || k === 'llm', extlimit: k => k === 'ext', lag: k => !SIM_K[k].async && SIM_K[k].cat !== 'src' }[id] || (k => SIM_K[k].cat !== 'src');
      if (id === 'backfill' && target && SIM_K[N(target).k].cat !== 'src') target = null;
      if (!target || !fits(N(target).k)) { const n = d.nodes.find(n => fits(n.k)); if (!n) { toast('No box here fits that failure.'); return; } target = n.id; } }
    if (on === 'edge') { target = sel && sel.e; if (!target) { if (!d.edges.length) { toast('Wire two boxes first.'); return; } target = d.edges[d.edges.length - 1].id; } }
    rt.chaos.push({ type: id, target, from: rt.t, to: null }); if (!running) play(true); panel(); draw(); toast(SIM_CH[id].t + ' on ' + (on === 'all' ? 'everything' : (N(target) ? N(target).name : 'the wire')) + '.');
  }
  const chart = (hist, keys, unit) => { const W = 320, H = 110, mx = Math.max(1, ...hist.map(h => Math.max(...keys.map(k => h[k[0]] || 0)))); const sx = i => 30 + i * (W - 34) / Math.max(1, hist.length - 1), sy = v => H - 16 - (v / mx) * (H - 26);
    return sv('svg', { class: 'simchart', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': keys.map(k => k[1]).join(', ') + ' over time' }, [Object.assign(sv('text', { x: 2, y: 12, class: 'ax' }), { textContent: Math.round(mx).toLocaleString() + unit }), Object.assign(sv('text', { x: 2, y: H - 18, class: 'ax' }), { textContent: '0' }), sv('line', { x1: 30, y1: H - 16, x2: W, y2: H - 16, class: 'axl' })]
      .concat(keys.map(k => sv('polyline', { class: 'pl', points: hist.map((h, i) => sx(i).toFixed(1) + ',' + sy(h[k[0]] || 0).toFixed(1)).join(' '), style: 'stroke:' + k[2] })))
      .concat(keys.map((k, i) => Object.assign(sv('text', { x: 34 + i * 92, y: H - 2, class: 'ax', style: 'fill:' + k[2] }), { textContent: '— ' + k[1] })))); };
  function pMetrics() { apx(body, live); liveMetrics(); }
  function liveMetrics() { live.textContent = '';
    if (!m) { apx(live, el('p', { class: 'muted', style: { margin: 0 }, text: 'Run traffic to fill the charts: latency, throughput, errors and lag, second by second.' }), el('button', { class: 'btn pri', style: { alignSelf: 'flex-start' }, onclick: () => play(true), text: 'Run traffic' })); return; }
    const h = rt.hist.slice(-120);
    apx(live, el('div', { class: 'simbig' }, [['Served', Math.round(m.rps * (1 - m.err / 100)).toLocaleString() + '/s'], ['p99', Math.round(m.p99) + ' ms'], ['Errors', m.err.toFixed(2) + '%'], ['Behind', (m.fresh || 0).toFixed(1) + ' s']].map(([k, v]) => el('div', {}, [el('small', { text: k }), el('b', { class: 'mono', text: v })]))),
      el('span', { class: 'lbl', text: 'Latency' }), chart(h, [['p50', 'p50', 'var(--teal)'], ['p99', 'p99', 'var(--red)']], ' ms'),
      el('span', { class: 'lbl', text: 'Throughput' }), chart(h, [['rps', 'offered', 'var(--blue)'], ['ok', 'served', 'var(--teal)']], '/s'),
      el('span', { class: 'lbl', text: 'Errors and lag' }), chart(h, [['err', 'errors %', 'var(--red)']], '%'), chart(h, [['lag', 'backlog', 'var(--amber)']], ''),
      el('span', { class: 'lbl', text: 'Hot spots' }), m.hot.length ? el('div', { class: 'list' }, m.hot.map(id => { const n = N(id), r = m.R[id]; return el('div', { class: 'item' }, [el('span', { class: 'grow t', text: n.name || SIM_K[n.k].t }), el('span', { class: 's', text: r.cap === 0 ? 'down' : r.drop > 0.5 ? 'dropping ' + Math.round(r.drop) + '/s: add replicas or put a queue in front' : (r.lag || 0) > r.inn ? 'readers behind by ' + (r.fresh || 0).toFixed(1) + ' s: more consumers or partitions' : Math.round(r.u * 100) + '% load: little headroom' })]); })) : el('span', { class: 'muted', text: 'None. Every box has headroom.' }));
  }
  function pCost() { apx(body, live); liveCost(); }
  function liveCost() { live.textContent = ''; const c = SIM.cost(d, rt, m && m.R);
    apx(live, el('div', { class: 'simbig' }, [el('div', {}, [el('small', { text: 'Per month' }), el('b', { class: 'mono', text: '$' + c.total.toLocaleString() })]), el('div', {}, [el('small', { text: 'Per 1M requests' }), el('b', { class: 'mono', text: m && m.rps ? '$' + (c.total / (m.rps * 2.628e6 / 1e6)).toFixed(3) : '—' })])]),
      el('div', { class: 'list' }, c.rows.map(([n, reps, v]) => el('div', { class: 'item' }, [el('span', { class: 'grow t', text: (n.name || SIM_K[n.k].t) }), el('span', { class: 's mono', text: '×' + reps + ' · $' + v.toLocaleString() })]))),
      el('p', { class: 'muted', style: { margin: 0, fontSize: '13.5px' }, text: 'Rough list prices for comparing designs, not a quote. Replicas added by auto-scale count while they run; serverless is priced by the requests it serves.' }));
  }
  function pReview() { const r = simReview(d, m || SIM.run(d, 10).ms.pop());
    const ex = sc && mode() === 'exam' ? simEx(sc.id) : null, seen = ex ? ex.cur.rev : d.live ? d.revSeen : true;
    let tips;
    if (gated() && !seen) tips = el('button', { class: 'btn sm', id: 'sim_revgate', onclick: () => {
      if (ex) ex.cur.rev = 1; else { d.revSeen = 1; const lv = S.live && S.live[d.live.k], x = lv && lv.ans && lv.ans[d.live.i]; if (x) x.simHints = (x.simHints || 0) + 1; }
      touch(); save(); panel(); }, text: 'Show ' + r.tips.length + ' suggestion' + (r.tips.length === 1 ? '' : 's') + (ex ? ' (−5 marks)' : ' (−0.25 on this answer)') });
    else tips = r.tips.length ? el('div', { class: 'stack', style: { gap: '8px' } }, r.tips.map(([t, x]) => el('div', { class: 'simtip' }, [el('b', { text: t }), el('span', { text: x })]))) : el('span', { class: 'muted', text: 'Nothing to flag. Try breaking it.' });
    apx(body, el('span', { class: 'lbl', text: 'Suggestions' }), tips,
      el('span', { class: 'lbl', text: 'Patterns in this design' }), r.pats.length ? el('div', { class: 'stack', style: { gap: '8px' } }, r.pats.map(([t, x]) => el('div', { class: 'simtip pat' }, [el('b', { text: t }), el('span', { text: x })]))) : el('span', { class: 'muted', text: 'None recognised yet: caches, topics, queues and CDC are named here when you use them.' }));
  }
  /* Show me: play the fix on the canvas one step at a time, each with its reason */
  function showMe() {
    const fx = SIM_HINTS[sc.id].fix; let k = 0;
    const next = () => { if (!document.body.contains(cv)) return; if (k >= fx.length) { showMsg = null; toast('Done. Now press ' + (mode() === 'exam' ? 'Submit' : 'Check my design') + '.'); draw(); return; }
      const f = fx[k++]; let id = null; change(() => { id = simApplyFix(d, f); }); if (id) sel = { n: id }; showMsg = 'Show me, step ' + k + ' of ' + fx.length + ': ' + f.why; draw(); panel(); setTimeout(next, 1600); };
    next();
  }
  function openHint(L) { if (mode() === 'exam') { const x = simEx(sc.id); x.cur.lvl = Math.max(x.cur.lvl, L); touch(); } else simLvl[sc.id] = Math.max(simLvl[sc.id] || 0, L); save(); panel(); if (L === 4) showMe(); }
  function pGoal() {
    if (sc) {
      const md = mode(), ex = simEx(sc.id), L = lvlOf(), H = SIM_HINTS[sc.id], g = lastGrade, out = el('div', { class: 'stack simresult' });
      if (g) apx(out, el('div', { class: 'list' }, g.res.map(([k, v, want, ok]) => el('div', { class: 'item' }, [el('span', { class: 'grow t', text: (ok ? '✓ ' : '✗ ') + k }), el('span', { class: 's mono', text: v + ' (' + want + ')' })]))),
        g.exam ? el('p', { class: 'simscore', style: { margin: 0 } }, [el('b', { text: 'Exam score: ' + g.exam.score + ' / 100' }), ' · goals met ' + g.exam.hit + '%' + (g.exam.cost ? ', hints −' + g.exam.cost : ', no hints') + ' · ' + Math.floor(g.exam.secs / 60) + ' min ' + (g.exam.secs % 60) + ' s']) : null,
        el('p', { class: g.pass ? 'simpass' : 'simfail', style: { margin: 0 }, text: g.pass ? 'Passed. In an interview, say why: which box limited you, and what you changed.' : md === 'exam' ? 'Not yet. Change the design and submit again (a new attempt), or open a hint.' : 'Not yet. Open the next hint below if you are stuck.' }));
      const seg = el('div', { class: 'seg simmode', role: 'tablist', 'aria-label': 'Mode' }, [['learn', 'Learn'], ['practice', 'Practice'], ['exam', 'Exam']].map(([k, t]) => el('button', { role: 'tab', 'aria-selected': String(md === k), 'data-mode': k, onclick: () => { simMode[sc.id] = k; if (k === 'exam' && !ex.cur.lvl && !ex.cur.rev) ex.cur.t0 = Date.now(); lastGrade = null; panel(); draw(); }, text: t })));
      const modeNote = { learn: 'Learn: hints open as you go and nothing is scored.', practice: 'Practice: hints are free; passing earns XP.', exam: 'Exam: hints cost marks (−5, −10, −20, −40; suggestions −5). Score = goals met minus hints.' }[md];
      const names = ['Where to look', 'The idea', 'What to change', 'Show me'], costs = [5, 10, 20, 40];
      const ladder = el('div', { class: 'stack simhints', style: { gap: '8px' } }, [el('span', { class: 'lbl', text: 'Hints' })]);
      [H.look, H.idea, H.change, null].forEach((txt, j) => { const n = j + 1;
        if (L >= n) apx(ladder, el('div', { class: 'simhint', 'data-h': n }, [el('b', { text: n + ' · ' + names[j] }), n < 4 ? el('span', { text: txt + (n === 2 ? ' (Module ' + modLabel(sc.mid) + ')' : '') }) : el('ol', { style: { margin: 0, paddingLeft: '20px' } }, H.fix.map(f => el('li', { text: f.why }))), n === 4 ? el('button', { class: 'btn sm', style: { alignSelf: 'flex-start' }, onclick: showMe, text: 'Play it again on the canvas' }) : null]));
        else if (L === n - 1) apx(ladder, el('button', { class: 'btn sm simhbtn', 'data-h': n, style: { alignSelf: 'flex-start' }, onclick: () => openHint(n), text: 'Hint ' + n + ': ' + names[j] + (md === 'exam' ? ' (−' + costs[j] + ')' : '') })); });
      if (md !== 'exam' && m) { const t = simReview(d, m).tips[0]; if (t) apx(ladder, el('div', { class: 'simtip' }, [el('b', { text: 'The simulator sees: ' + t[0] }), el('span', { text: t[1] })])); }
      apx(body, el('div', { class: 'row wrap', style: { gap: '6px' } }, [el('span', { class: 'chip c-arch', text: 'Module ' + modLabel(sc.mid) }), el('span', { class: 'chip c-test', text: sc.lvl }), st.done[sc.id] ? el('span', { class: 'chip c-dsa', text: '✓ Passed ' + shortDate(st.done[sc.id]) }) : null, ex.best != null ? el('span', { class: 'chip c-ai', text: 'Best exam ' + ex.best }) : null]),
        el('h3', { text: sc.t }), seg, el('span', { class: 'muted', style: { fontSize: '13.5px' }, text: modeNote }), el('p', { style: { margin: 0 }, text: sc.q }),
        el('div', { class: 'row wrap', style: { gap: '8px' } }, [el('button', { class: 'btn pri', id: 'sim_check', onclick: () => { const g = lastGrade = SIM.grade(d, sc);
          if (md === 'exam') { const hit = Math.round(100 * g.res.filter(r => r[3]).length / g.res.length), cost = SIM_HINT_COST[ex.cur.lvl] + (ex.cur.rev ? 5 : 0);
            g.exam = { score: Math.max(0, hit - cost), hit, cost, lvl: ex.cur.lvl, secs: Math.round((Date.now() - (ex.cur.t0 || Date.now())) / 1000) };
            ex.last = Object.assign({ at: Date.now(), pass: g.pass }, g.exam); ex.best = Math.max(ex.best || 0, g.exam.score); ex.cur = { lvl: 0, rev: 0, t0: Date.now() }; }
          if (g.pass && !(md === 'exam' && g.exam.lvl >= 4) && !st.done[sc.id]) { st.done[sc.id] = iso(new Date()); if (typeof gameNote === 'function') try { gameNote('sim'); } catch (e) { } }
          touch(); save(); const ch = simChaosFor(d, sc.chaos); resetSim(); rt.chaos = ch; play(true); }, text: md === 'exam' ? 'Submit my design' : 'Check my design' }),
          el('button', { class: 'btn', onclick: () => { rt.chaos = simChaosFor(d, sc.chaos); rt.t = 0; play(true); }, text: 'Watch it play' }),
          md !== 'exam' ? el('a', { class: 'btn', href: '#/learn/' + sc.mid, text: 'Open the module' }) : null,
          el('button', { class: 'btn sm', onclick: () => { st.d[d.id] = Object.assign(simFromSc(sc), { from: d.from }); save(); route(); }, text: 'Start over' })]),
        out, ladder,
        ex.last ? el('span', { class: 'muted', style: { fontSize: '13.5px' }, text: 'Last exam: ' + ex.last.score + ' / 100' + (ex.last.cost ? ' (hints −' + ex.last.cost + ')' : '') + ' on ' + shortDate(iso(new Date(ex.last.at))) + '.' }) : null,
        el('span', { class: 'lbl', text: 'Other scenarios' }));
    } else apx(body, el('p', { class: 'muted', style: { margin: 0, fontSize: '14px' }, text: 'Each scenario opens a starting design that fails on purpose. Fix it until Check my design passes. Your edits are kept.' }),
      el('span', { class: 'lbl', text: 'Learn a design box by box' }), el('div', { class: 'simquick' }, SIM_TPL.map(t => el('a', { class: 'simqbtn', href: '#/sim/teach/' + t.id }, [el('b', { text: 'Teach me: ' + t.t }), el('small', { text: t.s })]))));
    const mods = [...new Set(SIM_SC.map(s => s.mid))];
    apx(body, el('div', { class: 'simchips', role: 'group', 'aria-label': 'Filter scenarios' }, [['all', 'All']].concat(mods.map(x => [x, modLabel(x)]), [['Beginner', 'Beginner'], ['Intermediate', 'Intermediate'], ['Advanced', 'Advanced'], ['Staff', 'Staff scale']]).map(([k, t]) => el('button', { class: 'chip', 'aria-pressed': String(simScFilter === k), onclick: () => { simScFilter = k; panel(); }, text: t }))),
      el('div', { class: 'stack', style: { gap: '8px' } }, SIM_SC.filter(s => s.id !== d.sid && (simScFilter === 'all' || s.mid === simScFilter || s.lvl === simScFilter)).map(s => el('a', { class: 'simsc', href: '#/sim/sc/' + s.id, 'data-sc': s.id }, [el('span', { class: 'grow' }, [el('b', { text: (st.done[s.id] ? '✓ ' : '') + s.t }), el('small', { text: modLabel(s.mid) + ' · ' + modTitle(s.mid) + ' · ' + s.lvl })])]))));
  }

  /* ---- what is happening: one sentence from the tab, the selection, run state, failures and the challenge ---- */
  const nar = el('p', { class: 'simnar', id: 'sim_nar' });
  const fmt = v => Math.round(v || 0).toLocaleString(), nmOf = n => n ? n.name || SIM_K[n.k].t : '';
  const tname = id => { const n = N(id); if (n) return nmOf(n); const e = d.edges.find(x => x.id === id); return e ? nmOf(N(e.a)) + ' → ' + nmOf(N(e.b)) : 'everything'; };
  const why = id => { const r = m && m.R[id]; if (!r) return ''; return r.cap === 0 ? ' (down)' : r.drop > 0.5 ? ' (dropping ' + fmt(r.drop) + ' a second)' : (r.lag || 0) > r.inn ? ' (readers ' + (r.fresh || 0).toFixed(1) + ' s behind)' : ' (' + Math.round(r.u * 100) + '% load)'; };
  function narrate() {
    if (showMsg) return showMsg;
    const act = SIM.active(rt, rt.t), parts = [];
    if (sel && sel.n && N(sel.n)) {
      const n = N(sel.n), K = SIM_K[n.k], r = m && m.R[n.id], cap = n.cap != null ? n.cap : K.cap, reps = rt.reps[n.id] != null ? rt.reps[n.id] : (n.n || 1);
      if (sel.wiring) parts.push('Wiring from ' + nmOf(n) + ': tap the box it should send to.');
      else if (!r) parts.push(nmOf(n) + ': ' + (simIsSrc(n) ? 'sends ' + fmt((n.rps != null ? n.rps : K.rps) * (d.mult || 1)) + ' a second.' : 'one replica handles ' + fmt(cap) + ' a second at about ' + (n.lat != null ? n.lat : K.lat) + ' ms; ' + reps + ' replica' + (reps > 1 ? 's' : '') + ' = ' + fmt(cap * reps) + ' a second.' + (K.route === 'split' ? ' It shares traffic between its wires out.' : K.route === 'miss' ? ' Only misses go to the box behind it.' : K.async ? ' Readers pull from it at their own pace.' : '')));
      else if (simIsSrc(n)) parts.push(nmOf(n) + ' sends ' + fmt(r.inn) + ' a second' + (r.ok < 0.99 ? '; ' + Math.round(100 * (1 - r.ok)) + '% of them fail somewhere downstream.' : '; all of them succeed.'));
      else if (r.cap === 0) parts.push(nmOf(n) + ' is down: ' + (K.async || K.tail ? 'work piles up as lag until it is back.' : 'every request that needs it fails.') + (n.standby ? ' Its standby takes over in 3 s.' : ' A standby would take over in 3 s.'));
      else { let t = nmOf(n) + ' takes ' + fmt(r.inn) + ' a second and ' + (K.async ? 'stores them' : 'handles ' + fmt(r.served)) + ' at ' + Math.round(r.u * 100) + '% load on ' + reps + ' replica' + (reps > 1 ? 's' : '');
        if (K.route === 'miss') t += '; ' + Math.round((r.hit || 0) * 100) + '% are hits, the rest go on';
        if (n.k === 'kafka') t += '; ' + (n.parts || K.parts) + ' partitions let at most that many readers work';
        if (r.idle) t += '; ' + r.idle + ' replicas sit idle (more readers than partitions)';
        if ((r.lag || 0) > 1) t += '; readers are ' + (r.fresh || 0).toFixed(1) + ' s behind';
        if (r.drop > 0.5) t += '; it drops ' + fmt(r.drop) + ' a second';
        if (r.poison) t += '; bad records are ' + r.poison; if (r.schema) t += '; the schema change is ' + r.schema;
        if (r.u >= 0.85 && !r.drop) t += '; near full, so latency climbs';
        parts.push(t + '.'); }
    } else if (sel && sel.e) { const e = d.edges.find(x => x.id === sel.e); if (e) { const c = act.find(x => x.target === e.id); parts.push('Wire ' + tname(e.id) + (m && e._v != null ? ': carries ' + fmt(e._v) + ' a second' : '') + (c ? '; ' + SIM_CH[c.type].t.toLowerCase() + ' is active on it' : '') + '.'); } }
    const tc = d.teach && SIM_TPL.find(t => t.id === d.teach.tpl);
    const T = {
      build: () => sel ? 'Change it in the panel, or tap another box.' : tc ? 'Lesson: ' + Object.keys(d.teach.map).length + ' of ' + tc.nodes.length + ' boxes placed' + (tStep()[d.teach.step] && tStep()[d.teach.step].k ? '. Tap Add it for me, or add the highlighted part from the Build list below.' : '.') : d.nodes.length + ' boxes and ' + d.edges.length + ' wires. Tap a part to add it; drag from a box\'s right dot to wire it.',
      run: () => running && m ? 'Traffic is running: ' + fmt(m.rps) + ' a second in, p99 ' + fmt(m.p99) + ' ms, ' + m.err.toFixed(1) + '% errors' + (m.fresh > 0.5 ? ', ' + m.fresh.toFixed(1) + ' s behind' : '') + '.' : (m ? 'Paused. Run traffic to continue' : 'Press Run traffic to send requests through the design') + ' (traffic × ' + (d.mult || 1) + ').',
      break: () => act.length ? act.map(c => SIM_CH[c.type].t + (c.target ? ' on ' + tname(c.target) : '')).join(', ') + ' active' + (m ? ': ' + m.err.toFixed(1) + '% errors, ' + (m.fresh || 0).toFixed(1) + ' s behind.' : '.') : sel ? 'Inject a failure to hit the selected ' + (sel.e ? 'wire.' : 'box.') : 'Select a box or wire, then inject a failure to see how the design copes.',
      metrics: () => !m ? 'Run traffic to fill the charts.' : m.hot.length ? 'Weakest point: ' + tname(m.hot[0]) + why(m.hot[0]) + '.' : 'No hot spots: every box has headroom.',
      cost: () => { const c = SIM.cost(d, rt, m && m.R), top = c.rows.slice().sort((x, y) => y[2] - x[2])[0]; return '$' + fmt(c.total) + ' a month' + (top && c.total ? '; the biggest line is ' + nmOf(top[0]) + ' at ' + Math.round(100 * top[2] / c.total) + '%' : '') + (sel && sel.n && c.total ? '; the selected box is ' + Math.round(100 * ((c.rows.find(r => r[0].id === sel.n) || [0, 0, 0])[2]) / c.total) + '% of it' : '') + '.'; },
      review: () => { const r = simReview(d, m); return r.tips.length + ' suggestion' + (r.tips.length === 1 ? '' : 's') + ' and ' + r.pats.length + ' pattern' + (r.pats.length === 1 ? '' : 's') + ' recognised' + (!gated() && r.tips[0] ? '. First: ' + r.tips[0][0] + '.' : '.'); },
      goal: () => sc ? (mode() === 'exam' ? 'Exam: ' + sc.t + '. Hints cost marks; submit when ready.' : (mode() === 'learn' ? 'Learn: ' : 'Practice: ') + sc.t + (st.done[sc.id] ? ' (passed before).' : '. Fix the design, then check it.')) : 'Pick a scenario: each opens a design that fails on purpose.'
    };
    parts.push(T[simTab]());
    if (simTab !== 'break' && act.length && running) parts.push('Failure active: ' + act.map(c => SIM_CH[c.type].t.toLowerCase()).join(', ') + '.');
    return parts.join(' ');
  }
  const paintNar = () => { const t = narrate(); if (nar.textContent !== t) nar.textContent = t; };

  /* ---- Teach me this design: a lesson card above the canvas ---- */
  const coach = el('section', { class: 'card pad stack simcoach', 'aria-label': 'Lesson' });
  const tStep = () => { const t = SIM_TPL.find(x => x.id === d.teach.tpl), D = d.teach.mid && DATA.design && DATA.design[d.teach.mid];
    return [{ t: 'Requirements', x: (D ? D.prompt : t.t + ': ' + t.s + '.') + ' In an interview, start here: who uses it, how much data, how fresh, what must never break.' }, { t: 'Estimate', x: t.teach.est }]
      .concat(t.nodes.map((nd, i) => Object.assign({ t: 'Add: ' + SIM_K[nd[0]].t, k: nd[0], i }, t.teach.steps[i])))
      .concat([{ t: 'Run it', act: 'run', x: 'Press Run traffic. The wires start flowing; each box shows its load. Tap any box to read what it is doing.' },
        { t: 'Break it', act: 'break', x: t.teach.brk.t + '. Inject it and watch the numbers in the top bar.' },
        { t: 'Fix it', act: 'fix', x: t.teach.fix.map(f => f.why).join(' ') },
        { t: 'Say it in the interview', x: t.teach.say }]); };
  function teachSync() { /* a box the learner added from the palette counts for the current step: put it in place and wire it */
    if (!d.teach) return; const steps = tStep(), sp = steps[d.teach.step]; if (!sp || sp.k == null) return;
    const used = new Set(Object.values(d.teach.map)), n = d.nodes.find(x => x.k === sp.k && !used.has(x.id)); if (!n) return;
    placeT(sp.i, n); d.teach.step++; requestAnimationFrame(fit); }
  function placeT(i, n) { const t = SIM_TPL.find(x => x.id === d.teach.tpl), nd = t.nodes[i]; n.x = nd[1]; n.y = nd[2]; Object.assign(n, nd[3] || {}); d.teach.map[i] = n.id;
    d.edges = d.edges.filter(e => e.b !== n.id || Object.values(d.teach.map).includes(e.a));
    t.edges.forEach(([a, b]) => { const A = d.teach.map[a], B = d.teach.map[b]; if (A && B && !d.edges.some(e => e.a === A && e.b === B)) d.edges.push({ id: nid('e'), a: A, b: B }); }); }
  function paintCoach() {
    if (!d.teach) { coach.style.display = 'none'; return; } coach.style.display = '';
    const steps = tStep(), k = Math.min(d.teach.step, steps.length - 1), sp = steps[k], t = SIM_TPL.find(x => x.id === d.teach.tpl);
    const go = j => { d.teach.step = Math.max(0, Math.min(steps.length - 1, j)); if (d.teach.step === steps.length - 1) { st.taught = st.taught || {}; st.taught[d.teach.mid || t.id] = iso(new Date()); } touch(); paintCoach(); paintNar(); };
    let actB = null;
    if (sp.k != null) actB = el('button', { class: 'btn pri sm', id: 'sim_teach_add', onclick: () => { change(() => { const id = nid('n'), n = { id, k: sp.k, x: 0, y: 0, name: SIM_K[sp.k].t }; if (SIM_K[sp.k].cat === 'src') n.rps = SIM_K[sp.k].rps; d.nodes.push(n); placeT(sp.i, n); d.teach.step++; sel = null; simTab = 'build'; }); fit(); } }, 'Add it for me');
    else if (sp.act === 'run') actB = el('button', { class: 'btn pri sm', onclick: () => { play(true); go(k + 1); } }, 'Run traffic');
    else if (sp.act === 'break') actB = el('button', { class: 'btn pri sm', onclick: () => { rt.chaos = simChaosFor(d, [{ type: t.teach.brk.type, on: t.teach.brk.on }]).map(c => Object.assign(c, { from: rt.t })); play(true); simTab = 'metrics'; panel(); go(k + 1); } }, 'Inject it');
    else if (sp.act === 'fix') actB = el('button', { class: 'btn pri sm', onclick: () => { change(() => t.teach.fix.forEach(f => simApplyFix(d, f))); go(k + 1); } }, 'Fix it for me');
    coach.textContent = '';
    apx(coach, el('div', { class: 'row wrap', style: { gap: '8px' } }, [el('span', { class: 'lbl grow', text: 'Lesson · step ' + (k + 1) + ' of ' + steps.length }), el('span', { class: 'simdots', 'aria-hidden': 'true' }, steps.map((x, j) => el('i', { class: j < k ? 'd' : j === k ? 'c' : '' })))]),
      el('b', { class: 'simct', text: sp.t }), el('p', { style: { margin: 0 }, text: sp.why || sp.x }),
      (sp.alt && sp.alt !== '-') || (sp.cost && sp.cost !== '-') ? el('details', { class: 'simwhy' }, [el('summary', { text: 'Instead of this, and the cost' }), sp.alt && sp.alt !== '-' ? el('p', { text: 'Instead: ' + sp.alt }) : null, sp.cost && sp.cost !== '-' ? el('p', { text: 'Cost: ' + sp.cost }) : null]) : null,
      el('div', { class: 'row wrap', style: { gap: '8px' } }, [k > 0 ? el('button', { class: 'btn sm', onclick: () => go(k - 1), text: 'Back' }) : null, actB, k < steps.length - 1 ? el('button', { class: 'btn sm' + (actB ? '' : ' pri'), id: 'sim_teach_next', onclick: () => go(k + 1), text: 'Next' }) : el('a', { class: 'btn sm pri', href: d.teach.mid ? '#/design/' + d.teach.mid : '#/sim', text: d.teach.mid ? 'Write it up in the studio' : 'Done' })]));
    document.querySelectorAll('.simpulse').forEach(x => x.classList.remove('simpulse'));
    if (sp.k != null) { const pc = body.querySelector('.simcomp[data-k="' + sp.k + '"]'); if (pc) pc.classList.add('simpulse'); }
    if (sp.act === 'run') playB.classList.add('simpulse');
  }

  const head = el('div', { class: 'row wrap simhead' }, [nameIn, pick, exportMenu, impIn]);
  const backTo = d.from && /^#\/(live|mock|design|quiz|learn|interview)\b/.test(d.from) ? el('a', { class: 'btn sm pri', href: d.from, text: 'Back to the question' }) : null; if (backTo) head.prepend(backTo);
  shell('Design simulator', 'System design', [el('div', { class: 'stack simwrap' }, [head, strip, nar, coach, el('div', { class: 'simgrid' }, [canvasCard, el('section', { class: 'card pad stack simside' }, [tabRow, body])])])], { back: '#/design' });
  panel(); draw(); requestAnimationFrame(fit);
  window.simDebug = { get d() { return d; }, get rt() { return rt; }, get m() { return m; }, play, step: () => tick(), narrate, get sel() { return sel; }, set sel(v) { sel = v; draw(); panel(); } };
}

/* ---------------- quick start and the weekly program ---------------- */
/* starter designs for a fast start, on a phone too: one tap, then edit */
const SIM_TPL = [
  { id: 'stream', t: 'Streaming pipeline', s: 'Producers, registry, Kafka, stream job, serving store, lake, DLQ', re: /stream|kafka|real.?time|event|click|flink|lag/i,
    nodes: [['producer', 40, 140, { rps: 5000 }], ['registry', 40, 300], ['kafka', 260, 140, { n: 3, parts: 12 }], ['stream', 480, 140, { n: 3, max: 12 }], ['kv', 720, 60, { n: 2 }], ['lake', 720, 220], ['dlq', 480, 300]], edges: [[0, 1], [0, 2], [2, 3], [3, 4], [3, 5], [3, 6]] },
  { id: 'batch', t: 'Batch lakehouse', s: 'File drops, lake, Spark, quality checks, dbt, warehouse, dashboards', re: /batch|lake|warehouse|nightly|etl|elt|dbt|spark|iceberg|delta/i,
    nodes: [['files', 40, 140, { rps: 200 }], ['lake', 240, 140], ['spark', 440, 140, { n: 2 }], ['dq', 640, 140], ['dbt', 840, 140], ['wh', 1040, 140], ['bi', 840, 300, { rps: 40 }]], edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [6, 5]] },
  { id: 'cdc', t: 'CDC to the lake', s: 'App, Postgres, CDC, Kafka, Connect sink, lake', re: /cdc|change data|debezium|replicat|source of truth|outbox|sync/i,
    nodes: [['client', 40, 60, { rps: 1500 }], ['svc', 240, 60, { n: 3 }], ['pg', 440, 60, { n: 2 }], ['cdc', 440, 220], ['kafka', 640, 220, { parts: 6 }], ['connect', 840, 160], ['lake', 1040, 160], ['stream', 840, 300], ['kv', 1040, 300]], edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [4, 7], [7, 8]] },
  { id: 'serving', t: 'Serving API', s: 'Users, load balancer, service, cache, serving store', re: /serv|api|read|lookup|low.?latency|feature|recommend|profile/i,
    nodes: [['client', 40, 140, { rps: 5000 }], ['lb', 240, 140], ['svc', 440, 140, { n: 8, auto: true, max: 40 }], ['cache', 640, 140], ['kv', 840, 140, { n: 2 }]], edges: [[0, 1], [1, 2], [2, 3], [3, 4]] },
  { id: 'analytics', t: 'Real-time analytics', s: 'Events to Kafka to an OLAP store for dashboards', re: /dashboard|analytic|olap|metric|bi\b|aggregate|report/i,
    nodes: [['producer', 40, 60, { rps: 8000 }], ['kafka', 260, 60, { parts: 12 }], ['olap', 480, 140, { n: 5 }], ['bi', 260, 240, { rps: 200 }], ['lake', 480, 300]], edges: [[0, 1], [1, 2], [3, 2], [1, 4]] },
  { id: 'rag', t: 'RAG assistant', s: 'Service, embedding model, vector store, cache, LLM', re: /rag|llm|vector|embed|retriev|agent|ai\b|genai/i,
    nodes: [['client', 40, 140, { rps: 20 }], ['svc', 240, 140, { n: 2 }], ['embed', 460, 60], ['vector', 680, 60], ['cache', 460, 220, { hit: 0.2 }], ['llm', 680, 220]], edges: [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5]] },
  /* the classic web-app interview topics (Interview loop, design round); kept out of the quick-start row */
  { id: 'url', swe: true, t: 'URL shortener', s: 'Users, load balancer, service, cache, key-value store', re: /url|short|tinyurl|bit\.?ly|link/i,
    nodes: [['client', 40, 140, { rps: 12000 }], ['lb', 240, 140], ['svc', 440, 140, { n: 20, auto: true, max: 60 }], ['cache', 640, 140, { hit: 0.9 }], ['kv', 840, 140, { n: 1 }]], edges: [[0, 1], [1, 2], [2, 3], [3, 4]] },
  { id: 'chat', swe: true, t: 'Chat system', s: 'Users, load balancer, connection servers, Kafka, delivery workers, message store', re: /chat|messag|whatsapp|slack|inbox/i,
    nodes: [['client', 40, 140, { rps: 15000 }], ['lb', 240, 140], ['svc', 440, 140, { n: 25, auto: true, max: 60 }], ['kafka', 640, 140, { n: 3, parts: 12 }], ['stream', 840, 140, { n: 6 }], ['kv', 1040, 140, { n: 2 }]], edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]] },
  { id: 'ride', swe: true, t: 'Ride-hailing', s: 'Driver locations through Kafka into a geo index; riders query it through an API', re: /ride|uber|lyft|taxi|driver|geo|location/i,
    nodes: [['producer', 40, 60, { rps: 10000 }], ['kafka', 260, 60, { n: 3, parts: 24 }], ['stream', 480, 60, { n: 4 }], ['kv', 700, 140, { n: 2 }], ['client', 40, 240, { rps: 1500 }], ['lb', 260, 240], ['svc', 480, 240, { n: 4, auto: true, max: 20 }]], edges: [[0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [6, 3]] },
  { id: 'video', swe: true, t: 'Video streaming', s: 'Viewers through a CDN to object storage; uploads queued for transcoding', re: /video|youtube|netflix|stream(ing)? platform|transcod/i,
    nodes: [['client', 40, 60, { rps: 40000 }], ['cdn', 260, 60, { hit: 0.95 }], ['lake', 480, 140], ['files', 40, 240, { rps: 100 }], ['queue', 260, 240], ['fn', 480, 300]], edges: [[0, 1], [1, 2], [3, 4], [4, 5], [5, 2]] }
];
/* Teach me this design: one step per box (why it is there, what you could use instead, what it costs), then run, break and fix */
const SIM_TEACH = {
  stream: { est: '5,000 events a second at peak, about 430 million a day. Readers need them within seconds; history goes to the lake.',
    steps: [
      { why: 'Apps and devices emit events. Start every design from who sends what, and how much.', alt: 'Batch files instead, if minutes of delay are fine.', cost: 'Free here; you pay where events land.' },
      { why: 'Every producer registers its event schema; breaking changes are refused before any reader sees them.', alt: 'Schemas in a shared code library: works until one team deploys late.', cost: 'Small: one cheap service.' },
      { why: 'Kafka keeps events in order per key and lets many readers replay them. Partitions (12 here) cap how many readers can work at once.', alt: 'A queue (SQS) if each message has exactly one consumer and replay does not matter.', cost: '3 brokers, the biggest fixed cost of the pipeline.' },
      { why: 'The stream processor (Flink or Spark Structured Streaming) cleans, joins and aggregates events as they arrive.', alt: 'Micro-batches every few minutes, if seconds of freshness are not needed.', cost: '3 tasks; can auto-scale up to the partition count.' },
      { why: 'A serving store holds results keyed for fast lookups by apps and APIs.', alt: 'Postgres if the volume is small; Redis if it fits in memory.', cost: '2 nodes, sized for read traffic.' },
      { why: 'The lake (Iceberg or Delta on object storage) keeps full history cheaply for analytics and replays.', alt: 'Straight into the warehouse: simpler, but you pay warehouse prices for raw data.', cost: 'Cheapest storage per GB.' },
      { why: 'Records the processor cannot parse go to a dead-letter queue, so one bad record never stalls the pipeline.', alt: 'Skip bad records silently: you lose data without knowing.', cost: 'Almost nothing; someone must look at it.' }],
    brk: { type: 'spike', t: 'A launch sends 4 times the events' }, fix: [{ set: 'stream', f: 'auto', v: true, why: 'The processor adds tasks when busy, up to the 12 partitions.' }],
    goals: { fresh: 5 }, say: 'Producers write to Kafka with schemas checked by a registry; a stream job keeps a serving store fresh within seconds and lands history in the lake; bad records go to a DLQ. Under a spike the job scales out to the partition count, which is why partitions are sized for peak.' },
  batch: { est: '200 records a second from files, about 17 million a day, ready for dashboards each morning.',
    steps: [
      { why: 'Partners drop files on a schedule. Know the arrival time and size: it sets your deadline.', alt: 'An API or CDC feed if the source can push changes.', cost: 'Free here.' },
      { why: 'Land raw files in the lake first, unchanged, so you can always reprocess.', alt: 'Load straight into the warehouse: no replay if a transform was wrong.', cost: 'Cheapest storage.' },
      { why: 'Spark reads the raw files, deduplicates and writes clean tables.', alt: 'dbt alone on the warehouse if the data is small.', cost: '2 executors, on only while the job runs.' },
      { why: 'Quality checks (row counts, nulls, freshness, contracts) stop bad data before it reaches dashboards.', alt: 'No checks: people find problems in meetings.', cost: 'Small.' },
      { why: 'dbt builds the business tables (facts and dimensions) with tested SQL.', alt: 'SQL in the BI tool: no tests, no reuse.', cost: 'Runs on warehouse compute.' },
      { why: 'The warehouse serves analysts: big scans, few queries at once.', alt: 'Trino on the lake to avoid copying data.', cost: 'The largest line: pay per compute.' },
      { why: 'Dashboards query the warehouse. Count how many queries run at the same time.', alt: 'An OLAP store or cache for hundreds of users.', cost: 'Licences; their queries cost warehouse time.' }],
    brk: { type: 'backfill', on: 'files', t: 'A partner re-sends a month of files' }, fix: [{ set: 'wh', f: 'n', v: 3, why: 'More warehouse clusters run more loads and queries at once.' }],
    goals: { err: 2 }, say: 'Files land raw in the lake, Spark cleans them, checks gate quality, dbt builds tested models in the warehouse for dashboards. A backfill triples load, so the warehouse scales out (or the backfill is throttled) instead of failing dashboards.' },
  cdc: { est: '1,500 writes a second in the app database; the lake and serving store should be seconds behind.',
    steps: [
      { why: 'Users write through the app. Writes are the source of truth.', alt: '-', cost: '-' },
      { why: 'The app service handles requests and writes to its database.', alt: 'Writing to Kafka too (dual write): fails half-way and the two disagree.', cost: '3 replicas.' },
      { why: 'Postgres is the system of record. Its write-ahead log already lists every change in order.', alt: 'Polling tables by updated_at: misses deletes and adds load.', cost: 'Primary plus a replica.' },
      { why: 'A CDC connector (Debezium) tails the log and turns each change into an event, without touching the app.', alt: 'An outbox table if you need business events, not row changes.', cost: 'One task; it lags if slowed.' },
      { why: 'Kafka holds the change stream so many readers can use it at their own pace.', alt: 'Straight to the lake: one reader only, no replay.', cost: 'Brokers.' },
      { why: 'A Kafka Connect sink copies the changes into the lake as tables.', alt: 'Your own consumer code: more to run.', cost: 'Connector tasks.' },
      { why: 'The lake keeps the full history of every row (good for audits and backfills).', alt: '-', cost: 'Cheap storage.' },
      { why: 'A stream job builds a read model from the changes.', alt: 'Read the primary database directly: adds load to it.', cost: 'Tasks.' },
      { why: 'The serving store answers reads without touching the primary database.', alt: 'Read replicas of Postgres.', cost: 'Nodes.' }],
    brk: { type: 'lag', on: 'cdc', t: 'The connector slows to a fifth of its speed' }, fix: [{ set: 'cdc', f: 'n', v: 3, why: 'Three connector tasks keep up with 1,500 changes a second even when slowed.' }],
    goals: { fresh: 5 }, say: 'The app writes only to Postgres; Debezium tails the WAL into Kafka, so there are no dual writes. A sink lands history in the lake and a stream job keeps a serving store fresh. If the connector lags, the WAL grows on the database, so connector lag is a page.' },
  serving: { est: '5,000 reads a second, p99 under 100 ms.',
    steps: [
      { why: 'Users send read requests. Know the read:write ratio and the latency target.', alt: '-', cost: '-' },
      { why: 'The load balancer spreads requests over healthy service replicas and drops dead ones.', alt: 'DNS round robin: slow to remove a dead box.', cost: 'Small.' },
      { why: 'Stateless service replicas: add more for more traffic. Auto-scale is on.', alt: 'One big server: simple until it falls over.', cost: '8 replicas, more at peak.' },
      { why: 'A cache answers hot keys from memory; only misses go to the store.', alt: 'No cache: every read costs a store lookup.', cost: 'One node handles 60,000 a second.' },
      { why: 'The serving store holds the data keyed for lookups.', alt: 'Postgres with read replicas.', cost: '2 nodes.' }],
    brk: { type: 'crash', on: 'kv', t: 'The serving store crashes' }, fix: [{ set: 'kv', f: 'standby', v: true, why: 'A hot standby takes over in 3 seconds.' }],
    goals: { err: 2 }, say: 'Behind a load balancer, stateless services auto-scale; a cache takes most reads and a key-value store serves the rest. Cache hits keep working when the store dies, but misses fail, so the store has a hot standby.' },
  analytics: { est: '8,000 events a second; dashboards want numbers seconds old for 200 queries a second.',
    steps: [
      { why: 'Events from apps.', alt: '-', cost: '-' },
      { why: 'Kafka buffers events and feeds the OLAP store and the lake.', alt: '-', cost: 'Brokers.' },
      { why: 'A real-time OLAP store (ClickHouse, Pinot, Druid) ingests from Kafka and answers aggregates in milliseconds.', alt: 'The warehouse: minutes fresh and few queries at once.', cost: '5 nodes.' },
      { why: 'Dashboards query the OLAP store directly.', alt: '-', cost: '-' },
      { why: 'The lake keeps raw history for reprocessing.', alt: '-', cost: 'Cheap.' }],
    brk: { type: 'crash', on: 'olap', t: 'The OLAP store crashes' }, fix: [{ set: 'olap', f: 'standby', v: true, why: 'Replicas with a standby take over in 3 seconds; Kafka holds events meanwhile.' }],
    goals: { fresh: 5, err: 2 }, say: 'Events go through Kafka into a real-time OLAP store that dashboards query directly, and into the lake for history. If OLAP goes down, Kafka buffers and a standby takes over.' },
  rag: { est: '20 questions a second; each needs an embedding, a vector lookup and an LLM answer within a few seconds.',
    steps: [
      { why: 'Users ask questions.', alt: '-', cost: '-' },
      { why: 'The service runs retrieval and calls the model.', alt: '-', cost: '2 replicas.' },
      { why: 'The embedding model turns the question into a vector.', alt: 'A hosted embedding API.', cost: 'GPU time.' },
      { why: 'The vector store finds the closest passages.', alt: 'Postgres with pgvector for small corpora.', cost: 'Nodes.' },
      { why: 'A semantic cache returns stored answers for similar questions.', alt: 'No cache: every question costs a model call.', cost: 'One node.' },
      { why: 'The LLM writes the answer from the passages.', alt: 'A smaller self-hosted model.', cost: 'Per call: the biggest line.' }],
    brk: { type: 'extlimit', on: 'llm', t: 'The provider cuts your rate limit' }, fix: [{ set: 'cache', f: 'hit', v: 0.6, why: 'Matching similar questions, not only exact ones, answers 60% from the cache.' }],
    goals: { err: 2 }, say: 'Embed the question, retrieve passages from the vector store, and call the LLM through a semantic cache. The cache is the main lever on both rate limits and cost.' },
  url: { est: '100 million new links a month is about 40 writes a second; at 100 reads per write, about 4,000 redirects a second on average and 12,000 at peak. Seven characters of base62 give 3.5 trillion codes.',
    steps: [
      { why: 'People click short links (reads) and a few create them (writes). Reads dominate, so design for reads.', alt: '-', cost: '-' },
      { why: 'The load balancer spreads clicks over the redirect servers.', alt: 'DNS round robin.', cost: 'Small.' },
      { why: 'Stateless redirect servers look up the code and answer with a 301 or 302. A 302 lets you count clicks.', alt: 'Serve redirects at the CDN edge for the hottest links.', cost: '20 replicas, auto-scaling to 60.' },
      { why: 'Popular links are read again and again, so a cache answers 90% of lookups from memory.', alt: 'No cache: every click hits the store.', cost: 'One node.' },
      { why: 'A key-value store maps code to long URL. Codes come from a counter encoded in base62, or a hash with a collision check.', alt: 'Postgres: fine at this size, harder to shard later.', cost: 'One node for now.' }],
    brk: { type: 'stampede', on: 'cache', t: 'The cache restarts empty' }, fix: [{ set: 'kv', f: 'n', v: 2, why: 'With a cold cache every click reaches the store; two nodes carry the full 12,000 a second.' }],
    goals: { err: 2 }, say: 'Reads outnumber writes 100 to 1, so stateless redirect servers sit behind a load balancer with a cache in front of a key-value store; codes are a base62 counter. Size the store for a cold cache, because a cache restart sends every click to it.' },
  chat: { est: '50 million daily users sending 40 messages a day is about 23,000 messages a second on average; here 15,000 at peak in one region. Each message is about 200 bytes, so 400 GB a day.',
    steps: [
      { why: 'Users keep a connection open and send and receive messages.', alt: '-', cost: '-' },
      { why: 'The load balancer assigns each user to a connection server and keeps them there.', alt: '-', cost: 'Small.' },
      { why: 'Connection servers hold WebSockets: they push messages to online users and know who is connected.', alt: 'Long polling: simpler, more requests.', cost: '25 replicas.' },
      { why: 'Kafka orders messages per conversation (the conversation id is the key) and keeps them if a reader is slow.', alt: 'A queue per user: loses ordering across devices.', cost: '3 brokers, 12 partitions.' },
      { why: 'Delivery workers store each message and fan it out to the recipients\' connection servers, or to push notifications if they are offline.', alt: '-', cost: '6 workers.' },
      { why: 'A wide-column store (Cassandra) keeps messages by conversation and time for history and sync.', alt: 'Postgres: harder at billions of rows.', cost: '2 nodes.' }],
    brk: { type: 'hot', on: 'kafka', t: 'One huge group chat takes most of the traffic' }, fix: [{ set: 'kafka', f: 'parts', v: 48, why: 'More partitions (and splitting big groups across keys) leave enough usable partitions for the workers.' }],
    goals: { fresh: 5 }, say: 'Clients hold WebSockets on connection servers; messages go to Kafka keyed by conversation, delivery workers store them in a wide-column store and push them to online recipients. A giant group chat makes one partition hot, so partition generously and split very large groups.' },
  ride: { est: 'Each active driver sends a location every 4 seconds: 40,000 drivers is 10,000 updates a second. Riders ask for nearby drivers about 1,500 times a second.',
    steps: [
      { why: 'Driver apps send their location every few seconds. That write stream is the biggest load.', alt: '-', cost: '-' },
      { why: 'Kafka takes the location stream so the index can catch up after a hiccup.', alt: 'Write straight into the index: a slow index then slows the drivers\' apps.', cost: '3 brokers.' },
      { why: 'A stream job turns each location into a geo cell (geohash or H3) and updates the index.', alt: '-', cost: '4 tasks.' },
      { why: 'The geo index is a key-value store keyed by cell: who is in this cell right now.', alt: 'A spatial database (PostGIS): richer queries, less write throughput.', cost: '2 nodes.' },
      { why: 'Riders open the app and ask for nearby drivers.', alt: '-', cost: '-' },
      { why: 'The load balancer spreads rider requests.', alt: '-', cost: 'Small.' },
      { why: 'The matching service reads the rider\'s cell and the cells around it, ranks drivers by arrival time, and offers the ride.', alt: '-', cost: '4 replicas, auto-scaling.' }],
    brk: { type: 'az', t: 'A whole zone goes down' }, fix: [{ set: 'stream', f: 'n', v: 6, why: 'Spread the tasks over zones with enough spare to lose one.' }, { set: 'kv', f: 'n', v: 3, why: 'Three geo index nodes, one per zone, still carry the load with one zone gone.' }],
    goals: { fresh: 5, err: 2 }, say: 'Driver locations stream through Kafka into a geo index keyed by cell; matching reads the rider\'s cell and its neighbours. Locations are disposable after seconds, so freshness matters more than durability, and every tier has a spare zone of capacity.' },
  video: { est: '40,000 video chunk requests a second from viewers; 100 uploads a second of new chunks. A minute of video is about 100 MB across its quality levels.',
    steps: [
      { why: 'Viewers request small chunks of a video at the quality their network allows (adaptive bitrate).', alt: '-', cost: '-' },
      { why: 'The CDN serves 95% of chunks from servers near the viewer. This is what makes video affordable.', alt: 'Serve from your own region: slow and expensive.', cost: 'Per GB delivered.' },
      { why: 'Object storage holds every chunk at every quality level: the origin behind the CDN.', alt: '-', cost: 'Cheap per GB.' },
      { why: 'Creators upload raw video.', alt: '-', cost: '-' },
      { why: 'A queue holds transcoding jobs so a burst of uploads waits instead of failing.', alt: 'Transcode inside the upload request: slow and fragile.', cost: 'Small.' },
      { why: 'Workers transcode each upload into chunks at several qualities and write them to storage.', alt: '-', cost: 'Per second of work.' }],
    brk: { type: 'stampede', on: 'cdn', t: 'A purge leaves the CDN cold just as a video goes viral' }, fix: [{ insert: 'cache', a: 'cdn', b: 'lake', o: { hit: 0.9 }, why: 'An origin shield cache between the CDN and storage absorbs the misses.' }],
    goals: { err: 2 }, say: 'Viewers fetch adaptive-bitrate chunks through a CDN backed by object storage; uploads go to a queue and transcoding workers write every quality level. Protect the origin with a shield cache, because a cold CDN sends every request to storage.' }
};
SIM_TPL.forEach(t => { t.teach = SIM_TEACH[t.id]; });
function simNewFrom(tplId, name, from) {
  const st = simState(), t = SIM_TPL.find(x => x.id === tplId);
  const d = t ? Object.assign(simFromSc(t), { id: 'd' + Date.now().toString(36), sid: undefined, name: name || t.t }) : simBlank(name);
  if (from) d.from = from;
  st.d[d.id] = d; st.cur = d.id; save(); return d;
}
/* Quick start: a row of starter buttons (Build tab of an empty design, and the sketch sheet) */
function simQuickRow(onPick) {
  return el('div', { class: 'simquick' }, SIM_TPL.filter(t => !t.swe).map(t => el('button', { class: 'simqbtn', 'data-tpl': t.id, onclick: () => onPick(t.id) }, [el('b', { text: t.t }), el('small', { text: t.s })])));
}
/* "Sketch it in the simulator" for a question or design problem: opens a starter that fits the words, named after it */
function simSketch(text, label, live) {
  return el('button', { class: 'btn sm simsketch', onclick: () => { const t = SIM_TPL.find(x => x.swe && x.re.test(text || '')) || SIM_TPL.find(x => x.re.test(text || '')) || SIM_TPL[3]; const d = simNewFrom(t.id, String(text || '').replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 58) || t.t, location.hash); if (live) { d.live = live; save(); } location.hash = '#/sim'; } }, label || 'Sketch it in the simulator');
}
/* a module's simulator challenges, for its chapter, quiz and design pages */
function simCard(mid, opts) {
  opts = opts || {}; const sc = SIM_SC.filter(s => s.mid === mid); if (!sc.length) return null; const done = simState().done, ex = simState().ex || {}, tail = opts.exam ? '/exam' : '';
  return el('section', { class: 'card pad stack simmod' }, [el('div', { class: 'row wrap' }, [el('h3', { class: 'grow', text: opts.title || 'Prove it in the simulator' }), el('span', { class: 'muted', style: { fontSize: '14px' }, text: sc.filter(s => done[s.id]).length + ' of ' + sc.length + ' passed' })]),
    el('span', { class: 'muted', style: { fontSize: '14px' }, text: opts.exam ? 'Exam: fix a broken design with no help. Hints are there, but each one costs marks.' : 'A design that fails on purpose. Learn mode opens hints as you go; switch to Exam to score yourself.' }),
    el('div', { class: 'stack', style: { gap: '6px' } }, sc.map(s => el('a', { class: 'simsc', href: '#/sim/sc/' + s.id + tail, 'data-sc': s.id }, [el('span', { class: 'grow' }, [el('b', { text: (done[s.id] ? '✓ ' : '') + s.t }), el('small', { text: s.lvl + ' · ' + s.secs + ' s run' + (ex[s.id] && ex[s.id].best != null ? ' · best exam ' + ex[s.id].best : '') })]), el('span', { class: 'chip ' + (opts.exam ? 'c-ai' : done[s.id] ? 'c-dsa' : 'c-arch'), text: opts.exam ? 'Exam' : done[s.id] ? 'Passed' : 'Learn it' })])))]);
}
/* Today, below the plan: this week's first unpassed challenge, else a quick start */
function simToday() {
  if (typeof schedule !== 'function') return null; const sc = schedule(), done = simState().done;
  const wk = sc.units.filter(u => u.day >= sc.today).slice(0, 60).map(u => u.mid || (u.uid || '').split(':')[0]);
  const mods = [sc.cur].concat(wk).filter((x, i, a) => x && a.indexOf(x) === i);
  const s = mods.map(m => SIM_SC.find(x => x.mid === m && !done[x.id])).find(Boolean);
  if (!s) return null;
  return el('section', { class: 'card pad row wrap simtoday' }, [el('span', { class: 'simab', style: { background: 'var(--plum)' }, text: 'SIM' }), el('div', { class: 'grow stack', style: { gap: '0' } }, [el('b', { text: 'Simulator challenge: ' + s.t }), el('span', { class: 'muted', style: { fontSize: '14px' }, text: 'Module ' + modLabel(s.mid) + ' · about 5 minutes' })]), el('a', { class: 'btn sm', href: '#/sim/sc/' + s.id + (done[s.id] ? '/exam' : ''), text: done[s.id] ? 'Take the exam' : 'Learn it' })]);
}
