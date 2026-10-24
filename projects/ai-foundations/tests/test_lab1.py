import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
os.environ['PROVIDER'] = 'mock'
from labs.lab1_loop import run_agent

def test_calculator():
    assert '69111' in run_agent('What is 1234 * 56 + 7?')

def test_read_file():
    assert 'order_id' in run_agent('What is in data/orders.txt?')

def test_both_tools():
    assert '500' in run_agent('Read data/orders.txt and add up the amount column: give the total.')
