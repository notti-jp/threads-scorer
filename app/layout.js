export const metadata = {
  title: "Threads バズ採点ツール",
  description: "Threadsの投稿がバズるかAIが採点します",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
