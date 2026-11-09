"""TEDDY local server. Public files are confined to web/; owner views require auth."""
import argparse
from contextlib import contextmanager
import datetime as dt
import hashlib
import hmac
from http import cookies
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import secrets
import sqlite3
import threading
import time
from urllib.parse import urlsplit, unquote
import mimetypes

ROOT = Path(__file__).resolve().parent
WEB = ROOT / 'web'
OWNER = os.environ.get('TEDDY_OWNER_EMAIL', '').strip().lower()
STATE = Path(os.environ.get('TEDDY_STATE_DIR', str(Path.home() / '.teddy-private'))).resolve()
PRIVATE_TEMPLATES = Path(os.environ.get('TEDDY_PRIVATE_TEMPLATES', str(ROOT / 'private'))).resolve()
LOCK = threading.Lock()
ATTEMPTS = {}
MAX_BODY = 4096


@contextmanager
def connect():
    db = sqlite3.connect(STATE / 'teddy.sqlite3', timeout=10)
    db.row_factory = sqlite3.Row
    try:
        with db:
            yield db
    finally:
        db.close()


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def initialize():
    global OWNER
    STATE.mkdir(parents=True, exist_ok=True)
    with connect() as db:
        db.executescript('''
        CREATE TABLE IF NOT EXISTS owner (email TEXT PRIMARY KEY, salt TEXT NOT NULL, password TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, kind TEXT NOT NULL, expires INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS plans (id INTEGER PRIMARY KEY, visitor TEXT UNIQUE NOT NULL, activity TEXT NOT NULL, day TEXT NOT NULL, accepted_at TEXT NOT NULL);
        ''')
        existing_owner = db.execute('SELECT email FROM owner LIMIT 1').fetchone()
        if existing_owner:
            OWNER = existing_owner['email']
        else:
            if not OWNER or '@' not in OWNER or len(OWNER) > 254:
                raise RuntimeError('Set TEDDY_OWNER_EMAIL to your owner email before the first start.')
            password, salt = secrets.token_urlsafe(24), secrets.token_hex(16)
            hashed = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
            db.execute('INSERT INTO owner VALUES (?,?,?)', (OWNER, salt, hashed))
            (STATE / 'owner-access.txt').write_text(
                f'TEDDY — private owner access\n\nURL: http://127.0.0.1:5191/owner\nEmail: {OWNER}\nPassword: {password}\n\nKeep this file private. It is outside the website and source ZIP.\n', encoding='utf-8')
    try:
        os.chmod(STATE, 0o700)
        os.chmod(STATE / 'owner-access.txt', 0o600)
    except OSError:
        pass


class Handler(BaseHTTPRequestHandler):
    server_version = 'Teddy'

    def log_message(self, fmt, *args):
        # No URLs, credentials, request bodies, or acceptance details in logs.
        pass

    def reply(self, status, body, content_type='application/json; charset=utf-8', cookie=None):
        data = body if isinstance(body, bytes) else body.encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Referrer-Policy', 'same-origin')
        self.send_header('X-Robots-Tag', 'noindex, nofollow')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
        if cookie:
            self.send_header('Set-Cookie', cookie)
        self.end_headers()
        self.wfile.write(data)

    def json(self, status, data, **kwargs):
        self.reply(status, json.dumps(data), **kwargs)

    def secure_cookie(self, name, token, age):
        # Remote use requires TLS and explicit configuration. Never trust forwarded headers.
        secure = '; Secure' if self.server.secure else ''
        return f'{name}={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={age}{secure}'

    def session(self, kind):
        try:
            jar = cookies.SimpleCookie(self.headers.get('Cookie', ''))
            token = jar['teddy_' + kind].value
        except (KeyError, cookies.CookieError):
            return None
        with connect() as db:
            row = db.execute('SELECT token FROM sessions WHERE token=? AND kind=? AND expires>?', (digest(token), kind, int(time.time()))).fetchone()
        return token if row else None

    def new_session(self, kind):
        token = secrets.token_urlsafe(32)
        with connect() as db:
            db.execute('DELETE FROM sessions WHERE expires<=?', (int(time.time()),))
            db.execute('INSERT INTO sessions VALUES (?,?,?)', (digest(token), kind, int(time.time()) + 43200))
        return token

    def same_origin(self):
        origin = self.headers.get('Origin')
        return origin == self.server.origin

    def limited(self, scope, maximum, seconds):
        key = (scope, self.client_address[0])
        now = time.time()
        with LOCK:
            if len(ATTEMPTS) > 5000:
                for old in list(ATTEMPTS):
                    if not ATTEMPTS[old] or ATTEMPTS[old][-1] < now - 3600:
                        ATTEMPTS.pop(old, None)
            times = [t for t in ATTEMPTS.get(key, []) if t > now - seconds]
            allowed = len(times) < maximum
            if allowed:
                times.append(now)
            ATTEMPTS[key] = times
        return not allowed

    def do_GET(self):
        path = unquote(urlsplit(self.path).path)
        if self.headers.get('Host') != urlsplit(self.server.origin).netloc:
            return self.json(400, {'error': 'Invalid host'})
        if path == '/api/health':
            return self.json(200, {'ok': True})
        if path == '/api/session':
            if self.limited('visitor', 120, 60):
                return self.json(429, {'error': 'Please try again shortly.'})
            token = self.session('visitor') or self.new_session('visitor')
            return self.json(200, {'csrf': digest('csrf:' + token)}, cookie=self.secure_cookie('teddy_visitor', token, 43200))
        if path in ('/owner', '/owner/'):
            if not self.session('owner'):
                return self.reply(200, (ROOT / 'templates/login.html').read_bytes(), 'text/html; charset=utf-8')
            token = self.session('owner')
            template = PRIVATE_TEMPLATES / 'celebration.html'
            if not template.is_file():
                return self.json(503, {'error': 'Private view unavailable.'})
            view = template.read_text(encoding='utf-8')
            return self.reply(200, view.replace('__CSRF__', digest('csrf:' + token)), 'text/html; charset=utf-8')
        if path == '/api/owner/plans':
            if not self.session('owner'):
                return self.json(401, {'error': 'Sign in required'})
            with connect() as db:
                rows = db.execute('SELECT activity,day,accepted_at FROM plans ORDER BY accepted_at DESC LIMIT 50').fetchall()
            return self.json(200, {'plans': [dict(r) for r in rows]})
        if path.startswith('/api/'):
            return self.json(404, {'error': 'Not found'})
        relative = path.lstrip('/') or 'index.html'
        if path.endswith('/'):
            relative += 'index.html' if relative != 'index.html' else ''
        target = (WEB / relative).resolve()
        if not target.is_relative_to(WEB.resolve()) or any(p.startswith('.') for p in Path(relative).parts):
            return self.json(404, {'error': 'Not found'})
        if not target.is_file():
            return self.json(404, {'error': 'Not found'})
        return self.reply(200, target.read_bytes(), mimetypes.guess_type(str(target))[0] or 'application/octet-stream')

    def do_POST(self):
        if self.headers.get('Host') != urlsplit(self.server.origin).netloc or not self.same_origin():
            return self.json(403, {'error': 'Request not allowed'})
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if size < 1 or size > MAX_BODY or self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
                return self.json(400, {'error': 'Invalid request'})
            data = json.loads(self.rfile.read(size))
            if not isinstance(data, dict):
                raise ValueError()
        except (ValueError, UnicodeError):
            return self.json(400, {'error': 'Invalid request'})
        path = urlsplit(self.path).path
        if path == '/api/owner/login':
            if self.limited('login', 8, 900):
                return self.json(429, {'error': 'Too many attempts. Try again in 15 minutes.'})
            email, password = str(data.get('email', '')).strip().lower(), str(data.get('password', ''))
            with connect() as db:
                row = db.execute('SELECT * FROM owner WHERE email=?', (OWNER,)).fetchone()
            supplied = hashlib.scrypt(password.encode(), salt=bytes.fromhex(row['salt']), n=16384, r=8, p=1).hex()
            if email != OWNER or not hmac.compare_digest(supplied, row['password']):
                return self.json(401, {'error': 'Email or password is incorrect.'})
            old = self.session('owner')
            if old:
                with connect() as db:
                    db.execute('DELETE FROM sessions WHERE token=?', (digest(old),))
            token = self.new_session('owner')
            return self.json(200, {'ok': True}, cookie=self.secure_cookie('teddy_owner', token, 43200))
        if path == '/api/owner/logout':
            token = self.session('owner')
            if not token or not hmac.compare_digest(self.headers.get('X-CSRF-Token', ''), digest('csrf:' + token)):
                return self.json(403, {'error': 'Request not allowed'})
            with connect() as db:
                db.execute('DELETE FROM sessions WHERE token=?', (digest(token),))
            return self.json(200, {'ok': True}, cookie=self.secure_cookie('teddy_owner', '', 0))
        if path == '/api/accept':
            token = self.session('visitor')
            if not token or not hmac.compare_digest(self.headers.get('X-CSRF-Token', ''), digest('csrf:' + token)):
                return self.json(403, {'error': 'Refresh the page and try again.'})
            if self.limited('accept', 12, 3600):
                return self.json(429, {'error': 'Please try again later.'})
            activity, day = data.get('activity'), data.get('day')
            try:
                date = dt.date.fromisoformat(day)
                today = dt.datetime.now(dt.timezone(dt.timedelta(hours=5, minutes=30))).date()
                if date.isoformat() != day or activity not in ('Coffee', 'Ice cream', 'A walk') or not today <= date <= today + dt.timedelta(days=397) or data.get('accepted') is not True:
                    raise ValueError()
            except (ValueError, TypeError):
                return self.json(400, {'error': 'Choose an activity and an upcoming day.'})
            with connect() as db:
                # Retrying the same confirmation never creates duplicate celebrations.
                db.execute('''INSERT INTO plans(visitor,activity,day,accepted_at) VALUES (?,?,?,?)
                  ON CONFLICT(visitor) DO UPDATE SET activity=excluded.activity,day=excluded.day,accepted_at=excluded.accepted_at''',
                  (digest(token), activity, day, dt.datetime.now(dt.timezone.utc).isoformat()))
            return self.json(200, {'ok': True})
        return self.json(404, {'error': 'Not found'})


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=5191)
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--origin', help='Exact HTTPS origin when running behind your own trusted TLS proxy')
    args = parser.parse_args()
    if args.host not in ('127.0.0.1', 'localhost') and not (args.origin and args.origin.startswith('https://')):
        parser.error('Remote hosting requires --origin https://your-domain and a TLS reverse proxy.')
    initialize()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    server.origin = args.origin or f'http://127.0.0.1:{args.port}'
    server.secure = server.origin.startswith('https://')
    print(f'TEDDY ready: {server.origin} | Private credentials: {STATE / "owner-access.txt"}', flush=True)
    server.serve_forever()
