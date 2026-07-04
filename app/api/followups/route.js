import { NextResponse } from 'next/server';
import { getProspects, daysUntilDue } from '@/lib/db';
import { runFollowUpEngine } from '@/lib/engine';

export async function GET() {
  const prospects = await getProspects();
  const due = prospects
    .map((p) => ({ ...p, dueInDays: daysUntilDue(p) }))
    .filter((p) => p.dueInDays !== null && p.dueInDays <= 0);
  return NextResponse.json({ due });
}

// Run the follow-up engine manually from the dashboard (drafts only — sending stays a human click).
export async function POST() {
  try {
    const result = await runFollowUpEngine({ autoSend: false });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
