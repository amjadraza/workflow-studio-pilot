/* Production server: serves the built app from dist/ plus the /api routes. No extra packages needed.
   Start with: npm start   (reads .env if present) */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApi } from './api.js';

const DIST = fileURLToPath(new URL('../dist', import.meta.url));
const PORT = process.env.PORT || 3000;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json',
};

async function serveStatic(req, res) {
  const path = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^([/\\])+/, '');
  if (path.startsWith('..')) { res.writeHead(400).end(); return; }
  const file = path || 'index.html'; // "/" serves the home page
  try {
    const body = await readFile(join(DIST, file));
    const cache = file.startsWith('assets') ? 'public, max-age=31536000, immutable' : 'no-cache';
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': cache });
    res.end(body);
  } catch {
    res.writeHead(200, { 'content-type': TYPES['.html'], 'cache-control': 'no-cache' });
    res.end(await readFile(join(DIST, 'index.html')));
  }
}

const api = createApi(process.env);
http.createServer((req, res) => api(req, res, () => serveStatic(req, res)))
  .listen(PORT, () => console.log(`Workflow Studio on http://localhost:${PORT}`));
