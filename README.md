# Workflow Studio (React)

React + Vite version of `WorkflowStudio.html`, with a name + PIN sign-in.

## Run

```bash
npm install
npm run dev        # development: http://localhost:5173
npm run build      # build the site into dist/
npm start          # production server: http://localhost:3000 (run build first)
```

## The four tabs

1. **Summary for the CM (chain)**: a fixed chain of desks (workflow).
2. **Complaint triage (automated)**: a trigger plus fixed AI desks and a review queue (workflow).
3. **Agent: Assembly question**: the agent brief from slide 12. You give a goal, tools and a step limit; the agent
   chooses its own steps (Think → Act → Observe), and it always stops by escalating to the Secretary.
   Untick tools or set the limit to 6 to see how it adapts.
4. **Live dashboard**: charts that follow tabs 1 and 2.

## Settings (.env)

Copy `.env.example` to `.env` and fill it in. These settings stay on the server and are never sent to the browser.

| Variable | Meaning |
| --- | --- |
| `APP_PIN` | **Required.** The PIN people type, with their own name, to sign in. |
| `ANTHROPIC_API_KEY` | Empty = **replay mode** (recorded outputs, works offline). Set = **live mode**: every AI desk calls Claude. |
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5` (default), `claude-haiku-5-5` or `claude-opus-5-5`. |
| `SESSION_SECRET` | Long random string that signs the login cookie. If empty, everyone is signed out whenever the server restarts. |

Restart the server after changing `.env`.

## Sign-in

- Anyone with the PIN can sign in by typing their name and the PIN. The name is shown in the header.
- A session lasts 12 hours; **Sign out** ends it sooner.
- After 5 wrong PINs from one address, sign-in is locked for 5 minutes.
- The Claude key stays on the server: the browser calls `/api/claude`, which works only for signed-in users.
- To lock everyone out, change `APP_PIN` and `SESSION_SECRET`, then restart.

This is basic protection for a training session, not individual user accounts: everyone shares the same PIN.
On the internet, put it behind HTTPS (for example a reverse proxy such as Caddy or nginx with a certificate).

## Deploy with Docker

```bash
docker compose up -d --build     # http://localhost:8080
docker compose down              # stop
```

Compose reads all settings from `.env`. The `.env` file is not copied into the image.
Without compose:

```bash
docker build -t workflow-studio .
docker run -d -p 8080:3000 --env-file .env workflow-studio
```

## Code map

```
server/
  api.js              /api routes: sign-in (name + PIN), session cookie, Claude proxy
  index.js            production server: serves dist/ + /api (no npm packages)
src/
  App.jsx             checks the session, then shows Login or the studio (header, tabs, toast)
  Login.jsx           name + PIN form
  api.js              browser side: session calls and Claude calls through /api
  data.js             sample documents, prompts, recorded outputs, sample complaints
  rules.js            offline keyword classifier + Excel column detection
  files.js            read PDF / Word / text / Excel / CSV, save Excel
  useChain.js         state + actions for tab 1 (CM summary chain)
  useComplaints.js    state + actions for tab 2 (complaint triage)
  agentData.js        tab 3: Assembly question, past-reply archive, simulated wing replies, tool definitions
  useAgent.js         tab 3: the agent loop (tools, recorded run, live run where Claude picks the tools)
  components/         Output (text + tables), Charts (bars, KPIs, legend)
  tabs/               CmSummary, Complaints, Agent, Dashboard
vite.config.js        also runs server/api.js inside `npm run dev`
Dockerfile            build with Node, run server/index.js
docker-compose.yml    one-command deploy on port 8080
```

The original single-file app (`WorkflowStudio.html` + `lib/`) is still there and still works on its own.
