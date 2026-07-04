// One-off: create Quiet Tracker tables in Supabase.
// Reads SUPABASE_DB_URL from .env.local. Usage: node scripts/setup-supabase.mjs
import pg from 'pg';

process.loadEnvFile('.env.local');
const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('SUPABASE_DB_URL missing from .env.local');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query(`
  create table if not exists qt_prospects (
    id text primary key,
    data jsonb not null,
    updated_at timestamptz not null default now()
  );
  create table if not exists qt_state (
    key text primary key,
    value jsonb not null,
    updated_at timestamptz not null default now()
  );
  alter table qt_prospects enable row level security;
  alter table qt_state enable row level security;
`);
const check = await client.query(`select table_name from information_schema.tables where table_name in ('qt_prospects','qt_state')`);
console.log('Tables ready:', check.rows.map((r) => r.table_name).join(', '));
await client.end();
