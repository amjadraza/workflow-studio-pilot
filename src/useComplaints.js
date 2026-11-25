/* State and actions for workflow 2: complaint triage. */
import { useRef, useState } from 'react';
import { CX, CX_REC, CX_PROMPT, norm } from './data.js';
import { rulesClassify, rowsToComplaints } from './rules.js';
import { askJSON, server, liveHint } from './api.js';
import { readSheet, saveSheet } from './files.js';
import { now } from './useChain.js';

export const CX_NODES = [
  { id: 'trig', k: 'TRIGGER', name: 'New complaints' },
  { id: 'cls', k: 'AI DESK', name: 'Classify' },
  { id: 'route', k: 'AI DESK', name: 'Route to branch' },
  { id: 'draft', k: 'AI DESK', name: 'Draft replies' },
  { id: 'queue', k: 'QUEUE', name: 'Review queue' },
  { id: 'appr', k: 'OFFICER DESK', name: 'Officer approves', human: true },
  { id: 'sent', k: 'LOG', name: 'Sent and logged' },
  { id: 'aud', k: '2ND OFFICER', name: 'Sample audit', human: true },
];
const MAX_COMPLAINTS = 300;
const SAMPLE_SOURCE = '20 sample complaints';
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* Tidy one AI result so the UI can trust its shape */
const clean = o => ({
  category: String(o.category || ''),
  urgency: ['urgent', 'routine', 'needs officer'].includes(String(o.urgency).toLowerCase()) ? String(o.urgency).toLowerCase() : 'needs officer',
  branch: String(o.branch || ''),
  summary: String(o.summary || ''),
  injection: !!o.injection,
  reply: String(o.reply || ''),
  by: o.by || 'Claude',
});

/* The recorded result for a sample complaint, if its text is unchanged */
function recorded(c) {
  const sample = CX.find(x => x.id === c.id);
  const rec = sample && norm(sample.text) === norm(c.text) && CX_REC.find(x => x.id === c.id);
  return rec ? clean({ ...rec, by: 'recorded' }) : null;
}

/* Urgent, unclear or flagged replies need a person */
export const needsPerson = r => r.urgency !== 'routine' || r.injection;

const initialState = () => ({
  pending: CX, source: SAMPLE_SOURCE,
  inbox: [], res: {}, approved: [], sent: [], audit: [],
  sel: null, running: false, linked: false, log: [],
});

export function useComplaints(notify) {
  const [state, setState] = useState(initialState);
  const ref = useRef(state);
  const set = patch => {
    const s = ref.current;
    ref.current = { ...s, ...(typeof patch === 'function' ? patch(s) : patch) };
    setState(ref.current);
  };
  const log = text => set(s => ({ log: [...s.log, `${now()}  ${text}`] }));

  async function runAI() {
    const s = ref.current;
    if (s.running || !s.inbox.length) return;
    set({ running: true });
    const todo = s.inbox.filter(c => !s.res[c.id]);
    let mode;
    if (server.live) {
      /* batches of 20, so results appear in the queue as they come */
      mode = 'Claude';
      for (let i = 0; i < todo.length; i += 20) {
        const batch = todo.slice(i, i + 20);
        const list = await askJSON(CX_PROMPT + '\n\nCOMPLAINTS (JSON):\n' + JSON.stringify(batch.map(({ id, district, text }) => ({ id, district, text }))));
        if (!Array.isArray(list)) { mode = 'recorded or rules (live call failed)'; notify('Live call failed: recorded outputs or offline rules used.'); }
        const got = new Map((list || []).filter(o => o?.id).map(o => [String(o.id), clean(o)]));
        set(cur => ({ res: { ...cur.res, ...Object.fromEntries(batch.map(c => [c.id, got.get(c.id) || recorded(c) || rulesClassify(c)])) } }));
      }
    } else {
      await sleep(600);
      const results = Object.fromEntries(todo.map(c => [c.id, recorded(c) || rulesClassify(c)]));
      mode = Object.values(results).some(r => r.by === 'rules') ? 'offline rules (replay mode)' : 'recorded outputs';
      set(cur => ({ res: { ...cur.res, ...results } }));
      if (mode.startsWith('offline')) notify(`Replay mode: your complaints were sorted by simple offline rules. To use Claude, ${liveHint()}.`);
    }
    set({ running: false });
    log(`AI desks classified, routed and drafted ${Object.keys(ref.current.res).length} replies (${mode}). All wait in the review queue.`);
  }

  function fireTrigger() {
    const s = ref.current;
    if (s.running) return;
    set({ inbox: s.pending.map(c => ({ ...c })), res: {}, approved: [], sent: [], audit: [], sel: null });
    log(`Trigger fired: ${s.pending.length} new complaints arrived in the inbox.`);
    if (s.linked) { log('Linked: AI desks started automatically.'); runAI(); }
  }

  return {
    state,
    fireTrigger,
    runAI,
    select: id => set({ sel: id }),
    setLinked: on => { set({ linked: on }); log(on ? 'Trigger linked to the AI desks.' : 'Trigger unlinked: AI desks wait for a click.'); },

    loadFile: async file => {
      if (ref.current.running) { notify('Wait for the AI desks to finish.'); return; }
      try {
        const rows = await readSheet(file);
        if (rows.length < 2) throw new Error('No rows found. The first row should hold column names, one complaint per row.');
        const list = rowsToComplaints(rows);
        if (!list.length) throw new Error('No complaint text found. Name a column “complaint_text”, or use the template.');
        const kept = list.slice(0, MAX_COMPLAINTS);
        set({ pending: kept, source: `${kept.length} complaints from ${file.name}` });
        log(`Uploaded ${file.name}: ${kept.length} complaints read${list.length > MAX_COMPLAINTS ? ` (first ${MAX_COMPLAINTS} kept)` : ''}.`);
        notify(`${kept.length} complaints loaded from ${file.name}.`);
        fireTrigger();
      } catch (e) {
        notify(e.message || 'Could not read that file.');
        log('Upload failed: ' + (e.message || file.name));
      }
    },
    loadSamples: () => { set({ pending: CX, source: SAMPLE_SOURCE }); log('Back to the 20 sample complaints.'); fireTrigger(); },

    toggleApprove: id => {
      const s = ref.current, on = !s.approved.includes(id);
      set({ approved: on ? [...s.approved, id] : s.approved.filter(x => x !== id) });
      if (on && needsPerson(s.res[id])) log(`${id} approved by the officer after personal review.`);
    },
    approveRoutine: () => {
      const s = ref.current;
      const ids = Object.entries(s.res).filter(([id, r]) => !needsPerson(r) && !s.sent.includes(id) && !s.approved.includes(id)).map(([id]) => id);
      set({ approved: [...s.approved, ...ids] });
      log(`${ids.length} routine replies approved in bulk by the branch officer. Urgent, unclear and flagged items still need a person.`);
    },
    send: () => {
      const s = ref.current;
      set({ sent: [...s.sent, ...s.approved], approved: [] });
      log(`${s.approved.length} approved replies sent and logged on the file.`);
    },
    sampleAudit: () => {
      const picked = [...ref.current.sent].sort(() => Math.random() - 0.5).slice(0, 3);
      set({ audit: picked });
      log('Second officer sampled ' + picked.join(', ') + ' to check the approvals were real.');
    },

    downloadTemplate: () => saveSheet('complaints_template', [
      ['id', 'received', 'channel', 'district', 'complaint_text'],
      ['C-201', '2026-11-18 09:00', 'Citizen portal', 'Lahore', 'Example: the street light outside the school has not worked for a week.'],
      ['C-202', '2026-11-18 09:30', 'Letter', 'Kasur', 'Example: garbage is being burned at night near the canal.'],
    ], 'Complaints'),
    exportResults: () => {
      const s = ref.current;
      saveSheet('complaint_triage_results', [
        ['id', 'received', 'channel', 'district', 'complaint_text', 'category', 'urgency', 'route_to', 'summary', 'flagged_injection', 'draft_reply', 'status', 'classified_by'],
        ...s.inbox.map(c => {
          const r = s.res[c.id] || {};
          const status = s.sent.includes(c.id) ? 'sent' : s.approved.includes(c.id) ? 'approved' : r.category ? 'in review queue' : 'not processed';
          return [c.id, c.received || '', c.channel || '', c.district, c.text, r.category || '', r.urgency || '', r.branch || '', r.summary || '', r.injection ? 'yes' : '', r.reply || '', status, r.by || ''];
        }),
      ], 'Triage');
    },
  };
}
