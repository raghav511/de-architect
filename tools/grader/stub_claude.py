#!/usr/bin/env python3
"""Stands in for `claude -p` in tests: returns a fixed grade (or, for practice runs, a fixed answer) in claude's JSON shape.
An answer containing IGNORE scores 2; one containing XSS gets HTML in its verdict, to test that the app strips it."""
import json, sys
p = sys.stdin.read()
if 'Read,Grep,Glob' in sys.argv:  # a practice run
    print(json.dumps({'type': 'result', 'subtype': 'success', 'result': 'Stub run: parse_amount strips the comma.\n\n```python\nfloat(s)\n```',
                      'num_turns': 3, 'total_cost_usd': 0.0021, 'usage': {'input_tokens': 6, 'output_tokens': 300, 'cache_read_input_tokens': 9000, 'cache_creation_input_tokens': 2000}}))
    sys.exit(0)
score = 2 if 'IGNORE' in p else 4
verdict = 'Stub grade <img src=x onerror="window.__xss=1"><a href="javascript:window.__xss=2">x</a>' if 'XSS' in p else 'Stub grade.'
print(json.dumps({'type': 'result', 'total_cost_usd': 0.0007, 'structured_output': {
    'score': score, 'verdict': verdict, 'strengths': ['clear'], 'issues': ['no numbers'],
    'improve': 'Add a number.', 'better': 'A better answer.'}}))
