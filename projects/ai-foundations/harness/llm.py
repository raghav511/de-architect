"""One small interface over several model providers, using only the standard library.

chat(system, messages, tools) -> Reply(text, tool_calls, usage, cost)
messages use a neutral format: {"role": "user"|"assistant"|"tool", "content": str, "tool_calls": [...], "tool_call_id": str}
"""
import json, os, re, time, urllib.request
from dataclasses import dataclass, field

def _env():
    p = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(p):
        for line in open(p):
            if '=' in line and not line.strip().startswith('#'):
                k, v = line.strip().split('=', 1)
                os.environ.setdefault(k, v)
_env()

# USD per million tokens (input, output). Edit when prices change; used only for reporting.
PRICES = {'mock': (0, 0), 'gemini-2.5-flash': (0.30, 2.50), 'qwen2.5:3b': (0, 0), 'llama-3.1-8b-instant': (0.05, 0.08),
          'claude-haiku-4-5': (1.0, 5.0), 'claude-sonnet-4-5': (3.0, 15.0)}
DEFAULT_MODEL = {'mock': 'mock', 'gemini': 'gemini-2.5-flash', 'ollama': 'qwen2.5:3b', 'groq': 'llama-3.1-8b-instant', 'anthropic': 'claude-haiku-4-5'}

@dataclass
class Reply:
    text: str = ''
    tool_calls: list = field(default_factory=list)   # [{"id", "name", "input": dict}]
    usage: dict = field(default_factory=lambda: {'input': 0, 'output': 0, 'cache_read': 0})
    cost: float = 0.0
    model: str = ''

def provider():
    return os.environ.get('PROVIDER', 'mock').lower()

def model_name():
    return os.environ.get('MODEL') or DEFAULT_MODEL.get(provider(), 'mock')

def _cost(model, u):
    pi, po = PRICES.get(model, (0, 0))
    return round((u['input'] * pi + u['output'] * po) / 1e6, 6)

def _post(url, body, headers):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={'content-type': 'application/json', **headers})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 529) and attempt < 3:
                time.sleep(2 ** attempt); continue
            raise RuntimeError(f'{e.code} {e.read().decode()[:300]}')

def chat(system, messages, tools=None, max_tokens=800):
    p, m = provider(), model_name()
    if p == 'mock':
        from harness.mock import mock_chat
        r = mock_chat(system, messages, tools or [])
    elif p == 'anthropic':
        r = _anthropic(system, messages, tools, m, max_tokens)
    else:
        base = {'gemini': 'https://generativelanguage.googleapis.com/v1beta/openai', 'groq': 'https://api.groq.com/openai/v1',
                'ollama': os.environ.get('OLLAMA_URL', 'http://localhost:11434') + '/v1'}[p]
        r = _openai_compat(base, system, messages, tools, m, max_tokens)
    r.model = m
    r.cost = _cost(m, r.usage)
    return r

def _anthropic(system, messages, tools, m, max_tokens):
    msgs = []
    for x in messages:
        if x['role'] == 'tool':
            block = {'type': 'tool_result', 'tool_use_id': x['tool_call_id'], 'content': x['content']}
            if msgs and msgs[-1]['role'] == 'user' and isinstance(msgs[-1]['content'], list):
                msgs[-1]['content'].append(block)
            else:
                msgs.append({'role': 'user', 'content': [block]})
        elif x['role'] == 'assistant' and x.get('tool_calls'):
            c = ([{'type': 'text', 'text': x['content']}] if x.get('content') else []) + [{'type': 'tool_use', 'id': t['id'], 'name': t['name'], 'input': t['input']} for t in x['tool_calls']]
            msgs.append({'role': 'assistant', 'content': c})
        else:
            msgs.append({'role': x['role'], 'content': x['content']})
    body = {'model': m, 'max_tokens': max_tokens, 'system': [{'type': 'text', 'text': system, 'cache_control': {'type': 'ephemeral'}}], 'messages': msgs}
    if tools:
        body['tools'] = [{'name': t['name'], 'description': t['description'], 'input_schema': t['schema']} for t in tools]
    j = _post('https://api.anthropic.com/v1/messages', body, {'x-api-key': os.environ['API_KEY'], 'anthropic-version': '2023-06-01'})
    r = Reply()
    for c in j['content']:
        if c['type'] == 'text': r.text += c['text']
        if c['type'] == 'tool_use': r.tool_calls.append({'id': c['id'], 'name': c['name'], 'input': c['input']})
    u = j.get('usage', {})
    r.usage = {'input': u.get('input_tokens', 0) + u.get('cache_creation_input_tokens', 0), 'output': u.get('output_tokens', 0), 'cache_read': u.get('cache_read_input_tokens', 0)}
    return r

def _openai_compat(base, system, messages, tools, m, max_tokens):
    msgs = [{'role': 'system', 'content': system}]
    for x in messages:
        if x['role'] == 'tool':
            msgs.append({'role': 'tool', 'tool_call_id': x['tool_call_id'], 'content': x['content']})
        elif x['role'] == 'assistant' and x.get('tool_calls'):
            msgs.append({'role': 'assistant', 'content': x.get('content') or '', 'tool_calls': [{'id': t['id'], 'type': 'function', 'function': {'name': t['name'], 'arguments': json.dumps(t['input'])}} for t in x['tool_calls']]})
        else:
            msgs.append({'role': x['role'], 'content': x['content']})
    body = {'model': m, 'messages': msgs, 'max_tokens': max_tokens}
    if tools:
        body['tools'] = [{'type': 'function', 'function': {'name': t['name'], 'description': t['description'], 'parameters': t['schema']}} for t in tools]
    key = os.environ.get('API_KEY', 'ollama')
    j = _post(base + '/chat/completions', body, {'authorization': 'Bearer ' + key})
    ch = j['choices'][0]['message']
    r = Reply(text=ch.get('content') or '')
    for t in ch.get('tool_calls') or []:
        r.tool_calls.append({'id': t['id'], 'name': t['function']['name'], 'input': json.loads(t['function']['arguments'] or '{}')})
    u = j.get('usage', {})
    r.usage = {'input': u.get('prompt_tokens', 0), 'output': u.get('completion_tokens', 0), 'cache_read': 0}
    return r

def count_tokens_rough(text):
    """About 4 characters per token: good enough to compare prompt versions offline."""
    return max(1, len(text) // 4)
