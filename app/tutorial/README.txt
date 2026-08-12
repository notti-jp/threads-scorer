==========================================================
 キニナルメーカー チュートリアル
 https://notti.jp/tutorial
==========================================================

■ 中身
----------------------------------------------------------
tutorial/
├── index.html          … ガイド本体（これ1枚で動きます）
├── README.txt          … このファイル
└── images/
    ├── README.txt      … 画像のファイル名一覧とサイズ
    └── （ここに g-01.png などを入れる）


■ 置き場所
----------------------------------------------------------
Next.js のプロジェクトの  public/  の下に、
tutorial フォルダごとコピーしてください。

  your-project/
  └── public/
      └── tutorial/
          ├── index.html
          └── images/

これで  https://notti.jp/tutorial/index.html  で開けます。


■ /tutorial （末尾なし）で開けるようにする
----------------------------------------------------------
上記のままだと、環境によっては /tutorial だけでは
開けない場合があります。
プロジェクト直下の next.config.js に、
下の rewrites を足してください。

  /** @type {import('next').NextConfig} */
  const nextConfig = {
    async rewrites() {
      return [
        { source: '/tutorial', destination: '/tutorial/index.html' },
      ];
    },
  };
  module.exports = nextConfig;

すでに rewrites がある場合は、配列に1行足すだけでOKです。

※ next.config.mjs をお使いの場合は
   module.exports = nextConfig; の代わりに
   export default nextConfig; になります。

※ vercel.json で設定したい場合は、こちらでも同じです。

  {
    "rewrites": [
      { "source": "/tutorial", "destination": "/tutorial/index.html" }
    ]
  }


■ 既存の /guide について
----------------------------------------------------------
/tutorial は完全に独立した静的ファイルなので、
既存の /guide には一切影響しません。

/tutorial の内容で問題ないと確認できたら、
そのタイミングで /guide からリンクを張るか、
/guide → /tutorial へリダイレクトするか、
どちらでもお好きに切り替えられます。

  リダイレクトする場合（next.config.js）
  async redirects() {
    return [
      { source: '/guide', destination: '/tutorial', permanent: false },
    ];
  }

  ※ permanent: false（302）にしてあります。
     完全に切り替えると決めてから true（301）にしてください。


■ 画像について
----------------------------------------------------------
画像が1枚も無い状態でも、ガイドは動きます。
用意できていない番号は、番号入りの灰色の枠が出るだけです。
レイアウトは崩れないので、できたものから
images/ フォルダに入れていってください。

ファイル名と推奨サイズは images/README.txt をご覧ください。


■ 文章の直し方
----------------------------------------------------------
index.html をテキストエディタで開くと、
中ほどに下の目印があります。

  ▼▼▼ ここだけ編集すればOK ▼▼▼

そこから下が会話の中身です。

  { b:"文章" }              … 吹き出し
  { b:"文章", lead:true }   … 大きい太字
  { b:"文章", note:true }   … 黄色い補足枠
  { img:"11", cap:"説明" }  … 画像
  { c:[{ t:"ボタン", go:"とび先ID" }] } … 選択ボタン

  改行したいところには \n と書きます。

CSSやJavaScriptには触らずに、
文言の変更・画像の差し替え・順番の入れ替え・
ブロックの追加まで、すべてここで完結します。


■ 画像番号の確認
----------------------------------------------------------
画面のいちばん下にある「画像番号を表示」を押すと、
各画像の右下に IMG-11 のような番号が出ます。
差し替えの相談をするときに使ってください。
初期状態では非表示なので、読者には見えません。
