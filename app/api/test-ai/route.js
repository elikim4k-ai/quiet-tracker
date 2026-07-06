import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/db';
import { aiComplete } from '@/lib/ai';

// Test the AI connection using current form values (falls back to saved settings).
export async function POST(req) {
  const overrides = await req.json().catch(() => ({}));
  const settings = { ...(await getSettings()), ...overrides };
  const provider = settings.aiProvider;
  const model =
    provider === 'gemini' ? settings.geminiModel :
    provider === 'grok' ? settings.grokModel :
    settings.openaiModel;
  const started = Date.now();
  try {
    const reply = await aiComplete(settings, {
      system: 'You are a connection test. Reply with exactly: OK',
      user: 'Connection test — reply with exactly: OK',
    });
    return NextResponse.json({
      ok: true,
      provider,
      model,
      ms: Date.now() - started,
      reply: String(reply).trim().slice(0, 100),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, provider, model, error: e.message }, { status: 200 });
  }
}
