/* Exercise 6, "Run the prompt": Claude gets the CSV in its code sandbox, runs the class prompt, and writes dashboard.html.
   Runs in the background (it takes a few minutes); the browser polls for the result. One run at a time per person. */
import https from 'node:https';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { CSV_FILE } from './aqiPrompt.js';

const MAX_RUNNING = 6;          // across the class, to keep cost and rate limits in check
const MAX_PROMPT = 8000;        // characters; participants may edit the prompt
/* Replay: a dashboard Claude built earlier from the same prompt. Kept out of public/ so it is only ever shown in the sandboxed frame. */
const RECORDED = new URL('./recordedDashboard.html', import.meta.url);
/* the built site (Docker / npm start) or the source folder (npm run dev) */
const ROOTS = ['../dist/', '../public/'].map(p => fileURLToPath(new URL(p, import.meta.url)));
const readSite = async path => {
  for (const root of ROOTS) { try { return await readFile(root + path); } catch { /* try the next folder */ } }
  throw new Error(`${path} not found`);
};

const HOW = `

(Practical notes from the training app: the CSV is attached in your code environment. Do the calculations with code.
Save the finished page as a file named dashboard.html. After the file is saved, reply in a few short lines: Lahore's 2025
average PM2.5, then anything you could not do.)`;

export function createDashboardRun({ KEY, MODEL }) {
  const runs = new Map(); // user -> { status, startedAt, seconds, html, answer, error, mode }
  let fileId = null;      // the CSV, uploaded to the Files API once per server start

  /* HTTPS with no client timeout: a code-execution turn can take several minutes before the first byte */
  function api(method, path, body, headers = {}) {
    return new Promise((resolve, reject) => {
      const req = https.request({
        host: 'api.anthropic.com', path, method,
        headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', ...headers },
      }, res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          if (res.statusCode >= 400) {
            let msg = `Claude API error ${res.statusCode}`;
            try { msg = JSON.parse(buf).error?.message || msg; } catch { /* not JSON */ }
            return reject(new Error(msg));
          }
          resolve(buf);
        });
      });
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }
  const json = async (...a) => JSON.parse(await api(...a));

  async function uploadCsv() {
    if (fileId) return fileId;
    const csv = await readSite('demo-data/' + CSV_FILE);
    const boundary = '----ws' + Date.now();
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${CSV_FILE}"\r\nContent-Type: text/csv\r\n\r\n`),
      csv, Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    fileId = (await json('POST', '/v1/files', body, { 'content-type': `multipart/form-data; boundary=${boundary}` })).id;
    return fileId;
  }

  async function runLive(prompt) {
    const messages = [{ role: 'user', content: [{ type: 'text', text: prompt + HOW }, { type: 'container_upload', file_id: await uploadCsv() }] }];
    let container, answer = '';
    const made = []; // file ids Claude created
    for (let turn = 0; turn < 8; turn++) {
      const req = { model: MODEL, max_tokens: 32000, messages, tools: [{ type: 'code_execution_20260521', name: 'code_execution' }] };
      if (container) req.container = container;
      const data = await json('POST', '/v1/messages', JSON.stringify(req), { 'content-type': 'application/json' });
      container = data.container?.id || container;
      for (const b of data.content) {
        if (b.type === 'text') answer += b.text;
        for (const f of b.content?.content || []) if (f.file_id) made.push(f.file_id);
      }
      if (data.stop_reason !== 'pause_turn') break;
      messages.push({ role: 'assistant', content: data.content });
    }
    /* the newest .html file Claude saved */
    for (const id of made.reverse()) {
      const meta = await json('GET', `/v1/files/${id}`);
      if (/\.html?$/i.test(meta.filename)) return { html: (await api('GET', `/v1/files/${id}/content`)).toString('utf8'), answer: answer.trim() };
    }
    const inline = /<!doctype html[\s\S]*<\/html>/i.exec(answer); // fallback: the page written straight into the reply
    if (inline) return { html: inline[0], answer: answer.replace(inline[0], '').trim() };
    throw new Error(answer.trim().slice(0, 600) || 'Claude did not produce dashboard.html. Try running it again.');
  }

  async function runReplay() {
    const html = await readFile(RECORDED, 'utf8');
    const answer = /<!--\s*ANSWER:([\s\S]*?)-->/.exec(html)?.[1].trim() || '';
    return { html, answer };
  }

  return async function route(req, res, user, path, { readJson, send }) {
    const view = () => {
      const r = runs.get(user);
      if (!r) return { run: null };
      return { run: { ...r, seconds: Math.round(((r.endedAt || Date.now()) - r.startedAt) / 1000) } };
    };
    if (path === '/api/dashboard' && req.method === 'GET') return send(res, 200, view());
    if (path === '/api/dashboard/run' && req.method === 'POST') {
      const body = await readJson(req);
      const prompt = String(body.prompt || '').trim().slice(0, MAX_PROMPT);
      if (!prompt) return send(res, 400, { error: 'The prompt is empty.' });
      if (runs.get(user)?.status === 'running') return send(res, 409, { error: 'Your dashboard is still being built.' });
      const live = !!body.live && !!KEY;
      if (live && [...runs.values()].filter(r => r.status === 'running' && r.mode === 'live').length >= MAX_RUNNING) {
        return send(res, 429, { error: `${MAX_RUNNING} dashboards are being built right now. Try again in a few minutes.` });
      }
      const run = { status: 'running', mode: live ? 'live' : 'replay', startedAt: Date.now(), html: '', answer: '', error: '' };
      runs.set(user, run);
      (live ? runLive(prompt) : runReplay())
        .then(r => Object.assign(run, r, { status: 'done' }))
        .catch(e => { console.error('[dashboard]', e.message); Object.assign(run, { status: 'failed', error: e.message }); })
        .finally(() => { run.endedAt = Date.now(); });
      return send(res, 200, view());
    }
    send(res, 404, { error: 'Not found' });
  };
}
