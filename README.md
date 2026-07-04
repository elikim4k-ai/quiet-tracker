# Quiet Tracker

A local dashboard for tracking WISER Insider Program prospects (quantum & AI software companies), with AI-drafted cold pitches, follow-ups, and weekly company discovery.

## Run it

```powershell
cd "C:\Users\eliki\OneDrive\Desktop\Quiet Tracker"
npm run dev
```

Open http://localhost:3210

## First-time setup

1. Go to the **Settings** tab.
2. Pick your AI provider (**OpenAI** or **Gemini**) and paste an API key:
   - OpenAI: https://platform.openai.com/api-keys
   - Gemini: https://aistudio.google.com/apikey (has a free tier)
3. Fill in your **sender identity** (name, title, email) — the AI signs messages with it.
4. (Optional) Configure **SMTP** to send emails directly from the dashboard. For Gmail use `smtp.gmail.com`, port `587`, and an [App Password](https://myaccount.google.com/apppasswords).
5. Click **Import Excel** in the header and upload your tracker workbook.

## What it does

- **Import**: parses the `Tracker` tab, cross-checks the `List from Vardaan` tab to flag existing WISER connections (and pulls in Vardaan's contact info), and adds every name from `Additional Companies` as a new prospect. Re-importing merges — your local edits, drafts, and follow-up timers are kept.
- **Pipeline**: every prospect with organization, location, product, contact, title, email, LinkedIn status, WISER connection, stage, dated status log, meetings, proposals, contract, and pipeline value. Filter by Quantum / AI / stage, search, click a row to edit everything.
- **AI outreach**: per prospect, generate a cold pitch, a follow-up, or a response to their reply — for email or LinkedIn. Set each prospect's follow-up channel and frequency (days). The **Draft due follow-ups** button drafts messages for everyone whose timer is up. Emails can be sent via SMTP; LinkedIn drafts are copy-paste (LinkedIn doesn't allow automated messaging).
- **Discovery**: the 🔭 button asks the AI for new quantum/AI software companies not already in your tracker and files them under the right category. A banner reminds you when it hasn't run in 7 days.
- **AI classify**: fills in Quantum/AI category (and product descriptions when known) for uncategorized companies.

## Data & storage modes

- **Shared mode** (deployed, or locally with `.env.local`): data lives in Supabase tables `qt_prospects` / `qt_state` — everyone with the password sees the same live tracker.
- **Local mode** (no Supabase env vars): data lives in `data/db.json` on this machine.

AI keys can go in the Settings tab (stored in the DB) or as `OPENAI_API_KEY` / `GEMINI_API_KEY` env vars (env is used when Settings is empty).

## Deploy to Vercel (24/7 + share with coworkers)

The repo is at **https://github.com/elikim4k-ai/quiet-tracker** (private).

1. Go to https://vercel.com/new → Import `elikim4k-ai/quiet-tracker`.
2. **Framework Preset must say "Next.js"** (if it says "Other", fix it — otherwise every route 404s).
3. Add Environment Variables (Production + Preview) — copy values from `.env.local`:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `TRACKER_PASSWORD` — the password you'll share with coworkers
   - `CRON_SECRET` — protects the cron endpoints
   - `OPENAI_API_KEY` **or** `GEMINI_API_KEY` (or paste the key in Settings after deploy)
4. Deploy. Share the URL + `TRACKER_PASSWORD` with coworkers.

### Automation once deployed (vercel.json)

- **Daily 13:00 UTC** — `/api/cron/followups`: drafts a follow-up for every prospect whose timer is due. If **Settings → Automation → Auto-send** is ON and SMTP is configured, it also sends the emails. Default is OFF (drafts wait for your review).
- **Weekly Monday 14:00 UTC** — `/api/cron/discover`: adds new Quantum/AI companies automatically.

Pushing to `main` auto-deploys.
