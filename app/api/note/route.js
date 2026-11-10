// タブA専用：売りたいnoteの登録・構造化
//
// タブAは「どう書くか」の技法しか持たず、「このアカウントが何者で、何を信じ、どんな言葉で話すか」を
// 知らなかった。ここでユーザーのnote（4万字以上ある場合も）を1回だけ読み、投稿生成のたびに参照できる
// 1,200〜1,600字の構造カードに圧縮して保存する。
//   ・抽出は1回きり。入力4〜5万トークンで15〜20円程度。保存後は毎回この短いカードだけを渡す
//   ・1ユーザー1件（売りたいnoteは1本という前提）。登録し直すと上書き
//   ・URLを主経路にする。有料noteは「複製 → 共有リンクをコピー」で作った共有リンクなら全文が読める
//     （ユーザーにコピペさせるのは4万字だと非現実的なため）。本文の貼り付けは予備
import { NextResponse } from "next/server";
import { NOTE_EXTRACT_PROMPT } from "../../prompts";
import { getDb } from "../../lib/db";

const MODEL = "claude-sonnet-5";
const MAX_INPUT_CHARS = 120000; // 約13万トークン。これを超える分は末尾を切る
const SUMMARY_MAX_CHARS = 2800;  // カードの上限（プロンプトでは本体2,000字＋受け皿の案を指示。超過時の保険）

// 有料記事の公開ページ（共有リンクではないURL）に出る、続きが有料であることを示す文言。
// これがあると無料部分しか取れていないので、共有リンクを使うよう案内する
const PAYWALL_MARKERS = ["この続きをみるには", "この続きを見るには"];

// 開始タグから、対応する閉じタグまでを返す。
// ★以前は /<div ...>([\s\S]*?)<\/div>/ で「最初の </div>」までを取っていたため、
//   本文の中に入れ子の <div>（見出し・画像・埋め込み）があるとそこで途切れていた。
//   文体学習（8,000字まで）では目立たなかったが、4万字の記事を丸ごと読むここでは致命的なので、
//   <div> の入れ子の深さを数えて本当の閉じタグを探す
function sliceBalancedDiv(html, startRe) {
  const m = startRe.exec(html);
  if (!m) return null;
  const from = m.index + m[0].length;
  const tagRe = /<\/?div\b[^>]*>/gi;
  tagRe.lastIndex = from;
  let depth = 1;
  let t;
  while ((t = tagRe.exec(html))) {
    if (t[0][1] === "/") {
      depth--;
      if (depth === 0) return html.slice(from, t.index);
    } else if (!t[0].endsWith("/>")) {
      depth++;
    }
  }
  return html.slice(from); // 閉じタグが見つからなければ最後まで
}

function htmlToText(fragment) {
  let text = fragment.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<\/div>/gi, "\n").replace(/<\/h[1-6]>/gi, "\n\n").replace(/<\/li>/gi, "\n").replace(/<[^>]+>/g, "");
  text = text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
  return text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

// noteのURLから本文を取る（/api/style にも似た処理があるが、あちらはB1/B2が使うため触らない）
function extractTextFromHTML(html) {
  const cleaned = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<head[\s\S]*?<\/head>/gi, "");
  const body = sliceBalancedDiv(cleaned, /<div[^>]*class="[^"]*note-common-styles__textnote-body[^"]*"[^>]*>/i);
  if (body) return htmlToText(body);
  const article = cleaned.match(/<article[^>]*>([\s\S]*)<\/article>/i);
  return htmlToText(article ? article[1] : cleaned);
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

    const pasted = (text || "").trim();
    let body = "";
    let title = (givenTitle || "").trim();
    let sourceUrl = (url || "").trim();

    // URLが主経路。入っていればURLを優先し、貼り付けた本文は予備として使う
    if (sourceUrl) {
      let urlError = "";
      try {
        const res = await fetch(sourceUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36", "Accept": "text/html", "Accept-Language": "ja,en;q=0.9" },
          redirect: "follow",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        if (PAYWALL_MARKERS.some(w => html.includes(w))) {
          urlError = "このURLは有料記事の公開ページなので、無料の部分しか読み込めません。有料noteは、画面の手順で作った「共有リンク」のURLを入力してください。";
        } else {
          body = extractTextFromHTML(html);
          if (!title) title = titleFromHTML(html);
          if (body.length < 300) urlError = "このURLから本文を読み込めませんでした。共有リンクのURLか確認してください。";
        }
      } catch (err) {
        urlError = `記事の取得に失敗しました（${err.message}）。URLが正しいか確認してください。`;
      }
      if (urlError) {
        // 本文も貼られていれば、そちらで続ける。無ければURLのエラーを返す
        if (pasted.length >= 300) { body = pasted; sourceUrl = ""; }
        else return NextResponse.json({ error: urlError }, { status: 400 });
      }
    } else {
      body = pasted;
    }

    if (!body || body.length < 300) {
      return NextResponse.json({ error: "本文が短すぎます（300文字以上）。noteのURLを入力するか、本文をそのまま貼り付けてください。" }, { status: 400 });
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
