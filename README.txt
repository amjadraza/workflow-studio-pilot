WORKFLOW STUDIO, STANDALONE EDITION
Session: From Prompt to Workflow to Agent (Datafy Associates)

WHAT IT IS
One file, WorkflowStudio.html. It runs in any modern browser (Chrome, Edge,
Firefox, Safari) with nothing to install and no Claude login.

HOW TO START
1. Copy this folder to the presentation laptop (Desktop is fine).
2. Double-click WorkflowStudio.html. It opens in the default browser.
3. Press F11 for full screen. Zoom with Ctrl + / Ctrl - if the room is large.

TWO MODES
Replay (default): uses recorded outputs for every AI desk. Needs no internet.
  Use this if the venue Wi-Fi is unreliable. The badge reads
  "Replay: recorded outputs".
Live: every AI desk calls Claude through the Anthropic API.
  1. Click "Live mode settings" (top right).
  2. Paste your Anthropic API key (from console.anthropic.com) and pick a model.
     Claude Sonnet 5.5 is recommended; Haiku 5.5 is faster.
  3. Click "Save and test connection". The badge changes to "Live: Claude API".
  If a live call fails during the demo, that desk falls back to its recorded
  output automatically, and the badge says so for a few seconds.

KEY SAFETY
- The key is sent only to api.anthropic.com, directly from this browser.
- Tick "Remember the key on this computer" only on your own laptop.
- Click "Clear key" after the session if you used a shared computer.
- Use a key with a modest spending limit for training sessions.

DATA
All built-in data is invented training material, labelled as such. Use only
training or public data in live mode; never official documents.

WHAT TO CLICK
See the "Hands-on Demo Notes" document: Demo 2 (tab 1, including the linked
"Run all linked steps" finale) and Demo 4 (tab 2, complaint triage).

NEW IN THIS EDITION
Tab 3 · Live dashboard: smog KPIs and charts from the sample report, plus
  complaint charts (category, district, hour, channel, funnel, "needs a
  person") that update live as tab 2 runs. Hover any bar for details;
  "Show as table" gives exact numbers.
Upload documents (tab 1, "Three documents" desk): drop PDF, Word (.docx) or
  text files. Live mode runs every desk on them; replay mode shows an offline
  fact preview only (recorded outputs exist for the sample set).
Upload complaints (tab 2): "Upload complaints (Excel / CSV)", or drag a file
  onto the tab. Columns are detected by name (id, received, channel,
  district, complaint_text); "Download Excel template" gives the layout.
  Uploading = the trigger firing. demo-data/complaints_sample.xlsx reproduces
  the recorded demo exactly. In replay mode, other files are sorted by simple
  offline keyword rules (marked as such); live mode uses Claude in batches.
  "Download results (Excel)" exports the triaged queue.
Smoother auto run: replay outputs type out (click the output to skip),
  Replay speed (Natural / Fast / Instant), a progress bar, the file visibly
  moving along each link, and "Presenter autopilot", which plays the officer
  and Secretary for a hands-free run-through. Autopilot refuses to approve a
  draft that still has the deliberate failure in it.

FOLDER CONTENTS
WorkflowStudio.html            the app
lib/                           PDF, Word and Excel readers (keep next to the
                               HTML so uploads work offline)
demo-data/                     the same training documents as PDFs, the
                               presenter answer card, the complaints CSV and
                               complaints_sample.xlsx
