import { NextResponse } from 'next/server';
import { getProspects, getSettings, saveProspects } from '@/lib/db';
import { aiComplete, parseJsonLoose } from '@/lib/ai';

// Classify uncategorized prospects as Quantum or AI, and fill missing product descriptions when known.
export async function POST() {
  try {
    const [prospects, settings] = await Promise.all([getProspects(), getSettings()]);
    const targets = prospects.filter((p) => !p.category || (!p.description && !p.product));
    if (!targets.length) return NextResponse.json({ classified: 0, message: 'Everything is already classified.' });

    const list = targets
      .map((p) => `- id:${p.id} | ${p.organization} | product: ${p.product || '?'} | ${p.description || ''}`)
      .join('\n');
    const raw = await aiComplete(settings, {
      system: 'You classify technology companies as "Quantum" (quantum computing hardware/software/tooling) or "AI" (artificial intelligence / ML platforms). If you recognize the company, you may also supply its main software product and a one-sentence description.',
      user: `Classify each company. Respond with JSON only:
{"items":[{"id":"...","category":"Quantum"|"AI","product":"(only if known, else empty)","description":"(only if known, else empty)"}]}

Companies:
${list}`,
      json: true,
    });
    const items = parseJsonLoose(raw).items || [];
    const changed = [];
    for (const it of items) {
      const p = targets.find((x) => x.id === it.id);
      if (!p) continue;
      if (it.category === 'Quantum' || it.category === 'AI') p.category = it.category;
      if (it.product && !p.product) p.product = it.product;
      if (it.description && !p.description) p.description = it.description;
      changed.push(p);
    }
    await saveProspects(changed);
    return NextResponse.json({ classified: changed.length });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
