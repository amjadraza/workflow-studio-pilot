/* Talks to our own server (/api). The server holds the Claude key and checks the sign-in. */

/* Filled in by loadSession(); read by the rest of the app */
export const server = { user: null, live: false, model: '' };

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
  Object.assign(server, await (await call('/api/session')).json());
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
