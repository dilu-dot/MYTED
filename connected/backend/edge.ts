import { createHandler } from './core.mjs';
import { PostgrestStore } from './store.mjs';

// Supabase injects these server-only keys; no key is bundled into the frontend.
const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
const key = keys.default || Object.values(keys)[0] || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!key) throw new Error('Database access is not configured');
const store = new PostgrestStore(Deno.env.get('SUPABASE_URL')!, key);
Deno.serve(createHandler(store));
