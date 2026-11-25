/* Claude API calls. Without a key the app uses recorded outputs.
   Settings come from config.js (written by Docker at start-up) or, in development, from .env. */
const config = window.APP_CONFIG || {};
const KEY = config.ANTHROPIC_API_KEY || import.meta.env.VITE_ANTHROPIC_API_KEY || '';
export const MODEL = config.ANTHROPIC_MODEL || import.meta.env.VITE_ANTHROPIC_MODEL || 'claude-sonnet-5-5';
export const LIVE = !!KEY;

const URL = 'https://api.anthropic.com/v1/messages';
const HEADERS = {
  'x-api-key': KEY,
  'anthropic-version': '2023-06-01',
  'content-type': 'application/json',
  'anthropic-dangerous-direct-browser-access': 'true',
};

async function post(body) {
  const res = await fetch(URL, { method: 'POST', headers: HEADERS, body: JSON.stringify({ model: MODEL, ...body }) });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(`API error ${res.status}. ${detail?.error?.message || ''}`);
  }
  return res;
}

/* Streams the reply, calling onText with the text so far. Returns the full text, or null if not live or the call failed. */
export async function ask(prompt, onText) {
  if (!LIVE) return null;
  try {
    const res = await post({ max_tokens: 4000, stream: true, messages: [{ role: 'user', content: prompt }] });
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

/* Asks for a JSON array. Returns the parsed array, or null if not live or the call failed. */
export async function askJSON(prompt) {
  if (!LIVE) return null;
  try {
    const res = await post({ max_tokens: 6000, messages: [{ role: 'user', content: prompt + '\n\nReturn only the JSON, with no other text.' }] });
    const data = await res.json();
    const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
    return JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1));
  } catch (e) {
    console.error(e);
    return null;
  }
}
