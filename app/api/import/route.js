import { NextResponse } from 'next/server';
import { getProspects, saveProspects, replaceAllProspects, saveMeta } from '@/lib/db';
import { parseWorkbook } from '@/lib/importer';

export async function POST(req) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    const mode = form.get('mode') || 'merge'; // 'merge' | 'replace'
    const buf = Buffer.from(await file.arrayBuffer());
    const { prospects, vardaanCount, skipped } = parseWorkbook(buf);

    let added = 0, updated = 0, total = 0;
    if (mode === 'replace') {
      await replaceAllProspects(prospects);
      added = prospects.length;
      total = prospects.length;
    } else {
      const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const existing = await getProspects();
      const byOrg = new Map(existing.map((p) => [norm(p.organization), p]));
      const changed = [];
      for (const p of prospects) {
        const prev = byOrg.get(norm(p.organization));
        if (prev) {
          // refresh imported fields, keep local workflow state (drafts, followUp, timers)
          const keep = { id: prev.id, drafts: prev.drafts, followUp: prev.followUp, createdAt: prev.createdAt };
          const mergedLog = [...prev.statusLog];
          for (const e of p.statusLog) if (!mergedLog.some((x) => x.note === e.note)) mergedLog.push(e);
          Object.assign(prev, p, keep, { statusLog: mergedLog });
          changed.push(prev);
          updated++;
        } else {
          byOrg.set(norm(p.organization), p);
          changed.push(p);
          added++;
        }
      }
      await saveProspects(changed);
      total = byOrg.size;
    }
    await saveMeta({ lastImport: new Date().toISOString() });
    return NextResponse.json({ added, updated, skipped, vardaanCount, total });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
