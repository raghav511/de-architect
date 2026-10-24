"""Lab 4: an automation. Reads the newest file in data/inbox/ (or the log cases), asks the agent for a short report,
and writes reports/daily/<date>.md. Rerunning on the same day overwrites the file (idempotent)."""
import datetime as dt, glob, json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import llm
ROOT = os.path.join(os.path.dirname(__file__), '..')
src = sorted(glob.glob(os.path.join(ROOT, 'data/inbox/*')))
text = open(src[-1]).read() if src else '\n'.join(json.loads(l)['log'] for l in open(os.path.join(ROOT, 'data/log_cases.jsonl')))
SYSTEM = '<role>On-call lead.</role><task>Summarise these failures for the team.</task><constraints>Max 8 bullets. Group by cause. End with the single most urgent action.</constraints>'
r = llm.chat(SYSTEM, [{'role': 'user', 'content': text[:12000]}], max_tokens=400)
day = dt.date.today().isoformat()
os.makedirs(os.path.join(ROOT, 'reports/daily'), exist_ok=True)
path = os.path.join(ROOT, f'reports/daily/{day}.md')
with open(path, 'w') as f:
    f.write(f'# Daily report {day}\n\n{r.text}\n\n_model {r.model} · tokens {r.usage["input"]}+{r.usage["output"]} · ${r.cost:.5f}_\n')
print('wrote', path)
