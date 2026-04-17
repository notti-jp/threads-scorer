"use client";
import { useState } from "react";

const LABELS = { hook: "フック力", empathy: "共感・議論性", structure: "構成・読みやすさ", shareability: "拡散性", culture_fit: "Threads文化適合" };
const GC = { S: "#e11d48", A: "#f59e0b", B: "#3b82f6", C: "#6b7280", D: "#9ca3af" };
const GB = { S: "rgba(225,29,72,.12)", A: "rgba(245,158,11,.12)", B: "rgba(59,130,246,.12)", C: "rgba(107,114,128,.12)", D: "rgba(156,163,175,.12)" };

const Radio = ({ options, value, onChange }) => (
  <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
    {options.map((o) => (
      <label key={o.value} onClick={() => onChange(o.value)} style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: value === o.value ? "#1e1e24" : "#14141a", border: `1px solid ${value === o.value ? "#3f3f46" : "#27272a"}`, borderRadius: 8, cursor: "pointer" }}>
        <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${value === o.value ? "#e4e4e7" : "#52525b"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {value === o.value && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#e4e4e7" }} />}
        </div>
        <span style={{ fontSize: 13, color: value === o.value ? "#e4e4e7" : "#71717a" }}>{o.label}</span>
      </label>
    ))}
  </div>
);

const Btn = ({ onClick, loading, disabled, label }) => (
  <button onClick={onClick} disabled={loading || disabled} style={{ width: "100%", padding: 14, borderRadius: 10, border: "none", cursor: loading ? "wait" : "pointer", background: loading ? "#27272a" : "#e4e4e7", color: "#0a0a0a", fontSize: 15, fontWeight: 600, opacity: disabled ? 0.4 : 1 }}>
    {loading ? "生成中..." : label}
  </button>
);

const Err = ({ msg }) => msg ? <div style={{ marginTop: 16, padding: 12, background: "rgba(239,68,68,.1)", borderRadius: 8, color: "#ef4444", fontSize: 13 }}>{msg}</div> : null;

const Upload = ({ file, onChange }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "20px 16px", background: "#18181b", border: "2px dashed #27272a", borderRadius: 12, cursor: "pointer" }}>
      <input type="file" accept=".txt,.docx,.doc,.pdf" onChange={(e) => onChange(e.target.files?.[0] || null)} style={{ display: "none" }} />
      <span style={{ fontSize: 14, color: file ? "#e4e4e7" : "#52525b" }}>{file ? file.name : "記事ファイルをアップロード（.txt .docx .pdf）"}</span>
    </label>
  </div>
);

const Card = ({ index, main, reply }) => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ fontSize: 12, fontWeight: 600, color: "#71717a", marginBottom: 8 }}>案 {index}</div>
    {main && <div style={{ background: "#14141a", border: "1px solid #1e1e24", borderRadius: 10, padding: 14, borderLeft: "3px solid #e4e4e7", marginBottom: reply ? 8 : 0 }}><div style={{ fontSize: 11, fontWeight: 600, color: "#e4e4e7", marginBottom: 6 }}>本投稿</div><div style={{ fontSize: 14, color: "#d4d4d8", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{main}</div></div>}
    {reply && <div style={{ marginLeft: 16, background: "#14141a", border: "1px solid #1e1e24", borderRadius: 10, padding: 14, borderLeft: "3px solid #3b82f6" }}><div style={{ fontSize: 11, fontWeight: 600, color: "#3b82f6", marginBottom: 6 }}>└ リプ投稿</div><div style={{ fontSize: 14, color: "#d4d4d8", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{reply}</div></div>}
  </div>
);

// ========== [共通] ずるい一言フック ========== // [変更: v2.2]
const HookToggle = ({ value, onChange }) => (
  <div onClick={() => onChange(!value)} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 14px", background: "#14141a", border: `1px solid ${value ? "#f59e0b44" : "#27272a"}`, borderRadius: 8, cursor: "pointer", transition: "all .15s" }}>
    <div style={{ width: 40, height: 22, borderRadius: 11, background: value ? "#f59e0b" : "#27272a", position: "relative", transition: "background .2s" }}>
      <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: value ? 20 : 2, transition: "left .2s" }} />
    </div>
    <span style={{ fontSize: 13, color: value ? "#f59e0b" : "#71717a", fontWeight: 600 }}>ずるい一言をつける</span>
  </div>
);

const HooksDisplay = ({ hooks }) => {
  if (!hooks) return null;
  const lines = hooks.split("\n").filter((l) => l.trim());
  return (
    <div style={{ background: "#1a1a10", border: "1px solid #f59e0b33", borderRadius: 10, padding: 16, marginTop: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#f59e0b", marginBottom: 10 }}>ずるい一言の候補</div>
      {lines.map((line, i) => (
        <div key={i} style={{ fontSize: 14, color: "#e4e4e7", padding: "8px 0", borderTop: i ? "1px solid #f59e0b22" : "none", lineHeight: 1.6 }}>{line}</div>
      ))}
    </div>
  );
};

// ── Tab A ──
function TabA() {
  const [text, setText] = useState("");
  const [mode, setMode] = useState("tree");
  const [useHook, setUseHook] = useState(true); // [変更: v2.2]
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const run = async () => {
    if (!text.trim()) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, mode, useHook }) }); // [変更: v2.2] useHook追加
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div>
      <div style={{ position: "relative", marginBottom: 16 }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Threadsの投稿文をここに入力..." rows={6} style={{ width: "100%", boxSizing: "border-box", background: "#18181b", border: "1px solid #27272a", borderRadius: 12, padding: 16, color: "#e4e4e7", fontSize: 15, lineHeight: 1.7, resize: "vertical", outline: "none", fontFamily: "inherit" }} />
        <div style={{ position: "absolute", bottom: 12, right: 14, fontSize: 12, color: text.length > 500 ? "#ef4444" : "#52525b" }}>{text.length}</div>
      </div>
      <Radio options={[{ value: "single", label: "本投稿のみ" }, { value: "tree", label: "本投稿＋リプ" }]} value={mode} onChange={setMode} />
      <HookToggle value={useHook} onChange={setUseHook} />{/* [変更: v2.2] */}
      <Btn onClick={run} loading={loading} disabled={!text.trim()} label="採点する" />
      <Err msg={error} />
      {result && (
        <div style={{ marginTop: 28 }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 80, height: 80, borderRadius: "50%", fontSize: 36, fontWeight: 800, color: GC[result.grade] || "#fff", background: GB[result.grade] || "rgba(255,255,255,.08)", border: `2px solid ${GC[result.grade] || "#555"}` }}>{result.grade}</div>
            <div style={{ marginTop: 10, fontSize: 22, fontWeight: 700 }}>{result.total}<span style={{ fontSize: 14, color: "#71717a" }}> / 100</span></div>
            <div style={{ marginTop: 6, fontSize: 14, color: "#a1a1aa" }}>{result.verdict}</div>
          </div>
          {result.hooks && <HooksDisplay hooks={result.hooks} />}{/* [変更: v2.2] */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 28, marginTop: 28 }}>
            {Object.entries(result.scores).map(([k, v]) => (
              <div key={k}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}><span style={{ color: "#a1a1aa" }}>{LABELS[k]}</span><span style={{ fontWeight: 600 }}>{v.score}<span style={{ color: "#52525b" }}>/20</span></span></div>
                <div style={{ height: 6, background: "#1e1e22", borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", width: `${(v.score/20)*100}%`, background: v.score >= 16 ? "#22c55e" : v.score >= 12 ? "#3b82f6" : v.score >= 8 ? "#f59e0b" : "#ef4444", borderRadius: 3 }} /></div>
                <div style={{ fontSize: 12, color: "#71717a", marginTop: 4 }}>{v.comment}</div>
              </div>
            ))}
          </div>
          {result.suggestions?.length > 0 && (
            <div style={{ background: "#14141a", border: "1px solid #1e1e24", borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#a1a1aa", marginBottom: 10 }}>改善ポイント</div>
              {result.suggestions.map((s, i) => <div key={i} style={{ fontSize: 13, color: "#d4d4d8", padding: "6px 0", borderTop: i ? "1px solid #1e1e24" : "none" }}>{i+1}. {s}</div>)}
            </div>
          )}
          {result.rewrite && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#a1a1aa" }}>改善版</div>
              {[{ label: "本投稿", text: result.rewrite.main, ml: 0, c: "#e4e4e7" }, { label: "└ リプ投稿", text: result.rewrite.reply, ml: 16, c: "#3b82f6" }].map((p, i) => p.text && (
                <div key={i} style={{ marginLeft: p.ml, background: "#14141a", border: "1px solid #1e1e24", borderRadius: 10, padding: 14, borderLeft: `3px solid ${p.c}` }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: p.c, marginBottom: 8 }}>{p.label}</div>
                  <div style={{ fontSize: 14, color: "#d4d4d8", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{p.text}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab B1 ──
function TabB1() {
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState("tree");
  const [useHook, setUseHook] = useState(true); // [変更: v2.2]
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const run = async () => {
    if (!file) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", "b1");
      fd.append("mode", mode);
      fd.append("useHook", String(useHook)); // [変更: v2.2]
      const res = await fetch("/api/generate", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div>
      <Upload file={file} onChange={setFile} />
      <Radio options={[{ value: "single", label: "本投稿のみ" }, { value: "tree", label: "本投稿＋リプ" }]} value={mode} onChange={setMode} />
      <HookToggle value={useHook} onChange={setUseHook} />{/* [変更: v2.2] */}
      <Btn onClick={run} loading={loading} disabled={!file} label="誘導投稿を生成（5案）" />
      <Err msg={error} />
      {result && (
        <div style={{ marginTop: 24 }}>
          {result.analysis && <div style={{ background: "#14141a", border: "1px solid #1e1e24", borderRadius: 10, padding: 16, marginBottom: 20 }}><div style={{ fontSize: 13, fontWeight: 600, color: "#a1a1aa", marginBottom: 10 }}>記事分析</div><div style={{ fontSize: 13, color: "#d4d4d8", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{result.analysis}</div></div>}
          <div style={{ fontSize: 13, fontWeight: 600, color: "#a1a1aa", marginBottom: 12 }}>生成結果（5案）</div>
          {result.posts.map((p, i) => <Card key={i} index={i+1} main={p.main} reply={p.reply} />)}
        </div>
      )}
    </div>
  );
}

// ── Tab B2 ──
function TabB2() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const run = async () => {
    if (!file) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", "b2");
      fd.append("mode", "single");
      const res = await fetch("/api/generate", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div>
      <Upload file={file} onChange={setFile} />
      <div style={{ fontSize: 12, color: "#52525b", marginBottom: 16 }}>※ ゴースト投稿は本投稿のみ（8〜12行）で生成されます</div>
      <Btn onClick={run} loading={loading} disabled={!file} label="ゴースト投稿を生成（5案）" />
      <Err msg={error} />
      {result && (
        <div style={{ marginTop: 24 }}>
          {result.analysis && <div style={{ background: "#14141a", border: "1px solid #1e1e24", borderRadius: 10, padding: 16, marginBottom: 20 }}><div style={{ fontSize: 13, fontWeight: 600, color: "#a1a1aa", marginBottom: 10 }}>記事分析</div><div style={{ fontSize: 13, color: "#d4d4d8", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{result.analysis}</div></div>}
          <div style={{ fontSize: 13, fontWeight: 600, color: "#a1a1aa", marginBottom: 12 }}>生成結果（5案）</div>
          {result.posts.map((p, i) => <Card key={i} index={i+1} main={p.main} reply="" />)}
        </div>
      )}
    </div>
  );
}

// ── Main ──
const TABS = [{ id: "A", label: "バズスコア採点" }, { id: "B1", label: "誘導投稿" }, { id: "B2", label: "ゴースト投稿" }];

export default function Home() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [tab, setTab] = useState("A");

  if (!authed) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e4e4e7", fontFamily: "'Helvetica Neue', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div style={{ width: "100%", maxWidth: 360, textAlign: "center" }}>
          <div style={{ fontSize: 12, letterSpacing: 4, color: "#71717a", textTransform: "uppercase", marginBottom: 6 }}>Threads Tool</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 32px", background: "linear-gradient(135deg, #e4e4e7, #a1a1aa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Threads投稿エンジン</h1>
          <input
            type="password"
            value={pw}
            onChange={(e) => { setPw(e.target.value); setPwErr(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") { if (pw === "notti") setAuthed(true); else setPwErr("パスワードが違います"); } }}
            placeholder="パスワードを入力"
            style={{ width: "100%", boxSizing: "border-box", padding: "14px 16px", background: "#18181b", border: `1px solid ${pwErr ? "#ef4444" : "#27272a"}`, borderRadius: 10, color: "#e4e4e7", fontSize: 15, outline: "none", fontFamily: "inherit", marginBottom: 12 }}
          />
          <button
            onClick={() => { if (pw === "notti") setAuthed(true); else setPwErr("パスワードが違います"); }}
            style={{ width: "100%", padding: 14, borderRadius: 10, border: "none", cursor: "pointer", background: "#e4e4e7", color: "#0a0a0a", fontSize: 15, fontWeight: 600 }}
          >ログイン</button>
          {pwErr && <div style={{ marginTop: 12, fontSize: 13, color: "#ef4444" }}>{pwErr}</div>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e4e4e7", fontFamily: "'Helvetica Neue', sans-serif", padding: "32px 16px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ marginBottom: 24, textAlign: "center" }}>
          <div style={{ fontSize: 12, letterSpacing: 4, color: "#71717a", textTransform: "uppercase", marginBottom: 6 }}>Threads Tool</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, background: "linear-gradient(135deg, #e4e4e7, #a1a1aa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Threads投稿エンジン</h1>
        </div>
        <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "#14141a", borderRadius: 10, padding: 4 }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "10px 8px", borderRadius: 8, border: "none", cursor: "pointer", background: tab === t.id ? "#27272a" : "transparent", color: tab === t.id ? "#e4e4e7" : "#71717a", fontSize: 12, fontWeight: 600 }}>{t.label}</button>
          ))}
        </div>
        {tab === "A" && <TabA />}
        {tab === "B1" && <TabB1 />}
        {tab === "B2" && <TabB2 />}
      </div>
    </div>
  );
}
