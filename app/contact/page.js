"use client";
import { useState } from "react";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", category: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setSending(true); setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSent(true);
    } catch (e) { setError(e.message); } finally { setSending(false); }
  };

  const s = { maxWidth: 480, margin: "0 auto", padding: "40px 20px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Hiragino Sans', sans-serif", color: "#1A1A1A" };
  const inputSt = { width: "100%", boxSizing: "border-box", padding: "12px 14px", background: "#FAFAFA", border: "1px solid #E5E5E5", borderRadius: 8, color: "#1A1A1A", fontSize: 14, outline: "none", fontFamily: "inherit", marginBottom: 16 };
  const labelSt = { fontSize: 12, color: "#666", marginBottom: 4, display: "block" };

  if (sent) {
    return (
      <div style={s}>
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#1A1A1A", marginBottom: 12 }}>お問い合わせを受け付けました</div>
          <div style={{ fontSize: 14, color: "#666", lineHeight: 1.8, marginBottom: 24 }}>
            いただいたお問い合わせには、近日中に回答差し上げます。<br />
            しばらくお待ちくださいませ。
          </div>
          <a href="/" style={{ display: "inline-block", padding: "12px 32px", background: "#0a0a0a", color: "#fff", borderRadius: 8, textDecoration: "none", fontSize: 14, fontWeight: 600 }}>トップに戻る</a>
        </div>
        <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid #E5E5E5", display: "flex", justifyContent: "center", gap: 16, fontSize: 12 }}>
          <a href="/privacy" style={{ color: "#888", textDecoration: "none" }}>プライバシーポリシー</a>
          <a href="/terms" style={{ color: "#888", textDecoration: "none" }}>利用規約</a>
        </div>
      </div>
    );
  }

  return (
    <div style={s}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <a href="/"><img src="/logo.png" alt="キニナルメーカー" style={{ maxWidth: 160, width: "100%", height: "auto", marginBottom: 16 }} /></a>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1A1A1A" }}>お問い合わせ</div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelSt}>お名前 <span style={{ color: "#DC3545" }}>*</span></label>
        <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="山田 太郎" style={inputSt} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelSt}>メールアドレス <span style={{ color: "#DC3545" }}>*</span></label>
        <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" style={inputSt} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelSt}>カテゴリ</label>
        <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={{ ...inputSt, appearance: "auto" }}>
          <option value="">選択してください</option>
          <option value="サービスについて">サービスについて</option>
          <option value="アカウントについて">アカウントについて</option>
          <option value="お支払いについて">お支払いについて</option>
          <option value="不具合の報告">不具合の報告</option>
          <option value="機能のご要望">機能のご要望</option>
          <option value="その他">その他</option>
        </select>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelSt}>お問い合わせ内容 <span style={{ color: "#DC3545" }}>*</span></label>
        <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} rows={6} placeholder="お問い合わせ内容をご記入ください" style={{ ...inputSt, resize: "vertical" }} />
      </div>

      {error && <div style={{ marginBottom: 16, padding: 12, background: "rgba(220,53,69,.06)", borderRadius: 8, color: "#DC3545", fontSize: 13 }}>{error}</div>}

      <button onClick={handleSubmit} disabled={sending || !form.name.trim() || !form.email.trim() || !form.message.trim()}
        style={{ width: "100%", padding: 14, borderRadius: 10, border: "none", cursor: sending ? "wait" : "pointer", background: (!form.name.trim() || !form.email.trim() || !form.message.trim()) ? "#E5E5E5" : "#0a0a0a", color: "#FFFFFF", fontSize: 15, fontWeight: 600, opacity: (!form.name.trim() || !form.email.trim() || !form.message.trim()) ? 0.4 : 1 }}>
        {sending ? "送信中..." : "送信する"}
      </button>

      <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid #E5E5E5", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <a href="/" style={{ fontSize: 13, color: "#888", textDecoration: "none" }}>← トップに戻る</a>
        <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
          <a href="/privacy" style={{ color: "#888", textDecoration: "none" }}>プライバシーポリシー</a>
          <a href="/terms" style={{ color: "#888", textDecoration: "none" }}>利用規約</a>
        </div>
      </div>
    </div>
  );
}
