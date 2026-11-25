/* State and actions for the Agent tab.
   A workflow follows fixed steps; here the agent gets a goal, tools and limits, chooses its own steps,
   and always stops by handing the draft to the Secretary. */
import { useRef, useState } from 'react';
import { DOCS, CX, CX_REC } from './data.js';
import { AG_QUESTION, AG_ARCHIVE, AG_WINGS, AG_TOOLS, recordedDraft, agentBrief } from './agentData.js';
import { askWithTools, server } from './api.js';
import { now } from './useChain.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const LIMIT = 'LIMIT';
const LIMIT_MSG = 'Step limit reached. Call escalate_to_secretary now with what you have.';
const noCommas = t => t.replace(/(\d),(\d)/g, '$1$2');

const initialState = () => ({
  goal: AG_QUESTION,
  allowed: AG_TOOLS.map(t => t.name),
  max: 12,
  running: false,
  phase: '',        // goal | think | act | observe | escalate | secretary
  tools: 0,         // tool calls used
  trace: [],        // { kind: note|tool|warn|esc, tag, text, name, input, result }
  draft: '',
  escalated: null,  // { reason, summary }
  feedback: '',
  signed: '',
  lastMode: '',
});

export function useAgent() {
  const [state, setState] = useState(initialState);
  const ref = useRef(state);
  const seen = useRef(''); // everything the tools returned: the sources check_reply checks against
  const set = patch => {
    const s = ref.current;
    ref.current = { ...s, ...(typeof patch === 'function' ? patch(s) : patch) };
    setState(ref.current);
  };
  const addTrace = entry => set(s => ({ trace: [...s.trace, entry] }));
  const note = (tag, text, kind = 'note') => addTrace({ kind, tag, text });

  /* ---------- The tools: real functions over the sample data ---------- */
  function runTool(name, input = {}) {
    const s = ref.current;
    if (!s.allowed.includes(name)) return 'This tool is not permitted for this agent.';
    const remember = text => { seen.current += '\n' + text; return text; };

    if (name === 'search_past_replies') {
      const words = String(input.query || '').toLowerCase().split(/\W+/).filter(w => w.length > 2);
      const hits = AG_ARCHIVE
        .map(a => ({ a, score: words.filter(w => (a.subject + ' ' + a.text).toLowerCase().includes(w)).length }))
        .filter(x => x.score > 0).sort((x, y) => y.score - x.score);
      return remember(hits.length ? hits.map(h => `${h.a.id}: ${h.a.subject}\n${h.a.text}`).join('\n\n') : 'No past replies matched.');
    }
    if (name === 'read_document') {
      const doc = DOCS[{ doc1: 0, doc2: 1, doc3: 2 }[input.doc_id]];
      return doc ? remember(doc.text) : 'Unknown document. Use doc1, doc2 or doc3.';
    }
    if (name === 'query_complaints') {
      const cat = String(input.category || '').toLowerCase(), dis = String(input.district || '').toLowerCase();
      const districtOf = id => CX.find(c => c.id === id).district;
      const rows = CX_REC.filter(r => (!cat || r.category.includes(cat) || cat.includes(r.category)) && (!dis || districtOf(r.id).toLowerCase() === dis));
      return remember(`${rows.length} complaint(s) received on 17 November`
        + (cat ? ` in category "${input.category}"` : '') + (dis ? ` in ${input.district}` : '')
        + (rows.length ? ':\n' + rows.map(r => `${r.id} (${districtOf(r.id)}): ${r.summary}`).join('\n') : '.'));
    }
    if (name === 'request_information') {
      const wing = AG_WINGS.find(w => w.match.test(input.wing || '') || w.match.test(input.question || ''));
      return remember(wing ? wing.reply : `Request sent to ${input.wing || 'the wing'} (simulated). No reply yet: expected within 48 hours.`);
    }
    if (name === 'draft_reply') {
      const draft = String(input.reply || '');
      set({ draft });
      return `Draft saved (${draft.split(/\s+/).filter(Boolean).length} words).`;
    }
    if (name === 'check_reply') {
      if (!s.draft) return 'No draft saved yet.';
      const sources = noCommas(seen.current + '\n' + s.goal);
      const numbers = [...new Set(noCommas(s.draft).match(/\d+(\.\d+)?/g) || [])];
      const missing = numbers.filter(n => !new RegExp('(^|[^\\d.])' + n.replace('.', '\\.') + '(?![\\d])').test(sources));
      return missing.length
        ? `Numbers with no source: ${missing.join(', ')}. Correct or remove them before escalating.`
        : `All ${numbers.length} numbers in the draft were found in the sources.`;
    }
    if (name === 'escalate_to_secretary') {
      set({ escalated: { reason: String(input.reason || ''), summary: String(input.summary || '') } });
      return 'Escalated to the Secretary. Stop now; reply with one short closing line.';
    }
    return 'Unknown tool.';
  }

  /* One logged tool call: Act, then Observe */
  async function callTool(name, input) {
    const step = ref.current.tools + 1;
    set(s => ({ phase: 'act', tools: step, trace: [...s.trace, { kind: 'tool', tag: 'Step ' + step, name, input }] }));
    const index = ref.current.trace.length - 1;
    await sleep(250);
    const result = runTool(name, input);
    set(s => ({ phase: 'observe', trace: s.trace.map((t, i) => (i === index ? { ...t, result } : t)) }));
    return result;
  }

  /* ---------- Replay: a recorded run that adapts to the tools you allow and the step limit ---------- */
  async function replay() {
    const { max } = ref.current;
    const has = name => ref.current.allowed.includes(name);
    const think = async text => { set({ phase: 'think' }); note('Thinking', text); await sleep(650); };
    /* keeps one call in reserve so the agent can always escalate */
    const step = async (name, input) => (ref.current.tools >= max - 1 ? LIMIT : has(name) ? callTool(name, input) : null);

    await think('Plan: check how similar questions were answered, read this week’s report and the press release, confirm any conflicting figure, count the complaints, draft in the standard form, check every number, then hand to the Secretary.');
    let r = await step('search_past_replies', { query: 'smog Lahore measures units sealed' });
    if (r && r !== LIMIT) await think('PAQ-118 gives the standard form for this reply. Its figures are from last year, so I will not reuse them.');
    if (r !== LIMIT) r = await step('read_document', { doc_id: 'doc1' });
    if (r !== LIMIT) r = await step('read_document', { doc_id: 'doc3' });

    let confirmed = false, complaints = null;
    if (r !== LIMIT) {
      await think('Conflict: the situation report says 38 units were sealed; the press release says 45. I must not choose one myself.');
      if (has('request_information')) {
        r = await step('request_information', { wing: 'Environment Protection Department, Monitoring Cell', question: 'Please confirm the number of industrial units sealed in Week 46: 38 (situation report) or 45 (press release)?' });
        if (r && r !== LIMIT) { confirmed = true; await think('Confirmed: 38. The press release counted 7 units from the previous week.'); }
      } else await think('I am not permitted to ask the wing, so I cannot confirm the figure. I will report both figures and flag it.');
    }
    if (r !== LIMIT && has('query_complaints')) {
      r = await step('query_complaints', { category: 'smog and burning' });
      if (r && r !== LIMIT) complaints = (r.match(/^(\d+)/) || [])[1];
    } else if (r !== LIMIT) await think('I cannot query the complaint system, so part (c) will say the information is being collected.');
    if (r !== LIMIT) r = await step('read_document', { doc_id: 'doc2' });
    if (r !== LIMIT) {
      await think('Doc 2 has proposals, not decisions, and no budget. I will say the measures are under consideration and commit no funds.');
      r = await step('draft_reply', { reply: recordedDraft(confirmed, complaints) });
    }
    if (r !== LIMIT) r = await step('check_reply', {});
    if (r === LIMIT) note('Step limit', 'The step limit was reached before the work was finished. The agent must stop and hand over what it has.', 'warn');

    const reason = r === LIMIT ? 'Step limit reached before the draft was complete. Needs an officer to finish it.'
      : confirmed ? 'Draft ready. All figures checked against sources; the press release figure (45) was confirmed wrong by the Monitoring Cell.'
      : 'Draft ready, but the number of units sealed could not be confirmed (38 vs 45). Needs a decision before submission.';
    await callTool('escalate_to_secretary', { reason, summary: 'Reply to the starred question on smog measures in Lahore Division.' });
  }

  /* ---------- Live: Claude chooses the tools, one turn at a time ---------- */
  async function live() {
    const s = ref.current;
    const tools = AG_TOOLS.filter(t => s.allowed.includes(t.name));
    const messages = [{ role: 'user', content: agentBrief(s) }];
    for (let turn = 0; turn < s.max + 3 && !ref.current.escalated; turn++) {
      set({ phase: 'think' });
      const reply = await askWithTools(messages, tools);
      messages.push({ role: 'assistant', content: reply.content });
      reply.content.filter(b => b.type === 'text' && b.text.trim()).forEach(b => note('Thinking', b.text.trim()));
      const calls = reply.content.filter(b => b.type === 'tool_use');
      if (!calls.length) break;
      const results = [];
      for (const c of calls) {
        const out = ref.current.tools >= s.max && c.name !== 'escalate_to_secretary' ? LIMIT_MSG : await callTool(c.name, c.input);
        results.push({ type: 'tool_result', tool_use_id: c.id, content: out });
      }
      messages.push({ role: 'user', content: results });
    }
  }

  async function run(feedback = '') {
    if (ref.current.running) return;
    seen.current = '';
    set(s => ({
      running: true, phase: 'goal', tools: 0, escalated: null, signed: '', feedback,
      draft: feedback ? s.draft : '',
      trace: [{ kind: 'note', tag: 'Goal', text: feedback ? 'Revise the draft using the Secretary’s note.' : 'Prepare a draft reply to the Assembly question, ready for the Secretary.' }],
    }));
    let mode = 'replay';
    try {
      if (server.live) { mode = 'live'; await live(); } else await replay();
    } catch (e) {
      console.error(e);
      note('Live run failed', `${e.message || 'Connection failed'}. Showing the recorded run instead.`, 'warn');
      seen.current = '';
      set({ tools: 0, escalated: null });
      mode = 'replay';
      await replay();
    }
    if (!ref.current.escalated) {
      note('Stopped', 'The agent ended without escalating. A person must review what it produced.', 'warn');
      set({ escalated: { reason: 'The agent stopped without escalating.' } });
    }
    note('Escalated', ref.current.escalated.reason || 'Handed to the Secretary.', 'esc');
    if (mode === 'replay' && feedback) note('Note', 'Replay mode cannot rewrite from your note; run it live to see the agent revise.');
    set({ running: false, phase: 'secretary', lastMode: mode });
  }

  return {
    state,
    brief: agentBrief(state),
    setGoal: goal => set({ goal }),
    setMax: max => set({ max }),
    toggleTool: name => set(s => ({ allowed: s.allowed.includes(name) ? s.allowed.filter(n => n !== name) : [...s.allowed, name] })),
    run: () => run(''),
    sendBack: text => run(text),
    approve: () => set({ signed: now(), phase: 'secretary' }),
    reset: () => set(s => ({ ...initialState(), goal: s.goal, allowed: s.allowed, max: s.max })),
  };
}
