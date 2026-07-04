// One-off: copy data/db.json (local mode) into Supabase.
// Usage: node scripts/migrate-local-to-supabase.mjs
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

process.loadEnvFile('.env.local');
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing from .env.local');
  process.exit(1);
}
if (!fs.existsSync('data/db.json')) {
  console.error('No local data/db.json to migrate.');
  process.exit(1);
}

const db = JSON.parse(fs.readFileSync('data/db.json', 'utf8'));
const supa = createClient(url, key, { auth: { persistSession: false } });

const rows = (db.prospects || []).map((p) => ({ id: p.id, data: p }));
if (rows.length) {
  const { error } = await supa.from('qt_prospects').upsert(rows);
  if (error) throw new Error(error.message);
}
const { error: e2 } = await supa.from('qt_state').upsert([
  { key: 'settings', value: db.settings || {} },
  { key: 'meta', value: db.meta || {} },
]);
if (e2) throw new Error(e2.message);

const { count } = await supa.from('qt_prospects').select('id', { count: 'exact', head: true });
console.log(`Migrated ${rows.length} prospects (table now holds ${count}). Settings + meta migrated.`);
