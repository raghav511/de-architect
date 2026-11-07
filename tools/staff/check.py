"""Checks data/staff.json: at least 8 questions per kind, every kind the live mock rotates (LIVE_ROT, LIVE_WE in js/live.js)
present, module tags that exist, 4 or more answer points, no duplicate ids or questions. python3 tools/staff/check.py"""
import json, os, re, sys
R = os.path.join(os.path.dirname(__file__), '../..')
d = json.load(open(os.path.join(R, 'data/staff.json')))
live = open(os.path.join(R, 'js/live.js')).read()
mods = set(re.findall(r"'(\w\d\d)'", re.search(r"const PROGRAM = \[(.*?)\]", open(os.path.join(R, 'sw.js')).read()).group(1))) | {'*'}
need = set(re.findall(r"'(\w+)'", re.search(r"const LIVE_ROT = \{(.*?)\}", live).group(1))) | set(re.findall(r"'(\w+)'", re.search(r"const LIVE_WE = \[(.*?)\]", live).group(1)))
bad = []
for k in set(d['kinds']) | need:
    n = sum(x['kind'] == k for x in d['items'])
    if n < 8: bad.append('kind %s has %d questions (need 8)' % (k, n))
ids, qs = set(), set()
for x in d['items']:
    if x['kind'] not in d['kinds']: bad.append(x['id'] + ': unknown kind ' + x['kind'])
    if x['id'] in ids or x['q'] in qs: bad.append(x['id'] + ': duplicate')
    ids.add(x['id']); qs.add(x['q'])
    if not x['mids'] or any(m not in mods for m in x['mids']): bad.append(x['id'] + ': unknown module in ' + str(x['mids']))
    if len(x.get('points', [])) < 4: bad.append(x['id'] + ': fewer than 4 points')
print('\n'.join('BAD  ' + b for b in bad) or 'ok   %d questions, %d kinds, every live mock kind has 8 or more' % (len(d['items']), len(d['kinds'])))
sys.exit(1 if bad else 0)
