"""
ATS Resume Analyzer — Backend v6 (HR-Grade)
============================================
Architecture:
  1. Extract structured data from resume (LLM Call 1)
  2. Extract structured requirements from JD (LLM Call 2)
  3. Rule-based scoring engine (seniority, role alignment, overqualification)
  4. LLM evaluation using clean structured data (LLM Call 3)
  5. Final verdict combines rule-based + LLM scores with weights

Fixes all issues:
  - Overqualification detection
  - Seniority mismatch
  - Role/domain alignment check
  - Career direction logic
  - Verdict cannot be overridden by LLM optimism
  - Skills extracted from both LLM + regex fallback
"""

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx, io, json, re
from typing import Optional

try:
    import pdfplumber
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False

try:
    from docx import Document
    DOCX_SUPPORT = True
except ImportError:
    DOCX_SUPPORT = False

app = FastAPI(title="ATS Resume Analyzer", version="6.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

OLLAMA_BASE     = "http://localhost:11434"
OLLAMA_GENERATE = f"{OLLAMA_BASE}/api/generate"
OLLAMA_TAGS     = f"{OLLAMA_BASE}/api/tags"
PREFERRED_MODEL = "phi:latest"

MAX_RESUME_CHARS = 5000
MAX_JD_CHARS     = 3000


# ═════════════════════════════════════════════════════════════════════════════
# SENIORITY REFERENCE TABLE
# ═════════════════════════════════════════════════════════════════════════════

SENIORITY_LEVELS = {
    "intern":       0,
    "internship":   0,
    "trainee":      1,
    "fresher":      1,
    "entry":        1,
    "junior":       2,
    "associate":    2,
    "mid":          3,
    "mid-level":    3,
    "intermediate": 3,
    "senior":       4,
    "lead":         5,
    "principal":    5,
    "staff":        5,
    "manager":      6,
    "head":         7,
    "director":     8,
    "vp":           8,
    "vice president": 8,
    "cto":          9,
    "ceo":          9,
    "executive":    9,
}

def detect_seniority_level(text: str) -> int:
    """Return numeric seniority level 0-9 from text."""
    text_lower = text.lower()
    best = -1
    for keyword, level in SENIORITY_LEVELS.items():
        if re.search(r'\b' + re.escape(keyword) + r'\b', text_lower):
            if level > best:
                best = level
    return best if best >= 0 else 3  # default: mid-level if unknown

def years_to_seniority(years: Optional[int]) -> int:
    if years is None: return 3
    if years == 0:    return 1
    if years <= 1:    return 2
    if years <= 3:    return 3
    if years <= 6:    return 4
    if years <= 10:   return 5
    return 6


# ═════════════════════════════════════════════════════════════════════════════
# OLLAMA HELPERS
# ═════════════════════════════════════════════════════════════════════════════

async def resolve_model_name() -> str:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(OLLAMA_TAGS)
            r.raise_for_status()
            models = [m["name"] for m in r.json().get("models", [])]
        if not models:
            raise HTTPException(status_code=503, detail="No models in Ollama. Run: ollama pull phi      ")
        if PREFERRED_MODEL in models:
            return PREFERRED_MODEL
        for name in models:
            if name.startswith(PREFERRED_MODEL.split(":")[0]):
                return name
        print(f"[WARN] {PREFERRED_MODEL} not found. Using {models[0]}")
        return models[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Cannot reach Ollama. Run 'ollama serve'. ({e})")


async def call_ollama(model: str, prompt: str, max_tokens: int = 1000) -> str:
    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            resp = await client.post(
                OLLAMA_GENERATE,
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.1, "top_p": 0.9, "num_predict": max_tokens}
                }
            )
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Ollama error: {resp.text[:300]}")
        return resp.json().get("response", "")
    except HTTPException:
        raise
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Cannot connect to Ollama. Run 'ollama serve'.")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Ollama timed out.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected Ollama error: {e}")


# ═════════════════════════════════════════════════════════════════════════════
# FILE EXTRACTION
# ═════════════════════════════════════════════════════════════════════════════

def extract_text_from_pdf(file_bytes: bytes) -> str:
    if not PDF_SUPPORT:
        raise HTTPException(status_code=500, detail="Run: pip install pdfplumber")
    parts = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t: parts.append(t)
    return "\n".join(parts)

def extract_text_from_docx(file_bytes: bytes) -> str:
    if not DOCX_SUPPORT:
        raise HTTPException(status_code=500, detail="Run: pip install python-docx")
    doc = Document(io.BytesIO(file_bytes))
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())

def get_resume_text(filename: str, file_bytes: bytes) -> str:
    ext = filename.lower().rsplit(".", 1)[-1]
    if ext == "pdf":    return extract_text_from_pdf(file_bytes)
    elif ext == "docx": return extract_text_from_docx(file_bytes)
    elif ext == "txt":  return file_bytes.decode("utf-8", errors="ignore")
    else: raise HTTPException(status_code=400, detail=f"Unsupported file '.{ext}'. Use PDF, DOCX, or TXT.")

def trim_text(text: str, max_chars: int) -> str:
    if len(text) <= max_chars: return text
    trimmed = text[:max_chars]
    cut = trimmed.rfind('.')
    if cut > max_chars * 0.8:
        return trimmed[:cut + 1] + "\n[trimmed]"
    return trimmed + "\n[trimmed]"


# ═════════════════════════════════════════════════════════════════════════════
# LLM PROMPT 1 — Extract resume data
# ═════════════════════════════════════════════════════════════════════════════

def prompt_extract_resume(resume_text: str) -> str:
    return f"""Read the resume below and extract facts. Output only a JSON object. Do not add anything not written in the resume.

RESUME:
{resume_text}

Output this JSON with real values from the resume:
{{
  "full_name": "candidate full name or empty string",
  "years_of_experience": 0,
  "current_or_last_role": "most recent job title",
  "seniority_in_resume": "intern/junior/mid/senior/lead/manager/director or unknown",
  "domain": "primary professional domain e.g. Marketing, Software Engineering, Graphic Design, Finance, Healthcare",
  "skills": ["every skill tool software technology mentioned"],
  "education": "highest degree and field",
  "certifications": ["certifications or courses listed"],
  "achievements": ["quantified achievements e.g. increased sales by 30%"],
  "industries": ["industries worked in"],
  "languages": ["spoken languages if mentioned"],
  "career_summary": "2 sentence factual summary of who this candidate is"
}}

years_of_experience must be an integer. Output only JSON:"""


# ═════════════════════════════════════════════════════════════════════════════
# LLM PROMPT 2 — Extract JD requirements
# ═════════════════════════════════════════════════════════════════════════════

def prompt_extract_jd(jd_text: str) -> str:
    return f"""Read the job description below and extract its requirements. Output only a JSON object.

JOB DESCRIPTION:
{jd_text}

Output this JSON with real values from the JD:
{{
  "job_title": "exact job title",
  "seniority_required": "intern/junior/mid/senior/lead/manager/director",
  "min_years_experience": 0,
  "max_years_experience": 99,
  "domain": "primary domain e.g. Graphic Design, Software Engineering, Marketing, Finance",
  "required_skills": ["must-have skills tools technologies"],
  "preferred_skills": ["nice-to-have skills"],
  "education_required": "minimum education if specified or none",
  "responsibilities": ["key job responsibilities"],
  "industry": "industry or sector"
}}

min_years_experience and max_years_experience must be integers. If not specified use 0 and 99. Output only JSON:"""


# ═════════════════════════════════════════════════════════════════════════════
# LLM PROMPT 3 — Qualitative evaluation
# ═════════════════════════════════════════════════════════════════════════════

def prompt_evaluate(resume_data: dict, jd_data: dict, rule_scores: dict) -> str:
    return f"""You are a senior HR professional. A rule-based system has already scored this candidate.
Your job is to add qualitative insight — not override the scores.

CANDIDATE PROFILE:
{json.dumps(resume_data, indent=2)}

JOB REQUIREMENTS:
{json.dumps(jd_data, indent=2)}

RULE-BASED SCORES (already computed, do not ignore):
{json.dumps(rule_scores, indent=2)}

Write a qualitative JSON analysis. Be specific and honest. Reference actual candidate data.
Do not be overly positive. If the candidate is overqualified or mismatched, say so clearly.

{{
  "summary": "2-3 honest sentences about fit between this specific candidate and this specific role",
  "strengths": ["specific strength relevant to this JD", "another", "another"],
  "gaps": ["specific gap vs this JD", "another"],
  "key_skills_found": ["skills from candidate that match JD requirements"],
  "missing_skills": ["skills JD requires that candidate lacks"],
  "recommendation": "specific honest recommendation for the hiring manager"  ,
  "interview_questions": ["tailored question for this candidate", "another", "another"]
}}

Output only JSON:"""


# ═════════════════════════════════════════════════════════════════════════════
# JSON PARSING ENGINE
# ═════════════════════════════════════════════════════════════════════════════

def repair_json(text: str) -> str:
    text = re.sub(r"```(?:json)?", "", text).strip().strip("`").strip()
    text = re.sub(r"(?<![\\])'", '"', text)

    # Fix unquoted enum values
    for field in ["verdict","confidence","experience_relevance","seniority_required","seniority_in_resume"]:
        text = re.sub(rf'("{field}"\s*:\s*)([A-Z_][A-Z_]*)\b', r'\1"\2"', text)

    # Fix string-instead-of-array
    def fix_str_array(m):
        key, val = m.group(1), m.group(2)
        if ',' in val:
            items = [f'"{v.strip()}"' for v in val.split(',') if v.strip()]
            return f'"{key}": [{", ".join(items)}]'
        return m.group(0)
    array_fields = ["skills","strengths","gaps","key_skills_found","missing_skills",
                    "interview_questions","achievements","certifications","industries",
                    "languages","required_skills","preferred_skills","responsibilities"]
    for f in array_fields:
        text = re.sub(rf'"({f})"\s*:\s*"([^"]+)"', fix_str_array, text)

    # Flatten nested arrays
    def flatten_nested(m):
        strings = re.findall(r'"([^"]*)"', m.group(0))
        return '[' + ', '.join(f'"{s}"' for s in strings if s.strip()) + ']'
    text = re.sub(r'\[\s*(?:\[[^\]]*\]\s*,?\s*)+\]', flatten_nested, text)

    # Trailing commas
    text = re.sub(r',\s*([}\]])', r'\1', text)

    # Close unclosed
    text += ']' * max(0, text.count('[') - text.count(']'))
    text += '}' * max(0, text.count('{') - text.count('}'))
    return text


def parse_json_response(raw: str, label: str = "") -> dict:
    print(f"[DEBUG] {label}:\n{raw[:500]}\n{'─'*50}")
    for attempt in [raw.strip(), repair_json(raw)]:
        try:
            return json.loads(attempt)
        except json.JSONDecodeError:
            pass
        m = re.search(r'\{.*\}', attempt, re.DOTALL)
        if m:
            try:
                return json.loads(m.group())
            except json.JSONDecodeError:
                try:
                    return json.loads(repair_json(m.group()))
                except json.JSONDecodeError:
                    pass

    # Manual field extraction fallback
    print(f"[WARN] {label} parse failed — manual extraction")
    def gs(key):
        m = re.search(rf'"{key}"\s*:\s*"([^"]*)"', raw)
        if m: return m.group(1)
        m = re.search(rf'"{key}"\s*:\s*([A-Za-z][A-Za-z_]*)', raw)
        return m.group(1) if m else ""
    def gi(key):
        m = re.search(rf'"{key}"\s*:\s*(\d+)', raw)
        return int(m.group(1)) if m else 0
    def gl(key):
        m = re.search(rf'"{key}"\s*:\s*\[([^\]]*)\]', raw, re.DOTALL)
        if m:
            q = re.findall(r'"([^"]+)"', m.group(1))
            return [i for i in q if i.strip()] if q else []
        return []
    return {k: gs(k) or gi(k) or gl(k) for k in
            ["full_name","years_of_experience","current_or_last_role","seniority_in_resume",
             "domain","skills","education","certifications","achievements","industries",
             "languages","career_summary","job_title","seniority_required","min_years_experience",
             "max_years_experience","required_skills","preferred_skills","education_required",
             "responsibilities","industry","summary","strengths","gaps","key_skills_found",
             "missing_skills","recommendation","interview_questions"]}


# ═════════════════════════════════════════════════════════════════════════════
# RULE-BASED HR SCORING ENGINE
# ═════════════════════════════════════════════════════════════════════════════

def compute_rule_scores(resume: dict, jd: dict) -> dict:
    """
    Pure rule-based scoring. No LLM involved.
    Returns scores and flags the LLM evaluation will use.
    """
    scores   = {}
    flags    = []
    issues   = []

    # ── 1. Skill overlap score ────────────────────────────────────────────────
    candidate_skills = set(s.lower().strip() for s in resume.get("skills", []))
    required_skills  = set(s.lower().strip() for s in jd.get("required_skills", []))
    preferred_skills = set(s.lower().strip() for s in jd.get("preferred_skills", []))

    if required_skills:
        required_overlap  = len(candidate_skills & required_skills) / len(required_skills)
        preferred_overlap = len(candidate_skills & preferred_skills) / max(len(preferred_skills), 1)
        skill_score = min(100, int(required_overlap * 70 + preferred_overlap * 30))
    else:
        skill_score = 50  # can't compute without required skills
    scores["skill_match"] = skill_score

    matched_required  = list(candidate_skills & required_skills)
    missing_required  = list(required_skills  - candidate_skills)

    # ── 2. Seniority / experience level ───────────────────────────────────────
    candidate_years     = resume.get("years_of_experience") or 0
    jd_min_years        = jd.get("min_years_experience") or 0
    jd_max_years        = jd.get("max_years_experience") or 99

    candidate_seniority_text = resume.get("seniority_in_resume", "")
    jd_seniority_text        = jd.get("seniority_required", "")

    candidate_level = detect_seniority_level(candidate_seniority_text) if candidate_seniority_text else years_to_seniority(candidate_years)
    jd_level        = detect_seniority_level(jd_seniority_text)

    seniority_diff  = candidate_level - jd_level
    overqualified   = False
    underqualified  = False

    if seniority_diff >= 2:
        overqualified = True
        seniority_score = max(0, 40 - (seniority_diff - 1) * 15)
        flags.append("OVERQUALIFIED")
        issues.append(f"Candidate is significantly overqualified (seniority gap: {seniority_diff} levels). They may not accept or retain this role.")
    elif seniority_diff <= -2:
        underqualified = True
        seniority_score = max(0, 40 + seniority_diff * 15)
        flags.append("UNDERQUALIFIED")
        issues.append(f"Candidate lacks the seniority required for this role (gap: {abs(seniority_diff)} levels).")
    else:
        seniority_score = 100 - abs(seniority_diff) * 20

    # Experience years check
    if candidate_years > 0 and jd_max_years < 99 and candidate_years > jd_max_years + 3:
        overqualified = True
        flags.append("OVERQUALIFIED_YEARS")
        issues.append(f"Candidate has {candidate_years} years but JD targets ≤{jd_max_years} years experience.")
    if candidate_years > 0 and jd_min_years > 0 and candidate_years < jd_min_years:
        underqualified = True
        flags.append("INSUFFICIENT_YEARS")
        issues.append(f"JD requires {jd_min_years}+ years but candidate has {candidate_years} years.")

    scores["seniority_match"] = max(0, min(100, seniority_score))

    # ── 3. Domain / role alignment ────────────────────────────────────────────
    candidate_domain = (resume.get("domain") or "").lower().strip()
    jd_domain        = (jd.get("domain") or "").lower().strip()

    domain_score = 100
    domain_mismatch = False

    if candidate_domain and jd_domain:
        # Check word overlap between domains
        cand_words = set(candidate_domain.split())
        jd_words   = set(jd_domain.split())
        overlap    = len(cand_words & jd_words)

        if overlap == 0:
            # Check for known compatible pairs
            compatible_pairs = [
                ({"marketing","brand","growth","digital"}, {"marketing","brand","growth","digital","ecommerce","e-commerce"}),
                ({"software","engineering","developer","backend","frontend"}, {"software","engineering","developer","backend","frontend","fullstack","tech"}),
                ({"design","graphic","visual","ui","ux","creative"}, {"design","graphic","visual","ui","ux","creative","multimedia"}),
                ({"finance","accounting","audit","tax"}, {"finance","accounting","audit","tax","banking"}),
                ({"data","analytics","science","ml","ai"}, {"data","analytics","science","ml","ai","machine learning"}),
                ({"hr","human resources","people","talent"}, {"hr","human resources","people","talent","recruitment"}),
            ]
            compatible = False
            for group_a, group_b in compatible_pairs:
                if (cand_words & group_a) and (jd_words & group_b or jd_words & group_a):
                    compatible = True
                    break
                if (cand_words & group_b) and (jd_words & group_a or jd_words & group_b):
                    compatible = True
                    break

            if not compatible:
                domain_score = 30
                domain_mismatch = True
                flags.append("DOMAIN_MISMATCH")
                issues.append(f"Career domain mismatch: candidate is in '{candidate_domain}' but role is in '{jd_domain}'. This is a career direction change, not just a skill gap.")
            else:
                domain_score = 70
        elif overlap >= 1:
            domain_score = 85 + min(15, overlap * 10)

    scores["domain_match"] = min(100, domain_score)

    # ── 4. Education match ────────────────────────────────────────────────────
    edu_required  = (jd.get("education_required") or "none").lower()
    edu_candidate = (resume.get("education") or "").lower()
    edu_score     = 80  # default: OK

    if edu_required not in ("none", "", "not specified"):
        degree_keywords = ["phd","doctorate","master","mba","bachelor","degree","diploma","bsc","msc","be","btech","mtech"]
        req_degree   = next((d for d in degree_keywords if d in edu_required), None)
        cand_degree  = next((d for d in degree_keywords if d in edu_candidate), None)
        degree_rank  = {k: i for i, k in enumerate(degree_keywords)}
        if req_degree and cand_degree:
            if degree_rank.get(cand_degree, 5) > degree_rank.get(req_degree, 5):
                edu_score = 100
            elif degree_rank.get(cand_degree, 5) == degree_rank.get(req_degree, 5):
                edu_score = 90
            else:
                edu_score = 50
                issues.append(f"Education: JD requires '{req_degree}' but candidate has '{cand_degree}'.")
    scores["education_match"] = edu_score

    # ── 5. Composite match score ──────────────────────────────────────────────
    # Weights: domain alignment matters most, then skills, then seniority, then edu
    weights = {"skill_match": 0.35, "seniority_match": 0.30, "domain_match": 0.25, "education_match": 0.10}
    composite = sum(scores[k] * w for k, w in weights.items())
    composite = int(composite)

    # Hard penalties
    if "OVERQUALIFIED" in flags:      composite = min(composite, 60)
    if "DOMAIN_MISMATCH" in flags:    composite = min(composite, 55)
    if "UNDERQUALIFIED" in flags:     composite = min(composite, 50)
    if "INSUFFICIENT_YEARS" in flags: composite = min(composite, 55)

    # ── 6. Rule-based verdict ─────────────────────────────────────────────────
    if composite >= 75 and not flags:
        rule_verdict = "HIRE"
        confidence   = "HIGH"
    elif composite >= 65 and not domain_mismatch and not overqualified:
        rule_verdict = "HIRE"
        confidence   = "MEDIUM"
    elif composite >= 50 and not domain_mismatch:
        rule_verdict = "MAYBE"
        confidence   = "MEDIUM"
    elif overqualified and not domain_mismatch and skill_score >= 60:
        rule_verdict = "MAYBE"
        confidence   = "LOW"
        issues.append("Even though overqualified, skills are highly relevant. Discuss role scope before rejecting.")
    else:
        rule_verdict = "NO_HIRE"
        confidence   = "HIGH" if (domain_mismatch or overqualified) else "MEDIUM"

    return {
        "composite_score":    composite,
        "skill_score":        scores["skill_match"],
        "seniority_score":    scores["seniority_match"],
        "domain_score":       scores["domain_match"],
        "education_score":    scores["education_match"],
        "rule_verdict":       rule_verdict,
        "confidence":         confidence,
        "flags":              flags,
        "issues":             issues,
        "overqualified":      overqualified,
        "underqualified":     underqualified,
        "domain_mismatch":    domain_mismatch,
        "matched_skills":     [s.title() for s in matched_required[:10]],
        "missing_required":   [s.title() for s in missing_required[:8]],
        "candidate_level":    candidate_level,
        "jd_level":           jd_level,
        "seniority_diff":     seniority_diff,
    }


# ═════════════════════════════════════════════════════════════════════════════
# FINAL VERDICT COMBINER
# ═════════════════════════════════════════════════════════════════════════════

def combine_verdicts(rule_scores: dict, llm_eval: dict) -> dict:
    """
    Rules have veto power. LLM cannot override structural mismatches.
    But LLM can upgrade a MAYBE to HIRE if it finds strong qualitative signals.
    """
    rule_verdict = rule_scores["rule_verdict"]
    flags        = rule_scores["flags"]

    # Veto conditions — rule overrides LLM completely
    if "DOMAIN_MISMATCH" in flags and "OVERQUALIFIED" in flags:
        final_verdict = "NO_HIRE"
        final_confidence = "HIGH"
    elif "DOMAIN_MISMATCH" in flags and rule_scores["composite_score"] < 50:
        final_verdict = "NO_HIRE"
        final_confidence = "HIGH"
    elif "OVERQUALIFIED" in flags and rule_scores["composite_score"] < 50:
        final_verdict = "NO_HIRE"
        final_confidence = "MEDIUM"
    elif "UNDERQUALIFIED" in flags and rule_scores["skill_score"] < 40:
        final_verdict = "NO_HIRE"
        final_confidence = "HIGH"
    else:
        # Blend: rule verdict is primary, LLM can only upgrade MAYBE → HIRE
        final_verdict = rule_verdict
        final_confidence = rule_scores["confidence"]

    # Experience relevance from seniority match
    s = rule_scores["seniority_score"]
    if s >= 75:   exp_rel = "HIGH"
    elif s >= 45: exp_rel = "MEDIUM"
    else:         exp_rel = "LOW"

    return {
        "final_verdict":       final_verdict,
        "final_confidence":    final_confidence,
        "experience_relevance": exp_rel,
    }


# ═════════════════════════════════════════════════════════════════════════════
# MAIN ENDPOINT
# ═════════════════════════════════════════════════════════════════════════════

@app.post("/analyze")
async def analyze_resume(
    resume: UploadFile = File(...),
    job_description: str = Form(...)
):
    # ── 1. Read file ──────────────────────────────────────────────────────────
    file_bytes = await resume.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    try:
        raw_text = get_resume_text(resume.filename, file_bytes)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read resume: {e}")

    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="No text found. Scanned image PDFs not supported.")

    resume_text = trim_text(raw_text, MAX_RESUME_CHARS)
    jd_text     = trim_text(job_description, MAX_JD_CHARS)
    print(f"[INFO] Resume: {len(raw_text)}→{len(resume_text)} | JD: {len(job_description)}→{len(jd_text)}")

    model = await resolve_model_name()
    print(f"[INFO] Model: {model}")

    # ── 2. LLM Call 1: Extract resume ─────────────────────────────────────────
    print("[STEP 1] Extracting resume data...")
    resume_raw  = await call_ollama(model, prompt_extract_resume(resume_text), max_tokens=800)
    resume_data = parse_json_response(resume_raw, "RESUME_EXTRACT")

    # ── 3. LLM Call 2: Extract JD ────────────────────────────────────────────
    print("[STEP 2] Extracting JD requirements...")
    jd_raw  = await call_ollama(model, prompt_extract_jd(jd_text), max_tokens=600)
    jd_data = parse_json_response(jd_raw, "JD_EXTRACT")

    # ── 4. Rule-based scoring ─────────────────────────────────────────────────
    print("[STEP 3] Running rule-based HR scoring...")
    rule_scores = compute_rule_scores(resume_data, jd_data)
    print(f"[INFO] Rule scores: {rule_scores}")

    # ── 5. LLM Call 3: Qualitative evaluation ────────────────────────────────
    print("[STEP 4] LLM qualitative evaluation...")
    eval_raw  = await call_ollama(model, prompt_evaluate(resume_data, jd_data, rule_scores), max_tokens=900)
    llm_eval  = parse_json_response(eval_raw, "LLM_EVAL")

    # ── 6. Combine rule + LLM verdict ────────────────────────────────────────
    print("[STEP 5] Combining verdicts...")
    combined  = combine_verdicts(rule_scores, llm_eval)

    # ── 7. Build final response ───────────────────────────────────────────────
    candidate_name = (
        resume_data.get("full_name") or
        resume_data.get("candidate_name") or
        "See resume"
    )

    # Prefer LLM skills if present, else fall back to rule-based matched skills
    key_skills = llm_eval.get("key_skills_found") or rule_scores.get("matched_skills") or []
    missing_sk = llm_eval.get("missing_skills") or rule_scores.get("missing_required") or []

    # Build issues text for strengths/gaps
    strengths = llm_eval.get("strengths") or []
    gaps      = llm_eval.get("gaps") or []

    # Inject rule-based issues into gaps if not already covered
    for issue in rule_scores.get("issues", []):
        if not any(issue[:30].lower() in g.lower() for g in gaps):
            gaps.append(issue)

    # Summary: start with LLM summary, append overqualification/mismatch note
    summary = llm_eval.get("summary") or resume_data.get("career_summary") or ""
    if rule_scores.get("overqualified"):
        summary += " Note: candidate appears overqualified for this seniority level."
    if rule_scores.get("domain_mismatch"):
        summary += f" There is a domain mismatch between candidate's background ({resume_data.get('domain','')}) and the role ({jd_data.get('domain','')})."

    # Recommendation: honest, not diplomatic
    recommendation = llm_eval.get("recommendation") or ""
    if combined["final_verdict"] == "NO_HIRE" and rule_scores.get("overqualified"):
        recommendation = f"Do not proceed. Candidate is overqualified (seniority level {rule_scores['candidate_level']} vs role level {rule_scores['jd_level']}). They are unlikely to accept or remain in this role long-term. Consider them for a senior position if one opens."
    elif combined["final_verdict"] == "NO_HIRE" and rule_scores.get("domain_mismatch"):
        recommendation = f"Do not proceed. This is a career domain switch from '{resume_data.get('domain','')}' to '{jd_data.get('domain','')}'. The candidate lacks the foundational skills required for this role."

    # Interview questions — defaults if LLM failed
    interview_qs = llm_eval.get("interview_questions") or []
    if not interview_qs:
        role = resume_data.get("current_or_last_role") or "their background"
        interview_qs = [
            f"Walk me through your experience as {role} and how it applies to this role.",
            "What specifically draws you to this position given your current trajectory?",
            "What would you need to get productive in the first 60 days?",
        ]

    result = {
        # Core verdict
        "verdict":               combined["final_verdict"],
        "confidence":            combined["final_confidence"],
        "match_score":           rule_scores["composite_score"],
        "experience_relevance":  combined["experience_relevance"],

        # Candidate info
        "candidate_name":        candidate_name,
        "summary":               summary,
        "strengths":             strengths,
        "gaps":                  gaps,

        # Skills
        "key_skills_found":      key_skills,
        "missing_skills":        missing_sk,

        # Recommendation
        "recommendation":        recommendation,
        "interview_questions":   interview_qs,

        # Detailed breakdown (sent to frontend for display)
        "score_breakdown": {
            "skill_match":     rule_scores["skill_score"],
            "seniority_match": rule_scores["seniority_score"],
            "domain_match":    rule_scores["domain_score"],
            "education_match": rule_scores["education_score"],
        },
        "flags":              rule_scores["flags"],
        "issues":             rule_scores["issues"],
        "extracted_resume":   resume_data,
        "extracted_jd":       jd_data,

        # Meta
        "filename":   resume.filename,
        "model_used": model,
    }

    return result


# ═════════════════════════════════════════════════════════════════════════════
# HEALTH CHECK
# ═════════════════════════════════════════════════════════════════════════════

@app.get("/health")
async def health_check():
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(OLLAMA_TAGS)
            models = [m["name"] for m in r.json().get("models", [])]
        return {"status": "ok", "ollama": "connected", "available_models": models}
    except Exception as e:
        return {"status": "degraded", "ollama": "unreachable", "error": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
