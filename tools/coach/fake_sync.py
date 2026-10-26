"""A local stand-in for sync/Code.gs, for testing the app, the nightly coach and the grader without Google.
Usage: python3 tools/coach/fake_sync.py [port] [key] [dir]   (defaults 8812, testkey, /tmp/da-sync)
GET ?k=KEY returns {ok, data, coach}; POST {action: save|saveCoach} stores them, like the real script."""
import json, os, sys, time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8812
KEY = sys.argv[2] if len(sys.argv) > 2 else 'testkey'
DIR = sys.argv[3] if len(sys.argv) > 3 else '/tmp/da-sync'
os.makedirs(DIR, exist_ok=True)


def path(name):
    return os.path.join(DIR, name)


def read(name):
    try:
        return json.load(open(path(name)))
    except (OSError, ValueError):
        return {}


class H(BaseHTTPRequestHandler):
    def _send(self, obj):
        b = json.dumps(obj).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def _ok(self):
        return parse_qs(urlparse(self.path).query).get('k', [''])[0] == KEY

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        if not self._ok():
            return self._send({'ok': False, 'error': 'wrong or missing key'})
        q = parse_qs(urlparse(self.path).query)
        a = q.get('action', ['load'])[0]
        jobs = read('jobs.json') or []
        if a == 'jobs':
            return self._send({'ok': True, 'jobs': [j for j in jobs if j['status'] == 'pending']})
        if a == 'results':
            ids = [i for i in q.get('ids', [''])[0].split(',') if i]
            return self._send({'ok': True, 'results': {j['id']: {'status': j['status'], 'result': j.get('result'), 'at': j['at'], 'doneAt': j.get('doneAt')} for j in jobs if j['id'] in ids}})
        self._send({'ok': True, 'data': read('progress.json'), 'coach': read('coach.json')})

    def do_POST(self):
        if not self._ok():
            return self._send({'ok': False, 'error': 'wrong or missing key'})
        body = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))) or b'{}')
        if body.get('action') == 'save' and body.get('data'):
            json.dump(body['data'], open(path('progress.json'), 'w'))
        elif body.get('action') == 'saveCoach' and body.get('coach'):
            json.dump(body['coach'], open(path('coach.json'), 'w'))
        elif body.get('action') == 'ask' and (body.get('job') or {}).get('id'):
            jobs = read('jobs.json') or []
            if not any(j['id'] == body['job']['id'] for j in jobs):
                jobs.append({'id': body['job']['id'], 'kind': body['job'].get('kind', ''), 'payload': body['job'].get('payload', {}), 'status': 'pending', 'at': int(time.time() * 1000)})
            json.dump(jobs, open(path('jobs.json'), 'w'))
        elif body.get('action') == 'answer' and body.get('id'):
            jobs = read('jobs.json') or []
            for j in jobs:
                if j['id'] == body['id']:
                    j.update(status='done', result=body.get('result'), doneAt=int(time.time() * 1000))
            json.dump(jobs, open(path('jobs.json'), 'w'))
        self._send({'ok': True})

    def log_message(self, *a):
        pass


HTTPServer(('127.0.0.1', PORT), H).serve_forever()
