/* State and actions for workflow 1: the CM summary chain. */
import { useRef, useState } from 'react';
import { DOCS, PROMPTS, REC } from './data.js';
import { ask, server, liveHint } from './api.js';
import { readDocument } from './files.js';

export const NODES = [
  { id: 'input', k: 'INPUT', name: 'Three documents', what: 'Training sample documents. You can edit them before running.' },
  { id: 'extract', k: 'AI DESK', name: '1 · Extract facts', what: 'Pull every fact into a table with its source. Facts first, prose later.' },
  { id: 'draft', k: 'AI DESK', name: '2 · Draft summary', what: 'Draft in the order of the Manual of Secretariat Instructions (paras 4.15 to 4.16), using only the fact table.' },
  { id: 'critic', k: 'AI DESK', name: '3 · Critic check', what: 'A second prompt reviews the draft against the sources and lists problems. It does not rewrite.' },
  { id: 'officer', k: 'OFFICER', name: 'Officer review', what: 'Human checkpoint. Read the draft and the critic list, then approve or send back.', human: true },
  { id: 'urdu', k: 'AI DESK', name: '4 · Urdu brief', what: 'Half-page Urdu summary from the approved draft, figures unchanged.' },
  { id: 'sign', k: 'SECRETARY', name: 'Secretary signs', what: 'Human decision. The file records who approved and that AI helped draft it.', human: true },
];
export const LABEL = { done: 'Done', ready: 'Ready to run', locked: 'Waiting', run: 'Working…', wait: 'Your decision' };
export const OFFICER_CHECKS = [
  'Every figure has a source number',
  'No figure appears that is not in the sources',
  'Where sources disagree, it says so',
  'The recommendation does not go beyond the facts',
];
const ORDER = NODES.map(n => n.id);
export const nameOf = id => NODES.find(n => n.id === id)?.name || (id === 'failure' ? 'Deliberate failure' : 'Apply fixes');
export const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* What each step changes when it finishes, and what it writes to the log */
const AFTER = {
  extract: { extract: 'done', draft: 'ready' },
  draft: { draft: 'done', critic: 'ready' },
  failure: { draft: 'done', critic: 'ready', officer: 'locked', urdu: 'locked', sign: 'locked' },
  critic: { critic: 'done', officer: 'wait' },
  fix: { critic: 'done', officer: 'wait' },
  urdu: { urdu: 'done', sign: 'wait' },
};
const LOG = {
  extract: 'Facts extracted from the documents.',
  draft: 'Summary drafted.',
  failure: 'Asked for a budget figure that is not in the sources (deliberate failure).',
  critic: 'Critic listed problems. File sent to officer review.',
  fix: 'Draft revised to fix the critic’s list.',
  urdu: 'Urdu brief prepared. File sent to the Secretary.',
};
/* The order "Run all linked steps" follows */
const SEQUENCE = ['extract', 'draft', 'failure', 'critic', 'fix', 'officer', 'urdu', 'sign'];
const NO_CHECKS = [false, false, false, false];

const initialState = () => ({
  sel: 'input',
  status: { input: 'done', extract: 'ready', draft: 'locked', critic: 'locked', officer: 'locked', urdu: 'locked', sign: 'locked' },
  out: { extract: '', draft: '', critic: '', urdu: '' },
  streaming: null, // { key, text } while a desk is running
  docs: DOCS.map(d => ({ ...d })),
  doc: 0,
  custom: false,
  prompts: { ...PROMPTS },
  failed: false,
  fixed: false,
  signed: '',
  links: { extract: false, draft: false, critic: false, officer: false, urdu: false, sign: false },
  checks: NO_CHECKS,
  options: { fail: false, fix: true },
  chainOn: false,
  stop: false,
  message: { text: 'Desks are not linked yet: each one waits for you to press Run, like copy-paste between chats. Click a link between two desks, or “Link all desks”, to chain them.', kind: '' },
  log: [],
});

const docsBlock = docs => docs.map((d, i) => `--- DOCUMENT ${i + 1}: ${d.name} ---\n${d.text}`).join('\n\n');

function buildPrompt(id, s) {
  const P = s.prompts, docs = docsBlock(s.docs);
  if (id === 'extract') return `${P.extract}\n\nSOURCE DOCUMENTS:\n${docs}`;
  if (id === 'draft') return `${P.draft}\n\nFACT TABLE:\n${s.out.extract}\n\nSOURCE DOCUMENTS:\n${docs}`;
  if (id === 'failure') return `${P.failure}\n\nCURRENT DRAFT SUMMARY:\n${s.out.draft}\n\nSOURCE DOCUMENTS:\n${docs}`;
  if (id === 'critic') return `${P.critic}\n\nDRAFT SUMMARY:\n${s.out.draft}\n\nFACT TABLE:\n${s.out.extract}\n\nSOURCE DOCUMENTS:\n${docs}`;
  if (id === 'fix') return `${P.fix}\n\nDRAFT SUMMARY:\n${s.out.draft}\n\nREVIEWER'S LIST:\n${s.out.critic}\n\nSOURCE DOCUMENTS:\n${docs}`;
  if (id === 'urdu') return `${P.urdu}\n\nAPPROVED SUMMARY:\n${s.out.draft}`;
}

/* Replay mode with uploaded documents: list every sentence that contains a figure */
function offlineFacts(docs) {
  const rows = ['| No. | Fact or figure | Source document and paragraph | Stated or implied |', '| --- | --- | --- | --- |'];
  let n = 0;
  docs.forEach((d, di) => d.text.split(/\n\s*\n|\n(?=\s*\d+[.)]\s)/).forEach((para, pi) => {
    para.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=[A-Z0-9])/).filter(s => /\d/.test(s) && s.length > 25).slice(0, 4)
      .forEach(s => { if (n < 40) rows.push(`| ${++n} | ${s.trim().replace(/\|/g, '/').slice(0, 220)} | Doc ${di + 1}, para ${pi + 1} | Stated |`); });
  }));
  return `OFFLINE PREVIEW (replay mode, no AI): sentences that contain figures, found by a simple rule.\n\n${rows.join('\n')}\n\nTo let Claude extract, draft, check and translate your own documents, ${liveHint()}.`;
}

/* Re-running a desk makes everything after it out of date */
function resetAfter(s, id) {
  const status = { ...s.status }, out = { ...s.out };
  ORDER.slice(ORDER.indexOf(id) + 1).forEach(k => { status[k] = 'locked'; if (k in out) out[k] = ''; });
  const early = ORDER.indexOf(id) <= ORDER.indexOf('draft');
  return { status, out, checks: NO_CHECKS, signed: '', ...(early ? { failed: false, fixed: false } : {}) };
}

function isStepDone(step, s) {
  if (step === 'failure') return !s.options.fail || s.failed;
  if (step === 'fix') return !s.options.fix || s.fixed || !s.out.critic;
  return s.status[step] === 'done';
}

export function useChain(notify) {
  const [state, setState] = useState(initialState);
  /* async steps read the latest state from this ref */
  const ref = useRef(state);
  const set = patch => {
    const s = ref.current;
    ref.current = { ...s, ...(typeof patch === 'function' ? patch(s) : patch) };
    setState(ref.current);
  };
  const log = text => set(s => ({ log: [...s.log, `${now()}  ${text}`] }));
  const say = (text, kind = '') => set({ message: { text, kind } });

  /* Run one AI step. Returns false if it could not run. */
  async function runStep(id) {
    const s = ref.current;
    const target = id === 'failure' || id === 'fix' ? 'draft' : id;
    const node = id === 'fix' ? 'critic' : id === 'failure' ? 'draft' : id;
    if (s.custom && !server.live && id !== 'extract') {
      say(`Replay mode has recorded outputs only for the sample documents. To run “${nameOf(node)}” on your documents, ${liveHint()}, or restore the sample set on the Documents desk.`, 'pause');
      return false;
    }
    const reset = ['extract', 'draft', 'critic', 'urdu'].includes(id) ? resetAfter(s, id)
      : id === 'fix' ? { status: { ...s.status, urdu: 'locked', sign: 'locked' }, out: { ...s.out, urdu: '' }, signed: '' }
      : {};
    set(cur => ({ ...reset, status: { ...(reset.status || cur.status), [node]: 'run' }, sel: target, streaming: { key: target, text: '' } }));

    let text = await ask(buildPrompt(id, ref.current), t => set({ streaming: { key: target, text: t } }));
    if (text == null) {
      if (server.live) notify('Live call failed: recorded output used. See the browser console for details.');
      await sleep(400);
      text = s.custom && id === 'extract' ? offlineFacts(s.docs) : REC[id];
    }
    set(cur => ({
      streaming: null,
      out: { ...cur.out, [target]: text },
      status: { ...cur.status, ...AFTER[id] },
      failed: id === 'failure' ? true : cur.failed,
      fixed: id === 'fix' ? true : id === 'failure' ? false : cur.fixed,
    }));
    log(LOG[id]);
    return true;
  }

  /* Walk the sequence, stopping at manual links and at the human desks */
  async function runChain(continuing) {
    set({ chainOn: true, stop: false });
    let first = !continuing;
    for (const step of SEQUENCE) {
      const s = ref.current;
      if (isStepDone(step, s)) continue;
      if (s.stop) { say('Chain stopped by you. Press Run on any desk, or Run all linked steps, to continue.'); break; }
      const isDesk = ORDER.includes(step);
      if (isDesk && !first && !s.links[step]) {
        set({ sel: step });
        say(`Chain stopped before “${nameOf(step)}”: that link is manual. Press Run on the desk, or link it.`);
        break;
      }
      if (step === 'officer' || step === 'sign') {
        set({ sel: step });
        say(`Chain paused at “${nameOf(step)}”: a person must decide. The AI cannot link past a signature.`, 'pause');
        break;
      }
      first = false;
      say(`Running “${nameOf(step)}”…`, 'on');
      if (!(await runStep(step))) break;
    }
    if (ref.current.status.sign === 'done') say('Workflow complete: signed and logged.', 'on');
    set({ chainOn: false });
  }

  /* Run one desk by hand; carry on if the next link is connected */
  async function runDesk(id) {
    if (!(await runStep(id))) return;
    const node = id === 'fix' ? 'critic' : id === 'failure' ? 'draft' : id;
    const next = ORDER[ORDER.indexOf(node) + 1];
    if (next && ref.current.links[next] && !NODES.find(n => n.id === next).human) runChain(true);
  }

  /* After a person decides, continue if the next link is connected */
  function afterHuman(node) {
    const next = ORDER[ORDER.indexOf(node) + 1];
    if (!next) return;
    if (ref.current.links[next]) runChain(true);
    else say(`Approved. The link into “${nameOf(next)}” is manual: press Run there.`);
  }

  function docsChanged(why, docs = ref.current.docs) {
    const reset = resetAfter(ref.current, 'input');
    set({ ...reset, status: { ...reset.status, extract: 'ready' }, docs, custom: true });
    log(why);
  }

  return {
    state,
    select: id => set({ sel: id }),
    setOption: (k, v) => set(s => ({ options: { ...s.options, [k]: v } })),
    setPrompt: (id, text) => set(s => ({ prompts: { ...s.prompts, [id]: text } })),
    runDesk,
    runAll: () => { log('Run all linked steps started.'); runChain(false); },
    stop: () => { set({ stop: true }); say('Stopping after the current desk finishes…', 'pause'); },

    toggleLink: id => {
      const on = !ref.current.links[id];
      set(s => ({ links: { ...s.links, [id]: on } }));
      log(`Link into ${nameOf(id)} ${on ? 'connected' : 'removed'}.`);
    },
    linkAll: () => {
      const all = Object.values(ref.current.links).every(Boolean);
      set(s => ({ links: Object.fromEntries(Object.keys(s.links).map(k => [k, !all])) }));
      log(all ? 'All links removed: every desk is manual.' : 'All desks linked into one chain.');
      say(all ? 'All desks are manual again.' : 'All desks linked. Run all linked steps will move the file automatically, pausing only at the officer and Secretary.');
    },

    /* Documents desk */
    selectDoc: i => set({ doc: i }),
    editDoc: text => set(s => ({ docs: s.docs.map((d, i) => (i === s.doc ? { ...d, text } : d)) })),
    docEdited: () => { if (ref.current.status.extract === 'done') docsChanged(`Document edited: ${ref.current.docs[ref.current.doc].name}.`); },
    removeDoc: i => {
      const s = ref.current;
      set({ doc: 0 });
      docsChanged(`Document removed: ${s.docs[i].name}.`, s.docs.filter((_, k) => k !== i));
    },
    restoreSamples: () => { set({ ...initialState(), links: ref.current.links, log: ref.current.log }); log('Sample documents restored.'); },
    addFiles: async (files, replace) => {
      const got = [], bad = [];
      for (const f of files) {
        try {
          const text = await readDocument(f);
          if (!text) throw new Error(`“${f.name}” has no readable text (is it a scanned image?).`);
          got.push({ name: f.name, text: text.slice(0, 60000) });
        } catch (e) { bad.push(e.message); }
      }
      if (got.length) {
        const docs = replace ? got : [...ref.current.docs, ...got];
        set({ doc: replace ? 0 : docs.length - got.length });
        docsChanged(`${got.length} document(s) uploaded: ${got.map(d => d.name).join(', ')}.`, docs);
        notify(`${got.length} document(s) loaded. ${server.live ? 'Run the chain.' : `To process them with Claude, ${liveHint()}.`}`);
      }
      if (bad.length) notify(bad.join(' '));
    },

    /* Human desks */
    toggleCheck: i => set(s => ({ checks: s.checks.map((c, k) => (k === i ? !c : c)) })),
    approve: () => {
      set(s => ({ status: { ...s.status, officer: 'done', urdu: 'ready' }, sel: 'urdu' }));
      log('Officer ticked all four checks and approved the draft.');
      afterHuman('officer');
    },
    sendBack: () => {
      set(s => ({ status: { ...s.status, officer: 'locked', critic: 'locked', draft: 'ready' }, checks: NO_CHECKS, sel: 'draft' }));
      log('Officer sent the draft back.');
      say('Sent back. Re-run the draft desk, then the chain continues from there if linked.');
    },
    sign: () => {
      set(s => ({ signed: now(), status: { ...s.status, sign: 'done' } }));
      log('Secretary signed. File note: drafted with AI assistance; facts verified by the Section Officer.');
      say('Workflow complete: signed and logged.', 'on');
    },
    reset: () => set(initialState()),
  };
}
