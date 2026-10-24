"""Lab 5: one task, three graders.  python labs/lab5_evals.py  -> reports/lab5.md
TODO: improve grade_rubric's rubric, then compare graders on a real provider."""
import json, os, re, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import llm
ROOT = os.path.join(os.path.dirname(__file__), '..')
cases = [json.loads(l) for l in open(os.path.join(ROOT, 'data/eval_failures.jsonl'))]

def grade_exact(c):
    """Code grader: the explanation must name the right cause."""
    return c['cause'].replace('_', ' ') in c['explanation'].lower()

def grade_regex_evidence(c):
    """Code grader: the explanation must quote part of the log."""
    return any(chunk in c['explanation'] for chunk in re.findall(r'\w[\w\s:\.]{12,}', c['log'])[:3])

RUBRIC = """<role>You grade incident explanations.</role>
<rubric>cause: names a specific cause. evidence: quotes the log. concise: under 60 words.</rubric>
<output_format>{"criteria": {"cause": bool, "evidence": bool, "concise": bool}, "score": 0-3}</output_format>
Grade criterion by criterion before giving the score."""

def grade_rubric(c):
    r = llm.chat(RUBRIC, [{'role': 'user', 'content': 'Log: ' + c['log'] + '\nExplanation: ' + c['explanation']}], max_tokens=120)
    try:
        j = json.loads(r.text[r.text.find('{'):r.text.rfind('}') + 1])
        return j['score'] >= 2
    except Exception:
        return False

res = [(c, grade_exact(c), grade_regex_evidence(c), grade_rubric(c)) for c in cases]
os.makedirs(os.path.join(ROOT, 'reports'), exist_ok=True)
with open(os.path.join(ROOT, 'reports/lab5.md'), 'w') as f:
    n = len(res)
    f.write(f'# Lab 5 · {n} cases · provider {llm.provider()}\n\n| grader | pass rate |\n|---|---|\n')
    for i, name in enumerate(['exact cause (code)', 'quotes evidence (code)', 'rubric (model judge)']):
        f.write(f'| {name} | {sum(r[i + 1] for r in res) / n:.0%} |\n')
    f.write('\n## Disagreements\n')
    for c, a, b, d in res:
        if len({a, b, d}) > 1:
            f.write(f'- {c["log"][:70]} → exact {a}, evidence {b}, judge {d}\n')
print(open(os.path.join(ROOT, 'reports/lab5.md')).read())
