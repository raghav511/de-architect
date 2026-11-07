"""Builds data/reels.json from the hand-written scripts in tools/reels/*.py (one file per module).
Each reel narrates 30 to 60 seconds: 70 to 150 words at about 150 words a minute. A point that does not fit
goes into the next reel ("part 2 of 2"). Run: python3 tools/reels/build.py"""
import json, glob, os, re, runpy, sys
out, errs = {}, []
for f in sorted(glob.glob(os.path.join(os.path.dirname(__file__), 'r_*.py'))):
    d = runpy.run_path(f)
    mid = d['MID']; reels = d['REELS']
    for i, r in enumerate(reels):
        r['id'] = r.get('id') or '%s-%s-%d' % (mid, re.sub('[^a-z0-9]+', '', r['sec'].lower())[:24], i)
        words = sum(len(re.findall(r"\S+", b['say'])) for b in r['beats'])
        r['secs'] = round(words / 2.5)
        if not 70 <= words <= 150: errs.append('%s: %d words (needs 70 to 150 for 30 to 60 seconds)' % (r['id'], words))
        c = r.get('check')
        if c and not 0 <= c['ans'] < len(c['opts']): errs.append(r['id'] + ': check answer out of range')
    out[mid] = reels
if errs: sys.exit('\n'.join(errs))
json.dump(out, open('data/reels.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(sum(len(v) for v in out.values()), 'reels in', len(out), 'modules')
