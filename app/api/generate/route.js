// [変更: v2.8-Nozzle] knowledgePriority対応追加
import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { B1_EXTRACT_PROMPT, B1_REEXTRACT_INSTRUCTION, B2_PROMPT, buildStyleInstruction, buildKnowledgePriority, buildZuruiInstruction } from "../../prompts";

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY が設定されていません" }, { status: 500 });

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const type = formData.get("type");
    const mode = formData.get("mode");
    const useHook = formData.get("useHook");
    const styleProfileText = formData.get("styleProfile");
    const knowledgePriorityText = formData.get("knowledgePriority");
    let knowledgePriority = null;
    try { knowledgePriority = knowledgePriorityText ? JSON.parse(knowledgePriorityText) : null; } catch {}

    if (!file) return NextResponse.json({ error: "ファイルがありません" }, { status: 400 });

    const ext = file.name.split(".").pop().toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    const previousAppeals = formData.get("previousAppeals") || "";

    // ═══════ Prompt Caching: 静的部分と動的部分を分離 ═══════
    let staticPrompt;
    let dynamicPrompt = "";

    if (type === "b2") {
      staticPrompt = B2_PROMPT;
      dynamicPrompt += buildZuruiInstruction("normal");
    } else if (type === "b1") {
      staticPrompt = B1_EXTRACT_PROMPT;
      if (previousAppeals) {
        dynamicPrompt += B1_REEXTRACT_INSTRUCTION + previousAppeals;
      }
    }
    dynamicPrompt += buildKnowledgePriority(knowledgePriority);

    // system をコンテンツブロック配列で送信（cache_control付き）
    const systemBlocks = [
      { type: "text", text: staticPrompt, cache_control: { type: "ephemeral" } },
    ];
    if (dynamicPrompt) {
      systemBlocks.push({ type: "text", text: dynamicPrompt });
    }

    let instruction;
    if (type === "b2") {
      instruction = "この記事を分析し、ゴースト投稿を5案生成してください。各案8〜12行、本投稿のみ。[REPLY]タグは出力しないでください。";
    } else if (type === "b1") {
      instruction = "この記事を多角的に分析し、投稿の素案を5つ抽出してください。";
    }

    let messages;
    if (ext === "pdf") {
      const b64 = buffer.toString("base64");
      messages = [{ role: "user", content: [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } },
        { type: "text", text: instruction },
      ] }];
    } else {
      let text;
      if (ext === "txt") {
        text = buffer.toString("utf-8");
      } else if (ext === "docx" || ext === "doc") {
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
        if (!text?.trim()) return NextResponse.json({ error: "文書からテキストを抽出できませんでした" }, { status: 400 });
      } else {
        return NextResponse.json({ error: "未対応の形式です（.txt .docx .pdf に対応）" }, { status: 400 });
      }
      messages = [{ role: "user", content: `${instruction}\n\n---記事の内容---\n${text}` }];
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 4096, system: systemBlocks, messages }),
    });

    if (!res.ok) return NextResponse.json({ error: `API error: ${res.status}` }, { status: 502 });
    const data = await res.json();
    const raw = data.content?.map((c) => c.text || "").join("") || "";

    const analysis = raw.match(/\[ANALYSIS\]\s*([\s\S]*?)\s*\[\/ANALYSIS\]/)?.[1]?.trim() || "";

    if (type === "b1") {
      // B1: 素案の抽出
      const appeals = [];
      for (let i = 1; i <= 5; i++) {
        const m = raw.match(new RegExp(`\\[APPEAL${i}\\]\\s*([\\s\\S]*?)\\s*\\[\\/APPEAL${i}\\]`))?.[1]?.trim();
        if (m) {
          const angle = m.match(/切り口[：:](.+)/)?.[1]?.trim() || "";
          const painPoint = m.match(/読者の痛点[：:](.+)/)?.[1]?.trim() || "";
          const infoGap = m.match(/情報ギャップ[：:](.+)/)?.[1]?.trim() || "";
          const appealText = m.match(/魅力要素[：:](.+)/)?.[1]?.trim() || "";
          const draftMatch = m.match(/素案[：:]\s*([\s\S]+)/);
          const draft = draftMatch ? draftMatch[1].trim() : "";
          appeals.push({ angle, painPoint, infoGap, appeal: appealText, content: draft || appealText || m, raw: m });
        }
      }
      if (appeals.length === 0) return NextResponse.json({ error: "素案の抽出に失敗しました" }, { status: 502 });
      return NextResponse.json({ analysis, appeals });
    } else {
      // B2: 投稿生成
      const posts = [];
      for (let i = 1; i <= 5; i++) {
        const main = raw.match(new RegExp(`\\[MAIN${i}\\]\\s*([\\s\\S]*?)\\s*\\[\\/MAIN${i}\\]`))?.[1]?.trim();
        const reply = raw.match(new RegExp(`\\[REPLY${i}\\]\\s*([\\s\\S]*?)\\s*\\[\\/REPLY${i}\\]`))?.[1]?.trim();
        if (main) posts.push({ main, reply: reply || "" });
      }
      if (posts.length === 0) return NextResponse.json({ error: "投稿が生成されませんでした" }, { status: 502 });
      return NextResponse.json({ analysis, posts });
    }
  } catch (e) {
    return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 });
  }
}
