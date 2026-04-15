"use client";
import { useState } from "react";

const LABELS = {
  hook: "フック力",
  empathy: "共感・議論性",
  structure: "構成・読みやすさ",
  shareability: "拡散性",
  culture_fit: "Threads文化適合",
};

const GRADE_COLORS = {
  S: "#e11d48", A: "#f59e0b", B: "#3b82f6", C: "#6b7280", D: "#9ca3af",
};

const GRADE_BG = {
  S: "rgba(225,29,72,0.12)", A: "rgba(245,158,11,0.12)", B: "rgba(59,130,246,0.12)", C: "rgba(107,114,128,0.12)", D: "rgba(156,163,175,0.12)",
};

export default function Home() {
  const [text, setText] = useState("");
  const [mode, setMode] = useState("tree");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const analyze = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "エラーが発生しました");
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const charCount = text.length;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e4e4e7", fontFamily: "'Helvetica Neue', sans-serif", padding: "32px 16px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <div style={{ fontSize: 13, letterSpacing: 4, color: "#71717a", textTransform: "uppercase", marginBottom: 8 }}>Threads Post</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, background: "linear-gradient(135deg, #e4e4e7, #a1a1aa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>バズ採点ツール</h1>
        </div>

        <div style={{ position: "relative", marginBottom: 16 }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Threadsの投稿文をここに入力..."
            rows={6}
            style={{
              width: "100%", boxSizing: "border-box", background: "#18181b", border: "1px solid #27272a", borderRadius: 12, padding: 16,
              color: "#e4e4e7", fontSize: 15, lineHeight: 1.7, resize: "vertical", outline: "none", fontFamily: "inherit",
            }}
          />
          <div style={{ position: "absolute", bottom: 12, right: 14, fontSize: 12, color: charCount > 500 ? "#ef4444" : "#52525b" }}>{charCount}</div>
        </div>

        <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
          {[
            { value: "single", label: "本投稿のみ" },
            { value: "tree", label: "本投稿＋リプ" },
          ].map((opt) => (
            <label key={opt.value} onClick={() => setMode(opt.value)} style={{
              flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
              background: mode === opt.value ? "#1e1e24" : "#14141a",
              border: `1px solid ${mode === opt.value ? "#3f3f46" : "#27272a"}`,
              borderRadius: 8, cursor: "pointer", transition: "all .15s",
            }}>
              <div style={{
                width: 16, height: 16, borderRadius: "50%",
                border: `2px solid ${mode === opt.value ? "#e4e4e7" : "#52525b"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {mode === opt.value && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#e4e4e7" }} />}
              </div>
              <span style={{ fontSize: 13, color: mode === opt.value ? "#e4e4e7" : "#71717a" }}>{opt.label}</span>
            </label>
          ))}
        </div>

        <button
          onClick={analyze}
          disabled={loading || !text.trim()}
          style={{
            width: "100%", padding: 14, borderRadius: 10, border: "none", cursor: loading ? "wait" : "pointer",
            background: loading ? "#27272a" : "#e4e4e7", color: "#0a0a0a", fontSize: 15, fontWeight: 600,
            opacity: !text.trim() ? 0.4 : 1,
          }}
        >
          {loading ? "分析中..." : "採点する"}
        </button>

        {error && <div style={{ marginTop: 16, padding: 12, background: "rgba(239,68,68,.1)", borderRadius: 8, color: "#ef4444", fontSize: 13 }}>{error}</div>}

        {result && (
          <div style={{ marginTop: 32 }}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 80, height: 80, borderRadius: "50%", fontSize: 36, fontWeight: 800,
                color: GRADE_COLORS[result.grade] || "#fff",
                background: GRADE_BG[result.grade] || "rgba(255,255,255,.08)",
                border: `2px solid ${GRADE_COLORS[result.grade] || "#555"}`,
              }}>
                {result.grade}
              </div>
              <div style={{ marginTop: 10, fontSize: 22, fontWeight: 700 }}>{result.total}<span style={{ fontSize: 14, color: "#71717a" }}> / 100</span></div>
              <div style={{ marginTop: 6, fontSize: 14, color: "#a1a1aa" }}>{result.verdict}</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 28 }}>
              {Object.entries(result.scores).map(([key, v]) => (
                <div key={key}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                    <span style={{ color: "#a1a1aa" }}>{LABELS[key]}</span>
                    <span style={{ fontWeight: 600 }}>{v.score}<span style={{ color: "#52525b" }}>/20</span></span>
                  </div>
                  <div style={{ height: 6, background: "#1e1e22", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(v.score / 20) * 100}%`, background: v.score >= 16 ? "#22c55e" : v.score >= 12 ? "#3b82f6" : v.score >= 8 ? "#f59e0b" : "#ef4444", borderRadius: 3 }} />
                  </div>
                  <div style={{ fontSize: 12, color: "#71717a", marginTop: 4 }}>{v.comment}</div>
                </div>
              ))}
            </div>

            {result.suggestions?.length > 0 && (
              <div style={{ background: "#14141a", border: "1px solid #1e1e24", borderRadius: 10, padding: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#a1a1aa", marginBottom: 10 }}>💡 改善ポイント</div>
                {result.suggestions.map((s, i) => (
                  <div key={i} style={{ fontSize: 13, color: "#d4d4d8", padding: "6px 0", borderTop: i ? "1px solid #1e1e24" : "none" }}>{i + 1}. {s}</div>
                ))}
              </div>
            )}

            {result.rewrite && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#a1a1aa" }}>改善版</div>
                {[
                  { label: "本投稿", text: result.rewrite.main, indent: 0 },
                  { label: "└ リプ投稿", text: result.rewrite.reply, indent: 1 },
                ].map((part, i) => part.text && (
                  <div key={i} style={{
                    marginLeft: part.indent * 16,
                    background: "#14141a", border: "1px solid #1e1e24", borderRadius: 10, padding: 14,
                    borderLeft: `3px solid ${["#e4e4e7", "#3b82f6", "#22c55e"][i]}`,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: ["#e4e4e7", "#3b82f6", "#22c55e"][i], marginBottom: 8, letterSpacing: 1 }}>{part.label}</div>
                    <div style={{ fontSize: 14, color: "#d4d4d8", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{part.text}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
