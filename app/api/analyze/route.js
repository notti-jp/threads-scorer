// [変更: v3.0-PromptCaching] Prompt Caching対応
import { NextResponse } from "next/server";
import { SCORE_PROMPT, HOOK_CANDIDATES_INSTRUCTION, APPEAL_TO_POST_INSTRUCTION, buildStyleInstruction, buildKnowledgePriority, buildZuruiInstruction } from "../../prompts";
import { getDb } from "../../lib/db";

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY が設定されていません" }, { status: 500 });

  try {
    const { text, mode, useHook, styleProfile, knowledgePriority, isAppeal, username } = await request.json();
    if (!text?.trim()) return NextResponse.json({ error: "投稿文が空です" }, { status: 400 });

    // ═══════ Prompt Caching: 静的部分と動的部分を分離 ═══════
    const staticPrompt = useHook ? SCORE_PROMPT + HOOK_CANDIDATES_INSTRUCTION : SCORE_PROMPT;

    // 動的部分（毎回変わる）
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

    // system をコンテンツブロック配列で送信（cache_control付き）
    const systemBlocks = [
      { type: "text", text: staticPrompt, cache_control: { type: "ephemeral" } },
    ];
    if (dynamicPrompt) {
      systemBlocks.push({ type: "text", text: dynamicPrompt });
    }

    const modeInstructions = {
      single: `以下のThreads投稿を採点してください。リライトは「本投稿のみ」モードで、8行以内で完結。[REPLY]タグは出力しないでください`,
      singleShort: `以下のThreads投稿を採点してください。リライトは「本投稿のみ・短縮版」モードで、必ず5行以内で完結させること。短いながらも冒頭のフックと具体性は維持する。[REPLY]タグは出力しないでください`,
      tree: `以下のThreads投稿を採点してください。リライトは「本投稿＋リプ」モードで出力してください。本投稿は1-3行、リプは原則10行以内に収めること。リプは必ず2〜3行ごとに段落を分け、段落と段落の間に「　」（全角スペース1文字だけの行）を入れて読みやすくすること。この区切り行は行数に数えない`,
      treeShort: `以下のThreads投稿を採点してください。リライトは「本投稿＋リプ・簡潔版」モードで出力してください。本投稿は1-3行、リプは原則8行以内に収めること。短いながらも冒頭のフックと具体性は維持する。リプは必ず2〜3行ごとに段落を分け、段落と段落の間に「　」（全角スペース1文字だけの行）を入れて読みやすくすること。この区切り行は行数に数えない`,
    };
    const userMessage = `${modeInstructions[mode] || modeInstructions.tree}:\n\n${text}`;

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

    if (!res.ok) { if (res.status === 529) return NextResponse.json({ error: "APIが一時的に混雑しています。少し待ってから再度ボタンを押してください" }, { status: 502 }); return NextResponse.json({ error: `API error: ${res.status}` }, { status: 502 }); }
    const data = await res.json();
    const raw = data.content?.map((c) => c.text || "").join("") || "";

    // スコアJSON抽出（複数パターンに対応）
    let scores = null;
    const s = raw.indexOf('{"scores"');
    if (s !== -1) { let d = 0, e = -1; for (let i = s; i < raw.length; i++) { if (raw[i] === "{") d++; if (raw[i] === "}") { d--; if (d === 0) { e = i + 1; break; } } } if (e !== -1) try { scores = JSON.parse(raw.substring(s, e)); } catch {} }
    if (!scores) { const jsonBlock = raw.match(/```json?\s*(\{[\s\S]*?\})\s*```/); if (jsonBlock) try { scores = JSON.parse(jsonBlock[1]); } catch {} }
    if (!scores) { const lineJson = raw.match(/^(\{.*"scores".*\})$/m); if (lineJson) try { scores = JSON.parse(lineJson[1]); } catch {} }
    if (!scores) {
      // 本文は出たがJSONが出なかった/壊れた場合でも、リライトだけは返す
      const mainM = raw.match(/\[MAIN\]\s*([\s\S]*?)\s*\[\/MAIN\]/);
      const replyM = raw.match(/\[REPLY\]\s*([\s\S]*?)\s*\[\/REPLY\]/);
      if (mainM || replyM) {
        return NextResponse.json({
          scores: null,
          rewrite: { main: mainM?.[1]?.trim() || "", reply: replyM?.[1]?.trim() || "" },
          hooks: "",
          partial: true,
        });
      }
      return NextResponse.json({ error: "スコアデータの解析に失敗しました。もう一度お試しください。" }, { status: 502 });
    }

    const mainMatch = raw.match(/\[MAIN\]\s*([\s\S]*?)\s*\[\/MAIN\]/);
    const replyMatch = raw.match(/\[REPLY\]\s*([\s\S]*?)\s*\[\/REPLY\]/);
    const hooksMatch = raw.match(/\[HOOKS\]\s*([\s\S]*?)\s*\[\/HOOKS\]/);
    const hooks = hooksMatch ? hooksMatch[1].trim() : "";

    return NextResponse.json({
      ...scores,
      rewrite: (mainMatch || replyMatch) ? { main: mainMatch?.[1]?.trim() || "", reply: replyMatch?.[1]?.trim() || "" } : null,
      hooks,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 });
  }
}
