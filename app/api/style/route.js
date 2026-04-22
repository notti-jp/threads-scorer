import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { STYLE_ANALYSIS_PROMPT } from "../../prompts";

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY が設定されていません" }, { status: 500 });

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file) return NextResponse.json({ error: "ファイルがありません" }, { status: 400 });

    const ext = file.name.split(".").pop().toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    const instruction = "この記事の文体・口調・表現パターンを分析してください。記事の内容ではなく「書き方」を抽出してください。";

    let messages;
    if (ext === "pdf") {
      const b64 = buffer.toString("base64");
      messages = [{ role: "user", content: [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } },
        { type: "text", text: instruction },
      ] }];
    } else {
      let text;
      if (ext === "txt") { text = buffer.toString("utf-8"); }
      else if (ext === "docx" || ext === "doc") {
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
        if (!text?.trim()) return NextResponse.json({ error: "テキスト抽出失敗" }, { status: 400 });
      } else {
        return NextResponse.json({ error: "未対応の形式です" }, { status: 400 });
      }
      messages = [{ role: "user", content: `${instruction}\n\n---記事の内容---\n${text}` }];
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 2000, system: STYLE_ANALYSIS_PROMPT, messages }),
    });

    if (!res.ok) return NextResponse.json({ error: `API error: ${res.status}` }, { status: 502 });
    const data = await res.json();
    const raw = data.content?.map(c => c.text || "").join("") || "";

    const m = raw.match(/\[STYLE\]\s*([\s\S]*?)\s*\[\/STYLE\]/);
    if (!m) return NextResponse.json({ error: "文体の抽出に失敗しました" }, { status: 502 });

    return NextResponse.json({ profile: m[1].trim() });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 });
  }
}
