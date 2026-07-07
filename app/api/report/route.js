import { NextResponse } from 'next/server';
import { sendWeeklyReport } from '@/lib/report';

// Manual trigger for the weekly report (the Friday cron sends it automatically).
export async function POST() {
  try {
    const r = await sendWeeklyReport();
    return NextResponse.json({ ok: true, to: r.to, emailsSent: r.emailsSent.length, followedUp: r.followedUp, newProspects: r.newProspects.length });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
