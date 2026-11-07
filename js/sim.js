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
    nodes: [['client', 40, 140, { rps: 500 }], ['svc', 260, 140, { n: 2 }], ['pg', 500, 60], ['ext', 500, 220]], edges: [[0, 1], [1, 2], [1, 3]] }
];
function simFromSc(sc) {
  const ids = sc.nodes.map((x, i) => 'n' + (i + 1));
  return { id: 'sc-' + sc.id, sid: sc.id, name: sc.t, mult: 1, at: Date.now(),
    nodes: sc.nodes.map((x, i) => Object.assign({ id: ids[i], k: x[0], x: x[1], y: x[2], name: SIM_K[x[0]].t }, x[3] || {})),
    edges: sc.edges.map((e, i) => ({ id: 'e' + (i + 1), a: ids[e[0]], b: ids[e[1]] })) };
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
const SIM_W = 150, SIM_H = 66, SIM_NS = 'http://www.w3.org/2000/svg';
const sv = (tag, a, kids) => { const e = document.createElementNS(SIM_NS, tag); for (const k in (a || {})) if (a[k] != null) e.setAttribute(k, a[k]); (kids || []).forEach(c => c && e.appendChild(c)); return e; };
let simTab = 'build', simScFilter = 'all', simLastD = null;
function vSim(a, b) {
  const st = simState();
  if (a === 'share' && b) { try { const d = simUnpack(b); st.d[d.id] = d; st.cur = d.id; save(); toast('Shared design added: ' + d.name); } catch (e) { toast('That link does not hold a design.'); } location.replace('#/sim'); return; }
  if (a === 'sc' && b) { const sc = SIM_SC.find(s => s.id === b); if (sc) { const id = 'sc-' + sc.id; if (!st.d[id] || st.d[id].del) st.d[id] = simFromSc(sc); st.cur = id; simTab = 'goal'; save(); } location.replace('#/sim'); return; }
  let d = st.d[st.cur]; if (!d || d.del) { d = simList()[0]; if (!d) { d = simBlank(); st.d[d.id] = d; } st.cur = d.id; }
  const sc = d.sid && SIM_SC.find(s => s.id === d.sid);
  if (simLastD !== d.id) { simTab = sc ? 'goal' : 'build'; simLastD = d.id; } /* a scenario opens on its challenge */
  let lastGrade = null, rt = SIM.newRt(d), m = null, running = false, speed = 1, sel = null, vb = { x: 0, y: 0, w: 960, h: 420 }, zones = false;
  const undo = [], redo = [];
  const snap = () => JSON.stringify({ nodes: d.nodes, edges: d.edges });
  const touch = () => { d.at = Date.now(); save(); };
  const change = fn => { lastGrade = null; undo.push(snap()); if (undo.length > 60) undo.shift(); redo.length = 0; fn(); touch(); draw(); panel(); };
  const restore = (from, to) => { if (!from.length) return; to.push(snap()); const j = JSON.parse(from.pop()); d.nodes = j.nodes; d.edges = j.edges; sel = null; touch(); draw(); panel(); };
  const N = id => d.nodes.find(n => n.id === id);
  const nid = p => { let i = 1; while (d.nodes.some(n => n.id === p + i) || d.edges.some(e => e.id === p + i)) i++; return p + i; };

  /* status strip: always visible */
  const strip = el('div', { class: 'simstrip', role: 'status', 'aria-live': 'off' });
  const paintStrip = () => { const cost = SIM.cost(d, rt, m && m.R).total; strip.textContent = '';
    const cell = (l, v, cls) => el('span', { class: 'simstat' + (cls ? ' ' + cls : '') }, [el('small', { text: l }), el('b', { class: 'mono', text: v })]);
    strip.append(cell('In', m ? Math.round(m.rps).toLocaleString() + '/s' : '—'), cell('p50', m ? Math.round(m.p50) + ' ms' : '—'), cell('p99', m ? Math.round(m.p99) + ' ms' : '—', m && m.p99 > 500 ? 'bad' : ''),
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
      const p = ePath(a, b); g.append(sv('path', { class: 'hit', d: p }), sv('path', { class: 'ln', d: p, 'marker-end': 'url(#simarr)' }));
      g.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); sel = { e: e.id }; draw(); panel(); } });
      gE.append(g); });
    d.nodes.forEach(n => {
      const K = SIM_K[n.k], r = m && m.R[n.id], col = SIM_CAT[K.cat][1], hot = m && m.hot.includes(n.id), down = r && !simIsSrc(n) && r.cap === 0;
      const g = sv('g', { class: 'simnode' + (sel && sel.n === n.id ? ' on' : '') + (hot ? ' hot' : '') + (down ? ' down' : ''), 'data-id': n.id, 'data-k': n.k, transform: 'translate(' + n.x + ' ' + n.y + ')', tabindex: '0', role: 'button', 'aria-label': (n.name || K.t) + ', ' + K.t + (r ? ', ' + Math.round(r.inn) + ' per second, ' + Math.round((r.u || 0) * 100) + '% load' : '') });
      g.style.setProperty('--c', col);
      const tx = (x, y, s, cls) => { const t = sv('text', { x, y, class: cls }); t.textContent = s; return t; };
      g.append(sv('rect', { class: 'box', width: SIM_W, height: SIM_H, rx: 12 }), sv('rect', { class: 'tag', x: 8, y: 8, width: 34, height: 16, rx: 4 }), tx(25, 20, K.ab, 'ab'), tx(48, 21, (n.name || K.t).slice(0, 15), 'nm'));
      const reps = rt.reps[n.id] != null ? rt.reps[n.id] : (n.n || 1);
      if (!simIsSrc(n)) g.append(tx(SIM_W - 8, 21, '×' + reps + (n.standby ? '+S' : '') + (n.auto || K.auto ? ' A' : ''), 'rp'));
      if (r) { g.append(tx(10, 42, Math.round(simIsSrc(n) ? r.inn : r.served).toLocaleString() + '/s' + (simIsSrc(n) ? '' : ' · ' + Math.round((r.own || 0) * (2 + 2.5 * Math.pow(Math.min(r.u, 1.2), 2))) + 'ms'), 'rd'));
        if (!simIsSrc(n)) { const u = Math.min(1, r.u || 0); g.append(sv('rect', { class: 'ub', x: 10, y: 50, width: SIM_W - 20, height: 6, rx: 3 }), sv('rect', { class: 'uf' + (u >= 0.85 ? ' hi' : u >= 0.6 ? ' mid' : ''), x: 10, y: 50, width: Math.max(2, (SIM_W - 20) * u), height: 6, rx: 3 })); }
        if (r.lag > 1) g.append(tx(SIM_W - 8, 42, 'lag ' + (r.fresh || 0).toFixed(1) + 's', 'lg'));
      } else g.append(tx(10, 44, simIsSrc(n) ? ((n.rps != null ? n.rps : K.rps) * (d.mult || 1)).toLocaleString() + '/s' : (n.cap != null ? n.cap : K.cap).toLocaleString() + '/s each', 'rd sub'));
      g.append(sv('circle', { class: 'port', cx: SIM_W, cy: SIM_H / 2, r: 9, 'data-port': n.id }), sv('circle', { class: 'inport', cx: 0, cy: SIM_H / 2, r: 4 }));
      g.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); if (sel && sel.wiring && sel.n !== n.id) { simWire(sel.n, n.id); return; } sel = { n: n.id }; simTab = 'build'; draw(); panel(); } }); /* tap or Enter on a second box while wiring finishes the wire */
      gN.append(g);
    });
    paintStrip();
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
      body.append(el('div', { class: 'row' }, [el('span', { class: 'simab', style: { background: SIM_CAT[K.cat][1] }, text: K.ab }), el('h3', { class: 'grow', text: K.t }), el('button', { class: 'btn sm', onclick: () => { sel = null; panel(); draw(); }, text: 'Done' })]),
        el('p', { class: 'muted', style: { margin: 0, fontSize: '14px' }, text: K.d + (K.route === 'split' ? '. Shares its traffic between the wires out.' : K.route === 'miss' ? '. Only misses go on.' : K.async ? '. Readers pull at their own pace.' : '') }), ...f,
        el('div', { class: 'row wrap', style: { gap: '8px' } }, [el('button', { class: 'btn sm', onclick: () => { sel = { n: n.id, wiring: true }; draw(); toast('Now tap the box to wire it to.'); }, text: 'Wire to…' }), el('button', { class: 'btn sm', onclick: () => change(() => { const c = JSON.parse(JSON.stringify(n)); c.id = nid('n'); c.x += 30; c.y += 30; d.nodes.push(c); sel = { n: c.id }; }), text: 'Duplicate' }), el('button', { class: 'btn sm warn', onclick: delSel, text: 'Delete' })]));
      return;
    }
    if (sel && sel.e) { const e = d.edges.find(x => x.id === sel.e); if (e) { body.append(el('h3', { text: 'Wire' }), el('p', { style: { margin: 0 }, text: (N(e.a).name || N(e.a).k) + ' → ' + (N(e.b).name || N(e.b).k) }), el('p', { class: 'muted', style: { margin: 0, fontSize: '14px' }, text: 'Break it from the Break tab: add latency, cut it, or drop packets.' }), el('div', { class: 'row wrap', style: { gap: '8px' } }, [el('button', { class: 'btn sm', onclick: () => { simTab = 'break'; panel(); }, text: 'Break this wire' }), el('button', { class: 'btn sm warn', onclick: delSel, text: 'Delete wire' })])); return; } }
    const q = el('input', { type: 'search', class: 'simsearch', placeholder: 'Find a component', 'aria-label': 'Find a component' });
    const list = el('div', { class: 'stack', style: { gap: '10px' } });
    const fill = () => { list.textContent = ''; const s = q.value.trim().toLowerCase(); Object.keys(SIM_CAT).forEach(c => { const ks = Object.keys(SIM_K).filter(k => SIM_K[k].cat === c && (!s || (SIM_K[k].t + ' ' + SIM_K[k].d).toLowerCase().includes(s))); if (!ks.length) return;
      list.append(el('div', { class: 'stack', style: { gap: '6px' } }, [el('span', { class: 'lbl', text: SIM_CAT[c][0] }), el('div', { class: 'simpal' }, ks.map(k => el('button', { class: 'simcomp', 'data-k': k, title: SIM_K[k].d, onpointerdown: ev => palDrag(ev, k), onclick: ev => { if (ev.currentTarget.dataset.dragged) return; addNode(k); } }, [el('span', { class: 'simab', style: { background: SIM_CAT[c][1] }, text: SIM_K[k].ab }), el('span', { class: 'grow' }, [el('b', { text: SIM_K[k].t }), el('small', { text: SIM_K[k].d })])])))])); }); };
    q.addEventListener('input', fill); fill();
    if (d.nodes.length <= 1 && !d.edges.length) body.append(el('span', { class: 'lbl', text: 'Quick start' }), simQuickRow(id => change(() => { const t = simFromSc(SIM_TPL.find(x => x.id === id)); d.nodes = t.nodes; d.edges = t.edges; if (/^(My design|Design \d+)$/.test(d.name)) { d.name = t.name; nameIn.value = t.name; } sel = null; fit(); })), el('span', { class: 'lbl', text: 'Or build from parts' }));
    body.append(el('p', { class: 'muted', style: { margin: 0, fontSize: '14px' }, text: 'Tap a component to add it (wired after the selected box), or drag it onto the canvas. Drag from a box\'s right dot to another box to wire them.' }), q, list);
  }
  function pRun() {
    const mult = el('input', { type: 'range', id: 'sim_mult', min: '0.25', max: '10', step: '0.25', value: d.mult || 1 }), mv = el('b', { class: 'mono', text: '×' + (d.mult || 1) });
    mult.addEventListener('input', () => { d.mult = +mult.value; mv.textContent = '×' + d.mult; touch(); if (!running) draw(); });
    body.append(el('div', { class: 'row wrap', style: { gap: '8px' } }, [el('button', { class: 'btn pri', onclick: () => play(!running), text: running ? 'Pause' : 'Run traffic' }), el('button', { class: 'btn', onclick: resetSim, text: 'Reset' }),
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
    if (!m) { box.append(el('p', { class: 'muted', style: { margin: 0 }, text: 'Run traffic to see each box\'s load. Boxes turn amber at 85% load and red when they drop requests or fall behind.' })); return; }
    box.append(el('div', { class: 'list' }, d.nodes.filter(n => !simIsSrc(n)).map(n => { const r = m.R[n.id] || {}; return el('div', { class: 'item' }, [el('span', { class: 'grow t', text: n.name || SIM_K[n.k].t }), el('span', { class: 's mono', text: Math.round(r.served || 0).toLocaleString() + '/s · ' + Math.round((r.u || 0) * 100) + '%' + (r.drop > 0.5 ? ' · drops ' + Math.round(r.drop) + '/s' : '') + (r.lag > 1 ? ' · lag ' + (r.fresh || 0).toFixed(1) + ' s' : '') + (r.idle ? ' · ' + r.idle + ' idle' : '') })]); }))); }
  function pBreak() {
    const act = SIM.active(rt, rt.t), nm = id => { const n = N(id); if (n) return n.name || SIM_K[n.k].t; const e = d.edges.find(x => x.id === id); return e ? (N(e.a).name || '') + ' → ' + (N(e.b).name || '') : 'everything'; };
    body.append(el('p', { class: 'muted', style: { margin: 0, fontSize: '14px' }, text: 'Select a box or wire on the canvas, then inject a failure. Traffic starts by itself. Remove a failure to watch the system recover.' }));
    if (rt.chaos.length) body.append(el('div', { class: 'stack', style: { gap: '6px' } }, [el('span', { class: 'lbl', text: 'Active failures' })].concat(rt.chaos.map((c, i) => el('div', { class: 'row simact' }, [el('span', { class: 'grow', text: SIM_CH[c.type].t + ' · ' + nm(c.target) + (act.includes(c) ? '' : ' (scheduled)') }), el('button', { class: 'btn sm', onclick: () => { rt.chaos.splice(i, 1); panel(); draw(); }, text: 'Fix' })])))));
    SIM_CHAOS.forEach(([g, items]) => body.append(el('div', { class: 'stack', style: { gap: '6px' } }, [el('span', { class: 'lbl', text: g })].concat(items.map(([id, t, on, ds]) => el('div', { class: 'row simchaos' }, [el('span', { class: 'grow' }, [el('b', { text: t }), el('small', { text: ds })]), el('button', { class: 'btn sm', 'data-chaos': id, onclick: () => inject(id, on), text: 'Inject' })]))))));
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
  function pMetrics() { body.append(live); liveMetrics(); }
  function liveMetrics() { live.textContent = '';
    if (!m) { live.append(el('p', { class: 'muted', style: { margin: 0 }, text: 'Run traffic to fill the charts: latency, throughput, errors and lag, second by second.' }), el('button', { class: 'btn pri', style: { alignSelf: 'flex-start' }, onclick: () => play(true), text: 'Run traffic' })); return; }
    const h = rt.hist.slice(-120);
    live.append(el('div', { class: 'simbig' }, [['Served', Math.round(m.rps * (1 - m.err / 100)).toLocaleString() + '/s'], ['p99', Math.round(m.p99) + ' ms'], ['Errors', m.err.toFixed(2) + '%'], ['Behind', (m.fresh || 0).toFixed(1) + ' s']].map(([k, v]) => el('div', {}, [el('small', { text: k }), el('b', { class: 'mono', text: v })]))),
      el('span', { class: 'lbl', text: 'Latency' }), chart(h, [['p50', 'p50', 'var(--teal)'], ['p99', 'p99', 'var(--red)']], ' ms'),
      el('span', { class: 'lbl', text: 'Throughput' }), chart(h, [['rps', 'offered', 'var(--blue)'], ['ok', 'served', 'var(--teal)']], '/s'),
      el('span', { class: 'lbl', text: 'Errors and lag' }), chart(h, [['err', 'errors %', 'var(--red)']], '%'), chart(h, [['lag', 'backlog', 'var(--amber)']], ''),
      el('span', { class: 'lbl', text: 'Hot spots' }), m.hot.length ? el('div', { class: 'list' }, m.hot.map(id => { const n = N(id), r = m.R[id]; return el('div', { class: 'item' }, [el('span', { class: 'grow t', text: n.name || SIM_K[n.k].t }), el('span', { class: 's', text: r.cap === 0 ? 'down' : r.drop > 0.5 ? 'dropping ' + Math.round(r.drop) + '/s: add replicas or put a queue in front' : (r.lag || 0) > r.inn ? 'readers behind by ' + (r.fresh || 0).toFixed(1) + ' s: more consumers or partitions' : Math.round(r.u * 100) + '% load: little headroom' })]); })) : el('span', { class: 'muted', text: 'None. Every box has headroom.' }));
  }
  function pCost() { body.append(live); liveCost(); }
  function liveCost() { live.textContent = ''; const c = SIM.cost(d, rt, m && m.R);
    live.append(el('div', { class: 'simbig' }, [el('div', {}, [el('small', { text: 'Per month' }), el('b', { class: 'mono', text: '$' + c.total.toLocaleString() })]), el('div', {}, [el('small', { text: 'Per 1M requests' }), el('b', { class: 'mono', text: m && m.rps ? '$' + (c.total / (m.rps * 2.628e6 / 1e6)).toFixed(3) : '—' })])]),
      el('div', { class: 'list' }, c.rows.map(([n, reps, v]) => el('div', { class: 'item' }, [el('span', { class: 'grow t', text: (n.name || SIM_K[n.k].t) }), el('span', { class: 's mono', text: '×' + reps + ' · $' + v.toLocaleString() })]))),
      el('p', { class: 'muted', style: { margin: 0, fontSize: '13.5px' }, text: 'Rough list prices for comparing designs, not a quote. Replicas added by auto-scale count while they run; serverless is priced by the requests it serves.' }));
  }
  function pReview() { const r = simReview(d, m || SIM.run(d, 10).ms.pop());
    body.append(el('span', { class: 'lbl', text: 'Suggestions' }), r.tips.length ? el('div', { class: 'stack', style: { gap: '8px' } }, r.tips.map(([t, x]) => el('div', { class: 'simtip' }, [el('b', { text: t }), el('span', { text: x })]))) : el('span', { class: 'muted', text: 'Nothing to flag. Try breaking it.' }),
      el('span', { class: 'lbl', text: 'Patterns in this design' }), r.pats.length ? el('div', { class: 'stack', style: { gap: '8px' } }, r.pats.map(([t, x]) => el('div', { class: 'simtip pat' }, [el('b', { text: t }), el('span', { text: x })]))) : el('span', { class: 'muted', text: 'None recognised yet: caches, topics, queues and CDC are named here when you use them.' }));
  }
  function pGoal() {
    if (sc) {
      const out = el('div', { class: 'stack simresult' }), g = lastGrade;
      if (g) out.append(el('div', { class: 'list' }, g.res.map(([k, v, want, ok]) => el('div', { class: 'item' }, [el('span', { class: 'grow t', text: (ok ? '✓ ' : '✗ ') + k }), el('span', { class: 's mono', text: v + ' (' + want + ')' })]))),
        el('p', { class: g.pass ? 'simpass' : 'simfail', style: { margin: 0 }, text: g.pass ? 'Passed. In an interview, say why: which box limited you, and what you changed.' : 'Not yet. ' + sc.hint }));
      body.append(el('div', { class: 'row wrap', style: { gap: '6px' } }, [el('span', { class: 'chip c-arch', text: 'Module ' + modLabel(sc.mid) }), el('span', { class: 'chip c-test', text: sc.lvl }), st.done[sc.id] ? el('span', { class: 'chip c-dsa', text: '✓ Passed ' + shortDate(st.done[sc.id]) }) : null]),
        el('h3', { text: sc.t }), el('p', { style: { margin: 0 }, text: sc.q }),
        el('div', { class: 'row wrap', style: { gap: '8px' } }, [el('button', { class: 'btn pri', id: 'sim_check', onclick: () => { const g = lastGrade = SIM.grade(d, sc);
          if (g.pass && !st.done[sc.id]) { st.done[sc.id] = iso(new Date()); save(); if (typeof gameNote === 'function') try { gameNote('sim'); } catch (e) { } }
          const ch = simChaosFor(d, sc.chaos); resetSim(); rt.chaos = ch; play(true); }, text: 'Check my design' }),
          el('button', { class: 'btn', onclick: () => { rt.chaos = simChaosFor(d, sc.chaos); rt.t = 0; play(true); }, text: 'Watch it play' }),
          el('a', { class: 'btn', href: '#/learn/' + sc.mid, text: 'Open the module' }),
          el('button', { class: 'btn sm', onclick: () => { st.d[d.id] = simFromSc(sc); save(); route(); }, text: 'Start over' })]),
        el('span', { class: 'muted', style: { fontSize: '14px' }, text: 'Check runs ' + sc.secs + ' simulated seconds' + (sc.chaos ? ' with the failures in the story' : '') + ' and scores the goals.' }), out,
        el('span', { class: 'lbl', text: 'Other scenarios' }));
    } else body.append(el('p', { class: 'muted', style: { margin: 0, fontSize: '14px' }, text: 'Each scenario opens a starting design that fails on purpose. Fix it until Check my design passes. Your edits are kept.' }));
    const mods = [...new Set(SIM_SC.map(s => s.mid))];
    body.append(el('div', { class: 'simchips', role: 'group', 'aria-label': 'Filter scenarios' }, [['all', 'All']].concat(mods.map(x => [x, modLabel(x)]), [['Beginner', 'Beginner'], ['Intermediate', 'Intermediate'], ['Advanced', 'Advanced']]).map(([k, t]) => el('button', { class: 'chip', 'aria-pressed': String(simScFilter === k), onclick: () => { simScFilter = k; panel(); }, text: t }))),
      el('div', { class: 'stack', style: { gap: '8px' } }, SIM_SC.filter(s => s.id !== d.sid && (simScFilter === 'all' || s.mid === simScFilter || s.lvl === simScFilter)).map(s => el('a', { class: 'simsc', href: '#/sim/sc/' + s.id, 'data-sc': s.id }, [el('span', { class: 'grow' }, [el('b', { text: (st.done[s.id] ? '✓ ' : '') + s.t }), el('small', { text: modLabel(s.mid) + ' · ' + modTitle(s.mid) + ' · ' + s.lvl })])]))));
  }

  const head = el('div', { class: 'row wrap simhead' }, [nameIn, pick, exportMenu, impIn]);
  const backTo = d.from && /^#\/(live|mock|design|quiz|learn|interview)\b/.test(d.from) ? el('a', { class: 'btn sm pri', href: d.from, text: 'Back to the question' }) : null; if (backTo) head.prepend(backTo);
  shell('Design simulator', 'System design', [el('div', { class: 'stack simwrap' }, [head, strip, el('div', { class: 'simgrid' }, [canvasCard, el('section', { class: 'card pad stack simside' }, [tabRow, body])])])], { back: '#/design' });
  panel(); draw(); requestAnimationFrame(fit);
  window.simDebug = { get d() { return d; }, get rt() { return rt; }, get m() { return m; }, play, step: () => tick() };
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
    nodes: [['producer', 40, 60, { rps: 8000 }], ['kafka', 260, 60, { parts: 12 }], ['olap', 480, 140, { n: 3 }], ['bi', 260, 240, { rps: 200 }], ['lake', 480, 300]], edges: [[0, 1], [1, 2], [3, 2], [1, 4]] },
  { id: 'rag', t: 'RAG assistant', s: 'Service, embedding model, vector store, cache, LLM', re: /rag|llm|vector|embed|retriev|agent|ai\b|genai/i,
    nodes: [['client', 40, 140, { rps: 20 }], ['svc', 240, 140, { n: 2 }], ['embed', 460, 60], ['vector', 680, 60], ['cache', 460, 220, { hit: 0.4 }], ['llm', 680, 220]], edges: [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5]] }
];
function simNewFrom(tplId, name, from) {
  const st = simState(), t = SIM_TPL.find(x => x.id === tplId);
  const d = t ? Object.assign(simFromSc(t), { id: 'd' + Date.now().toString(36), sid: undefined, name: name || t.t }) : simBlank(name);
  if (from) d.from = from;
  st.d[d.id] = d; st.cur = d.id; save(); return d;
}
/* Quick start: a row of starter buttons (Build tab of an empty design, and the sketch sheet) */
function simQuickRow(onPick) {
  return el('div', { class: 'simquick' }, SIM_TPL.map(t => el('button', { class: 'simqbtn', 'data-tpl': t.id, onclick: () => onPick(t.id) }, [el('b', { text: t.t }), el('small', { text: t.s })])));
}
/* "Sketch it in the simulator" for a question or design problem: opens a starter that fits the words, named after it */
function simSketch(text, label) {
  return el('button', { class: 'btn sm simsketch', onclick: () => { const t = SIM_TPL.find(x => x.re.test(text || '')) || SIM_TPL[3]; simNewFrom(t.id, String(text || '').replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 58) || t.t, location.hash); location.hash = '#/sim'; } }, label || 'Sketch it in the simulator');
}
/* a module's simulator challenges, for its chapter, quiz and design pages */
function simCard(mid, opts) {
  opts = opts || {}; const sc = SIM_SC.filter(s => s.mid === mid); if (!sc.length) return null; const done = simState().done;
  return el('section', { class: 'card pad stack simmod' }, [el('div', { class: 'row wrap' }, [el('h3', { class: 'grow', text: opts.title || 'Prove it in the simulator' }), el('span', { class: 'muted', style: { fontSize: '14px' }, text: sc.filter(s => done[s.id]).length + ' of ' + sc.length + ' passed' })]),
    el('span', { class: 'muted', style: { fontSize: '14px' }, text: 'A design that fails on purpose. Change boxes, replicas or wires until Check my design passes.' }),
    el('div', { class: 'stack', style: { gap: '6px' } }, sc.map(s => el('a', { class: 'simsc', href: '#/sim/sc/' + s.id, 'data-sc': s.id }, [el('span', { class: 'grow' }, [el('b', { text: (done[s.id] ? '✓ ' : '') + s.t }), el('small', { text: s.lvl + ' · ' + s.secs + ' s run' })]), el('span', { class: 'chip ' + (done[s.id] ? 'c-dsa' : 'c-arch'), text: done[s.id] ? 'Passed' : 'Try it' })])))]);
}
/* Today, below the plan: this week's first unpassed challenge, else a quick start */
function simToday() {
  if (typeof schedule !== 'function') return null; const sc = schedule(), done = simState().done;
  const wk = sc.units.filter(u => u.day >= sc.today).slice(0, 60).map(u => u.mid || (u.uid || '').split(':')[0]);
  const mods = [sc.cur].concat(wk).filter((x, i, a) => x && a.indexOf(x) === i);
  const s = mods.map(m => SIM_SC.find(x => x.mid === m && !done[x.id])).find(Boolean);
  if (!s) return null;
  return el('section', { class: 'card pad row wrap simtoday' }, [el('span', { class: 'simab', style: { background: 'var(--plum)' }, text: 'SIM' }), el('div', { class: 'grow stack', style: { gap: '0' } }, [el('b', { text: 'Simulator challenge: ' + s.t }), el('span', { class: 'muted', style: { fontSize: '14px' }, text: 'Module ' + modLabel(s.mid) + ' · about 5 minutes' })]), el('a', { class: 'btn sm', href: '#/sim/sc/' + s.id, text: 'Open' })]);
}
