import { NextResponse } from 'next/server';
import { runDiscovery } from '@/lib/engine';

export async function POST(req) {
  try {
    const { category = 'both' } = await req.json().catch(() => ({}));
    const result = await runDiscovery(category);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
