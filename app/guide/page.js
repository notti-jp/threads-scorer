"use client";
export default function Guide() {
  const wrap = { maxWidth: 720, margin: "0 auto", padding: "0 16px 60px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Hiragino Sans', sans-serif", color: "#1A1A1A" };
  const section = { marginBottom: 48 };
  const img = { width: "100%", borderRadius: 12, marginBottom: 16 };
  const h2 = { fontSize: 20, fontWeight: 700, color: "#0a0a0a", marginBottom: 12, lineHeight: 1.5 };
  const p = { fontSize: 14, color: "#444", lineHeight: 1.9, marginBottom: 16 };
  const step = { display: "flex", alignItems: "center", gap: 12, marginBottom: 12 };
  const stepNum = { width: 32, height: 32, borderRadius: "50%", background: "#0a0a0a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flexShrink: 0 };
  const stepText = { fontSize: 15, fontWeight: 600, color: "#1A1A1A" };
  const divider = { height: 1, background: "#E5E5E5", margin: "40px 0" };
  const tipBox = { padding: "16px 20px", background: "#F8F8F8", borderRadius: 12, borderLeft: "3px solid #83c2cb", fontSize: 13, color: "#555", lineHeight: 1.8, marginBottom: 16 };

  return (
    <div style={wrap}>
      {/* ヒーロー画像 */}
      <img src="/guide-hero.png" alt="キニナルメーカー" style={{ width: "100%", borderRadius: 0, marginBottom: 0 }} />

      <div style={{ textAlign: "center", padding: "32px 0 24px" }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: "#0a0a0a", lineHeight: 1.4, marginBottom: 8 }}>はじめてガイド</div>
        <div style={{ fontSize: 14, color: "#888", lineHeight: 1.6 }}>キニナルメーカーの使い方を、やさしく解説します</div>
      </div>

      <div style={divider} />

      {/* イントロ */}
      <div style={section}>
        <h2 style={h2}>キニナルメーカーって何ができるの？</h2>
        <p style={p}>あなたのnote記事を読み込ませるだけで、Threadsで「気になる！」と思わせる投稿文を作ってくれるツールです。</p>
        <p style={p}>バズることだけが目的ではありません。「あなたのnoteを読みたくなる人を、Threadsで自然に増やす」ことを目的に作りました。</p>
        <p style={p}>難しい操作は一切ありません。ボタンを押していくだけで、投稿文が出来上がります。</p>
      </div>

      <div style={divider} />

      {/* 全体の流れ */}
      <div style={section}>
        <h2 style={h2}>投稿文ができるまでの流れ</h2>
        <img src="/guide-flow.png" alt="全体の流れ" style={img} />
        <div style={tipBox}>
          <strong>ポイント：</strong>note魅力抽出で素案を作り → タブAで完成させる。この2ステップが基本の流れです。
        </div>
      </div>

      <div style={divider} />

      {/* STEP1: noteの魅力を抽出 */}
      <div style={section}>
        <div style={step}><div style={stepNum}>1</div><div style={stepText}>noteの魅力を抽出する</div></div>
        <img src="/guide-extract.png" alt="noteの魅力を抽出" style={img} />
        <p style={p}>まず「note魅力抽出」タブを開き、あなたのnote記事ファイル（.txt、.docx、.pdf）をアップロードします。</p>
        <p style={p}>「魅力を抽出する（5案）」ボタンを押すと、AIがあなたの記事を多角的に分析し、投稿の「素案」を5つ作成してくれます。</p>
        <p style={p}>各素案には「読者の痛点」と「情報ギャップ」が設計されているので、ただの要約にはなりません。読者が「続きが知りたい」と感じる構造になっています。</p>
        <div style={tipBox}>
          <strong>ヒント：</strong>気に入った素案をタップして「投稿文作成へ進む →」を押すだけ。自動でタブAに移動します。
        </div>
      </div>

      <div style={divider} />

      {/* STEP2: 宣伝投稿を作成 */}
      <div style={section}>
        <div style={step}><div style={stepNum}>2</div><div style={stepText}>投稿文を作成する</div></div>
        <img src="/guide-create.png" alt="宣伝投稿を作成" style={img} />
        <p style={p}>素案がタブAに届いたら、「この素案で投稿文を生成＋採点する」を押すだけ。</p>
        <p style={p}>AIがあなたの文体・ナレッジ設定を反映しながら、投稿文を完成させます。同時に5つの観点（フック力・共感度・構成力・拡散性・文化適合）で採点もしてくれます。</p>
        <p style={p}>「本投稿のみ」か「本投稿＋リプ」をボタンで切り替えられます。リプ付きにすると、ツリー構造でより詳しい情報を伝えられます。</p>
      </div>

      <div style={divider} />

      {/* STEP3: 改善後の投稿文 */}
      <div style={section}>
        <div style={step}><div style={stepNum}>3</div><div style={stepText}>改善された投稿文を受け取る</div></div>
        <img src="/guide-score.png" alt="改善後の投稿文を作成" style={img} />
        <p style={p}>あなたの投稿前の文章を送ると、複数の視点からあなたの投稿が伸びるかをレビューしてくれます。さらに改善点をおさえた伸びる投稿文を提示します。</p>
        <p style={p}>「ずるい一言をつける」をONにすると、冒頭に読者の指を止めるフレーズを3パターン提案してくれます。</p>
        <p style={p}>完成した投稿文は「コピー」ボタンでクリップボードにコピー。そのままThreadsに貼り付けるだけです。</p>
      </div>

      <div style={divider} />

      {/* あなたの個性を演出 */}
      <div style={section}>
        <div style={step}><div style={{ ...stepNum, background: "#f07852" }}>+</div><div style={stepText}>あなたの個性を演出する</div></div>
        <img src="/guide-custom.png" alt="あなたの個性を演出" style={img} />
        <p style={p}>あなたのnoteのURLを読み込ませると、あなた独自の文体を学習します。学習後は、生成される投稿文があなたらしい言い回しで仕上がります。</p>
        <p style={p}>さらに「ナレッジ調整」で、フック力・共感・ライティング技法などのバランスをスライダーで調整できます。迷ったら「バランス型」を選べばOKです。</p>

        {/* ナレッジ調整の詳細 */}
        <div style={{ marginTop: 20, padding: 20, background: "#FAFAFA", borderRadius: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0a0a0a", marginBottom: 16 }}>ナレッジ調整でできること</div>
          <div style={{ fontSize: 13, color: "#444", lineHeight: 1.9, marginBottom: 8 }}>各スライダーを「強」にすると、その要素が投稿文に色濃く反映されます。</div>
          {[
            { name: "フック力", desc: "投稿は1行目が超重要。「断言」「問いかけ」「本音」など、スクロールする指を止める冒頭になる。" },
            { name: "ライティング技法", desc: "文章のリズム・改行・強調語・短文と長文の使い分けが洗練される。読みやすさが上がる。" },
            { name: "共感・感情", desc: "「これ、私のことだ」と感じさせる表現が増える。読者の気持ちを代弁するトーンになる。" },
            { name: "欲望設計", desc: "「知りたい」「欲しい」を引き出す構造になる。答えを全部見せず、情報ギャップを残す書き方になる。" },
            { name: "認知・集客", desc: "フォロワーを増やすことを意識した投稿になる。プロフィールクリックにつながる設計が強まる。" },
            { name: "ゴースト投稿", desc: "24時間で消える限定感・「コッソリ感」を活かした表現になる。秘密を打ち明けるトーンが出る。" },
            { name: "プロフ・差別化", desc: "「この人は○○の専門家だ」と伝わる投稿になる。発信テーマとnoteの一貫性を意識した内容になる。" },
          ].map((item, i) => (
            <div key={i} style={{ padding: "8px 0", borderBottom: i < 6 ? "1px solid #E5E5E5" : "none" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#0a0a0a" }}>{item.name}</span>
              <span style={{ fontSize: 13, color: "#555" }}>：{item.desc}</span>
            </div>
          ))}
          <div style={{ marginTop: 16, padding: "14px 16px", background: "#FFFFFF", borderRadius: 8, border: "2px solid #f07852" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0a0a0a", lineHeight: 1.8 }}>「私も昔、◯◯だった」という寄り添い型の投稿にしたくない場合は、「共感・感情」を弱に設定してください。</div>
          </div>
        </div>
      </div>

      <div style={divider} />

      {/* 伸びた投稿を分析 */}
      <div style={section}>
        <div style={step}><div style={{ ...stepNum, background: "#83c2cb" }}>+</div><div style={stepText}>伸びた投稿を分析する</div></div>
        <img src="/guide-feedback.png" alt="伸びた投稿を分析" style={img} />
        <p style={p}>投稿した後の結果（ビュー数・いいね数・コメント数）を「フィードバック」タブに記録すると、自動でバズスコアとグレードを計算してくれます。</p>
        <p style={p}>データが溜まるほど、あなたの成功パターンをAIが学習し、次の投稿文の生成に活かしてくれるようになります。</p>
        <div style={tipBox}>
          <strong>ヒント：</strong>うまく伸びた投稿があれば、フィードバックに登録してみてください。その投稿を分析して次の投稿にいかします。
        </div>
      </div>

      <div style={divider} />

      {/* 料金 */}
      <div style={section}>
        <h2 style={h2}>料金について</h2>
        <p style={p}>月額1,980円（税込）で、毎月100回分のクレジットが付与されます。翌月への繰り越しも可能です。</p>
        <p style={p}>文体学習・フィードバック入力・下書き保存はクレジットを消費しません。何度でも無料で使えます。</p>
        <div style={{ background: "#FAFAFA", borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#0a0a0a", marginBottom: 12 }}>追加クレジット（100回で足りない場合）</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[{ n: "+100回", p: "¥1,200" }, { n: "+200回", p: "¥2,200" }, { n: "+300回", p: "¥3,000", badge: "お得" }].map((pl, i) => (
              <div key={i} style={{ flex: 1, minWidth: 90, padding: 12, background: "#FFFFFF", border: pl.badge ? "2px solid #f07852" : "1px solid #E5E5E5", borderRadius: 8, textAlign: "center", position: "relative" }}>
                {pl.badge && <div style={{ position: "absolute", top: -8, right: 8, background: "#f07852", color: "#fff", fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4 }}>{pl.badge}</div>}
                <div style={{ fontSize: 15, fontWeight: 700 }}>{pl.n}</div>
                <div style={{ fontSize: 13, color: "#888" }}>{pl.p}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={divider} />

      {/* よくある質問 */}
      <div style={section}>
        <h2 style={h2}>よくある質問</h2>
        {[
          { q: "スマホからでも使えますか？", a: "はい。スマホのブラウザ（Safari、Chromeなど）からそのまま使えます。アプリのインストールは不要です。" },
          { q: "自分で書いた投稿文を採点だけすることはできますか？", a: "はい。「バズスコア採点」タブに自分の文章を貼り付けて「採点する」を押すだけでOKです。" },
          { q: "対応しているファイル形式は？", a: ".txt、.docx、.pdfに対応しています。noteの記事をコピーしてテキストファイルに保存するか、Wordファイルとして書き出してからアップロードしてください。" },
          { q: "退会（サブスクリプションの解約）はできますか？", a: "いつでも解約できます。会員情報の「サブスクリプションを管理する」から手続きするか、お問い合わせフォームからご連絡ください。" },
        ].map((faq, i) => (
          <div key={i} style={{ marginBottom: 16, padding: "14px 16px", background: "#FAFAFA", borderRadius: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#0a0a0a", marginBottom: 6 }}>Q. {faq.q}</div>
            <div style={{ fontSize: 13, color: "#555", lineHeight: 1.7 }}>{faq.a}</div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div style={{ textAlign: "center", padding: "24px 0" }}>
        <a href="/" style={{ display: "inline-block", padding: "14px 40px", background: "#0a0a0a", color: "#fff", borderRadius: 10, textDecoration: "none", fontSize: 15, fontWeight: 600 }}>キニナルメーカーを使ってみる</a>
      </div>

      {/* フッター */}
      <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid #E5E5E5", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, fontSize: 12 }}>
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
  );
}
