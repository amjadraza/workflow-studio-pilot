/* The /api routes: name + PIN login, and a Claude proxy so the API key never reaches the browser.
   Used by the production server (server/index.js) and by `npm run dev` (vite.config.js). */
import crypto from 'node:crypto';
import { createBriefs } from './briefs.js';
import { createDashboardRun } from './dashboardRun.js';

const COOKIE = 'ws_session';
const SESSION_HOURS = 12;
const MAX_FAILS = 5;             // wrong PINs allowed per IP...
const LOCK_MINUTES = 5;          // ...before a short lock-out
const MAX_BODY = 5 * 1024 * 1024;

export function createApi(env) {
  const PIN = String(env.APP_PIN || '').trim();
  const KEY = env.ANTHROPIC_API_KEY || '';
  const MODEL = env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
  /* Without a fixed secret, everyone is signed out when the server restarts */
  const SECRET = env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
  const fails = new Map(); // ip -> { count, until }
  /* the scheduled morning media brief (its own file: server/briefs.js) */
  const briefs = createBriefs({ KEY, MODEL, DATA_DIR: env.DATA_DIR || 'data', TIMEZONE: env.BRIEF_TIMEZONE || 'Asia/Karachi' });
  /* exercise 6: run the dashboard prompt on Claude (server/dashboardRun.js) */
  const dashboard = createDashboardRun({ KEY, MODEL });

  if (!PIN) console.warn('[auth] APP_PIN is not set: nobody can sign in. Add it to .env.');

  const sign = value => crypto.createHmac('sha256', SECRET).update(value).digest('base64url');
  const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

  function makeCookie(req, value, maxAge) {
    const secure = req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted ? '; Secure' : '';
    return `${COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`;
  }

  /* Returns the signed-in name, or null */
  function currentUser(req) {
    const match = new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`).exec(req.headers.cookie || '');
    if (!match) return null;
    const [data, sig] = match[1].split('.');
    if (!data || !sig || !same(sign(data), sig)) return null;
    try {
      const { name, exp } = JSON.parse(Buffer.from(data, 'base64url').toString());
      return exp > Date.now() ? name : null;
    } catch { return null; }
  }

  async function readJson(req) {
    let size = 0, body = '';
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BODY) throw new Error('Request too large');
      body += chunk;
    }
    return JSON.parse(body || '{}');
  }

  const send = (res, status, data, headers = {}) => {
    res.writeHead(status, { 'content-type': 'application/json', ...headers });
    res.end(JSON.stringify(data));
  };

  async function login(req, res) {
    const ip = req.socket.remoteAddress;
    const f = fails.get(ip);
    if (f && f.until > Date.now()) return send(res, 429, { error: `Too many wrong PINs. Try again in ${LOCK_MINUTES} minutes.` });

    const { name = '', pin = '' } = await readJson(req);
    const cleanName = String(name).trim().slice(0, 40);
    if (!cleanName) return send(res, 400, { error: 'Enter your name.' });
    if (!PIN) return send(res, 503, { error: 'No PIN is set on the server (APP_PIN in .env).' });

    if (!same(String(pin).trim(), PIN)) {
      const count = (f?.count || 0) + 1;
      fails.set(ip, { count: count >= MAX_FAILS ? 0 : count, until: count >= MAX_FAILS ? Date.now() + LOCK_MINUTES * 60000 : 0 });
      return send(res, 401, { error: 'Wrong PIN.' });
    }
    fails.delete(ip);
    const data = Buffer.from(JSON.stringify({ name: cleanName, exp: Date.now() + SESSION_HOURS * 3600000 })).toString('base64url');
    console.log(`[auth] ${cleanName} signed in from ${ip}`);
    send(res, 200, { user: cleanName }, { 'set-cookie': makeCookie(req, `${data}.${sign(data)}`, SESSION_HOURS * 3600) });
  }

  /* Forward a Messages API request to Claude, streaming the answer back */
  async function claude(req, res) {
    if (!KEY) return send(res, 503, { error: 'Replay mode: no API key on the server.' });
    const { messages, max_tokens, stream, tools } = await readJson(req);
    const body = { model: MODEL, messages, stream: !!stream, max_tokens: Math.min(Number(max_tokens) || 4000, 8000) };
    if (Array.isArray(tools) && tools.length) body.tools = tools.slice(0, 20); // the Agent tab's tools
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    res.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') || 'application/json' });
    for await (const chunk of upstream.body) res.write(chunk);
    res.end();
  }

  /* Connect-style middleware: handles /api/*, passes everything else on */
  return async function api(req, res, next) {
    const path = req.url.split('?')[0];
    if (!path.startsWith('/api/')) return next();
    try {
      if (path === '/api/session' && req.method === 'GET') return send(res, 200, { user: currentUser(req), live: !!KEY, model: MODEL });
      if (path === '/api/login' && req.method === 'POST') return await login(req, res);
      if (path === '/api/logout' && req.method === 'POST') return send(res, 200, {}, { 'set-cookie': makeCookie(req, '', 0) });
      if (path === '/api/claude' && req.method === 'POST') {
        if (!currentUser(req)) return send(res, 401, { error: 'Please sign in again.' });
        return await claude(req, res);
      }
      if (path.startsWith('/api/dashboard')) {
        const user = currentUser(req);
        if (!user) return send(res, 401, { error: 'Please sign in again.' });
        return await dashboard(req, res, user, path, { readJson, send });
      }
      if (path.startsWith('/api/briefs')) {
        const user = currentUser(req);
        if (!user) return send(res, 401, { error: 'Please sign in again.' });
        return await briefs(req, res, user, path, { readJson, send });
      }
      send(res, 404, { error: 'Not found' });
    } catch (e) {
      console.error('[api]', e);
      if (!res.headersSent) send(res, 500, { error: 'Server error' }); else res.end();
    }
  };
}
