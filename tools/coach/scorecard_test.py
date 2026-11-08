"""Live mock scorecard in the coach digest, on a made-up state (never real learner data, never the sync URL).
Usage: python3 tools/coach/scorecard_test.py   (from the repo root)"""
import contextlib, io, json, os, sys, tempfile, datetime as dt
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import coach

os.environ.pop('DA_SYNC_URL', None)
coach.sync_url = lambda: sys.exit('the scorecard test must never reach the sync script')
fails = []
def check(name, ok):
    print('PASS ' if ok else 'FAIL ', name)
    if not ok: fails.append(name)

def run(state):
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as f:
        json.dump({'data': state}, f)
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        coach.digest(f.name, dt.datetime(2026, 11, 8, 21, 0))
    os.unlink(f.name)
    t = buf.getvalue()
    return t[t.index('## Last live mock scorecard'):].split('\n## ')[0]

q = lambda n: {'label': 'Q' + str(n), 'q': 'Made-up question %d' % n, 'points': []}
base = {'start': '2026-10-19', 'settings': {}, 'done': {}, 'doneAt': {}}
state = dict(base, live={
    '2026-11-06': {'kind': 'wd', 'mod': 's05', 'level': 'staff', 'done': 1, 'qs': [q(1)], 'ans': {'0': {'sc': {'correct': 4, 'depth': 4, 'trade': 4, 'clear': 4}}}},
    '2026-11-07': {'kind': 'we', 'mod': 's06', 'level': 'staff', 'done': 2, 'qs': [q(1), q(2), q(3), q(4)], 'ans': {
        '0': {'sc': {'correct': 4, 'depth': 3, 'trade': 2, 'clear': 4}, 'checks': {'rejected': True, 'limits': True}, 'fb': 'name the cost'},
        '1': {'sc': {'correct': 3, 'depth': 2, 'trade': 1, 'clear': 3}, 'checks': {'operate': True}, 'self': True},
        '2': {'sc': {'correct': 1, 'depth': 1, 'trade': 1, 'clear': 1}, 'checks': {}, 'skipped': True},
        '3': {'sc': {'correct': 4, 'depth': 4, 'trade': 3, 'clear': 4}, 'simHints': 2, 'fb': 'good'}}},
    '2026-11-08': {'kind': 'wd', 'mod': 's06', 'level': 'staff', 'qs': [q(1)], 'ans': {}}})  # started today, not finished
t = run(state)
print(t)
check('picks the last finished mock, not one still open', '2026-11-07 · weekend round · module s06' in t)
check('four averages', 'correctness 3.0; depth and internals 2.5; trade-offs 1.8; structure and clarity 3.0' in t)
check('overall uses the simulator-hint penalty (3.0, 2.25, 1, 3.25 → 2.4)', 'overall 2.4 of 4' in t)
check('weakest dimension', 'Weakest: trade-offs (1.8).' in t)
check('marked by AI, self and skipped', 'Marked by: AI 2, self 1, skipped 1, of 4 questions' in t)
check('staff checks counted', 'named a rejected alternative 1 of 4, said where it stops scaling 1 of 4, said how to run it 1 of 4' in t)
check('answers under the bar listed', '- Q2 below the bar (2.2)' in t and '- Q3 below the bar (skipped)' in t)
check('no live mock yet', 'No live mock finished yet.' in run(dict(base)))
print('%d failed' % len(fails))
sys.exit(1 if fails else 0)
