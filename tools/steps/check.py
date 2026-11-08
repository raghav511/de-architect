"""Checks every module's @@steps block (integrated week steps, js/steps.js): known kinds, at most 10 minutes each,
simulator challenges that exist, a bug-fix exercise whose code fails a test as given and whose fix passes them all
(same test semantics as check_py in py/runtime.py), a valid check answer, and a question with a model answer, a task
and a rubric where each kind needs them. python3 tools/steps/check.py"""
import glob, json, os, re, sys
R = os.path.join(os.path.dirname(__file__), '../..')
sys.path.insert(0, os.path.join(R, 'tools/loop'))
KEYS = ['STEP', 'TITLE', 'MIN', 'SIM', 'BODY', 'SPEC', 'CODE', 'FIX', 'BUG', 'TESTS', 'CHECK', 'Q', 'A', 'TASK', 'RUBRIC', 'DESIGN']
NEED = {'design': ['BODY'], 'fix': ['SPEC', 'CODE', 'FIX', 'BUG', 'TESTS'], 'platform': ['BODY', 'CHECK'], 'lead': ['Q', 'A'], 'ai': ['BODY', 'TASK', 'RUBRIC']}

def run(code, tests):
    ns = {'__name__': '__main__'}
    exec(compile(code, '<user>', 'exec'), ns)
    res = []
    for name, snippet, want in tests:
        tns = dict(ns)
        try:
            lines = snippet.strip().split('\n')
            if len(lines) > 1: exec(compile('\n'.join(lines[:-1]), '<test>', 'exec'), tns)
            res.append(json.loads(json.dumps(eval(compile(lines[-1], '<test>', 'eval'), tns), default=str)) == want)
        except Exception:
            res.append(False)
    return res

def blocks(text):
    out, b, f, fence = [], None, None, False
    for l in text.split('\n'):
        isf = l.startswith('```')
        if isf: fence = not fence
        if not fence and not isf:
            if l.strip() == '---':
                if b: out.append(b)
                b = f = None; continue
            m = re.match(r'^(' + '|'.join(KEYS) + r'):\s?(.*)$', l)
            if m: b = b or {}; f = m.group(1); b[f] = m.group(2); continue
        if b is not None and f: b[f] += '\n' + l
    if b: out.append(b)
    return [{k: v.strip() for k, v in x.items()} for x in out]

code = lambda t: re.sub(r'\n?```$', '', re.sub(r'^```\w*\n?', '', t or ''))
sim = open(os.path.join(R, 'js/sim.js')).read(); sc_ids = set(re.findall(r"\{ id: '(\w+)', mid: '", sim))
design_ids = set(json.load(open(os.path.join(R, 'data/design.json'))))
bad = 0
for p in sorted(glob.glob(os.path.join(R, 'data/program/*.txt'))):
    t = open(p).read(); m = re.search(r'^@@steps\n(.*?)(?=^@@[a-z]+\s*$)', t, re.S | re.M)
    if not m: continue
    mid, seen = os.path.basename(p)[:-4], set()
    for x in blocks(m.group(1)):
        k, errs = x.get('STEP'), []
        if k not in NEED: errs.append('unknown step ' + str(k))
        else:
            if k in seen: errs.append('two ' + k + ' steps')
            seen.add(k)
            errs += ['no ' + f for f in NEED[k] + ['TITLE'] if not x.get(f)]
            if not 1 <= int(x.get('MIN') or 0) <= 10: errs.append('MIN must be 1 to 10')
            if k == 'design':
                if not x.get('SIM') and x.get('DESIGN') != 'yes': errs.append('design needs SIM or DESIGN: yes')
                if x.get('DESIGN') == 'yes' and mid not in design_ids: errs.append('DESIGN: yes but data/design.json has no ' + mid)
                errs += ['unknown simulator challenge ' + s.strip() for s in x.get('SIM', '').split(',') if s.strip() and s.strip() not in sc_ids]
            if k == 'fix' and not errs:
                tests = json.loads(x['TESTS']); a, b = run(code(x['CODE']), tests), run(code(x['FIX']), tests)
                n = len(code(x['CODE']).split('\n'))
                if all(a): errs.append('the given code passes every test')
                if not all(b): errs.append('the fix fails a test: ' + ''.join('✓' if v else '✗' for v in b))
                if not all(1 <= int(v) <= n for v in x['BUG'].split(',')): errs.append('bug line out of range')
            if k == 'platform' and x.get('CHECK'):
                c = json.loads(x['CHECK'])
                if not (c.get('q') and 0 <= c.get('a', -1) < len(c.get('c', [])) and c.get('why')): errs.append('the check needs q, c, a and why')
        bad += bool(errs)
        print(('BAD  ' if errs else 'ok   ') + mid + ' ' + str(k) + ('' if not errs else ': ' + '; '.join(errs)))
    order = [x.get('STEP') for x in blocks(m.group(1))]
    if order != ['design', 'fix', 'platform', 'lead', 'ai']:
        bad += 1; print('BAD  ' + mid + ': steps must be design, fix, platform, lead, ai in that order, got ' + ', '.join(map(str, order)))
print('%d problem%s' % (bad, '' if bad == 1 else 's')); sys.exit(1 if bad else 0)
