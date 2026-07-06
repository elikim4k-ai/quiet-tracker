// One-off: remove Quiet Tracker tables from a Supabase project (used after
// moving to a dedicated project, to clean qt_* out of the old shared one).
// Usage: node scripts/drop-qt-tables.mjs "<postgres-connection-url>"
import pg from 'pg';

const url = process.argv[2];
if (!url) {
  console.error('Usage: node scripts/drop-qt-tables.mjs "<postgres-connection-url>"');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query('drop table if exists qt_prospects; drop table if exists qt_state;');
console.log('qt_prospects and qt_state dropped.');
await client.end();
