/* Tab 3: smog figures from the sample report, plus live views of tabs 1 and 2. */
import { SMOG_AQI } from '../data.js';
import { NODES, LABEL } from '../useChain.js';
import { needsPerson } from '../useComplaints.js';
import { HBars, Columns, Kpis, Legend, Empty } from '../components/Charts.jsx';

const URGENCY = [['urgent', 'Urgent', 'var(--crit)'], ['needs officer', 'Needs officer', 'var(--amber)'], ['routine', 'Routine', 'var(--good)']];
const PENDING_COLOR = 'light-dark(#B8C9CE,#3C5A62)';
const countBy = (list, key) => {
  const counts = {};
  list.forEach(x => { const k = key(x); counts[k] = (counts[k] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
};

function Card({ title, cap, wide, children }) {
  return <div className={'card ' + (wide || '')}><h3>{title}</h3><p className="cap">{cap}</p>{children}</div>;
}

function SmogSection({ chain }) {
  const s = chain.state;
  const critic = s.out.critic || '', facts = s.out.extract || '';
  const ran = s.status.critic === 'done' && !s.custom;
  /* planted problems, and whether the AI desks have caught them yet */
  const flags = [
    ['Sources disagree', 'Units sealed: 38 in the situation report, 45 in the press release.', ran && /45/.test(critic), 'p-flag'],
    ['Not in any source', 'Budget for Option B: Finance has not costed it. Any figure is invented.', ran && /budget|cost|Rs/i.test(critic), 'p-flag'],
    ['Conditional support', 'Police support night checks only with extra staff; schools need notice by Tuesday.', ran && /Police|Tuesday/i.test(critic), 'p-officer'],
    ['Data gaps', 'No data on residential waste burning; Sheikhupura vehicle checks missing.', s.status.extract === 'done' && !s.custom && /Sheikhupura|residential/i.test(facts), 'p-officer'],
  ];
  return (
    <>
      <div className="db-head">
        <div>
          <h2>Smog situation · Lahore Division, Week 46</h2>
          <p>{s.custom ? 'Figures from the sample situation report. Your uploaded documents feed the AI desks in tab 1, not these tiles.' : 'From the training situation report (Doc 1) and the press release (Doc 3). Fictional figures.'}</p>
        </div>
      </div>
      <Kpis items={[
        { lab: 'Lahore AQI', val: '312', foot: 'Hazardous · 3 Hazardous days', cls: 'alert', delta: ['⚠ Hazardous', 'bad'] },
        { lab: 'Fire detections', val: '412', foot: 'from 598 in Week 45', delta: ['▼ 31%', 'good'] },
        { lab: 'Units sealed', val: '38', unit: 'of 146', foot: 'Press release says 45', cls: 'warnk', delta: ['≠ sources', 'bad'] },
        { lab: 'Vehicles fined', val: '212', unit: 'of 1,240', foot: '17% of vehicles checked' },
        { lab: 'Respiratory OPD', val: '+27%', foot: 'vs October weekly average', cls: 'alert', delta: ['▲ visits', 'bad'] },
      ]} />
      <div className="dgrid">
        <Card title="Weekly average AQI by district" cap="Dashed lines mark the Very Unhealthy (200) and Hazardous (300) thresholds." wide="w8">
          <HBars max={350} refs={[{ v: 200, label: '200' }, { v: 300, label: '300' }]}
            rows={SMOG_AQI.map(([d, v]) => ({ label: d, value: v + (v > 300 ? ' ⚠' : ''), segs: [{ v, color: v > 300 ? 'var(--crit)' : 'var(--amber)', tip: `${d}: AQI ${v}` }] }))} />
          <Legend items={[['Hazardous (above 300) ⚠', 'var(--crit)'], ['Very Unhealthy (201–300)', 'var(--amber)']]} />
        </Card>
        <Card title="Crop-residue fire detections" cap="Week 45 against Week 46, with field follow-up." wide="w4">
          <HBars rows={[
            { label: 'Week 45', segs: [{ v: 598, tip: 'Week 45: 598 detections' }] },
            { label: 'Week 46', segs: [{ v: 388, color: 'var(--good)', tip: '388 attended by field teams' }, { v: 24, color: 'var(--amber)', tip: '24 still pending' }] },
          ]} />
          <Legend items={[['Week 45 detections', 'var(--s1)'], ['Attended', 'var(--good)'], ['Pending', 'var(--amber)']]} />
        </Card>
        <Card title="Industrial enforcement" cap="146 units inspected in Week 46.">
          <HBars rows={[
            { label: 'Inspected', segs: [{ v: 146 }] },
            { label: 'Notices issued', segs: [{ v: 61 }] },
            { label: 'Sealed', segs: [{ v: 22, color: 'var(--crit)', tip: '22 brick kilns sealed (not zig-zag)' }, { v: 16, tip: '16 other units sealed' }] },
          ]} />
          <Legend items={[['Brick kilns sealed', 'var(--crit)'], ['Other units', 'var(--s1)']]} />
        </Card>
        <Card title="Checks the AI critic must catch" cap="Planted problems in the sample documents.">
          {flags.map(([title, text, caught, cls]) => (
            <div key={title} className="flagrow">
              <span className={'pill ' + cls}>{title}</span>
              <div>{text} <span className={'pill ' + (caught ? 'p-routine' : 'p-sent')}>{caught ? '✓ Caught by the AI desks' : 'Not checked yet'}</span></div>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}

function ComplaintsSection({ cx, onLoadSamples }) {
  const s = cx.state, { inbox, res } = s, n = inbox.length;
  const done = Object.keys(res).length;
  const person = Object.entries(res).filter(([, r]) => needsPerson(r));
  const approved = s.approved.length + s.sent.length;
  const urgencySegs = list => [
    ...URGENCY.map(([k, label, color]) => ({ v: list.filter(c => res[c.id]?.urgency === k).length, color, label })),
    { v: list.filter(c => !res[c.id]).length, color: PENDING_COLOR, label: 'Not yet classified' },
  ];
  const grouped = key => [...new Set(inbox.map(key))].map(k => [k, inbox.filter(c => key(c) === k)]).sort((a, b) => b[1].length - a[1].length);
  const hours = inbox.map(c => String(c.received || '').match(/(\d{1,2}):\d{2}/)).filter(Boolean).map(m => +m[1]);
  const open = person.filter(([id]) => !s.sent.includes(id))
    .sort((a, b) => (b[1].injection - a[1].injection) || ((a[1].urgency === 'urgent' ? 0 : 1) - (b[1].urgency === 'urgent' ? 0 : 1)));

  return (
    <>
      <div className="db-head">
        <div>
          <h2>Complaints · live from the triage workflow</h2>
          <p>{n ? `Source: ${s.source}. Updates live as complaints move through tab 2.` : 'Updates as complaints arrive, are classified, approved and sent (tab 2).'}</p>
        </div>
      </div>
      <Kpis items={[
        { lab: 'Received', val: n, foot: n ? s.source : 'Inbox empty' },
        { lab: 'Processed by AI', val: (n ? Math.round((done / n) * 100) : 0) + '%', foot: `${done} of ${n} classified` },
        { lab: 'Urgent', val: Object.values(res).filter(r => r.urgency === 'urgent').length, foot: 'risk to life or health within 48 h', cls: 'alert' },
        { lab: 'Needs a person', val: person.length, foot: `${Object.values(res).filter(r => r.injection).length} flagged for hidden instructions`, cls: 'warnk' },
        { lab: 'Approved / sent', val: approved, unit: `/ ${s.sent.length} sent`, foot: s.audit.length ? `${s.audit.length} sampled by 2nd officer` : 'after human review' },
      ]} />
      {!n ? (
        <div className="card" style={{ marginBottom: 26 }}>
          <Empty>No complaints yet.<br /><button className="gold" style={{ marginTop: 10 }} onClick={onLoadSamples}>Bring in the 20 sample complaints</button></Empty>
        </div>
      ) : (
        <div className="dgrid">
          <Card title="Complaints by category" cap="Split by urgency, after the AI desks run.">
            {done ? (
              <>
                <Legend items={URGENCY.map(([, l, c]) => [l, c])} />
                <HBars rows={grouped(c => res[c.id]?.category || 'other').filter(([, list]) => list.some(c => res[c.id]))
                  .map(([k, list]) => ({ label: k, segs: urgencySegs(list.filter(c => res[c.id])).slice(0, 3).map(x => ({ ...x, tip: `${k} · ${x.label}: ${x.v}` })) }))} />
              </>
            ) : <Empty>{s.running ? 'The AI desks are working…' : 'Run the AI desks in tab 2 to see categories.'}</Empty>}
          </Card>
          <Card title="Complaints by district" cap="Split by urgency once classified; arrivals before that.">
            <Legend items={[...URGENCY.map(([, l, c]) => [l, c]), ...(done < n ? [['Not yet classified', PENDING_COLOR]] : [])]} />
            <HBars rows={grouped(c => c.district || 'Not given').slice(0, 10)
              .map(([d, list]) => ({ label: d, segs: urgencySegs(list).map(x => ({ ...x, tip: `${d} · ${x.label}: ${x.v}` })) }))} />
          </Card>
          <Card title="Arrivals by hour" cap="When complaints were received." wide="w8">
            {hours.length ? (
              <Columns items={Array.from({ length: Math.max(...hours) - Math.min(...hours) + 1 }, (_, i) => {
                const h = Math.min(...hours) + i, v = hours.filter(x => x === h).length, label = String(h).padStart(2, '0') + ':00';
                return { label, v, tip: `${label} · ${v} complaint(s)` };
              })} />
            ) : <Empty>This file has no arrival times.</Empty>}
          </Card>
          <Card title="Workflow funnel" cap="How far each complaint has moved." wide="w4">
            <HBars max={n} rows={[['Received', n], ['Classified', done], ['Approved', approved], ['Sent', s.sent.length], ['Audited', s.audit.length]]
              .map(([k, v]) => ({ label: k, segs: [{ v, tip: `${k}: ${v} of ${n}` }] }))} />
          </Card>
          <Card title="By channel" cap="How citizens reached us." wide="w4">
            <HBars rows={countBy(inbox, c => c.channel || 'Not given').slice(0, 8).map(([k, v]) => ({ label: k, segs: [{ v }] }))} />
          </Card>
          <Card title="Needs a person" cap="Urgent, unclear and flagged complaints waiting in the review queue." wide="w8">
            {!open.length && <Empty>{done ? 'Nothing waiting: every urgent, unclear or flagged reply has been handled.' : 'Appears after the AI desks run.'}</Empty>}
            {open.slice(0, 7).map(([id, r]) => (
              <div key={id} className="flagrow">
                <span className={'pill ' + (r.injection ? 'p-flag' : r.urgency === 'urgent' ? 'p-urgent' : 'p-officer')}>{r.injection ? 'Flagged' : r.urgency}</span>
                <div><b>{id}</b> · {inbox.find(c => c.id === id)?.district} · {r.summary} <span className="source">→ {r.branch}</span></div>
              </div>
            ))}
            {open.length > 7 && <p className="source">…and {open.length - 7} more in the review queue.</p>}
          </Card>
        </div>
      )}
    </>
  );
}

export default function Dashboard({ chain, cx, onLoadSamples }) {
  return (
    <section className="band">
      <SmogSection chain={chain} />
      <ComplaintsSection cx={cx} onLoadSamples={onLoadSamples} />
      <div className="db-head"><div><h2>Summary for the CM · chain progress</h2><p>Where the file is in workflow 1.</p></div></div>
      <div className="card" style={{ marginBottom: 26 }}>
        <div className="steps">
          {NODES.map(n => <div key={n.id} className={'step ' + chain.state.status[n.id]}><b>{n.name}</b><span>{LABEL[chain.state.status[n.id]]}</span></div>)}
        </div>
      </div>
    </section>
  );
}
