"use client";
export default function Legal() {
  const s = { maxWidth: 640, margin: "0 auto", padding: "40px 20px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Hiragino Sans', sans-serif", color: "#1A1A1A", lineHeight: 1.9 };
  const h1 = { fontSize: 22, fontWeight: 700, marginBottom: 24 };
  const row = { display: "flex", borderBottom: "1px solid #E5E5E5", padding: "14px 0" };
  const th = { width: 140, fontSize: 13, color: "#888", flexShrink: 0 };
  const td = { fontSize: 14, color: "#444", flex: 1 };

  return (
    <div style={s}>
      <h1 style={h1}>特定商取引法に基づく表記</h1>

      <div style={row}><div style={th}>事業者名</div><div style={td}>株式会社FutabaUnited</div></div>
      <div style={row}><div style={th}>所在地</div><div style={td}>〒814-0001<br />福岡市早良区百道浜3－3－7　5F</div></div>
      <div style={row}><div style={th}>連絡先</div><div style={td}>info@futabaunited.com</div></div>
      <div style={row}><div style={th}>販売価格</div><div style={td}>月額1,980円（税込）<br />追加クレジット：100回分 1,200円 / 200回分 2,200円 / 300回分 3,000円（いずれも税込）</div></div>
      <div style={row}><div style={th}>支払方法</div><div style={td}>クレジットカード（Stripe決済）</div></div>
      <div style={row}><div style={th}>支払時期</div><div style={td}>サブスクリプション：登録時に初回決済、以降毎月自動決済<br />追加クレジット：購入時に即時決済</div></div>
      <div style={row}><div style={th}>サービス提供時期</div><div style={td}>決済完了後、即時利用可能</div></div>
      <div style={row}><div style={th}>返品・キャンセル</div><div style={td}>デジタルサービスの性質上、サービス提供後の返品はお受けできません。サブスクリプションはいつでも解約可能です。詳細は<a href="/refund" style={{ color: "#0a0a0a", textDecoration: "underline" }}>返金ポリシー</a>をご確認ください。</div></div>
      <div style={row}><div style={th}>動作環境</div><div style={td}>インターネット接続環境および最新のWebブラウザ（Chrome、Safari、Edge等）</div></div>
      <div style={{ ...row, borderBottom: "none" }}><div style={th}>サービス名</div><div style={td}>キニナルメーカー（https://notti.jp）</div></div>

      <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid #E5E5E5", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <a href="/" style={{ fontSize: 13, color: "#888", textDecoration: "none" }}>← トップに戻る</a>
        <div style={{ display: "flex", gap: 16, fontSize: 12, flexWrap: "wrap" }}>
          <a href="/privacy" style={{ color: "#888", textDecoration: "none" }}>プライバシーポリシー</a>
          <a href="/terms" style={{ color: "#888", textDecoration: "none" }}>利用規約</a>
          <a href="/refund" style={{ color: "#888", textDecoration: "none" }}>返金ポリシー</a>
          <span style={{ color: "#555" }}>特定商取引法</span>
          <a href="/contact" style={{ color: "#888", textDecoration: "none" }}>お問い合わせ</a>
        </div>
      </div>
    </div>
  );
}
