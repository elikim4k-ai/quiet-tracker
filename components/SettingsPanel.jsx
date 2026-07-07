'use client';
import { useEffect, useState } from 'react';
import { PROVIDERS } from '@/lib/providers';

export default function SettingsPanel({ settings, onSaved }) {
  const [form, setForm] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
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

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      // Send the current form values so unsaved keys/models are tested too.
      // Send current form values (all provider fields) so unsaved keys/models are tested too.
      const fields = { aiProvider: form.aiProvider };
      for (const p of Object.values(PROVIDERS)) {
        fields[p.keyField] = form[p.keyField];
        fields[p.modelField] = form[p.modelField];
        if (p.urlField) fields[p.urlField] = form[p.urlField];
      }
      const r = await fetch('/api/test-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      }).then((r) => r.json());
      setTestResult(r);
    } catch (e) {
      setTestResult({ ok: false, error: e.message });
    }
    setTesting(false);
  }

  return (
    <div style={{ maxWidth: 780 }}>
      <div className="card">
        <h3>🤖 AI provider</h3>
        <p className="hint">Pick a provider and paste the matching API key. Keys are stored in the tracker database and only sent to the provider you choose. Use "Custom" for any other OpenAI-compatible API.</p>
        <div className="fieldgrid">
          <div className="field">
            <label>Provider</label>
            <select value={form.aiProvider} onChange={(e) => set('aiProvider', e.target.value)}>
              {Object.entries(PROVIDERS).map(([id, p]) => (
                <option key={id} value={id}>{p.label}</option>
              ))}
            </select>
          </div>
          {(() => {
            const p = PROVIDERS[form.aiProvider] || PROVIDERS.openai;
            return (
              <>
                <div className="field">
                  <label>{p.label} model</label>
                  <input value={form[p.modelField] || ''} onChange={(e) => set(p.modelField, e.target.value)} placeholder={p.defaultModel || 'model name'} />
                </div>
                {p.urlField && (
                  <div className="field full">
                    <label>Base URL</label>
                    <input value={form[p.urlField] || ''} onChange={(e) => set(p.urlField, e.target.value)} placeholder="https://api.example.com/v1" />
                  </div>
                )}
                <div className="field full">
                  <label>{p.label} API key</label>
                  <input type="password" value={form[p.keyField] || ''} onChange={(e) => set(p.keyField, e.target.value)} placeholder={p.placeholder} />
                </div>
              </>
            );
          })()}
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={testConnection} disabled={testing}>
            {testing ? 'Testing…' : '🔌 Test connection'}
          </button>
          {testResult && (
            <span className={`notice ${testResult.ok ? 'ok' : 'err'}`} style={{ margin: 0, flex: 1 }}>
              {testResult.ok
                ? `✓ Working — ${testResult.provider} / ${testResult.model} replied "${testResult.reply}" in ${testResult.ms} ms`
                : `✗ Failed (${testResult.provider} / ${testResult.model}): ${testResult.error}`}
            </span>
          )}
        </div>
      </div>

      <div className="card">
        <h3>✍️ Sender identity</h3>
        <div className="fieldgrid">
          <div className="field"><label>Your name</label><input value={form.senderName} onChange={(e) => set('senderName', e.target.value)} /></div>
          <div className="field"><label>Your title at WISER</label><input value={form.senderTitle} onChange={(e) => set('senderTitle', e.target.value)} placeholder="e.g. Partnerships Lead" /></div>
          <div className="field full"><label>Your email</label><input value={form.senderEmail} onChange={(e) => set('senderEmail', e.target.value)} /></div>
          <div className="field full">
            <label>Email signature — plain text (appended to every outgoing email)</label>
            <textarea rows={5} value={form.emailSignature || ''} onChange={(e) => set('emailSignature', e.target.value)}
              placeholder={"Elijah Kim\nHead of Wiser Insider\nWISER\n…"} />
          </div>
          <div className="field full">
            <label>Email signature — HTML (optional; makes links clickable in the email)</label>
            <textarea rows={5} value={form.emailSignatureHtml || ''} onChange={(e) => set('emailSignatureHtml', e.target.value)}
              placeholder={'<p>Elijah Kim<br><a href="https://thewiser.org">thewiser.org</a></p>'} />
          </div>
        </div>
      </div>

      <div className="card">
        <h3>📊 Google Sheet sync</h3>
        <p className="hint">
          Lets the "⇪ Sync Google Sheet" button push the tracker to a shared spreadsheet.
          One-time setup: open the sheet → Extensions → Apps Script → paste the script from{' '}
          <span className="mono">scripts/google-sheet-sync.gs</span> (in the project repo) with the secret below → Deploy as Web app
          (Execute as: Me, Access: Anyone) → paste the /exec URL here.
        </p>
        <div className="fieldgrid">
          <div className="field full"><label>Web app URL</label><input value={form.sheetSyncUrl || ''} onChange={(e) => set('sheetSyncUrl', e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" /></div>
          <div className="field full"><label>Sync secret (must match SECRET in the Apps Script)</label><input value={form.sheetSyncSecret || ''} onChange={(e) => set('sheetSyncSecret', e.target.value)} /></div>
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
            <label>Weekly summary email (Friday morning NZ)</label>
            <select value={form.weeklyReport === false ? 'off' : 'on'} onChange={(e) => set('weeklyReport', e.target.value === 'on')}>
              <option value="on">On — email me every Friday</option>
              <option value="off">Off</option>
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
