const routes = new Set(['health', 'session', 'accept', 'owner', 'owner/login', 'owner/logout', 'owner/plans']);
export function createProxy({ gateway, backendUrl, origins, environment, fetcher = fetch }) {
  return async request => {
    try {
      const url = new URL(request.url);
      if (!origins.includes(url.origin)) return Response.json({ error: 'Request not allowed.' }, { status: 403 });
      const route = url.searchParams.get('route') || (url.pathname.replace(/^\/api\//, '').replace(/^\//, '').replace(/\/$/, ''));
      if (!routes.has(route) || !['GET', 'POST'].includes(request.method)) return Response.json({ error: 'Not found.' }, { status: 404 });
      if (request.method === 'POST' && request.headers.get('origin') !== url.origin) return Response.json({ error: 'Request not allowed.' }, { status: 403 });
      if (Number(request.headers.get('content-length') || 0) > 4096) return Response.json({ error: 'Invalid request.' }, { status: 413 });
      const body = request.method === 'POST' ? await request.text() : undefined;
      if (body && new TextEncoder().encode(body).length > 4096) return Response.json({ error: 'Invalid request.' }, { status: 413 });
      const headers = new Headers();
      for (const name of ['origin', 'content-type', 'x-csrf-token']) {
        const value = request.headers.get(name);
        if (value) headers.set(name, value);
      }
      const appCookies = request.headers.get('cookie')?.split(';').map(part => part.trim()).filter(part => /^(?:__Host-)?teddy_(?:owner|visitor)=/.test(part)).join('; ');
      if (appCookies) headers.set('cookie', appCookies);
      // Incoming gateway/scope/IP headers are always replaced, never trusted.
      headers.set('x-teddy-gateway', gateway);
      headers.set('x-teddy-route', route);
      headers.set('x-teddy-site-origin', url.origin);
      headers.set('x-teddy-environment', environment);
      headers.set('x-teddy-client-ip', request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown');
      const upstream = await fetcher(backendUrl, { method: request.method, headers, body, redirect: 'error', signal: AbortSignal.timeout(20000) });
      const responseHeaders = new Headers();
      for (const name of ['content-type', 'cache-control', 'x-content-type-options', 'x-frame-options', 'referrer-policy', 'x-robots-tag', 'content-security-policy']) {
        const value = upstream.headers.get(name);
        if (value) responseHeaders.set(name, value);
      }
      for (const value of upstream.headers.getSetCookie()) {
        if (/^(?:__Host-)?teddy_(?:owner|visitor)=/.test(value)) responseHeaders.append('Set-Cookie', value);
      }
      let responseBody = upstream.body;
      // Edge Functions return JSON view data. This first-party gateway alone
      // renders it after the backend has checked the owner session.
      if (route === 'owner' && upstream.status === 200) {
        const data = await upstream.json();
        if (typeof data.view !== 'string') throw new Error('Invalid view response');
        responseBody = data.view;
        responseHeaders.set('Content-Type', 'text/html; charset=utf-8');
        responseHeaders.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
      }
      responseHeaders.set('Cache-Control', 'private, no-store');
      return new Response(responseBody, { status: upstream.status, headers: responseHeaders });
    } catch (error) {
      console.error('teddy_gateway_failure', { kind: error?.name || 'Error' });
      return Response.json({ error: 'Could not connect right now. Please try again.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
  };
}
