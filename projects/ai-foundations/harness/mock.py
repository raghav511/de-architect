"""A scripted, offline 'model' so every lab runs for free. It follows simple rules:
use a tool when the question needs one, then answer from the tool result. Good for building and
testing the harness; switch PROVIDER to a real model to see real behaviour."""
import json, re, itertools
from harness.llm import Reply, count_tokens_rough
_ids = itertools.count(1)

def _usage(system, messages, out):
    inp = count_tokens_rough(system + json.dumps(messages))
    return {'input': inp, 'output': count_tokens_rough(out), 'cache_read': 0}

def mock_chat(system, messages, tools):
    names = {t['name'] for t in tools}
    last_user = next((m['content'] for m in reversed(messages) if m['role'] == 'user'), '')
    tool_msgs = [m for m in messages if m['role'] == 'tool']
    # self-fixing scenario (lab 6): run tests -> read the failing module -> write a fix -> run tests
    if 'self-fixing' in system and 'write_file' in names:
        return _selffix(system, messages)
    # forced loop scenario for testing stop conditions
    if 'LOOP_FOREVER' in last_user and 'calculator' in names:
        return Reply(tool_calls=[{'id': f'm{next(_ids)}', 'name': 'calculator', 'input': {'expression': '1+1'}}], usage=_usage(system, messages, 'loop'))
    if 'SPIN' in last_user and 'calculator' in names:
        return Reply(tool_calls=[{'id': f'm{next(_ids)}', 'name': 'calculator', 'input': {'expression': str(len(tool_msgs))}}], usage=_usage(system, messages, 'spin'))
    m = re.search(r'([\d\.]+\s*[\+\-\*/]\s*[\d\.\s\+\-\*/\(\)]+)', last_user)
    f = re.search(r'([\w/\.-]+\.(?:txt|md|csv|json|log))', last_user)
    used = [t for m_ in messages if m_['role'] == 'assistant' for t in (m_.get('tool_calls') or [])]
    used_names = [t['name'] for t in used]
    if f and 'read_file' in names and 'read_file' not in used_names:
        return Reply(tool_calls=[{'id': f'm{next(_ids)}', 'name': 'read_file', 'input': {'path': f.group(1)}}], usage=_usage(system, messages, f.group(1)))
    if 'calculator' in names and 'calculator' not in used_names:
        expr = None
        if m:
            expr = m.group(1).strip()
        elif tool_msgs and re.search(r'(total|sum|add|multiply|times)', last_user, re.I):
            body = tool_msgs[-1]['content'].strip().splitlines()
            if len(body) > 1 and ',' in body[0]:
                nums = [l.split(',')[-1] for l in body[1:] if re.fullmatch(r'-?\d+(?:\.\d+)?', l.split(',')[-1].strip())]
            else:
                nums = re.findall(r'-?\d+(?:\.\d+)?', tool_msgs[-1]['content'])
            if nums:
                expr = '+'.join(nums)
        if expr:
            return Reply(tool_calls=[{'id': f'm{next(_ids)}', 'name': 'calculator', 'input': {'expression': expr}}], usage=_usage(system, messages, expr))
    if tool_msgs:
        ans = 'Answer: ' + tool_msgs[-1]['content'].strip()[:400]
        return Reply(text=ans, usage=_usage(system, messages, ans))
    # classification tasks (lab 3/7): keyword rules standing in for a model
    if re.search(r'classify|label', system + last_user, re.I):
        t = last_user.lower()
        lab = 'oom' if re.search(r'memory|oom|killed', t) else 'schema_change' if re.search(r'column|schema|cannot resolve', t) else 'timeout' if 'timeout' in t or 'timed out' in t else 'permission' if re.search(r'denied|permission|403', t) else 'upstream_missing'
        if 'examples' not in system.lower() and re.search(r'exit code 137', t):
            lab = 'timeout'    # the weak prompt makes this classic mistake; examples fix it
        out = json.dumps({'label': lab})
        return Reply(text=out, usage=_usage(system, messages, out))
    if re.search(r'rubric|grade', system, re.I):
        out = json.dumps({'criteria': {'cause': True, 'evidence': 'quote' in last_user.lower() or '"' in last_user, 'concise': len(last_user) < 2000}, 'score': 3})
        return Reply(text=out, usage=_usage(system, messages, out))
    ans = 'I could not find a tool that answers this. Please give me more context.'
    return Reply(text=ans, usage=_usage(system, messages, ans))

def _selffix(system, messages):
    import os, re
    calls = [t for m in messages if m['role'] == 'assistant' for t in (m.get('tool_calls') or [])]
    last_tool = next((m for m in reversed(messages) if m['role'] == 'tool'), None)
    def call(name, inp):
        return Reply(tool_calls=[{'id': f'm{next(_ids)}', 'name': name, 'input': inp}], usage=_usage(system, messages, name))
    if not calls or calls[-1]['name'] == 'write_file':
        return call('run_tests', {'path': 'tasks/tests'})
    if calls[-1]['name'] == 'run_tests':
        out = last_tool['content'] if last_tool else ''
        if re.search(r'\b\d+ passed\b', out) and 'failed' not in out:
            ans = 'All tests pass.'
            return Reply(text=ans, usage=_usage(system, messages, ans))
        m = re.search(r'tasks/tests/test_tasks.py::test_(\w+)', out) or re.search(r'def test_(\w+)', out)
        mod = {'dedupe_keeps_latest': 'dedupe', 'sessions': 'sessionize', 'error_counts': 'parse_logs'}.get(m.group(1) if m else '', 'dedupe')
        return call('read_file', {'path': f'tasks/{mod}.py'})
    if calls[-1]['name'] == 'read_file':
        path = calls[-1]['input']['path']
        fix = open(os.path.join(os.path.dirname(__file__), '..', 'tasks', '.mock_fixes', os.path.basename(path))).read()
        return call('write_file', {'path': path, 'content': fix})
    return call('run_tests', {'path': 'tasks/tests'})
