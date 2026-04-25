// [変更: v2.6] URL入力による文体学習
import { NextResponse } from "next/server";
import { STYLE_ANALYSIS_PROMPT } from "../../prompts";

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY が設定されていません" }, { status: 500 });

  try {
    const { url } = await request.json();
    if (!url?.trim()) return NextResponse.json({ error: "URLが空です" }, { status: 400 });

    const instruction = `以下のURLの記事を読んで、文体・口調・表現パターンを分析してください。記事の内容ではなく「書き方」を抽出してください。\n\nURL: ${url.trim()}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2500,
        system: STYLE_ANALYSIS_PROMPT,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: instruction }],
      }),
    });

    if (!res.ok) return NextResponse.json({ error: `API error: ${res.status}` }, { status: 502 });
    const data = await res.json();
    const raw = data.content?.map(c => c.text || "").join("") || "";

    const m = raw.match(/\[STYLE\]\s*([\s\S]*?)\s*\[\/STYLE\]/);
    if (!m) return NextResponse.json({ error: "文体の抽出に失敗しました。URLが正しいか確認してください。" }, { status: 502 });

    return NextResponse.json({ profile: m[1].trim() });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 });
  }
}
