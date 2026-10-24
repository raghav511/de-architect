"""Lab 3: measure prompt versions for accuracy, tokens and cost.  python labs/lab3_prompts.py
Writes reports/lab3.md. Run with PROVIDER=mock first, then with a real provider."""
import glob, json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import llm
ROOT = os.path.join(os.path.dirname(__file__), '..')
cases = [json.loads(l) for l in open(os.path.join(ROOT, 'data/log_cases.jsonl'))]

def classify(prompt, log):
    r = llm.chat(prompt + '\nClassify the log.', [{'role': 'user', 'content': 'log: ' + log}], max_tokens=40)
    try:
        label = json.loads(r.text[r.text.find('{'):r.text.rfind('}') + 1])['label']
    except Exception:
        label = r.text.strip().split()[0].lower() if r.text.strip() else ''
    return label, r

def main():
    rows = []
    for path in sorted(glob.glob(os.path.join(ROOT, 'prompts/v*.txt'))):
        prompt = open(path).read()
        ok = tin = tout = cost = 0
        for c in cases:
            label, r = classify(prompt, c['log'])
            ok += label == c['label']; tin += r.usage['input']; tout += r.usage['output']; cost += r.cost
        n = len(cases)
        rows.append((os.path.basename(path), ok / n, tin / n, tout / n, cost / n * 100))
    os.makedirs(os.path.join(ROOT, 'reports'), exist_ok=True)
    with open(os.path.join(ROOT, 'reports/lab3.md'), 'w') as f:
        f.write(f'# Lab 3 · provider {llm.provider()} · model {llm.model_name()}\n\n| prompt | accuracy | avg input tokens | avg output tokens | cost per 100 runs (USD) |\n|---|---|---|---|---|\n')
        for name, acc, ti, to, c100 in rows:
            f.write(f'| {name} | {acc:.0%} | {ti:.0f} | {to:.0f} | {c100:.4f} |\n')
        f.write('\nWhich would you ship, and why? (two sentences)\n')
    print(open(os.path.join(ROOT, 'reports/lab3.md')).read())

if __name__ == '__main__':
    main()
