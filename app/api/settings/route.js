import { NextResponse } from 'next/server';
import { getSettings, saveSettings } from '@/lib/db';

export async function GET() {
  return NextResponse.json({ settings: await getSettings() });
}

export async function POST(req) {
  const patch = await req.json();
  const settings = await saveSettings(patch);
  return NextResponse.json({ settings });
}
