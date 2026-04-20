import { useState, useRef, useCallback, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const COLOR = {
  brand:        "#E31E24",
  brandDark:    "#B91C1C",
  brandLight:   "#FEE2E2",
  brandBg:      "#FEF2F2",
  bg:           "#FAFAFA",
  bgSoft:       "#F6F7F9",
  surface:      "#FFFFFF",
  ink:          "#0B1220",
  inkSoft:      "#334155",
  muted:        "#64748B",
  subtle:       "#94A3B8",
  hairline:     "#E6E8EC",
  hairlineSoft: "#F0F2F5",
  indigo:       "#4F46E5",
  indigoSoft:   "#EEF2FF",
  hire:         "#16A34A",
  hireBg:       "#ECFDF5",
  hireBorder:   "#A7F3D0",
  hireBadge:    "#DCFCE7",
  hireBadgeText:"#15803D",
  maybe:        "#D97706",
  maybeBg:      "#FFFBEB",
  maybeBorder:  "#FCD34D",
  maybeBadge:   "#FEF3C7",
  maybeBadgeText:"#A16207",
  nohire:       "#DC2626",
  nohireBg:     "#FEF2F2",
  nohireBorder: "#FCA5A5",
  nohireBadge:  "#FEE2E2",
  nohireBadgeText:"#B91C1C",
};

const SHADOW = {
  xs: "0 1px 2px rgba(15,23,42,0.05)",
  sm: "0 2px 6px rgba(15,23,42,0.06)",
  md: "0 6px 18px rgba(15,23,42,0.08)",
  lg: "0 20px 48px rgba(15,23,42,0.12)",
  brand: "0 10px 28px rgba(227,30,36,0.28)",
};

const VERDICT = {
  HIRE:    { label: "Recommended",     color: COLOR.hire,   bg: COLOR.hireBg,   border: COLOR.hireBorder,   icon: "\u2713", badge: COLOR.hireBadge,   badgeText: COLOR.hireBadgeText   },
  MAYBE:   { label: "Review Needed",   color: COLOR.maybe,  bg: COLOR.maybeBg,  border: COLOR.maybeBorder,  icon: "~",      badge: COLOR.maybeBadge,  badgeText: COLOR.maybeBadgeText  },
  NO_HIRE: { label: "Not Recommended", color: COLOR.nohire, bg: COLOR.nohireBg, border: COLOR.nohireBorder, icon: "\u2715", badge: COLOR.nohireBadge, badgeText: COLOR.nohireBadgeText },
};

const IcsLogo = ({ height = 34 }) => {
  const [src, setSrc] = useState("/logo.png");
  return (
    <img src={src} onError={() => setSrc("/logo.svg")} alt="ICS"
      style={{ height, width: "auto", display: "block" }} />
  );
};

const ScoreRing = ({ score, color, size = 64, stroke = 6 }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (Math.max(0, Math.min(100, score)) / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={COLOR.hairlineSoft} strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.9s cubic-bezier(.2,.8,.2,1)" }} />
    </svg>
  );
};

const ScoreBar = ({ value, label, color = COLOR.indigo }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
      <span style={{ fontSize:12, color:COLOR.muted, fontWeight:500 }}>{label}</span>
      <span style={{ fontSize:12, fontWeight:700, color }}>{value}%</span>
    </div>
    <div style={{ height:6, background:COLOR.hairlineSoft, borderRadius:99, overflow:"hidden" }}>
      <div style={{ height:"100%", borderRadius:99, background:color,
        width:`${Math.max(0, Math.min(100, value))}%`, transition:"width 1s cubic-bezier(.2,.8,.2,1)" }} />
    </div>
  </div>
);

const Tag = ({ text, variant = "blue" }) => {
  const variants = {
    blue:   { bg:"#DBEAFE", color:"#1D4ED8" },
    green:  { bg:"#DCFCE7", color:"#15803D" },
    red:    { bg:"#FEE2E2", color:"#B91C1C" },
    purple: { bg:"#EDE9FE", color:"#6D28D9" },
    brand:  { bg: COLOR.brandLight, color: COLOR.brandDark },
    gray:   { bg: COLOR.hairlineSoft, color: COLOR.inkSoft },
  };
  const s = variants[variant] || variants.gray;
  return (
    <span style={{ display:"inline-block", padding:"3px 10px", borderRadius:99,
      fontSize:11.5, fontWeight:600, margin:"2px 4px 2px 0",
      background:s.bg, color:s.color, letterSpacing:.1 }}>{text}</span>
  );
};

const Badge = ({ text, color, bg }) => (
  <span style={{ padding:"4px 11px", borderRadius:99, fontSize:11, fontWeight:700,
    background:bg, color, letterSpacing:0.3, textTransform:"uppercase" }}>{text}</span>
);

const Card = ({ children, style = {}, hoverable = false }) => (
  <div
    style={{
      background:COLOR.surface, borderRadius:16,
      border:`1px solid ${COLOR.hairline}`, boxShadow:SHADOW.xs, padding:22,
      transition:"box-shadow .2s, transform .2s", ...style,
    }}
    onMouseEnter={hoverable ? (e) => { e.currentTarget.style.boxShadow = SHADOW.md; } : undefined}
    onMouseLeave={hoverable ? (e) => { e.currentTarget.style.boxShadow = SHADOW.xs; } : undefined}
  >{children}</div>
);

const SectionTitle = ({ children, color = COLOR.ink, style = {} }) => (
  <div style={{ fontSize:13, fontWeight:700, color, marginBottom:12, letterSpacing:0.2, ...style }}>{children}</div>
);

const UploadZone = ({ files, onFiles, onRemove }) => {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef();
  const accept = useCallback((list) => {
    const allowed = [".pdf",".docx",".txt"];
    const valid = Array.from(list).filter(f => allowed.includes("." + f.name.split(".").pop().toLowerCase()));
    if (valid.length !== list.length) alert("Only PDF, DOCX, and TXT files are supported.");
    onFiles(valid);
  }, [onFiles]);
  const borderColor = drag ? COLOR.brand : files.length ? COLOR.hire : COLOR.hairline;
  const bg = drag ? COLOR.brandBg : files.length ? COLOR.hireBg : COLOR.bgSoft;
  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={e => { e.preventDefault(); setDrag(false); accept(e.dataTransfer.files); }}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        style={{
          border:`1.5px dashed ${borderColor}`,
          borderRadius:14, padding:"32px 20px", textAlign:"center",
          cursor:"pointer", background: bg, transition:"all 0.2s",
        }}
      >
        <div style={{
          width:56, height:56, margin:"0 auto 10px",
          borderRadius:14, background: files.length ? COLOR.hire : COLOR.brand,
          color:COLOR.surface, display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:26, fontWeight:800,
          boxShadow: files.length ? "0 6px 18px rgba(22,163,74,.28)" : SHADOW.brand,
        }}>{files.length ? "\u2713" : "+"}</div>
        {files.length === 0 ? (
          <>
            <div style={{ fontWeight:600, color:COLOR.ink, fontSize:14 }}>Drop resumes here or click to browse</div>
            <div style={{ fontSize:12, color:COLOR.subtle, marginTop:4 }}>PDF, DOCX, TXT {"\u00b7"} Max 10 resumes {"\u00b7"} 5 MB each</div>
          </>
        ) : (
          <div style={{ fontWeight:600, color:COLOR.hireBadgeText, fontSize:14 }}>
            {files.length} resume{files.length > 1 ? "s" : ""} selected {"\u00b7"} Click to add more
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" multiple accept=".pdf,.docx,.txt"
        style={{ display:"none" }} onChange={e => accept(e.target.files)} />

      {files.length > 0 && (
        <div style={{ marginTop:12, display:"flex", flexDirection:"column", gap:6 }}>
          {files.map((f, i) => (
            <div key={i} style={{
              display:"flex", alignItems:"center", justifyContent:"space-between",
              background:COLOR.surface, borderRadius:10, padding:"10px 14px",
              border:`1px solid ${COLOR.hairline}`, fontSize:13,
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
                <span style={{
                  width:26, height:26, borderRadius:6, background:COLOR.brandLight,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:11, fontWeight:800, color:COLOR.brand,
                }}>{f.name.split(".").pop().toUpperCase().slice(0,3)}</span>
                <span style={{ fontWeight:500, color:COLOR.inkSoft, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name}</span>
                <span style={{ color:COLOR.subtle, fontSize:11, flexShrink:0 }}>{(f.size/1024).toFixed(0)} KB</span>
              </div>
              <button onClick={(e) => { e.stopPropagation(); onRemove(i); }} style={{
                border:"none", background:"none", cursor:"pointer",
                color:COLOR.subtle, fontSize:18, padding:"0 4px", lineHeight:1
              }}>{"\u00d7"}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ResultRow = ({ result, rank, onSelect, isSelected }) => {
  const vc = VERDICT[result.verdict] || VERDICT.MAYBE;
  const score = result.match_score;
  const scoreColor = score >= 75 ? COLOR.hire : score >= 55 ? COLOR.maybe : COLOR.nohire;
  return (
    <tr
      onClick={() => onSelect(result)}
      style={{
        cursor:"pointer", transition:"background 0.15s",
        background: isSelected ? COLOR.brandBg : "transparent",
        borderBottom:`1px solid ${COLOR.hairlineSoft}`,
      }}
      onMouseEnter={e => { if(!isSelected) e.currentTarget.style.background = COLOR.bgSoft; }}
      onMouseLeave={e => { if(!isSelected) e.currentTarget.style.background = "transparent"; }}
    >
      <td style={{ padding:"14px 16px", fontWeight:800, color:COLOR.subtle, fontSize:13 }}>#{rank}</td>
      <td style={{ padding:"14px 16px" }}>
        <div style={{ fontWeight:700, color:COLOR.ink, fontSize:14 }}>{result.candidate_name}</div>
        <div style={{ fontSize:11, color:COLOR.subtle, marginTop:2 }}>{result.filename}</div>
      </td>
      <td style={{ padding:"14px 16px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <ScoreRing score={score} color={scoreColor} size={42} stroke={5} />
          <div style={{ minWidth:28 }}>
            <div style={{ fontSize:17, fontWeight:900, color:scoreColor, lineHeight:1 }}>{score}</div>
            <div style={{ fontSize:9, color:COLOR.subtle, marginTop:1 }}>/ 100</div>
          </div>
        </div>
      </td>
      <td style={{ padding:"14px 16px" }}>
        <Badge text={vc.label} color={vc.badgeText} bg={vc.badge} />
      </td>
      <td style={{ padding:"14px 16px", maxWidth:320 }}>
        <div style={{ fontSize:12.5, color:COLOR.muted, lineHeight:1.55 }}>
          {(result.summary || "").slice(0, 130)}{result.summary?.length > 130 ? "\u2026" : ""}
        </div>
      </td>
      <td style={{ padding:"14px 16px" }}>
        <div style={{ fontSize:12, color:COLOR.brand, fontWeight:700 }}>View {"\u2192"}</div>
      </td>
    </tr>
  );
};

const DetailPanel = ({ result, onClose }) => {
  if (!result) return null;
  const vc = VERDICT[result.verdict] || VERDICT.MAYBE;
  const breakdown = result.score_breakdown || {};
  const score = result.match_score;
  const scoreColor = score >= 75 ? COLOR.hire : score >= 55 ? COLOR.maybe : COLOR.nohire;

  return (
    <div style={{
      background:COLOR.surface, borderRadius:16,
      border:`1px solid ${COLOR.hairline}`,
      boxShadow: SHADOW.md,
      overflow:"hidden", animation:"slideUp .3s ease",
    }}>
      <div style={{
        padding:"22px 24px 18px",
        background:`linear-gradient(180deg, ${vc.bg} 0%, ${COLOR.surface} 100%)`,
        borderBottom:`1px solid ${COLOR.hairline}`,
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12 }}>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:10, color:vc.badgeText, fontWeight:800, textTransform:"uppercase", letterSpacing:1.2, marginBottom:6 }}>
              Analysis Report
            </div>
            <div style={{ fontSize:20, fontWeight:800, color:COLOR.ink, letterSpacing:-.3 }}>{result.candidate_name}</div>
            <div style={{ fontSize:12, color:COLOR.subtle, marginTop:3 }}>{result.filename}</div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:34, fontWeight:900, color:scoreColor, lineHeight:1, letterSpacing:-1 }}>{score}</div>
              <div style={{ fontSize:10, color:COLOR.subtle, fontWeight:600, marginTop:2 }}>MATCH</div>
            </div>
            <button onClick={onClose} style={{
              border:"none", background:COLOR.surface, cursor:"pointer",
              width:32, height:32, borderRadius:99, fontSize:18, color:COLOR.muted,
              display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow: SHADOW.xs,
            }}>{"\u00d7"}</button>
          </div>
        </div>
        <div style={{ marginTop:12, display:"flex", gap:6, flexWrap:"wrap" }}>
          <Badge text={vc.label} color={vc.badgeText} bg={vc.badge} />
          <Badge text={`Conf: ${result.confidence}`} color={COLOR.inkSoft} bg={COLOR.hairlineSoft} />
          {(result.flags || []).map((f, i) => (
            <Badge key={i} text={f.replace(/_/g," ")} color={COLOR.brand} bg={COLOR.brandLight} />
          ))}
        </div>
      </div>

      <div style={{ padding:"20px 24px" }}>
        <Card style={{ marginBottom:14 }}>
          <SectionTitle>Summary</SectionTitle>
          <p style={{ margin:0, fontSize:13.5, color:COLOR.inkSoft, lineHeight:1.7 }}>{result.summary}</p>
        </Card>

        <Card style={{ marginBottom:14 }}>
          <SectionTitle>Score Breakdown</SectionTitle>
          <ScoreBar value={score} label="Overall Match" color={scoreColor} />
          <ScoreBar value={breakdown.skill_match || 0} label="Skill Match" color={COLOR.brand} />
          <ScoreBar value={breakdown.seniority_match || 0} label="Seniority Fit" color={COLOR.indigo} />
          <ScoreBar value={breakdown.domain_match || 0} label="Domain Alignment" color="#7C3AED" />
          <ScoreBar value={breakdown.education_match || 0} label="Education Match" color={COLOR.hire} />
        </Card>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
          <Card>
            <SectionTitle color={COLOR.hireBadgeText}>Strengths</SectionTitle>
            {(result.strengths || []).length ? (
              (result.strengths).map((s, i) => (
                <div key={i} style={{ fontSize:12.5, color:COLOR.inkSoft, marginBottom:7, lineHeight:1.55, display:"flex", gap:7 }}>
                  <span style={{ color:COLOR.hire, fontWeight:900, flexShrink:0 }}>{"\u2713"}</span><span>{s}</span>
                </div>
              ))
            ) : <div style={{ fontSize:12, color:COLOR.subtle }}>None identified</div>}
          </Card>
          <Card>
            <SectionTitle color={COLOR.nohireBadgeText}>Gaps</SectionTitle>
            {(result.gaps || []).length ? (
              (result.gaps).map((g, i) => (
                <div key={i} style={{ fontSize:12.5, color:COLOR.inkSoft, marginBottom:7, lineHeight:1.55, display:"flex", gap:7 }}>
                  <span style={{ color:COLOR.nohire, fontWeight:900, flexShrink:0 }}>{"\u2715"}</span><span>{g}</span>
                </div>
              ))
            ) : <div style={{ fontSize:12, color:COLOR.subtle }}>No significant gaps</div>}
          </Card>
        </div>

        <Card style={{ marginBottom:14 }}>
          <SectionTitle>Skills Found</SectionTitle>
          {(result.key_skills_found || []).map((s, i) => <Tag key={i} text={s} variant="brand" />)}
          {!(result.key_skills_found?.length) && <div style={{ fontSize:12, color:COLOR.subtle }}>None matched</div>}
          {(result.missing_skills || []).length > 0 && (
            <>
              <div style={{ fontSize:12, color:COLOR.muted, marginTop:12, marginBottom:6, fontWeight:600 }}>Missing</div>
              {(result.missing_skills).map((s, i) => <Tag key={i} text={s} variant="red" />)}
            </>
          )}
        </Card>

        <Card style={{
          marginBottom:14,
          background: score >= 75 ? COLOR.hireBg : score >= 55 ? COLOR.maybeBg : COLOR.nohireBg,
          borderColor: score >= 75 ? COLOR.hireBorder : score >= 55 ? COLOR.maybeBorder : COLOR.nohireBorder,
        }}>
          <SectionTitle>Recommendation</SectionTitle>
          <p style={{ margin:0, fontSize:13.5, color:COLOR.inkSoft, lineHeight:1.7 }}>{result.recommendation}</p>
          <div style={{ marginTop:10, fontSize:11, color:COLOR.subtle }}>AI Provider: {result.ai_provider}</div>
        </Card>

        <Card style={{ marginBottom:14 }}>
          <SectionTitle>Interview Questions</SectionTitle>
          {(result.interview_questions || []).map((q, i) => (
            <div key={i} style={{
              padding:"12px 14px", borderRadius:10, background:COLOR.bgSoft,
              marginBottom:8, fontSize:13, color:COLOR.inkSoft, lineHeight:1.55,
              borderLeft:`3px solid ${COLOR.brand}`
            }}>
              <span style={{ fontWeight:700, color:COLOR.brand }}>Q{i+1}. </span>{q}
            </div>
          ))}
        </Card>

        {result.extracted_resume && (
          <Card style={{ marginBottom:4 }}>
            <SectionTitle>Extracted Profile</SectionTitle>
            {[
              ["Role", result.extracted_resume.current_or_last_role],
              ["Experience", result.extracted_resume.years_of_experience != null ? `${result.extracted_resume.years_of_experience} years` : null],
              ["Domain", result.extracted_resume.domain],
              ["Education", result.extracted_resume.education],
              ["Seniority", result.extracted_resume.seniority_in_resume],
            ].filter(([,v]) => v).map(([k, v]) => (
              <div key={k} style={{ display:"flex", gap:10, marginBottom:6, fontSize:12.5 }}>
                <span style={{ color:COLOR.subtle, minWidth:92, fontWeight:600, textTransform:"uppercase", fontSize:10.5, letterSpacing:.5 }}>{k}</span>
                <span style={{ color:COLOR.inkSoft, fontWeight:500 }}>{v}</span>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
};

const LoadingView = ({ total, done }) => (
  <div style={{ textAlign:"center", padding:"80px 20px" }}>
    <div style={{ width:72, height:72, margin:"0 auto 20px", position:"relative" }}>
      <div style={{
        width:72, height:72, borderRadius:99,
        border:`4px solid ${COLOR.brandLight}`,
        borderTopColor: COLOR.brand,
        animation: "spin 1s linear infinite",
      }} />
    </div>
    <div style={{ fontSize:22, fontWeight:800, color:COLOR.ink, marginBottom:8, letterSpacing:-.3 }}>
      Analyzing resumes
    </div>
    {total > 1 && (
      <div style={{ fontSize:13, color:COLOR.muted, marginBottom:20 }}>
        {done} of {total} completed
      </div>
    )}
    <div style={{
      width:240, height:6, background:COLOR.hairlineSoft, borderRadius:99,
      margin:"0 auto 18px", overflow:"hidden"
    }}>
      <div style={{
        height:"100%", borderRadius:99,
        background: `linear-gradient(90deg, ${COLOR.brand}, ${COLOR.brandDark})`,
        width: total > 1 ? `${(done/total)*100}%` : "60%",
        transition:"width 0.5s ease",
        animation: total <= 1 ? "pulse 1.5s ease-in-out infinite" : "none",
      }} />
    </div>
    <div style={{ fontSize:13, color:COLOR.subtle }}>
      Reading resume {"\u00b7"} Comparing with JD {"\u00b7"} Scoring
    </div>
  </div>
);

export default function App() {
  const [files, setFiles]         = useState([]);
  const [jd, setJd]               = useState("");
  const [results, setResults]     = useState([]);
  const [selected, setSelected]   = useState(null);
  const [loading, setLoading]     = useState(false);
  const [loadDone, setLoadDone]   = useState(0);
  const [error, setError]         = useState("");
  const [phase, setPhase]         = useState("input");
  const [narrow, setNarrow]       = useState(typeof window !== "undefined" ? window.innerWidth < 1024 : false);

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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
    <div style={{ minHeight:"100vh", background:COLOR.bg, color:COLOR.ink }}>
      <header style={{
        background:COLOR.surface,
        borderBottom:`1px solid ${COLOR.hairline}`,
        padding:"0 28px", display:"flex", alignItems:"center",
        justifyContent:"space-between", height:64,
        position:"sticky", top:0, zIndex:50,
        backdropFilter:"saturate(180%) blur(8px)",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <IcsLogo height={34} />
          <div style={{ width:1, height:26, background:COLOR.hairline, margin:"0 2px" }} />
          <div>
            <div style={{ fontWeight:800, fontSize:15, letterSpacing:-0.3, color: COLOR.ink }}>Resume Analyzer</div>
            <div style={{ fontSize:11, color:COLOR.muted, marginTop:1, fontWeight:500 }}>AI-powered candidate screening</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {phase === "results" && (
            <button onClick={handleReset} style={{
              background:COLOR.surface, border:`1px solid ${COLOR.hairline}`, borderRadius:8,
              padding:"7px 14px", fontSize:13, cursor:"pointer", color:COLOR.inkSoft, fontWeight:600,
              transition:"all .15s",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = COLOR.bgSoft; }}
              onMouseLeave={e => { e.currentTarget.style.background = COLOR.surface; }}
            >{"\u2190"} New analysis</button>
          )}
          <div style={{
            fontSize:11, color:COLOR.muted, background:COLOR.bgSoft,
            padding:"6px 12px", borderRadius:99, fontWeight:600,
            display:"flex", alignItems:"center", gap:6,
            border:`1px solid ${COLOR.hairline}`,
          }}>
            <span style={{ width:6, height:6, borderRadius:99, background: COLOR.hire, boxShadow:"0 0 0 2px rgba(22,163,74,.18)" }} />
            No data stored
          </div>
        </div>
      </header>

      {error && (
        <div style={{
          background:COLOR.nohireBg, borderBottom:`1px solid ${COLOR.nohireBorder}`, color:COLOR.nohireBadgeText,
          padding:"11px 28px", fontSize:13, display:"flex", justifyContent:"space-between", alignItems:"center"
        }}>
          <span style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ width:18, height:18, borderRadius:99, background:COLOR.nohire, color:"#fff", fontSize:11, display:"inline-flex", alignItems:"center", justifyContent:"center", fontWeight:800 }}>!</span>
            {error}
          </span>
          <button onClick={() => setError("")} style={{ background:"none", border:"none", cursor:"pointer", color:COLOR.nohireBadgeText, fontSize:18 }}>{"\u00d7"}</button>
        </div>
      )}

      <main style={{ maxWidth:1240, margin:"0 auto", padding: phase === "input" ? "40px 24px 80px" : "28px 24px 80px" }}>
        {phase === "input" && !loading && (
          <>
            <div style={{ textAlign:"center", marginBottom:36, animation:"slideUp .4s ease" }}>
              <div style={{
                display:"inline-flex", alignItems:"center", gap:7,
                padding:"5px 13px", borderRadius:99,
                background:COLOR.brandLight, color:COLOR.brand, fontSize:11.5,
                fontWeight:700, letterSpacing:.3, marginBottom:18, textTransform:"uppercase",
              }}>
                <span style={{ width:6, height:6, borderRadius:99, background:COLOR.brand }} />
                HR-grade scoring
              </div>
              <h1 style={{
                fontSize:40, fontWeight:900, letterSpacing:-1.5, lineHeight:1.1,
                color:COLOR.ink, marginBottom:14,
              }}>
                Screen smarter, hire faster.
              </h1>
              <p style={{
                fontSize:16, color:COLOR.muted, maxWidth:620, margin:"0 auto",
                lineHeight:1.55, fontWeight:400,
              }}>
                Upload resumes, paste a job description, and get ranked candidates
                with honest, human-like scoring {"\u2014"} not keyword filters.
              </p>
            </div>

            <div style={{ display:"flex", gap:8, marginBottom:24, alignItems:"center", justifyContent:"center", flexWrap:"wrap" }}>
              {[["1","Paste JD"],["2","Upload Resumes"],["3","Get Ranked Results"]].map(([n,t],i) => (
                <div key={n} style={{ display:"flex", alignItems:"center", gap:8 }}>
                  {i > 0 && <div style={{ width:28, height:1, background:COLOR.hairline }} />}
                  <div style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 12px 5px 5px", background:COLOR.surface, borderRadius:99, border:`1px solid ${COLOR.hairline}` }}>
                    <div style={{
                      width:22, height:22, borderRadius:99, background:COLOR.brand,
                      color:COLOR.surface, fontSize:11, fontWeight:800,
                      display:"flex", alignItems:"center", justifyContent:"center"
                    }}>{n}</div>
                    <span style={{ fontSize:12.5, fontWeight:600, color:COLOR.inkSoft }}>{t}</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display:"grid", gridTemplateColumns: narrow ? "1fr" : "1fr 1fr", gap:18, marginBottom:28 }}>
              <Card hoverable>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                  <SectionTitle style={{marginBottom:0}}>Job Description</SectionTitle>
                  <span style={{ fontSize:11, color:COLOR.subtle }}>Paste role details below</span>
                </div>
                <textarea
                  value={jd}
                  onChange={e => setJd(e.target.value)}
                  placeholder={"Paste the job description here...\n\nExample:\nWe are hiring a Graphic Designer with 2+ years of experience. Required skills: Adobe Photoshop, Illustrator, video editing. Degree in design preferred."}
                  style={{
                    width:"100%", height:260, padding:"14px 16px",
                    border:`1.5px solid ${jd ? COLOR.brand : COLOR.hairline}`,
                    borderRadius:12, fontSize:13.5, lineHeight:1.7, resize:"vertical",
                    outline:"none", fontFamily:"inherit", color:COLOR.inkSoft,
                    boxSizing:"border-box", transition:"border-color 0.2s, box-shadow .2s",
                    background:COLOR.bgSoft,
                    boxShadow: jd ? `0 0 0 4px ${COLOR.brandLight}` : "none",
                  }}
                />
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:8 }}>
                  <span style={{ fontSize:11, color:COLOR.subtle }}>{jd.length} characters</span>
                  {jd.length > 100 && <span style={{ fontSize:11, color:COLOR.hire, fontWeight:600 }}>{"\u2713"} JD ready</span>}
                </div>
              </Card>

              <Card hoverable>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                  <SectionTitle style={{marginBottom:0}}>Upload Resumes</SectionTitle>
                  <span style={{ fontSize:11, color:COLOR.subtle, fontWeight:600,
                    background: COLOR.bgSoft, padding:"3px 10px", borderRadius:99 }}>
                    {files.length}/10 uploaded
                  </span>
                </div>
                <UploadZone files={files} onFiles={addFiles} onRemove={removeFile} />
              </Card>
            </div>

            <div style={{ textAlign:"center" }}>
              <button
                onClick={handleAnalyze}
                disabled={!files.length || !jd.trim()}
                style={{
                  background: (!files.length || !jd.trim()) ? COLOR.hairline : `linear-gradient(135deg, ${COLOR.brand}, ${COLOR.brandDark})`,
                  color: (!files.length || !jd.trim()) ? COLOR.subtle : COLOR.surface,
                  border:"none", borderRadius:12, padding:"15px 56px",
                  fontSize:15.5, fontWeight:700, cursor: (!files.length || !jd.trim()) ? "not-allowed" : "pointer",
                  boxShadow: (!files.length || !jd.trim()) ? "none" : SHADOW.brand,
                  transition:"transform .15s, box-shadow .15s", letterSpacing:0.3,
                }}
                onMouseDown={e => { if (!e.currentTarget.disabled) e.currentTarget.style.transform = "translateY(1px)"; }}
                onMouseUp={e => { e.currentTarget.style.transform = "translateY(0)"; }}
              >
                Analyze {files.length > 1 ? `${files.length} resumes` : "resume"} {"\u2192"}
              </button>
              <div style={{ fontSize:12, color:COLOR.subtle, marginTop:12 }}>
                Takes 15{"\u2013"}90 seconds depending on provider and batch size
              </div>
            </div>

            <div style={{ display:"grid", gridTemplateColumns: narrow ? "1fr" : "repeat(3, 1fr)", gap:14, marginTop:56 }}>
              {[
                { title:"Privacy-first", body:"Resumes never leave memory. Nothing stored, logged, or resold." },
                { title:"Human-like scoring", body:"Skill equivalences, retention-risk flags, domain adjacency." },
                { title:"Explainable results", body:"Every verdict comes with a reason, breakdown, and interview questions." },
              ].map((f, i) => (
                <div key={i} style={{
                  background:COLOR.surface, borderRadius:14, padding:"18px 20px",
                  border:`1px solid ${COLOR.hairline}`,
                }}>
                  <div style={{
                    width:30, height:30, borderRadius:8, background:COLOR.brandLight,
                    color:COLOR.brand, display:"flex", alignItems:"center", justifyContent:"center",
                    fontWeight:900, fontSize:13, marginBottom:10,
                  }}>0{i+1}</div>
                  <div style={{ fontSize:13, fontWeight:700, color:COLOR.ink, marginBottom:4 }}>{f.title}</div>
                  <div style={{ fontSize:12.5, color:COLOR.muted, lineHeight:1.55 }}>{f.body}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {loading && <LoadingView total={files.length} done={loadDone} />}

        {phase === "results" && !loading && (
          <div style={{ display:"flex", gap:20, flexDirection: narrow ? "column" : "row" }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:20 }}>
                {[
                  { label:"Recommended",     count:hireCount,  color:COLOR.hire,   bg:COLOR.hireBg,   border:COLOR.hireBorder,   icon:"\u2713" },
                  { label:"Review Needed",   count:maybeCount, color:COLOR.maybe,  bg:COLOR.maybeBg,  border:COLOR.maybeBorder,  icon:"~" },
                  { label:"Not Recommended", count:noCount,    color:COLOR.nohire, bg:COLOR.nohireBg, border:COLOR.nohireBorder, icon:"\u2715" },
                ].map(s => (
                  <div key={s.label} style={{
                    background:COLOR.surface, borderRadius:14, padding:"16px 18px",
                    border:`1px solid ${s.count ? s.border : COLOR.hairline}`,
                    boxShadow: SHADOW.xs,
                  }}>
                    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                      <div style={{
                        width:38, height:38, borderRadius:10, background:s.bg,
                        color:s.color, display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:16, fontWeight:800, border:`1px solid ${s.border}`,
                      }}>{s.icon}</div>
                      <div>
                        <div style={{ fontSize:26, fontWeight:900, color:s.count ? s.color : COLOR.subtle, lineHeight:1, letterSpacing:-.6 }}>{s.count}</div>
                        <div style={{ fontSize:11, color:COLOR.muted, marginTop:3, fontWeight:600, textTransform:"uppercase", letterSpacing:.3 }}>{s.label}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Card style={{ padding:0, overflow:"hidden" }}>
                <div style={{ padding:"18px 22px", borderBottom:`1px solid ${COLOR.hairline}`,
                  display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div>
                    <div style={{ fontWeight:800, fontSize:15, color:COLOR.ink, letterSpacing:-.2 }}>Candidate Rankings</div>
                    <div style={{ fontSize:12, color:COLOR.subtle, marginTop:2 }}>Sorted by overall match score</div>
                  </div>
                  <div style={{ fontSize:12, color:COLOR.muted, fontWeight:500 }}>{results.length} candidate{results.length !== 1 ? "s" : ""} analyzed</div>
                </div>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse" }}>
                    <thead>
                      <tr style={{ background:COLOR.bgSoft }}>
                        {["Rank","Candidate","Score","Verdict","Overview",""].map(h => (
                          <th key={h} style={{ padding:"11px 16px", textAlign:"left",
                            fontSize:10.5, color:COLOR.muted, fontWeight:700, textTransform:"uppercase",
                            letterSpacing:0.6, borderBottom:`1px solid ${COLOR.hairline}` }}>{h}</th>
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

            {selected && (
              <div style={{ width: narrow ? "100%" : 540, flexShrink:0 }}>
                <div style={{ position: narrow ? "static" : "sticky", top:88 }}>
                  <DetailPanel result={selected} onClose={() => setSelected(null)} />
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer style={{
        borderTop:`1px solid ${COLOR.hairline}`,
        padding:"18px 28px", textAlign:"center",
        fontSize:12, color:COLOR.subtle, background:COLOR.surface,
      }}>
        {"\u00a9"} {new Date().getFullYear()} ICS {"\u00b7"} Resume Analyzer {"\u00b7"} Privacy-first HR tooling
      </footer>
    </div>
  );
}
