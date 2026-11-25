# Workflow Studio (React)

React + Vite version of `WorkflowStudio.html`, with a name + PIN sign-in.

## Run

```bash
npm install
npm run dev        # development: http://localhost:5173
npm run build      # build the site into dist/
npm start          # production server: http://localhost:3000 (run build first)
```

## The six exercises

After sign-in, the home page shows every exercise as a card; click one to open it (the tab bar switches between them).

1. **Summary for the CM (workflow)**: a fixed chain of desks.
2. **Complaint triage (automated workflow)**: a trigger plus fixed AI desks and a review queue.
3. **Morning media brief (scheduled workflow, slide 10)**: pick a Punjab department and a time. Every morning at that
   time the server runs the brief prompt with **web search** over the last 24 hours of news, and the draft (English + Urdu)
   waits in the inbox until a person approves it or sends it back. **Run now** fires the trigger immediately for class.
   A schedule stops by itself after 7 days. Replay mode has a recorded (fictional) brief for the Environment Protection
   Department only; Live mode searches real news for any department.
4. **Agent: Assembly question (slide 12)**: you give a goal, tools and a step limit; the agent chooses its own steps
   (Think → Act → Observe), and it always stops by escalating to the Secretary.
5. **Live dashboard**: charts that follow exercises 1 and 2.
6. **Air quality dashboard (prompt to dashboard)**: the class exercise prompt (copy button) and the CSV to download, plus
   a reference dashboard calculated in the browser from the same file: headline, Lahore 2025 KPIs, map with a year
   selector, monthly line, heatmap and city ranking. *Check your answer* shows Lahore's 2025 average PM2.5
   (**68.7 µg/m³**). People can also load their own copy of the CSV.
   **Run the prompt on Claude** sends the prompt (participants can edit it first) and the CSV to Claude's code sandbox;
   Claude calculates with code and writes `dashboard.html`, which appears in a locked-down frame with Claude's answer
   checked against the file. **Run the prompt again** builds a fresh one. A live run takes about 5–10 minutes and costs
   roughly what a long chat does; at most 6 run at once across the class, one per person. In Replay mode the button
   shows a dashboard Claude built earlier from the same prompt.

## Settings (.env)

Copy `.env.example` to `.env` and fill it in. These settings stay on the server and are never sent to the browser.

| Variable | Meaning |
| --- | --- |
| `APP_PIN` | **Required.** The PIN people type, with their own name, to sign in. |
| `ANTHROPIC_API_KEY` | Empty = **replay mode only** (recorded outputs, works offline). Set = **live mode** is available: every AI desk calls Claude. |
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5` (default), `claude-haiku-5-5` or `claude-opus-5-5`. |
| `SESSION_SECRET` | Long random string that signs the login cookie. If empty, everyone is signed out whenever the server restarts. |

| `BRIEF_TIMEZONE` | Clock the morning brief trigger follows. Default `Asia/Karachi`. |
| `DATA_DIR` | Where brief schedules and drafts are saved (`briefs.json`). Default `data`. |

Restart the server after changing `.env`.

**Live / Replay switch (top right).** When a key is set, each person can switch between
**Live: Claude API** and **Replay: recorded outputs** at any time, for example to fall back to replay
if the venue Wi-Fi drops. Live is the default; the choice is remembered in that browser.
Without a key, only Replay is available.

**Light / Dark switch** (top right, and on the sign-in page): ◐ follows the computer's setting (default),
☀ forces light, ☾ forces dark. Remembered in that browser.

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
docker compose up -d --build     # http://localhost:8383
docker compose down              # stop
```

Compose reads all settings from `.env`. The `.env` file is not copied into the image.
Brief schedules and drafts are kept in the `briefs` Docker volume, so they survive rebuilds.
Without compose:

```bash
docker build -t workflow-studio .
docker run -d --init -p 8383:8383 --env-file .env -v briefs:/app/data workflow-studio
```

## Code map

```
server/
  api.js              /api routes: sign-in (name + PIN), session cookie, Claude proxy
  index.js            production server: serves dist/ + /api (no npm packages)
  briefs.js           morning brief: daily trigger, web search call, saved schedules and drafts
  briefPrompt.js      the brief prompt and department list (shared with the browser)
  sampleBrief.js      recorded, fictional brief for Replay mode
  aqiPrompt.js        the exercise 6 prompt (shared with the browser)
  dashboardRun.js     exercise 6: runs the prompt on Claude (Files API + code execution), returns dashboard.html
  recordedDashboard.html  a dashboard Claude built from the prompt, shown in Replay mode
public/demo-data/     the air quality CSV (served for download and for exercise 6)
src/
  App.jsx             checks the session, then shows Login or the studio (header, tabs, toast)
  Home.jsx            the home page: one card per exercise
  Login.jsx           name + PIN form
  api.js              browser side: session calls and Claude calls through /api
  data.js             sample documents, prompts, recorded outputs, sample complaints
  rules.js            offline keyword classifier + Excel column detection
  files.js            read PDF / Word / text / Excel / CSV, save Excel
  useChain.js         state + actions for exercise 1 (CM summary chain)
  useComplaints.js    state + actions for exercise 2 (complaint triage)
  agentData.js        exercise 4: Assembly question, past-reply archive, simulated wing replies, tool definitions
  useAgent.js         exercise 4: the agent loop (tools, recorded run, live run where Claude picks the tools)
  aqi.js              exercise 6: every AQI number, calculated from the CSV
  components/         Output (text + tables), Charts (bars, KPIs, legend)
  tabs/               CmSummary, Complaints, MorningBrief, Agent, Dashboard, AirQuality (+ AiRun: Claude's dashboard)
vite.config.js        also runs server/api.js inside `npm run dev`
Dockerfile            build with Node, run server/index.js
docker-compose.yml    one-command deploy on port 8383
```

The original single-file app (`WorkflowStudio.html` + `lib/`) is still there and still works on its own.
