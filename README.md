# Workflow Studio (React)

React + Vite version of `WorkflowStudio.html`.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
```

## Settings (.env)

Copy `.env.example` to `.env` (already done) and edit:

| Variable | Meaning |
| --- | --- |
| `VITE_ANTHROPIC_API_KEY` | Empty = **replay mode** (recorded outputs, works offline). Set = **live mode**: every AI desk calls Claude. |
| `VITE_ANTHROPIC_MODEL` | `claude-sonnet-5-5` (default), `claude-haiku-5-5` or `claude-opus-5-5`. |

Restart `npm run dev` after changing `.env`.

> **Warning:** Vite builds `VITE_` variables into the page, so anyone who opens the
> app can read the key. Use a training key with a low spending limit, and never
> deploy a `dist/` build that contains a real key.

## Deploy with Docker

```bash
docker compose up -d --build     # http://localhost:8080
docker compose down              # stop
```

Compose takes the key and model from `.env`. Without compose:

```bash
docker build -t workflow-studio .
docker run -d -p 8080:80 -e ANTHROPIC_API_KEY=sk-ant-... -e ANTHROPIC_MODEL=claude-sonnet-5-5 workflow-studio
```

The image is a static build served by nginx. The key is **not** in the image: at start-up,
[docker/write-config.sh](docker/write-config.sh) writes `config.js` from the environment variables,
so you can change the key by restarting the container (no rebuild). Leave `ANTHROPIC_API_KEY` empty for replay mode.

> The key is still sent to every browser that opens the page (it is in `config.js`).
> Only run live mode on a private network or behind a login, with a training key.

## Code map

```
src/
  App.jsx             header, tabs, toast
  api.js              Claude API calls (reads .env)
  data.js             sample documents, prompts, recorded outputs, sample complaints
  rules.js            offline keyword classifier + Excel column detection
  files.js            read PDF / Word / text / Excel / CSV, save Excel
  useChain.js         state + actions for tab 1 (CM summary chain)
  useComplaints.js    state + actions for tab 2 (complaint triage)
  components/         Output (text + tables), Charts (bars, KPIs, legend)
  tabs/               CmSummary, Complaints, Dashboard
public/config.js      runtime settings (overwritten by Docker)
Dockerfile            build with Node, serve with nginx
docker/               nginx config + start-up script that writes config.js
docker-compose.yml    one-command deploy on port 8080
```

The original single-file app (`WorkflowStudio.html` + `lib/`) is still there and still works on its own.
