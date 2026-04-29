export const metadata = {
  title: "Threads投稿エンジン",
  description: "Threads投稿の採点・誘導投稿・ゴースト投稿を生成",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja" style={{ overflowX: "hidden" }}>
      <body style={{ margin: 0, overflowX: "hidden", WebkitTextSizeAdjust: "100%" }}>
        <style>{`
          *, *::before, *::after { box-sizing: border-box; }
          html, body { width: 100%; max-width: 100vw; overflow-x: hidden; background: #000; color: #f5f5f5; }
          img, video, iframe, table { max-width: 100%; }
          input, textarea, button, select { max-width: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Sans", "Noto Sans JP", sans-serif; }
          div, p, span { word-break: break-word; overflow-wrap: break-word; }
          ::selection { background: rgba(255,255,255,0.2); }
          input::placeholder, textarea::placeholder { color: #555; }
          ::-webkit-scrollbar { width: 4px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
        `}</style>
        {children}
      </body>
    </html>
  );
}
