import { NextResponse } from 'next/server';
import { runFollowUpEngine } from '@/lib/engine';

export const maxDuration = 300;

// Vercel Cron hits this daily (GET). Drafts follow-ups for every due prospect;
// auto-sends emails only if the "auto-send" toggle is on in Settings AND SMTP is configured.
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await runFollowUpEngine({ autoSend: true });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
