const encoder = new TextEncoder();
const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
const bytes = value => new Uint8Array(value.match(/../g).map(v => parseInt(v, 16)));
export async function sha(value) { return hex(await crypto.subtle.digest('SHA-256', encoder.encode(value))); }
export async function hmac(key, value) {
  const imported = await crypto.subtle.importKey('raw', encoder.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', imported, encoder.encode(value)));
}
export async function passwordHash(password, salt, iterations = 600000) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: bytes(salt), iterations }, key, 256));
}
export function equal(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
function randomToken() { return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', ''); }
function cookieValue(request, name) {
  const value = request.headers.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith(name + '='))?.slice(name.length + 1);
  return value && /^[A-Za-z0-9_-]{40,80}$/.test(value) ? value : null;
}
function headers(type) {
  return { 'Content-Type': type, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin', 'X-Robots-Tag': 'noindex, nofollow', 'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" };
}
export function createHandler(store, { clock = () => Date.now() } = {}) {
  return async request => {
    let route = '';
    try {
      const settings = await store.settings();
      const scope = request.headers.get('x-teddy-environment');
      if (!equal(request.headers.get('x-teddy-gateway'), settings.gateways?.[scope])) return Response.json({ error: 'Request not allowed.' }, { status: 401, headers: headers('application/json') });
      const site = request.headers.get('x-teddy-site-origin');
      if (!['production', 'preview', 'test'].includes(scope) || !site) return Response.json({ error: 'Request not allowed.' }, { status: 403, headers: headers('application/json') });
      let origin;
      try { origin = new URL(site); } catch { return new Response(null, { status: 403 }); }
      if (origin.origin !== site || (origin.protocol !== 'https:' && !(scope === 'test' && origin.hostname === '127.0.0.1'))) return new Response(null, { status: 403 });
      const secure = origin.protocol === 'https:';
      const prefix = secure ? '__Host-' : '';
      const name = kind => `${prefix}teddy_${kind}`;
      const cookie = (kind, token, age = 43200) => `${name(kind)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? '; Secure' : ''}`;
      const hashToken = token => hmac(settings.sessionSecret + ':' + scope, token);
      const csrfFor = token => hmac(settings.sessionSecret + ':csrf:' + scope, token);
      const json = (status, data, setCookie) => {
        const h = headers('application/json; charset=utf-8');
        if (setCookie) h['Set-Cookie'] = setCookie;
        return new Response(JSON.stringify(data), { status, headers: h });
      };
      // Edge Functions transport view data as JSON; Vercel renders the HTML.
      const html = text => json(200, { view: text });
      const session = async kind => {
        const token = cookieValue(request, name(kind));
        if (!token) return null;
        const row = await store.session(scope, await hashToken(token), kind, new Date(clock()).toISOString());
        return row ? token : null;
      };
      const newSession = async kind => {
        const token = randomToken();
        await store.createSession(scope, await hashToken(token), kind, new Date(clock() + 43200000).toISOString());
        return token;
      };
      const limited = async (action, maximum, seconds, global = false) => {
        const identity = global ? 'all' : request.headers.get('x-teddy-client-ip') || 'unknown';
        const key = await hmac(settings.sessionSecret, action + ':' + identity);
        return !(await store.takeLimit(scope, key, maximum, seconds));
      };
      route = request.headers.get('x-teddy-route') || '';
      const method = request.method;
      if (method === 'GET') {
        if (route === 'health') { await store.health(); return json(200, { ok: true }); }
        if (route === 'session') {
          if (await limited('visitors', 600, 60, true) || await limited('visitor', 60, 60)) return json(429, { error: 'Please try again shortly.' });
          const token = await session('visitor') || await newSession('visitor');
          return json(200, { csrf: await csrfFor(token) }, cookie('visitor', token));
        }
        if (route === 'owner') {
          const token = await session('owner');
          if (!token) return html(settings.loginTemplate);
          if (!settings.celebrationTemplate) return json(503, { error: 'Private view unavailable.' });
          return html(settings.celebrationTemplate.replace('__CSRF__', await csrfFor(token)));
        }
        if (route === 'owner/plans') {
          if (!await session('owner')) return json(401, { error: 'Sign in required.' });
          return json(200, { plans: await store.plans(scope) });
        }
        return json(404, { error: 'Not found.' });
      }
      if (method !== 'POST') return json(405, { error: 'Method not allowed.' });
      if (request.headers.get('origin') !== site) return json(403, { error: 'Request not allowed.' });
      if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return json(400, { error: 'Invalid request.' });
      if (Number(request.headers.get('content-length') || 0) > 4096) return json(413, { error: 'Invalid request.' });
      const raw = await request.text();
      if (encoder.encode(raw).byteLength > 4096) return json(413, { error: 'Invalid request.' });
      let data;
      try { data = JSON.parse(raw); } catch { return json(400, { error: 'Invalid request.' }); }
      if (!data || typeof data !== 'object' || Array.isArray(data)) return json(400, { error: 'Invalid request.' });
      if (route === 'owner/login') {
        if (await limited('login-global', 40, 900, true) || await limited('login', 8, 900)) return json(429, { error: 'Too many attempts. Try again in 15 minutes.' });
        if (typeof data.email !== 'string' || typeof data.password !== 'string' || data.password.length > 512) return json(401, { error: 'Email or password is incorrect.' });
        const candidate = await passwordHash(data.password, settings.passwordSalt, settings.passwordIterations);
        if (data.email.trim().toLowerCase() !== settings.ownerEmail || !equal(candidate, settings.passwordHash)) return json(401, { error: 'Email or password is incorrect.' });
        const old = await session('owner');
        if (old) await store.deleteSession(scope, await hashToken(old));
        const token = await newSession('owner');
        return json(200, { ok: true }, cookie('owner', token));
      }
      if (route === 'owner/logout') {
        const token = await session('owner');
        if (!token || !equal(request.headers.get('x-csrf-token'), await csrfFor(token))) return json(403, { error: 'Request not allowed.' });
        await store.deleteSession(scope, await hashToken(token));
        return json(200, { ok: true }, cookie('owner', '', 0));
      }
      if (route === 'accept') {
        const token = await session('visitor');
        if (!token || !equal(request.headers.get('x-csrf-token'), await csrfFor(token))) return json(403, { error: 'Refresh the page and try again.' });
        if (await limited('accept', 12, 3600)) return json(429, { error: 'Please try again later.' });
        const day = data.day;
        const parsed = typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) ? Date.parse(day + 'T00:00:00Z') : NaN;
        const today = new Date(clock() + 19800000).toISOString().slice(0, 10);
        const last = new Date(Date.parse(today) + 397 * 86400000).toISOString().slice(0, 10);
        if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== day || day < today || day > last || !['Coffee', 'Ice cream', 'A walk'].includes(data.activity) || data.accepted !== true) return json(400, { error: 'Choose an activity and an upcoming day.' });
        await store.savePlan(scope, await hashToken(token), data.activity, day, new Date(clock()).toISOString());
        return json(200, { ok: true });
      }
      return json(404, { error: 'Not found.' });
    } catch (error) {
      // Operational signal only: never log request bodies, cookies, credentials or dates.
      console.error('teddy_api_failure', { route, kind: error?.name || 'Error' });
      return Response.json({ error: 'Could not connect right now. Please try again.' }, { status: 503, headers: headers('application/json') });
    }
  };
}
