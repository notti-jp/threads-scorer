// タブA専用：売りたいnoteの登録・構造化
//
// タブAは「どう書くか」の技法しか持たず、「このアカウントが何者で、何を信じ、どんな言葉で話すか」を
// 知らなかった。ここでユーザーのnote（4万字以上ある場合も）を1回だけ読み、投稿生成のたびに参照できる
// 1,200〜1,600字の構造カードに圧縮して保存する。
//   ・抽出は1回きり。入力4〜5万トークンで15〜20円程度。保存後は毎回この短いカードだけを渡す
//   ・1ユーザー1件（売りたいnoteは1本という前提）。登録し直すと上書き
//   ・有料記事はURLから取れないため、本文の貼り付けを主経路にする。URLは公開記事向けの補助
import { NextResponse } from "next/server";
import { NOTE_EXTRACT_PROMPT } from "../../prompts";
import { getDb } from "../../lib/db";

const MODEL = "claude-sonnet-5";
const MAX_INPUT_CHARS = 120000; // 約13万トークン。これを超える分は末尾を切る
const SUMMARY_MAX_CHARS = 2800;  // カードの上限（プロンプトでは本体2,000字＋受け皿の案を指示。超過時の保険）

// 公開noteのURLから本文を取る（/api/style と同じ簡易パーサー。あちらはB1/B2が使うため触らない）
function extractTextFromHTML(html) {
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<head[\s\S]*?<\/head>/gi, "");
  const articleMatch = text.match(/<div[^>]*class="[^"]*note-common-styles__textnote-body[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
    || text.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) text = articleMatch[1];
  text = text.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<\/div>/gi, "\n").replace(/<\/h[1-6]>/gi, "\n\n").replace(/<[^>]+>/g, "");
  text = text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, " ");
  return text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function titleFromHTML(html) {
  const m = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i)
    || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  let t = m ? m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : "";
  if (t.includes("｜")) t = t.split("｜")[0].trim();
  else if (t.includes("|")) t = t.split("|")[0].trim();
  return t.replace(/[\s\-\|]+note\s*$/i, "").trim();
}

// 登録済みのカードを返す（タブAの生成時と、画面表示の両方で使う）
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");
    if (!username) return NextResponse.json({ error: "ユーザー名が必要です" }, { status: 400 });
    const sql = getDb();
    const rows = await sql`
      SELECT title, source_url, summary, source_chars, updated_at
      FROM notes WHERE username = ${username} LIMIT 1
    `;
    return NextResponse.json({ note: rows[0] || null });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// 本文（またはURL）を受け取り、構造カードを作って保存する
export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY が設定されていません" }, { status: 500 });

  try {
    const { username, text, url, title: givenTitle } = await request.json();
    if (!username) return NextResponse.json({ error: "ユーザー名が必要です" }, { status: 400 });

    let body = (text || "").trim();
    let title = (givenTitle || "").trim();
    let sourceUrl = (url || "").trim();

    if (!body && sourceUrl) {
      try {
        const res = await fetch(sourceUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36", "Accept": "text/html", "Accept-Language": "ja,en;q=0.9" },
          redirect: "follow",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        body = extractTextFromHTML(html);
        if (!title) title = titleFromHTML(html);
      } catch (err) {
        return NextResponse.json({ error: `記事の取得に失敗しました（${err.message}）。有料記事はURLから取れないので、本文を貼り付けてください。` }, { status: 400 });
      }
    }

    if (!body || body.length < 300) {
      return NextResponse.json({ error: "本文が短すぎます（300文字以上）。noteの本文をそのまま貼り付けてください。" }, { status: 400 });
    }

    const sourceChars = body.length;
    if (body.length > MAX_INPUT_CHARS) body = body.slice(0, MAX_INPUT_CHARS) + "\n\n（以下省略）";

    // 1回きりの抽出。思考はOFF（Sonnet 5は省略すると自動でONになり出力単価で課金される）
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        thinking: { type: "disabled" },
        output_config: { effort: "high" },
        system: [{ type: "text", text: NOTE_EXTRACT_PROMPT }],
        messages: [{ role: "user", content: `以下のnote記事から構造カードを作ってください。${title ? `\n記事タイトル：${title}` : ""}\n本文の文字数：${sourceChars.toLocaleString("ja-JP")}字（「note自体の事実」の分量にはこの数字を使う）\n\n---記事本文---\n${body}` }],
      }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(`[apierr] note-extract status=${res.status} body=${errBody.slice(0, 300)}`);
      return NextResponse.json({ error: `API error: ${res.status}` }, { status: 502 });
    }
    const data = await res.json();
    const u = data.usage || {};
    console.log(`[usage] note-extract in=${u.input_tokens || 0} out=${u.output_tokens || 0} chars=${sourceChars}`);

    const raw = data.content?.map(c => c.text || "").join("") || "";
    const m = raw.match(/\[NOTE\]\s*([\s\S]*?)\s*\[\/NOTE\]/);
    if (!m) return NextResponse.json({ error: "構造の抽出に失敗しました。もう一度お試しください。" }, { status: 502 });
    let summary = m[1].trim();
    if (summary.length > SUMMARY_MAX_CHARS) summary = summary.slice(0, SUMMARY_MAX_CHARS);

    const sql = getDb();
    await sql`INSERT INTO users (username) VALUES (${username}) ON CONFLICT (username) DO NOTHING`;
    await sql`
      INSERT INTO notes (username, title, source_url, summary, source_chars, updated_at)
      VALUES (${username}, ${title || null}, ${sourceUrl || null}, ${summary}, ${sourceChars}, NOW())
      ON CONFLICT (username) DO UPDATE
        SET title = EXCLUDED.title, source_url = EXCLUDED.source_url, summary = EXCLUDED.summary,
            source_chars = EXCLUDED.source_chars, updated_at = NOW()
    `;

    return NextResponse.json({ note: { title: title || null, source_url: sourceUrl || null, summary, source_chars: sourceChars, updated_at: new Date().toISOString() } });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");
    if (!username) return NextResponse.json({ error: "ユーザー名が必要です" }, { status: 400 });
    const sql = getDb();
    await sql`DELETE FROM notes WHERE username = ${username}`;
    return NextResponse.json({ result: "ok" });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
