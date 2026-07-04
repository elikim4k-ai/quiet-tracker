import { NextResponse } from 'next/server';
import { getProspects, getMeta, saveProspect, blankProspect, daysUntilDue } from '@/lib/db';

export async function GET() {
  const [prospects, meta] = await Promise.all([getProspects(), getMeta()]);
  return NextResponse.json({
    prospects: prospects.map((p) => ({ ...p, dueInDays: daysUntilDue(p) })),
    meta,
  });
}

export async function POST(req) {
  const body = await req.json();
  const p = { ...blankProspect(), ...body };
  await saveProspect(p);
  return NextResponse.json({ prospect: p });
}
