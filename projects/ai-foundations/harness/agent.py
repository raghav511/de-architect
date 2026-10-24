"""Reference harness: the agent loop with budgets, a no-progress check, approval gates and a trace."""
import json
from harness import llm, tools as T
from harness.trace import Trace

class Stop(Exception):
    pass

def run_agent(task, tool_names, system='You are a careful assistant. Use tools when needed. Answer briefly.',
              max_steps=8, max_tokens_total=20000, approve=None, name='agent', lessons=None):
    """Returns (answer, trace). approve(call) -> bool is asked before any tool marked as needing approval."""
    tr = Trace(name)
    if lessons:
        system += '\n<lessons>\n' + lessons + '\n</lessons>'
    msgs = [{'role': 'user', 'content': task}]
    specs = T.specs(tool_names)
    last_call = None
    tr.log('start', task=task, tools=tool_names, max_steps=max_steps, max_tokens_total=max_tokens_total)
    for step in range(1, max_steps + 1):
        r = llm.chat(system, msgs, specs)
        tr.log('model', step=step, usage=r.usage, cost=r.cost, text=r.text, tool_calls=r.tool_calls, model=r.model)
        if not r.tool_calls:
            tr.log('stop', reason='done', steps=step, tokens=tr.tokens, cost=round(tr.cost, 6))
            return r.text, tr
        if tr.tokens > max_tokens_total:
            tr.log('stop', reason='token_budget', steps=step, tokens=tr.tokens)
            return f'STOPPED: token budget of {max_tokens_total} reached', tr
        msgs.append({'role': 'assistant', 'content': r.text, 'tool_calls': r.tool_calls})
        for c in r.tool_calls:
            sig = (c['name'], json.dumps(c['input'], sort_keys=True))
            if sig == last_call:
                tr.log('stop', reason='no_progress', steps=step, repeated=c['name'])
                return f'STOPPED: no progress (repeated {c["name"]} with the same input)', tr
            last_call = sig
            if approve and getattr(T.REGISTRY.get(c['name'], {}).get('fn'), 'needs_approval', False) and not approve(c):
                out = 'DENIED: a human did not approve this action'
            else:
                out = T.run(c)
            tr.log('tool', name=c['name'], input=c['input'], output=out[:2000])
            msgs.append({'role': 'tool', 'tool_call_id': c['id'], 'content': out})
    tr.log('stop', reason='step_budget', steps=max_steps)
    return f'STOPPED: step budget of {max_steps} reached', tr
