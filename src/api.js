/* Talks to our own server (/api). The server holds the Claude key and checks the sign-in. */

/* Filled in by loadSession(); read by the rest of the app.
   hasKey: the server has an API key.  live: the mode the person chose (Live only possible with a key). */
export const server = { user: null, hasKey: false, live: false, model: '' };
const MODE_KEY = 'workflow-studio-mode';

/* Switch between Live (Claude API) and Replay (recorded outputs); remembered in this browser */
export function setLive(on) {
  server.live = server.hasKey && on;
  try { localStorage.setItem(MODE_KEY, server.live ? 'live' : 'replay'); } catch { /* storage blocked: still works for this visit */ }
}

/* What to tell people who need live mode for something */
export const liveHint = () => (server.hasKey ? 'switch to Live mode (top right)' : 'add ANTHROPIC_API_KEY to .env');

async function call(path, body) {
  const res = await fetch(path, body === undefined ? {} : {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.error || `Server error ${res.status}`);
  }
  return res;
}

export async function loadSession() {
  const session = await (await call('/api/session')).json();
  let saved = null;
  try { saved = localStorage.getItem(MODE_KEY); } catch { /* storage blocked */ }
  Object.assign(server, { user: session.user, model: session.model, hasKey: session.live });
  server.live = session.live && saved !== 'replay'; // default: Live when a key is set
  return server.user;
}
export async function login(name, pin) {
  server.user = (await (await call('/api/login', { name, pin })).json()).user;
  return server.user;
}
export async function logout() {
  await call('/api/logout', {});
  server.user = null;
}

/* The morning media brief: schedule, run now, review. Each call returns this person's schedule and briefs. */
export const briefsApi = (action, body) => call('/api/briefs' + (action ? '/' + action : ''), body).then(r => r.json());

/* Exercise 6: run the dashboard prompt on Claude (server-side, takes minutes) and poll for the result */
export const dashboardApi = (action, body) => call('/api/dashboard' + (action ? '/' + action : ''), body).then(r => r.json());

/* Streams the reply, calling onText with the text so far. Returns the full text, or null if not live or the call failed. */
export async function ask(prompt, onText) {
  if (!server.live) return null;
  try {
    const res = await call('/api/claude', { max_tokens: 4000, stream: true, messages: [{ role: 'user', content: prompt }] });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '', text = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const event = JSON.parse(line.slice(5));
        if (event.type === 'error') throw new Error(event.error?.message || 'Stream error');
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          text += event.delta.text;
          onText(text);
        }
      }
    }
    return text;
  } catch (e) {
    console.error(e);
    return null;
  }
}

/* One agent turn: sends the conversation and the allowed tools, returns Claude's reply (content blocks). Throws on failure. */
export async function askWithTools(messages, tools) {
  const res = await call('/api/claude', { max_tokens: 2000, messages, tools });
  return res.json();
}

/* Asks for a JSON array. Returns the parsed array, or null if not live or the call failed. */
export async function askJSON(prompt) {
  if (!server.live) return null;
  try {
    const res = await call('/api/claude', { max_tokens: 6000, messages: [{ role: 'user', content: prompt + '\n\nReturn only the JSON, with no other text.' }] });
    const data = await res.json();
    const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
    return JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1));
  } catch (e) {
    console.error(e);
    return null;
  }
}
