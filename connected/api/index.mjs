import { createProxy } from '../backend/proxy.mjs';

const origins = [process.env.TEDDY_SITE_ORIGIN, process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`, process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`].filter(Boolean);
const handler = createProxy({ gateway: process.env.TEDDY_GATEWAY_SECRET, backendUrl: process.env.TEDDY_BACKEND_URL, origins, environment: process.env.VERCEL_ENV === 'production' ? 'production' : 'preview' });
export default { fetch: handler };
