"use client";
// Version: v2.6-URLStyle-Loading - 2026-04-25 - A/B1/B2/Drafts/Style (Vercel版)
import { useState, useEffect, useRef, useCallback } from "react";

// ═══════ Storage (localStorage for Vercel) ═══════
const DRAFTS_KEY = "threads-drafts";
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
const GC = { S: "#FFFFFF", A: "#E0E0E0", B: "#999999", C: "#666666", D: "#CCCCCC" };
const GB = { S: "rgba(240,120,82,.1)", A: "rgba(240,184,62,.1)", B: "rgba(131,194,203,.1)", C: "rgba(44,66,90,.08)", D: "rgba(223,185,174,.1)" };

// ═══════ 共通UI ═══════
const Radio = ({ options, value, onChange }) => (
  <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
    {options.map(o => (
      <label key={o.value} onClick={() => onChange(o.value)} style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: value === o.value ? "#2c425a" : "#FAFAFA", border: `1px solid ${value === o.value ? "#2c425a" : "#E5E5E5"}`, borderRadius: 8, cursor: "pointer", transition: "all .15s" }}>
        <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${value === o.value ? "#FFFFFF" : "#CCCCCC"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {value === o.value && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#FFFFFF" }} />}
        </div>
        <span style={{ fontSize: 13, color: value === o.value ? "#FFFFFF" : "#666666", fontWeight: value === o.value ? 600 : 400 }}>{o.label}</span>
      </label>
    ))}
  </div>
);
const Btn = ({ onClick, loading, disabled, label, bg, color: c }) => (
  <button onClick={onClick} disabled={loading || disabled} style={{ width: "100%", padding: 14, borderRadius: 10, border: "none", cursor: loading ? "wait" : "pointer", background: loading ? "#E5E5E5" : (bg || "#2c425a"), color: c || "#FFFFFF", fontSize: 15, fontWeight: 600, opacity: disabled ? 0.4 : 1, marginBottom: 8 }}>{loading ? "生成中..." : label}</button>
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
const Upload = ({ file, onChange }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "20px 16px", background: "#FAFAFA", border: "2px dashed #E5E5E5", borderRadius: 12, cursor: "pointer" }}>
      <input type="file" accept=".txt,.docx,.doc,.pdf" onChange={e => onChange(e.target.files?.[0] || null)} style={{ display: "none" }} />
      <span style={{ fontSize: 14, color: file ? "#F5F5F5" : "#555555" }}>{file ? file.name : "記事ファイルをアップロード（.txt .docx .pdf）"}</span>
    </label>
  </div>
);
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} };
  return <button onClick={copy} style={{ fontSize: 11, padding: "3px 10px", background: copied ? "#83c2cb22" : "#F0F0F0", border: `1px solid ${copied ? "#83c2cb44" : "#CCCCCC"}`, borderRadius: 6, color: copied ? "#2c425a" : "#999999", cursor: "pointer", whiteSpace: "nowrap" }}>{copied ? "コピー済" : "コピー"}</button>;
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
    {main && <div style={{ background: "#FAFAFA", border: "1px solid #E5E5E5", borderRadius: 10, padding: 14, borderLeft: "3px solid #2c425a", marginBottom: reply ? 8 : 0 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}><div style={{ fontSize: 11, fontWeight: 600, color: "#1A1A1A" }}>本投稿</div><CopyBtn text={main} /></div><div style={{ fontSize: 14, color: "#333333", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{main}</div></div>}
    {reply && <div style={{ marginLeft: 16, background: "#FAFAFA", border: "1px solid #E5E5E5", borderRadius: 10, padding: 14, borderLeft: "3px solid #83c2cb" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}><div style={{ fontSize: 11, fontWeight: 600, color: "#2c425a" }}>└ リプ投稿</div><CopyBtn text={reply} /></div><div style={{ fontSize: 14, color: "#333333", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{reply}</div></div>}
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
          <div style={{ fontSize: 13, fontWeight: 600, color: "#2c425a", marginBottom: 4 }}>学習済みの文体</div>
          <div style={{ fontSize: 12, color: "#666666" }}>{style.sourceName} ・ {new Date(style.updatedAt).toLocaleDateString("ja-JP")}</div>
        </div>
        <span style={{ fontSize: 12, color: "#83c2cb" }}>{expanded ? "▲" : "▼"}</span>
      </div>
      {expanded && (
        <div style={{ padding: "0 14px 14px" }}>
          <div style={{ fontSize: 13, color: "#444444", lineHeight: 1.7, whiteSpace: "pre-wrap", marginBottom: 12, maxHeight: 200, overflowY: "auto" }}>{style.profile}</div>
          <button onClick={onChangeRequest} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #83c2cb", background: "transparent", color: "#2c425a", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>文体を変更する</button>
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
          <button onClick={() => onSave(title)} style={{ flex: 1, padding: 12, borderRadius: 8, border: "none", background: "#2c425a", color: "#FFFFFF", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>保存</button>
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
          <button key={t.id} onClick={() => setFilter(t.id)} style={{ flex: 1, padding: "10px 8px", borderRadius: 8, border: "none", cursor: "pointer", background: filter === t.id ? "#2c425a" : "transparent", color: filter === t.id ? "#FFFFFF" : "#777777", fontSize: 13, fontWeight: 600 }}>{t.label}</button>
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
                <div style={{ background: "#FFFFFF", border: "1px solid #E5E5E5", borderRadius: 8, padding: 12, borderLeft: "3px solid #2c425a", marginBottom: d.reply ? 8 : 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}><div style={{ fontSize: 11, fontWeight: 600, color: "#1A1A1A" }}>本投稿</div><CopyBtn text={d.mainPost} /></div>
                  <div style={{ fontSize: 14, color: "#333333", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{d.mainPost}</div>
                </div>
                {d.reply && (
                  <div style={{ marginLeft: 16, background: "#FFFFFF", border: "1px solid #E5E5E5", borderRadius: 8, padding: 12, borderLeft: "3px solid #83c2cb", marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}><div style={{ fontSize: 11, fontWeight: 600, color: "#2c425a" }}>└ リプ投稿</div><CopyBtn text={d.reply} /></div>
                    <div style={{ fontSize: 14, color: "#333333", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{d.reply}</div>
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  {filter === "draft" && <>
                    <button onClick={() => onEdit(d)} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #CCCCCC", background: "transparent", color: "#1A1A1A", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>編集</button>
                    <button onClick={() => onMarkPosted(d.id)} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #83c2cb44", background: "transparent", color: "#2c425a", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>投稿済みにする</button>
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
function TabA({ onSaveDraft, draftEdit, styleProfile, onStyleChange }) {
  const [text, setText] = useState(draftEdit?.mainPost || "");
  const [mode, setMode] = useState("tree");
  const [useHook, setUseHook] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { if (draftEdit) setText(draftEdit.mainPost || ""); }, [draftEdit]);
  const run = async () => {
    if (!text.trim()) return; setLoading(true); setError(""); setResult(null);
    try {
      const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, mode, useHook, styleProfile: styleProfile?.profile || "" }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error); setResult(data);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };
  return (
    <div>
      <StyleCard style={styleProfile} onChangeRequest={onStyleChange} />
      <div style={{ position: "relative", marginBottom: 16 }}>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Threadsの投稿文をここに入力..." rows={6} style={{ width: "100%", boxSizing: "border-box", background: "#FAFAFA", border: "1px solid #E5E5E5", borderRadius: 12, padding: 16, color: "#1A1A1A", fontSize: 15, lineHeight: 1.7, resize: "vertical", outline: "none", fontFamily: "inherit" }} />
        <div style={{ position: "absolute", bottom: 12, right: 14, fontSize: 12, color: text.length > 500 ? "#DC3545" : "#555555" }}>{text.length}</div>
      </div>
      <Radio options={[{ value: "single", label: "本投稿のみ" }, { value: "tree", label: "本投稿＋リプ" }]} value={mode} onChange={setMode} />
      <HookToggle value={useHook} onChange={setUseHook} />
      <Btn onClick={run} loading={loading} disabled={!text.trim()} label="採点する" bg="#f07852" />
      {text.trim() && !loading && <Btn onClick={() => onSaveDraft(text, "")} label="下書き保存" bg="#F5F5F5" color="#666666" />}
      <Err msg={error} />
      {loading && <LoadingIndicator message="採点中（しばらくお待ちください）" />}
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
              {[{ label: "本投稿", text: result.rewrite.main, ml: 0, c: "#2c425a" }, { label: "└ リプ投稿", text: result.rewrite.reply, ml: 16, c: "#83c2cb" }].map((p, i) => p.text && (
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

// ═══════ タブB1 ═══════
function TabB1({ onSaveDraft, styleProfile }) {
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState("tree");
  const [useHook, setUseHook] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const run = async () => {
    if (!file) return; setLoading(true); setError(""); setResult(null);
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("type", "b1"); fd.append("mode", mode); fd.append("useHook", String(useHook)); fd.append("styleProfile", styleProfile?.profile || "");
      const res = await fetch("/api/generate", { method: "POST", body: fd });
      const data = await res.json(); if (!res.ok) throw new Error(data.error); setResult(data);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };
  return (
    <div>
      {styleProfile && <div style={{ fontSize: 12, color: "#2c425a", marginBottom: 12, padding: "8px 12px", background: "rgba(131,194,203,0.08)", border: "1px solid rgba(131,194,203,0.2)", borderRadius: 8 }}>文体「{styleProfile.sourceName}」を適用中</div>}
      <Upload file={file} onChange={setFile} />
      <Radio options={[{ value: "single", label: "本投稿のみ" }, { value: "tree", label: "本投稿＋リプ" }]} value={mode} onChange={setMode} />
      <HookToggle value={useHook} onChange={setUseHook} />
      <Btn onClick={run} loading={loading} disabled={!file} label="誘導投稿を生成（5案）" bg="#edbb3f" color="#1A1A1A" />
      <Err msg={error} />
      {loading && <LoadingIndicator message="生成中（しばらくお待ちください）" />}
      {result && (
        <div style={{ marginTop: 24 }}>
          {result.analysis && <div style={{ background: "#FAFAFA", border: "1px solid #E5E5E5", borderRadius: 10, padding: 16, marginBottom: 20 }}><div style={{ fontSize: 13, fontWeight: 600, color: "#555555", marginBottom: 10 }}>記事分析</div><div style={{ fontSize: 13, color: "#333333", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{result.analysis}</div></div>}
          <div style={{ fontSize: 13, fontWeight: 600, color: "#555555", marginBottom: 12 }}>生成結果（5案）</div>
          {result.posts.map((p, i) => <Card key={i} index={i+1} main={p.main} reply={p.reply} hooks={p.hooks} onSave={onSaveDraft} />)}
        </div>
      )}
    </div>
  );
}

// ═══════ タブB2 ═══════
function TabB2({ onSaveDraft, styleProfile }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const run = async () => {
    if (!file) return; setLoading(true); setError(""); setResult(null);
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("type", "b2"); fd.append("mode", "single"); fd.append("styleProfile", styleProfile?.profile || "");
      const res = await fetch("/api/generate", { method: "POST", body: fd });
      const data = await res.json(); if (!res.ok) throw new Error(data.error); setResult(data);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };
  return (
    <div>
      {styleProfile && <div style={{ fontSize: 12, color: "#2c425a", marginBottom: 12, padding: "8px 12px", background: "rgba(131,194,203,0.08)", border: "1px solid rgba(131,194,203,0.2)", borderRadius: 8 }}>文体「{styleProfile.sourceName}」を適用中</div>}
      <Upload file={file} onChange={setFile} />
      <div style={{ fontSize: 12, color: "#888888", marginBottom: 16 }}>※ ゴースト投稿は本投稿のみ（8〜12行）で生成されます</div>
      <Btn onClick={run} loading={loading} disabled={!file} label="ゴースト投稿を生成（5案）" bg="#83c2cb" color="#1A1A1A" />
      <Err msg={error} />
      {loading && <LoadingIndicator message="生成中（しばらくお待ちください）" />}
      {result && (
        <div style={{ marginTop: 24 }}>
          {result.analysis && <div style={{ background: "#FAFAFA", border: "1px solid #E5E5E5", borderRadius: 10, padding: 16, marginBottom: 20 }}><div style={{ fontSize: 13, fontWeight: 600, color: "#555555", marginBottom: 10 }}>記事分析</div><div style={{ fontSize: 13, color: "#333333", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{result.analysis}</div></div>}
          <div style={{ fontSize: 13, fontWeight: 600, color: "#555555", marginBottom: 12 }}>生成結果（5案）</div>
          {result.posts.map((p, i) => <Card key={i} index={i+1} main={p.main} reply="" onSave={(m) => onSaveDraft(m, "")} />)}
        </div>
      )}
    </div>
  );
}

// ═══════ タブD：フィードバック ═══════
function TabD({ username }) {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ mainPost: "", replyPost: "", score: "", grade: "", views: "", likes: "", comments: "", saves: "", hookType: "" });
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
      setFeedbacks(data.data || []);
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
        body: JSON.stringify({ username, mainPost: form.mainPost, replyPost: form.replyPost, score: form.score ? Number(form.score) : null, grade: form.grade, views: form.views ? Number(form.views) : null, likes: form.likes ? Number(form.likes) : null, comments: form.comments ? Number(form.comments) : null, saves: form.saves ? Number(form.saves) : null, hookType: form.hookType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm({ mainPost: "", replyPost: "", score: "", grade: "", views: "", likes: "", comments: "", saves: "", hookType: "" });
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
  const avgScore = feedbacks.length > 0 ? Math.round(feedbacks.filter(f => f.score).reduce((s, f) => s + (f.score || 0), 0) / (feedbacks.filter(f => f.score).length || 1)) : 0;

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
        <button onClick={() => setShowForm(true)} style={{ width: "100%", padding: 14, borderRadius: 10, border: "none", cursor: "pointer", background: "#2c425a", color: "#FFFFFF", fontSize: 15, fontWeight: 600, marginBottom: 20 }}>
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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div><label style={labelStyle}>バズスコア</label><input type="number" value={form.score} onChange={e => setForm({ ...form, score: e.target.value })} placeholder="82" style={inputStyle} /></div>
            <div><label style={labelStyle}>グレード</label><input type="text" value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })} placeholder="A" style={inputStyle} /></div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div><label style={labelStyle}>ビュー数</label><input type="number" value={form.views} onChange={e => setForm({ ...form, views: e.target.value })} placeholder="3200" style={inputStyle} /></div>
            <div><label style={labelStyle}>いいね数</label><input type="number" value={form.likes} onChange={e => setForm({ ...form, likes: e.target.value })} placeholder="45" style={inputStyle} /></div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div><label style={labelStyle}>コメント数</label><input type="number" value={form.comments} onChange={e => setForm({ ...form, comments: e.target.value })} placeholder="12" style={inputStyle} /></div>
            <div><label style={labelStyle}>保存数</label><input type="number" value={form.saves} onChange={e => setForm({ ...form, saves: e.target.value })} placeholder="8" style={inputStyle} /></div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>使ったフックの型</label>
            <select value={form.hookType} onChange={e => setForm({ ...form, hookType: e.target.value })} style={{ ...inputStyle, appearance: "auto" }}>
              <option value="">選択してください</option>
              <option value="驚き停止">①驚き停止型</option>
              <option value="警告・緊急">②警告・緊急型</option>
              <option value="断言">③断言型</option>
              <option value="本音・暴露">④本音・暴露型</option>
              <option value="驚き・感情共有">⑤驚き・感情共有型</option>
              <option value="共感呼びかけ">⑥共感呼びかけ型</option>
              <option value="問いかけ">⑦問いかけ型</option>
              <option value="告白・自己開示">⑧告白・自己開示型</option>
              <option value="ストーリーつなぎ">⑨ストーリーつなぎ型</option>
              <option value="限定・特別感">⑩限定・特別感型</option>
            </select>
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
          {fb.score && <span style={{ fontSize: 12, color: "#f07852" }}>スコア:{fb.score}</span>}
          {fb.views && <span style={{ fontSize: 12, color: "#2c425a" }}>👁{fb.views.toLocaleString()}</span>}
          {fb.likes && <span style={{ fontSize: 12, color: "#ef7c50" }}>♥{fb.likes}</span>}
          {fb.comments != null && fb.comments > 0 && <span style={{ fontSize: 12, color: "#83c2cb" }}>💬{fb.comments}</span>}
          {fb.saves != null && fb.saves > 0 && <span style={{ fontSize: 12, color: "#edbb3f" }}>🔖{fb.saves}</span>}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "0 14px 14px" }}>
          {/* 本投稿 */}
          <div style={{ background: "#FFFFFF", border: "1px solid #E5E5E5", borderRadius: 8, padding: 12, borderLeft: "3px solid #2c425a", marginBottom: fb.reply_post ? 8 : 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#1A1A1A", marginBottom: 6 }}>本投稿</div>
            <div style={{ fontSize: 14, color: "#333333", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{fb.main_post}</div>
          </div>
          {/* リプ */}
          {fb.reply_post && (
            <div style={{ marginLeft: 16, background: "#FFFFFF", border: "1px solid #E5E5E5", borderRadius: 8, padding: 12, borderLeft: "3px solid #83c2cb", marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#2c425a", marginBottom: 6 }}>└ リプ投稿</div>
              <div style={{ fontSize: 14, color: "#333333", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{fb.reply_post}</div>
            </div>
          )}
          {/* 詳細指標 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
            {[
              { label: "スコア", val: fb.score, color: "#f07852" },
              { label: "グレード", val: fb.grade, color: "#f0b83e" },
              { label: "ビュー", val: fb.views?.toLocaleString(), color: "#2c425a" },
              { label: "いいね", val: fb.likes, color: "#ef7c50" },
              { label: "コメント", val: fb.comments, color: "#83c2cb" },
              { label: "保存", val: fb.saves, color: "#edbb3f" },
            ].filter(x => x.val != null && x.val !== "").map((x, i) => (
              <div key={i} style={{ background: "#FFFFFF", borderRadius: 6, padding: 8, textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#888888" }}>{x.label}</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: x.color }}>{x.val}</div>
              </div>
            ))}
          </div>
          {fb.hook_type && <div style={{ fontSize: 12, color: "#666666", marginBottom: 12 }}>フック型: {fb.hook_type}</div>}
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

// ═══════ メイン ═══════
const TABS = [{ id: "A", label: "バズスコア採点" }, { id: "B1", label: "誘導投稿" }, { id: "B2", label: "ゴースト投稿" }, { id: "D", label: "フィードバック" }];

export default function Home() {
  const [authed, setAuthed] = useState(false);
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
  const toast = useToast();

  useEffect(() => { setDrafts(lsGet(DRAFTS_KEY) || []); setStyleProfile(lsGet(STYLE_KEY)); }, []);

  const persistDrafts = (next) => { setDrafts(next); lsSet(DRAFTS_KEY, next); };
  const handleSaveDraft = (mainPost, reply) => { if (!mainPost?.trim()) return; setSaveDialog({ mainPost, reply: reply || "", defaultTitle: mainPost.slice(0, 20) }); };
  const confirmSave = (title) => {
    if (!saveDialog) return;
    const now = new Date().toISOString();
    const existing = draftEdit ? drafts.find(d => d.id === draftEdit.id) : null;
    let next;
    if (existing) { next = drafts.map(d => d.id === existing.id ? { ...d, title: title || d.title, mainPost: saveDialog.mainPost, reply: saveDialog.reply, updatedAt: now } : d); }
    else { next = [{ id: genId(), title: title || saveDialog.defaultTitle, mainPost: saveDialog.mainPost, reply: saveDialog.reply, createdAt: now, updatedAt: now, status: "draft" }, ...drafts]; }
    persistDrafts(next); setSaveDialog(null); setDraftEdit(null); toast.show("下書きを保存しました");
  };
  const handleDelete = (id) => { persistDrafts(drafts.filter(d => d.id !== id)); toast.show("削除しました"); };
  const handleMarkPosted = (id) => { persistDrafts(drafts.map(d => d.id === id ? { ...d, status: "posted", updatedAt: new Date().toISOString() } : d)); toast.show("投稿済みにしました"); };
  const handleEdit = (draft) => { setDraftEdit(draft); setTab("A"); setScreen("main"); };
  const handleStyleComplete = (s) => { setStyleProfile(s); setShowStyleDialog(false); toast.show("文体を学習しました"); };
  const draftCount = drafts.filter(d => d.status === "draft").length;

  const [authMode, setAuthMode] = useState("login"); // "login" or "register"
  const [authLoading, setAuthLoading] = useState(false);

  const doAuth = async () => {
    if (!username.trim()) { setPwErr("ユーザー名を入力してください"); return; }
    if (!pw.trim()) { setPwErr("パスワードを入力してください"); return; }
    setAuthLoading(true); setPwErr("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: authMode, username: username.trim(), password: pw.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setPwErr(data.error); return; }
      setUsername(data.username);
      setAuthed(true);
    } catch (e) { setPwErr("通信エラーが発生しました"); } finally { setAuthLoading(false); }
  };

  if (!authed) {
    return (
      <div style={{ minHeight: "100vh", background: "#FFFFFF", color: "#1A1A1A", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Hiragino Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowX: "hidden", width: "100%", maxWidth: "100vw" }}>
        <div style={{ width: "100%", maxWidth: 360, textAlign: "center" }}>
          <div style={{ fontSize: 12, letterSpacing: 4, color: "#666666", textTransform: "uppercase", marginBottom: 6 }}>Threads Tool</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 24px", background: "linear-gradient(135deg, #2c425a, #83c2cb)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Threads投稿エンジン</h1>

          {/* ログイン/新規登録 切り替え */}
          <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#FAFAFA", borderRadius: 10, padding: 4 }}>
            <button onClick={() => { setAuthMode("login"); setPwErr(""); }} style={{ flex: 1, padding: "10px 8px", borderRadius: 8, border: "none", cursor: "pointer", background: authMode === "login" ? "#2c425a" : "transparent", color: authMode === "login" ? "#FFFFFF" : "#777777", fontSize: 13, fontWeight: 600 }}>ログイン</button>
            <button onClick={() => { setAuthMode("register"); setPwErr(""); }} style={{ flex: 1, padding: "10px 8px", borderRadius: 8, border: "none", cursor: "pointer", background: authMode === "register" ? "#2c425a" : "transparent", color: authMode === "register" ? "#FFFFFF" : "#777777", fontSize: 13, fontWeight: 600 }}>新規登録</button>
          </div>

          <input type="text" value={username} onChange={e => { setUsername(e.target.value); setPwErr(""); }}
            placeholder="ユーザー名" style={{ width: "100%", boxSizing: "border-box", padding: "14px 16px", background: "#FAFAFA", border: `1px solid ${pwErr ? "#DC3545" : "#E5E5E5"}`, borderRadius: 10, color: "#1A1A1A", fontSize: 15, outline: "none", fontFamily: "inherit", marginBottom: 12 }} />
          <input type="password" value={pw} onChange={e => { setPw(e.target.value); setPwErr(""); }}
            onKeyDown={e => { if (e.key === "Enter") doAuth(); }}
            placeholder="パスワード" style={{ width: "100%", boxSizing: "border-box", padding: "14px 16px", background: "#FAFAFA", border: `1px solid ${pwErr ? "#DC3545" : "#E5E5E5"}`, borderRadius: 10, color: "#1A1A1A", fontSize: 15, outline: "none", fontFamily: "inherit", marginBottom: 12 }} />

          {authMode === "register" && (
            <div style={{ fontSize: 12, color: "#888888", marginBottom: 12, lineHeight: 1.5, textAlign: "left" }}>
              ・ユーザー名：2〜20文字（後から変更不可）<br/>
              ・パスワード：4文字以上
            </div>
          )}

          <button onClick={doAuth} disabled={authLoading}
            style={{ width: "100%", padding: 14, borderRadius: 10, border: "none", cursor: authLoading ? "wait" : "pointer", background: authLoading ? "#E5E5E5" : "#F5F5F5", color: "#000000", fontSize: 15, fontWeight: 600 }}>
            {authLoading ? "処理中..." : authMode === "login" ? "ログイン" : "アカウントを作成"}
          </button>
          {pwErr && <div style={{ marginTop: 12, fontSize: 13, color: "#DC3545" }}>{pwErr}</div>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#FFFFFF", color: "#1A1A1A", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Hiragino Sans', sans-serif", padding: "32px 16px", overflowX: "hidden", width: "100%", maxWidth: "100vw" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ marginBottom: 24, textAlign: "center" }}>
          <div style={{ fontSize: 12, letterSpacing: 4, color: "#666666", textTransform: "uppercase", marginBottom: 6 }}>Threads Tool</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, background: "linear-gradient(135deg, #2c425a, #83c2cb)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Threads投稿エンジン</h1>
        </div>
        {screen === "drafts" ? (
          <DraftsScreen drafts={drafts} onBack={() => setScreen("main")} onEdit={handleEdit} onDelete={handleDelete} onMarkPosted={handleMarkPosted} statusFilter={draftsFilter} />
        ) : (
          <>
            <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "#FAFAFA", borderRadius: 10, padding: 4 }}>
              {TABS.map(t => <button key={t.id} onClick={() => { setTab(t.id); setDraftEdit(null); }} style={{ flex: 1, padding: "10px 8px", borderRadius: 8, border: "none", cursor: "pointer", background: tab === t.id ? "#2c425a" : "transparent", color: tab === t.id ? "#FFFFFF" : "#777777", fontSize: 12, fontWeight: 600 }}>{t.label}</button>)}
            </div>
            <button onClick={() => { setDraftsFilter("draft"); setScreen("drafts"); }} style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #83c2cb", background: "rgba(131,194,203,0.06)", color: "#2c425a", fontSize: 13, fontWeight: 500, cursor: "pointer", marginBottom: 20 }}>
              下書き一覧{draftCount > 0 ? `（${draftCount}件）` : ""}
            </button>
            {tab === "A" && <TabA onSaveDraft={handleSaveDraft} draftEdit={draftEdit} styleProfile={styleProfile} onStyleChange={() => setShowStyleDialog(true)} />}
            {tab === "B1" && <TabB1 onSaveDraft={handleSaveDraft} styleProfile={styleProfile} />}
            {tab === "B2" && <TabB2 onSaveDraft={handleSaveDraft} styleProfile={styleProfile} />}
            {tab === "D" && <TabD username={username} />}
          </>
        )}
      </div>
      {saveDialog && <SaveDialog defaultTitle={saveDialog.defaultTitle} onSave={confirmSave} onClose={() => setSaveDialog(null)} />}
      {showStyleDialog && <StyleLearningDialog onComplete={handleStyleComplete} onClose={() => setShowStyleDialog(false)} />}
      {toast.Toast}
    </div>
  );
}
