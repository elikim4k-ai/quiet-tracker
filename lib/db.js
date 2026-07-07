import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { PROVIDERS } from './providers.js';

// ── Backend selection ────────────────────────────────────────────────────────
// With Supabase creds in the environment (deployed, or .env.local) all data
// lives in Postgres (tables qt_prospects / qt_state) so the tracker can be
// shared and run 24/7. Without them it falls back to a local JSON file.
const SUPA_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const usingSupabase = Boolean(SUPA_URL && SUPA_KEY);

let _supa = null;
function supa() {
  if (!_supa) _supa = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });
  return _supa;
}

// ── Local JSON fallback ──────────────────────────────────────────────────────
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function localRead() {
  if (!fs.existsSync(DB_FILE)) return { prospects: [], settings: {}, meta: {} };
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function localWrite(db) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

// ── Defaults ─────────────────────────────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  aiProvider: 'openai',
  openaiApiKey: '',
  openaiModel: 'gpt-4o-mini',
  geminiApiKey: '',
  geminiModel: 'gemini-flash-latest',
  grokApiKey: '',
  grokModel: 'grok-4-fast',
  deepseekApiKey: '',
  deepseekModel: 'deepseek-chat',
  qwenApiKey: '',
  qwenModel: 'qwen-plus',
  glmApiKey: '',
  glmModel: 'glm-4.5-air',
  customBaseUrl: '',
  customApiKey: '',
  customModel: '',
  senderName: '',
  senderTitle: '',
  senderEmail: '',
  emailSignature: '',
  orgProfile: `WISER — The Washington Institute for STEM, Entrepreneurship and Research (thewiser.org) is a non-profit headquartered in Washington, DC with global reach. Mission: inspire and equip the next generation of leaders in science, technology, engineering, and mathematics.

Focus areas: scientific leadership development, workforce advancement through cutting-edge training in advanced domains (quantum, AI), innovation & entrepreneurship support, and cross-sector collaboration. Programs include summer programs, on-demand learning, regional partnerships, executive education, research initiatives, and the WISER Fellows program.

Community: a global network of students and researchers in quantum computing and AI.

Partnership offer (the "Insider Program"): the company provides exclusive access to its software platform for WISER's community of students and researchers; in exchange, WISER promotes the company's product across its community channels (newsletters, events, programs), giving the company visibility with an engaged, technical audience of future customers and hires. WISER is a non-profit — this is a mutually beneficial community partnership, not a paid vendor deal.`,
  smtp: { host: '', port: 587, user: '', pass: '', from: '' },
  autoSendEmail: false,
  defaultFollowUpDays: 7,
  discoveryCount: 10,
};

const DEFAULT_META = { lastDiscoveryRun: null, lastImport: null };

function withDefaults(settings) {
  const s = { ...DEFAULT_SETTINGS, ...settings, smtp: { ...DEFAULT_SETTINGS.smtp, ...(settings?.smtp || {}) } };
  // Environment keys act as fallbacks so deployed instances can keep secrets out of the DB.
  for (const p of Object.values(PROVIDERS)) {
    if (s[p.keyField]) continue;
    const envName = (p.env || []).find((name) => process.env[name]);
    if (envName) s[p.keyField] = process.env[envName];
  }
  return s;
}

// ── Prospects ────────────────────────────────────────────────────────────────
export async function getProspects() {
  if (usingSupabase) {
    const { data, error } = await supa().from('qt_prospects').select('data');
    if (error) throw new Error('Supabase read failed: ' + error.message);
    return data.map((r) => r.data).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  }
  return localRead().prospects;
}

export async function getProspect(id) {
  if (usingSupabase) {
    const { data, error } = await supa().from('qt_prospects').select('data').eq('id', id).maybeSingle();
    if (error) throw new Error('Supabase read failed: ' + error.message);
    return data?.data || null;
  }
  return localRead().prospects.find((p) => p.id === id) || null;
}

export async function saveProspects(list) {
  if (!list.length) return;
  if (usingSupabase) {
    const rows = list.map((p) => ({ id: p.id, data: p, updated_at: new Date().toISOString() }));
    const { error } = await supa().from('qt_prospects').upsert(rows);
    if (error) throw new Error('Supabase write failed: ' + error.message);
    return;
  }
  const db = localRead();
  const byId = new Map(db.prospects.map((p) => [p.id, p]));
  for (const p of list) byId.set(p.id, p);
  db.prospects = [...byId.values()];
  localWrite(db);
}

export const saveProspect = (p) => saveProspects([p]);

export async function deleteProspect(id) {
  if (usingSupabase) {
    const { error } = await supa().from('qt_prospects').delete().eq('id', id);
    if (error) throw new Error('Supabase delete failed: ' + error.message);
    return;
  }
  const db = localRead();
  db.prospects = db.prospects.filter((p) => p.id !== id);
  localWrite(db);
}

export async function replaceAllProspects(list) {
  if (usingSupabase) {
    const { error } = await supa().from('qt_prospects').delete().neq('id', '');
    if (error) throw new Error('Supabase clear failed: ' + error.message);
    await saveProspects(list);
    return;
  }
  const db = localRead();
  db.prospects = list;
  localWrite(db);
}

// ── Settings & meta (qt_state) ───────────────────────────────────────────────
async function getState(key, fallback) {
  if (usingSupabase) {
    const { data, error } = await supa().from('qt_state').select('value').eq('key', key).maybeSingle();
    if (error) throw new Error('Supabase read failed: ' + error.message);
    return data?.value ?? fallback;
  }
  const db = localRead();
  return db[key] ?? fallback;
}

async function saveState(key, value) {
  if (usingSupabase) {
    const { error } = await supa().from('qt_state').upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) throw new Error('Supabase write failed: ' + error.message);
    return;
  }
  const db = localRead();
  db[key] = value;
  localWrite(db);
}

export async function getSettings() {
  return withDefaults(await getState('settings', {}));
}

export async function saveSettings(patch) {
  const current = await getState('settings', {});
  const next = { ...current, ...patch, smtp: { ...(current.smtp || {}), ...(patch.smtp || {}) } };
  await saveState('settings', next);
  return withDefaults(next);
}

export async function getMeta() {
  return { ...DEFAULT_META, ...(await getState('meta', {})) };
}

export async function saveMeta(patch) {
  const next = { ...(await getMeta()), ...patch };
  await saveState('meta', next);
  return next;
}

// ── Domain helpers ───────────────────────────────────────────────────────────
export function newId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export const STAGES = ['New', 'Contacted', 'Intro Meeting', 'Follow-up Meeting', 'Proposal', 'Contract Initiated', 'Onboard', 'Dead'];

export function blankProspect() {
  return {
    id: newId(),
    organization: '',
    location: '',
    product: '',
    description: '',
    category: '',
    contactPerson: '',
    title: '',
    email: '',
    linkedin: '',
    linkedinConnected: 'Pending',
    wiserConnection: 'No',
    wiserConnectionNote: '',
    stage: 'New',
    statusLog: [],
    introMeeting: '',
    followUpMeeting: '',
    proposals: '',
    contractInitiated: '',
    pipelineValue: 0,
    followUp: { active: true, channel: 'email', frequencyDays: 7, lastContacted: null },
    drafts: [],
    source: 'manual',
    createdAt: new Date().toISOString(),
  };
}

// Days until next follow-up is due. <= 0 means due now.
export function daysUntilDue(p) {
  if (!p.followUp?.active) return null;
  if (['Onboard', 'Dead'].includes(p.stage)) return null;
  const last = p.followUp.lastContacted ? new Date(p.followUp.lastContacted) : null;
  if (!last) return 0;
  const next = new Date(last.getTime() + p.followUp.frequencyDays * 86400000);
  return Math.ceil((next.getTime() - Date.now()) / 86400000);
}
