import { NextResponse } from 'next/server';
import { getProspects, getSettings, daysUntilDue } from '@/lib/db';

// Push the whole tracker to the shared Google Sheet via its Apps Script webhook.
export async function POST() {
  try {
    const [prospects, settings] = await Promise.all([getProspects(), getSettings()]);
    if (!settings.sheetSyncUrl) {
      return NextResponse.json({ error: 'No Google Sheet sync URL configured. Add it in Settings (see the setup hint there).' }, { status: 400 });
    }
    if (!/^https:\/\/script\.google\.com\/macros\/.+\/exec$/.test(settings.sheetSyncUrl.trim())) {
      return NextResponse.json({
        error: 'The sync URL must be the Apps Script Web app URL (https://script.google.com/macros/s/…/exec) — not the spreadsheet link. In the sheet: Extensions → Apps Script → Deploy → Web app, then copy the /exec URL.',
      }, { status: 400 });
    }
    const header = [
      '#', 'Organization', 'Location', 'Product', 'Description', 'Category',
      'Contact Person', 'Title', 'Email', 'LinkedIn Profile', 'LinkedIn Connect',
      'WISER Connection', 'Stage', 'Status Log', 'Introductory Meeting', 'Follow-up Meeting',
      'Proposals', 'Contract Initiated', 'Value of Pipeline', 'Last Contacted',
      'Next Follow-up', 'Channel', 'Source',
    ];
    const rows = prospects.map((p, i) => {
      const due = daysUntilDue(p);
      return [
        i + 1, p.organization, p.location, p.product, p.description, p.category,
        p.contactPerson, p.title, p.email, p.linkedin, p.linkedinConnected,
        p.wiserConnection + (p.wiserConnectionNote ? ` — ${p.wiserConnectionNote}` : ''),
        p.stage,
        (p.statusLog || []).map((s) => `- ${s.note}${s.date ? ` (${s.date})` : ''}`).join('\n'),
        p.introMeeting, p.followUpMeeting, p.proposals, p.contractInitiated,
        p.pipelineValue || '',
        p.followUp?.lastContacted ? new Date(p.followUp.lastContacted).toISOString().slice(0, 10) : '',
        due === null ? 'paused' : due <= 0 ? 'due now' : `in ${due}d`,
        p.followUp?.channel || '', p.source,
      ].map((v) => (v == null ? '' : v));
    });

    const res = await fetch(settings.sheetSyncUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: settings.sheetSyncSecret || '',
        updatedAt: new Date().toISOString(),
        rows: [header, ...rows],
      }),
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = null; }
    if (!res.ok || !data?.ok) {
      const hint = text.includes('<html') ? 'The webhook returned a Google sign-in page — redeploy the Apps Script with access set to "Anyone".' : text.slice(0, 200);
      return NextResponse.json({ error: `Sheet sync failed: ${data?.error || hint}` }, { status: 500 });
    }
    return NextResponse.json({ ok: true, rows: rows.length });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
