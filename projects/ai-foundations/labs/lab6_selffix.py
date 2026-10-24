"""Lab 6: a self-fixing coding agent.  python labs/lab6_selffix.py [--reset]
The agent may read and write files in tasks/ and run tests, but cannot edit tests/. Writes reports/lab6.md."""
import os, shutil, subprocess, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness.agent import run_agent
from harness.trace import show
ROOT = os.path.join(os.path.dirname(__file__), '..')
if '--reset' in sys.argv:
    for f in os.listdir(os.path.join(ROOT, 'tasks/.originals')):
        shutil.copy(os.path.join(ROOT, 'tasks/.originals', f), os.path.join(ROOT, 'tasks', f))
    print('tasks/ reset to the broken versions')
SYSTEM = ('You are a self-fixing coding agent. Loop: run the tests, read the failing module, make ONE small fix with write_file, '
          'run the tests again. Never edit files under tests/. Stop when all tests pass and say so.')
lessons_path = os.path.join(ROOT, 'memory/lessons.md')
lessons = open(lessons_path).read() if os.path.exists(lessons_path) else None
answer, tr = run_agent('Make all tests in tasks/tests pass.', ['run_tests', 'read_file', 'write_file'], system=SYSTEM, max_steps=24, max_tokens_total=200000, name='selffix', lessons=lessons)
final = subprocess.run([sys.executable, '-m', 'pytest', '-q', os.path.join(ROOT, 'tasks/tests')], capture_output=True, text=True).stdout.strip().splitlines()[-1]
steps = sum(1 for l in open(tr.path) if '"kind": "model"' in l)
os.makedirs(os.path.join(ROOT, 'reports'), exist_ok=True)
with open(os.path.join(ROOT, 'reports/lab6.md'), 'w') as f:
    f.write(f'# Lab 6\n\nAnswer: {answer}\n\nFinal test run: {final}\n\nModel calls: {steps} · tokens: {tr.tokens} · cost: ${tr.cost:.5f}\n\nTrace: {tr.path}\n')
print(open(os.path.join(ROOT, 'reports/lab6.md')).read())
