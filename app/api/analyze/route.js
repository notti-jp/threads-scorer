// [変更: v4.0-AgentLoop] 自動改善ループ（生成→検査→再生成）対応
import { NextResponse } from "next/server";
import { SCORE_PROMPT, TAB_A_FINAL_CHECK, HOOK_PATTERN_CATALOG, HOOK_CANDIDATES_INSTRUCTION, APPEAL_TO_POST_INSTRUCTION, buildStyleInstruction, buildKnowledgePriorityA, buildZuruiInstructionA } from "../../prompts";
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

// ═══════ ナレッジ由来のチェック ═══════
// ナレッジに「禁止」「厳守」と明記されているのに、これまでどこでも検査していなかったもの。
// 空行→「　」の整形はUI側（cleanText / cleanReplyText）が自動で直すので、ここでは扱わない。
const DECOR_PATTERNS = [
  { re: /[✅❌⭕✨📌💡👉🔎🔥🚀]/u, label: "装飾絵文字（✅❌📌💡👉等）が含まれている。ナレッジの禁止記号にあたるため削除すること" },
  { re: /[〝〟]/, label: "〝〟（ダブルプライム引用符）が含まれている。強調は「」を使うこと" },
  { re: /＊/, label: "＊（全角アスタリスク）が含まれている。削除すること" },
  { re: /"/, label: 'ASCIIのダブルクォート(")が含まれている。強調は「」に置き換えること' },
  { re: /^[ 　]*[■●▶]/m, label: "■●▶の記号見出しが使われている。見出し装飾は禁止なので地の文に戻すこと" },
  { re: /^[ 　]*【[^】]*】[ 　]*$/m, label: "【】で囲んだ見出し風の装飾が使われている。禁止なので地の文に戻すこと" },
  { re: /^[ 　]*\d+[.．)）][ 　]/m, label: "番号リスト（1. 2. 3.）が使われている。整理された説明資料に見えるためThreadsでは不自然。地の文に戻すこと" },
];

// 品位が下がるため使わない、とナレッジで明示されている語。
// codeCheck が見るのは本文（[MAIN]/[REPLY]/[REPLY2]）だけで、[HOOKS]の一言候補は対象外。
// 「ヤバい」は冒頭の一言としては許可し、本文では禁止する、という切り分けを意図的にそうしている。
const TONE_NG_PATTERNS = [
  { re: /マジで/, label: "「マジで」" },
  { re: /ヤバい|やばい/, label: "「ヤバい」" },
  { re: /ガチで/, label: "「ガチで」" },
  { re: /死ぬほど/, label: "「死ぬほど」" },
];

// 詩的AI語。既存の禁止フレーズはビジネス調（「〜が重要です」等）しか止めておらず、
// この系統は1つも検査されていなかった。実際に「AIっぽい」と指摘された言い回し
const POETIC_AI_PATTERNS = [
  { re: /静かに(変化|変わ|効い)/, label: "「静かに変化する」系" },
  { re: /(大切|小さ|確か)な一歩/, label: "「大切な一歩」系" },
  { re: /そっと(背中を押|寄り添)/, label: "「そっと背中を押す」系" },
  { re: /心が動く瞬間/, label: "「心が動く瞬間」" },
  { re: /その先にある景色|新しい景色/, label: "「その先にある景色」系" },
  { re: /少しずつ、?確実に|ゆっくりでいい/, label: "「少しずつ、確実に」系" },
];

// 文末の単調さ。
// 「です。ます。です。ます。」は"同じ語尾の3連続"ではなく交互なので、連続回数では捕まらない。
// 実際の症状は「文末が丁寧語ばかりでリズムがない」ことなので、丁寧語の比率で判定する。
const POLITE_ENDING_RE = /(です|ます|でした|ました|ですね|ますね|でしょう|ください|ませんか?)$/;

function politeEndingStats(text) {
  if (!text) return null;
  // 句点だけでなく改行でも文を区切る（体言止めの行を数え落とさないため）
  const sentences = text.split(/[。\n]/).map(s => s.trim()).filter(s => s && s !== "　");
  if (sentences.length < 4) return null; // 短すぎると比率が意味を持たない
  const polite = sentences.filter(s => POLITE_ENDING_RE.test(s)).length;
  return { total: sentences.length, polite, ratio: polite / sentences.length };
}

// 接続の言葉だけで終わる断片行。「実は。」のように、それ単体では意味を持たない
const DANGLING_LINE_RE = /^(実は|それは|理由は|原因は|答えは|問題は|でも|しかも|つまり|ただ|要は|結論は|正直|ぶっちゃけ)[。、…]*$/;

// 段落の細切れ。「　」は段落と段落のあいだにだけ置くルールだが、
// つながる文が1行ずつ「　」で切り離されると細切れに見える。
// ★先頭と末尾の段落は数えない。リプの1行目（即答）と最後の締めは、
//   1行だけの段落になるのがナレッジ上むしろ正しい形のため。中間の段落だけを見る。
function middleParagraphStats(text) {
  if (!text) return null;
  const blocks = [];
  let cur = [];
  for (const line of text.split("\n")) {
    if (/^[ 　]*$/.test(line)) {
      if (cur.length) blocks.push(cur);
      cur = [];
    } else {
      cur.push(line);
    }
  }
  if (cur.length) blocks.push(cur);
  const middle = blocks.slice(1, -1);
  if (middle.length < 2) return null;
  const singles = middle.filter(b => b.length === 1).length;
  const avg = middle.reduce((s, b) => s + b.length, 0) / middle.length;
  return { count: middle.length, singles, avg };
}

// 接続詞は1投稿に最大1つ。文頭で使われたものだけを数える。
// 「また」は「または」「またぐ」「またたく」と紛れるため、そこだけ除外する
const CONNECTIVE_RE = /(^|[\n。、「（])(しかし|また(?!は|ぐ|たく|たせ)|そして|さらに|そのため|したがって|つまり)/g;

function countConnectives(text) {
  if (!text) return 0;
  return (text.match(CONNECTIVE_RE) || []).length;
}

function countLines(text) {
  // 全角スペースだけの行（段落区切り）は行数に含めない
  return text.split("\n").filter(l => l.trim() !== "" && l !== "　").length;
}

function codeCheck(main, reply, mode, reply2, originalText) {
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
  if (mode === "treeAuto" && replyLines > 12 && !(reply2 || "").trim()) issues.push(`リプが${replyLines}行あり12行を超えているのに1つのままになっている。[REPLY]は12行以内に収め、残りを必ず[REPLY2]に分割すること。リプ①の最後は言い切らず、続きが気になる形（核心の直前で止める等）で終えること`);
  if ((mode === "tree" || mode === "treeAuto") && mainLines === 1) issues.push(`本投稿が1行だけになっている。2〜3行にしてフックとしての厚みを持たせること`);

  // 締めの「…」チェック（投稿全体の締め＝singleは本投稿末尾、treeはリプ末尾）
  const closing = (mode === "tree" || mode === "treeAuto") ? ((reply2 || "").trim() || (reply || "").trim()) : main.trim();
  if (/[…]{1,}。?$/.test(closing)) issues.push(`投稿の締めが「…」で終わっている。言い切りで着地させること`);

  // 元の投稿にあった案内（プロフィール・固定記事など）が消えていないか
  if (originalText) {
    const guideWords = ["プロフ", "固定記事", "ハイライト"];
    const inOriginal = guideWords.filter(w => originalText.includes(w));
    if (inOriginal.length > 0 && !guideWords.some(w => whole.includes(w))) {
      issues.push(`元の投稿にあった「${inOriginal[0]}」への案内が改善版から消えている。案内は削除せず必ず残すこと。ただし宣伝口調にならないよう自然な言い回しに整えること（例：「プロフ固定記事にまとめてます」→「プロフ固定記事が参考になるはずです」）`);
    }
  }

  // 禁止記号・装飾
  for (const p of DECOR_PATTERNS) {
    if (p.re.test(whole)) issues.push(p.label);
  }

  // 品位が下がるワード
  const toneHits = TONE_NG_PATTERNS.filter(p => p.re.test(whole)).map(p => p.label);
  if (toneHits.length > 0) {
    issues.push(`${toneHits.join("・")}が使われている。品位が下がるためナレッジで使用禁止。別の感情語（焦った／震えた／衝撃だった等）に置き換えること`);
  }

  // 詩的AI語
  const poeticHits = POETIC_AI_PATTERNS.filter(p => p.re.test(whole)).map(p => p.label);
  if (poeticHits.length > 0) {
    issues.push(`${poeticHits.join("・")}が使われている。普通に喋っていて出てこない言い回しで、AIが書いた文章に見える。その場で実際に起きたことに書き換えること（例：「静かに変化していきます」→「気づいたら、3週間で書く速さが倍になってた」）`);
  }

  // 接続詞は1投稿に最大1つ。本投稿・リプ・リプ2をそれぞれ1投稿として数える
  const parts = [["本投稿", main], ["リプ", reply], ["リプ2", reply2]];
  // 意味を持たない断片行（「実は。」など）。冒頭で出ると読者は何も分からず離脱する
  for (const [label, part] of parts) {
    const dangling = (part || "").split("\n").map(l => l.trim()).find(l => DANGLING_LINE_RE.test(l));
    if (dangling) {
      issues.push(`${label}に「${dangling}」という、それだけでは意味が通らない断片の行がある。短くするために文を途中で止めないこと。「実はAIに書けないものが一つだけある」のように、何の話かが分かる形まで書ききる（答えの中身だけを伏せる）`);
    }
  }

  // 段落の細切れ（リプ側のみ。本投稿は2〜3行なので段落分けの対象外）
  for (const [label, part] of [["リプ", reply], ["リプ2", reply2]]) {
    const ps = middleParagraphStats(part);
    if (ps && (ps.singles >= 2 || ps.avg < 2)) {
      issues.push(`${label}の段落が細切れになっている（中間の${ps.count}段落の平均${ps.avg.toFixed(1)}行）。「　」で1行ずつ切り離さず、意味のまとまり2〜4行を1つの段落にまとめ、そのまとまりの後ろにだけ「　」を置くこと。21文字で折り返した行は同じ段落の続きなので「　」を入れない`);
    }
  }

  for (const [label, part] of parts) {
    const st = politeEndingStats(part);
    if (st && st.ratio >= 0.8) {
      issues.push(`${label}の文末が丁寧語ばかりになっている（${st.total}文中${st.polite}文が「です・ます」系）。リズムがなくAIが書いた文章に見える。友達に話しかけるつもりで「〜だった」「〜なんだよね」「〜でしょ」「〜かも」を混ぜること`);
    }
  }
  for (const [label, part] of parts) {
    const n = countConnectives(part);
    if (n >= 2) {
      issues.push(`${label}に接続詞（しかし・また・そして・さらに・そのため・したがって・つまり）が${n}回ある。1投稿につき最大1つ。残りは削って改行で切ること`);
    }
  }

  // 冒頭1〜2行は短く刻む（本投稿の最初の2行だけが対象。3行目以降とリプは対象外）
  const openingLines = main.split("\n").map(l => l.trim()).filter(l => l && l !== "　").slice(0, 2);
  const longOpening = openingLines.find(l => l.length > 22);
  if (longOpening) {
    issues.push(`本投稿の冒頭が長い（${longOpening.length}文字）。冒頭1〜2行は1文20文字前後で言い切り、テンポで読ませること。該当：「${longOpening.slice(0, 30)}」`);
  }

  // 1行の長さ。ナレッジの目安は20文字。読みにくさの指摘が続いたため22文字超×2行で弾く
  // （以前は25文字超×3行で、リプ側の長い行がほとんど素通りしていた）
  const longLines = whole.split("\n").map(l => l.trim()).filter(l => l !== "" && l !== "　" && l.length > 22);
  if (longLines.length >= 2) {
    const longest = longLines.reduce((a, b) => (b.length > a.length ? b : a));
    issues.push(`1行が長すぎる行が${longLines.length}行ある（最長${longest.length}文字）。スマホの1行は20〜21文字が目安。意味の切れ目で改行すること（改行を増やすだけで、段落の区切り「　」は増やさない）。該当例：「${longest.slice(0, 30)}…」`);
  }

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
7. 事実の報告だけで終わっていないか。読み手の心が動く要素（この先で何かが変わる予感／読み手自身が当事者だと感じる／まだ明かされていないものがある）が投稿全体に1つも見当たらず、出来事や情報をただ並べているだけだと明確に言える場合のみ指摘する。※「もっと感情を込められる」程度の改善余地は指摘しない。何か1つでもスイッチが機能していれば合格とする
8. 読み手の側に立って書けているか。書き手の実績・経歴や機能・スペックの説明が中心で、読み手にとって何が変わるのかが最後まで一度も示されないまま終わっていると明確に言える場合のみ指摘する。※部分的に自分語りがあること自体は問題ない。投稿全体を通して読み手視点が皆無な場合だけ指摘する。※★重要：「フォローを促す一言がない」「行動喚起がない」ことは欠点ではないので絶対に指摘しないこと。誘導を書き足す提案もしないこと。逆に、投稿内に案内（プロフィール・固定記事・note等）が含まれている場合は、それが宣伝口調・押し売り口調で浮いているときだけ「自然な言い回しに整える」よう指摘する（案内の存在自体は問題ない）

9. 投稿の中身を最後まで全部明かして終わっていないか。読み終えた読者が「で、それ具体的にどうやるの？」と思う余地が1つも残っておらず、やり方・数字の中身・きっかけの正体のすべてが説明しきられていると明確に言える場合のみ指摘する。※「文として言い切って締める」ことは正しい形なので、それ自体を指摘してはいけない。伏せるべきは中身であって文の閉じ方ではない。※余韻や解釈の余地が1つでもあれば合格とする

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
    logUsage("aiReview", data.usage);
    const raw = data.content?.map((c) => c.text || "").join("") || "";
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return { pass: true, issues: [] };
    const parsed = JSON.parse(m[0]);
    return { pass: !!parsed.pass, issues: Array.isArray(parsed.issues) ? parsed.issues.slice(0, 4) : [] };
  } catch {
    return { pass: true, issues: [] };
  }
}

// ═══════ フィードバックの型判定（追加のAPI呼び出しはしない） ═══════
// 同じ題材の投稿が上位を占めると、実例を何本渡しても学べる型は1つしかない。
// 冒頭の文字2-gramの重なり（Jaccard係数）で「同じ型」を機械的にまとめる。
// ひらがなを含めて比較すると、助詞や語尾の一致がノイズになって題材の一致が薄まる
// （同題材0.15〜0.34に対し別題材0.11まで上がり、分離できなかった）。
// 漢字・カタカナ・英数だけを残して内容語の重なりを見ると、はっきり分かれる。
const SAME_TYPE_THRESHOLD = 0.40;

function bigramSet(text) {
  // 内容語だけを残す（ひらがな・記号・空白を落とす）
  const t = (text || "").slice(0, 80).replace(/[^一-鿿゠-ヿA-Za-z0-9]/g, "");
  const set = new Set();
  for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
  return set;
}

// 重なり係数。片方が長くても、短いほうにどれだけ含まれるかで見る
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / Math.min(a.size, b.size);
}

// 上位から順に見て、すでに拾った投稿と型が重複するものは飛ばす
function pickDistinctTypes(rows, limit, excludeGrams = []) {
  const picked = [];
  const grams = [...excludeGrams];
  for (const r of rows) {
    const g = bigramSet(r.main_post);
    if (grams.some(x => jaccard(g, x) >= SAME_TYPE_THRESHOLD)) continue;
    picked.push(r);
    grams.push(g);
    if (picked.length >= limit) break;
  }
  return picked;
}

function firstLineOf(text, max = 30) {
  const line = (text || "").split("\n").map(s => s.trim()).find(s => s && s !== "　") || "";
  return line.length > max ? `${line.slice(0, max)}…` : line;
}

function excerptOf(text, max = 150) {
  const t = (text || "").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

const fmtViews = v => `${Number(v).toLocaleString("ja-JP")}ビュー`;

// ═══════ トークン使用量ログ（コスト計測用） ═══════
// APIは毎回 usage を返しているのに使っていなかったので記録する。
// cache_read_input_tokens が常に0＝キャッシュが一度も効いていない、と判断できる。
function logUsage(label, usage) {
  if (!usage) return;
  const read = usage.cache_read_input_tokens || 0;
  const write = usage.cache_creation_input_tokens || 0;
  const fresh = usage.input_tokens || 0;
  const hit = read > 0 ? "HIT" : "MISS";
  console.log(`[usage] ${label} cache=${hit} read=${read} write=${write} uncached=${fresh} out=${usage.output_tokens || 0}`);
}

// ═══════ 自動修正 ═══════
// ナレッジ違反のうち、文字レベルで確実に直せるものだけをコードで直す。
// これをやらないと「絵文字が1つ入っていた」だけで再生成（＝APIをもう1往復・約16円）が走る。
// 意味の書き換えが必要なもの（番号リスト・品位ワード・接続詞過多・長すぎる行・禁止ワード）は
// 機械的に直せないので、従来どおり再生成に回す。
function autoRepair(text) {
  if (!text) return text;
  let t = text;

  // 装飾絵文字（ナレッジの禁止記号）
  t = t.replace(/[✅❌⭕✨📌💡👉🔎🔥🚀]/gu, "");
  // 〝〟（ダブルプライム引用符）→ 「」
  t = t.replace(/〝/g, "「").replace(/〟/g, "」");
  // ＊（全角アスタリスク）
  t = t.replace(/＊/g, "");
  // ASCIIのダブルクォート → 「」（開き・閉じを交互に割り当てる）
  let openQuote = true;
  t = t.replace(/"/g, () => (openQuote = !openQuote) ? "」" : "「");
  // 行頭の記号見出し
  t = t.replace(/^[ 　]*[■●▶][ 　]*/gm, "");
  // 投稿の締めが「…」で終わっている → 言い切りにする
  t = t.replace(/[…]+\s*。?\s*$/, "。");

  // 記号を消した跡に残る余分な空白を整える（行数・改行構造は変えない）
  t = t.split("\n").map(l => {
    // 空白だけの行は段落区切り。全角スペース1文字に正規化して残す
    if (/^[ 　]*$/.test(l)) return l.includes("　") ? "　" : l;
    return l.replace(/^[ 　]+/, "").replace(/[ 　]+$/, "");
  }).join("\n");
  return t.trim();
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
  // 検査より前に自動修正をかける。直せる違反で再生成を走らせないため
  return {
    scores,
    main: autoRepair(mainMatch?.[1]?.trim() || ""),
    reply: autoRepair(replyMatch?.[1]?.trim() || ""),
    reply2: autoRepair(reply2Match?.[1]?.trim() || ""),
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
    // パターン集は候補提案の参照元。指示より先に置いて、指示が実体を指せるようにする
    const staticPrompt = useHook ? SCORE_PROMPT + HOOK_PATTERN_CATALOG + HOOK_CANDIDATES_INSTRUCTION : SCORE_PROMPT;

    let dynamicPrompt = "";
    if (isAppeal) dynamicPrompt += APPEAL_TO_POST_INSTRUCTION;
    dynamicPrompt += buildStyleInstruction(styleProfile);
    dynamicPrompt += buildKnowledgePriorityA(knowledgePriority);
    if (useHook) dynamicPrompt += buildZuruiInstructionA(isAppeal ? "appeal" : "normal");

    // ═══════ フィードバックの参照 ═══════
    // 構成：1行目3本（型はすべて別）＋ 全文2本 ＋ リプ1本（ツリー時のみ）＋ 伸びなかった1行目1本
    //
    // 選び方：
    //   ・リーチした順（views DESC）。反応が薄い当たり投稿を教材にしないため、
    //     エンゲージメント率が中央値以上のものに絞る（母数6件未満のときは絞らない）
    //   ・同じ題材の投稿が上位を独占すると学べる型が1つに縮むため、冒頭の類似度で型をまとめ、
    //     グループごとに最上位の1本だけを採用する
    //   ・comments が NULL でも計算が壊れないよう COALESCE で 0 として扱う
    //     （PostgreSQL の DESC は既定で NULLS FIRST のため、放置すると未入力行が上位を占める）
    if (username) {
      try {
        const sql = getDb();
        const rows = await sql`
          SELECT main_post, reply_post, views,
                 COALESCE(likes, 0) AS likes,
                 COALESCE(comments, 0) AS comments
          FROM feedbacks
          WHERE username = ${username}
            AND views > 0
            AND main_post IS NOT NULL AND main_post <> ''
          ORDER BY views DESC
          LIMIT 60
        `;

        if (rows.length > 0) {
          const scored = rows.map(r => ({
            ...r,
            eng: (Number(r.likes) + Number(r.comments) * 2) / Number(r.views),
          }));

          // エンゲージメント率の中央値（母数が少ないときは絞り込みを外す）
          const engSorted = scored.map(r => r.eng).sort((a, b) => a - b);
          const mid = (engSorted.length - 1) / 2;
          const median = Number.isInteger(mid)
            ? engSorted[mid]
            : engSorted[Math.floor(mid)] +
              (engSorted[Math.ceil(mid)] - engSorted[Math.floor(mid)]) * (mid - Math.floor(mid));
          const enoughData = scored.length >= 6;
          const successPool = enoughData ? scored.filter(r => r.eng >= median) : scored;

          const successes = pickDistinctTypes(successPool, 3);
          const usedGrams = successes.map(r => bigramSet(r.main_post));

          // 伸びなかった投稿（母数が足りるときだけ。ビューの少ない順、成功例と型が被らないもの）
          const failures = enoughData
            ? pickDistinctTypes([...scored].sort((a, b) => a.views - b.views), 1, usedGrams)
            : [];

          const isTree = mode === "tree" || mode === "treeAuto";
          const replySample = isTree ? successes.find(r => (r.reply_post || "").trim()) : null;

          if (successes.length > 0) {
            dynamicPrompt += "\n\n【あなたの過去の実データ】\n";
            dynamicPrompt += "以下はこのアカウントで実際に起きた結果です。一般論より優先して参考にすること。\n";
            dynamicPrompt += "同じ型の投稿はまとめてあるので、並んでいるものはすべて別の型です。\n";

            dynamicPrompt += "\n■ 実際に伸びた1行目（届いた順）\n";
            successes.forEach((p, i) => {
              dynamicPrompt += `${i + 1}. 「${firstLineOf(p.main_post)}」（${fmtViews(p.views)}）\n`;
            });
            dynamicPrompt += "→ どれか1つに寄せず、今回の素案の内容に合う型を選ぶこと。\n";

            dynamicPrompt += "\n■ 伸びた投稿の本文（文体・段落の切り方・運び方の手本）\n";
            successes.slice(0, 2).forEach((p, i) => {
              dynamicPrompt += `【${i + 1}】${fmtViews(p.views)}\n${excerptOf(p.main_post)}\n`;
            });
            dynamicPrompt += "→ 語尾のリズム、段落の分け方、1行目から2行目への運び方を参考にすること。内容はコピーしない。\n";

            if (replySample) {
              dynamicPrompt += "\n■ そのリプ（ツリーの運び方の手本）\n";
              dynamicPrompt += `${excerptOf(replySample.reply_post)}\n`;
              dynamicPrompt += "→ 本投稿からリプへの繋ぎ方と、リプ1行目の入り方を参考にすること。\n";
            }

            if (failures.length > 0) {
              dynamicPrompt += "\n■ 伸びなかった1行目（反面教師）\n";
              dynamicPrompt += `「${firstLineOf(failures[0].main_post)}」（${fmtViews(failures[0].views)}）\n`;
              dynamicPrompt += "→ この1行目では知らない読者の手が止まらなかった。同じ入り方をしないこと。\n";
            }
          }
        }
      } catch {}
    }

    // ナレッジの棚卸しと出力前チェックは必ず最後（ユーザーの投稿文の直前）に置く。
    // 分量の多いナレッジは、後ろに来る指示に押されて落ちるため、直前で拾い直す
    dynamicPrompt += TAB_A_FINAL_CHECK;

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
      treeAuto: `以下のThreads投稿を採点してください。リライトは「本投稿＋リプ・元の長さに合わせる」モードで出力してください。まず「この投稿全体で伝える気づき」を1行で内部的に決めてから、本投稿=問い／リプ=答えと着地、という1つの話の流れとして書くこと（ツリー全体の一貫性設計に従う）。本投稿は2〜3行（1行だけにせず、フックとして成立する厚みを残す）。★リプの長さは行数を固定せず、入力された元の投稿文の情報量に合わせること：元が短ければリプも短く（無理に引き伸ばさない）、元が長く内容が濃ければリプも長く書く。このモードでは300字上限は適用されない。★★分割ルール（最重要・厳守）：リプの本文が12行を超える（13行以上になる）場合は、絶対に1つのリプにまとめず、必ず[REPLY]と[REPLY2]の2つのタグに分割して出力すること。[REPLY]に12行以内で前半を入れ、意味の区切りのよいところで区切って、残りを[REPLY2]に入れる。Threadsは長い投稿を途中で「…」と省略してしまうため、13行以上を1つのリプにすることは必ず避ける。リプが12行以内に収まる場合のみ[REPLY]だけを出力し、[REPLY2]は出力しない。★分割するときの繋ぎ目：[REPLY]（リプ①）の最後は言い切って完結させず、リプ②を自然に読みたくなる状態で終えること。「続きは↓」「以下に続く」のような浅い直接誘導は絶対に禁止。内容そのものの力で続きを読ませる（例：核心の直前で止めてリプ②冒頭で即答する／リストの途中で切り「残りが一番効く」と示す／「でも、ここで多くの人が落とし穴にはまる。」のように問いを持ち越す）。[REPLY2]の1行目は前置きなしで自然に続きから始める。リプの1行目は前置きを入れず、答えそのもの／リストの1行目／読者の心の声のどれかで即座に書き出すこと（2行目以降は通常どおり展開）。リプは必ず2〜3行ごとに段落を分け、段落と段落の間に「　」（全角スペース1文字だけの行）を入れて読みやすくすること。この区切り行は行数に数えない`,
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
      // コスト実測用。プロンプトキャッシュが当たっているかはここでしか分からない。
      // cache_read が毎回0なら5分TTLが短すぎるということなので、TTLの判断材料にする
      logUsage(retryIssues ? "generate(retry)" : "generate", data.usage);
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
      issues = codeCheck(parsed.main, parsed.reply, mode, parsed.reply2, text);
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
            // 再生成が悪化していないか最終確認（悪化していたら初回を採用）
            // NGワードだけでなくチェック全体の件数も比べる。ナレッジ由来のチェックを増やしたぶん、
            // 「NGワードは直ったが装飾記号が増えた」のような差し替えを防ぐ必要があるため
            const retryIssues = codeCheck(retryParsed.main, retryParsed.reply, mode, retryParsed.reply2, text);
            const firstIssues = codeCheck(parsed.main, parsed.reply, mode, parsed.reply2, text);
            const ngOnly = (arr) => arr.filter(i => i.includes("禁止ワード")).length;
            if (ngOnly(retryIssues) <= ngOnly(firstIssues) && retryIssues.length <= firstIssues.length) {
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
