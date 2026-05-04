// [変更: v2.5-StyleLearning] styleProfile対応追加
import { NextResponse } from "next/server";
import { SCORE_PROMPT, HOOK_CANDIDATES_INSTRUCTION, APPEAL_TO_POST_INSTRUCTION, buildStyleInstruction, buildKnowledgePriority, buildZuruiInstruction } from "../../prompts";

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY が設定されていません" }, { status: 500 });

  try {
    const { text, mode, useHook, styleProfile, knowledgePriority, isAppeal } = await request.json();
    if (!text?.trim()) return NextResponse.json({ error: "投稿文が空です" }, { status: 400 });

    let system = useHook ? SCORE_PROMPT + HOOK_CANDIDATES_INSTRUCTION : SCORE_PROMPT;
    if (isAppeal) system += APPEAL_TO_POST_INSTRUCTION;
    system += buildStyleInstruction(styleProfile);
    system += buildKnowledgePriority(knowledgePriority);
    if (useHook) system += buildZuruiInstruction(isAppeal ? "appeal" : "normal"); // [変更: v2.5]

    const userMessage = mode === "single"
      ? `以下のThreads投稿を採点してください。リライトは「本投稿のみ」モードで、10行以内で完結。[REPLY]タグは出力しないでください:\n\n${text}`
      : `以下のThreads投稿を採点してください。リライトは「本投稿＋リプ」モードで出力してください:\n\n${text}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 4000, system, messages: [{ role: "user", content: userMessage }] }),
    });

    if (!res.ok) return NextResponse.json({ error: `API error: ${res.status}` }, { status: 502 });
    const data = await res.json();
    const raw = data.content?.map((c) => c.text || "").join("") || "";

    // スコアJSON抽出（複数パターンに対応）
    let scores = null;
    // パターン1: {"scores" を探す
    const s = raw.indexOf('{"scores"');
    if (s !== -1) { let d = 0, e = -1; for (let i = s; i < raw.length; i++) { if (raw[i] === "{") d++; if (raw[i] === "}") { d--; if (d === 0) { e = i + 1; break; } } } if (e !== -1) try { scores = JSON.parse(raw.substring(s, e)); } catch {} }
    // パターン2: ```json ... ``` のコードブロック内
    if (!scores) { const jsonBlock = raw.match(/```json?\s*(\{[\s\S]*?\})\s*```/); if (jsonBlock) try { scores = JSON.parse(jsonBlock[1]); } catch {} }
    // パターン3: 行頭の { から始まるJSON
    if (!scores) { const lineJson = raw.match(/^(\{.*"scores".*\})$/m); if (lineJson) try { scores = JSON.parse(lineJson[1]); } catch {} }
    if (!scores) return NextResponse.json({ error: "スコアデータの解析に失敗しました。もう一度お試しください。" }, { status: 502 });

    const mainMatch = raw.match(/\[MAIN\]\s*([\s\S]*?)\s*\[\/MAIN\]/);
    const replyMatch = raw.match(/\[REPLY\]\s*([\s\S]*?)\s*\[\/REPLY\]/);

    // [変更: v2.2] ずるい一言の候補を抽出
    const hooksMatch = raw.match(/\[HOOKS\]\s*([\s\S]*?)\s*\[\/HOOKS\]/);
    const hooks = hooksMatch ? hooksMatch[1].trim() : "";

    return NextResponse.json({
      ...scores,
      rewrite: (mainMatch || replyMatch) ? { main: mainMatch?.[1]?.trim() || "", reply: replyMatch?.[1]?.trim() || "" } : null,
      hooks, // [変更: v2.2]
    });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 });
  }
}
