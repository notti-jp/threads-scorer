// [変更: v4.0-AgentLoop] 自動改善ループ（生成→検査→再生成）対応
import { NextResponse } from "next/server";
import { SCORE_PROMPT, HOOK_CANDIDATES_INSTRUCTION, APPEAL_TO_POST_INSTRUCTION, buildStyleInstruction, buildKnowledgePriority, buildZuruiInstruction } from "../../prompts";
import { getDb } from "../../lib/db";

// ═══════ コード側チェック（0円・確実に弾く） ═══════
const NG_PATTERNS = [
  { re: /稼ぐ|稼げ|稼い/, label: "禁止ワード「稼ぐ／稼げる」" },
  { re: /儲か/, label: "禁止ワード「儲かる」" },
  { re: /高収入/, label: "禁止ワード「高収入」" },
  { re: /即金/, label: "禁止ワード「即金」" },
  { re: /副業/, label: "禁止ワード「副業」" },
  { re: /LINE追加/, label: "禁止ワード「LINE追加」" },
];

function countLines(text) {
  // 全角スペースだけの行（段落区切り）は行数に含めない
  return text.split("\n").filter(l => l.trim() !== "" && l !== "　").length;
}

function codeCheck(main, reply, mode) {
  const issues = [];
  const whole = `${main}\n${reply || ""}`;

  // 禁止ワード
  for (const p of NG_PATTERNS) {
    if (p.re.test(whole)) issues.push(`${p.label}が含まれている。言い換えること（例：稼ぐ→収益化する、副業→本業のあいまに）`);
  }

  // 行数チェック
  const mainLines = countLines(main);
  const replyLines = reply ? countLines(reply) : 0;
  if (mode === "single" && mainLines > 8) issues.push(`本投稿が${mainLines}行ある。8行以内に収めること`);
  if (mode === "singleShort" && mainLines > 5) issues.push(`本投稿が${mainLines}行ある。5行以内に収めること`);
  if ((mode === "tree" || mode === "treeShort") && mainLines > 3) issues.push(`本投稿が${mainLines}行ある。2〜3行に収めること`);
  if (mode === "tree" && replyLines > 10) issues.push(`リプが${replyLines}行ある。10行以内に収めること`);
  if (mode === "treeShort" && replyLines > 8) issues.push(`リプが${replyLines}行ある。8行以内に収めること`);
  if ((mode === "tree" || mode === "treeShort") && mainLines === 1) issues.push(`本投稿が1行だけになっている。2〜3行にしてフックとしての厚みを持たせること`);

  // 締めの「…」チェック（投稿全体の締め＝singleは本投稿末尾、treeはリプ末尾）
  const closing = (mode === "tree" || mode === "treeShort") ? (reply || "").trim() : main.trim();
  if (/[…]{1,}。?$/.test(closing)) issues.push(`投稿の締めが「…」で終わっている。言い切りで着地させること`);

  return issues;
}

// ═══════ AI審査（Haiku・軽量） ═══════
async function aiReview(apiKey, main, reply, mode) {
  const target = reply ? `【本投稿】\n${main}\n\n【リプ】\n${reply}` : `【本投稿】\n${main}`;
  const reviewPrompt = `あなたはThreads投稿の品質審査員です。以下の投稿を審査し、JSON形式のみで回答してください。

審査基準：
1. 1行目〜2行目に、テーマを示す具体的な名詞（note、Threads、文章、フォロワー等のジャンル語）が入っているか
2. 1行目が挨拶・自己紹介・「〜な人へ」のような対象説明で始まっていないか（フックとして弱くないか）
3. AIが書いたような不自然さがないか：全文が同じ長さの文の羅列／「しかし」「また」「そして」等の接続詞が2回以上／同じ語尾が3連続以上
4. 抽象語（「大切」「重要」「本質」）だけで内容が薄くないか

出力形式（この形式のみ。他の文章は一切書かない）：
{"pass": true または false, "issues": ["問題点1", "問題点2"]}

問題がなければ {"pass": true, "issues": []} と返す。

審査対象：
${target}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        messages: [{ role: "user", content: reviewPrompt }],
      }),
    });
    if (!res.ok) return { pass: true, issues: [] }; // 審査APIの失敗は生成を止めない
    const data = await res.json();
    const raw = data.content?.map((c) => c.text || "").join("") || "";
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return { pass: true, issues: [] };
    const parsed = JSON.parse(m[0]);
    return { pass: !!parsed.pass, issues: Array.isArray(parsed.issues) ? parsed.issues.slice(0, 4) : [] };
  } catch {
    return { pass: true, issues: [] };
  }
}

// ═══════ レスポンス解析 ═══════
function parseResult(raw) {
  let scores = null;
  const s = raw.indexOf('{"scores"');
  if (s !== -1) { let d = 0, e = -1; for (let i = s; i < raw.length; i++) { if (raw[i] === "{") d++; if (raw[i] === "}") { d--; if (d === 0) { e = i + 1; break; } } } if (e !== -1) try { scores = JSON.parse(raw.substring(s, e)); } catch {} }
  if (!scores) { const jsonBlock = raw.match(/```json?\s*(\{[\s\S]*?\})\s*```/); if (jsonBlock) try { scores = JSON.parse(jsonBlock[1]); } catch {} }
  if (!scores) { const lineJson = raw.match(/^(\{.*"scores".*\})$/m); if (lineJson) try { scores = JSON.parse(lineJson[1]); } catch {} }
  const mainMatch = raw.match(/\[MAIN\]\s*([\s\S]*?)\s*\[\/MAIN\]/);
  const replyMatch = raw.match(/\[REPLY\]\s*([\s\S]*?)\s*\[\/REPLY\]/);
  const hooksMatch = raw.match(/\[HOOKS\]\s*([\s\S]*?)\s*\[\/HOOKS\]/);
  return {
    scores,
    main: mainMatch?.[1]?.trim() || "",
    reply: replyMatch?.[1]?.trim() || "",
    hooks: hooksMatch ? hooksMatch[1].trim() : "",
  };
}

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY が設定されていません" }, { status: 500 });

  try {
    const { text, mode, useHook, styleProfile, knowledgePriority, isAppeal, username } = await request.json();
    if (!text?.trim()) return NextResponse.json({ error: "投稿文が空です" }, { status: 400 });

    // ═══════ Prompt Caching: 静的部分と動的部分を分離 ═══════
    const staticPrompt = useHook ? SCORE_PROMPT + HOOK_CANDIDATES_INSTRUCTION : SCORE_PROMPT;

    let dynamicPrompt = "";
    if (isAppeal) dynamicPrompt += APPEAL_TO_POST_INSTRUCTION;
    dynamicPrompt += buildStyleInstruction(styleProfile);
    dynamicPrompt += buildKnowledgePriority(knowledgePriority);
    if (useHook) dynamicPrompt += buildZuruiInstruction(isAppeal ? "appeal" : "normal");

    // ═══════ 成功事例の参照（フィードバックDBから上位3件）═══════
    if (username) {
      try {
        const sql = getDb();
        const successPosts = await sql`
          SELECT main_post FROM feedbacks
          WHERE username = ${username} AND views > 0 AND likes > 0
          ORDER BY (likes + comments * 2.0) / views DESC
          LIMIT 3
        `;
        if (successPosts.length > 0) {
          dynamicPrompt += "\n\n【あなたの過去の成功投稿（参考）】\n";
          dynamicPrompt += "以下はこのユーザーの過去の投稿のうち、エンゲージメント率が高かったものです。\n";
          dynamicPrompt += "文体・構成・トーン・リズムを参考にして、リライトに活かしてください。\n";
          dynamicPrompt += "ただし、内容をコピーしたり混ぜたりしないこと。あくまで「書き方」の参考として使うこと。\n\n";
          successPosts.forEach((p, i) => {
            const truncated = (p.main_post || "").slice(0, 200);
            dynamicPrompt += `成功例${i + 1}：${truncated}\n\n`;
          });
        }
      } catch {}
    }

    const systemBlocks = [
      { type: "text", text: staticPrompt, cache_control: { type: "ephemeral" } },
    ];
    if (dynamicPrompt) {
      systemBlocks.push({ type: "text", text: dynamicPrompt });
    }

    const modeInstructions = {
      single: `以下のThreads投稿を採点してください。リライトは「本投稿のみ」モードで、8行以内で完結。[REPLY]タグは出力しないでください`,
      singleShort: `以下のThreads投稿を採点してください。リライトは「本投稿のみ・短縮版」モードで、必ず5行以内で完結させること。短いながらも冒頭のフックと具体性は維持する。[REPLY]タグは出力しないでください`,
      tree: `以下のThreads投稿を採点してください。リライトは「本投稿＋リプ」モードで出力してください。本投稿は2〜3行（1行だけにせず、フックとして成立する厚みを残す)、リプは原則10行以内に収めること。リプは必ず2〜3行ごとに段落を分け、段落と段落の間に「　」（全角スペース1文字だけの行）を入れて読みやすくすること。この区切り行は行数に数えない`,
      treeShort: `以下のThreads投稿を採点してください。リライトは「本投稿＋リプ・簡潔版」モードで出力してください。本投稿は2〜3行（1行だけにせず、フックとして成立する厚みを残す）、リプは原則8行以内に収めること。短いながらも冒頭のフックと具体性は維持する。リプは必ず2〜3行ごとに段落を分け、段落と段落の間に「　」（全角スペース1文字だけの行）を入れて読みやすくすること。この区切り行は行数に数えない`,
    };
    const baseUserMessage = `${modeInstructions[mode] || modeInstructions.tree}:\n\n${text}`;

    // ═══════ 生成関数（リトライ時は指摘を追加） ═══════
    const generateOnce = async (retryIssues) => {
      let userMessage = baseUserMessage;
      if (retryIssues && retryIssues.length > 0) {
        userMessage += `\n\n【重要：前回の生成には以下の問題があった。すべて修正して再生成すること】\n${retryIssues.map((i, n) => `${n + 1}. ${i}`).join("\n")}`;
      }
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 12000,
          system: systemBlocks,
          messages: [{ role: "user", content: userMessage }],
        }),
      });
      if (!res.ok) {
        if (res.status === 529) throw Object.assign(new Error("APIが一時的に混雑しています。少し待ってから再度ボタンを押してください"), { status: 502 });
        throw Object.assign(new Error(`API error: ${res.status}`), { status: 502 });
      }
      const data = await res.json();
      return data.content?.map((c) => c.text || "").join("") || "";
    };

    // ═══════ エージェントループ：生成 → 検査 → 不合格なら再生成（最大1回） ═══════
    let raw = await generateOnce(null);
    let parsed = parseResult(raw);

    if (parsed.main) {
      // コード側チェック（0円）
      let issues = codeCheck(parsed.main, parsed.reply, mode);
      // AI審査（Haiku・軽量）：コードチェックが通っても品質面を確認
      if (issues.length === 0) {
        const review = await aiReview(apiKey, parsed.main, parsed.reply, mode);
        if (!review.pass) issues = review.issues;
      }
      // 不合格なら指摘付きで1回だけ再生成
      if (issues.length > 0) {
        try {
          const retryRaw = await generateOnce(issues);
          const retryParsed = parseResult(retryRaw);
          // 再生成が有効な本文を返した場合のみ差し替え（失敗時は初回結果を使う）
          if (retryParsed.main) {
            // 再生成分にNGワードが残っていないか最終確認（残っていたら初回とマシな方を選ぶ）
            const retryIssues = codeCheck(retryParsed.main, retryParsed.reply, mode);
            const ngOnly = (arr) => arr.filter(i => i.includes("禁止ワード")).length;
            if (ngOnly(retryIssues) <= ngOnly(codeCheck(parsed.main, parsed.reply, mode))) {
              raw = retryRaw;
              parsed = retryParsed;
            }
          }
        } catch {}
      }
    }

    // ═══════ レスポンス構築 ═══════
    if (!parsed.scores) {
      if (parsed.main || parsed.reply) {
        return NextResponse.json({
          scores: null,
          rewrite: { main: parsed.main, reply: parsed.reply },
          hooks: parsed.hooks,
          partial: true,
        });
      }
      return NextResponse.json({ error: "スコアデータの解析に失敗しました。もう一度お試しください。" }, { status: 502 });
    }

    return NextResponse.json({
      ...parsed.scores,
      rewrite: (parsed.main || parsed.reply) ? { main: parsed.main, reply: parsed.reply } : null,
      hooks: parsed.hooks,
    });
  } catch (e) {
    const status = e.status || 500;
    return NextResponse.json({ error: e.message || "Internal server error" }, { status });
  }
}
