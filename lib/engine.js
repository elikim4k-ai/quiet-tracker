import { getProspects, getSettings, saveProspect, saveProspects, saveMeta, daysUntilDue, blankProspect } from './db.js';
import { aiComplete, parseJsonLoose, outreachSystemPrompt } from './ai.js';
import { sendEmail, smtpConfigured } from './mailer.js';

// Draft (and optionally auto-send) a message for every prospect whose follow-up timer is up.
export async function runFollowUpEngine({ autoSend = false } = {}) {
  const settings = await getSettings();
  const prospects = await getProspects();
  const due = prospects.filter((p) => {
    const d = daysUntilDue(p);
    return d !== null && d <= 0;
  });
  const results = [];
  for (const p of due) {
    try {
      const type = p.followUp.lastContacted ? 'followup' : 'cold';
      const channel = p.followUp.channel || 'email';
      const log = p.statusLog.map((s) => `- ${s.note}${s.date ? ` (${s.date})` : ''}`).join('\n');
      const channelNote =
        channel === 'linkedin'
          ? p.linkedinConnected === 'Yes'
            ? 'Channel: LinkedIn direct message (under 100 words, no subject).'
            : 'Channel: LinkedIn connection request note (under 280 characters, no subject).'
          : 'Channel: email.';
      const user = `TARGET: ${p.organization} — ${p.product || 'product unknown'} (${p.category || 'Quantum/AI'})
Contact: ${p.contactPerson || 'unknown'} (${p.title || ''}), stage: ${p.stage}
WISER connection: ${p.wiserConnection}${p.wiserConnectionNote ? ` — ${p.wiserConnectionNote}` : ''}
History:
${log || '- No contact yet'}

TASK: ${type === 'cold' ? 'Write the first cold outreach proposing the Insider Program partnership with a short intro-call ask.' : 'Write a brief polite follow-up referencing the history; one new value angle; re-ask for a short call.'}
${channelNote}
Respond with JSON only: {"subject": "...", "body": "..."}`;
      const raw = await aiComplete(settings, { system: outreachSystemPrompt(settings), user, json: true });
      const draft = parseJsonLoose(raw);
      const record = { ts: new Date().toISOString(), type, channel, subject: draft.subject || '', body: draft.body || '', sent: false };
      p.drafts.unshift(record);

      let sent = false;
      if (autoSend && settings.autoSendEmail && channel === 'email' && p.email && smtpConfigured(settings)) {
        await sendEmail(settings, { to: p.email, subject: record.subject, body: record.body });
        record.sent = true;
        sent = true;
        p.followUp.lastContacted = new Date().toISOString();
        p.statusLog.push({ date: new Date().toISOString().slice(0, 10), note: `Auto-sent ${type} email: "${record.subject}"` });
        if (p.stage === 'New') p.stage = 'Contacted';
      }
      await saveProspect(p);
      results.push({ prospectId: p.id, organization: p.organization, channel, ok: true, sent });
    } catch (e) {
      results.push({ prospectId: p.id, organization: p.organization, ok: false, error: e.message });
    }
  }
  return { drafted: results.filter((r) => r.ok).length, sent: results.filter((r) => r.sent).length, results };
}

// Ask the AI for new quantum/AI software companies not already tracked.
export async function runDiscovery(category = 'both') {
  const settings = await getSettings();
  const prospects = await getProspects();
  const existing = prospects.map((p) => p.organization).join(', ');
  const count = settings.discoveryCount || 10;
  const catText =
    category === 'both'
      ? 'a mix of Quantum computing software companies and AI software companies'
      : `${category} software companies`;

  const system = `You are a market researcher building a partnership prospect list for WISER, a non-profit serving students and researchers in quantum computing and AI. Suggest real companies that sell or provide software platforms (SaaS, SDKs, dev tools, cloud platforms) in quantum computing or AI — companies whose product students and researchers would want hands-on access to.`;
  const user = `Suggest ${count} ${catText} NOT already in this list:
${existing || '(list is empty)'}

For each, respond with real, verifiable companies you are confident exist. Respond with JSON only:
{"companies":[{"organization":"...","location":"City/Country","product":"product name","description":"one sentence on what the product does","category":"Quantum" or "AI","website":"https://..."}]}`;

  const raw = await aiComplete(settings, { system, user, json: true });
  const parsed = parseJsonLoose(raw);
  const list = parsed.companies || parsed;
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const seen = new Set(prospects.map((p) => norm(p.organization)));
  const fresh = [];
  for (const c of list) {
    if (!c.organization || seen.has(norm(c.organization))) continue;
    seen.add(norm(c.organization));
    const p = blankProspect();
    p.organization = c.organization;
    p.location = c.location || '';
    p.product = c.product || '';
    p.description = [c.description, c.website].filter(Boolean).join(' — ');
    p.category = c.category === 'AI' ? 'AI' : 'Quantum';
    p.source = 'discovery';
    fresh.push(p);
  }
  await saveProspects(fresh);
  await saveMeta({ lastDiscoveryRun: new Date().toISOString() });
  return { added: fresh.length, suggested: list.length };
}
