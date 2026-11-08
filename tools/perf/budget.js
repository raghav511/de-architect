/* Speed budget guard: fails when a budgeted item is more than 10% over its budget (tools/perf/budget.json, BASELINE.md).
   node tools/perf/budget.js BASE [--engine chromium|webkit] [--runs 3]
   It runs tools/perf/measure.js (load and actions; no memory run) and compares the medians. Exit code 1 on a FAIL line. */
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const args = process.argv.slice(2), arg = (k, d) => args.includes(k) ? args[args.indexOf(k) + 1] : d;
const BASE = args.find(a => /^http/.test(a)) || 'http://127.0.0.1:8844/';
const budget = JSON.parse(fs.readFileSync(path.join(__dirname, 'budget.json'), 'utf8'));
const out = path.join(os.tmpdir(), 'perf_budget_' + process.pid + '.json');
execFileSync(process.execPath, [path.join(__dirname, 'measure.js'), BASE, '--only', 'load,actions', '--runs', arg('--runs', '3'), '--out', out].concat(arg('--engine') ? ['--engine', arg('--engine')] : []), { stdio: ['ignore', 'ignore', 'inherit'] });
const res = JSON.parse(fs.readFileSync(out, 'utf8')); fs.unlinkSync(out);
const get = (o, k) => k.split('.').reduce((a, x) => a == null ? a : a[x], o);
let bad = 0;
for (const [engine, E] of Object.entries(res.engines)) for (const [k, lim] of Object.entries(budget.items[engine] || {})) {
  const v = get(E, k); if (v == null) { console.log('SKIP', engine, k, '(not measured)'); continue; }
  const over = v > lim * 1.1; if (over) bad++;
  console.log((over ? 'FAIL' : 'ok  '), engine.padEnd(8), k.padEnd(34), String(v).padStart(6), ' budget', lim, over ? '(more than 10% over)' : '');
}
process.exit(bad ? 1 : 0);
