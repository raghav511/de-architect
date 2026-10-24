import os, subprocess, sys
ROOT = os.path.join(os.path.dirname(__file__), '..')
def test_selffix_end_to_end():
    env = dict(os.environ, PROVIDER='mock')
    out = subprocess.run([sys.executable, os.path.join(ROOT, 'labs/lab6_selffix.py'), '--reset'], capture_output=True, text=True, env=env, cwd=ROOT).stdout
    assert '3 passed' in out
    before = open(os.path.join(ROOT, 'tasks/tests/test_tasks.py')).read()
    assert 'def test_sessions' in before
