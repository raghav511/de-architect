"""Lab 2: prove each stop condition of harness/agent.py with a test (these pass on the reference harness;
copy the same three checks into your own loop from lab 1 and make test_lab2_mine pass too)."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
os.environ['PROVIDER'] = 'mock'
from harness.agent import run_agent

def test_done():
    a, tr = run_agent('What is 2+2?', ['calculator'])
    assert '4' in a

def test_no_progress():
    a, tr = run_agent('LOOP_FOREVER', ['calculator'], max_steps=10)
    assert a.startswith('STOPPED: no progress')

def test_step_budget():
    a, tr = run_agent('SPIN', ['calculator'], max_steps=3)
    assert a.startswith('STOPPED: step budget')

def test_token_budget():
    a, tr = run_agent('SPIN ' + 'x' * 4000, ['calculator'], max_steps=20, max_tokens_total=1500)
    assert a.startswith('STOPPED: token budget')

def test_trace_written():
    a, tr = run_agent('What is 3*3?', ['calculator'])
    kinds = [l.split('"kind": "')[1].split('"')[0] for l in open(tr.path)]
    assert kinds[0] == 'start' and 'model' in kinds and 'tool' in kinds and kinds[-1] == 'stop'
