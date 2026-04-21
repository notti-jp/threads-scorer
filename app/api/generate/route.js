// [変更: v2.2-ZuruiHitokoto] useHook対応追加
import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { B1_PROMPT, B2_PROMPT, HOOK_INSTRUCTION } from "../../prompts";

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY が設定されていません" }, { status: 500 });

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const type = formData.get("type"); // "b1" or "b2"
    const mode = formData.get("mode"); // "single" or "tree"
    const useHook = formData.get("useHook"); // [変更: v2.2]

    if (!file) return NextResponse.json({ error: "ファイルがありません" }, { status: 400 });

    const ext = file.name.split(".").pop().toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    // [変更: v2.2] B1でuseHook ONならHOOK_INSTRUCTIONを注入。B2には適用しない
    let prompt;
    if (type === "b2") {
      prompt = B2_PROMPT;
    } else {
      prompt = useHook === "true" ? B1_PROMPT + HOOK_INSTRUCTION : B1_PROMPT;
    }

    let instruction;
    if (type === "b2") {
      instruction = "この記事を分析し、ゴースト投稿を5案生成してください。各案8〜12行、本投稿のみ。[REPLY]タグは出力しないでください。";
    } else if (mode === "single") {
      instruction = "この記事を分析し、Threadsでの誘導投稿を「本投稿のみ」モードで5案生成してください。各案10行以内。[REPLY]タグは出力しないでください。";
    } else {
      instruction = "この記事を分析し、Threadsでの誘導投稿を「本投稿＋リプ」モードで5案生成してください。";
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
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 4096, system: prompt, messages }),
    });

    if (!res.ok) return NextResponse.json({ error: `API error: ${res.status}` }, { status: 502 });
    const data = await res.json();
    const raw = data.content?.map((c) => c.text || "").join("") || "";

    const analysis = raw.match(/\[ANALYSIS\]\s*([\s\S]*?)\s*\[\/ANALYSIS\]/)?.[1]?.trim() || "";
    const posts = [];
    for (let i = 1; i <= 5; i++) {
      const main = raw.match(new RegExp(`\\[MAIN${i}\\]\\s*([\\s\\S]*?)\\s*\\[\\/MAIN${i}\\]`))?.[1]?.trim();
      const reply = raw.match(new RegExp(`\\[REPLY${i}\\]\\s*([\\s\\S]*?)\\s*\\[\\/REPLY${i}\\]`))?.[1]?.trim();
      if (main) posts.push({ main, reply: reply || "" });
    }
    if (posts.length === 0) return NextResponse.json({ error: "投稿が生成されませんでした" }, { status: 502 });

    return NextResponse.json({ analysis, posts });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 });
  }
}
