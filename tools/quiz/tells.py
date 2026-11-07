"""List the multiple-choice questions whose right option is the longest or the shortest (what validate.py limits to 40% per module).

    python3 tools/quiz/tells.py [module ...]
"""
import re, sys, glob, os
sys.path.insert(0, os.path.dirname(__file__))
from same import sections

for f in sorted(glob.glob('data/program/*.txt')):
    m = os.path.basename(f)[:-4]
    if len(sys.argv) > 1 and m not in sys.argv[1:]: continue
    quiz = sections(open(f).read()).get('quiz') or ''
    rows, n = [], 0
    for k, blk in enumerate(b for b in re.split(r'\n---[ \t]*(?=\n|$)', quiz) if b.strip()):
        opts = dict(re.findall(r'^([A-D])\)\s(.*)$', blk, re.M)); a = re.search(r'^ANS:\s?(.*)$', blk, re.M)
        if not opts or not a: continue
        n += 1; ans = a.group(1).strip(); others = [len(v) for l, v in opts.items() if l != ans]
        tag = 'LONGEST' if all(len(opts[ans]) > o for o in others) else 'SHORTEST' if all(len(opts[ans]) < o for o in others) else ''
        if tag: rows.append('  Q%d %s (right %s: %d chars; others %s) %s' % (k + 1, tag, ans, len(opts[ans]), others, re.search(r'^Q:\s?(.*)$', blk, re.M).group(1)[:70]))
    lo = sum('LONGEST' in r for r in rows); sh = sum('SHORTEST' in r for r in rows)
    ok = lo <= 0.4 * n and sh <= 0.4 * n
    print('%s %s: %d mcq, right is longest in %d, shortest in %d (limit %d each)' % ('ok  ' if ok else 'FAIL', m, n, lo, sh, int(0.4 * n)))
    if not ok or len(sys.argv) > 1: print('\n'.join(rows))
