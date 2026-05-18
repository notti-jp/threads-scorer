// [変更: v2.7] サーバー側でURL取得→文体分析
import { NextResponse } from "next/server";
import { STYLE_ANALYSIS_PROMPT } from "../../prompts";

// HTMLからテキストを抽出（簡易パーサー）
function extractTextFromHTML(html) {
  // script, style, head を除去
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<head[\s\S]*?<\/head>/gi, "");
  
  // note.comの記事本文を優先的に抽出
  const articleMatch = text.match(/<div[^>]*class="[^"]*note-common-styles__textnote-body[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
    || text.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
    || text.match(/<div[^>]*class="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  
  if (articleMatch) {
    text = articleMatch[1];
  }
  
  // HTMLタグを除去
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n\n");
  text = text.replace(/<\/div>/gi, "\n");
  text = text.replace(/<\/h[1-6]>/gi, "\n\n");
  text = text.replace(/<[^>]+>/g, "");
  
  // HTMLエンティティをデコード
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#039;/g, "'");
  text = text.replace(/&nbsp;/g, " ");
  
  // 余分な空白を整理
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.trim();
  
  return text;
}

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY が設定されていません" }, { status: 500 });

  try {
    const { url } = await request.json();
    if (!url?.trim()) return NextResponse.json({ error: "URLが空です" }, { status: 400 });

    // ステップ1：URLからHTML取得
    let articleText = "";
    let pageTitle = "";
    try {
      const fetchRes = await fetch(url.trim(), {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "ja,en;q=0.9",
        },
        redirect: "follow",
      });
      
      if (!fetchRes.ok) throw new Error(`HTTP ${fetchRes.status}`);
      const html = await fetchRes.text();
      articleText = extractTextFromHTML(html);
      
      // ページタイトルを抽出（複数のパターンに対応）
      const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["'][^>]*>/i)
        || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:title["'][^>]*>/i);
      const htmlTitleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      const titleMatch = ogTitleMatch || htmlTitleMatch || h1Match;
      pageTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, " ").trim() : "";
      // note.comのタイトル形式「タイトル｜著者名｜note」からタイトル部分だけ抽出
      if (pageTitle.includes("｜")) {
        pageTitle = pageTitle.split("｜")[0].trim();
      } else if (pageTitle.includes("|")) {
        pageTitle = pageTitle.split("|")[0].trim();
      }
      // 「- note」「| note」で終わる場合も除去
      pageTitle = pageTitle.replace(/[\s\-\|]+note\s*$/i, "").trim();
    } catch (fetchErr) {
      return NextResponse.json({ 
        error: `記事の取得に失敗しました（${fetchErr.message}）。URLが正しいか、記事が公開されているか確認してください。` 
      }, { status: 400 });
    }

    if (!articleText || articleText.length < 100) {
      return NextResponse.json({ 
        error: "記事の本文を取得できませんでした。有料記事や非公開記事の場合は取得できません。" 
      }, { status: 400 });
    }

    // 長すぎる場合は先頭を使用（トークン制限対策）
    if (articleText.length > 8000) {
      articleText = articleText.slice(0, 8000) + "\n\n（以下省略）";
    }

    // ステップ2：Claude APIで文体分析
    const instruction = `以下の記事の文体・口調・表現パターンを分析してください。記事の「内容」ではなく「書き方」を抽出してください。\n\n---記事の内容---\n${articleText}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: [{ type: "text", text: STYLE_ANALYSIS_PROMPT, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: instruction }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `API error: ${res.status}` }, { status: 502 });
    }
    
    const data = await res.json();
    const raw = data.content?.map(c => c.text || "").join("") || "";

    const m = raw.match(/\[STYLE\]\s*([\s\S]*?)\s*\[\/STYLE\]/);
    if (!m) return NextResponse.json({ error: "文体の抽出に失敗しました。別の記事で試してみてください。" }, { status: 502 });

    return NextResponse.json({ profile: m[1].trim(), title: pageTitle || "" });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 });
  }
}
