export const metadata = {
  title: "Threads投稿エンジン",
  description: "Threads投稿の採点・誘導投稿・ゴースト投稿を生成",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
