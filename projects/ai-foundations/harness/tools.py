"""Tools are plain functions with a name, a description and a JSON schema."""
import ast, json, operator, os, subprocess, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
REGISTRY = {}

def tool(name, description, schema):
    def deco(fn):
        REGISTRY[name] = {'name': name, 'description': description, 'schema': schema, 'fn': fn}
        return fn
    return deco

def specs(names):
    return [{k: REGISTRY[n][k] for k in ('name', 'description', 'schema')} for n in names]

def run(call):
    t = REGISTRY.get(call['name'])
    if not t:
        return f'ERROR: unknown tool {call["name"]}'
    try:
        out = t['fn'](**call['input'])
        return out if isinstance(out, str) else json.dumps(out, default=str)
    except Exception as e:
        return f'ERROR: {type(e).__name__}: {e}'

_OPS = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv, ast.USub: operator.neg, ast.Pow: operator.pow}
def _eval(n):
    if isinstance(n, ast.Constant) and isinstance(n.value, (int, float)): return n.value
    if isinstance(n, ast.BinOp): return _OPS[type(n.op)](_eval(n.left), _eval(n.right))
    if isinstance(n, ast.UnaryOp): return _OPS[type(n.op)](_eval(n.operand))
    raise ValueError('only + - * / ** and numbers are allowed')

@tool('calculator', 'Evaluate an arithmetic expression such as "12*7+3". Use it for any maths.', {'type': 'object', 'properties': {'expression': {'type': 'string'}}, 'required': ['expression']})
def calculator(expression):
    v = _eval(ast.parse(expression, mode='eval').body)
    return str(round(v, 6))

def _safe(path, write=False):
    p = os.path.abspath(os.path.join(ROOT, path))
    if not p.startswith(ROOT):
        raise PermissionError('path outside the project')
    if write and (os.sep + 'tests' + os.sep) in p:
        raise PermissionError('tests are read-only for agents')
    return p

@tool('read_file', 'Read a text file from the project (relative path). Returns at most 8,000 characters.', {'type': 'object', 'properties': {'path': {'type': 'string'}}, 'required': ['path']})
def read_file(path):
    return open(_safe(path)).read()[:8000]

@tool('write_file', 'Overwrite a project file with new content. Files under tests/ are read-only.', {'type': 'object', 'properties': {'path': {'type': 'string'}, 'content': {'type': 'string'}}, 'required': ['path', 'content']})
def write_file(path, content):
    p = _safe(path, write=True)
    open(p, 'w').write(content)
    return f'wrote {len(content)} characters to {path}'

@tool('run_tests', 'Run pytest on a path and return the last 3,000 characters of output.', {'type': 'object', 'properties': {'path': {'type': 'string'}}, 'required': ['path']})
def run_tests(path='tasks/tests'):
    r = subprocess.run([sys.executable, '-m', 'pytest', '-q', '-x', _safe(path)], capture_output=True, text=True, cwd=ROOT, timeout=120)
    return (r.stdout + r.stderr)[-3000:]
