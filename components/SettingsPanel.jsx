'use client';
import { useEffect, useState } from 'react';

export default function SettingsPanel({ settings, onSaved }) {
  const [form, setForm] = useState(settings);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (settings) setForm(settings); }, [settings]);
  if (!form) return <div className="empty">Loading…</div>;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setSmtp = (k, v) => setForm((f) => ({ ...f, smtp: { ...f.smtp, [k]: v } }));

  async function save() {
    setBusy(true);
    const r = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }).then((r) => r.json());
    setBusy(false);
    onSaved(r.settings);
  }

  return (
    <div style={{ maxWidth: 780 }}>
      <div className="card">
        <h3>🤖 AI provider</h3>
        <p className="hint">Pick OpenAI or Gemini and paste the matching API key. The key stays in a local file on this computer (data/db.json) and is only sent to the provider you choose.</p>
        <div className="fieldgrid">
          <div className="field">
            <label>Provider</label>
            <select value={form.aiProvider} onChange={(e) => set('aiProvider', e.target.value)}>
              <option value="openai">OpenAI</option>
              <option value="gemini">Google Gemini</option>
            </select>
          </div>
          {form.aiProvider === 'openai' ? (
            <>
              <div className="field"><label>OpenAI model</label><input value={form.openaiModel} onChange={(e) => set('openaiModel', e.target.value)} placeholder="gpt-4o-mini" /></div>
              <div className="field full"><label>OpenAI API key</label><input type="password" value={form.openaiApiKey} onChange={(e) => set('openaiApiKey', e.target.value)} placeholder="sk-…" /></div>
            </>
          ) : (
            <>
              <div className="field"><label>Gemini model</label><input value={form.geminiModel} onChange={(e) => set('geminiModel', e.target.value)} placeholder="gemini-2.0-flash" /></div>
              <div className="field full"><label>Gemini API key</label><input type="password" value={form.geminiApiKey} onChange={(e) => set('geminiApiKey', e.target.value)} placeholder="AIza…" /></div>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <h3>✍️ Sender identity</h3>
        <div className="fieldgrid">
          <div className="field"><label>Your name</label><input value={form.senderName} onChange={(e) => set('senderName', e.target.value)} /></div>
          <div className="field"><label>Your title at WISER</label><input value={form.senderTitle} onChange={(e) => set('senderTitle', e.target.value)} placeholder="e.g. Partnerships Lead" /></div>
          <div className="field full"><label>Your email</label><input value={form.senderEmail} onChange={(e) => set('senderEmail', e.target.value)} /></div>
        </div>
      </div>

      <div className="card">
        <h3>🏛 WISER profile (used in every pitch)</h3>
        <p className="hint">This is what the AI knows about WISER and the Insider Program offer. Edit freely — it was pre-filled from thewiser.org.</p>
        <div className="field full">
          <textarea rows={10} value={form.orgProfile} onChange={(e) => set('orgProfile', e.target.value)} />
        </div>
      </div>

      <div className="card">
        <h3>📤 Email sending (SMTP — optional)</h3>
        <p className="hint">
          Needed only to send emails directly from the dashboard; drafts and copy-to-clipboard work without it.
          For Gmail: host <span className="mono">smtp.gmail.com</span>, port <span className="mono">587</span>, and an{' '}
          <a href="https://myaccount.google.com/apppasswords" target="_blank">App Password</a> (not your normal password).
        </p>
        <div className="fieldgrid">
          <div className="field"><label>SMTP host</label><input value={form.smtp.host} onChange={(e) => setSmtp('host', e.target.value)} placeholder="smtp.gmail.com" /></div>
          <div className="field"><label>Port</label><input type="number" value={form.smtp.port} onChange={(e) => setSmtp('port', Number(e.target.value))} /></div>
          <div className="field"><label>Username</label><input value={form.smtp.user} onChange={(e) => setSmtp('user', e.target.value)} placeholder="you@thewiser.org" /></div>
          <div className="field"><label>Password / App password</label><input type="password" value={form.smtp.pass} onChange={(e) => setSmtp('pass', e.target.value)} /></div>
          <div className="field full"><label>From address (optional)</label><input value={form.smtp.from} onChange={(e) => setSmtp('from', e.target.value)} placeholder="WISER Partnerships <you@thewiser.org>" /></div>
        </div>
      </div>

      <div className="card">
        <h3>⚙️ Automation</h3>
        <p className="hint">
          When deployed, a daily job drafts follow-ups for every prospect whose timer is up, and a weekly job discovers new companies.
          With auto-send ON (and SMTP configured), the daily job also sends the drafted follow-up emails without waiting for your review — leave it OFF if you want to approve every message. LinkedIn messages are always drafts.
        </p>
        <div className="fieldgrid">
          <div className="field">
            <label>Auto-send follow-up emails</label>
            <select value={form.autoSendEmail ? 'on' : 'off'} onChange={(e) => set('autoSendEmail', e.target.value === 'on')}>
              <option value="off">Off — I review every draft</option>
              <option value="on">On — send automatically</option>
            </select>
          </div>
          <div className="field">
            <label>Default follow-up frequency (days)</label>
            <input type="number" min={1} value={form.defaultFollowUpDays} onChange={(e) => set('defaultFollowUpDays', Number(e.target.value) || 7)} />
          </div>
          <div className="field">
            <label>Companies per discovery run</label>
            <input type="number" min={1} max={25} value={form.discoveryCount} onChange={(e) => set('discoveryCount', Number(e.target.value) || 10)} />
          </div>
        </div>
      </div>

      <button className="btn primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : '💾 Save settings'}</button>
    </div>
  );
}
