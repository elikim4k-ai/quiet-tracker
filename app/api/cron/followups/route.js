import { NextResponse } from 'next/server';
import { runFollowUpEngine } from '@/lib/engine';
import { sendWeeklyReport } from '@/lib/report';
import { getSettings } from '@/lib/db';

export const maxDuration = 300;

// Vercel Cron hits this daily at 20:00 UTC (= Friday-morning NZ when UTC day is Thursday).
// Drafts follow-ups for every due prospect; auto-sends emails only if the "auto-send"
// toggle is on in Settings AND SMTP is configured. On Thursdays (UTC) it also sends
// the weekly summary email — Vercel Hobby allows only two cron jobs, so it rides along here.
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await runFollowUpEngine({ autoSend: true });
    let weeklyReport = 'not due today';
    if (new Date().getUTCDay() === 4) { // Thursday UTC = Friday morning in New Zealand
      const settings = await getSettings();
      if (settings.weeklyReport !== false) {
        try {
          const r = await sendWeeklyReport();
          weeklyReport = `sent to ${r.to}`;
        } catch (e) {
          weeklyReport = `failed: ${e.message}`;
        }
      } else {
        weeklyReport = 'disabled in settings';
      }
    }
    return NextResponse.json({ ...result, weeklyReport });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
