'use client';
import { useEffect, useState } from 'react';

const F = ({ label, children }) => (
  <div className="field">
    <label>{label}</label>
    {children}
  </div>
);

// One draft: inline-editable, sendable (with attachments), and revisable via an AI instruction box.
function DraftCard({ d, prospect: p, signature, flash, onChanged }) {
  const [subject, setSubject] = useState(d.subject);
  const [body, setBody] = useState(d.body);
  const [instruction, setInstruction] = useState('');
  const [files, setFiles] = useState([]); // [{filename, contentBase64, size}]
  const [busy, setBusy] = useState('');
  useEffect(() => { setSubject(d.subject); setBody(d.body); }, [d.subject, d.body]);
  const dirty = subject !== d.subject || body !== d.body;

  async function addFiles(e) {
    const picked = [...(e.target.files || [])];
    e.target.value = '';
    const next = [...files];
    for (const f of picked) {
      const buf = new Uint8Array(await f.arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      next.push({ filename: f.name, contentBase64: btoa(bin), size: f.size });
    }
    const total = next.reduce((s, f) => s + f.size, 0);
    if (total > 3 * 1024 * 1024) return flash('err', 'Attachments too large — keep the total under 3 MB.');
    setFiles(next);
  }

  async function saveEdits() {
    setBusy('save');
    const drafts = p.drafts.map((x) => (x.ts === d.ts ? { ...x, subject, body, edited: true } : x));
    const r = await fetch(`/api/prospects/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drafts }),
    }).then((r) => r.json());
    setBusy('');
    if (r.error) return flash('err', r.error);
    flash('ok', 'Draft edits saved.');
    onChanged();
  }

  async function revise() {
    if (!instruction.trim()) return;
    setBusy('revise');
    const r = await fetch('/api/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prospectId: p.id,
        type: 'revise',
        draftTs: d.ts,
        instructions: instruction.trim(),
        currentSubject: subject,
        currentBody: body,
      }),
    }).then((r) => r.json());
    setBusy('');
    if (r.error) return flash('err', r.error);
    setInstruction('');
    flash('ok', 'Draft revised by AI.');
    onChanged();
  }

  async function send() {
    const attachNote = files.length ? `\nAttachments: ${files.map((f) => f.filename).join(', ')}` : '';
    if (!confirm(`Send this email to ${p.contactPerson || p.organization} <${p.email}>?\n\nSubject: ${subject}${attachNote}`)) return;
    setBusy('send');
    const r = await fetch('/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prospectId: p.id, subject, body, draftTs: d.ts, attachments: files.map(({ filename, contentBase64 }) => ({ filename, contentBase64 })) }),
    }).then((r) => r.json());
    setBusy('');
    if (r.error) return flash('err', r.error);
    setFiles([]);
    flash('ok', `Email sent to ${p.email}.`);
    onChanged();
  }

  function copy() {
    navigator.clipboard.writeText(subject ? `Subject: ${subject}\n\n${body}` : body);
    flash('ok', 'Copied to clipboard.');
  }

  return (
    <div className="draftcard">
      <div className="meta">
        <span className="badge stage">{d.type}</span>
        <span className="badge no">{d.channel}</span>
        {d.sent && <span className="badge yes">sent</span>}
        {d.revised && !d.sent && <span className="badge pending">revised</span>}
        {dirty && <span className="badge pending">unsaved edits</span>}
        <span>{new Date(d.ts).toLocaleString()}</span>
      </div>
      {d.channel === 'email' && (
        <div className="field full" style={{ marginBottom: 8 }}>
          <label>Subject</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={d.sent} />
        </div>
      )}
      <div className="field full">
        <label>Message</label>
        <textarea rows={Math.min(14, Math.max(5, body.split('\n').length + 1))} value={body} onChange={(e) => setBody(e.target.value)} disabled={d.sent} />
      </div>
      {!d.sent && (
        <div className="row" style={{ marginTop: 8 }}>
          <input
            style={{ flex: 1, background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder='Ask AI to revise… e.g. "shorter and mention our summer program"'
            onKeyDown={(e) => e.key === 'Enter' && revise()}
          />
          <button className="btn small" onClick={revise} disabled={busy === 'revise' || !instruction.trim()}>
            {busy === 'revise' ? 'Revising…' : '✨ Revise'}
          </button>
        </div>
      )}
      {!d.sent && d.channel === 'email' && (
        <div className="row" style={{ marginTop: 8 }}>
          <label className="btn small" style={{ cursor: 'pointer' }}>
            📎 Attach files
            <input type="file" multiple style={{ display: 'none' }} onChange={addFiles} />
          </label>
          {files.map((f, i) => (
            <span key={i} className="badge no">
              {f.filename} ({Math.round(f.size / 1024)} KB){' '}
              <a style={{ cursor: 'pointer', color: 'var(--red)' }} onClick={() => setFiles(files.filter((_, j) => j !== i))}>✕</a>
            </span>
          ))}
          {signature && <span className="sub">signature added on send</span>}
        </div>
      )}
      {d.sent && d.attachmentNames?.length > 0 && (
        <div className="sub" style={{ marginTop: 6 }}>📎 Sent with: {d.attachmentNames.join(', ')}</div>
      )}
      <div className="actions">
        {dirty && !d.sent && (
          <button className="btn small primary" onClick={saveEdits} disabled={busy === 'save'}>
            {busy === 'save' ? 'Saving…' : '💾 Save edits'}
          </button>
        )}
        <button className="btn small" onClick={copy}>📋 Copy</button>
        {d.channel === 'email' && p.email && !d.sent && (
          <button className="btn small primary" onClick={send} disabled={busy === 'send'}>
            {busy === 'send' ? 'Sending…' : `📤 Send to ${p.email}`}
          </button>
        )}
        {d.channel === 'linkedin' && p.linkedin && (
          <a className="btn small" href={p.linkedin} target="_blank" style={{ textDecoration: 'none', display: 'inline-block' }}>Open LinkedIn ↗</a>
        )}
      </div>
    </div>
  );
}

// A status-log line; clickable when it can be linked to a sent email (or any draft).
function LogEntry({ s, drafts }) {
  const [open, setOpen] = useState(false);
  const linked =
    (s.draftTs && drafts.find((d) => d.ts === s.draftTs)) ||
    (/email sent|auto-sent/i.test(s.note) ? drafts.find((d) => d.sent && d.subject && s.note.includes(`"${d.subject}"`)) : null);

  return (
    <div className="entry">
      <div className="date">{s.date || '—'}</div>
      <div
        onClick={() => linked && setOpen(!open)}
        style={linked ? { cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'var(--border)', textUnderlineOffset: 3 } : undefined}
        title={linked ? 'Click to view the email' : undefined}
      >
        {s.note} {linked && <span className="sub">{open ? '▾' : '▸ view email'}</span>}
      </div>
      {open && linked && (
        <div className="draftcard" style={{ marginTop: 6 }}>
          {linked.subject && <div className="subject">{linked.subject}</div>}
          <pre>{linked.body}</pre>
          {linked.attachmentNames?.length > 0 && <div className="sub" style={{ marginTop: 6 }}>📎 {linked.attachmentNames.join(', ')}</div>}
        </div>
      )}
    </div>
  );
}

export default function ProspectDrawer({ prospect: p, aiReady, settings, onClose, onChanged, flash }) {
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

  async function markContacted() {
    await patch({ followUp: { lastContacted: new Date().toISOString() }, addStatusNote: `Contacted via ${p.followUp?.channel || 'email'} (marked manually)` });
    flash('ok', 'Marked as contacted — follow-up timer reset.');
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
            <p className="sub" style={{ marginBottom: 10 }}>Edit the text directly, or type an instruction and hit ✨ Revise to have the AI rewrite it. Nothing is sent until you click Send.</p>
            {p.drafts.map((d) => (
              <DraftCard key={d.ts} d={d} prospect={p} signature={settings?.emailSignature} flash={flash} onChanged={onChanged} />
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
              <LogEntry key={i} s={s} drafts={p.drafts || []} />
            ))}
            {(!p.statusLog || p.statusLog.length === 0) && <div className="sub">No history yet.</div>}
          </div>
        </div>
      </div>
    </>
  );
}
