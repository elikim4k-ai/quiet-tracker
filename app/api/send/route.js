import { NextResponse } from 'next/server';
import { getProspect, getSettings, saveProspect } from '@/lib/db';
import { sendEmail, smtpConfigured } from '@/lib/mailer';

export async function POST(req) {
  try {
    const { prospectId, subject, body, draftTs = '', attachments = [] } = await req.json();
    const totalBytes = attachments.reduce((s, a) => s + Math.ceil((a.contentBase64 || '').length * 0.75), 0);
    if (totalBytes > 3 * 1024 * 1024) {
      return NextResponse.json({ error: 'Attachments too large — keep the total under 3 MB.' }, { status: 400 });
    }
    const [p, settings] = await Promise.all([getProspect(prospectId), getSettings()]);
    if (!p) return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
    if (!p.email) return NextResponse.json({ error: 'Prospect has no email address' }, { status: 400 });
    if (!smtpConfigured(settings)) {
      return NextResponse.json({ error: 'SMTP not configured. Add SMTP settings first.' }, { status: 400 });
    }
    await sendEmail(settings, { to: p.email, subject, body, attachments });
    // Record exactly what was sent (the user may have edited the draft before sending).
    const d = p.drafts.find((x) => x.ts === draftTs) || p.drafts.find((x) => x.subject === subject && x.body === body);
    if (d) {
      d.subject = subject;
      d.body = body;
      d.sent = true;
      d.attachmentNames = attachments.map((a) => a.filename);
    }
    p.followUp.lastContacted = new Date().toISOString();
    p.statusLog.push({
      date: new Date().toISOString().slice(0, 10),
      note: `Email sent: "${subject}"${attachments.length ? ` (${attachments.length} attachment${attachments.length > 1 ? 's' : ''})` : ''}`,
      draftTs: d?.ts || '',
    });
    if (p.stage === 'New') p.stage = 'Contacted';
    await saveProspect(p);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
