import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, passwordHash } from './core.mjs';
import { createProxy } from './proxy.mjs';

class MemoryStore {
  constructor(settings) { this.config = settings; this.sessions = new Map(); this.saved = new Map(); this.limits = new Map(); }
  async settings() { return this.config; }
  async health() {}
  async session(env, token, kind, now) { const s = this.sessions.get(env + token); return s?.kind === kind && s.expires_at > now ? s : null; }
  async createSession(env, token, kind, expires_at) { this.sessions.set(env + token, { kind, expires_at }); }
  async deleteSession(env, token) { this.sessions.delete(env + token); }
  async savePlan(env, token, activity, day, accepted_at) { this.saved.set(env + token, { env, activity, day, accepted_at }); }
  async plans(env) { return [...this.saved.values()].filter(v => v.env === env); }
  async takeLimit(env, key, maximum) { const n = (this.limits.get(env + key) || 0) + 1; this.limits.set(env + key, n); return n <= maximum; }
}
const password = 'fixture-owner-password';
const salt = '0123456789abcdef0123456789abcdef';
const settings = { ownerEmail: 'owner@example.test', passwordSalt: salt, passwordIterations: 600000, passwordHash: await passwordHash(password, salt), gateways: { production: 'prod-gateway', preview: 'preview-gateway', test: 'test-gateway' }, sessionSecret: 'fixture-session-secret', loginTemplate: '<h1>Sign in</h1>', celebrationTemplate: "<h1>Private celebration</h1><script>const csrf='__CSRF__';</script>" };

test('hosted flow protects owner data, validates dates, persists sessions, and separates environments', async () => {
  const store = new MemoryStore(settings);
  const now = Date.parse('2026-11-09T12:00:00Z');
  let handler = createHandler(store, { clock: () => now });
  const call = (route, data, more = {}) => handler(new Request('https://edge.example/teddy-api', { method: data === undefined ? 'GET' : 'POST', headers: { 'x-teddy-gateway': 'prod-gateway', 'x-teddy-environment': 'production', 'x-teddy-route': route, 'x-teddy-site-origin': 'https://site.example', 'x-teddy-client-ip': 'fixture', ...(data === undefined ? {} : { 'Content-Type': 'application/json', Origin: 'https://site.example' }), ...more }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) }));
  assert.equal((await call('health', undefined, { 'x-teddy-gateway': 'wrong' })).status, 401);
  assert.equal((await call('owner/plans')).status, 401);
  assert.match(await (await call('owner')).text(), /Sign in/);
  assert.equal((await call('owner/login', { email: 'someone@example.test', password })).status, 401);
  assert.equal((await call('owner/login', { email: settings.ownerEmail, password }, { origin: 'https://other.example' })).status, 403);
  const login = await call('owner/login', { email: settings.ownerEmail, password });
  assert.equal(login.status, 200);
  const ownerCookie = login.headers.get('set-cookie').split(';')[0];
  assert.match(login.headers.get('set-cookie'), /HttpOnly.*SameSite=Strict.*Secure/);
  const session = await call('session');
  const visitorCookie = session.headers.get('set-cookie').split(';')[0];
  const csrf = (await session.json()).csrf;
  const plan = { accepted: true, activity: 'Coffee', day: '2026-11-12' };
  const visitorHeaders = { cookie: visitorCookie, 'x-csrf-token': csrf };
  assert.equal((await call('accept', plan, { cookie: visitorCookie })).status, 403);
  for (const day of ['20261112', '2026-W46-4', '2026-02-30', '2000-01-01']) assert.equal((await call('accept', { ...plan, day }, visitorHeaders)).status, 400, day);
  assert.equal((await call('accept', { ...plan, accepted: false }, visitorHeaders)).status, 400);
  assert.equal((await call('accept', plan, visitorHeaders)).status, 200);
  assert.equal((await call('accept', plan, visitorHeaders)).status, 200);
  assert.equal(store.saved.size, 1);
  assert.equal((await call('owner/plans', undefined, { cookie: visitorCookie })).status, 401);
  handler = createHandler(store, { clock: () => now });
  const saved = await (await call('owner/plans', undefined, { cookie: ownerCookie })).json();
  assert.equal(saved.plans[0].day, plan.day);
  assert.equal((await call('owner/plans', undefined, { cookie: ownerCookie, 'x-teddy-gateway': 'preview-gateway', 'x-teddy-environment': 'preview' })).status, 401);
  assert.equal((await call('owner/plans', undefined, { cookie: ownerCookie, 'x-teddy-gateway': 'preview-gateway' })).status, 401);
  const page = await (await call('owner', undefined, { cookie: ownerCookie })).text();
  assert.match(page, /Private celebration/);
  const ownerCsrf = page.split("const csrf='")[1].split("'")[0];
  assert.equal((await call('owner/logout', {}, { cookie: ownerCookie, 'x-csrf-token': ownerCsrf })).status, 200);
  assert.equal((await call('owner/plans', undefined, { cookie: ownerCookie })).status, 401);
});

test('proxy constrains origin, replaces private headers, and preserves secure cookies', async () => {
  let forwarded;
  const proxy = createProxy({ gateway: 'trusted', backendUrl: 'https://backend.example/function', origins: ['https://site.example'], environment: 'preview', fetcher: async (url, options) => { forwarded = options; const headers = new Headers({ 'Content-Type': 'text/plain' }); headers.append('Set-Cookie', '__Host-teddy_owner=fixture; Secure; HttpOnly; Path=/'); headers.append('Set-Cookie', '__cf_bm=provider-cookie; Domain=provider.example; Secure; Path=/'); return new Response('ok', { headers }); } });
  assert.equal((await proxy(new Request('https://other.example/api/health'))).status, 403);
  const result = await proxy(new Request('https://site.example/api/index?route=owner', { headers: { 'x-teddy-gateway': 'untrusted', 'x-teddy-environment': 'production', cookie: 'platform_session=never-forward; __Host-teddy_owner=fixture' } }));
  assert.equal(result.status, 200);
  assert.equal(forwarded.headers.get('x-teddy-gateway'), 'trusted');
  assert.equal(forwarded.headers.get('x-teddy-environment'), 'preview');
  assert.equal(forwarded.headers.get('cookie'), '__Host-teddy_owner=fixture');
  assert.match(result.headers.get('set-cookie'), /Secure; HttpOnly/);
  assert.equal(result.headers.getSetCookie().length, 1);
  assert.doesNotMatch(result.headers.get('set-cookie'), /provider-cookie/);
});
