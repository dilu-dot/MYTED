export class PostgrestStore {
  constructor(url, key, fetcher = fetch) { this.url = url.replace(/\/$/, ''); this.key = key; this.fetcher = fetcher; }
  async request(path, method = 'GET', body, prefer) {
    const headers = { apikey: this.key, 'Content-Type': 'application/json' };
    if (this.key.startsWith('eyJ')) headers.Authorization = `Bearer ${this.key}`;
    if (prefer) headers.Prefer = prefer;
    const result = await this.fetcher(this.url + '/rest/v1/' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000) });
    if (!result.ok) throw new Error('Database request failed');
    const text = await result.text();
    return text ? JSON.parse(text) : null;
  }
  query(table, parameters) { return table + '?' + new URLSearchParams(parameters); }
  async settings() {
    const rows = await this.request('teddy_settings?id=eq.owner&select=value&limit=1');
    if (!rows?.[0]?.value) throw new Error('Application not configured');
    return rows[0].value;
  }
  async health() { await this.request('teddy_plans?select=day&limit=0'); }
  async session(environment, token_hash, kind, now) {
    const rows = await this.request(this.query('teddy_sessions', { environment: 'eq.' + environment, token_hash: 'eq.' + token_hash, kind: 'eq.' + kind, expires_at: 'gt.' + now, select: 'token_hash', limit: 1 }));
    return rows[0] || null;
  }
  async createSession(environment, token_hash, kind, expires_at) {
    await this.request(this.query('teddy_sessions', { environment: 'eq.' + environment, expires_at: 'lte.' + new Date().toISOString() }), 'DELETE');
    await this.request('teddy_sessions', 'POST', { environment, token_hash, kind, expires_at }, 'return=minimal');
  }
  async deleteSession(environment, token_hash) {
    await this.request(this.query('teddy_sessions', { environment: 'eq.' + environment, token_hash: 'eq.' + token_hash }), 'DELETE');
  }
  async plans(environment) {
    return this.request(this.query('teddy_plans', { environment: 'eq.' + environment, select: 'activity,day,accepted_at', order: 'accepted_at.desc', limit: 50 }));
  }
  async savePlan(environment, visitor_hash, activity, day, accepted_at) {
    await this.request('teddy_plans?on_conflict=environment,visitor_hash', 'POST', { environment, visitor_hash, activity, day, accepted_at }, 'resolution=merge-duplicates,return=minimal');
  }
  async takeLimit(environment, key, maximum, seconds) {
    return this.request('rpc/teddy_take_limit', 'POST', { p_environment: environment, p_key: key, p_max: maximum, p_seconds: seconds });
  }
}
