// [変更: v3.0-PromptCaching] Prompt Caching対応
import { NextResponse } from "next/server";
import { SCORE_PROMPT, HOOK_CANDIDATES_INSTRUCTION, APPEAL_TO_POST_INSTRUCTION, buildStyleInstruction, buildKnowledgePriority, buildZuruiInstruction } from "../../prompts";

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY が設定されていません" }, { status: 500 });

  try {
    const { text, mode, useHook, styleProfile, knowledgePriority, isAppeal } = await request.json();
    if (!text?.trim()) return NextResponse.json({ error: "投稿文が空です" }, { status: 400 });

    // ═══════ Prompt Caching: 静的部分と動的部分を分離 ═══════
    // 静的部分（SCORE_PROMPT = SHARED_KNOWLEDGE含む）→ キャッシュ対象（90%コスト削減）
    const staticPrompt = useHook ? SCORE_PROMPT + HOOK_CANDIDATES_INSTRUCTION : SCORE_PROMPT;

    // 動的部分（毎回変わる）→ キャッシュ対象外
    let dynamicPrompt = "";
    if (isAppeal) dynamicPrompt += APPEAL_TO_POST_INSTRUCTION;
    dynamicPrompt += buildStyleInstruction(styleProfile);
    dynamicPrompt += buildKnowledgePriority(knowledgePriority);
    if (useHook) dynamicPrompt += buildZuruiInstruction(isAppeal ? "appeal" : "normal");

    // system をコンテンツブロック配列で送信（cache_control付き）
    const systemBlocks = [
      { type: "text", text: staticPrompt, cache_control: { type: "ephemeral" } },
    ];
    if (dynamicPrompt) {
      systemBlocks.push({ type: "text", text: dynamicPrompt });
    }

    const userMessage = mode === "single"
      ? `以下のThreads投稿を採点してください。リライトは「本投稿のみ」モードで、10行以内で完結。[REPLY]タグは出力しないでください:\n\n${text}`
      : `以下のThreads投稿を採点してください。リライトは「本投稿＋リプ」モードで出力してください:\n\n${text}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
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
    if (!scores) return NextResponse.json({ error: "スコアデータの解析に失敗しました。もう一度お試しください。" }, { status: 502 });

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
