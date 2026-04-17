# ATS Resume Analyzer

> AI-powered resume screening tool for HR teams. Upload multiple resumes, paste a job description, and get ranked candidates with honest, human-like scoring — not keyword filters.

**Privacy-first:** all uploads are processed in-memory. Nothing is stored, logged, or sent anywhere except your chosen AI provider.

---

## Features

- **Multi-resume batch analysis** — upload up to 10 resumes at once, get a ranked table
- **Human-like scoring** — skill equivalence (CapCut = Premiere), soft skill inference, domain adjacency detection
- **Multiple AI providers** — works with OpenAI, Groq (free), Anthropic, or local Ollama
- **HR-grade verdict logic** — retention risk flags, overqualification detection, domain alignment levels
- **Modern UI** — ranking table, score breakdowns, interview questions, exportable results

---

## AI Provider Options

Configure via `backend/.env` — no code changes needed.

| Provider | Cost | Speed | Privacy | Best For |
|----------|------|-------|---------|----------|
| **Groq** | Free | ⚡ Fast | Cloud | Getting started |
| **OpenAI** (gpt-4o-mini) | ~$0.01/resume | ⚡ Fast | Cloud | Production |
| **Anthropic** (Claude Haiku) | ~$0.01/resume | ⚡ Fast | Cloud | High quality |
| **Ollama** (local) | Free | 🐢 Slow | 100% Local | Full privacy |

---

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+

### Step 1 — Configure AI Provider

```bash
cd backend
cp .env.example .env
```

Open `backend/.env` and set your provider:

```env
# Choose one: groq | openai | anthropic | ollama
AI_PROVIDER=openai

# Add your key for the chosen provider
OPENAI_API_KEY=sk-proj-your-key-here
```

Get a free Groq key at [console.groq.com](https://console.groq.com) — no credit card needed.

### Step 2 — Backend

```bash
cd backend

# Windows
python -m venv venv
venv\Scripts\activate

# Mac/Linux
python -m venv venv
source venv/bin/activate

# Install & run
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

Backend running at: `http://localhost:8000`

### Step 3 — Frontend

Open a new terminal:

```bash
cd frontend
echo "VITE_API_URL=http://localhost:8000" > .env
npm install
npm run dev
```

Open: **http://localhost:5173**

---

## Using Ollama (fully local, no API key)

```bash
# Install from https://ollama.com, then:
ollama pull phi          # lightweight, fast
ollama pull llama3.2     # better quality
ollama serve
```

In `backend/.env`:
```env
AI_PROVIDER=ollama
OLLAMA_MODEL=phi
```

---

## How to Use

1. Paste your **job description** on the left
2. **Upload resumes** (PDF, DOCX, or TXT — up to 10 at once)
3. Click **Analyze**
4. Get a **ranked table** of candidates with scores
5. Click any row for a full breakdown: skills, gaps, strengths, interview questions

---

## Deploy (Free)

### Backend → [Railway](https://railway.app)
1. Connect your GitHub repo
2. Set Root Directory to `backend`
3. Add environment variables (AI provider + key + CORS)
4. Generate a public domain

### Frontend → [Vercel](https://vercel.com)
1. Connect your GitHub repo
2. Set Root Directory to `frontend`
3. Add `VITE_API_URL=https://your-railway-url.up.railway.app`
4. Deploy — share the URL with your HR team

---

## Project Structure

```
ATS_Analyzer/
├── backend/
│   ├── main.py              # FastAPI app, scoring engine, AI providers
│   ├── requirements.txt
│   ├── .env.example         # Copy to .env and fill in your keys
│   └── Dockerfile
├── frontend/
│   ├── src/App.jsx          # Full React UI
│   ├── .env.example
│   └── Dockerfile
└── docker-compose.yml       # Run both with one command
```

## Docker (run both at once)

```bash
cp backend/.env.example backend/.env   # fill in your AI key
docker-compose up --build
# Frontend → http://localhost:3000
# Backend  → http://localhost:8000
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `pip` not found | Use `python -m pip install -r requirements.txt` |
| CORS error in browser | Make sure `CORS_ORIGINS` in `.env` matches your frontend URL |
| PDF shows empty | PDF is image-only (scanned). Convert to text first |
| Ollama timeout | Try a smaller model: `ollama pull phi3` |
| OpenAI 401 error | API key is wrong or missing from `backend/.env` |
| "unrelated histories" on git push | Use `git push origin main --force` |

---

## Tech Stack

**Frontend:** React 18 + Vite — no CSS framework, pure inline styles, zero extra dependencies

**Backend:** FastAPI + Python — async, multi-resume batch endpoint, provider-agnostic AI calls

**Scoring:** Rule-based HR engine (skill equivalence maps, domain clustering, seniority detection) + LLM qualitative evaluation
