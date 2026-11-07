"""Summarises the learner's last 7 days of usage (S.metrics) and progress for the morning suggestions.
  python3 tools/coach/coach.py fetch /tmp/da_state.json && python3 tools/insights/digest.py /tmp/da_state.json
Prints totals only: screens, time, draw speed, reel and check rates, errors, steps done per day. Never commit its output."""
import json, sys, collections, datetime as dt
b = json.load(open(sys.argv[1])); S = b.get('data') or b
M = S.get('metrics') or {}
days = sorted(M)
print('# Usage, last %d days with data: %s' % (len(days), ', '.join(days) or 'none'))
scr, perf, ev = collections.Counter(), collections.defaultdict(lambda: [0, 0]), collections.Counter()
opens = collections.Counter()
for d in days:
    m = M[d]
    for k, v in (m.get('screens') or {}).items(): scr[k] += v.get('secs', 0); opens[k] += v.get('n', 0)
    for k, v in (m.get('perf') or {}).items(): perf[k][0] += v[0]; perf[k][1] += v[1]
    ev.update(m.get('ev') or {})
print('\n## Time per screen (minutes, opens)')
for k, v in scr.most_common(15): print('- %s: %.1f min, %d opens' % (k, v / 60, opens[k]))
print('\n## Draw time per screen (average ms on the device)')
for k, (t, n) in sorted(perf.items(), key=lambda x: -x[1][0] / max(1, x[1][1]))[:12]: print('- %s: %d ms over %d draws' % (k, t / max(1, n), n))
print('\n## Events')
for k, v in sorted(ev.items()): print('- %s: %d' % (k, v))
o, f, s = ev.get('reel_open', 0), ev.get('reel_finish', 0), ev.get('reel_skip', 0)
if o: print('\nReels: %d opened, %d finished (%.0f%%), %d left while playing' % (o, f, 100 * f / o, s))
r, w = ev.get('check_right', 0), ev.get('check_wrong', 0)
if r + w: print('Quick checks: %d right, %d wrong (%.0f%% right)' % (r, w, 100 * r / (r + w)))
done = collections.Counter(dt.datetime.fromtimestamp(t / 1000).date().isoformat() for t in (S.get('doneAt') or {}).values() if t)
print('\n## Steps done per day (last 14 days)')
for d in sorted(done)[-14:]: print('- %s: %d' % (d, done[d]))
missed = [k for k, v in (S.get('reels') or {}).items() if v.get('ok') is False]
print('\nReels with a missed check: %d' % len(missed))
