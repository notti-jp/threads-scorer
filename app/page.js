"use client";
// Version: v2.6-URLStyle-Loading - 2026-04-25 - A/B1/B2/Drafts/Style (Vercel版)
import { useState, useEffect, useRef, useCallback } from "react";

// ═══════ Storage (localStorage for style profile only) ═══════
const STYLE_KEY = "threads-style";
function lsGet(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } }

// ═══════ Toast ═══════
function useToast() {
  const [msg, setMsg] = useState(null);
  const t = useRef(null);
  const show = useCallback((text, dur = 2500) => { setMsg(text); clearTimeout(t.current); t.current = setTimeout(() => setMsg(null), dur); }, []);
  const Toast = msg ? <div style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", background: "#E5E5E5", color: "#1A1A1A", padding: "12px 24px", borderRadius: 10, fontSize: 14, fontWeight: 500, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,.5)" }}>{msg}</div> : null;
  return { show, Toast };
}
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// ═══════ 定数 ═══════
const LABELS = { hook: "フック力", empathy: "共感・議論性", structure: "構成・読みやすさ", shareability: "拡散性", culture_fit: "Threads文化適合" };
const GC = { S: "#f07852", A: "#f0b83e", B: "#83c2cb", C: "#dfb9ae", D: "#DC3545" };
const GB = { S: "rgba(240,120,82,.1)", A: "rgba(240,184,62,.1)", B: "rgba(131,194,203,.1)", C: "rgba(44,66,90,.08)", D: "rgba(223,185,174,.1)" };

// ═══════ 共通UI ═══════
const Radio = ({ options, value, onChange }) => (
  <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
    {options.map(o => (
      <label key={o.value} onClick={() => onChange(o.value)} style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: value === o.value ? "#0a0a0a" : "#FAFAFA", border: `1px solid ${value === o.value ? "#0a0a0a" : "#E5E5E5"}`, borderRadius: 8, cursor: "pointer", transition: "all .15s" }}>
        <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${value === o.value ? "#FFFFFF" : "#CCCCCC"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {value === o.value && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#FFFFFF" }} />}
        </div>
        <span style={{ fontSize: 13, color: value === o.value ? "#FFFFFF" : "#666666", fontWeight: value === o.value ? 600 : 400 }}>{o.label}</span>
      </label>
    ))}
  </div>
);
const Btn = ({ onClick, loading, disabled, label, bg, color: c }) => (
  <button onClick={onClick} disabled={loading || disabled} style={{ width: "100%", padding: 14, borderRadius: 10, border: "none", cursor: loading ? "wait" : "pointer", background: loading ? "#E5E5E5" : (bg || "#0a0a0a"), color: c || "#FFFFFF", fontSize: 15, fontWeight: 600, opacity: disabled ? 0.4 : 1, marginBottom: 8 }}>{loading ? "生成中..." : label}</button>
);
const Err = ({ msg }) => msg ? <div style={{ marginTop: 16, padding: 12, background: "rgba(220,53,69,.06)", borderRadius: 8, color: "#DC3545", fontSize: 13 }}>{msg}</div> : null;

const LoadingIndicator = ({ message = "採点中（しばらくお待ちください）" }) => (
  <div style={{ marginTop: 24, marginBottom: 24, textAlign: "center" }}>
    <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }`}</style>
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "24px 32px", background: "#FAFAFA", border: "1px solid #E5E5E5", borderRadius: 16 }}>
      <video autoPlay loop muted playsInline style={{ width: 120, height: 120, borderRadius: 12, objectFit: "cover" }}>
        <source src="/loading.mp4" type="video/mp4" />
      </video>
      <span style={{ fontSize: 14, color: "#555555", animation: "blink 1.4s ease-in-out infinite" }}>{message}</span>
    </div>
  </div>
);
function Upload({ file, onChange }) {
  const [preview, setPreview] = useState("");
  const handleFile = (f) => {
    onChange(f);
    if (!f) { setPreview(""); return; }
    if (f.name.endsWith(".txt")) {
      const reader = new FileReader();
      reader.onload = (e) => { setPreview(e.target.result?.slice(0, 100) || ""); };
      reader.readAsText(f);
    } else {
      setPreview("");
    }
  };
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "20px 16px", background: file ? "rgba(131,194,203,0.06)" : "#FAFAFA", border: `2px dashed ${file ? "#83c2cb" : "#E5E5E5"}`, borderRadius: 12, cursor: "pointer" }}>
        <input type="file" accept=".txt,.docx,.doc,.pdf" onChange={e => handleFile(e.target.files?.[0] || null)} style={{ display: "none" }} />
        <span style={{ fontSize: 14, color: file ? "#0a0a0a" : "#888" }}>{file ? `📄 ${file.name}` : "記事ファイルをアップロード（.txt .docx .pdf）"}</span>
      </label>
      {file && preview && (
        <div style={{ marginTop: 8, padding: "10px 14px", background: "#FAFAFA", border: "1px solid #E5E5E5", borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>記事の冒頭</div>
          <div style={{ fontSize: 13, color: "#444", lineHeight: 1.6, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>{preview}{preview.length >= 100 ? "…" : ""}</div>
        </div>
      )}
      {file && !preview && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#888" }}>✓ ファイルを読み込みました</div>
      )}
    </div>
  );
}
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} };
  return <button onClick={copy} style={{ fontSize: 11, padding: "3px 10px", background: copied ? "#83c2cb22" : "#F0F0F0", border: `1px solid ${copied ? "#83c2cb44" : "#CCCCCC"}`, borderRadius: 6, color: copied ? "#0a0a0a" : "#999999", cursor: "pointer", whiteSpace: "nowrap" }}>{copied ? "コピー済" : "コピー"}</button>;
}
const HooksDisplay = ({ hooks }) => {
  if (!hooks) return null;
  return (
    <div style={{ background: "rgba(240,120,82,0.04)", border: "1px solid rgba(240,120,82,0.2)", borderRadius: 10, padding: 16, marginTop: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#f07852", marginBottom: 10 }}>ずるい一言の候補</div>
      {hooks.split("\n").filter(l => l.trim()).map((line, i) => <div key={i} style={{ fontSize: 14, color: "#1A1A1A", padding: "8px 0", borderTop: i ? "1px solid rgba(240,120,82,0.1)" : "none" }}>{line}</div>)}
    </div>
  );
};
const Card = ({ index, main, reply, hooks, onSave }) => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#666666" }}>案 {index}</div>
      {onSave && <button onClick={() => onSave(main, reply)} style={{ fontSize: 11, padding: "4px 10px", background: "#F0F0F0", border: "1px solid #CCCCCC", borderRadius: 6, color: "#555555", cursor: "pointer" }}>下書き保存</button>}
    </div>
    {main && <div style={{ background: "#FAFAFA", border: "1px solid #E5E5E5", borderRadius: 10, padding: 14, borderLeft: "3px solid #0a0a0a", marginBottom: reply ? 8 : 0 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}><div style={{ fontSize: 11, fontWeight: 600, color: "#1A1A1A" }}>本投稿</div><CopyBtn text={main} /></div><div style={{ fontSize: 14, color: "#333333", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{main}</div></div>}
    {reply && <div style={{ marginLeft: 16, background: "#FAFAFA", border: "1px solid #E5E5E5", borderRadius: 10, padding: 14, borderLeft: "3px solid #83c2cb" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}><div style={{ fontSize: 11, fontWeight: 600, color: "#0a0a0a" }}>└ リプ投稿</div><CopyBtn text={reply} /></div><div style={{ fontSize: 14, color: "#333333", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{reply}</div></div>}
    {hooks && <HooksDisplay hooks={hooks} />}
  </div>
);
const HookToggle = ({ value, onChange }) => (
  <div onClick={() => onChange(!value)} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 14px", background: value ? "rgba(240,120,82,0.06)" : "#FAFAFA", border: `1px solid ${value ? "#f07852" : "#E5E5E5"}`, borderRadius: 8, cursor: "pointer", transition: "all .15s" }}>
    <div style={{ width: 40, height: 22, borderRadius: 11, background: value ? "#f07852" : "#D0D0D0", position: "relative", transition: "background .2s" }}>
      <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#FFFFFF", position: "absolute", top: 2, left: value ? 20 : 2, transition: "left .2s" }} />
    </div>
    <span style={{ fontSize: 13, color: value ? "#f07852" : "#888888", fontWeight: 600 }}>ずるい一言をつける</span>
  </div>
);

// ═══════ ナレッジノズル ═══════
const KN_AREAS = [
  { id: "hook", label: "フック力（1行目・型）" },
  { id: "writing", label: "ライティング技法" },
  { id: "empathy", label: "共感・感情" },
  { id: "desire", label: "欲望設計" },
  { id: "recognition", label: "認知・集客" },
  { id: "ghost", label: "ゴースト投稿" },
  { id: "profile", label: "プロフ・差別化" },
];
const KN_PRESETS = {
  balanced: { label: "バランス型", values: { hook: 5, writing: 5, empathy: 5, desire: 5, recognition: 5, ghost: 5, profile: 5 } },
  empathy: { label: "共感重視", values: { hook: 5, writing: 5, empathy: 9, desire: 7, recognition: 3, ghost: 3, profile: 3 } },
  writing: { label: "ノウハウ重視（ライティング強化）", values: { hook: 6, writing: 9, empathy: 5, desire: 5, recognition: 3, ghost: 3, profile: 3 } },
  hookFocus: { label: "フック重視", values: { hook: 9, writing: 6, empathy: 5, desire: 5, recognition: 3, ghost: 3, profile: 3 } },
  spread: { label: "認知拡大", values: { hook: 7, writing: 5, empathy: 5, desire: 5, recognition: 9, ghost: 5, profile: 7 } },
};
const KN_DEFAULT = KN_PRESETS.balanced.values;

function KnowledgeNozzle({ values, onChange }) {
  const [expanded, setExpanded] = useState(false);

  // 現在の値がどのプリセットに一致するか自動判定
  const detectPreset = (v) => {
    for (const [key, p] of Object.entries(KN_PRESETS)) {
      if (Object.keys(p.values).every(k => p.values[k] === (v[k] || 5))) return key;
    }
    return "custom";
  };
  const [preset, setPreset] = useState(() => detectPreset(values));

  const selectPreset = (key) => {
    setPreset(key);
    if (key !== "custom") onChange(KN_PRESETS[key].values);
  };

  const updateSlider = (id, val) => {
    setPreset("custom");
    onChange({ ...values, [id]: Number(val) });
  };

  const sliderBg = (val) => {
    const pct = ((val - 1) / 8) * 100;
    return `linear-gradient(to right, #f07852 0%, #f07852 ${pct}%, #E5E5E5 ${pct}%, #E5E5E5 100%)`;
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div onClick={() => setExpanded(!expanded)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#FAFAFA", border: "1px solid #E5E5E5", borderRadius: 8, cursor: "pointer" }}>
        <span style={{ fontSize: 13, color: "#0a0a0a", fontWeight: 600 }}>ナレッジ調整：{preset === "custom" ? "カスタム" : KN_PRESETS[preset]?.label}</span>
        <span style={{ fontSize: 12, color: "#999" }}>{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div style={{ marginTop: 8, padding: 14, background: "#FAFAFA", border: "1px solid #E5E5E5", borderRadius: 8 }}>
          {/* プリセット */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {Object.entries(KN_PRESETS).map(([key, p]) => (
              <button key={key} onClick={() => selectPreset(key)} style={{
                padding: "6px 12px", borderRadius: 6, border: preset === key ? "1px solid #0a0a0a" : "1px solid #E5E5E5",
                background: preset === key ? "#0a0a0a" : "#FFFFFF", color: preset === key ? "#FFFFFF" : "#666666",
                fontSize: 12, fontWeight: 500, cursor: "pointer",
              }}>{p.label}</button>
            ))}
            <button onClick={() => setPreset("custom")} style={{
              padding: "6px 12px", borderRadius: 6, border: preset === "custom" ? "1px solid #f07852" : "1px solid #E5E5E5",
              background: preset === "custom" ? "#f07852" : "#FFFFFF", color: preset === "custom" ? "#FFFFFF" : "#666666",
              fontSize: 12, fontWeight: 500, cursor: "pointer",
            }}>カスタム</button>
          </div>

          {/* スライダー */}
          <style>{`
            input[type=range] { -webkit-appearance: none; width: 100%; height: 6px; border-radius: 3px; outline: none; }
            input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #FFFFFF; border: 2px solid #0a0a0a; cursor: pointer; margin-top: -1px; }
          `}</style>
          {KN_AREAS.map(a => (
            <div key={a.id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: "#444444" }}>{a.label}</span>
                <span style={{ color: values[a.id] >= 7 ? "#f07852" : values[a.id] >= 4 ? "#0a0a0a" : "#999", fontWeight: 600 }}>
                  {values[a.id] >= 7 ? "強" : values[a.id] >= 4 ? "中" : "弱"}
                </span>
              </div>
              <input type="range" min="1" max="9" value={values[a.id] || 5} onChange={e => updateSlider(a.id, e.target.value)}
                style={{ background: sliderBg(values[a.id] || 5) }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════ 文体カード ═══════
function StyleCard({ style, onChangeRequest }) {
  const [expanded, setExpanded] = useState(false);
  if (!style) {
    return (
      <div style={{ marginBottom: 20, padding: 16, background: "rgba(131,194,203,0.04)", border: "1px solid rgba(131,194,203,0.3)", borderRadius: 10, textAlign: "center" }}>
        <div style={{ fontSize: 13, color: "#555555", marginBottom: 10 }}>文体が未設定です。記事を読み込ませると、その言い回しで投稿文を生成します。</div>
        <button onClick={onChangeRequest} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#83c2cb", color: "#FFFFFF", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>文体を学習させる</button>
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 20, background: "rgba(131,194,203,0.04)", border: "1px solid rgba(131,194,203,0.3)", borderRadius: 10, overflow: "hidden" }}>
      <div onClick={() => setExpanded(!expanded)} style={{ padding: 14, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#0a0a0a", marginBottom: 4 }}>学習済みの文体</div>
          <div style={{ fontSize: 12, color: "#666666" }}>{style.sourceName} ・ {new Date(style.updatedAt).toLocaleDateString("ja-JP")}</div>
        </div>
        <span style={{ fontSize: 12, color: "#83c2cb" }}>{expanded ? "▲" : "▼"}</span>
      </div>
      {expanded && (
        <div style={{ padding: "0 14px 14px" }}>
          <div style={{ fontSize: 13, color: "#444444", lineHeight: 1.7, whiteSpace: "pre-wrap", marginBottom: 12, maxHeight: 200, overflowY: "auto" }}>{style.profile}</div>
          <button onClick={onChangeRequest} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #83c2cb", background: "transparent", color: "#0a0a0a", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>文体を変更する</button>
        </div>
      )}
    </div>
  );
}

// ═══════ 文体学習ダイアログ ═══════
function StyleLearningDialog({ onComplete, onClose }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const learn = async () => {
    if (!url.trim()) return;
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/style", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url.trim() }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const displayName = data.title || url.replace(/https?:\/\//, "").replace(/\/$/, "").slice(0, 40);
      const styleData = { profile: data.profile, sourceName: displayName, updatedAt: new Date().toISOString() };
      lsSet(STYLE_KEY, styleData);
      onComplete(styleData);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9998, padding: 16 }}>
      <div style={{ background: "#FAFAFA", borderRadius: 14, padding: 24, width: "100%", maxWidth: 400 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: "#1A1A1A", marginBottom: 6 }}>文体を学習させる</div>
        <div style={{ fontSize: 13, color: "#666666", marginBottom: 20, lineHeight: 1.6 }}>noteのURLを入力すると、その記事の文体（口調・リズム・表現の癖）を分析し、以降の投稿生成に反映します。</div>
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://note.com/..."
          style={{ width: "100%", boxSizing: "border-box", padding: "14px 16px", background: "#FFFFFF", border: "1px solid #E5E5E5", borderRadius: 10, color: "#1A1A1A", fontSize: 14, outline: "none", fontFamily: "inherit", marginBottom: 16 }} />
        {error && <div style={{ marginBottom: 12, padding: 10, background: "rgba(220,53,69,.06)", borderRadius: 8, color: "#DC3545", fontSize: 13 }}>{error}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} disabled={loading} style={{ flex: 1, padding: 12, borderRadius: 8, border: "1px solid #E5E5E5", background: "transparent", color: "#555555", fontSize: 14, cursor: "pointer" }}>キャンセル</button>
          <button onClick={learn} disabled={loading || !url.trim()} style={{ flex: 1, padding: 12, borderRadius: 8, border: "none", background: loading ? "#E5E5E5" : "#F5F5F5", color: "#000", fontSize: 14, fontWeight: 600, cursor: loading ? "wait" : "pointer", opacity: !url.trim() ? 0.4 : 1 }}>{loading ? "分析中..." : "学習する"}</button>
        </div>
      </div>
    </div>
  );
}

// ═══════ 下書きダイアログ ═══════
function SaveDialog({ defaultTitle, onSave, onClose }) {
  const [title, setTitle] = useState(defaultTitle);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9998, padding: 16 }}>
      <div style={{ background: "#FAFAFA", borderRadius: 14, padding: 24, width: "100%", maxWidth: 360 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#1A1A1A", marginBottom: 16 }}>下書きを保存</div>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="タイトル（任意）" style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", background: "#FFFFFF", border: "1px solid #E5E5E5", borderRadius: 8, color: "#1A1A1A", fontSize: 14, outline: "none", marginBottom: 16, fontFamily: "inherit" }} />
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 8, border: "1px solid #E5E5E5", background: "transparent", color: "#555555", fontSize: 14, cursor: "pointer" }}>キャンセル</button>
          <button onClick={() => onSave(title)} style={{ flex: 1, padding: 12, borderRadius: 8, border: "none", background: "#0a0a0a", color: "#FFFFFF", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>保存</button>
        </div>
      </div>
    </div>
  );
}

// ═══════ 下書き一覧 ═══════
function DraftsScreen({ drafts, onBack, onEdit, onDelete, onMarkPosted, statusFilter }) {
  const [filter, setFilter] = useState(statusFilter || "draft");
  const filtered = drafts.filter(d => d.status === filter).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const [confirmId, setConfirmId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#666666", fontSize: 14, cursor: "pointer", marginBottom: 16, padding: 0 }}>← 戻る</button>
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#FAFAFA", borderRadius: 10, padding: 4 }}>
        {[{ id: "draft", label: "下書き" }, { id: "posted", label: "投稿済み" }].map(t => (
          <button key={t.id} onClick={() => setFilter(t.id)} style={{ flex: 1, padding: "10px 8px", borderRadius: 8, border: "none", cursor: "pointer", background: filter === t.id ? "#0a0a0a" : "transparent", color: filter === t.id ? "#FFFFFF" : "#777777", fontSize: 13, fontWeight: 600 }}>{t.label}</button>
        ))}
      </div>
      {filtered.length === 0 && <div style={{ textAlign: "center", color: "#888888", fontSize: 14, padding: 40 }}>{filter === "draft" ? "下書きはありません" : "投稿履歴はありません"}</div>}
      {filtered.map(d => {
        const isOpen = expandedId === d.id;
        return (
          <div key={d.id} style={{ background: "#FAFAFA", border: "1px solid #E5E5E5", borderRadius: 10, marginBottom: 12, overflow: "hidden" }}>
            <div onClick={() => setExpandedId(isOpen ? null : d.id)} style={{ padding: 14, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#1A1A1A", marginBottom: 4 }}>{d.title}{d.reply && <span style={{ fontSize: 11, color: "#83c2cb", marginLeft: 6 }}>+リプ</span>}</div>
                  <div style={{ fontSize: 11, color: "#888888" }}>{new Date(d.updatedAt).toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                </div>
                <span style={{ fontSize: 12, color: "#888888", marginLeft: 8 }}>{isOpen ? "▲" : "▼"}</span>
              </div>
              {!isOpen && <div style={{ fontSize: 13, color: "#666666", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{d.mainPost}</div>}
            </div>
            {isOpen && (
              <div style={{ padding: "0 14px 14px" }}>
                <div style={{ background: "#FFFFFF", border: "1px solid #E5E5E5", borderRadius: 8, padding: 12, borderLeft: "3px solid #0a0a0a", marginBottom: d.reply ? 8 : 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}><div style={{ fontSize: 11, fontWeight: 600, color: "#1A1A1A" }}>本投稿</div><CopyBtn text={d.mainPost} /></div>
                  <div style={{ fontSize: 14, color: "#333333", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{d.mainPost}</div>
                </div>
                {d.reply && (
                  <div style={{ marginLeft: 16, background: "#FFFFFF", border: "1px solid #E5E5E5", borderRadius: 8, padding: 12, borderLeft: "3px solid #83c2cb", marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}><div style={{ fontSize: 11, fontWeight: 600, color: "#0a0a0a" }}>└ リプ投稿</div><CopyBtn text={d.reply} /></div>
                    <div style={{ fontSize: 14, color: "#333333", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{d.reply}</div>
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  {filter === "draft" && <>
                    <button onClick={() => onEdit(d)} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #CCCCCC", background: "transparent", color: "#1A1A1A", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>編集</button>
                    <button onClick={() => onMarkPosted(d.id)} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #83c2cb44", background: "transparent", color: "#0a0a0a", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>投稿済みにする</button>
                  </>}
                  {confirmId === d.id ? (
                    <div style={{ display: "flex", gap: 6, flex: 1 }}>
                      <button onClick={() => { onDelete(d.id); setConfirmId(null); }} style={{ flex: 1, padding: 10, borderRadius: 8, border: "none", background: "#DC3545", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>削除する</button>
                      <button onClick={() => setConfirmId(null)} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #E5E5E5", background: "transparent", color: "#555555", fontSize: 12, cursor: "pointer" }}>やめる</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmId(d.id)} style={{ padding: 10, borderRadius: 8, border: "1px solid #DC354544", background: "transparent", color: "#DC3545", fontSize: 12, cursor: "pointer" }}>削除</button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══════ タブA ═══════
function TabA({ onSaveDraft, draftEdit, styleProfile, onStyleChange, knowledgePriority, onKnowledgeChange, appealText, onClearAppeal, useCredit, username }) {
  const [text, setText] = useState(draftEdit?.mainPost || appealText || "");
  const [isAppeal, setIsAppeal] = useState(!!appealText);
  const [mode, setMode] = useState("tree");
  const [useHook, setUseHook] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { if (draftEdit) { setText(draftEdit.mainPost || ""); setIsAppeal(false); } }, [draftEdit]);
  useEffect(() => { if (appealText) { setText(appealText); setIsAppeal(true); } }, [appealText]);
  const run = async () => {
    if (!text.trim()) return; setLoading(true); setError(""); setResult(null);
    try {
      await useCredit("tabA_score");
      const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, mode, useHook, styleProfile: styleProfile?.profile || "", knowledgePriority, isAppeal, username }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error); setResult(data);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };
  return (
    <div>
      <StyleCard style={styleProfile} onChangeRequest={onStyleChange} />
      <KnowledgeNozzle values={knowledgePriority} onChange={onKnowledgeChange} />
      {isAppeal && (
        <div style={{ marginBottom: 12, padding: "10px 14px", background: "rgba(240,184,62,0.08)", border: "1px solid rgba(240,184,62,0.3)", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#0a0a0a", fontWeight: 600 }}>note魅力抽出から受け取った素案</span>
          <button onClick={() => { setIsAppeal(false); setText(""); if (onClearAppeal) onClearAppeal(); }} style={{ fontSize: 11, padding: "4px 10px", background: "transparent", border: "1px solid #E5E5E5", borderRadius: 6, color: "#888", cursor: "pointer" }}>クリア</button>
        </div>
      )}
      <div style={{ position: "relative", marginBottom: 16 }}>
        <textarea value={text} onChange={e => { setText(e.target.value); if (isAppeal) setIsAppeal(true); }} placeholder={isAppeal ? "素案が入力されています。「この素案で投稿文を生成＋採点する」を押してください。" : "Threadsの投稿文をここに入力..."} rows={6} style={{ width: "100%", boxSizing: "border-box", background: isAppeal ? "rgba(240,184,62,0.04)" : "#FAFAFA", border: `1px solid ${isAppeal ? "rgba(240,184,62,0.3)" : "#E5E5E5"}`, borderRadius: 12, padding: 16, color: "#1A1A1A", fontSize: 15, lineHeight: 1.7, resize: "vertical", outline: "none", fontFamily: "inherit" }} />
        <div style={{ position: "absolute", bottom: 12, right: 14, fontSize: 12, color: text.length > 500 ? "#DC3545" : "#555555" }}>{text.length}</div>
      </div>
      <Radio options={[{ value: "single", label: "本投稿のみ" }, { value: "tree", label: "本投稿＋リプ" }]} value={mode} onChange={setMode} />
      <HookToggle value={useHook} onChange={setUseHook} />
      <Btn onClick={run} loading={loading} disabled={!text.trim()} label={isAppeal ? "この素案で投稿文を生成＋採点する" : "採点する"} bg="#f07852" />
      {text.trim() && !loading && <Btn onClick={() => onSaveDraft(text, "")} label="下書き保存" bg="#F5F5F5" color="#666666" />}
      <Err msg={error} />
      {loading && <LoadingIndicator message={isAppeal ? "素案から投稿文を生成中..." : "採点中（しばらくお待ちください）"} />}
      {result && (
        <div style={{ marginTop: 28 }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 80, height: 80, borderRadius: "50%", fontSize: 36, fontWeight: 800, color: GC[result.grade] || "#fff", background: GB[result.grade] || "rgba(255,255,255,.08)", border: `2px solid ${GC[result.grade] || "#555"}` }}>{result.grade}</div>
            <div style={{ marginTop: 10, fontSize: 22, fontWeight: 700 }}>{result.total}<span style={{ fontSize: 14, color: "#666666" }}> / 100</span></div>
            <div style={{ marginTop: 6, fontSize: 14, color: "#555555" }}>{result.verdict}</div>
          </div>
          {result.hooks && <HooksDisplay hooks={result.hooks} />}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 28, marginTop: 28 }}>
            {Object.entries(result.scores).map(([k, v]) => (
              <div key={k}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}><span style={{ color: "#555555" }}>{LABELS[k]}</span><span style={{ fontWeight: 600 }}>{v.score}<span style={{ color: "#888888" }}>/20</span></span></div>
                <div style={{ height: 6, background: "#F0F0F0", borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", width: `${(v.score/20)*100}%`, background: v.score >= 16 ? "#f07852" : v.score >= 12 ? "#f0b83e" : v.score >= 8 ? "#83c2cb" : "#dfb9ae", borderRadius: 3 }} /></div>
                <div style={{ fontSize: 12, color: "#666666", marginTop: 4 }}>{v.comment}</div>
              </div>
            ))}
          </div>
          {result.suggestions?.length > 0 && (
            <div style={{ background: "#FAFAFA", border: "1px solid #E5E5E5", borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#555555", marginBottom: 10 }}>改善ポイント</div>
              {result.suggestions.map((s, i) => <div key={i} style={{ fontSize: 13, color: "#444444", padding: "6px 0", borderTop: i ? "1px solid #F0F0F0" : "none" }}>{i+1}. {s}</div>)}
            </div>
          )}
          {result.rewrite && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#555555" }}>改善版</div>
              {[{ label: "本投稿", text: result.rewrite.main, ml: 0, c: "#0a0a0a" }, { label: "└ リプ投稿", text: result.rewrite.reply, ml: 16, c: "#83c2cb" }].map((p, i) => p.text && (
                <div key={i} style={{ marginLeft: p.ml, background: "#FAFAFA", border: "1px solid #E5E5E5", borderRadius: 10, padding: 14, borderLeft: `3px solid ${p.c}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}><div style={{ fontSize: 11, fontWeight: 600, color: p.c }}>{p.label}</div><CopyBtn text={p.text} /></div>
                  <div style={{ fontSize: 14, color: "#333333", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{p.text}</div>
                </div>
              ))}
              <Btn onClick={() => onSaveDraft(result.rewrite.main, result.rewrite.reply || "")} label="改善版を下書き保存" bg="#F5F5F5" color="#666666" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════ タブB1：note魅力抽出 ═══════
function TabB1({ onSelectAppeal, useCredit, styleProfile, onStyleChange }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [previousAppeals, setPreviousAppeals] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);

  const run = async (isReextract = false) => {
    if (!file) return;
    setLoading(true); setError(""); setResult(null); setSelectedIndex(null);
    try {
      await useCredit(isReextract ? "tabB1_reextract" : "tabB1_extract");
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", "b1");
      fd.append("mode", "extract");
      if (isReextract && previousAppeals.length > 0) {
        fd.append("previousAppeals", previousAppeals.map((a, i) => `${i + 1}. ${a.content}`).join("\n"));
      }
      const res = await fetch("/api/generate", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      if (data.appeals) {
        setPreviousAppeals(prev => [...prev, ...data.appeals]);
      }
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  const handleSelect = (appeal) => {
    onSelectAppeal(appeal.content);
  };

  return (
    <div>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 16, lineHeight: 1.6 }}>
        記事をアップロードすると、投稿の「素案」を5つ抽出します。気に入った素案を選んで「投稿文作成へ進む」をクリックすると、タブAで文体・フック・ナレッジを反映した完成版を作成できます。
      </div>
      <StyleCard style={styleProfile} onChangeRequest={onStyleChange} />
      <Upload file={file} onChange={f => { setFile(f); setResult(null); setPreviousAppeals([]); setSelectedIndex(null); }} />
      <Btn onClick={() => run(false)} loading={loading} disabled={!file} label="魅力を抽出する（5案）" bg="#edbb3f" color="#1A1A1A" />
      <Err msg={error} />
      {loading && <LoadingIndicator message="記事を分析中（しばらくお待ちください）" />}

      {result && (
        <div style={{ marginTop: 24 }}>
          {/* 素案一覧 */}
          <div style={{ fontSize: 14, fontWeight: 600, color: "#0a0a0a", marginBottom: 12 }}>抽出された投稿の素案（5案）</div>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 16 }}>気に入った素案をタップして「投稿文作成へ進む」をクリックしてください</div>

          {result.appeals?.map((appeal, i) => (
            <div key={i} onClick={() => setSelectedIndex(i)} style={{
              background: selectedIndex === i ? "rgba(0,0,0,0.03)" : "#FAFAFA",
              border: `2px solid ${selectedIndex === i ? "#0a0a0a" : "#E5E5E5"}`,
              borderRadius: 10, padding: 16, marginBottom: 12, cursor: "pointer", transition: "all .15s"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#f07852" }}>案 {i + 1}：{appeal.angle}</div>
                {selectedIndex === i && <div style={{ fontSize: 11, color: "#0a0a0a", fontWeight: 600 }}>選択中</div>}
              </div>
              {appeal.painPoint && <div style={{ fontSize: 12, color: "#DC3545", marginBottom: 4, lineHeight: 1.5 }}>痛点：{appeal.painPoint}</div>}
              {appeal.infoGap && <div style={{ fontSize: 12, color: "#0a0a0a", marginBottom: 8, lineHeight: 1.5 }}>ギャップ：{appeal.infoGap}</div>}
              <div style={{ fontSize: 14, color: "#1A1A1A", lineHeight: 1.9, whiteSpace: "pre-wrap", background: "#FFFFFF", borderRadius: 8, padding: 12, border: "1px solid #E5E5E5", borderLeft: "3px solid #0a0a0a" }}>{appeal.content}</div>
              <div onClick={e => e.stopPropagation()} style={{ marginTop: 8 }}><CopyBtn text={appeal.content} /></div>
            </div>
          ))}

          {/* アクションボタン */}
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={() => run(true)} disabled={loading} style={{
              flex: 1, padding: 14, borderRadius: 10, border: "1px solid #E5E5E5", background: "#FFFFFF",
              color: "#555", fontSize: 13, fontWeight: 600, cursor: loading ? "wait" : "pointer"
            }}>もう一度抽出する（別角度）</button>

            <button onClick={() => { if (selectedIndex !== null) handleSelect(result.appeals[selectedIndex]); }} disabled={selectedIndex === null} style={{
              flex: 1, padding: 14, borderRadius: 10, border: "none",
              background: selectedIndex !== null ? "#0a0a0a" : "#E5E5E5",
              color: selectedIndex !== null ? "#FFFFFF" : "#999",
              fontSize: 13, fontWeight: 600, cursor: selectedIndex !== null ? "pointer" : "default"
            }}>投稿文作成へ進む →</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════ タブB2 ═══════
function TabB2({ onSaveDraft, styleProfile, onStyleChange, useCredit }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [lineBreak, setLineBreak] = useState(true);
  const run = async () => {
    if (!file) return; setLoading(true); setError(""); setResult(null);
    try {
      await useCredit("tabB2_ghost");
      const fd = new FormData(); fd.append("file", file); fd.append("type", "b2"); fd.append("mode", "single"); fd.append("styleProfile", styleProfile?.profile || ""); fd.append("lineBreak", lineBreak ? "true" : "false");
      const res = await fetch("/api/generate", { method: "POST", body: fd });
      const data = await res.json(); if (!res.ok) throw new Error(data.error); setResult(data);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };
  return (
    <div>
      <StyleCard style={styleProfile} onChangeRequest={onStyleChange} />
      <Upload file={file} onChange={setFile} />
      <div style={{ fontSize: 12, color: "#888888", marginBottom: 12 }}>※ ゴースト投稿は本投稿のみ（200文字以内）で生成されます</div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        {[{ id: "break", label: "改行あり" }, { id: "nobreak", label: "改行なし" }].map(o => (
          <button key={o.id} onClick={() => setLineBreak(o.id === "break")} style={{
            flex: 1, padding: "10px 8px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
            background: (o.id === "break" ? lineBreak : !lineBreak) ? "#0a0a0a" : "#FAFAFA",
            color: (o.id === "break" ? lineBreak : !lineBreak) ? "#fff" : "#888",
            border: (o.id === "break" ? lineBreak : !lineBreak) ? "none" : "1px solid #E5E5E5",
          }}>{o.label}</button>
        ))}
      </div>
      <Btn onClick={run} loading={loading} disabled={!file} label="ゴースト投稿を生成（5案）" bg="#83c2cb" color="#1A1A1A" />
      <Err msg={error} />
      {loading && <LoadingIndicator message="生成中（しばらくお待ちください）" />}
      {result && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#555555", marginBottom: 12 }}>生成結果（5案）</div>
          {result.posts.map((p, i) => <Card key={i} index={i+1} main={p.main} reply="" onSave={(m) => onSaveDraft(m, "")} />)}
        </div>
      )}
    </div>
  );
}

// ═══════ 自動スコアリング（フィードバックデータから自動計算）═══════
function calcAutoScores(feedbacks) {
  if (!feedbacks || feedbacks.length === 0) return [];
  
  // エンゲージメント率を計算（コメントは重み2倍＝アルゴリズムに効くため）
  const withEng = feedbacks.map(f => {
    const v = f.views || 0;
    const l = f.likes || 0;
    const c = f.comments || 0;
    const engRate = v > 0 ? (l + c * 2) / v * 100 : 0;
    return { ...f, engRate };
  });

  // 投稿が1件だけの場合はエンゲージメント率で固定閾値判定
  if (withEng.length === 1) {
    return withEng.map(f => {
      const s = Math.min(Math.round(f.engRate * 12), 100);
      return { ...f, autoScore: s, autoGrade: s >= 90 ? "S" : s >= 75 ? "A" : s >= 60 ? "B" : s >= 40 ? "C" : "D" };
    });
  }

  // 2件以上：自分の平均との相対評価
  const avgViews = withEng.reduce((s, f) => s + (f.views || 0), 0) / withEng.length;
  const avgEng = withEng.reduce((s, f) => s + f.engRate, 0) / withEng.length;

  return withEng.map(f => {
    // ビュー数の相対スコア（平均=50, 2倍=100, 0=0）
    const viewRatio = avgViews > 0 ? (f.views || 0) / avgViews : 1;
    const viewScore = Math.min(Math.round(viewRatio * 40), 60);
    // エンゲージメント率の相対スコア
    const engRatio = avgEng > 0 ? f.engRate / avgEng : 1;
    const engScore = Math.min(Math.round(engRatio * 40), 60);
    // 合計（最大100）
    const total = Math.min(viewScore + engScore, 100);
    const grade = total >= 85 ? "S" : total >= 70 ? "A" : total >= 50 ? "B" : total >= 30 ? "C" : "D";
    return { ...f, autoScore: total, autoGrade: grade };
  });
}

// ═══════ タブD：フィードバック ═══════
function TabD({ username }) {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ mainPost: "", replyPost: "", views: "", likes: "", comments: "" });
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  // データ取得
  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/feedback?username=${encodeURIComponent(username)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFeedbacks(calcAutoScores(data.data || []));
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [username]);

  // 保存
  const handleSave = async () => {
    if (!form.mainPost.trim()) { setError("投稿文を入力してください"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, mainPost: form.mainPost, replyPost: form.replyPost, views: form.views ? Number(form.views) : null, likes: form.likes ? Number(form.likes) : null, comments: form.comments ? Number(form.comments) : null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm({ mainPost: "", replyPost: "", views: "", likes: "", comments: "" });
      setShowForm(false);
      showToast("フィードバックを保存しました");
      loadData();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  // 削除
  const handleDelete = async (id) => {
    try {
      await fetch(`/api/feedback?id=${id}&username=${encodeURIComponent(username)}`, { method: "DELETE" });
      setConfirmDeleteId(null);
      showToast("削除しました");
      loadData();
    } catch (e) { setError(e.message); }
  };

  const inputStyle = { width: "100%", boxSizing: "border-box", padding: "10px 14px", background: "#FFFFFF", border: "1px solid #E5E5E5", borderRadius: 8, color: "#1A1A1A", fontSize: 14, outline: "none", fontFamily: "inherit" };
  const labelStyle = { fontSize: 12, color: "#666666", marginBottom: 4, display: "block" };

  // 統計
  const avgViews = feedbacks.length > 0 ? Math.round(feedbacks.filter(f => f.views).reduce((s, f) => s + (f.views || 0), 0) / (feedbacks.filter(f => f.views).length || 1)) : 0;
  const avgScore = feedbacks.length > 0 ? Math.round(feedbacks.reduce((s, f) => s + (f.autoScore || 0), 0) / feedbacks.length) : 0;

  return (
    <div>
      <div style={{ fontSize: 12, color: "#888888", marginBottom: 16 }}>ログイン中: {username}</div>

      {/* 統計カード */}
      {feedbacks.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <div style={{ flex: 1, background: "#FAFAFA", border: "1px solid #E5E5E5", borderRadius: 10, padding: 14, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#666666", marginBottom: 4 }}>投稿数</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{feedbacks.length}</div>
          </div>
          <div style={{ flex: 1, background: "#FAFAFA", border: "1px solid #E5E5E5", borderRadius: 10, padding: 14, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#666666", marginBottom: 4 }}>平均ビュー</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{avgViews.toLocaleString()}</div>
          </div>
          <div style={{ flex: 1, background: "#FAFAFA", border: "1px solid #E5E5E5", borderRadius: 10, padding: 14, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#666666", marginBottom: 4 }}>平均スコア</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{avgScore}</div>
          </div>
        </div>
      )}

      {/* 入力フォーム表示ボタン */}
      {!showForm && (
        <button onClick={() => setShowForm(true)} style={{ width: "100%", padding: 14, borderRadius: 10, border: "none", cursor: "pointer", background: "#0a0a0a", color: "#FFFFFF", fontSize: 15, fontWeight: 600, marginBottom: 20 }}>
          フィードバックを記録する
        </button>
      )}

      {/* 入力フォーム */}
      {showForm && (
        <div style={{ background: "#FAFAFA", border: "1px solid #E5E5E5", borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#1A1A1A", marginBottom: 16 }}>投稿フィードバックを記録</div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>投稿した本文</label>
            <textarea value={form.mainPost} onChange={e => setForm({ ...form, mainPost: e.target.value })} rows={3} placeholder="投稿した本文を貼り付け" style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>リプ文（あれば）</label>
            <textarea value={form.replyPost} onChange={e => setForm({ ...form, replyPost: e.target.value })} rows={2} placeholder="リプ投稿の内容" style={{ ...inputStyle, resize: "vertical" }} />
          </div>

          <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>Threadsインサイトの数値を入力してください</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div><label style={labelStyle}>ビュー数</label><input type="number" value={form.views} onChange={e => setForm({ ...form, views: e.target.value })} placeholder="3200" style={inputStyle} /></div>
            <div><label style={labelStyle}>いいね数</label><input type="number" value={form.likes} onChange={e => setForm({ ...form, likes: e.target.value })} placeholder="45" style={inputStyle} /></div>
            <div><label style={labelStyle}>コメント数</label><input type="number" value={form.comments} onChange={e => setForm({ ...form, comments: e.target.value })} placeholder="12" style={inputStyle} /></div>
          </div>

          {error && <div style={{ marginBottom: 12, padding: 10, background: "rgba(220,53,69,.06)", borderRadius: 8, color: "#DC3545", fontSize: 13 }}>{error}</div>}

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => { setShowForm(false); setError(""); }} style={{ flex: 1, padding: 12, borderRadius: 8, border: "1px solid #E5E5E5", background: "transparent", color: "#555555", fontSize: 14, cursor: "pointer" }}>キャンセル</button>
            <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: 12, borderRadius: 8, border: "none", background: saving ? "#E5E5E5" : "#F5F5F5", color: "#000", fontSize: 14, fontWeight: 600, cursor: saving ? "wait" : "pointer" }}>{saving ? "保存中..." : "保存する"}</button>
          </div>
        </div>
      )}

      {/* ローディング */}
      {loading && <div style={{ textAlign: "center", color: "#888888", padding: 20 }}>読み込み中...</div>}

      {/* フィードバック一覧 */}
      {!loading && feedbacks.length === 0 && !showForm && (
        <div style={{ textAlign: "center", color: "#888888", fontSize: 14, padding: 40 }}>まだフィードバックがありません</div>
      )}

      {feedbacks.map(f => (
        <FeedbackCard key={f.id} fb={f} onDelete={handleDelete} confirmDeleteId={confirmDeleteId} setConfirmDeleteId={setConfirmDeleteId} />
      ))}

      {/* トースト */}
      {toast && <div style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", background: "#E5E5E5", color: "#1A1A1A", padding: "12px 24px", borderRadius: 10, fontSize: 14, fontWeight: 500, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,.5)" }}>{toast}</div>}
    </div>
  );
}

// ═══════ フィードバックカード ═══════
function FeedbackCard({ fb, onDelete, confirmDeleteId, setConfirmDeleteId }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ background: "#FAFAFA", border: "1px solid #E5E5E5", borderRadius: 10, marginBottom: 12, overflow: "hidden" }}>
      <div onClick={() => setExpanded(!expanded)} style={{ padding: 14, cursor: "pointer" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: "#666666", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{fb.main_post}</div>
            <div style={{ fontSize: 11, color: "#888888", marginTop: 6 }}>{new Date(fb.created_at).toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
          </div>
          <span style={{ fontSize: 12, color: "#888888", marginLeft: 8 }}>{expanded ? "▲" : "▼"}</span>
        </div>
        {/* ミニ指標 */}
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          {fb.autoGrade && <span style={{ fontSize: 12, fontWeight: 700, color: GC[fb.autoGrade] || "#888" }}>{fb.autoGrade}</span>}
          {fb.autoScore != null && <span style={{ fontSize: 12, color: "#f07852" }}>{fb.autoScore}pt</span>}
          {fb.views && <span style={{ fontSize: 12, color: "#0a0a0a" }}>▷ {fb.views.toLocaleString()}</span>}
          {fb.likes && <span style={{ fontSize: 12, color: "#ef7c50" }}>♥{fb.likes}</span>}
          {fb.comments != null && fb.comments > 0 && <span style={{ fontSize: 12, color: "#83c2cb" }}>💬{fb.comments}</span>}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "0 14px 14px" }}>
          {/* 本投稿 */}
          <div style={{ background: "#FFFFFF", border: "1px solid #E5E5E5", borderRadius: 8, padding: 12, borderLeft: "3px solid #0a0a0a", marginBottom: fb.reply_post ? 8 : 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#1A1A1A", marginBottom: 6 }}>本投稿</div>
            <div style={{ fontSize: 14, color: "#333333", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{fb.main_post}</div>
          </div>
          {/* リプ */}
          {fb.reply_post && (
            <div style={{ marginLeft: 16, background: "#FFFFFF", border: "1px solid #E5E5E5", borderRadius: 8, padding: 12, borderLeft: "3px solid #83c2cb", marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#0a0a0a", marginBottom: 6 }}>└ リプ投稿</div>
              <div style={{ fontSize: 14, color: "#333333", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{fb.reply_post}</div>
            </div>
          )}
          {/* 詳細指標 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
            {[
              { label: "スコア", val: fb.autoScore, color: "#f07852" },
              { label: "グレード", val: fb.autoGrade, color: GC[fb.autoGrade] || "#f0b83e" },
              { label: "ビュー", val: fb.views?.toLocaleString(), color: "#0a0a0a" },
              { label: "いいね", val: fb.likes, color: "#ef7c50" },
              { label: "コメント", val: fb.comments, color: "#83c2cb" },
            ].filter(x => x.val != null && x.val !== "").map((x, i) => (
              <div key={i} style={{ background: "#FFFFFF", borderRadius: 6, padding: 8, textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#888888" }}>{x.label}</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: x.color }}>{x.val}</div>
              </div>
            ))}
          </div>
          {/* 削除ボタン */}
          {confirmDeleteId === fb.id ? (
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => onDelete(fb.id)} style={{ flex: 1, padding: 10, borderRadius: 8, border: "none", background: "#DC3545", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>削除する</button>
              <button onClick={() => setConfirmDeleteId(null)} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #E5E5E5", background: "transparent", color: "#555555", fontSize: 12, cursor: "pointer" }}>やめる</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDeleteId(fb.id)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #DC354544", background: "transparent", color: "#DC3545", fontSize: 12, cursor: "pointer" }}>削除</button>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════ 会員情報変更 ═══════
function ProfileScreen({ username, onBack }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ email: "", birthday: "", threadsAccount: "", currentPassword: "", newPassword: "" });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "getProfile", username }) });
        const data = await res.json();
        if (data.profile) {
          setProfile(data.profile);
          setForm(f => ({ ...f, email: data.profile.email || "", birthday: data.profile.birthday?.slice(0, 10) || "", threadsAccount: data.profile.threads_account || "" }));
        }
      } catch {} finally { setLoading(false); }
    })();
  }, [username]);

  const handleSave = async () => {
    if (!form.currentPassword) { setErr("現在のパスワードを入力してください"); return; }
    setSaving(true); setErr(""); setMsg("");
    try {
      const res = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "updateProfile", username, currentPassword: form.currentPassword, email: form.email, birthday: form.birthday, threadsAccount: form.threadsAccount, newPassword: form.newPassword || null }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg("会員情報を更新しました"); setForm(f => ({ ...f, currentPassword: "", newPassword: "" }));
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };

  const inputSt = { width: "100%", boxSizing: "border-box", padding: "12px 14px", background: "#FAFAFA", border: "1px solid #E5E5E5", borderRadius: 8, color: "#1A1A1A", fontSize: 14, outline: "none", fontFamily: "inherit" };
  const labelSt = { fontSize: 12, color: "#666", marginBottom: 4, display: "block" };

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: "#888" }}>読み込み中...</div>;

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#888", fontSize: 14, cursor: "pointer", marginBottom: 16, padding: 0 }}>← 戻る</button>
      <div style={{ fontSize: 18, fontWeight: 600, color: "#1A1A1A", marginBottom: 24 }}>会員情報の変更</div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelSt}>ユーザー名（変更不可）</label>
        <div style={{ ...inputSt, background: "#F0F0F0", color: "#888" }}>{username}</div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={labelSt}>メールアドレス</label>
        <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inputSt} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={labelSt}>生年月日</label>
        <input type="date" value={form.birthday} onChange={e => setForm({ ...form, birthday: e.target.value })} style={inputSt} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={labelSt}>ThreadsアカウントID</label>
        <input type="text" value={form.threadsAccount} onChange={e => setForm({ ...form, threadsAccount: e.target.value })} placeholder="@notti__jp" style={inputSt} />
      </div>

      <div style={{ borderTop: "1px solid #E5E5E5", marginTop: 24, paddingTop: 24, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#1A1A1A", marginBottom: 16 }}>変更を保存するには現在のパスワードが必要です</div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelSt}>現在のパスワード（必須）</label>
          <input type="password" value={form.currentPassword} onChange={e => setForm({ ...form, currentPassword: e.target.value })} style={inputSt} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelSt}>新しいパスワード（変更する場合のみ）</label>
          <input type="password" value={form.newPassword} onChange={e => setForm({ ...form, newPassword: e.target.value })} placeholder="変更しない場合は空欄" style={inputSt} />
        </div>
      </div>

      {err && <div style={{ marginBottom: 12, padding: 10, background: "rgba(220,53,69,.06)", borderRadius: 8, color: "#DC3545", fontSize: 13 }}>{err}</div>}
      {msg && <div style={{ marginBottom: 12, padding: 10, background: "rgba(37,99,235,.06)", borderRadius: 8, color: "#0a0a0a", fontSize: 13 }}>{msg}</div>}

      <button onClick={handleSave} disabled={saving} style={{ width: "100%", padding: 14, borderRadius: 10, border: "none", cursor: saving ? "wait" : "pointer", background: saving ? "#E5E5E5" : "#0a0a0a", color: "#FFFFFF", fontSize: 15, fontWeight: 600 }}>
        {saving ? "保存中..." : "変更を保存する"}
      </button>

      {/* サブスクリプション管理 */}
      <div style={{ borderTop: "1px solid #E5E5E5", marginTop: 32, paddingTop: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#1A1A1A", marginBottom: 16 }}>サブスクリプション</div>
        <button onClick={async () => {
          try {
            const res = await fetch("/api/stripe/portal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            window.location.href = data.url;
          } catch (e) { setErr(e.message); }
        }} style={{ width: "100%", padding: 14, borderRadius: 10, border: "1px solid #E5E5E5", background: "#FFFFFF", color: "#0a0a0a", fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 12 }}>
          サブスクリプションを管理する
        </button>
        <div style={{ fontSize: 12, color: "#888", lineHeight: 1.6, marginBottom: 16 }}>
          お支払い方法の変更、請求履歴の確認、プランの解約ができます。
        </div>
        <div style={{ fontSize: 12, color: "#888", lineHeight: 1.6 }}>
          解約をご希望の場合は、上のボタンからお手続きいただくか、<a href="/contact" style={{ color: "#0a0a0a", textDecoration: "underline" }}>お問い合わせフォーム</a>からご連絡ください。運営が代理で解約手続きを行います。
        </div>
      </div>
    </div>
  );
}

// ═══════ メイン ═══════
const TABS = [{ id: "A", label: "バズスコア採点" }, { id: "B1", label: "note魅力抽出" }, { id: "B2", label: "ゴースト投稿" }, { id: "D", label: "フィードバック" }];

export default function Home() {
  const [authed, setAuthed] = useState(false);
  const [announcement, setAnnouncement] = useState(null);
  const [announcementType, setAnnouncementType] = useState(null);
  useEffect(() => { fetch(`/api/announcements?t=${Date.now()}`, { cache: "no-store" }).then(r => r.json()).then(d => { setAnnouncement(d.message); setAnnouncementType(d.type); }).catch(() => {}); }, []);
  const [pw, setPw] = useState("");
  const [username, setUsername] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [tab, setTab] = useState("A");
  const [screen, setScreen] = useState("main");
  const [drafts, setDrafts] = useState([]);
  const [saveDialog, setSaveDialog] = useState(null);
  const [draftEdit, setDraftEdit] = useState(null);
  const [draftsFilter, setDraftsFilter] = useState("draft");
  const [styleProfile, setStyleProfile] = useState(null);
  const [showStyleDialog, setShowStyleDialog] = useState(false);
  const [knowledgePriority, setKnowledgePriority] = useState(() => {
    if (typeof window !== "undefined") {
      try { const saved = localStorage.getItem("threads-nozzle"); if (saved) return JSON.parse(saved); } catch {}
    }
    return KN_DEFAULT;
  });

  // ノズル設定が変わったら即保存（localStorage + DB）
  const handleNozzleChange = (newValues) => {
    setKnowledgePriority(newValues);
    try { localStorage.setItem("threads-nozzle", JSON.stringify(newValues)); } catch {}
    // バックグラウンドでDBにも保存
    if (username) {
      fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "saveNozzle", username, nozzleSettings: JSON.stringify(newValues) })
      }).catch(() => {});
    }
  };

  // ログイン時にDBからノズル設定を復元
  const loadNozzleFromDB = async (uname) => {
    try {
      const res = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getProfile", username: uname }) });
      const data = await res.json();
      if (data.profile?.nozzle_settings) {
        const settings = JSON.parse(data.profile.nozzle_settings);
        setKnowledgePriority(settings);
        try { localStorage.setItem("threads-nozzle", JSON.stringify(settings)); } catch {}
      }
    } catch {}
  };
  const [appealText, setAppealText] = useState("");
  const [credits, setCredits] = useState(null);
  const [showPurchase, setShowPurchase] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(null);

  // クレジット残高を取得
  const loadCredits = async () => {
    if (!username) return;
    try {
      const res = await fetch(`/api/credits?username=${encodeURIComponent(username)}`);
      const data = await res.json();
      if (res.ok) setCredits(data.credits);
    } catch {}
  };
  useEffect(() => { if (authed && username) loadCredits(); }, [authed, username]);

  // クレジットを消費（API呼び出し前に呼ぶ）
  const useCredit = async (action) => {
    try {
      const res = await fetch("/api/credits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, action }) });
      const data = await res.json();
      if (!res.ok) {
        if (data.needPurchase) setShowPurchase(true);
        throw new Error(data.error);
      }
      setCredits(data.credits);
      return true;
    } catch (e) { throw e; }
  };

  // Stripe決済
  const handlePurchase = async (planId) => {
    setPurchaseLoading(planId);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "credits", planId, username }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = data.url;
    } catch (e) { toast.show("決済の開始に失敗しました"); } finally { setPurchaseLoading(null); }
  };

  // 購入成功/キャンセルのURL検出
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("purchase") === "success") { toast.show("クレジットを追加しました！"); loadCredits(); window.history.replaceState({}, "", window.location.pathname); }
    if (params.get("purchase") === "cancel") { toast.show("購入がキャンセルされました"); window.history.replaceState({}, "", window.location.pathname); }
  }, []);
  const toast = useToast();

  useEffect(() => { setStyleProfile(lsGet(STYLE_KEY)); }, []);
  // 下書きをDBから読み込み（ログイン後）
  const loadDrafts = async () => {
    if (!username) return;
    try {
      const res = await fetch(`/api/drafts?username=${encodeURIComponent(username)}`);
      const data = await res.json();
      if (data.data) setDrafts(data.data.map(d => ({ id: d.id, title: d.title, mainPost: d.main_post, reply: d.reply || "", status: d.status, createdAt: d.created_at, updatedAt: d.updated_at })));
    } catch {}
  };
  useEffect(() => { if (authed && username) loadDrafts(); }, [authed, username]);

  const handleSaveDraft = (mainPost, reply) => { if (!mainPost?.trim()) return; setSaveDialog({ mainPost, reply: reply || "", defaultTitle: mainPost.slice(0, 20) }); };
  const confirmSave = async (title) => {
    if (!saveDialog) return;
    const id = draftEdit ? draftEdit.id : undefined;
    try {
      await fetch("/api/drafts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, id, title: title || saveDialog.defaultTitle, mainPost: saveDialog.mainPost, reply: saveDialog.reply, status: "draft" }) });
      loadDrafts();
    } catch {}
    setSaveDialog(null); setDraftEdit(null); toast.show("下書きを保存しました");
  };
  const handleDelete = async (id) => {
    try { await fetch(`/api/drafts?id=${id}&username=${encodeURIComponent(username)}`, { method: "DELETE" }); loadDrafts(); } catch {}
    toast.show("削除しました");
  };
  const handleMarkPosted = async (id) => {
    const draft = drafts.find(d => d.id === id);
    if (!draft) return;
    try { await fetch("/api/drafts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, id, title: draft.title, mainPost: draft.mainPost, reply: draft.reply, status: "posted" }) }); loadDrafts(); } catch {}
    toast.show("投稿済みにしました");
  };
  const handleEdit = (draft) => { setDraftEdit(draft); setTab("A"); setScreen("main"); };
  const handleStyleComplete = (s) => { setStyleProfile(s); setShowStyleDialog(false); toast.show("文体を学習しました"); };
  const handleSelectAppeal = (content) => { setAppealText(content); setTab("A"); setScreen("main"); toast.show("素案をタブAに送りました"); };
  const draftCount = drafts.filter(d => d.status === "draft").length;

  const [authMode, setAuthMode] = useState("login"); // "login", "register1", "register2", "resetRequest", "resetDone", "resetExecute"
  const [authLoading, setAuthLoading] = useState(false);
  const [regEmail, setRegEmail] = useState("");
  const [regBirthday, setRegBirthday] = useState("");
  const [regThreads, setRegThreads] = useState("");
  const [regCoupon, setRegCoupon] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [resetMaskedEmail, setResetMaskedEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPw, setNewPw] = useState("");

  // URLパラメータからリセットトークン / サブスク結果を検出
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("reset");
    if (t) { setResetToken(t); setAuthMode("resetExecute"); }
    if (params.get("subscription") === "success") { toast.show("サブスクリプション登録が完了しました！ログインしてください。"); window.history.replaceState({}, "", window.location.pathname); }
    if (params.get("subscription") === "cancel") { toast.show("サブスクリプション登録がキャンセルされました。ログイン後に再度お手続きいただけます。"); window.history.replaceState({}, "", window.location.pathname); }
  }, []);

  const inputSt = { width: "100%", boxSizing: "border-box", padding: "14px 16px", background: "#FAFAFA", border: "1px solid #E5E5E5", borderRadius: 10, color: "#1A1A1A", fontSize: 15, outline: "none", fontFamily: "inherit", marginBottom: 12 };
  const btnSt = (loading) => ({ width: "100%", padding: 14, borderRadius: 10, border: "none", cursor: loading ? "wait" : "pointer", background: loading ? "#E5E5E5" : "#0a0a0a", color: "#FFFFFF", fontSize: 15, fontWeight: 600 });
  const authApi = async (body) => {
    const res = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  };

  // STEP1: ユーザー名＋メール → STEP2へ
  const doStep1 = async () => {
    if (!username.trim()) { setPwErr("ユーザー名を入力してください"); return; }
    if (!regEmail.trim()) { setPwErr("メールアドレスを入力してください"); return; }
    setAuthLoading(true); setPwErr("");
    try {
      await authApi({ action: "checkUsername", username: username.trim() });
      setAuthMode("register2");
    } catch (e) { setPwErr(e.message); } finally { setAuthLoading(false); }
  };

  // STEP2: パスワード＋生年月日＋ThreadsID → DB登録 → Stripe決済へ
  const doStep2 = async () => {
    if (!pw.trim()) { setPwErr("パスワードを入力してください"); return; }
    if (pw.trim().length < 4) { setPwErr("パスワードは4文字以上にしてください"); return; }
    if (!regBirthday) { setPwErr("生年月日を入力してください"); return; }
    if (!agreeTerms) { setPwErr("利用規約への同意が必要です"); return; }
    setAuthLoading(true); setPwErr("");
    try {
      // まずアカウントをDBに作成
      const data = await authApi({ action: "register", username: username.trim(), email: regEmail.trim(), password: pw.trim(), birthday: regBirthday, threadsAccount: regThreads.trim() });
      // Stripe Checkout（サブスクリプション）へリダイレクト
      const stripeRes = await fetch("/api/stripe/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "subscription", username: data.username, couponCode: regCoupon.trim() || null }),
      });
      const stripeData = await stripeRes.json();
      if (!stripeRes.ok) throw new Error(stripeData.error);
      window.location.href = stripeData.url;
    } catch (e) { setPwErr(e.message); } finally { setAuthLoading(false); }
  };

  // ログイン
  const doLogin = async () => {
    if (!username.trim() || !pw.trim()) { setPwErr("ユーザー名とパスワードを入力してください"); return; }
    setAuthLoading(true); setPwErr("");
    try {
      const data = await authApi({ action: "login", username: username.trim(), password: pw.trim() });
      setUsername(data.username);
      loadNozzleFromDB(data.username);
      setAuthed(true);
    } catch (e) { setPwErr(e.message); } finally { setAuthLoading(false); }
  };

  // パスワードリセット申請
  const doResetRequest = async () => {
    if (!username.trim() || !regEmail.trim() || !regBirthday) { setPwErr("すべての項目を入力してください"); return; }
    setAuthLoading(true); setPwErr("");
    try {
      const data = await authApi({ action: "requestReset", username: username.trim(), email: regEmail.trim(), birthday: regBirthday });
      setResetMaskedEmail(data.maskedEmail);
      setAuthMode("resetDone");
    } catch (e) { setPwErr(e.message); } finally { setAuthLoading(false); }
  };

  // パスワードリセット実行
  const doResetExecute = async () => {
    if (!newPw.trim()) { setPwErr("新しいパスワードを入力してください"); return; }
    if (newPw.trim().length < 4) { setPwErr("パスワードは4文字以上にしてください"); return; }
    setAuthLoading(true); setPwErr("");
    try {
      await authApi({ action: "executeReset", token: resetToken, newPassword: newPw.trim() });
      setAuthMode("login");
      setPwErr(""); setNewPw(""); setResetToken("");
      window.history.replaceState({}, "", window.location.pathname);
      toast.show("パスワードを再設定しました。新しいパスワードでログインしてください。");
    } catch (e) { setPwErr(e.message); } finally { setAuthLoading(false); }
  };


  if (!authed) {
    return (
      <div style={{ minHeight: "100vh", background: "#FFFFFF", color: "#1A1A1A", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Hiragino Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowX: "hidden", width: "100%", maxWidth: "100vw" }}>
        <div style={{ width: "100%", maxWidth: 380, textAlign: "center" }}>
          <img src="/logo.png" alt="キニナルメーカー" style={{ maxWidth: 240, width: "100%", height: "auto", marginBottom: 24 }} />
          {announcement && announcementType === "alert" && <div style={{ marginBottom: 16, padding: "12px 16px", background: "#FFF3CD", border: "1px solid #FFEEBA", borderRadius: 10, fontSize: 13, color: "#856404", lineHeight: 1.6, textAlign: "left" }}>⚠ {announcement}</div>}

          {/* ═══ ログイン画面 ═══ */}
          {authMode === "login" && (<>
            <input type="text" value={username} onChange={e => { setUsername(e.target.value); setPwErr(""); }} placeholder="ユーザー名" style={inputSt} />
            <input type="password" value={pw} onChange={e => { setPw(e.target.value); setPwErr(""); }} onKeyDown={e => { if (e.key === "Enter") doLogin(); }} placeholder="パスワード" style={inputSt} />
            <button onClick={doLogin} disabled={authLoading} style={btnSt(authLoading)}>{authLoading ? "処理中..." : "ログイン"}</button>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, fontSize: 13 }}>
              <button onClick={() => { setAuthMode("register1"); setPwErr(""); setPw(""); }} style={{ background: "none", border: "none", color: "#0a0a0a", cursor: "pointer", fontSize: 13, textDecoration: "underline" }}>新規登録</button>
              <button onClick={() => { setAuthMode("resetRequest"); setPwErr(""); }} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 13, textDecoration: "underline" }}>パスワードを忘れた</button>
            </div>
          </>)}

          {/* ═══ 新規登録 STEP1 ═══ */}
          {authMode === "register1" && (<>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#0a0a0a", marginBottom: 4 }}>STEP 1 / 2</div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 20 }}>アカウント情報を入力してください</div>
            <input type="text" value={username} onChange={e => { setUsername(e.target.value); setPwErr(""); }} placeholder="ユーザー名（英数字、2〜20文字）" style={inputSt} />
            <input type="email" value={regEmail} onChange={e => { setRegEmail(e.target.value); setPwErr(""); }} placeholder="メールアドレス" style={inputSt} />
            <button onClick={doStep1} disabled={authLoading} style={btnSt(authLoading)}>{authLoading ? "確認中..." : "次へ"}</button>
            <button onClick={() => { setAuthMode("login"); setPwErr(""); }} style={{ marginTop: 12, background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 13 }}>← ログインに戻る</button>
          </>)}

          {/* ═══ 新規登録 STEP2 ═══ */}
          {authMode === "register2" && (<>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#0a0a0a", marginBottom: 4 }}>STEP 2 / 2</div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 20 }}>{username} さんの登録を完了します</div>
            <input type="password" value={pw} onChange={e => { setPw(e.target.value); setPwErr(""); }} placeholder="パスワード（4文字以上）" style={inputSt} />
            <input type="date" value={regBirthday} onChange={e => { setRegBirthday(e.target.value); setPwErr(""); }} style={{ ...inputSt, color: regBirthday ? "#1A1A1A" : "#BBB" }} />
            <div style={{ fontSize: 12, color: "#888", marginBottom: 4, textAlign: "left" }}>生年月日</div>
            <input type="text" value={regThreads} onChange={e => setRegThreads(e.target.value)} placeholder="ThreadsアカウントID（例：@notti__jp）" style={{ ...inputSt, marginTop: 4 }} />
            <input type="text" value={regCoupon} onChange={e => setRegCoupon(e.target.value)} placeholder="割引コード（お持ちの方のみ）" style={{ ...inputSt, textAlign: "center", letterSpacing: 1 }} />
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", fontSize: 13, color: "#444", lineHeight: 1.6, textAlign: "left" }}>
                <input type="checkbox" checked={agreeTerms} onChange={e => { setAgreeTerms(e.target.checked); setPwErr(""); }} style={{ marginTop: 3, accentColor: "#0a0a0a" }} />
                <span><a href="/terms" target="_blank" style={{ color: "#0a0a0a", textDecoration: "underline" }}>利用規約</a>および<a href="/privacy" target="_blank" style={{ color: "#0a0a0a", textDecoration: "underline" }}>プライバシーポリシー</a>に同意します</span>
              </label>
            </div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 16, textAlign: "left", lineHeight: 1.6 }}>
              月額¥1,980（税込）のサブスクリプションに登録されます。{regCoupon.trim() ? "割引コードが適用されます。" : ""}次の画面でクレジットカード情報を入力してください。
            </div>
            <button onClick={doStep2} disabled={authLoading || !agreeTerms} style={{ ...btnSt(authLoading), opacity: !agreeTerms ? 0.4 : 1 }}>{authLoading ? "処理中..." : "登録してお支払いへ進む"}</button>
            <button onClick={() => { setAuthMode("register1"); setPwErr(""); }} style={{ marginTop: 12, background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 13 }}>← 戻る</button>
          </>)}

          {/* ═══ パスワードリセット申請 ═══ */}
          {authMode === "resetRequest" && (<>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#0a0a0a", marginBottom: 4 }}>パスワードの再設定</div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 20 }}>登録情報を入力してください</div>
            <input type="text" value={username} onChange={e => { setUsername(e.target.value); setPwErr(""); }} placeholder="ユーザー名" style={inputSt} />
            <input type="email" value={regEmail} onChange={e => { setRegEmail(e.target.value); setPwErr(""); }} placeholder="登録メールアドレス" style={inputSt} />
            <input type="date" value={regBirthday} onChange={e => { setRegBirthday(e.target.value); setPwErr(""); }} style={{ ...inputSt, color: regBirthday ? "#1A1A1A" : "#BBB" }} />
            <div style={{ fontSize: 12, color: "#888", marginBottom: 4, textAlign: "left" }}>生年月日</div>
            <button onClick={doResetRequest} disabled={authLoading} style={{ ...btnSt(authLoading), marginTop: 8 }}>{authLoading ? "送信中..." : "リセットメールを送信"}</button>
            <button onClick={() => { setAuthMode("login"); setPwErr(""); }} style={{ marginTop: 12, background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 13 }}>← ログインに戻る</button>
          </>)}

          {/* ═══ パスワードリセットメール送信完了 ═══ */}
          {authMode === "resetDone" && (<>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#0a0a0a", marginBottom: 16 }}>メールを送信しました</div>
            <div style={{ fontSize: 14, color: "#444", lineHeight: 1.8, marginBottom: 20, textAlign: "left" }}>
              ご登録済みの<br/>
              <span style={{ fontWeight: 600, color: "#0a0a0a" }}>{resetMaskedEmail}</span><br/>
              にパスワード再設定用のURLを発行しました。<br/><br/>
              10分以内にメール内のリンクからパスワードを再設定してください。
            </div>
            <button onClick={() => { setAuthMode("login"); setPwErr(""); }} style={btnSt(false)}>ログイン画面に戻る</button>
          </>)}

          {/* ═══ パスワードリセット実行（メールのリンクから来た時） ═══ */}
          {authMode === "resetExecute" && (<>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#0a0a0a", marginBottom: 16 }}>新しいパスワードを設定</div>
            <input type="password" value={newPw} onChange={e => { setNewPw(e.target.value); setPwErr(""); }} placeholder="新しいパスワード（4文字以上）" style={inputSt} />
            <button onClick={doResetExecute} disabled={authLoading} style={btnSt(authLoading)}>{authLoading ? "設定中..." : "パスワードを再設定する"}</button>
          </>)}

          {pwErr && <div style={{ marginTop: 12, fontSize: 13, color: "#DC3545" }}>{pwErr}</div>}
          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, fontSize: 12 }}>
            <div style={{ display: "flex", gap: 16 }}>
              <a href="/privacy" style={{ color: "#888", textDecoration: "none" }}>プライバシーポリシー</a>
              <a href="/terms" style={{ color: "#888", textDecoration: "none" }}>利用規約</a>
              <a href="/refund" style={{ color: "#888", textDecoration: "none" }}>返金ポリシー</a>
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              <a href="/legal" style={{ color: "#888", textDecoration: "none" }}>特定商取引法</a>
              <a href="/contact" style={{ color: "#888", textDecoration: "none" }}>お問い合わせ</a>
            </div>
          </div>
        </div>
        {toast.Toast}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#FFFFFF", color: "#1A1A1A", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Hiragino Sans', sans-serif", padding: "20px 16px", overflowX: "hidden", width: "100%", maxWidth: "100vw" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ marginBottom: 12, textAlign: "center" }}>
          <img src="/logo.png" alt="キニナルメーカー" style={{ maxWidth: 160, width: "100%", height: "auto", marginBottom: 4 }} />
          <div style={{ marginTop: 4, display: "flex", justifyContent: "center", gap: 16, fontSize: 12 }}>
            <span style={{ color: "#888" }}>{username}</span>
            <button onClick={() => setScreen("profile")} style={{ background: "none", border: "none", color: "#0a0a0a", cursor: "pointer", fontSize: 12, textDecoration: "underline" }}>会員情報</button>
            <button onClick={() => { setAuthed(false); setUsername(""); setPw(""); }} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 12 }}>ログアウト</button>
          </div>
          {/* クレジットバロメーター */}
          {credits !== null && (
            <div style={{ marginTop: 12, padding: "8px 16px", background: "#FAFAFA", borderRadius: 10, border: "1px solid #E5E5E5" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: "#888" }}>残り利用回数</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: credits <= 10 ? "#DC3545" : credits <= 30 ? "#f0b83e" : "#0a0a0a" }}>{credits}</span>
                  <span style={{ fontSize: 12, color: "#888" }}>回</span>
                  <button onClick={() => setShowPurchase(true)} style={{ fontSize: 11, padding: "3px 10px", background: "#0a0a0a", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>追加</button>
                </div>
              </div>
              <div style={{ height: 4, background: "#E5E5E5", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(credits, 100)}%`, background: credits <= 10 ? "#DC3545" : credits <= 30 ? "#f0b83e" : "#83c2cb", borderRadius: 2, transition: "width .3s" }} />
              </div>
            </div>
          )}
        </div>
        {/* 購入モーダル */}
        {showPurchase && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16 }}>
            <div style={{ background: "#FFFFFF", borderRadius: 16, padding: 24, maxWidth: 380, width: "100%" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#1A1A1A", marginBottom: 4 }}>追加クレジットを購入</div>
              <div style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>現在の残り：{credits}回</div>
              {[
                { id: "plan100", credits: 100, price: "¥1,200", sub: "1回あたり¥12" },
                { id: "plan200", credits: 200, price: "¥2,200", sub: "1回あたり¥11" },
                { id: "plan300", credits: 300, price: "¥3,000", sub: "1回あたり¥10", badge: "お得" },
              ].map(p => (
                <button key={p.id} onClick={() => handlePurchase(p.id)} disabled={!!purchaseLoading} style={{
                  width: "100%", padding: 16, marginBottom: 10, borderRadius: 10,
                  border: p.badge ? "2px solid #f07852" : "1px solid #E5E5E5",
                  background: purchaseLoading === p.id ? "#F0F0F0" : "#FFFFFF",
                  cursor: purchaseLoading ? "wait" : "pointer", textAlign: "left", position: "relative",
                }}>
                  {p.badge && <span style={{ position: "absolute", top: -8, right: 12, background: "#f07852", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4 }}>{p.badge}</span>}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "#1A1A1A" }}>+{p.credits}回</div>
                      <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{p.sub}</div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#0a0a0a" }}>{p.price}</div>
                  </div>
                </button>
              ))}
              <button onClick={() => setShowPurchase(false)} style={{ width: "100%", padding: 12, marginTop: 8, borderRadius: 8, border: "1px solid #E5E5E5", background: "transparent", color: "#888", fontSize: 13, cursor: "pointer" }}>閉じる</button>
            </div>
          </div>
        )}
        {screen === "profile" ? (
          <ProfileScreen username={username} onBack={() => setScreen("main")} />
        ) : screen === "drafts" ? (
          <DraftsScreen drafts={drafts} onBack={() => setScreen("main")} onEdit={handleEdit} onDelete={handleDelete} onMarkPosted={handleMarkPosted} statusFilter={draftsFilter} />
        ) : (
          <>
            {announcement && announcementType === "alert" && <div style={{ marginBottom: 14, padding: "12px 16px", background: "#FFF3CD", border: "1px solid #FFEEBA", borderRadius: 10, fontSize: 13, color: "#856404", lineHeight: 1.6 }}>⚠ {announcement}</div>}
            {announcement && announcementType === "memo" && <div style={{ marginBottom: 14, position: "relative", padding: "12px 16px 12px 20px", background: "#F8F8F8", borderRadius: 12, borderLeft: "3px solid #83c2cb", fontSize: 13, color: "#555", lineHeight: 1.7 }}><span style={{ fontWeight: 600, color: "#0a0a0a" }}>投稿のヒント：</span>{announcement}</div>}
            <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "#FAFAFA", borderRadius: 10, padding: 4 }}>
              {TABS.map(t => <button key={t.id} onClick={() => { setTab(t.id); setDraftEdit(null); if (t.id !== "A") setAppealText(""); }} style={{ flex: 1, padding: "10px 8px", borderRadius: 8, border: "none", cursor: "pointer", background: tab === t.id ? "#0a0a0a" : "transparent", color: tab === t.id ? "#FFFFFF" : "#777777", fontSize: 12, fontWeight: 600 }}>{t.label}</button>)}
            </div>
            <button onClick={() => { setDraftsFilter("draft"); setScreen("drafts"); }} style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #83c2cb", background: "rgba(131,194,203,0.06)", color: "#0a0a0a", fontSize: 13, fontWeight: 500, cursor: "pointer", marginBottom: 20 }}>
              下書き一覧{draftCount > 0 ? `（${draftCount}件）` : ""}
            </button>
            {tab === "A" && <TabA onSaveDraft={handleSaveDraft} draftEdit={draftEdit} styleProfile={styleProfile} onStyleChange={() => setShowStyleDialog(true)} knowledgePriority={knowledgePriority} onKnowledgeChange={handleNozzleChange} appealText={appealText} onClearAppeal={() => setAppealText("")} useCredit={useCredit} username={username} />}
            {tab === "B1" && <TabB1 onSelectAppeal={handleSelectAppeal} useCredit={useCredit} styleProfile={styleProfile} onStyleChange={() => setShowStyleDialog(true)} />}
            {tab === "B2" && <TabB2 onSaveDraft={handleSaveDraft} styleProfile={styleProfile} onStyleChange={() => setShowStyleDialog(true)} useCredit={useCredit} />}
            {tab === "D" && <TabD username={username} />}
          </>
        )}
      </div>
      <div style={{ maxWidth: 560, margin: "40px auto 0", padding: "20px 0", borderTop: "1px solid #E5E5E5", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, fontSize: 12 }}>
        <div style={{ display: "flex", gap: 16 }}>
          <a href="/privacy" style={{ color: "#888", textDecoration: "none" }}>プライバシーポリシー</a>
          <a href="/terms" style={{ color: "#888", textDecoration: "none" }}>利用規約</a>
          <a href="/refund" style={{ color: "#888", textDecoration: "none" }}>返金ポリシー</a>
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          <a href="/legal" style={{ color: "#888", textDecoration: "none" }}>特定商取引法</a>
          <a href="/contact" style={{ color: "#888", textDecoration: "none" }}>お問い合わせ</a>
        </div>
      </div>
      {saveDialog && <SaveDialog defaultTitle={saveDialog.defaultTitle} onSave={confirmSave} onClose={() => setSaveDialog(null)} />}
      {showStyleDialog && <StyleLearningDialog onComplete={handleStyleComplete} onClose={() => setShowStyleDialog(false)} />}
      {toast.Toast}
    </div>
  );
}
