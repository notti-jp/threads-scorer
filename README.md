# Threads バズ採点ツール

Threadsの投稿文をAIが5つの観点で採点し、改善案を提示するWebアプリです。

## デプロイ手順（Vercel）

### 1. 準備

- [GitHub](https://github.com) アカウント
- [Vercel](https://vercel.com) アカウント（GitHubで無料登録可）
- [Anthropic API Key](https://console.anthropic.com)（要取得）

### 2. GitHubにリポジトリを作成

```bash
cd threads-scorer
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/あなたのユーザー名/threads-scorer.git
git push -u origin main
```

### 3. Vercelでデプロイ

1. [vercel.com](https://vercel.com) にログイン
2. 「Add New → Project」をクリック
3. GitHubリポジトリ「threads-scorer」を選択し「Import」
4. **Environment Variables** に以下を追加:
   - Key: `ANTHROPIC_API_KEY`
   - Value: `sk-ant-xxxxx...`（あなたのAPIキー）
5. 「Deploy」をクリック

数十秒でデプロイ完了し、`https://threads-scorer-xxx.vercel.app` のようなURLが発行されます。

### 4. ローカルで動かす場合

```bash
cp .env.local.example .env.local
# .env.local を編集してAPIキーを設定
npm install
npm run dev
```

http://localhost:3000 で確認できます。

## 料金について

- **Vercel**: 無料プラン（Hobby）で十分動作します
- **Anthropic API**: 従量課金（1回の採点で約$0.005〜0.01程度）
