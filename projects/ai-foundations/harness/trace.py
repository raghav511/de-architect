"""Append-only JSONL traces, and a readable timeline: python -m harness.trace traces/<run>.jsonl"""
import json, os, sys, time, uuid
DIR = os.path.join(os.path.dirname(__file__), '..', 'traces')

class Trace:
    def __init__(self, name='run'):
        os.makedirs(DIR, exist_ok=True)
        self.id = time.strftime('%Y%m%d-%H%M%S-') + name + '-' + uuid.uuid4().hex[:4]
        self.path = os.path.join(DIR, self.id + '.jsonl')
        self.tokens = self.cost = 0

    def log(self, kind, **kw):
        kw.update(kind=kind, t=round(time.time(), 3))
        if kind == 'model':
            self.tokens += kw.get('usage', {}).get('input', 0) + kw.get('usage', {}).get('output', 0)
            self.cost += kw.get('cost', 0)
        with open(self.path, 'a') as f:
            f.write(json.dumps(kw, default=str) + '\n')

def show(path):
    t0 = None
    for line in open(path):
        e = json.loads(line); t0 = t0 or e['t']
        head = f"+{e['t'] - t0:6.2f}s {e['kind']:<6}"
        if e['kind'] == 'model':
            print(head, f"tokens in/out {e['usage']['input']}/{e['usage']['output']} cost ${e['cost']:.5f}", ('→ tools: ' + ', '.join(c['name'] for c in e.get('tool_calls', []))) if e.get('tool_calls') else '→ ' + (e.get('text') or '')[:80])
        elif e['kind'] == 'tool':
            print(head, e['name'], json.dumps(e['input'])[:60], '=>', str(e['output'])[:70].replace('\n', ' '))
        else:
            print(head, {k: v for k, v in e.items() if k not in ('kind', 't')})

if __name__ == '__main__':
    show(sys.argv[1])
