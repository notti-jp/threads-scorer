export const metadata = {
  title: "キニナルメーカー",
  description: "note記事からThreads投稿を自動生成。魅力抽出・バズスコア採点・ゴースト投稿作成ができるThreads投稿支援ツール",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
  icons: { icon: "/favicon.png" },
  openGraph: {
    title: "キニナルメーカー",
    description: "note記事からThreads投稿を自動生成。魅力抽出・バズスコア採点・ゴースト投稿作成ができるThreads投稿支援ツール",
    url: "https://notti.jp",
    siteName: "キニナルメーカー",
    images: [{ url: "https://notti.jp/ogp.png", width: 1200, height: 630 }],
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "キニナルメーカー",
    description: "note記事からThreads投稿を自動生成。魅力抽出・バズスコア採点・ゴースト投稿作成ができるThreads投稿支援ツール",
    images: ["https://notti.jp/ogp.png"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja" style={{ overflowX: "hidden" }}>
      <body style={{ margin: 0, overflowX: "hidden", WebkitTextSizeAdjust: "100%" }}>
        <style>{`
          *, *::before, *::after { box-sizing: border-box; }
          html, body { width: 100%; max-width: 100vw; overflow-x: hidden; background: #fff; color: #1A1A1A; }
          img, video, iframe, table { max-width: 100%; }
          input, textarea, button, select { max-width: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Sans", "Noto Sans JP", sans-serif; }
          div, p, span { word-break: break-word; overflow-wrap: break-word; }
          ::selection { background: rgba(0,0,0,0.08); }
          input::placeholder, textarea::placeholder { color: #BBB; }
          ::-webkit-scrollbar { width: 4px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: #DDD; border-radius: 2px; }
        `}</style>
        {children}
      </body>
    </html>
  );
}
