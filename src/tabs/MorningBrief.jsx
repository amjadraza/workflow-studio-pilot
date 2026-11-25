/* Exercise 3: the scheduled morning media brief (slide 10).
   The same kind of prompt now runs on its own: a trigger starts it, it reads public news, and the draft waits for a person. */
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { briefsApi, server, liveHint } from '../api.js';
import { DEPARTMENTS, SAMPLE_DEPT, briefPrompt } from '../../server/briefPrompt.js';

const STATUS = {
  running: ['Preparing…', 'p-sent'], draft: ['Draft for PRO review', 'p-officer'], approved: ['Approved', 'p-routine'],
  returned: ['Sent back', 'p-flag'], failed: ['Failed', 'p-urgent'],
};
const URDU = /[؀-ۿ]/;
const fmtDate = d => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/* Text with clickable links: plain URLs and markdown [title](url) */
function Linked({ text }) {
  const parts = text.split(/(\[[^\]]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s)]+)/g);
  return parts.map((p, i) => {
    const md = /^\[([^\]]+)\]\((.+)\)$/.exec(p);
    if (md) return <a key={i} href={md[2]} target="_blank" rel="noreferrer">{md[1]}</a>;
    if (/^https?:\/\//.test(p)) return <a key={i} href={p} target="_blank" rel="noreferrer">{p}</a>;
    return <Fragment key={i}>{p}</Fragment>;
  });
}

/* The brief, line by line: Urdu lines right-to-left in a Nastaliq font, headings bold, markdown tables as tables */
function BriefText({ text }) {
  const items = [];
  for (const raw of text.split('\n')) {
    if (/^\s*\|.*\|\s*$/.test(raw)) {
      const cells = raw.trim().slice(1, -1).split('|').map(c => c.trim().replace(/\*\*/g, ''));
      if (cells.every(c => /^:?-{2,}:?$/.test(c))) continue; // the |---| row
      if (!Array.isArray(items.at(-1))) items.push([]);
      items.at(-1).push(cells);
    } else items.push(raw);
  }
  return (
    <div className="brief">
      {items.map((raw, i) => {
        if (Array.isArray(raw)) return (
          <div key={i} className="scroll"><table className="q"><tbody>
            {raw.map((row, j) => <tr key={j}>{row.map((c, k) => j === 0 ? <th key={k}>{c}</th> : <td key={k} dir="auto"><Linked text={c} /></td>)}</tr>)}
          </tbody></table></div>
        );
        const line = raw.replace(/\*\*/g, '').replace(/^(\s*)\*\s+/, '$1• ').replace(/\*/g, '').replace(/^#+\s*/, '');
        if (!line.trim()) return <div key={i} className="gap" />;
        const urdu = /^\s*(?:[-*]\s*)?(?:Urdu|اردو)\s*[:：]\s*(.*)$/.exec(line);
        if (urdu && URDU.test(urdu[1])) return <p key={i}><span className="lang">Urdu</span><span className="urdu" dir="rtl">{urdu[1]}</span></p>;
        if (URDU.test(line) && !/[a-z]{4}/i.test(line)) return <p key={i} className="urdu" dir="rtl">{line}</p>;
        const head = raw.startsWith('#') || /^[\dA-Z][A-Z0-9 .:,&()-]{6,}$/.test(line.trim()); // markdown or ALL-CAPS headings
        return <p key={i} className={head ? 'h' : ''}><Linked text={line} /></p>;
      })}
    </div>
  );
}

export default function MorningBrief({ notify }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [department, setDepartment] = useState(SAMPLE_DEPT);
  const [time, setTime] = useState('07:00');
  const [pick, setPick] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const noteRef = useRef(null);

  const act = useCallback(async (action, body) => {
    setBusy(true); setError('');
    try { const d = await briefsApi(action, body); setData(d); return d; }
    catch (e) { setError(e.message); return null; }
    finally { setBusy(false); }
  }, []);

  /* First load: show the saved schedule */
  useEffect(() => {
    briefsApi().then(d => {
      setData(d);
      if (d.schedule) { setDepartment(d.schedule.department); setTime(d.schedule.time); }
    }).catch(e => setError(e.message));
  }, []);

  /* Check for new briefs: every 3 s while one is being prepared, otherwise every minute (to catch the morning trigger) */
  const running = data?.briefs.some(b => b.status === 'running');
  useEffect(() => {
    const t = setInterval(() => briefsApi().then(setData).catch(() => {}), running ? 3000 : 60000);
    return () => clearInterval(t);
  }, [running]);

  if (!data) return <section className="band"><p className="note">{error || 'Loading…'}</p></section>;

  const brief = data.briefs.find(b => b.id === pick) || data.briefs[0];
  const sched = data.schedule;
  const replayNoSample = !server.live && department !== SAMPLE_DEPT;
  const tz = data.timezone === 'Asia/Karachi' ? 'Pakistan time' : data.timezone;
  const nextRun = sched && (sched.lastRun === data.now.date ? 'tomorrow' : 'today') + ` at ${sched.time}`;
  const phase = !brief ? 'trigger' : brief.status === 'running' ? 'search' : brief.status === 'draft' ? 'review' : brief.status === 'failed' ? '' : 'done';

  const review = async decision => {
    if (decision === 'returned' && !note.trim()) { noteRef.current?.focus(); return; }
    if (await act('review', { id: brief.id, decision, note: note.trim() })) {
      setNote('');
      notify(decision === 'approved' ? 'Approved for release. Recorded with your name.' : 'Sent back with your note.');
    }
  };
  const copyPrompt = () => navigator.clipboard?.writeText(briefPrompt(department, '').split('\n').slice(1).join('\n'))
    .then(() => notify('Prompt copied. Paste it into a scheduled task in your own assistant.'), () => notify('Copy failed: select the text and copy it.'));

  return (
    <section className="band">
      <p className="note">Slide 10 · The same kind of prompt now runs on its own: a trigger starts it, it reads public news,
        and the output waits for a person. That is an automated workflow.</p>
      <div className="loop" aria-label="Scheduled workflow">
        {[['trigger', `⏰ Daily at ${sched?.time || time}`], ['search', 'AI searches 24 h of news'],
          ['search2', 'AI drafts brief (EN + UR)'], ['review', 'PRO reviews', true], ['done', 'Approve or send back', true]]
          .map(([id, label, human], i) => (
            <Fragment key={id}>
              {i > 0 && <i aria-hidden="true">→</i>}
              <span className={(human ? 'hum ' : '') + (phase === id || (phase === 'search' && id === 'search2') ? 'cur' : '')}>{label}</span>
            </Fragment>
          ))}
      </div>

      <div className="grid ag">
        <div className="card">
          <h2>Schedule</h2>
          <p className="what">Choose a department and a time. Every morning at that time the server runs the prompt with web search, and the brief lands in your inbox below as a draft.</p>
          <label className="lbl" htmlFor="mb-dept">Department, Government of Punjab</label>
          <select id="mb-dept" className="agselect" value={department} onChange={e => setDepartment(e.target.value)}>
            {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
          </select>
          <label className="lbl" htmlFor="mb-time">Time ({tz})</label>
          <input id="mb-time" type="time" className="agselect" value={time} onChange={e => setTime(e.target.value)} />

          <div className="notice" style={{ marginTop: 14 }}>
            {sched
              ? <>Scheduled: <b>{sched.department}</b> every day at <b>{sched.time}</b>. Next run {nextRun}. Runs until {fmtDate(sched.until)}, then stops by itself.
                  {' '}{sched.live ? 'Live: searches the web.' : 'Replay: uses the recorded brief.'}</>
              : 'No schedule yet.'}
          </div>
          {replayNoSample && <p className="note">Replay mode has a recorded brief only for the {SAMPLE_DEPT}. To search the news for this department, {liveHint()}.</p>}
          <div className="row">
            <button className="primary" disabled={busy} onClick={() => act('schedule', { department, time, live: server.live }).then(d => d && notify(`Scheduled for ${time} every day.`))}>
              {sched ? 'Update schedule' : 'Schedule daily brief'}
            </button>
            {sched && <button className="ghost" disabled={busy} onClick={() => act('schedule', { stop: true }).then(d => d && notify('Schedule stopped.'))}>Stop</button>}
            <button className="gold" disabled={busy || running || replayNoSample} onClick={() => act('run', { department, live: server.live })}
              title="Fire the trigger now instead of waiting for the morning">Run now</button>
          </div>
          {error && <p className="login-error" role="alert">{error}</p>}

          <details>
            <summary>The prompt the trigger runs</summary>
            <pre className="prompt">{briefPrompt(department, data.now.date)}</pre>
            <p className="note">In class: copy it into a scheduled task in your own assistant (Claude scheduled tasks or ChatGPT tasks, with web search on) and compare.</p>
            <button className="ghost" onClick={copyPrompt}>Copy prompt</button>
          </details>
        </div>

        <div className="card">
          <h2>Briefs inbox</h2>
          <p className="what">Each brief is a draft until a person approves it. Nothing is released without a human signature.</p>
          {data.briefs.length ? (
            <div className="mb-list" role="list">
              {data.briefs.map(b => (
                <button key={b.id} role="listitem" className={b === brief ? 'on' : ''} onClick={() => { setPick(b.id); setNote(''); }}>
                  <b>{fmtDate(b.date)} · {b.time}</b>
                  <span>{b.department.replace(/ Department$/, '')}</span>
                  <small>{b.trigger === 'schedule' ? '⏰ Morning trigger' : '▶ Run now'} · {b.mode === 'live' ? 'Live' : 'Replay'}</small>
                  <span className={'pill ' + STATUS[b.status][1]}>{STATUS[b.status][0]}</span>
                </button>
              ))}
            </div>
          ) : <p className="empty">No briefs yet. Schedule one, or press Run now to fire the trigger.</p>}

          {brief && (
            <div className="mb-brief">
              <h3>{brief.department}, {fmtDate(brief.date)}</h3>
              {brief.status === 'running' && <p className="chainmsg on">Searching the news and writing the brief… this can take a minute or two.</p>}
              {brief.status === 'failed' && <p className="login-error">{brief.text}</p>}
              {brief.text && brief.status !== 'failed' && <BriefText text={brief.text} />}
              {brief.sources?.length > 0 && (
                <details>
                  <summary>Sources the AI read ({brief.sources.length})</summary>
                  <ul className="src">{brief.sources.map(s => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>)}</ul>
                </details>
              )}
              {brief.status === 'draft' && (
                <div className="mb-review">
                  <label className="lbl" htmlFor="mb-note">PRO note (needed to send back)</label>
                  <textarea id="mb-note" ref={noteRef} style={{ minHeight: 80 }} value={note} onChange={e => setNote(e.target.value)}
                    placeholder="For example: verify story 2 with the department before release." />
                  <div className="row">
                    <button className="gold" disabled={busy} onClick={() => review('approved')}>Approve for release</button>
                    <button className="ghost" disabled={busy} onClick={() => review('returned')}>Send back</button>
                  </div>
                </div>
              )}
              {(brief.status === 'approved' || brief.status === 'returned') && (
                <p className="notice">{brief.status === 'approved' ? 'Approved' : 'Sent back'} by <b>{brief.reviewer}</b> at {brief.reviewedAt}.{brief.note && <> Note: {brief.note}</>}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
