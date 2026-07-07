import { getProspects, getSettings, daysUntilDue } from './db.js';
import { sendEmail, smtpConfigured } from './mailer.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inLastDays(dateStr, days) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(dateStr))) return false;
  const t = new Date(dateStr).getTime();
  return t >= Date.now() - days * 86400000;
}

export function buildWeeklyReport(prospects) {
  const emailsSent = [];
  const followedUpOrgs = new Set();

  for (const p of prospects) {
    for (const s of p.statusLog || []) {
      if (!inLastDays(s.date, 7)) continue;
      if (/email sent|auto-sent/i.test(s.note)) {
        const subject = (s.note.match(/"([^"]+)"/) || [])[1] || '';
        emailsSent.push({
          date: s.date,
          organization: p.organization,
          contact: p.contactPerson || '—',
          email: p.email || '—',
          subject,
        });
        followedUpOrgs.add(p.organization);
      } else if (/contacted via/i.test(s.note)) {
        followedUpOrgs.add(p.organization);
      }
    }
  }
  emailsSent.sort((a, b) => a.date.localeCompare(b.date));

  const newProspects = prospects
    .filter((p) => inLastDays(String(p.createdAt).slice(0, 10), 7))
    .map((p) => ({ organization: p.organization, category: p.category || '?', source: p.source }));

  const dueNow = prospects.filter((p) => {
    const d = daysUntilDue(p);
    return d !== null && d <= 0;
  }).length;

  return {
    emailsSent,
    followedUp: followedUpOrgs.size,
    newProspects,
    totals: {
      prospects: prospects.length,
      quantum: prospects.filter((p) => p.category === 'Quantum').length,
      ai: prospects.filter((p) => p.category === 'AI').length,
      dueNow,
      pipeline: prospects.reduce((s, p) => s + (Number(p.pipelineValue) || 0), 0),
    },
  };
}

export async function sendWeeklyReport() {
  const settings = await getSettings();
  const to = settings.senderEmail || settings.smtp.user;
  if (!to) throw new Error('No sender email configured in Settings.');
  if (!smtpConfigured(settings)) throw new Error('SMTP not configured.');

  const prospects = await getProspects();
  const r = buildWeeklyReport(prospects);
  const dateStr = new Date().toISOString().slice(0, 10);

  const text = `WISER Insider Program — weekly update (${dateStr})

EMAILS SENT THIS WEEK (${r.emailsSent.length})
${r.emailsSent.map((e) => `- ${e.date} — ${e.organization} · ${e.contact} <${e.email}> — "${e.subject}"`).join('\n') || '- none'}

PROSPECTS FOLLOWED UP: ${r.followedUp}

NEW PROSPECTS ADDED (${r.newProspects.length})
${r.newProspects.map((n) => `- ${n.organization} [${n.category}] via ${n.source}`).join('\n') || '- none'}

PIPELINE SNAPSHOT
- Total prospects: ${r.totals.prospects} (${r.totals.quantum} Quantum / ${r.totals.ai} AI)
- Follow-ups due now: ${r.totals.dueNow}
- Pipeline value: $${r.totals.pipeline.toLocaleString()}

— Quiet Tracker`;

  const row = (cells) => `<tr>${cells.map((c) => `<td style="padding:6px 10px;border-bottom:1px solid #eee;">${c}</td>`).join('')}</tr>`;
  const th = (cells) => `<tr>${cells.map((c) => `<th style="padding:6px 10px;text-align:left;border-bottom:2px solid #ccc;">${c}</th>`).join('')}</tr>`;
  const h2 = (t) => `<h3 style="margin:18px 0 8px;font-family:Arial,sans-serif;">${t}</h3>`;

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222;">
<h2 style="margin:0 0 4px;">WISER Insider Program — weekly update</h2>
<p style="margin:0;color:#777;">${dateStr} · Quiet Tracker</p>
${h2(`📤 Emails sent this week (${r.emailsSent.length})`)}
${r.emailsSent.length
  ? `<table style="border-collapse:collapse;">${th(['Date', 'Organization', 'Contact', 'Email', 'Subject'])}${r.emailsSent
      .map((e) => row([e.date, `<b>${esc(e.organization)}</b>`, esc(e.contact), esc(e.email), esc(e.subject)])).join('')}</table>`
  : '<p style="margin:0;color:#777;">None</p>'}
${h2(`🔁 Prospects followed up: ${r.followedUp}`)}
${h2(`🆕 New prospects added (${r.newProspects.length})`)}
${r.newProspects.length
  ? `<table style="border-collapse:collapse;">${th(['Organization', 'Category', 'Source'])}${r.newProspects
      .map((n) => row([`<b>${esc(n.organization)}</b>`, n.category, n.source])).join('')}</table>`
  : '<p style="margin:0;color:#777;">None</p>'}
${h2('📊 Pipeline snapshot')}
<p style="margin:0;">Total prospects: <b>${r.totals.prospects}</b> (${r.totals.quantum} Quantum / ${r.totals.ai} AI)<br>
Follow-ups due now: <b>${r.totals.dueNow}</b><br>
Pipeline value: <b>$${r.totals.pipeline.toLocaleString()}</b></p>
<p style="margin:16px 0 0;color:#999;font-size:12px;">Sent automatically every Friday morning (NZ time) by Quiet Tracker.</p>
</div>`;

  await sendEmail(settings, {
    to,
    subject: `Quiet Tracker weekly update — ${r.emailsSent.length} sent, ${r.newProspects.length} new (${dateStr})`,
    body: text,
    htmlOverride: html,
    skipSignature: true,
  });
  return { to, ...r };
}
