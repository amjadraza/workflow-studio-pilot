import { useCallback, useRef, useState } from 'react';
import { LIVE, MODEL } from './api.js';
import { useChain } from './useChain.js';
import { useComplaints } from './useComplaints.js';
import CmSummary from './tabs/CmSummary.jsx';
import Complaints from './tabs/Complaints.jsx';
import Dashboard from './tabs/Dashboard.jsx';

const TABS = [
  ['cm', '1 · Summary for the CM (chain)'],
  ['cx', '2 · Complaint triage (automated)'],
  ['db', '3 · Live dashboard'],
];

export default function App() {
  const [tab, setTab] = useState('cm');
  const [toast, setToast] = useState('');
  const timer = useRef();
  const notify = useCallback(text => {
    setToast(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(''), 4200);
  }, []);

  /* State lives here so the dashboard can show both workflows */
  const chain = useChain(notify);
  const cx = useComplaints(notify);

  return (
    <>
      <header>
        <div className="top">
          <div>
            <h1>Workflow Studio</h1>
            <p className="sub">Watch a chain of prompts move a file from desk to desk. AI desks draft and check; officer desks approve. Nothing leaves without a human signature.</p>
          </div>
          <span className="mode">{LIVE ? `Live: Claude API (${MODEL})` : 'Replay: recorded outputs'}</span>
        </div>
        <nav className="tabs" aria-label="Workflows">
          {TABS.map(([id, label]) => (
            <button key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>{label}</button>
          ))}
        </nav>
      </header>

      <main>
        {tab === 'cm' && <CmSummary chain={chain} />}
        {tab === 'cx' && <Complaints cx={cx} />}
        {tab === 'db' && <Dashboard chain={chain} cx={cx} onLoadSamples={() => { setTab('cx'); cx.loadSamples(); }} />}
      </main>

      <div className={'toast' + (toast ? ' on' : '')} role="status" aria-live="polite">{toast}</div>
      <footer>
        Training tool for the session “From Prompt to Workflow to Agent”, Datafy Associates. Replay mode works offline.
        Live mode sends the text to Claude; use only public or training data.
      </footer>
    </>
  );
}
