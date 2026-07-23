// [変更: v4.0-AgentLoop] 自動改善ループ（生成→検査→再生成）対応
import { NextResponse } from "next/server";
import { SCORE_PROMPT, HOOK_CANDIDATES_INSTRUCTION, APPEAL_TO_POST_INSTRUCTION, buildStyleInstruction, buildKnowledgePriority, buildZuruiInstruction } from "../../prompts";
import { getDb } from "../../lib/db";

// ═══════ コード側チェック（0円・確実に弾く） ═══════
const NG_PATTERNS = [
  { re: /稼ぐ|稼げ|稼い/, label: "禁止ワード「稼ぐ／稼げる」" },
  { re: /儲か/, label: "禁止ワード「儲かる」" },
  { re: /高収入/, label: "禁止ワード「高収入」" },
  { re: /即金/, label: "禁止ワード「即金」" },
  { re: /副業/, label: "禁止ワード「副業」" },
  { re: /LINE追加/, label: "禁止ワード「LINE追加」" },
];

function countLines(text) {
  // 全角スペースだけの行（段落区切り）は行数に含めない
  return text.split("\n").filter(l => l.trim() !== "" && l !== "　").length;
}

function codeCheck(main, reply, mode, reply2) {
  const issues = [];
  const whole = `${main}\n${reply || ""}\n${reply2 || ""}`;

  // 禁止ワード
  for (const p of NG_PATTERNS) {
    if (p.re.test(whole)) issues.push(`${p.label}が含まれている。言い換えること（例：稼ぐ→収益化する、副業→本業のあいまに）`);
  }

  // 行数チェック
  const mainLines = countLines(main);
  const replyLines = reply ? countLines(reply) : 0;
  if (mode === "single" && mainLines > 8) issues.push(`本投稿が${mainLines}行ある。8行以内に収めること`);
  if (mode === "singleShort" && mainLines > 5) issues.push(`本投稿が${mainLines}行ある。5行以内に収めること`);
  if ((mode === "tree" || mode === "treeAuto") && mainLines > 3) issues.push(`本投稿が${mainLines}行ある。2〜3行に収めること`);
  if (mode === "tree" && replyLines > 10) issues.push(`リプが${replyLines}行ある。10行以内に収めること`);
  if (mode === "treeAuto" && replyLines > 12) issues.push(`リプ1が${replyLines}行ある。12行以内に収め、残りは[REPLY2]に分割すること`);
  if ((mode === "tree" || mode === "treeAuto") && mainLines === 1) issues.push(`本投稿が1行だけになっている。2〜3行にしてフックとしての厚みを持たせること`);

  // 締めの「…」チェック（投稿全体の締め＝singleは本投稿末尾、treeはリプ末尾）
  const closing = (mode === "tree" || mode === "treeAuto") ? ((reply2 || "").trim() || (reply || "").trim()) : main.trim();
  if (/[…]{1,}。?$/.test(closing)) issues.push(`投稿の締めが「…」で終わっている。言い切りで着地させること`);

  return issues;
}

// ═══════ AI審査（Haiku・軽量） ═══════
async function aiReview(apiKey, main, reply, mode, reply2) {
  const target = reply ? `【本投稿】\n${main}\n\n【リプ】\n${reply}${reply2 ? `\n\n【リプ2】\n${reply2}` : ""}` : `【本投稿】\n${main}`;
  const reviewPrompt = `あなたはThreads投稿の品質審査員です。以下の投稿を審査し、JSON形式のみで回答してください。

審査基準：
1. 1行目が挨拶・自己紹介・「〜な人へ」のような対象説明で始まっていないか（フックとして弱くないか）
2. AIが書いたような不自然さがないか：全文が同じ長さの文の羅列／「しかし」「また」「そして」等の接続詞が2回以上／同じ語尾が3連続以上
3. 抽象語（「大切」「重要」「本質」）だけで内容が薄くないか
4. 読者視点で読み直したとき、投稿の序盤〜中盤（全体の前半6割まで）に「ここで読むのをやめる」と明確に言える箇所がないか。該当するのは、話が急に抽象的になって何の話か分からなくなる／同じ内容の繰り返しで先に進まない／前置きや説明が続いて結論が一向に来ない、など。※終盤（後半4割）の細かい粗さは指摘しない。※「もっと良くできる」程度の改善余地は指摘しない。読者が離脱すると断言できる箇所だけを指摘する
5. 主張が立っているか。「世間ではこう言われているが実際は違う」という対立構造や、著者独自の立場が読み取れるか。誰でも書ける平凡な解説・一般論の紹介で終わっていないか。※対立構造そのものは必須ではないが、この投稿ならではの主張が1つも見当たらない場合は指摘する
6. 【リプがある場合のみ】ツリー全体の一貫性。次の3点を確認：(a)本投稿が立てた問い・話題に、リプが正面から答えているか（本投稿と無関係な話をリプで始めていないか）／(b)リプ①とリプ②がある場合、リプ①の最後とリプ②の最初が自然につながっているか（話が飛んでいないか）／(c)本投稿の1行目から最後のリプの締めまでを通して読んだとき、1つの話として筋が通っているか。1つでも壊れていたら具体的に指摘する

出力形式（この形式のみ。他の文章は一切書かない）：
{"pass": true または false, "issues": ["問題点1", "問題点2"]}

問題がなければ {"pass": true, "issues": []} と返す。
基準4を指摘する場合は、該当箇所を短く引用し、なぜ読者が離れるかを添えること。

審査対象：
${target}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 700,
        messages: [{ role: "user", content: reviewPrompt }],
      }),
    });
    if (!res.ok) return { pass: true, issues: [] }; // 審査APIの失敗は生成を止めない
    const data = await res.json();
    const raw = data.content?.map((c) => c.text || "").join("") || "";
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return { pass: true, issues: [] };
    const parsed = JSON.parse(m[0]);
    return { pass: !!parsed.pass, issues: Array.isArray(parsed.issues) ? parsed.issues.slice(0, 4) : [] };
  } catch {
    return { pass: true, issues: [] };
  }
}

// ═══════ レスポンス解析 ═══════
function parseResult(raw) {
  let scores = null;
  const s = raw.indexOf('{"scores"');
  if (s !== -1) { let d = 0, e = -1; for (let i = s; i < raw.length; i++) { if (raw[i] === "{") d++; if (raw[i] === "}") { d--; if (d === 0) { e = i + 1; break; } } } if (e !== -1) try { scores = JSON.parse(raw.substring(s, e)); } catch {} }
  if (!scores) { const jsonBlock = raw.match(/```json?\s*(\{[\s\S]*?\})\s*```/); if (jsonBlock) try { scores = JSON.parse(jsonBlock[1]); } catch {} }
  if (!scores) { const lineJson = raw.match(/^(\{.*"scores".*\})$/m); if (lineJson) try { scores = JSON.parse(lineJson[1]); } catch {} }
  const mainMatch = raw.match(/\[MAIN\]\s*([\s\S]*?)\s*\[\/MAIN\]/);
  const replyMatch = raw.match(/\[REPLY\]\s*([\s\S]*?)\s*\[\/REPLY\]/);
  const reply2Match = raw.match(/\[REPLY2\]\s*([\s\S]*?)\s*\[\/REPLY2\]/);
  const hooksMatch = raw.match(/\[HOOKS\]\s*([\s\S]*?)\s*\[\/HOOKS\]/);
  return {
    scores,
    main: mainMatch?.[1]?.trim() || "",
    reply: replyMatch?.[1]?.trim() || "",
    reply2: reply2Match?.[1]?.trim() || "",
    hooks: hooksMatch ? hooksMatch[1].trim() : "",
  };
}

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY が設定されていません" }, { status: 500 });

  try {
    const { text, mode, useHook, styleProfile, knowledgePriority, isAppeal, username } = await request.json();
    if (!text?.trim()) return NextResponse.json({ error: "投稿文が空です" }, { status: 400 });

    // ═══════ Prompt Caching: 静的部分と動的部分を分離 ═══════
    const staticPrompt = useHook ? SCORE_PROMPT + HOOK_CANDIDATES_INSTRUCTION : SCORE_PROMPT;

    let dynamicPrompt = "";
    if (isAppeal) dynamicPrompt += APPEAL_TO_POST_INSTRUCTION;
    dynamicPrompt += buildStyleInstruction(styleProfile);
    dynamicPrompt += buildKnowledgePriority(knowledgePriority);
    if (useHook) dynamicPrompt += buildZuruiInstruction(isAppeal ? "appeal" : "normal");

    // ═══════ 成功事例の参照（フィードバックDBから上位3件）═══════
    if (username) {
      try {
        const sql = getDb();
        const successPosts = await sql`
          SELECT main_post FROM feedbacks
          WHERE username = ${username} AND views > 0 AND likes > 0
          ORDER BY (likes + comments * 2.0) / views DESC
          LIMIT 3
        `;
        if (successPosts.length > 0) {
          dynamicPrompt += "\n\n【あなたの過去の成功投稿（参考）】\n";
          dynamicPrompt += "以下はこのユーザーの過去の投稿のうち、エンゲージメント率が高かったものです。\n";
          dynamicPrompt += "文体・構成・トーン・リズムを参考にして、リライトに活かしてください。\n";
          dynamicPrompt += "ただし、内容をコピーしたり混ぜたりしないこと。あくまで「書き方」の参考として使うこと。\n\n";
          successPosts.forEach((p, i) => {
            const truncated = (p.main_post || "").slice(0, 200);
            dynamicPrompt += `成功例${i + 1}：${truncated}\n\n`;
          });
        }
      } catch {}
    }

    const systemBlocks = [
      { type: "text", text: staticPrompt, cache_control: { type: "ephemeral" } },
    ];
    if (dynamicPrompt) {
      systemBlocks.push({ type: "text", text: dynamicPrompt });
    }

    const modeInstructions = {
      single: `以下のThreads投稿を採点してください。リライトは「本投稿のみ」モードで、8行以内で完結。[REPLY]タグは出力しないでください`,
      singleShort: `以下のThreads投稿を採点してください。リライトは「本投稿のみ・短縮版」モードで、必ず5行以内で完結させること。短いながらも冒頭のフックと具体性は維持する。[REPLY]タグは出力しないでください`,
      tree: `以下のThreads投稿を採点してください。リライトは「本投稿＋リプ」モードで出力してください。まず「この投稿全体で伝える気づき」を1行で内部的に決めてから、本投稿=問い／リプ=答えと着地、という1つの話の流れとして書くこと（ツリー全体の一貫性設計に従う）。本投稿は2〜3行（1行だけにせず、フックとして成立する厚みを残す)、リプは原則10行以内に収めること。リプの1行目は前置きを入れず、答えそのもの／リストの1行目／読者の心の声のどれかで即座に書き出すこと（2行目以降は通常どおり展開）。リプは必ず2〜3行ごとに段落を分け、段落と段落の間に「　」（全角スペース1文字だけの行）を入れて読みやすくすること。この区切り行は行数に数えない`,
      treeAuto: `以下のThreads投稿を採点してください。リライトは「本投稿＋リプ・元の長さに合わせる」モードで出力してください。まず「この投稿全体で伝える気づき」を1行で内部的に決めてから、本投稿=問い／リプ=答えと着地、という1つの話の流れとして書くこと（ツリー全体の一貫性設計に従う）。本投稿は2〜3行（1行だけにせず、フックとして成立する厚みを残す）。★リプの長さは行数を固定せず、入力された元の投稿文の情報量に合わせること：元が短ければリプも短く（無理に引き伸ばさない）、元が長く内容が濃ければリプも長くしてよい。★★最重要：リプの本文が合計13行以上になる場合は、絶対に1つのリプにまとめず、必ず[REPLY]と[REPLY2]の2つのタグに分割して出力すること。[REPLY]に12行程度まで入れ、意味の区切りのよいところで区切って、残りを[REPLY2]に入れる。Threadsは長すぎる投稿を途中で「…」と省略してしまうため、13行以上を1つのリプにするのは必ず避けること。リプが12行以内に収まる場合のみ[REPLY]だけを出力し、[REPLY2]は出力しない。リプの1行目は前置きを入れず、答えそのもの／リストの1行目／読者の心の声のどれかで即座に書き出すこと（2行目以降は通常どおり展開）。[REPLY2]がある場合、その1行目も自然に続きから始める。★[REPLY]（リプ①）の最後は言い切って完結させず、リプ②を自然に読みたくなる状態で終えること（「続きは↓」のような浅い誘導は禁止。内容の力で続きを読ませる。例：核心の直前で止めてリプ②冒頭で即答する／リストの途中で切り「残りが一番効く」と示す）。リプは必ず2〜3行ごとに段落を分け、段落と段落の間に「　」（全角スペース1文字だけの行）を入れて読みやすくすること。この区切り行は行数に数えない`,
    };
    const baseUserMessage = `${modeInstructions[mode] || modeInstructions.tree}:\n\n${text}`;

    // ═══════ 生成関数（リトライ時は指摘を追加） ═══════
    const generateOnce = async (retryIssues) => {
      let userMessage = baseUserMessage;
      if (retryIssues && retryIssues.length > 0) {
        userMessage += `\n\n【重要：前回の生成には以下の問題があった。すべて修正して再生成すること】\n${retryIssues.map((i, n) => `${n + 1}. ${i}`).join("\n")}`;
      }
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 12000,
          system: systemBlocks,
          messages: [{ role: "user", content: userMessage }],
        }),
      });
      if (!res.ok) {
        if (res.status === 529) throw Object.assign(new Error("APIが一時的に混雑しています。少し待ってから再度ボタンを押してください"), { status: 502 });
        throw Object.assign(new Error(`API error: ${res.status}`), { status: 502 });
      }
      const data = await res.json();
      return data.content?.map((c) => c.text || "").join("") || "";
    };

    // ═══════ エージェントループ：生成 → 検査 → 不合格なら再生成（最大1回） ═══════
    let raw = await generateOnce(null);
    let parsed = parseResult(raw);

    // 検査（リライト欠落も検査対象に含める）
    let issues = [];
    if (!parsed.main) {
      // 最重要：リライト本文そのものが出力されていない
      issues.push("リライト本文が出力されていない。必ず[MAIN]...[/MAIN]の形式でリライト本文を出力すること（本投稿＋リプのモードでは[REPLY]...[/REPLY]も必ず出力）。採点JSONやずるい一言だけを出力してリライトを省略することは絶対に許されない");
    } else {
      issues = codeCheck(parsed.main, parsed.reply, mode, parsed.reply2);
      // AI審査：コードチェックが通っても品質面を確認
      if (issues.length === 0) {
        const review = await aiReview(apiKey, parsed.main, parsed.reply, mode, parsed.reply2);
        if (!review.pass) issues = review.issues;
      }
    }

    // 不合格なら指摘付きで1回だけ再生成
    if (issues.length > 0) {
      try {
        const retryRaw = await generateOnce(issues);
        const retryParsed = parseResult(retryRaw);
        if (retryParsed.main) {
          // 再生成でJSONが欠けた場合は初回の採点結果を引き継ぐ
          const merged = { ...retryParsed, scores: retryParsed.scores || parsed.scores, hooks: retryParsed.hooks || parsed.hooks };
          if (!parsed.main) {
            // 初回にリライトが無かった場合は無条件で採用
            raw = retryRaw;
            parsed = merged;
          } else {
            // 再生成分にNGワードが残っていないか最終確認（悪化していたら初回を採用）
            const retryIssues = codeCheck(retryParsed.main, retryParsed.reply, mode, retryParsed.reply2);
            const ngOnly = (arr) => arr.filter(i => i.includes("禁止ワード")).length;
            if (ngOnly(retryIssues) <= ngOnly(codeCheck(parsed.main, parsed.reply, mode, parsed.reply2))) {
              raw = retryRaw;
              parsed = merged;
            }
          }
        }
      } catch {}
    }

    // ═══════ レスポンス構築 ═══════
    // リライトが最後まで得られなかった場合は、採点だけ返さず明示的にエラーにする
    if (!parsed.main && !parsed.reply) {
      return NextResponse.json({ error: "改善版の投稿文を生成できませんでした。お手数ですが、もう一度お試しください。" }, { status: 502 });
    }

    if (!parsed.scores) {
      return NextResponse.json({
        scores: null,
        rewrite: { main: parsed.main, reply: parsed.reply, reply2: parsed.reply2 },
        hooks: parsed.hooks,
        partial: true,
      });
    }

    return NextResponse.json({
      ...parsed.scores,
      rewrite: { main: parsed.main, reply: parsed.reply, reply2: parsed.reply2 },
      hooks: parsed.hooks,
    });
  } catch (e) {
    const status = e.status || 500;
    return NextResponse.json({ error: e.message || "Internal server error" }, { status });
  }
}
