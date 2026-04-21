"use client";
// Version: v2.3.2-CopyButton - 2026-04-19 - A/B1/B2/Drafts (Vercel版)
import { useState, useEffect, useRef, useCallback } from "react";

// ═══════ Storage ═══════
const STORAGE_KEY = "threads-drafts";
async function loadDraftsStorage() {
  try { const r = JSON.parse(window.localStorage?.getItem(STORAGE_KEY) || "[]"); return r; } catch { return []; }
}
async function saveDraftsStorage(drafts) {
  try { window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(drafts)); return true; } catch { return false; }
}
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// ═══════ Toast ═══════
function useToast() {
  const [msg, setMsg] = useState(null);
  const t = useRef(null);
  const show = useCallback((text, dur = 2500) => { setMsg(text); clearTimeout(t.current); t.current = setTimeout(() => setMsg(null), dur); }, []);
  const Toast = msg ? <div style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", background: "#27272a", color: "#e4e4e7", padding: "12px 24px", borderRadius: 10, fontSize: 14, fontWeight: 500, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,.5)" }}>{msg}</div> : null;
  return { show, Toast };
}

// ═══════ 定数 ═══════
const LABELS = { hook: "フック力", empathy: "共感・議論性", structure: "構成・読みやすさ", shareability: "拡散性", culture_fit: "Threads文化適合" };
const GC = { S: "#e11d48", A: "#f59e0b", B: "#3b82f6", C: "#6b7280", D: "#9ca3af" };
const GB = { S: "rgba(225,29,72,.12)", A: "rgba(245,158,11,.12)", B: "rgba(59,130,246,.12)", C: "rgba(107,114,128,.12)", D: "rgba(156,163,175,.12)" };

// ═══════ 共通UIパーツ ═══════
const Radio = ({ options, value, onChange }) => (
  <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
    {options.map(o => (
      <label key={o.value} onClick={() => onChange(o.value)} style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: value === o.value ? "#1e1e24" : "#14141a", border: `1px solid ${value === o.value ? "#3f3f46" : "#27272a"}`, borderRadius: 8, cursor: "pointer" }}>
        <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${value === o.value ? "#e4e4e7" : "#52525b"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {value === o.value && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#e4e4e7" }} />}
        </div>
        <span style={{ fontSize: 13, color: value === o.value ? "#e4e4e7" : "#71717a" }}>{o.label}</span>
      </label>
    ))}
  </div>
);
const Btn = ({ onClick, loading, disabled, label, bg, color: c }) => (
  <button onClick={onClick} disabled={loading || disabled} style={{ width: "100%", padding: 14, borderRadius: 10, border: "none", cursor: loading ? "wait" : "pointer", background: loading ? "#27272a" : (bg || "#e4e4e7"), color: c || "#0a0a0a", fontSize: 15, fontWeight: 600, opacity: disabled ? 0.4 : 1, marginBottom: 8 }}>{loading ? "生成中..." : label}</button>
);
const Err = ({ msg }) => msg ? <div style={{ marginTop: 16, padding: 12, background: "rgba(239,68,68,.1)", borderRadius: 8, color: "#ef4444", fontSize: 13 }}>{msg}</div> : null;
const Upload = ({ file, onChange }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "20px 16px", background: "#18181b", border: "2px dashed #27272a", borderRadius: 12, cursor: "pointer" }}>
      <input type="file" accept=".txt,.docx,.doc,.pdf" onChange={e => onChange(e.target.files?.[0] || null)} style={{ display: "none" }} />
      <span style={{ fontSize: 14, color: file ? "#e4e4e7" : "#52525b" }}>{file ? file.name : "記事ファイルをアップロード（.txt .docx .pdf）"}</span>
    </label>
  </div>
);

// ═══════ コピーボタン ═══════
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} };
  return <button onClick={copy} style={{ fontSize: 11, padding: "3px 10px", background: copied ? "#22c55e22" : "#1e1e24", border: `1px solid ${copied ? "#22c55e44" : "#3f3f46"}`, borderRadius: 6, color: copied ? "#22c55e" : "#a1a1aa", cursor: "pointer", whiteSpace: "nowrap", transition: "all .15s" }}>{copied ? "コピー済" : "コピー"}</button>;
}

const Card = ({ index, main, reply, onSave }) => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#71717a" }}>案 {index}</div>
      {onSave && <button onClick={() => onSave(main, reply)} style={{ fontSize: 11, padding: "4px 10px", background: "#1e1e24", border: "1px solid #3f3f46", borderRadius: 6, color: "#a1a1aa", cursor: "pointer" }}>下書き保存</button>}
    </div>
    {main && <div style={{ background: "#14141a", border: "1px solid #1e1e24", borderRadius: 10, padding: 14, borderLeft: "3px solid #e4e4e7", marginBottom: reply ? 8 : 0 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}><div style={{ fontSize: 11, fontWeight: 600, color: "#e4e4e7" }}>本投稿</div><CopyBtn text={main} /></div><div style={{ fontSize: 14, color: "#d4d4d8", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{main}</div></div>}
    {reply && <div style={{ marginLeft: 16, background: "#14141a", border: "1px solid #1e1e24", borderRadius: 10, padding: 14, borderLeft: "3px solid #3b82f6" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}><div style={{ fontSize: 11, fontWeight: 600, color: "#3b82f6" }}>└ リプ投稿</div><CopyBtn text={reply} /></div><div style={{ fontSize: 14, color: "#d4d4d8", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{reply}</div></div>}
  </div>
);
const HookToggle = ({ value, onChange }) => (
  <div onClick={() => onChange(!value)} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 14px", background: "#14141a", border: `1px solid ${value ? "#f59e0b44" : "#27272a"}`, borderRadius: 8, cursor: "pointer" }}>
    <div style={{ width: 40, height: 22, borderRadius: 11, background: value ? "#f59e0b" : "#27272a", position: "relative", transition: "background .2s" }}>
      <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: value ? 20 : 2, transition: "left .2s" }} />
    </div>
    <span style={{ fontSize: 13, color: value ? "#f59e0b" : "#71717a", fontWeight: 600 }}>ずるい一言をつける</span>
  </div>
);
const HooksDisplay = ({ hooks }) => {
  if (!hooks) return null;
  return (
    <div style={{ background: "#1a1a10", border: "1px solid #f59e0b33", borderRadius: 10, padding: 16, marginTop: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#f59e0b", marginBottom: 10 }}>ずるい一言の候補</div>
      {hooks.split("\n").filter(l => l.trim()).map((line, i) => <div key={i} style={{ fontSize: 14, color: "#e4e4e7", padding: "8px 0", borderTop: i ? "1px solid #f59e0b22" : "none" }}>{line}</div>)}
    </div>
  );
};

// ═══════ 下書き保存ダイアログ ═══════
function SaveDialog({ defaultTitle, onSave, onClose }) {
  const [title, setTitle] = useState(defaultTitle);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9998, padding: 16 }}>
      <div style={{ background: "#18181b", borderRadius: 14, padding: 24, width: "100%", maxWidth: 360 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#e4e4e7", marginBottom: 16 }}>下書きを保存</div>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="タイトル（任意）" style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", background: "#0a0a0a", border: "1px solid #27272a", borderRadius: 8, color: "#e4e4e7", fontSize: 14, outline: "none", marginBottom: 16, fontFamily: "inherit" }} />
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 8, border: "1px solid #27272a", background: "transparent", color: "#71717a", fontSize: 14, cursor: "pointer" }}>キャンセル</button>
          <button onClick={() => onSave(title)} style={{ flex: 1, padding: 12, borderRadius: 8, border: "none", background: "#e4e4e7", color: "#0a0a0a", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>保存</button>
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
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#71717a", fontSize: 14, cursor: "pointer", marginBottom: 16, padding: 0 }}>← 戻る</button>
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#14141a", borderRadius: 10, padding: 4 }}>
        {[{ id: "draft", label: "下書き" }, { id: "posted", label: "投稿済み" }].map(t => (
          <button key={t.id} onClick={() => setFilter(t.id)} style={{ flex: 1, padding: "10px 8px", borderRadius: 8, border: "none", cursor: "pointer", background: filter === t.id ? "#27272a" : "transparent", color: filter === t.id ? "#e4e4e7" : "#71717a", fontSize: 13, fontWeight: 600 }}>{t.label}</button>
        ))}
      </div>
      {filtered.length === 0 && <div style={{ textAlign: "center", color: "#52525b", fontSize: 14, padding: 40 }}>{filter === "draft" ? "下書きはありません" : "投稿履歴はありません"}</div>}
      {filtered.map(d => {
        const isOpen = expandedId === d.id;
        return (
          <div key={d.id} style={{ background: "#14141a", border: "1px solid #1e1e24", borderRadius: 10, marginBottom: 12, overflow: "hidden" }}>
            <div onClick={() => setExpandedId(isOpen ? null : d.id)} style={{ padding: 14, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#e4e4e7", marginBottom: 4 }}>{d.title}{d.reply && <span style={{ fontSize: 11, color: "#3b82f6", marginLeft: 6 }}>+リプ</span>}</div>
                  <div style={{ fontSize: 11, color: "#52525b" }}>{new Date(d.updatedAt).toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                </div>
                <span style={{ fontSize: 12, color: "#52525b", marginLeft: 8 }}>{isOpen ? "▲" : "▼"}</span>
              </div>
              {!isOpen && <div style={{ fontSize: 13, color: "#71717a", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{d.mainPost}</div>}
            </div>
            {isOpen && (
              <div style={{ padding: "0 14px 14px" }}>
                <div style={{ background: "#0a0a0a", border: "1px solid #1e1e24", borderRadius: 8, padding: 12, borderLeft: "3px solid #e4e4e7", marginBottom: d.reply ? 8 : 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}><div style={{ fontSize: 11, fontWeight: 600, color: "#e4e4e7", letterSpacing: 1 }}>本投稿</div><CopyBtn text={d.mainPost} /></div>
                  <div style={{ fontSize: 14, color: "#d4d4d8", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{d.mainPost}</div>
                </div>
                {d.reply && (
                  <div style={{ marginLeft: 16, background: "#0a0a0a", border: "1px solid #1e1e24", borderRadius: 8, padding: 12, borderLeft: "3px solid #3b82f6", marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}><div style={{ fontSize: 11, fontWeight: 600, color: "#3b82f6", letterSpacing: 1 }}>└ リプ投稿</div><CopyBtn text={d.reply} /></div>
                    <div style={{ fontSize: 14, color: "#d4d4d8", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{d.reply}</div>
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  {filter === "draft" && <>
                    <button onClick={() => onEdit(d)} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #3f3f46", background: "transparent", color: "#e4e4e7", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>編集</button>
                    <button onClick={() => onMarkPosted(d.id)} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #22c55e44", background: "transparent", color: "#22c55e", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>投稿済みにする</button>
                  </>}
                  {confirmId === d.id ? (
                    <div style={{ display: "flex", gap: 6, flex: 1 }}>
                      <button onClick={() => { onDelete(d.id); setConfirmId(null); }} style={{ flex: 1, padding: 10, borderRadius: 8, border: "none", background: "#ef4444", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>削除する</button>
                      <button onClick={() => setConfirmId(null)} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #27272a", background: "transparent", color: "#71717a", fontSize: 12, cursor: "pointer" }}>やめる</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmId(d.id)} style={{ padding: 10, borderRadius: 8, border: "1px solid #ef444444", background: "transparent", color: "#ef4444", fontSize: 12, cursor: "pointer" }}>削除</button>
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
function TabA({ onSaveDraft, draftEdit }) {
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
      const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, mode, useHook }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error); setResult(data);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };
  return (
    <div>
      <div style={{ position: "relative", marginBottom: 16 }}>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Threadsの投稿文をここに入力..." rows={6} style={{ width: "100%", boxSizing: "border-box", background: "#18181b", border: "1px solid #27272a", borderRadius: 12, padding: 16, color: "#e4e4e7", fontSize: 15, lineHeight: 1.7, resize: "vertical", outline: "none", fontFamily: "inherit" }} />
        <div style={{ position: "absolute", bottom: 12, right: 14, fontSize: 12, color: text.length > 500 ? "#ef4444" : "#52525b" }}>{text.length}</div>
      </div>
      <Radio options={[{ value: "single", label: "本投稿のみ" }, { value: "tree", label: "本投稿＋リプ" }]} value={mode} onChange={setMode} />
      <HookToggle value={useHook} onChange={setUseHook} />
      <Btn onClick={run} loading={loading} disabled={!text.trim()} label="採点する" />
      {text.trim() && <Btn onClick={() => onSaveDraft(text, "")} label="下書き保存" bg="#1e1e24" color="#a1a1aa" />}
      <Err msg={error} />
      {result && (
        <div style={{ marginTop: 28 }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 80, height: 80, borderRadius: "50%", fontSize: 36, fontWeight: 800, color: GC[result.grade] || "#fff", background: GB[result.grade] || "rgba(255,255,255,.08)", border: `2px solid ${GC[result.grade] || "#555"}` }}>{result.grade}</div>
            <div style={{ marginTop: 10, fontSize: 22, fontWeight: 700 }}>{result.total}<span style={{ fontSize: 14, color: "#71717a" }}> / 100</span></div>
            <div style={{ marginTop: 6, fontSize: 14, color: "#a1a1aa" }}>{result.verdict}</div>
          </div>
          {result.hooks && <HooksDisplay hooks={result.hooks} />}
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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}><div style={{ fontSize: 11, fontWeight: 600, color: p.c }}>{p.label}</div><CopyBtn text={p.text} /></div>
                  <div style={{ fontSize: 14, color: "#d4d4d8", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{p.text}</div>
                </div>
              ))}
              <Btn onClick={() => onSaveDraft(result.rewrite.main, result.rewrite.reply || "")} label="改善版を下書き保存" bg="#1e1e24" color="#a1a1aa" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════ タブB1 ═══════
function TabB1({ onSaveDraft }) {
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState("tree");
  const [useHook, setUseHook] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const run = async () => {
    if (!file) return; setLoading(true); setError(""); setResult(null);
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("type", "b1"); fd.append("mode", mode); fd.append("useHook", String(useHook));
      const res = await fetch("/api/generate", { method: "POST", body: fd });
      const data = await res.json(); if (!res.ok) throw new Error(data.error); setResult(data);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };
  return (
    <div>
      <Upload file={file} onChange={setFile} />
      <Radio options={[{ value: "single", label: "本投稿のみ" }, { value: "tree", label: "本投稿＋リプ" }]} value={mode} onChange={setMode} />
      <HookToggle value={useHook} onChange={setUseHook} />
      <Btn onClick={run} loading={loading} disabled={!file} label="誘導投稿を生成（5案）" />
      <Err msg={error} />
      {result && (
        <div style={{ marginTop: 24 }}>
          {result.analysis && <div style={{ background: "#14141a", border: "1px solid #1e1e24", borderRadius: 10, padding: 16, marginBottom: 20 }}><div style={{ fontSize: 13, fontWeight: 600, color: "#a1a1aa", marginBottom: 10 }}>記事分析</div><div style={{ fontSize: 13, color: "#d4d4d8", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{result.analysis}</div></div>}
          <div style={{ fontSize: 13, fontWeight: 600, color: "#a1a1aa", marginBottom: 12 }}>生成結果（5案）</div>
          {result.posts.map((p, i) => <Card key={i} index={i+1} main={p.main} reply={p.reply} onSave={onSaveDraft} />)}
        </div>
      )}
    </div>
  );
}

// ═══════ タブB2 ═══════
function TabB2({ onSaveDraft }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const run = async () => {
    if (!file) return; setLoading(true); setError(""); setResult(null);
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("type", "b2"); fd.append("mode", "single");
      const res = await fetch("/api/generate", { method: "POST", body: fd });
      const data = await res.json(); if (!res.ok) throw new Error(data.error); setResult(data);
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
          {result.posts.map((p, i) => <Card key={i} index={i+1} main={p.main} reply="" onSave={(m) => onSaveDraft(m, "")} />)}
        </div>
      )}
    </div>
  );
}

// ═══════ メインアプリ ═══════
const TABS = [{ id: "A", label: "バズスコア採点" }, { id: "B1", label: "誘導投稿" }, { id: "B2", label: "ゴースト投稿" }];

export default function Home() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [tab, setTab] = useState("A");
  const [screen, setScreen] = useState("main");
  const [drafts, setDrafts] = useState([]);
  const [saveDialog, setSaveDialog] = useState(null);
  const [draftEdit, setDraftEdit] = useState(null);
  const [draftsFilter, setDraftsFilter] = useState("draft");
  const toast = useToast();

  useEffect(() => { loadDraftsStorage().then(setDrafts); }, []);

  const persistDrafts = async (next) => { setDrafts(next); await saveDraftsStorage(next); };

  const handleSaveDraft = (mainPost, reply) => {
    setSaveDialog({ mainPost, reply: reply || "", defaultTitle: mainPost.slice(0, 20) });
  };
  const confirmSave = async (title) => {
    if (!saveDialog) return;
    const now = new Date().toISOString();
    const existing = draftEdit ? drafts.find(d => d.id === draftEdit.id) : null;
    let next;
    if (existing) {
      next = drafts.map(d => d.id === existing.id ? { ...d, title: title || d.title, mainPost: saveDialog.mainPost, reply: saveDialog.reply, updatedAt: now } : d);
    } else {
      next = [{ id: genId(), title: title || saveDialog.defaultTitle, mainPost: saveDialog.mainPost, reply: saveDialog.reply, createdAt: now, updatedAt: now, status: "draft" }, ...drafts];
    }
    await persistDrafts(next);
    setSaveDialog(null); setDraftEdit(null);
    toast.show("下書きを保存しました");
  };
  const handleDelete = async (id) => { await persistDrafts(drafts.filter(d => d.id !== id)); toast.show("削除しました"); };
  const handleMarkPosted = async (id) => { await persistDrafts(drafts.map(d => d.id === id ? { ...d, status: "posted", updatedAt: new Date().toISOString() } : d)); toast.show("投稿済みにしました"); };
  const handleEdit = (draft) => { setDraftEdit(draft); setTab("A"); setScreen("main"); };

  const draftCount = drafts.filter(d => d.status === "draft").length;

  if (!authed) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e4e4e7", fontFamily: "'Helvetica Neue', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div style={{ width: "100%", maxWidth: 360, textAlign: "center" }}>
          <div style={{ fontSize: 12, letterSpacing: 4, color: "#71717a", textTransform: "uppercase", marginBottom: 6 }}>Threads Tool</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 32px", background: "linear-gradient(135deg, #e4e4e7, #a1a1aa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Threads投稿エンジン</h1>
          <input type="password" value={pw} onChange={e => { setPw(e.target.value); setPwErr(""); }}
            onKeyDown={e => { if (e.key === "Enter") { if (pw === "notti") setAuthed(true); else setPwErr("パスワードが違います"); } }}
            placeholder="パスワードを入力" style={{ width: "100%", boxSizing: "border-box", padding: "14px 16px", background: "#18181b", border: `1px solid ${pwErr ? "#ef4444" : "#27272a"}`, borderRadius: 10, color: "#e4e4e7", fontSize: 15, outline: "none", fontFamily: "inherit", marginBottom: 12 }} />
          <button onClick={() => { if (pw === "notti") setAuthed(true); else setPwErr("パスワードが違います"); }}
            style={{ width: "100%", padding: 14, borderRadius: 10, border: "none", cursor: "pointer", background: "#e4e4e7", color: "#0a0a0a", fontSize: 15, fontWeight: 600 }}>ログイン</button>
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
        {screen === "drafts" ? (
          <DraftsScreen drafts={drafts} onBack={() => setScreen("main")} onEdit={handleEdit} onDelete={handleDelete} onMarkPosted={handleMarkPosted} statusFilter={draftsFilter} />
        ) : (
          <>
            <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "#14141a", borderRadius: 10, padding: 4 }}>
              {TABS.map(t => <button key={t.id} onClick={() => { setTab(t.id); setDraftEdit(null); }} style={{ flex: 1, padding: "10px 8px", borderRadius: 8, border: "none", cursor: "pointer", background: tab === t.id ? "#27272a" : "transparent", color: tab === t.id ? "#e4e4e7" : "#71717a", fontSize: 12, fontWeight: 600 }}>{t.label}</button>)}
            </div>
            <button onClick={() => { setDraftsFilter("draft"); setScreen("drafts"); }} style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #27272a", background: "transparent", color: "#71717a", fontSize: 13, cursor: "pointer", marginBottom: 20 }}>
              下書き一覧{draftCount > 0 ? `（${draftCount}件）` : ""}
            </button>
            {tab === "A" && <TabA onSaveDraft={handleSaveDraft} draftEdit={draftEdit} />}
            {tab === "B1" && <TabB1 onSaveDraft={handleSaveDraft} />}
            {tab === "B2" && <TabB2 onSaveDraft={handleSaveDraft} />}
          </>
        )}
      </div>
      {saveDialog && <SaveDialog defaultTitle={saveDialog.defaultTitle} onSave={confirmSave} onClose={() => setSaveDialog(null)} />}
      {toast.Toast}
    </div>
  );
}
