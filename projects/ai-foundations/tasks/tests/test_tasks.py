import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from dedupe import latest_per_key
from sessionize import sessions
from parse_logs import error_counts

def test_dedupe_keeps_latest():
    rows = [{'event_id': 'a', 'ts': 2, 'v': 'new'}, {'event_id': 'a', 'ts': 1, 'v': 'old'}, {'event_id': 'b', 'ts': 1, 'v': 'x'}]
    assert [r['v'] for r in latest_per_key(rows)] == ['new', 'x']

def test_sessions():
    assert sessions([]) == 0
    assert sessions([0, 10, 40]) == 1
    assert sessions([0, 31, 100]) == 3

def test_error_counts():
    lines = ['2026-10-20T08:01:02 ERROR svc=payments msg=timeout', '', '2026-10-20T08:01:03  INFO svc=payments', '2026-10-20T08:01:04 ERROR  svc=search msg=oom']
    assert error_counts(lines) == {'payments': 1, 'search': 1}
