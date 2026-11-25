/* Tab 3: an agent. You give a goal, tools and limits; it chooses its own steps, then stops for the Secretary.
   Compare with tabs 1 and 2, where the steps are fixed in advance (the agent brief, slide 12). */
import { Fragment, useEffect, useRef, useState } from 'react';
import { AG_TOOLS, ALWAYS_ON, BLOCKED_TOOLS, ESCALATE_WHEN } from '../agentData.js';
import Output from '../components/Output.jsx';

const LOOP = [
  ['goal', 'Goal', '→'], ['think', 'Think', '→'], ['act', 'Act: use a tool', '→'], ['observe', 'Observe the result', '↺'],
  ['escalate', 'Stop and escalate', '→', true], ['secretary', 'Secretary decides', '', true],
];

function TraceItem({ t }) {
  return (
    <li className={t.kind}>
      <span className="tag">{t.tag}</span>
      {t.kind === 'tool'
        ? <><code className="tn">{t.name}</code><code> {JSON.stringify(t.input).slice(0, 160)}</code></>
        : t.text}
      {t.result != null && <details><summary>Result</summary><pre>{t.result}</pre></details>}
    </li>
  );
}

export default function Agent({ agent }) {
  const s = agent.state;
  const [note, setNote] = useState('');
  const traceRef = useRef(null);
  const noteRef = useRef(null);
  useEffect(() => { const t = traceRef.current; if (t) t.scrollTop = t.scrollHeight; }, [s.trace.length]);

  const toolsUsed = new Set(s.trace.filter(t => t.kind === 'tool').map(t => t.name)).size;
  const status = s.signed ? 'Signed' : s.escalated && !s.running ? 'With the Secretary' : s.running ? 'Working' : 'Idle';
  const finished = s.escalated && !s.running;

  const sendBack = () => {
    if (!note.trim()) { noteRef.current?.focus(); return; }
    agent.sendBack(note.trim());
  };

  return (
    <section className="band">
      <p className="note">Sample data: a fictional Assembly question, the same three training documents, the 20 sample complaints, and a fictional archive of past replies. Wing replies are simulated.</p>
      <div className="contrast">
        <div><b>Workflow (tabs 1 and 2)</b><span>You fixed the steps in advance. The AI follows them in order.</span></div>
        <div className="on"><b>Agent (this tab)</b><span>You give a goal, tools and limits. The AI chooses its own steps, then stops for a person.</span></div>
      </div>
      <div className="loop" aria-label="Agent loop">
        {LOOP.map(([id, label, arrow, human]) => (
          <Fragment key={id}>
            <span className={(human ? 'hum ' : '') + (s.phase === id ? 'cur' : '')}>{label}</span>
            {arrow && <i aria-hidden="true">{arrow}</i>}
          </Fragment>
        ))}
      </div>

      <div className="grid ag">
        <div className="card">
          <h2>Agent brief</h2>
          <p className="what">The agent brief from slide 12: a goal, tools, limits and when to stop. Change it before you run.</p>
          <label className="lbl" htmlFor="ag-goal">Goal: the Assembly question (fictional)</label>
          <textarea id="ag-goal" style={{ minHeight: 150 }} value={s.goal} disabled={s.running} onChange={e => agent.setGoal(e.target.value)} />

          <p className="lbl">Tools the agent may use</p>
          {AG_TOOLS.map(t => (
            <label key={t.name} className="toolrow">
              <input type="checkbox" checked={s.allowed.includes(t.name)} disabled={t.name === ALWAYS_ON || s.running} onChange={() => agent.toggleTool(t.name)} />
              <div>
                <b>{t.name}</b>
                <span>{t.description}{t.name === ALWAYS_ON && ' (always on: the agent must be able to stop)'}</span>
              </div>
            </label>
          ))}

          <p className="lbl">Tools it can never use</p>
          <ul className="blocked">{BLOCKED_TOOLS.map(([name, why]) => <li key={name}><b>{name}</b>: {why}</li>)}</ul>

          <label className="lbl" htmlFor="ag-max">Step limit (tool calls)</label>
          <select id="ag-max" className="agselect" value={s.max} disabled={s.running} onChange={e => agent.setMax(+e.target.value)}>
            <option value={6}>6: too tight, see what happens</option>
            <option value={12}>12</option>
            <option value={20}>20</option>
          </select>

          <p className="lbl">Stop and escalate when</p>
          <ul className="rules">{ESCALATE_WHEN.map(r => <li key={r}>{r}</li>)}</ul>
          <div className="row">
            <button className="gold" disabled={s.running} onClick={agent.run}>Run the agent</button>
            <button className="ghost" disabled={s.running} onClick={() => { setNote(''); agent.reset(); }}>Reset</button>
          </div>
        </div>

        <div className="card">
          <h2>What the agent did</h2>
          <div className="stats">
            <div className="stat"><b>{s.tools} of {s.max}</b>Tool calls</div>
            <div className="stat"><b>{toolsUsed}</b>Tools used</div>
            <div className="stat"><b>{status}</b>Status</div>
          </div>
          <ol className="trace" ref={traceRef}>
            {!s.trace.length && <li className="empty">Press Run the agent. Each step it chooses appears here.</li>}
            {s.trace.map((t, i) => <TraceItem key={i} t={t} />)}
          </ol>

          {finished && (
            <div className="ag-final">
              <h3>Draft reply for the Secretary</h3>
              <p className="what">Why it stopped: {s.escalated.reason}</p>
              <Output text={s.draft || 'No draft was saved.'} />
              {s.signed ? (
                <p className="what">Signed at {s.signed}. File note: “Drafted by an AI agent with {s.tools} logged tool calls; facts verified and approved by the Secretary.”</p>
              ) : (
                <>
                  <div className="row"><button className="primary" onClick={agent.approve}>Approve and sign</button></div>
                  <label className="lbl" htmlFor="ag-note">Or send it back with a note</label>
                  <textarea id="ag-note" ref={noteRef} style={{ minHeight: 70 }} value={note} onChange={e => setNote(e.target.value)}
                    placeholder="For example: shorten part (a) and say when the night checks start." />
                  <div className="row"><button className="ghost" onClick={sendBack}>Send back to the agent</button></div>
                </>
              )}
            </div>
          )}

          <details>
            <summary>The full instruction the agent receives</summary>
            <Output text={agent.brief} />
          </details>
        </div>
      </div>
    </section>
  );
}
