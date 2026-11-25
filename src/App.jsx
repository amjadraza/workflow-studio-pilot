import { useCallback, useEffect, useRef, useState } from 'react';
import { server, loadSession, logout, setLive } from './api.js';
import ThemeSwitch from './components/ThemeSwitch.jsx';
import { useChain } from './useChain.js';
import { useComplaints } from './useComplaints.js';
import { useAgent } from './useAgent.js';
import Login from './Login.jsx';
import CmSummary from './tabs/CmSummary.jsx';
import Complaints from './tabs/Complaints.jsx';
import Agent from './tabs/Agent.jsx';
import Dashboard from './tabs/Dashboard.jsx';

const TABS = [
  ['cm', '1 · Summary for the CM (chain)'],
  ['cx', '2 · Complaint triage (automated)'],
  ['ag', '3 · Agent: Assembly question'],
  ['db', '4 · Live dashboard'],
];

/* Checks the session first; shows the sign-in screen until someone signs in */
export default function App() {
  const [user, setUser] = useState(undefined); // undefined = still checking
  const [error, setError] = useState('');

  useEffect(() => {
    loadSession().then(setUser).catch(e => { setError(e.message); setUser(null); });
  }, []);

  if (user === undefined) return null;
  if (error) return <p className="note" style={{ padding: 20 }}>Cannot reach the server: {error}</p>;
  if (!user) return <Login onSignedIn={setUser} />;
  return <Studio user={user} onSignOut={() => logout().finally(() => setUser(null))} />;
}

/* Two-button switch: Live (Claude API) or Replay (recorded outputs). Live needs a key on the server. */
function ModeSwitch({ live, onChange }) {
  const noKey = !server.hasKey;
  return (
    <div className="modeswitch" role="radiogroup" aria-label="AI mode">
      <button role="radio" aria-checked={live} disabled={noKey} onClick={() => onChange(true)}
        title={noKey ? 'Add ANTHROPIC_API_KEY to .env and restart the server to enable Live mode' : `Every AI desk calls Claude (${server.model})`}>
        Live: Claude API{live && <small> · {server.model}</small>}
      </button>
      <button role="radio" aria-checked={!live} onClick={() => onChange(false)} title="Every AI desk uses the recorded outputs; works offline">
        Replay: recorded outputs
      </button>
    </div>
  );
}

function Studio({ user, onSignOut }) {
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
  const agent = useAgent();

  /* Live or Replay: read by every AI call at the moment it runs */
  const [live, setLiveState] = useState(server.live);
  const chooseMode = on => {
    setLive(on);
    setLiveState(server.live);
    notify(server.live ? `Live mode: AI desks now call Claude (${server.model}).` : 'Replay mode: AI desks now use the recorded outputs.');
  };

  return (
    <>
      <header>
        <div className="top">
          <div>
            <h1>Workflow Studio</h1>
            <p className="sub">Watch a chain of prompts move a file from desk to desk, then watch an agent choose its own steps. AI drafts and checks; officers approve. Nothing leaves without a human signature.</p>
          </div>
          <div className="user">
            <ModeSwitch live={live} onChange={chooseMode} />
            <ThemeSwitch />
            <span>Signed in as <b>{user}</b></span>
            <button className="ghost" style={{ color: '#fff', minHeight: 36, padding: '6px 12px' }} onClick={onSignOut}>Sign out</button>
          </div>
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
        {tab === 'ag' && <Agent agent={agent} />}
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
