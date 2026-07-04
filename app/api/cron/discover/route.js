import { NextResponse } from 'next/server';
import { runDiscovery } from '@/lib/engine';

export const maxDuration = 120;

// Vercel Cron hits this weekly (GET): find new Quantum/AI companies automatically.
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await runDiscovery('both');
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
