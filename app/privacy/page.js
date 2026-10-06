export default function Privacy() {
  const s = { maxWidth: 640, margin: "0 auto", padding: "40px 20px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Hiragino Sans', sans-serif", color: "#1A1A1A", lineHeight: 1.9 };
  const h1 = { fontSize: 22, fontWeight: 700, marginBottom: 8 };
  const h2 = { fontSize: 16, fontWeight: 700, marginTop: 32, marginBottom: 8, borderBottom: "1px solid #E5E5E5", paddingBottom: 8 };
  const p = { fontSize: 14, color: "#444", marginBottom: 16 };
  const ul = { fontSize: 14, color: "#444", paddingLeft: 20, marginBottom: 16 };
  const date = { fontSize: 12, color: "#888", marginBottom: 24 };

  return (
    <div style={s}>
      <h1 style={h1}>プライバシーポリシー</h1>
      <p style={date}>最終更新日：2025年5月7日</p>

      <p style={p}>キニナルメーカー（以下「本サービス」）は、ユーザーの個人情報の保護に努めます。本プライバシーポリシーでは、本サービスが取得する情報、その利用目的、および管理方法について説明します。</p>

      <h2 style={h2}>1. 取得する情報</h2>
      <p style={p}>本サービスでは、以下の情報を取得します。</p>
      <ul style={ul}>
        <li>ユーザー名（ログインID）</li>
        <li>メールアドレス</li>
        <li>パスワード</li>
        <li>生年月日</li>
        <li>ThreadsアカウントID</li>
        <li>Googleアカウント情報（Googleログインを利用した場合：名前、メールアドレス）</li>
        <li>本サービス上で入力された投稿文、下書き、フィードバックデータ</li>
      </ul>

      <h2 style={h2}>2. 利用目的</h2>
      <p style={p}>取得した情報は、以下の目的でのみ使用します。</p>
      <ul style={ul}>
        <li>ユーザーアカウントの識別・認証</li>
        <li>本サービスの機能提供（投稿文の採点・生成・下書き保存・フィードバック管理）</li>
        <li>パスワードリセット時のメール送信</li>
        <li>決済処理（追加クレジット購入時）</li>
        <li>サービスの改善・不具合対応</li>
      </ul>

      <h2 style={h2}>3. 第三者への提供</h2>
      <p style={p}>本サービスは、ユーザーの個人情報を第三者に提供・販売・共有することはありません。ただし、以下の場合を除きます。</p>
      <ul style={ul}>
        <li>ユーザー本人の同意がある場合</li>
        <li>法令に基づく開示請求があった場合</li>
        <li>決済処理に必要な範囲で決済サービス（Stripe）に情報を提供する場合</li>
      </ul>

      <h2 style={h2}>4. 外部サービスの利用</h2>
      <p style={p}>本サービスでは、以下の外部サービスを利用しています。各サービスのプライバシーポリシーもあわせてご確認ください。</p>
      <ul style={ul}>
        <li>Anthropic Claude API（投稿文の生成・採点）</li>
        <li>Stripe（決済処理）</li>
        <li>Resend（メール送信）</li>
        <li>Neon（データベース）</li>
        <li>Vercel（ホスティング）</li>
        <li>Google（ログイン認証）</li>
      </ul>

      <h2 style={h2}>5. データの保管</h2>
      <p style={p}>ユーザーのデータはデータベースに保存されます。データの管理には十分な注意を払いますが、完全な安全性を保証するものではありません。</p>

      <h2 style={h2}>6. データの削除</h2>
      <p style={p}>ユーザーは、アカウントの削除を希望する場合、下記のお問い合わせ先までご連絡ください。アカウントに紐づくすべてのデータを削除いたします。</p>

      <h2 style={h2}>7. Cookieについて</h2>
      <p style={p}>本サービスでは、ログイン状態の維持および設定の保存のためにブラウザのローカルストレージを使用しています。Cookieは決済処理（Stripe）において使用される場合があります。</p>

      <h2 style={h2}>8. プライバシーポリシーの変更</h2>
      <p style={p}>本プライバシーポリシーは、必要に応じて変更されることがあります。変更があった場合は、本ページにて通知します。</p>

      <h2 style={h2}>9. お問い合わせ</h2>
      <p style={p}>本プライバシーポリシーに関するお問い合わせは、以下までご連絡ください。</p>
      <p style={{ ...p, fontWeight: 600 }}>info@notti.jp</p>

      <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid #E5E5E5", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <a href="/" style={{ fontSize: 13, color: "#888", textDecoration: "none" }}>← トップに戻る</a>
        <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
          <span style={{ color: "#555" }}>プライバシーポリシー</span>
          <a href="/terms" style={{ color: "#888", textDecoration: "none" }}>利用規約</a>
          <a href="/refund" style={{ color: "#888", textDecoration: "none" }}>返金ポリシー</a>
          <a href="/legal" style={{ color: "#888", textDecoration: "none" }}>特定商取引法</a>
          <a href="/contact" style={{ color: "#888", textDecoration: "none" }}>お問い合わせ</a>
        </div>
      </div>
    </div>
  );
}
