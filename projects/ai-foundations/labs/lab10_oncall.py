"""Lab 10: the on-call agent for the lakehouse project.
Prereq: the lakehouse stack is running (cd ../lakehouse && make up-all && make land bronze silver gold), then break it:
    cd ../lakehouse && make break CASE=schema
Run:  python labs/lab10_oncall.py
The agent investigates with READ-ONLY tools and writes reports/incident-<date>.md. It may only PROPOSE a patch;
applying it needs your approval at the prompt."""
import datetime as dt, os, subprocess, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import tools as T
from harness.agent import run_agent
LAKE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'lakehouse'))

def sh(cmd, cwd=LAKE, timeout=180):
    r = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True, timeout=timeout)
    return (r.stdout + r.stderr)[-4000:]

@T.tool('run_checks', 'Run the lakehouse project checks and return PASS/FAIL lines.', {'type': 'object', 'properties': {}})
def run_checks():
    return sh('make check')

@T.tool('run_sql', 'Run a read-only SQL query on Trino (SELECT/SHOW/DESCRIBE only). Returns up to 50 rows.', {'type': 'object', 'properties': {'query': {'type': 'string'}}, 'required': ['query']})
def run_sql(query):
    if not query.strip().lower().startswith(('select', 'with', 'show', 'describe')) or ';' in query.strip().rstrip(';'):
        return 'REFUSED: read-only, single statement only'
    q = query.replace('"', '\\"')
    return sh(f'docker compose exec -T trino trino --output-format TSV_HEADER --execute "{q}" | head -50')

@T.tool('list_landing', 'List raw files in s3://landing with sizes.', {'type': 'object', 'properties': {}})
def list_landing():
    return sh('docker compose exec -T spark aws --endpoint-url http://s3:8333 s3 ls --recursive s3://landing/ | tail -40')

@T.tool('propose_patch', 'Propose a fix as a unified diff and a one-paragraph explanation. Does NOT apply it.', {'type': 'object', 'properties': {'diff': {'type': 'string'}, 'why': {'type': 'string'}}, 'required': ['diff', 'why']})
def propose_patch(diff, why):
    os.makedirs('reports', exist_ok=True)
    path = f'reports/patch-{dt.date.today()}.diff'
    open(path, 'w').write(diff)
    return f'saved {path}; waiting for human approval'
propose_patch.needs_approval = True

SYSTEM = """<role>You are the on-call data engineer for a lakehouse (Bronze → Silver → Gold on Iceberg).</role>
<task>Find why the checks fail, prove it with evidence, and propose the smallest fix.</task>
<rules>Start with run_checks. Every claim must quote a tool result. Use only read-only tools to investigate.
If you are not sure after 3 queries, say what you know and what you would check next. Never claim a fix works without evidence.</rules>
<output_format>## Cause\n## Evidence (quotes)\n## Proposed fix\n## Confidence (low/medium/high)</output_format>"""

if __name__ == '__main__':
    def approve(call):
        print('\nThe agent wants to', call['name'], '\n', call['input'].get('why', ''))
        return input('Approve? [y/N] ').strip().lower() == 'y'
    answer, tr = run_agent('The lakehouse checks are failing after last night\'s run. Investigate.', ['run_checks', 'run_sql', 'list_landing', 'propose_patch'],
                           system=SYSTEM, max_steps=14, max_tokens_total=120000, approve=approve, name='oncall')
    os.makedirs('reports', exist_ok=True)
    path = f'reports/incident-{dt.date.today()}.md'
    open(path, 'w').write(answer + f'\n\n_trace: {tr.path} · tokens {tr.tokens} · ${tr.cost:.4f}_\n')
    print(answer, '\n\nSaved', path)
