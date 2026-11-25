/* Exercise 1: a chain of desks turns three documents into a signed summary for the CM. */
import { Fragment, useState } from 'react';
import { ANSWERS } from '../data.js';
import { server, liveHint } from '../api.js';
import { NODES, LABEL, OFFICER_CHECKS, nameOf } from '../useChain.js';
import Output from '../components/Output.jsx';
import { Progress } from '../components/Charts.jsx';

/* Title, hint and which output each desk shows */
function outputInfo(s) {
  return {
    input: ['Documents', `${s.docs.length} document(s) feed every AI desk.`, null],
    extract: ['Fact table', 'Check one figure against the answer card.', 'extract'],
    draft: ['Draft summary', s.failed && !s.fixed ? 'This draft now contains a budget figure. Is it in any source?' : s.fixed ? 'Revised after the critic’s list.' : 'Each figure points back to the fact table.', 'draft'],
    critic: ['Critic’s list', 'The AI checks itself, and still a person checks the AI.', 'critic'],
    officer: ['Draft for review', 'Read before you approve.', 'draft'],
    urdu: ['Urdu brief', 'Have a native reader check terms before official use.', 'urdu'],
    sign: ['Final summary', 'This is what goes on the file.', 'draft'],
  }[s.sel];
}

function Pipeline({ chain }) {
  const s = chain.state;
  return (
    <div className="pipe" id="pipe-cm">
      {NODES.map((n, i) => {
        const st = s.status[n.id], next = NODES[i + 1];
        return (
          <Fragment key={n.id}>
            <button className={`node ${st}${n.human ? ' human' : ''}${s.sel === n.id ? ' sel' : ''}`} onClick={() => chain.select(n.id)}>
              <span className="k">{n.k}</span><b>{n.name}</b><small>{LABEL[st]}</small>
            </button>
            {next && (
              <button className={'link' + (s.links[next.id] ? ' on' : '')} aria-pressed={s.links[next.id]}
                title={`Link into ${next.name}`} onClick={() => chain.toggleLink(next.id)}>
                <span aria-hidden="true">{s.links[next.id] ? '🔗' : '⋯'}</span>
                <span>{s.links[next.id] ? 'Linked' : 'Manual'}</span>
              </button>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

function DocumentsDesk({ chain, busy }) {
  const s = chain.state;
  const [replace, setReplace] = useState(true);
  const [over, setOver] = useState(false);
  const upload = files => chain.addFiles([...files], replace);
  return (
    <>
      {s.custom && !server.live && <p className="notice">Replay mode: recorded outputs exist only for the sample documents. Extract facts will show an offline preview; to run every desk on your documents, {liveHint()}.</p>}
      <div className={'drop' + (over ? ' over' : '')}
        onDragOver={e => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); if (!busy) upload(e.dataTransfer.files); }}>
        <b>Upload documents: </b>drop PDF, Word (.docx) or text files here, or{' '}
        <label>browse<input type="file" multiple accept=".pdf,.docx,.txt,.md" disabled={busy} onChange={e => { upload(e.target.files); e.target.value = ''; }} /></label>
        <label className="opt" style={{ justifyContent: 'center' }}>
          <input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} /> Replace the current documents (untick to add to them)
        </label>
      </div>
      <div className="chips">
        {s.docs.map((d, i) => (
          <span key={i} className={'chip' + (i === s.doc ? ' on' : '')}>
            <button className="chipname" onClick={() => chain.selectDoc(i)}>{d.name}</button>
            {s.docs.length > 1 && <button aria-label={'Remove ' + d.name} disabled={busy} onClick={() => chain.removeDoc(i)}>×</button>}
          </span>
        ))}
      </div>
      <textarea aria-label="Document text" value={s.docs[s.doc]?.text || ''} onChange={e => chain.editDoc(e.target.value)} onBlur={chain.docEdited} />
      <div className="row">
        <button className="primary" onClick={() => chain.select('extract')}>Next: run Extract facts</button>
        {s.custom && <button className="ghost" disabled={busy} onClick={chain.restoreSamples}>Restore the sample documents</button>}
      </div>
    </>
  );
}

function AiDesk({ chain, node, busy }) {
  const s = chain.state;
  return (
    <>
      <p className="what">The prompt for this desk (edit it if you like). The documents and earlier outputs are added automatically.</p>
      <textarea className={node.id === 'urdu' ? 'urdu' : ''} aria-label="Prompt for this desk" value={s.prompts[node.id]} onChange={e => chain.setPrompt(node.id, e.target.value)} />
      <div className="row">
        <button className="primary" disabled={busy || s.status[node.id] === 'locked'} onClick={() => chain.runDesk(node.id)}>
          {s.out[node.id] ? 'Run again' : 'Run this desk'}
        </button>
        {node.id === 'draft' && <button className="gold" disabled={busy || !s.out.draft} onClick={() => chain.runDesk('failure')}>Deliberate failure: ask for the budget</button>}
        {node.id === 'critic' && <button className="gold" disabled={busy || !s.out.critic} onClick={() => chain.runDesk('fix')}>Apply the fixes to the draft</button>}
      </div>
    </>
  );
}

function OfficerDesk({ chain }) {
  const s = chain.state, waiting = s.status.officer === 'wait';
  return (
    <>
      {OFFICER_CHECKS.map((t, i) => (
        <label key={i} className="check">
          <input type="checkbox" checked={s.checks[i]} disabled={!waiting} onChange={() => chain.toggleCheck(i)} /><span>{t}</span>
        </label>
      ))}
      {waiting && !s.checks.every(Boolean) && <p className="what">Tick all four checks to enable Approve.</p>}
      <div className="row">
        <button className="primary" disabled={!waiting || !s.checks.every(Boolean)} onClick={chain.approve}>Approve the draft</button>
        <button className="ghost" disabled={!waiting} onClick={chain.sendBack}>Send back to the draft desk</button>
      </div>
      {s.failed && !s.fixed && <p className="what">Note: the draft still contains the budget figure the critic flagged. Apply the fixes before approving.</p>}
    </>
  );
}

function SignDesk({ chain }) {
  const s = chain.state;
  return (
    <>
      <div className="row">
        <button className="primary" disabled={s.status.sign !== 'wait'} onClick={chain.sign}>{s.signed ? 'Signed' : 'Sign the summary'}</button>
        <button className="ghost" onClick={chain.reset}>Start over</button>
      </div>
      {s.signed && <p className="what">Signed at {s.signed}. File note added: “Drafted with AI assistance; facts verified by the Section Officer.”</p>}
    </>
  );
}

export default function CmSummary({ chain }) {
  const s = chain.state;
  const node = NODES.find(n => n.id === s.sel);
  const busy = Object.values(s.status).includes('run');
  const done = NODES.filter(n => s.status[n.id] === 'done').length;
  const allLinked = Object.values(s.links).every(Boolean);
  const [title, hint, key] = outputInfo(s);
  const outText = s.sel === 'input'
    ? s.docs.map(d => `━━ ${d.name} ━━\n${d.text}`).join('\n\n')
    : s.streaming?.key === key ? s.streaming.text : s.out[key];

  return (
    <section className="band">
      <p className="note">
        {s.custom
          ? `Your documents: ${s.docs.length} loaded (${s.docs.map(d => d.name).join(', ')}). Use only public or training material.`
          : 'Sample data: three fictional training documents on smog in Lahore Division (not official documents). Open the “Documents” desk to upload your own.'}
      </p>
      <div className="chainbar">
        <button className="gold" disabled={busy || s.chainOn || s.status.sign === 'done'} onClick={chain.runAll}>Run all linked steps</button>
        {s.chainOn && <button className="ghost" onClick={chain.stop}>Stop after this desk</button>}
        <button className="ghost" onClick={chain.linkAll}>{allLinked ? 'Unlink all desks' : 'Link all desks'}</button>
        <label className="opt"><input type="checkbox" checked={s.options.fail} onChange={e => chain.setOption('fail', e.target.checked)} /> Include the deliberate failure</label>
        <label className="opt"><input type="checkbox" checked={s.options.fix} onChange={e => chain.setOption('fix', e.target.checked)} /> Apply the critic’s fixes automatically</label>
      </div>
      <Progress value={done / NODES.length} label={`${done} of ${NODES.length} desks done${busy ? ' · working' : ''}`} />
      <p className={'chainmsg ' + s.message.kind} aria-live="polite">{s.message.text}</p>
      <Pipeline chain={chain} />

      <div className="grid">
        <div className="card">
          <h2>{nameOf(node.id)}</h2>
          <p className="what">{node.what}</p>
          {node.id === 'input' && <DocumentsDesk chain={chain} busy={busy} />}
          {!node.human && node.id !== 'input' && <AiDesk chain={chain} node={node} busy={busy} />}
          {node.id === 'officer' && <OfficerDesk chain={chain} />}
          {node.id === 'sign' && <SignDesk chain={chain} />}
        </div>
        <div className="card">
          <h2>{title}</h2>
          <p className="what">{hint}</p>
          <Output text={outText} urdu={key === 'urdu'} />
          <details>
            <summary>Presenter answer card</summary>
            <ul>{ANSWERS.map(a => <li key={a}>{a}</li>)}</ul>
          </details>
          <details>
            <summary>File log (what happened, when)</summary>
            <ol className="log">{s.log.map((l, i) => <li key={i}>{l}</li>)}</ol>
          </details>
        </div>
      </div>
    </section>
  );
}
