import { NextResponse } from 'next/server';
import { getProspect, getSettings, saveProspect } from '@/lib/db';
import { sendEmail, smtpConfigured } from '@/lib/mailer';

export async function POST(req) {
  try {
    const { prospectId, subject, body } = await req.json();
    const [p, settings] = await Promise.all([getProspect(prospectId), getSettings()]);
    if (!p) return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
    if (!p.email) return NextResponse.json({ error: 'Prospect has no email address' }, { status: 400 });
    if (!smtpConfigured(settings)) {
      return NextResponse.json({ error: 'SMTP not configured. Add SMTP settings first.' }, { status: 400 });
    }
    await sendEmail(settings, { to: p.email, subject, body });
    const d = p.drafts.find((x) => x.subject === subject && x.body === body);
    if (d) d.sent = true;
    p.followUp.lastContacted = new Date().toISOString();
    p.statusLog.push({ date: new Date().toISOString().slice(0, 10), note: `Email sent: "${subject}"` });
    if (p.stage === 'New') p.stage = 'Contacted';
    await saveProspect(p);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
