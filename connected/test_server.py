"""Security and persistence integration checks; isolated data, never real responses."""
import datetime as dt
import http.cookiejar
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.request


class ServerChecks(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            self.port = sock.getsockname()[1]
        self.origin = f'http://127.0.0.1:{self.port}'
        self.env = dict(os.environ, TEDDY_STATE_DIR=self.temp.name, TEDDY_OWNER_EMAIL='owner@example.test')
        # Public source checks use a small private-view fixture, never the real design.
        template_dir = Path(self.temp.name) / 'templates'
        template_dir.mkdir()
        (template_dir / 'celebration.html').write_text("She said <script>const csrf='__CSRF__';</script>", encoding='utf-8')
        self.env['TEDDY_PRIVATE_TEMPLATES'] = str(template_dir)
        self.visitor = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        self.owner = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        self.start()

    def start(self):
        self.process = subprocess.Popen([sys.executable, str(Path(__file__).with_name('server.py')), '--port', str(self.port)], env=self.env, stdout=subprocess.DEVNULL)
        for _ in range(100):
            try:
                urllib.request.urlopen(self.origin + '/api/health', timeout=.1)
                return
            except OSError:
                time.sleep(.05)
        self.fail('Server did not start')

    def tearDown(self):
        self.process.terminate()
        self.process.wait(timeout=10)
        self.temp.cleanup()

    def call(self, opener, path, payload=None, headers=None):
        h = {'Origin': self.origin, **(headers or {})}
        if payload is not None:
            h['Content-Type'] = 'application/json'
        req = urllib.request.Request(self.origin + path, data=json.dumps(payload).encode() if payload is not None else None, headers=h)
        try:
            result = opener.open(req)
        except urllib.error.HTTPError as result:
            return result.code, result.read().decode(), result.headers
        return result.status, result.read().decode(), result.headers

    def test_private_access_and_confirmation_persistence(self):
        for path in ['/api/owner/plans', '/private/celebration.html', '/server.py', '/owner-access.txt', '/%2e%2e/private/celebration.html']:
            code, text, _ = self.call(self.visitor, path)
            self.assertIn(code, (401, 404), path)
            self.assertNotIn('She said', text)
        code, login, _ = self.call(self.visitor, '/owner')
        self.assertEqual(code, 200)
        self.assertIn('Private password', login)
        self.assertNotIn('She said', login)
        credentials = (Path(self.temp.name) / 'owner-access.txt').read_text(encoding='utf-8')
        password = credentials.split('Password: ')[1].splitlines()[0]
        data = {'email': 'someone@example.com', 'password': password}
        self.assertEqual(self.call(self.owner, '/api/owner/login', data)[0], 401)
        data['email'] = 'owner@example.test'
        self.assertEqual(self.call(self.owner, '/api/owner/login', data, {'Origin': 'https://other.example'})[0], 403)
        code, _, headers = self.call(self.owner, '/api/owner/login', data)
        self.assertEqual(code, 200)
        self.assertIn('HttpOnly', headers['Set-Cookie'])
        self.assertIn('SameSite=Strict', headers['Set-Cookie'])
        self.assertEqual(json.loads(self.call(self.owner, '/api/owner/plans')[1])['plans'], [])
        session = json.loads(self.call(self.visitor, '/api/session')[1])
        csrf = {'X-CSRF-Token': session['csrf']}
        plan = {'accepted': True, 'activity': 'Coffee', 'day': (dt.date.today() + dt.timedelta(days=2)).isoformat()}
        self.assertEqual(self.call(self.visitor, '/api/accept', plan)[0], 403)
        self.assertEqual(self.call(self.visitor, '/api/accept', {**plan, 'accepted': False}, csrf)[0], 400)
        self.assertEqual(self.call(self.visitor, '/api/accept', {**plan, 'day': '2000-01-01'}, csrf)[0], 400)
        self.assertEqual(self.call(self.visitor, '/api/accept', {**plan, 'day': plan['day'].replace('-', '')}, csrf)[0], 400)
        self.assertEqual(self.call(self.visitor, '/api/accept', {**plan, 'day': '2026-W46-4'}, csrf)[0], 400)
        self.assertEqual(self.call(self.visitor, '/api/accept', {**plan, 'activity': '<script>'}, csrf)[0], 400)
        self.assertEqual(self.call(self.visitor, '/api/accept', plan, csrf)[0], 200)
        self.assertEqual(self.call(self.visitor, '/api/accept', plan, csrf)[0], 200)
        self.assertEqual(self.call(self.visitor, '/api/owner/plans')[0], 401)
        self.process.terminate()
        self.process.wait(timeout=10)
        self.start()
        plans = json.loads(self.call(self.owner, '/api/owner/plans')[1])['plans']
        self.assertEqual(len(plans), 1)
        self.assertEqual(plans[0]['day'], plan['day'])
        _, view, _ = self.call(self.owner, '/owner')
        self.assertIn('She said', view)
        owner_csrf = view.split("const csrf='")[1].split("'")[0]
        (Path(self.env['TEDDY_PRIVATE_TEMPLATES']) / 'celebration.html').unlink()
        self.assertEqual(self.call(self.owner, '/owner')[0], 503)
        self.assertEqual(self.call(self.owner, '/api/owner/logout', {}, {'X-CSRF-Token': owner_csrf})[0], 200)
        self.assertEqual(self.call(self.owner, '/api/owner/plans')[0], 401)


if __name__ == '__main__':
    unittest.main()
