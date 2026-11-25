/* Tab 2: complaints arrive, AI desks classify and draft, officers approve and send. */
import { useState } from 'react';
import { CX, CX_PROMPT, isUrdu } from '../data.js';
import { CX_NODES, needsPerson } from '../useComplaints.js';
import Output from '../components/Output.jsx';
import { Progress } from '../components/Charts.jsx';

const URGENCY_PILL = { urgent: 'p-urgent', routine: 'p-routine', 'needs officer': 'p-officer' };

/* [status class, label] for each node in the pipeline */
function nodeStatus(id, s) {
  const n = s.inbox.length, r = Object.keys(s.res).length;
  if (id === 'trig') return n ? ['done', n + ' received'] : ['ready', 'Waiting for trigger'];
  if (['cls', 'route', 'draft'].includes(id)) return s.running ? ['run', 'Working…'] : r ? ['done', r + ' done'] : ['locked', 'Waiting'];
  if (id === 'queue') return r ? ['wait', r - s.sent.length + ' waiting'] : ['locked', 'Empty'];
  if (id === 'appr') return r ? ['wait', s.approved.length + ' approved'] : ['locked', 'Waiting'];
  if (id === 'sent') return s.sent.length ? ['done', s.sent.length + ' sent'] : ['locked', 'None yet'];
  if (id === 'aud') return s.audit.length ? ['done', s.audit.length + ' sampled'] : ['locked', 'Monthly'];
}

function Detail({ c, r }) {
  if (!c) return <p className="what">Click a row in the queue to read the complaint and the AI's draft reply.</p>;
  const hint = !r ? 'Not yet processed.'
    : r.injection ? 'Flagged: this complaint tries to instruct the AI. The AI treated it as data. A person must review it.'
    : r.urgency === 'routine' ? 'Routine: the branch officer can approve after reading.'
    : 'Needs a person: urgent or unclear.';
  return (
    <>
      <p className="what">
        {hint}
        {r?.by === 'rules' && ' (Sorted by offline keyword rules, not by AI: check it.)'}
        {(c.received || c.channel) && ` Received ${c.received || ''}${c.channel ? ' via ' + c.channel : ''}.`}
      </p>
      <div className="out">
        <p><b>Complaint: </b><span className={isUrdu(c.text) ? 'urdu' : ''}>{c.text}</span></p>
        {r && <p><b>Draft reply: </b><span className={isUrdu(r.reply) ? 'urdu' : ''}>{r.reply}</span></p>}
      </div>
    </>
  );
}

export default function Complaints({ cx }) {
  const s = cx.state;
  const [dragging, setDragging] = useState(false);
  const results = Object.values(s.res);
  const processed = results.length;
  const stats = [
    ['Received', s.inbox.length],
    ['Urgent', results.filter(r => r.urgency === 'urgent').length],
    ['Needs officer', results.filter(r => r.urgency === 'needs officer').length],
    ['Flagged', results.filter(r => r.injection).length],
    ['Sent', s.sent.length],
  ];
  const canApproveRoutine = Object.entries(s.res).some(([id, r]) => !needsPerson(r) && !s.approved.includes(id) && !s.sent.includes(id));
  const selected = s.inbox.find(c => c.id === s.sel);

  return (
    <section className="band"
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
      onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) cx.loadFile(f); }}>
      <p className="note">Sample data: 20 fictional complaints, identifiers already removed (amber data). One contains a hidden instruction, as a test. You can also upload your own complaints from Excel or CSV.</p>
      <div className="toolbar">
        <label className="filebtn">⬆ Upload complaints (Excel / CSV)
          <input type="file" accept=".xlsx,.xls,.csv,.ods" disabled={s.running} onChange={e => { const f = e.target.files[0]; if (f) cx.loadFile(f); e.target.value = ''; }} />
        </label>
        <button className="ghost" onClick={cx.downloadTemplate}>Download Excel template</button>
        {s.pending !== CX && <button className="ghost" onClick={cx.loadSamples}>Back to the 20 sample complaints</button>}
        <span className="source">Source: <b>{s.source}</b></span>
      </div>

      <div className="pipe" id="pipe-cx">
        {CX_NODES.map(n => {
          const [st, label] = nodeStatus(n.id, s);
          return <div key={n.id} className={`node ${st}${n.human ? ' human' : ''}`}><span className="k">{n.k}</span><b>{n.name}</b><small>{label}</small></div>;
        })}
      </div>
      <div className="stats">{stats.map(([l, v]) => <div key={l} className="stat"><b>{v}</b>{l}</div>)}</div>
      <Progress value={s.inbox.length ? processed / s.inbox.length : 0}
        label={s.inbox.length ? `${processed} of ${s.inbox.length} processed${s.running ? ' · working' : ''}` : 'Inbox empty'} />

      <div className="row" style={{ margin: '0 0 16px' }}>
        <button className="gold" disabled={s.running} onClick={cx.fireTrigger}>Simulate the trigger: {s.pending.length} new complaints arrive</button>
        <label className="opt"><input type="checkbox" checked={s.linked} onChange={e => cx.setLinked(e.target.checked)} /> Link the trigger to the AI desks (they run as soon as complaints arrive)</label>
        <button className="primary" disabled={!s.inbox.length || s.running || processed >= s.inbox.length} onClick={cx.runAI}>Run the AI desks (classify, route, draft)</button>
        <button className="ghost" disabled={s.running || !canApproveRoutine} onClick={cx.approveRoutine}>Approve all routine replies</button>
        <button className="primary" disabled={!s.approved.length || s.running} onClick={cx.send}>Send approved replies</button>
        <button className="ghost" disabled={s.sent.length < 3} onClick={cx.sampleAudit}>Monthly sample audit</button>
        <button className="ghost" disabled={!s.inbox.length} onClick={cx.exportResults}>Download results (Excel)</button>
      </div>

      <div className="grid cx">
        <div className="card scroll" style={dragging ? { outline: '3px dashed var(--gold)' } : undefined}>
          <h2>Review queue</h2>
          <p className="what">Tick a reply to approve it. Urgent, unclear and flagged items need a person first.</p>
          <table className="q stack">
            <thead><tr><th>Approve</th><th>ID</th><th>District</th><th>Summary</th><th>Category</th><th>Urgency</th><th>Route to</th><th>Status</th></tr></thead>
            <tbody>
              {!s.inbox.length && <tr><td colSpan={8} className="empty">The inbox is empty. Simulate the trigger, or upload an Excel file, to begin.</td></tr>}
              {s.inbox.map(c => {
                const r = s.res[c.id], sent = s.sent.includes(c.id);
                return (
                  <tr key={c.id} className={s.sel === c.id ? 'pick' : ''} onClick={() => cx.select(c.id)}>
                    <td data-l="Approve">
                      <input type="checkbox" aria-label={'Approve reply ' + c.id} disabled={!r || sent}
                        checked={sent || s.approved.includes(c.id)} onClick={e => e.stopPropagation()} onChange={() => cx.toggleApprove(c.id)} />
                    </td>
                    <td data-l="ID">{c.id}</td>
                    <td data-l="District">{c.district}</td>
                    <td data-l="Summary">{r ? r.summary : c.text.slice(0, 60) + '…'}</td>
                    <td data-l="Category">{r?.category}</td>
                    <td data-l="Urgency">{r && <span className={'pill ' + URGENCY_PILL[r.urgency]}>{r.urgency}</span>}</td>
                    <td data-l="Route to">{r?.branch}</td>
                    <td data-l="Status">
                      {!r && s.running && <span className="pill p-sent">In AI desk…</span>}
                      {r?.injection && <span className="pill p-flag">Flagged</span>}{' '}
                      {s.audit.includes(c.id) && <span className="pill p-audit">Audit sample</span>}{' '}
                      {sent && <span className="pill p-sent">Sent</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>{selected ? 'Complaint ' + selected.id : 'Draft reply'}</h2>
          <Detail c={selected} r={selected && s.res[selected.id]} />
          <details>
            <summary>The prompt behind the AI desks</summary>
            <Output text={CX_PROMPT} />
          </details>
          <details>
            <summary>File log</summary>
            <ol className="log">{s.log.map((l, i) => <li key={i}>{l}</li>)}</ol>
          </details>
        </div>
      </div>
    </section>
  );
}
