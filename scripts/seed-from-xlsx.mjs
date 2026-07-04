// Seed the running app from an Excel tracker file.
// Usage: node scripts/seed-from-xlsx.mjs "C:\path\to\tracker.xlsx" [replace]
import fs from 'fs';

const [, , filePath, mode = 'merge'] = process.argv;
if (!filePath || !fs.existsSync(filePath)) {
  console.error('Usage: node scripts/seed-from-xlsx.mjs <path-to-xlsx> [merge|replace]');
  process.exit(1);
}

const buf = fs.readFileSync(filePath);
const fd = new FormData();
fd.append('file', new Blob([buf]), 'tracker.xlsx');
fd.append('mode', mode);

const res = await fetch('http://localhost:3210/api/import', { method: 'POST', body: fd });
console.log(JSON.stringify(await res.json(), null, 2));
