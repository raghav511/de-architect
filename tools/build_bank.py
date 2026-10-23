"""Validate every bank item against the real runtime and write data/bank/*.json.
Usage: python tools/build_bank.py   (needs duckdb; run from the repo root)"""
import json, sys, os, re
sys.path.insert(0, 'py'); sys.path.insert(0, 'tools')
import runtime
from bank_dsa import D
from bank_sql import S
from bank_spark import P
runtime.seed()
bad = 0
for i, d in enumerate(D):
    spec = {k: d[k] for k in ('fn', 'tests', 'big', 'bigLabel', 'cls', 'in', 'out', 'inplace', 'sortout', 'un', 'lca', 'ms') if k in d}
    if spec.get('un'): spec['unordered'] = True
    r = json.loads(runtime.check_dsa(json.dumps(spec), d['sol']))
    if r['err'] or not all(t['ok'] for t in r['tests']):
        bad += 1; print('DSA FAIL', d['w'], d['t'], r['err'], [t for t in r['tests'] if not t['ok']][:2])
    d['id'] = 'd%02d%d' % (d['w'], sum(1 for x in D[:i] if x['w'] == d['w']) + 1)
for i, s in enumerate(S):
    s['id'] = 'q%02d%d' % (s['w'], sum(1 for x in S[:i] if x['w'] == s['w']) + 1)
    r = json.loads(runtime.check_sql(s['sol'], s['sol'], s.get('ordered', False)))
    if r.get('err') or r['table']['total'] == 0:
        bad += 1; print('SQL FAIL', s['id'], s['t'], r.get('err'), 'rows', r.get('table', {}).get('total'))
    if s['k'] == 'O' and not s.get('approx'):
        r2 = json.loads(runtime.check_sql(s['start'], s['sol'], s.get('ordered', False)))
        if r2.get('err') or not r2.get('pass'):
            print('  note: slow query differs', s['id'], s['t'], r2.get('err'), [t['note'] for t in r2.get('tests', []) if not t['ok']])
        for rx, msg in s.get('avoid', []):
            if re.search(rx, s['sol'], re.I): print('  RULE avoid hits sol', s['id'], rx); bad += 1
        for rx, msg in s.get('need', []):
            if not re.search(rx, s['sol'], re.I): print('  RULE need misses sol', s['id'], rx); bad += 1
for i, s in enumerate(P):
    s['id'] = 'p%02d%d' % (s['w'], sum(1 for x in P[:i] if x['w'] == s['w']) + 1)
    r = json.loads(runtime.check_spark(s['sol'], s['sol'], 'result', s.get('ordered', False)))
    if r.get('err') or not r.get('table') or (r['table']['total'] == 0 and not s.get('empty')):
        bad += 1; print('SPARK FAIL', s['id'], s['t'], r.get('err'), (r.get('table') or {}).get('total'))
    r0 = json.loads(runtime.check_spark(s['start'], s['sol'], 'result', s.get('ordered', False)))
    if r0.get('err') and 'result' not in (r0.get('err') or ''):
        print('  note: starter errors', s['id'], r0['err'][:120])
    if s['k'] == 'O' and not s.get('approx'):
        if not r0.get('pass'):
            print('  note: slow job differs', s['id'], s['t'], (r0.get('err') or '')[:100], [t['note'] for t in r0.get('tests', []) if not t['ok']])
        for rx, msg in s.get('avoid', []):
            if re.search(rx, s['sol'], re.I): print('  RULE avoid hits sol', s['id'], rx); bad += 1
        for rx, msg in s.get('need', []):
            if not re.search(rx, s['sol'], re.I): print('  RULE need misses sol', s['id'], rx); bad += 1
from collections import Counter
print('per week dsa', dict(Counter(d['w'] for d in D)), 'sql', dict(Counter(d['w'] for d in S)), 'spark', dict(Counter(d['w'] for d in P)))
os.makedirs('data/bank', exist_ok=True)
for name, arr in (('dsa', D), ('sql', S), ('spark', P)):
    json.dump(arr, open('data/bank/' + name + '.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('problems:', bad)
