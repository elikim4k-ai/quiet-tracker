'use client';
import { useState } from 'react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (r.ok) window.location.href = '/';
    else setError('Wrong password — ask the tracker owner for access.');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={submit} className="card" style={{ width: 360 }}>
        <h3 style={{ marginBottom: 4 }}>Quiet Tracker</h3>
        <p className="hint">WISER Insider Program prospects — team access</p>
        <div className="field full" style={{ margin: '14px 0' }}>
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            placeholder="Shared team password"
          />
        </div>
        {error && <div className="notice err">{error}</div>}
        <button className="btn primary" type="submit" disabled={busy || !password} style={{ width: '100%' }}>
          {busy ? 'Checking…' : 'Enter'}
        </button>
      </form>
    </div>
  );
}
