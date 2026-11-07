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
# reels written by tools/reels/write.py for sections without a hand-written one
for f in sorted(glob.glob(os.path.join(os.path.dirname(__file__), 'auto', '*.json'))):
    mid = os.path.basename(f)[:-5]; have = {r['sec'] for r in out.get(mid, [])}
    for head, v in json.load(open(f)).items():
        if v['sec'] in have or head in have: continue
        for i, r in enumerate(v['reels']):
            r = dict(r); r['sec'] = v['sec']; r['id'] = '%s-%s-w%d' % (mid, re.sub('[^a-z0-9]+', '', v['sec'].lower())[:24], i)
            words = sum(len(re.findall(r"\S+", b['say'])) for b in r['beats']); r['secs'] = round(words / 2.5)
            if not 60 <= words <= 160: errs.append('%s: %d words' % (r['id'], words)); continue
            out.setdefault(mid, []).append(r)
if errs: sys.exit('\n'.join(errs))
# keep links to recordings that already match the text (tools/reels/voice.py records the rest)
import hashlib
for reels in out.values():
    for r in reels:
        for i, b in enumerate(r['beats']):
            h = hashlib.sha1(('kokoro|af_heart||' + b['say']).encode()).hexdigest()[:10]
            f = 'audio/reels/%s-%d-%s.m4a' % (r['id'], i, h)
            if os.path.exists(f): b['audio'] = f
json.dump(out, open('data/reels.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(sum(len(v) for v in out.values()), 'reels in', len(out), 'modules')
