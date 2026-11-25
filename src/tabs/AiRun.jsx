/* Exercise 6: run the class prompt on Claude and show the dashboard it builds, next to the reference.
   Claude's page is shown in a locked-down frame: its scripts run, but it cannot reach this app or your sign-in. */
import { useEffect, useRef, useState } from 'react';
import { dashboardApi, server, liveHint } from '../api.js';

const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/* Does any number in Claude's answer match the value calculated from the file (to one decimal)? */
const matches = (answer, value) => (answer.match(/\d+(?:\.\d+)?/g) || []).some(n => Math.abs(Number(n) - value) < 0.051);

export default function AiRun({ prompt, reference, notify }) {
  const [run, setRun] = useState(null);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const frame = useRef(null);

  useEffect(() => { dashboardApi().then(d => setRun(d.run)).catch(() => {}); }, []);

  /* while building: ask the server every 5 s, and tick the clock every second */
  const running = run?.status === 'running';
  useEffect(() => {
    if (!running) return;
    const poll = setInterval(() => dashboardApi().then(d => {
      setRun(d.run);
      if (d.run?.status === 'done') notify('Claude’s dashboard is ready.');
    }).catch(() => {}), 5000);
    const t = setInterval(() => setTick(x => x + 1), 1000);
    return () => { clearInterval(poll); clearInterval(t); };
  }, [running, notify]);

  const start = async () => {
    setError('');
    try { setRun((await dashboardApi('run', { prompt, live: server.live })).run); setTick(0); }
    catch (e) { setError(e.message); }
  };

  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([run.html], { type: 'text/html' }));
    a.download = 'dashboard.html';
    a.click();
  };

  const seconds = running ? run.seconds + tick : run?.seconds;
  const ok = run?.answer && reference != null ? matches(run.answer, reference) : null;

  return (
    <div className="card w12 airun">
      <div className="airun-head">
        <div>
          <h2>Run the prompt on Claude</h2>
          <p className="what">Claude gets the CSV in its code sandbox, follows the prompt above (edit it first if you like), and builds the page.
            {server.live ? ' Takes about 5–10 minutes; you can keep working meanwhile.' : ' Replay mode: shows a dashboard Claude built earlier from the same prompt.'}</p>
        </div>
        <div className="row" style={{ marginTop: 0 }}>
          <button className="gold" onClick={start} disabled={running}>
            {running ? `Building… ${clock(seconds)}` : run ? '↻ Run the prompt again' : '▶ Run the prompt'}
          </button>
        </div>
      </div>
      {!server.live && <p className="note">To build a new one with your own edits, {liveHint()}.</p>}
      {error && <p className="login-error" role="alert">{error}</p>}
      {running && <p className="chainmsg on">Claude is reading the file, calculating with code and writing the page… you can leave this page and come back.</p>}
      {run?.status === 'failed' && <p className="notice">The run failed: {run.error}</p>}

      {run?.status === 'done' && (
        <>
          <div className="check-answer">
            <div><span className="lab">Claude says</span><p>{run.answer ? run.answer.replace(/\*\*|`/g, '').replace(/^#+\s*/gm, '') : '(no message)'}</p></div>
            <div><span className="lab">Calculated from the file</span>
              <p>Lahore 2025 average PM2.5: <b>{reference?.toFixed(1)} µg/m³</b></p>
              {ok != null && <span className={'pill ' + (ok ? 'p-routine' : 'p-flag')}>{ok ? '✓ Claude’s number matches' : '✗ No matching number: check it'}</span>}
            </div>
          </div>
          <div className="row">
            <button className="ghost" onClick={() => frame.current?.requestFullscreen?.()}>Full screen</button>
            <button className="ghost" onClick={download}>Download dashboard.html</button>
            <span className="source">{run.mode === 'live' ? `Built live in ${clock(run.seconds)}` : 'Recorded run (Replay mode)'}</span>
          </div>
          <iframe ref={frame} className="airun-frame" title="Claude's dashboard" sandbox="allow-scripts" srcDoc={run.html} />
        </>
      )}
    </div>
  );
}
