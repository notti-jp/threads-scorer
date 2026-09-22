# Threads投稿エンジン v2.1

3つのタブでThreads投稿を支援するツールです。

- **A: バズスコア採点** — 投稿文を入力→5観点で採点＋改善版
- **B1: 誘導投稿** — note記事をアップ→誘導投稿を5案生成
- **B2: ゴースト投稿** — note記事をアップ→ゴースト投稿を5案生成

## セットアップ

```bash
npm install
cp .env.local.example .env.local
# .env.local にAPIキーを設定
npm run dev
```

## 環境変数

| 変数名 | 説明 |
|--------|------|
| ANTHROPIC_API_KEY | Anthropic APIキー（必須） |

## デプロイ（Vercel）

1. GitHubにpush
2. Vercelでインポート
3. Environment Variablesに `ANTHROPIC_API_KEY` を設定
4. Deploy
