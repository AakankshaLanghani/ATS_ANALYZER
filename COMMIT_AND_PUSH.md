# Commit & Push — Final Step

The repo is fully updated and ready. I couldn't finish the `git commit` from this session because a stale `.git/index.lock` was left over (it's a Windows file-lock my sandbox can't unlink), so please run these 5 commands yourself from **PowerShell** in `D:\Desktop\ICS_Resume_Analyzer`.

## One-time: clear the stale lock (only if needed)

```powershell
Remove-Item -Force .\.git\index.lock -ErrorAction SilentlyContinue
```

## Point the repo at the new GitHub remote

Your repo is currently set to:
- `origin`  → `https://github.com/AakankshaLanghani/ATS_ANALYZER.git`
- `second`  → `https://github.com/icsprojects/ats-resume-analyzer.git`

Add / switch to **icsprojects/ICSResumeAnalyzer**:

```powershell
git remote set-url origin https://github.com/icsprojects/ICSResumeAnalyzer.git
# verify
git remote -v
```

## Stage, commit, push

```powershell
git status                      # sanity check: should NOT list any .env files
git add -A
git commit -m "ICS branding + modern SaaS frontend + deploy configs (Render + Vercel)"
git branch -M main
git push -u origin main
```

If GitHub rejects because the remote repo already has a commit (an empty initial commit), force the first push:

```powershell
git push -u origin main --force
```

## Then deploy

Open `DEPLOY.md` and follow Parts 2 through 4. Total time ~15 min, total cost $0 (Groq) or ~$5/month (OpenAI).
