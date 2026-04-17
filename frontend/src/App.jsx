import { useState, useRef, useCallback } from "react";

// ── Config (set VITE_API_URL in frontend/.env) ────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ── Design tokens ─────────────────────────────────────────────────────────────
const COLOR = {
  primary:    "#4f46e5",
  primaryDark:"#3730a3",
  primaryLight:"#eef2ff",
  hire:       "#16a34a",
  hireBg:     "#f0fdf4",
  hireBorder: "#86efac",
  maybe:      "#d97706",
  maybeBg:    "#fffbeb",
  maybeBorder:"#fcd34d",
  nohire:     "#dc2626",
  nohireBg:   "#fef2f2",
  nohireBorder:"#fca5a5",
  gray50:     "#f8fafc",
  gray100:    "#f1f5f9",
  gray200:    "#e2e8f0",
  gray400:    "#94a3b8",
  gray500:    "#64748b",
  gray700:    "#334155",
  gray900:    "#0f172a",
  white:      "#ffffff",
};

const VERDICT = {
  HIRE:    { label: "Recommended",      color: COLOR.hire,   bg: COLOR.hireBg,   border: COLOR.hireBorder,   icon: "✓", badge: "#dcfce7", badgeText: "#15803d" },
  MAYBE:   { label: "Review Needed",    color: COLOR.maybe,  bg: COLOR.maybeBg,  border: COLOR.maybeBorder,  icon: "~", badge: "#fef9c3", badgeText: "#a16207" },
  NO_HIRE: { label: "Not Recommended",  color: COLOR.nohire, bg: COLOR.nohireBg, border: COLOR.nohireBorder, icon: "✕", badge: "#fee2e2", badgeText: "#b91c1c" },
};

// ── Tiny reusable components ──────────────────────────────────────────────────
const ScoreRing = ({ score, color, size = 64 }) => {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={COLOR.gray200} strokeWidth={5} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.8s ease" }} />
    </svg>
  );
};

const ScoreBar = ({ value, label, color = COLOR.primary }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
      <span style={{ fontSize:12, color:COLOR.gray500, fontWeight:500 }}>{label}</span>
      <span style={{ fontSize:12, fontWeight:700, color }}>{value}%</span>
    </div>
    <div style={{ height:6, background:COLOR.gray100, borderRadius:99, overflow:"hidden" }}>
      <div style={{ height:"100%", borderRadius:99, background:color,
        width:`${value}%`, transition:"width 1s ease" }} />
    </div>
  </div>
);

const Tag = ({ text, variant = "blue" }) => {
  const variants = {
    blue:   { bg:"#dbeafe", color:"#1d4ed8" },
    green:  { bg:"#dcfce7", color:"#15803d" },
    red:    { bg:"#fee2e2", color:"#b91c1c" },
    purple: { bg:"#ede9fe", color:"#6d28d9" },
    gray:   { bg:COLOR.gray100, color:COLOR.gray700 },
  };
  const s = variants[variant] || variants.gray;
  return (
    <span style={{ display:"inline-block", padding:"2px 9px", borderRadius:99,
      fontSize:11, fontWeight:600, margin:"2px 3px 2px 0",
      background:s.bg, color:s.color }}>
      {text}
    </span>
  );
};

const Badge = ({ text, color, bg }) => (
  <span style={{ padding:"3px 10px", borderRadius:99, fontSize:11, fontWeight:700,
    background:bg, color, letterSpacing:0.3 }}>{text}</span>
);

const Card = ({ children, style = {} }) => (
  <div style={{ background:COLOR.white, borderRadius:14, border:`1px solid ${COLOR.gray200}`,
    boxShadow:"0 1px 3px rgba(0,0,0,0.06)", padding:20, ...style }}>
    {children}
  </div>
);

const SectionTitle = ({ children, color = COLOR.gray900 }) => (
  <div style={{ fontSize:13, fontWeight:700, color, marginBottom:10, letterSpacing:0.2 }}>{children}</div>
);

// ── Upload zone ────────────────────────────────────────────────────────────────
const UploadZone = ({ files, onFiles, onRemove }) => {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef();

  const accept = useCallback((list) => {
    const allowed = [".pdf",".docx",".txt"];
    const valid = Array.from(list).filter(f => allowed.includes("." + f.name.split(".").pop().toLowerCase()));
    if (valid.length !== list.length) alert("Only PDF, DOCX, and TXT files are supported.");
    onFiles(valid);
  }, [onFiles]);

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={e => { e.preventDefault(); setDrag(false); accept(e.dataTransfer.files); }}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        style={{
          border:`2px dashed ${drag ? COLOR.primary : files.length ? "#22c55e" : COLOR.gray200}`,
          borderRadius:12, padding:"28px 20px", textAlign:"center",
          cursor:"pointer", background: drag ? COLOR.primaryLight : files.length ? "#f0fdf4" : COLOR.gray50,
          transition:"all 0.2s",
        }}
      >
        <div style={{ fontSize:32, marginBottom:6 }}>{files.length ? "📂" : "⬆️"}</div>
        {files.length === 0 ? (
          <>
            <div style={{ fontWeight:600, color:COLOR.gray700, fontSize:14 }}>Drop resumes here or click to browse</div>
            <div style={{ fontSize:12, color:COLOR.gray400, marginTop:4 }}>PDF, DOCX, TXT · Max 10 resumes · 5MB each</div>
          </>
        ) : (
          <div style={{ fontWeight:600, color:"#15803d", fontSize:14 }}>
            {files.length} resume{files.length > 1 ? "s" : ""} selected · Click to add more
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" multiple accept=".pdf,.docx,.txt"
        style={{ display:"none" }} onChange={e => accept(e.target.files)} />

      {files.length > 0 && (
        <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:6 }}>
          {files.map((f, i) => (
            <div key={i} style={{
              display:"flex", alignItems:"center", justifyContent:"space-between",
              background:COLOR.gray50, borderRadius:8, padding:"8px 12px",
              border:`1px solid ${COLOR.gray200}`, fontSize:13,
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span>📄</span>
                <span style={{ fontWeight:500, color:COLOR.gray700 }}>{f.name}</span>
                <span style={{ color:COLOR.gray400, fontSize:11 }}>{(f.size/1024).toFixed(0)} KB</span>
              </div>
              <button onClick={() => onRemove(i)} style={{
                border:"none", background:"none", cursor:"pointer",
                color:COLOR.gray400, fontSize:16, padding:"0 4px", lineHeight:1
              }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Results table row ──────────────────────────────────────────────────────────
const ResultRow = ({ result, rank, onSelect, isSelected }) => {
  const vc = VERDICT[result.verdict] || VERDICT.MAYBE;
  const score = result.match_score;
  const scoreColor = score >= 75 ? COLOR.hire : score >= 55 ? COLOR.maybe : COLOR.nohire;

  return (
    <tr
      onClick={() => onSelect(result)}
      style={{
        cursor:"pointer", transition:"background 0.15s",
        background: isSelected ? COLOR.primaryLight : "transparent",
        borderBottom:`1px solid ${COLOR.gray100}`,
      }}
      onMouseEnter={e => { if(!isSelected) e.currentTarget.style.background = COLOR.gray50; }}
      onMouseLeave={e => { if(!isSelected) e.currentTarget.style.background = "transparent"; }}
    >
      <td style={{ padding:"12px 16px", fontWeight:700, color:COLOR.gray400, fontSize:13 }}>#{rank}</td>
      <td style={{ padding:"12px 16px" }}>
        <div style={{ fontWeight:700, color:COLOR.gray900, fontSize:14 }}>{result.candidate_name}</div>
        <div style={{ fontSize:11, color:COLOR.gray400, marginTop:1 }}>{result.filename}</div>
      </td>
      <td style={{ padding:"12px 16px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <ScoreRing score={score} color={scoreColor} size={40} />
          <div style={{ textAlign:"center", minWidth:24 }}>
            <div style={{ fontSize:16, fontWeight:800, color:scoreColor, lineHeight:1 }}>{score}</div>
            <div style={{ fontSize:9, color:COLOR.gray400, marginTop:1 }}>/ 100</div>
          </div>
        </div>
      </td>
      <td style={{ padding:"12px 16px" }}>
        <Badge text={vc.label} color={vc.badgeText} bg={vc.badge} />
      </td>
      <td style={{ padding:"12px 16px", maxWidth:300 }}>
        <div style={{ fontSize:12, color:COLOR.gray500, lineHeight:1.5 }}>
          {(result.summary || "").slice(0, 120)}{result.summary?.length > 120 ? "…" : ""}
        </div>
      </td>
      <td style={{ padding:"12px 16px" }}>
        <div style={{ fontSize:12, color:COLOR.primary, fontWeight:600 }}>View →</div>
      </td>
    </tr>
  );
};

// ── Detail panel ───────────────────────────────────────────────────────────────
const DetailPanel = ({ result, onClose }) => {
  if (!result) return null;
  const vc = VERDICT[result.verdict] || VERDICT.MAYBE;
  const breakdown = result.score_breakdown || {};
  const score = result.match_score;
  const scoreColor = score >= 75 ? COLOR.hire : score >= 55 ? COLOR.maybe : COLOR.nohire;

  return (
    <div style={{
      position:"fixed", top:0, right:0, bottom:0, width:"min(560px, 100vw)",
      background:COLOR.white, boxShadow:"-4px 0 24px rgba(0,0,0,0.12)",
      zIndex:100, overflowY:"auto", display:"flex", flexDirection:"column",
    }}>
      {/* Panel header */}
      <div style={{
        padding:"20px 24px 16px", borderBottom:`1px solid ${COLOR.gray200}`,
        background:vc.bg, position:"sticky", top:0, zIndex:1,
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ fontSize:11, color:COLOR.gray500, fontWeight:600, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>
              Analysis Report
            </div>
            <div style={{ fontSize:20, fontWeight:800, color:COLOR.gray900 }}>{result.candidate_name}</div>
            <div style={{ fontSize:12, color:COLOR.gray500, marginTop:2 }}>{result.filename}</div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:36, fontWeight:900, color:scoreColor, lineHeight:1 }}>{score}</div>
              <div style={{ fontSize:10, color:COLOR.gray400 }}>Match Score</div>
            </div>
            <button onClick={onClose} style={{
              border:"none", background:COLOR.gray100, cursor:"pointer",
              width:32, height:32, borderRadius:99, fontSize:18, color:COLOR.gray500,
              display:"flex", alignItems:"center", justifyContent:"center"
            }}>×</button>
          </div>
        </div>
        <div style={{ marginTop:10, display:"flex", gap:6, flexWrap:"wrap" }}>
          <Badge text={vc.label} color={vc.badgeText} bg={vc.badge} />
          <Badge text={`Confidence: ${result.confidence}`} color={COLOR.gray700} bg={COLOR.gray100} />
          {(result.flags || []).map((f, i) => (
            <Badge key={i} text={f.replace(/_/g," ")} color="#7c2d12" bg="#fee2e2" />
          ))}
        </div>
      </div>

      <div style={{ padding:"20px 24px", flex:1 }}>
        {/* Summary */}
        <Card style={{ marginBottom:16 }}>
          <SectionTitle>💬 Summary</SectionTitle>
          <p style={{ margin:0, fontSize:13, color:COLOR.gray700, lineHeight:1.7 }}>{result.summary}</p>
        </Card>

        {/* Score breakdown */}
        <Card style={{ marginBottom:16 }}>
          <SectionTitle>📊 Score Breakdown</SectionTitle>
          <ScoreBar value={score} label="Overall Match"
            color={scoreColor} />
          <ScoreBar value={breakdown.skill_match || 0} label="Skill Match" color="#4f46e5" />
          <ScoreBar value={breakdown.seniority_match || 0} label="Seniority Fit" color="#0891b2" />
          <ScoreBar value={breakdown.domain_match || 0} label="Domain Alignment" color="#7c3aed" />
          <ScoreBar value={breakdown.education_match || 0} label="Education Match" color="#059669" />
        </Card>

        {/* Strengths + Gaps */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
          <Card>
            <SectionTitle color="#15803d">💪 Strengths</SectionTitle>
            {(result.strengths || []).length ? (
              (result.strengths).map((s, i) => (
                <div key={i} style={{ fontSize:12, color:COLOR.gray700, marginBottom:5, lineHeight:1.5 }}>
                  <span style={{ color:"#15803d" }}>✓</span> {s}
                </div>
              ))
            ) : <div style={{ fontSize:12, color:COLOR.gray400 }}>None identified</div>}
          </Card>
          <Card>
            <SectionTitle color="#b91c1c">⚠️ Gaps</SectionTitle>
            {(result.gaps || []).length ? (
              (result.gaps).map((g, i) => (
                <div key={i} style={{ fontSize:12, color:COLOR.gray700, marginBottom:5, lineHeight:1.5 }}>
                  <span style={{ color:COLOR.nohire }}>✕</span> {g}
                </div>
              ))
            ) : <div style={{ fontSize:12, color:COLOR.gray400 }}>No significant gaps</div>}
          </Card>
        </div>

        {/* Skills */}
        <Card style={{ marginBottom:16 }}>
          <SectionTitle>🛠 Skills Found</SectionTitle>
          {(result.key_skills_found || []).map((s, i) => <Tag key={i} text={s} variant="blue" />)}
          {!(result.key_skills_found?.length) && <div style={{ fontSize:12, color:COLOR.gray400 }}>None matched</div>}
          {(result.missing_skills || []).length > 0 && (
            <>
              <div style={{ fontSize:12, color:COLOR.gray500, marginTop:10, marginBottom:4, fontWeight:600 }}>Missing</div>
              {(result.missing_skills).map((s, i) => <Tag key={i} text={s} variant="red" />)}
            </>
          )}
        </Card>

        {/* Recommendation */}
        <Card style={{ marginBottom:16, background: score >= 75 ? COLOR.hireBg : score >= 55 ? COLOR.maybeBg : COLOR.nohireBg }}>
          <SectionTitle>💡 Recommendation</SectionTitle>
          <p style={{ margin:0, fontSize:13, color:COLOR.gray700, lineHeight:1.7 }}>{result.recommendation}</p>
          <div style={{ marginTop:8, fontSize:11, color:COLOR.gray400 }}>AI Provider: {result.ai_provider}</div>
        </Card>

        {/* Interview Questions */}
        <Card style={{ marginBottom:16 }}>
          <SectionTitle>🎤 Interview Questions</SectionTitle>
          {(result.interview_questions || []).map((q, i) => (
            <div key={i} style={{
              padding:"10px 12px", borderRadius:8, background:COLOR.gray50,
              marginBottom:8, fontSize:13, color:COLOR.gray700, lineHeight:1.5,
              borderLeft:`3px solid ${COLOR.primary}`
            }}>
              <span style={{ fontWeight:700, color:COLOR.primary }}>Q{i+1}. </span>{q}
            </div>
          ))}
        </Card>

        {/* Candidate extract */}
        {result.extracted_resume && (
          <Card style={{ marginBottom:16 }}>
            <SectionTitle>👤 Extracted Profile</SectionTitle>
            {[
              ["Role", result.extracted_resume.current_or_last_role],
              ["Experience", result.extracted_resume.years_of_experience != null ? `${result.extracted_resume.years_of_experience} years` : null],
              ["Domain", result.extracted_resume.domain],
              ["Education", result.extracted_resume.education],
              ["Seniority", result.extracted_resume.seniority_in_resume],
            ].filter(([,v]) => v).map(([k, v]) => (
              <div key={k} style={{ display:"flex", gap:8, marginBottom:4, fontSize:12 }}>
                <span style={{ color:COLOR.gray400, minWidth:80 }}>{k}</span>
                <span style={{ color:COLOR.gray700, fontWeight:500 }}>{v}</span>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
};

// ── Loading animation ─────────────────────────────────────────────────────────
const LoadingView = ({ total, done }) => (
  <div style={{ textAlign:"center", padding:"60px 20px" }}>
    <div style={{ fontSize:52, marginBottom:16 }}>🧠</div>
    <div style={{ fontSize:20, fontWeight:700, color:COLOR.gray900, marginBottom:8 }}>
      Analyzing Resumes…
    </div>
    {total > 1 && (
      <div style={{ fontSize:14, color:COLOR.gray500, marginBottom:20 }}>
        {done} of {total} completed
      </div>
    )}
    <div style={{
      width:200, height:6, background:COLOR.gray200, borderRadius:99,
      margin:"0 auto 20px", overflow:"hidden"
    }}>
      <div style={{
        height:"100%", borderRadius:99, background:COLOR.primary,
        width: total > 1 ? `${(done/total)*100}%` : "60%",
        transition:"width 0.5s ease",
        animation: total <= 1 ? "pulse 1.5s ease-in-out infinite" : "none",
      }} />
    </div>
    <div style={{ fontSize:13, color:COLOR.gray400 }}>
      Reading resume · Comparing with JD · Scoring
    </div>
    <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
  </div>
);

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [files, setFiles]         = useState([]);
  const [jd, setJd]               = useState("");
  const [results, setResults]     = useState([]);
  const [selected, setSelected]   = useState(null);
  const [loading, setLoading]     = useState(false);
  const [loadDone, setLoadDone]   = useState(0);
  const [error, setError]         = useState("");
  const [phase, setPhase]         = useState("input"); // input | results

  const addFiles = (incoming) => {
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      const fresh = incoming.filter(f => !names.has(f.name));
      return [...prev, ...fresh].slice(0, 10);
    });
  };

  const removeFile = (i) => setFiles(prev => prev.filter((_, idx) => idx !== i));

  const handleAnalyze = async () => {
    if (!files.length) return setError("Please upload at least one resume.");
    if (!jd.trim())    return setError("Please paste a job description.");
    setError("");
    setResults([]);
    setLoading(true);
    setLoadDone(0);

    const formData = new FormData();
    files.forEach(f => formData.append("resumes", f));
    formData.append("job_description", jd);

    try {
      const res = await fetch(`${API_BASE}/analyze-batch`, { method:"POST", body:formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server error ${res.status}`);
      }
      const data = await res.json();
      setResults(data.results || []);
      if (data.errors?.length) {
        setError(`${data.errors.length} file(s) failed: ${data.errors.map(e=>e.filename).join(", ")}`);
      }
      setPhase("results");
    } catch(e) {
      setError(e.message || "Something went wrong. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFiles([]); setJd(""); setResults([]);
    setSelected(null); setError(""); setPhase("input");
  };

  const hireCount  = results.filter(r => r.verdict === "HIRE").length;
  const maybeCount = results.filter(r => r.verdict === "MAYBE").length;
  const noCount    = results.filter(r => r.verdict === "NO_HIRE").length;

  return (
    <div style={{ minHeight:"100vh", background:COLOR.gray50, fontFamily:"'Inter',system-ui,sans-serif", color:COLOR.gray900 }}>

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <header style={{
        background:COLOR.white, borderBottom:`1px solid ${COLOR.gray200}`,
        padding:"0 32px", display:"flex", alignItems:"center",
        justifyContent:"space-between", height:62,
        position:"sticky", top:0, zIndex:50,
        boxShadow:"0 1px 3px rgba(0,0,0,0.04)"
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{
            width:38, height:38, borderRadius:10, background:"linear-gradient(135deg,#4f46e5,#7c3aed)",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:18,
          }}>⚡</div>
          <div>
            <div style={{ fontWeight:800, fontSize:16, letterSpacing:-0.3 }}>ATS Resume Analyzer</div>
            <div style={{ fontSize:11, color:COLOR.gray400 }}>Powered by AI · HR-Grade Scoring</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {phase === "results" && (
            <button onClick={handleReset} style={{
              background:"none", border:`1px solid ${COLOR.gray200}`, borderRadius:8,
              padding:"6px 14px", fontSize:13, cursor:"pointer", color:COLOR.gray700, fontWeight:500
            }}>← New Analysis</button>
          )}
          <div style={{
            fontSize:11, color:COLOR.gray500, background:COLOR.gray100,
            padding:"5px 12px", borderRadius:99, fontWeight:500
          }}>🔒 No data stored</div>
        </div>
      </header>

      {/* ── Error banner ─────────────────────────────────────────────────────── */}
      {error && (
        <div style={{
          background:"#fef2f2", borderBottom:`1px solid ${COLOR.nohireBorder}`, color:"#991b1b",
          padding:"10px 32px", fontSize:13, display:"flex", justifyContent:"space-between", alignItems:"center"
        }}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError("")} style={{ background:"none", border:"none", cursor:"pointer", color:"#991b1b", fontSize:18 }}>×</button>
        </div>
      )}

      <main style={{ maxWidth:1200, margin:"0 auto", padding:"32px 24px" }}>

        {/* ══════════════════════════════════════════════════════════════════════
            INPUT PHASE
        ═══════════════════════════════════════════════════════════════════════ */}
        {phase === "input" && !loading && (
          <>
            {/* Steps indicator */}
            <div style={{ display:"flex", gap:8, marginBottom:24, alignItems:"center" }}>
              {[["1","Add Job Description"],["2","Upload Resumes"],["3","Get Ranked Results"]].map(([n,t],i) => (
                <div key={n} style={{ display:"flex", alignItems:"center", gap:8 }}>
                  {i > 0 && <div style={{ width:32, height:1, background:COLOR.gray200 }} />}
                  <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                    <div style={{
                      width:24, height:24, borderRadius:99, background:COLOR.primary,
                      color:COLOR.white, fontSize:11, fontWeight:700,
                      display:"flex", alignItems:"center", justifyContent:"center"
                    }}>{n}</div>
                    <span style={{ fontSize:13, fontWeight:600, color:COLOR.gray700 }}>{t}</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:24 }}>
              {/* JD input */}
              <Card>
                <SectionTitle>📋 Job Description</SectionTitle>
                <textarea
                  value={jd}
                  onChange={e => setJd(e.target.value)}
                  placeholder={`Paste the job description here…\n\nExample:\nWe are looking for a Graphic Designer with 2+ years of experience. Skills required: Adobe Photoshop, Illustrator, video editing. Degree in design preferred.`}
                  style={{
                    width:"100%", height:260, padding:"12px 14px",
                    border:`1.5px solid ${jd ? COLOR.primary : COLOR.gray200}`,
                    borderRadius:10, fontSize:13, lineHeight:1.7, resize:"vertical",
                    outline:"none", fontFamily:"inherit", color:COLOR.gray700,
                    boxSizing:"border-box", transition:"border-color 0.2s",
                    background:COLOR.gray50,
                  }}
                />
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
                  <span style={{ fontSize:11, color:COLOR.gray400 }}>{jd.length} characters</span>
                  {jd.length > 100 && <span style={{ fontSize:11, color:COLOR.hire }}>✓ JD ready</span>}
                </div>
              </Card>

              {/* Resume upload */}
              <Card>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                  <SectionTitle style={{marginBottom:0}}>📁 Upload Resumes</SectionTitle>
                  <span style={{ fontSize:11, color:COLOR.gray400 }}>
                    {files.length}/10 uploaded
                  </span>
                </div>
                <UploadZone files={files} onFiles={addFiles} onRemove={removeFile} />
              </Card>
            </div>

            {/* Analyze button */}
            <div style={{ textAlign:"center" }}>
              <button
                onClick={handleAnalyze}
                disabled={!files.length || !jd.trim()}
                style={{
                  background: (!files.length || !jd.trim()) ? COLOR.gray200 : "linear-gradient(135deg,#4f46e5,#7c3aed)",
                  color: (!files.length || !jd.trim()) ? COLOR.gray400 : COLOR.white,
                  border:"none", borderRadius:12, padding:"15px 52px",
                  fontSize:16, fontWeight:700, cursor: (!files.length || !jd.trim()) ? "not-allowed" : "pointer",
                  boxShadow: (!files.length || !jd.trim()) ? "none" : "0 4px 14px rgba(79,70,229,0.4)",
                  transition:"all 0.2s", letterSpacing:0.3,
                }}
              >
                ⚡ Analyze {files.length > 1 ? `${files.length} Resumes` : "Resume"}
              </button>
              <div style={{ fontSize:12, color:COLOR.gray400, marginTop:8 }}>
                Takes 15–90 seconds depending on AI provider and number of resumes
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            LOADING
        ═══════════════════════════════════════════════════════════════════════ */}
        {loading && <LoadingView total={files.length} done={loadDone} />}

        {/* ══════════════════════════════════════════════════════════════════════
            RESULTS PHASE
        ═══════════════════════════════════════════════════════════════════════ */}
        {phase === "results" && !loading && (
          <div style={{ display:"flex", gap:20 }}>

            <div style={{ flex:1, minWidth:0 }}>
              {/* Summary stats */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:20 }}>
                {[
                  { label:"Recommended", count:hireCount,  color:COLOR.hire,   bg:COLOR.hireBg,   icon:"✓" },
                  { label:"Review Needed", count:maybeCount, color:COLOR.maybe,  bg:COLOR.maybeBg,  icon:"~" },
                  { label:"Not Recommended", count:noCount,  color:COLOR.nohire, bg:COLOR.nohireBg, icon:"✕" },
                ].map(s => (
                  <div key={s.label} style={{
                    background:s.bg, borderRadius:12, padding:"16px 20px",
                    border:`1px solid`, borderColor: s.count ? s.color + "40" : COLOR.gray200,
                  }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{
                        width:32, height:32, borderRadius:99, background:s.color,
                        color:COLOR.white, display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:14, fontWeight:700
                      }}>{s.icon}</div>
                      <div>
                        <div style={{ fontSize:24, fontWeight:900, color:s.count ? s.color : COLOR.gray400, lineHeight:1 }}>{s.count}</div>
                        <div style={{ fontSize:11, color:COLOR.gray500, marginTop:1 }}>{s.label}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Ranking table */}
              <Card style={{ padding:0, overflow:"hidden" }}>
                <div style={{ padding:"16px 20px", borderBottom:`1px solid ${COLOR.gray200}`,
                  display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div style={{ fontWeight:700, fontSize:15 }}>🏆 Candidate Rankings</div>
                  <div style={{ fontSize:12, color:COLOR.gray400 }}>{results.length} candidate{results.length !== 1 ? "s" : ""} analyzed</div>
                </div>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse" }}>
                    <thead>
                      <tr style={{ background:COLOR.gray50 }}>
                        {["Rank","Candidate","Score","Verdict","Overview",""].map(h => (
                          <th key={h} style={{ padding:"10px 16px", textAlign:"left",
                            fontSize:11, color:COLOR.gray400, fontWeight:700, textTransform:"uppercase",
                            letterSpacing:0.5, borderBottom:`1px solid ${COLOR.gray200}` }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r, i) => (
                        <ResultRow key={i} result={r} rank={r.rank || i+1}
                          onSelect={setSelected}
                          isSelected={selected?.filename === r.filename && selected?.candidate_name === r.candidate_name}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* Sticky detail panel (inline on wide screens, modal-style on narrow) */}
            {selected && (
              <div style={{ width:520, flexShrink:0 }}>
                <div style={{ position:"sticky", top:80 }}>
                  <DetailPanel result={selected} onClose={() => setSelected(null)} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Fullscreen detail panel on small screens */}
        {selected && window.innerWidth < 1024 && (
          <DetailPanel result={selected} onClose={() => setSelected(null)} />
        )}
      </main>
    </div>
  );
}
