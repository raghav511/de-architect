"""Lab 7: a prompt that improves itself.  python labs/lab7_optimise.py
Loop for 3 rounds: score on TRAIN, collect failures, ask the model for a better prompt, keep it only if TRAIN improves.
Always report HELD-OUT accuracy: that is the only number that counts."""
import json, os, random, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import llm
from labs.lab3_prompts import classify
ROOT = os.path.join(os.path.dirname(__file__), '..')
cases = [json.loads(l) for l in open(os.path.join(ROOT, 'data/log_cases.jsonl'))]
random.Random(1).shuffle(cases)
train, held = cases[:12], cases[12:]
def score(prompt, data):
    res = [(c, classify(prompt, c['log'])[0]) for c in data]
    return sum(c['label'] == y for c, y in res) / len(data), [c for c, y in res if c['label'] != y]
prompt = open(os.path.join(ROOT, 'prompts/v1_one_line.txt')).read()
best, fails = score(prompt, train)
print(f'round 0 · train {best:.0%} · held-out {score(prompt, held)[0]:.0%}')
for rnd in range(1, 4):
    # TODO: write the optimiser prompt. Give the current prompt, the labels, and the failed cases (log + correct label),
    # and ask for an improved prompt only (no commentary). With PROVIDER=mock this step adds the failures as examples instead.
    if llm.provider() == 'mock':
        candidate = open(os.path.join(ROOT, 'prompts/v2_structured.txt')).read() + '\n<examples>\n' + '\n'.join(f'log: "{c["log"]}" -> {{"label": "{c["label"]}"}}' for c in fails[:3]) + '\n</examples>'
    else:
        ask = 'Improve this classification prompt. Labels: oom, schema_change, timeout, upstream_missing, permission.\n<prompt>' + prompt + '</prompt>\n<failures>' + json.dumps(fails[:6]) + '</failures>\nReturn only the new prompt.'
        candidate = llm.chat('You write excellent prompts.', [{'role': 'user', 'content': ask}], max_tokens=600).text
    acc, f2 = score(candidate, train)
    if acc > best:
        prompt, best, fails = candidate, acc, f2
    print(f'round {rnd} · train {best:.0%} · held-out {score(prompt, held)[0]:.0%}')
open(os.path.join(ROOT, 'prompts/optimised.txt'), 'w').write(prompt)
print('Saved prompts/optimised.txt. Did held-out improve as much as train? If not, it overfit.')
