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
# reels written by tools/reels/write.py: for sections without a hand-written series, and in place of an older
# single hand-written reel (one without levels) once the four-level series exists
for f in sorted(glob.glob(os.path.join(os.path.dirname(__file__), 'auto', '*.json'))):
    mid = os.path.basename(f)[:-5]
    have = {s for s in {r['sec'] for r in out.get(mid, [])} if all(r.get('level') for r in out[mid] if r['sec'] == s)}
    for head, v in json.load(open(f)).items():
        if v['sec'] in have or head in have: continue
        out[mid] = [r for r in out.get(mid, []) if r['sec'] != v['sec']]
        for i, r in enumerate(v['reels']):
            r = dict(r); r['sec'] = v['sec']; r['id'] = '%s-%s-w%d' % (mid, re.sub('[^a-z0-9]+', '', v['sec'].lower())[:24], i)
            words = sum(len(re.findall(r"\S+", b['say'])) for b in r['beats']); r['secs'] = round(words / 2.5)
            if not 60 <= words <= 160: errs.append('%s: %d words' % (r['id'], words)); continue
            out.setdefault(mid, []).append(r)
# every picture in the shape js/reelfx.js draws: written reels sometimes give a flow as steps or nodes instead of items
# (260 beats did, and a reel next to one crashed the player); anything else the engine cannot draw stops the build
KINDS = {'scene', 'big', 'points', 'flow', 'bars', 'code', 'disk', 'shift', 'fig'}
def picture(rid, s):
    t = s.get('t', 'big')
    if t == 'flow' and not isinstance(s.get('items'), list):
        s['items'] = [x if isinstance(x, str) else x.get('label') or x.get('text') or '' for x in s.pop('steps', None) or s.pop('nodes', None) or []]
        s['items'] = [x for x in s['items'] if x]
    if t not in KINDS: return '%s: unknown picture type %r' % (rid, t)
    if t in ('flow', 'points') and not (isinstance(s.get('items'), list) and all(isinstance(x, str) for x in s['items'])): return rid + ': %s picture needs items, a list of strings' % t
    if t == 'bars' and not (isinstance(s.get('items'), list) and all(isinstance(x, list) and len(x) > 1 and isinstance(x[1], (int, float)) for x in s['items'])): return rid + ': bars picture needs items [[label, number, note]]'
    if t == 'scene' and not all(isinstance(st, dict) and (not st.get('race') or isinstance(st['race'].get('items'), list)) and (not st.get('cells') or isinstance(st['cells'].get('items'), list)) for st in s.get('steps', [])): return rid + ': scene step with race or cells but no items'
for reels in out.values():
    for r in reels:
        if not r.get('beats') or not all(isinstance(b.get('say'), str) for b in r['beats']): errs.append(r['id'] + ': needs beats, each with say'); continue
        for b in r['beats']:
            e = picture(r['id'], b.setdefault('show', {'t': 'big', 'text': ''}))
            if e: errs.append(e)
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
# the app loads one module at a time: data/reels/<mid>.json, named in data/reels/index.json by a hash of its text,
# so the service worker can keep each file until its module changes (data/reels.json stays whole for the routines)
os.makedirs('data/reels', exist_ok=True)
index = {}
for mid, reels in out.items():
    body = json.dumps(reels, ensure_ascii=False, separators=(',', ':'))
    index[mid] = hashlib.sha1(body.encode()).hexdigest()[:10]
    open('data/reels/%s.json' % mid, 'w').write(body)
for f in os.listdir('data/reels'):
    if f != 'index.json' and f[:-5] not in index: os.remove(os.path.join('data/reels', f))
json.dump(index, open('data/reels/index.json', 'w'), separators=(',', ':'))
print(sum(len(v) for v in out.values()), 'reels in', len(out), 'modules')
