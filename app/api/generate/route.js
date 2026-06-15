// [変更: v3.2-URLInput] URL入力対応追加
import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { B1_EXTRACT_PROMPT, B1_REEXTRACT_INSTRUCTION, B2_PROMPT, buildStyleInstruction, buildKnowledgePriority, buildZuruiInstruction } from "../../prompts";

// HTMLからテキストを抽出（note.com対応・精密版）
function extractTextFromHTML(html) {
  // 不要なタグを先に除去
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<head[\s\S]*?<\/head>/gi, "");
  text = text.replace(/<nav[\s\S]*?<\/nav>/gi, "");
  text = text.replace(/<footer[\s\S]*?<\/footer>/gi, "");
  text = text.replace(/<header[\s\S]*?<\/header>/gi, "");
  text = text.replace(/<aside[\s\S]*?<\/aside>/gi, "");
  // コメント欄・関連記事・サイドバーを除去
  text = text.replace(/<div[^>]*class="[^"]*comment[^"]*"[\s\S]*?<\/div>/gi, "");
  text = text.replace(/<div[^>]*class="[^"]*sidebar[^"]*"[\s\S]*?<\/div>/gi, "");
  text = text.replace(/<div[^>]*class="[^"]*recommend[^"]*"[\s\S]*?<\/div>/gi, "");
  text = text.replace(/<div[^>]*class="[^"]*footer[^"]*"[\s\S]*?<\/div>/gi, "");
  text = text.replace(/<div[^>]*class="[^"]*header[^"]*"[\s\S]*?<\/div>/gi, "");
  text = text.replace(/<div[^>]*class="[^"]*share[^"]*"[\s\S]*?<\/div>/gi, "");
  text = text.replace(/<div[^>]*class="[^"]*creator[^"]*"[\s\S]*?<\/div>/gi, "");
  text = text.replace(/<div[^>]*class="[^"]*magazine[^"]*"[\s\S]*?<\/div>/gi, "");

  // note本文を優先的に抽出（複数パターン対応）
  const articleMatch = text.match(/<div[^>]*class="[^"]*note-common-styles__textnote-body[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
    || text.match(/<div[^>]*class="[^"]*p-article__body[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
    || text.match(/<div[^>]*class="[^"]*note-body[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
    || text.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) text = articleMatch[1];

  // HTMLタグをテキストに変換
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n\n");
  text = text.replace(/<\/div>/gi, "\n");
  text = text.replace(/<\/h[1-6]>/gi, "\n\n");
  text = text.replace(/<[^>]+>/g, "");
  text = text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, " ");
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY が設定されていません" }, { status: 500 });

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const noteUrl = formData.get("noteUrl") || "";
    const type = formData.get("type");
    const mode = formData.get("mode");
    const useHook = formData.get("useHook");
    const styleProfileText = formData.get("styleProfile");
    const knowledgePriorityText = formData.get("knowledgePriority");
    let knowledgePriority = null;
    try { knowledgePriority = knowledgePriorityText ? JSON.parse(knowledgePriorityText) : null; } catch {}

    const previousAppeals = formData.get("previousAppeals") || "";
    const lineBreak = formData.get("lineBreak") || "true";

    // ═══════ 記事テキストの取得（URL or ファイル）═══════
    let articleText = "";
    let isPdf = false;
    let pdfB64 = "";

    if (noteUrl.trim()) {
      // URL入力の場合：note APIから本文取得を試み、失敗したらHTML取得にフォールバック
      try {
        const url = noteUrl.trim();

        // noteのURLからキーを抽出
        let noteKey = "";
        let accessKey = "";
        const previewMatch = url.match(/note\.com\/preview\/(n[a-f0-9]+)/);
        const normalMatch = url.match(/note\.com\/[^/]+\/n\/(n[a-f0-9]+)/);
        if (previewMatch) {
          noteKey = previewMatch[1];
          const akMatch = url.match(/prev_access_key=([^&]+)/);
          if (akMatch) accessKey = akMatch[1];
        } else if (normalMatch) {
          noteKey = normalMatch[1];
        }

        // 方法1: note API（JSON）で本文取得を試行
        if (noteKey) {
          try {
            const apiUrl = accessKey
              ? `https://note.com/api/v3/notes/${noteKey}?preview=true&prev_access_key=${accessKey}`
              : `https://note.com/api/v3/notes/${noteKey}`;
            const apiRes = await fetch(apiUrl, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "application/json",
              },
            });
            if (apiRes.ok) {
              const json = await apiRes.json();
              const body = json?.data?.body || json?.data?.note?.body || "";
              if (body) {
                // HTMLタグを除去してプレーンテキストに
                articleText = body.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/\n{3,}/g, "\n\n").trim();
              }
            }
          } catch {}
        }

        // 方法2: APIで取れなかった場合、HTMLページから取得
        if (!articleText || articleText.length < 50) {
          const fetchRes = await fetch(url, {
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
        }

        if (!articleText || articleText.length < 50) {
          return NextResponse.json({ error: "記事を読み込めませんでした。ファイルアップロードをお試しください" }, { status: 400 });
        }
        // URL取得時はメニュー等のゴミが含まれがちなので、本文15000文字で切る
        if (articleText.length > 15000) {
          articleText = articleText.slice(0, 15000);
        }
      } catch (e) {
        return NextResponse.json({ error: "記事を読み込めませんでした。ファイルアップロードをお試しください" }, { status: 400 });
      }
    } else if (file) {
      // ファイルアップロードの場合
      const ext = file.name.split(".").pop().toLowerCase();
      const buffer = Buffer.from(await file.arrayBuffer());
      if (ext === "pdf") {
        isPdf = true;
        pdfB64 = buffer.toString("base64");
      } else if (ext === "txt") {
        articleText = buffer.toString("utf-8");
        if (articleText.length > 15000) articleText = articleText.slice(0, 15000);
      } else if (ext === "docx" || ext === "doc") {
        const result = await mammoth.extractRawText({ buffer });
        articleText = result.value;
        if (!articleText?.trim()) return NextResponse.json({ error: "文書からテキストを抽出できませんでした" }, { status: 400 });
        if (articleText.length > 15000) articleText = articleText.slice(0, 15000);
      } else {
        return NextResponse.json({ error: "未対応の形式です（.txt .docx .pdf に対応）" }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: "URLまたはファイルを入力してください" }, { status: 400 });
    }

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
      if (lineBreak === "true") {
        instruction = "この記事を分析し、ゴースト投稿を5案生成してください。各案200文字以内、本投稿のみ。[REPLY]タグは出力しないでください。\n\n【改行ルール】ゴースト投稿はスマホでの表示幅が通常投稿より狭いため、1行は最大17文字で改行してください。段落と段落の間は「　」（全角スペース1文字だけの行）を1行だけ入れてください。空行（何もない行）は入れないでください。2行以上の空白は絶対に作らないでください。1つの段落は2〜4行程度。全体で6〜10行にしてください。";
      } else {
        instruction = "この記事を分析し、ゴースト投稿を5案生成してください。各案200文字以内、本投稿のみ。[REPLY]タグは出力しないでください。\n\n【改行ルール】改行を一切入れないでください。1つの段落として、途切れなく続く文章にしてください。句読点でつなげて、一気に読ませる構成にしてください。";
      }
    } else if (type === "b1") {
      instruction = "この記事を多角的に分析し、投稿の素案を5つ抽出してください。";
    }

    let messages;
    if (isPdf) {
      messages = [{ role: "user", content: [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfB64 } },
        { type: "text", text: instruction },
      ] }];
    } else {
      messages = [{ role: "user", content: `${instruction}\n\n---記事の内容---\n${articleText}` }];
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-6-20250217", max_tokens: 16000, system: systemBlocks, messages }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      if (res.status === 529) return NextResponse.json({ error: "APIが一時的に混雑しています。少し待ってから再度ボタンを押してください" }, { status: 502 });
      return NextResponse.json({ error: `API error: ${res.status} ${errBody.slice(0, 200)}` }, { status: 502 });
    }
    const data = await res.json();
    const raw = data.content?.map((c) => c.text || "").join("") || "";

    if (!raw) return NextResponse.json({ error: `AIからの応答が空です。stop_reason: ${data.stop_reason || "不明"}` }, { status: 502 });

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
      if (appeals.length === 0) return NextResponse.json({ error: `素案の抽出に失敗しました。URLで読み込めない場合は、記事のテキストファイル（.txt）をアップロードしてお試しください（記事${articleText?.length || 0}文字、API応答${raw?.length || 0}文字）` }, { status: 502 });
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
