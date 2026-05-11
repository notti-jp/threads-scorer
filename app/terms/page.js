export default function Terms() {
  const s = { maxWidth: 640, margin: "0 auto", padding: "40px 20px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Hiragino Sans', sans-serif", color: "#1A1A1A", lineHeight: 1.9 };
  const h1 = { fontSize: 22, fontWeight: 700, marginBottom: 8 };
  const h2 = { fontSize: 16, fontWeight: 700, marginTop: 32, marginBottom: 8, borderBottom: "1px solid #E5E5E5", paddingBottom: 8 };
  const p = { fontSize: 14, color: "#444", marginBottom: 16 };
  const ul = { fontSize: 14, color: "#444", paddingLeft: 20, marginBottom: 16 };
  const date = { fontSize: 12, color: "#888", marginBottom: 24 };

  return (
    <div style={s}>
      <h1 style={h1}>利用規約</h1>
      <p style={date}>最終更新日：2025年5月7日</p>

      <p style={p}>この利用規約（以下「本規約」）は、キニナルメーカー（以下「本サービス」）の利用条件を定めるものです。本サービスをご利用いただくにあたり、本規約に同意いただくものとします。</p>

      <h2 style={h2}>第1条（サービスの内容）</h2>
      <p style={p}>本サービスは、SNS「Threads」への投稿文の作成を支援するツールです。AI技術を活用した投稿文の採点、魅力要素の抽出、投稿文の生成、フィードバック管理などの機能を提供します。</p>

      <h2 style={h2}>第2条（アカウント）</h2>
      <ul style={ul}>
        <li>本サービスの利用にはアカウント登録が必要です。</li>
        <li>登録情報は正確な内容を入力してください。</li>
        <li>アカウントの管理責任はユーザー本人にあります。パスワードの漏洩等による損害について、本サービスは責任を負いません。</li>
        <li>1人のユーザーが複数のアカウントを作成することは禁止します。</li>
      </ul>

      <h2 style={h2}>第3条（利用回数と料金）</h2>
      <ul style={ul}>
        <li>毎月1日に100回分の無料利用回数が付与されます。未使用分は翌月に繰り越されます。</li>
        <li>利用回数の上限に達した場合、追加クレジットを購入することで利用を継続できます。</li>
        <li>購入済みのクレジットは返金できません。</li>
        <li>利用回数のカウント対象は、投稿文の採点・生成・魅力抽出・ゴースト投稿生成です。文体学習・フィードバック入力・下書き保存はカウント対象外です。</li>
      </ul>

      <h2 style={h2}>第4条（禁止事項）</h2>
      <p style={p}>ユーザーは、以下の行為を行ってはなりません。</p>
      <ul style={ul}>
        <li>本サービスの不正利用（不正アクセス、自動化ツールによる大量リクエスト等）</li>
        <li>他のユーザーのアカウントの使用</li>
        <li>本サービスのリバースエンジニアリング、複製、再配布</li>
        <li>法令または公序良俗に反する投稿文の生成</li>
        <li>本サービスを利用した第三者への誹謗中傷・差別的な投稿の作成</li>
        <li>本サービスのナレッジ・プロンプト・辞書等の知的財産の外部への持ち出し・共有</li>
      </ul>

      <h2 style={h2}>第5条（知的財産権）</h2>
      <ul style={ul}>
        <li>本サービスのナレッジ、プロンプト、ずるい辞書、UI/UXデザインなどの知的財産はすべて本サービスの運営者に帰属します。</li>
        <li>本サービスを利用して生成された投稿文の著作権はユーザーに帰属します。ただし、生成された文章の利用によって生じた問題について、本サービスは責任を負いません。</li>
      </ul>

      <h2 style={h2}>第6条（免責事項）</h2>
      <ul style={ul}>
        <li>本サービスはAI技術を利用しており、生成される投稿文の正確性・適切性を保証するものではありません。</li>
        <li>本サービスの利用により生じた損害について、本サービスは一切の責任を負いません。</li>
        <li>本サービスは予告なくメンテナンス、仕様変更、サービス停止を行う場合があります。</li>
        <li>本サービスを利用して作成した投稿文をSNSに投稿した結果について、本サービスは責任を負いません。</li>
        <li>本サービスを利用して作成・投稿したコンテンツに起因して、Threads、Instagram、その他のSNSプラットフォームにおいてユーザーのアカウントが凍結、停止、削除等の措置を受けた場合、当社は一切の責任を負わないものとします。SNSプラットフォームの利用規約およびガイドラインの遵守は、ユーザー自身の責任となります。</li>
      </ul>

      <h2 style={h2}>第7条（サービスの変更・終了）</h2>
      <p style={p}>本サービスは、事前の通知なくサービス内容の変更、一時停止、または終了を行うことができるものとします。これによりユーザーに生じた損害について、本サービスは責任を負いません。</p>

      <h2 style={h2}>第8条（規約の変更）</h2>
      <p style={p}>本規約は、必要に応じて変更されることがあります。変更後の規約は、本ページに掲載した時点で効力を生じるものとします。</p>

      <h2 style={h2}>第9条（準拠法・管轄）</h2>
      <p style={p}>本規約は日本法に準拠し、本サービスに関する一切の紛争は、東京地方裁判所を第一審の専属的合意管轄裁判所とします。</p>

      <h2 style={h2}>第10条（お問い合わせ）</h2>
      <p style={p}>本規約に関するお問い合わせは、以下までご連絡ください。</p>
      <p style={{ ...p, fontWeight: 600 }}>info@notti.jp</p>

      <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid #E5E5E5", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <a href="/" style={{ fontSize: 13, color: "#888", textDecoration: "none" }}>← トップに戻る</a>
        <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
          <a href="/privacy" style={{ color: "#888", textDecoration: "none" }}>プライバシーポリシー</a>
          <span style={{ color: "#555" }}>利用規約</span>
          <a href="/contact" style={{ color: "#888", textDecoration: "none" }}>お問い合わせ</a>
        </div>
      </div>
    </div>
  );
}
