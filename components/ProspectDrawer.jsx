'use client';
import { useState } from 'react';

const F = ({ label, children }) => (
  <div className="field">
    <label>{label}</label>
    {children}
  </div>
);

export default function ProspectDrawer({ prospect: p, aiReady, onClose, onChanged, flash }) {
  const [form, setForm] = useState({ ...p });
  const [note, setNote] = useState('');
  const [draftType, setDraftType] = useState('cold');
  const [draftChannel, setDraftChannel] = useState(p.followUp?.channel || 'email');
  const [replyText, setReplyText] = useState('');
  const [instructions, setInstructions] = useState('');
  const [busy, setBusy] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function patch(body) {
    const r = await fetch(`/api/prospects/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => r.json());
    if (r.error) flash('err', r.error);
    onChanged();
    return r;
  }

  async function save() {
    setBusy('save');
    const { drafts, statusLog, dueInDays, ...fields } = form;
    await patch(fields);
    setBusy('');
    flash('ok', 'Saved.');
  }

  async function addNote() {
    if (!note.trim()) return;
    await patch({ addStatusNote: note.trim() });
    setNote('');
  }

  async function generateDraft() {
    setBusy('draft');
    const r = await fetch('/api/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prospectId: p.id, type: draftType, channel: draftChannel, replyText, instructions }),
    }).then((r) => r.json());
    setBusy('');
    if (r.error) return flash('err', r.error);
    flash('ok', 'Draft generated.');
    onChanged();
  }

  async function sendEmail(d) {
    if (!confirm(`Send this email to ${p.contactPerson || p.organization} <${p.email}>?`)) return;
    setBusy('send');
    const r = await fetch('/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prospectId: p.id, subject: d.subject, body: d.body }),
    }).then((r) => r.json());
    setBusy('');
    if (r.error) return flash('err', r.error);
    flash('ok', `Email sent to ${p.email}.`);
    onChanged();
  }

  async function markContacted() {
    await patch({ followUp: { lastContacted: new Date().toISOString() }, addStatusNote: `Contacted via ${p.followUp?.channel || 'email'} (marked manually)` });
    flash('ok', 'Marked as contacted — follow-up timer reset.');
  }

  function copyDraft(d) {
    navigator.clipboard.writeText(d.subject ? `Subject: ${d.subject}\n\n${d.body}` : d.body);
    flash('ok', 'Copied to clipboard.');
  }

  async function remove() {
    if (!confirm(`Delete ${p.organization} from the tracker?`)) return;
    await fetch(`/api/prospects/${p.id}`, { method: 'DELETE' });
    onChanged();
    onClose();
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="drawer">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h2>{p.organization}</h2>
            <div className="sub">{[p.location, p.product].filter(Boolean).join(' · ')}</div>
          </div>
          <button className="btn" onClick={onClose}>✕ Close</button>
        </div>

        {p.wiserConnection === 'Yes' && p.wiserConnectionNote && (
          <div className="notice ok" style={{ marginTop: 12 }}>🤝 {p.wiserConnectionNote}</div>
        )}

        <div className="section">
          <h3>Details</h3>
          <div className="fieldgrid">
            <F label="Organization"><input value={form.organization} onChange={(e) => set('organization', e.target.value)} /></F>
            <F label="Location"><input value={form.location} onChange={(e) => set('location', e.target.value)} /></F>
            <F label="Software product"><input value={form.product} onChange={(e) => set('product', e.target.value)} /></F>
            <F label="Category">
              <select value={form.category} onChange={(e) => set('category', e.target.value)}>
                <option value="">Uncategorized</option><option>Quantum</option><option>AI</option>
              </select>
            </F>
            <div className="field full">
              <label>Product description</label>
              <textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
            </div>
            <F label="Contact person"><input value={form.contactPerson} onChange={(e) => set('contactPerson', e.target.value)} /></F>
            <F label="Title"><input value={form.title} onChange={(e) => set('title', e.target.value)} /></F>
            <F label="Email"><input value={form.email} onChange={(e) => set('email', e.target.value)} /></F>
            <F label="LinkedIn profile"><input value={form.linkedin} onChange={(e) => set('linkedin', e.target.value)} placeholder="https://linkedin.com/in/…" /></F>
            <F label="LinkedIn connected?">
              <select value={form.linkedinConnected} onChange={(e) => set('linkedinConnected', e.target.value)}>
                <option>Yes</option><option>No</option><option>Pending</option><option>N/A</option>
              </select>
            </F>
            <F label="WISER connection already?">
              <select value={form.wiserConnection} onChange={(e) => set('wiserConnection', e.target.value)}>
                <option>Yes</option><option>No</option>
              </select>
            </F>
            <F label="Stage">
              <select value={form.stage} onChange={(e) => set('stage', e.target.value)}>
                {['New', 'Contacted', 'Intro Meeting', 'Follow-up Meeting', 'Proposal', 'Contract Initiated', 'Onboard', 'Dead'].map((s) => <option key={s}>{s}</option>)}
              </select>
            </F>
            <F label="Pipeline value ($)"><input type="number" value={form.pipelineValue} onChange={(e) => set('pipelineValue', Number(e.target.value))} /></F>
            <F label="Introductory meeting"><input value={form.introMeeting} onChange={(e) => set('introMeeting', e.target.value)} placeholder="date / notes" /></F>
            <F label="Follow-up meeting"><input value={form.followUpMeeting} onChange={(e) => set('followUpMeeting', e.target.value)} placeholder="date / notes" /></F>
            <F label="Proposals"><input value={form.proposals} onChange={(e) => set('proposals', e.target.value)} /></F>
            <F label="Contract initiated"><input value={form.contractInitiated} onChange={(e) => set('contractInitiated', e.target.value)} /></F>
          </div>
          {p.linkedin && <p style={{ marginTop: 8 }}><a href={p.linkedin} target="_blank">Open LinkedIn profile ↗</a></p>}
        </div>

        <div className="section">
          <h3>Follow-up schedule</h3>
          <div className="row">
            <F label="Active">
              <select value={form.followUp.active ? 'yes' : 'no'} onChange={(e) => set('followUp', { ...form.followUp, active: e.target.value === 'yes' })}>
                <option value="yes">On</option><option value="no">Paused</option>
              </select>
            </F>
            <F label="Channel">
              <select value={form.followUp.channel} onChange={(e) => set('followUp', { ...form.followUp, channel: e.target.value })}>
                <option value="email">Email</option><option value="linkedin">LinkedIn</option>
              </select>
            </F>
            <F label="Every (days)">
              <input type="number" min={1} style={{ width: 90 }} value={form.followUp.frequencyDays}
                onChange={(e) => set('followUp', { ...form.followUp, frequencyDays: Number(e.target.value) || 7 })} />
            </F>
            <F label="Last contacted">
              <input readOnly value={p.followUp.lastContacted ? new Date(p.followUp.lastContacted).toLocaleDateString() : 'never'} style={{ width: 120 }} />
            </F>
            <button className="btn small" style={{ marginTop: 14 }} onClick={markContacted}>✓ Mark contacted now</button>
          </div>
        </div>

        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn primary" onClick={save} disabled={busy === 'save'}>{busy === 'save' ? 'Saving…' : '💾 Save changes'}</button>
          <div className="spacer" />
          <button className="btn danger" onClick={remove}>Delete</button>
        </div>

        <div className="section">
          <h3>✨ AI outreach</h3>
          {!aiReady && <p className="sub">Add an API key in Settings to enable drafting.</p>}
          <div className="row">
            <select value={draftType} onChange={(e) => setDraftType(e.target.value)}>
              <option value="cold">Cold pitch</option>
              <option value="followup">Follow-up</option>
              <option value="reply">Respond to their reply</option>
            </select>
            <select value={draftChannel} onChange={(e) => setDraftChannel(e.target.value)}>
              <option value="email">Email</option>
              <option value="linkedin">LinkedIn</option>
            </select>
            <button className="btn primary" onClick={generateDraft} disabled={!aiReady || busy === 'draft'}>
              {busy === 'draft' ? 'Generating…' : 'Generate draft'}
            </button>
          </div>
          {draftType === 'reply' && (
            <div className="field full" style={{ marginTop: 10 }}>
              <label>Paste their reply</label>
              <textarea rows={4} value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Paste the email/LinkedIn reply you received…" />
            </div>
          )}
          <div className="field full" style={{ marginTop: 10 }}>
            <label>Extra instructions (optional)</label>
            <input value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="e.g. mention our summer program, keep it very short…" />
          </div>
        </div>

        {p.drafts?.length > 0 && (
          <div className="section">
            <h3>Drafts ({p.drafts.length})</h3>
            {p.drafts.map((d, i) => (
              <div className="draftcard" key={i}>
                <div className="meta">
                  <span className="badge stage">{d.type}</span>
                  <span className="badge {d.channel}">{d.channel}</span>
                  {d.sent && <span className="badge yes">sent</span>}
                  <span>{new Date(d.ts).toLocaleString()}</span>
                </div>
                {d.subject && <div className="subject">{d.subject}</div>}
                <pre>{d.body}</pre>
                <div className="actions">
                  <button className="btn small" onClick={() => copyDraft(d)}>📋 Copy</button>
                  {d.channel === 'email' && p.email && !d.sent && (
                    <button className="btn small primary" onClick={() => sendEmail(d)} disabled={busy === 'send'}>
                      {busy === 'send' ? 'Sending…' : `📤 Send to ${p.email}`}
                    </button>
                  )}
                  {d.channel === 'linkedin' && p.linkedin && (
                    <a className="btn small" href={p.linkedin} target="_blank" style={{ textDecoration: 'none', display: 'inline-block' }}>Open LinkedIn ↗</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="section">
          <h3>Status log</h3>
          <div className="row" style={{ marginBottom: 12 }}>
            <input style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: '8px 10px' }}
              value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a status note…"
              onKeyDown={(e) => e.key === 'Enter' && addNote()} />
            <button className="btn" onClick={addNote}>Add</button>
          </div>
          <div className="log">
            {[...(p.statusLog || [])].reverse().map((s, i) => (
              <div className="entry" key={i}>
                <div className="date">{s.date || '—'}</div>
                <div>{s.note}</div>
              </div>
            ))}
            {(!p.statusLog || p.statusLog.length === 0) && <div className="sub">No history yet.</div>}
          </div>
        </div>
      </div>
    </>
  );
}
