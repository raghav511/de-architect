"""A stand-in coach for automated tests: writes a valid report for the fetched state without Claude.
python3 tools/coach/stub_coach.py STATE.json OUT.json"""
import json, sys, datetime as dt
state = json.load(open(sys.argv[1]))
S = state.get('data') or {}
now = dt.datetime.now().astimezone()
tomorrow = (now + dt.timedelta(days=1)).date()
n = 5 if tomorrow.weekday() == 6 else 3
struggled = [q for q, h in (S.get('hints') or {}).items() if h >= 2][:3]
fb = {}
for day, m in (S.get('mock') or {}).items():
    if m.get('sub'):
        fb[day] = {'score': 3, 'overall': 'Test grading.', 'items': [{'score': 3, 'feedback': 'Test feedback for question %d.' % (i + 1), 'better': 'A test answer.'} for i in range(len(m.get('qs', [])))]}
json.dump({'version': 1, 'generated_at': now.isoformat(timespec='seconds'), 'summary': 'Test coach report.', 'strengths': ['test'], 'weaknesses': ['test'],
           'focus': [{'title': 'Review ' + q, 'why': 'test', 'href': '#/dsa/' + q if q.startswith('d') else '#/practice/review', 'mins': 10} for q in struggled] or [{'title': 'Path', 'why': 'test', 'href': '#/path/s00', 'mins': 5}],
           'review_add': struggled, 'mock_feedback': fb,
           'next_mock': {tomorrow.isoformat(): {'kind': 'sunday' if n == 5 else 'daily', 'questions': [{'q': 'Test question %d?' % (i + 1), 'tag': 'core', 'why': 'test'} for i in range(n)]}}},
          open(sys.argv[2], 'w'), indent=1)
