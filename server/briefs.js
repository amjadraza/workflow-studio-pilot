/* Morning media brief (slide 10): a scheduled workflow.
   A trigger (every morning at the chosen time) runs one prompt with web search; the draft waits for the PRO.
   Schedules and briefs are kept in DATA_DIR/briefs.json so they survive restarts. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import crypto from 'node:crypto';
import { SAMPLE_BRIEF } from './sampleBrief.js';

import { DEPARTMENTS, SAMPLE_DEPT, briefPrompt } from './briefPrompt.js';

const SCHEDULE_DAYS = 7;   // a schedule stops by itself after a week, so a class does not leave it running
const KEEP_BRIEFS = 200;

export function createBriefs({ KEY, MODEL, DATA_DIR = 'data', TIMEZONE = 'Asia/Karachi' }) {
  const FILE = join(DATA_DIR, 'briefs.json');
  let db = { schedules: {}, briefs: [] };
  const loaded = readFile(FILE, 'utf8').then(t => { db = JSON.parse(t); }).catch(() => {});
  const save = () => mkdir(DATA_DIR, { recursive: true }).then(() => writeFile(FILE, JSON.stringify(db, null, 1)))
    .catch(e => console.error('[briefs] cannot save', e.message));

  /* "Now" in Pakistan time (or BRIEF_TIMEZONE): { date: 'YYYY-MM-DD', time: 'HH:MM' } */
  function now() {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date()).map(x => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
  }
  const addDays = (date, n) => new Date(Date.parse(date + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);

  /* One live run: Claude searches the web and writes the brief. Server tools may pause; we resume a few times. */
  async function searchAndWrite(department, today) {
    /* The basic search tool: Claude searches directly. (The newer variant filters results in code, and in tests it spent
       the whole search allowance re-running the same query.) */
    const tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 10 }];
    const messages = [{ role: 'user', content: briefPrompt(department, today) }];
    let data;
    for (let turn = 0; turn < 4; turn++) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: MODEL, max_tokens: 8000, messages, tools }),
      });
      data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Claude API error ${res.status}`);
      if (data.stop_reason !== 'pause_turn') break;
      messages.push({ role: 'assistant', content: data.content });
    }
    const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
    /* sources: what Claude cited, else what the searches returned */
    const sources = new Map();
    for (const b of data.content) {
      for (const c of b.citations || []) if (c.url) sources.set(c.url, c.title || c.url);
    }
    if (!sources.size) {
      for (const b of data.content) {
        if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) b.content.forEach(r => r.url && sources.set(r.url, r.title || r.url));
      }
    }
    if (!text) throw new Error('Claude returned no text');
    return { text, sources: [...sources].slice(0, 15).map(([url, title]) => ({ url, title })) };
  }

  /* Starts a run in the background and returns the new brief straight away (status "running") */
  function run(user, department, trigger, live) {
    const { date, time } = now();
    const brief = {
      id: crypto.randomUUID(), user, department, date, time, trigger,
      mode: live && KEY ? 'live' : 'replay', status: 'running', text: '', sources: [],
    };
    db.briefs.unshift(brief);
    db.briefs.length = Math.min(db.briefs.length, KEEP_BRIEFS);
    save();
    (async () => {
      try {
        if (brief.mode === 'live') Object.assign(brief, await searchAndWrite(department, date));
        else if (department === SAMPLE_DEPT) Object.assign(brief, { text: SAMPLE_BRIEF, sources: [] });
        else throw new Error(`Replay has a recorded brief only for the ${SAMPLE_DEPT}. Switch to Live mode to search the news for this department.`);
        brief.status = 'draft';
      } catch (e) {
        console.error('[briefs]', e.message);
        Object.assign(brief, { status: 'failed', text: e.message });
      }
      save();
    })();
    return brief;
  }

  /* The trigger: every 30 seconds, start any schedule whose time has come today */
  setInterval(async () => {
    await loaded;
    const { date, time } = now();
    for (const [user, s] of Object.entries(db.schedules)) {
      if (s.until < date) { delete db.schedules[user]; save(); continue; }
      if (s.lastRun !== date && s.time <= time) {
        s.lastRun = date;
        console.log(`[briefs] ${time} trigger: ${s.department} for ${user}`);
        run(user, s.department, 'schedule', s.live);
      }
    }
  }, 30000).unref();

  /* Routes under /api/briefs (the user is already signed in) */
  return async function route(req, res, user, path, { readJson, send }) {
    await loaded;
    const mine = () => ({
      departments: DEPARTMENTS, sampleDepartment: SAMPLE_DEPT, now: now(), timezone: TIMEZONE,
      schedule: db.schedules[user] || null,
      briefs: db.briefs.filter(b => b.user === user).slice(0, 30),
    });
    if (path === '/api/briefs' && req.method === 'GET') return send(res, 200, mine());

    const body = await readJson(req);
    const department = DEPARTMENTS.includes(body.department) ? body.department : null;

    if (path === '/api/briefs/schedule') {
      if (body.stop) delete db.schedules[user];
      else {
        if (!department || !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.time || '')) return send(res, 400, { error: 'Choose a department and a time.' });
        const { date, time } = now();
        db.schedules[user] = {
          department, time: body.time, live: !!body.live, until: addDays(date, SCHEDULE_DAYS - 1),
          lastRun: body.time <= time ? date : null, // first run: the next time the clock reaches the chosen time
        };
      }
      save();
      return send(res, 200, mine());
    }
    if (path === '/api/briefs/run') {
      if (!department) return send(res, 400, { error: 'Choose a department.' });
      if (db.briefs.some(b => b.user === user && b.status === 'running')) return send(res, 409, { error: 'A brief is already being prepared.' });
      run(user, department, 'manual', !!body.live);
      return send(res, 200, mine());
    }
    if (path === '/api/briefs/review') {
      const brief = db.briefs.find(b => b.id === body.id && b.user === user);
      if (!brief || brief.status !== 'draft') return send(res, 400, { error: 'This brief cannot be reviewed now.' });
      Object.assign(brief, {
        status: body.decision === 'approved' ? 'approved' : 'returned',
        reviewer: user, reviewedAt: `${now().date} ${now().time}`, note: String(body.note || '').slice(0, 500),
      });
      save();
      return send(res, 200, mine());
    }
    send(res, 404, { error: 'Not found' });
  };
}
