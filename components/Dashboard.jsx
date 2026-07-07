'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PROVIDERS } from '@/lib/providers';
import ProspectDrawer from './ProspectDrawer';
import SettingsPanel from './SettingsPanel';

const fmtMoney = (n) => (n ? '$' + Number(n).toLocaleString() : '—');

function CategoryBadge({ c }) {
  if (c === 'Quantum') return <span className="badge quantum">Quantum</span>;
  if (c === 'AI') return <span className="badge ai">AI</span>;
  return <span className="badge uncat">?</span>;
}

function YesNo({ v }) {
  const s = String(v || '').toLowerCase();
  if (s === 'yes') return <span className="badge yes">Yes</span>;
  if (s === 'pending') return <span className="badge pending">Pending</span>;
  if (s === 'n/a') return <span className="badge no">N/A</span>;
  return <span className="badge no">No</span>;
}

export default function Dashboard() {
  const [prospects, setProspects] = useState([]);
  const [meta, setMeta] = useState({});
  const [settings, setSettings] = useState(null);
  const [tab, setTab] = useState('pipeline');
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState('');
  const fileRef = useRef(null);

  async function refresh() {
    const r = await fetch('/api/prospects').then((r) => r.json());
    setProspects(r.prospects);
    setMeta(r.meta || {});
    if (selected) setSelected(r.prospects.find((p) => p.id === selected.id) || null);
  }
  async function loadSettings() {
    const r = await fetch('/api/settings').then((r) => r.json());
    setSettings(r.settings);
  }
  useEffect(() => { refresh(); loadSettings(); }, []);

  const flash = (type, text) => { setNotice({ type, text }); setTimeout(() => setNotice(null), 6000); };

  async function uploadFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy('import');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('mode', 'merge');
    const r = await fetch('/api/import', { method: 'POST', body: fd }).then((r) => r.json());
    setBusy('');
    e.target.value = '';
    if (r.error) return flash('err', 'Import failed: ' + r.error);
    flash('ok', `Imported: ${r.added} added, ${r.updated} updated (cross-checked ${r.vardaanCount} Vardaan contacts). Total: ${r.total}`);
    refresh();
  }

  async function runDiscovery() {
    setBusy('discover');
    const r = await fetch('/api/discover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: 'both' }) }).then((r) => r.json());
    setBusy('');
    if (r.error) return flash('err', 'Discovery failed: ' + r.error);
    flash('ok', `Discovery added ${r.added} new companies.`);
    refresh();
  }

  async function runClassify() {
    setBusy('classify');
    const r = await fetch('/api/classify', { method: 'POST' }).then((r) => r.json());
    setBusy('');
    if (r.error) return flash('err', 'Classify failed: ' + r.error);
    flash('ok', r.message || `Classified ${r.classified} companies.`);
    refresh();
  }

  async function syncSheet() {
    setBusy('sheet');
    const r = await fetch('/api/export-sheet', { method: 'POST' }).then((r) => r.json());
    setBusy('');
    if (r.error) return flash('err', r.error);
    flash('ok', `Google Sheet updated — ${r.rows} prospects synced.`);
  }

  async function runFollowUpEngine() {
    setBusy('engine');
    const r = await fetch('/api/followups', { method: 'POST' }).then((r) => r.json());
    setBusy('');
    if (r.error) return flash('err', 'Engine failed: ' + r.error);
    const failed = (r.results || []).filter((x) => !x.ok);
    flash(failed.length ? 'warn' : 'ok', `Drafted ${r.drafted} follow-up message(s).${failed.length ? ` ${failed.length} failed: ${failed[0].error}` : ' Review them in each company’s panel.'}`);
    refresh();
  }

  const due = useMemo(() => prospects.filter((p) => p.dueInDays !== null && p.dueInDays <= 0), [prospects]);
  const totalPipeline = useMemo(() => prospects.reduce((s, p) => s + (Number(p.pipelineValue) || 0), 0), [prospects]);

  const filtered = useMemo(() => {
    let list = prospects;
    if (tab === 'followups') list = due;
    if (catFilter !== 'all') list = list.filter((p) => (p.category || '?') === catFilter);
    if (stageFilter !== 'all') list = list.filter((p) => p.stage === stageFilter);
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((p) => [p.organization, p.contactPerson, p.product, p.location, p.email].join(' ').toLowerCase().includes(q));
    }
    return list;
  }, [prospects, due, tab, catFilter, stageFilter, query]);

  const stages = [...new Set(prospects.map((p) => p.stage))];
  const discoveryStale = !meta.lastDiscoveryRun || Date.now() - new Date(meta.lastDiscoveryRun).getTime() > 7 * 86400000;
  const activeProvider = settings && (PROVIDERS[settings.aiProvider] || PROVIDERS.openai);
  const aiReady = Boolean(settings && activeProvider && settings[activeProvider.keyField]);

  return (
    <div className="container">
      <header className="topbar">
        <div className="brand">
          <h1>Quiet Tracker</h1>
          <span>WISER Insider Program prospects</span>
        </div>
        <div className="row">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={uploadFile} />
          <button className="btn" onClick={() => fileRef.current.click()} disabled={busy === 'import'}>
            {busy === 'import' ? 'Importing…' : '⬆ Import Excel'}
          </button>
          <button className="btn" onClick={syncSheet} disabled={busy === 'sheet'}
            title={settings?.sheetSyncUrl ? 'Rewrite the shared Google Sheet with current tracker data' : 'Set up the sync URL in Settings first'}>
            {busy === 'sheet' ? 'Syncing…' : '⇪ Sync Google Sheet'}
          </button>
          <button className="btn primary" onClick={runFollowUpEngine} disabled={busy === 'engine' || !aiReady} title={aiReady ? '' : 'Add an API key in Settings first'}>
            {busy === 'engine' ? 'Drafting…' : `✨ Draft due follow-ups (${due.length})`}
          </button>
        </div>
      </header>

      {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}
      {settings && !aiReady && (
        <div className="notice warn">
          No API key for {activeProvider?.label || 'the selected AI provider'} — add one in the <a onClick={() => setTab('settings')} style={{ cursor: 'pointer' }}>Settings</a> tab to enable drafting, discovery, and classification.
        </div>
      )}
      {discoveryStale && aiReady && (
        <div className="notice warn">
          Weekly discovery hasn’t run in the last 7 days.{' '}
          <a onClick={runDiscovery} style={{ cursor: 'pointer' }}>{busy === 'discover' ? 'Discovering…' : 'Run it now →'}</a>
        </div>
      )}

      <div className="stats">
        <div className="stat"><div className="label">Prospects</div><div className="value">{prospects.length}</div></div>
        <div className="stat"><div className="label">Quantum</div><div className="value" style={{ color: 'var(--quantum)' }}>{prospects.filter((p) => p.category === 'Quantum').length}</div></div>
        <div className="stat"><div className="label">AI</div><div className="value" style={{ color: 'var(--ai)' }}>{prospects.filter((p) => p.category === 'AI').length}</div></div>
        <div className="stat"><div className="label">Follow-ups due</div><div className="value" style={{ color: due.length ? 'var(--red)' : 'var(--green)' }}>{due.length}</div></div>
        <div className="stat"><div className="label">Intro meetings</div><div className="value">{prospects.filter((p) => ['Intro Meeting', 'Follow-up Meeting', 'Proposal', 'Contract Initiated', 'Onboard'].includes(p.stage)).length}</div></div>
        <div className="stat"><div className="label">Pipeline value</div><div className="value small">{fmtMoney(totalPipeline)}</div></div>
      </div>

      <div className="tabs">
        <button className={tab === 'pipeline' ? 'active' : ''} onClick={() => setTab('pipeline')}>Pipeline</button>
        <button className={tab === 'followups' ? 'active' : ''} onClick={() => setTab('followups')}>
          Follow-ups{due.length > 0 && <span className="pill">{due.length}</span>}
        </button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>Settings</button>
      </div>

      {tab === 'settings' ? (
        <SettingsPanel settings={settings} onSaved={(s) => { setSettings(s); flash('ok', 'Settings saved.'); }} />
      ) : (
        <>
          <div className="toolbar">
            <input type="text" placeholder="Search organization, contact, product…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
              <option value="all">All categories</option>
              <option value="Quantum">Quantum</option>
              <option value="AI">AI</option>
              <option value="?">Uncategorized</option>
            </select>
            <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
              <option value="all">All stages</option>
              {stages.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="spacer" />
            <button className="btn" onClick={runClassify} disabled={busy === 'classify' || !aiReady}>
              {busy === 'classify' ? 'Classifying…' : '🏷 AI classify'}
            </button>
            <button className="btn" onClick={runDiscovery} disabled={busy === 'discover' || !aiReady}>
              {busy === 'discover' ? 'Discovering…' : '🔭 Discover companies'}
            </button>
            <button className="btn" onClick={async () => {
              const name = prompt('Organization name:');
              if (!name) return;
              await fetch('/api/prospects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ organization: name }) });
              refresh();
            }}>+ Add</button>
          </div>

          {filtered.length === 0 ? (
            <div className="empty">
              {prospects.length === 0
                ? 'No prospects yet. Import your tracker Excel file to get started.'
                : tab === 'followups' ? 'Nothing due — you’re all caught up. 🎉' : 'No matches for this filter.'}
            </div>
          ) : (
            <table className="grid">
              <thead>
                <tr>
                  <th>Organization</th><th>Cat.</th><th>Location</th><th>Product</th><th>Contact</th>
                  <th>LinkedIn</th><th>WISER conn.</th><th>Stage</th><th>Next follow-up</th><th>Pipeline</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} onClick={() => setSelected(p)}>
                    <td><div className="orgname">{p.organization}</div>{p.source === 'discovery' && <div className="sub">via discovery</div>}</td>
                    <td><CategoryBadge c={p.category} /></td>
                    <td>{p.location || <span className="sub">—</span>}</td>
                    <td>{p.product || <span className="sub">—</span>}</td>
                    <td>
                      {p.contactPerson || <span className="sub">—</span>}
                      {p.title && <div className="sub">{p.title}</div>}
                    </td>
                    <td><YesNo v={p.linkedinConnected} /></td>
                    <td><YesNo v={p.wiserConnection} /></td>
                    <td><span className="badge stage">{p.stage}</span></td>
                    <td>
                      {p.dueInDays === null ? <span className="sub">paused</span>
                        : p.dueInDays <= 0 ? <span className="badge due">Due now</span>
                        : <span className="sub">in {p.dueInDays}d</span>}
                      <div className="sub">{p.followUp?.channel}</div>
                    </td>
                    <td>{fmtMoney(p.pipelineValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {selected && (
        <ProspectDrawer
          prospect={selected}
          aiReady={aiReady}
          settings={settings}
          onClose={() => setSelected(null)}
          onChanged={refresh}
          flash={flash}
        />
      )}
    </div>
  );
}
