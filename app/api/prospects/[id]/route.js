import { NextResponse } from 'next/server';
import { getProspect, saveProspect, deleteProspect } from '@/lib/db';

export async function PATCH(req, { params }) {
  const { id } = await params;
  const patch = await req.json();
  const p = await getProspect(id);
  if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (patch.addStatusNote) {
    p.statusLog.push({ date: new Date().toISOString().slice(0, 10), note: patch.addStatusNote });
    delete patch.addStatusNote;
  }
  if (patch.followUp) patch.followUp = { ...p.followUp, ...patch.followUp };
  Object.assign(p, patch);
  await saveProspect(p);
  return NextResponse.json({ prospect: p });
}

export async function DELETE(req, { params }) {
  const { id } = await params;
  await deleteProspect(id);
  return NextResponse.json({ ok: true });
}
