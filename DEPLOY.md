# Deploy Guide — ICS Resume Analyzer

This guide walks you through deploying the app end-to-end on the **free tier** of Render (backend) and Vercel (frontend). Total setup time: ~15 minutes. No credit card needed for Groq; OpenAI/Anthropic require a payment method but cost ~$0.01 per resume.

---

## Architecture

```
┌─────────────────────┐    HTTPS    ┌──────────────────────┐    HTTPS    ┌─────────────────┐
│  Browser (user)     │  ────────▶  │  Vercel              │  ────────▶  │  Render         │
│                     │             │  (React/Vite static) │             │  (FastAPI)      │
└─────────────────────┘             └──────────────────────┘             └─────────────────┘
                                                                                    │
                                                                                    │ HTTPS
                                                                                    ▼
                                                                         ┌─────────────────┐
                                                                         │  AI Provider    │
                                                                         │  OpenAI / Groq  │
                                                                         │  / Anthropic    │
                                                                         └─────────────────┘
```

Resumes are processed **in memory**. Nothing is persisted server-side; the backend has no database.

---

## Cost Summary

| Provider | Model | Cost per resume | Notes |
|----------|-------|-----------------|-------|
| **Groq** (recommended start) | `llama3-8b-8192` | **$0.00** (free tier, rate-limited) | Fast, good enough for triage; sign up at [console.groq.com](https://console.groq.com) |
| **OpenAI** | `gpt-4o-mini` | **~$0.01** (~$1 per 100 resumes) | Best balance of quality + price |
| **Anthropic** | `claude-haiku-4-5-20251001` | **~$0.01** | Highest-quality verdicts and interview questions |
| **Ollama** | `phi` / `llama3.2` | **$0.00** (local) | Only works if you self-host — not usable on Render free tier |

Hosting itself is free:

| Service | Plan | Limit | Sleep behaviour |
|---------|------|-------|-----------------|
| **Render** (backend) | Free web service | 512 MB RAM, 750 hrs/mo | Spins down after 15 min idle; first request after sleep takes ~30 s |
| **Vercel** (frontend) | Hobby | 100 GB bandwidth/mo | Never sleeps (static CDN) |

---

## Part 1 — Prepare the Repo

This only needs to be done once.

1. Make sure `backend/.env` and `frontend/.env` exist **only locally** and are gitignored (they already are — verified in `.gitignore`).
2. From the project root:

```bash
git status                 # should NOT show .env files
git add .
git commit -m "Deploy-ready: ICS branding, render.yaml, vercel.json, DEPLOY.md"
git remote add origin https://github.com/icsprojects/ICSResumeAnalyzer.git  # only if remote not set
git branch -M main
git push -u origin main
```

If the remote already has commits you'll need `git push -u origin main --force` for the first push.

---

## Part 2 — Deploy Backend to Render

1. Go to [dashboard.render.com](https://dashboard.render.com) and sign in with GitHub.
2. Click **New +** → **Blueprint**.
3. Connect the **icsprojects/ICSResumeAnalyzer** repo. Render will detect `render.yaml` at the repo root and show a proposed service named `ics-resume-analyzer-api`.
4. Click **Apply**. Render builds the Docker-less Python service (~3 min on free tier).
5. Once the service is **Live**, open its **Environment** tab and paste your AI key:
   - If using OpenAI: set `OPENAI_API_KEY` (get one at [platform.openai.com/api-keys](https://platform.openai.com/api-keys))
   - If using Anthropic: set `ANTHROPIC_API_KEY` (get one at [console.anthropic.com](https://console.anthropic.com))
   - If using Groq (free): set `GROQ_API_KEY` and also change `AI_PROVIDER` to `groq`
6. Render auto-redeploys after you save env vars.
7. Copy the service URL — it looks like `https://ics-resume-analyzer-api.onrender.com`. Test it:

```bash
curl https://ics-resume-analyzer-api.onrender.com/health
# expected: {"status":"ok","provider":"openai"}
```

---

## Part 3 — Deploy Frontend to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import the same **icsprojects/ICSResumeAnalyzer** repo.
2. Vercel should auto-detect Vite, but confirm the settings:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build` (already in `vercel.json`)
   - **Output Directory:** `dist`
3. Under **Environment Variables**, add:
   - Key: `VITE_API_URL`
   - Value: the Render URL from Part 2 (e.g. `https://ics-resume-analyzer-api.onrender.com`)
   - Apply to: Production, Preview, Development
4. Click **Deploy**. Vercel builds and publishes in ~60 seconds.
5. Copy the Vercel URL (e.g. `https://ics-resume-analyzer.vercel.app`).

---

## Part 4 — Wire CORS

The backend must explicitly allow the Vercel origin — otherwise the browser blocks API calls.

1. Back in Render → service → **Environment**.
2. Edit `CORS_ORIGINS` and add your Vercel URL (comma-separated, no spaces, no trailing slash):

```
http://localhost:5173,http://localhost:3000,https://ics-resume-analyzer.vercel.app
```

3. Save — Render auto-redeploys.
4. Open the Vercel URL in your browser, upload a resume + JD, click **Analyze**. If it works, you're live.

---

## Part 5 — Optional: Custom Domain

On Vercel: **Settings → Domains → Add** (e.g. `analyzer.icsconsultants.com`). Vercel issues a free SSL cert. Add the new domain to `CORS_ORIGINS` on Render and redeploy.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Frontend loads, but **Analyze** button 500s | CORS blocked or backend env missing | Check Render logs; confirm `CORS_ORIGINS` includes the Vercel URL exactly |
| First analyze after idle takes ~30 s | Render free-tier cold start | Normal. Upgrade to Starter ($7/mo) for always-on |
| `401` / `insufficient_quota` from OpenAI | Wrong key or no billing | Go to [platform.openai.com/account/billing](https://platform.openai.com/account/billing) and add $5 credit |
| Vercel build fails: "dist not found" | Wrong root directory | In Vercel project settings, set Root Directory to `frontend` |
| Resume upload silently fails | File > ~5 MB or scanned image PDF | Convert scanned PDFs to text; use DOCX for large resumes |
| Logs show `429 Too Many Requests` from Groq | Free-tier rate limit | Throttle requests, or switch `AI_PROVIDER` to `openai` |

---

## Estimated Monthly Cost

For a team screening **~500 resumes/month** via OpenAI gpt-4o-mini:

| Line item | Cost |
|-----------|------|
| Render free web service | $0 |
| Vercel Hobby | $0 |
| OpenAI API (500 resumes × $0.01) | ~$5 |
| **Total** | **~$5/month** |

Switching to Groq drops it to $0. Switching to Render Starter ($7) removes cold starts.

---

## Rollback

Every commit creates a new deployment on both Render and Vercel. To roll back:
- **Render:** service → **Deploys** tab → pick a previous deploy → **Redeploy**
- **Vercel:** project → **Deployments** tab → previous deploy → **Promote to Production**
