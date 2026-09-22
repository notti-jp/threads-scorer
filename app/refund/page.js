"use client";
export default function Refund() {
  const s = { maxWidth: 640, margin: "0 auto", padding: "40px 20px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Hiragino Sans', sans-serif", color: "#1A1A1A", lineHeight: 1.9 };
  const h1 = { fontSize: 22, fontWeight: 700, marginBottom: 8 };
  const h2 = { fontSize: 16, fontWeight: 700, marginTop: 32, marginBottom: 8, borderBottom: "1px solid #E5E5E5", paddingBottom: 8 };
  const p = { fontSize: 14, color: "#444", marginBottom: 16 };
  const ul = { fontSize: 14, color: "#444", paddingLeft: 20, marginBottom: 16 };
  const date = { fontSize: 12, color: "#888", marginBottom: 24 };

  return (
    <div style={s}>
      <h1 style={h1}>返金ポリシー</h1>
      <p style={date}>最終更新日：2025年5月7日</p>

      <p style={p}>キニナルメーカー（以下「本サービス」）の返金ポリシーについて、以下の通り定めます。</p>

      <h2 style={h2}>1. サブスクリプション（月額プラン）の返金</h2>
      <ul style={ul}>
        <li>サブスクリプションはいつでも解約が可能です。</li>
        <li>返金をご希望の場合は、お問い合わせフォームまたはメール（info@futabaunited.com）にてご連絡ください。</li>
        <li>返金依頼を受領した日から14日以内に、キャンセル処理および返金手続きを行います。</li>
        <li>返金はお支払い時に利用されたクレジットカードへの返金となります。</li>
        <li>返金処理完了後、カード会社の処理により実際の返金まで数日かかる場合があります。</li>
      </ul>

      <h2 style={h2}>2. 追加クレジット購入の返金</h2>
      <ul style={ul}>
        <li>追加クレジットの購入後、未使用分がある場合は返金の対象となります。</li>
        <li>返金をご希望の場合は、お問い合わせフォームまたはメール（info@futabaunited.com）にてご連絡ください。</li>
        <li>返金依頼を受領した日から14日以内に、キャンセル処理および返金手続きを行います。</li>
        <li>一部使用済みの場合は、未使用分に相当する金額を日割り計算にて返金いたします。</li>
      </ul>

      <h2 style={h2}>3. 返金の対象外となる場合</h2>
      <ul style={ul}>
        <li>クレジットをすべて使用済みの場合</li>
        <li>利用規約に違反したことによりアカウントが停止された場合</li>
        <li>購入から180日以上経過している場合</li>
      </ul>

      <h2 style={h2}>4. 返金手続きの流れ</h2>
      <ul style={ul}>
        <li>ステップ1：<a href="/contact" style={{ color: "#0a0a0a", textDecoration: "underline" }}>お問い合わせフォーム</a>またはメール（info@futabaunited.com）にて返金を依頼</li>
        <li>ステップ2：運営が内容を確認（1〜3営業日）</li>
        <li>ステップ3：返金依頼の受領日から14日以内にキャンセル処理・返金を実施</li>
        <li>ステップ4：クレジットカードへの返金が完了（カード会社により数日かかる場合あり）</li>
      </ul>

      <h2 style={h2}>5. お問い合わせ</h2>
      <p style={p}>返金に関するお問い合わせは、以下までご連絡ください。</p>
      <p style={{ ...p, fontWeight: 600 }}>株式会社FutabaUnited<br />info@futabaunited.com</p>

      <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid #E5E5E5", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <a href="/" style={{ fontSize: 13, color: "#888", textDecoration: "none" }}>← トップに戻る</a>
        <div style={{ display: "flex", gap: 16, fontSize: 12, flexWrap: "wrap" }}>
          <a href="/privacy" style={{ color: "#888", textDecoration: "none" }}>プライバシーポリシー</a>
          <a href="/terms" style={{ color: "#888", textDecoration: "none" }}>利用規約</a>
          <span style={{ color: "#555" }}>返金ポリシー</span>
          <a href="/legal" style={{ color: "#888", textDecoration: "none" }}>特定商取引法</a>
          <a href="/contact" style={{ color: "#888", textDecoration: "none" }}>お問い合わせ</a>
        </div>
      </div>
    </div>
  );
}
