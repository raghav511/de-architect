"""Checks every code comprehension item in data/loop.json: the code as given fails at least one test, the fixed
code passes them all, and the bug lines exist. Same test semantics as check_py in py/runtime.py. python3 tools/loop/check.py"""
import json, os, sys
d = json.load(open(os.path.join(os.path.dirname(__file__), '../../data/loop.json')))

def run(code, tests):
    ns = {'__name__': '__main__'}
    exec(compile(code, '<user>', 'exec'), ns)
    res = []
    for name, snippet, want in tests:
        tns = dict(ns)
        try:
            lines = snippet.strip().split('\n')
            if len(lines) > 1:
                exec(compile('\n'.join(lines[:-1]), '<test>', 'exec'), tns)
            got = json.loads(json.dumps(eval(compile(lines[-1], '<test>', 'eval'), tns), default=str))
            res.append(got == want)
        except Exception:
            res.append(False)
    return res

bad = 0
for it in d['cc']:
    a, b = run(it['code'], it['tests']), run(it['fixed'], it['tests'])
    n = len(it['code'].split('\n'))
    ok = not all(a) and all(b) and all(1 <= x <= n for x in it['bug']) and 0 <= it['what']['a'] < len(it['what']['c']) and 0 <= it['better']['a'] < len(it['better']['c'])
    bad += not ok
    print(('ok   ' if ok else 'BAD  ') + it['id'], 'given:', ''.join('✓' if x else '✗' for x in a), 'fixed:', ''.join('✓' if x else '✗' for x in b))
for x in d['cx']:
    if x['ans'] not in d['cxChoices']:
        bad += 1; print('BAD  ' + x['id'] + ': answer not among the choices')

# every data platform design links to a simulator walkthrough and challenges that exist; rounds 8 and 9 answer every part
import re
sim = open(os.path.join(os.path.dirname(__file__), '../../js/sim.js')).read()
sc_ids = set(re.findall(r"\{ id: '(\w+)', mid: '", sim)); tpl_ids = set(re.findall(r"\{ id: '(\w+)',(?: swe: true,)? t: '", sim))
ai_tpls = set(re.findall(r"\{ id: '(\w+)', t: '[^']*', ai: true", sim))
for t in d['topics'] + d['webTopics'] + d.get('aiTopics', []):
    miss = [x for x in t.get('sc', []) if x not in sc_ids] + ([t['tpl']] if t['tpl'] not in tpl_ids else [])
    if miss: bad += 1; print('BAD  topic ' + t['id'] + ': unknown ' + ', '.join(miss))
    elif t in d.get('aiTopics', []) and t['tpl'] not in ai_tpls: bad += 1; print('BAD  topic ' + t['id'] + ': its walkthrough is not an AI template (ai: true)')
    else: print('ok   topic ' + t['id'])
if len(d.get('aiTopics', [])) < 4: bad += 1; print('BAD  fewer than four AI designs')
parts = {'model': ['ask', 'grain', 'facts', 'dims', 'keys', 'query'], 'metrics': ['goal', 'metrics', 'events', 'pipeline', 'sql', 'diag']}
for k, ps in parts.items():
    for c in d[k]:
        gap = [p for p in ps if not c['a'].get(p)]
        if gap or len(c['rubric']) < 4: bad += 1; print('BAD  ' + c['id'] + ': missing ' + ', '.join(gap))
        else: print('ok   ' + c['id'])
sys.exit(1 if bad else 0)
