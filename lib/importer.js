import * as XLSX from 'xlsx';
import { blankProspect } from './db.js';

const QUANTUM_WORDS = /quantum|qubit|qpu|photonic|superconduct|ion trap|annealing|qkd|qsl/i;
const AI_WORDS = /\bai\b|artificial intelligence|machine learning|\bml\b|llm|deep learning|neural|genai|generative/i;

export function guessCategory(text) {
  if (QUANTUM_WORDS.test(text)) return 'Quantum';
  if (AI_WORDS.test(text)) return 'AI';
  return '';
}

function excelDateToISO(v) {
  if (v === '' || v == null) return '';
  if (typeof v === 'number' && v > 20000 && v < 60000) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return d.toISOString().slice(0, 10);
  }
  return String(v).trim();
}

function clean(v) {
  return String(v ?? '').replace(/\r/g, '').trim();
}

// Split a multi-line status cell like "- Confirmed for a call (May 7)\n- No response" into log entries.
function parseStatusLog(cell) {
  const text = clean(cell);
  if (!text) return [];
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^[-•\s]+/, '').trim())
    .filter(Boolean)
    .map((note) => {
      const m = note.match(/\(([A-Za-z]{3,9}\.?\s*\d{1,2}(?:,?\s*\d{4})?)\)\s*$/);
      return { date: m ? m[1] : '', note };
    });
}

function inferStage(p) {
  if (clean(p.contractInitiated)) return 'Contract Initiated';
  if (clean(p.proposals)) return 'Proposal';
  if (clean(p.followUpMeeting)) return 'Follow-up Meeting';
  if (clean(p.introMeeting) && !/pending/i.test(p.introMeeting)) return 'Intro Meeting';
  if (p.statusLog.length) return 'Contacted';
  return 'New';
}

function normOrg(name) {
  return clean(name).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Find header row: the row containing "Organization"
function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    if (rows[i].some((c) => /organization/i.test(String(c)))) return i;
  }
  return 0;
}

function colIndex(header, ...patterns) {
  for (const pat of patterns) {
    const idx = header.findIndex((h) => pat.test(String(h)));
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * Parse a tracker workbook (Buffer). Returns { prospects, vardaanMatches, skipped }.
 * Handles the three known tabs: Tracker, List from Vardaan, Additional Companies.
 */
export function parseWorkbook(buf) {
  const wb = XLSX.read(buf, { type: 'buffer' });

  // --- Vardaan list: org -> contact info ---
  const vardaan = new Map();
  const vSheetName = wb.SheetNames.find((n) => /vardaan/i.test(n));
  if (vSheetName) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[vSheetName], { header: 1, defval: '' });
    const h = findHeaderRow(rows.map((r) => r.map(clean)));
    const header = rows[h] ? rows[h].map(clean) : [];
    const cPartner = colIndex(header, /partner|organization|company/i);
    const cContact = colIndex(header, /contact/i);
    const cEmail = colIndex(header, /email/i);
    const cNotes = colIndex(header, /notes/i);
    for (const row of rows.slice(h + 1)) {
      const org = clean(row[cPartner]);
      if (!org) continue;
      vardaan.set(normOrg(org), {
        org,
        contact: clean(row[cContact]),
        email: cEmail >= 0 ? clean(row[cEmail]) : '',
        notes: cNotes >= 0 ? clean(row[cNotes]) : '',
      });
    }
  }

  const prospects = [];
  const seen = new Set();
  let skipped = 0;

  // --- Main tracker tab ---
  const tSheetName = wb.SheetNames.find((n) => /tracker/i.test(n)) || wb.SheetNames[0];
  const tRows = XLSX.utils.sheet_to_json(wb.Sheets[tSheetName], { header: 1, defval: '' });
  const th = findHeaderRow(tRows);
  const header = (tRows[th] || []).map(clean);
  const col = {
    org: colIndex(header, /^organization/i, /company/i),
    location: colIndex(header, /location/i),
    product: colIndex(header, /^product/i, /software/i),
    description: colIndex(header, /description/i),
    contact: colIndex(header, /contact person/i, /^contact$/i),
    email: colIndex(header, /email/i),
    title: colIndex(header, /^title/i),
    linkedin: colIndex(header, /linkedin/i),
    wiser: colIndex(header, /wiser/i, /previous.*connection/i),
    status: colIndex(header, /^status/i),
    intro: colIndex(header, /introductory/i),
    followUpMeeting: colIndex(header, /follow.?up meeting/i),
    proposals: colIndex(header, /proposal/i),
    contract: colIndex(header, /contract/i),
    pipeline: colIndex(header, /pipeline|value/i),
  };

  for (const row of tRows.slice(th + 1)) {
    const org = clean(row[col.org]);
    if (!org) { skipped++; continue; }
    const p = blankProspect();
    p.organization = org;
    p.location = clean(row[col.location]);
    p.product = clean(row[col.product]);
    p.description = col.description >= 0 ? clean(row[col.description]) : '';
    p.contactPerson = clean(row[col.contact]);
    p.title = clean(row[col.title]);
    const emailRaw = clean(row[col.email]);
    p.email = /@/.test(emailRaw) ? emailRaw : '';
    const liRaw = clean(row[col.linkedin]);
    if (/^https?:/i.test(liRaw)) { p.linkedin = liRaw; p.linkedinConnected = 'Pending'; }
    else p.linkedinConnected = liRaw || 'Pending';
    if (!p.email && /@/.test(liRaw) === false && /^https?:/i.test(emailRaw)) p.linkedin = p.linkedin || emailRaw;
    p.statusLog = parseStatusLog(row[col.status]);
    p.introMeeting = excelDateToISO(row[col.intro]);
    p.followUpMeeting = excelDateToISO(row[col.followUpMeeting]);
    p.proposals = clean(row[col.proposals]);
    p.contractInitiated = clean(row[col.contract]);
    p.pipelineValue = Number(String(row[col.pipeline]).replace(/[^0-9.]/g, '')) || 0;
    p.stage = inferStage(p);
    p.category = guessCategory([p.organization, p.product, p.description, p.title].join(' ')) || 'Quantum';
    p.source = 'import';
    // Already-contacted prospects: start the follow-up clock at import so the
    // queue doesn't flag the entire sheet as "due now" on day one.
    if (p.statusLog.length) p.followUp.lastContacted = new Date().toISOString();

    // Cross-check Vardaan list
    const v = vardaan.get(normOrg(org)) || [...vardaan.entries()].find(([k]) => k && (k.includes(normOrg(org)) || normOrg(org).includes(k)))?.[1];
    const sheetSaysYes = /yes/i.test(clean(row[col.wiser]));
    if (v || sheetSaysYes) {
      p.wiserConnection = 'Yes';
      if (v) {
        p.wiserConnectionNote = `From Vardaan's list: ${v.contact || 'contact on file'}${v.email ? ` <${v.email}>` : ''}${v.notes ? ` — ${v.notes}` : ''}`;
        if (!p.contactPerson && v.contact) p.contactPerson = v.contact;
        if (!p.email && v.email) p.email = v.email;
      }
    }

    seen.add(normOrg(org));
    prospects.push(p);
  }

  // --- Additional Companies tab: bare names in any column ---
  const aSheetName = wb.SheetNames.find((n) => /additional/i.test(n));
  if (aSheetName) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[aSheetName], { header: 1, defval: '' });
    for (const row of rows) {
      for (const cell of row) {
        const org = clean(cell);
        if (!org || /^https?:/i.test(org) || seen.has(normOrg(org))) continue;
        seen.add(normOrg(org));
        const p = blankProspect();
        p.organization = org;
        p.stage = 'New';
        p.source = 'import';
        p.category = guessCategory(org) || 'Quantum';
        const v = vardaan.get(normOrg(org));
        if (v) {
          p.wiserConnection = 'Yes';
          p.wiserConnectionNote = `From Vardaan's list: ${v.contact || 'contact on file'}${v.notes ? ` — ${v.notes}` : ''}`;
          if (v.contact) p.contactPerson = v.contact;
          if (v.email) p.email = v.email;
        }
        prospects.push(p);
      }
    }
  }

  return { prospects, vardaanCount: vardaan.size, skipped };
}
