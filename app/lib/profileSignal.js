// プロフィールへのアクセス（ビューに対する率）を、投稿づくりの材料にするための計算。
// APIは呼ばない。並べる・選ぶ・入れ替える、の3つだけを担当する。
//
// 使う場面は2つ：
//   ・タブAの生成（/api/analyze）   … 多かった投稿の実例を、毎回入れ替えて渡す
//   ・考察の作成（/api/feedback/insight）… 多かった投稿と少なかった投稿を比べる材料を作る

// ═══════ 型の重複判定（もとは /api/analyze にあったものを共用のためここへ移した） ═══════
// 同じ題材の投稿が上位を占めると、実例を何本渡しても学べる型は1つしかない。
// 冒頭の文字2-gramの重なりで「同じ型」を機械的にまとめる。
// ひらがなを含めて比較すると、助詞や語尾の一致がノイズになって題材の一致が薄まる
// （同題材0.15〜0.34に対し別題材0.11まで上がり、分離できなかった）。
// 漢字・カタカナ・英数だけを残して内容語の重なりを見ると、はっきり分かれる。
export const SAME_TYPE_THRESHOLD = 0.40;

export function bigramSet(text) {
  // 内容語だけを残す（ひらがな・記号・空白を落とす）
  const t = (text || "").slice(0, 80).replace(/[^一-鿿゠-ヿA-Za-z0-9]/g, "");
  const set = new Set();
  for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
  return set;
}

// 重なり係数。片方が長くても、短いほうにどれだけ含まれるかで見る
export function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / Math.min(a.size, b.size);
}

// 上位から順に見て、すでに拾った投稿と型が重複するものは飛ばす
export function pickDistinctTypes(rows, limit, excludeGrams = []) {
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

// ═══════ プロフィールへのアクセス率 ═══════
export const MIN_EXAMPLES = 3;  // 実例を渡し始める件数（プロフィールへのアクセスを入力した投稿の数）
export const MIN_INSIGHT = 6;   // 考察を作り始める件数（多い側・少ない側を3件ずつ比べられる最小）
export const REFRESH_STEP = 3;  // 何件増えるごとに考察を作り直すか

// 率の高い順に並べる。
// ★生の率（アクセス÷ビュー）でそのまま並べない。ビューが少ない投稿は偶然で率が跳ねる
//   （ビュー50でアクセス3＝6% が、ビュー1万でアクセス200＝2% に勝ってしまう）。
//   そこで「このアカウントの平均」に寄せて補正する：補正後 = (アクセス + K×平均) ÷ (ビュー + K)
//   K はこのアカウントのビューの中央値。ビューが中央値の投稿は、自分の数字と平均が半々で効く。
//   ビューが多い投稿ほど自分の数字がそのまま通り、少ない投稿ほど平均に引き戻される。
//   アカウントの規模に合わせて K が決まるので、小さいアカウントでも大きいアカウントでも同じ意味になる。
export function rankByProfileRate(rows) {
  const data = (rows || [])
    .map(r => ({ ...r, v: Number(r.views), p: Number(r.profile_views) }))
    .filter(r => r.v > 0 && r.profile_views !== null && r.profile_views !== undefined && Number.isFinite(r.p) && r.p >= 0 && (r.main_post || "").trim());
  if (data.length === 0) return { n: 0, avg: 0, k: 0, ranked: [] };

  const sumV = data.reduce((s, r) => s + r.v, 0);
  const sumP = data.reduce((s, r) => s + r.p, 0);
  const avg = sumP / sumV;
  const vs = data.map(r => r.v).sort((a, b) => a - b);
  const k = vs.length % 2 ? vs[(vs.length - 1) / 2] : (vs[vs.length / 2 - 1] + vs[vs.length / 2]) / 2;

  const ranked = data
    .map(r => {
      const adj = (r.p + k * avg) / (r.v + k);
      return { ...r, raw: r.p / r.v, adj, lift: avg > 0 ? adj / avg : 0 };
    })
    .sort((a, b) => b.adj - a.adj);
  return { n: data.length, avg, k, ranked };
}

// 実例の候補。補正後の率が平均より1割以上高いものから、型の重複を除いて最大8本。
// 平均並み・平均以下の投稿は「多かった投稿」ではないので、件数が少なくても候補にしない。
// （ビューが極端に少ない投稿は、生の率が高くても補正で平均近くに戻るので、ここで外れる）
export const CANDIDATE_MIN_LIFT = 1.1;
export function pickCandidates(sig) {
  if (!sig || sig.n < MIN_EXAMPLES || sig.avg <= 0) return [];
  const above = sig.ranked.filter(r => r.lift >= CANDIDATE_MIN_LIFT);
  return pickDistinctTypes(above, 8);
}

// 候補から k 本を選ぶ。毎回同じ投稿にならないよう抽選するが、率が高い投稿ほど選ばれやすくする。
// （重みつきの非復元抽出：各候補に rand^(1/重み) の札を配り、大きい順に k 本取る）
export function sampleWeighted(cands, k, rand = Math.random) {
  if (!cands || cands.length === 0) return [];
  if (cands.length <= k) return [...cands];
  return cands
    .map(r => ({ r, key: Math.pow(rand(), 1 / Math.max(r.lift, 0.1)) }))
    .sort((a, b) => b.key - a.key)
    .slice(0, k)
    .map(x => x.r)
    .sort((a, b) => b.adj - a.adj);
}

// 考察の材料。多かった側と少なかった側を、重ならないように分ける
export function splitHighLow(sig) {
  if (!sig || sig.n < MIN_INSIGHT || sig.avg <= 0) return { high: [], low: [] };
  const high = sig.ranked.slice(0, Math.min(8, Math.ceil(sig.n / 2)));
  const low = sig.ranked.slice(sig.n - Math.min(6, Math.floor(sig.n / 2)));
  return { high, low };
}

// 考察を作り直すべきか。初回は MIN_INSIGHT 件から。以後は REFRESH_STEP 件増えるごと
export function shouldRefreshInsight(n, lastCount) {
  if (n < MIN_INSIGHT) return false;
  if (lastCount === null || lastCount === undefined) return true;
  return n >= Number(lastCount) + REFRESH_STEP;
}

export const per1000 = (rate) => (Number(rate) * 1000).toFixed(1);

const MODE_LABEL = { single: "本投稿のみ", singleShort: "本投稿のみ", tree: "本投稿＋リプ", treeAuto: "本投稿＋リプ" };
export const modeLabel = (m) => MODE_LABEL[m] || "";

const clip = (t, max) => {
  const s = (t || "").trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
};

// 生成に渡す実例1本ぶん（抜粋と数字）。プロンプトを組み立てる側は、この形だけを受け取る
export function toExample(r) {
  return {
    per1000: per1000(r.raw),
    views: r.v.toLocaleString("ja-JP"),
    mode: modeLabel(r.mode),
    main: clip(r.main_post, 140),
    reply: (r.reply_post || "").trim() ? clip(r.reply_post, 80) : "",
  };
}

// 考察を作るときにモデルへ渡す本文（多かった投稿・少なかった投稿の一覧）
export function buildInsightInput(sig) {
  const { high, low } = splitHighLow(sig);
  const fmt = (r, tag, i) => {
    const m = modeLabel(r.mode);
    let s = `[${tag}${i + 1}] ビュー1,000あたり${per1000(r.raw)}件／ビュー${r.v.toLocaleString("ja-JP")}${m ? `／形式：${m}` : ""}\n本投稿：${clip(r.main_post, 220)}`;
    if ((r.reply_post || "").trim()) s += `\nリプ：${clip(r.reply_post, 160)}`;
    return s;
  };
  return [
    `このアカウントの平均：ビュー1,000あたり${per1000(sig.avg)}件（プロフィールへのアクセスを記録した投稿 ${sig.n}件）`,
    "",
    "【プロフィールへのアクセスが多かった投稿】",
    ...high.map((r, i) => fmt(r, "多", i)),
    "",
    "【少なかった投稿】",
    ...low.map((r, i) => fmt(r, "少", i)),
  ].join("\n");
}
