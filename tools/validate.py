"""Content checks for Data Architect. Run from the repo root:  python3 tools/validate.py
Exits non-zero on any error. Checks module files, tickets, quiz/interview/coding blocks,
data JSON, file paths named in labs, and that every coding test's reference solution passes."""
import json, os, re, sys, glob
sys.path.insert(0, 'py')
E, W = [], []
def err(*a): E.append(' '.join(str(x) for x in a))
def warn(*a): W.append(' '.join(str(x) for x in a))

def sections(t):
    out, name, buf = {}, None, []
    for l in t.split('\n'):
        m = re.match(r'^@@([a-z]+)\s*$', l)
        if m:
            if name: out[name] = '\n'.join(buf)
            name, buf = m.group(1), []
        else: buf.append(l)
    if name: out[name] = '\n'.join(buf)
    return out

def heads(t):
    out, fence = [], False
    for l in (t or '').split('\n'):
        if l.startswith('```'): fence = not fence
        elif not fence and l.startswith('## '): out.append(l[3:].strip())
    return out

def blocks(text, keys, letters):
    res, b, f, fence = [], None, None, False
    rx = re.compile('^(' + '|'.join(keys) + r'):\s?(.*)$')
    for l in (text or '').split('\n'):
        isf = l.startswith('```')
        if isf: fence = not fence
        if not fence and not isf:
            if l.strip() == '---':
                if b: res.append(b)
                b, f = None, None; continue
            m = rx.match(l)
            if m: b = b or {}; f = m.group(1); b[f] = m.group(2); continue
            if letters:
                o = re.match(r'^([A-D])\)\s(.*)$', l)
                if o: b = b or {}; b.setdefault('opts', []).append(o.group(1)); f = None; continue
        if b is not None and f: b[f] += '\n' + l
    if b: res.append(b)
    return res

mods = ['a01', 'a02', 'a03'] + ['p%02d' % i for i in range(1, 7)] + ['m%02d' % i for i in range(1, 4)] + ['d01', 'j01', 'r01'] + ['s%02d' % i for i in range(13)]
sparkbank = json.load(open('data/bank/spark.json'))
sqlbank = json.load(open('data/bank/sql.json'))
pybank = json.load(open('data/bank/py.json'))
ext = json.load(open('data/extensions.json')).get('modules', [])
mods += ext
design = json.load(open('data/design.json'))
gitl = json.load(open('data/git.json'))
news = json.load(open('data/news.json'))
projects = json.load(open('data/projects.json'))
coding_all = []
TYPES = {'learn', 'build', 'ai', 'incident', 'practice', 'test', 'talk'}
for m in mods:
    p = 'data/program/%s.txt' % m
    if not os.path.exists(p): err(m, 'module file missing'); continue
    t = open(p, encoding='utf-8').read()
    s = sections(t)
    for need in ['meta', 'tickets', 'chapter', 'lab', 'quiz'] + ([] if m == 's00' else ['interview']):
        if need not in s: err(m, 'missing @@' + need)
    meta = dict(l.split(':', 1) for l in s.get('meta', '').split('\n') if ':' in l)
    meta = {k.strip(): v.strip() for k, v in meta.items()}
    if meta.get('id') != m: err(m, 'meta id is', meta.get('id'))
    if not meta.get('title') or not meta.get('goal'): err(m, 'meta title/goal missing')
    ch, lab = heads(s.get('chapter')), heads(s.get('lab'))
    if not ch: err(m, 'chapter has no ## headings')
    ids = set()
    for l in s.get('tickets', '').split('\n'):
        if not l.strip(): continue
        f = [x.strip() for x in l.split('|')]
        if len(f) != 6: err(m, 'ticket needs 6 fields:', l[:60]); continue
        tid, typ, h, title, done, tab = f
        if tid in ids: err(m, 'duplicate ticket id', tid)
        ids.add(tid)
        if typ not in TYPES: err(m, tid, 'unknown type', typ)
        try:
            if not 0 < float(h) <= (5 if tab == 'mock' else 3): err(m, tid, 'odd hours', h)
        except ValueError: err(m, tid, 'hours not a number', h)
        r = re.match(r'chapter:(\d+)-(\d+)$', tab)
        if r:
            a, b = int(r.group(1)), int(r.group(2))
            if not (0 <= a <= b < len(ch)): err(m, tid, 'chapter range', tab, 'but chapter has', len(ch), 'sections')
        elif re.match(r'(py|sql|spark):(\d+)-(\d+)$', tab):
            bank = {'py': pybank, 'sql': sqlbank, 'spark': sparkbank}[tab.split(':')[0]]
            a, b = map(int, tab.split(':')[1].split('-'))
            if not (1 <= a <= b <= sum(1 for x in bank if x.get('m') == m)): err(m, tid, 'exercise range', tab, 'out of bounds')
        elif tab not in ('chapter', 'lab', 'practice', 'quiz', 'interview', 'coding', 'readings', 'mock'): err(m, tid, 'unknown tab', tab)
        if tab == 'coding' and 'coding' not in s: err(m, tid, 'coding ticket but no @@coding')
        if not done: err(m, tid, 'empty done-when')
    q = blocks(s.get('quiz'), ['TYPE', 'TAG', 'Q', 'ANS', 'WHY', 'MODEL'], True)
    if len(q) < 5: err(m, 'only', len(q), 'quiz questions')
    for i, x in enumerate(q):
        ty = x.get('TYPE', '').strip()
        if ty not in ('mcq', 'fill', 'short'): err(m, 'quiz', i + 1, 'bad TYPE', ty)
        if not x.get('Q', '').strip(): err(m, 'quiz', i + 1, 'empty Q')
        if ty == 'mcq':
            if len(x.get('opts', [])) < 3: err(m, 'quiz', i + 1, 'mcq has', len(x.get('opts', [])), 'options')
            if x.get('ANS', '').strip() not in x.get('opts', []): err(m, 'quiz', i + 1, 'ANS', x.get('ANS'), 'not an option')
        if ty == 'fill' and not x.get('ANS', '').strip(): err(m, 'quiz', i + 1, 'fill without ANS')
        if ty == 'short' and not (x.get('MODEL') or x.get('ANS')): err(m, 'quiz', i + 1, 'short without MODEL')
        if not x.get('WHY', '').strip() and ty != 'short': warn(m, 'quiz', i + 1, 'no WHY')
    iv = blocks(s.get('interview'), ['Q', 'SRC', 'TAG', 'A'], False)
    if len(iv) < 5 and m != 's00': err(m, 'only', len(iv), 'interview questions')
    for i, x in enumerate(iv):
        if not x.get('Q', '').strip() or not x.get('A', '').strip(): err(m, 'interview', i + 1, 'missing Q or A')
    for i, c in enumerate(blocks(s.get('coding'), ['TITLE', 'KIND', 'MIN', 'TAG', 'SRC', 'PROBLEM', 'SOLUTION'], False)):
        if c.get('KIND', '').strip() not in ('sql', 'pyspark', 'python', 'dsa'): err(m, 'coding', i, 'bad KIND', c.get('KIND'))
        sol = c.get('SOLUTION', '')
        tm = re.search(r'<!--test\n?([\s\S]*?)-->', sol)
        code = re.search(r'```(?:\w+)?\n([\s\S]*?)```', re.sub(r'<!--test[\s\S]*?-->', '', sol))
        if not tm: err(m, 'coding', i, c.get('TITLE'), 'has no hidden test')
        if not code: err(m, 'coding', i, c.get('TITLE'), 'has no code block in SOLUTION')
        if tm and code: coding_all.append((m, i, c.get('TITLE', '').strip(), c['KIND'].strip(), code.group(1), tm.group(1)))
    # backticked repo paths in AI labs must exist
    if m.startswith('a'):
        base = 'projects/ai-foundations/'
        for pth in set(re.findall(r'`(?:python3? (?:-m \w+ )?)?((?:labs|harness|tasks|tests|prompts|data|memory|automations|workflows)/[\w./-]+?\.(?:py|txt|jsonl|md|yml\.example|yml))', t)):
            if not os.path.exists(base + pth) and '_mine' not in pth: err(m, 'lab mentions missing file', pth)
    if m not in design and not m.startswith('x') and not m.startswith('p'): warn(m, 'no design problem')
    for l in re.findall(r'\]\((https?://[^)\s]+)\)', t):
        if ' ' in l or l.endswith('.'): err(m, 'suspicious link', l)

if len(gitl) != 16: err('git.json has', len(gitl), 'lessons')
for g in gitl:
    for k in ('n', 'title', 'why', 'commands', 'mistake', 'interview'):
        if not g.get(k): err('git lesson', g.get('n'), 'missing', k)
gl = open('labs/git/gitlab.sh').read()
for g in gitl:
    if not re.search(r'^\s*%d\)' % g['n'], gl, re.M): err('gitlab.sh has no setup case for lesson', g['n'])
for k, d in design.items():
    for f in ('title', 'prompt', 'deliverable'):
        if not d.get(f): err('design', k, 'missing', f)
for it in news['items']:
    for f in ('title', 'summary', 'why', 'url', 'source'):
        if not it.get(f): err('news item missing', f, it.get('title'))
pmods = set()
for p in projects:
    if p.get('mod') not in mods: err('project', p['id'], 'module', p.get('mod'), 'not in program')
    pmods.add(p.get('mod'))
    if p.get('readme') and not os.path.exists(p['readme']): err('project', p['id'], 'readme missing', p['readme'])
    for f in ('title', 'goal', 'stack', 'parts', 'status'):
        if not p.get(f): err('project', p['id'], 'missing', f)
for n in ('dsa', 'sql', 'spark', 'py'):
    b = json.load(open('data/bank/%s.json' % n))
    ids = [x['id'] for x in b]
    if len(ids) != len(set(ids)): err(n, 'duplicate ids')
    for x in b:
        for f in ('t', 'p', 'sol', 'h', 'lv'):
            if not x.get(f): err(n, x.get('id'), 'missing', f)

# run every coding test's reference solution through the real runtime
if '--no-run' not in sys.argv:
    try:
        import runtime
        runtime.seed()
        for m, i, title, kind, code, test in coding_all:
            r = json.loads(runtime.run_program_test(code, test, kind if kind in ('sql', 'pyspark') else 'python'))
            if not r.get('ok'): err('coding test', m, i, title, 'reference fails:', (r.get('err') or '')[:200])
    except ImportError as e:
        warn('runtime not importable, skipped coding runs:', e)

for w in W: print('WARN ', w)
for e in E: print('ERROR', e)
print('%d modules, %d coding tests, %d errors, %d warnings' % (len(mods), len(coding_all), len(E), len(W)))
sys.exit(1 if E else 0)
