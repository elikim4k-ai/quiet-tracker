import { NextResponse } from 'next/server';
import { getProspect, getSettings, saveProspect } from '@/lib/db';
import { aiComplete, parseJsonLoose, outreachSystemPrompt } from '@/lib/ai';

function prospectContext(p) {
  const log = p.statusLog.map((s) => `- ${s.note}${s.date ? ` (${s.date})` : ''}`).join('\n');
  return `TARGET COMPANY:
- Organization: ${p.organization}
- Location: ${p.location || 'unknown'}
- Product: ${p.product || 'unknown'}
- Product description: ${p.description || 'n/a'}
- Category: ${p.category || 'Quantum/AI'}
- Contact person: ${p.contactPerson || 'unknown'} (${p.title || 'title unknown'})
- Existing WISER connection: ${p.wiserConnection}${p.wiserConnectionNote ? ` — ${p.wiserConnectionNote}` : ''}
- Current stage: ${p.stage}
- History so far:
${log || '- No contact yet'}`;
}

const TYPE_INSTRUCTIONS = {
  cold: 'Write the FIRST cold outreach. Introduce WISER briefly, connect it to their specific product, and propose the Insider Program partnership with a short intro-call ask.',
  followup: 'Write a polite FOLLOW-UP referencing the history above. Do not repeat the full pitch; add one new angle of value and re-ask for a short call. Keep it shorter than a cold email.',
  reply: 'They replied. Using REPLY_TEXT below, write a response that moves toward a scheduled intro call (or the next stage). Answer their questions directly.',
};

export async function POST(req) {
  try {
    const { prospectId, type = 'cold', channel = 'email', replyText = '', instructions = '' } = await req.json();
    const [p, settings] = await Promise.all([getProspect(prospectId), getSettings()]);
    if (!p) return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });

    const channelNote =
      channel === 'linkedin'
        ? p.linkedinConnected === 'Yes'
          ? 'Channel: LinkedIn direct message (under 100 words, no subject).'
          : 'Channel: LinkedIn connection request note (under 280 characters, no subject).'
        : 'Channel: email.';

    const user = `${prospectContext(p)}

TASK: ${TYPE_INSTRUCTIONS[type] || TYPE_INSTRUCTIONS.cold}
${channelNote}
${replyText ? `\nREPLY_TEXT from ${p.contactPerson}:\n"""${replyText}"""` : ''}
${instructions ? `\nEXTRA INSTRUCTIONS FROM SENDER: ${instructions}` : ''}

Respond with JSON only: {"subject": "...", "body": "..."} (subject empty string for LinkedIn).`;

    const raw = await aiComplete(settings, { system: outreachSystemPrompt(settings), user, json: true });
    const draft = parseJsonLoose(raw);
    const record = {
      ts: new Date().toISOString(),
      type,
      channel,
      subject: draft.subject || '',
      body: draft.body || String(raw),
      sent: false,
    };
    p.drafts.unshift(record);
    await saveProspect(p);
    return NextResponse.json({ draft: record });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
