"""Builds data/story/<mid>.json from tools/story/arcs.py and checks every arc against the app. python3 tools/story/build.py
Checks: a known season; scenes at most 60 words, never naming the protagonist (the learner is "you"); previously and cliff lines present, about
20 words and one line each; and every link in `to` opens real content: the module's own chapter, lab, practice or quiz,
a py, sql or spark exercise in the banks, an F7 step the module has, a simulator challenge in js/sim.js or the module's
design problem. Fails (exit 1) on any problem; --check checks without writing."""
import json, os, re, sys
R = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
sys.path.insert(0, os.path.dirname(__file__))
from arcs import ARCS, SEASONS

mods = re.search(r"const BASE_MODS = \[(.*?)\]", open(os.path.join(R, 'js/plan.js')).read()).group(1).replace("'", '').replace(' ', '').split(',')
bank = {}
for kind in ('py', 'sql', 'spark'):
    for x in json.load(open(os.path.join(R, 'data/bank/%s.json' % kind))): bank[kind + ':' + x['id']] = x
sims = set(re.findall(r"\{ id: '(\w+)', mid: '", open(os.path.join(R, 'js/sim.js')).read()))
design = json.load(open(os.path.join(R, 'data/design.json')))
words = lambda s: len(s.split())

def steps_of(m):
    t = open(os.path.join(R, 'data/program/%s.txt' % m)).read(); b = re.search(r'^@@steps\n(.*?)(?=^@@[a-z]+\s*$)', t, re.S | re.M)
    return set(re.findall(r'^STEP: (\w+)', b.group(1), re.M)) if b else set()

def link_ok(m, h):
    p = h.split('/')
    if p[:2] == ['#', 'learn']: return p[2] == m and p[3] in ('chapter', 'lab', 'practice')
    if p[1] in ('py', 'sql', 'spark'): return (p[1] + ':' + p[2]) in bank
    if p[1] == 'step': return p[2] == m and p[3] in steps_of(m)
    if p[1] == 'sim': return p[2] == 'sc' and p[3] in sims
    if p[1] == 'design': return p[2] == m and m in design
    if p[1] == 'quiz': return p[2] == m
    return False

bad = []
for m, a in ARCS.items():
    e = lambda msg: bad.append(m + ': ' + msg)
    if m not in mods: e('not a module in BASE_MODS')
    if a['season'] not in SEASONS: e('unknown season')
    if not 60 <= words(a['arc']) <= 140: e('arc is %d words (60 to 140)' % words(a['arc']))
    keys = ['monday', 'midweek', 'friday'] + (['finale'] if 'finale' in a else [])
    for k in keys:
        s = a.get(k, '')
        if not s: e('no ' + k + ' scene'); continue
        if words(s) > 60: e('%s scene is %d words (at most 60)' % (k, words(s)))
        if re.search(r'\bJordan\b', s): e(k + ' scene names the protagonist; the learner is "you"')
        h = a['to'].get(k)
        if not h or not link_ok(m, h): e('%s link %s does not open real content' % (k, h))
    for k in ('previously', 'cliff'):
        xs = a.get(k) or []
        if len(xs) < 3: e('fewer than 3 %s lines' % k)
        for x in xs:
            if '\n' in x or not 6 <= words(x) <= 26: e('%s line of %d words: %s' % (k, words(x), x[:50]))
        if k == 'cliff' and not all(x.rstrip().endswith('?') for x in xs): e('every cliffhanger ends with a question mark')

# links named in the bible's outline tables (seasons 3 to 5) must open real content too
here = os.path.dirname(__file__); tail = open(os.path.join(here, 'bible_tail.md')).read()
for line in tail.splitlines():
    mm = re.match(r'^\| \*\*(\w\d\d)\*\*', line)
    if not mm: continue
    for h in re.findall(r'`(#/[^`]+)`', line):
        if h != '#/mock' and not link_ok(mm.group(1), h): bad.append('bible %s: link %s does not open real content' % (mm.group(1), h))

if bad:
    print('\n'.join(bad)); print('%d problems' % len(bad)); sys.exit(1)
if '--check' not in sys.argv:
    out = os.path.join(R, 'data/story'); os.makedirs(out, exist_ok=True)
    for m, a in ARCS.items():
        scenes = {k: a[k] for k in ('monday', 'midweek', 'friday', 'finale') if k in a}
        doc = {'season': a['season'], 'title': a['title'], 'arc': a['arc'], 'previously': a['previously'], 'cliff': a['cliff'], 'scenes': scenes, 'to': a['to']}
        json.dump(doc, open(os.path.join(out, m + '.json'), 'w'), ensure_ascii=False, indent=1); open(os.path.join(out, m + '.json'), 'a').write('\n')
if '--bible' in sys.argv:
    path = sys.argv[sys.argv.index('--bible') + 1]; out = [open(os.path.join(here, 'bible_head.md')).read().rstrip('\n'), '']
    link = lambda h: ' (`%s`)' % h
    for n in sorted({a['season'] for a in ARCS.values()}):
        out += ['### Season %d: %s' % (n, SEASONS[n][0]), '', SEASONS[n][1], '']
        for m, a in ARCS.items():
            if a['season'] != n: continue
            out += ['#### %s: %s' % (m, a['title']), '', a['arc'], '',
                    '- **Monday:** ' + a['monday'] + link(a['to']['monday']), '- **Midweek:** ' + a['midweek'] + link(a['to']['midweek']), '- **Friday:** ' + a['friday'] + link(a['to']['friday'])]
            if 'finale' in a: out.append('- **Finale:** ' + a['finale'] + link(a['to']['finale']))
            out += ['- **Previously on, by day:** ' + ' / '.join(a['previously']), '- **Tomorrow on, by day:** ' + ' / '.join(a['cliff']), '']
    out.append(open(os.path.join(here, 'bible_tail.md')).read())
    open(path, 'w').write('\n'.join(out)); print('bible written to', path)
print('%d arcs, 0 problems' % len(ARCS))
