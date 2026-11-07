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
sys.exit(1 if bad else 0)
